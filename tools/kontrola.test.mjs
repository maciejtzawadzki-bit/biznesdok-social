// Testy zasad treści (decyzja właściciela 20.10.2026): co blokuje post, okresy, rotacja i łamanie wierszy.
// Uruchamia CI: node --test tools/*.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { ocenPost, uwagiTygodnia } from "./kontrola.mjs";
import { propozycjaTygodnia } from "./propozycja.mjs";
import { blokadaTematu, wOkresie } from "./tematy.mjs";

const pozycje = [
  { temat: "umowa-zlecenia", rodzaj: "dokument", platny: true, priorytet: "A", link: "https://biznesdok.pl/dokument/umowa-zlecenia", fakty: [] },
  { temat: "aneks-do-umowy", rodzaj: "dokument", platny: true, priorytet: "B", link: "https://biznesdok.pl/dokument/aneks-do-umowy", fakty: [] },
  { temat: "rezygnacja-czlonka-zarzadu", rodzaj: "dokument", platny: true, priorytet: "B", link: "https://biznesdok.pl/dokument/rezygnacja-czlonka-zarzadu", fakty: [] },
  { temat: "ksiega-udzialow", rodzaj: "dokument", platny: true, priorytet: "C", link: "https://biznesdok.pl/dokument/ksiega-udzialow", fakty: [] },
  { temat: "lista-wspolnikow", rodzaj: "dokument", platny: true, priorytet: "C", link: "https://biznesdok.pl/dokument/lista-wspolnikow", fakty: [] },
  { temat: "zgoda-na-powolanie-do-zarzadu", rodzaj: "dokument", platny: true, priorytet: "B", link: "https://biznesdok.pl/dokument/zgoda-na-powolanie-do-zarzadu", fakty: [] },
  { temat: "rezerwa-1", rodzaj: "dokument", platny: true, priorytet: "C", link: "https://biznesdok.pl/dokument/rezerwa-1", fakty: [] },
  { temat: "rezerwa-2", rodzaj: "dokument", platny: true, priorytet: "C", link: "https://biznesdok.pl/dokument/rezerwa-2", fakty: [] },
  { temat: "rezerwa-3", rodzaj: "dokument", platny: true, priorytet: "C", link: "https://biznesdok.pl/dokument/rezerwa-3", fakty: [] },
  { temat: "rezerwa-4", rodzaj: "dokument", platny: true, priorytet: "C", link: "https://biznesdok.pl/dokument/rezerwa-4", fakty: [] },
  { temat: "swiadectwo-pracy", rodzaj: "dokument", platny: false, priorytet: "C", link: "https://biznesdok.pl/dokument/swiadectwo-pracy", fakty: [] },
  { temat: "kwota-slownie", rodzaj: "narzedzie", platny: false, priorytet: "C", link: "https://biznesdok.pl/kwota-slownie", fakty: [] },
  { temat: "subskrypcja", rodzaj: "subskrypcja", platny: true, priorytet: "A", link: "https://biznesdok.pl/subskrypcja", fakty: [] },
  { temat: "sprawozdanie", rodzaj: "dokument", platny: true, priorytet: "B", link: "https://biznesdok.pl/dokument/sprawozdanie", sezon: [{ od: "02-01", do: "06-30" }], tylko_w_sezonie: true, fakty: [] },
  { temat: "wstrzymany", rodzaj: "dokument", platny: true, priorytet: "C", link: "https://biznesdok.pl/dokument/wstrzymany", wstrzymany: "uwagi prawnika", fakty: [] },
  { temat: "poradniki/faktura", rodzaj: "poradnik", platny: false, priorytet: "A", link: "https://biznesdok.pl/poradniki/faktura", fakty: [] },
];
const oferta = { pozycje, mapa: new Map(pozycje.map((p) => [p.temat, p])) };
const seria = { tematy: [{ id: "krs", fakt: "…", rozwiazanie: "umowa-zlecenia", instagram: null, linkedin: null }] };

const post = (zmiany = {}) => ({
  id: "2026-11-02-test",
  date: "2026-11-02",
  time: "08:30",
  type: "feed",
  status: "planned",
  link: "https://biznesdok.pl/dokument/umowa-zlecenia",
  slides: [{ layout: "headline", text: "Umowy zlecenia [[przygotowujesz i trzymasz]] w BiznesDOK." }],
  caption: "Dokumenty przygotowane przez prawników. Dopasowane technologią.\n\nLink w bio → Dokumenty.\n\n#a #b #c #d #biznesdok",
  ...zmiany,
});
const kontekst = (inne = []) => ({ wszystkie: inne.map((p) => ({ kanal: "instagram", post: p })), oferta, seria });
const twarde = (p, k = kontekst(), kanal = "instagram") => ocenPost(p, kanal, "2026-11-01", k).twarde;

test("poprawny post płatnego dokumentu przechodzi", () => {
  assert.deepEqual(twarde(post()), []);
});

test("pytanie na start blokuje, poza serią AI", () => {
  assert.ok(twarde(post({ slides: [{ text: "Faktura nieopłacona? [[Odsetki]] policzysz." }] })).some((u) => u.includes("pytaniem")));
  assert.ok(twarde(post({ caption: "Kontrahent nie zapłacił faktury? Wezwanie przygotujesz w BiznesDOK." })).some((u) => u.includes("pytaniem")));
});

test("AI tylko w serii, nazwy narzędzi nigdy", () => {
  assert.ok(twarde(post({ caption: "Treść od prawnika, nie od AI." })).some((u) => u.includes("AI poza serią")));
  const wSerii = post({ seria: "ai-zawiodlo", temat_serii: "krs", slides: [{ text: "AI zawiodło? [[Decyduje prawnik.]]" }], caption: "AI często podaje starą kwotę. Decyduje prawnik." });
  assert.deepEqual(twarde(wSerii), []);
  assert.ok(twarde({ ...wSerii, caption: "ChatGPT podaje starą kwotę. Decyduje prawnik." }).some((u) => u.includes("nazwa narzędzia AI")));
});

test("powtórka tematu w 21 dni blokuje w tym samym kanale, po 21 dniach nie", () => {
  const wczesniej = post({ id: "a", date: "2026-10-20", status: "published", slides: [{ text: "Inne hasło." }] });
  assert.ok(twarde(post(), kontekst([wczesniej])).some((u) => u.includes("powtórka tematu")));
  assert.deepEqual(twarde(post(), kontekst([{ ...wczesniej, date: "2026-10-11" }])), []);
  assert.deepEqual(twarde(post(), { ...kontekst(), wszystkie: [{ kanal: "linkedin", post: wczesniej }] }), []);
});

test("to samo hasło na grafice blokuje", () => {
  const stary = post({ id: "b", date: "2026-06-01", status: "published", link: "https://biznesdok.pl/dokument/aneks-do-umowy" });
  assert.ok(twarde(post(), kontekst([stary])).some((u) => u.includes("to samo hasło")));
});

test("bezpłatny dokument bez ID i bez „trzymasz”; „każdy dokument” tylko przy Subskrypcji", () => {
  const wolny = post({ link: "https://biznesdok.pl/dokument/swiadectwo-pracy", slides: [{ text: "Świadectwo pracy z identyfikatorem do weryfikacji." }] });
  assert.ok(twarde(wolny).some((u) => u.includes("identyfikatora")));
  assert.ok(twarde(post({ link: "https://biznesdok.pl/dokument/swiadectwo-pracy" })).some((u) => u.includes("trzymasz")));
  assert.ok(twarde(post({ slides: [{ text: "Każdy dokument zweryfikujesz." }] })).some((u) => u.includes("każdy dokument")));
  assert.deepEqual(twarde(post({ link: "https://biznesdok.pl/subskrypcja", slides: [{ text: "Każdy dokument w PDF i Word." }] })), []);
});

test("zrozumiałość: skrót bez rozwinięcia i stary wzór „trzymasz” to miękkie uwagi; „na swoim koncie” blokuje przy bezpłatnym", () => {
  const miekkie = (p) => ocenPost(p, "instagram", "2026-11-01", kontekst()).miekkie;
  assert.ok(miekkie(post({ slides: [{ text: "Protokół NZW [[przygotujesz w BiznesDOK.]]" }] })).some((u) => u.includes("NZW")));
  assert.ok(!miekkie(post({ slides: [{ text: "Protokół z nadzwyczajnego zgromadzenia wspólników (NZW) [[przygotujesz w BiznesDOK.]]" }] })).some((u) => u.includes("skrót")));
  assert.ok(!miekkie(post({ caption: "#krs #biznesdok", slides: [{ text: "Uchwałę [[przygotujesz w BiznesDOK.]]" }] })).some((u) => u.includes("skrót")));
  assert.ok(miekkie(post()).some((u) => u.includes("stary wzór")));
  assert.ok(twarde(post({ link: "https://biznesdok.pl/dokument/swiadectwo-pracy", slides: [{ text: "Świadectwo pracy zapiszesz na swoim koncie." }] })).some((u) => u.includes("na swoim koncie")));
  assert.deepEqual(twarde(post({ slides: [{ text: "Umowę zlecenia [[przygotujesz w BiznesDOK.]]", sub: "Po zakupie zostaje na Twoim koncie." }] })), []);
});

test("temat spoza oferty, wstrzymany i poza sezonem blokuje", () => {
  assert.ok(twarde(post({ link: "https://biznesdok.pl/dokument/nie-ma" })).some((u) => u.includes("spoza data/oferta.json")));
  assert.ok(twarde(post({ link: "https://biznesdok.pl/dokument/wstrzymany" })).some((u) => u.includes("wstrzymany")));
  assert.ok(twarde(post({ link: "https://biznesdok.pl/dokument/sprawozdanie" })).some((u) => u.includes("poza okresem")));
  assert.deepEqual(twarde(post({ date: "2026-05-04", link: "https://biznesdok.pl/dokument/sprawozdanie" })), []);
});

test("zastrzeżenie „nie gwarantuje” nie blokuje, obietnica gwarancji tak", () => {
  assert.deepEqual(twarde(post({ caption: "Dokument nie gwarantuje zapłaty.\n\nLink w bio → Dokumenty.\n\n#a #b #c #d #biznesdok" })), []);
  assert.ok(twarde(post({ caption: "Gwarantujemy wygraną." })).some((u) => u.includes("gwarancja")));
});

test("okresy przechodzą przez Nowy Rok; ważność tematu", () => {
  assert.ok(wOkresie("2026-12-15", { od: "12-01", do: "01-31" }));
  assert.ok(wOkresie("2027-01-10", { od: "12-01", do: "01-31" }));
  assert.ok(!wOkresie("2026-11-10", { od: "12-01", do: "01-31" }));
  assert.match(blokadaTematu({ wazne_do: "2026-12-31" }, "2027-01-05"), /nieaktualny/);
});

test("propozycja tygodnia: bez powtórek w tygodniu, seria AI w tygodniu parzystym, płatne w większości", () => {
  const p = propozycjaTygodnia("2026-11-09", kontekst()); // tydzień 46 — parzysty
  const ig = p.miejsca.filter((m) => m.kanal === "instagram" && m.temat);
  assert.equal(new Set(ig.map((m) => m.temat)).size, ig.length);
  assert.ok(p.miejsca.some((m) => m.kanal === "instagram" && m.temat === "seria-ai/krs"));
  const platne = ig.filter((m) => oferta.mapa.get(m.temat)?.platny).length;
  assert.ok(platne / ig.length >= 0.6, `płatne ${platne}/${ig.length}`);
});

test("uwagi tygodnia: pusty tydzień po starcie nowych zasad to błąd planu", () => {
  assert.deepEqual(uwagiTygodnia("2026-10-19", kontekst()), []);
  assert.match(uwagiTygodnia("2026-11-09", kontekst())[0], /plan tygodnia nie zadziałał/);
});
