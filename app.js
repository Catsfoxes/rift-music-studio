const state = { tracks: [], selectedTrackId: null, bpm: 120, masterVolume: 0.9, isPlaying: false };
let audioContext = null;
const $ = (selector) => document.querySelector(selector);
const tracksEl = $('#tracks'), emptyStateEl = $('#emptyState'), trackCountEl = $('#trackCount');
const bpmEl = $('#bpm'), bpmValueEl = $('#bpmValue'), masterVolumeEl = $('#masterVolume'), masterValueEl = $('#masterValue');
const transportEl = $('#transport'), playButton = $('#playButton'), fileInput = $('#audioFile'), lastSoundEl = $('#lastSound');

function getAudioContext() { audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); if (audioContext.state === 'suspended') audioContext.resume(); return audioContext; }
function tone(freq, duration, type='sine', gain=0.16, start=0) {
  const ctx=getAudioContext(), now=ctx.currentTime+start, osc=ctx.createOscillator(), amp=ctx.createGain();
  osc.type=type; osc.frequency.setValueAtTime(freq,now); amp.gain.setValueAtTime(0.0001,now); amp.gain.exponentialRampToValueAtTime(Math.max(0.001,gain*state.masterVolume),now+0.012); amp.gain.exponentialRampToValueAtTime(0.0001,now+duration); osc.connect(amp).connect(ctx.destination); osc.start(now); osc.stop(now+duration+0.03);
}
function playInstrument(name) {
  const base=261.63;
  if(name==='piano'){ tone(base,.9,'triangle',.30); tone(base*1.5,.7,'sine',.08,.01); }
  if(name==='trumpet'){ tone(base*2,.45,'sawtooth',.10); tone(base*2.01,.45,'square',.045); }
  if(name==='flute'){ tone(base*2,.8,'sine',.20); tone(base*4,.55,'sine',.025,.03); }
  if(name==='clarinet'){ tone(base*1.5,.75,'square',.11); tone(base*3,.62,'triangle',.035); }
  if(name==='chimes'){ [1,2.01,3.01,4.02].forEach((m,i)=>tone(base*3*m,1.3,'sine',.08,i*.025)); }
  lastSoundEl.textContent = name[0].toUpperCase()+name.slice(1)+' ✦';
}

document.querySelectorAll('.instrument').forEach(button => button.addEventListener('click', () => playInstrument(button.dataset.instrument)));

function makeTrack(file) { return { id: crypto.randomUUID(), name: file.name.replace(/\.[^/.]+$/, ''), file, url: URL.createObjectURL(file), muted:false, volume:.8, audio:null }; }
function addFiles(files) { [...files].filter(f=>f.type.startsWith('audio/')).forEach(file=>{ const track=makeTrack(file); track.audio=new Audio(track.url); track.audio.preload='auto'; track.audio.addEventListener('ended',()=>{if(state.tracks.every(item=>item.audio.ended||item.audio.paused)){state.isPlaying=false;updateTransport();}}); state.tracks.push(track); if(!state.selectedTrackId) state.selectedTrackId=track.id; }); render(); }
function render(){ tracksEl.innerHTML=''; emptyStateEl.hidden=state.tracks.length>0; trackCountEl.textContent=`${state.tracks.length} track${state.tracks.length===1?'':'s'}`; state.tracks.forEach((track,index)=>{const row=document.createElement('article');row.className=`track ${track.id===state.selectedTrackId?'selected':''}`;row.dataset.id=track.id;row.innerHTML=`<div class="track-number">${index+1}</div><div class="track-info"><button class="track-name" data-action="select">${escapeHtml(track.name)}</button><div class="waveform" aria-label="Audio waveform placeholder">${Array.from({length:40},(_,i)=>`<i style="--h:${18+((i*17+index*11)%58)}%"></i>`).join('')}</div></div><div class="track-controls"><button class="small ${track.muted?'active':''}" data-action="mute">${track.muted?'Unmute':'Mute'}</button><label>Vol <input data-action="volume" type="range" min="0" max="1" step=".01" value="${track.volume}"></label><button class="small danger" data-action="remove">Remove</button></div>`;tracksEl.appendChild(row);}); }
function escapeHtml(value){return value.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function syncAudio(){state.tracks.forEach(t=>t.audio.volume=t.muted?0:t.volume*state.masterVolume);}
function playAll(){if(!state.tracks.length)return;state.tracks.forEach(t=>t.audio.play().catch(()=>{}));state.isPlaying=true;updateTransport();}
function pauseAll(){state.tracks.forEach(t=>t.audio.pause());state.isPlaying=false;updateTransport();}
function stopAll(){state.tracks.forEach(t=>{t.audio.pause();t.audio.currentTime=0;});state.isPlaying=false;updateTransport();}
function updateTransport(){transportEl.textContent=state.isPlaying?'Playing':'Ready';playButton.textContent=state.isPlaying?'Pause':'Play';}
fileInput.addEventListener('change',e=>{addFiles(e.target.files);e.target.value='';});
$('#playButton').addEventListener('click',()=>state.isPlaying?pauseAll():playAll());
$('#stopButton').addEventListener('click',stopAll);
$('#addTrackButton').addEventListener('click',()=>fileInput.click());
$('#clearButton').addEventListener('click',()=>{state.tracks.forEach(t=>{t.audio.pause();URL.revokeObjectURL(t.url);});state.tracks=[];state.selectedTrackId=null;state.isPlaying=false;render();updateTransport();});
tracksEl.addEventListener('click',e=>{const button=e.target.closest('[data-action]');if(!button)return;const track=state.tracks.find(item=>item.id===button.closest('.track').dataset.id);if(!track)return;if(button.dataset.action==='select'){state.selectedTrackId=track.id;render();}if(button.dataset.action==='mute'){track.muted=!track.muted;syncAudio();render();}if(button.dataset.action==='remove'){track.audio.pause();URL.revokeObjectURL(track.url);state.tracks=state.tracks.filter(item=>item.id!==track.id);if(state.selectedTrackId===track.id)state.selectedTrackId=state.tracks[0]?.id??null;syncAudio();render();}});
tracksEl.addEventListener('input',e=>{if(e.target.dataset.action!=='volume')return;const track=state.tracks.find(item=>item.id===e.target.closest('.track').dataset.id);if(!track)return;track.volume=Number(e.target.value);syncAudio();});
bpmEl.addEventListener('input',()=>{state.bpm=Number(bpmEl.value);bpmValueEl.textContent=state.bpm;});
masterVolumeEl.addEventListener('input',()=>{state.masterVolume=Number(masterVolumeEl.value);masterValueEl.textContent=`${Math.round(state.masterVolume*100)}%`;syncAudio();});
updateTransport();render();
