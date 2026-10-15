// src/components/ui/StatCard.tsx
import { clsx } from "clsx";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: React.ReactNode;
  trend?: { value: number; positive: boolean };
  accent?: "volt" | "ice" | "ember" | "field";
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  sublabel,
  icon,
  trend,
  accent = "volt",
  className,
}) => {
  const accents = {
    volt: "text-volt-600 dark:text-volt-400",
    ice: "text-sky-600 dark:text-ice-400",
    ember: "text-amber-600 dark:text-ember-400",
    field: "text-emerald-600 dark:text-field-400",
  };

  return (
    <div className={clsx("card p-3 sm:p-4 space-y-2 sm:space-y-3 h-full flex flex-col justify-between", className)}>
      <div className="flex items-start justify-between gap-1">
        <span className="section-title text-[10px] sm:text-xs truncate block">{label}</span>
        {icon && (
          <span className={clsx("text-base sm:text-lg shrink-0", accents[accent])}>{icon}</span>
        )}
      </div>
      <div>
        <span
          className={clsx(
            "font-display font-extrabold text-xl sm:text-2xl lg:text-3xl tabular-nums truncate block",
            accents[accent],
          )}
          title={
            typeof value === "string" || typeof value === "number"
              ? String(value)
              : undefined
          }
        >
          {value}
        </span>
        {sublabel && (
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{sublabel}</p>
        )}
      </div>
      {trend && (
        <div
          className={clsx(
            "flex items-center gap-1 text-[11px] sm:text-xs",
            trend.positive
              ? "text-emerald-600 dark:text-field-400"
              : "text-amber-600 dark:text-ember-400",
          )}
        >
          {trend.positive ? (
            <TrendingUp size={12} className="shrink-0" />
          ) : (
            <TrendingDown size={12} className="shrink-0" />
          )}
          <span>{Math.abs(trend.value)}% vs last week</span>
        </div>
      )}
    </div>
  );
};
