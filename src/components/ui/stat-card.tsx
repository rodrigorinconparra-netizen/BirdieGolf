import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  /** Text shown next to the trend arrow, e.g. "vs. últimas 5". */
  delta?: string;
  /** true = good (green), false = bad (red), null/undefined = neutral. */
  deltaPositive?: boolean | null;
  icon?: LucideIcon;
}

export function StatCard({
  label,
  value,
  unit,
  delta,
  deltaPositive,
  icon: Icon,
}: StatCardProps) {
  const tone =
    deltaPositive == null
      ? "text-muted"
      : deltaPositive
        ? "text-positive"
        : "text-negative";
  const TrendIcon =
    deltaPositive == null ? Minus : deltaPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted">{label}</span>
        {Icon ? (
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent/10 text-accent">
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-3xl font-semibold tracking-tight text-ink">{value}</span>
        {unit ? <span className="text-sm text-faint">{unit}</span> : null}
      </div>
      {delta ? (
        <div className={cn("mt-2 flex items-center gap-1 text-xs font-medium", tone)}>
          <TrendIcon className="h-3.5 w-3.5" />
          <span>{delta}</span>
        </div>
      ) : null}
    </div>
  );
}
