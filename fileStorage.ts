import { db } from "@/db";
import { fileBlobs } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import fs from "fs";

export type BlobOwnerType =
  | "engineering_file"
  | "general_info"
  | "haram_document"
  | "profile_photo";

// Storage path marker for files whose bytes live in PostgreSQL.
export const DB_STORAGE_PREFIX = "db://";

export function isDbStoragePath(path: string | null | undefined): boolean {
  return Boolean(path && path.startsWith(DB_STORAGE_PREFIX));
}

export function isLocalStoragePath(path: string | null | undefined): boolean {
  return Boolean(path && path.startsWith("/tmp/mihwar_vault"));
}

export async function saveFileBlob(
  ownerType: BlobOwnerType,
  ownerId: number,
  data: Buffer,
  mimeType: string
): Promise<string> {
  await db
    .delete(fileBlobs)
    .where(and(eq(fileBlobs.ownerType, ownerType), eq(fileBlobs.ownerId, ownerId)));
  const [created] = await db
    .insert(fileBlobs)
    .values({ ownerType, ownerId, data, mimeType, sizeBytes: data.byteLength })
    .returning({ id: fileBlobs.id });
  return `${DB_STORAGE_PREFIX}${ownerType}/${created.id}`;
}

export async function readFileBlob(
  ownerType: BlobOwnerType,
  ownerId: number
): Promise<{ data: Buffer; mimeType: string } | null> {
  const [row] = await db
    .select({ data: fileBlobs.data, mimeType: fileBlobs.mimeType })
    .from(fileBlobs)
    .where(and(eq(fileBlobs.ownerType, ownerType), eq(fileBlobs.ownerId, ownerId)))
    .limit(1);
  if (!row) return null;
  const data = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data as Uint8Array);
  return { data, mimeType: row.mimeType };
}

// Resolves the bytes for a record: database first, then any legacy disk copy.
export async function resolveStoredFile(
  ownerType: BlobOwnerType,
  ownerId: number,
  storagePath: string | null | undefined,
  fallbackMime: string | null | undefined
): Promise<{ data: Buffer; mimeType: string } | null> {
  const fromDb = await readFileBlob(ownerType, ownerId);
  if (fromDb) return fromDb;
  if (isLocalStoragePath(storagePath) && storagePath && fs.existsSync(storagePath)) {
    return {
      data: fs.readFileSync(storagePath),
      mimeType: fallbackMime || "application/octet-stream",
    };
  }
  return null;
}

export async function deleteFileBlob(ownerType: BlobOwnerType, ownerId: number): Promise<void> {
  await db
    .delete(fileBlobs)
    .where(and(eq(fileBlobs.ownerType, ownerType), eq(fileBlobs.ownerId, ownerId)));
}

// Returns the owner ids that have a stored blob, used to flag records whose
// bytes were lost when the temporary disk vault was wiped.
export async function listOwnersWithBlobs(
  ownerType: BlobOwnerType,
  ownerIds: number[]
): Promise<Set<number>> {
  if (ownerIds.length === 0) return new Set();
  const rows = await db
    .select({ ownerId: fileBlobs.ownerId })
    .from(fileBlobs)
    .where(and(eq(fileBlobs.ownerType, ownerType), inArray(fileBlobs.ownerId, ownerIds)));
  return new Set(rows.map((row) => row.ownerId));
}

export function hasRecoverableBytes(storagePath: string | null | undefined, hasBlob: boolean): boolean {
  if (hasBlob) return true;
  if (isLocalStoragePath(storagePath) && storagePath) return fs.existsSync(storagePath);
  return false;
}

// Adds `hasContent` so the UI can flag records whose bytes are no longer available.
export async function annotateFileContent<
  T extends { id: number; storagePath: string | null }
>(rows: T[]): Promise<Array<T & { hasContent: boolean }>> {
  const withBlob = await listOwnersWithBlobs(
    "engineering_file",
    rows.map((row) => row.id)
  );
  return rows.map((row) => ({
    ...row,
    hasContent: hasRecoverableBytes(row.storagePath, withBlob.has(row.id)),
  }));
}

export function encodeContentDisposition(kind: "inline" | "attachment", fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") || "file";
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
