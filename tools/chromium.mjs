// Wybór Chromium dla renderera (render.mjs, plan.mjs, preview.mjs), bez zależności od playwright-core,
// żeby dało się go testować bez instalacji. Kolejność: CHROMIUM_PATH, przeglądarki Playwrighta
// w znanych katalogach (najnowsza wersja najpierw; nowsze wydania mają chrome-linux64, starsze chrome-linux),
// na końcu ścieżka podana przez playwright-core. Zwraca tylko plik, który istnieje.
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const LAYOUTS = [
  ["chromium-", ["chrome-linux64/chrome", "chrome-linux/chrome"]],
  ["chromium_headless_shell-", ["chrome-headless-shell-linux64/chrome-headless-shell", "chrome-linux/headless_shell"]],
];

export const INSTALL_HINT = "cd tools && npx playwright-core install chromium";

export function browserDirs(env = process.env) {
  return [env.PLAYWRIGHT_BROWSERS_PATH, "/opt/pw-browsers", path.join(homedir(), ".cache", "ms-playwright")].filter(Boolean);
}

export function findChromium({ env = process.env, bases = browserDirs(env), bundled = () => null } = {}) {
  if (env.CHROMIUM_PATH) {
    if (existsSync(env.CHROMIUM_PATH)) return env.CHROMIUM_PATH;
    throw new Error(`CHROMIUM_PATH wskazuje nieistniejący plik: ${env.CHROMIUM_PATH}`);
  }
  const tried = [];
  for (const base of bases.filter((b) => existsSync(b))) {
    for (const [prefix, files] of LAYOUTS) {
      const rev = (d) => Number(d.slice(prefix.length));
      const dirs = readdirSync(base).filter((d) => d.startsWith(prefix) && /^\d+$/.test(d.slice(prefix.length)));
      for (const dir of dirs.sort((a, b) => rev(b) - rev(a))) {
        for (const file of files) {
          const candidate = path.join(base, dir, file);
          if (existsSync(candidate)) return candidate;
          tried.push(candidate);
        }
      }
    }
  }
  let fromPlaywright = null;
  try {
    fromPlaywright = bundled();
  } catch {}
  if (fromPlaywright && existsSync(fromPlaywright)) return fromPlaywright;
  throw new Error(
    `Nie znaleziono Chromium (katalogi: ${bases.join(", ")}${tried.length ? `; sprawdzone: ${tried.join(", ")}` : ""}). ` +
      `Zainstaluj: ${INSTALL_HINT} albo ustaw CHROMIUM_PATH.`,
  );
}
