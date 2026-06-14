import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/sponsors";
import type { Chamber } from "@/lib/legisinfo";
import { cn } from "@/lib/utils";

export function SponsorAvatar({
  name,
  photoUrl,
  chamber,
  className,
}: {
  name: string | null;
  photoUrl: string | null;
  chamber?: Chamber | null;
  className?: string;
}) {
  const label = name ?? "Unknown sponsor";
  // Fallback (no photo, typically Senators) is coloured by chamber so it looks deliberate.
  const fallbackTone =
    chamber === "senate"
      ? "bg-senate-soft text-senate"
      : chamber === "house"
        ? "bg-house-soft text-house"
        : "bg-mauve-soft text-mauve-deep";
  return (
    <Avatar className={cn("border border-black/5", className)}>
      {photoUrl && <AvatarImage src={photoUrl} alt={label} className="object-cover object-top" />}
      <AvatarFallback className={cn("text-xs font-semibold", fallbackTone)}>
        {initials(label)}
      </AvatarFallback>
    </Avatar>
  );
}
