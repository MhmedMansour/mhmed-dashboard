"use client";

import React, { useState, useEffect } from "react";
import { ProjectRecord } from "@/db/schema";
import { X, Pencil, Loader2 } from "lucide-react";

export function EditProjectModal({
  project,
  isOpen,
  onClose,
  onSave,
}: {
  project: ProjectRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: number, payload: Record<string, unknown>) => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [clientOrSite, setClientOrSite] = useState("");
  const [segment, setSegment] = useState("autocad");
  const [discipline, setDiscipline] = useState("");
  const [software, setSoftware] = useState("");
  const [status, setStatus] = useState("in_progress");
  const [priority, setPriority] = useState("high");
  const [progress, setProgress] = useState("0");
  const [sheetsCount, setSheetsCount] = useState("0");
  const [hoursLogged, setHoursLogged] = useState("0");
  const [slaScore, setSlaScore] = useState("95");
  const [location, setLocation] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isSample, setIsSample] = useState(false);
  const [sampleSummary, setSampleSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (project) {
      setCode(project.code || "");
      setTitle(project.title || "");
      setClientOrSite(project.clientOrSite || "");
      setSegment(project.segment || "autocad");
      setDiscipline(project.discipline || "");
      setSoftware(project.software || "");
      setStatus(project.status || "in_progress");
      setPriority(project.priority || "high");
      setProgress(String(project.progress ?? 0));
      setSheetsCount(String(project.sheetsCount ?? 0));
      setHoursLogged(String(project.hoursLogged ?? 0));
      setSlaScore(String(project.slaScore ?? 95));
      setLocation(project.location || "");
      setDueDate(project.dueDate || "");
      setIsSample(Boolean(project.isSample));
      setSampleSummary(project.sampleSummary || "");
    }
  }, [project, isOpen]);

  if (!isOpen || !project) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !clientOrSite.trim()) return;
    setSubmitting(true);
    try {
      await onSave(project.id, {
        code: code.trim(),
        title: title.trim(),
        clientOrSite: clientOrSite.trim(),
        segment,
        discipline: discipline.trim(),
        software: software.trim(),
        status,
        priority,
        progress: Number(progress) || 0,
        sheetsCount: Number(sheetsCount) || 0,
        hoursLogged: Number(hoursLogged) || 0,
        slaScore: Number(slaScore) || 95,
        location: location.trim(),
        dueDate: dueDate.trim(),
        isSample,
        sampleSummary: sampleSummary.trim(),
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelCls =
    "block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-600 text-white">
              <Pencil className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                تعديل بيانات المشروع
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                عدّل أي حقل تريده — الاسم، العميل، التخصص، البرنامج، التاريخ، لوحات العمل… كل حاجة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 max-h-[75vh] overflow-y-auto"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={labelCls}>كود المشروع</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={`${inputCls} font-mono`}
              />
            </div>
            <div>
              <label className={labelCls}>الحالة</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={inputCls}
              >
                <option value="in_progress">قيد التنفيذ</option>
                <option value="review">مراجعة واعتماد</option>
                <option value="completed">مكتمل ومسلّم</option>
                <option value="on_hold">متوقف مؤقتاً</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>اسم المشروع / المهمة *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>العميل / الموقع *</label>
              <input
                type="text"
                required
                value={clientOrSite}
                onChange={(e) => setClientOrSite(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>المدينة / الموقع الجغرافي</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>المسار / التخصص الرئيسي</label>
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                className={`${inputCls} font-bold`}
              >
                <option value="autocad">رسومات أوتوكاد (AutoCAD)</option>
                <option value="revit">نمذجة ريفيت (Revit BIM)</option>
                <option value="om">التشغيل والصيانة (O&M)</option>
                <option value="parallel">مشروع متوازي متعدد المهام</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>التخصص الدقيق</label>
              <input
                type="text"
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>البرامج المستخدمة</label>
              <input
                type="text"
                value={software}
                onChange={(e) => setSoftware(e.target.value)}
                className={`${inputCls} font-mono`}
              />
            </div>

            <div>
              <label className={labelCls}>الأولوية</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className={inputCls}
              >
                <option value="urgent">عاجل</option>
                <option value="high">أولوية عالية</option>
                <option value="normal">قياسي</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className={labelCls}>الإنجاز %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={progress}
                onChange={(e) => setProgress(e.target.value)}
                className={`${inputCls} font-mono`}
              />
            </div>
            <div>
              <label className={labelCls}>عدد اللوحات</label>
              <input
                type="number"
                min="0"
                value={sheetsCount}
                onChange={(e) => setSheetsCount(e.target.value)}
                className={`${inputCls} font-mono`}
              />
            </div>
            <div>
              <label className={labelCls}>ساعات العمل</label>
              <input
                type="number"
                min="0"
                value={hoursLogged}
                onChange={(e) => setHoursLogged(e.target.value)}
                className={`${inputCls} font-mono`}
              />
            </div>
            <div>
              <label className={labelCls}>درجة الجودة SLA %</label>
              <input
                type="number"
                min="50"
                max="100"
                value={slaScore}
                onChange={(e) => setSlaScore(e.target.value)}
                className={`${inputCls} font-mono`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>تاريخ التسليم / الاستحقاق</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`${inputCls} font-mono`}
              />
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/20 space-y-2">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs font-bold text-amber-900 dark:text-amber-300">
                عرض كعينة شغل للعملاء ⭐
              </span>
              <input
                type="checkbox"
                checked={isSample}
                onChange={(e) => setIsSample(e.target.checked)}
                className="rounded text-amber-600"
              />
            </label>
            {isSample && (
              <textarea
                value={sampleSummary}
                onChange={(e) => setSampleSummary(e.target.value)}
                rows={2}
                placeholder="ملخص فني يظهر للعميل عند مشاركة العينة..."
                className={`${inputCls} resize-y`}
              />
            )}
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-xs font-bold shadow-sm transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                "حفظ التعديلات"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
