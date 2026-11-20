"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Box, Loader2, Maximize2, RotateCcw } from "lucide-react";

type AutodeskViewerInstance = {
  start(): number;
  finish(): void;
  loadDocumentNode(doc: AutodeskDocument, node: unknown): Promise<unknown>;
  fitToView(): void;
  resize(): void;
  setTheme?(theme: string): void;
};
type AutodeskDocument = {
  getRoot(): {
    getDefaultGeometry(): unknown;
    search(query: Record<string, string>): Array<{ name?: string; guid?: string }>;
  };
};
type AutodeskNamespace = {
  Viewing: {
    Initializer(options: Record<string, unknown>, callback: () => void): void;
    GuiViewer3D: new (element: HTMLDivElement, config?: Record<string, unknown>) => AutodeskViewerInstance;
    Document: {
      load(urn: string, onSuccess: (doc: AutodeskDocument) => void, onError: (code: number, message?: string) => void): void;
    };
  };
};

declare global {
  interface Window {
    Autodesk?: AutodeskNamespace;
  }
}

const VIEWER_VERSION = "7.*";

export function AutodeskViewer({ urn, source }: { urn: string; source: "docs" | "local" }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<AutodeskViewerInstance | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [views, setViews] = useState<Array<{ name: string; node: unknown }>>([]);
  const [selected, setSelected] = useState(0);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setError("");
    setViews([]);
    let script: HTMLScriptElement | null = null;
    let stylesheet: HTMLLinkElement | null = null;
    let viewer: AutodeskViewerInstance | null = null;

    const fail = (message: string) => {
      if (cancelled) return;
      setError(message);
      setState("error");
    };

    const start = () => {
      if (cancelled || !window.Autodesk || !containerRef.current) return;
      const AV = window.Autodesk.Viewing;
      AV.Initializer(
        {
          env: "AutodeskProduction2",
          api: "streamingV2",
          getAccessToken: async (callback: (token: string, expiresIn: number) => void) => {
            try {
              const res = await fetch(`/api/autodesk/viewer-token?source=${source}`, { cache: "no-store", credentials: "include" });
              if (!res.ok) throw new Error("تعذر تجديد توكن Autodesk؛ افصل الحساب وأعد توصيله");
              const body = await res.json();
              callback(body.access_token, body.expires_in);
            } catch (e) {
              fail(e instanceof Error ? e.message : "انتهت جلسة Autodesk");
            }
          },
        },
        () => {
          if (cancelled || !containerRef.current) return;
          viewer = new AV.GuiViewer3D(containerRef.current, { extensions: [] });
          viewerRef.current = viewer;
          const started = viewer.start();
          if (started > 0) {
            fail("جهازك أو المتصفح لا يدعم WebGL. جرب Chrome أو Edge على جهاز أحدث.");
            return;
          }
          AV.Document.load(
            `urn:${urn}`,
            (doc) => {
              if (cancelled || !viewer) return;
              const all = doc.getRoot().search({ type: "geometry" });
              const options = all.length > 0 ? all : [doc.getRoot().getDefaultGeometry()];
              const available = options.filter(Boolean).map((node, i) => ({ name: (node as { name?: string }).name || `لوحة / منظر ${i + 1}`, node }));
              if (available.length === 0) {
                fail("لم يجد Autodesk مناظر قابلة للعرض في هذا الملف");
                return;
              }
              setViews(available);
              viewer.loadDocumentNode(doc, available[0].node).then(() => {
                if (!cancelled) setState("ready");
              }).catch(() => fail("تعذر فتح المنظر في Autodesk Viewer"));
              (viewer as AutodeskViewerInstance & { _mihwarDoc?: AutodeskDocument })._mihwarDoc = doc;
            },
            (code, message) => fail(`تعذر تحميل الملف من Autodesk (${code})${message ? `: ${message}` : ""}`)
          );
        }
      );
    };

    const load = () => {
      if (window.Autodesk?.Viewing) {
        start();
        return;
      }
      stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = `https://developer.api.autodesk.com/modelderivative/v2/viewers/${VIEWER_VERSION}/style.min.css`;
      document.head.appendChild(stylesheet);
      script = document.createElement("script");
      script.src = `https://developer.api.autodesk.com/modelderivative/v2/viewers/${VIEWER_VERSION}/viewer3D.min.js`;
      script.async = true;
      script.onload = start;
      script.onerror = () => fail("تعذر تحميل مكتبة Autodesk Viewer من الإنترنت. تأكد من الاتصال وحاول مرة أخرى.");
      document.body.appendChild(script);
    };
    load();
    return () => {
      cancelled = true;
      try { viewer?.finish(); } catch { /* ignore */ }
      viewerRef.current = null;
      if (script && script.parentNode) script.parentNode.removeChild(script);
      if (stylesheet && stylesheet.parentNode) stylesheet.parentNode.removeChild(stylesheet);
    };
  }, [urn, source, retryKey]);

  const selectView = async (index: number) => {
    const viewer = viewerRef.current as (AutodeskViewerInstance & { _mihwarDoc?: AutodeskDocument }) | null;
    if (!viewer || !views[index] || !viewer._mihwarDoc) return;
    setState("loading");
    setSelected(index);
    try {
      await viewer.loadDocumentNode(viewer._mihwarDoc, views[index].node);
      setState("ready");
    } catch {
      setError("تعذر تبديل المنظر");
      setState("error");
    }
  };

  return (
    <div className="relative flex h-full min-h-[480px] flex-col rounded-2xl border border-slate-700 bg-[#171c23] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#20252c] px-3 py-2 text-white">
        <div className="inline-flex items-center gap-2 text-xs font-bold">
          <Box className="h-4 w-4 text-teal-400" /> Autodesk Viewer — {source === "docs" ? "Autodesk Docs" : "ملف من الخزنة"}
        </div>
        <div className="flex items-center gap-2">
          {views.length > 1 && (
            <select aria-label="المنظر أو اللوحة" value={selected} onChange={(e) => selectView(Number(e.target.value))} className="max-w-[200px] rounded-lg border border-white/20 bg-[#2b3139] px-2 py-1.5 text-[11px] text-white">
              {views.map((v, i) => <option key={`${v.name}-${i}`} value={i}>{v.name}</option>)}
            </select>
          )}
          <button type="button" onClick={() => viewerRef.current?.fitToView()} className="rounded-lg p-1.5 hover:bg-white/10" title="توسيط الرسم">
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="relative flex-1 min-h-[430px]">
        <div ref={containerRef} className="absolute inset-0" />
        {state !== "ready" && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#171c23]/85 p-5">
            {state === "loading" ? (
              <div className="flex items-center gap-2 text-sm font-bold text-white"><Loader2 className="h-5 w-5 animate-spin text-teal-400" /> جاري تحميل المناظر…</div>
            ) : (
              <div className="pointer-events-auto max-w-md rounded-xl border border-rose-900/70 bg-rose-950/40 p-5 text-center text-rose-200">
                <AlertCircle className="mx-auto mb-2 h-6 w-6" />
                <p className="text-xs leading-relaxed">{error}</p>
                <button type="button" onClick={() => setRetryKey((v) => v + 1)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-xs font-bold text-white hover:bg-teal-700">
                  <RotateCcw className="h-3.5 w-3.5" /> إعادة المحاولة
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
