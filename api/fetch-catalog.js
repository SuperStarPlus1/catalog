import XLSX from 'xlsx';
import fetch from 'node-fetch';

export const config = { runtime: 'nodejs' };

const BASE_FOLDER = '/סריקות חנות/מוצרים';

async function getDropboxAccessToken() {
  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', process.env.DROPBOX_REFRESH_TOKEN);

  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${process.env.DROPBOX_APP_KEY}:${process.env.DROPBOX_APP_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });

  if (!res.ok) {
    const error = await res.text();
    console.error('Failed to refresh token:', error);
    throw new Error('Cannot refresh Dropbox token');
  }

  const data = await res.json();
  return data.access_token;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const DROPBOX_TOKEN = await getDropboxAccessToken();

    // Download catalog.xls from Dropbox
    const downloadRes = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DROPBOX_TOKEN}`,
        'Dropbox-API-Arg': JSON.stringify({ path: `${BASE_FOLDER}/catalog.xls` })
      }
    });

    if (!downloadRes.ok) {
      const error = await downloadRes.text();
      return res.status(500).json({ error });
    }

    const buffer = await downloadRes.buffer();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Skip header row (assuming first row is header)
    const catalog = rows.slice(1).map(row => ({
      name: row[1] || '',
      barcode: row[2] || '',
      department: row[3] || '',
      group: row[4] || '',
      price: row[5] || '',
      imageUrl: `https://content.dropboxapi.com/2/files/download?arg=${encodeURIComponent(JSON.stringify({ path: `${BASE_FOLDER}/${row[2]}.jpg` }))}&authorization=Bearer ${DROPBOX_TOKEN}`
    }));

    res.status(200).json(catalog);
  } catch (err) {
    console.error('Catalog Fetch Error:', err);
    res.status(500).json({ error: err.message });
  }
}
