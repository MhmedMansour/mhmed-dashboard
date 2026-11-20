"use client";

import React from "react";
import {
  EngineerProfileRecord,
  CvExperienceRecord,
} from "@/db/schema";
import {
  UserCheck,
  Target,
  Wrench,
  ClipboardList,
  Briefcase,
  GraduationCap,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { useCollapsed } from "./CollapsibleSection";

export function ProfessionalCVSection({
  profile,
  experiences,
}: {
  profile: EngineerProfileRecord | null;
  experiences: CvExperienceRecord[];
}) {
  const skills = (profile?.skills || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const responsibilities = (profile?.responsibilities || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const cvOpen = useCollapsed("cv-section", true);

  return (
    <div className="bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
      {/* CV Header */}
      <div className="px-6 py-5 bg-gradient-to-l from-slate-900 via-blue-900 to-indigo-900 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/15 border border-white/25">
                <Sparkles className="w-3 h-3" />
                السيرة الذاتية المهنية
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-500/20 border border-emerald-400/40 text-emerald-200">
                {profile?.yearsExperience || 15}+ سنة خبرة
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              {profile?.fullName || "محمد مصطفى عبد المنعم منصور"}
            </h2>
            <p className="text-blue-100 text-xs sm:text-sm mt-1 max-w-2xl">
              {profile?.headline}
            </p>
          </div>

          <div className="space-y-1.5 text-xs">
            <a
              href={`tel:${profile?.phoneOrWhatsapp || ""}`}
              dir="ltr"
              className="flex items-center gap-2 text-blue-100 hover:text-white transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-300" />
              <span className="font-mono">{profile?.phoneOrWhatsapp}</span>
            </a>
            <a
              href={`mailto:${profile?.email || ""}`}
              dir="ltr"
              className="flex items-center gap-2 text-blue-100 hover:text-white transition-colors"
            >
              <Mail className="w-3.5 h-3.5 text-indigo-300" />
              <span className="font-mono">{profile?.email}</span>
            </a>
            <div className="flex items-center gap-2 text-blue-100">
              <MapPin className="w-3.5 h-3.5 text-teal-300" />
              <span>{profile?.city}</span>
            </div>
            <button
              type="button"
              onClick={cvOpen.toggle}
              aria-expanded={cvOpen.open}
              aria-controls="cv-section-body"
              className="mt-2 inline-flex items-center gap-1 rounded-lg border border-white/30 bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-white/20 transition-colors"
            >
              {cvOpen.open ? "طي السيرة الذاتية" : "عرض السيرة الذاتية"}
              <ChevronDown size={14} className={`transition-transform duration-200 ${cvOpen.open ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {cvOpen.open && (
      <div id="cv-section-body" className="p-6 space-y-7">
        {/* Objective */}
        {profile?.objective && (
          <section>
            <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-white mb-2.5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white">
                <Target className="w-4 h-4" />
              </span>
              الهدف المهني
            </h3>
            <p className="text-xs sm:text-sm leading-loose text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
              {profile.objective}
            </p>
          </section>
        )}

        {/* Skills */}
        {skills.length > 0 && (
          <section>
            <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-white mb-2.5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
                <Wrench className="w-4 h-4" />
              </span>
              المهارات والبرامج
            </h3>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800"
                >
                  {skill}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Responsibilities */}
        {responsibilities.length > 0 && (
          <section>
            <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-white mb-2.5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-white">
                <ClipboardList className="w-4 h-4" />
              </span>
              المسؤوليات الوظيفية
            </h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {responsibilities.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 rounded-lg p-2.5 border border-slate-100 dark:border-slate-800"
                >
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Experience Timeline */}
        {experiences.length > 0 && (
          <section>
            <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-white mb-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-600 text-white">
                <Briefcase className="w-4 h-4" />
              </span>
              الخبرة العملية ({experiences.length} محطات مهنية)
            </h3>

            <div className="space-y-3">
              {experiences.map((exp, idx) => (
                <div key={exp.id} className="flex items-stretch gap-3">
                  {/* Timeline marker */}
                  <div className="flex flex-col items-center shrink-0">
                    <span
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-extrabold ${
                        idx === 0
                          ? "bg-emerald-600 ring-4 ring-emerald-100 dark:ring-emerald-950"
                          : "bg-slate-400 dark:bg-slate-600"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    {idx < experiences.length - 1 && (
                      <span className="w-0.5 flex-1 bg-slate-200 dark:bg-slate-700 my-1" />
                    )}
                  </div>

                  {/* Experience card */}
                  <div className="flex-1 pb-3">
                    <div
                      className={`rounded-xl border p-4 transition-colors ${
                        idx === 0
                          ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/25"
                          : "border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                            {exp.companyName}
                          </h4>
                          <div className="text-xs font-semibold text-blue-700 dark:text-blue-400 mt-0.5">
                            {exp.roleTitle}
                          </div>
                        </div>
                        <div className="text-left">
                          <div className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-slate-600 dark:text-slate-400 tabular-nums">
                            <Calendar className="w-3 h-3" />
                            {exp.periodLabel}
                          </div>
                          {exp.location && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {exp.location}
                            </div>
                          )}
                        </div>
                      </div>

                      {exp.details && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed mt-2">
                          {exp.details}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Education & Personal */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profile?.education && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-4">
              <h3 className="flex items-center gap-2 text-xs font-extrabold text-slate-900 dark:text-white mb-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-white">
                  <GraduationCap className="w-3.5 h-3.5" />
                </span>
                المؤهل الدراسي
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {profile.education}
              </p>
            </div>
          )}

          {profile?.personalDetails && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-4">
              <h3 className="flex items-center gap-2 text-xs font-extrabold text-slate-900 dark:text-white mb-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-teal-600 text-white">
                  <UserCheck className="w-3.5 h-3.5" />
                </span>
                معلومات شخصية وإضافية
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {profile.personalDetails}
              </p>
            </div>
          )}
        </section>
      </div>
      )}
    </div>
  );
}
