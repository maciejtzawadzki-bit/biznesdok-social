// Testy formatu posta dla Buffera (schemat API odczytany 20.10.2026: needsApproval i assets są wymagane).
// Uruchamia CI: node --test tools/*.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { mutacjaPosta, wynikZBuffera } from "./linkedin.mjs";

const baza = { tekst: "Pierwsza linia\n\nDruga — z „cudzysłowem” i \"znakiem\" #biznesdok", kanal: "6ad74104778b240e2f67c91c", kiedy: "2026-10-22T07:00:00.000Z" };

test("createPost ma wszystkie pola wymagane przez API Buffera", () => {
  const m = mutacjaPosta(baza);
  for (const pole of ["text:", "channelId:", "schedulingType: automatic", "mode: customScheduled", 'dueAt: "2026-10-22T07:00:00.000Z"', "needsApproval: false", "assets:"]) {
    assert.ok(m.includes(pole), `brak ${pole}`);
  }
});

test("bez grafiki assets to pusta lista, z grafiką — jeden obraz z adresem", () => {
  assert.ok(mutacjaPosta(baza).includes("assets: []"));
  const url = "https://raw.githubusercontent.com/maciejtzawadzki-bit/biznesdok-social/main/media/linkedin/x-01.png";
  assert.ok(mutacjaPosta({ ...baza, obraz: url }).includes(`assets: [{ image: { url: "${url}" } }]`));
});

test("tekst posta jest bezpiecznie zapisany (nowe linie i cudzysłowy nie psują zapytania)", () => {
  const m = mutacjaPosta(baza);
  assert.ok(m.includes(`text: ${JSON.stringify(baza.tekst)}`));
  assert.ok(!m.includes("\n"), "surowy znak nowej linii w zapytaniu");
  const bezTekstu = m.replace(JSON.stringify(baza.tekst), '""');
  assert.equal((bezTekstu.match(/{/g) ?? []).length, (bezTekstu.match(/}/g) ?? []).length, "niezbalansowane nawiasy");
});

test("odpowiedź mówi, czy Buffer przyjął post, a jeśli nie — dlaczego", () => {
  const m = mutacjaPosta(baza);
  assert.ok(m.includes("__typename"));
  assert.ok(m.includes("... on PostActionSuccess { post { id dueAt } }"));
  assert.ok(m.includes("... on MutationError { message }"));
});

const przekazany = { id: "x", status: "handed", buffer: { postId: "p1", dueAt: "2026-10-20T11:08:38.093Z" } };
const poTerminie = (godzin) => Date.parse("2026-10-20T11:08:38.093Z") + godzin * 3_600_000;

test("Buffer wysłał post → published z linkiem do LinkedIna", () => {
  const stan = { status: "sent", sentAt: "2026-10-20T11:09:06.727Z", externalLink: "https://www.linkedin.com/feed/update/urn:li:share:1", error: null };
  assert.deepEqual(wynikZBuffera(przekazany, stan, poTerminie(1)), {
    status: "published",
    publishedAt: "2026-10-20T11:09:06.727Z",
    permalink: "https://www.linkedin.com/feed/update/urn:li:share:1",
  });
});

test("Buffer zgłosił błąd → error z powodem z Buffera", () => {
  const wynik = wynikZBuffera(przekazany, { status: "error", error: { message: "LinkedIn token expired" } }, poTerminie(1));
  assert.equal(wynik.status, "error");
  assert.match(wynik.error, /LinkedIn token expired/);
});

test("przed upływem doby od terminu post czeka — bez zmiany statusu", () => {
  assert.equal(wynikZBuffera(przekazany, { status: "scheduled", error: null }, poTerminie(2)), null);
  assert.equal(wynikZBuffera(przekazany, null, poTerminie(2)), null);
});

test("doba po terminie bez wysłania albo bez posta w Bufferze → error", () => {
  assert.match(wynikZBuffera(przekazany, { status: "scheduled", error: null }, poTerminie(25)).error, /w ciągu doby/);
  assert.match(wynikZBuffera(przekazany, null, poTerminie(25)).error, /nie ma już tego posta/);
});
