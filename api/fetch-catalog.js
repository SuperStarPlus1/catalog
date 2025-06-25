import XLSX from 'xlsx';
import fetch from 'node-fetch';

export const config = { runtime: 'nodejs' };

const BASE_FOLDER = '/catalog';
const FILE_NAME = 'catalog.xls';

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
    console.error('🔴 Failed to refresh token:', error);
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
    const token = await getDropboxAccessToken();

    const response = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Dropbox-API-Arg': Buffer.from(JSON.stringify({ path: `${BASE_FOLDER}/${FILE_NAME}` })).toString('utf8')
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🔴 Dropbox Download Error:', errorText);
      return res.status(500).json({ error: 'Failed to download file from Dropbox' });
    }

    const buffer = await response.buffer();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const catalog = rows.slice(1).map(row => {
      const barcode = row[2]?.toString().trim() || '';
      return {
        name: row[1]?.toString().trim() || '',
        barcode,
        department: row[3]?.toString().trim() || '',
        group: row[4]?.toString().trim() || '',
        price: row[5]?.toString().trim() || '',
        imagePath: `${BASE_FOLDER}/${barcode}.jpg`
      };
    });

    res.status(200).json({ catalog });
  } catch (err) {
    console.error('❌ Catalog Fetch Error:', err);
    res.status(500).json({ error: err.message });
  }
}
