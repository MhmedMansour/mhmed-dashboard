import React from "react";
import { getInitialDashboard } from "@/lib/getInitialDashboard";
import { DashboardClient } from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const initialData = await getInitialDashboard();
  return <DashboardClient initialData={initialData} />;
}
