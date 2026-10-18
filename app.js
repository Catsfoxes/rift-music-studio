const state = {
  tracks: [],
  selectedTrackId: null,
  bpm: 120,
  masterVolume: 0.9,
  isPlaying: false,
  startedAt: 0,
  pausedAt: 0,
};

const $ = (selector) => document.querySelector(selector);
const tracksEl = $('#tracks');
const emptyStateEl = $('#emptyState');
const trackCountEl = $('#trackCount');
const bpmEl = $('#bpm');
const bpmValueEl = $('#bpmValue');
const masterVolumeEl = $('#masterVolume');
const masterValueEl = $('#masterValue');
const transportEl = $('#transport');
const playButton = $('#playButton');
const fileInput = $('#audioFile');

function makeTrack(file) {
  return {
    id: crypto.randomUUID(),
    name: file.name.replace(/\.[^/.]+$/, ''),
    file,
    url: URL.createObjectURL(file),
    muted: false,
    volume: 0.8,
    audio: null,
  };
}

function addFiles(files) {
  [...files].filter((file) => file.type.startsWith('audio/')).forEach((file) => {
    const track = makeTrack(file);
    track.audio = new Audio(track.url);
    track.audio.preload = 'auto';
    track.audio.addEventListener('ended', () => {
      if (state.tracks.every((item) => item.audio.ended || item.audio.paused)) {
        state.isPlaying = false;
        updateTransport();
      }
    });
    state.tracks.push(track);
    if (!state.selectedTrackId) state.selectedTrackId = track.id;
  });
  render();
}

function render() {
  tracksEl.innerHTML = '';
  emptyStateEl.hidden = state.tracks.length > 0;
  trackCountEl.textContent = `${state.tracks.length} track${state.tracks.length === 1 ? '' : 's'}`;

  state.tracks.forEach((track, index) => {
    const row = document.createElement('article');
    row.className = `track ${track.id === state.selectedTrackId ? 'selected' : ''}`;
    row.dataset.id = track.id;
    row.innerHTML = `
      <div class="track-number">${index + 1}</div>
      <div class="track-info">
        <button class="track-name" data-action="select">${escapeHtml(track.name)}</button>
        <div class="waveform" aria-label="Audio waveform placeholder">
          ${Array.from({ length: 40 }, (_, i) => `<i style="--h:${18 + ((i * 17 + index * 11) % 58)}%"></i>`).join('')}
        </div>
      </div>
      <div class="track-controls">
        <button class="small ${track.muted ? 'active' : ''}" data-action="mute">${track.muted ? 'Unmute' : 'Mute'}</button>
        <label>Vol <input data-action="volume" type="range" min="0" max="1" step="0.01" value="${track.volume}"></label>
        <button class="small danger" data-action="remove">Remove</button>
      </div>
    `;
    tracksEl.appendChild(row);
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function syncAudio() {
  state.tracks.forEach((track) => {
    track.audio.volume = track.muted ? 0 : track.volume * state.masterVolume;
  });
}

function playAll() {
  if (!state.tracks.length) return;
  state.tracks.forEach((track) => track.audio.play().catch(() => {}));
  state.isPlaying = true;
  updateTransport();
}

function pauseAll() {
  state.tracks.forEach((track) => track.audio.pause());
  state.isPlaying = false;
  updateTransport();
}

function stopAll() {
  state.tracks.forEach((track) => {
    track.audio.pause();
    track.audio.currentTime = 0;
  });
  state.isPlaying = false;
  updateTransport();
}

function updateTransport() {
  transportEl.textContent = state.isPlaying ? 'Playing' : 'Ready';
  playButton.textContent = state.isPlaying ? 'Pause' : 'Play';
}

fileInput.addEventListener('change', (event) => {
  addFiles(event.target.files);
  event.target.value = '';
});

$('#playButton').addEventListener('click', () => state.isPlaying ? pauseAll() : playAll());
$('#stopButton').addEventListener('click', stopAll);
$('#addTrackButton').addEventListener('click', () => fileInput.click());

$('#clearButton').addEventListener('click', () => {
  state.tracks.forEach((track) => {
    track.audio.pause();
    URL.revokeObjectURL(track.url);
  });
  state.tracks = [];
  state.selectedTrackId = null;
  state.isPlaying = false;
  render();
  updateTransport();
});

tracksEl.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const track = state.tracks.find((item) => item.id === button.closest('.track').dataset.id);
  if (!track) return;

  if (button.dataset.action === 'select') {
    state.selectedTrackId = track.id;
    render();
  }
  if (button.dataset.action === 'mute') {
    track.muted = !track.muted;
    syncAudio();
    render();
  }
  if (button.dataset.action === 'remove') {
    track.audio.pause();
    URL.revokeObjectURL(track.url);
    state.tracks = state.tracks.filter((item) => item.id !== track.id);
    if (state.selectedTrackId === track.id) state.selectedTrackId = state.tracks[0]?.id ?? null;
    syncAudio();
    render();
  }
});

tracksEl.addEventListener('input', (event) => {
  if (event.target.dataset.action !== 'volume') return;
  const track = state.tracks.find((item) => item.id === event.target.closest('.track').dataset.id);
  if (!track) return;
  track.volume = Number(event.target.value);
  syncAudio();
});

bpmEl.addEventListener('input', () => {
  state.bpm = Number(bpmEl.value);
  bpmValueEl.textContent = state.bpm;
});

masterVolumeEl.addEventListener('input', () => {
  state.masterVolume = Number(masterVolumeEl.value);
  masterValueEl.textContent = `${Math.round(state.masterVolume * 100)}%`;
  syncAudio();
});

updateTransport();
render();
