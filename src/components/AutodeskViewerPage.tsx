"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, AlertCircle, Box, CheckCircle2, Clock3, ExternalLink, FileCode2, Loader2, RotateCcw, ShieldCheck, Unplug } from "lucide-react";
import { AutodeskViewer } from "./AutodeskViewer";

interface Status { configured: boolean; connected: boolean; callbackUrl?: string; displayName?: string | null; email?: string | null; setupUrl?: string }
interface Model { status: string; urn?: string; progress?: string | null; error?: string; messages?: unknown[] }

export function AutodeskViewerPage({ fileId, docsUrn, name }: { fileId: string; docsUrn: string; name: string }) {
  const source = docsUrn ? "docs" : "local";
  const validFileId = Number.isInteger(Number(fileId)) && Number(fileId) > 0;
  const validDocsUrn = /^[A-Za-z0-9_-]{10,1000}$/.test(docsUrn);
  const [account, setAccount] = useState<Status | null>(null);
  const [model, setModel] = useState<Model | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const preparing = useRef(false);

  const loadAccount = useCallback(async () => {
    try {
      const res = await fetch("/api/autodesk/status", { cache: "no-store" });
      const json = await res.json();
      setAccount(json);
      return json as Status;
    } catch {
      setError("تعذر قراءة حالة حساب Autodesk. تأكد من الإنترنت.");
      return null;
    }
  }, []);

  const checkModel = useCallback(async () => {
    if (!validFileId) return;
    try {
      const res = await fetch(`/api/autodesk/models?fileId=${encodeURIComponent(fileId)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) setError(json.error || "تعذر فحص حالة النموذج");
      else setModel(json);
    } catch {
      setError("تعذر الاتصال بـ Autodesk — الـ Viewer يحتاج إنترنت.");
    }
  }, [fileId, validFileId]);

  useEffect(() => {
    loadAccount().then((status) => {
      if (status?.connected && source === "local") checkModel();
    });
  }, [loadAccount, checkModel, source]);

  useEffect(() => {
    if (source !== "local" || model?.status !== "inprogress") return;
    const timer = setInterval(checkModel, 8000);
    return () => clearInterval(timer);
  }, [source, model?.status, checkModel]);

  const prepare = async () => {
    if (preparing.current || !validFileId) return;
    preparing.current = true;
    setWorking(true);
    setError("");
    try {
      const res = await fetch("/api/autodesk/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileId: Number(fileId) }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "تعذر تجهيز الملف");
      setModel(json);
      if (json.status === "inprogress") setTimeout(checkModel, 6000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تجهيز الملف");
    } finally {
      preparing.current = false;
      setWorking(false);
    }
  };

  const urn = source === "docs" ? docsUrn : model?.urn || "";
  const ready = source === "docs" ? validDocsUrn : model?.status === "success";
  const modelName = name || (source === "docs" ? "موديل Autodesk Docs" : `ملف CAD/BIM #${fileId}`);

  return (
    <div dir="rtl" className="min-h-screen bg-slate-950 text-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#111a23] px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/?tab=vault" className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white" title="رجوع للداشبورد"><ArrowRight className="h-4 w-4" /></Link>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-600"><Box className="h-5 w-5" /></span>
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold">Autodesk Viewer — {modelName}</div>
            <div className="text-[11px] text-slate-400">AutoCAD / Revit / IFC • عرض هندسي ثنائي وثلاثي الأبعاد</div>
          </div>
        </div>
        <Link href="/?tab=vault" className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/10">الرجوع للخزنة</Link>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-5 sm:px-6">
        {!account ? (
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300"><Loader2 className="h-4 w-4 animate-spin" /> جاري فحص ربط حساب Autodesk…</div>
        ) : !account.configured ? (
          <div className="rounded-2xl border border-amber-800/60 bg-amber-950/30 p-6">
            <AlertCircle className="mb-2 h-6 w-6 text-amber-400" />
            <h1 className="text-base font-extrabold">الربط محتاج إعدادات APS</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">سجّل تطبيق في Autodesk Platform Services ثم اضبط <code className="rounded bg-black/20 px-1">APS_CLIENT_ID</code> و <code className="rounded bg-black/20 px-1">APS_CLIENT_SECRET</code> في إعدادات السيرفر، وأضف عنوان Callback ده في تطبيق Autodesk:</p>
            <code dir="ltr" className="mt-3 block break-all rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-teal-300">{account.callbackUrl}</code>
            <a href="https://aps.autodesk.com/myapps/" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white">فتح Autodesk APS <ExternalLink className="h-3.5 w-3.5" /></a>
          </div>
        ) : !account.connected ? (
          <div className="rounded-2xl border border-teal-800/60 bg-teal-950/25 p-6">
            <Unplug className="mb-2 h-6 w-6 text-teal-400" />
            <h1 className="text-base font-extrabold">وصّل حساب Autodesk الأول</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">سجّل الدخول في Autodesk واسمح للمنصة بقراءة ملفاتك وعرض النماذج. كلمة السر لا تدخل هنا.</p>
            <a href="/api/autodesk/connect" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white"><ShieldCheck className="h-4 w-4" /> ربط حساب Autodesk</a>
          </div>
        ) : source === "local" && !validFileId ? (
          <div className="rounded-xl border border-rose-900/60 bg-rose-950/30 p-4 text-sm text-rose-200">ملف غير صالح؛ افتح ملف DWG أو RVT من الخزنة واضغط «عرض Autodesk».</div>
        ) : source === "docs" && !validDocsUrn ? (
          <div className="rounded-xl border border-rose-900/60 bg-rose-950/30 p-4 text-sm text-rose-200">URN غير صالح؛ اختَر النموذج من Autodesk Docs من داخل الداشبورد.</div>
        ) : ready && urn ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-800/40 bg-emerald-950/25 px-4 py-2.5 text-xs text-emerald-200"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> الملف جاهز للعرض في Autodesk Viewer</span><span className="text-[11px] text-slate-400">{account.displayName || account.email || "حساب Autodesk متصل"}</span></div>
            <div className="h-[75vh] min-h-[520px]"><AutodeskViewer urn={urn} source={source} /></div>
          </>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-[#151f2b] p-6 sm:p-8">
            <FileCode2 className="mb-2 h-8 w-8 text-teal-400" />
            <h1 className="text-lg font-extrabold">تجهيز «{modelName}» للعرض</h1>
            {model?.status === "inprogress" ? (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-indigo-800/50 bg-indigo-950/30 p-4 text-sm text-indigo-200"><Clock3 className="mt-0.5 h-4 w-4 shrink-0" /><span>Autodesk بيحوّل الملف لصيغة SVF2 حالياً. ده ممكن ياخد دقائق حسب حجم الملف، والصفحة هتحدّث الحالة تلقائياً. {model.progress || ""}</span></div>
            ) : model?.status === "failed" ? (
              <div className="mt-3 rounded-xl border border-rose-900/50 bg-rose-950/30 p-4 text-sm text-rose-200">فشل تحويل الملف في Autodesk. تأكد من سلامة الملف والملفات المرتبطة به (Xrefs في CAD).</div>
            ) : (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">ملفات CAD/Revit لا يمكن عرضها مباشرة من الخزنة. هنرفع نسخة منها إلى مساحة Autodesk APS ونبدأ التحويل. قد تترتب تكاليف حسب خطة Autodesk الخاصة بتطبيق APS. ملفك الأصلي يفضل محفوظ في الخزنة.</p>
            )}
            {error && <div className="mt-3 rounded-lg border border-rose-800/50 bg-rose-950/30 p-3 text-xs text-rose-200">{error}</div>}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {model?.status !== "inprogress" && <button type="button" disabled={working} onClick={prepare} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-60">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Box className="h-4 w-4" />}{working ? "جاري الرفع والتجهيز…" : model?.status === "failed" ? "إعادة تجهيز الملف" : "رفع وتحويل وعرض في Autodesk"}</button>}
              <button type="button" onClick={checkModel} className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/10"><RotateCcw className="h-3.5 w-3.5" /> تحديث الحالة</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
