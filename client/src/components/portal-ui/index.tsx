// src/components/portal-ui/index.tsx
import React from "react";

export const NoxStatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  accent?: "core" | "ion" | "plasma";
  icon?: React.ReactNode;
}> = ({ label, value, accent = "core", icon }) => {
  const accentText =
    accent === "ion"
      ? "text-blue-600 dark:text-ion-400"
      : accent === "plasma"
      ? "text-purple-600 dark:text-plasma-400"
      : "text-emerald-700 dark:text-core-400";
  return (
    <div className="nox-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono uppercase tracking-wide text-slate-500 dark:text-nox-low">{label}</span>
        {icon && <span className={accentText}>{icon}</span>}
      </div>
      <div className={`mt-2 font-orbital text-2xl font-semibold ${accentText}`}>{value}</div>
    </div>
  );
};

export const NoxSkeleton: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`animate-pulse rounded-lg bg-slate-200 dark:bg-white/[0.06] ${className}`} />
);

export const NoxEmptyState: React.FC<{ title: string; body?: string; icon?: React.ReactNode }> = ({
  title,
  body,
  icon,
}) => (
  <div className="nox-card flex flex-col items-center text-center px-6 py-14">
    {icon && <div className="mb-4 text-slate-400 dark:text-nox-low">{icon}</div>}
    <h3 className="font-orbital text-base font-medium text-slate-900 dark:text-nox-high">{title}</h3>
    {body && <p className="mt-1.5 text-sm text-slate-600 dark:text-nox-mid max-w-sm">{body}</p>}
  </div>
);

const STATUS_STYLES: Record<string, string> = {
  present: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25 dark:border-emerald-400/20",
  paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25 dark:border-emerald-400/20",
  late: "bg-amber-500/15 text-amber-800 dark:text-core-400 border-amber-500/30 dark:border-core-400/20",
  partial: "bg-amber-500/15 text-amber-800 dark:text-core-400 border-amber-500/30 dark:border-core-400/20",
  pending: "bg-blue-500/10 text-blue-700 dark:text-ion-400 border-blue-500/25 dark:border-ion-400/20",
  excused: "bg-purple-500/10 text-purple-700 dark:text-plasma-400 border-purple-500/25 dark:border-plasma-400/20",
  absent: "bg-rose-500/10 text-rose-700 dark:text-red-400 border-rose-500/25 dark:border-red-400/20",
  overdue: "bg-rose-500/10 text-rose-700 dark:text-red-400 border-rose-500/25 dark:border-red-400/20",
  refunded: "bg-slate-500/10 text-slate-700 dark:text-nox-low border-slate-300 dark:border-white/10",
};

export const NoxStatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-wide border ${
      STATUS_STYLES[status] || "bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-nox-mid border-slate-200 dark:border-white/10"
    }`}
  >
    {status}
  </span>
);

export const NoxPageHeader: React.FC<{ eyebrow?: string; title: string; subtitle?: string }> = ({
  eyebrow,
  title,
  subtitle,
}) => (
  <div className="mb-8">
    {eyebrow && <span className="nox-eyebrow">{eyebrow}</span>}
    <h1 className="mt-2 font-orbital text-2xl md:text-3xl font-semibold text-nox-high">{title}</h1>
    {subtitle && <p className="mt-1.5 text-sm text-nox-mid">{subtitle}</p>}
  </div>
);
