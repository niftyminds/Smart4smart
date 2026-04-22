# Smart4smart — Kalkulačka nabíjecích stanic

## Co to je
Marketingová kalkulačka pro Smart4smart, která pomáhá potenciálním zákazníkům odhadnout cenu instalace nabíjecí stanice. Po vyplnění dotazníku uživatel zadá kontakt (email + telefon) a odešle lead. Data se uloží do Google Sheets a odešle se notifikační email.

## Stack
- **Frontend**: React 18, Vite 4, Tailwind CSS 3
- **Backend**: Vercel serverless funkce (`/api`)
- **Google Sheets**: googleapis npm package, Service Account auth
- **Email**: Resend (free plán, odesílá z `onboarding@resend.dev`)
- **Deploy**: GitHub → Vercel (auto-deploy na push do `main`)
- **Analytics**: Google Tag Manager (pushToDataLayer) + Google Consent Mode v2
- **Cookie consent**: custom `CookieConsent.jsx` — localStorage, gtag consent update

## Architektura
Čistě frontendové SPA + jedna serverless funkce:

```
src/ChargingStationCalculator.jsx   # celá aplikace (jeden velký komponent)
src/CookieConsent.jsx               # cookie consent banner + preferences modal
src/main.jsx                        # root render
api/submit-lead.js                  # Vercel serverless funkce
index.html                          # GTM Consent Mode v2 defaults + GTM script tag
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
| `VŠECHNY TYPY` | Hlavní přehled — všechny segmenty, 22 sloupců (A–V) |
| `Rodinný dům` | Pouze rodinny leads, 11 sloupců |
| `Firemní prostředí` | Pouze firemni leads, 11 sloupců |
| `Bytový dům` | Pouze bytovy leads, 11 sloupců |

Přejmenování hlavní záložky: změnit název v Sheets + aktualizovat `GOOGLE_SHEET_NAME` v Vercel env (a `.env` lokálně).

### Sloupce hlavní záložky (A–V)
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
| U | Termín instalace | všechny segmenty — `intentData.purchaseTimeline` |
| V | Zájem leada | všechny segmenty — `intentData.helpType` |

Nevyplněné buňky (jiný segment) → prázdný string `''`.

### Intent data (záměr leada)
Dvě otázky zobrazené na konci dotazníku ve všech třech segmentech, těsně před kontaktním formulářem. Odpovědi se zapisují do sloupců U a V (hlavní záložka) a do posledních dvou sloupců každé segmentové záložky.

**Termín instalace** (`purchaseTimeline`):
| Hodnota | Label v Sheets |
|---------|---------------|
| `do-3-mesicu` | Do 3 měsíců |
| `3-6-mesicu` | Za 3–6 měsíců |
| `rok-a-dele` | Za rok a déle |
| `zjistuji` | Zatím jen zjišťuji |

**Zájem leada** (`helpType`):
| Hodnota | Label v Sheets | Callout text v kontaktním formuláři |
|---------|---------------|-------------------------------------|
| `want_offer` | Nabídka na míru | „Po odeslání vás bude kontaktovat náš specialista a připraví vám nabídku přímo na míru." |
| `want_consultation` | Konzultace | „Po odeslání vás bude kontaktovat náš specialista a domluvíte si termín konzultace." |
| `want_info` | Podklady k prostudování | „Po odeslání vám zašleme podklady a materiály k instalaci." |
| `no_action` | Jen orientační cena | „Po odeslání se zobrazí váš cenový odhad…" (šedý box) |

## Formulář — kontaktní data
- **Email**: standard text input
- **Telefon**: dropdown předvolby (`+420` / `+421`) + input pro číslo (9 číslic)
  - Normalizace: `phoneNumber.replace(/[\s\-]/g, '')` před odesláním
  - Frontend validace: přesně 9 číslic, jinak inline chybová hláška
  - Backend validace: `/^\+\d{10,15}$/`
  - Do Sheets posíláno jako `'${phone}` (apostrofem, aby Sheets nebral `+` jako formuli)
- **Reset formuláře** (`setLeadData`): vždy používat `{ email: '', phoneCountry: '+420', phoneNumber: '', consentData: false, consentContact: false }` — starší field `phone` už neexistuje
- **Reset intent dat** (`setIntentData`): vždy resetovat spolu s `setLeadData` — `{ purchaseTimeline: '', helpType: '' }`

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

## Analytics & GTM

### GTM Consent Mode v2
Consent Mode defaults jsou nastaveny v `index.html` **před** GTM scriptem:
- `security_storage`, `functionality_storage` → vždy `granted`
- ostatní signály → default `denied`, update po rozhodnutí uživatele

**Důležité**: V `index.html` (řádky s GTM scriptem) nahradit `GTM-XXXXXXX` skutečným GTM container ID.

### Cookie consent (`src/CookieConsent.jsx`)
- Uložení do `localStorage` pod klíčem `cookie_consent` (`{ analytics, ads, personalization }`)
- Po rozhodnutí volá `gtag('consent', 'update', {...})` — nebo fallback přes `window.dataLayer.push`
- Kategorie: Nezbytné (vždy ON) / Analytické / Reklamní / Personalizační

### GTM DataLayer funnel
```
view_calculator        ← kalkulačka je viditelná (IntersectionObserver)
select_segment         ← uživatel vybral segment
complete_questionnaire ← kliknul "Pokračovat" po dotazníku
start_contact_form     ← začal psát do email inputu (jednorázový event)
generate_lead          ← odeslal formulář (obsahuje user_data pro Enhanced Conversions)
view_price_result      ← viděl výsledek s cenou
```

### `generate_lead` — payload
```js
pushToDataLayer('generate_lead', {
  segment: segmentLabel,
  estimated_price: finalPrice,
  currency: 'CZK',
  purchase_timeline: intentData.purchaseTimeline,  // hodnoty: do-3-mesicu | 3-6-mesicu | rok-a-dele | zjistuji
  help_type: intentData.helpType,                  // hodnoty: want_offer | want_consultation | want_info | no_action
  user_data: {
    email: leadData.email.toLowerCase().trim(),    // Google Enhanced Conversions
    phone: combinedPhone.replace('+', ''),         // Meta: formát 420123456789
  }
});
```

### GTM — intent qualification (Meta Pixel, GA4, Google Ads)
GTM container: `GTM-PHW2TK4N` (kalkulatornabijecek.cz), workspace Default (ID: 12)

**Proměnné:**
| Název | DLV klíč | ID |
|-------|----------|----|
| `DLV - Purchase Timeline` | `purchase_timeline` | 43 |
| `DLV - Help Type` | `help_type` | 44 |

**Trigger:**
- `CE - Generate Lead - Qualified` (ID: 45) — event `generate_lead`, podmínky AND:
  - `{{DLV - Purchase Timeline}}` matchesRegex `^(do-3-mesicu|3-6-mesicu)$`
  - `{{DLV - Help Type}}` matchesRegex `^(want_offer|want_consultation)$`

**Tagy — co kam posílá:**
| Tag | Event | Trigger | Poznámka |
|-----|-------|---------|----------|
| Meta Pixel - Generate Lead | `Lead` (standard) | CE - Generate Lead | +`purchase_timeline`, `help_type` v custom params |
| Meta Pixel - Qualified Lead | `QualifiedLead` (custom) | CE - Generate Lead - Qualified | pro optimalizaci kampaní |
| GA4 Event - Generate Lead | `generate_lead` | CE - Generate Lead | +`purchase_timeline`, `help_type` |
| GA4 Event - Qualified Lead | `qualified_lead` | CE - Generate Lead - Qualified | samostatná GA4 událost |
| Google Ads Conversion - Generate Lead | konverze | CE - Generate Lead | +`conversionValue`, `currencyCode: CZK` |
| Google Ads Conversion - Generate Qualified Lead | konverze | CE - Generate Lead - Qualified | +`conversionValue`, `currencyCode: CZK` |

**GA4 Custom Dimensions** (nutné zaregistrovat v GA4 Admin → Custom definitions):
- `purchase_timeline` (event-scoped)
- `help_type` (event-scoped)
