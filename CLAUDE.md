# Smart4smart — Kalkulačka nabíjecích stanic

## Co to je
Marketingová kalkulačka pro Smart4smart, která pomáhá potenciálním zákazníkům odhadnout cenu instalace nabíjecí stanice. Po vyplnění dotazníku uživatel zadá kontakt (email + telefon) a odešle lead. Data se uloží do Google Sheets a odešle se notifikační email.

## Stack
- **Frontend**: React 18, Vite 4, Tailwind CSS 3
- **Backend**: Vercel serverless funkce (`/api`)
- **Google Sheets**: googleapis npm package, Service Account auth
- **Email**: Resend (free plán, odesílá z `onboarding@resend.dev`)
- **Deploy**: GitHub → Vercel (auto-deploy na push do `main`)
- **Analytics**: Google Tag Manager (pushToDataLayer)

## Architektura
Čistě frontendové SPA + jedna serverless funkce:

```
src/ChargingStationCalculator.jsx   # celá aplikace (jeden velký komponent)
api/submit-lead.js                  # Vercel serverless funkce
```

Lead flow: formulář → POST `/api/submit-lead` → Google Sheets + Resend email → výsledek

## Segmenty kalkulačky
Tři segmenty, každý má vlastní dotazník a cenovou logiku:
- **rodinny** — Rodinný dům
- **firemni** — Firemní prostředí
- **bytovy** — Bytový dům

## Environment variables
Potřebné jak v `.env` (lokálně), tak v Vercel dashboardu (produkce):

```
GOOGLE_SERVICE_ACCOUNT_EMAIL   # service account email z Google Cloud
GOOGLE_PRIVATE_KEY             # RSA private key (s \n jako oddělovačem řádků)
GOOGLE_SPREADSHEET_ID          # ID sheetu z URL
GOOGLE_SHEET_NAME              # název hlavní záložky (aktuálně: VŠECHNY TYPY)
GOOGLE_SHEET_URL               # celý odkaz na sheet (přijde v notifikačním emailu)
RESEND_API_KEY                 # API klíč z resend.com
NOTIFICATION_EMAIL             # marketing@niftyminds.cz
```

## Google Sheets setup
- Projekt v Google Cloud Console: **smart-4-smart-kalkulacka**
- Service account: `smart4smart-leads@smart-4-smart-kalkulacka.iam.gserviceaccount.com`
- Service account musí mít roli **Editor** na sheetu
- Headers jsou spravované automaticky funkcí `ensureHeaders()` — při každém odeslání se zkontrolují a případně přepíší
- Záložky pro jednotlivé segmenty se vytvoří automaticky při prvním odeslání daného segmentu

### Záložky
| Název záložky | Obsah |
|---------------|-------|
| `VŠECHNY TYPY` | Hlavní přehled — všechny segmenty, 20 sloupců (A–T) |
| `Rodinný dům` | Pouze rodinny leads, 9 sloupců |
| `Firemní prostředí` | Pouze firemni leads, 9 sloupců |
| `Bytový dům` | Pouze bytovy leads, 9 sloupců |

Přejmenování hlavní záložky: změnit název v Sheets + aktualizovat `GOOGLE_SHEET_NAME` v Vercel env (a `.env` lokálně).

### Sloupce hlavní záložky (A–T)
| Sl. | Název | Typ |
|-----|-------|-----|
| A | Datum | datetime string (`YYYY-MM-DD HH:MM:SS`) |
| B | Segment | string |
| C | Email | string |
| D | Telefon | string (apostrofem chráněný před Sheets formulí) |
| E | Odhadovaná cena (Kč) | **number** — formátováno jako `#,##0 "Kč"` přes batchUpdate |
| F | Vzdálenost od rozvaděče | rodinny |
| G | Smart funkce | rodinny |
| H | Místo nabíjení | rodinny |
| I | Parkovací místo | rodinny |
| J | Rychlost nabíjení | rodinny |
| K | Počet vozů | firemni |
| L | Výkon DC stanice (kW) | firemni |
| M | Stav přípravy | firemni |
| N | Rozúčtování nákladů | firemni |
| O | Cílová skupina | firemni |
| P | Počet stanic | bytovy |
| Q | Společný výkon k dispozici | bytovy |
| R | Role žadatele | bytovy |
| S | Místo instalace | bytovy |
| T | Stav schválení | bytovy |

Nevyplněné buňky (jiný segment) → prázdný string `''`.

## Formulář — kontaktní data
- **Email**: standard text input
- **Telefon**: dropdown předvolby (`+420` / `+421`) + input pro číslo (9 číslic)
  - Normalizace: `phoneNumber.replace(/[\s\-]/g, '')` před odesláním
  - Frontend validace: přesně 9 číslic, jinak inline chybová hláška
  - Backend validace: `/^\+\d{10,15}$/`
  - Do Sheets posíláno jako `'${phone}` (apostrofem, aby Sheets nebral `+` jako formuli)
- **Reset formuláře** (`setLeadData`): vždy používat `{ email: '', phoneCountry: '+420', phoneNumber: '', consentData: false, consentContact: false }` — starší field `phone` už neexistuje

## Emaily
- **Notifikační email**: odesílá se při každém novém leadu na `marketing@niftyminds.cz`
- **Error email**: odesílá se pokud selže Sheets nebo Resend, obsahuje zachycená data + doporučené kroky
- Retry logika: 3 pokusy, exponenciální backoff (1s → 2s → 4s) pro Sheets i email

## Lokální vývoj
```bash
npm run dev       # pouze frontend (bez API funkcí)
vercel dev        # frontend + API funkce (vyžaduje vercel CLI a přihlášení)
```

Poznámka: `vercel dev` má občas problémy se správným spuštěním Vite. Preferuj přímý deploy na Vercel přes git.

## Deploy
```bash
git push origin main   # Vercel auto-deployuje
```

Po deployi zkontroluj Vercel logy pokud něco nefunguje: `vercel logs`
