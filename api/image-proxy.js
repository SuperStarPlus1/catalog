// /api/image-proxy.js

import fetch from 'node-fetch';

export const config = {
  runtime: 'nodejs',
};

async function getDropboxAccessToken() {
  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', process.env.DROPBOX_REFRESH_TOKEN);

  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization:
        'Basic ' +
        Buffer.from(
          `${process.env.DROPBOX_APP_KEY}:${process.env.DROPBOX_APP_SECRET}`
        ).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
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
  const imagePath = req.query.path;
  if (!imagePath) {
    return res.status(400).send('Missing image path');
  }

  try {
    const token = await getDropboxAccessToken();

    const response = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Dropbox-API-Arg': JSON.stringify({ path: imagePath }),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🔴 Dropbox image download error:', errorText);
      return res.status(500).send('Image not found');
    }

    res.setHeader('Content-Type', 'image/jpeg');
    const buffer = await response.buffer();
    res.send(buffer);
  } catch (err) {
    console.error('🔴 Image Proxy Error:', err.message);
    res.status(500).send('Server error');
  }
}
