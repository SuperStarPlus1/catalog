import XLSX from 'xlsx';
import fetch from 'node-fetch';

export const config = { runtime: 'nodejs' };

const BASE_FOLDER = '/catalog';

async function getDropboxAccessToken() {
  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', process.env.DROPBOX_REFRESH_TOKEN);

  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(
        `${process.env.DROPBOX_APP_KEY}:${process.env.DROPBOX_APP_SECRET}`
      ).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });

  if (!res.ok) {
    const error = await res.text();
    console.error('❌ Failed to refresh token:', error);
    throw new Error('Cannot refresh Dropbox token');
  }

  const data = await res.json();
  return data.access_token;
}

async function getTemporaryLink(token, path) {
  const res = await fetch("https://api.dropboxapi.com/2/files/get_temporary_link", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ path })
  });

  if (!res.ok) {
    console.warn("⚠️ Image not found:", path);
    return null;
  }

  const data = await res.json();
  return data.link;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const DROPBOX_TOKEN = await getDropboxAccessToken();

    const downloadRes = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DROPBOX_TOKEN}`,
        'Dropbox-API-Arg': JSON.stringify({ path: `${BASE_FOLDER}/catalog.xls` })
      }
    });

    if (!downloadRes.ok) {
      const error = await downloadRes.text();
      console.error("❌ Excel Fetch Error:", error);
      return res.status(500).json({ error });
    }

    const buffer = await downloadRes.buffer();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const catalog = await Promise.all(
      rows.slice(1).map(async row => {
        const barcode = row[2]?.toString().trim() || '';
        const imagePath = `${BASE_FOLDER}/${barcode}.jpg`;
        const imageUrl = await getTemporaryLink(DROPBOX_TOKEN, imagePath);
        return {
          name: row[1]?.toString().trim() || '',
          barcode,
          department: row[3]?.toString().trim() || '',
          group: row[4]?.toString().trim() || '',
          price: row[5]?.toString().trim() || '',
          imageUrl: imageUrl || ''
        };
      })
    );

    res.status(200).json({ catalog });
  } catch (err) {
    console.error('❌ Catalog Fetch Error:', err);
    res.status(500).json({ error: err.message });
  }
}
