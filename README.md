# biznesdok-social

Automat profilu Instagram **@biznesdok.pl** (BiznesDOK): kolejka postów (`queue/`), grafiki w stylu brandbooka (`media/`, `preview/`), dziennik publikacji (`DZIENNIK.md`).

Publikacja przez oficjalne Instagram Graph API. Zasady treści i tryby pracy: [CLAUDE.md](CLAUDE.md). Decyzja właściciela i konfiguracja Meta: repo `biznes-dokumenty-pro`, `docs/social/instagram/README.md`.

Plan publikacji dla panelu KMZ (`plan.json`, miniatury w `media/plan/`) tworzy automat GitHub `.github/workflows/plan.yml` (`tools/plan.mjs`, uwagi z `tools/kontrola.mjs`).

Repo jest publiczne, bo Instagram pobiera grafiki z publicznego adresu. Nie zawiera tokenów ani danych osobowych.

Fonty Instrument Sans i Instrument Serif: SIL Open Font License (`tools/fonts/`).
