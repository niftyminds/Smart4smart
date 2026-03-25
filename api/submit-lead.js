import { google } from 'googleapis';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const HEADERS = [
  'Datum', 'Segment', 'Email', 'Telefon', 'Odhadovaná cena (Kč)',
  'Vzdálenost od rozvaděče', 'Smart funkce',
  'Počet vozů', 'Výkon DC stanice (kW)', 'Stav přípravy', 'Rozúčtování nákladů',
  'Počet stanic', 'Společný výkon k dispozici',
];

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

// --- Questionnaire → human readable (for emails) ---
function formatQuestionnaireForEmail(segment, questionnaire) {
  if (!questionnaire) return 'N/A';

  if (segment === 'rodinny') {
    const sf = questionnaire.smartFunctions || {};
    const smartList = [
      sf.dynamicPower && 'Dynamické řízení výkonu + RFID',
      sf.lowTariff && 'Nabíjení v nízkém tarifu',
      sf.planning && 'Plánování nabíjení',
      sf.rfid && 'RFID zabezpečení',
    ].filter(Boolean).join(', ');
    return [
      `Vzdálenost od rozvaděče: ${questionnaire.distance || 'N/A'}m`,
      `Smart funkce: ${smartList || 'žádné'}`,
    ].join(' | ');
  }

  if (segment === 'firemni') {
    return [
      `Počet vozů: ${questionnaire.carCount || 'N/A'}`,
      `Výkon DC stanice: ${questionnaire.dcStation || 'N/A'} kW`,
      `Stav přípravy: ${questionnaire.preparationState || 'N/A'}`,
      `Rozúčtování nákladů: ${questionnaire.costAccounting ? 'Ano' : 'Ne'}`,
    ].join(' | ');
  }

  if (segment === 'bytovy') {
    return [
      `Počet stanic: ${questionnaire.stationCount || 'N/A'}`,
      `Společný výkon k dispozici: ${questionnaire.commonPower === 'yes' ? 'Ano' : 'Ne'}`,
    ].join(' | ');
  }

  return JSON.stringify(questionnaire);
}

// --- Segment label ---
function segmentLabel(segment) {
  if (segment === 'rodinny') return 'Rodinný dům';
  if (segment === 'firemni') return 'Firemní prostředí';
  if (segment === 'bytovy') return 'Bytový dům';
  return segment;
}

// --- Ensure header row exists and column E is formatted as currency ---
async function ensureHeaders(sheets, spreadsheetId, sheetName) {
  const getRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!1:1`,
  });
  const existing = getRes.data.values?.[0] || [];

  if (JSON.stringify(existing) === JSON.stringify(HEADERS)) return;

  // Write/update headers
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [HEADERS] },
  });

  // Format column E (index 4) as currency with no decimals
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
              startColumnIndex: 4, // column E
              endColumnIndex: 5,
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
  const sheetName = process.env.GOOGLE_SHEET_NAME || 'Smart4smart Leads';

  await ensureHeaders(sheets, spreadsheetId, sheetName);

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
    new Date().toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' }), // A: Datum
    segmentLabel(data.segment),                                          // B: Segment
    data.email,                                                          // C: Email
    data.phone,                                                          // D: Telefon
    data.estimatedPrice || '',                                           // E: Cena (number)
    isRodinny ? (q.distance || '') : '',                                 // F: Vzdálenost od rozvaděče
    isRodinny ? (smartFunctions || '') : '',                             // G: Smart funkce
    isFiremni ? (q.carCount || '') : '',                                 // H: Počet vozů
    isFiremni ? (q.dcStation || '') : '',                                // I: Výkon DC stanice
    isFiremni ? (q.preparationState || '') : '',                         // J: Stav přípravy
    isFiremni ? (q.costAccounting ? 'Ano' : 'Ne') : '',                  // K: Rozúčtování nákladů
    isBytovy ? (parseInt(q.stationCount) || '') : '',                    // L: Počet stanic
    isBytovy ? (q.commonPower === 'yes' ? 'Ano' : 'Ne') : '',            // M: Společný výkon
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:M`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

// --- Send success notification email ---
async function sendNotificationEmail(data) {
  const sheetUrl = process.env.GOOGLE_SHEET_URL || '#';
  const segName = segmentLabel(data.segment);
  const questDetail = formatQuestionnaireForEmail(data.segment, data.questionnaire);
  const priceFormatted = data.estimatedPrice
    ? `${Math.round(data.estimatedPrice).toLocaleString('cs-CZ')} Kč`
    : 'N/A';

  await resend.emails.send({
    from: 'Smart4smart <onboarding@resend.dev>',
    to: process.env.NOTIFICATION_EMAIL,
    subject: `🔌 Nový lead - ${segName} - ${data.email}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <div style="background: linear-gradient(135deg, #2563eb, #7c3aed); padding: 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🔌 Nový lead ze Smart4smart kalkulačky</h1>
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
              <td style="padding: 10px 0; font-weight: bold; color: #64748b;">Detaily dotazníku</td>
              <td style="padding: 10px 0;">${questDetail}</td>
            </tr>
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
    from: 'Smart4smart <onboarding@resend.dev>',
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

  // Phone validation: +420 or +421 followed by exactly 9 digits
  if (!/^\+42[01]\d{9}$/.test(data.phone)) {
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
