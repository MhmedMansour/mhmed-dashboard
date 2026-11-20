import { NextRequest, NextResponse } from "next/server";
import { APS_API, getUserApsToken } from "@/lib/aps";

export const dynamic = "force-dynamic";

function safeId(value: string | null): string | null {
  if (!value || value.length > 500 || /[\s<>"'\\]/.test(value)) return null;
  return encodeURIComponent(value);
}

export async function GET(request: NextRequest) {
  const token = await getUserApsToken();
  if (!token) return NextResponse.json({ error: "وصّل حساب Autodesk الأول" }, { status: 401 });
  const q = request.nextUrl.searchParams;
  const kind = q.get("kind") || "hubs";
  const hub = safeId(q.get("hub"));
  const project = safeId(q.get("project"));
  const folder = safeId(q.get("folder"));
  const item = safeId(q.get("item"));
  const version = safeId(q.get("version"));
  let path: string;
  if (kind === "hubs") path = "/project/v1/hubs";
  else if (kind === "projects" && hub) path = `/project/v1/hubs/${hub}/projects`;
  else if (kind === "folders" && hub && project) path = `/project/v1/hubs/${hub}/projects/${project}/topFolders`;
  else if (kind === "contents" && project && folder) path = `/data/v1/projects/${project}/folders/${folder}/contents`;
  else if (kind === "versions" && project && item) path = `/data/v1/projects/${project}/items/${item}/versions`;
  else if (kind === "version" && project && version) path = `/data/v1/projects/${project}/versions/${version}`;
  else return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  try {
    const resp = await fetch(`${APS_API}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.api+json" }, cache: "no-store" });
    if (!resp.ok) {
      console.error("APS browse:", kind, resp.status, (await resp.text()).slice(0, 300));
      return NextResponse.json({ error: resp.status === 403 ? "حسابك لا يملك صلاحية هذا المشروع في Autodesk Docs" : `تعذر تحميل محتوى Autodesk (${resp.status})` }, { status: resp.status });
    }
    const json = await resp.json();
    const data = Array.isArray(json.data) ? json.data : json.data ? [json.data] : [];
    const included = Array.isArray(json.included) ? json.included : [];
    const format = (x: Record<string, any>) => ({
      id: x.id,
      type: x.type,
      name: x.attributes?.displayName || x.attributes?.name || x.attributes?.fileName || x.id,
      extension: x.attributes?.extension?.type || "",
      derivativeUrn: x.relationships?.derivatives?.data?.id || null,
      webView: x.links?.webView?.href || null,
      versionId: x.relationships?.tip?.data?.id || null,
      raw: kind === "version" ? { relationships: x.relationships, attributes: x.attributes } : undefined,
    });
    return NextResponse.json({ data: data.map(format), included: included.map(format), next: json.links?.next?.href || null });
  } catch (error) {
    console.error("APS browse error:", error);
    return NextResponse.json({ error: "تعذر الاتصال بـ Autodesk" }, { status: 502 });
  }
}
