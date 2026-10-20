import Link from "next/link";
import { categoryLabel, type Category } from "@/lib/categories";

/**
 * Topic chips for a bill. Each chip links to the homepage filtered to that topic; `linked`
 * is off on cards, where the whole card is already a link to the bill.
 */
export function CategoryChips({
  categories,
  linked = false,
  className = "",
}: {
  categories: Category[];
  linked?: boolean;
  className?: string;
}) {
  if (categories.length === 0) return null;
  const chip =
    "bg-brand/8 text-brand-darker rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide";
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`} aria-label="Topics">
      {categories.map((c) => (
        <li key={c}>
          {linked ? (
            <Link
              href={`/?topic=${c}`}
              className={`${chip} hover:bg-brand inline-block transition hover:text-white`}
            >
              {categoryLabel(c)}
            </Link>
          ) : (
            <span className={chip}>{categoryLabel(c)}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
