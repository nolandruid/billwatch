import { Check } from "lucide-react";
import { Fragment } from "react";
import type { ProgressStep } from "@/lib/legisinfo";
import { cn } from "@/lib/utils";

function formatDate(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Each macro step carries its own ramp colour so the stepper reads like a thermometer:
 * Introduced (red) → Passed first chamber (orange) → Passed second chamber (olive) →
 * Royal Assent (green). Keyed by ProgressStep.key. (Tailwind needs the literal class names.)
 */
const STAGE_COLOR: Record<string, { fill: string; ring: string; text: string }> = {
  introduced: { fill: "bg-intro", ring: "ring-intro", text: "text-intro" },
  "passed-first": { fill: "bg-second", ring: "ring-second", text: "text-second" },
  "passed-second": { fill: "bg-third", ring: "ring-third", text: "text-third" },
  "royal-assent": { fill: "bg-royal", ring: "ring-royal", text: "text-royal" },
};

const FALLBACK = { fill: "bg-slate-400", ring: "ring-slate-400", text: "text-slate-500" };

/**
 * GovTrack-style horizontal stepper: Introduced → Passed [chamber] → Passed [chamber] →
 * Royal Assent. Completed steps are filled in their stage colour; the first incomplete step
 * is the "current" one (hollow, outlined in its colour).
 */
export function ProgressTracker({
  steps,
  className,
}: {
  steps: ProgressStep[];
  className?: string;
}) {
  const currentIndex = steps.findIndex((s) => !s.done);

  return (
    <div className={cn("flex items-start", className)}>
      {steps.map((step, i) => {
        const isCurrent = i === currentIndex;
        const c = STAGE_COLOR[step.key] ?? FALLBACK;
        const next = steps[i + 1];
        const nextColor = next ? (STAGE_COLOR[next.key] ?? FALLBACK) : FALLBACK;
        const nextDone = i < steps.length - 1 && next.done;
        const date = formatDate(step.date);
        return (
          <Fragment key={step.key}>
            <div className="flex min-w-0 flex-col items-center text-center">
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-offset-1 ring-offset-card",
                  step.done
                    ? cn(c.fill, c.ring, "text-white")
                    : isCurrent
                      ? cn("bg-card", c.ring, c.text)
                      : "bg-slate-100 text-slate-400 ring-slate-200",
                )}
              >
                {step.done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cn(
                  "mt-1.5 text-[10px] leading-tight font-semibold",
                  step.done ? c.text : isCurrent ? "text-foreground" : "text-slate-400",
                )}
              >
                {step.label}
              </span>
              {date && <span className="text-[9px] text-slate-400">{date}</span>}
            </div>
            {i < steps.length - 1 && (
              <span
                className={cn(
                  "mt-3 h-0.5 flex-1 rounded-full",
                  nextDone ? nextColor.fill : "bg-slate-200",
                )}
                aria-hidden
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
