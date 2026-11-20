"use client";

import React, { useState, useEffect } from "react";
import { SiteOperationRecord, CertificateRecord } from "@/db/schema";
import { X, Pencil, Loader2 } from "lucide-react";

const inputCls =
  "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500";
const labelCls =
  "block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1";

export function EditOperationModal({
  record,
  isOpen,
  onClose,
  onSave,
}: {
  record: SiteOperationRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: number, payload: Record<string, unknown>) => Promise<void>;
}) {
  const [siteName, setSiteName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [operationType, setOperationType] = useState("preventive");
  const [systemCategory, setSystemCategory] = useState("");
  const [siteStatus, setSiteStatus] = useState("active_site");
  const [uptimePercent, setUptimePercent] = useState("98");
  const [ticketsTotal, setTicketsTotal] = useState("30");
  const [ticketsResolved, setTicketsResolved] = useState("29");
  const [periodLabel, setPeriodLabel] = useState("");
  const [loggedDate, setLoggedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (record) {
      setSiteName(record.siteName || "");
      setProjectName(record.projectName || "");
      setRoleTitle(record.roleTitle || "");
      setOperationType(record.operationType || "preventive");
      setSystemCategory(record.systemCategory || "");
      setSiteStatus(record.siteStatus || "active_site");
      setUptimePercent(String(record.uptimePercent ?? 98));
      setTicketsTotal(String(record.ticketsTotal ?? 30));
      setTicketsResolved(String(record.ticketsResolved ?? 0));
      setPeriodLabel(record.periodLabel || "");
      setLoggedDate(record.loggedDate || "");
      setNotes(record.notes || "");
    }
  }, [record, isOpen]);

  if (!isOpen || !record) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteName.trim() || !roleTitle.trim()) return;
    setSubmitting(true);
    try {
      await onSave(record.id, {
        siteName: siteName.trim(),
        projectName: projectName.trim(),
        roleTitle: roleTitle.trim(),
        operationType,
        systemCategory: systemCategory.trim(),
        siteStatus,
        uptimePercent: Number(uptimePercent) || 98,
        ticketsTotal: Number(ticketsTotal) || 1,
        ticketsResolved: Number(ticketsResolved) || 0,
        periodLabel: periodLabel.trim(),
        loggedDate: loggedDate.trim(),
        notes: notes.trim(),
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white">
              <Pencil className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                تعديل سجل تشغيل وصيانة الموقع
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                عدّل اسم الموقع، الدور الوظيفي، الأنظمة المشمولة، ونسب الجاهزية والبلاغات
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={labelCls}>اسم الموقع / المنشأة *</label>
              <input
                type="text"
                required
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>الدور الوظيفي بالموقع *</label>
              <input
                type="text"
                required
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>نوع التشغيل</label>
              <select
                value={operationType}
                onChange={(e) => setOperationType(e.target.value)}
                className={inputCls}
              >
                <option value="preventive">صيانة وقائية PM</option>
                <option value="corrective">صيانة علاجية CM</option>
                <option value="handover">استلام وتشغيل T&C</option>
                <option value="inspection">فحص واختبار دوري</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>حالة الموقع</label>
              <select
                value={siteStatus}
                onChange={(e) => setSiteStatus(e.target.value)}
                className={inputCls}
              >
                <option value="active_site">موقع حالي نشط</option>
                <option value="previous_site">موقع سابق (خبرة مسجلة)</option>
                <option value="scheduled">خطة تشغيل مجدولة</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>اسم المشروع داخل الموقع 📎</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="مثال: مشروع تجهيز البنية التحتية للاتصالات — وزارة الداخلية"
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>الأنظمة المشمولة</label>
              <input
                type="text"
                value={systemCategory}
                onChange={(e) => setSystemCategory(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className={labelCls}>الجاهزية %</label>
              <input
                type="number"
                min="50"
                max="100"
                value={uptimePercent}
                onChange={(e) => setUptimePercent(e.target.value)}
                className={`${inputCls} font-mono`}
              />
            </div>
            <div>
              <label className={labelCls}>البلاغات المنجزة</label>
              <input
                type="number"
                min="0"
                value={ticketsResolved}
                onChange={(e) => setTicketsResolved(e.target.value)}
                className={`${inputCls} font-mono`}
              />
            </div>
            <div>
              <label className={labelCls}>إجمالي البلاغات</label>
              <input
                type="number"
                min="1"
                value={ticketsTotal}
                onChange={(e) => setTicketsTotal(e.target.value)}
                className={`${inputCls} font-mono`}
              />
            </div>
            <div>
              <label className={labelCls}>تاريخ التحديث</label>
              <input
                type="date"
                value={loggedDate}
                onChange={(e) => setLoggedDate(e.target.value)}
                className={`${inputCls} font-mono`}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>الفترة الزمنية</label>
            <input
              type="text"
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              placeholder="2024 - مستمر"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>ملاحظات / ملخص الأعمال</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={`${inputCls} resize-y`}
            />
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
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-xs font-bold shadow-sm transition-colors"
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

export function EditCertificateModal({
  record,
  isOpen,
  onClose,
  onSave,
}: {
  record: CertificateRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: number, payload: Record<string, unknown>) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [issuer, setIssuer] = useState("");
  const [category, setCategory] = useState("cad_bim");
  const [credentialCode, setCredentialCode] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [verified, setVerified] = useState(true);
  const [fileUrl, setFileUrl] = useState("");
  const [highlights, setHighlights] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (record) {
      setTitle(record.title || "");
      setIssuer(record.issuer || "");
      setCategory(record.category || "cad_bim");
      setCredentialCode(record.credentialCode || "");
      setIssueDate(record.issueDate || "");
      setExpiryDate(record.expiryDate || "");
      setVerified(Boolean(record.verified));
      setFileUrl(record.fileUrl || "");
      setHighlights(record.highlights || "");
    }
  }, [record, isOpen]);

  if (!isOpen || !record) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !issuer.trim()) return;
    setSubmitting(true);
    try {
      await onSave(record.id, {
        title: title.trim(),
        issuer: issuer.trim(),
        category,
        credentialCode: credentialCode.trim(),
        issueDate: issueDate.trim(),
        expiryDate: expiryDate.trim() || "مدى الحياة",
        verified,
        fileUrl: fileUrl.trim(),
        highlights: highlights.trim(),
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-600 text-white">
              <Pencil className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                تعديل بيانات الشهادة
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                عدّل العنوان، الجهة المانحة، رقم الاعتماد، التواريخ، والمهارات المعتمدة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div>
            <label className={labelCls}>اسم الشهادة / الدبلومة *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={labelCls}>الجهة المانحة *</label>
              <input
                type="text"
                required
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>التصنيف</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inputCls}
              >
                <option value="cad_bim">اعتماد AutoCAD & Revit BIM</option>
                <option value="om_facility">التشغيل والصيانة وإدارة المرافق</option>
                <option value="safety_pm">السلامة المهنية وإدارة المشاريع</option>
                <option value="academic">تأهيل أكاديمي ونقابي</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>كود التحقق / الاعتماد</label>
              <input
                type="text"
                value={credentialCode}
                onChange={(e) => setCredentialCode(e.target.value)}
                className={`${inputCls} font-mono`}
              />
            </div>
            <div>
              <label className={labelCls}>رابط ملف الشهادة (PDF)</label>
              <input
                type="text"
                dir="ltr"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="/samples/cert.pdf"
                className={`${inputCls} font-mono text-right`}
              />
            </div>
            <div>
              <label className={labelCls}>تاريخ الإصدار</label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className={`${inputCls} font-mono`}
              />
            </div>
            <div>
              <label className={labelCls}>الصلاحية</label>
              <input
                type="text"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                placeholder="2027-06-18 أو مدى الحياة"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>المهارات المعتمدة في الشهادة</label>
            <textarea
              value={highlights}
              onChange={(e) => setHighlights(e.target.value)}
              rows={2}
              className={`${inputCls} resize-y`}
            />
          </div>

          <label className="flex items-center justify-between cursor-pointer p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
            <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
              معتمدة وموثّقة ✓
            </span>
            <input
              type="checkbox"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
              className="rounded text-emerald-600"
            />
          </label>

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
