import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { calendarTokens, seal, unseal, type CalendarProvider } from "./provider";
export function calendarAdmin() {
  if (!process.env.SUPABASE_SECRET_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) throw Error("Calendar storage is not configured.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function calendarAccess(admin: SupabaseClient, connection: { id: string; user_id: string; provider: CalendarProvider }) {
  const { data, error } = await admin.from("calendar_tokens").select("access_token,refresh_token,expires_at").eq("connection_id", connection.id).single();
  if (error || !data) throw Error("Reconnect your calendar to restore access.");
  const purpose = `${connection.user_id}:${connection.id}`;
  if (Date.parse(data.expires_at) > Date.now()+60000) return unseal(data.access_token, `${purpose}:access`);
  const token = await calendarTokens(connection.provider, { grant_type: "refresh_token", refresh_token: unseal(data.refresh_token, `${purpose}:refresh`) });
  const value = { access_token: seal(token.access_token, `${purpose}:access`), refresh_token: token.refresh_token ? seal(token.refresh_token, `${purpose}:refresh`) : data.refresh_token, expires_at: new Date(Date.now()+token.expires_in*1000).toISOString() };
  const { error: saveError } = await admin.from("calendar_tokens").update(value).eq("connection_id",connection.id);
  if (saveError) throw Error("Calendar access could not be saved. Try again before syncing.");
  return token.access_token;
}
