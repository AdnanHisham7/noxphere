// src/components/ui/Select.tsx
import React from "react";
import { clsx } from "clsx";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  options?: (SelectOption | string)[];
  wrapperClassName?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      icon,
      options,
      children,
      className,
      wrapperClassName,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <div className={clsx(label || helperText || error ? "space-y-1.5" : "", wrapperClassName)}>
        {label && <label className="label">{label}</label>}

        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10">
              {icon}
            </span>
          )}

          <select
            ref={ref}
            disabled={disabled}
            className={clsx(
              "input appearance-none pr-9",
              error ? "input-error" : "",
              icon ? "pl-9" : "",
              disabled
                ? "opacity-60 cursor-not-allowed bg-slate-100 dark:bg-pitch-800"
                : "cursor-pointer",
              className,
            )}
            {...props}
          >
            {options
              ? options.map((opt) => {
                  const val = typeof opt === "string" ? opt : opt.value;
                  const lbl = typeof opt === "string" ? opt : opt.label;
                  const dis = typeof opt === "string" ? false : opt.disabled;
                  return (
                    <option key={String(val)} value={val} disabled={dis}>
                      {lbl}
                    </option>
                  );
                })
              : children}
          </select>

          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <ChevronDown className="w-4 h-4 opacity-70" />
          </span>
        </div>

        {error && <p className="text-xs text-ember-400">{error}</p>}
        {helperText && !error && (
          <p className="text-2xs text-slate-500">{helperText}</p>
        )}
      </div>
    );
  },
);

Select.displayName = "Select";
