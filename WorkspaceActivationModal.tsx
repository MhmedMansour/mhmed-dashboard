"use client";

import React, { useRef, useState, useEffect } from "react";
import { EngineerProfileRecord } from "@/db/schema";
import {
  X,
  CheckCircle2,
  UserCheck,
  Sparkles,
  Trash2,
  RotateCcw,
  DownloadCloud,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Camera,
  Loader2,
} from "lucide-react";
import { queueOp } from "@/lib/offlineDb";
import { requestBackgroundSync } from "@/lib/offlineSync";

export function WorkspaceActivationModal({
  isOpen,
  onClose,
  profile,
  onWorkspaceUpdated,
}: {
  isOpen: boolean;
  onClose: () => void;
  profile: EngineerProfileRecord | null;
  onWorkspaceUpdated: () => Promise<void>;
}) {
  const [fullName, setFullName] = useState("");
  const [headline, setHeadline] = useState("");
  const [phoneOrWhatsapp, setPhoneOrWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [yearsExperience, setYearsExperience] = useState("6");

  const [saving, setSaving] = useState(false);
  const [confirmClean, setConfirmClean] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoKey, setPhotoKey] = useState(() => Date.now());
  const [photoHasExisting, setPhotoHasExisting] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || "");
      setHeadline(profile.headline || "");
      setPhoneOrWhatsapp(profile.phoneOrWhatsapp || "");
      setEmail(profile.email || "");
      setCity(profile.city || "");
      setYearsExperience(String(profile.yearsExperience ?? 6));
    }
    if (isOpen) {
      setPhotoFile(null);
      setPhotoPreview(null);
      setPhotoError(null);
      setPhotoKey(Date.now());
      fetch("/api/workspace/photo", { method: "HEAD", credentials: "include" })
        .then((r) => setPhotoHasExisting(r.ok))
        .catch(() => setPhotoHasExisting(false));
    }
  }, [profile, isOpen]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  if (!isOpen) return null;

  const uploadPhotoFile = async (file: File): Promise<boolean> => {
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/workspace/photo", {
        credentials: "include",
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPhotoError(data.error || "تعذر حفظ الصورة");
        return false;
      }
      setPhotoHasExisting(true);
      setPhotoFile(null);
      setPhotoKey(Date.now());
      return true;
    } catch {
      setPhotoError("تعذر الاتصال — تحقق من الإنترنت");
      return false;
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const res = await fetch("/api/workspace/photo", {
        credentials: "include",
        method: "DELETE",
      });
      if (!res.ok) {
        setPhotoError("تعذر حذف الصورة");
        return;
      }
      setPhotoHasExisting(false);
      setPhotoFile(null);
      setPhotoKey(Date.now());
    } catch {
      setPhotoError("تعذر الاتصال — تحقق من الإنترنت");
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      action: "update_profile",
      fullName,
      headline,
      phoneOrWhatsapp,
      email,
      city,
      yearsExperience: Number(yearsExperience) || 5,
    };
    try {
      const res = await fetch("/api/workspace", {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        if (photoFile) {
          await uploadPhotoFile(photoFile);
        }
        await onWorkspaceUpdated();
        onClose();
      }
    } catch (err) {
      const offline =
        (typeof navigator !== "undefined" && !navigator.onLine) || err instanceof TypeError;
      if (offline) {
        try {
          await queueOp({
            kind: "workspace-profile",
            label: "تحديث بيانات الملف المهني أوفلاين",
            method: "POST",
            url: "/api/workspace",
            json: payload,
          });
          requestBackgroundSync().catch(() => {});
          await onWorkspaceUpdated();
          onClose();
        } catch {
          // ignore
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleWorkspaceAction = async (
    action: "start_clean" | "restore_samples"
  ) => {
    setActionBusy(true);
    try {
      const res = await fetch("/api/workspace", { credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setConfirmClean(false);
        await onWorkspaceUpdated();
        onClose();
      }
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-l from-blue-50/80 to-emerald-50/60 dark:from-blue-950/40 dark:to-emerald-950/30">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <UserCheck className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  تفعيل المنصة وتخصيص بياناتك الهندسية
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  <CheckCircle2 className="w-3 h-3" />
                  مفعّلة ومجانية ∞
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                تظهر بياناتك تلقائياً في رأس المنصة وفي رسائل عينات الشغل المرسلة للعملاء
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-white/80 dark:hover:bg-slate-800 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Personal Engineering Identity Form */}
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="flex items-center gap-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-4">
              <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-white shadow-lg shrink-0 bg-slate-200">
                {photoPreview ? (
                  <img src={photoPreview} alt="معاينة الصورة الشخصية" className="w-full h-full object-cover" />
                ) : photoHasExisting ? (
                  <img
                    key={photoKey}
                    src="/api/workspace/photo"
                    alt="الصورة الشخصية الحالية"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/images/clay-engineer-avatar.png";
                    }}
                  />
                ) : (
                  <img src="/images/clay-engineer-avatar.png" alt="صورة افتراضية" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-teal-600" />
                  الصورة الشخصية للداشبورد
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  ارفع صورتك (JPG / PNG / WEBP حتى 8 ميجا) — هتظهر في الشريط الجانبي والبطاقة الترحيبية
                </p>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setPhotoError(null);
                    setPhotoFile(f);
                    e.target.value = "";
                  }}
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold"
                  >
                    {photoFile ? "تغيير الصورة" : photoHasExisting ? "اختيار صورة جديدة" : "اختيار صورة"}
                  </button>
                  {photoFile && (
                    <button
                      type="button"
                      disabled={photoBusy}
                      onClick={() => uploadPhotoFile(photoFile)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-[11px] font-bold"
                    >
                      {photoBusy && <Loader2 className="w-3 h-3 animate-spin" />}
                      رفع الآن
                    </button>
                  )}
                  {(photoHasExisting || photoFile) && (
                    <button
                      type="button"
                      disabled={photoBusy}
                      onClick={() => {
                        if (photoFile) {
                          setPhotoFile(null);
                        } else {
                          removePhoto();
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      {photoFile ? "إلغاء الاختيار" : "حذف الصورة"}
                    </button>
                  )}
                </div>
                {photoFile && (
                  <div className="mt-1 text-[10px] font-mono text-slate-500 truncate" title={photoFile.name}>
                    المحدد: {photoFile.name} — هتترفع مع حفظ البيانات
                  </div>
                )}
                {photoError && <div className="mt-1 text-[11px] font-bold text-rose-600">{photoError}</div>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الاسم واللقب المهني *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثال: م. محمد أحمد"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-blue-500" />
                  سنوات الخبرة
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  المسمى التخصصي (يظهر في البورتفوليو) *
                </label>
                <input
                  type="text"
                  required
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="مثال: مهندس AutoCAD & Revit BIM | خبرة في التشغيل والصيانة وإدارة المواقع O&M"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-500" />
                  رقم الهاتف / واتساب للعملاء
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={phoneOrWhatsapp}
                  onChange={(e) => setPhoneOrWhatsapp(e.target.value)}
                  placeholder="+20 100 000 0000"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs font-mono text-right text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-indigo-500" />
                  البريد الإلكتروني المهني
                </label>
                <input
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="engineer@domain.com"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs font-mono text-right text-slate-900 dark:text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-teal-500" />
                  المدينة / نطاق العمل
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="القاهرة - متاح للعمل بالمواقع وعن بُعد"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {saving ? "جاري الحفظ والتفعيل..." : "حفظ بياناتي وتفعيل البورتفوليو"}
              </button>
            </div>
          </form>

          {/* Workspace Data Management (Clean Slate vs Sample Data + JSON Backup) */}
          <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
              إدارة بيانات مساحة العمل والنسخ الاحتياطي
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Start Clean Workspace */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 flex flex-col justify-between gap-2.5">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    بدء مساحة عمل نظيفة ببياناتك
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    مسح الأمثلة التجريبية الافتراضية لتبدأ بإدخال مشاريعك وشهاداتك وملفاتك الحقيقية من الصفر.
                  </p>
                </div>

                {!confirmClean ? (
                  <button
                    type="button"
                    onClick={() => setConfirmClean(true)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-rose-200 dark:border-rose-900/70 bg-rose-50/70 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs font-bold hover:bg-rose-100 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    تصفير الأمثلة والبدء ببياناتي
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => handleWorkspaceAction("start_clean")}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold"
                    >
                      {actionBusy ? "جاري التصفير..." : "تأكيد المسح"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClean(false)}
                      className="py-1.5 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-[11px] font-bold"
                    >
                      تراجع
                    </button>
                  </div>
                )}
              </div>

              {/* Backup & Restore */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 flex flex-col justify-between gap-2.5">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    نسخة احتياطية واستعادة الأمثلة
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    حمّل نسخة احتياطية كاملة (JSON) من كل مشاريعك وشهاداتك وملفاتك في أي لحظة.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href="/api/workspace?export=true"
                    className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold transition-colors"
                  >
                    <DownloadCloud className="w-3.5 h-3.5" />
                    تصدير JSON
                  </a>
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => handleWorkspaceAction("restore_samples")}
                    title="إعادة تحميل بيانات الأمثلة الاسترشادية"
                    className="inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-bold hover:bg-slate-100"
                  >
                    <RotateCcw className="w-3 h-3" />
                    استعادة أمثلة
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
