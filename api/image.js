export const config = {
  runtime: 'nodejs',
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Only GET allowed' });
  }

  const filename = req.query.file;
  if (!filename) {
    return res.status(400).json({ error: 'Missing file name in query (?file=...)' });
  }

  try {
    const accessToken = await getAccessToken();

    const dropboxRes = await fetch('https://api.dropboxapi.com/2/files/get_temporary_link', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ path: `/catalog/${filename}` })
    });

    if (!dropboxRes.ok) {
      const error = await dropboxRes.json();
      return res.status(404).json({ error: 'File not found', details: error });
    }

    const data = await dropboxRes.json();
    return res.status(200).json({ url: data.link });

  } catch (err) {
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
}

async function getAccessToken() {
  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', process.env.DROPBOX_REFRESH_TOKEN);

  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(
        `${process.env.DROPBOX_APP_KEY}:${process.env.DROPBOX_APP_SECRET}`
      ).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });

  if (!res.ok) {
    throw new Error('Failed to refresh access token');
  }

  const data = await res.json();
  return data.access_token;
}
