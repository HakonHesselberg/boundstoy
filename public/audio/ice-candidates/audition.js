import { AuditionPlayer } from '../audition-player.js';

const status = document.getElementById('status');
const volume = document.getElementById('volume');
const mono = document.getElementById('mono');
const cards = document.getElementById('candidates');
let manifest, selectedCard;
const player = new AuditionPlayer(message => { status.textContent = message; }, playing => {
  for (const card of cards.children) card.removeAttribute('data-playing');
  if (playing) selectedCard?.setAttribute('data-playing', '');
});
player.setVolume(Number(volume.value) / 100);
document.getElementById('stop').addEventListener('click', () => player.stop());
volume.addEventListener('input', () => player.setVolume(Number(volume.value) / 100));
mono.addEventListener('change', () => player.setMono(mono.checked));

try {
  const response = await fetch('./manifest.json');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  manifest = await response.json();
  for (const candidate of manifest.candidates) {
    const card = document.createElement('article'), title = document.createElement('h2');
    card.id = candidate.id; title.textContent = candidate.label; card.append(title);
    const description = document.createElement('p');
    description.className = 'description'; description.textContent = candidate.description; card.append(description);
    const actions = document.createElement('div'); actions.className = 'actions';
    for (const withCues of [false, true]) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = withCues ? 'With cues' : 'Solo';
      button.id = `${candidate.id}-${withCues ? 'context' : 'solo'}`;
      button.setAttribute('aria-label', `${candidate.label}: ${button.textContent}`);
      button.addEventListener('click', () => {
        selectedCard = card;
        void player.play([{ file: candidate.file, time: 0 }, ...(withCues ? manifest.context : [])],
          `${candidate.label}${withCues ? ' with reference cues' : ' solo'}`);
      });
      actions.append(button);
    }
    card.append(actions);
    const download = document.createElement('a');
    download.href = candidate.file; download.download = candidate.file; download.textContent = 'Download WAV'; card.append(download);
    if (candidate.id !== 'silk') {
      const pattern = document.createElement('a');
      pattern.href = `${candidate.id}.strudel.js`; pattern.download = `${candidate.id}.strudel.js`;
      pattern.textContent = 'Editable Strudel patch'; card.append(pattern);
    }
    const credit = document.createElement('small');
    credit.textContent = `${candidate.license} · ${candidate.lufs} LUFS`; card.append(credit);
    cards.append(card);
  }
  status.textContent = 'Ready. Choose a solo preview or listen with reference cues.';
} catch (error) {
  status.textContent = `Cannot load the shortlist: ${error.message}. Reload to retry.`;
}
