import { google } from 'googleapis';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// --- Value → Czech label lookup maps ---
const LABELS = {
  chargingLocation:  { dum: 'Dům', chata: 'Chata', garaz: 'Garáž jinde' },
  parkingSpace:      { pozemek: 'Pozemek', garaz: 'Garáž', neresim: 'Neřeším' },
  chargingSpeed:     { '11kw': '11 kW', '22kw': '22 kW', nevim: 'Nevím' },
  distance:          { '0-5': 'Do 5 metrů', '5-15': '5–15 metrů', '15+': '15+ metrů' },
  targetAudience:    { flotila: 'Flotila', zamestnanci: 'Zaměstnanci', klienti: 'Klienti', kombinace: 'Kombinace' },
  carCount:          { '1-2': '1–2 auta', '3-5': '3–5 aut', '6-12': '6–12 aut', '12+': '12+ aut' },
  dcStation:         { '': 'Bez DC stanice', '40-120': '40–120 kW', '160-240': '160–240 kW', '400': '400 kW' },
  preparationState:  { ready: 'Dostatečná kapacita', capacity: 'Kapacita může být nedostatečná', other: 'Nejsme si jistí' },
  role:              { predseda: 'Předseda SVJ', facility: 'Facility manager', vlastnik: 'Vlastník bytu', jine: 'Jiné' },
  installLocation:   { garaze: 'Garáže', venku: 'Venkovní parkoviště', nevim: 'Nevím' },
  approvalStatus:    { schvaleno: 'Schváleno', zvazujeme: 'Zvažujeme', nesouhlas: 'Je nesouhlas' },
  commonPower:       { yes: 'Ano', no: 'Ne', unsure: 'Nevím, potřebuji poradit' },
  purchaseTimeline:  { 'do-3-mesicu': 'Do 3 měsíců', '3-6-mesicu': 'Za 3–6 měsíců', 'rok-a-dele': 'Za rok a déle', zjistuji: 'Zatím jen zjišťuji' },
  helpType:          { want_offer: 'Nabídka na míru', want_consultation: 'Konzultace', want_info: 'Podklady k prostudování', no_action: 'Jen orientační cena' },
};

const l = (field, value) => (value !== undefined && value !== null ? (LABELS[field]?.[value] ?? value) : '');

const HEADERS = [
  'Datum', 'Segment', 'Email', 'Telefon', 'Odhadovaná cena (Kč)',
  // Rodinný dům
  'Vzdálenost od rozvaděče', 'Smart funkce', 'Místo nabíjení', 'Parkovací místo', 'Rychlost nabíjení',
  // Firemní prostředí
  'Počet vozů', 'Výkon DC stanice (kW)', 'Stav přípravy', 'Rozúčtování nákladů', 'Cílová skupina',
  // Bytový dům
  'Počet stanic', 'Společný výkon k dispozici', 'Role žadatele', 'Místo instalace', 'Stav schválení',
  // Intent (všechny segmenty)
  'Termín instalace', 'Zájem leada',
];

// --- Segment-specific sheets ---
const SEGMENT_SHEETS = {
  rodinny: {
    name: 'Rodinný dům',
    headers: [
      'Datum', 'Email', 'Telefon', 'Odhadovaná cena (Kč)',
      'Vzdálenost od rozvaděče', 'Smart funkce', 'Místo nabíjení', 'Parkovací místo', 'Rychlost nabíjení',
      'Termín instalace', 'Zájem leada',
    ],
    priceColIndex: 3,
  },
  firemni: {
    name: 'Firemní prostředí',
    headers: [
      'Datum', 'Email', 'Telefon', 'Odhadovaná cena (Kč)',
      'Počet vozů', 'Výkon DC stanice (kW)', 'Stav přípravy', 'Rozúčtování nákladů', 'Cílová skupina',
      'Termín instalace', 'Zájem leada',
    ],
    priceColIndex: 3,
  },
  bytovy: {
    name: 'Bytový dům',
    headers: [
      'Datum', 'Email', 'Telefon', 'Odhadovaná cena (Kč)',
      'Počet stanic', 'Společný výkon k dispozici', 'Role žadatele', 'Místo instalace', 'Stav schválení',
      'Termín instalace', 'Zájem leada',
    ],
    priceColIndex: 3,
  },
};

// --- Retry helper ---
async function withRetry(fn, label, maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delay = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw new Error(`${label} failed after ${maxAttempts} attempts: ${lastError.message}`);
}

// --- Questionnaire → individual HTML table rows (for emails) ---
function questRowsHtml(segment, questionnaire) {
  const q = questionnaire || {};
  const sf = q.smartFunctions || {};
  const row = (label, value) => {
    if (!value && value !== 0) return '';
    return `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #64748b; width: 40%;">${label}</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">${value}</td>
      </tr>`;
  };

  if (segment === 'rodinny') {
    const smartList = [
      sf.dynamicPower && 'Dynamické řízení výkonu + RFID',
      sf.lowTariff && 'Nabíjení v nízkém tarifu',
      sf.planning && 'Plánování nabíjení',
      sf.rfid && 'RFID zabezpečení',
    ].filter(Boolean).join(', ');
    return [
      row('Vzdálenost od rozvaděče', l('distance', q.distance)),
      row('Místo nabíjení', l('chargingLocation', q.chargingLocation)),
      row('Parkovací místo', l('parkingSpace', q.parkingSpace)),
      row('Rychlost nabíjení', l('chargingSpeed', q.chargingSpeed)),
      row('Smart funkce', smartList || 'žádné'),
    ].join('');
  }

  if (segment === 'firemni') {
    return [
      row('Cílová skupina', l('targetAudience', q.targetAudience)),
      row('Počet vozů', l('carCount', q.carCount)),
      row('Výkon DC stanice', l('dcStation', q.dcStation ?? '')),
      row('Stav přípravy', l('preparationState', q.preparationState)),
      row('Rozúčtování nákladů', q.costAccounting ? 'Ano' : 'Ne'),
    ].join('');
  }

  if (segment === 'bytovy') {
    return [
      row('Role žadatele', l('role', q.role)),
      row('Místo instalace', l('installLocation', q.installLocation)),
      row('Stav schválení', l('approvalStatus', q.approvalStatus)),
      row('Počet stanic', q.stationCount),
      row('Společný výkon k dispozici', l('commonPower', q.commonPower)),
    ].join('');
  }

  return '';
}

// --- Segment label ---
function segmentLabel(segment) {
  if (segment === 'rodinny') return 'Rodinný dům';
  if (segment === 'firemni') return 'Firemní prostředí';
  if (segment === 'bytovy') return 'Bytový dům';
  return segment;
}

// --- Ensure sheet tab exists (creates it if missing) ---
async function ensureSheetExists(sheets, spreadsheetId, sheetName) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets.some((s) => s.properties.title === sheetName);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] },
    });
  }
}

// --- Ensure header row exists and price column is formatted as currency ---
async function ensureHeaders(sheets, spreadsheetId, sheetName, expectedHeaders, priceColIndex = 4) {
  const getRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName}'!1:1`,
  });
  const existing = getRes.data.values?.[0] || [];

  if (JSON.stringify(existing) === JSON.stringify(expectedHeaders)) return;

  // Write/update headers
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetName}'!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [expectedHeaders] },
  });

  // Format price column as currency with no decimals
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetObj = spreadsheet.data.sheets.find((s) => s.properties.title === sheetName);
  if (!sheetObj) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId: sheetObj.properties.sheetId,
              startRowIndex: 1, // skip header row
              startColumnIndex: priceColIndex,
              endColumnIndex: priceColIndex + 1,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: {
                  type: 'NUMBER',
                  pattern: '#,##0 "Kč"',
                },
              },
            },
            fields: 'userEnteredFormat.numberFormat',
          },
        },
      ],
    },
  });
}

// --- Build a segment-specific row (common fields + segment fields only) ---
function buildSegmentRow(segment, data) {
  const q = data.questionnaire || {};
  const sf = q.smartFunctions || {};
  const date = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Prague' });
  const common = [date, data.email, `'${data.phone}`, data.estimatedPrice || ''];

  const intentCols = [
    l('purchaseTimeline', data.purchaseTimeline),
    l('helpType', data.helpType),
  ];

  if (segment === 'rodinny') {
    const smartList = [
      sf.dynamicPower && 'Dynamické řízení výkonu + RFID',
      sf.lowTariff && 'Nabíjení v nízkém tarifu',
      sf.planning && 'Plánování nabíjení',
      sf.rfid && 'RFID zabezpečení',
    ].filter(Boolean).join(', ');
    return [
      ...common,
      l('distance', q.distance),
      smartList || '',
      l('chargingLocation', q.chargingLocation),
      l('parkingSpace', q.parkingSpace),
      l('chargingSpeed', q.chargingSpeed),
      ...intentCols,
    ];
  }

  if (segment === 'firemni') {
    return [
      ...common,
      l('carCount', q.carCount),
      l('dcStation', q.dcStation ?? ''),
      l('preparationState', q.preparationState),
      q.costAccounting ? 'Ano' : 'Ne',
      l('targetAudience', q.targetAudience),
      ...intentCols,
    ];
  }

  if (segment === 'bytovy') {
    return [
      ...common,
      parseInt(q.stationCount) || '',
      l('commonPower', q.commonPower),
      l('role', q.role),
      l('installLocation', q.installLocation),
      l('approvalStatus', q.approvalStatus),
      ...intentCols,
    ];
  }

  return common;
}

// --- Append row to Google Sheets ---
async function appendToSheet(data) {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  const sheetName = process.env.GOOGLE_SHEET_NAME || 'VŠECHNY TYPY';

  await ensureHeaders(sheets, spreadsheetId, sheetName, HEADERS, 4);

  const q = data.questionnaire || {};
  const sf = q.smartFunctions || {};

  const smartFunctions = [
    sf.dynamicPower && 'Dynamické řízení výkonu + RFID',
    sf.lowTariff && 'Nabíjení v nízkém tarifu',
    sf.planning && 'Plánování nabíjení',
    sf.rfid && 'RFID zabezpečení',
  ].filter(Boolean).join(', ');

  const isRodinny = data.segment === 'rodinny';
  const isFiremni = data.segment === 'firemni';
  const isBytovy = data.segment === 'bytovy';

  const row = [
    new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Prague' }),  // A: Datum (YYYY-MM-DD HH:MM:SS → Sheets datetime)
    segmentLabel(data.segment),                                          // B: Segment
    data.email,                                                          // C: Email
    `'${data.phone}`,                                                    // D: Telefon (apostrophe prefix → Sheets stores as text, keeps +)
    data.estimatedPrice || '',                                           // E: Cena (number)
    // Rodinný dům (F–J)
    isRodinny ? l('distance', q.distance) : '',                          // F: Vzdálenost od rozvaděče
    isRodinny ? (smartFunctions || '') : '',                             // G: Smart funkce
    isRodinny ? l('chargingLocation', q.chargingLocation) : '',          // H: Místo nabíjení
    isRodinny ? l('parkingSpace', q.parkingSpace) : '',                  // I: Parkovací místo
    isRodinny ? l('chargingSpeed', q.chargingSpeed) : '',                // J: Rychlost nabíjení
    // Firemní prostředí (K–O)
    isFiremni ? l('carCount', q.carCount) : '',                          // K: Počet vozů
    isFiremni ? l('dcStation', q.dcStation ?? '') : '',                  // L: Výkon DC stanice
    isFiremni ? l('preparationState', q.preparationState) : '',          // M: Stav přípravy
    isFiremni ? (q.costAccounting ? 'Ano' : 'Ne') : '',                  // N: Rozúčtování nákladů
    isFiremni ? l('targetAudience', q.targetAudience) : '',              // O: Cílová skupina
    // Bytový dům (P–T)
    isBytovy ? (parseInt(q.stationCount) || '') : '',                    // P: Počet stanic (number)
    isBytovy ? l('commonPower', q.commonPower) : '',                     // Q: Společný výkon
    isBytovy ? l('role', q.role) : '',                                   // R: Role žadatele
    isBytovy ? l('installLocation', q.installLocation) : '',             // S: Místo instalace
    isBytovy ? l('approvalStatus', q.approvalStatus) : '',               // T: Stav schválení
    l('purchaseTimeline', data.purchaseTimeline),                         // U: Termín instalace
    l('helpType', data.helpType),                                         // V: Zájem leada
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${sheetName}'!A:V`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });

  // Append to segment-specific sheet
  const seg = SEGMENT_SHEETS[data.segment];
  if (seg) {
    await ensureSheetExists(sheets, spreadsheetId, seg.name);
    await ensureHeaders(sheets, spreadsheetId, seg.name, seg.headers, seg.priceColIndex);
    const segRow = buildSegmentRow(data.segment, data);
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${seg.name}'!A:K`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [segRow] },
    });
  }
}

// --- Send success notification email ---
async function sendNotificationEmail(data) {
  const sheetUrl = process.env.GOOGLE_SHEET_URL || '#';
  const segName = segmentLabel(data.segment);
  const priceFormatted = data.estimatedPrice
    ? `${Math.round(data.estimatedPrice).toLocaleString('cs-CZ')} Kč`
    : 'N/A';

  await resend.emails.send({
    from: 'Smart4Smart <onboarding@resend.dev>',
    to: process.env.NOTIFICATION_EMAIL,
    subject: `🔌 Nový lead - ${segName} - ${data.email}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <div style="background: linear-gradient(135deg, #2563eb, #7c3aed); padding: 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🔌 Nový lead ze Smart4Smart kalkulačky</h1>
        </div>
        <div style="background: #f8fafc; padding: 32px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #64748b; width: 40%;">Datum a čas</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">${new Date().toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' })}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #64748b;">Segment</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">${segName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #64748b;">E-mail</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;"><a href="mailto:${data.email}" style="color: #2563eb;">${data.email}</a></td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #64748b;">Telefon</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;"><a href="tel:${data.phone}" style="color: #2563eb;">${data.phone}</a></td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #64748b;">Odhadovaná cena</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 18px; font-weight: bold; color: #2563eb;">${priceFormatted}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #64748b; width: 40%;">Termín instalace</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">${l('purchaseTimeline', data.purchaseTimeline) || '—'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #64748b;">Zájem leada</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">${l('helpType', data.helpType) || '—'}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding: 16px 0 8px; font-weight: bold; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">Dotazník</td>
            </tr>
            ${questRowsHtml(data.segment, data.questionnaire)}
          </table>

          <div style="text-align: center; margin-top: 24px;">
            <a href="${sheetUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Otevřít Google Sheet →
            </a>
          </div>
        </div>
      </div>
    `,
  });
}

// --- Send error email ---
async function sendErrorEmail(data, failedStep, errorMessage) {
  const priceFormatted = data?.estimatedPrice
    ? `${Math.round(data.estimatedPrice).toLocaleString('cs-CZ')} Kč`
    : 'N/A';

  await resend.emails.send({
    from: 'Smart4Smart <onboarding@resend.dev>',
    to: process.env.NOTIFICATION_EMAIL,
    subject: `⚠️ Chyba při zpracování leadu - ${segmentLabel(data?.segment)} - ${data?.email}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <div style="background: #dc2626; padding: 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 22px;">⚠️ Chyba při zpracování leadu</h1>
        </div>
        <div style="background: #fef2f2; padding: 32px; border-radius: 0 0 12px 12px; border: 1px solid #fecaca;">

          <h2 style="color: #dc2626; margin-top: 0;">Co selhalo: ${failedStep}</h2>
          <pre style="background: #fff; border: 1px solid #fecaca; padding: 12px; border-radius: 8px; font-size: 13px; overflow-x: auto; white-space: pre-wrap;">${errorMessage}</pre>

          <h3 style="color: #1e293b;">Zachycená data z formuláře</h3>
          <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #fecaca; font-weight: bold; color: #64748b; width: 40%;">Segment</td>
              <td style="padding: 10px; border-bottom: 1px solid #fecaca;">${segmentLabel(data?.segment)}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #fecaca; font-weight: bold; color: #64748b;">E-mail</td>
              <td style="padding: 10px; border-bottom: 1px solid #fecaca;">${data?.email || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #fecaca; font-weight: bold; color: #64748b;">Telefon</td>
              <td style="padding: 10px; border-bottom: 1px solid #fecaca;">${data?.phone || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #fecaca; font-weight: bold; color: #64748b;">Odhadovaná cena</td>
              <td style="padding: 10px; border-bottom: 1px solid #fecaca;">${priceFormatted}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold; color: #64748b;">Dotazník</td>
              <td style="padding: 10px;"><pre style="margin: 0; font-size: 12px; white-space: pre-wrap;">${JSON.stringify(data?.questionnaire, null, 2)}</pre></td>
            </tr>
          </table>

          <h3 style="color: #1e293b;">Doporučené kroky</h3>
          <ol style="color: #475569; line-height: 1.8;">
            <li>Zkontroluj <a href="https://vercel.com/dashboard" style="color: #2563eb;">Vercel logy</a> pro detailní stack trace</li>
            <li>Manuálně přidej lead do Google Sheetu z dat výše</li>
            <li>Kontaktuj leada na <strong>${data?.email || 'N/A'}</strong> nebo <strong>${data?.phone || 'N/A'}</strong></li>
            <li>Oprav příčinu chyby a otestuj znovu</li>
          </ol>
        </div>
      </div>
    `,
  });
}

// --- Main handler ---
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const data = req.body;

  // Basic validation
  if (!data?.email || !data?.phone || !data?.segment) {
    return res.status(400).json({ error: 'Missing required fields: email, phone, segment' });
  }

  // Phone sanity check: starts with + followed by digits only
  if (!/^\+\d{10,15}$/.test(data.phone)) {
    return res.status(400).json({ error: 'invalid_phone' });
  }

  // 1. Append to Google Sheets (with retry)
  try {
    await withRetry(() => appendToSheet(data), 'Google Sheets');
  } catch (sheetsError) {
    try {
      await sendErrorEmail(data, 'Google Sheets', sheetsError.message);
    } catch (emailErr) {
      console.error('Failed to send error email:', emailErr.message);
    }
    return res.status(500).json({ error: 'Failed to save lead data', details: sheetsError.message });
  }

  // 2. Send notification email (with retry)
  try {
    await withRetry(() => sendNotificationEmail(data), 'Resend email');
  } catch (emailError) {
    try {
      await sendErrorEmail(data, 'Resend notifikační email', emailError.message);
    } catch (errEmailErr) {
      console.error('Failed to send error email:', errEmailErr.message);
    }
    return res.status(207).json({
      warning: 'Lead saved to sheet, but notification email failed',
      details: emailError.message,
    });
  }

  return res.status(200).json({ success: true });
}
