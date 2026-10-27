// Testy wyboru Chromium (tools/chromium.mjs) na katalogach tymczasowych, bez przeglądarki. Uruchomienie: node --test tools/chromium.test.mjs
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { findChromium } from "./chromium.mjs";

const browsers = (files) => {
  const base = mkdtempSync(path.join(tmpdir(), "pw-browsers-"));
  for (const file of files) {
    mkdirSync(path.dirname(path.join(base, file)), { recursive: true });
    writeFileSync(path.join(base, file), "");
  }
  return base;
};
const find = (base, opts = {}) => findChromium({ env: {}, bases: [base], ...opts });

test("nowy układ chrome-linux64 (obraz chmury od 26.10: chromium-1243)", () => {
  const base = browsers(["chromium-1243/chrome-linux64/chrome", "chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell"]);
  assert.equal(find(base), path.join(base, "chromium-1243/chrome-linux64/chrome"));
});

test("stary układ chrome-linux nadal działa", () => {
  const base = browsers(["chromium-1194/chrome-linux/chrome"]);
  assert.equal(find(base), path.join(base, "chromium-1194/chrome-linux/chrome"));
});

test("najnowsza wersja najpierw; pusty katalog wersji pomijany", () => {
  const base = browsers(["chromium-1194/chrome-linux/chrome", "chromium-1243/chrome-linux64/chrome"]);
  mkdirSync(path.join(base, "chromium-1300"));
  assert.equal(find(base), path.join(base, "chromium-1243/chrome-linux64/chrome"));
});

test("sam headless shell wystarcza", () => {
  const base = browsers(["chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell"]);
  assert.equal(find(base), path.join(base, "chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell"));
});

test("CHROMIUM_PATH ma pierwszeństwo, a zła ścieżka to jasny błąd", () => {
  const base = browsers(["chromium-1243/chrome-linux64/chrome", "own/chrome"]);
  assert.equal(find(base, { env: { CHROMIUM_PATH: path.join(base, "own/chrome") } }), path.join(base, "own/chrome"));
  assert.throws(() => find(base, { env: { CHROMIUM_PATH: path.join(base, "brak") } }), /CHROMIUM_PATH wskazuje nieistniejący plik/);
});

test("bez przeglądarki w katalogach: ścieżka z playwright-core, a bez niej błąd z poleceniem instalacji", () => {
  const base = browsers(["inne/plik", "chromium-1243/chrome-win/chrome.exe"]);
  assert.equal(find(base, { bundled: () => path.join(base, "inne/plik") }), path.join(base, "inne/plik"));
  assert.throws(() => find(base, { bundled: () => path.join(base, "brak") }), /npx playwright-core install chromium/);
  assert.throws(() => find(base, { bundled: () => { throw new Error("x"); } }), /Nie znaleziono Chromium/);
});
