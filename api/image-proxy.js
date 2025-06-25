// pages/api/image-proxy.js

import fetch from 'node-fetch';

export const config = { runtime: 'nodejs' };

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
    throw new Error('Failed to refresh Dropbox token');
  }

  const data = await res.json();
  return data.access_token;
}

export default async function handler(req, res) {
  const { path } = req.query;

  if (!path) {
    return res.status(400).json({ error: 'Missing image path' });
  }

  try {
    const DROPBOX_TOKEN = await getDropboxAccessToken();

    const dropboxRes = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DROPBOX_TOKEN}`,
        'Dropbox-API-Arg': JSON.stringify({ path: decodeURIComponent(path) }).replace(/\u202a|\u202c/g, '')
      }
    });

    if (!dropboxRes.ok) {
      const error = await dropboxRes.text();
      console.error('❌ Dropbox Image Fetch Error:', error);
      return res.status(404).json({ error: 'Image not found' });
    }

    res.setHeader('Content-Type', dropboxRes.headers.get('Content-Type') || 'image/jpeg');
    const buffer = await dropboxRes.buffer();
    res.send(buffer);
  } catch (err) {
    console.error('❌ Image Proxy Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
}
