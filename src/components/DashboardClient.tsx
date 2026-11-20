"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ProjectRecord,
  SiteOperationRecord,
  CertificateRecord,
  EngineeringFileRecord,
  EngineerProfileRecord,
  CvExperienceRecord,
  GeneralInfoRecord,
  HaramTaskRecord,
} from "@/db/schema";
import {
  DateRangeKey,
  SegmentKey,
  SEGMENT_LABELS,
  isImageExtension,
  isPdfExtension,
} from "@/lib/engineering";
import {
  loadLatestSnapshot,
  loadSnapshot,
  notifyOutboxChanged,
  queueOp,
  saveSnapshot,
  snapshotKey,
} from "@/lib/offlineDb";
import { requestBackgroundSync, syncOutbox } from "@/lib/offlineSync";
import {
  OutputTrendLineChart,
  WorkloadBarChart,
  VaultFormatDonutChart,
  LinePoint,
  BarItem,
  DonutSlice,
} from "./EngineeringCharts";
import { MasterProjectsTable } from "./MasterProjectsTable";
import { FileVaultAndSamples } from "./FileVaultAndSamples";
import { OperationsAndCertificates } from "./OperationsAndCertificates";
import { NewProjectModal } from "./NewProjectModal";
import { EditProjectModal } from "./EditProjectModal";
import {
  EditOperationModal,
  EditCertificateModal,
} from "./EditRecordsModals";
import { ProfessionalCVSection } from "./ProfessionalCVSection";
import { GeneralInfoGallery } from "./GeneralInfoGallery";
import { ThemeSettingsPanel, applyMode } from "./ThemeSettingsPanel";
import { OfflineManager } from "./OfflineManager";
import { HaramTasksPanel } from "./HaramTasksPanel";
import { AutodeskWorkspace } from "./AutodeskWorkspace";
import { ReportsPanel } from "./ReportsPanel";
import { OpportunityFeed } from "./OpportunityFeed";
import { DashboardHeader } from "./DashboardHeader";
import { WorkspaceActivationModal } from "./WorkspaceActivationModal";
import { ProfilePhoto } from "./ProfilePhoto";
import { StartGuideModal } from "./StartGuideModal";
import {
  TrendingUp,
  Layers,
  Wrench,
  HardDrive,
  Check,
  Sparkles,
  Award,
  FolderKanban,
  Activity,
  Zap,
  UserCheck,
  Landmark,
  Search,
  Bell,
  Sun,
  Moon,
  Palette,
  Play,
  Heart,
  Clock,
  Flame,
  Crown,
  Settings,
  Home,
  Plus,
  Share2,
  RotateCcw,
  Star,
} from "lucide-react";

export interface DashboardPayload {
  profile?: EngineerProfileRecord | null;
  cvExperiences?: CvExperienceRecord[];
  generalInfo?: GeneralInfoRecord[];
  projectFileStats: Record<
    string,
    { count: number; sizeBytes: number; sizeFormatted: string }
  >;
  filters: {
    range: DateRangeKey;
    segment: SegmentKey;
    search: string;
    samplesOnly: boolean;
  };
  kpis: {
    activeProjects: {
      value: number;
      totalProjects: number;
      avgProgress: number;
      trend: string;
    };
    sheetsAndModels: {
      value: number;
      hoursLogged: number;
      trend: string;
    };
    omEfficiency: {
      value: number;
      activeSites: number;
      totalSites: number;
      ticketsResolved: number;
      ticketsTotal: number;
      trend: string;
    };
    vaultAndSamples: {
      fileCount: number;
      totalSizeFormatted: string;
      totalSizeBytes: number;
      readySamples: number;
      certificatesCount: number;
      trend: string;
    };
  };
  lineSeries: LinePoint[];
  barSeries: BarItem[];
  donutSeries: DonutSlice[];
  projects: ProjectRecord[];
  siteOperations: SiteOperationRecord[];
  certificates: CertificateRecord[];
  certificateFiles?: EngineeringFileRecord[];
  files: EngineeringFileRecord[];
}

type WorkspaceTab = "all" | "parallel" | "vault" | "om_certs" | "haram" | "cv";

export function DashboardClient({
  initialData,
}: {
  initialData: DashboardPayload;
}) {
  const [data, setData] = useState<DashboardPayload>(initialData);
  const [range, setRange] = useState<DateRangeKey>("all");
  const [segment, setSegment] = useState<SegmentKey>("all");
  const [search, setSearch] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("all");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDark, setIsDark] = useState<boolean>(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState<boolean>(false);
  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(
    null
  );
  const [editingOperation, setEditingOperation] =
    useState<SiteOperationRecord | null>(null);
  const [editingCertificate, setEditingCertificate] =
    useState<CertificateRecord | null>(null);
  const [showActivationModal, setShowActivationModal] = useState<boolean>(false);
  const [showStartGuide, setShowStartGuide] = useState<boolean>(false);
  const [showThemePanel, setShowThemePanel] = useState<boolean>(false);
  const [copiedPortfolio, setCopiedPortfolio] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [cachedMode, setCachedMode] = useState<boolean>(false);
  const [syncingQueue, setSyncingQueue] = useState<boolean>(false);
  const [photoVersion, setPhotoVersion] = useState<number>(0);
  const [haramTasks, setHaramTasks] = useState<HaramTaskRecord[]>([]);
  const syncInFlightRef = useRef<boolean>(false);

  // Haram tasks live in their own endpoint (heavy Excel register), so they are
  // fetched separately and reused for the reporting panel.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/haram-tasks", { credentials: "include", cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (alive && Array.isArray(json.tasks)) setHaramTasks(json.tasks);
      } catch {
        // offline — reports simply omit the Haram section
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Sync dark mode, online/offline status, and URL shortcuts
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));

    const updateOnline = () => setIsOnline(navigator.onLine);
    const syncTheme = () => setIsDark(document.documentElement.classList.contains("dark"));
    updateOnline();
    syncTheme();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    window.addEventListener("mihwar-theme-change", syncTheme);

    // Handle Shortcut URL parameters (?action=new_project or ?tab=vault)
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (
      tabParam === "parallel" ||
      tabParam === "vault" ||
      tabParam === "om_certs" ||
      tabParam === "haram" ||
      tabParam === "cv"
    ) {
      setActiveTab(tabParam);
    }
    if (params.get("action") === "new_project") {
      setShowNewProjectModal(true);
    }

    // Show the beginner guide automatically on first visit only
    try {
      if (!localStorage.getItem("mihwar_guide_seen")) {
        setShowStartGuide(true);
      }
    } catch {
      // Ignore
    }

    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      window.removeEventListener("mihwar-theme-change", syncTheme);
    };
  }, []);

  const toggleDarkMode = () => {
    applyMode(isDark ? "light" : "dark");
  };

  // Debounce search query
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
    }, 220);
    return () => clearTimeout(t);
  }, [search]);

  const fetchDashboard = useCallback(
    async (
      nextRange: DateRangeKey,
      nextSegment: SegmentKey,
      nextSearch: string
    ) => {
      setIsLoading(true);
      const key = snapshotKey(nextRange, nextSegment, nextSearch);
      try {
        const params = new URLSearchParams();
        params.set("range", nextRange);
        params.set("segment", nextSegment);
        if (nextSearch.trim()) {
          params.set("search", nextSearch.trim());
        }
        const res = await fetch(`/api/dashboard?${params.toString()}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (res.ok) {
          const json = (await res.json()) as DashboardPayload;
          setData(json);
          setCachedMode(false);
          // Save for offline use (fire-and-forget).
          saveSnapshot(key, json).catch(() => {});
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      } catch {
        // Offline or server unreachable — fall back to the last saved snapshot.
        try {
          const snap =
            (await loadSnapshot(key)) || (await loadLatestSnapshot());
          if (snap?.payload) {
            setData(snap.payload as DashboardPayload);
            setCachedMode(true);
          }
        } catch {
          // keep current data
        }
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3200);
  };

  const flushQueue = useCallback(async (): Promise<void> => {
    // A ref (not state) prevents double replay when several online/sync events
    // arrive while a sync is already in flight.
    if (syncInFlightRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    syncInFlightRef.current = true;
    setSyncingQueue(true);
    try {
      const result = await syncOutbox();
      if (result.synced > 0) {
        await fetchDashboard(range, segment, debouncedSearch);
        showToast(
          result.remaining === 0
            ? `تمت مزامنة ${result.synced} ${result.synced === 1 ? "تعديل" : "تعديلات"} ✓`
            : `اترفع ${result.synced} وباقي ${result.remaining} في الطابور`
        );
      } else if (result.messages[0] && result.remaining > 0) {
        showToast(result.messages[0]);
      }
    } catch (error) {
      console.error("offline sync failed:", error);
    } finally {
      syncInFlightRef.current = false;
      setSyncingQueue(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, segment, debouncedSearch]);

  /** Queue a mutation for later sync + toast. Returns true if queued. */
  const queueOfflineChange = async (
    kind: string,
    label: string,
    method: "POST" | "PATCH" | "DELETE",
    url: string,
    opts: {
      json?: Record<string, unknown> | null;
      formFields?: Record<string, string>;
      files?: File[];
    } = {}
  ): Promise<boolean> => {
    try {
      await queueOp({
        kind,
        label,
        method,
        url,
        json: opts.json ?? null,
        formFields: opts.formFields,
        files: (opts.files || []).map((f) => ({
          field: "files",
          name: f.name,
          type: f.type || "application/octet-stream",
          blob: f,
        })),
      });
      requestBackgroundSync().catch(() => {});
      showToast("💾 محفوظ أوفلاين — هيترفع تلقائياً أول ما النت يرجع");
      return true;
    } catch {
      showToast("تعذر الحفظ أوفلاين — مساحة التخزين ممتلئة غالباً");
      return false;
    }
  };

  const isOfflineError = (err: unknown): boolean => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return true;
    if (err instanceof TypeError) return true;
    const msg = err instanceof Error ? err.message : "";
    return msg.includes("Failed to fetch") || msg.includes("NetworkError");
  };

  // Refetch live whenever range, segment, or search changes
  useEffect(() => {
    fetchDashboard(range, segment, debouncedSearch);
  }, [range, segment, debouncedSearch, fetchDashboard]);

  // Auto-sync the offline outbox when connectivity returns + on SW sync events.
  useEffect(() => {
    const onOnline = () => {
      fetchDashboard(range, segment, debouncedSearch);
      flushQueue();
    };
    const onSwSync = () => flushQueue();
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "MIHWAR_SYNC") onSwSync();
    };
    window.addEventListener("online", onOnline);
    navigator.serviceWorker?.addEventListener?.("message", onMessage as EventListener);
    return () => {
      window.removeEventListener("online", onOnline);
      try {
        (navigator.serviceWorker as unknown as { removeEventListener: typeof window.removeEventListener })?.removeEventListener?.("message", onMessage as EventListener);
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, segment, debouncedSearch]);

  // CRUD Handlers (offline-aware: queue + optimistic UI when offline)
  // ---- Optimistic local patches (so offline edits show instantly) ----
  const patchLocalProject = (id: number, patch: Record<string, unknown>) => {
    setData((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  };
  const removeLocalProject = (id: number) => {
    setData((prev) => ({ ...prev, projects: prev.projects.filter((p) => p.id !== id) }));
  };
  const patchLocalOperation = (id: number, patch: Record<string, unknown>) => {
    setData((prev) => ({
      ...prev,
      siteOperations: prev.siteOperations.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }));
  };
  const removeLocalOperation = (id: number) => {
    setData((prev) => ({
      ...prev,
      siteOperations: prev.siteOperations.filter((o) => o.id !== id),
    }));
  };
  const patchLocalCertificate = (id: number, patch: Record<string, unknown>) => {
    setData((prev) => ({
      ...prev,
      certificates: prev.certificates.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  };
  const removeLocalCertificate = (id: number) => {
    setData((prev) => ({
      ...prev,
      certificates: prev.certificates.filter((c) => c.id !== id),
    }));
  };
  const patchLocalFile = (id: number, patch: Record<string, unknown>) => {
    setData((prev) => ({
      ...prev,
      files: prev.files.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
  };
  const removeLocalFile = (id: number) => {
    setData((prev) => ({
      ...prev,
      files: prev.files.filter((f) => f.id !== id),
      certificateFiles: (prev.certificateFiles || []).filter((f) => f.id !== id),
    }));
  };

  const handleCreateProject = async (
    payload: Record<string, unknown>,
    files: File[] = []
  ) => {
    const title = String(payload.title || "مشروع جديد");
    try {
      const res = await fetch("/api/projects", {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        showToast("تعذر حفظ المشروع — حاول مرة أخرى");
        return;
      }
      const { project } = await res.json();
      let uploadedCount = 0;
      if (files.length > 0 && project?.id) {
        const formData = new FormData();
        files.forEach((f) => formData.append("files", f));
        formData.append("projectId", String(project.id));
        formData.append("segment", "auto");
        formData.append("projectTitle", String(payload.title || ""));
        formData.append("isClientSample", String(Boolean(payload.isSample)));
        if (payload.sampleSummary) formData.append("sampleNote", String(payload.sampleSummary));
        try {
          const upRes = await fetch("/api/files", { credentials: "include", method: "POST", body: formData });
          if (upRes.ok) {
            const upData = await upRes.json();
            uploadedCount = Array.isArray(upData.files) ? upData.files.length : 1;
          }
        } catch {
          // Upload failed — project is still created
        }
      }
      await fetchDashboard(range, segment, debouncedSearch);
      if (files.length > 0 && uploadedCount === 0) {
        showToast("تم إنشاء المشروع، لكن تعذر رفع الملفات — أرفقها من سجل المشاريع");
      } else if (uploadedCount > 0) {
        showToast(`تمت إضافة المشروع وربط ${uploadedCount} ${uploadedCount === 1 ? "ملف" : "ملفات"} به ✓`);
      } else {
        showToast("تمت إضافة المشروع وتحديث المؤشرات بنجاح");
      }
    } catch (err) {
      if (!isOfflineError(err)) {
        showToast("تعذر حفظ المشروع — حاول مرة أخرى");
        return;
      }
      // Offline: queue project + its files (files replay after project syncs is server-safe:
      // we store them as a second op; if it fails the user still has the project queued).
      await queueOfflineChange("project-create", `إضافة مشروع: ${title}`, "POST", "/api/projects", { json: payload });
      if (files.length > 0) {
        await queueOfflineChange(
          "file-upload",
          `رفع ${files.length} ${files.length === 1 ? "ملف" : "ملفات"} (مشروع: ${title})`,
          "POST",
          "/api/files",
          {
            formFields: {
              segment: "auto",
              projectTitle: title,
              isClientSample: String(Boolean(payload.isSample)),
              ...(payload.sampleSummary ? { sampleNote: String(payload.sampleSummary) } : {}),
            },
            files,
          }
        );
      }
      notifyOutboxChanged();
    }
  };

  const handleUpdateProject = async (id: number, payload: Record<string, unknown>) => {
    patchLocalProject(id, payload);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        credentials: "include",
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await fetchDashboard(range, segment, debouncedSearch);
        showToast("تم تحديث حالة المشروع");
      } else {
        showToast("تعذر تحديث المشروع");
      }
    } catch (err) {
      if (!isOfflineError(err)) return;
      await queueOfflineChange("project-update", `تعديل مشروع #${id}`, "PATCH", `/api/projects/${id}`, { json: payload });
    }
  };

  const handleDeleteProject = async (id: number) => {
    const backup = data.projects.find((p) => p.id === id);
    removeLocalProject(id);
    try {
      const res = await fetch(`/api/projects/${id}`, { credentials: "include", method: "DELETE" });
      if (res.ok) {
        await fetchDashboard(range, segment, debouncedSearch);
        showToast("تم حذف المشروع من السجل");
      } else if (backup) {
        setData((prev) => ({ ...prev, projects: [...prev.projects, backup] }));
        showToast("تعذر حذف المشروع");
      }
    } catch (err) {
      if (!isOfflineError(err)) return;
      await queueOfflineChange("project-delete", `حذف مشروع: ${backup?.title || `#${id}`}`, "DELETE", `/api/projects/${id}`);
    }
  };

  const handleAddOperation = async (payload: Record<string, unknown>) => {
    try {
      const res = await fetch("/api/operations", {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await fetchDashboard(range, segment, debouncedSearch);
        showToast("تم تسجيل بيانات الموقع والتشغيل والصيانة");
      } else {
        showToast("تعذر حفظ سجل الموقع");
      }
    } catch (err) {
      if (!isOfflineError(err)) return;
      await queueOfflineChange(
        "operation-create",
        `إضافة موقع: ${String(payload.siteName || "موقع جديد")}`,
        "POST",
        "/api/operations",
        { json: payload }
      );
    }
  };

  const handleUpdateOperation = async (id: number, payload: Record<string, unknown>) => {
    patchLocalOperation(id, payload);
    try {
      const res = await fetch(`/api/operations/${id}`, {
        credentials: "include",
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await fetchDashboard(range, segment, debouncedSearch);
        showToast("تم تحديث حالة الموقع");
      }
    } catch (err) {
      if (!isOfflineError(err)) return;
      await queueOfflineChange("operation-update", `تعديل سجل موقع #${id}`, "PATCH", `/api/operations/${id}`, { json: payload });
    }
  };

  const handleDeleteOperation = async (id: number) => {
    const backup = data.siteOperations.find((o) => o.id === id);
    removeLocalOperation(id);
    try {
      const res = await fetch(`/api/operations/${id}`, { credentials: "include", method: "DELETE" });
      if (res.ok) {
        await fetchDashboard(range, segment, debouncedSearch);
        showToast("تم حذف سجل الموقع");
      } else if (backup) {
        setData((prev) => ({ ...prev, siteOperations: [...prev.siteOperations, backup] }));
      }
    } catch (err) {
      if (!isOfflineError(err)) return;
      await queueOfflineChange("operation-delete", `حذف موقع: ${backup?.siteName || `#${id}`}`, "DELETE", `/api/operations/${id}`);
    }
  };

  const handleAddCertificate = async (payload: Record<string, unknown>) => {
    try {
      const res = await fetch("/api/certificates", {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await fetchDashboard(range, segment, debouncedSearch);
        showToast("تمت إضافة الشهادة المعتمدة بنجاح");
      } else {
        showToast("تعذر إضافة الشهادة");
      }
    } catch (err) {
      if (!isOfflineError(err)) return;
      await queueOfflineChange(
        "certificate-create",
        `إضافة شهادة: ${String(payload.title || "شهادة جديدة")}`,
        "POST",
        "/api/certificates",
        { json: payload }
      );
    }
  };

  const handleUpdateCertificate = async (id: number, payload: Record<string, unknown>) => {
    patchLocalCertificate(id, payload);
    try {
      const res = await fetch(`/api/certificates/${id}`, {
        credentials: "include",
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await fetchDashboard(range, segment, debouncedSearch);
        showToast("تم حفظ تعديلات الشهادة ✓");
      }
    } catch (err) {
      if (!isOfflineError(err)) return;
      await queueOfflineChange("certificate-update", `تعديل شهادة #${id}`, "PATCH", `/api/certificates/${id}`, { json: payload });
    }
  };

  const handleDeleteCertificate = async (id: number) => {
    const backup = data.certificates.find((c) => c.id === id);
    removeLocalCertificate(id);
    try {
      const res = await fetch(`/api/certificates/${id}`, { credentials: "include", method: "DELETE" });
      if (res.ok) {
        await fetchDashboard(range, segment, debouncedSearch);
        showToast("تم حذف الشهادة");
      } else if (backup) {
        setData((prev) => ({ ...prev, certificates: [...prev.certificates, backup] }));
      }
    } catch (err) {
      if (!isOfflineError(err)) return;
      await queueOfflineChange("certificate-delete", `حذف شهادة: ${backup?.title || `#${id}`}`, "DELETE", `/api/certificates/${id}`);
    }
  };

  const handleToggleFileSample = async (id: number, current: boolean) => {
    patchLocalFile(id, { isClientSample: !current });
    try {
      const res = await fetch(`/api/files/${id}`, {
        credentials: "include",
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isClientSample: !current }),
      });
      if (res.ok) {
        await fetchDashboard(range, segment, debouncedSearch);
        showToast(!current ? "تمت إضافة الملف إلى عينات الشغل للعملاء ⭐" : "تمت إزالة الملف من عينات العملاء");
      }
    } catch (err) {
      if (!isOfflineError(err)) return;
      await queueOfflineChange(
        "file-toggle-sample",
        `${!current ? "اعتماد عينة" : "إزالة عينة"} لملف #${id}`,
        "PATCH",
        `/api/files/${id}`,
        { json: { isClientSample: !current } }
      );
    }
  };

  const handleDeleteFile = async (id: number) => {
    const backup = data.files.find((f) => f.id === id);
    removeLocalFile(id);
    try {
      const res = await fetch(`/api/files/${id}`, { credentials: "include", method: "DELETE" });
      if (res.ok) {
        await fetchDashboard(range, segment, debouncedSearch);
        showToast("تم حذف الملف من الخزنة");
      } else if (backup) {
        setData((prev) => ({ ...prev, files: [...prev.files, backup] }));
      }
    } catch (err) {
      if (!isOfflineError(err)) return;
      await queueOfflineChange("file-delete", `حذف ملف: ${backup?.fileName || `#${id}`}`, "DELETE", `/api/files/${id}`);
    }
  };

  const copyClientPortfolioSummary = async () => {
    const sampleProjs = data.projects.filter((p) => p.isSample).slice(0, 5);
    const certs = data.certificates.slice(0, 4);
    const prof = data.profile;
    const summaryText = [
      `🏗️ بورتفوليو الأعمال الهندسية — ${prof?.fullName || "مِحور الهندسي"}`,
      prof?.headline
        ? `• التخصص: ${prof.headline}`
        : "• التخصص: AutoCAD | Revit BIM | التشغيل والصيانة O&M",
      prof?.phoneOrWhatsapp ? `• للتواصل / واتساب: ${prof.phoneOrWhatsapp}` : "",
      prof?.email ? `• البريد الإلكتروني: ${prof.email}` : "",
      "================================================================",
      `• إجمالي اللوحات ونماذج الـ BIM المنجزة: ${data.kpis.sheetsAndModels.value} لوحة ونموذج`,
      `• كفاءة التشغيل والصيانة بالمواقع: ${data.kpis.omEfficiency.value}%`,
      "",
      "📌 أبرز عينات المشاريع الجاهزة:",
      ...sampleProjs.map(
        (p, idx) =>
          `${idx + 1}. [${p.code}] ${p.title} — (${p.software}) • ${p.sheetsCount} لوحة`
      ),
      "",
      "🏅 الشهادات والاعتمادات:",
      ...certs.map((c) => `• ${c.title} (${c.issuer})`),
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(summaryText);
      setCopiedPortfolio(true);
      showToast("تم نسخ بورتفوليو عينات الشغل والشهادات جاهز للإرسال للعميل!");
      setTimeout(() => setCopiedPortfolio(false), 2500);
    } catch {
      // Ignore
    }
  };

  const activeParallelList = data.projects.filter(
    (p) => p.status === "in_progress" || p.status === "review"
  );

  const firstName =
    (data.profile?.fullName || "م. محمد منصور")
      .replace(/^م\.\s*/, "")
      .split(" ")[0] || "محمد";

  const sidebarItems: Array<{
    key: WorkspaceTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    targetId: string;
  }> = [
    { key: "all", label: "اللوحة الشاملة", icon: Home, targetId: "top-of-dashboard" },
    { key: "parallel", label: "المشاريع والمهام", icon: FolderKanban, targetId: "projects-section" },
    { key: "vault", label: "الخزنة والعينات", icon: HardDrive, targetId: "vault-section" },
    { key: "haram", label: "مهام الحرم النبوي", icon: Landmark, targetId: "haram-section" },
    { key: "om_certs", label: "المواقع والشهادات", icon: Award, targetId: "om-certs-section" },
    { key: "cv", label: "السيرة الذاتية", icon: UserCheck, targetId: "cv-section" },
  ];

  // Clicking a sidebar icon switches the view AND smoothly scrolls the page
  // down to that section so the user lands exactly on what they picked.
  const navigateToSection = (key: WorkspaceTab, targetId: string) => {
    setActiveTab(key);
    window.setTimeout(() => {
      if (key === "all") {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        // Section may still be mounting after the tab switch — retry once.
        window.setTimeout(() => {
          document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 260);
      }
    }, 40);
  };

  const recentShowcaseProjects = (
    activeParallelList.length > 0 ? activeParallelList : data.projects
  ).slice(0, 3);

  return (
    <div id="top-of-dashboard" className="min-h-screen dashboard-shell py-3 px-2 sm:px-5 sm:py-5 flex flex-col scroll-mt-4">
      {/* Sculpted 3D Claymorphic Outer Board */}
      <div className="clay-board max-w-[1480px] w-full mx-auto p-3 sm:p-5 flex-1 flex flex-col lg:flex-row gap-5">
        {/* ============================================================
            1. Vertical 3D Navy-Slate Sidebar Rail (Reference Left/Right Rail)
           ============================================================ */}
        <aside
          aria-label="القائمة الجانبية"
          className="clay-sidebar hidden lg:flex lg:w-[238px] shrink-0 p-4 flex-col justify-between select-none"
        >
          <div>
            {/* 3D Avatar Medallion + Greeting */}
            <div className="flex flex-col items-center text-center pt-2 pb-5">
              <button
                type="button"
                onClick={() => setShowActivationModal(true)}
                title="تعديل بياناتي المهنية"
                className="relative w-24 h-24 rounded-full p-1.5 bg-gradient-to-b from-[#496580] to-[#1b2a38] shadow-[inset_0_2px_4px_rgba(255,255,255,0.35),0_10px_20px_rgba(8,16,24,0.55)] border-2 border-white/25 hover:scale-105 transition-transform"
              >
                <ProfilePhoto
                  alt={data.profile?.fullName || "م. محمد منصور"}
                  version={photoVersion}
                  imgClassName="w-full h-full rounded-full object-cover"
                />
                <span
                  className={`absolute bottom-1 left-1 w-3.5 h-3.5 rounded-full border-2 border-[#1e2e3e] ${
                    isOnline ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                />
              </button>
              <div className="mt-3 text-base font-extrabold text-white tracking-tight">
                أهلاً، م. {firstName}!
              </div>
              <div className="text-[11px] text-slate-300/80 line-clamp-1 mt-0.5">
                AutoCAD • Revit • O&M
              </div>
            </div>

            {/* Navigation Pill List */}
            <nav className="space-y-2 mt-1" aria-label="أقسام المنصة">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => navigateToSection(item.key, item.targetId)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-xs transition-all cursor-pointer ${
                      active
                        ? "clay-nav-active"
                        : "rounded-2xl text-slate-200/85 hover:bg-white/10 hover:text-white font-bold"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        active ? "text-[#245968]" : "text-[#8cc3cd]"
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setShowThemePanel(true)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold text-slate-200/85 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
              >
                <Settings className="w-4 h-4 shrink-0 text-[#8cc3cd]" />
                <span>الألوان والمظهر</span>
              </button>
            </nav>
          </div>

          {/* Bottom Sculpted Promo Card inside Sidebar */}
          <div className="clay-sidebar-promo p-4 text-center mt-6">
            <div className="mx-auto w-11 h-11 rounded-2xl bg-gradient-to-b from-[#d8e6f0] to-[#9fb6c8] text-[#1e3142] flex items-center justify-center shadow-md mb-2.5">
              <Crown className="w-5 h-5" />
            </div>
            <div className="text-xs font-extrabold text-white">
              خزنة هندسية مفتوحة
            </div>
            <p className="text-[11px] text-slate-300/80 mt-1 leading-relaxed">
              رفع ملفات بكل الصيغ والأحجام مجاناً + عمل أوفلاين
            </p>
            <button
              type="button"
              onClick={() => setShowNewProjectModal(true)}
              className="clay-btn-teal w-full py-2 px-3 text-xs mt-3 cursor-pointer"
            >
              + مشروع / مهمة
            </button>
          </div>
        </aside>

        {/* ============================================================
            2. Main Sculpted Workspace Column
           ============================================================ */}
        <div
          id="main-content"
          className="flex-1 min-w-0 flex flex-col gap-5"
        >
          {/* Top Claymorphic Header Bar (Dashboard Title + Pill Search + 3D Circle Icons) */}
          <header className="flex flex-wrap items-center justify-between gap-3 px-1 pt-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                لوحة التحكم
              </h1>
              <span
                className="clay-pill hidden sm:inline-flex items-center gap-1.5 px-3 py-1 text-[11px]"
                aria-live="polite"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isLoading ? "bg-amber-500 animate-ping" : "bg-emerald-600"
                  }`}
                />
                {isLoading ? "جاري التحديث…" : SEGMENT_LABELS[segment]}
              </span>
            </div>

            {/* Pill Search Input */}
            <div className="relative flex-1 min-w-[210px] max-w-md order-last md:order-none">
              <Search className="w-4 h-4 text-slate-600 dark:text-slate-300 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                aria-label="البحث في مساحة العمل"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث عن مشروع، ملف (.dwg, .rvt)، أو شهادة..."
                className="clay-pill w-full pr-10 pl-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-600/80 dark:placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            {/* Circular 3D Action Buttons (Bell, Theme, DarkMode, Profile) */}
            <div className="flex items-center gap-2">
              {/* Date Range Pill Select */}
              <select
                aria-label="الفترة الزمنية"
                value={range}
                onChange={(e) => setRange(e.target.value as DateRangeKey)}
                className="clay-pill px-3 py-2 text-xs cursor-pointer focus:outline-none"
              >
                <option value="7d">آخر 7 أيام</option>
                <option value="30d">آخر 30 يوم</option>
                <option value="90d">آخر 90 يوم</option>
                <option value="1y">آخر سنة</option>
                <option value="all">كل الفترات</option>
              </select>

              <button
                type="button"
                onClick={() => setShowStartGuide(true)}
                title="دليل الاستخدام والإشعارات"
                className="clay-circle-btn relative w-10 h-10 flex items-center justify-center cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-[#22b98c] text-white text-[9px] font-extrabold flex items-center justify-center shadow">
                  {data.kpis.activeProjects.value}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowThemePanel(true)}
                title="ألوان الداش والمظهر"
                className="clay-circle-btn w-10 h-10 flex items-center justify-center cursor-pointer"
              >
                <Palette className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={toggleDarkMode}
                title={isDark ? "الوضع النهاري" : "الوضع الليلي"}
                className="clay-circle-btn w-10 h-10 flex items-center justify-center cursor-pointer"
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowActivationModal(true)}
                title="بياناتي المهنية والتفعيل"
                className="clay-circle-btn w-10 h-10 flex items-center justify-center cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Compact Segment Filter Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { key: "all", label: "الكل" },
                  { key: "autocad", label: "AutoCAD" },
                  { key: "revit", label: "Revit BIM" },
                  { key: "om", label: "تشغيل وصيانة" },
                  { key: "parallel", label: "مهام متوازية" },
                  { key: "certificates", label: "الشهادات" },
                ] as Array<{ key: SegmentKey; label: string }>
              ).map((seg) => (
                <button
                  key={seg.key}
                  type="button"
                  onClick={() => setSegment(seg.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-extrabold transition-all cursor-pointer ${
                    segment === seg.key
                      ? "clay-btn-teal"
                      : "clay-pill opacity-85 hover:opacity-100"
                  }`}
                >
                  {seg.label}
                </button>
              ))}

              {(segment !== "all" || range !== "all" || search.trim() !== "") && (
                <button
                  type="button"
                  onClick={() => {
                    setSegment("all");
                    setRange("all");
                    setSearch("");
                  }}
                  className="clay-pill px-2.5 py-1.5 text-[11px] inline-flex items-center gap-1 text-rose-700 dark:text-rose-300 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  إعادة ضبط
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={copyClientPortfolioSummary}
                className="clay-pill px-3 py-1.5 text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                {copiedPortfolio ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                    تم نسخ البورتفوليو
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    نسخ عينات للعميل
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ============================================================
              3. Hero 3D Greeting Banner Card (Matching "Good Evening, Aryan!")
             ============================================================ */}
          <section className="clay-hero relative overflow-hidden p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-5">
            <div className="flex flex-col sm:flex-row items-center gap-5 z-10 text-center sm:text-right">
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden border-2 border-white shadow-2xl shrink-0 bg-[#dceee6]">
                <ProfilePhoto
                  alt="الصورة الشخصية"
                  version={photoVersion}
                  imgClassName="w-full h-full object-cover"
                />
              </div>

              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#dff8ec] border border-[#bcead4] text-[11px] font-bold text-[#08775d] dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300 mb-2 shadow-sm">
                  <Sparkles className="w-3.5 h-3.5" />
                  منصة مِحور الهندسية • AutoCAD & Revit & O&M
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  مساء الخير، {data.profile?.fullName || "م. محمد منصور"}!
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-xl">
                  {data.profile?.headline ||
                    "جاهز لمتابعة مشاريع الأوتوكاد والريفيت ومهام الحرم النبوي وعينات الشغل اليوم!"}
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowNewProjectModal(true)}
                    className="clay-btn-teal px-5 py-2.5 text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    إضافة مشروع / مهمة
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("vault");
                      requestAnimationFrame(() => {
                        document
                          .getElementById("vault-section")
                          ?.scrollIntoView({ behavior: "smooth" });
                      });
                    }}
                    className="clay-pill px-4 py-2.5 text-xs cursor-pointer"
                  >
                    رفع ملفات للخزنة ∞
                  </button>
                </div>
              </div>
            </div>

            {/* Soft raised stats card inside the hero */}
            <div className="hidden xl:flex flex-col items-center justify-center px-5 py-4 rounded-3xl bg-[#fffefa]/80 border border-white shadow-[inset_0_2px_3px_rgba(255,255,255,0.95),0_10px_22px_rgba(87,79,66,0.12)] dark:bg-slate-900/70 dark:border-slate-700 shrink-0 text-center backdrop-blur-xs">
              <div className="text-2xl font-extrabold font-mono text-[#0f7a5c] dark:text-emerald-300 tabular-nums">
                {data.kpis.vaultAndSamples.totalSizeFormatted}
              </div>
              <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mt-0.5">
                {data.kpis.vaultAndSamples.fileCount} ملف محفوظ بالخزنة
              </div>
              <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                ● شغّال أونلاين وأوفلاين
              </div>
            </div>
          </section>

          {/* ============================================================
              4. Four Sculpted 3D Pastel KPI Cards (Matching the 4 Vertical Cards)
             ============================================================ */}
          <section
            className="grid grid-cols-2 xl:grid-cols-4 gap-4"
            aria-label="ملخص مؤشرات مساحة العمل"
          >
            {/* Card 1: Aqua-Teal ("Songs Played" equivalent) */}
            <div className="clay-kpi-1 p-5 flex flex-col justify-between">
              <div className="clay-icon-tile w-12 h-12 bg-[#e4fff2] flex items-center justify-center text-[#125f47] mb-4">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-extrabold opacity-85">
                  لوحات ونماذج منجزة
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight mt-1 tabular-nums">
                  {data.kpis.sheetsAndModels.value.toLocaleString("en-US")}
                </div>
                <div className="text-[11px] font-bold mt-1.5 opacity-85">
                  {data.kpis.sheetsAndModels.trend} • AutoCAD & Revit
                </div>
              </div>
            </div>

            {/* Card 2: Cool Slate-Blue ("Favorites" equivalent) */}
            <div className="clay-kpi-2 p-5 flex flex-col justify-between">
              <div className="clay-icon-tile w-12 h-12 bg-[#ffffff] flex items-center justify-center text-[#3a443f] mb-4">
                <Heart className="w-6 h-6 fill-current" />
              </div>
              <div>
                <div className="text-xs font-extrabold opacity-85">
                  عينات وشهادات معتمدة
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight mt-1 tabular-nums">
                  {data.kpis.vaultAndSamples.readySamples}
                </div>
                <div className="text-[11px] font-bold mt-1.5 opacity-85">
                  +{data.kpis.vaultAndSamples.certificatesCount} شهادات جاهزة للعملاء
                </div>
              </div>
            </div>

            {/* Card 3: Frosted Ice-Blue ("Hours Listened" equivalent) */}
            <div className="clay-kpi-3 p-5 flex flex-col justify-between">
              <div className="clay-icon-tile w-12 h-12 bg-[#fff6d8] flex items-center justify-center text-[#685019] mb-4">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-extrabold opacity-85">
                  ساعات العمل الهندسي
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight mt-1 tabular-nums">
                  {data.kpis.sheetsAndModels.hoursLogged}
                </div>
                <div className="text-[11px] font-bold mt-1.5 opacity-85">
                  متوسط إنجاز {data.kpis.activeProjects.avgProgress}%
                </div>
              </div>
            </div>

            {/* Card 4: Periwinkle-Lavender ("Current Streak" equivalent) */}
            <div className="clay-kpi-4 p-5 flex flex-col justify-between">
              <div className="clay-icon-tile w-12 h-12 bg-[#ffe4e6] flex items-center justify-center text-[#6e3039] mb-4">
                <Flame className="w-6 h-6 fill-current" />
              </div>
              <div>
                <div className="text-xs font-extrabold opacity-85">
                  مشاريع ومواقع نشطة
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight mt-1 tabular-nums">
                  {data.kpis.activeProjects.value}
                </div>
                <div className="text-[11px] font-bold mt-1.5 opacity-85">
                  جاهزية تشغيل {data.kpis.omEfficiency.value}%
                </div>
              </div>
            </div>
          </section>

          {/* ============================================================
              5. Middle Analytics Row ("Listening Overview" 3D Pills + "Top Genres" 3D Donut)
             ============================================================ */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7">
              <OutputTrendLineChart
                data={data.lineSeries}
                activeSegment={segment}
              />
            </div>
            <div className="lg:col-span-5">
              <VaultFormatDonutChart
                data={data.donutSeries}
                barSeries={data.barSeries}
                totalFiles={data.kpis.vaultAndSamples.fileCount}
                totalSizeFormatted={data.kpis.vaultAndSamples.totalSizeFormatted}
                activeSegment={segment}
                onSelectSegment={(seg) => setSegment(seg)}
              />
            </div>
          </section>

          {/* ============================================================
              6. Bottom Showcase Row ("Recently Played" Projects + "Daily Mix" Studio Vault)
             ============================================================ */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left/Right Card 1: "Recently Played" -> أحدث المشاريع والمهام الجارية */}
            <div className="lg:col-span-6 clay-card p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    أحدث المشاريع والمهام الجارية
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    متابعة سريعة للمشاريع النشطة وتحديث نسبة الإنجاز
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("parallel");
                    document
                      .getElementById("projects-table-body")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="clay-pill px-3 py-1 text-[11px] cursor-pointer"
                >
                  عرض الكل ({data.projects.length})
                </button>
              </div>

              <div className="space-y-2.5 my-auto">
                {recentShowcaseProjects.map((proj, idx) => (
                  <div
                    key={proj.id}
                    className="clay-list-row p-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={
                          idx % 2 === 0
                            ? "/images/sample-revit-bim.png"
                            : "/images/sample-autocad-mep.png"
                        }
                        alt={proj.title}
                        className="w-12 h-12 rounded-xl object-cover border border-white/60 shadow-sm shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                          {proj.title}
                        </div>
                        <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 truncate mt-0.5">
                          {proj.clientOrSite} •{" "}
                          <span className="font-mono">{proj.progress}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {proj.progress < 100 && (
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateProject(proj.id, {
                              progress: Math.min(100, proj.progress + 10),
                            })
                          }
                          title="زيادة الإنجاز +10%"
                          className="clay-pill px-2 py-1 text-[10px] font-mono cursor-pointer"
                        >
                          +10%
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditingProject(proj)}
                        title="فتح وتعديل المشروع"
                        className="clay-play-circle w-9 h-9 flex items-center justify-center cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Left/Right Card 2: "Daily Mix" -> معرض عينات الشغل والخزنة */}
            <div className="lg:col-span-6 clay-card p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    استوديو العينات والخزنة الهندسية
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    نماذج AutoCAD وRevit وصور المشاريع الجاهزة للعرض والمشاركة
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("vault");
                    requestAnimationFrame(() => {
                      document
                        .getElementById("vault-section")
                        ?.scrollIntoView({ behavior: "smooth" });
                    });
                  }}
                  className="clay-pill px-3 py-1 text-[11px] cursor-pointer"
                >
                  فتح الخزنة
                </button>
              </div>

              <div
                onClick={() => {
                  setActiveTab("vault");
                  requestAnimationFrame(() => {
                    document
                      .getElementById("vault-section")
                      ?.scrollIntoView({ behavior: "smooth" });
                  });
                }}
                className="group relative rounded-2xl overflow-hidden border-2 border-white/50 shadow-lg cursor-pointer h-52 my-auto"
              >
                <img
                  src="/images/clay-studio-mix.png"
                  alt="Engineering Studio Showcase"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent p-4 flex items-end justify-between">
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#3f8696] text-white mb-1">
                      CAD • BIM • O&M Portfolio
                    </span>
                    <h4 className="text-base font-extrabold text-white">
                      حقيبة الأعمال والعينات المعتمدة
                    </h4>
                    <p className="text-xs text-slate-200 font-mono">
                      {data.kpis.vaultAndSamples.fileCount} ملف هندسي •{" "}
                      {data.kpis.vaultAndSamples.totalSizeFormatted}
                    </p>
                  </div>

                  <span className="clay-play-circle w-11 h-11 flex items-center justify-center shrink-0">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ============================================================
              7. Bottom Wide Discovery Strip (Matching "⭐ Discover new music — Explore Now")
             ============================================================ */}
          <section className="clay-card px-5 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="clay-icon-tile w-12 h-12 bg-gradient-to-b from-[#d8e6f0] to-[#a7bdd0] flex items-center justify-center text-[#1f3447] shrink-0">
                <Star className="w-6 h-6 fill-current" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  سجل مهام الحرم النبوي الشريف والوثائق الرسمية ✨
                </h3>
                <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">
                  استورد ملف الإكسل، أرفق اللوحات والصور لكل مهمة، أو شارك أي ملف بالإيميل وجوجل درايف
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("haram");
                  requestAnimationFrame(() => {
                    document
                      .getElementById("haram-section")
                      ?.scrollIntoView({ behavior: "smooth" });
                  });
                }}
                className="clay-btn-teal px-5 py-2.5 text-xs cursor-pointer"
              >
                استعراض مهام الحرم
              </button>
            </div>
          </section>

          {/* Offline status, pending queue & one-tap offline preparation */}
          <OfflineManager
            isOnline={isOnline}
            filesToCache={[
              ...data.files
                .filter((f) => isImageExtension(f.extension) || isPdfExtension(f.extension))
                .map((f) => `/api/files/${f.id}/preview`),
              ...(data.generalInfo || [])
                .filter((g) => g.storagePath)
                .map((g) => `/api/general-info/${g.id}/preview`),
            ]}
            onSynced={() => fetchDashboard(range, segment, debouncedSearch)}
            onNotify={showToast}
          />

          {/* Autodesk APS account connection and cloud model browser */}
          <AutodeskWorkspace />

          {/* Workload Bar Chart across Engineering Workstreams */}
          {activeTab === "all" && (
            <section>
              <WorkloadBarChart
                data={data.barSeries}
                activeSegment={segment}
                onSelectSegment={(seg) => setSegment(seg)}
              />
            </section>
          )}

        {/* 3. Master Sortable & Filterable Projects Table */}
        {(activeTab === "all" || activeTab === "parallel") && (
          <section id="projects-section" className="scroll-mt-4">
            <MasterProjectsTable
              projects={data.projects}
              fileStats={data.projectFileStats || {}}
              onUpdateProject={handleUpdateProject}
              onDeleteProject={handleDeleteProject}
              onOpenNewProject={() => setShowNewProjectModal(true)}
              onFilesChanged={() =>
                fetchDashboard(range, segment, debouncedSearch)
              }
              onToggleFileSample={handleToggleFileSample}
              onDeleteFile={handleDeleteFile}
              onOpenEditProject={setEditingProject}
            />
          </section>
        )}

        {/* 4. Free Unlimited File Vault & Client Samples Showcase */}
        {(activeTab === "all" || activeTab === "vault") && (
          <section id="vault-section">
            <FileVaultAndSamples
              files={data.files}
              projects={data.projects}
              onFilesUploaded={() =>
                fetchDashboard(range, segment, debouncedSearch)
              }
              onToggleFileSample={handleToggleFileSample}
              onDeleteFile={handleDeleteFile}
              onNotify={showToast}
            />
          </section>
        )}

        {/* 5. Site Operations & Maintenance History + Certificates Vault */}
        {(activeTab === "all" || activeTab === "om_certs") && (
          <section id="om-certs-section" className="scroll-mt-4">
            <OperationsAndCertificates
              operations={data.siteOperations}
              certificates={data.certificates}
              certificateFiles={data.certificateFiles || []}
              onCertificateFilesChanged={() =>
                fetchDashboard(range, segment, debouncedSearch)
              }
              onDeleteFile={handleDeleteFile}
              onNotify={showToast}
              onAddOperation={handleAddOperation}
              onUpdateOperation={handleUpdateOperation}
              onDeleteOperation={handleDeleteOperation}
              onAddCertificate={handleAddCertificate}
              onDeleteCertificate={handleDeleteCertificate}
              onOpenEditOperation={setEditingOperation}
              onOpenEditCertificate={setEditingCertificate}
            />
          </section>
        )}

        {/* 5b. Haram tasks register (Excel import + per-task attachments) */}
        {(activeTab === "all" || activeTab === "haram") && (
          <section id="haram-section">
            <HaramTasksPanel onNotify={showToast} />
          </section>
        )}

        {/* 6. General Info Gallery (images / PDFs / notes) */}
        {(activeTab === "all" || activeTab === "cv") && (
          <section>
            <GeneralInfoGallery
              items={data.generalInfo || []}
              onChanged={() =>
                fetchDashboard(range, segment, debouncedSearch)
              }
            />
          </section>
        )}

        {/* 7. Professional CV (Objective / Skills / Experience / Education) */}
        {(activeTab === "all" || activeTab === "cv") && (
          <section id="cv-section" className="scroll-mt-4">
            <ProfessionalCVSection
              profile={data.profile || null}
              experiences={data.cvExperiences || []}
            />
          </section>
        )}

          {/* PDF / Excel reporting from live dashboard data */}
          <ReportsPanel
            projects={data.projects}
            operations={data.siteOperations}
            certificates={data.certificates}
            haramTasks={haramTasks}
            files={data.files}
            activeRange={range}
          />

          {/* Specialisation job & opportunity feed with WhatsApp delivery */}
          <OpportunityFeed onNotify={showToast} />

          {/* Footer inside main column */}
          <footer className="pt-2 pb-16 lg:pb-2 text-center text-xs font-semibold text-slate-700 dark:text-slate-400">
            مِحور الهندسي — منصة تنظيم مشاريع الأوتوكاد والريفيت والتشغيل والصيانة وخزنة الملفات المفتوحة المجانية ∞
          </footer>
        </div>
      </div>

      {/* Mobile Bottom Native-Style App Navigation Dock */}
      <nav
        aria-label="شريط التنقل السريع للتطبيق"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 grid grid-cols-5 gap-1 text-[10px] font-bold"
      >
        <button
          type="button"
          onClick={() => {
            setActiveTab("all");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className={`flex flex-col items-center justify-center py-1 rounded-xl ${
            activeTab === "all"
              ? "text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/50"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          <Layers className="w-4 h-4 mb-0.5" />
          الرئيسية
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("parallel")}
          className={`flex flex-col items-center justify-center py-1 rounded-xl ${
            activeTab === "parallel"
              ? "text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/50"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          <FolderKanban className="w-4 h-4 mb-0.5" />
          المهام
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("vault")}
          className={`flex flex-col items-center justify-center py-1 rounded-xl ${
            activeTab === "vault"
              ? "text-teal-600 dark:text-teal-400 bg-teal-50/80 dark:bg-teal-950/50"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          <HardDrive className="w-4 h-4 mb-0.5" />
          الخزنة ∞
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("om_certs")}
          className={`flex flex-col items-center justify-center py-1 rounded-xl ${
            activeTab === "om_certs"
              ? "text-amber-600 dark:text-amber-400 bg-amber-50/80 dark:bg-amber-950/50"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          <Award className="w-4 h-4 mb-0.5" />
          الشهادات
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("haram")}
          className={`flex flex-col items-center justify-center py-1 rounded-xl ${
            activeTab === "haram"
              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/50"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          <Landmark className="w-4 h-4 mb-0.5" />
          الحرم
        </button>
      </nav>

      {/* New Project Modal */}
      <NewProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onCreateProject={handleCreateProject}
      />

      {/* Edit Project Modal */}
      <EditProjectModal
        project={editingProject}
        isOpen={editingProject !== null}
        onClose={() => setEditingProject(null)}
        onSave={async (id, payload) => {
          await handleUpdateProject(id, payload);
          showToast("تم حفظ تعديلات المشروع بنجاح ✓");
        }}
      />

      {/* Edit Site Operation Modal */}
      <EditOperationModal
        record={editingOperation}
        isOpen={editingOperation !== null}
        onClose={() => setEditingOperation(null)}
        onSave={async (id, payload) => {
          await handleUpdateOperation(id, payload);
          showToast("تم حفظ تعديلات سجل الموقع ✓");
        }}
      />

      {/* Edit Certificate Modal */}
      <EditCertificateModal
        record={editingCertificate}
        isOpen={editingCertificate !== null}
        onClose={() => setEditingCertificate(null)}
        onSave={handleUpdateCertificate}
      />

      {/* Workspace Activation & Profile Modal */}
      <WorkspaceActivationModal
        isOpen={showActivationModal}
        onClose={() => setShowActivationModal(false)}
        profile={data.profile || null}
        onWorkspaceUpdated={async () => {
          await fetchDashboard(range, segment, debouncedSearch);
          setPhotoVersion(Date.now());
          showToast("تم تحديث وتفعيل بيانات مساحة العمل بنجاح!");
        }}
      />

      {/* Appearance / Accent Colour Panel */}
      <ThemeSettingsPanel
        isOpen={showThemePanel}
        onClose={() => setShowThemePanel(false)}
      />

      {/* Beginner Start Guide Modal (auto-opens on first visit) */}
      <StartGuideModal
        isOpen={showStartGuide}
        onClose={() => {
          setShowStartGuide(false);
          try {
            localStorage.setItem("mihwar_guide_seen", "1");
          } catch {
            // Ignore
          }
        }}
      />

      {/* Floating Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-5 left-5 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 dark:bg-blue-600 text-white text-xs font-bold shadow-xl border border-slate-700 dark:border-blue-400">
          <Check className="w-4 h-4 text-emerald-400 dark:text-white shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
