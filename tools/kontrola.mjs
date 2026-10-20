// Kontrola zgodności postów z zasadami treści (CLAUDE.md, „Zasady treści”; decyzje właściciela 29.09 i 20.10.2026).
// Dwa rodzaje uwag:
//  - twarde (BLOKUJE) — post z taką uwagą nie wyjdzie: publikator (run.mjs, linkedin.mjs) go zatrzyma, a CI pokaże błąd.
//    Powtórka tematu w 21 dni, to samo hasło na grafice, temat spoza oferty, wstrzymany albo poza sezonem, pytanie na start,
//    AI poza serią „AI zawiodło?”, nazwy narzędzi AI, obietnica czasu, zakazane zwroty, ID przy bezpłatnym dokumencie.
//  - miękkie — do poprawy przy planie, widoczne w panelu KMZ (hasztagi, „link w bio”, kwoty, długość opisu LinkedIn).
// Uwagi tygodnia (uwagiTygodnia) pilnują proporcji: płatne dokumenty, bezpłatne, seria AI, Subskrypcja, poradnik.
// Użycie: node tools/kontrola.mjs   (uwagi dla wszystkich nieopublikowanych postów i bieżącego oraz kolejnego tygodnia)
import {
  blokadaTematu,
  dodajDni,
  dzisWarszawa,
  numerTygodnia,
  poniedzialek,
  ODSTEP_POWIAZANYCH_DNI,
  odstepTematu,
  powtorkiHasla,
  powtorkiTematu,
  tematPosta,
  toWideo,
  wczytajOferte,
  wczytajPosty,
  wczytajSerieAI,
  wOkresie,
  ZYWE,
} from "./tematy.mjs";

const ZAKAZANE = [
  [/masz problem/i, "„Masz problem?”"],
  [/mamy rozwiązanie/i, "„Mamy rozwiązanie”"],
  [/czy wiesz,? że/i, "„Czy wiesz, że…?”"],
  [/startujemy/i, "„startujemy”"],
  [/rewolucj/i, "„rewolucjonizujemy”"],
  [/(?<!nie\s)gwarant/i, "gwarancja wyniku"],
  [/w ciągu (minuty|sekund)/i, "obietnica czasu"],
];
// „Każdy dokument” sugeruje, że wszystkie dokumenty mają te same funkcje (POSITIONING §10) — wolno tylko przy Subskrypcji.
const KAZDY_DOKUMENT = /każd\p{L}* dokument/iu;
const CENA = /\d\s?(zł|pln)(?!\p{L})|złotych|rabat|zniżk|promocj|\d\s?%/iu;
const CZAS = /(^|[^\p{L}])w (minutę|minutkę|chwilę|kilka (minut|sekund)|\d+\s?(sekund|minut|godzin))|oszczędz/iu;
// AI wolno tylko w serii „AI zawiodło? Decyduje prawnik” (LINKEDIN_GUIDELINES §9); nazw narzędzi AI — nigdy.
const AI = /(^|[^\p{L}])(AI|sztuczn\p{L}* inteligencj\p{L}*)(?!\p{L})/u;
const NARZEDZIA_AI = /(chat\s?gpt|\bgpt-?\d|gemini|copilot|\bclaude\b|perplexity|\bgrok\b|\bllama\b|deepseek|mistral)/i;
const ID_DOKUMENTU = /identyfikator|zweryfikujesz|weryfikacj|\bID\b/iu;
const HASZTAGI = /#[\p{L}\p{N}_]+/gu;

const bezWyroznien = (t) => String(t ?? "").replace(/\[\[|\]\]/g, "");

// Cały tekst posta: opis i slajdy (nadtytuł, hasło, podtytuł, adres, punkty listy).
function tekstPosta(post) {
  const slajdy = (post.slides ?? []).flatMap((s) => [s.eyebrow, s.text, s.sub, s.note, ...(s.items ?? []).flat()]);
  return bezWyroznien([post.caption, ...slajdy].filter((t) => typeof t === "string").join("\n"));
}

function pierwszeZdanie(tekst) {
  const t = bezWyroznien(tekst).trim();
  const m = t.match(/^[\s\S]*?[.!?…](?=\s|$)/);
  return (m ? m[0] : t).trim();
}

let domyslny = null;
function kontekstDomyslny() {
  if (!domyslny) domyslny = { wszystkie: wczytajPosty(), oferta: wczytajOferte(), seria: wczytajSerieAI() };
  return domyslny;
}

/** Ocena posta: { twarde: [...], miekkie: [...] }. kanal: "instagram" (queue/) albo "linkedin" (linkedin/). */
export function ocenPost(post, kanal = "instagram", dzis = dzisWarszawa(), kontekst = kontekstDomyslny()) {
  const { wszystkie = [], oferta = { mapa: new Map() }, seria = { tematy: [] } } = kontekst;
  const twarde = [];
  const miekkie = [];
  const linkedin = kanal === "linkedin";
  const relacja = !linkedin && post.type === "story";
  const tekst = tekstPosta(post);
  const opis = String(post.caption ?? "").trim();
  const wSerii = post.seria === "ai-zawiodlo";
  const temat = tematPosta(post);
  const pozycja = wSerii ? null : oferta.mapa?.get(temat);

  // Treść — zakazy bezwzględne.
  for (const [wzor, nazwa] of ZAKAZANE) if (wzor.test(tekst)) twarde.push(`zakazany zwrot: ${nazwa}`);
  if (KAZDY_DOKUMENT.test(tekst) && temat !== "subskrypcja") twarde.push("„każdy dokument” — nie wszystkie dokumenty mają te same funkcje (np. ID mają tylko płatne)");
  if (CZAS.test(tekst)) twarde.push("obietnica czasu („w minutę”, „oszczędzasz…”)");
  if (NARZEDZIA_AI.test(tekst)) twarde.push("nazwa narzędzia AI — nie wymieniamy konkretnych narzędzi");
  if (AI.test(tekst) && !wSerii) twarde.push("AI poza serią „AI zawiodło? Decyduje prawnik” — dokumenty przygotowują prawnicy");

  // Pytanie na start: zaczynamy od tego, co robi BiznesDOK (LINKEDIN_GUIDELINES §4). Seria AI ma pytanie w nazwie.
  if (!wSerii) {
    const pierwsze = [post.slides?.[0]?.text, opis.split("\n")[0]].filter(Boolean).map(pierwszeZdanie);
    if (pierwsze.some((z) => z.endsWith("?"))) twarde.push("zaczyna się pytaniem — pierwsze zdanie ma mówić, co robi BiznesDOK");
  }

  // Temat: musi być w ofercie, aktywny i w sezonie; bez powtórki (Instagram 21 dni, LinkedIn 120) i bez tej samej grafiki.
  if (wSerii) {
    const t = (seria.tematy ?? []).find((x) => x.id === post.temat_serii);
    if (!t) twarde.push(`seria AI: brak tematu „${post.temat_serii ?? "—"}” w data/seria-ai.json`);
    else if ((t.sezon ?? []).length && !t.sezon.some((o) => wOkresie(post.date ?? dzis, o))) twarde.push("seria AI: temat poza swoim okresem");
    if (!toWideo(post) && !/prawni/i.test(tekst)) twarde.push("seria AI: brak puenty — decyduje prawnik");
  } else if (!temat) {
    twarde.push("nie wiadomo, o czym jest post: brak linku do biznesdok.pl i pola temat");
  } else if (!pozycja) {
    twarde.push(`temat „${temat}” spoza data/oferta.json — dopisz go do oferty albo popraw link`);
  } else {
    const blokada = blokadaTematu(pozycja, post.date ?? dzis);
    if (blokada) twarde.push(blokada);
    if (!pozycja.platny && pozycja.rodzaj === "dokument" && ID_DOKUMENTU.test(tekst)) twarde.push("bezpłatny dokument nie ma identyfikatora ani weryfikacji");
    if (!pozycja.platny && /trzymasz w BiznesDOK/i.test(tekst)) twarde.push("„…przygotowujesz i trzymasz” tylko przy płatnych (bezpłatny: „…przygotujesz w BiznesDOK — bezpłatnie, bez konta”)");
    if (pozycja.platny && pozycja.rodzaj === "dokument" && /bezpłatn/i.test(tekst)) miekkie.push("dokument płatny, a w treści „bezpłatnie” — sprawdź, czy to o innym, bezpłatnym dokumencie");
  }
  if (!toWideo(post)) {
    const powtorki = powtorkiTematu(post, kanal, wszystkie, oferta, seria);
    if (powtorki.length) {
      const zasada = linkedin ? `LinkedIn: ten sam temat ${odstepTematu(kanal)} dni, tematy powiązane ${ODSTEP_POWIAZANYCH_DNI} dni` : `${odstepTematu(kanal)} dni`;
      const gdzie = powtorki.map((p) => (tematPosta(p) === temat ? p.date : `${tematPosta(p)} ${p.date}`)).join(", ");
      twarde.push(`powtórka tematu (${zasada}): ${gdzie}`);
    }
    const takieSame = powtorkiHasla(post, kanal, wszystkie);
    if (takieSame.length) twarde.push(`to samo hasło na grafice co ${takieSame.map((p) => p.id).join(", ")}`);
  }

  // Forma — do poprawy przy planie.
  if (post.status === "planned" && post.date < dzis) miekkie.push("termin minął, a post nie jest opublikowany");
  if (!post.link) miekkie.push("brak linku do strony BiznesDOK");
  else if (!String(post.link).startsWith("https://biznesdok.pl/")) miekkie.push("link poza biznesdok.pl");
  if (CENA.test(tekst)) miekkie.push("kwota w złotych, procent albo rabat — sprawdź, czy to nie cena (posty bez cen)");
  if (relacja) {
    if (!post.video && !(post.slides ?? []).some((s) => s.note)) miekkie.push("relacja bez adresu na grafice (pole note)");
  } else if (!opis) {
    miekkie.push("brak opisu");
  } else {
    const tagi = opis.match(HASZTAGI) ?? [];
    const [min, max] = linkedin ? [3, 5] : [5, 8];
    if (tagi.length < min || tagi.length > max) miekkie.push(`${tagi.length} hasztagów (zasada: ${min}–${max})`);
    if (!tagi.some((t) => t.toLowerCase() === "#biznesdok")) miekkie.push("brak #biznesdok");
    if (linkedin) {
      if (opis.length < 500 || opis.length > 1200) miekkie.push(`opis ma ${opis.length} znaków (zasada: 500–1200)`);
      if (!/utm_source=linkedin/.test(opis)) miekkie.push("brak linku z utm_source=linkedin");
    } else if (!/link w bio/i.test(opis)) miekkie.push("brak wezwania „Link w bio → …”");
  }
  return { twarde, miekkie };
}

/** Uwagi do pokazania w panelu KMZ: najpierw blokujące, potem pozostałe (najwyżej 10, po 160 znaków). */
export function uwagiPosta(post, kanal = "instagram", dzis = dzisWarszawa(), kontekst = kontekstDomyslny()) {
  const { twarde, miekkie } = ocenPost(post, kanal, dzis, kontekst);
  return [...twarde.map((u) => `BLOKUJE: ${u}`), ...miekkie].slice(0, 10).map((u) => u.slice(0, 160));
}

// Od tego tygodnia obowiązują proporcje z decyzji 20.10 (pierwszy plan według nowych zasad).
export const START_PROPORCJI = "2026-10-26";

/** Uwagi do tygodnia Instagrama (poniedziałek RRRR-MM-DD): proporcje i stałe miejsca rytmu. */
export function uwagiTygodnia(pon, kontekst = kontekstDomyslny()) {
  if (pon < START_PROPORCJI) return [];
  const { wszystkie = [], oferta = { mapa: new Map() } } = kontekst;
  const pt = dodajDni(pon, 4);
  const wTygodniu = (od, doDnia) =>
    wszystkie.filter(({ kanal, post }) => kanal === "instagram" && ZYWE.has(post.status) && !post.usunieto && post.date >= od && post.date <= doDnia);
  const tydzien = wTygodniu(pon, dodajDni(pon, 6)).map((x) => x.post);
  const grafiki = tydzien.filter((p) => !toWideo(p));
  if (!grafiki.length) return ["brak postów w tym tygodniu — plan tygodnia nie zadziałał"];
  const uwagi = [];
  const rodzaj = (p) => (p.seria === "ai-zawiodlo" ? "seria-ai" : oferta.mapa.get(tematPosta(p))?.rodzaj ?? "?");
  const platne = grafiki.filter((p) => {
    const poz = oferta.mapa.get(tematPosta(p));
    return poz?.platny && p.seria !== "ai-zawiodlo";
  });
  const bezplatne = grafiki.filter((p) => {
    const poz = oferta.mapa.get(tematPosta(p));
    return poz && !poz.platny && poz.rodzaj !== "poradnik";
  });
  const udzial = Math.round((100 * platne.length) / grafiki.length);
  if (udzial < 60) uwagi.push(`płatne dokumenty i Subskrypcja to ${udzial}% publikacji (zasada: co najmniej 60%)`);
  if (bezplatne.length > 2) uwagi.push(`${bezplatne.length} publikacje o bezpłatnych narzędziach i dokumentach (zasada: najwyżej 2 w tygodniu)`);
  if (!grafiki.some((p) => rodzaj(p) === "poradnik") && [...oferta.mapa.values()].some((p) => p.rodzaj === "poradnik" && !blokadaTematu(p, pon)))
    uwagi.push("brak karuzeli z poradnika (wtorek)");
  const dwaTygodnie = wTygodniu(dodajDni(pon, -7), pt).map((x) => x.post);
  if (numerTygodnia(pon) % 2 === 0 && !dwaTygodnie.some((p) => p.seria === "ai-zawiodlo")) uwagi.push("brak posta z serii „AI zawiodło? Decyduje prawnik” w ostatnich 2 tygodniach");
  if (!dwaTygodnie.some((p) => tematPosta(p) === "subskrypcja")) uwagi.push("brak Subskrypcji w ostatnich 2 tygodniach");
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
  const kontekst = kontekstDomyslny();
  const dzis = dzisWarszawa();
  let blokujace = 0;
  for (const { kanal, post } of kontekst.wszystkie) {
    if (!["planned"].includes(post.status) || post.usunieto) continue;
    const uwagi = uwagiPosta(post, kanal, dzis, kontekst);
    blokujace += uwagi.filter((u) => u.startsWith("BLOKUJE")).length;
    console.log(`${kanal === "linkedin" ? "linkedin" : "queue"}/${post.id}: ${uwagi.length ? "" : "OK"}`);
    for (const u of uwagi) console.log(`  ${u.startsWith("BLOKUJE") ? "✖" : "⚠"} ${u}`);
  }
  for (const pon of [poniedzialek(dzis), dodajDni(poniedzialek(dzis), 7)]) {
    const uwagi = uwagiTygodnia(pon, kontekst);
    console.log(`Tydzień od ${pon}: ${uwagi.length ? uwagi.join("; ") : "OK"}`);
  }
  if (blokujace) console.log(`Blokujących uwag: ${blokujace} — te posty nie wyjdą, dopóki ich nie poprawisz.`);
}
