import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "مِحور الهندسي | مساحة عملك الهندسية",
  description:
    "مساحة عمل لتنظيم مشاريع AutoCAD وRevit BIM، التشغيل والصيانة، الملفات والصور وPDF، الشهادات وعينات الأعمال.",
  manifest: "/manifest.webmanifest",
  applicationName: "مِحور الهندسي",
  referrer: "origin-when-cross-origin",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "مِحور الهندسي",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0f766e" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1a22" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" data-accent="teal" data-surface="mist" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var root = document.documentElement;
                var accent = 'teal', surface = 'mist', mode = null, legacy = null;
                try {
                  accent = localStorage.getItem('mihwar_accent') || accent;
                  surface = localStorage.getItem('mihwar_surface') || surface;
                  mode = localStorage.getItem('mihwar_mode');
                  legacy = localStorage.getItem('mihwar_theme');
                } catch (e) {}
                var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                var dark = mode === 'dark' || (mode === 'system' && systemDark);
                if (!mode) dark = legacy === 'dark' || (!legacy && systemDark);
                root.classList.toggle('dark', dark);
                root.setAttribute('data-accent', accent);
                root.setAttribute('data-surface', surface);
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js').then(function(reg) {
                      try {
                        if (reg.update) reg.update();
                        setInterval(function() { try { reg.update(); } catch (e) {} }, 60 * 60 * 1000);
                      } catch (e) {}
                      if (reg.addEventListener) {
                        reg.addEventListener('updatefound', function() {
                          var worker = reg.installing;
                          if (!worker) return;
                          worker.addEventListener('statechange', function() {
                            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                              try { window.dispatchEvent(new CustomEvent('mihwar-sw-update')); } catch (e) {}
                            }
                          });
                        });
                      }
                    }).catch(function() {});
                  });
                }
              })();
            `,
          }}
        />
      </head>
      <body className="dashboard-shell min-h-screen text-slate-900 antialiased selection:bg-blue-600 selection:text-white dark:text-slate-100">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:right-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-white focus:text-sm focus:font-bold"
        >
          تخطَّ إلى المحتوى الرئيسي
        </a>
        {children}
      </body>
    </html>
  );
}
