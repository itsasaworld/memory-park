// Environment configuration
export const config = {
  mapbox: {
    token: import.meta.env.VITE_MAPBOX_TOKEN,
    style: 'mapbox://styles/itsasasworld/cm8o36g5q005g01qdafs70jow'
  },
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL,
    key: import.meta.env.VITE_SUPABASE_ANON_KEY
  },
  security: {
    maxSearchLength: parseInt(import.meta.env.VITE_MAX_SEARCH_LENGTH) || 100,
    rateLimitInterval: parseInt(import.meta.env.VITE_RATE_LIMIT_INTERVAL) || 300
  }
};

// Validate configuration
console.log('Validating configuration...');
console.log('Environment variables status:', {
  VITE_MAPBOX_TOKEN: config.mapbox.token ? `Present (${config.mapbox.token.slice(0, 5)}...)` : 'Missing',
  VITE_SUPABASE_URL: config.supabase.url ? `Present (${config.supabase.url.slice(0, 20)}...)` : 'Missing',
  VITE_SUPABASE_ANON_KEY: config.supabase.key ? `Present (${config.supabase.key.slice(0, 5)}...)` : 'Missing'
});

if (!config.mapbox.token) {
  console.error('ERROR: Mapbox token is missing. Please add VITE_MAPBOX_TOKEN to your environment variables.');
  console.error('You can set this in your Netlify dashboard under Site settings > Build & deploy > Environment variables');
}

if (!config.supabase.url || !config.supabase.key) {
  console.error('ERROR: Supabase credentials are missing. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment variables.');
  console.error('You can set these in your Netlify dashboard under Site settings > Build & deploy > Environment variables');
} 