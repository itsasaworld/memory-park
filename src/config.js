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
if (!config.mapbox.token) {
  console.error('Mapbox token is not set');
}

if (!config.supabase.url || !config.supabase.key) {
  console.error('Supabase credentials are not set');
} 