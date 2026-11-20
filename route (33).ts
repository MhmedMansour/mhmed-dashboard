import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { shareLinks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolveShareResource } from "@/lib/share";
import { resolveStoredFile } from "@/lib/fileStorage";
import type { BlobOwnerType } from "@/lib/fileStorage";

export const dynamic = "force-dynamic";

const MAX_ATTACH_BYTES = 20 * 1024 * 1024;

function smtpConfig() {
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST || "";
  if (!host) return null;
  return {
    host,
    port: Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587),
    secure: String(process.env.SMTP_SECURE || process.env.EMAIL_SECURE || "false") === "true",
    user: process.env.SMTP_USER || process.env.EMAIL_USER || "",
    pass: process.env.SMTP_PASS || process.env.EMAIL_PASS || "",
    from:
      process.env.SMTP_FROM ||
      process.env.EMAIL_FROM ||
      process.env.SMTP_USER ||
      process.env.EMAIL_USER ||
      "no-reply@localhost",
  };
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

// POST /api/share/send-email — { token, to, subject?, message? }
// Sends the share link (and attaches the file when small enough).
// Falls back to a mailto link when no SMTP is configured.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || "");
    const toRaw = String(body.to || "");
    const recipients = toRaw
      .split(/[,;\n]+/)
      .map((s: string) => s.trim())
      .filter(Boolean);

    if (!token) return NextResponse.json({ error: "حدد رابط المشاركة" }, { status: 400 });
    if (recipients.length === 0) {
      return NextResponse.json({ error: "اكتب بريداً إلكترونياً واحداً على الأقل" }, { status: 400 });
    }
    const invalid = recipients.filter((r) => !isEmail(r));
    if (invalid.length > 0) {
      return NextResponse.json({ error: `بريد غير صالح: ${invalid.join("، ")}` }, { status: 400 });
    }

    const [link] = await db.select().from(shareLinks).where(eq(shareLinks.token, token)).limit(1);
    if (!link) {
      return NextResponse.json({ error: "الرابط غير موجود أو تم إلغاؤه" }, { status: 404 });
    }
    if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: "انتهت صلاحية هذا الرابط" }, { status: 410 });
    }

    const resolved = await resolveShareResource(link.resourceType, link.resourceId);
    if (!resolved) {
      return NextResponse.json({ error: "العنصر المرتبط تم حذفه" }, { status: 404 });
    }

    const origin = new URL(request.url).origin;
    const shareUrl = `${origin}/s/${token}`;
    const subject = String(body.subject || `مشاركة: ${resolved.title}`).slice(0, 200);
    const customMessage = String(body.message || "").trim();
    const textLines = [
      `مشاركة من منصة مِحور الهندسي`,
      ``,
      `العنوان: ${resolved.title}`,
      ...(resolved.subtitle ? [`التفاصيل: ${resolved.subtitle}`] : []),
      ...(resolved.fileName ? [`الملف: ${resolved.fileName}${resolved.sizeFormatted ? ` (${resolved.sizeFormatted})` : ""}`] : []),
      ``,
      ...(customMessage ? [`رسالة المرسل:`, customMessage, ``] : []),
      `رابط المشاركة: ${shareUrl}`,
      ...(resolved.files.length > 1
        ? [`ملفات مرفقة بالصفحة (${resolved.files.length}): ${resolved.files.map((f) => f.fileName).join("، ")}`]
        : []),
    ];
    const text = textLines.join("\n");
    const mailto = `mailto:${encodeURIComponent(recipients.join(","))}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(text)}`;

    const smtp = smtpConfig();
    if (!smtp) {
      return NextResponse.json({
        sent: false,
        noSmtp: true,
        mailto,
        message: "لا يوجد خادم بريد مُعد — استخدم زر فتح تطبيق البريد",
      });
    }

    // Lazy-load nodemailer only when SMTP is actually configured.
    const { default: nodemailer } = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    });

    // Attach the single file when it's small enough; otherwise the link suffices.
    const attachments: Array<{ filename: string; content: Buffer; contentType?: string }> = [];
    if (resolved.isFile && resolved.files.length === 1) {
      const f = resolved.files[0];
      const ownerType: BlobOwnerType =
        f.kind === "general_info" ? "general_info" : f.kind === "haram_document" ? "haram_document" : "engineering_file";
      const stored = await resolveStoredFile(ownerType, f.id, null, f.mimeType);
      if (stored && stored.data.byteLength <= MAX_ATTACH_BYTES) {
        attachments.push({
          filename: f.fileName,
          content: stored.data,
          contentType: stored.mimeType || undefined,
        });
      }
    }

    const html = `
      <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9;color:#1e293b">
        <h2 style="margin:0 0 8px">📐 مشاركة من منصة مِحور الهندسي</h2>
        <p style="margin:0 0 4px"><strong>العنوان:</strong> ${escapeHtml(resolved.title)}</p>
        ${resolved.subtitle ? `<p style="margin:0 0 4px"><strong>التفاصيل:</strong> ${escapeHtml(resolved.subtitle)}</p>` : ""}
        ${resolved.fileName ? `<p style="margin:0 0 4px"><strong>الملف:</strong> ${escapeHtml(resolved.fileName)}${resolved.sizeFormatted ? ` (${escapeHtml(resolved.sizeFormatted)})` : ""}</p>` : ""}
        ${customMessage ? `<p style="margin:12px 0 4px"><strong>رسالة المرسل:</strong><br/>${escapeHtml(customMessage).replace(/\n/g, "<br/>")}</p>` : ""}
        <p style="margin:12px 0">
          <a href="${shareUrl}" style="display:inline-block;background:#0f766e;color:#fff;padding:10px 22px;border-radius:10px;text-decoration:none;font-weight:bold">فتح صفحة المشاركة</a>
        </p>
        <p style="color:#64748b;font-size:12px">أو انسخ الرابط: ${shareUrl}</p>
      </div>`;

    await transporter.sendMail({
      from: smtp.from,
      to: recipients.join(", "),
      subject,
      text,
      html,
      attachments,
    });

    return NextResponse.json({ sent: true, attached: attachments.length > 0 });
  } catch (error) {
    console.error("POST /api/share/send-email error:", error);
    return NextResponse.json({ error: "تعذر إرسال الإيميل" }, { status: 500 });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
