import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "مِحور الهندسي — داشبورد هندسي منفصل",
    short_name: "مِحور الداش",
    description:
      "داشبورد مستقل لإدارة مشاريع AutoCAD و Revit BIM، مهام الحرم، التشغيل والصيانة، الشهادات والمرفقات — بأيقونة وتثبيت منفصل تماماً عن الدردشة.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "any",
    dir: "rtl",
    lang: "ar",
    background_color: "#ece9e3",
    theme_color: "#159a73",
    categories: ["productivity", "business", "utilities"],
    icons: [
      {
        src: "/icons/dashboard-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/dashboard-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/dashboard-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/dashboard-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "إضافة مشروع / مهمة جديدة",
        short_name: "مشروع جديد",
        description: "إضافة مشروع أوتوكاد أو ريفيت أو مهمة تشغيل وصيانة",
        url: "/?action=new_project",
        icons: [{ src: "/icons/dashboard-icon-192.png", sizes: "192x192" }],
      },
      {
        name: "خزنة الملفات وعينات الشغل",
        short_name: "الخزنة والعينات",
        description: "رفع ملفات DWG / RVT / PDF وعرض عينات العملاء",
        url: "/?tab=vault",
        icons: [{ src: "/icons/dashboard-icon-192.png", sizes: "192x192" }],
      },
      {
        name: "التشغيل والصيانة والشهادات",
        short_name: "المواقع والشهادات",
        description: "سجل مواقع التشغيل والصيانة والشهادات المعتمدة",
        url: "/?tab=om_certs",
        icons: [{ src: "/icons/dashboard-icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
