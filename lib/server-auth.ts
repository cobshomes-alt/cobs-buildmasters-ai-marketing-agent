import { createClient } from "@supabase/supabase-js";

export async function requireOwner(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new HttpError(503, "Supabase is not configured.");
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) throw new HttpError(401, "Sign in before using this feature.");
  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user)
    throw new HttpError(401, "Your session expired. Sign in again.");
  const profile = await client
    .from("cobs_profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profile.error)
    throw new HttpError(503, "Owner permissions could not be verified.");
  if (profile.data?.role !== "owner")
    throw new HttpError(403, "Only the COBS owner can use this feature.");
  return { client, user: data.user };
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function errorResponse(error: unknown) {
  return Response.json(
    {
      error:
        error instanceof HttpError
          ? error.message
          : "The operation failed. Please try again.",
    },
    { status: error instanceof HttpError ? error.status : 500 },
  );
}
