import { createServerClient } from "@supabase/ssr";
import { AuthError } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },

        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Cookie updates can fail in Server Components.
          }
        },
      },
    },
  );
  const getUser = client.auth.getUser.bind(client.auth);
  client.auth.getUser = async (...args) => {
    const result = await getUser(...args);
    if (!result.data.user || result.error) return result;
    const active = await client.rpc("current_account_is_active");
    if (active.error || active.data !== true) {
      return {
        data: { user: null },
        error: new AuthError(
          "Account access is unavailable.",
          403,
          "account_unavailable",
        ),
      };
    }
    return result;
  };
  return client;
}

export type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;
