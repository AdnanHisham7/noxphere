// src/components/ui/PageHeader.tsx
import React from "react";
import { clsx } from "clsx";

export interface PageHeaderProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  eyebrow,
  title,
  subtitle,
  badge,
  actions,
  className,
}) => {
  return (
    <div
      className={clsx(
        "flex flex-col sm:flex-row sm:items-start justify-between gap-3.5 sm:gap-4",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="section-title mb-1">
            {eyebrow}
          </p>
        )}
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="font-display font-extrabold text-slate-900 dark:text-white text-xl sm:text-2xl uppercase tracking-tight">
            {title}
          </h1>
          {badge}
        </div>
        {subtitle && (
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0 w-full sm:w-auto">
          {actions}
        </div>
      )}
    </div>
  );
};
