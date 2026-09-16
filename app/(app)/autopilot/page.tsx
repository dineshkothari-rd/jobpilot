import { AutopilotPageClient } from "./autopilot-page-client";
import { getAutopilotDashboard } from "@/lib/autopilot/dashboard";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Career Autopilot | JobPilot",
  description: "Configure and monitor safe, grounded career automation.",
};

export default async function AutopilotPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const dashboard = await getAutopilotDashboard(supabase, user.id);
  return <AutopilotPageClient initialData={dashboard} />;
}
