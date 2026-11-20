import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { encodeContentDisposition } from "@/lib/fileStorage";

export const dynamic = "force-dynamic";

// Downloadable Excel template matching the columns the importer understands.
export async function GET() {
  const header = [
    "م",
    "المهمة",
    "الوصف",
    "النوع",
    "الموقع",
    "الجهة الطالبة",
    "الحالة",
    "الأولوية",
    "تاريخ البدء",
    "تاريخ الانتهاء",
    "عدد اللوحات",
    "الساعات",
    "ملاحظات",
  ];
  const example = [
    1,
    "رسم مخططات توزيع السجاد — التوسعة الشمالية",
    "لوحات AutoCAD لتوزيع الفرش حسب الاحتياج التشغيلي",
    "رسم",
    "التوسعة الشمالية",
    "إدارة التشغيل",
    "منجز",
    "عادية",
    "2024-03-10",
    "2024-03-25",
    12,
    40,
    "تم الاعتماد",
  ];
  const ws = XLSX.utils.aoa_to_sheet([header, example]);
  ws["!cols"] = header.map((h, i) => ({ wch: i === 1 || i === 2 ? 42 : Math.max(12, h.length + 4) }));
  if (!ws["!views"]) ws["!views"] = [];
  (ws["!views"] as Array<{ rightToLeft?: boolean }>)[0] = { rightToLeft: true };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "المهام");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": encodeContentDisposition("attachment", "قالب-مهام-الحرم.xlsx"),
      "Cache-Control": "no-store",
    },
  });
}
