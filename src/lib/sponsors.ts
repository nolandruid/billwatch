/**
 * Sponsor photos.
 *
 * LEGISinfo gives us a sponsor's name but no photo. We assemble photos from two official-ish
 * sources and merge them into one name → photo map:
 *   - openparliament.ca — a photo for (nearly) every sitting MP.
 *   - sencanada.ca — the Senate's own portraits, for Senators (whom openparliament omits).
 * Sponsors are looked up by a normalized name key; anyone we still can't match falls back to
 * an initials avatar.
 *
 * openparliament is an independent, open project (a data ally, credited in docs/data-sources);
 * the Senate portraits come from Parliament's own site. We cache both aggressively to be a
 * good citizen.
 */

const OP_BASE = "https://openparliament.ca";
const OP_API = "https://api.openparliament.ca";
const SEN_BASE = "https://sencanada.ca";
/** Bulk "senator tiles" partial — every senator with portrait + slug in one response. */
const SEN_ENDPOINT = `${SEN_BASE}/umbraco/surface/SenatorsAjax/GetSenators?displayFor=senatorstiles`;
const USER_AGENT = "BillWatch/0.1 (+https://billwatch.ca)";
const CACHE_SECONDS = 86_400; // 1 day

interface OpPolitician {
  name: string;
  image: string | null;
}

interface OpPoliticianList {
  objects: OpPolitician[];
}

const HONORIFICS =
  /^(the\s+)?(rt\.?\s*|right\s+)?(hon\.?|l['’]?hon\.?|hon(?:ou)?rable|sen\.?|mr\.?|mrs\.?|ms\.?|dr\.?)\s+/i;

/** Canonical key for matching names across sources: strip honorifics + diacritics, lowercase. */
export function sponsorKey(name: string): string {
  return name
    .replace(HONORIFICS, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // drop diacritics
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Looser key: just first + last token (drops middle names/initials). Catches cases like
 * "Percy E. Downe" vs "Percy Downe". Used only as a fallback to avoid false matches.
 */
export function firstLastKey(name: string): string {
  const parts = sponsorKey(name).split(" ").filter(Boolean);
  if (parts.length < 2) return parts.join(" ");
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

/** Initials for the avatar fallback (e.g. "François-Philippe Champagne" → "FC"). */
export function initials(name: string): string {
  const parts = name.replace(HONORIFICS, "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Add a name's exact + first/last keys to the map without overwriting an existing entry. */
function indexPhoto(map: Map<string, string>, name: string, url: string): void {
  const exact = sponsorKey(name);
  if (!map.has(exact)) map.set(exact, url);
  const fl = firstLastKey(name);
  if (!map.has(fl)) map.set(fl, url);
}

/**
 * Recover a senator's "Firstname Lastname" from their profile slug and portrait filename.
 * The slug is `lastname-firstname` (either part may itself be hyphenated), and the portrait
 * is `sen_pho_{lastname}_official.jpg` — so the filename tells us exactly where the surname
 * ends and the given name begins (e.g. slug `laboucane-benson-patti` + `…laboucane-benson…`
 * → "patti laboucane-benson").
 */
function senatorNameFromSlug(slug: string, lastname: string): string {
  if (slug.startsWith(`${lastname}-`)) {
    return `${slug.slice(lastname.length + 1)} ${lastname}`;
  }
  // Fallback: assume a single-token given name at the end of the slug.
  const parts = slug.split("-");
  return `${parts[parts.length - 1]} ${parts.slice(0, -1).join("-")}`;
}

/** Fetch openparliament's MP photos into the map. */
async function addMpPhotos(map: Map<string, string>): Promise<void> {
  try {
    const res = await fetch(`${OP_API}/politicians/?limit=600&format=json`, {
      headers: { "User-Agent": USER_AGENT, "API-Version": "v1", Accept: "application/json" },
      next: { revalidate: CACHE_SECONDS },
    });
    if (!res.ok) return;
    const data = (await res.json()) as OpPoliticianList;
    for (const p of data.objects ?? []) {
      if (p.name && p.image) {
        const url = p.image.startsWith("http") ? p.image : `${OP_BASE}${p.image}`;
        indexPhoto(map, p.name, url);
      }
    }
  } catch {
    // Network/parse error — leave the map as-is.
  }
}

/**
 * Fetch the Senate's senator portraits into the map. The bulk "tiles" partial renders each
 * senator as a photo anchor — `<a href="/en/senators/{slug}/"><img … src="/media/…/sen_pho_
 * {lastname}_official.jpg">` — so we pull (slug, portrait) pairs and reconstruct the name from
 * the slug + filename. (Most tiles omit a text name, so we don't rely on one.)
 */
async function addSenatorPhotos(map: Map<string, string>): Promise<void> {
  try {
    const res = await fetch(SEN_ENDPOINT, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      next: { revalidate: CACHE_SECONDS },
    });
    if (!res.ok) return;
    const html = await res.text();

    const seen = new Set<string>();
    const re =
      /\/en\/senators\/([a-z0-9-]+)\/">\s*<img[\s\S]{0,500}?(\/media\/[a-z0-9]+\/sen_pho_([a-z0-9-]+)_(?:official|bio|portrait)\.jpg)/g;
    for (const m of html.matchAll(re)) {
      const [, slug, mediaPath, lastname] = m;
      if (seen.has(slug)) continue;
      seen.add(slug);
      const url = `${SEN_BASE}${mediaPath}?width=300&quality=90`;
      indexPhoto(map, senatorNameFromSlug(slug, lastname), url);
    }
  } catch {
    // Network/parse error — leave the map as-is.
  }
}

/**
 * Fetch and cache the merged name → absolute photo URL map (MPs from openparliament, Senators
 * from sencanada.ca). On any failure the affected source is simply skipped; the UI degrades
 * gracefully to initials avatars.
 */
export async function fetchSponsorPhotoMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  // MPs first so a sitting MP's openparliament photo wins any (unexpected) name collision.
  await addMpPhotos(map);
  await addSenatorPhotos(map);
  return map;
}

/** Look up a sponsor's photo URL in the map, or null if not found. */
export function photoForSponsor(
  map: Map<string, string>,
  sponsorName: string | null | undefined,
): string | null {
  if (!sponsorName) return null;
  return map.get(sponsorKey(sponsorName)) ?? map.get(firstLastKey(sponsorName)) ?? null;
}
