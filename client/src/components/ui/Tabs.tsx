// src/components/ui/Tabs.tsx
import React from "react";
import { clsx } from "clsx";

export interface TabItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  className?: string;
  variant?: "underline" | "pills";
}

export function Tabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className,
  variant = "underline",
}: TabsProps<T>) {
  if (variant === "pills") {
    return (
      <div
        className={clsx(
          "flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-pitch-900/80 border border-slate-200 dark:border-white/10 w-full sm:w-auto",
          className
        )}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={clsx(
                "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2",
                isActive
                  ? "bg-volt-400 text-pitch-900 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "border-b border-slate-200 dark:border-white/10 flex overflow-x-auto gap-2 no-scrollbar flex-nowrap -mx-3.5 px-3.5 sm:mx-0 sm:px-0",
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={clsx(
              "pb-3 px-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors flex items-center gap-2 border-b-2 shrink-0",
              isActive
                ? "border-volt-400 text-volt-500 dark:text-volt-400"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge}
          </button>
        );
      })}
    </div>
  );
}
