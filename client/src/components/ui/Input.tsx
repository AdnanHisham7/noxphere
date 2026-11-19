// src/components/ui/Input.tsx
import React from "react";
import { clsx } from "clsx";
import { usePhonePlaceholder } from "../../hooks/usePhonePlaceholder";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: React.ReactNode;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, icon, className, placeholder, type, ...props }, ref) => {
    const { placeholder: defaultTelPlaceholder } = usePhonePlaceholder();
    const effectivePlaceholder = placeholder ?? (type === "tel" ? defaultTelPlaceholder : undefined);

    return (
      <div className="space-y-1.5">
        {label && <label className="label">{label}</label>}

        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
              {icon}
            </span>
          )}

          <input
            ref={ref}
            type={type}
            placeholder={effectivePlaceholder}
            className={clsx(
              error ? "input-error" : "input",
              icon ? "pl-9" : "",
              className,
            )}
            {...props}
          />
        </div>

        {error ? (
          <p className="text-xs text-ember-400">{error}</p>
        ) : helperText ? (
          <p className="text-2xs text-slate-500 dark:text-slate-400">{helperText}</p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = "Input";
