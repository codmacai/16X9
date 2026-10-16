// ===========================================================================
// MAKE SHOTS — a real frame from every film, in place of the placeholder posters.
//
// Runs before `next build` (npm "prebuild"), where the build can reach the
// video bucket. For each film in app/work/_shared/data.ts that names its file
// in the bucket, it looks at a few moments of the film (12s to 75s in), lets
// ffmpeg's thumbnail filter pick the most representative frame around each
// (it skips black and fades), and keeps the sharpest of them — the one whose
// edges show the most detail. They're written to public/work/shots/<name>.jpg and
// listed in app/work/_shared/shots.ts, which the site reads.
//
// A film whose shot is already in public/work/shots is skipped, so shots can
// be committed (or swapped by hand for a chosen frame). If the bucket can't be
// reached, nothing is changed and the build carries on with what's there.
//
//   node scripts/make-shots.mjs            all films
//   node scripts/make-shots.mjs --test URL one film, to try the picking
// ===========================================================================
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const ROOT = new URL("..", import.meta.url).pathname;
const DATA = join(ROOT, "app/work/_shared/data.ts");
const OUT_DIR = join(ROOT, "public/work/shots");
const MAP = join(ROOT, "app/work/_shared/shots.ts");
const BASE = (process.env.NEXT_PUBLIC_VIDEO_BASE || "https://pub-9d250cf0ea9541beac9a7e373fe10d2f.r2.dev").replace(/\/+$/, "");
const MOMENTS = [12, 20, 30, 42, 58, 75]; // seconds in
const TIMEOUT_MS = 45_000;
const PARALLEL = 4;

const ffmpegPath = (() => {
  try {
    return createRequire(import.meta.url)("ffmpeg-static") || "ffmpeg";
  } catch {
    return "ffmpeg";
  }
})();

const slug = (key) => key.toLowerCase().replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const urlOf = (key) => `${BASE}/${key.split("/").map(encodeURIComponent).join("/")}`;

function run(args) {
  return new Promise((resolve) => {
    const p = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    const t = setTimeout(() => p.kill("SIGKILL"), TIMEOUT_MS);
    p.on("close", (code) => {
      clearTimeout(t);
      resolve({ ok: code === 0, err });
    });
    p.on("error", (e) => {
      clearTimeout(t);
      resolve({ ok: false, err: String(e) });
    });
  });
}

/** The best frame of a film (a URL or a path) written to `out`; false if none could be read. */
async function bestShot(src, out) {
  const tmp = join(tmpdir(), `shot-${process.pid}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmp, { recursive: true });
  let best = null;
  for (const t of MOMENTS) {
    const f = join(tmp, `${t}.jpg`);
    const r = await run(["-hide_banner", "-loglevel", "error", "-ss", String(t), "-i", src, "-vf", "thumbnail=48,scale=1280:-2", "-frames:v", "1", "-q:v", "3", "-y", f]);
    if (!r.ok || !existsSync(f)) {
      if (t === MOMENTS[0] && /Connection|resolve|refused|403|404|Server returned|Input\/output/i.test(r.err)) break; // can't reach it at all
      continue;
    }
    // its sharpness: the frame's edges, drawn small; a crisp, well-lit frame has more of them
    // (and compresses to more bytes) than a soft, dark or flat one
    const e = join(tmp, `${t}-edge.jpg`);
    await run(["-hide_banner", "-loglevel", "error", "-i", f, "-vf", "scale=320:-2,edgedetect=low=0.08:high=0.25", "-q:v", "4", "-y", e]);
    const size = existsSync(e) ? statSync(e).size : 0;
    if (!best || size > best.size) best = { f, size };
  }
  if (best) {
    // cut away any letterbox bars baked into the film, so the shot fills its frame
    // (only top and bottom: a dark side of the picture is picture, not a bar)
    const probe = await run(["-hide_banner", "-loop", "1", "-t", "0.2", "-i", best.f, "-vf", "cropdetect=limit=24:round=2:reset=0", "-f", "null", "-"]);
    const crop = [...probe.err.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)].pop();
    const cut = join(tmp, "cut.jpg");
    if (crop && Number(crop[2]) > 100) {
      await run(["-hide_banner", "-loglevel", "error", "-i", best.f, "-vf", `crop=iw:${crop[2]}:0:${crop[4]}`, "-q:v", "3", "-y", cut]);
    }
    writeFileSync(out, readFileSync(existsSync(cut) ? cut : best.f));
  }
  rmSync(tmp, { recursive: true, force: true });
  return !!best;
}

async function main() {
  const test = process.argv.indexOf("--test");
  if (test > -1) {
    const out = join(tmpdir(), "shot-test.jpg");
    console.log((await bestShot(process.argv[test + 1], out)) ? `shot: ${out}` : "no shot");
    return;
  }

  const src = readFileSync(DATA, "utf8");
  const keys = [...src.matchAll(/R\("[^"]*",\s*"[^"]*",\s*"\w+",\s*"([^"]+)"\)/g)].map((m) => m[1]);
  mkdirSync(OUT_DIR, { recursive: true });

  const shots = {};
  const todo = [];
  for (const key of keys) {
    const name = `${slug(key)}.jpg`;
    if (existsSync(join(OUT_DIR, name))) shots[key] = `/work/shots/${name}`;
    else todo.push({ key, name });
  }

  let reached = todo.length === 0;
  let misses = 0;
  const queue = [...todo];
  const worker = async () => {
    while (queue.length) {
      if (!reached && misses >= 3) return; // the bucket isn't reachable from here: stop trying
      const { key, name } = queue.shift();
      const ok = await bestShot(urlOf(key), join(OUT_DIR, name));
      if (ok) {
        reached = true;
        shots[key] = `/work/shots/${name}`;
        console.log(`shot  ${key}`);
      } else {
        misses++;
        console.log(`none  ${key}`);
      }
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));

  const body = Object.entries(shots)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join("\n");
  writeFileSync(
    MAP,
    `// Written by scripts/make-shots.mjs (before each build): a real frame from each film, by its file\n// in the bucket. Edit by replacing the image in public/work/shots, not this list.\nexport const SHOTS: Record<string, string> = {\n${body}\n};\n`
  );
  console.log(`shots: ${Object.keys(shots).length} of ${keys.length} films`);
}

main().catch((e) => {
  console.error("make-shots:", e);
  process.exit(0); // never fail the build over posters
});
