// src/components/ui/Button.tsx
import React from "react";
import { clsx } from "clsx";
import { Spinner } from "./Spinner";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  children,
  className,
  disabled,
  ...props
}) => {
  const base =
    "inline-flex items-center justify-center gap-2 font-body font-medium rounded transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "bg-volt-400 text-white dark:text-pitch-900 font-display font-bold uppercase tracking-wide hover:bg-volt-500 shadow-sm",
    secondary:
      "bg-white border border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900 hover:bg-slate-50 dark:bg-transparent dark:border-white/15 dark:text-slate-300 dark:hover:border-white/30 dark:hover:text-white dark:hover:bg-white/5 shadow-2xs",
    danger:
      "bg-ember-500 text-white font-display font-semibold uppercase tracking-wide hover:bg-ember-600 shadow-sm",
    ghost:
      "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      className={clsx(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner size="sm" /> : icon}
      {children}
    </button>
  );
};
