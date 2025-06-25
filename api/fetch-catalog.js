import XLSX from 'xlsx';
import fetch from 'node-fetch';

export const config = { runtime: 'nodejs' };

const BASE_PATH = '/סריקות חנות/מוצרים';
const EXCEL_FILE = `${BASE_PATH}/catalog.xls`;

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
    console.error("🔴 Token Refresh Error:", error);
    throw new Error("Cannot refresh Dropbox token");
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

  if (!res.ok) return null;

  const json = await res.json();
  return json.link;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = await getDropboxAccessToken();

    const fileRes = await fetch("https://content.dropboxapi.com/2/files/download", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Dropbox-API-Arg": JSON.stringify({ path: EXCEL_FILE })
      }
    });

    if (!fileRes.ok) {
      const error = await fileRes.text();
      return res.status(500).json({ error: "Failed to fetch Excel file", details: error });
    }

    const buffer = await fileRes.buffer();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const catalog = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const barcode = row[2]?.toString().trim() || '';
      const imagePath = `${BASE_PATH}/${barcode}.jpg`;
      const imageUrl = await getTemporaryLink(token, imagePath);

      catalog.push({
        name: row[1]?.toString().trim() || '',
        barcode,
        department: row[3]?.toString().trim() || '',
        group: row[4]?.toString().trim() || '',
        price: row[5]?.toString().trim() || '',
        imageUrl: imageUrl || null
      });
    }

    return res.status(200).json({ catalog });
  } catch (err) {
    console.error("🔴 Catalog API Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
