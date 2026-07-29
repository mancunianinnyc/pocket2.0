// Print a magic-link callback URL for testing.
//   node scripts/dev-login-link.mjs [port | https://base.url]
// Uses admin generateLink + the /auth/callback?token_hash=... branch (Gmail
// prefetch makes emailed PKCE links unreliable; this path is deterministic).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const target = process.argv[2] || "3200";
const base = target.startsWith("http") ? target.replace(/\/$/, "") : `http://localhost:${target}`;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(path.join(repoRoot, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const { data, error } = await supabase.auth.admin.generateLink({
  type: "magiclink",
  email: "rossgarlick@gmail.com",
});
if (error) throw error;
console.log(`${base}/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink&next=/library`);
