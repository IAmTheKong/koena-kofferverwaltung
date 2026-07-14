import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let browserClient: ReturnType<typeof createClient<Database>> | undefined;

export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase ist nicht konfiguriert. Bitte .env.local ergänzen.");
  }

  browserClient ??= createClient<Database>(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  });

  return browserClient;
}
