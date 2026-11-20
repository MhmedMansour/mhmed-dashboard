"use client";

import React from "react";
import {
  X,
  Smartphone,
  UserCheck,
  FolderKanban,
  UploadCloud,
  Wrench,
  Award,
  Share2,
  CheckCircle2,
  MousePointerClick,
} from "lucide-react";

const STEPS = [
  {
    icon: Smartphone,
    color: "bg-indigo-600",
    title: "١) افتح المنصة من المتصفح",
    desc: "دي صفحة ويب: افتحها من أي متصفح على الجوال أو اللابتوب واشتغل عليها على طول — من غير كلمة مرور ولا تسجيل دخول. وبتشتغل حتى بدون إنترنت بالبيانات المحفوظة على جهازك.",
  },
  {
    icon: UserCheck,
    color: "bg-emerald-600",
    title: "٢) حط بياناتك مرة واحدة",
    desc: "اضغط «بياناتي والتفعيل» واكتب اسمك ورقمك ومسماك المهني. هتظهر في رأس الصفحة وفي رسائل عينات الشغل اللي هتبعتها للعملاء.",
  },
  {
    icon: FolderKanban,
    color: "bg-blue-600",
    title: "٣) سجّل مشاريعك الجارية",
    desc: "اضغط «مشروع / مهمة» وسجّل كل شغلانة شغال عليها دلوقتي: أوتوكاد، ريفيت، أو تشغيل وصيانة. تقدر تتابع نسبة إنجاز كل مشروع وتحدّثها بضغطة (+10%).",
  },
  {
    icon: UploadCloud,
    color: "bg-teal-600",
    title: "٤) ارفع ملفاتك في الخزنة",
    desc: "اسحب وأفلت ملفاتك (.dwg, .rvt, .pdf, .zip وأي صيغة) في قسم «الخزنة والعينات». هتفضل محفوظة وتقدر تحمّلها في أي وقت من أي جهاز.",
  },
  {
    icon: Wrench,
    color: "bg-cyan-600",
    title: "٥) سجّل المواقع اللي مسكتها",
    desc: "في قسم «المواقع والشهادات» سجّل كل موقع اشتغلت فيه تشغيل وصيانة — الحالي والسابق — مع نسبة الجاهزية والبلاغات المنجزة.",
  },
  {
    icon: Award,
    color: "bg-amber-600",
    title: "٦) ضيف شهاداتك",
    desc: "نفس القسم: أضف شهاداتك (أوتوديسك، تشغيل وصيانة، سلامة، نقابة...) عشان تبقى جاهزة للعرض على أي عميل.",
  },
  {
    icon: Share2,
    color: "bg-rose-600",
    title: "٧) ابعت عينات شغلك للعميل",
    desc: "علّم على الشغلانة أو الملف نجمة ⭐ عشان يبقى «عينة شغل»، وبعدين اضغط «نسخ عينات للعميل» — هيتنسخ بورتفوليو منظم جاهز للإرسال واتساب أو إيميل.",
  },
];

export function StartGuideModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-l from-blue-50 to-emerald-50 dark:from-blue-950/40 dark:to-emerald-950/30">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
              <MousePointerClick className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                ابدأ من هنا — إزاي تشتغل على المنصة؟
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                دليل بسيط في ٧ خطوات. كل حاجة بتتحفظ تلقائياً وتقدر ترجع لها في أي وقت.
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

        <div className="p-5 space-y-3 max-h-[65vh] overflow-y-auto">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40"
              >
                <span
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-white shrink-0 ${step.color}`}
                >
                  <Icon className="w-4 h-4" />
                </span>
                <div>
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {step.title}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <strong>متقلقش:</strong> كل مشروع أو ملف أو شهادة بترفعها بتتحفظ في قاعدة
              البيانات على طول، وهتلاقيها زي ما هي لما تفتح من الجوال أو اللابتوب —
              حتى لو النت قطع، هتلاقي آخر بيانات محفوظة شغالة.
            </span>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors"
          >
            فهمت، ابدأ الشغل 💪
          </button>
        </div>
      </div>
    </div>
  );
}
