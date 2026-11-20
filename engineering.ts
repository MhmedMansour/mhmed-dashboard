export type DateRangeKey = "7d" | "30d" | "90d" | "1y" | "all";
export type SegmentKey = "all" | "autocad" | "revit" | "om" | "parallel" | "certificates";

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let idx = 0;
  let val = bytes;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val >= 100 || idx <= 1 ? val.toFixed(0) : val.toFixed(2)} ${units[idx]}`;
}

export function normalizeExtension(fileNameOrExt: string): string {
  const trimmed = fileNameOrExt.trim().toLowerCase();
  if (!trimmed) return ".dat";
  if (trimmed.startsWith(".") && !trimmed.slice(1).includes(".")) {
    return trimmed;
  }
  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot === -1) return `.${trimmed}`;
  return trimmed.slice(lastDot);
}

export type FileFormatGroup =
  | "autocad"
  | "revit_bim"
  | "documents_pdf"
  | "images"
  | "archives_other";

export const IMAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".bmp",
  ".tif",
  ".tiff",
  ".heic",
  ".avif",
  ".ico",
];

export const PDF_EXTENSIONS = [".pdf"];

export function isImageExtension(extension: string): boolean {
  return IMAGE_EXTENSIONS.includes(normalizeExtension(extension));
}

export function isPdfExtension(extension: string): boolean {
  return PDF_EXTENSIONS.includes(normalizeExtension(extension));
}

export function classifyFileFormat(extension: string): {
  formatGroup: FileFormatGroup;
  suggestedSegment: "autocad" | "revit" | "om" | "certificates";
  labelAr: string;
} {
  const ext = normalizeExtension(extension);
  if ([".dwg", ".dxf", ".dwt", ".ctb", ".bak", ".shx"].includes(ext)) {
    return {
      formatGroup: "autocad",
      suggestedSegment: "autocad",
      labelAr: "رسومات AutoCAD",
    };
  }
  if ([".rvt", ".rfa", ".rte", ".rft", ".ifc", ".nwd", ".nwc", ".nwf", ".fbx", ".obj"].includes(ext)) {
    return {
      formatGroup: "revit_bim",
      suggestedSegment: "revit",
      labelAr: "نماذج Revit & BIM",
    };
  }
  if (PDF_EXTENSIONS.includes(ext)) {
    return {
      formatGroup: "documents_pdf",
      suggestedSegment: "om",
      labelAr: "مستندات ولوحات PDF",
    };
  }
  if ([".doc", ".docx", ".ppt", ".pptx", ".txt", ".md"].includes(ext)) {
    return {
      formatGroup: "documents_pdf",
      suggestedSegment: "om",
      labelAr: "مستندات وملفات نصية",
    };
  }
  if (IMAGE_EXTENSIONS.includes(ext)) {
    return {
      formatGroup: "images",
      suggestedSegment: "om",
      labelAr: "صور ومرئيات بصرية",
    };
  }
  return {
    formatGroup: "archives_other",
    suggestedSegment: "om",
    labelAr: "أرشيف وجداول وملفات أخرى",
  };
}

export function getCutoffDate(range: DateRangeKey): string | null {
  if (range === "all") return null;
  const d = new Date();
  const daysMap: Record<Exclude<DateRangeKey, "all">, number> = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "1y": 365,
  };
  d.setDate(d.getDate() - daysMap[range]);
  return d.toISOString().split("T")[0];
}

export const SEGMENT_LABELS: Record<SegmentKey, string> = {
  all: "الكل (جميع التخصصات)",
  autocad: "رسومات أوتوكاد AutoCAD",
  revit: "نمذجة ريفيت Revit BIM",
  om: "التشغيل والصيانة O&M",
  parallel: "المشاريع المتوازية",
  certificates: "الشهادات والاعتمادات",
};

export const STATUS_CONFIG: Record<
  string,
  { label: string; badgeClass: string; dotClass: string }
> = {
  in_progress: {
    label: "قيد التنفيذ",
    badgeClass:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/70",
    dotClass: "bg-blue-500",
  },
  review: {
    label: "مراجعة واعتماد",
    badgeClass:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/70",
    dotClass: "bg-amber-500",
  },
  completed: {
    label: "مكتمل ومسلّم",
    badgeClass:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/70",
    dotClass: "bg-emerald-500",
  },
  on_hold: {
    label: "متوقف مؤقتاً",
    badgeClass:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    dotClass: "bg-slate-400",
  },
};

export const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  urgent: {
    label: "عاجل",
    className:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/70",
  },
  high: {
    label: "أولوية عالية",
    className:
      "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/70",
  },
  normal: {
    label: "قياسي",
    className:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700",
  },
};
