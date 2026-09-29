// Publikacja posta BiznesDOK na Instagramie przez oficjalne Instagram Graph API (Meta).
// Użycie: node publish.mjs <post.json> [--dry-run]
// Zmienne środowiskowe (nigdy w repo):
//   IG_USER_ID        — opcjonalnie; bez niej ustalany z tokena (jedyne konto albo IG_USERNAME, domyślnie biznesdok.pl),
//   IG_ACCESS_TOKEN   — token użytkownika systemowego Meta Business (nie wygasa),
//   IG_MEDIA_BASE_URL — publiczny adres katalogu z PNG (Instagram pobiera obraz z URL),
//   IG_GRAPH_VERSION  — opcjonalnie, domyślnie v23.0.
// Obsługiwane typy: feed (1 obraz), carousel (2–10 obrazów), story (1 obraz).
import { readFile } from "node:fs/promises";

const GRAPH = `https://graph.facebook.com/${process.env.IG_GRAPH_VERSION ?? "v23.0"}`;

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Brak zmiennej środowiskowej ${name}`);
  return value;
}

async function graph(method, pathName, params) {
  const url = new URL(`${GRAPH}/${pathName}`);
  const body = new URLSearchParams({ ...params, access_token: env("IG_ACCESS_TOKEN") });
  const res =
    method === "GET"
      ? await fetch(`${url}?${body}`)
      : await fetch(url, { method, body });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(`Graph API ${pathName}: ${JSON.stringify(json.error ?? json)}`);
  return json;
}

// Kontener musi mieć status FINISHED, zanim da się go opublikować.
async function waitReady(containerId) {
  for (let i = 0; i < 30; i += 1) {
    const { status_code: status } = await graph("GET", containerId, { fields: "status_code" });
    if (status === "FINISHED") return;
    if (status === "ERROR" || status === "EXPIRED") throw new Error(`Kontener ${containerId}: ${status}`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Kontener ${containerId} nie jest gotowy po 60 s`);
}

// Konto Instagram powiązane ze stroną na Facebooku, do której token ma dostęp.
async function igUserId() {
  if (process.env.IG_USER_ID) return process.env.IG_USER_ID;
  const username = (process.env.IG_USERNAME ?? "biznesdok.pl").toLowerCase();
  const { data = [] } = await graph("GET", "me/accounts", { fields: "instagram_business_account{id,username}" });
  const accounts = data.map((page) => page.instagram_business_account).filter(Boolean);
  // Jedno konto → bierzemy je (zmiana nazwy na Instagramie nie psuje publikacji).
  const account = accounts.length === 1 ? accounts[0] : accounts.find((ig) => ig.username?.toLowerCase() === username);
  if (!account) throw new Error(`Token nie ma dostępu do konta Instagram @${username}`);
  return account.id;
}

export function imageUrls(post) {
  const base = env("IG_MEDIA_BASE_URL").replace(/\/$/, "");
  return post.slides.map((_, i) => `${base}/${post.id}-${String(i + 1).padStart(2, "0")}.png`);
}

export async function publishPost(post, { dryRun = false } = {}) {
  const urls = imageUrls(post);
  if (dryRun) return { dryRun: true, type: post.type, urls, caption: post.caption };
  const user = await igUserId();

  let creationId;
  if (post.type === "story") {
    ({ id: creationId } = await graph("POST", `${user}/media`, { media_type: "STORIES", image_url: urls[0] }));
  } else if (post.type === "carousel") {
    if (urls.length < 2 || urls.length > 10) throw new Error("Karuzela wymaga 2–10 slajdów");
    const children = [];
    for (const image_url of urls) {
      const { id } = await graph("POST", `${user}/media`, { image_url, is_carousel_item: "true" });
      await waitReady(id);
      children.push(id);
    }
    ({ id: creationId } = await graph("POST", `${user}/media`, {
      media_type: "CAROUSEL",
      children: children.join(","),
      caption: post.caption,
    }));
  } else {
    ({ id: creationId } = await graph("POST", `${user}/media`, { image_url: urls[0], caption: post.caption }));
  }
  await waitReady(creationId);
  const { id: mediaId } = await graph("POST", `${user}/media_publish`, { creation_id: creationId });
  const { permalink } = await graph("GET", mediaId, { fields: "permalink" });
  return { mediaId, permalink };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [input, flag] = process.argv.slice(2);
  if (!input) {
    console.error("Użycie: node publish.mjs <post.json> [--dry-run]");
    process.exit(1);
  }
  const post = JSON.parse(await readFile(input, "utf8"));
  console.log(JSON.stringify(await publishPost(post, { dryRun: flag === "--dry-run" }), null, 2));
}
