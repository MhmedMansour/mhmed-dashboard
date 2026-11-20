"use client";

import Link from "next/link";
import { Box } from "lucide-react";

const VIEWABLE = new Set([".dwg", ".rvt", ".ifc", ".nwd", ".nwc", ".dxf", ".dwt", ".rfa"]);

export function AutodeskFileButton({ fileId, fileName, extension, compact = false }: { fileId: number; fileName: string; extension: string; compact?: boolean }) {
  if (!VIEWABLE.has(extension.toLowerCase())) return null;
  return (
    <Link
      href={`/viewer/autodesk?fileId=${fileId}&name=${encodeURIComponent(fileName)}`}
      target="_blank"
      rel="noopener noreferrer"
      title="عرض ملف CAD / Revit داخل Autodesk Viewer — يتطلب ربط حساب Autodesk وإنترنت"
      className={`inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 font-bold text-indigo-700 transition hover:bg-indigo-600 hover:text-white dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-600 dark:hover:text-white ${compact ? "p-1.5 text-[11px]" : "px-2.5 py-1.5 text-[11px]"}`}
    >
      <Box className="h-3.5 w-3.5" />
      {!compact && "عرض Autodesk"}
    </Link>
  );
}
