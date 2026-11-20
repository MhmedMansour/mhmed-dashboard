import { db } from "./index";
import {
  projects,
  siteOperations,
  certificates,
  engineeringFiles,
  telemetrySnapshots,
  engineerProfile,
  cvExperiences,
  generalInfo,
  haramDocuments,
  appSettings,
} from "./schema";
import { count, eq } from "drizzle-orm";

/** True once a starter dataset has been seeded (even if the user deleted it). */
async function isSeedMarkerSet(key: string): Promise<boolean> {
  const [row] = await db
    .select({ key: appSettings.key })
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);
  return Boolean(row);
}

async function markSeeded(key: string): Promise<void> {
  await db.insert(appSettings).values({ key, value: "1" }).onConflictDoNothing();
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function monthsAgoLabel(months: number): { date: string; label: string } {
  const arabicMonths = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
  ];
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  const year = d.getFullYear();
  const monthIdx = d.getMonth();
  const dateStr = `${year}-${String(monthIdx + 1).padStart(2, "0")}-15`;
  return {
    date: dateStr,
    label: `${arabicMonths[monthIdx]} ${String(year).slice(2)}`,
  };
}

let seedPromise: Promise<void> | null = null;

export async function ensureSeeded(force = false): Promise<void> {
  if (seedPromise && !force) {
    return seedPromise;
  }

  seedPromise = (async () => {
    try {
      const existingProfiles = await db.select().from(engineerProfile).limit(1);
      const CV_PROFILE = {
        fullName: "محمد مصطفى عبد المنعم منصور",
        headline:
          "مشرف رسامي كهروميكانيك — تصميم لوحات MEP | AutoCAD & Revit | تشغيل وصيانة مواقع",
        phoneOrWhatsapp: "0966547620418",
        email: "Mohamedshemey@ymail.com",
        city: "متاح بالرياض / جدة / الخبر (السعودية) والقاهرة (مصر)",
        yearsExperience: 15,
        objective:
          "مشرف رسامي كهروميكانيك ذو خبرة قوية في تصميم وتطوير الأنظمة الكهروميكانيكية والإلكترونية، متخصص في إعداد اللوحات الهندسية والحصر الكمّي. متمرس في الإشراف على تنفيذ الأعمال في المواقع لضمان أعلى معايير الجودة ودقة التصميم، وملتزم باستيفاء متطلبات العملاء واحتياجات المشاريع مع تقديم نتائج استثنائية باستمرار.",
        skills: [
          "برامج أوتوديسك: AutoCAD + Revit",
          "أنظمة التشغيل: تثبيت البرامج • Windows • Outlook",
          "Microsoft Office: Word • Excel • PowerPoint",
          "إدارة الملفات: Google Drive • OneDrive",
          "نظام Maximo لإدارة الأصول والصيانة",
        ].join("\n"),
        responsibilities: [
          "إعداد لوحات هندسية كهروميكانيكية (MEP) ميكانيكية وكهربائية وصحية.",
          "تصميم وتنفيذ أنظمة التكييف والتبريد والسباكة والكهرباء.",
          "إنشاء لوحات تنفيذية ومخططات مواقع دقيقة.",
          "التنسيق مع الفرق الهندسية الأخرى لضمان تكامل اللوحات وتوافقها.",
          "مراجعة اللوحات للتحقق من مطابقة المواصفات الفنية والأنظمة التنظيمية.",
          "تقديم الدعم الفني للمقاولين والمهندسين خلال مرحلة التنفيذ.",
          "تنفيذ التعديلات والتحديثات على اللوحات حسب الحاجة.",
        ].join("\n"),
        education:
          "المعهد الفني الصناعي (Industrial Technical Institute) — 2014 — تقدير جيد",
        personalDetails:
          "الحالة الاجتماعية: متزوج • الجنسية: مصري • إضافي: مشرف مراحل التركيبات، مسؤول عن تنظيم وتنفيذ أعمال التركيبات مع ضمان الجودة والالتزام بالمواعيد النهائية.",
      };

      const isCleanMode =
        existingProfiles.length > 0 &&
        existingProfiles[0].workspaceMode === "clean_empty" &&
        !force;

      if (existingProfiles.length === 0) {
        await db.insert(engineerProfile).values({
          ...CV_PROFILE,
          workspaceMode: "live_active",
          isActivated: true,
        });
      } else {
        // Fill only the empty CV fields — never clobber user-edited data
        const p = existingProfiles[0];
        await db
          .update(engineerProfile)
          .set({
            fullName: p.fullName || CV_PROFILE.fullName,
            headline: p.headline || CV_PROFILE.headline,
            phoneOrWhatsapp: p.phoneOrWhatsapp || CV_PROFILE.phoneOrWhatsapp,
            email: p.email || CV_PROFILE.email,
            city: p.city || CV_PROFILE.city,
            yearsExperience: p.yearsExperience || CV_PROFILE.yearsExperience,
            objective: p.objective || CV_PROFILE.objective,
            skills: p.skills || CV_PROFILE.skills,
            responsibilities: p.responsibilities || CV_PROFILE.responsibilities,
            education: p.education || CV_PROFILE.education,
            personalDetails: p.personalDetails || CV_PROFILE.personalDetails,
            updatedAt: new Date(),
          })
          .where(eq(engineerProfile.id, p.id));
      }

      const [{ value: existingExp }] = await db
        .select({ value: count() })
        .from(cvExperiences);
      const cvSeeded = await isSeedMarkerSet("cv_experiences_v1");
      if (!cvSeeded && existingExp === 0) {
        await db.insert(cvExperiences).values([
          {
            companyName: "Specialist Engineering Consulting Company",
            roleTitle: "مشرف رسامي كهروميكانيك (MEP Draftsmen Supervisor)",
            periodLabel: "10/2021 — حتى الآن",
            location: "الرياض، السعودية",
            details:
              "الإشراف على فريق رسامي الكهروميكانيك، إعداد لوحات MEP، حصر الكميات، ومتابعة التنفيذ في الموقع.",
            sortOrder: 1,
          },
          {
            companyName: "Al Orini CONTRACTING Company",
            roleTitle: "رسام كهروميكانيك أول / مشرف لوحات",
            periodLabel: "03/2020 — 09/2021",
            location: "الرياض، السعودية",
            details:
              "إعداد لوحات تنفيذية ومخططات مواقع وتنسيقها مع الفرق الهندسية.",
            sortOrder: 2,
          },
          {
            companyName: "BSEC — Building Specialized Contracting CO.",
            roleTitle: "رسام كهروميكانيك (MEP Draftsman)",
            periodLabel: "10/2019 — 03/2020",
            location: "الخبر، السعودية",
            details: "تصميم وتنفيذ أنظمة التكييف والسباكة والكهرباء.",
            sortOrder: 3,
          },
          {
            companyName: "The Arab Contractors (Othman Ahmed Othman)",
            roleTitle: "رسام كهروميكانيك",
            periodLabel: "06/2016 — 07/2018",
            location: "القاهرة، مصر",
            details: "إعداد لوحات مشاريع كبيرة والدعم الفني في مرحلة التنفيذ.",
            sortOrder: 4,
          },
          {
            companyName: "Bakri Engineering Consulting Company",
            roleTitle: "رسام هندسي",
            periodLabel: "01/2015 — 05/2016",
            location: "الجيزة، مصر",
            details: "إعداد المخططات التنفيذية ومتابعة التعديلات.",
            sortOrder: 5,
          },
          {
            companyName: "(VECG) Consultant Engineering",
            roleTitle: "مساعد رسام هندسي",
            periodLabel: "04/2011 — 10/2014",
            location: "القاهرة، مصر",
            details: "الرسم الهندسي وتجهيز اللوحات والمخططات.",
            sortOrder: 6,
          },
          {
            companyName: "(GSCO) General Supplies & Contracting",
            roleTitle: "فنّي رسم هندسي",
            periodLabel: "01/2009 — 01/2011",
            location: "الجيزة، مصر",
            details: "بداية المسيرة المهنية في الرسم الهندسي واللوحات.",
            sortOrder: 7,
          },
        ]);
      }

      const [{ value: existingInfo }] = await db
        .select({ value: count() })
        .from(generalInfo);
      const infoSeeded = await isSeedMarkerSet("general_info_starter_v1");
      if (!infoSeeded && existingInfo === 0) {
        await db.insert(generalInfo).values([
          {
            title: "خبرة مشاريع الحرم المكي الشريف",
            description:
              "إضافة إلى عملي كرسام AutoCAD MEP، ساهمت في التخطيط التشغيلي والرسم داخل منطقة الحرم: إعداد لوحات مخططات التشغيل وبرامج النظافة والخدمات، ترجمة مفاهيم التخطيط إلى لوحات AutoCAD قابلة للتنفيذ، تطوير مخططات توزيع المساحات وتدفقات الحركة حسب الاحتياج التشغيلي، وتحديث اللوحات وفق متطلبات المشروع وملاحظات الموقع.",
            mediaType: "note",
          },
          {
            title: "البيانات الشخصية والتعليم",
            description:
              "المعهد الفني الصناعي — 2014 — تقدير جيد. الحالة الاجتماعية: متزوج. الجنسية: مصري. مشرف مراحل التركيبات مسؤول عن تنظيم وتنفيذ أعمال التركيبات مع ضمان الجودة والالتزام بالمواعيد النهائية.",
            mediaType: "note",
          },
        ]);
      }

      // Starter certificate records based on the CV — every field is editable,
      // and the folder import attaches the real certificate files afterwards.
      const [{ value: existingCertificates }] = await db
        .select({ value: count() })
        .from(certificates);
      const certSeeded = await isSeedMarkerSet("certificates_starter_v1");
      if (!certSeeded && existingCertificates === 0) {
        await db.insert(certificates).values([
          {
            title: "المعهد الفني الصناعي — شهادة مؤقتة (قسم الكهربى)",
            issuer: "وزارة التربية والتعليم — المعهد الفني الصناعي",
            category: "academic",
            credentialCode: "58474",
            issueDate: "2018-09-16",
            expiryDate: "شهادة مؤقتة",
            verified: false,
            highlights:
              "العام الدراسي 2015 • الامتحان: آخر العام • النسبة 60% بمجموع 1268 درجة (68.68 درجة فقط لا غير) • إبلاغ: سداد الرسوم المقررة وقد سددت بريدياً الجكومية • تاريخ التحديث: 2018/9/16 • الاسم كما بالشهادة: محمد سعد عبد المنعم منصور • أرفق صورة الشهادة من قسم «استيراد فولدر الشهادات».",
          },
          {
            title: "شهادة خبرة — مشرف رسامي كهروميكانيك (10/2021 — حتى الآن)",
            issuer: "Specialist Engineering Consulting Company — Riyadh, SA",
            category: "om_facility",
            credentialCode: "CV-EXP-SECC",
            issueDate: "2021-10-01",
            expiryDate: "مدى الحياة",
            verified: false,
            highlights: "شهادة خبرة من السيرة الذاتية — إشراف فريق رسامي MEP، حصر كميات، ومتابعة التنفيذ.",
          },
          {
            title: "شهادة خبرة — رسام كهروميكانيك (2016 — 2018)",
            issuer: "The Arab Contractors (Othman Ahmed Othman) — Cairo, Egy",
            category: "om_facility",
            credentialCode: "CV-EXP-ARAB",
            issueDate: "2016-06-01",
            expiryDate: "مدى الحياة",
            verified: false,
            highlights: "شهادة خبرة من السيرة الذاتية — إعداد لوحات مشاريع كبيرة والدعم الفني في مرحلة التنفيذ.",
          },
          {
            title: "كفاءة برامج Autodesk: AutoCAD & Revit",
            issuer: "Autodesk Software — بيانات من السيرة الذاتية",
            category: "cad_bim",
            credentialCode: "CV-SKILL-AUTODESK",
            issueDate: "2021-01-01",
            expiryDate: "مدى الحياة",
            verified: false,
            highlights: "مهارة موثقة بالسي في: AutoCAD، Revit، إعداد اللوحات التنفيذية MEP — استبدلها بملف الشهادة التدريبية الفعلي.",
          },
          {
            title: "كفاءة أنظمة إدارة الصيانة Maximo / MS Office / إدارة الملفات",
            issuer: "Maximo • MS Office • Google Drive • OneDrive",
            category: "safety_pm",
            credentialCode: "CV-SKILL-MAXIMO",
            issueDate: "2021-01-01",
            expiryDate: "مدى الحياة",
            verified: false,
            highlights: "مهارات موثقة بالسي في — استبدلها بشهادات التدريب الفعلية بعد استيراد الفولدر.",
          },
        ]);
      }

      // Official Haram documents (access card front/back) — real data from the
      // scanned card the user provided in this conversation.
      const [{ value: existingHaramDocs }] = await db
        .select({ value: count() })
        .from(haramDocuments);
      const haramDocsSeeded = await isSeedMarkerSet("haram_documents_starter_v1");
      if (!haramDocsSeeded && existingHaramDocs === 0) {
        await db.insert(haramDocuments).values([
          {
            title: "بطاقة الحرم النبوي — الوجه الأمامي",
            docType: "card_front",
            holderName: "أ. محمد مصطفى منصور",
            roleTitle: "مصمم معمارى",
            organization: "الخدمة العامة للعناية بشؤون الحرم والمسجد النبوي",
            projectTitle:
              "مشروع الإشراف على أعمال التنفيذ والصيانة والنظافة والسقفا والفرش بالمسجد النبوي الشريف وجميع المواقع التابعة له",
            cardNote:
              "بطاقة رسمية من الخدمة العامة للعناية بشؤون الحرم والمسجد النبوي — تتضمن صورة حامل البطاقة ورمز QR للتحقق.",
            sortOrder: 1,
          },
          {
            title: "بطاقة الحرم النبوي — الوجه الخلفي",
            docType: "card_back",
            holderName: "أ. محمد مصطفى منصور",
            roleTitle: "مصمم معمارى",
            organization: "المتخصص للاستشارات الهندسية (SXG) — The Specialist for Engineering Consulting",
            projectTitle:
              "مشروع الإشراف على أعمال التنفيذ والصيانة والنظافة والسقفا والفرش بالمسجد النبوي الشريف وجميع المواقع التابعة له",
            contactNumber: "1977",
            cardNote:
              "هذه البطاقة من الوثائق الرسمية يجب المحافظة عليها، وفي حال العثور عليها الاتصال على الرقم الموحد 1977 — تتضمن شعار الجهة ورمز QR.",
            sortOrder: 2,
          },
        ]);
      }

      // One-time data correction for the old education placeholder. Runs once
      // only, so later user edits to that certificate are never overwritten.
      if (!(await isSeedMarkerSet("edu_certificate_corrected_v1"))) {
        const [edu] = await db
          .select()
          .from(certificates)
          .where(eq(certificates.credentialCode, "CV-EDU-2014"))
          .limit(1);
        if (edu) {
          await db
            .update(certificates)
            .set({
              title: "المعهد الفني الصناعي — شهادة مؤقتة (قسم الكهربى)",
              issuer: "وزارة التربية والتعليم — المعهد الفني الصناعي",
              credentialCode: "58474",
              issueDate: "2018-09-16",
              expiryDate: "شهادة مؤقتة",
              highlights:
                "العام الدراسي 2015 • الامتحان: آخر العام • النسبة 60% بمجموع 1268 درجة (68.68 درجة فقط لا غير) • إبلاغ: سداد الرسوم المقررة وقد سددت بريدياً الجكومية • تاريخ التحديث: 2018/9/16 • الاسم كما بالشهادة: محمد سعد عبد المنعم منصور",
            })
            .where(eq(certificates.id, edu.id));
        }
        await markSeeded("edu_certificate_corrected_v1");
      }

      // Record that starter rows were offered once. From now on, deleting a
      // certificate / card / CV row keeps it deleted across server restarts.
      await markSeeded("cv_experiences_v1");
      await markSeeded("general_info_starter_v1");
      await markSeeded("certificates_starter_v1");
      await markSeeded("haram_documents_starter_v1");

      const [{ value: existingProjects }] = await db
        .select({ value: count() })
        .from(projects);

      const samplesSeeded = await isSeedMarkerSet("sample_projects_v1");
      const shouldSeedSamples =
        force || (!samplesSeeded && !isCleanMode && existingProjects === 0);

      if (shouldSeedSamples) {

      await db.insert(projects).values([
        {
          code: "BIM-2025-101",
          title: "نمذجة مبنى إداري متكامل معماري وإنشائي وMEP (LOD 350)",
          clientOrSite: "مجموعة العمران القابضة - التجمع الخامس",
          segment: "revit",
          discipline: "Revit BIM - معماري & MEP",
          software: "Revit 2025 + Navisworks Manage",
          status: "in_progress",
          priority: "urgent",
          progress: 78,
          sheetsCount: 42,
          hoursLogged: 118,
          slaScore: 98,
          isSample: true,
          sampleSummary:
            "نموذج BIM متكامل LOD 350 خالي من التعارضات (Clash-Free) يشمل شبكات التكييف المركزي Chilled Water، مكافحة الحريق، اللوحات الكهربائية، وجداول الحصر التلقائية BOQ.",
          location: "القاهرة الجديدة",
          dueDate: daysAgo(2),
        },
        {
          code: "CAD-2025-104",
          title: "لوحات الشوب دروينج التنفيذية لمحطة محولات وموزع كهرباء",
          clientOrSite: "شركة النور للطاقة والمقاولات",
          segment: "autocad",
          discipline: "رسومات تنفيذية AutoCAD Shop Drawings",
          software: "AutoCAD 2025 + AutoCAD Electrical",
          status: "in_progress",
          priority: "high",
          progress: 64,
          sheetsCount: 36,
          hoursLogged: 84,
          slaScore: 96,
          isSample: true,
          sampleSummary:
            "مجموعة لوحات تنفيذية دقيقة بمقياس رسم 1:50 و 1:20 لمسارات الكابلات Cable Trays، التأريض Earthing، وتفاصيل غرف المحولات طبقاً لكود IEC.",
          location: "العاشر من رمضان",
          dueDate: daysAgo(4),
        },
        {
          code: "OM-2025-208",
          title: "خطة الصيانة الوقائية الشاملة لأنظمة التكييف المركزي والمبردات",
          clientOrSite: "مستشفى الصفوة التخصصي - موقع 1",
          segment: "om",
          discipline: "تشغيل وصيانة مواقع O&M",
          software: "CAFM + AutoCAD As-Built",
          status: "in_progress",
          priority: "urgent",
          progress: 85,
          sheetsCount: 18,
          hoursLogged: 96,
          slaScore: 99,
          isSample: true,
          sampleSummary:
            "إدارة تشغيل وصيانة 4 وحدات Chillers و 22 وحدة مناولة هواء AHU مع تحديث مخططات As-Built وتقليل الأعطال الطارئة بنسبة 34%.",
          location: "مدينة نصر - القاهرة",
          dueDate: daysAgo(1),
        },
        {
          code: "BIM-2025-112",
          title: "تصميم فيلا مودرن فاخرة - موديل 3D وإخراج لوحات الرخصة",
          clientOrSite: "مكتب دار المعمار للاستشارات",
          segment: "revit",
          discipline: "نمذجة معمارية وإظهار 3D",
          software: "Revit 2025 + Enscape",
          status: "review",
          priority: "high",
          progress: 92,
          sheetsCount: 28,
          hoursLogged: 72,
          slaScore: 97,
          isSample: true,
          sampleSummary:
            "ملف ريفيت معماري كامل بمساحة 850 م² شامل الواجهات، القطاعات التفصيلية، جداول الأبواب والشبابيك، ولقطات منظورية واقعية.",
          location: "الشيخ زايد",
          dueDate: daysAgo(6),
        },
        {
          code: "CAD-2025-119",
          title: "مخططات As-Built وحصر كميات لشبكات الحريق والسباكة لمول تجاري",
          clientOrSite: "سيتي سنتر بلازا",
          segment: "autocad",
          discipline: "ميكانيكا وصحية AutoCAD MEP",
          software: "AutoCAD 2025 + Excel BOQ",
          status: "in_progress",
          priority: "normal",
          progress: 55,
          sheetsCount: 31,
          hoursLogged: 63,
          slaScore: 94,
          isSample: false,
          sampleSummary:
            "رفع مساحي ومطابقة على الطبيعة لشبكات الرشاشات الآلية Sprinklers وخطوط الصرف والتغذية لـ 3 طوابق تجارية.",
          location: "المعادي",
          dueDate: daysAgo(11),
        },
        {
          code: "OM-2025-215",
          title: "إشراف موقع وتسليم ابتدائي لأعمال الكهروميكانيك بمجمع بنوك",
          clientOrSite: "الحي المالي - العاصمة الإدارية",
          segment: "om",
          discipline: "استلام مواقع واختبارات التشغيل T&C",
          software: "Revit + AutoCAD + Checklists",
          status: "in_progress",
          priority: "high",
          progress: 70,
          sheetsCount: 22,
          hoursLogged: 110,
          slaScore: 97,
          isSample: true,
          sampleSummary:
            "إعداد قوائم الفحص والاختبار Testing & Commissioning لمولدات الطوارئ، أنظمة UPS، ونظام إدارة المباني BMS.",
          location: "العاصمة الإدارية",
          dueDate: daysAgo(15),
        },
        {
          code: "PAR-2025-301",
          title: "إعداد مكتبة بلوكات أوتوكاد وفاميلي ريفيت قياسية للمكتب الفني",
          clientOrSite: "مشروع تطوير داخلي متعدد المهام",
          segment: "parallel",
          discipline: "توحيد معايير CAD / BIM Standards",
          software: "Revit Families (.RFA) + Dynamic Blocks",
          status: "in_progress",
          priority: "normal",
          progress: 60,
          sheetsCount: 54,
          hoursLogged: 48,
          slaScore: 100,
          isSample: true,
          sampleSummary:
            "بناء أكثر من 120 Dynamic Block للأوتوكاد و 65 Parametric Family للريفيت لتسريع إنتاج اللوحات بنسبة 40%.",
          location: "عن بُعد / المكتب الفني",
          dueDate: daysAgo(19),
        },
        {
          code: "CAD-2024-088",
          title: "رسومات تنفيذية وتفاصيل معمارية لمصنع مستحضرات طبية",
          clientOrSite: "شركة فارما كير للصناعات الدوائية",
          segment: "autocad",
          discipline: "معماري صناعي وغرف نظيفة Cleanrooms",
          software: "AutoCAD 2024",
          status: "completed",
          priority: "high",
          progress: 100,
          sheetsCount: 64,
          hoursLogged: 152,
          slaScore: 99,
          isSample: true,
          sampleSummary:
            "لوحات تفصيلية لغرف Cleanrooms، القواطيع المعزولة، مسارات الحركة، وتفاصيل الأرضيات الإيبوكسية المعتمدة.",
          location: "السادس من أكتوبر",
          dueDate: daysAgo(38),
        },
        {
          code: "BIM-2024-074",
          title: "تنسيق تعارضات MEP لمبنى فندقي 12 طابق باستخدام Navisworks",
          clientOrSite: "فندق الواحة السياحي - الغردقة",
          segment: "revit",
          discipline: "BIM Coordination & Clash Detection",
          software: "Revit 2024 + Navisworks",
          status: "completed",
          priority: "urgent",
          progress: 100,
          sheetsCount: 49,
          hoursLogged: 138,
          slaScore: 98,
          isSample: true,
          sampleSummary:
            "حل أكثر من 310 تعارض بين مجاري الهواء Ducts والكمرات الإنشائية ومواسير الحريق وإصدار تقارير تنسيق معتمدة.",
          location: "الغردقة",
          dueDate: daysAgo(68),
        },
        {
          code: "OM-2024-052",
          title: "إدارة التشغيل والصيانة السنوية لقرية سياحية متكاملة",
          clientOrSite: "منتجع مرسي علم السياحي",
          segment: "om",
          discipline: "إدارة مرافق وتشغيل مواقع",
          software: "AutoCAD + Maintenance ERP",
          status: "completed",
          priority: "normal",
          progress: 100,
          sheetsCount: 25,
          hoursLogged: 210,
          slaScore: 96,
          isSample: false,
          sampleSummary:
            "قيادة فريق فني مكون من 14 فني كهرباء وتكييف وسباكة لصيانة 180 شاليه ومحطة تحلية مياه.",
          location: "مرسى علم",
          dueDate: daysAgo(125),
        },
        {
          code: "CAD-2024-031",
          title: "مخططات البنية التحتية وشبكات الصرف والمياه لمجمع سكني",
          clientOrSite: "كمبوند حدائق الياسمين",
          segment: "autocad",
          discipline: "بنية تحتية وموقع عام Civil 3D / CAD",
          software: "AutoCAD + Civil 3D",
          status: "completed",
          priority: "normal",
          progress: 100,
          sheetsCount: 45,
          hoursLogged: 115,
          slaScore: 95,
          isSample: true,
          sampleSummary:
            "لوحات الموقع العام، المناسيب، غرف التفتيش، وقطاعات الطرق والشبكات الخارجية.",
          location: "الشروق",
          dueDate: daysAgo(210),
        },
      ]);

      await db.insert(siteOperations).values([
        {
          siteName: "مستشفى الصفوة التخصصي",
          roleTitle: "مهندس تشغيل وصيانة مواقع أول",
          operationType: "preventive",
          systemCategory: "HVAC التكييف المركزي والمبردات",
          siteStatus: "active_site",
          uptimePercent: 99,
          ticketsResolved: 46,
          ticketsTotal: 47,
          periodLabel: "2024 - مستمر",
          loggedDate: daysAgo(2),
          notes:
            "تنفيذ الصيانة الوقائية الشهرية لوحدات Chillers وضبط ضغوط الفريون وتحديث مخططات As-Built لغرف الماكينات.",
        },
        {
          siteName: "الحي المالي - مبنى B4",
          roleTitle: "مهندس استلامات وتشغيل كهروميكانيك",
          operationType: "handover",
          systemCategory: "اللوحات الكهربائية والمولدات وUPS",
          siteStatus: "active_site",
          uptimePercent: 98,
          ticketsResolved: 32,
          ticketsTotal: 34,
          periodLabel: "2025 - مستمر",
          loggedDate: daysAgo(5),
          notes:
            "اختبارات الأحمال الكاملة لمولدات الطوارئ 1500 KVA ومطابقة لوحات التوزيع الرئيسية MDB مع مخططات الأوتوكاد.",
        },
        {
          siteName: "سيتي سنتر بلازا التجاري",
          roleTitle: "مهندس صيانة وقائية ومكافحة حريق",
          operationType: "inspection",
          systemCategory: "شبكات المياه ومكافحة الحريق",
          siteStatus: "active_site",
          uptimePercent: 97,
          ticketsResolved: 28,
          ticketsTotal: 29,
          periodLabel: "2024 - مستمر",
          loggedDate: daysAgo(12),
          notes:
            "فحص طلمبات الحريق الديزل والكهرباء واختبار حساسات الدخان ولوحات الإنذار المعنونة.",
        },
        {
          siteName: "مصنع فارما كير للأدوية",
          roleTitle: "مهندس موقع وتشغيل مرافق",
          operationType: "corrective",
          systemCategory: "غرف نظيفة ووحدات مناولة الهواء AHU",
          siteStatus: "previous_site",
          uptimePercent: 96,
          ticketsResolved: 84,
          ticketsTotal: 86,
          periodLabel: "2023 - 2024",
          loggedDate: daysAgo(45),
          notes:
            "معالجة فروق الضغوط داخل الغرف النظيفة وتغيير فلاتر HEPA وإعداد سجل صيانة رقمي متكامل.",
        },
        {
          siteName: "منتجع مرسي علم السياحي",
          roleTitle: "مدير صيانة الموقع والمرافق",
          operationType: "preventive",
          systemCategory: "تشغيل شامل (كهرباء + تكييف + محطة تحلية)",
          siteStatus: "previous_site",
          uptimePercent: 95,
          ticketsResolved: 215,
          ticketsTotal: 224,
          periodLabel: "2022 - 2023",
          loggedDate: daysAgo(130),
          notes:
            "إدارة طاقم الصيانة اليومي لـ 180 وحدة فندقية وحمامات السباحة والمطابخ المركزية على مدار 24 ساعة.",
        },
        {
          siteName: "برج النيل الإداري - المعادي",
          roleTitle: "مهندس صيانة وتشغيل مباني",
          operationType: "corrective",
          systemCategory: "المصاعد وأنظمة التحكم BMS",
          siteStatus: "previous_site",
          uptimePercent: 94,
          ticketsResolved: 63,
          ticketsTotal: 67,
          periodLabel: "2021 - 2022",
          loggedDate: daysAgo(240),
          notes:
            "متابعة عقود صيانة المصاعد وضبط جداول التشغيل التلقائي للإضاءة والتكييف لتوفير 18% من استهلاك الكهرباء.",
        },
      ]);

      await db.insert(certificates).values([
        {
          title: "Autodesk Certified Professional: Revit for Architectural Design",
          issuer: "Autodesk Official",
          category: "cad_bim",
          credentialCode: "ACP-RVT-2024-8841",
          issueDate: "2024-06-18",
          expiryDate: "2027-06-18",
          verified: true,
          fileUrl: "/samples/cert-revit-acp.pdf",
          highlights:
            "اعتماد دولي في النمذجة المعمارية، الفاميلي المتقدمة، جداول الحصر، وإخراج اللوحات التنفيذية.",
        },
        {
          title: "Autodesk Certified Professional: AutoCAD Design & Drafting",
          issuer: "Autodesk Official",
          category: "cad_bim",
          credentialCode: "ACP-ACD-2023-4192",
          issueDate: "2023-11-05",
          expiryDate: "2026-11-05",
          verified: true,
          fileUrl: "/samples/cert-autocad-acp.pdf",
          highlights:
            "إتقان الرسومات التنفيذية، Dynamic Blocks، Xrefs، ومعايير الطباعة واللوحات الهندسية.",
        },
        {
          title: "دبلومة إدارة التشغيل والصيانة والمرافق (Facility & O&M Management)",
          issuer: "الجمعية المصرية لإدارة المرافق / نقابة المهندسين",
          category: "om_facility",
          credentialCode: "FMA-OM-2024-309",
          issueDate: "2024-02-20",
          expiryDate: "مدى الحياة",
          verified: true,
          fileUrl: "/samples/cert-om-diploma.pdf",
          highlights:
            "تخطيط الصيانة الوقائية والتنبؤية، إدارة عقود المقاولين، مؤشرات الأداء KPIs، وأنظمة CAFM.",
        },
        {
          title: "دورة تنسيق مشاريع الـ BIM وحل التعارضات (Revit MEP & Navisworks)",
          issuer: "BIM Arabia Academy",
          category: "cad_bim",
          credentialCode: "BIM-MEP-2024-772",
          issueDate: "2024-09-12",
          expiryDate: "مدى الحياة",
          verified: true,
          fileUrl: "/samples/cert-navisworks.pdf",
          highlights:
            "نمذجة شبكات التكييف والكهرباء والصرف ومصفوفة التعارضات Clash Matrix وإعداد تقارير الموقع.",
        },
        {
          title: "شهادة السلامة والصحة المهنية في مواقع التشغيل والإنشاءات (OSHA 30-Hour)",
          issuer: "OSHA Academy",
          category: "safety_pm",
          credentialCode: "OSHA-30-991042",
          issueDate: "2023-05-14",
          expiryDate: "مدى الحياة",
          verified: true,
          fileUrl: "/samples/cert-osha30.pdf",
          highlights:
            "إجراءات العزل الآمن LOTO، تصاريح العمل الساخن والمرتفعات، وسلامة غرف الكهرباء والمحطات.",
        },
        {
          title: "بكالوريوس الهندسة — قيد نقابة المهندسين المصرية",
          issuer: "نقابة المهندسين المصرية",
          category: "academic",
          credentialCode: "ENG-SYND-2020-55120",
          issueDate: "2020-07-30",
          expiryDate: "مدى الحياة",
          verified: true,
          fileUrl: "/samples/cert-syndicate.pdf",
          highlights: "عضو عامل بنقابة المهندسين ومعتمد لأعمال التصميم والإشراف والتشغيل.",
        },
      ]);

      await db.insert(engineeringFiles).values([
        {
          fileName: "Al-Omran-Admin-Building-MEP-LOD350.rvt",
          extension: ".rvt",
          formatGroup: "revit_bim",
          sizeBytes: 1485000000, // 1.48 GB
          sizeFormatted: "1.48 GB",
          segment: "revit",
          projectId: 1,
          projectTitle: "نمذجة مبنى إداري متكامل معماري وإنشائي وMEP",
          isClientSample: true,
          sampleNote: "عينة ريفيت متكاملة جاهزة للعرض على العملاء والشركات الهندسية",
          storagePath: "workstation://BIM-Archive/2025/Al-Omran-MEP-LOD350.rvt",
          mimeType: "application/octet-stream",
          uploadedDate: daysAgo(1),
          downloadsCount: 14,
        },
        {
          fileName: "Substation-ShopDrawings-IEC-Package.dwg",
          extension: ".dwg",
          formatGroup: "autocad",
          sizeBytes: 186400000, // 186.4 MB
          sizeFormatted: "186.4 MB",
          segment: "autocad",
          projectId: 2,
          projectTitle: "لوحات الشوب دروينج التنفيذية لمحطة محولات",
          isClientSample: true,
          sampleNote: "ملف أوتوكاد أصلي بالطبقات والبلوكات الديناميكية وجداول الكابلات",
          storagePath: "workstation://CAD-Archive/2025/Substation-ShopDrawings.dwg",
          mimeType: "image/vnd.dwg",
          uploadedDate: daysAgo(3),
          downloadsCount: 21,
        },
        {
          fileName: "Hospital-Chillers-PM-Schedule-AsBuilt.pdf",
          extension: ".pdf",
          formatGroup: "documents_pdf",
          sizeBytes: 48200000, // 48.2 MB
          sizeFormatted: "48.2 MB",
          segment: "om",
          projectId: 3,
          projectTitle: "خطة الصيانة الوقائية الشاملة لأنظمة التكييف المركزي",
          isClientSample: true,
          sampleNote: "كتيب تشغيل وصيانة شامل مع لوحات As-Built معتمدة",
          storagePath: "workstation://OM-Vault/2025/Hospital-Chillers-PM.pdf",
          mimeType: "application/pdf",
          uploadedDate: daysAgo(4),
          downloadsCount: 19,
        },
        {
          fileName: "Luxury-Villa-Arch-Model-Enscape-Render.rvt",
          extension: ".rvt",
          formatGroup: "revit_bim",
          sizeBytes: 940000000, // 940 MB
          sizeFormatted: "940.0 MB",
          segment: "revit",
          projectId: 4,
          projectTitle: "تصميم فيلا مودرن فاخرة - موديل 3D وإخراج لوحات الرخصة",
          isClientSample: true,
          sampleNote: "نموذج فيلا سكنية بالماتريال والإضاءة وجداول التشطيبات",
          storagePath: "workstation://BIM-Archive/2025/Luxury-Villa-Arch.rvt",
          mimeType: "application/octet-stream",
          uploadedDate: daysAgo(7),
          downloadsCount: 27,
        },
        {
          fileName: "Hotel-12F-Navisworks-Federation-ClashFree.nwd",
          extension: ".nwd",
          formatGroup: "revit_bim",
          sizeBytes: 2650000000, // 2.65 GB
          sizeFormatted: "2.65 GB",
          segment: "revit",
          projectId: 9,
          projectTitle: "تنسيق تعارضات MEP لمبنى فندقي 12 طابق",
          isClientSample: true,
          sampleNote: "ملف تجميعي Navisworks كامل لـ 12 طابق بدون تعارضات",
          storagePath: "workstation://BIM-Archive/2024/Hotel-12F-ClashFree.nwd",
          mimeType: "application/octet-stream",
          uploadedDate: daysAgo(18),
          downloadsCount: 11,
        },
        {
          fileName: "Cleanroom-Pharma-Factory-Full-CAD-Set.zip",
          extension: ".zip",
          formatGroup: "archives_other",
          sizeBytes: 620000000, // 620 MB
          sizeFormatted: "620.0 MB",
          segment: "autocad",
          projectId: 8,
          projectTitle: "رسومات تنفيذية وتفاصيل معمارية لمصنع مستحضرات طبية",
          isClientSample: true,
          sampleNote: "أرشيف مضغوط يحتوي على 64 لوحة DWG + ملفات الطباعة CTB",
          storagePath: "workstation://CAD-Archive/2024/Cleanroom-Pharma-Set.zip",
          mimeType: "application/zip",
          uploadedDate: daysAgo(28),
          downloadsCount: 16,
        },
        {
          fileName: "Master-MEP-BOQ-And-Asset-Register-2025.xlsx",
          extension: ".xlsx",
          formatGroup: "archives_other",
          sizeBytes: 24500000, // 24.5 MB
          sizeFormatted: "24.5 MB",
          segment: "om",
          projectId: 6,
          projectTitle: "إشراف موقع وتسليم ابتدائي لأعمال الكهروميكانيك بمجمع بنوك",
          isClientSample: false,
          sampleNote: "شيت حصر كميات وسجل أصول المعدات واختبارات التشغيل",
          storagePath: "workstation://OM-Vault/2025/Master-MEP-BOQ.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          uploadedDate: daysAgo(14),
          downloadsCount: 9,
        },
        {
          fileName: "BIM-OpenExchange-IFC4-Structural-Arch.ifc",
          extension: ".ifc",
          formatGroup: "revit_bim",
          sizeBytes: 780000000, // 780 MB
          sizeFormatted: "780.0 MB",
          segment: "revit",
          projectId: 1,
          projectTitle: "نمذجة مبنى إداري متكامل معماري وإنشائي وMEP",
          isClientSample: true,
          sampleNote: "نسخة OpenBIM بصيغة IFC4 متوافقة مع جميع برامج الهندسة",
          storagePath: "workstation://BIM-Archive/2025/Al-Omran-IFC4.ifc",
          mimeType: "application/x-step",
          uploadedDate: daysAgo(9),
          downloadsCount: 8,
        },
        {
          fileName: "Dynamic-CAD-Blocks-HVAC-Electrical-Library.dwg",
          extension: ".dwg",
          formatGroup: "autocad",
          sizeBytes: 95400000, // 95.4 MB
          sizeFormatted: "95.4 MB",
          segment: "autocad",
          projectId: 7,
          projectTitle: "إعداد مكتبة بلوكات أوتوكاد وفاميلي ريفيت قياسية للمكتب الفني",
          isClientSample: true,
          sampleNote: "مكتبة بلوكات ديناميكية جاهزة للاستخدام السريع في اللوحات",
          storagePath: "workstation://CAD-Archive/Library/Dynamic-Blocks-2025.dwg",
          mimeType: "image/vnd.dwg",
          uploadedDate: daysAgo(21),
          downloadsCount: 34,
        },
        {
          fileName: "Autodesk-Revit-AutoCAD-Certificates-Portfolio.pdf",
          extension: ".pdf",
          formatGroup: "documents_pdf",
          sizeBytes: 18900000, // 18.9 MB
          sizeFormatted: "18.9 MB",
          segment: "certificates",
          projectId: null,
          projectTitle: "ملف الشهادات المعتمدة والسيرة الذاتية الهندسية",
          isClientSample: true,
          sampleNote: "ملف PDF مجمع لجميع شهادات أوتوديسك والتشغيل والصيانة",
          storagePath: "workstation://Certificates/All-Verified-Certificates.pdf",
          mimeType: "application/pdf",
          uploadedDate: daysAgo(6),
          downloadsCount: 42,
        },
        {
          fileName: "Parametric-MEP-Equipment-Families-Pack.rfa",
          extension: ".rfa",
          formatGroup: "revit_bim",
          sizeBytes: 312000000, // 312 MB
          sizeFormatted: "312.0 MB",
          segment: "revit",
          projectId: 7,
          projectTitle: "إعداد مكتبة بلوكات أوتوكاد وفاميلي ريفيت قياسية للمكتب الفني",
          isClientSample: false,
          sampleNote: "حزمة فاميلي ريفيت بارامترية لمعدات التكييف والطلمبات",
          storagePath: "workstation://BIM-Archive/Families/MEP-Families-2025.rfa",
          mimeType: "application/octet-stream",
          uploadedDate: daysAgo(35),
          downloadsCount: 15,
        },
        {
          fileName: "Infrastructure-Grading-Networks-Civil.dxf",
          extension: ".dxf",
          formatGroup: "autocad",
          sizeBytes: 142000000, // 142 MB
          sizeFormatted: "142.0 MB",
          segment: "autocad",
          projectId: 11,
          projectTitle: "مخططات البنية التحتية وشبكات الصرف والمياه لمجمع سكني",
          isClientSample: false,
          sampleNote: "ملف تبادل رسومي DXF لشبكات الموقع العام والمناسيب",
          storagePath: "workstation://CAD-Archive/2024/Infrastructure-Civil.dxf",
          mimeType: "image/vnd.dxf",
          uploadedDate: daysAgo(95),
          downloadsCount: 7,
        },
        {
          fileName: "Mall-3D-Perspective-Render-Final.png",
          extension: ".png",
          formatGroup: "images",
          sizeBytes: 8400000, // 8.4 MB
          sizeFormatted: "8.40 MB",
          segment: "revit",
          projectId: 9,
          projectTitle: "تنسيق تعارضات MEP لمبنى فندقي 12 طابق",
          isClientSample: true,
          sampleNote: "لقطة منظورية 3D معتمدة من Enscape معروضة للعملاء",
          storagePath: "workstation://Renders/2024/Mall-3D-Perspective-Final.png",
          mimeType: "image/png",
          uploadedDate: daysAgo(60),
          downloadsCount: 23,
        },
        {
          fileName: "Shop-Drawings-Approval-Sheet-Signed.pdf",
          extension: ".pdf",
          formatGroup: "documents_pdf",
          sizeBytes: 12200000, // 12.2 MB
          sizeFormatted: "12.2 MB",
          segment: "autocad",
          projectId: 2,
          projectTitle: "لوحات الشوب دروينج التنفيذية لمحطة محولات",
          isClientSample: true,
          sampleNote: "ورقة اعتماد موقعة من الاستشاري مع مجموعة اللوحات PDF",
          storagePath: "workstation://PDF/2025/Shop-Drawings-Approval-Signed.pdf",
          mimeType: "application/pdf",
          uploadedDate: daysAgo(5),
          downloadsCount: 17,
        },
        {
          fileName: "Site-Progress-Photos-Week-12.zip",
          extension: ".zip",
          formatGroup: "archives_other",
          sizeBytes: 340000000, // 340 MB
          sizeFormatted: "340.0 MB",
          segment: "om",
          projectId: 3,
          projectTitle: "خطة الصيانة الوقائية الشاملة لأنظمة التكييف المركزي",
          isClientSample: false,
          sampleNote: "أرشيف صور تقدم الأعمال بالموقع أسبوع 12",
          storagePath: "workstation://Site-Photos/2025/Week-12.zip",
          mimeType: "application/zip",
          uploadedDate: daysAgo(8),
          downloadsCount: 6,
        },
      ]);

      } // end of sample-workspace seeding (skipped in clean workspace)

      // Real CV projects — seeded once (guarded by CV marker codes)
      const existingCv = await db
        .select({ value: count() })
        .from(projects)
        .where(eq(projects.code, "CV-KFSH"));
      if (existingCv[0].value === 0) {
        await db.insert(projects).values([
          {
            code: "CV-KFSH",
            title:
              "مستشفى الملك فيصل التخصصي ومركز الأبحاث — لوحات MEP وتكييف وسباكة وكهرباء",
            clientOrSite: "King Faisal Specialist Hospital & Research Center",
            segment: "revit",
            discipline: "إشراف رسم كهروميكانيك MEP — AutoCAD & Revit",
            software: "AutoCAD 2025 • Revit 2025 • Maximo",
            status: "in_progress",
            priority: "urgent",
            progress: 88,
            sheetsCount: 145,
            hoursLogged: 620,
            slaScore: 98,
            isSample: true,
            sampleSummary:
              "إعداد وتحديث لوحات MEP للمشروع: تصميم وتنفيذ أنظمة التكييف والتبريد والسباكة والكهرباء مع التنسيق الكامل مع الفرق الهندسية ومطابقة أنظمة الرقابة الصحية.",
            location: "الرياض، السعودية",
            dueDate: daysAgo(2),
          },
          {
            code: "CV-PNU",
            title: "جامعة الأميرة نورة بنت عبدالعزيز — مخططات كهروميكانيك وحصر كميات",
            clientOrSite: "Specialist Engineering Consulting Company",
            segment: "autocad",
            discipline: "إشراف رسامي كهروميكانيك وحصر كميات",
            software: "AutoCAD 2025 • Excel BOQ",
            status: "in_progress",
            priority: "high",
            progress: 76,
            sheetsCount: 98,
            hoursLogged: 430,
            slaScore: 97,
            isSample: true,
            sampleSummary:
              "لوحات تنفيذية دقيقة لأنظمة التكييف والكهرباء والصحية لمباني جامعية مع جداول حصر كميات كاملة ومراجعة الالتزام بالمواصفات الفنية.",
            location: "الرياض، السعودية",
            dueDate: daysAgo(9),
          },
          {
            code: "CV-SAFWA",
            title: "مستشفى الصفا — تصميم شبكات التكييف والسباكة والكهرباء",
            clientOrSite: "Al Orini CONTRACTING Company",
            segment: "autocad",
            discipline: "MEP Drawings — مخططات تنفيذية",
            software: "AutoCAD 2024",
            status: "completed",
            priority: "high",
            progress: 100,
            sheetsCount: 72,
            hoursLogged: 380,
            slaScore: 96,
            isSample: true,
            sampleSummary:
              "إنهاء كافة اللوحات التنفيذية للمشروع الصحي ومطابقتها للمعايير مع تجهيز ملفات As-Built النهائية.",
            location: "الرياض، السعودية",
            dueDate: daysAgo(120),
          },
          {
            code: "CV-GIB",
            title: "بنك الخليج الدولي GIB — لوحات كهروميكانيك للفرع الرئيسي",
            clientOrSite: "BSEC — Building Specialized Contracting CO.",
            segment: "autocad",
            discipline: "MEP Drawings — تكييف وكهرباء",
            software: "AutoCAD 2024",
            status: "completed",
            priority: "high",
            progress: 100,
            sheetsCount: 54,
            hoursLogged: 260,
            slaScore: 97,
            isSample: true,
            sampleSummary:
              "لوحات معمارية وكهروميكانيك لمبنى بنكي بمعايير تشغيل عالية مع تنسيق أعمال السلامة وأنظمة التكييف.",
            location: "الدمام، السعودية",
            dueDate: daysAgo(240),
          },
          {
            code: "CV-AJDAN",
            title: "أجدان ووك (مجمع سينمائي) — مخططات MEP وتنسيق تعارضات",
            clientOrSite: "Al Orini CONTRACTING Company",
            segment: "revit",
            discipline: "نمذجة وتنسيق MEP — Revit & Navisworks",
            software: "Revit 2024 + Navisworks",
            status: "completed",
            priority: "high",
            progress: 100,
            sheetsCount: 66,
            hoursLogged: 310,
            slaScore: 98,
            isSample: true,
            sampleSummary:
              "موديل MEP كامل لمجمع سينمائي مع حل التعارضات بين مجاري الهواء والكابلات وتسليم لوحات تنفيذية معتمدة.",
            location: "الخبر، السعودية",
            dueDate: daysAgo(320),
          },
          {
            code: "CV-MOE",
            title: "مشروع المدارس — وزارة التعليم (شركة تطوير المباني التعليمية TBC)",
            clientOrSite: "The Arab Contractors (Othman Ahmed Othman)",
            segment: "autocad",
            discipline: "مخططات كهروميكانيك لمدارس",
            software: "AutoCAD 2022",
            status: "completed",
            priority: "normal",
            progress: 100,
            sheetsCount: 88,
            hoursLogged: 410,
            slaScore: 95,
            isSample: true,
            sampleSummary:
              "إعداد لوحات MEP لمجموعة مدارس بنظام التصميم والإشراف مع متابعة التنفيذ في الموقع.",
            location: "الرياض، السعودية",
            dueDate: daysAgo(420),
          },
          {
            code: "CV-KHARJ",
            title: "حظائر ومشروع الحفاظ على الثروة الحيوانية — وزارة البيئة والمياه والزراعة",
            clientOrSite: "Ministry of Environment, Fields and Agriculture",
            segment: "autocad",
            discipline: "مخططات تشغيلية وتنفيذية",
            software: "AutoCAD 2022",
            status: "completed",
            priority: "normal",
            progress: 100,
            sheetsCount: 41,
            hoursLogged: 195,
            slaScore: 95,
            isSample: true,
            sampleSummary:
              "مخططات تشغيلية وتنفيذية لمنشآت الحفاظ على الثروة الحيوانية بمحافظة الخرج.",
            location: "الخرج، السعودية",
            dueDate: daysAgo(500),
          },
          {
            code: "CV-SOUTH-BORDER",
            title: "مشروع البنية التحتية للحدود الجنوبية",
            clientOrSite: "هيئة تطوير منطقة مكة المكرمة / الجهات الحكومية",
            segment: "autocad",
            discipline: "بنية تحتية ومخططات مواقع",
            software: "AutoCAD 2022",
            status: "completed",
            priority: "high",
            progress: 100,
            sheetsCount: 37,
            hoursLogged: 220,
            slaScore: 96,
            isSample: false,
            sampleSummary: "مخططات بنية تحتية ومواقع لمشروع حدودي استراتيجي.",
            location: "السعودية",
            dueDate: daysAgo(560),
          },
          {
            code: "CV-MOI-NET",
            title: "مشروع تجهيز البنية التحتية للشبكات والاتصالات — وزارة الداخلية (الشرطة المركزية)",
            clientOrSite: "Ministry of Interior — Central Police Dept.",
            segment: "om",
            discipline: "تغذية ومتابعة مخططات التشغيل",
            software: "AutoCAD + Maximo",
            status: "completed",
            priority: "urgent",
            progress: 100,
            sheetsCount: 33,
            hoursLogged: 240,
            slaScore: 98,
            isSample: true,
            sampleSummary:
              "تجهيز مخططات البنية التحتية للشبكات والاتصالات مع متابعة التشغيل والصيانة داخل المنشأة.",
            location: "الرياض، السعودية",
            dueDate: daysAgo(640),
          },
          {
            code: "CV-SPORT",
            title: "مشروع تجهيز البنية التحتية — وزارة الرياضة (الصالةات الخضراء ومدن رياضية)",
            clientOrSite:
              "Green Halls Riyadh/Jeddah/Dammam • Majma'ah • Abha • Al-Baha Sports Cities",
            segment: "autocad",
            discipline: "مخططات تشغيلية وتجهيزات رياضية",
            software: "AutoCAD 2022",
            status: "completed",
            priority: "high",
            progress: 100,
            sheetsCount: 58,
            hoursLogged: 330,
            slaScore: 96,
            isSample: true,
            sampleSummary:
              "مخططات التجهيزات والبنية التحتية لمجموعة صالة ومركز رياضي: الصالة الخضراء الرياضية وجدة والدمام ومجمع المجمعة الرياضي ومدن أبها والباحة والشراياء الرياضية.",
            location: "السعودية",
            dueDate: daysAgo(700),
          },
          {
            code: "CV-VILLA",
            title: "فيلا السيد الظنعيان السكنية — لوحات معمارية وكهروميكانيك",
            clientOrSite: "AL-Thunayan Residence Villa",
            segment: "autocad",
            discipline: "معماري وMEP للفلل",
            software: "AutoCAD 2022",
            status: "completed",
            priority: "normal",
            progress: 100,
            sheetsCount: 29,
            hoursLogged: 150,
            slaScore: 97,
            isSample: true,
            sampleSummary:
              "تصميم وتنفيذ لوحات معمارية وكهروميكانيك لفيلا سكنية فاخرة.",
            location: "الرياض، السعودية",
            dueDate: daysAgo(780),
          },
          {
            code: "CV-SUBWAY",
            title: "مترو القاهرة الخط الثالث — لوحات تنفيذية للأنظمة الكهروميكانيكية",
            clientOrSite: "القطار الكهربائي — الخط الثالث (Cairo Metro Line 3)",
            segment: "autocad",
            discipline: "MEP Drawings — مشاريع نقل عام",
            software: "AutoCAD 2018",
            status: "completed",
            priority: "urgent",
            progress: 100,
            sheetsCount: 92,
            hoursLogged: 480,
            slaScore: 96,
            isSample: true,
            sampleSummary:
              "لوحات تنفيذية لأنظمة التكييف والتهوية والكهرباء والإنارة بالمحطات والأنفاق مع التنسيق مع مقاولي المشروع.",
            location: "القاهرة، مصر",
            dueDate: daysAgo(2100),
          },
          {
            code: "CV-SPECIAL-NEEDS",
            title: "مركز تنمية مهارات الأطفال ذوي الاحتياجات الخاصة",
            clientOrSite: "Developing Skills of Children with Special Needs Center",
            segment: "autocad",
            discipline: "معماري وMEP — منشآت خدمية",
            software: "AutoCAD 2018",
            status: "completed",
            priority: "normal",
            progress: 100,
            sheetsCount: 26,
            hoursLogged: 140,
            slaScore: 95,
            isSample: false,
            sampleSummary:
              "مخططات معمارية وكهروميكانيك لمركز خدمي متخصص بمواصفات إتاحة خاصة.",
            location: "القاهرة، مصر",
            dueDate: daysAgo(2300),
          },
          {
            code: "CV-NOSSER",
            title: "أبراج سبورتنج وناصر بلازا السكنية — الإسكندرية",
            clientOrSite: "Sporting And Noser Plaza Towers",
            segment: "autocad",
            discipline: "معماري وMEP — أبراج سكنية",
            software: "AutoCAD 2017",
            status: "completed",
            priority: "normal",
            progress: 100,
            sheetsCount: 47,
            hoursLogged: 240,
            slaScore: 95,
            isSample: false,
            sampleSummary:
              "لوحات معمارية وكهروميكانيك لمجمعي أبراج سكنية بمواصفات تنفيذية عالية.",
            location: "الإسكندرية، مصر",
            dueDate: daysAgo(2600),
          },
          {
            code: "CV-GHABBOUR",
            title: "مركز خدمة جبّور وورشة العمل — الأقصر",
            clientOrSite: "Ghabbour Service Center And Work Shop Building",
            segment: "autocad",
            discipline: "معماري وMEP — منشآت صناعية",
            software: "AutoCAD 2017",
            status: "completed",
            priority: "normal",
            progress: 100,
            sheetsCount: 31,
            hoursLogged: 165,
            slaScore: 95,
            isSample: false,
            sampleSummary:
              "مخططات تنفيذية لمركز خدمة وورشة أعمال بمعرض صناعي كبير.",
            location: "الأقصر، مصر",
            dueDate: daysAgo(2800),
          },
        ]);

        await db.insert(siteOperations).values([
          {
            siteName: "مستشفى الملك فيصل التخصصي ومركز الأبحاث",
            projectName:
              "مشروع تحديث مخططات MEP — أجنحة التخصصات الطبية (King Faisal Specialist Hospital)",
            roleTitle: "مشرف رسامي كهروميكانيك (MEP Draftsmen Supervisor)",
            operationType: "handover",
            systemCategory: "التكييف المركزي والسباكة والكهرباء",
            siteStatus: "active_site",
            uptimePercent: 99,
            ticketsResolved: 84,
            ticketsTotal: 86,
            periodLabel: "10/2021 — حتى الآن",
            loggedDate: daysAgo(3),
            notes:
              "الإشراف على إعداد وتحديث لوحات MEP ومطابقتها مع أنظمة الرقابة الصحية، مع تنسيق التنفيذ في الموقع وحصر الكميات.",
          },
        ]);
      }
      await markSeeded("sample_projects_v1");

      // Telemetry snapshots: 14 daily points + 12 monthly points
      const dailyPoints = [
        { d: 28, label: "يوم 1", cad: 5, rvt: 3, om: 4, hrs: 38, eff: 91 },
        { d: 25, label: "يوم 4", cad: 7, rvt: 4, om: 5, hrs: 44, eff: 92 },
        { d: 22, label: "يوم 7", cad: 6, rvt: 5, om: 4, hrs: 42, eff: 93 },
        { d: 19, label: "يوم 10", cad: 9, rvt: 6, om: 6, hrs: 51, eff: 94 },
        { d: 16, label: "يوم 13", cad: 8, rvt: 5, om: 7, hrs: 49, eff: 93 },
        { d: 13, label: "يوم 16", cad: 11, rvt: 7, om: 6, hrs: 56, eff: 95 },
        { d: 10, label: "يوم 19", cad: 10, rvt: 8, om: 7, hrs: 58, eff: 96 },
        { d: 6, label: "قبل 6 أيام", cad: 12, rvt: 9, om: 8, hrs: 62, eff: 96 },
        { d: 5, label: "قبل 5 أيام", cad: 14, rvt: 8, om: 7, hrs: 60, eff: 97 },
        { d: 4, label: "قبل 4 أيام", cad: 11, rvt: 10, om: 9, hrs: 64, eff: 96 },
        { d: 3, label: "قبل 3 أيام", cad: 15, rvt: 11, om: 8, hrs: 68, eff: 98 },
        { d: 2, label: "أمس", cad: 16, rvt: 12, om: 10, hrs: 72, eff: 98 },
        { d: 1, label: "اليوم", cad: 18, rvt: 13, om: 11, hrs: 76, eff: 99 },
      ];

      const monthlyPoints = [];
      const baseCad = [28, 32, 35, 31, 39, 44, 42, 48, 52, 56, 61, 68];
      const baseRvt = [14, 18, 21, 24, 26, 29, 33, 35, 38, 42, 46, 51];
      const baseOm = [19, 22, 20, 25, 27, 26, 30, 32, 34, 36, 39, 43];
      const baseHrs = [145, 160, 168, 172, 184, 192, 198, 210, 218, 226, 238, 248];
      const baseEff = [89, 90, 91, 91, 92, 93, 94, 95, 95, 96, 97, 98];

      for (let i = 11; i >= 0; i--) {
        const idx = 11 - i;
        const m = monthsAgoLabel(i);
        monthlyPoints.push({
          periodDate: m.date,
          label: m.label,
          granularity: "monthly",
          autocadSheets: baseCad[idx],
          revitModels: baseRvt[idx],
          omTasks: baseOm[idx],
          hoursLogged: baseHrs[idx],
          efficiencyRate: baseEff[idx],
        });
      }

      const [{ value: existingTelemetry }] = await db
        .select({ value: count() })
        .from(telemetrySnapshots);
      const telemetrySeeded = await isSeedMarkerSet("telemetry_v1");
      if (!telemetrySeeded && existingTelemetry === 0) {
        await db.insert(telemetrySnapshots).values([
          ...dailyPoints.map((p) => ({
            periodDate: daysAgo(p.d),
            label: p.label,
            granularity: "daily",
            autocadSheets: p.cad,
            revitModels: p.rvt,
            omTasks: p.om,
            hoursLogged: p.hrs,
            efficiencyRate: p.eff,
          })),
          ...monthlyPoints,
        ]);
      }
      await markSeeded("telemetry_v1");
    } catch (err) {
      seedPromise = null;
      throw err;
    }
  })();

  return seedPromise;
}
