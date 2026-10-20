// Publikacja LinkedIn (strona firmowa BiznesDOK) przez Buffer — decyzja właściciela 20.10.2026: „linkedin trzeba wreszcie
// zautomatyzować”. Buffer jest oficjalnym partnerem LinkedIn; właściciel raz łączy stronę BiznesDOK z Bufferem i tworzy
// klucz API, który leży wyłącznie w zmiennej środowiska automatu (BUFFER_API_KEY). Bez klucza nic się nie dzieje.
// Post z linkedin/ ze statusem `planned` i dzisiejszą datą (albo zaległy do 3 dni): kontrola treści → grafika
// (render.mjs, media/linkedin/) → push, żeby obraz był publiczny → Buffer z terminem posta (09:00) → status `handed`.
// Użycie: node tools/linkedin.mjs [--now] [--dry-run] [--kanaly] [--schemat] [--test-buffer]
//   --kanaly  — lista kanałów konta Buffer (do ustawienia BUFFER_CHANNEL_ID przy pierwszym uruchomieniu),
//   --schemat — opis wejścia createPost z API Buffera (tylko odczyt; do sprawdzenia formatu posta),
//   --test-buffer — próba formatu bez publikacji: post w Bufferze z terminem za 45 dni, od razu usuwany,
//   --now     — publikuje posty z dzisiejszą datą od razu (bez czekania do ich godziny),
//   --dry-run — niczego nie wypycha i nie wysyła; pokazuje, co by zrobił.
import { appendFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { ocenPost } from "./kontrola.mjs";
import { dniMiedzy, dzisWarszawa, ROOT, wczytajOferte, wczytajPosty, wczytajSerieAI } from "./tematy.mjs";

const KATALOG = path.join(ROOT, "linkedin");
const MEDIA = path.join(ROOT, "media", "linkedin");
const LOG = path.join(ROOT, "DZIENNIK.md");
const RAW = "https://raw.githubusercontent.com/maciejtzawadzki-bit/biznesdok-social/main/media/linkedin";
const ZALEGLE_DNI = 3;

// W chmurze ruch wychodzący bywa możliwy tylko przez proxy środowiska, a wbudowany fetch Node'a proxy pomija
// (Node włącza je tylko przy starcie: NODE_USE_ENV_PROXY=1). Jak w tools/reakcje.mjs: przy ustawionym proxy pytamy
// Buffer z osobnego procesu Node z tą zmienną. Klucz przechodzi w zmiennych środowiska, nigdy w argumentach ani na wyjściu.
const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;

async function zapytanieBuffer(tresc) {
  try {
    const odp = await fetch("https://api.buffer.com", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.BUFFER_API_KEY}` },
      body: JSON.stringify({ query: tresc }),
      signal: AbortSignal.timeout(30_000),
    });
    return { status: odp.status, dane: await odp.json().catch(() => ({})) };
  } catch (error) {
    return { blad: [error.message, error.cause?.code].filter(Boolean).join(", ").slice(0, 200) };
  }
}
const ZAPYTANIE = `
${zapytanieBuffer.toString()}
let tresc = "";
for await (const c of process.stdin) tresc += c;
process.stdout.write(JSON.stringify(await zapytanieBuffer(tresc)));
`;

async function graphql(zapytanie) {
  let wynik;
  if (PROXY && !process.env.NODE_USE_ENV_PROXY) {
    const w = spawnSync(process.execPath, ["--disable-warning=UNDICI-EHPA", "--input-type=module", "-e", ZAPYTANIE], {
      input: zapytanie,
      encoding: "utf8",
      timeout: 45_000,
      env: { ...process.env, NODE_USE_ENV_PROXY: "1" },
    });
    try {
      wynik = JSON.parse(w.stdout);
    } catch {
      wynik = { blad: w.error?.message ?? `zapytanie przez proxy nie powiodło się (kod ${w.status})` };
    }
  } else {
    wynik = await zapytanieBuffer(zapytanie);
  }
  if (wynik.blad) throw new Error(`Buffer: ${wynik.blad}`);
  const { status, dane = {} } = wynik;
  if (status < 200 || status > 299 || dane.errors?.length) {
    throw new Error(`Buffer ${status}: ${(dane.errors ?? []).map((e) => e.message).join("; ") || "błąd odpowiedzi"}`);
  }
  return dane.data;
}

export async function kanaly() {
  const { account } = await graphql("query { account { organizations { id name } } }");
  const wynik = [];
  for (const org of account?.organizations ?? []) {
    const { channels } = await graphql(`query { channels(input: { organizationId: ${JSON.stringify(org.id)} }) { id name service } }`);
    for (const c of channels ?? []) wynik.push({ organizacja: org.name, ...c });
  }
  return wynik;
}

const PROSTE = new Set(["String", "Boolean", "Int", "Float", "ID", "DateTime"]);
const nazwaTypu = (t) => {
  while (t && !t.name) t = t.ofType;
  return t?.name ?? null;
};
const opisTypu = (t) => (!t ? "?" : t.kind === "NON_NULL" ? `${opisTypu(t.ofType)}!` : t.kind === "LIST" ? `[${opisTypu(t.ofType)}]` : t.name);
const TYP = "type { name kind ofType { name kind ofType { name kind ofType { name kind ofType { name kind } } } } }";

/** Opis wejścia mutacji createPost ze schematu API (introspekcja) — tylko odczyt, nic nie tworzy. */
export async function schemat() {
  const { __schema } = await graphql(`{ __schema { mutationType { fields { name args { name ${TYP} } } } } }`);
  const mutacje = __schema?.mutationType?.fields ?? [];
  const wynik = { mutacje: mutacje.filter((f) => /post/i.test(f.name)).map((f) => `${f.name}(${f.args.map((a) => `${a.name}: ${opisTypu(a.type)}`).join(", ")})`) };
  const kolejka = [nazwaTypu(mutacje.find((f) => f.name === "createPost")?.args?.[0]?.type)];
  while (kolejka.length && Object.keys(wynik).length < 16) {
    const nazwa = kolejka.shift();
    if (!nazwa || wynik[nazwa] || PROSTE.has(nazwa)) continue;
    const { __type } = await graphql(`{ __type(name: ${JSON.stringify(nazwa)}) { kind inputFields { name ${TYP} } enumValues { name } } }`);
    wynik[nazwa] = __type?.enumValues?.length ? __type.enumValues.map((e) => e.name) : (__type?.inputFields ?? []).map((f) => `${f.name}: ${opisTypu(f.type)}`);
    for (const f of __type?.inputFields ?? []) kolejka.push(nazwaTypu(f.type));
  }
  return wynik;
}

/**
 * Mutacja createPost według schematu API Buffera (odczyt 20.10.2026): needsApproval i assets są wymagane
 * (assets: pusta lista, gdy posta nie ma grafiki). __typename mówi, jaką odpowiedź dał Buffer, gdy posta nie przyjął.
 */
export function mutacjaPosta({ tekst, kanal, kiedy, obraz = null }) {
  const zasoby = obraz ? `[{ image: { url: ${JSON.stringify(obraz)} } }]` : "[]";
  return `mutation { createPost(input: { text: ${JSON.stringify(tekst)}, channelId: ${JSON.stringify(kanal)}, schedulingType: automatic, mode: customScheduled, dueAt: ${JSON.stringify(kiedy)}, needsApproval: false, assets: ${zasoby} }) { __typename ... on PostActionSuccess { post { id dueAt } } ... on MutationError { message } } }`;
}

/**
 * Próba przed pierwszym postem, bez publikacji: ta sama mutacja co przy publikacji (z grafiką), ale z terminem
 * za 45 dni, a zaraz potem usunięcie posta z Buffera — nic nie trafia na LinkedIn. Najpierw sprawdza w schemacie
 * API, że post da się usunąć po samym id; inaczej niczego nie tworzy.
 */
export async function testBuffera() {
  const { __schema } = await graphql(`{ __schema { mutationType { fields { name args { name ${TYP} } } } } }`);
  const usun = (__schema?.mutationType?.fields ?? []).find((f) => f.name === "deletePost");
  const wejscie = nazwaTypu(usun?.args?.[0]?.type);
  const pola = wejscie ? ((await graphql(`{ __type(name: ${JSON.stringify(wejscie)}) { inputFields { name ${TYP} } } }`)).__type?.inputFields ?? []) : [];
  const wymagane = pola.filter((f) => f.type?.kind === "NON_NULL").map((f) => f.name);
  if (wymagane.join(",") !== "id") {
    return { utworzony: false, powod: `nie wiem, jak usunąć post przez API (${wejscie ?? "brak deletePost"}: ${wymagane.join(", ") || "brak pól"}) — nic nie utworzono` };
  }
  const kanal = await idKanalu();
  const kiedy = new Date(Date.now() + 45 * 86_400_000).toISOString();
  const obraz = `${RAW}/2026-10-13-poradnik-sprawozdanie-finansowe-01.png`;
  const odp = (await graphql(mutacjaPosta({ tekst: "TEST automatu BiznesDOK — do usunięcia, nie publikować", kanal, kiedy, obraz }))).createPost ?? {};
  if (!odp.post) return { utworzony: false, odpowiedz: odp.__typename ?? null, powod: odp.message ?? "Buffer nie przyjął posta" };
  const wynik = { utworzony: true, odpowiedz: odp.__typename, id: odp.post.id, dueAt: odp.post.dueAt };
  // Kształt odpowiedzi deletePost nie jest znany z góry: najpierw z komunikatem błędu, potem samo __typename, potem bez pól.
  const proby = [" { __typename ... on MutationError { message } }", " { __typename }", ""];
  const bledy = [];
  for (const wybor of proby) {
    try {
      const d = (await graphql(`mutation { deletePost(input: { id: ${JSON.stringify(odp.post.id)} })${wybor} }`)).deletePost;
      wynik.usuniety = d?.message ? `NIE: ${d.message}` : `tak (${typeof d === "object" ? d?.__typename : d})`;
      break;
    } catch (blad) {
      bledy.push(blad.message);
    }
  }
  if (!wynik.usuniety) wynik.usuniety = `NIE — usuń ręcznie w Bufferze (${bledy.join(" | ")})`;
  return wynik;
}

async function idKanalu() {
  if (process.env.BUFFER_CHANNEL_ID) return process.env.BUFFER_CHANNEL_ID;
  const linkedin = (await kanaly()).filter((c) => /linkedin/i.test(c.service ?? ""));
  const strona = linkedin.find((c) => /biznes[\s-]?dok/i.test(c.name ?? "")) ?? (linkedin.length === 1 ? linkedin[0] : null);
  if (!strona) throw new Error(`Nie wiem, który kanał LinkedIn wybrać (${linkedin.map((c) => c.name).join(", ") || "brak kanałów LinkedIn"}). Ustaw BUFFER_CHANNEL_ID.`);
  return strona.id;
}

function warszawaNaUTC(data, godzina) {
  // Godzina warszawska → ISO UTC (z przesunięciem strefy w tym dniu, także przy zmianie czasu).
  const proba = new Date(`${data}T${godzina}:00Z`);
  const wWarszawie = new Date(proba.toLocaleString("en-US", { timeZone: "Europe/Warsaw" }));
  const wUTC = new Date(proba.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(proba.getTime() - (wWarszawie - wUTC)).toISOString();
}

function git(...cmd) {
  return execFileSync("git", ["-C", ROOT, ...cmd], { encoding: "utf8" }).trim();
}

function wypchnij(wiadomosc) {
  git("add", "linkedin", "media/linkedin", "DZIENNIK.md");
  if (!git("status", "--porcelain", "linkedin", "media/linkedin", "DZIENNIK.md")) return;
  git("commit", "-q", "-m", wiadomosc);
  for (const czekaj of [0, 2, 4, 8, 16]) {
    if (czekaj) execFileSync("sleep", [String(czekaj)]);
    try {
      git("pull", "--rebase", "-q", "origin", "main");
      git("push", "-q", "origin", "HEAD:main");
      return;
    } catch (blad) {
      if (czekaj === 16) throw blad;
    }
  }
}

async function czekajNaObraz(url) {
  for (let i = 0; i < 30; i += 1) {
    if ((await fetch(url, { method: "HEAD" }).then((r) => r.status, () => 0)) === 200) return;
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`Grafika nie jest publiczna po 150 s: ${url}`);
}

/** Publikacja zaległych i dzisiejszych postów LinkedIn. Zwraca listę wyników (do podsumowania trybu 1). */
export async function publikujLinkedIn({ dryRun = false, teraz = false, czekajace = new Set() } = {}) {
  if (!process.env.BUFFER_API_KEY) {
    console.log("LinkedIn: brak BUFFER_API_KEY — posty LinkedIn czekają w kolejce (właściciel łączy Buffer raz, instrukcja w CLAUDE.md).");
    return [];
  }
  const dzis = dzisWarszawa();
  const godzina = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
  const kontekst = { wszystkie: wczytajPosty(), oferta: wczytajOferte(), seria: wczytajSerieAI() };
  const opublikowane = { ...kontekst, wszystkie: kontekst.wszystkie.filter((x) => ["published", "handed"].includes(x.post.status)) };
  const doWyslania = kontekst.wszystkie.filter(({ kanal, post }) => {
    if (kanal !== "linkedin" || post.status !== "planned" || post.usunieto || czekajace.has(`linkedin-${post.id}`)) return false;
    const wiek = dniMiedzy(post.date, dzis);
    // Posty z dzisiejszą datą idą do Buffera rano z terminem na ich godzinę; zaległe — od razu.
    return wiek >= 0 && wiek <= ZALEGLE_DNI;
  });
  if (!doWyslania.length) {
    console.log("LinkedIn: na dziś nic do publikacji.");
    return [];
  }
  const kanal = dryRun ? "(dry-run)" : await idKanalu();
  const wyniki = [];
  for (const { post } of doWyslania) {
    const plik = path.join(KATALOG, `${post.id}.json`);
    // Kontrola przy publikacji: tylko względem tego, co już wyszło (późniejsze powtórki to problem późniejszych postów).
    const { twarde } = ocenPost(post, "linkedin", dzis, opublikowane);
    if (twarde.length) {
      console.error(`LinkedIn: zatrzymany przez kontrolę treści ${post.id}: ${twarde.join("; ")}`);
      wyniki.push({ id: post.id, stan: "zatrzymany", powod: twarde.join("; ") });
      if (!dryRun) {
        post.status = "error";
        post.error = `kontrola treści: ${twarde.join("; ")}`.slice(0, 500);
        await writeFile(plik, `${JSON.stringify(post, null, 2)}\n`);
        await appendFile(LOG, `- ${dzis} ${godzina} · LinkedIn ZATRZYMANY (kontrola treści) · ${post.id} · ${twarde.join("; ")}\n`);
        wypchnij(`linkedin: zatrzymany ${post.id}`);
      }
      continue;
    }
    const obraz = path.join(MEDIA, `${post.id}-01.png`);
    if ((post.slides ?? []).length && !existsSync(obraz)) {
      const { renderPost } = await import("./render.mjs");
      await renderPost({ ...post, type: "feed" }, MEDIA);
    }
    const termin = dniMiedzy(post.date, dzis) === 0 && !teraz ? warszawaNaUTC(post.date, post.time ?? "09:00") : null;
    const kiedy = termin && Date.parse(termin) > Date.now() + 120_000 ? termin : new Date(Date.now() + 180_000).toISOString();
    if (dryRun) {
      console.log(`LinkedIn (dry-run): ${post.id} → Buffer na ${kiedy}, grafika ${existsSync(obraz) ? "gotowa" : "brak"}`);
      wyniki.push({ id: post.id, stan: "dry-run", kiedy });
      continue;
    }
    try {
      wypchnij(`media: linkedin ${post.id}`);
      const url = `${RAW}/${post.id}-01.png`;
      if (existsSync(obraz)) await czekajNaObraz(url);
      const dane = await graphql(mutacjaPosta({ tekst: post.caption, kanal, kiedy, obraz: existsSync(obraz) ? url : null }));
      const odp = dane.createPost ?? {};
      if (!odp.post) throw new Error(`Buffer nie przyjął posta${odp.__typename ? ` (${odp.__typename})` : ""}: ${odp.message ?? "bez komunikatu"}`);
      post.status = "handed";
      post.handedAt = new Date().toISOString();
      post.buffer = { postId: odp.post.id, dueAt: odp.post.dueAt ?? kiedy };
      await appendFile(LOG, `- ${dzis} ${godzina} · LinkedIn · ${post.id} · przekazany do Buffer na ${post.buffer.dueAt}\n`);
      wyniki.push({ id: post.id, stan: "przekazany", kiedy: post.buffer.dueAt });
      console.log(`LinkedIn: ${post.id} przekazany do Buffer na ${post.buffer.dueAt}`);
    } catch (blad) {
      post.status = "error";
      post.error = String(blad.message ?? blad).slice(0, 500);
      await appendFile(LOG, `- ${dzis} ${godzina} · LinkedIn BŁĄD · ${post.id} · ${post.error}\n`);
      wyniki.push({ id: post.id, stan: "błąd", powod: post.error });
      console.error(`LinkedIn: błąd ${post.id}: ${post.error}`);
    }
    await writeFile(plik, `${JSON.stringify(post, null, 2)}\n`);
    wypchnij(`linkedin: ${post.status} ${post.id}`);
  }
  return wyniki;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  if (args.includes("--test-buffer")) {
    if (!process.env.BUFFER_API_KEY) throw new Error("Brak BUFFER_API_KEY");
    console.log(JSON.stringify(await testBuffera(), null, 2));
  } else if (args.includes("--schemat")) {
    if (!process.env.BUFFER_API_KEY) throw new Error("Brak BUFFER_API_KEY");
    console.log(JSON.stringify(await schemat(), null, 2));
  } else if (args.includes("--kanaly")) {
    if (!process.env.BUFFER_API_KEY) throw new Error("Brak BUFFER_API_KEY");
    console.log(JSON.stringify(await kanaly(), null, 2));
  } else {
    await publikujLinkedIn({ dryRun: args.includes("--dry-run"), teraz: args.includes("--now") });
  }
}
