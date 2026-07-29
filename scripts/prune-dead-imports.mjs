// Delete failed source rows whose canonical URLs are permanently dead
// (killed shorteners, purged archives) — one-off cleanup after the 2026-07-28
// repost import. Only touches rows with status='failed' and no chunks.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(path.join(repoRoot, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const DEAD = [
  "https://nanransohoff.com/A-mental-model-for-combating-climate-change-846be1769d374fa1b5b855407c93da66",
  "https://goo.gl/fb/WwfZJQ",
  "http://goo.gl/dDq6fe",
  "https://qz.com/967215",
  "http://qz.com/86949",
  "http://ow.ly/GJDcP",
  "http://ow.ly/wqJ0h",
  "http://www.goodcountry.org/overall",
  "http://f-st.co/WK8o1uT",
  "https://tmblr.co/Z1T9by24r5n8h",
  "http://tcrn.ch/1IjfdTZ",
  "http://pops.ci/1a40adm",
  "http://trib.al/wHmoMTt",
  "http://techre.vu/10omUn3",
  "http://bit.ly/Z3B3ji",
  "http://buswk.co/TLIvP1",
  "http://bit.ly/JyH15E",
  "http://virg.co/lcfu",
];

const { data: usersPage } = await supabase.auth.admin.listUsers();
const user = usersPage.users.find((u) => u.email === "rossgarlick@gmail.com");

const { data: rows, error } = await supabase
  .from("sources")
  .select("id, canonical_url, status")
  .eq("user_id", user.id)
  .eq("status", "failed")
  .in("canonical_url", DEAD);
if (error) throw error;
console.log(`matched failed rows: ${rows.length}`);
for (const r of rows) {
  const { error: delErr } = await supabase.from("sources").delete().eq("id", r.id).eq("user_id", user.id);
  console.log(`${delErr ? "FAILED to delete" : "deleted"}: ${r.canonical_url}`);
}
