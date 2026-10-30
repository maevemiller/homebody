// Downloads Homebody's typefaces from Fontshare (https://www.fontshare.com) into app/fonts/.
// They're under the ITF Free Font License (public/fonts/LICENSES.md), which allows self-hosting
// but not redistributing the files, so they aren't in the repository. Run once: `npm run fonts`.
//
// It fetches each family's official zip and extracts the variable woff2 files unmodified.
// Needs the `unzip` command (built into macOS and most Linux distributions).
import { mkdir, writeFile, access, mkdtemp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const OUT = path.resolve("app/fonts");
// Fontshare slug -> file prefix inside the zip
const FAMILIES = {
  gambetta: "Gambetta",
  switzer: "Switzer",
  boska: "Boska",
  "general-sans": "GeneralSans",
};

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

await mkdir(OUT, { recursive: true });
const tmp = await mkdtemp(path.join(tmpdir(), "homebody-fonts-"));
try {
  for (const [slug, prefix] of Object.entries(FAMILIES)) {
    const wanted = [`${prefix}-Variable.woff2`, `${prefix}-VariableItalic.woff2`];
    const missing = [];
    for (const f of wanted) if (!(await exists(path.join(OUT, f)))) missing.push(f);
    if (missing.length === 0) { console.log(`font ${prefix} (already here)`); continue; }

    const res = await fetch(`https://api.fontshare.com/v2/fonts/download/${slug}`);
    if (!res.ok) throw new Error(`Fontshare download failed for "${slug}" (${res.status})`);
    const zip = path.join(tmp, `${slug}.zip`);
    await writeFile(zip, Buffer.from(await res.arrayBuffer()));

    const root = `${prefix}_Complete/Fonts/WEB/fonts`;
    execFileSync("unzip", ["-o", "-j", "-q", zip, ...missing.map((f) => `${root}/${f}`), "-d", OUT]);
    console.log(`font ${prefix}`);
  }
} finally {
  await rm(tmp, { recursive: true, force: true });
}
