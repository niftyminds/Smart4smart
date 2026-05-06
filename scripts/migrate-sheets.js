import { google } from 'googleapis';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// --- Load .env from project root ---
function loadEnv() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

// --- CLI args ---
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const csvArgIdx = args.indexOf('--csv');
const CSV_PATH = csvArgIdx !== -1 ? args[csvArgIdx + 1] : null;

if (DRY_RUN) console.log('[DRY RUN] Nic se nezapíše do Google Sheets.\n');

// --- New headers ---
const NEW_MAIN_HEADERS = [
  'Datum', 'Poznámky', 'Další krok', 'Výsledek schůzky', 'Jméno', 'Město',
  'Segment', 'Email', 'Telefon', 'Odhadovaná cena (Kč)',
  'Plánovaná realizace', 'Požadavek leada',
  'Stav přípravy', 'Rozúčtování nákladů', 'Cílová skupina',
  'Společný výkon k dispozici', 'Místo instalace', 'Stav schválení',
  'Vzdálenost od rozvaděče', 'Smart funkce', 'Místo nabíjení', 'Parkovací místo', 'Rychlost nabíjení',
  'Počet vozů', 'Výkon DC stanice (kW)',
  'Počet stanic', 'Role žadatele',
  'UTM Source', 'UTM Medium', 'UTM Campaign', 'UTM Ad Set', 'UTM Content',
];

const SEG_PREFIX = [
  'Datum', 'Poznámky', 'Další krok', 'Výsledek schůzky', 'Jméno', 'Město',
  'Email', 'Telefon', 'Odhadovaná cena (Kč)',
  'Plánovaná realizace', 'Požadavek leada',
];
const SEG_SUFFIX = ['UTM Source', 'UTM Medium', 'UTM Campaign', 'UTM Ad Set', 'UTM Content'];

const NEW_SEGMENT_HEADERS = {
  'Rodinný dům':       [...SEG_PREFIX, 'Vzdálenost od rozvaděče', 'Smart funkce', 'Místo nabíjení', 'Parkovací místo', 'Rychlost nabíjení', ...SEG_SUFFIX],
  'Firemní prostředí': [...SEG_PREFIX, 'Počet vozů', 'Výkon DC stanice (kW)', 'Stav přípravy', 'Rozúčtování nákladů', 'Cílová skupina', ...SEG_SUFFIX],
  'Bytový dům':        [...SEG_PREFIX, 'Počet stanic', 'Společný výkon k dispozici', 'Role žadatele', 'Místo instalace', 'Stav schválení', ...SEG_SUFFIX],
};

// --- CSV parser (handles comma, semicolon, tab; quoted fields) ---
function splitCsvLine(line, sep) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === sep && !inQuotes) {
      result.push(current); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCsv(content) {
  const lines = content.split('\n').map(l => l.replace(/\r$/, '')).filter(Boolean);
  if (lines.length === 0) return [];
  const firstLine = lines[0];
  let sep = '\t';
  if (!firstLine.includes('\t')) sep = firstLine.includes(';') ? ';' : ',';
  const rawHeaders = splitCsvLine(firstLine, sep).map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const cells = splitCsvLine(line, sep);
    const row = {};
    rawHeaders.forEach((h, i) => { row[h] = (cells[i] ?? '').trim().replace(/^"|"$/g, ''); });
    return row;
  });
}

// --- Row remapping ---

// Old main tab (27 cols A-AA):
// 0:Datum 1:Segment 2:Email 3:Telefon 4:Cena
// 5:Vzdálenost 6:Smart 7:Místo nabíjení 8:Parkoviště 9:Rychlost
// 10:Počet vozů 11:DC kW 12:Stav přípravy 13:Rozúčtování 14:Cílová
// 15:Počet stanic 16:Spol.výkon 17:Role 18:Místo inst. 19:Stav schr.
// 20:Termín 21:Zájem 22-26:UTM×5
function remapMainRow(old, csv) {
  const n = new Array(32).fill('');
  n[0]  = old[0]  ?? ''; // Datum
  n[6]  = old[1]  ?? ''; // Segment
  n[7]  = old[2]  ?? ''; // Email
  n[8]  = old[3]  ?? ''; // Telefon
  n[9]  = old[4]  ?? ''; // Odhadovaná cena
  n[10] = old[20] ?? ''; // Plánovaná realizace (bylo: Termín instalace)
  n[11] = old[21] ?? ''; // Požadavek leada (bylo: Zájem leada)
  n[12] = old[12] ?? ''; // Stav přípravy
  n[13] = old[13] ?? ''; // Rozúčtování nákladů
  n[14] = old[14] ?? ''; // Cílová skupina
  n[15] = old[16] ?? ''; // Společný výkon (bylo na idx 16)
  n[16] = old[18] ?? ''; // Místo instalace (bylo na idx 18)
  n[17] = old[19] ?? ''; // Stav schválení (bylo na idx 19)
  n[18] = old[5]  ?? ''; // Vzdálenost od rozvaděče
  n[19] = old[6]  ?? ''; // Smart funkce
  n[20] = old[7]  ?? ''; // Místo nabíjení
  n[21] = old[8]  ?? ''; // Parkovací místo
  n[22] = old[9]  ?? ''; // Rychlost nabíjení
  n[23] = old[10] ?? ''; // Počet vozů
  n[24] = old[11] ?? ''; // Výkon DC stanice
  n[25] = old[15] ?? ''; // Počet stanic (bylo na idx 15)
  n[26] = old[17] ?? ''; // Role žadatele (bylo na idx 17)
  n[27] = old[22] ?? ''; // UTM Source
  n[28] = old[23] ?? ''; // UTM Medium
  n[29] = old[24] ?? ''; // UTM Campaign
  n[30] = old[25] ?? ''; // UTM Ad Set
  n[31] = old[26] ?? ''; // UTM Content
  if (csv) {
    n[1] = csv['Výsledek']   || ''; // Poznámky
    n[2] = csv['Další krok'] || '';
    n[5] = csv['Město']      || '';
  }
  return n;
}

// Old segment tabs (16 cols A-P):
// 0:Datum 1:Email 2:Telefon 3:Cena
// 4-8: segment-specific cols (5 cols)
// 9:Termín 10:Zájem 11-15:UTM×5
function remapSegmentRow(old, csv) {
  const n = new Array(21).fill('');
  n[0]  = old[0]  ?? ''; // Datum
  n[6]  = old[1]  ?? ''; // Email
  n[7]  = old[2]  ?? ''; // Telefon
  n[8]  = old[3]  ?? ''; // Odhadovaná cena
  n[9]  = old[9]  ?? ''; // Plánovaná realizace (bylo: Termín instalace)
  n[10] = old[10] ?? ''; // Požadavek leada (bylo: Zájem leada)
  n[11] = old[4]  ?? ''; // seg col 1
  n[12] = old[5]  ?? ''; // seg col 2
  n[13] = old[6]  ?? ''; // seg col 3
  n[14] = old[7]  ?? ''; // seg col 4
  n[15] = old[8]  ?? ''; // seg col 5
  n[16] = old[11] ?? ''; // UTM Source
  n[17] = old[12] ?? ''; // UTM Medium
  n[18] = old[13] ?? ''; // UTM Campaign
  n[19] = old[14] ?? ''; // UTM Ad Set
  n[20] = old[15] ?? ''; // UTM Content
  if (csv) {
    n[1] = csv['Výsledek']   || ''; // Poznámky
    n[2] = csv['Další krok'] || '';
    n[5] = csv['Město']      || '';
  }
  return n;
}

// --- Apply price number format ---
async function applyPriceFormat(sheets, spreadsheetId, sheetId, priceColIndex) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 1,
            startColumnIndex: priceColIndex,
            endColumnIndex: priceColIndex + 1,
          },
          cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '#,##0 "Kč"' } } },
          fields: 'userEnteredFormat.numberFormat',
        },
      }],
    },
  });
}

// --- Archive a tab by duplicating it ---
async function archiveTab(sheets, spreadsheetId, sourceTab, archiveTab, allSheets) {
  const sourceSheet = allSheets.find(s => s.properties.title === sourceTab);
  if (!sourceSheet) {
    console.log(`  Záložka "${sourceTab}" nenalezena — přeskakuji archivaci.`);
    return;
  }
  const archiveExists = allSheets.some(s => s.properties.title === archiveTab);
  if (archiveExists) {
    console.log(`  Archivní záložka "${archiveTab}" již existuje — přeskakuji.`);
    return;
  }
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Vytvořil bych záložku "${archiveTab}" s kopií dat z "${sourceTab}".`);
    return;
  }
  // Duplicate sheet
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        duplicateSheet: {
          sourceSheetId: sourceSheet.properties.sheetId,
          insertSheetIndex: allSheets.length,
          newSheetName: archiveTab,
        },
      }],
    },
  });
  console.log(`  ✓ Záložka "${archiveTab}" vytvořena jako archiv.`);
}

// --- Main ---
async function main() {
  // Validate env
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  const mainSheetName = process.env.GOOGLE_SHEET_NAME || 'VŠECHNY TYPY';
  if (!spreadsheetId || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    console.error('Chybí env proměnné: GOOGLE_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY');
    process.exit(1);
  }

  // Auth
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // Load CSV if provided
  let csvByEmail = new Map();
  if (CSV_PATH) {
    if (!existsSync(CSV_PATH)) { console.error(`CSV soubor nenalezen: ${CSV_PATH}`); process.exit(1); }
    const csvRows = parseCsv(readFileSync(CSV_PATH, 'utf-8'));
    for (const row of csvRows) {
      const email = (row['Email'] || '').toLowerCase().trim();
      if (email) csvByEmail.set(email, row);
    }
    console.log(`CSV: načteno ${csvRows.length} řádků, ${csvByEmail.size} unikátních emailů.\n`);
  }

  // Get spreadsheet metadata (all sheet names + IDs)
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const allSheets = meta.data.sheets;
  const sheetIdMap = Object.fromEntries(allSheets.map(s => [s.properties.title, s.properties.sheetId]));

  const segmentTabs = ['Rodinný dům', 'Firemní prostředí', 'Bytový dům'];

  // --- Process main tab ---
  console.log(`=== Hlavní záložka: "${mainSheetName}" ===`);
  const mainRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${mainSheetName}'` });
  const mainRows = mainRes.data.values || [];
  const mainData = mainRows.slice(1); // skip header row
  console.log(`  Načteno ${mainData.length} datových řádků.`);

  // Build CSV match stats
  let mainMatched = 0;
  const newMainRows = mainData.map(row => {
    const email = (row[2] || '').toLowerCase().trim();
    const csv = csvByEmail.get(email) || null;
    if (csv) mainMatched++;
    return remapMainRow(row, csv);
  });
  if (CSV_PATH) console.log(`  CSV match: ${mainMatched}/${mainData.length} řádků.`);

  if (mainData.length > 0) {
    console.log(`  Ukázkový přemapovaný řádek [0]: ${JSON.stringify(newMainRows[0].slice(0, 12))}...`);
  }

  await archiveTab(sheets, spreadsheetId, mainSheetName, `ARCHIV ${mainSheetName}`, allSheets);

  if (!DRY_RUN) {
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${mainSheetName}'` });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${mainSheetName}'!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [NEW_MAIN_HEADERS, ...newMainRows] },
    });
    if (sheetIdMap[mainSheetName] !== undefined) {
      await applyPriceFormat(sheets, spreadsheetId, sheetIdMap[mainSheetName], 9);
    }
    console.log(`  ✓ Záložka "${mainSheetName}" přepsána (${newMainRows.length} řádků, 33 sloupců).`);
  } else {
    console.log(`  [DRY RUN] Přepsal bych "${mainSheetName}": ${newMainRows.length} řádků → 33 sloupců.`);
  }

  // --- Process segment tabs ---
  for (const tabName of segmentTabs) {
    console.log(`\n=== Segmentová záložka: "${tabName}" ===`);
    const exists = allSheets.some(s => s.properties.title === tabName);
    if (!exists) {
      console.log(`  Záložka neexistuje — přeskakuji.`);
      continue;
    }

    const segRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${tabName}'` });
    const segRows = segRes.data.values || [];
    const segData = segRows.slice(1);
    console.log(`  Načteno ${segData.length} datových řádků.`);

    let segMatched = 0;
    const newSegRows = segData.map(row => {
      const email = (row[1] || '').toLowerCase().trim();
      const csv = csvByEmail.get(email) || null;
      if (csv) segMatched++;
      return remapSegmentRow(row, csv);
    });
    if (CSV_PATH) console.log(`  CSV match: ${segMatched}/${segData.length} řádků.`);

    if (segData.length > 0) {
      console.log(`  Ukázkový přemapovaný řádek [0]: ${JSON.stringify(newSegRows[0].slice(0, 12))}...`);
    }

    await archiveTab(sheets, spreadsheetId, tabName, `ARCHIV ${tabName}`, allSheets);

    if (!DRY_RUN) {
      await sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${tabName}'` });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${tabName}'!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [NEW_SEGMENT_HEADERS[tabName], ...newSegRows] },
      });
      if (sheetIdMap[tabName] !== undefined) {
        await applyPriceFormat(sheets, spreadsheetId, sheetIdMap[tabName], 8);
      }
      console.log(`  ✓ Záložka "${tabName}" přepsána (${newSegRows.length} řádků, 22 sloupců).`);
    } else {
      console.log(`  [DRY RUN] Přepsal bych "${tabName}": ${newSegRows.length} řádků → 22 sloupců.`);
    }
  }

  console.log('\n=== Hotovo ===');
  if (DRY_RUN) console.log('Suchý běh dokončen. Pro ostrý běh spusť bez --dry-run.');
  else console.log('Migrace dokončena. Ověř data v Google Sheets a aktualizuj schéma v Looker Studiu.');
}

main().catch(err => { console.error('Chyba:', err.message); process.exit(1); });
