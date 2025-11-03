import { config as loadEnv } from "dotenv";

loadEnv();

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY"];

required.forEach(key => {
  if (!process.env[key]) {
    console.warn(`[config] Missing environment variable ${key}`);
  }
});

export const config = {
  port: Number(process.env.PORT || 8787),
  supabaseUrl: process.env.SUPABASE_URL || "",
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  anonKey: process.env.SUPABASE_ANON_KEY || "",
  corsOrigin: (process.env.CORS_ORIGIN || "").split(",").filter(Boolean)
};
