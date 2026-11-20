"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Box, CheckCircle2, ChevronLeft, ExternalLink, FileCode2, Folder, HardDrive, Loader2, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { CollapsibleSection } from "./CollapsibleSection";

interface Status { configured: boolean; connected: boolean; callbackUrl?: string; displayName?: string | null; email?: string | null }
interface BrowseEntry { id: string; type: string; name: string; derivativeUrn?: string | null; versionId?: string | null; webView?: string | null }
type Level = "hubs" | "projects" | "folders" | "contents" | "versions";

export function AutodeskWorkspace() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [level, setLevel] = useState<Level>("hubs");
  const [hubs, setHubs] = useState<BrowseEntry[]>([]);
  const [projects, setProjects] = useState<BrowseEntry[]>([]);
  const [folders, setFolders] = useState<BrowseEntry[]>([]);
  const [contents, setContents] = useState<BrowseEntry[]>([]);
  const [versions, setVersions] = useState<BrowseEntry[]>([]);
  const [hub, setHub] = useState<BrowseEntry | null>(null);
  const [project, setProject] = useState<BrowseEntry | null>(null);
  const [folderPath, setFolderPath] = useState<BrowseEntry[]>([]);
  const [item, setItem] = useState<BrowseEntry | null>(null);

  const refreshStatus = async () => {
    try {
      const r = await fetch("/api/autodesk/status", { cache: "no-store" });
      setStatus(await r.json());
    } catch { setError("تعذر قراءة حالة Autodesk"); }
  };
  useEffect(() => { refreshStatus(); }, []);

  const fetchLevel = async (params: Record<string, string>, onLoaded: (entries: BrowseEntry[]) => void, nextLevel: Level) => {
    setBusy(true); setError("");
    try {
      const r = await fetch(`/api/autodesk/browse?${new URLSearchParams(params)}`, { cache: "no-store" });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "تعذر تحميل الملفات");
      onLoaded(body.data || []);
      if (nextLevel === "versions" && Array.isArray(body.included) && body.included.length) {
        // Versions can be in included depending on the Autodesk hub.
        onLoaded([...(body.data || []), ...body.included.filter((x: BrowseEntry) => x.type === "versions")]);
      }
      setLevel(nextLevel);
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر الوصول لـ Autodesk Docs"); }
    finally { setBusy(false); }
  };

  const openHubs = () => { setHub(null); setProject(null); setFolderPath([]); setItem(null); fetchLevel({ kind: "hubs" }, setHubs, "hubs"); };
  const openProjects = (h: BrowseEntry) => { setHub(h); setProject(null); setFolderPath([]); setItem(null); fetchLevel({ kind: "projects", hub: h.id }, setProjects, "projects"); };
  const openTopFolders = (p: BrowseEntry) => {
    if (!hub) return;
    setProject(p); setFolderPath([]); setItem(null);
    fetchLevel({ kind: "folders", hub: hub.id, project: p.id }, setFolders, "folders");
  };
  const openFolder = (f: BrowseEntry, path?: BrowseEntry[]) => {
    if (!project) return;
    setFolderPath(path || [...folderPath, f]); setItem(null);
    fetchLevel({ kind: "contents", project: project.id, folder: f.id }, setContents, "contents");
  };
  const openVersions = (f: BrowseEntry) => {
    if (!project) return;
    setItem(f);
    fetchLevel({ kind: "versions", project: project.id, item: f.id }, setVersions, "versions");
  };

  const chooseVersion = async (v: BrowseEntry) => {
    let urn = v.derivativeUrn || item?.derivativeUrn || "";
    if (!urn && project) {
      setBusy(true);
      try {
        const r = await fetch(`/api/autodesk/browse?${new URLSearchParams({ kind: "version", project: project.id, version: v.id })}`);
        const body = await r.json();
        urn = body.data?.[0]?.derivativeUrn || body.included?.find((x: BrowseEntry) => x.derivativeUrn)?.derivativeUrn || "";
      } catch { /* no derivative */ }
      finally { setBusy(false); }
    }
    if (!urn) {
      setError("الملف ده لسه ملوش نسخة معروضة في Autodesk Docs. افتحه من Docs الأول عشان يتجهّز، أو ارفعه من الخزنة هنا واضغط عرض Autodesk.");
      return;
    }
    window.location.href = `/viewer/autodesk?urn=${encodeURIComponent(urn)}&name=${encodeURIComponent(item?.name || v.name || "موديل Autodesk Docs")}`;
  };

  const disconnect = async () => {
    if (!window.confirm("فصل حساب Autodesk من المتصفح ده؟")) return;
    await fetch("/api/autodesk/status", { method: "DELETE" });
    setStatus((prev) => prev ? { ...prev, connected: false } : prev);
    setLevel("hubs"); setHubs([]);
  };

  const entries = level === "hubs" ? hubs : level === "projects" ? projects : level === "folders" ? folders : level === "contents" ? contents : versions;

  return (
    <CollapsibleSection
      storageKey="autodesk-account"
      title="حساب Autodesk والعارض الهندسي"
      subtitle="اربط حسابك مرة واحدة، استعرض Autodesk Docs وافتح موديلات CAD / Revit داخل العارض الرسمي"
      icon={<span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#171c23] text-white"><Box className="h-5 w-5" /></span>}
      badge={status?.connected ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">متصل ✓</span> : undefined}
    >
      {!status ? (
        <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> جاري فحص حالة الربط…</div>
      ) : !status.configured ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="font-extrabold">⚠️ تكامل Autodesk مش مفعّل لسه</div>
          <p className="mt-1 leading-relaxed">لازم تسجّل تطبيق في Autodesk Platform Services وتحط <code>APS_CLIENT_ID</code> و <code>APS_CLIENT_SECRET</code> في متغيرات بيئة السيرفر. ده ربط رسمي من Autodesk — من غير المفاتيح مش ممكن عرض ملفات DWG/RVT في Viewer.</p>
          <div className="mt-2 break-all rounded-lg bg-white/70 p-2 font-mono text-[10px] dark:bg-slate-900/70">Callback URL: {status.callbackUrl}</div>
          <a className="mt-2 inline-flex items-center gap-1 font-bold underline" href="https://aps.autodesk.com/myapps/" target="_blank" rel="noreferrer">فتح Autodesk APS <ExternalLink className="h-3 w-3" /></a>
        </div>
      ) : !status.connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
          <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300"><Unplug className="h-4 w-4 text-amber-600" /> وصّل حساب Autodesk عشان تشوف ملفاتك ونماذجك هنا.</div>
          <a href="/api/autodesk/connect" className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"><ShieldCheck className="h-4 w-4" /> ربط حساب Autodesk</a>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/20">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" /> {status.displayName || status.email || "حساب Autodesk متصل"}</div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={openHubs} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700"><HardDrive className="h-3.5 w-3.5" /> استعرض Autodesk Docs</button>
              <button type="button" onClick={disconnect} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">فصل</button>
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">لو ملف DWG/RVT مرفوع في الخزنة هنا، اضغط زر «عرض Autodesk» بجانبه عشان يترفع ويتحول للعارض. الملفات الموجودة في Autodesk Docs يمكن فتحها من القائمة أدناه بدون إعادة رفع.</p>
          {(entries.length > 0 || busy || error) && (
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] dark:border-slate-700 dark:bg-slate-900/60">
                <button type="button" onClick={openHubs} className="font-bold text-blue-600 hover:underline">Autodesk Docs</button>
                {hub && <><ChevronLeft className="h-3 w-3 text-slate-400" /><button type="button" onClick={() => openProjects(hub)} className="text-slate-700 hover:underline dark:text-slate-300">{hub.name}</button></>}
                {project && <><ChevronLeft className="h-3 w-3 text-slate-400" /><button type="button" onClick={() => openTopFolders(project)} className="text-slate-700 hover:underline dark:text-slate-300">{project.name}</button></>}
                {folderPath.map((f, idx) => <span key={`${f.id}-${idx}`} className="inline-flex items-center gap-1"><ChevronLeft className="h-3 w-3 text-slate-400" /><button type="button" onClick={() => openFolder(f, folderPath.slice(0, idx + 1))} className="text-slate-700 hover:underline dark:text-slate-300">{f.name}</button></span>)}
                {item && <><ChevronLeft className="h-3 w-3 text-slate-400" /><span className="font-bold text-slate-800 dark:text-slate-200">{item.name}</span></>}
                <button type="button" onClick={() => { if (level === "hubs") openHubs(); else if (level === "projects" && hub) openProjects(hub); else if (level === "folders" && project) openTopFolders(project); else if (level === "contents" && folderPath.length) openFolder(folderPath[folderPath.length - 1], folderPath); else if (level === "versions" && item) openVersions(item); }} className="mr-auto rounded p-1 text-slate-400 hover:bg-slate-200" title="تحديث"><RefreshCw className="h-3.5 w-3.5" /></button>
              </div>
              {error && <div className="border-b border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-950 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
              {busy ? <div className="flex items-center gap-2 p-5 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> جاري تحميل الملفات…</div> : (
                <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                  {entries.length === 0 && <div className="p-5 text-xs text-slate-500">لا توجد ملفات في هذا المسار.</div>}
                  {entries.map((e) => (
                    <button key={e.id} type="button" onClick={() => { if (level === "hubs") openProjects(e); else if (level === "projects") openTopFolders(e); else if (level === "folders" || e.type === "folders") openFolder(e); else if (level === "contents" && e.type === "items") openVersions(e); else if (level === "versions") chooseVersion(e); }} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-right text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60">
                      {level === "hubs" || level === "projects" || e.type === "folders" ? <Folder className="h-4 w-4 shrink-0 text-amber-500" /> : <FileCode2 className="h-4 w-4 shrink-0 text-blue-600" />}
                      <span className="min-w-0 flex-1 truncate" title={e.name}>{e.name}</span>
                      {level === "versions" ? <span className="font-bold text-teal-600">عرض ←</span> : <ChevronLeft className="h-3.5 w-3.5 text-slate-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <Link href="https://docs.autodesk.com/" target="_blank" className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:underline dark:text-teal-400">فتح Autodesk Docs الرسمي <ExternalLink className="h-3 w-3" /></Link>
        </div>
      )}
    </CollapsibleSection>
  );
}
