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
// From the same moment it also cuts a short preview clip — 5 seconds, 1280 wide,
// letterbox removed, no sound, H.264 with the index up front so it starts at
// once — to public/work/previews/<name>.mp4 (listed as PREVIEW_CLIPS). These
// are the brand-matched films on hero 6's 16x9 wall. Replace any one by
// dropping a hand-cut clip of the same name in public/work/previews.
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
const CLIP_DIR = join(ROOT, "public/work/previews");
const CLIP_S = 5;
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

/** The best moment of a film (a URL or a path): its frame written to `shotOut` (if given), and a
 *  short clip cut from there to `clipOut` (if given). False if the film couldn't be read. */
async function bestShot(src, shotOut, clipOut) {
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
    if (!best || size > best.size) best = { f, size, t };
  }
  if (best) {
    // cut away any letterbox bars baked into the film, so the shot fills its frame
    // (only top and bottom: a dark side of the picture is picture, not a bar)
    const probe = await run(["-hide_banner", "-loop", "1", "-t", "0.2", "-i", best.f, "-vf", "cropdetect=limit=24:round=2:reset=0", "-f", "null", "-"]);
    const crop = [...probe.err.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)].pop();
    const bars = crop && Number(crop[2]) > 100 ? `,crop=iw:${crop[2]}:0:${crop[4]}` : "";
    if (shotOut) {
      const cut = join(tmp, "cut.jpg");
      if (bars) await run(["-hide_banner", "-loglevel", "error", "-i", best.f, "-vf", `crop=iw:${crop[2]}:0:${crop[4]}`, "-q:v", "3", "-y", cut]);
      writeFileSync(shotOut, readFileSync(existsSync(cut) ? cut : best.f));
    }
    if (clipOut) {
      // the clip: from the chosen moment, 5 seconds, small and quick to start
      const c = join(tmp, "clip.mp4");
      await run([
        "-hide_banner", "-loglevel", "error", "-ss", String(best.t), "-i", src, "-t", String(CLIP_S), "-an",
        "-vf", `scale=1280:-2${bars},scale=trunc(iw/2)*2:trunc(ih/2)*2`,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "27", "-maxrate", "1800k", "-bufsize", "3600k",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-y", c,
      ]);
      if (existsSync(c) && statSync(c).size > 10_000) writeFileSync(clipOut, readFileSync(c));
    }
  }
  rmSync(tmp, { recursive: true, force: true });
  return !!best;
}

async function main() {
  const test = process.argv.indexOf("--test");
  if (test > -1) {
    const out = join(tmpdir(), "shot-test.jpg");
    const clip = join(tmpdir(), "clip-test.mp4");
    console.log((await bestShot(process.argv[test + 1], out, clip)) ? `shot: ${out}  clip: ${clip}` : "no shot");
    return;
  }

  const src = readFileSync(DATA, "utf8");
  const keys = [...src.matchAll(/R\("[^"]*",\s*"[^"]*",\s*"\w+",\s*"([^"]+)"\)/g)].map((m) => m[1]);
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(CLIP_DIR, { recursive: true });

  const shots = {};
  const clips = {};
  const todo = [];
  for (const key of keys) {
    const name = `${slug(key)}.jpg`;
    const clip = `${slug(key)}.mp4`;
    const hasShot = existsSync(join(OUT_DIR, name));
    const hasClip = existsSync(join(CLIP_DIR, clip));
    if (hasShot) shots[key] = `/work/shots/${name}`;
    if (hasClip) clips[key] = `/work/previews/${clip}`;
    if (!hasShot || !hasClip) todo.push({ key, name, clip, hasShot, hasClip });
  }

  let reached = todo.length === 0;
  let misses = 0;
  const queue = [...todo];
  const worker = async () => {
    while (queue.length) {
      if (!reached && misses >= 3) return; // the bucket isn't reachable from here: stop trying
      const { key, name, clip, hasShot, hasClip } = queue.shift();
      const ok = await bestShot(urlOf(key), hasShot ? null : join(OUT_DIR, name), hasClip ? null : join(CLIP_DIR, clip));
      if (ok) {
        reached = true;
        if (existsSync(join(OUT_DIR, name))) shots[key] = `/work/shots/${name}`;
        if (existsSync(join(CLIP_DIR, clip))) clips[key] = `/work/previews/${clip}`;
        console.log(`shot  ${key}`);
      } else {
        misses++;
        console.log(`none  ${key}`);
      }
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));

  const list = (o) =>
    Object.entries(o)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
      .join("\n");
  writeFileSync(
    MAP,
    `// Written by scripts/make-shots.mjs (before each build), by each film's file in the bucket: a real\n// frame from it, and a 5-second preview clip cut from the same moment. Edit by replacing the files in\n// public/work/shots and public/work/previews, not these lists.\nexport const SHOTS: Record<string, string> = {\n${list(shots)}\n};\n\nexport const PREVIEW_CLIPS: Record<string, string> = {\n${list(clips)}\n};\n`
  );
  console.log(`shots: ${Object.keys(shots).length}, clips: ${Object.keys(clips).length} of ${keys.length} films`);
}

main().catch((e) => {
  console.error("make-shots:", e);
  process.exit(0); // never fail the build over posters
});
