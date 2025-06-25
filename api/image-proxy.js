import fetch from 'node-fetch';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const url = new URL(req.url);
  const path = url.searchParams.get('path');

  if (!path || !path.startsWith('/')) {
    return new Response(JSON.stringify({ error: 'Invalid or missing path' }), {
      status: 400,
    });
  }

  try {
    const accessToken = process.env.DROPBOX_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error('Missing Dropbox access token');
    }

    const dropboxRes = await fetch('https://api.dropboxapi.com/2/files/get_temporary_link', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path }),
    });

    if (!dropboxRes.ok) {
      const error = await dropboxRes.json();
      console.error('Dropbox Link Error:', error);
      return new Response(JSON.stringify({ error: 'Dropbox Link Error', details: error }), {
        status: 500,
      });
    }

    const { link } = await dropboxRes.json();
    return Response.redirect(link, 302);
  } catch (err) {
    console.error('Proxy Handler Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
    });
  }
}
