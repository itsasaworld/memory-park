require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Spotify authentication endpoints
app.get('/api/spotify-login', (req, res) => {
  const scopes = [
    'streaming',
    'user-read-email',
    'user-read-private',
    'playlist-read-private',
    'playlist-read-collaborative'
  ];

  const authUrl = new URL('https://accounts.spotify.com/authorize');
  const params = {
    response_type: 'code',
    client_id: process.env.SPOTIFY_CLIENT_ID,
    scope: scopes.join(' '),
    redirect_uri: 'http://127.0.0.1:3000/callback',
    show_dialog: true
  };

  authUrl.search = new URLSearchParams(params).toString();
  res.json({ url: authUrl.toString() });
});

app.get('/api/spotify-token', async (req, res) => {
  const { code } = req.query;
  
  try {
    const response = await axios.post('https://accounts.spotify.com/api/token', 
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'http://127.0.0.1:3000/callback'
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(
            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
          ).toString('base64')}`
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Error getting token:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to get token' });
  }
});

app.put('/api/spotify/play/:playlistId', async (req, res) => {
  const { playlistId } = req.params;
  const { device_id } = req.body;
  const { access_token } = req.headers;

  try {
    // First, get the playlist tracks
    const playlistResponse = await axios.get(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      }
    );

    const trackUris = playlistResponse.data.items.map(item => item.track.uri);

    // Then, start playback
    await axios.put(
      `https://api.spotify.com/v1/me/player/play?device_id=${device_id}`,
      {
        context_uri: `spotify:playlist:${playlistId}`
      },
      {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error playing playlist:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to play playlist' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 