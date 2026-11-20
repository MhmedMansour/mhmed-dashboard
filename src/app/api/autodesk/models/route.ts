import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { apsModels, engineeringFiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { apsFetch, getAppToken, getUserApsToken, isApsConfigured, urnify } from "@/lib/aps";
import { resolveStoredFile } from "@/lib/fileStorage";

export const dynamic = "force-dynamic";

const SUPPORTED = new Set([".dwg", ".rvt", ".ifc", ".nwd", ".nwc", ".dxf", ".dwt", ".rfa"]);
const CHUNK = 8 * 1024 * 1024;
const MAX_PARTS = 24;
const MAX_BYTES = CHUNK * MAX_PARTS;

function bucketKey(): string {
  const id = (process.env.APS_CLIENT_ID || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24);
  return `mihwar-${id}-models`;
}

async function ensureBucket(token: string, key: string) {
  const details = await apsFetch(`/oss/v2/buckets/${key}/details`, token);
  if (details.ok) return;
  if (details.status !== 404) throw new Error(`تعذر الوصول إلى مساحة Autodesk OSS (${details.status})`);
  const created = await apsFetch("/oss/v2/buckets", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bucketKey: key, policyKey: "persistent" }),
  });
  if (!created.ok && created.status !== 409) {
    throw new Error(`تعذر إنشاء مساحة Autodesk OSS (${created.status})`);
  }
}

// POST { fileId } — upload local CAD/BIM model to APS OSS + start SVF2 job.
export async function POST(request: NextRequest) {
  if (!isApsConfigured()) {
    return NextResponse.json({ error: "ضيف APS_CLIENT_ID و APS_CLIENT_SECRET أولاً في إعدادات السيرفر" }, { status: 503 });
  }
  if (!(await getUserApsToken())) {
    return NextResponse.json({ error: "وصّل حساب Autodesk الأول عشان تجهّز ملفاتك للعارض" }, { status: 401 });
  }
  let fileId = 0;
  try { fileId = Number((await request.json()).fileId); } catch { /* invalid */ }
  if (!Number.isInteger(fileId) || fileId <= 0) {
    return NextResponse.json({ error: "اختَر ملف كاد أو ريفيت صالح" }, { status: 400 });
  }
  const [file] = await db.select().from(engineeringFiles).where(eq(engineeringFiles.id, fileId)).limit(1);
  if (!file) return NextResponse.json({ error: "الملف غير موجود" }, { status: 404 });
  if (!SUPPORTED.has(file.extension.toLowerCase())) {
    return NextResponse.json({ error: "عارض Autodesk يدعم ملفات CAD / Revit / IFC / Navisworks فقط" }, { status: 400 });
  }
  const [existing] = await db.select().from(apsModels).where(eq(apsModels.fileId, fileId)).limit(1);
  // Reuse a ready/pending translation, but retry a failed one with a fresh job.
  if (existing && existing.status !== "failed") {
    return NextResponse.json({ urn: existing.urn, status: existing.status, reused: true });
  }

  const stored = await resolveStoredFile("engineering_file", fileId, file.storagePath, file.mimeType);
  if (!stored) {
    return NextResponse.json({ error: "محتوى الملف غير متاح على السيرفر؛ أعد رفعه أولاً من الخزنة" }, { status: 410 });
  }
  if (stored.data.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: `الملف أكبر من ${Math.floor(MAX_BYTES / 1024 / 1024)} MB؛ صيغة Autodesk تحتاج رفعًا مقسمًا لمزيد من الأجزاء. اعرضه مباشرة من Autodesk Docs لو موجود في حسابك.` }, { status: 413 });
  }
  if (stored.data.byteLength === 0) return NextResponse.json({ error: "الملف فارغ" }, { status: 400 });

  try {
    const token = (await getAppToken("bucket:create bucket:read data:read data:create data:write viewables:read")).access_token;
    const bucket = bucketKey();
    await ensureBucket(token, bucket);
    const objectKey = `${file.id}-${Date.now()}-${file.fileName.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(-75)}`;
    const base = `/oss/v2/buckets/${bucket}/objects/${encodeURIComponent(objectKey)}/signeds3upload`;
    const count = Math.ceil(stored.data.byteLength / CHUNK);
    const signed = await apsFetch(`${base}?parts=${count}&firstPart=1&minutesExpiration=20`, token);
    if (!signed.ok) throw new Error(`تعذر طلب روابط رفع Autodesk (${signed.status})`);
    const session = await signed.json() as { uploadKey: string; urls: string[] };
    if (!session.uploadKey || !Array.isArray(session.urls) || session.urls.length < count) throw new Error("لم يرجع Autodesk روابط رفع كافية");
    const eTags: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = stored.data.subarray(i * CHUNK, Math.min((i + 1) * CHUNK, stored.data.byteLength));
      const put = await fetch(session.urls[i], { method: "PUT", body: new Uint8Array(part) });
      if (!put.ok) throw new Error(`فشل رفع الجزء ${i + 1} إلى Autodesk (${put.status})`);
      const tag = put.headers.get("etag");
      if (!tag) throw new Error(`Autodesk S3 لم يرجع ETag للجزء ${i + 1}`);
      eTags.push(tag.replace(/^"|"$/g, ""));
    }
    const complete = await apsFetch(base, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadKey: session.uploadKey, eTags, size: stored.data.byteLength }),
    });
    if (!complete.ok) throw new Error(`Autodesk رفض إكمال الرفع (${complete.status})`);
    const obj = await complete.json() as { objectId?: string };
    if (!obj.objectId) throw new Error("Autodesk لم يرجع Object ID");
    const urn = urnify(obj.objectId);
    const job = await apsFetch("/modelderivative/v2/designdata/job", token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: { urn }, output: { formats: [{ type: "svf2", views: ["2d", "3d"] }] } }),
    });
    if (!job.ok) throw new Error(`تعذر بدء تحويل Autodesk SVF2 (${job.status})`);
    await db.insert(apsModels).values({ fileId, urn, objectId: obj.objectId, status: "inprogress", updatedAt: new Date() }).onConflictDoUpdate({ target: apsModels.fileId, set: { urn, objectId: obj.objectId, status: "inprogress", updatedAt: new Date() } });
    return NextResponse.json({ urn, status: "inprogress", reused: false }, { status: 202 });
  } catch (error) {
    console.error("APS model prepare failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تجهيز النموذج للعرض" }, { status: 502 });
  }
}

// GET ?fileId= — look up translation status; does not upload anything.
export async function GET(request: NextRequest) {
  if (!isApsConfigured()) return NextResponse.json({ error: "إعدادات Autodesk APS غير موجودة" }, { status: 503 });
  if (!(await getUserApsToken())) return NextResponse.json({ error: "وصّل حساب Autodesk الأول" }, { status: 401 });
  const fileId = Number(request.nextUrl.searchParams.get("fileId"));
  if (!Number.isInteger(fileId) || fileId <= 0) return NextResponse.json({ error: "معرف غير صالح" }, { status: 400 });
  const [row] = await db.select().from(apsModels).where(eq(apsModels.fileId, fileId)).limit(1);
  if (!row) return NextResponse.json({ status: "not_uploaded" });
  if (!isApsConfigured()) return NextResponse.json({ status: "configuration_missing", urn: row.urn });
  try {
    const token = (await getAppToken("data:read viewables:read")).access_token;
    const response = await apsFetch(`/modelderivative/v2/designdata/${encodeURIComponent(row.urn)}/manifest`, token);
    if (response.status === 404) return NextResponse.json({ status: "inprogress", urn: row.urn, progress: "في انتظار بدء التحويل" });
    if (!response.ok) return NextResponse.json({ error: `تعذر قراءة حالة تحويل Autodesk (${response.status})` }, { status: 502 });
    const manifest = await response.json() as { status?: string; progress?: string; messages?: unknown[] };
    const status = manifest.status === "success" ? "success" : manifest.status === "failed" ? "failed" : "inprogress";
    if (status !== row.status) await db.update(apsModels).set({ status, updatedAt: new Date() }).where(eq(apsModels.fileId, fileId));
    return NextResponse.json({ status, urn: row.urn, progress: manifest.progress || null, messages: status === "failed" ? manifest.messages || [] : undefined });
  } catch (error) {
    console.error("APS manifest check failed:", error);
    return NextResponse.json({ error: "تعذر الاتصال بخدمة تحويل Autodesk" }, { status: 502 });
  }
}
