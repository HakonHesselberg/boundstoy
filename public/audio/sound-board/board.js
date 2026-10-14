import { AuditionPlayer } from '../audition-player.js';

const status = document.getElementById('status'), cards = document.getElementById('candidates');
const groups = document.getElementById('groups'), volume = document.getElementById('volume');
let selectedCard;
const player = new AuditionPlayer(message => { status.textContent = message; }, playing => {
  for (const card of cards.children) card.removeAttribute('data-playing');
  if (playing && selectedCard) selectedCard.setAttribute('data-playing', '');
});
player.setVolume(Number(volume.value) / 100);
document.getElementById('stop').addEventListener('click', () => player.stop());
volume.addEventListener('input', () => player.setVolume(Number(volume.value) / 100));
document.getElementById('mono').addEventListener('change', event => player.setMono(event.target.checked));

try {
  const response = await fetch('./manifest.json');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const manifest = await response.json();
  const select = group => {
    player.stop();
    for (const button of groups.children) button.setAttribute('aria-pressed', String(button.id === `group-${group.id}`));
    for (const card of cards.children) card.hidden = card.dataset.role !== group.id;
    document.getElementById('group-title').textContent = group.label;
    document.getElementById('group-description').textContent = group.description;
    status.textContent = `Ready: ${group.label}. Choose a sound.`;
  };
  for (const group of manifest.groups) {
    const button = document.createElement('button');
    button.id = `group-${group.id}`; button.type = 'button'; button.textContent = group.label;
    button.setAttribute('aria-controls', 'candidates'); button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => select(group)); groups.append(button);
  }
  for (const entry of manifest.entries) {
    const card = document.createElement('article'), title = document.createElement('h3');
    card.id = entry.id; card.dataset.role = entry.role; title.textContent = entry.label;
    const badge = document.createElement('p');
    badge.className = 'badge';
    badge.textContent = `${entry.approved ? 'Approved - in game' : { current: 'Current game cue', alternative: 'Suggestion', 'ice-option': 'Existing ice option' }[entry.kind]} · ${entry.seconds.toFixed(2)} seconds`;
    const description = document.createElement('p');
    description.className = 'description'; description.textContent = entry.description;
    card.append(badge, title, description);
    const actions = document.createElement('div'); actions.className = 'actions';
    for (const [mode, label] of [['once', 'Hear once'], ['repeat', 'Repeat x4'], ['context', 'With explosion']]) {
      if (mode === 'repeat' && !entry.repeat) continue;
      const button = document.createElement('button');
      button.id = `${entry.id}-${mode}`; button.type = 'button'; button.textContent = label;
      if (mode !== 'once') button.className = 'secondary';
      button.setAttribute('aria-label', `${entry.label}: ${label}`);
      button.addEventListener('click', () => {
        selectedCard = card;
        const count = mode === 'repeat' ? manifest.repeatCount : 1;
        const events = Array.from({ length: count }, (_, i) => ({ ...entry, time: i ? i * entry.interval : 0 }));
        if (mode === 'context') events.push({ ...manifest.approvedExplosion,
          time: entry.role === 'warning' ? entry.seconds : entry.kind === 'ice-option' ? 2 : entry.seconds + .2 });
        void player.play(events, `${entry.label} - ${label}`);
      });
      actions.append(button);
    }
    const link = document.createElement('a');
    link.className = 'download'; link.href = entry.file; link.download = `${entry.id}.wav`;
    link.textContent = 'Download WAV';
    card.append(actions, link); cards.append(card);
  }
  select(manifest.groups[0]);
} catch (error) {
  status.textContent = `Cannot load the sound board: ${error.message}. Reload to retry.`;
}
