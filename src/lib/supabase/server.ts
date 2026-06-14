import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Public Supabase client for server-side reads of *public* data (bills, history). Uses the
 * anon key and is bound by Row Level Security, so it can only see what RLS exposes — never
 * subscriber tables. Safe to use from server components and route handlers.
 */
export function createPublicClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.",
    );
  }
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
