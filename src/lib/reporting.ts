import * as XLSX from "xlsx";

/** Shared Excel/PDF export helpers used across the dashboard. */

export interface ReportColumn<T> {
  header: string;
  /** Arabic header shown in the file */
  accessor: (row: T) => string | number | null | undefined;
  /** Column width hint (Excel character units) */
  width?: number;
}

export interface ReportMeta {
  title: string;
  fileName: string;
  /** Optional subtitle printed under the title */
  subtitle?: string;
}

function safeSheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, "-").slice(0, 31) || "Sheet1";
}

function cellValue(value: string | number | null | undefined): string | number {
  if (value === null || value === undefined) return "";
  return value;
}

/**
 * Exports rows to a styled .xlsx workbook with an Arabic title row,
 * RTL sheet direction, a bold header band and auto-sized columns.
 */
export function exportToExcel<T>(
  rows: T[],
  columns: Array<ReportColumn<T>>,
  meta: ReportMeta
): void {
  const headerRow = columns.map((c) => c.header);

  const dataRows = rows.map((row) =>
    columns.map((col) => cellValue(col.accessor(row)))
  );

  const ws = XLSX.utils.aoa_to_sheet([
    [meta.title],
    meta.subtitle ? [meta.subtitle] : [],
    [],
    headerRow,
    ...dataRows,
  ]);

  // Title band + header band styling
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, columns.length - 1) } },
  ];
  if (meta.subtitle) {
    ws["!merges"]!.push({
      s: { r: 1, c: 0 },
      e: { r: 1, c: Math.max(0, columns.length - 1) },
    });
  }

  // Column widths
  ws["!cols"] = columns.map((c) => ({
    wch: c.width ?? Math.max(12, c.header.length + 6),
  }));

  // Freeze panes below the header rows
  const preamble = meta.subtitle ? 3 : 2;
  ws["!freeze"] = { xSplit: "0", ySplit: String(preamble) };
  ws["!views"] = [{ rightToLeft: true } as XLSX.WorkSheet["!views"]];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName(meta.title));
  XLSX.writeFile(wb, `${meta.fileName}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** Each section carries its own row type and matching column set. */
export interface ReportSection {
  heading: string;
  rows: Array<unknown>;
  /** Accessor args are pre-cast by buildSection, so the PDF renderer is type-neutral. */
  render: (row: unknown) => Array<string | number>;
  headers: string[];
  widths: number[] | null;
}

/** Type-safe builder: keeps autocomplete on the caller's row type. */
export function buildSection<T>(section: {
  heading: string;
  rows: T[];
  columns: Array<ReportColumn<T>>;
}): ReportSection {
  return {
    heading: section.heading,
    rows: section.rows,
    headers: section.columns.map((c) => c.header),
    widths: section.columns.some((c) => c.width) ? section.columns.map((c) => c.width ?? 14) : null,
    render: (row) => section.columns.map((c) => cellValue(c.accessor(row as T))),
  };
}

/** Builds a print-ready HTML document and opens the browser print dialog (PDF). */
export function exportToPdf(
  sections: Array<ReportSection>,
  meta: ReportMeta
): void {
  const today = new Date().toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const esc = (v: string) =>
    v.replace(/[&<>"']/g, (c) =>
      c === "&"
        ? "&amp;"
        : c === "<"
        ? "&lt;"
        : c === ">"
        ? "&gt;"
        : c === '"'
        ? "&quot;"
        : "&#39;"
    );

  const sectionHtml = sections
    .filter((s) => s.rows.length > 0)
    .map((section) => {
      const head = section.headers.map((h) => `<th>${esc(h)}</th>`).join("");
      const body = section.rows
        .map(
          (row) =>
            `<tr>${section
              .render(row)
              .map((v) => `<td>${esc(String(v))}</td>`)
              .join("")}</tr>`
        )
        .join("");
      return `<h2>${esc(section.heading)} <span class="count">(${section.rows.length})</span></h2>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    })
    .join('<div class="page-break"></div>');

  const doc = `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
<title>${esc(meta.title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Cairo","Segoe UI",Tahoma,Arial,sans-serif; color:#1f2937; margin:28px 34px; }
  .doc-head { border-bottom:3px solid #159a73; padding-bottom:14px; margin-bottom:22px; }
  .doc-head h1 { margin:0 0 6px; font-size:22px; color:#0f5c48; }
  .doc-head .sub { color:#6b7280; font-size:12px; }
  .doc-head .date { float:left; color:#6b7280; font-size:12px; }
  h2 { font-size:15px; color:#0f5c48; margin:26px 0 10px; border-bottom:1px solid #d1d5db; padding-bottom:5px; }
  h2 .count { color:#6b7280; font-weight:normal; font-size:12px; }
  table { width:100%; border-collapse:collapse; font-size:11px; }
  th { background:#e8f5ef; color:#0f5c48; text-align:right; padding:7px 8px; border:1px solid #cfd8d4; font-weight:700; }
  td { padding:6px 8px; border:1px solid #e5e7eb; vertical-align:top; }
  tbody tr:nth-child(even) { background:#faf9f7; }
  .page-break { page-break-after:always; }
  @page { size:A4; margin:14mm; }
  @media print {
    body { margin:0; }
    .no-print { display:none; }
  }
</style></head><body>
<div class="doc-head">
  <div class="date">${esc(today)}</div>
  <h1>${esc(meta.title)}</h1>
  ${meta.subtitle ? `<div class="sub">${esc(meta.subtitle)}</div>` : ""}
</div>
${sectionHtml}
<script>window.onload=function(){setTimeout(function(){window.print();},350);};</script>
</body></html>`;

  const win = window.open("", "_blank");
  if (!win) {
    alert("المتصفح منع فتح نافذة الطباعة — اسمح بالنوافذ المنبثقة للموقع ثم أعد المحاولة.");
    return;
  }
  win.document.write(doc);
  win.document.close();
}
