/**
 * Rift Music Studio — tiny prototype engine
 *
 * OUTLINE
 * 1. Track data: instrument, volume, notes, effects.
 * 2. Pattern builder: create notes from a simple beat pattern.
 * 3. Mixer: combine multiple tracks into one timeline.
 * 4. Transport: play/stop will eventually connect to Web Audio.
 * 5. Future UI: piano roll, instrument picker, mixer, BPM control.
 * 6. Future AI bridge: accept a text idea and turn it into structured music data.
 *
 * This first version intentionally has no external dependencies.
 */

export function createTrack(name, instrument = "sine", volume = 0.8) {
  return { name, instrument, volume, notes: [] };
}

export function addNote(track, pitch, start, duration = 1, velocity = 1) {
  if (!Number.isFinite(pitch) || !Number.isFinite(start) || !Number.isFinite(duration)) {
    throw new TypeError("pitch, start, and duration must be numbers");
  }
  if (duration <= 0) throw new RangeError("duration must be greater than 0");
  track.notes.push({ pitch, start, duration, velocity });
  return track;
}

export function createPattern(track, pattern, pitch = 60, step = 1) {
  [...pattern].forEach((hit, index) => {
    if (hit === "x" || hit === "X" || hit === "1") addNote(track, pitch, index * step, step);
  });
  return track;
}

export function mixTracks(tracks) {
  return tracks
    .flatMap(track => track.notes.map(note => ({ ...note, track: track.name, instrument: track.instrument, volume: track.volume })))
    .sort((a, b) => a.start - b.start);
}

export function getSongLength(tracks) {
  const notes = mixTracks(tracks);
  if (notes.length === 0) return 0;
  return Math.max(...notes.map(note => note.start + note.duration));
}

export function runSelfTest() {
  const drums = createTrack("Drums", "noise");
  const melody = createTrack("Magic Lead", "sine");

  // Four drum hits across two beats.
  createPattern(drums, "x-x-x-x-", 36, 0.25);
  addNote(melody, 60, 0, 0.5);
  addNote(melody, 64, 0.5, 0.5);
  addNote(melody, 67, 1, 1);

  const mixed = mixTracks([drums, melody]);
  const length = getSongLength([drums, melody]);

  if (mixed.length !== 7) throw new Error("Self-test failed: unexpected note count");
  if (length !== 2) throw new Error("Self-test failed: unexpected song length");

  return { passed: true, noteCount: mixed.length, songLength: length, message: "Rift Music Studio prototype self-test passed!" };
}

console.log(runSelfTest());
