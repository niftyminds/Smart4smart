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
GOOGLE_SHEET_NAME              # název záložky (Smart4smart Leads)
GOOGLE_SHEET_URL               # celý odkaz na sheet (přijde v notifikačním emailu)
RESEND_API_KEY                 # API klíč z resend.com
NOTIFICATION_EMAIL             # marketing@niftyminds.cz
```

## Google Sheets setup
- Projekt v Google Cloud Console: **smart-4-smart-kalkulacka**
- Service account: `smart4smart-leads@smart-4-smart-kalkulacka.iam.gserviceaccount.com`
- Sheet headers (řádek 1): `Datum | Segment | Email | Telefon | Odhadovaná cena (Kč) | Detaily dotazníku`
- Service account musí mít roli **Editor** na sheetu

## Emaily
- **Notifikační email**: odesílá se při každém novém leadu na `marketing@niftyminds.cz`
- **Error email**: odesílá se pokud selže Sheets nebo Resend, obsahuje zachycená data + doporučené kroky

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
