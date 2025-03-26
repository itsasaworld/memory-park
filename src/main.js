import mapboxgl from 'mapbox-gl';
import * as THREE from 'three';
import { createClient } from '@supabase/supabase-js';

// Initialize Mapbox with environment variable
mapboxgl.accessToken = 'pk.eyJ1IjoiaXRzYXNhc3dvcmxkIiwiYSI6ImNtOG5xMDg3azAzMnQyanE3aTVjdWg3NGYifQ.FTD4G6jwPf-qdqpEZ73_Qg';

// Security constants from environment variables
const MAX_SEARCH_LENGTH = parseInt(import.meta.env.VITE_MAX_SEARCH_LENGTH);
const RATE_LIMIT_INTERVAL = parseInt(import.meta.env.VITE_RATE_LIMIT_INTERVAL);

// Create map instance
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/itsasasworld/cm8o36g5q005g01qdafs70jow',
  center: [-87.6298, 41.8781], // Default to Chicago
  zoom: 15,
  pitch: 60,
  bearing: 0,
  antialias: true,
  maxZoom: 20,
  minZoom: 10,
  maxPitch: 85,
  minPitch: 0,
  maxBounds: [-180, -85, 180, 85],
  attributionControl: false,
  transformRequest: (url, resourceType) => {
    console.log('Loading resource:', resourceType, url);
    return { url };
  }
});

// Try to get user's location and center map
if ("geolocation" in navigator) {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      map.setCenter([longitude, latitude]);
    },
    (error) => {
      console.log("Error getting location:", error);
      // Keep default Chicago coordinates if location access fails
    }
  );
}

// Add map controls with constraints
const nav = new mapboxgl.NavigationControl({
  showCompass: true,
  showZoom: true,
  visualizePitch: false
});
map.addControl(nav);

// Search functionality
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
let searchTimeout = null;
let lastSearchTime = 0;

// Rate limiting function
function isRateLimited() {
  const now = Date.now();
  if (now - lastSearchTime < RATE_LIMIT_INTERVAL) {
    return true;
  }
  lastSearchTime = now;
  return false;
}

// Sanitize input
function sanitizeInput(input) {
  return input.slice(0, MAX_SEARCH_LENGTH).replace(/[<>]/g, '');
}

// Handle search input
searchInput.addEventListener('input', (e) => {
  const query = sanitizeInput(e.target.value);
  
  if (query.length < 2) {
    searchResults.style.display = 'none';
    return;
  }

  if (isRateLimited()) {
    return;
  }

  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxgl.accessToken}&types=place,locality,neighborhood,address,poi&language=en`)
      .then(response => response.json())
      .then(data => {
        searchResults.innerHTML = '';
        if (data.features.length > 0) {
          data.features.forEach(feature => {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.textContent = feature.place_name;
            div.addEventListener('click', () => {
              // Exit pointer lock if active
              if (isPointerLocked) {
                document.exitPointerLock();
              }
              
              // Reset all movement states
              moveForward = false;
              moveBackward = false;
              moveLeft = false;
              moveRight = false;
              isSprinting = false;
              isJumping = false;
              canJump = true;
              
              // Reset velocity and rotation
              velocity.set(0, 0, 0);
              jumpVelocity = 0;
              camera.rotation.set(0, 0, 0);
              
              // Update map center and camera
              map.setCenter(feature.center);
              map.setZoom(20);
              map.setPitch(85);
              map.setBearing(0);
              
              // Force a camera update
              const center = map.getCenter();
              camera.position.x = center.lng * 100;
              camera.position.z = center.lat * 100;
              camera.position.y = 1.7;
              
              // Force a render update
              renderer.render(scene, camera);
              
              searchResults.style.display = 'none';
              searchInput.value = '';
            });
            searchResults.appendChild(div);
          });
          searchResults.style.display = 'block';
        } else {
          searchResults.style.display = 'none';
        }
      })
      .catch(error => {
        console.error('Error fetching search results:', error);
        searchResults.style.display = 'none';
      });
  }, 300);
});

// Close search results when clicking outside
document.addEventListener('click', (e) => {
  if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
    searchResults.style.display = 'none';
  }
});

// Log when map and style are loaded
map.on('load', () => {
  console.log('Map loaded successfully');
});

map.on('style.load', () => {
  console.log('Style loaded successfully');

  // Add composite source if it doesn't exist
  if (!map.getSource('composite')) {
    map.addSource('composite', {
      'type': 'vector',
      'url': 'mapbox://mapbox.mapbox-streets-v8'
    });
  }
  
  // Add terrain source and layer
  if (!map.getSource('mapbox-dem')) {
    map.addSource('mapbox-dem', {
      'type': 'raster-dem',
      'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
      'tileSize': 512,
      'maxzoom': 14
    });
  }

  // Set terrain
  map.setTerrain({
    'source': 'mapbox-dem',
    'exaggeration': 1.5
  });

  // Add sky layer if it doesn't exist
  if (!map.getLayer('sky')) {
    map.addLayer({
      'id': 'sky',
      'type': 'sky',
      'paint': {
        'sky-type': 'atmosphere',
        'sky-atmosphere-sun': [0.0, 90.0],
        'sky-atmosphere-sun-intensity': 5
      }
    });
  }

  // Wait a bit to ensure sources are loaded
  setTimeout(() => {
    // Add 3D buildings layer if it doesn't exist
    if (!map.getLayer('3d-buildings')) {
      map.addLayer({
        'id': '3d-buildings',
        'source': 'composite',
        'source-layer': 'building',
        'type': 'fill-extrusion',
        'minzoom': 14,
        'paint': {
          'fill-extrusion-color': [
            'interpolate',
            ['linear'],
            ['get', 'height'],
            0, '#c9c9c9',
            50, '#d4d4d4',
            100, '#dfdfdf',
            200, '#ebebeb',
            400, '#f5f5f5'
          ],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'min_height'],
          'fill-extrusion-opacity': 0.9,
          'fill-extrusion-vertical-gradient': true
        },
        'filter': ['has', 'height']
      });
    }

    // Add ambient light effect for buildings
    if (!map.getLayer('building-light')) {
      map.addLayer({
        'id': 'building-light',
        'type': 'fill-extrusion',
        'source': 'composite',
        'source-layer': 'building',
        'minzoom': 14,
        'paint': {
          'fill-extrusion-color': '#ffffff',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'min_height'],
          'fill-extrusion-opacity': 0.1,
          'fill-extrusion-vertical-gradient': true
        },
        'filter': ['has', 'height']
      });
    }

    // Hide business labels but keep POI and building names
    if (!map.getLayer('business-labels')) {
      map.addLayer({
        'id': 'business-labels',
        'source': 'composite',
        'source-layer': 'poi_label',
        'type': 'symbol',
        'filter': ['==', ['get', 'class'], 'business'],
        'paint': {
          'text-opacity': 0
        }
      });
    }

    console.log('All layers added successfully');
  }, 1000); // Wait 1 second for sources to load
});

// Initialize Three.js for rain effect
const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ 
  alpha: true,
  antialias: true,
  canvas: document.createElement('canvas'),
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x000000, 0);
renderer.domElement.style.position = 'absolute';
renderer.domElement.style.top = '0';
renderer.domElement.style.left = '0';
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = '100%';
renderer.domElement.style.pointerEvents = 'none';
document.body.appendChild(renderer.domElement);

// First person camera controls
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;
let isSprinting = false;
let isJumping = false;
let velocity = new THREE.Vector3();
let jumpVelocity = 0;

// Movement constants
const WALK_SPEED = 0.01;
const SPRINT_SPEED = 0.03;
const JUMP_FORCE = 0.2;
const GRAVITY = 0.008;
const ACCELERATION = 0.004;
const DECELERATION = 0.004;

// Add keyboard controls
document.addEventListener('keydown', (event) => {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveForward = true;
      break;
    case 'ArrowDown':
    case 'KeyS':
      moveBackward = true;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      moveLeft = true;
      break;
    case 'ArrowRight':
    case 'KeyD':
      moveRight = true;
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      isSprinting = true;
      break;
    case 'Space':
      if (canJump && !isJumping) {
        jumpVelocity = JUMP_FORCE;
        isJumping = true;
        canJump = false;
      }
      break;
    case 'Escape':
      if (isPointerLocked) {
        document.exitPointerLock();
      }
      break;
  }
});

document.addEventListener('keyup', (event) => {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveForward = false;
      break;
    case 'ArrowDown':
    case 'KeyS':
      moveBackward = false;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      moveLeft = false;
      break;
    case 'ArrowRight':
    case 'KeyD':
      moveRight = false;
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      isSprinting = false;
      break;
    case 'Space':
      if (jumpVelocity > 0) {
        jumpVelocity = 0;
      }
      break;
  }
});

// Add mouse look controls
let isPointerLocked = false;
document.addEventListener('click', (e) => {
  if (!isPointerLocked && e.target === renderer.domElement) {
    renderer.domElement.requestPointerLock();
  }
});

document.addEventListener('pointerlockchange', () => {
  isPointerLocked = document.pointerLockElement === renderer.domElement;
  
  // Reset all movement states and velocity when entering/exiting pointer lock
  moveForward = false;
  moveBackward = false;
  moveLeft = false;
  moveRight = false;
  isSprinting = false;
  isJumping = false;
  canJump = true;
  velocity.set(0, 0, 0);
  jumpVelocity = 0;
  
  // If exiting pointer lock, ensure camera rotation is reset
  if (!isPointerLocked) {
    camera.rotation.set(0, 0, 0);
  }
});

document.addEventListener('mousemove', (event) => {
  if (isPointerLocked) {
    // Horizontal look (left/right)
    camera.rotation.y -= event.movementX * 0.002;
    
    // Vertical look (up/down)
    camera.rotation.x -= event.movementY * 0.002;
    
    // Limit vertical look to prevent over-rotation
    camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, camera.rotation.x));
  }
});

// Position camera for first person view
camera.position.set(0, 1.7, 0); // Set camera height to average human height
camera.rotation.order = 'YXZ'; // This order prevents gimbal lock

// Add walking animation variables
let walkingTime = 0;
const walkingSpeed = 0.1;
const walkingHeight = 0.05; // Amount of vertical bobbing
const walkingFrequency = 5; // Speed of the bobbing motion

// Create rain effect
const rainGeometry = new THREE.BufferGeometry();
const rainCount = 500000;
const positions = new Float32Array(rainCount * 3);
const velocities = new Float32Array(rainCount);

// Initialize raindrop positions and velocities
for (let i = 0; i < rainCount * 3; i += 3) {
  positions[i] = (Math.random() - 0.5) * 10000;     // x - wider spread
  positions[i + 1] = (Math.random() - 0.5) * 10000; // y - wider spread
  positions[i + 2] = (Math.random() - 0.5) * 10000; // z - wider spread
}

for (let i = 0; i < rainCount; i++) {
  velocities[i] = -2.0; // Faster fall speed
}

rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

const rainMaterial = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 1.0, // Larger raindrops
  transparent: true,
  opacity: 1,
  sizeAttenuation: false,
  depthWrite: false,
  depthTest: false,
  blending: THREE.AdditiveBlending
});

const rain = new THREE.Points(rainGeometry, rainMaterial);
scene.add(rain);

// Add a variable to track the current zoom level
let currentZoom = 15;

// Add comprehensive error handling
map.on('error', (e) => {
  console.error('Map error:', e.error);
});

map.on('style.error', (e) => {
  console.error('Style error:', e.error);
});

map.on('source.error', (e) => {
  console.error('Source error:', e.error);
});

map.on('tile.error', (e) => {
  console.error('Tile error:', e.error);
});

// Update current zoom when map zooms
map.on('zoom', () => {
  currentZoom = map.getZoom();
  // Prevent zooming out too far when in first-person mode
  if (isPointerLocked && currentZoom < 15) {
    map.easeTo({
      zoom: 15,
      duration: 0,
      essential: true
    });
  }
});

// Update the map camera sync to maintain street view
map.on('move', () => {
  if (!isPointerLocked) {
    const center = map.getCenter();
    const pitch = map.getPitch();
    const bearing = map.getBearing();
    
    // Update Three.js camera to match map view
    camera.position.set(
      center.lng * 100,
      1.7,
      center.lat * 100
    );
    
    // Convert map rotation to Three.js rotation
    camera.rotation.y = -bearing * Math.PI / 180;
    camera.rotation.x = -pitch * Math.PI / 180;
    
    // Force a render update
    renderer.render(scene, camera);
  }
});

// Start animation
animate();

// Handle window resize
const handleResize = () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
};

window.addEventListener('resize', handleResize);

// Update animation loop with first person movement
function animate() {
  requestAnimationFrame(animate);
  
  // Update camera movement
  if (isPointerLocked) {
    const speed = isSprinting ? SPRINT_SPEED : WALK_SPEED;
    
    // Only apply acceleration if pointer is locked
    if (moveForward) velocity.z -= ACCELERATION;
    if (moveBackward) velocity.z += ACCELERATION;
    if (moveLeft) velocity.x -= ACCELERATION;
    if (moveRight) velocity.x += ACCELERATION;
    
    // Apply stronger deceleration when no keys are pressed
    if (!moveForward && !moveBackward) {
      velocity.z = 0;  // Immediate stop for z-axis
    }
    if (!moveLeft && !moveRight) {
      velocity.x = 0;  // Immediate stop for x-axis
    }

    // Limit maximum velocity
    const maxSpeed = speed;
    velocity.x = Math.max(Math.min(velocity.x, maxSpeed), -maxSpeed);
    velocity.z = Math.max(Math.min(velocity.z, maxSpeed), -maxSpeed);

    // Apply movement relative to camera direction
    const moveX = velocity.x * Math.cos(camera.rotation.y) + velocity.z * Math.sin(camera.rotation.y);
    const moveZ = velocity.z * Math.cos(camera.rotation.y) - velocity.x * Math.sin(camera.rotation.y);

    // Update walking animation
    walkingTime += walkingSpeed;
    const verticalOffset = Math.sin(walkingTime * walkingFrequency) * walkingHeight;
    
    // Handle jumping
    if (isJumping) {
      jumpVelocity -= GRAVITY;
      if (jumpVelocity <= 0) {
        jumpVelocity = 0;
        isJumping = false;
        canJump = true;
      }
    }
    
    // Apply movement, walking animation, and jumping
    camera.position.x += moveX;
    camera.position.z += moveZ;
    camera.position.y = 1.7 + verticalOffset + jumpVelocity;

    // Update map camera to match street view
    const mapCenter = map.getCenter();
    mapCenter.lng = camera.position.x / 100;
    mapCenter.lat = camera.position.z / 100;
    map.easeTo({
      center: mapCenter,
      duration: 0,
      essential: true
    });

    // Set map pitch and bearing to match street view
    map.easeTo({
      pitch: 85,
      bearing: -camera.rotation.y * 180 / Math.PI,
      duration: 0,
      essential: true
    });
  }

  // Update rain positions and color
  const positions = rainGeometry.attributes.position.array;
  const zoomScale = currentZoom / 15;
  
  // Always use white color for better visibility
  rainMaterial.color.setHex(0xffffff);
  
  for (let i = 0; i < positions.length; i += 3) {
    positions[i + 1] += velocities[i / 3] * zoomScale;

    // Reset raindrops when they fall below view
    if (positions[i + 1] < -5000) {
      positions[i + 1] = 5000;
      // Reset position relative to camera with wider spread
      positions[i] = camera.position.x + (Math.random() - 0.5) * 10000 * zoomScale;
      positions[i + 2] = camera.position.z + (Math.random() - 0.5) * 10000 * zoomScale;
      velocities[i / 3] = -2.0; // Match initial fall speed
    }
  }
  rainGeometry.attributes.position.needsUpdate = true;

  renderer.render(scene, camera);
}

// Initialize Supabase client
const supabaseUrl = 'https://wfspbewhxxklgilaofgh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indmc3BiZXdoeHhrbGdpbGFvZmdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI5MzY5MDcsImV4cCI6MjA1ODUxMjkwN30.Fwdz43TET0DJIflkQgIzLdKOdvHSyqefBXvWL20UMj8';
const supabase = createClient(supabaseUrl, supabaseKey);

// Memory UI Elements
const memoryButton = document.getElementById('memory-button');
const memoryFormContainer = document.getElementById('memory-form-container');
const memoryForm = document.getElementById('memory-form');
const closeButton = document.querySelector('.close-button');

// Memory markers storage
let memoryMarkers = [];
let selectedLocation = null;

// Add click handler for memory placement
map.on('click', (e) => {
  // Exit pointer lock if active
  if (document.pointerLockElement === document.body) {
    document.exitPointerLock();
  }

  // Store the clicked location
  selectedLocation = {
    lat: e.lngLat.lat,
    lng: e.lngLat.lng
  };

  // Show the memory form
  memoryFormContainer.style.display = 'block';
});

// Show/hide memory form
memoryButton.addEventListener('click', () => {
  // Exit pointer lock if active
  if (document.pointerLockElement) {
    document.exitPointerLock();
  }
  
  // Show the form without setting a location
  memoryFormContainer.style.display = 'block';
  selectedLocation = null;
});

closeButton.addEventListener('click', () => {
  memoryFormContainer.style.display = 'none';
  selectedLocation = null;
});

// Handle memory form submission
memoryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (!selectedLocation) {
    alert('Please click on the map to select a location for your memory.');
    return;
  }
  
  const title = document.getElementById('memory-title').value;
  const content = document.getElementById('memory-content').value;
  
  try {
    console.log('Attempting to save memory:', {
      title,
      content,
      latitude: selectedLocation.lat,
      longitude: selectedLocation.lng
    });

    const { data, error } = await supabase
      .from('memories')
      .insert([
        {
          title,
          content,
          latitude: selectedLocation.lat,
          longitude: selectedLocation.lng,
          created_at: new Date().toISOString()
        }
      ])
      .select(); // Add this to return the inserted row
      
    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    
    if (!data || data.length === 0) {
      throw new Error('No data returned from server');
    }
    
    console.log('Memory saved successfully:', data);
    
    // Add new memory marker to the map
    addMemoryMarker(data[0]);
    
    // Clear form and hide
    memoryForm.reset();
    memoryFormContainer.style.display = 'none';
    selectedLocation = null;
    
  } catch (error) {
    console.error('Error saving memory:', error);
    alert(`Failed to save memory: ${error.message}`);
  }
});

// Function to generate random pastel colors
function generatePastelColor() {
  const hue = Math.random() * 360;
  return `hsla(${hue}, 95%, 65%, 0.9)`; // Higher saturation (95%), higher lightness (65%), higher opacity (0.9)
}

// Function to create a glow layer for memory hotspots
function createGlowLayer() {
  if (!map.getLayer('memory-glow')) {
    map.addLayer({
      'id': 'memory-glow',
      'type': 'circle',
      'source': 'memories',
      'paint': {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10, 50,  // Increased base radius
          20, 250  // Increased max radius
        ],
        'circle-color': [
          'case',
          ['has', 'color'],
          ['get', 'color'],
          generatePastelColor()
        ],
        'circle-opacity': 0.9,  // Increased from 0.8
        'circle-blur': 2.0,     // Reduced blur for sharper glow
        'circle-stroke-width': 0,
        'circle-translate': [0, 0],
        'circle-pitch-alignment': 'map'
      }
    });
  }
}

// Modify the map.on('load') event to include the glow layer
map.on('load', async () => {
  try {
    // Create the memories source if it doesn't exist
    if (!map.getSource('memories')) {
      map.addSource('memories', {
        'type': 'geojson',
        'data': {
          'type': 'FeatureCollection',
          'features': []
        }
      });
    }

    // Create the glow layer
    createGlowLayer();

    // Load existing memories
    const { data: memories, error } = await supabase
      .from('memories')
      .select('*');
      
    if (error) throw error;
    
    // Create a GeoJSON feature collection for all memories
    const features = memories.map(memory => ({
      'type': 'Feature',
      'geometry': {
        'type': 'Point',
        'coordinates': [memory.longitude, memory.latitude]
      },
      'properties': {
        'id': memory.id,
        'color': generatePastelColor()
      }
    }));

    // Update the memories source with all features at once
    map.getSource('memories').setData({
      'type': 'FeatureCollection',
      'features': features
    });

    // Add markers for each memory
    memories.forEach(memory => {
      addMemoryMarker(memory);
    });
    
  } catch (error) {
    console.error('Error loading memories:', error);
  }
});

// Modify the addMemoryMarker function
function addMemoryMarker(memory) {
  // Create marker element
  const el = document.createElement('div');
  el.className = 'memory-marker';
  el.style.width = '24px';
  el.style.height = '24px';
  el.style.backgroundImage = 'url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIgZmlsbD0iIzRDQUY1MCIgZmlsbC1vcGFjaXR5PSIwLjkiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI2IiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg==)';
  el.style.backgroundSize = 'cover';
  el.style.cursor = 'pointer';
  
  // Create popup with improved configuration
  const popup = new mapboxgl.Popup({
    offset: [0, -5],
    closeButton: true,
    closeOnClick: false,
    maxWidth: '300px',
    className: 'memory-popup-container',
    anchor: 'center',
    focusAfterOpen: false
  })
  .setHTML(`
    <div class="memory-popup">
      <h3>${memory.title}</h3>
      <div class="content-wrapper">
        <p>${memory.content}</p>
        <div class="date">${new Date(memory.created_at).toLocaleDateString()}</div>
      </div>
    </div>
  `);
  
  // Add marker to map
  const marker = new mapboxgl.Marker(el)
    .setLngLat([memory.longitude, memory.latitude])
    .setPopup(popup)
    .addTo(map);
  
  memoryMarkers.push(marker);

  // Update the memories source with the new memory
  const memoriesSource = map.getSource('memories');
  const currentFeatures = memoriesSource._data.features || [];
  
  // Add the new memory feature
  const newFeature = {
    'type': 'Feature',
    'geometry': {
      'type': 'Point',
      'coordinates': [memory.longitude, memory.latitude]
    },
    'properties': {
      'id': memory.id,
      'color': generatePastelColor()
    }
  };

  // Update the source data
  memoriesSource.setData({
    'type': 'FeatureCollection',
    'features': [...currentFeatures, newFeature]
  });
}
