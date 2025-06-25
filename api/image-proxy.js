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
      'Authorization': 'Basic ' + Buffer.from(
        `${process.env.DROPBOX_APP_KEY}:${process.env.DROPBOX_APP_SECRET}`
      ).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });

  if (!res.ok) {
    const error = await res.text();
    console.error('❌ Token Refresh Error:', error);
    throw new Error('Cannot refresh Dropbox token');
  }

  const data = await res.json();
  return data.access_token;
}

export default async function handler(req, res) {
  const { barcode } = req.query;

  if (!barcode) {
    return res.status(400).json({ error: 'Missing barcode' });
  }

  try {
    const DROPBOX_TOKEN = await getDropboxAccessToken();

    const path = `${BASE_FOLDER}/${barcode}.jpg`;

    const response = await fetch('https://api.dropboxapi.com/2/files/get_temporary_link', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DROPBOX_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ path })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Dropbox Link Error:', error);
      return res.status(500).json({ error });
    }

    const json = await response.json();
    return res.status(200).json({ url: json.link });

  } catch (err) {
    console.error('❌ Proxy Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
