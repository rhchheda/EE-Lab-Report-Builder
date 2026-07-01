// Regenerates attendance-data.json from the Attendance Google Sheet (source of truth,
// replaces the old local xlsx registers). Auth uses the same service-account key supplied
// ONLY via the GDRIVE_SA_KEY env var (a GitHub Actions secret) — never committed to this repo.
import { google } from 'googleapis';
import { writeFile } from 'node:fs/promises';

const SHEET_ID = process.env.GSHEET_ATTENDANCE_ID || '12FetMHFxTKO13NOMHUyR_rArlp4gRvI4tFGi5kjo3g8';
const OUTPUT_PATH = new URL('../attendance-data.json', import.meta.url);
const DAY_TYPE_REQ_HRS = { weekday: 8, saturday: 4, sunday: 0, holiday: 0 };

function num(v) { return (v === null || v === undefined || v === '') ? 0 : Number(v) || 0; }

async function main() {
  const raw = process.env.GDRIVE_SA_KEY;
  if (!raw) throw new Error('GDRIVE_SA_KEY env var is not set — refusing to run without credentials.');
  const credentials = JSON.parse(raw);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const sheetTitles = meta.data.sheets.map((s) => s.properties.title);

  // 1. Parse the Dashboard sheet's pre-summarized monthly rows.
  const dashRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: `'Dashboard'!A1:J40`, valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const dashRows = dashRes.data.values || [];
  const hIdx = dashRows.findIndex((r) => String(r[0] || '').trim().toUpperCase() === 'MONTH');
  const months = []; let grand = null;
  const summarizedLabels = new Set();
  if (hIdx >= 0) {
    for (let i = hIdx + 1; i < dashRows.length; i++) {
      const r = dashRows[i]; if (!r || r[0] == null || r[0] === '') continue;
      const label = String(r[0]).trim();
      const rec = {
        month: label, workingDays: num(r[1]), present: num(r[2]), absent: num(r[3]),
        leaves: num(r[4]), halfDays: num(r[5]), hoursWorked: num(r[6]), requiredHrs: num(r[7]),
        excessHrs: num(r[8]), attendancePct: num(r[9]),
      };
      if (label.toUpperCase() === 'GRAND TOTAL') grand = rec;
      else { months.push(rec); summarizedLabels.add(label); }
    }
  }

  // 2. Any monthly tab not yet rolled up into the Dashboard (i.e. the current, in-progress
  // month) gets its summary computed directly from its daily rows.
  const inProgress = [];
  for (const title of sheetTitles) {
    if (title === 'Dashboard' || summarizedLabels.has(title)) continue;
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: `'${title}'!A1:K400`, valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const rows = res.data.values || [];
    const dIdx = rows.findIndex((r) => r && String(r[0] || '').trim() === '#');
    if (dIdx < 0) continue;
    let present = 0, absent = 0, leave = 0, half = 0, workingDays = 0, recorded = 0, hoursWorked = 0;
    for (let i = dIdx + 1; i < rows.length; i++) {
      const r = rows[i]; if (!r || r[1] == null || r[1] === '') continue;
      const dayType = String(r[3] || '').trim().toLowerCase();
      const reqHrs = (r[7] != null && r[7] !== '') ? num(r[7]) : (DAY_TYPE_REQ_HRS[dayType] ?? 8);
      const status = String(r[9] || '').trim();
      if (reqHrs > 0) workingDays++;
      if (status && status.toLowerCase() !== 'holiday') {
        recorded++;
        if (/present/i.test(status)) present++;
        else if (/absent/i.test(status)) absent++;
        else if (/leave/i.test(status)) leave++;
        else if (/half/i.test(status)) half++;
      }
      hoursWorked += num(r[6]);
    }
    inProgress.push({
      month: title, workingDays, present, absent, leaves: leave, halfDays: half,
      recorded, hoursWorked, attendancePct: recorded > 0 ? present / recorded : 0,
    });
  }

  const output = { months, grand, inProgress, generatedAt: new Date().toISOString() };
  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');
  console.log(`Wrote attendance-data.json: ${months.length} summarized month(s), ${inProgress.length} in-progress`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
