// Kontrola zgodności posta z zasadami treści (CLAUDE.md, „Zasady treści” i tryb 3): krótkie uwagi do pokazania
// w panelu KMZ przy postach z planu (tools/plan.mjs). Tylko ostrzega, niczego nie blokuje i nie zmienia.
// Sprawdza to, co da się zmierzyć; trafności tematu, faktów prawnych i jakości grafiki nie oceni.
// Użycie: node tools/kontrola.mjs   (uwagi dla wszystkich nieopublikowanych postów z queue/ i linkedin/, bez sieci)

const ZAKAZANE = [
  [/masz problem/i, "„Masz problem?”"],
  [/mamy rozwiązanie/i, "„Mamy rozwiązanie”"],
  [/czy wiesz,? że/i, "„Czy wiesz, że…?”"],
  [/startujemy/i, "„startujemy”"],
  [/rewolucj/i, "„rewolucjonizujemy”"],
];
// Zasada 4: bez cen, kodów rabatowych i niezweryfikowanych czasów.
const CENA = /\d\s?(zł|pln)(?!\p{L})|złotych|rabat|zniżk|promocj|\d\s?%/iu;
const CZAS = /(^|[^\p{L}])w (minutę|minutkę|chwilę|kilka (minut|sekund)|\d+\s?(sekund|minut|godzin))|oszczędz/iu;
// Zasada 6: AI nie jest autorem dokumentów.
const AI = /(^|[^\p{L}])(AI|ChatGPT|GPT|sztuczn\p{L}* inteligencj\p{L}*)(?!\p{L})/u;
const HASZTAGI = /#[\p{L}\p{N}_]+/gu;

const dzisWarszawa = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(new Date());

// Cały tekst posta: opis i slajdy (nadtytuł, hasło, podtytuł, adres, punkty listy).
function tekstPosta(post) {
  const slajdy = (post.slides ?? []).flatMap((s) => [s.eyebrow, s.text, s.sub, s.note, ...(s.items ?? []).flat()]);
  return [post.caption, ...slajdy].filter((t) => typeof t === "string").join("\n").replace(/\[\[|\]\]/g, "");
}

/** Uwagi do posta; kanal: "instagram" (queue/) albo "linkedin" (linkedin/). */
export function uwagiPosta(post, kanal = "instagram", dzis = dzisWarszawa()) {
  const uwagi = [];
  const opis = String(post.caption ?? "").trim();
  const tekst = tekstPosta(post);
  const linkedin = kanal === "linkedin";
  const relacja = !linkedin && post.type === "story";

  if (post.status === "planned" && post.date < dzis) uwagi.push("termin minął, a post nie jest opublikowany");
  if (!post.link) uwagi.push("brak linku do strony BiznesDOK");
  else if (!String(post.link).startsWith("https://biznesdok.pl/")) uwagi.push("link poza biznesdok.pl");

  for (const [wzor, nazwa] of ZAKAZANE) if (wzor.test(tekst)) uwagi.push(`zakazany zwrot ${nazwa}`);
  if (CENA.test(tekst)) uwagi.push("kwota w złotych, procent albo rabat — sprawdź, czy to nie cena (posty bez cen)");
  if (CZAS.test(tekst)) uwagi.push("obietnica czasu („w minutę”, „oszczędzasz…”)");
  if (AI.test(tekst)) uwagi.push("wzmianka o AI — dokumenty przygotowują prawnicy");

  if (relacja) {
    if (!post.video && !(post.slides ?? []).some((s) => s.note)) uwagi.push("relacja bez adresu na grafice (pole note)");
    return uwagi;
  }
  if (!opis) {
    uwagi.push("brak opisu");
    return uwagi;
  }
  const tagi = opis.match(HASZTAGI) ?? [];
  const [min, max] = linkedin ? [3, 5] : [5, 8];
  if (tagi.length < min || tagi.length > max) uwagi.push(`${tagi.length} hasztagów (zasada: ${min}–${max})`);
  if (!tagi.some((t) => t.toLowerCase() === "#biznesdok")) uwagi.push("brak #biznesdok");
  if (linkedin) {
    if (opis.length < 500 || opis.length > 1200) uwagi.push(`opis ma ${opis.length} znaków (zasada: 500–1200)`);
    if (!/utm_source=linkedin/.test(opis)) uwagi.push("brak linku z utm_source=linkedin");
  } else if (!/link w bio/i.test(opis)) uwagi.push("brak wezwania „Link w bio → …”");
  return uwagi;
}

const stronyPamiec = new Map();

/** Zasada 2 (tylko to, co LIVE): link z posta prowadzi do istniejącej strony. Błąd sieci nie daje uwagi. */
export async function uwagaStrony(link) {
  if (!link || !String(link).startsWith("https://biznesdok.pl/")) return [];
  if (!stronyPamiec.has(link)) {
    stronyPamiec.set(
      link,
      await fetch(link, { redirect: "follow", signal: AbortSignal.timeout(15_000) }).then((r) => r.status, () => 0),
    );
  }
  const status = stronyPamiec.get(link);
  return status === 404 || status === 410 ? [`strona z linku nie istnieje (HTTP ${status})`] : [];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { readdir, readFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  for (const [katalog, kanal] of [["queue", "instagram"], ["linkedin", "linkedin"]]) {
    for (const f of (await readdir(path.join(root, katalog))).filter((x) => x.endsWith(".json")).sort()) {
      const post = JSON.parse(await readFile(path.join(root, katalog, f), "utf8"));
      if (["published", "skipped", "handed"].includes(post.status)) continue;
      const uwagi = uwagiPosta(post, kanal);
      console.log(`${katalog}/${f}: ${uwagi.length ? uwagi.join("; ") : "OK"}`);
    }
  }
}
