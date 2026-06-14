export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 py-6 text-center text-sm text-slate-500">
        <p>
          BillWatch is an independent, open-source project — not affiliated with the Government of
          Canada. Bill data is sourced from{" "}
          <a
            href="https://www.parl.ca/legisinfo"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-slate-700 underline underline-offset-2 hover:text-red-600"
          >
            LEGISinfo
          </a>{" "}
          (Parliament of Canada).
        </p>
        <p className="mt-1">
          Free &amp; AGPLv3 ·{" "}
          <a
            href="https://github.com/nolandruid/billwatch"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-red-600"
          >
            Source on GitHub
          </a>
        </p>
      </div>
    </footer>
  );
}
