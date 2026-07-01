// Regenerates drive-index.json by listing the shared EE Lab reports Drive folder.
// Auth uses a service-account key supplied ONLY via the GDRIVE_SA_KEY env var
// (a GitHub Actions secret) — the key must never be committed to this repo.
import { google } from 'googleapis';
import { writeFile } from 'node:fs/promises';

const FOLDER_ID = process.env.GDRIVE_FOLDER_ID || '1gFaR3TqFGoDFFGV10B9y2FNcB-OLzBIT';
const OUTPUT_PATH = new URL('../drive-index.json', import.meta.url);

async function main() {
  const raw = process.env.GDRIVE_SA_KEY;
  if (!raw) throw new Error('GDRIVE_SA_KEY env var is not set — refusing to run without credentials.');
  const credentials = JSON.parse(raw);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const drive = google.drive({ version: 'v3', auth });

  const files = [];
  let pageToken;
  do {
    const res = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, webViewLink, modifiedTime)',
      pageSize: 200,
      pageToken,
    });
    files.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  files.sort((a, b) => a.name.localeCompare(b.name));
  await writeFile(OUTPUT_PATH, JSON.stringify(files, null, 2) + '\n');
  console.log(`Wrote ${files.length} files to drive-index.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
