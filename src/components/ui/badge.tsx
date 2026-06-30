import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "positive" | "negative" | "warning";

const tones: Record<Tone, string> = {
  neutral: "bg-black/5 text-ink-soft",
  accent: "bg-accent/12 text-accent-deep",
  positive: "bg-positive/12 text-positive",
  negative: "bg-negative/12 text-negative",
  warning: "bg-warning/15 text-[#9a6500]",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
