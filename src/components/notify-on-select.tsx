"use client";

import { NOTIFY_ON, NOTIFY_ON_LABELS, type NotifyOn } from "@/lib/notify-prefs";

/** "Notify me about: …" selector shared by NotifyDialog and SubscribeCard. */
export function NotifyOnSelect({
  value,
  onChange,
  className,
}: {
  value: NotifyOn;
  onChange: (value: NotifyOn) => void;
  className: string;
}) {
  return (
    <label className="block text-xs">
      <span className="sr-only">Notify me about</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as NotifyOn)}
        className={className}
      >
        {NOTIFY_ON.map((option) => (
          <option key={option} value={option} className="text-foreground">
            {NOTIFY_ON_LABELS[option]}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Success-message tail describing what the subscriber will be emailed about. */
export function notifyOnSummary(value: NotifyOn): string {
  switch (value) {
    case "milestones":
      return "when it passes a chamber or receives Royal Assent";
    case "law":
      return "when it receives Royal Assent";
    case "died":
      return "if it's defeated or withdrawn";
    default:
      return "each time it changes status";
  }
}
