// Testy formatu posta dla Buffera (schemat API odczytany 20.10.2026: needsApproval i assets są wymagane).
// Uruchamia CI: node --test tools/*.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { mutacjaPosta } from "./linkedin.mjs";

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
