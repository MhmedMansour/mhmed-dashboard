"use client";

import React, { useState } from "react";
import { SiteOperationRecord, CertificateRecord } from "@/db/schema";
import {
  Wrench,
  Award,
  Building2,
  CheckCircle2,
  Plus,
  Trash2,
  Copy,
  Check,
  ShieldCheck,
  Calendar,
  Activity,
  Pencil,
} from "lucide-react";
import { CollapseToggle, useCollapsed } from "./CollapsibleSection";
import { CertificateVaultPanel } from "./CertificateVaultPanel";
import { ShareButton } from "./ShareDialog";
import { EngineeringFileRecord } from "@/db/schema";
import { Paperclip } from "lucide-react";

const OP_TYPE_LABELS: Record<string, { label: string; cls: string }> = {
  preventive: {
    label: "صيانة وقائية PM",
    cls: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800",
  },
  corrective: {
    label: "صيانة علاجية CM",
    cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  },
  handover: {
    label: "استلام وتشغيل T&C",
    cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
  },
  inspection: {
    label: "فحص واختبار دوري",
    cls: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800",
  },
};

const CERT_CATEGORY_LABELS: Record<string, string> = {
  cad_bim: "اعتماد AutoCAD & Revit BIM",
  om_facility: "التشغيل والصيانة وإدارة المرافق",
  safety_pm: "السلامة المهنية وإدارة المشاريع",
  academic: "تأهيل أكاديمي ونقابي",
};

export function OperationsAndCertificates({
  operations,
  certificates,
  certificateFiles,
  onCertificateFilesChanged,
  onDeleteFile,
  onNotify,
  onAddOperation,
  onUpdateOperation,
  onDeleteOperation,
  onAddCertificate,
  onDeleteCertificate,
  onOpenEditOperation,
  onOpenEditCertificate,
}: {
  operations: SiteOperationRecord[];
  certificates: CertificateRecord[];
  certificateFiles: EngineeringFileRecord[];
  onCertificateFilesChanged: () => Promise<void>;
  onDeleteFile: (id: number) => Promise<void>;
  onNotify?: (message: string) => void;
  onAddOperation: (payload: Record<string, unknown>) => Promise<void>;
  onUpdateOperation: (
    id: number,
    payload: Record<string, unknown>
  ) => Promise<void>;
  onDeleteOperation: (id: number) => Promise<void>;
  onAddCertificate: (payload: Record<string, unknown>) => Promise<void>;
  onDeleteCertificate: (id: number) => Promise<void>;
  onOpenEditOperation: (record: SiteOperationRecord) => void;
  onOpenEditCertificate: (record: CertificateRecord) => void;
}) {
  // New O&M Site form toggle & fields
  const [showAddOp, setShowAddOp] = useState(false);
  const [siteName, setSiteName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [roleTitle, setRoleTitle] = useState("مهندس تشغيل وصيانة مواقع");
  const [operationType, setOperationType] = useState("preventive");
  const [systemCategory, setSystemCategory] = useState(
    "HVAC التكييف المركزي واللوحات الكهربائية"
  );
  const [siteStatus, setSiteStatus] = useState("active_site");
  const [uptimePercent, setUptimePercent] = useState("98");
  const [ticketsTotal, setTicketsTotal] = useState("30");
  const [ticketsResolved, setTicketsResolved] = useState("29");
  const [periodLabel, setPeriodLabel] = useState("2025 - مستمر");
  const [notes, setNotes] = useState("");
  const [submittingOp, setSubmittingOp] = useState(false);

  // New Certificate form toggle & fields
  const [showAddCert, setShowAddCert] = useState(false);
  const [certTitle, setCertTitle] = useState("");
  const [certIssuer, setCertIssuer] = useState("");
  const [certCategory, setCertCategory] = useState("cad_bim");
  const [certCode, setCertCode] = useState("");
  const [certDate, setCertDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [certExpiry, setCertExpiry] = useState("مدى الحياة");
  const [certHighlights, setCertHighlights] = useState("");
  const [submittingCert, setSubmittingCert] = useState(false);

  const [copiedCertId, setCopiedCertId] = useState<number | null>(null);
  const opsOpen = useCollapsed("ops-list", true);
  const certsOpen = useCollapsed("certs-list", true);

  const handleOpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteName.trim() || !roleTitle.trim()) return;
    setSubmittingOp(true);
    try {
      await onAddOperation({
        siteName: siteName.trim(),
        projectName: projectName.trim(),
        roleTitle: roleTitle.trim(),
        operationType,
        systemCategory: systemCategory.trim(),
        siteStatus,
        uptimePercent: Number(uptimePercent) || 98,
        ticketsTotal: Number(ticketsTotal) || 20,
        ticketsResolved: Number(ticketsResolved) || 20,
        periodLabel: periodLabel.trim(),
        notes: notes.trim(),
      });
      setSiteName("");
      setProjectName("");
      setNotes("");
      setShowAddOp(false);
    } finally {
      setSubmittingOp(false);
    }
  };

  const handleCertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certTitle.trim() || !certIssuer.trim()) return;
    setSubmittingCert(true);
    try {
      await onAddCertificate({
        title: certTitle.trim(),
        issuer: certIssuer.trim(),
        category: certCategory,
        credentialCode: certCode.trim(),
        issueDate: certDate,
        expiryDate: certExpiry.trim() || "مدى الحياة",
        highlights: certHighlights.trim(),
      });
      setCertTitle("");
      setCertIssuer("");
      setCertCode("");
      setCertHighlights("");
      setShowAddCert(false);
    } finally {
      setSubmittingCert(false);
    }
  };

  const copyCertDetails = async (c: CertificateRecord) => {
    const txt = `🏅 شهادة معتمدة: ${c.title}\n• الجهة المانحة: ${c.issuer}\n• رقم الاعتماد: ${c.credentialCode}\n• تاريخ الإصدار: ${c.issueDate} (${c.expiryDate || "معتمدة"})`;
    try {
      await navigator.clipboard.writeText(txt);
      setCopiedCertId(c.id);
      setTimeout(() => setCopiedCertId(null), 2000);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      {/* Left / Main 7 Cols: Site Operations & Maintenance History */}
      <div className="xl:col-span-7 bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950/70 dark:text-teal-400">
                <Wrench className="w-4 h-4" />
              </span>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                سجل التشغيل والصيانة وإدارة المواقع (الحالية والسابقة)
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              توثيق المواقع التي تم تشغيلها أو الإشراف عليها ونسب الجاهزية وإغلاق الأعطال
            </p>
          </div>

          <div className="flex items-center gap-2">
            {opsOpen.open && (
              <button
                type="button"
                onClick={() => setShowAddOp((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                {showAddOp ? "إلغاء" : "تسجيل موقع / عملية O&M"}
              </button>
            )}
            <CollapseToggle open={opsOpen.open} onToggle={opsOpen.toggle} controls="ops-list-body" />
          </div>
        </div>

        {opsOpen.open && (
        <div id="ops-list-body">
        {showAddOp && (
          <form
            onSubmit={handleOpSubmit}
            className="my-4 p-4 rounded-xl border border-teal-200 dark:border-teal-800/70 bg-teal-50/40 dark:bg-teal-950/20 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اسم الموقع / المنشأة *
                </label>
                <input
                  type="text"
                  required
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="مثال: برج القاهرة الإداري أو مستشفى النور"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  دورك بالموقع *
                </label>
                <input
                  type="text"
                  required
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اسم المشروع داخل الموقع 📎
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="مثال: مشروع تجهيز البنية التحتية للاتصالات — وزارة الداخلية"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  حالة الموقع
                </label>
                <select
                  value={siteStatus}
                  onChange={(e) => setSiteStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                >
                  <option value="active_site">موقع حالي نشط</option>
                  <option value="previous_site">موقع سابق (خبرة مسجلة)</option>
                  <option value="scheduled">خطة تشغيل مجدولة</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  نوع التشغيل
                </label>
                <select
                  value={operationType}
                  onChange={(e) => setOperationType(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                >
                  <option value="preventive">صيانة وقائية PM</option>
                  <option value="corrective">صيانة علاجية CM</option>
                  <option value="handover">استلام وتشغيل T&C</option>
                  <option value="inspection">فحص واختبار دوري</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الفترة الزمنية
                </label>
                <input
                  type="text"
                  value={periodLabel}
                  onChange={(e) => setPeriodLabel(e.target.value)}
                  placeholder="2024 - مستمر"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الأنظمة المشمولة
                </label>
                <input
                  type="text"
                  value={systemCategory}
                  onChange={(e) => setSystemCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  كفاءة التشغيل %
                </label>
                <input
                  type="number"
                  min="50"
                  max="100"
                  value={uptimePercent}
                  onChange={(e) => setUptimePercent(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  البلاغات المنجزة / الكلي
                </label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    min="0"
                    value={ticketsResolved}
                    onChange={(e) => setTicketsResolved(e.target.value)}
                    className="w-1/2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-xs font-mono"
                  />
                  <input
                    type="number"
                    min="1"
                    value={ticketsTotal}
                    onChange={(e) => setTicketsTotal(e.target.value)}
                    className="w-1/2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <div>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملخص الأعمال المنفذة بالموقع..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submittingOp}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold"
              >
                {submittingOp ? "جاري الحفظ..." : "حفظ سجل الموقع"}
              </button>
            </div>
          </form>
        )}

        <div className="mt-4 space-y-3">
          {operations.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              لا توجد سجلات تشغيل وصيانة مطابقة للفلتر الحالي
            </div>
          ) : (
            operations.map((op) => {
              const opBadge =
                OP_TYPE_LABELS[op.operationType] || OP_TYPE_LABELS.preventive;
              const isActiveSite = op.siteStatus === "active_site";
              return (
                <div
                  key={op.id}
                  className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 hover:border-teal-300 dark:hover:border-teal-800 transition-all"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl shrink-0 ${
                          isActiveSite
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        <Building2 className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                            {op.siteName}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                              isActiveSite
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                                : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                            }`}
                          >
                            {isActiveSite ? "● موقع حالي نشط" : "خبرة موقع سابق"}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${opBadge.cls}`}
                          >
                            {opBadge.label}
                          </span>
                        </div>

                        {op.projectName && (
                          <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
                            📎 المشروع: {op.projectName}
                          </div>
                        )}

                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1">
                          {op.roleTitle} •{" "}
                          <span className="text-teal-700 dark:text-teal-400">
                            {op.systemCategory}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-left font-mono tabular-nums">
                        <div className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <Activity className="w-3.5 h-3.5" />
                          {op.uptimePercent}% جاهزية
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {op.ticketsResolved}/{op.ticketsTotal} بلاغ منجز
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          onUpdateOperation(op.id, {
                            siteStatus: isActiveSite
                              ? "previous_site"
                              : "active_site",
                          })
                        }
                        title="تبديل بين موقع حالي / موقع سابق"
                        className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800"
                      >
                        تبديل الحالة
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteOperation(op.id)}
                        title="حذف السجل"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {op.notes && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                      {op.notes}
                    </p>
                  )}

                  <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-500">
                    <span>الفترة: {op.periodLabel}</span>
                    <span>تاريخ التحديث: {op.loggedDate}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
        </div>
        )}
      </div>

      {/* Right 5 Cols: Verified Certificates & Credentials Vault */}
      <div className="xl:col-span-5 bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/70 dark:text-amber-400">
                <Award className="w-4 h-4" />
              </span>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                الشهادات والاعتمادات المهنية ({certificates.length})
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              شهادات أوتوديسك وإدارة المرافق والسلامة المهنية جاهزة للعرض
            </p>
          </div>

          <div className="flex items-center gap-2">
            {certsOpen.open && (
              <button
                type="button"
                onClick={() => setShowAddCert((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                {showAddCert ? "إلغاء" : "إضافة شهادة"}
              </button>
            )}
            <CollapseToggle open={certsOpen.open} onToggle={certsOpen.toggle} controls="certs-list-body" />
          </div>
        </div>

        {certsOpen.open && (
        <div id="certs-list-body">
        <div className="mt-4">
          <CertificateVaultPanel
            certificates={certificates}
            certificateFiles={certificateFiles}
            onChanged={onCertificateFilesChanged}
            onDeleteFile={onDeleteFile}
            onNotify={onNotify}
          />
        </div>
        {showAddCert && (
          <form
            onSubmit={handleCertSubmit}
            className="my-4 p-4 rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50/40 dark:bg-amber-950/20 space-y-3"
          >
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                اسم الشهادة أو الدبلومة *
              </label>
              <input
                type="text"
                required
                value={certTitle}
                onChange={(e) => setCertTitle(e.target.value)}
                placeholder="مثال: Autodesk Certified Professional Revit MEP"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الجهة المانحة *
                </label>
                <input
                  type="text"
                  required
                  value={certIssuer}
                  onChange={(e) => setCertIssuer(e.target.value)}
                  placeholder="Autodesk / PMI / نقابة المهندسين"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  التصنيف
                </label>
                <select
                  value={certCategory}
                  onChange={(e) => setCertCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                >
                  <option value="cad_bim">اعتماد AutoCAD & Revit BIM</option>
                  <option value="om_facility">التشغيل والصيانة وإدارة المرافق</option>
                  <option value="safety_pm">السلامة المهنية وإدارة المشاريع</option>
                  <option value="academic">تأهيل أكاديمي ونقابي</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  كود التحقق
                </label>
                <input
                  type="text"
                  value={certCode}
                  onChange={(e) => setCertCode(e.target.value)}
                  placeholder="ACP-2025-991"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  تاريخ الإصدار
                </label>
                <input
                  type="date"
                  value={certDate}
                  onChange={(e) => setCertDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الصلاحية
                </label>
                <input
                  type="text"
                  value={certExpiry}
                  onChange={(e) => setCertExpiry(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs"
                />
              </div>
            </div>

            <input
              type="text"
              value={certHighlights}
              onChange={(e) => setCertHighlights(e.target.value)}
              placeholder="أبرز المهارات المعتمدة في الشهادة..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
            />

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submittingCert}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
              >
                {submittingCert ? "جاري الإضافة..." : "حفظ الشهادة"}
              </button>
            </div>
          </form>
        )}

        <div className="mt-4 space-y-3">
          {certificates.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              لا توجد شهادات في هذا التصنيف حالياً
            </div>
          ) : (
            certificates.map((cert) => (
              <div
                key={cert.id}
                className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 hover:border-amber-300 dark:hover:border-amber-800 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {CERT_CATEGORY_LABELS[cert.category] || cert.category}
                    </span>
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5 leading-snug">
                      {cert.title}
                    </h4>
                    <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
                      {cert.issuer}
                    </div>
                    {certificateFiles.filter((f) => f.certificateId === cert.id).length > 0 && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                        <Paperclip className="w-3 h-3" />
                        {certificateFiles.filter((f) => f.certificateId === cert.id).length} ملف مرفق
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => copyCertDetails(cert)}
                      title="نسخ بيانات الاعتماد للعميل"
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600"
                    >
                      {copiedCertId === cert.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenEditCertificate(cert)}
                      title="تعديل بيانات الشهادة (العنوان، الجهة المانحة، الكود، التواريخ...)"
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-300 dark:hover:bg-amber-950/60 dark:hover:text-amber-400 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <ShareButton
                      resourceType="certificate"
                      resourceId={cert.id}
                      title={cert.title}
                      label=""
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-emerald-600 hover:border-emerald-300"
                    />
                    <button
                      type="button"
                      onClick={() => onDeleteCertificate(cert.id)}
                      title="حذف الشهادة"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {cert.highlights && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                    {cert.highlights}
                  </p>
                )}

                <div className="mt-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
                  <span className="px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold">
                    ID: {cert.credentialCode}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {cert.issueDate} • {cert.expiryDate || "معتمدة"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
        </div>
        )}
      </div>
    </div>
  );
}
