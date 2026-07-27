const missing = (name: string): never => {
  throw new Error(`Missing required environment variable: ${name}`);
};

export function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || missing("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabasePublishableKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    missing(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)",
    )
  );
}

export function getSupabaseServiceRoleKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    missing("SUPABASE_SERVICE_ROLE_KEY")
  );
}

export function getAnthropicApiKey() {
  return process.env.ANTHROPIC_API_KEY || missing("ANTHROPIC_API_KEY");
}

export function getOpenAiApiKey() {
  return process.env.OPENAI_API_KEY || missing("OPENAI_API_KEY");
}

export function getAppBaseUrl() {
  return process.env.APP_BASE_URL || "http://localhost:3000";
}
