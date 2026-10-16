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
  breakpoint?: "sm" | "md" | "lg" | "xl";
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  eyebrow,
  title,
  subtitle,
  badge,
  actions,
  className,
  breakpoint = "sm",
}) => {
  const breakpointClassMap = {
    sm: {
      container: "sm:flex-row sm:items-start",
      actions: "sm:self-auto sm:w-auto",
    },
    md: {
      container: "md:flex-row md:items-start",
      actions: "md:self-auto md:w-auto",
    },
    lg: {
      container: "lg:flex-row lg:items-start",
      actions: "lg:self-auto lg:w-auto",
    },
    xl: {
      container: "xl:flex-row xl:items-start",
      actions: "xl:self-auto xl:w-auto",
    },
  };

  const bp = breakpointClassMap[breakpoint] || breakpointClassMap.sm;

  return (
    <div
      className={clsx(
        "flex flex-col justify-between gap-3.5 sm:gap-4",
        bp.container,
        className
      )}
    >
      <div className="min-w-0 flex-1">
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
        <div
          className={clsx(
            "flex flex-wrap items-center gap-2 self-start shrink-0 w-full",
            bp.actions
          )}
        >
          {actions}
        </div>
      )}
    </div>
  );
};
