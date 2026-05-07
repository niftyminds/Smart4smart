# Smart4smart — Kalkulačka nabíjecích stanic

Marketingová kalkulačka pro Smart4smart. Pomáhá potenciálním zákazníkům odhadnout cenu instalace nabíjecí stanice — po vyplnění dotazníku odešlou kontakt a lead se uloží do Google Sheets s notifikačním emailem.

## Stack

- **Frontend**: React 18, Vite 4, Tailwind CSS 3
- **Backend**: Vercel serverless funkce (`/api`)
- **Google Sheets**: googleapis, Service Account auth
- **Email**: Resend (odesílá z `onboarding@resend.dev`)
- **Analytics**: Google Tag Manager + Google Consent Mode v2
- **Deploy**: GitHub → Vercel (auto-deploy na push do `main`)

## Segmenty

- **Rodinný dům** (`rodinny`)
- **Firemní prostředí** (`firemni`)
- **Bytový dům** (`bytovy`)

Každý segment má vlastní dotazník a cenovou logiku.

## Struktura projektu

```
src/
├── ChargingStationCalculator.jsx   # celá aplikace (jeden velký komponent)
├── CookieConsent.jsx               # cookie consent banner + preferences modal
└── main.jsx                        # root render
api/
└── submit-lead.js                  # Vercel serverless funkce (Sheets + email)
scripts/
├── migrate-sheets.js               # jednorázový migrační script (spuštěn 2025-05)
└── fix-dropdowns.js                # jednorázový opravný script (spuštěn 2025-05)
index.html                          # GTM Consent Mode v2 defaults + GTM script
```

## Lokální vývoj

```bash
npm install
npm run dev       # pouze frontend (bez API funkcí)
vercel dev        # frontend + API funkce (vyžaduje vercel CLI)
```

> `vercel dev` má občas problémy se Vite. Preferuj přímý deploy přes git.

## Deploy

```bash
git push origin main   # Vercel auto-deployuje
vercel logs            # logy při problémech
```

## Environment variables

Nastavit v `.env` (lokálně) i Vercel dashboardu (produkce):

```
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY
GOOGLE_SPREADSHEET_ID
GOOGLE_SHEET_NAME        # aktuálně: VŠECHNY TYPY
GOOGLE_SHEET_URL
RESEND_API_KEY
NOTIFICATION_EMAIL
```

## Google Sheets

Data jdou do jedné záložky **VŠECHNY TYPY** (32 sloupců A–AF). Segmenty jsou odděleny přes Filter Views (Data → Zobrazení filtru), ne samostatné záložky.

Podrobná dokumentace: viz `CLAUDE.md`.

## Analytics

GTM container: `GTM-PHW2TK4N` (kalkulatornabijecek.cz)

Funnel events: `view_calculator` → `select_segment` → `complete_questionnaire` → `start_contact_form` → `generate_lead` → `view_price_result`

Podrobná dokumentace: viz `ANALYTICS-SETUP.md`.

## Kalkulační logika

### Rodinný dům

**Základní cena podle vzdálenosti:**
- Do 5 m: 10 004 Kč
- 5–15 m: 10 685 Kč
- 15+ m: 12 823 Kč

**Smart funkce:**
- Bez výběru: +15 305 Kč (základní stanice)
- Dynamické řízení výkonu: 36 366 Kč (zahrnuje plánování + RFID)
- Nízký tarif: +3 000 Kč / Plánování: +5 000 Kč / RFID: +4 000 Kč

### Firemní prostředí

- **Počet aut**: 1–2 (39 tis.), 3–5 (156 tis.), 6–12 (390 tis.), 12+ (546 tis.)
- **DC stanice**: 40–120 kW (350 tis.), 160–240 kW (980 tis.), 400 kW (1,45 mil.)
- **Rozúčtování nákladů**: +5 000 Kč
- **Stav přípravy**: připraveno (0), jiné úpravy (+20 tis.), kapacita (+50 tis.)

### Bytový dům

- **Počet stanic**: 1 (53 tis.), 2 (87 tis.), 3 (131 tis.), 5 (203 tis.), 10 (737 tis.)
- **Společné rozvody**: +9 823 Kč
