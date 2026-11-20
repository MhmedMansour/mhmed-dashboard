"use client";

import { use, useEffect, useState } from "react";
import {
  Download,
  Eye,
  FileText,
  Mail,
  Copy,
  Check,
  MessageCircle,
  Send,
  HardDrive,
  ExternalLink,
  AlertTriangle,
  Loader2,
  Compass,
  Lock,
} from "lucide-react";

interface ShareFileItem {
  id: number;
  kind: string;
  fileName: string;
  mimeType: string | null;
  sizeFormatted: string | null;
  uploadedDate?: string;
  hasContent: boolean;
}

interface ShareInfo {
  token: string;
  title: string;
  subtitle: string | null;
  details: Array<{ label: string; value: string }>;
  resourceType: string;
  isFile: boolean;
  fileName: string | null;
  mimeType: string | null;
  sizeFormatted: string | null;
  allowDownload: boolean;
  files: ShareFileItem[];
}

function isPreviewable(mime: string | null, name: string): boolean {
  const m = (mime || "").toLowerCase();
  if (m.startsWith("image/") || m === "application/pdf") return true;
  const n = name.toLowerCase();
  return [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".pdf"].some((e) =>
    n.endsWith(e)
  );
}

export default function PublicSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [info, setInfo] = useState<ShareInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<string | null>(null);
  const [driveReady, setDriveReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/share/${token}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok) {
          setError(data.error || "تعذر فتح صفحة المشاركة");
        } else {
          setInfo(data);
        }
      } catch {
        if (alive) setError("تعذر الاتصال بالخادم");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  // Load Google Save-to-Drive script
  useEffect(() => {
    if (!info || info.files.length === 0) return;
    const existing = document.querySelector('script[data-g-save-drive]');
    const render = () => {
      try {
        const g = (window as unknown as { gapi?: { savetodrive?: { go: (el?: Element | string) => void } } }).gapi;
        g?.savetodrive?.go();
        setDriveReady(true);
      } catch {
        // ignore
      }
    };
    if (existing) {
      render();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://apis.google.com/js/platform.js";
    s.async = true;
    s.defer = true;
    s.setAttribute("data-g-save-drive", "1");
    s.onload = render;
    document.body.appendChild(s);
    const t = setTimeout(render, 2500);
    return () => clearTimeout(t);
  }, [info]);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/s/${token}` : `/s/${token}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked
    }
  };

  const sendByEmail = async () => {
    const to = email.trim();
    if (!to) {
      setSendMsg("اكتب البريد الإلكتروني أولاً");
      return;
    }
    setSending(true);
    setSendMsg(null);
    try {
      const res = await fetch("/api/share/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, to }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.sent) {
        setSendMsg(data.attached ? "تم الإرسال مع إرفاق الملف ✓" : "تم إرسال الإيميل بالرابط ✓");
        setEmail("");
      } else if (data.noSmtp && data.mailto) {
        window.location.href = data.mailto as string;
        setSendMsg("اتفتح تطبيق البريد عندك — دوس إرسال");
      } else {
        setSendMsg(data.error || "تعذر الإرسال");
      }
    } catch {
      // Fallback: open the mail client directly
      const subject = encodeURIComponent(`مشاركة: ${info?.title || ""}`);
      const body = encodeURIComponent(`رابط المشاركة:\n${shareUrl}`);
      window.location.href = `mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}`;
      setSendMsg("اتفتح تطبيق البريد عندك — دوس إرسال");
    } finally {
      setSending(false);
    }
  };

  const waText = `مشاركة: ${info?.title || ""}\n${shareUrl}`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" /> جاري فتح صفحة المشاركة…
        </div>
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" dir="rtl">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
          <Lock className="w-8 h-8 mx-auto text-slate-300 mb-3" />
          <h1 className="font-extrabold text-slate-900 mb-1">الرابط غير متاح</h1>
          <p className="text-sm text-slate-500">{error || "تم إلغاء هذه المشاركة"}</p>
        </div>
      </div>
    );
  }

  const mainFile = info.isFile ? info.files[0] : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900" dir="rtl">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2.5">
          <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0">
            <Compass className="w-4.5 h-4.5 w-5 h-5" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-extrabold truncate">مِحور الهندسي — مشاركة</div>
            <div className="text-[11px] text-slate-500 truncate">{info.title}</div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Title card */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h1 className="text-lg font-extrabold leading-snug">{info.title}</h1>
          {info.subtitle && <p className="text-sm text-slate-500 mt-1">{info.subtitle}</p>}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
            {info.details.slice(0, 8).map((d) => (
              <div key={d.label} className="flex gap-2 bg-slate-50 rounded-lg px-3 py-1.5">
                <span className="font-bold text-slate-500 shrink-0">{d.label}:</span>
                <span className="text-slate-800 truncate" title={d.value}>{d.value}</span>
              </div>
            ))}
          </div>

          {/* Main file actions */}
          {mainFile && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {isPreviewable(mainFile.mimeType, mainFile.fileName) && (
                <a
                  href={`/api/share/${token}/file${info.files.length > 1 ? `?fileId=${mainFile.id}` : ""}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-sm font-bold"
                >
                  <Eye className="w-4 h-4" /> معاينة
                </a>
              )}
              {info.allowDownload ? (
                <a
                  href={`/api/share/${token}/file${info.files.length > 1 ? `?fileId=${mainFile.id}` : ""}&download=1`.replace("?&", "?")}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
                >
                  <Download className="w-4 h-4" /> تحميل
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  <AlertTriangle className="w-4 h-4" /> المعاينة فقط — التحميل غير مسموح
                </span>
              )}
            </div>
          )}
        </section>

        {/* Attached files (entity shares) */}
        {!info.isFile && info.files.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h2 className="text-sm font-extrabold mb-3">الملفات المرفقة ({info.files.length})</h2>
            <ul className="space-y-2">
              {info.files.map((f) => (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-2 border border-slate-100 rounded-xl px-3 py-2.5"
                >
                  <div className="min-w-0 flex items-center gap-2.5">
                    <span className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-slate-500" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate max-w-[260px]" title={f.fileName}>
                        {f.fileName}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {f.sizeFormatted || ""} {f.hasContent ? "" : "• غير متاح"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {f.hasContent && isPreviewable(f.mimeType, f.fileName) && (
                      <a
                        href={`/api/share/${token}/file?fileId=${f.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-pink-50 text-pink-700 hover:bg-pink-600 hover:text-white text-xs font-bold"
                      >
                        <Eye className="w-3.5 h-3.5" /> معاينة
                      </a>
                    )}
                    {f.hasContent && info.allowDownload && (
                      <a
                        href={`/api/share/${token}/file?fileId=${f.id}&download=1`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white text-xs font-bold"
                      >
                        <Download className="w-3.5 h-3.5" /> تحميل
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Forward by email */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-extrabold flex items-center gap-2 mb-1">
            <Mail className="w-4 h-4 text-blue-600" /> إعادة الإرسال بالإيميل
          </h2>
          <p className="text-xs text-slate-500 mb-3">ابعت صفحة المشاركة دي لأي بريد إلكتروني</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@mail.com"
              className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={sendByEmail}
              disabled={sending}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              إرسال
            </button>
          </div>
          {sendMsg && <p className="mt-2 text-xs font-bold text-emerald-700">{sendMsg}</p>}
        </section>

        {/* Drive + quick share */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-extrabold flex items-center gap-2 mb-3">
            <HardDrive className="w-4 h-4 text-emerald-600" /> حفظ في جوجل درايف ومشاركة سريعة
          </h2>
          {info.files.length > 0 ? (
            <div className="space-y-2.5">
              {info.files.slice(0, 5).map((f) => (
                <div
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-2 border border-slate-100 rounded-xl px-3 py-2"
                >
                  <span className="text-xs font-bold truncate max-w-[240px]" title={f.fileName}>
                    {f.fileName}
                  </span>
                  {f.hasContent ? (
                    <div
                      className="g-savetodrive"
                      data-src={`${typeof window !== "undefined" ? window.location.origin : ""}/api/share/${token}/file?fileId=${f.id}&download=1`}
                      data-filename={f.fileName}
                      data-sitename="مِحور الهندسي"
                    />
                  ) : (
                    <span className="text-[11px] text-amber-600">غير متاح</span>
                  )}
                </div>
              ))}
              {!driveReady && (
                <p className="text-[11px] text-slate-400">جاري تجهيز زر الحفظ في درايف…</p>
              )}
              <a
                href="https://drive.google.com/drive/my-drive"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" /> فتح جوجل درايف
              </a>
            </div>
          ) : (
            <p className="text-xs text-slate-500">لا توجد ملفات قابلة للحفظ في هذه المشاركة.</p>
          )}

          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold hover:bg-slate-50"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "تم النسخ" : "نسخ الرابط"}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(waText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold"
            >
              <MessageCircle className="w-3.5 h-3.5" /> واتساب
            </a>
            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(info.title)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold"
            >
              <Send className="w-3.5 h-3.5" /> تيليجرام
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
