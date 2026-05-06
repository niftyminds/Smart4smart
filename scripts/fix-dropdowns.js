import { google } from 'googleapis';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('='); if (eq === -1) continue;
    const key = t.slice(0, eq).trim(); let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

const NEXT_STEP_OPTIONS = ['Odpad', 'Jen zaslání informací', 'Rozpracováno', 'Schůzka nebo zájem', 'Volat v budoucnu', 'Realizace'];
const MEETING_RESULT_OPTIONS = ['Nezájem - cena', 'Nezájem - jiné', 'Zájem'];

function dropdownRule(values) {
  return {
    condition: {
      type: 'ONE_OF_LIST',
      values: values.map(v => ({ userEnteredValue: v })),
    },
    showCustomUi: true,
    strict: false,
  };
}

async function fixTab(sheets, spreadsheetId, tabName, sheetId) {
  console.log(`\n=== "${tabName}" ===`);

  // Read all data
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${tabName}'` });
  const rows = res.data.values || [];
  if (rows.length < 2) { console.log('  Žádná data, přeskakuji.'); return; }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  // Fix: col D (idx 3) → col B (idx 1), clear col D
  let fixed = 0;
  for (const row of dataRows) {
    const valD = row[3] ?? '';
    if (valD) {
      row[1] = valD;
      row[3] = '';
      fixed++;
    }
  }
  console.log(`  Přesunuto ${fixed} hodnot z Výsledek schůzky (D) → Poznámky (B).`);

  // Write back all data
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tabName}'!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [headers, ...dataRows] },
  });
  console.log(`  ✓ Data přepsána.`);

  // Apply dropdown validation to col C (idx 2) and col D (idx 3)
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          setDataValidation: {
            range: { sheetId, startRowIndex: 1, startColumnIndex: 2, endColumnIndex: 3 },
            rule: dropdownRule(NEXT_STEP_OPTIONS),
          },
        },
        {
          setDataValidation: {
            range: { sheetId, startRowIndex: 1, startColumnIndex: 3, endColumnIndex: 4 },
            rule: dropdownRule(MEETING_RESULT_OPTIONS),
          },
        },
      ],
    },
  });
  console.log(`  ✓ Dropdown validace přidána na sloupce C (Další krok) a D (Výsledek schůzky).`);
}

async function main() {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  const mainSheetName = process.env.GOOGLE_SHEET_NAME || 'VŠECHNY TYPY';
  if (!spreadsheetId || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    console.error('Chybí env proměnné.'); process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetIdMap = Object.fromEntries(
    meta.data.sheets
      .filter(s => !s.properties.title.startsWith('ARCHIV'))
      .map(s => [s.properties.title, s.properties.sheetId])
  );

  const tabs = [mainSheetName, 'Rodinný dům', 'Firemní prostředí', 'Bytový dům'];
  for (const tab of tabs) {
    if (sheetIdMap[tab] === undefined) { console.log(`\n"${tab}" nenalezena, přeskakuji.`); continue; }
    await fixTab(sheets, spreadsheetId, tab, sheetIdMap[tab]);
  }

  console.log('\n=== Hotovo ===');
}

main().catch(err => { console.error('Chyba:', err.message); process.exit(1); });
