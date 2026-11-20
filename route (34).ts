import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { engineerProfile } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import {
  deleteFileBlob,
  encodeContentDisposition,
  readFileBlob,
  saveFileBlob,
} from "@/lib/fileStorage";

export const dynamic = "force-dynamic";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/avif",
]);

const MAX_BYTES = 8 * 1024 * 1024;

async function getProfile() {
  await ensureSeeded();
  const [profile] = await db.select().from(engineerProfile).limit(1);
  return profile || null;
}

export async function GET() {
  try {
    const profile = await getProfile();
    if (!profile) {
      return NextResponse.json({ error: "لا يوجد ملف مهني بعد" }, { status: 404 });
    }
    const stored = await readFileBlob("profile_photo", profile.id);
    if (!stored) {
      return NextResponse.json({ error: "لا توجد صورة شخصية بعد" }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(stored.data), {
      status: 200,
      headers: {
        "Content-Type": stored.mimeType || "image/jpeg",
        "Content-Disposition": encodeContentDisposition("inline", "profile-photo"),
        "Content-Length": String(stored.data.byteLength),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("GET /api/workspace/photo error:", error);
    return NextResponse.json({ error: "تعذر تحميل الصورة الشخصية" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const profile = await getProfile();
    if (!profile) {
      return NextResponse.json({ error: "لا يوجد ملف مهني بعد" }, { status: 404 });
    }
    const formData = await request.formData();
    const file = formData.get("photo");
    if (!(file instanceof File) || !file.name || file.size === 0) {
      return NextResponse.json({ error: "اختَر صورة أولاً" }, { status: 400 });
    }
    const mimeType = file.type || "application/octet-stream";
    if (!ALLOWED_MIME.has(mimeType)) {
      return NextResponse.json(
        { error: "الصيغة غير مدعومة — ارفع صورة JPG أو PNG أو WEBP" },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "حجم الصورة كبير — الحد الأقصى 8 ميجا" },
        { status: 413 }
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    await saveFileBlob("profile_photo", profile.id, buffer, mimeType);
    return NextResponse.json({ ok: true, hasPhoto: true }, { status: 201 });
  } catch (error) {
    console.error("POST /api/workspace/photo error:", error);
    return NextResponse.json({ error: "تعذر حفظ الصورة الشخصية" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const profile = await getProfile();
    if (!profile) {
      return NextResponse.json({ error: "لا يوجد ملف مهني بعد" }, { status: 404 });
    }
    await deleteFileBlob("profile_photo", profile.id);
    return NextResponse.json({ ok: true, hasPhoto: false });
  } catch (error) {
    console.error("DELETE /api/workspace/photo error:", error);
    return NextResponse.json({ error: "تعذر حذف الصورة الشخصية" }, { status: 500 });
  }
}
