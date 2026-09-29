// Codzienny przebieg publikacji Instagram BiznesDOK.
// Użycie: node tools/run.mjs [--dry-run] [--only <id>] [--now]
//   --dry-run  — renderuje i pokazuje plan, niczego nie wypycha ani nie publikuje,
//   --only     — tylko wskazany post (np. publikacja testowa),
//   --now      — ignoruje godzinę z kolejki (publikuje posty z dzisiejszą datą od razu).
// Kolejność dla każdego posta: render PNG → commit i push media/ → czekanie, aż obraz
// będzie publiczny → publikacja przez Graph API → status "published" + dziennik → push.
import { readFile, writeFile, readdir, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderPost } from "./render.mjs";
import { publishPost, imageUrls } from "./publish.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const QUEUE = path.join(ROOT, "queue");
const MEDIA = path.join(ROOT, "media");
const LOG = path.join(ROOT, "DZIENNIK.md");
const RAW = "https://raw.githubusercontent.com/maciejtzawadzki-bit/biznesdok-social/main/media";
process.env.IG_MEDIA_BASE_URL ??= RAW;

// Posty z poprzednich dni: relacji nie nadrabiamy (są „na dziś”), posty w feedzie do 3 dni wstecz.
const CATCH_UP_DAYS = 3;
const MAX_FEED_PER_RUN = 2;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const ignoreTime = args.includes("--now");
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

function warsawNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function daysBetween(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

function git(...cmd) {
  return execFileSync("git", ["-C", ROOT, ...cmd], { encoding: "utf8" }).trim();
}

function pushWithRetry() {
  for (const wait of [0, 2, 4, 8, 16]) {
    if (wait) execFileSync("sleep", [String(wait)]);
    try {
      git("pull", "--rebase", "-q", "origin", "main");
      git("push", "-q", "origin", "HEAD:main");
      return;
    } catch (error) {
      if (wait === 16) throw error;
    }
  }
}

async function waitPublic(urls) {
  for (let i = 0; i < 30; i += 1) {
    const codes = await Promise.all(urls.map((u) => fetch(u, { method: "HEAD" }).then((r) => r.status, () => 0)));
    if (codes.every((c) => c === 200)) return;
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`Obrazy nie są publiczne po 150 s: ${urls.join(", ")}`);
}

async function loadQueue() {
  const files = (await readdir(QUEUE)).filter((f) => f.endsWith(".json")).sort();
  return Promise.all(files.map(async (f) => ({ file: path.join(QUEUE, f), post: JSON.parse(await readFile(path.join(QUEUE, f), "utf8")) })));
}

function select(queue, now) {
  const due = [];
  const skipped = [];
  for (const item of queue) {
    const { post } = item;
    if (only ? post.id !== only : post.status !== "planned") continue;
    if (only) { due.push(item); continue; }
    const age = daysBetween(post.date, now.date);
    if (age < 0 || (age === 0 && !ignoreTime && post.time > now.time)) continue;
    if (age > 0 && (post.type === "story" || age > CATCH_UP_DAYS)) skipped.push(item);
    else due.push(item);
  }
  const feed = due.filter((i) => i.post.type !== "story").slice(0, MAX_FEED_PER_RUN);
  const stories = due.filter((i) => i.post.type === "story");
  return { due: [...feed, ...stories], skipped };
}

async function save(item) {
  await writeFile(item.file, `${JSON.stringify(item.post, null, 2)}\n`);
}

const now = warsawNow();
const { due, skipped } = select(await loadQueue(), now);
console.log(`Warszawa ${now.date} ${now.time} — do publikacji: ${due.map((i) => i.post.id).join(", ") || "brak"}`);

for (const item of skipped) {
  console.log(`Pominięty (za stary): ${item.post.id}`);
  if (dryRun) continue;
  item.post.status = "skipped";
  await save(item);
  await appendFile(LOG, `- ${now.date} ${now.time} · POMINIĘTY (za stary) · ${item.post.id}\n`);
}

for (const item of due) {
  const { post } = item;
  const files = post.slides.map((_, i) => path.join(MEDIA, `${post.id}-${String(i + 1).padStart(2, "0")}.png`));
  if (!files.every(existsSync)) await renderPost(post, MEDIA);
  if (dryRun) {
    console.log(JSON.stringify(await publishPost(post, { dryRun: true }), null, 2));
    continue;
  }
  git("add", "media", "queue");
  if (git("status", "--porcelain", "media")) git("commit", "-q", "-m", `media: ${post.id}`);
  pushWithRetry();
  await waitPublic(imageUrls(post));
  try {
    const result = await publishPost(post);
    post.status = "published";
    post.publishedAt = new Date().toISOString();
    post.permalink = result.permalink ?? null;
    post.mediaId = result.mediaId;
    await appendFile(LOG, `- ${now.date} ${now.time} · ${post.type} · ${post.id} · ${post.permalink ?? "(relacja)"}\n`);
    console.log(`Opublikowano ${post.id}: ${post.permalink ?? post.mediaId}`);
  } catch (error) {
    post.status = "error";
    post.error = String(error.message ?? error).slice(0, 500);
    await appendFile(LOG, `- ${now.date} ${now.time} · BŁĄD · ${post.id} · ${post.error}\n`);
    console.error(`Błąd ${post.id}: ${post.error}`);
  }
  await save(item);
  git("add", "queue", "DZIENNIK.md");
  git("commit", "-q", "-m", `instagram: ${post.status} ${post.id}`);
  pushWithRetry();
}

if (!dryRun && skipped.length && !due.length) {
  git("add", "queue", "DZIENNIK.md");
  git("commit", "-q", "-m", "instagram: pominięte zaległe posty");
  pushWithRetry();
}
