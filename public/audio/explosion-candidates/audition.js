import { AuditionPlayer } from '../audition-player.js';

const status = document.getElementById('status'), cards = document.getElementById('candidates');
const volume = document.getElementById('volume'), mono = document.getElementById('mono');
const pad = document.getElementById('pad'), phase = document.getElementById('phase');
let manifest, selectedCard, events = [], frame;
const player = new AuditionPlayer(message => { status.textContent = message; }, playing => {
  cancelAnimationFrame(frame);
  for (const card of cards.children) card.removeAttribute('data-playing');
  if (playing) { selectedCard.setAttribute('data-playing', ''); animate(); }
  else { pad.dataset.phase = 'idle'; phase.textContent = 'Ready'; }
});
player.setVolume(Number(volume.value) / 100);

function animate() {
  const elapsed = player.elapsed;
  if (elapsed === null) return;
  const event = events.findLast(event => elapsed >= event.time && elapsed < event.time + event.seconds);
  const state = !event ? 'idle' : event.part === 'warning' ? 'buildup'
    : elapsed - event.time < 1 / 120 ? 'impact' : 'tail';
  pad.dataset.phase = state;
  phase.textContent = { idle: 'Between sounds', buildup: 'Buildup', impact: 'Impact', tail: 'Harmless tail' }[state];
  frame = requestAnimationFrame(animate);
}

document.getElementById('stop').addEventListener('click', () => player.stop());
volume.addEventListener('input', () => player.setVolume(Number(volume.value) / 100));
mono.addEventListener('change', () => player.setMono(mono.checked));

try {
  const response = await fetch('./manifest.json');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  manifest = await response.json();
  for (const [index, candidate] of manifest.candidates.entries()) {
    const card = document.createElement('article'), title = document.createElement('h2');
    card.id = candidate.id;
    title.textContent = `${String(index + 1).padStart(2, '0')} / ${candidate.label}`;
    card.append(title);
    for (const [className, text] of [['description', candidate.description],
      ['parts', `Buildup: ${candidate.warningDescription}`], ['parts', `Impact: ${candidate.blastDescription}`]]) {
      const paragraph = document.createElement('p');
      paragraph.className = className; paragraph.textContent = text; card.append(paragraph);
    }
    const actions = document.createElement('div'); actions.className = 'actions';
    for (const [mode, label] of [['pair', 'Hear pair'], ['pattern', 'Pattern x4'], ['rapid', 'Rapid x8 (4/sec)'],
      ['warning', 'Buildup only'], ['blast', 'Explosion only']]) {
      const button = document.createElement('button');
      button.type = 'button'; button.id = `${candidate.id}-${mode}`; button.textContent = label;
      button.className = mode === 'pair' || mode === 'pattern' ? '' : 'secondary';
      button.setAttribute('aria-label', `${candidate.label}: ${label}`);
      button.addEventListener('click', () => {
        selectedCard = card;
        events = [];
        const rapid = mode === 'rapid', blastOnly = mode === 'blast' || rapid;
        const count = rapid ? manifest.rapidCount : mode === 'pattern' ? manifest.patternCount : 1;
        for (let i = 0; i < count; i++) {
          const time = i * (rapid ? manifest.rapidInterval : manifest.patternInterval);
          if (!blastOnly) events.push({ ...candidate.warning, time, part: 'warning' });
          if (mode !== 'warning') events.push({ ...candidate.blast,
            time: time + (blastOnly ? 0 : manifest.warningSeconds), part: 'blast' });
        }
        void player.play(events, `${candidate.label} - ${label}`, manifest.startDelay);
      });
      actions.append(button);
    }
    card.append(actions);
    const downloads = document.createElement('div'); downloads.className = 'downloads';
    for (const [part, label] of [['warning', 'Buildup WAV'], ['blast', 'Explosion WAV']]) {
      const link = document.createElement('a');
      link.href = candidate[part].file; link.download = candidate[part].file;
      link.textContent = label; downloads.append(link);
    }
    card.append(downloads); cards.append(card);
  }
  status.textContent = 'Ready. Choose a pair or hear its parts separately.';
} catch (error) {
  status.textContent = `Cannot load the suggestions: ${error.message}. Reload to retry.`;
}
