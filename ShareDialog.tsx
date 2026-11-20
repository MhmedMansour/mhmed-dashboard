"use client";

import { useEffect, useState } from "react";
import {
  X,
  Link2,
  Mail,
  HardDrive,
  Copy,
  Check,
  Send,
  MessageCircle,
  ExternalLink,
  Loader2,
  RotateCcw,
  Trash2,
  Share2,
  Smartphone,
} from "lucide-react";

export type ShareResourceType =
  | "engineering_file"
  | "general_info"
  | "haram_document"
  | "project"
  | "haram_task"
  | "certificate"
  | "operation";

interface ShareLinkInfo {
  token: string;
  title: string;
  fileName: string | null;
  allowDownload: boolean;
  expiresAt: string | null;
  createdAt: string;
}

type Tab = "link" | "email" | "drive";

export function ShareDialog({
  open,
  onClose,
  resourceType,
  resourceId,
  title,
}: {
  open: boolean;
  onClose: () => void;
  resourceType: ShareResourceType;
  resourceId: number;
  title: string;
}) {
  const [tab, setTab] = useState<Tab>("link");
  const [link, setLink] = useState<ShareLinkInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedMail, setCopiedMail] = useState(false);
  const [expiry, setExpiry] = useState<string>("0");
  const [allowDownload, setAllowDownload] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Email form
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<string | null>(null);

  const [driveReady, setDriveReady] = useState(false);
  const [systemSharing, setSystemSharing] = useState(false);

  const shareUrl = link && typeof window !== "undefined" ? `${window.location.origin}/s/${link.token}` : "";

  useEffect(() => {
    if (!open) return;
    setTab("link");
    setError(null);
    setSendMsg(null);
    setLoading(true);
    setLink(null);
    (async () => {
      try {
        const res = await fetch("/api/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resourceType, resourceId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "تعذر إنشاء الرابط");
        const l = data.link as ShareLinkInfo;
        setLink(l);
        setAllowDownload(l.allowDownload);
        setSubject(`مشاركة: ${l.title}`);
        setMessage(`أشارك معك هذا العنصر من منصة مِحور الهندسي:\n${l.title}\n\nرابط المشاركة:\n${window.location.origin}/s/${l.token}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذر إنشاء الرابط");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, resourceType, resourceId]);

  // Save-to-Drive script
  useEffect(() => {
    if (!open || tab !== "drive" || !link) return;
    const render = () => {
      try {
        const g = (window as unknown as { gapi?: { savetodrive?: { go: () => void } } }).gapi;
        g?.savetodrive?.go();
        setDriveReady(true);
      } catch {
        // ignore
      }
    };
    if (document.querySelector('script[data-g-save-drive]')) {
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
  }, [open, tab, link]);

  if (!open) return null;

  const copyText = async (text: string, done: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      done(true);
      setTimeout(() => done(false), 2000);
    } catch {
      // clipboard blocked
    }
  };

  const saveSettings = async (nextAllow: boolean, nextExpiry: string) => {
    if (!link) return;
    setSavingSettings(true);
    try {
      const res = await fetch(`/api/share/${link.token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowDownload: nextAllow, expiresInDays: Number(nextExpiry) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذر حفظ الإعدادات");
      setLink(data.link);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ الإعدادات");
    } finally {
      setSavingSettings(false);
    }
  };

  const revoke = async () => {
    if (!link || !window.confirm("إلغاء هذا الرابط؟ لن يفتح مع أي حد بعد كده.")) return;
    try {
      const res = await fetch(`/api/share/${link.token}`, { method: "DELETE" });
      if (!res.ok) throw new Error("تعذر الإلغاء");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الإلغاء");
    }
  };

  const freshLink = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceType, resourceId, fresh: true, allowDownload, expiresInDays: Number(expiry) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذر إنشاء الرابط");
      setLink(data.link);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إنشاء الرابط");
    } finally {
      setLoading(false);
    }
  };

  const sendEmail = async () => {
    if (!link) return;
    const toList = to.trim();
    if (!toList) {
      setSendMsg("اكتب البريد الإلكتروني الأول");
      return;
    }
    setSending(true);
    setSendMsg(null);
    try {
      const res = await fetch("/api/share/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: link.token, to: toList, subject, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.sent) {
        setSendMsg(data.attached ? "تم الإرسال مع إرفاق الملف ✓" : "تم إرسال الإيميل بالرابط ✓");
        setTo("");
      } else if (data.noSmtp && data.mailto) {
        window.location.href = data.mailto as string;
        setSendMsg("اتفتح تطبيق البريد — دوس إرسال");
      } else {
        setSendMsg(data.error || "تعذر الإرسال");
      }
    } catch {
      openMailApp();
      setSendMsg("اتفتح تطبيق البريد — دوس إرسال");
    } finally {
      setSending(false);
    }
  };

  const openMailApp = () => {
    if (!link) return;
    const body = `${message}\n\nرابط المشاركة:\n${shareUrl}`;
    window.location.href = `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(
      subject || `مشاركة: ${link.title}`
    )}&body=${encodeURIComponent(body)}`;
  };

  const mailText = `الموضوع: ${subject}\nإلى: ${to || "—"}\n\n${message}\n\nرابط المشاركة:\n${shareUrl}`;

  const driveFileUrl = (download: boolean) =>
    link && typeof window !== "undefined"
      ? `${window.location.origin}/api/share/${link.token}/file${download ? "?download=1" : ""}`
      : "";

  const systemShare = async () => {
    if (!link) return;
    setSystemSharing(true);
    try {
      // Try sharing the actual file bytes (mobile share sheet → Gmail/Drive/WhatsApp)
      let shared = false;
      const nav = navigator as Navigator & {
        canShare?: (d: { files?: File[] }) => boolean;
        share?: (d: { title?: string; text?: string; url?: string; files?: File[] }) => Promise<void>;
      };
      try {
        const res = await fetch(`/api/share/${link.token}/file`);
        if (res.ok) {
          const blob = await res.blob();
          const file = new File([blob], link.fileName || link.title || "shared-file", {
            type: blob.type || "application/octet-stream",
          });
          if (nav.canShare?.({ files: [file] }) && nav.share) {
            await nav.share({ title: link.title, text: link.title, files: [file] });
            shared = true;
          }
        }
      } catch {
        // fall through to URL share
      }
      if (!shared && nav.share) {
        await nav.share({ title: link.title, text: link.title, url: shareUrl });
      } else if (!shared) {
        await copyText(shareUrl, setCopied);
      }
    } catch {
      // user cancelled — ignore
    } finally {
      setSystemSharing(false);
    }
  };

  const canSystemShare =
    typeof navigator !== "undefined" &&
    "share" in navigator;

  const waText = `${link?.title || title}\n${shareUrl}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto" dir="rtl">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Share2 className="w-4.5 h-4.5 w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate max-w-[280px]">
                مشاركة: {link?.title || title}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                رابط عام + إيميل + جوجل درايف
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-lg leading-none">✕</button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 flex items-center gap-1.5 bg-slate-50/60 dark:bg-slate-900/40">
          {(
            [
              { k: "link", label: "الرابط", icon: Link2 },
              { k: "email", label: "إيميل", icon: Mail },
              { k: "drive", label: "درايف", icon: HardDrive },
            ] as const
          ).map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={() => setTab(t.k)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-t-xl text-xs font-bold border-b-2 transition ${
                tab === t.k
                  ? "bg-white dark:bg-[#111827] text-blue-700 dark:text-blue-400 border-blue-600"
                  : "text-slate-500 border-transparent hover:text-slate-800"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {loading && !link ? (
            <div className="py-10 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> جاري تجهيز رابط المشاركة…
            </div>
          ) : error && !link ? (
            <div className="py-8 text-center">
              <p className="text-xs font-bold text-rose-600 mb-3">{error}</p>
              <button type="button" onClick={() => window.location.reload()} className="text-xs text-blue-600 underline">إعادة المحاولة</button>
            </div>
          ) : link ? (
            <>
              {tab === "link" && (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">الرابط العام (يفتح من غير تسجيل دخول)</label>
                  <div className="flex items-center gap-2">
                    <input dir="ltr" readOnly value={shareUrl} className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-mono text-left" />
                    <button type="button" onClick={() => copyText(shareUrl, setCopied)} className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shrink-0">
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? "اتنسخ" : "نسخ"}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(shareUrl)}`}
                      alt="QR"
                      width={96}
                      height={96}
                      className="rounded-lg border border-slate-200"
                      onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                    />
                    <div className="flex-1 space-y-2 min-w-[200px]">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        مدة الصلاحية
                        <select
                          value={expiry}
                          onChange={(e) => {
                            setExpiry(e.target.value);
                            saveSettings(allowDownload, e.target.value);
                          }}
                          disabled={savingSettings}
                          className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                        >
                          <option value="0">بدون انتهاء</option>
                          <option value="7">7 أيام</option>
                          <option value="30">30 يوم</option>
                        </select>
                      </label>
                      <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowDownload}
                          disabled={savingSettings}
                          onChange={(e) => {
                            setAllowDownload(e.target.checked);
                            saveSettings(e.target.checked, expiry);
                          }}
                          className="rounded text-blue-600"
                        />
                        السماح بالتحميل (لو مقفول: معاينة فقط)
                      </label>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-blue-600 hover:underline">فتح صفحة المشاركة ↗</a>
                    <button type="button" onClick={freshLink} className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-blue-600">
                      <RotateCcw className="w-3 h-3" /> رابط جديد
                    </button>
                    <button type="button" onClick={revoke} className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-700">
                      <Trash2 className="w-3 h-3" /> إلغاء الرابط
                    </button>
                  </div>
                  {canSystemShare && (
                    <button type="button" onClick={systemShare} disabled={systemSharing} className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800">
                      {systemSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                      مشاركة عبر تطبيقات الجهاز (واتساب / جيميل / درايف…)
                    </button>
                  )}
                </div>
              )}

              {tab === "email" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">إلى (افصل بفاصلة لأكتر من بريد)</label>
                    <input dir="ltr" type="text" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@mail.com, other@mail.com" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs text-left" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">الموضوع</label>
                    <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">رسالتك (اختياري)</label>
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs resize-y" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={sendEmail} disabled={sending} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold">
                      {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      إرسال بالإيميل
                    </button>
                    <button type="button" onClick={openMailApp} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800">
                      <Mail className="w-3.5 h-3.5" /> فتح تطبيق البريد
                    </button>
                    <button type="button" onClick={() => copyText(mailText, setCopiedMail)} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800">
                      {copiedMail ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedMail ? "اتنسخ" : "نسخ نص الإيميل"}
                    </button>
                  </div>
                  {sendMsg && <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">{sendMsg}</p>}
                  <p className="text-[10px] text-slate-400">لو السيرفر مظبوط عليه بريد (SMTP) هيتبعت مباشرة مع إرفاق الملف — غير كده هيفتح تطبيق البريد عندك.</p>
                </div>
              )}

              {tab === "drive" && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    احفظ نسخة من الملف في <strong>Google Drive</strong> بتاعك بضغطة واحدة، وبعدها تقدر تشاركه من درايف لأي إيميل.
                  </p>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{link.fileName || link.title}</div>
                      <div className="text-[10px] text-slate-400">زر جوجل الرسمي للحفظ في درايف</div>
                    </div>
                    <div
                      className="g-savetodrive shrink-0"
                      data-src={driveFileUrl(true)}
                      data-filename={link.fileName || link.title}
                      data-sitename="مِحور الهندسي"
                    />
                  </div>
                  {!driveReady && <p className="text-[10px] text-slate-400">جاري تجهيز زر جوجل…</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    <a href="https://drive.google.com/drive/my-drive" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">
                      <HardDrive className="w-3.5 h-3.5" /> فتح جوجل درايف
                    </a>
                    <a href={`https://wa.me/?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold">
                      <MessageCircle className="w-3.5 h-3.5" /> واتساب
                    </a>
                    <a href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(link.title)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold">
                      <Send className="w-3.5 h-3.5" /> تيليجرام
                    </a>
                    <a href="https://mail.google.com/mail/?view=cm&fs=1" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800">
                      <ExternalLink className="w-3.5 h-3.5" /> Gmail ويب
                    </a>
                  </div>
                </div>
              )}
            </>
          ) : null}
          {error && link && <p className="mt-2 text-[11px] font-bold text-rose-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}

export function ShareButton({
  resourceType,
  resourceId,
  title,
  className = "",
  label,
  iconClassName = "w-3.5 h-3.5",
}: {
  resourceType: ShareResourceType;
  resourceId: number;
  title: string;
  className?: string;
  label?: string;
  iconClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="مشاركة عبر رابط / إيميل / جوجل درايف"
        className={
          className ||
          "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white dark:bg-emerald-950/70 dark:text-emerald-300 dark:hover:bg-emerald-600 dark:hover:text-white text-xs font-bold transition-colors"
        }
      >
        <Share2 className={iconClassName} />
        {label || "مشاركة"}
      </button>
      <ShareDialog open={open} onClose={() => setOpen(false)} resourceType={resourceType} resourceId={resourceId} title={title} />
    </>
  );
}
