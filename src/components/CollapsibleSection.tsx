"use client";

import React, { useId } from "react";
import { ChevronDown } from "lucide-react";
import { setStoredValue, useStoredValue } from "@/lib/useStoredValue";

interface CollapsibleSectionProps {
  /** Unique storage key so the open/closed state survives reloads. */
  storageKey: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  /** Right-side controls (filters, add buttons) kept visible when collapsed. */
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  bodyClassName?: string;
  /** Removes the card's inner padding so tables can span the full width. */
  flush?: boolean;
  children: React.ReactNode;
}

export function useCollapsed(storageKey: string, defaultOpen = true) {
  const key = `section_${storageKey}`;
  const saved = useStoredValue(key, "");
  const open = saved === "1" ? true : saved === "0" ? false : defaultOpen;
  const toggle = () => setStoredValue(key, open ? "0" : "1");
  return { open, toggle };
}

export function CollapseToggle({
  open,
  onToggle,
  controls,
  label,
}: {
  open: boolean;
  onToggle: () => void;
  controls: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      title={open ? "طي القائمة" : "فتح القائمة"}
      className="collapse-toggle inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-600 transition hover:border-blue-300 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
    >
      <span className="hidden sm:inline">{label ?? (open ? "طي" : "فتح")}</span>
      <ChevronDown
        size={15}
        className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      />
    </button>
  );
}

export function CollapsibleSection({
  storageKey,
  title,
  subtitle,
  icon,
  actions,
  badge,
  defaultOpen = true,
  className = "",
  bodyClassName = "",
  flush = false,
  children,
}: CollapsibleSectionProps) {
  const { open, toggle } = useCollapsed(storageKey, defaultOpen);
  const bodyId = useId();

  return (
    <section
      className={`collapsible-section bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden ${className}`}
      data-open={open ? "true" : "false"}
    >
      <header
        className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 ${
          open ? "border-b border-slate-100 dark:border-slate-800" : ""
        }`}
      >
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-right"
        >
          {icon && <span className="shrink-0">{icon}</span>}
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-base font-extrabold text-slate-900 dark:text-white">
                {title}
              </span>
              {badge}
            </span>
            {subtitle && open && (
              <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                {subtitle}
              </span>
            )}
          </span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {open && actions}
          <CollapseToggle open={open} onToggle={toggle} controls={bodyId} />
        </div>
      </header>

      {open && (
        <div id={bodyId} className={flush ? bodyClassName : `p-5 ${bodyClassName}`}>
          {children}
        </div>
      )}
    </section>
  );
}
