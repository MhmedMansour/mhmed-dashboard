import * as XLSX from "xlsx";

/**
 * Smart Excel → Haram tasks parser.
 * Column headers are matched by Arabic/English aliases, so the sheet does not
 * need a strict template. Unknown columns are preserved inside `notes`.
 */

export type HaramCategory =
  | "drawing"
  | "survey"
  | "planning"
  | "coordination"
  | "operation"
  | "other";

export type HaramStatus = "completed" | "in_progress" | "pending" | "on_hold";
export type HaramPriority = "urgent" | "high" | "normal";

export interface ParsedHaramTask {
  taskNo: string | null;
  title: string;
  description: string | null;
  category: HaramCategory;
  location: string | null;
  requestedBy: string | null;
  status: HaramStatus;
  priority: HaramPriority;
  startDate: string | null;
  endDate: string | null;
  sheetsCount: number;
  hours: number;
  notes: string | null;
  sourceSheet: string;
  sourceRow: number;
}

export interface ParseResult {
  tasks: ParsedHaramTask[];
  sheets: Array<{ name: string; rows: number; imported: number; headers: string[] }>;
  skipped: number;
  warnings: string[];
}

const FIELD_ALIASES: Record<string, string[]> = {
  taskNo: ["م", "رقم", "رقم المهمة", "الرقم", "#", "no", "no.", "id", "ref", "serial", "code", "كود", "مسلسل", "رقم الطلب"],
  title: ["المهمة", "اسم المهمة", "العمل", "اسم العمل", "البند", "الموضوع", "المشروع", "اسم المشروع", "task", "title", "name", "subject", "work", "item", "description of work", "activity", "النشاط", "الوصف المختصر", "بيان العمل"],
  description: ["الوصف", "التفاصيل", "تفاصيل", "شرح", "بيان", "description", "details", "scope", "نطاق العمل", "ملخص"],
  category: ["النوع", "التصنيف", "نوع العمل", "نوع المهمة", "category", "type", "kind", "القسم", "المجال"],
  location: ["الموقع", "المكان", "المنطقة", "الساحة", "الدور", "الجهة", "location", "area", "zone", "place", "site", "floor", "الساحات"],
  requestedBy: ["الجهة الطالبة", "طالب العمل", "بناءً على طلب", "الإدارة", "القسم الطالب", "requested by", "requester", "department", "dept", "client", "العميل", "المستفيد"],
  status: ["الحالة", "حالة المهمة", "status", "state", "الموقف", "حالة التنفيذ"],
  priority: ["الأولوية", "priority", "الأهمية", "importance"],
  startDate: ["تاريخ البدء", "تاريخ البداية", "البداية", "من", "start", "start date", "from", "تاريخ الطلب", "تاريخ الاستلام", "التاريخ"],
  endDate: ["تاريخ الانتهاء", "تاريخ النهاية", "النهاية", "إلى", "الى", "end", "end date", "to", "تاريخ التسليم", "تاريخ الإنجاز", "finish", "due", "deadline"],
  sheetsCount: ["عدد اللوحات", "اللوحات", "لوحات", "sheets", "drawings", "no. of sheets", "عدد الرسومات", "الرسومات"],
  hours: ["الساعات", "ساعات العمل", "عدد الساعات", "hours", "duration", "المدة", "المدة بالساعات"],
  notes: ["ملاحظات", "ملاحظة", "notes", "note", "remarks", "comment", "comments", "تعليق"],
};

function normalizeHeader(h: unknown): string {
  return String(h ?? "")
    .replace(/[\u064B-\u0652\u0640]/g, "") // tashkeel + tatweel
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}#.]+/gu, " ")
    .trim()
    .toLowerCase();
}

function buildAliasIndex(): Map<string, string> {
  const index = new Map<string, string>();
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      const key = normalizeHeader(alias);
      if (key && !index.has(key)) index.set(key, field);
    }
  }
  return index;
}

const ALIAS_INDEX = buildAliasIndex();

function matchField(header: string): string | null {
  const key = normalizeHeader(header);
  if (!key) return null;
  if (ALIAS_INDEX.has(key)) return ALIAS_INDEX.get(key)!;
  // partial match (e.g. "تاريخ بدء العمل")
  for (const [aliasKey, field] of ALIAS_INDEX.entries()) {
    if (aliasKey.length >= 3 && (key.includes(aliasKey) || aliasKey.includes(key))) {
      return field;
    }
  }
  return null;
}

function toText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().split("T")[0];
  return String(v).trim();
}

function toInt(v: unknown): number {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function excelSerialToDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 20000 || serial > 80000) return null;
  const parsed = XLSX.SSF.parse_date_code(serial);
  if (!parsed) return null;
  const y = parsed.y;
  const m = String(parsed.m).padStart(2, "0");
  const d = String(parsed.d).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().split("T")[0];
  if (typeof v === "number") return excelSerialToDate(v);
  const s = String(v).trim();
  if (!s) return null;
  // Hijri-looking or free text → keep as-is if it looks like a date string
  const iso = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const t = Date.parse(s);
  if (!isNaN(t)) return new Date(t).toISOString().split("T")[0];
  return s.length <= 30 ? s : null;
}

export function normalizeCategory(raw: string): HaramCategory {
  const v = normalizeHeader(raw);
  if (!v) return "other";
  if (/(رسم|لوحه|لوحات|autocad|cad|drawing|drafting|مخطط|revit|تصميم)/.test(v)) return "drawing";
  if (/(رفع|مساح|قياس|survey|measure|حصر|معاين)/.test(v)) return "survey";
  if (/(تخطيط|خطه|planning|plan|دراسه|study|برنامج)/.test(v)) return "planning";
  if (/(تنسيق|متابع|coordinat|follow|اجتماع|meeting)/.test(v)) return "coordination";
  if (/(تشغيل|صيانه|نظاف|operation|maint|clean|خدم|service)/.test(v)) return "operation";
  return "other";
}

export function normalizeStatus(raw: string): HaramStatus {
  const v = normalizeHeader(raw);
  if (!v) return "completed";
  if (/(منجز|مكتمل|تم|انتهي|خلص|done|complete|finish|closed|مغلق|مسلم)/.test(v)) return "completed";
  if (/(جاري|قيد|تنفيذ|progress|working|ongoing|active|شغال)/.test(v)) return "in_progress";
  if (/(معلق|موقوف|متوقف|hold|paused|stopped)/.test(v)) return "on_hold";
  if (/(انتظار|لم|pending|waiting|new|جديد|مطلوب)/.test(v)) return "pending";
  return "completed";
}

export function normalizePriority(raw: string): HaramPriority {
  const v = normalizeHeader(raw);
  if (!v) return "normal";
  if (/(عاجل|urgent|critical|حرج|فوري|immediate)/.test(v)) return "urgent";
  if (/(عالي|مرتفع|high|مهم|important)/.test(v)) return "high";
  return "normal";
}

/** Guess category from title/description text when the sheet has no category column. */
function inferCategoryFromText(text: string): HaramCategory {
  return normalizeCategory(text);
}

function detectHeaderRow(rows: unknown[][]): number {
  let best = 0;
  let bestScore = -1;
  const limit = Math.min(rows.length, 15);
  for (let i = 0; i < limit; i++) {
    const row = rows[i] || [];
    let score = 0;
    let nonEmpty = 0;
    for (const cell of row) {
      const text = toText(cell);
      if (!text) continue;
      nonEmpty += 1;
      if (matchField(text)) score += 2;
    }
    if (nonEmpty >= 2 && score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return bestScore > 0 ? best : 0;
}

export function parseHaramWorkbook(buffer: ArrayBuffer | Buffer): ParseResult {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: false });
  const result: ParseResult = { tasks: [], sheets: [], skipped: 0, warnings: [] };
  let globalOrder = 0;

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", blankrows: false });
    if (!rows || rows.length === 0) {
      result.sheets.push({ name: sheetName, rows: 0, imported: 0, headers: [] });
      continue;
    }

    const headerIdx = detectHeaderRow(rows);
    const headerRow = (rows[headerIdx] || []).map((h) => toText(h));
    const mapping: Array<{ col: number; field: string | null; header: string }> = headerRow.map(
      (h, col) => ({ col, field: matchField(h), header: h })
    );

    const hasTitle = mapping.some((m) => m.field === "title");
    if (!hasTitle) {
      // Fallback: first text-heavy column becomes the title.
      const firstTextCol = mapping.find((m) => m.header && !m.field) || mapping.find((m) => m.header);
      if (firstTextCol) {
        firstTextCol.field = "title";
        result.warnings.push(`الورقة «${sheetName}»: لم يُعثر على عمود "المهمة" — تم استخدام العمود «${firstTextCol.header}» كاسم للمهمة.`);
      }
    }

    let imported = 0;
    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const allEmpty = row.every((c) => !toText(c));
      if (allEmpty) continue;

      const rec: Record<string, unknown> = {};
      const extras: string[] = [];
      for (const m of mapping) {
        const value = row[m.col];
        const text = toText(value);
        if (!text && value !== 0) continue;
        if (m.field) {
          if (rec[m.field] === undefined || rec[m.field] === "") rec[m.field] = value;
          else if (m.field === "notes" || m.field === "description") rec[m.field] = `${toText(rec[m.field])} • ${text}`;
        } else if (m.header) {
          extras.push(`${m.header}: ${text}`);
        }
      }

      const title = toText(rec.title);
      if (!title) {
        result.skipped += 1;
        continue;
      }
      // Skip summary/total rows
      if (/^(الاجمالي|الإجمالي|total|مجموع)/i.test(normalizeHeader(title))) {
        result.skipped += 1;
        continue;
      }

      const description = toText(rec.description) || null;
      const categoryRaw = toText(rec.category);
      const category = categoryRaw
        ? normalizeCategory(categoryRaw)
        : inferCategoryFromText(`${title} ${description || ""}`);

      const notesParts = [toText(rec.notes), ...extras].filter(Boolean);
      const notes = notesParts.length > 0 ? notesParts.join(" • ") : null;

      globalOrder += 1;
      result.tasks.push({
        taskNo: toText(rec.taskNo) || null,
        title,
        description,
        category,
        location: toText(rec.location) || null,
        requestedBy: toText(rec.requestedBy) || null,
        status: normalizeStatus(toText(rec.status)),
        priority: normalizePriority(toText(rec.priority)),
        startDate: toDate(rec.startDate),
        endDate: toDate(rec.endDate),
        sheetsCount: toInt(rec.sheetsCount),
        hours: toInt(rec.hours),
        notes,
        sourceSheet: sheetName,
        sourceRow: r + 1,
      });
      imported += 1;
    }

    result.sheets.push({
      name: sheetName,
      rows: rows.length - headerIdx - 1,
      imported,
      headers: headerRow.filter(Boolean),
    });
  }

  if (result.tasks.length === 0) {
    result.warnings.push("لم يتم العثور على مهام في الملف — تأكد أن أول صف يحتوي على عناوين الأعمدة (مثل: المهمة، الموقع، التاريخ).");
  }
  return result;
}

export const HARAM_CATEGORY_LABELS: Record<HaramCategory, string> = {
  drawing: "رسم ولوحات AutoCAD",
  survey: "رفع مساحي وحصر",
  planning: "تخطيط تشغيلي",
  coordination: "تنسيق ومتابعة",
  operation: "تشغيل ونظافة وخدمات",
  other: "أعمال أخرى",
};

export const HARAM_STATUS_LABELS: Record<HaramStatus, string> = {
  completed: "منجزة",
  in_progress: "جارية",
  pending: "في الانتظار",
  on_hold: "متوقفة",
};

export const HARAM_PRIORITY_LABELS: Record<HaramPriority, string> = {
  urgent: "عاجل",
  high: "عالية",
  normal: "عادية",
};
