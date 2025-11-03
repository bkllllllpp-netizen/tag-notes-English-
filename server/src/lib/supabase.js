import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";

if (!config.supabaseUrl || !config.serviceKey) {
  console.warn(
    "[supabase] Supabase credentials are missing. API routes will fail until SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
  );
}

export const supabaseAdmin = createClient(config.supabaseUrl, config.serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { headers: { "X-Client-Info": "tag-notebook-api/0.1.0" } }
});
