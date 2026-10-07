import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import "server-only";
import { meterNames, type Meter } from "./policy";
export class AllowanceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export async function consumeAllowance(
  user: string,
  meter: Exclude<Meter, "active_postings">,
  admin?: SupabaseClient,
) {
  if (!admin) {
    if (
      !process.env.SUPABASE_SECRET_KEY ||
      !process.env.NEXT_PUBLIC_SUPABASE_URL
    )
      throw new AllowanceError("Usage limits are not available yet.", 503);
    admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          fetch: (input, init) =>
            fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }),
        },
      },
    );
  }
  const result = await admin.rpc("consume_launch_allowance", {
    p_user: user,
    p_meter: meter,
  });
  if (result.error?.message === "account_suspended")
    throw new AllowanceError("Account access is suspended.", 403);
  if (result.error?.message === "allowance_exhausted")
    throw new AllowanceError(
      `${meterNames[meter]} daily limit reached. Your free allowance resets at 00:00 UTC.`,
      429,
    );
  if (result.error?.message === "company_not_verified")
    throw new AllowanceError(
      "Company verification is required for candidate searches.",
      409,
    );
  if (result.error || !Number.isInteger(result.data) || result.data < 1)
    throw new AllowanceError(
      "Unable to verify your free allowance. Try again later.",
      503,
    );
}
