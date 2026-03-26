# Analytics Setup — Smart4smart Kalkulačka

Kompletní průvodce nastavením GTM, GA4, Google Ads a Meta Ads.
Conversion event: **`generate_lead`** (odeslání formuláře s kontaktem).

---

## Přehled kroků

1. Vytvoření účtů a získání ID
2. GTM — základní nastavení kontejneru
3. GTM — proměnné (Variables)
4. GTM — triggery (Triggers)
5. GTM — GA4 tagy
6. GTM — Google Ads tagy + Enhanced Conversions
7. GTM — Meta Pixel tagy + Advanced Matching
8. Consent Mode — kontrola nastavení
9. Testování

---

## 1. Vytvoření účtů a získání ID

### GTM
1. Jdi na [tagmanager.google.com](https://tagmanager.google.com)
2. Vytvoř účet → kontejner (typ: **Web**)
3. Zkopíruj **Container ID** (`GTM-PHW2TK4N`)
4. Vlož ho do `index.html` na **dvou místech** kde je `GTM-PHW2TK4N`

### Google Analytics 4
1. Jdi na [analytics.google.com](https://analytics.google.com)
2. Vytvoř Property → Data Stream → Web → zadej URL webu
3. Zkopíruj **Measurement ID** (`G-JVY9Y7W5X9`)

### Google Ads
1. Jdi na [ads.google.com](https://ads.google.com) → Nástroje → Konverze
2. Nová konverzní akce → **Web**
3. Vyber kategorii: **Lead**
4. Název: `generate_lead`
5. Zkopíruj **Conversion ID** (`AW-XXXXXXXXX`) a **Conversion Label** (`xxxxxxxxxxxx`)

### Meta Pixel
1. Jdi na [business.facebook.com](https://business.facebook.com) → Events Manager
2. Připoj zdroj dat → Web → **Meta Pixel**
3. Název: `Smart4smart`
4. Zkopíruj **Pixel ID** (15místné číslo)

---

## 2. GTM — základní nastavení kontejneru

### Consent Mode v2 — povolit v GTM
1. GTM → Admin → Container Settings
2. Zapni **Enable consent overview** (ikona štítu)
3. Ulož

> Consent Mode defaults jsou již nastaveny v kódu (`index.html`) — GTM je jen musí přečíst.

---

## 3. GTM — proměnné (Variables)

Vytvoř tyto **Data Layer Variables** (Variables → New → Data Layer Variable):

| Název proměnné | Data Layer Variable Name | Version |
|---|---|---|
| `dlv - segment` | `segment` | Version 2 |
| `dlv - estimated_price` | `estimated_price` | Version 2 |
| `dlv - user_email` | `user_data.email` | Version 2 |
| `dlv - user_phone` | `user_data.phone` | Version 2 |

---

## 4. GTM — triggery (Triggers)

Vytvoř **Custom Event** trigger pro každý dataLayer event (Triggers → New → Custom Event):

| Název triggeru | Event Name |
|---|---|
| `CE - view_calculator` | `view_calculator` |
| `CE - select_segment` | `select_segment` |
| `CE - complete_questionnaire` | `complete_questionnaire` |
| `CE - start_contact_form` | `start_contact_form` |
| `CE - generate_lead` | `generate_lead` |
| `CE - view_price_result` | `view_price_result` |

---

## 5. GTM — GA4 tagy

### Tag 1: GA4 Configuration (Google Tag)
- **Tag type**: Google Tag
- **Tag ID**: `G-JVY9Y7W5X9` ← tvé Measurement ID
- **Trigger**: All Pages (Initialization - All Pages)
- **Consent settings**: Required → `analytics_storage`

### Tag 2–7: GA4 Events
Pro každý event vytvoř jeden tag (Tags → New → **Google Analytics: GA4 Event**):

| Tag název | Event Name | Trigger | Extra parametry |
|---|---|---|---|
| `GA4 - view_calculator` | `view_calculator` | CE - view_calculator | — |
| `GA4 - select_segment` | `select_segment` | CE - select_segment | `segment` = `{{dlv - segment}}` |
| `GA4 - complete_questionnaire` | `complete_questionnaire` | CE - complete_questionnaire | `segment`, `estimated_price` |
| `GA4 - start_contact_form` | `start_contact_form` | CE - start_contact_form | `segment` |
| `GA4 - generate_lead` | `generate_lead` | CE - generate_lead | `segment`, `estimated_price` |
| `GA4 - view_price_result` | `view_price_result` | CE - view_price_result | `segment`, `estimated_price` |

Každý GA4 Event tag:
- **Measurement ID**: `G-JVY9Y7W5X9`
- **Consent settings**: Required → `analytics_storage`

### GA4 konverze
V Google Analytics → Admin → Events → najdi `generate_lead` → přepni **Mark as conversion**.

---

## 6. GTM — Google Ads tagy + Enhanced Conversions

### Tag: Google Ads Remarketing
- **Tag type**: Google Ads Remarketing
- **Conversion ID**: `AW-XXXXXXXXX`
- **Trigger**: All Pages
- **Consent**: Required → `ad_storage`, `ad_personalization`

### Tag: Google Ads Conversion — generate_lead
- **Tag type**: Google Ads Conversion Tracking
- **Conversion ID**: `AW-XXXXXXXXX`
- **Conversion Label**: `xxxxxxxxxxxx` ← z Google Ads
- **Conversion Value**: `{{dlv - estimated_price}}`
- **Currency**: `CZK`
- **Trigger**: CE - generate_lead

#### Enhanced Conversions v2 (v tomto tagu)
Scrolluj dolů v tagu na sekci **User-provided data**:

1. Zaškrtni **Include user-provided data from your website**
2. **Method**: Manual — Select user-provided data variables
3. Vyplň:
   - **Email**: `{{dlv - user_email}}`
   - **Phone number**: `{{dlv - user_phone}}`
   - Ostatní pole nech prázdné
4. GTM automaticky provede SHA-256 hashování — nic dalšího není potřeba

**Consent**: Required → `ad_storage`, `ad_user_data`

> Data jsou správně naformátována v kódu: email lowercase+trimmed, telefon bez `+` (formát `420123456789`).

### Tag: Google Tag — User-Provided Data (UPD)

Samostatný tag pro předání user data napříč **všemi** Google produkty (GA4, Ads, Floodlight) — doporučeno Google vedle Enhanced Conversions.

- **Tag type**: Google tag: User-Provided Data
- **Configuration tag**: vyber svůj Google Tag (`G-JVY9Y7W5X9`)
- **Method**: Manual — Data layer variables
- Vyplň:
  - **Email**: `{{dlv - user_email}}`
  - **Phone number**: `{{dlv - user_phone}}`
  - Ostatní pole nech prázdné
- **Trigger**: CE - generate_lead
- **Consent**: Required → `ad_storage`, `ad_user_data`

> Tento tag doplňuje Enhanced Conversions v Ads tagu — nepřepisuje ho. GTM provede hashování automaticky.

---

## 7. GTM — Meta Pixel tagy + Advanced Matching

> Použij **oficiální šablonu** z GTM Template Gallery (ne Custom HTML).

### Přidání šablony
1. Tags → New → hledej šablonu
2. Klikni na ikonu hledání šablon (Community Template Gallery)
3. Vyhledej **"Meta Pixel"** (od Meta)
4. Přidej do workspace

### Tag 1: Meta Pixel — PageView
- **Template**: Meta Pixel
- **Pixel ID**: `XXXXXXXXXXXXXXX` ← tvé Pixel ID
- **Event**: `PageView`
- **Advanced Matching**: viz níže
- **Trigger**: All Pages
- **Consent**: Required → `ad_storage`, `ad_user_data`

### Tag 2: Meta Pixel — Lead (generate_lead)
- **Template**: Meta Pixel
- **Pixel ID**: `XXXXXXXXXXXXXXX`
- **Event**: `Lead` (standardní Meta event)
- **Value**: `{{dlv - estimated_price}}`
- **Currency**: `CZK`
- **Advanced Matching**: viz níže
- **Trigger**: CE - generate_lead
- **Consent**: Required → `ad_storage`, `ad_user_data`

#### Advanced Matching (v obou Meta tazích)
V sekci **Advanced Matching** namapuj:

| Meta pole | GTM proměnná | Poznámka |
|---|---|---|
| `em` (email) | `{{dlv - user_email}}` | Pouze v generate_lead tagu |
| `ph` (phone) | `{{dlv - user_phone}}` | Formát `420123456789` — správně |

> Pro PageView tag nech Advanced Matching prázdné (email/telefon nejsou ještě k dispozici).
> Meta šablona hashuje data automaticky.

---

## 8. Consent Mode — kontrola nastavení

Všechny tagy mají nastavené consent requirements. Přehled:

| Tag | Vyžaduje consent |
|---|---|
| GA4 | `analytics_storage` |
| Google Ads Conversion | `ad_storage`, `ad_user_data` |
| Google Ads Remarketing | `ad_storage`, `ad_personalization` |
| Meta Pixel | `ad_storage`, `ad_user_data` |

Tagy se automaticky nespustí pokud uživatel daný consent neudělil.
Modelování konverzí (Google) bude fungovat i pro uživatele bez souhlasu díky Consent Mode v2.

### Kontrola v GTM
1. Tags → vyber tag → **Advanced Settings** → **Consent Settings**
2. **Require additional consent for tag to fire** → přidej příslušné typy

---

## 9. Testování

### GTM Preview
1. GTM → Preview → zadej URL webu
2. Ověř, že každý dataLayer event spouští správné tagy
3. Zkontroluj hodnoty proměnných (`user_data.email`, `user_data.phone`)

### Google Consent Mode debugger
1. Chrome rozšíření **Google Tag Assistant** nebo **Consent Mode Debugger**
2. Po kliknutí "Přijmout vše" v cookie banneru musí všechny signály přejít na `granted`
3. Po "Odmítnout vše" musí zůstat `denied` (kromě `functionality_storage` a `security_storage`)

### Meta Pixel Helper
1. Chrome rozšíření **Meta Pixel Helper**
2. Na webu ověř, že se `PageView` spustí při načtení
3. Odešli testovací lead → ověř `Lead` event s hodnotou

### Google Ads Tag Diagnostics
1. Google Ads → Nástroje → Konverze → klikni na konverzní akci
2. Záložka **Diagnostics** → ověř, že konverze přichází

### GA4 DebugView
1. GA4 → Configure → DebugView
2. V prohlížeči zapni debug mode: URL parametr `?gtm_debug=x` nebo GA4 rozšíření
3. Ověř všechny eventy v reálném čase

---

## Rychlý checklist

- [ ] GTM Container ID doplněn do `index.html` (2 místa)
- [ ] GA4 Property vytvořena, Measurement ID doplněno do GTM
- [ ] Google Ads konverzní akce `generate_lead` vytvořena
- [ ] Meta Pixel vytvořen v Events Manager
- [ ] GTM Variables (4 dataLayer proměnné) vytvořeny
- [ ] GTM Triggers (6 custom events) vytvořeny
- [ ] GA4 tagy (1 config + 6 events) vytvořeny a otestovány
- [ ] Google Ads Conversion tag s Enhanced Conversions vytvořen
- [ ] Meta Pixel šablona přidána z Template Gallery
- [ ] Meta PageView + Lead tagy vytvořeny s Advanced Matching
- [ ] Consent requirements nastaveny na všech tazích
- [ ] Testování v GTM Preview provedeno
- [ ] Consent Mode debugger ověřen
- [ ] GTM kontejner **publikován** (Submit → Publish)
