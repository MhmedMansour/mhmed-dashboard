"use client";

import React, { useEffect } from "react";
import { X, Palette, Sun, Moon, Monitor, Check, Paintbrush } from "lucide-react";
import { notifyStoredChange, useStoredValue } from "@/lib/useStoredValue";

export const ACCENTS = [
  { key: "teal", label: "تركواز", swatch: "#0f766e" },
  { key: "blue", label: "أزرق", swatch: "#2563eb" },
  { key: "indigo", label: "نيلي", swatch: "#4f46e5" },
  { key: "violet", label: "بنفسجي", swatch: "#7c3aed" },
  { key: "emerald", label: "أخضر", swatch: "#047857" },
  { key: "amber", label: "عسلي", swatch: "#b45309" },
  { key: "rose", label: "وردي", swatch: "#e11d48" },
  { key: "slate", label: "رمادي", swatch: "#475569" },
] as const;

export const SURFACES = [
  { key: "mist", label: "أزرق هادي", canvas: "#edf3f7", surface: "#ffffff", border: "#dbe5ec" },
  { key: "mint", label: "نعناعي", canvas: "#eef6f2", surface: "#ffffff", border: "#d8e7df" },
  { key: "plain", label: "رمادي فاتح", canvas: "#f7f8fa", surface: "#ffffff", border: "#e2e8f0" },
  { key: "sand", label: "دافئ", canvas: "#f6f3ed", surface: "#fffefa", border: "#e6dfd2" },
] as const;

export type AccentKey = (typeof ACCENTS)[number]["key"];
export type SurfaceKey = (typeof SURFACES)[number]["key"];

export function applyAccent(accent: string) {
  const valid = ACCENTS.some((item) => item.key === accent) ? accent : "teal";
  document.documentElement.setAttribute("data-accent", valid);
  try { localStorage.setItem("mihwar_accent", valid); } catch { /* optional storage */ }
  notifyStoredChange();
}

export function applySurface(surface: string) {
  const valid = SURFACES.some((item) => item.key === surface) ? surface : "mist";
  document.documentElement.setAttribute("data-surface", valid);
  try { localStorage.setItem("mihwar_surface", valid); } catch { /* optional storage */ }
  notifyStoredChange();
}

export function applyMode(mode: "light" | "dark" | "system") {
  const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem("mihwar_mode", mode);
    localStorage.setItem("mihwar_theme", dark ? "dark" : "light");
  } catch { /* optional storage */ }
  notifyStoredChange();
  window.dispatchEvent(new Event("mihwar-theme-change"));
}

export function ThemeSettingsPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  // Read preferences from the shared store; changes apply instantly without
  // setState-in-effect and survive reloads / other tabs.
  const accent = useStoredValue("accent", "teal");
  const surface = useStoredValue("surface", "mist");
  const storedMode = useStoredValue("mode", "light");
  const mode: "light" | "dark" | "system" =
    storedMode === "light" || storedMode === "dark" || storedMode === "system"
      ? storedMode
      : "light";

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (mode !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => applyMode("system");
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [mode]);

  if (!isOpen) return null;

  const pickAccent = (key: string) => applyAccent(key);
  const pickSurface = (key: string) => applySurface(key);
  const pickMode = (next: "light" | "dark" | "system") => applyMode(next);
  const selectedSwatch = ACCENTS.find((item) => item.key === accent)?.swatch || "#0f766e";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="theme-panel-title" className="my-auto max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#111827]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white"><Palette size={19} /></span>
            <div>
              <h3 id="theme-panel-title" className="text-sm font-extrabold text-slate-900 dark:text-white">ألوان الداش والمظهر</h3>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">التغيير بيظهر فورًا وبيتحفظ في المتصفح</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="إغلاق إعدادات الألوان" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={17} /></button>
        </div>

        <div className="space-y-5 p-5">
          <section>
            <h4 className="mb-2.5 flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-slate-200"><Paintbrush size={14} /> لون خلفية الداش</h4>
            <div className="grid grid-cols-2 gap-2.5">
              {SURFACES.map((item) => (
                <button key={item.key} type="button" onClick={() => pickSurface(item.key)} aria-pressed={surface === item.key} className={`rounded-xl border p-2 text-right transition ${surface === item.key ? "border-blue-600 ring-2 ring-blue-500/15" : "border-slate-200 hover:border-slate-400 dark:border-slate-700"}`}>
                  <div className="mb-2 h-14 overflow-hidden rounded-lg border" style={{ background: item.canvas, borderColor: item.border }}>
                    <div className="flex h-4 items-center justify-end gap-1 border-b px-2" style={{ background: item.surface, borderColor: item.border }}>
                      <span className="h-1.5 w-5 rounded-sm" style={{ background: selectedSwatch }} />
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: item.border }} />
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 p-1.5">
                      {[0, 1, 2].map((card) => <span key={card} className="h-5 rounded border" style={{ background: item.surface, borderColor: item.border }} />)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-0.5 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                    {item.label}
                    {surface === item.key && <Check size={13} className="text-blue-600" />}
                  </div>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">بيغيّر الخلفية والهيدر والبطاقات. في الوضع الليلي بياخد درجة غامقة مناسبة.</p>
          </section>

          <section>
            <h4 className="mb-2.5 text-xs font-extrabold text-slate-800 dark:text-slate-200">لون الأزرار والتحديد</h4>
            <div className="grid grid-cols-4 gap-2">
              {ACCENTS.map((item) => (
                <button key={item.key} type="button" onClick={() => pickAccent(item.key)} aria-pressed={accent === item.key} title={item.label} className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 transition ${accent === item.key ? "border-blue-600 bg-blue-50 dark:border-blue-400" : "border-slate-200 hover:border-slate-400 dark:border-slate-700"}`}>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full shadow-inner" style={{ background: item.swatch }}>{accent === item.key && <Check size={14} className="text-white" />}</span>
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{item.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h4 className="mb-2.5 text-xs font-extrabold text-slate-800 dark:text-slate-200">الوضع الليلي والنهاري</h4>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "light", label: "نهاري", icon: Sun },
                { key: "dark", label: "ليلي", icon: Moon },
                { key: "system", label: "حسب الجهاز", icon: Monitor },
              ].map((item) => (
                <button key={item.key} type="button" onClick={() => pickMode(item.key as "light" | "dark" | "system")} aria-pressed={mode === item.key} className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-[11px] font-bold transition ${mode === item.key ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}>
                  <item.icon size={14} />{item.label}
                </button>
              ))}
            </div>
          </section>

          <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
            <button type="button" onClick={() => { pickAccent("teal"); pickSurface("mist"); pickMode("light"); }} className="text-[11px] font-bold text-slate-500 hover:text-blue-600 dark:text-slate-400">إرجاع المظهر الجديد</button>
            <button type="button" onClick={onClose} className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700">تم</button>
          </div>
        </div>
      </div>
    </div>
  );
}
