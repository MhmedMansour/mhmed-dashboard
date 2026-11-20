"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Briefcase,
  ExternalLink,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  Landmark,
  AlertCircle,
  Clock3,
  Share2,
} from "lucide-react";
import { CollapsibleSection, useCollapsed } from "./CollapsibleSection";

interface FeedItem {
  title: string;
  link: string;
  source: string;
  publishedAt: string | null;
  summary: string;
  matchedKeywords: string[];
}

const DEFAULT_WHATSAPP = "966547620418";

export function OpportunityFeed({
  onNotify,
}: {
  onNotify?: (msg: string) => void;
}) {
  const feedOpen = useCollapsed("opportunities", true);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customKeyword, setCustomKeyword] = useState("");
  const [activeKeyword, setActiveKeyword] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [whatsappNumber, setWhatsappNumber] = useState(DEFAULT_WHATSAPP);
  const [feedMeta, setFeedMeta] = useState<{ total: number; fetchedAt: string } | null>(null);

  const load = useCallback(async (keyword: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "40" });
      if (keyword.trim()) params.set("keywords", keyword.trim());
      const res = await fetch(`/api/opportunities?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذر جلب الإعلانات");
      setItems(Array.isArray(data.items) ? data.items : []);
      setFeedMeta({ total: Number(data.total) || 0, fetchedAt: data.fetchedAt });
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر جلب الإعلانات");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  const searchKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    const kw = customKeyword.trim();
    setActiveKeyword(kw);
    load(kw);
  };

  const toggleSelect = (link: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(link)) next.delete(link);
      else next.add(link);
      return next;
    });
  };

  const buildMessage = (list: FeedItem[]) => {
    const header =
      "📢 إعلانات وفرص بتخصصك (AutoCAD • Revit BIM • MEP • تشغيل وصيانة O&M)";
    const body = list
      .slice(0, 15)
      .map(
        (item, i) =>
          `${i + 1}) ${item.title}\n${item.source}${
            item.publishedAt
              ? ` • ${new Date(item.publishedAt).toLocaleDateString("ar-EG")}`
              : ""
          }\n${item.link}`
      )
      .join("\n\n");
    return `${header}\n\n${body}\n\n— تم جمعها تلقائيًا من منصة مِحور الهندسية`;
  };

  const openWhatsApp = (list: FeedItem[]) => {
    const text = buildMessage(list);
    const number = whatsappNumber.replace(/[^\d]/g, "");
    const url = number
      ? `https://wa.me/${number}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener");
    onNotify?.(
      `فتح واتساب على رقم ${number || "الواتساب"} — دوس إرسال لاستلام الإعلانات`
    );
  };

  const selectedItems = items.filter((i) => selected.has(i.link));
  const listForWhatsapp = selectedItems.length > 0 ? selectedItems : items;

  const timeAgo = (iso: string | null) => {
    if (!iso) return "";
    const diff = Date.now() - Date.parse(iso);
    if (!Number.isFinite(diff) || diff < 0) return "";
    const h = Math.floor(diff / 3600000);
    if (h < 1) return "الآن";
    if (h === 1) return "قبل ساعة";
    if (h === 2) return "قبل ساعتين";
    if (h < 24) return `قبل ${h} ساعات`;
    const d = Math.floor(h / 24);
    if (d === 1) return "قبل يوم";
    if (d === 2) return "قبل يومين";
    return `قبل ${d} أيام`;
  };

  return (
    <CollapsibleSection
      storageKey="opportunities-feed"
      flush
      title="إعلانات وفرص شغل بتخصصك"
      subtitle="من مصادر مفتوحة مجانية (أخبار جوجل) — مصفّاة على AutoCAD / Revit / MEP / O&M والخليج"
      icon={
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#3f8696] text-white shadow-md">
          <Briefcase className="w-5 h-5" />
        </span>
      }
      badge={
        <span className="rounded-full border border-[#b5e2d4] bg-[#dff3ee] px-2 py-0.5 font-mono text-[11px] font-bold text-[#14614f] dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          {items.length} نتيجة
        </span>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => load(activeKeyword)}
            className="clay-pill inline-flex cursor-pointer items-center gap-1.5 px-3 py-2 text-[11px]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            تحديث
          </button>
          <button
            type="button"
            onClick={() => openWhatsApp(listForWhatsapp)}
            disabled={items.length === 0}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[#25D366] px-3.5 py-2 text-[11px] font-extrabold text-white shadow-sm disabled:opacity-50"
            title="يفتح واتساب على رقمك مع الإعلانات جاهزة للإرسال"
          >
            <MessageCircle className="h-4 w-4" />
            إشعار واتساب {selectedItems.length > 0 ? `(${selectedItems.length})` : ""}
          </button>
        </div>
      }
    >
      <div className="space-y-3 px-5 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={searchKeyword} className="flex min-w-[240px] flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={customKeyword}
                onChange={(e) => setCustomKeyword(e.target.value)}
                placeholder="أضف كلمة بحث (مثال: Jeddah hospital, BIM coordinator)"
                className="w-full rounded-full border border-slate-200 bg-white py-2 pl-3 pr-9 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>
            <button type="submit" className="clay-pill cursor-pointer px-4 py-2 text-xs">
              بحث
            </button>
          </form>

          <div className="flex items-center gap-1.5">
            <span className="shrink-0 text-[11px] font-bold text-slate-600 dark:text-slate-400">
              واتساب:
            </span>
            <input
              dir="ltr"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              className="w-[150px] rounded-full border border-slate-200 bg-white px-3 py-2 text-left font-mono text-[11px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </div>
        </div>

        <div className="rounded-xl border border-[#c6e4d8] bg-[#eef6f2] px-3.5 py-2.5 text-[11px] leading-relaxed text-[#3a5a52] dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-200">
          <strong className="font-extrabold">كيف بيوصلك واتساب؟</strong> الضغط على الزر
          يفتح واتساب على رقمك{" "}
          <span className="font-mono">{whatsappNumber}</span> والرسالة مكتوبة جاهزة
          بالإعلانات — دوس إرسال وتوصلك عندك. واتساب الرسمي مايسمحش لأي موقع يبعت
          لوحده (ده لمنع السبام)، والبديل الرسمي للإرسال التلقائي هو WhatsApp Business
          Cloud API برقم أعمال مخصص — مش هنخاطر برقمك الشخصي.
        </div>
      </div>

      <div className="px-5 pb-4 pt-2">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> جاري جمع الإعلانات من المصادر…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 py-8 text-center text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
            <AlertCircle className="mx-auto mb-1.5 h-5 w-5" />
            {error}
            <button
              type="button"
              onClick={() => load(activeKeyword)}
              className="mx-auto mt-2 block font-bold underline"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center dark:border-slate-700">
            <Landmark className="mx-auto mb-2 h-7 w-7 text-slate-300" />
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
              مفيش إعلانات مطابقة للتخصص دلوقتي
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">جرب كلمة بحث أو حدّث لاحقًا</p>
          </div>
        ) : (
          <>
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5" />
                {feedMeta?.fetchedAt
                  ? `آخر تحديث ${new Date(feedMeta.fetchedAt).toLocaleString("ar-EG", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "numeric",
                      month: "short",
                    })}`
                  : ""}
              </span>
              {selectedItems.length > 0 && (
                <span className="inline-flex items-center gap-2">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    {selectedItems.length} محددة للواتساب
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="underline hover:text-slate-700"
                  >
                    إلغاء التحديد
                  </button>
                </span>
              )}
            </div>

            <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-0.5">
              {items.map((item) => (
                <li
                  key={item.link}
                  className={`rounded-2xl border p-3 transition-colors ${
                    selected.has(item.link)
                      ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40"
                      : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/60"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(item.link)}
                      onChange={() => toggleSelect(item.link)}
                      className="mt-1 shrink-0 rounded text-emerald-600"
                      title="تحديد للإرسال على واتساب"
                    />
                    <div className="min-w-0 flex-1">
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-extrabold leading-snug text-slate-900 hover:text-teal-700 dark:text-white dark:hover:text-emerald-400"
                      >
                        {item.title}
                      </a>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1 font-bold">
                          <ExternalLink className="h-3 w-3" />
                          {item.source}
                        </span>
                        {timeAgo(item.publishedAt) && <span>• {timeAgo(item.publishedAt)}</span>}
                        {item.matchedKeywords.slice(0, 3).map((k) => (
                          <span
                            key={k}
                            className="rounded-full border border-[#bfe8d7] bg-[#e6f6ef] px-1.5 py-0.5 font-bold text-[#12614d] dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                      {item.summary && (
                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                          {item.summary}
                        </p>
                      )}
                    </div>
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="clay-pill inline-flex shrink-0 items-center gap-1 px-2.5 py-1.5 text-[11px]"
                    >
                      <Share2 className="h-3 w-3" />
                      فتح
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </CollapsibleSection>
  );
}
