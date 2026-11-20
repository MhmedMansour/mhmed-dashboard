"use client";

import React, { useEffect, useRef, useState } from "react";
import { setStoredValue, useStoredFlag } from "@/lib/useStoredValue";
import {
  CalendarDays,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  Check,
  Compass,
  DownloadCloud,
  ListFilter,
  Moon,
  MoreHorizontal,
  Palette,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  Search,
  Share2,
  Sparkles,
  Sun,
  UploadCloud,
  UserCheck,
} from "lucide-react";
import type { DateRangeKey, SegmentKey } from "@/lib/engineering";

const DATE_RANGES: Array<{ key: DateRangeKey; label: string }> = [
  { key: "7d", label: "آخر 7 أيام" },
  { key: "30d", label: "آخر 30 يوم" },
  { key: "90d", label: "آخر 90 يوم" },
  { key: "1y", label: "آخر سنة" },
  { key: "all", label: "كل الفترات" },
];

const SEGMENTS: Array<{ key: SegmentKey; label: string }> = [
  { key: "all", label: "كل التخصصات" },
  { key: "autocad", label: "AutoCAD" },
  { key: "revit", label: "Revit BIM" },
  { key: "om", label: "تشغيل وصيانة" },
  { key: "parallel", label: "مهام متوازية" },
  { key: "certificates", label: "الشهادات" },
];

interface DashboardHeaderProps {
  profileName?: string;
  search: string;
  onSearchChange: (value: string) => void;
  range: DateRangeKey;
  onRangeChange: (value: DateRangeKey) => void;
  segment: SegmentKey;
  onSegmentChange: (value: SegmentKey) => void;
  isDark: boolean;
  onToggleDark: () => void;
  copiedPortfolio: boolean;
  onOpenGuide: () => void;
  onOpenProfile: () => void;
  onCopyPortfolio: () => void;
  onOpenVault: () => void;
  onNewProject: () => void;
  onOpenTheme: () => void;
}

export function DashboardHeader({
  profileName,
  search,
  onSearchChange,
  range,
  onRangeChange,
  segment,
  onSegmentChange,
  isDark,
  onToggleDark,
  copiedPortfolio,
  onOpenGuide,
  onOpenProfile,
  onCopyPortfolio,
  onOpenVault,
  onNewProject,
  onOpenTheme,
}: DashboardHeaderProps) {
  // Preferences are read through an SSR-safe store (no setState-in-effect).
  const pinned = useStoredFlag("header_pinned", false);
  const compact = useStoredFlag("header_compact", false);
  const [scrolled, setScrolled] = useState(false);
  const [filtersOverride, setFiltersOverride] = useState<boolean | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const isCompact = compact || (pinned && scrolled);
  const showFilters = filtersOverride ?? !isCompact;
  const hasFilters = range !== "all" || segment !== "all" || search.trim() !== "";

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setScrolled(window.scrollY > 64));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    if (!moreOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [moreOpen]);

  const togglePinned = () => {
    setStoredValue("header_pinned", pinned ? "0" : "1");
  };

  const toggleCompact = () => {
    const next = !isCompact;
    setStoredValue("header_compact", next ? "1" : "0");
    setFiltersOverride(next ? false : true);
    // Expanding while pinned-and-scrolled would immediately re-compact it.
    if (!next && pinned && window.scrollY > 64) {
      setStoredValue("header_pinned", "0");
    }
  };

  const runMenuAction = (action: () => void) => {
    setMoreOpen(false);
    action();
  };

  const resetFilters = () => {
    onRangeChange("all");
    onSegmentChange("all");
    onSearchChange("");
  };

  const dateSelect = (extraClass = "") => (
    <label className={`header-date-select ${extraClass}`} title="الفترة الزمنية لكل الإحصائيات والمشاريع">
      <CalendarDays size={14} aria-hidden="true" />
      <span className="sr-only">الفترة الزمنية</span>
      <select
        aria-label="الفترة الزمنية"
        value={range}
        onChange={(event) => onRangeChange(event.target.value as DateRangeKey)}
      >
        {DATE_RANGES.map((item) => (
          <option key={item.key} value={item.key}>{item.label}</option>
        ))}
      </select>
      <ChevronDown size={12} aria-hidden="true" />
    </label>
  );

  return (
    <header
      className={`workspace-header ${pinned ? "is-pinned" : ""} ${isCompact ? "is-compact" : ""}`}
      aria-label="شريط مساحة العمل والفلاتر"
    >
      <div className="header-inner mx-auto max-w-[1440px] px-4 sm:px-6">
        <div className="header-main flex flex-wrap items-center gap-2 lg:flex-nowrap">
          <div className="header-brand flex min-w-0 flex-1 items-center gap-2.5 lg:flex-none">
            <span className="header-logo flex shrink-0 items-center justify-center bg-blue-600 text-white">
              <Compass size={20} strokeWidth={1.7} />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-extrabold text-slate-900 dark:text-white" title={profileName || "مِحور الهندسي"}>
                {profileName || "مِحور الهندسي"}
              </h1>
              <p className="header-brand-caption mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                مساحة العمل الهندسية
              </p>
            </div>
          </div>

          <div className={`header-search relative order-last w-full basis-full lg:order-none lg:w-auto lg:min-w-[150px] lg:max-w-[360px] lg:flex-1 lg:basis-auto ${isCompact && !searchOpen ? "hidden sm:block" : "block"}`}>
            <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              aria-label="البحث في مساحة العمل"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="ابحث عن مشروع، ملف أو شهادة…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 pr-9 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          {isCompact && dateSelect("hidden md:flex")}

          <div className="header-actions flex shrink-0 items-center gap-1">
            {isCompact && (
              <button type="button" className="header-icon-button sm:hidden" onClick={() => setSearchOpen((value) => !value)} aria-label="إظهار البحث" aria-expanded={searchOpen} title="البحث">
                <Search size={16} />
              </button>
            )}
            <button
              type="button"
              className={`header-icon-button ${showFilters && isCompact ? "is-active" : ""}`}
              onClick={() => setFiltersOverride(!showFilters)}
              aria-label="إظهار الفلاتر أو إخفاؤها"
              aria-expanded={showFilters}
              title="الفلاتر والبحث المدمج"
            >
              <ListFilter size={16} />
              {hasFilters && <span className="header-filter-dot" />}
            </button>
            <button type="button" onClick={onNewProject} className="header-new-project inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-2.5 text-xs font-bold text-white transition hover:bg-blue-700" title="إضافة مشروع أو مهمة">
              <Plus size={16} />
              <span className="hidden xl:inline">مشروع جديد</span>
            </button>
            <button type="button" onClick={onOpenTheme} className="header-theme-button inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2 text-xs font-bold dark:border-slate-700" title="تغيير لون الداشبورد والمظهر">
              <Palette size={16} />
              <span className="hidden lg:inline">ألوان الداش</span>
            </button>
            <button type="button" onClick={onToggleDark} className="header-icon-button hidden sm:inline-flex" aria-label={isDark ? "الوضع النهاري" : "الوضع الليلي"} title={isDark ? "الوضع النهاري" : "الوضع الليلي"}>
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <div className="relative" ref={moreRef}>
              <button type="button" className={`header-icon-button ${moreOpen ? "is-active" : ""}`} onClick={() => setMoreOpen((value) => !value)} aria-label="المزيد من الإجراءات" aria-expanded={moreOpen} aria-haspopup="menu" title="المزيد">
                <MoreHorizontal size={18} />
              </button>
              {moreOpen && (
                <div role="menu" className="header-more-menu absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  {[
                    { label: "بياناتي ومساحة العمل", icon: UserCheck, action: onOpenProfile },
                    { label: "رفع ملفات ومشروع", icon: UploadCloud, action: onOpenVault },
                    { label: copiedPortfolio ? "تم نسخ البورتفوليو" : "نسخ عينات للعميل", icon: copiedPortfolio ? Check : Share2, action: onCopyPortfolio },
                    { label: "دليل الاستخدام", icon: Sparkles, action: onOpenGuide },
                    { label: isDark ? "الوضع النهاري" : "الوضع الليلي", icon: isDark ? Sun : Moon, action: onToggleDark },
                  ].map((item) => (
                    <button key={item.label} type="button" role="menuitem" onClick={() => runMenuAction(item.action)} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-right text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                      <item.icon size={15} />
                      {item.label}
                    </button>
                  ))}
                  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                  <a role="menuitem" href="/api/workspace?export=true" onClick={() => setMoreOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                    <DownloadCloud size={15} />
                    تصدير نسخة احتياطية
                  </a>
                  <button type="button" role="menuitem" onClick={togglePinned} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-right text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 sm:hidden">
                    {pinned ? <PinOff size={15} /> : <Pin size={15} />}
                    {pinned ? "إلغاء تثبيت الهيدر" : "تثبيت الهيدر أعلى الصفحة"}
                  </button>
                </div>
              )}
            </div>

            <span className="mx-1 hidden h-5 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
            <button type="button" onClick={togglePinned} className={`header-icon-button hidden sm:inline-flex ${pinned ? "is-active" : ""}`} aria-label={pinned ? "إلغاء تثبيت الهيدر" : "تثبيت الهيدر"} aria-pressed={pinned} title={pinned ? "الهيدر مثبت ويصغر مع التمرير — اضغط ليتحرك مع الصفحة" : "تثبيت الهيدر وتصغيره تلقائيًا مع التمرير"}>
              {pinned ? <PinOff size={15} /> : <Pin size={15} />}
            </button>
            <button type="button" onClick={toggleCompact} className="header-icon-button" aria-label={isCompact ? "توسيع الهيدر" : "تصغير الهيدر"} aria-pressed={isCompact} title={isCompact ? "توسيع الهيدر" : "تصغير الهيدر"}>
              {isCompact ? <ChevronsDown size={17} /> : <ChevronsUp size={17} />}
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="header-filter-row flex items-center gap-2 border-t border-slate-100 dark:border-slate-800">
            <div className="header-segments flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" aria-label="تصفية حسب التخصص">
              {SEGMENTS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onSegmentChange(item.key)}
                  aria-pressed={segment === item.key}
                  className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${segment === item.key ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {hasFilters && (
              <button type="button" onClick={resetFilters} className="header-icon-button shrink-0" aria-label="إعادة ضبط الفلاتر" title="إظهار كل البيانات">
                <RotateCcw size={14} />
              </button>
            )}
            {dateSelect(isCompact ? "md:hidden" : "")}
          </div>
        )}
      </div>
    </header>
  );
}
