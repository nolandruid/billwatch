/**
 * Topic categories for bills (issue #20). Titles alone hide what omnibus and budget bills
 * contain, so a bill's categories come from keyword rules over its titles plus a hand-curated
 * list for bills whose titles say nothing about their contents. Pure, so the homepage, the
 * bill page and the sync all agree.
 */

export const CATEGORIES = [
  "ai",
  "crypto",
  "housing",
  "climate",
  "health",
  "immigration",
  "defence",
  "tax",
  "justice",
  "indigenous",
  "transport",
  "labour",
] as const;
export type Category = (typeof CATEGORIES)[number];

interface CategoryDef {
  label: string;
  /** Matched against the long and short titles. */
  pattern: RegExp;
  /** Extra words that should find this topic in search, beyond its label. */
  searchTerms: string[];
}

export const CATEGORY_DEFS: Record<Category, CategoryDef> = {
  ai: {
    label: "AI",
    pattern: /\bAI\b|[Aa]rtificial [Ii]ntelligence|[Aa]utomated [Dd]ecision|[Aa]lgorithm/,
    searchTerms: ["artificial intelligence", "algorithm"],
  },
  crypto: {
    label: "Crypto",
    pattern: /crypto|stablecoin|digital (asset|currenc)|virtual currenc|blockchain/i,
    searchTerms: ["cryptocurrency", "stablecoin", "digital currency", "blockchain"],
  },
  housing: {
    label: "Housing",
    pattern: /housing|homebuyer|home buyer|\brent(al|ers?)?\b|mortgage|homeless/i,
    searchTerms: ["home", "rent", "mortgage", "homelessness"],
  },
  climate: {
    label: "Climate & Energy",
    pattern:
      /climate|environment|emission|carbon|greenhouse|pollut|conservation|clean (energy|electricity|fuel)|energy|electricity|nuclear|\boil\b|natural gas|pipeline|species at risk/i,
    searchTerms: ["environment", "emissions", "carbon", "energy", "oil", "gas", "pipeline"],
  },
  health: {
    label: "Health",
    pattern:
      /health|medical|pharma|disease|cancer|dental|hospital|medicine|patient|pandemic|assistance in dying|opioid/i,
    searchTerms: ["healthcare", "pharmacare", "dental", "mental health", "medical"],
  },
  immigration: {
    label: "Immigration",
    pattern: /immigra|refugee|citizenship|asylum|\bborder/i,
    searchTerms: ["refugee", "citizenship", "asylum", "border"],
  },
  defence: {
    label: "Defence & Security",
    pattern:
      /defence|defense|military|armed forces|national security|veteran|terroris|espionage|foreign interference|cyber ?security/i,
    searchTerms: ["defense", "military", "security", "veterans", "cybersecurity"],
  },
  tax: {
    label: "Tax & Budget",
    pattern: /\btax|budget|appropriation|excise|tariff|customs|fiscal|\bduties\b/i,
    searchTerms: ["taxes", "budget", "tariff", "excise", "spending"],
  },
  justice: {
    label: "Justice & Crime",
    pattern:
      /criminal|crime|offence|sentenc|prison|correction|firearm|police|\bcourts?\b|victim|bail|judges/i,
    searchTerms: ["crime", "criminal code", "firearms", "guns", "police", "bail"],
  },
  indigenous: {
    label: "Indigenous",
    pattern: /indigenous|first nation|inuit|m[ée]tis|aboriginal|\btreaty|self-government/i,
    searchTerms: ["first nations", "inuit", "metis", "treaty"],
  },
  transport: {
    label: "Transport",
    pattern:
      /transport|railway|\brail\b|aviation|airport|airline|shipping|marine|vessel|highway|motor vehicle/i,
    searchTerms: ["rail", "airline", "aviation", "shipping"],
  },
  labour: {
    label: "Labour",
    pattern: /\blabou?r\b|employment|worker|\bwages?\b|pension|\bunion|pay equity|workplace/i,
    searchTerms: ["jobs", "workers", "wages", "pension", "unions", "employment insurance"],
  },
};

/**
 * Topics bundled into bills whose titles don't mention them, keyed "parliament-session:number".
 * Add to this when a user can't find a measure by topic (see issue #20 for C-15 and C-31).
 */
export const CURATED_CATEGORIES: Record<string, Category[]> = {
  // Budget 2025 Implementation Act, No. 1 includes the stablecoin framework.
  "45-1:C-15": ["crypto"],
  "45-1:C-31": ["crypto"],
};

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

export function categoryLabel(category: Category): string {
  return CATEGORY_DEFS[category].label;
}

/** A bill's categories, in CATEGORIES order. */
export function categorizeBill(bill: {
  parliament: number;
  session: number;
  billNumber: string;
  title: string;
  shortTitle: string | null;
}): Category[] {
  const text = `${bill.title} ${bill.shortTitle ?? ""}`;
  const curated = CURATED_CATEGORIES[`${bill.parliament}-${bill.session}:${bill.billNumber}`] ?? [];
  return CATEGORIES.filter((c) => curated.includes(c) || CATEGORY_DEFS[c].pattern.test(text));
}

/**
 * Whether a search query names this topic: "AI", "crypto", or "Stablecoin Act" (which
 * contains the term "stablecoin"). Fragments of four or more letters like "hous" also match.
 */
export function queryMatchesCategory(query: string, category: Category): boolean {
  const q = query.trim().toLowerCase();
  const def = CATEGORY_DEFS[category];
  if (q === category || q === def.label.toLowerCase()) return true;
  if (q.length < 3) return false;
  const terms = [def.label.toLowerCase(), ...def.searchTerms, category];
  return terms.some((t) => q.includes(t) || (q.length >= 4 && t.includes(q)));
}
