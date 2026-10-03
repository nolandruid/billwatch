/**
 * In-memory Supabase stand-in for unit tests. Not imported by production code.
 * Nested `table!inner(...)` selects are joined on `*_id` foreign keys.
 */

export type FakeRow = Record<string, unknown>;

export interface FakeDb {
  subscribers: FakeRow[];
  subscriptions: FakeRow[];
  bills: FakeRow[];
  bill_status_history: FakeRow[];
  digest_outbox: FakeRow[];
  notifications_outbox: FakeRow[];
}

type Filter = (row: FakeRow) => boolean;

function newId(): string {
  return crypto.randomUUID();
}

function subscriberDefaults(row: FakeRow): FakeRow {
  return {
    id: newId(),
    confirmed: false,
    confirm_token: newId(),
    unsubscribe_token: newId(),
    digest_opt_in: false,
    created_at: new Date().toISOString(),
    ...row,
  };
}

function getNested(row: FakeRow, path: string): unknown {
  if (path.includes(".")) {
    return path.split(".").reduce<unknown>((acc, key) => {
      if (acc && typeof acc === "object") return (acc as FakeRow)[key];
      return undefined;
    }, row);
  }
  return row[path];
}

function applyJoin(select: string, db: FakeDb, rows: FakeRow[]): FakeRow[] {
  let result = rows;
  if (select.includes("subscribers")) {
    result = result
      .map((row) => ({
        ...row,
        subscribers: db.subscribers.find((s) => s.id === row.subscriber_id) ?? null,
      }))
      .filter((row) => (select.includes("subscribers!inner") ? row.subscribers : true));
  }
  if (select.includes("bills")) {
    result = result
      .map((row) => ({
        ...row,
        bills: db.bills.find((b) => b.id === row.bill_id) ?? null,
      }))
      .filter((row) => (select.includes("bills!inner") ? row.bills : true));
  }
  return result;
}

export function createFakeSupabase(seed: Partial<FakeDb> = {}) {
  const db: FakeDb = {
    subscribers: (seed.subscribers ?? []).map(subscriberDefaults),
    subscriptions: [...(seed.subscriptions ?? [])],
    bills: [...(seed.bills ?? [])],
    bill_status_history: [...(seed.bill_status_history ?? [])],
    digest_outbox: [...(seed.digest_outbox ?? [])],
    notifications_outbox: [...(seed.notifications_outbox ?? [])],
  };

  function from(table: keyof FakeDb | string) {
    const tableName = table as keyof FakeDb;
    let selectStr = "*";
    const filters: Filter[] = [];
    let pendingInsert: FakeRow[] | null = null;
    let pendingUpdate: FakeRow | null = null;
    let pendingDelete = false;
    let pendingUpsert: {
      rows: FakeRow[];
      onConflict?: string;
      ignoreDuplicates?: boolean;
    } | null = null;
    let limitN: number | null = null;

    const api = {
      select(cols?: string) {
        if (cols) selectStr = cols;
        return api;
      },
      eq(col: string, value: unknown) {
        filters.push((row) => getNested(row, col) === value);
        return api;
      },
      gte(col: string, value: string) {
        filters.push((row) => String(row[col] ?? "") >= value);
        return api;
      },
      ilike(col: string, value: string) {
        const needle = value.replace(/%/g, "").toLowerCase();
        filters.push((row) => String(row[col] ?? "").toLowerCase() === needle);
        return api;
      },
      limit(n: number) {
        limitN = n;
        return api;
      },
      order() {
        return api;
      },
      insert(data: FakeRow | FakeRow[]) {
        pendingInsert = Array.isArray(data) ? data : [data];
        return api;
      },
      update(data: FakeRow) {
        pendingUpdate = data;
        return api;
      },
      delete() {
        pendingDelete = true;
        return api;
      },
      upsert(
        data: FakeRow | FakeRow[],
        opts?: { onConflict?: string; ignoreDuplicates?: boolean; count?: string },
      ) {
        pendingUpsert = {
          rows: Array.isArray(data) ? data : [data],
          onConflict: opts?.onConflict,
          ignoreDuplicates: opts?.ignoreDuplicates,
        };
        return api;
      },
      maybeSingle() {
        return execute("maybe");
      },
      single() {
        return execute("single");
      },
      then(resolve: (value: unknown) => unknown, reject?: (err: unknown) => unknown) {
        return execute("many").then(resolve, reject);
      },
    };

    async function execute(mode: "many" | "single" | "maybe") {
      const tableRows = db[tableName];
      if (!tableRows) {
        return {
          data: mode === "many" ? [] : null,
          error: { message: `unknown table ${table}` },
          count: 0,
        };
      }

      if (pendingInsert) {
        const inserted: FakeRow[] = pendingInsert.map((row) => {
          const withDefaults =
            tableName === "subscribers" ? subscriberDefaults(row) : { id: newId(), ...row };
          tableRows.push(withDefaults);
          return withDefaults;
        });
        pendingInsert = null;
        const data = mode === "many" ? inserted : (inserted[0] ?? null);
        return {
          data,
          error: data || mode === "many" ? null : { message: "empty" },
          count: inserted.length,
        };
      }

      if (pendingUpsert) {
        const conflictKeys = (pendingUpsert.onConflict ?? "id")
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean);
        let inserted = 0;
        for (const row of pendingUpsert.rows) {
          const exists = tableRows.some((existing) =>
            conflictKeys.every((key) => existing[key] === row[key]),
          );
          if (exists) {
            if (!pendingUpsert.ignoreDuplicates) {
              const idx = tableRows.findIndex((existing) =>
                conflictKeys.every((key) => existing[key] === row[key]),
              );
              tableRows[idx] = { ...tableRows[idx], ...row };
            }
            continue;
          }
          tableRows.push({ id: newId(), state: "pending", attempts: 0, ...row });
          inserted += 1;
        }
        pendingUpsert = null;
        return { data: null, error: null, count: inserted };
      }

      let matched = applyJoin(selectStr, db, tableRows).filter((row) =>
        filters.every((fn) => fn(row)),
      );

      if (pendingUpdate) {
        const patch = pendingUpdate;
        pendingUpdate = null;
        const ids = new Set(matched.map((row) => row.id));
        for (let i = 0; i < tableRows.length; i += 1) {
          if (ids.has(tableRows[i]?.id)) {
            tableRows[i] = { ...tableRows[i], ...patch };
          }
        }
        matched = applyJoin(selectStr, db, tableRows).filter((row) => ids.has(row.id));
      }

      if (pendingDelete) {
        pendingDelete = false;
        const ids = new Set(matched.map((row) => row.id));
        const remaining = tableRows.filter((row) => !ids.has(row.id));
        tableRows.length = 0;
        tableRows.push(...remaining);
        // cascade subscriber deletes the way Postgres would
        if (tableName === "subscribers") {
          for (const related of [
            "subscriptions",
            "digest_outbox",
            "notifications_outbox",
          ] as const) {
            db[related] = db[related].filter((row) => !ids.has(row.subscriber_id));
          }
        }
      }

      if (limitN != null) matched = matched.slice(0, limitN);

      if (mode === "many") return { data: matched, error: null, count: matched.length };
      if (mode === "maybe") return { data: matched[0] ?? null, error: null, count: matched.length };
      if (!matched[0]) return { data: null, error: { message: "not found" }, count: 0 };
      return { data: matched[0], error: null, count: 1 };
    }

    return api;
  }

  return { from, db };
}
