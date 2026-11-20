import { AutodeskViewerPage } from "@/components/AutodeskViewerPage";

export const dynamic = "force-dynamic";

export default async function AutodeskPage({ searchParams }: { searchParams: Promise<{ fileId?: string; urn?: string; name?: string }> }) {
  const params = await searchParams;
  return <AutodeskViewerPage fileId={params.fileId || ""} docsUrn={params.urn || ""} name={params.name || ""} />;
}
