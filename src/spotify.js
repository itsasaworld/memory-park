// Audio Player Configuration
const PLAYLIST = [
  {
    title: "Bloodlust",
    artist: "Cokasian",
    url: "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0c6ff1bab.mp3?filename=bloodlust.mp3"
  }
];

let currentTrack = 0;
let isPlaying = false;
let audio = new Audio();
let widget;

// Initialize SoundCloud player
function initPlayer() {
  const iframe = document.querySelector('iframe');
  widget = SC.Widget(iframe);

  widget.bind(SC.Widget.Events.FINISH, function() {
    // When the track finishes, seek back to the beginning and play
    widget.seekTo(0);
    widget.play();
  });
}

// Load a track
function loadTrack(trackIndex) {
  const track = PLAYLIST[trackIndex];
  audio.src = track.url;
  updateTrackInfo(track);
}

// Update track information in the UI
function updateTrackInfo(track) {
  const trackName = document.querySelector('.track-name');
  const trackArtist = document.querySelector('.track-artist');
  
  trackName.textContent = track.title;
  trackArtist.textContent = track.artist;
}

// Play/Pause toggle
function togglePlay() {
  if (isPlaying) {
    audio.pause();
  } else {
    audio.play();
  }
  isPlaying = !isPlaying;
  updatePlayButton();
}

// Update progress bar
function updateProgress() {
  const progress = (audio.currentTime / audio.duration) * 100;
  const progressBar = document.querySelector('.progress-bar');
  if (progressBar) {
    progressBar.style.width = `${progress}%`;
  }
}

// Update play button icon
function updatePlayButton() {
  const button = document.getElementById('player-toggle');
  const icon = button.querySelector('.player-icon path');
  
  if (isPlaying) {
    icon.setAttribute('d', 'M6 19h4V5H6v14zm8-14v14h4V5h-4z');
  } else {
    icon.setAttribute('d', 'M8 5v14l11-7z');
  }
}

// Toggle player visibility
function togglePlayer() {
  const player = document.getElementById('spotify-player');
  if (player) {
    player.classList.toggle('collapsed');
  }
}

// Toggle help guide visibility
function toggleHelp() {
  const helpGuide = document.getElementById('help-tooltip');
  if (helpGuide) {
    helpGuide.classList.toggle('collapsed');
  }
}

// Initialize player controls
document.addEventListener('DOMContentLoaded', () => {
  initPlayer();

  // Add click handler for the player header
  const playerHeader = document.querySelector('.player-header');
  if (playerHeader) {
    playerHeader.addEventListener('click', togglePlayer);
  }

  // Add click handler for the toggle button
  const toggleButton = document.querySelector('.player-toggle');
  if (toggleButton) {
    toggleButton.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent the header click from firing
      togglePlayer();
    });
  }

  // Add click handler for the help header
  const helpHeader = document.querySelector('.help-header');
  if (helpHeader) {
    helpHeader.addEventListener('click', toggleHelp);
  }

  // Add click handler for the help toggle button
  const helpToggle = document.querySelector('.help-toggle');
  if (helpToggle) {
    helpToggle.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent the header click from firing
      toggleHelp();
    });
  }
});

export { togglePlayer, toggleHelp }; 