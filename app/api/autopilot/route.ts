import {
  getAutopilotDashboard,
  saveAutopilotPreferences,
} from "@/lib/autopilot/dashboard";
import {
  AutopilotRunError,
  runAutopilot,
} from "@/lib/autopilot/service";
import {
  InvalidAutopilotPreferencesError,
  parsePreferences,
} from "@/lib/autopilot/preferences";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  return error || !user ? null : { supabase, user };
}

export async function GET() {
  try {
    const auth = await authenticatedClient();
    if (!auth) {
      return Response.json({ error: "You must be logged in." }, { status: 401 });
    }

    return Response.json(
      await getAutopilotDashboard(auth.supabase, auth.user.id),
    );
  } catch (error) {
    console.error("AUTOPILOT GET ERROR:", error);
    return Response.json({ error: "Failed to load Autopilot." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await authenticatedClient();
    if (!auth) {
      return Response.json({ error: "You must be logged in." }, { status: 401 });
    }

    const input: unknown = await request.json().catch(() => null);
    if (!isRecord(input)) {
      return Response.json(
        { error: "A valid JSON body is required." },
        { status: 400 },
      );
    }

    const preferences = parsePreferences(input);
    return Response.json({
      preferences: await saveAutopilotPreferences(
        auth.supabase,
        auth.user.id,
        preferences,
      ),
    });
  } catch (error) {
    if (error instanceof InvalidAutopilotPreferencesError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("AUTOPILOT PATCH ERROR:", error);
    return Response.json(
      { error: "Failed to save Autopilot settings." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticatedClient();
    if (!auth) {
      return Response.json({ error: "You must be logged in." }, { status: 401 });
    }

    const input: unknown = await request.json().catch(() => ({}));
    const retryId = isRecord(input) && typeof input.retryId === "string"
      ? input.retryId.trim()
      : "";
    if (retryId.length > 200) {
      return Response.json({ error: "Invalid retry ID." }, { status: 400 });
    }

    return Response.json({
      success: true,
      ...await runAutopilot(auth.supabase, auth.user.id, retryId),
    });
  } catch (error) {
    if (error instanceof AutopilotRunError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("AUTOPILOT RUN ERROR:", error);
    return Response.json(
      { error: "Autopilot run failed safely. No application was marked submitted." },
      { status: 500 },
    );
  }
}
