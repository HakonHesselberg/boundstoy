import './style.css';
import { LEVELS } from '../data/levels.ts';
import { TERRAIN, type Tile } from '../data/terrain.ts';
import { createState, step, hazardSample, ascii, DT, STILL } from '../core/simulation.ts';
import { importLevel, parseLevel, type Level, type Point } from '../core/level.ts';
import { paint, placeSaw, blankLevel, type Brush } from '../core/editor.ts';
import { readProgress, recordFinish, PROGRESS_KEY, DRAFT_KEY, type Progress } from '../application/storage.ts';
import { nextCourse, finishResult } from '../application/campaign.ts';
import { DEFAULT_PREFERENCES, PREFERENCES_KEY, readPreferences } from '../application/preferences.ts';
import { Audio } from './audio.ts';
import { courseGuide, deathMessage } from '../application/guidance.ts';
import { createRenderLoop, fixedSteps } from '../application/render-loop.ts';
import { Scene } from './scene.ts';

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing UI element: ${id}`);
  return node as T;
}
const text = (id: string, value: string) => {
  const node = element(id);
  if (node.textContent !== value) node.textContent = value;
};
const timeLabel = (ticks: number) => {
  const hundredths = Math.floor(ticks * DT * 100);
  return `${String(Math.floor(hundredths / 6000)).padStart(2, '0')}:${String(Math.floor(hundredths / 100) % 60).padStart(2, '0')}.${String(hundredths % 100).padStart(2, '0')}`;
};
let noticeTimer = 0;
function notify(message: string, error = false) {
  clearTimeout(noticeTimer);
  const menu = element<HTMLDialogElement>('game-menu');
  (menu.open ? menu : element('boundstoy')).append(element('notice'));
  text('notice-text', message);
  element('notice').hidden = false;
  element('notice').classList.toggle('error', error);
  if (!error) noticeTimer = window.setTimeout(() => { element('notice').hidden = true; }, 4500);
}
function report(context: string, error: unknown) {
  console.error(`[Boundstoy] ${context}`, error);
  notify(`${context}: ${error instanceof Error ? error.message : String(error)}`, true);
}

const keys = new Set<string>();
const touchPointers = new Map<number, string>();
const directions: Record<string, Point> = { up: { x: 0, y: -1 }, left: { x: -1, y: 0 }, down: { x: 0, y: 1 }, right: { x: 1, y: 0 } };
const keyDirections: Record<string, string> = { KeyW: 'up', ArrowUp: 'up', KeyA: 'left', ArrowLeft: 'left', KeyS: 'down', ArrowDown: 'down', KeyD: 'right', ArrowRight: 'right' };

function boot(scene: Scene) {
  const viewport = element('viewport'), menu = element<HTMLDialogElement>('game-menu'), audio = new Audio();
  const abort = new AbortController(), options = { signal: abort.signal };
  let level = LEVELS[0], state = createState(level), selectedCourse = 0;
  let mode: 'play' | 'edit' = 'play', draft: Level | null = null;
  let history: Level[] = [], brush: Brush = '.', sawStart: Point | null = null;
  let painting = false, lastPaint = '', testing = false, started = false, paused = true;
  let paintingPointer: number | null = null;
  let accumulator = 0, visualTime = 0;
  let progress: Progress = {};
  let storageFailed = false;
  let feedbackUntil = 0;
  let lastDeath = '';
  let result: ReturnType<typeof finishResult> | null = null;
  let progressSaved = true;
  let preferences = DEFAULT_PREFERENCES, audioBusy = false, audioReady = false;
  const loop = createRenderLoop({
    request: callback => requestAnimationFrame(callback),
    cancel: id => cancelAnimationFrame(id),
    render: frame,
  });
  loop.setVisible(!document.hidden);
  scene.onInvalidate = loop.invalidate;
  try { progress = readProgress(localStorage.getItem(PROGRESS_KEY)); }
  catch (error) { report('Could not load local progress', error); }
  try { preferences = readPreferences(localStorage.getItem(PREFERENCES_KEY)); }
  catch (error) { report('Could not load sound preferences', error); }
  audio.setVolume(preferences.volume);

  function soundControls() {
    for (const id of ['audio', 'intro-audio']) {
      const button = element<HTMLButtonElement>(id);
      text(id, preferences.sound ? 'Sound on' : 'Sound off');
      button.setAttribute('aria-pressed', String(preferences.sound));
      button.setAttribute('aria-label', preferences.sound ? 'Mute sound' : 'Enable sound');
      button.setAttribute('aria-disabled', String(audioBusy));
    }
    element<HTMLInputElement>('sound-volume').value = String(preferences.volume * 100);
    text('sound-volume-label', `Volume ${Math.round(preferences.volume * 100)}%`);
  }
  function savePreferences() {
    try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)); }
    catch (error) { report('Could not save sound preferences', error); }
  }
  async function setSound(enabled: boolean) {
    if (audioBusy) return;
    audioBusy = true; soundControls();
    try {
      await audio.setEnabled(enabled); audioReady = enabled;
      preferences = { ...preferences, sound: enabled };
      savePreferences();
      if (enabled) audio.play('checkpoint');
    } catch (error) { report('Could not change sound', error); }
    finally { audioBusy = false; soundControls(); }
  }
  function activateSound() {
    if (preferences.sound && !audioReady) void setSound(true);
  }
  soundControls();

  function clearInput() {
    for (const pointer of touchPointers.keys()) {
      document.querySelectorAll<HTMLButtonElement>('[data-direction]').forEach(button => {
        if (button.hasPointerCapture(pointer)) button.releasePointerCapture(pointer);
      });
    }
    keys.clear(); touchPointers.clear();
    document.querySelectorAll('.touch-controls button').forEach(button => button.classList.remove('pressed'));
    if (paintingPointer !== null && viewport.hasPointerCapture(paintingPointer)) viewport.releasePointerCapture(paintingPointer);
    paintingPointer = null; painting = false; lastPaint = '';
  }
  function movement(): Point {
    const active = new Set([...keys].map(key => keyDirections[key]).filter(Boolean));
    for (const dir of touchPointers.values()) active.add(dir);
    let x = 0, y = 0;
    for (const dir of active) { x += directions[dir].x; y += directions[dir].y; }
    return { x, y };
  }
  function syncRendering() {
    // A modal freezes all background visuals, including entry/editor/victory.
    loop.setActive(!menu.open && (!started || mode === 'edit' || state.won || !paused));
  }
  function saveDraft() {
    if (!draft) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      text('draft-status', 'Draft saved on this device.'); storageFailed = false;
    } catch (error) {
      text('draft-status', 'Not saved. Export JSON to keep your work.');
      if (!storageFailed) report('Could not save draft; export it instead', error);
      storageFailed = true;
    }
  }
  function courseCards() {
    text('completion-count', `${LEVELS.filter(course => progress[course.id]).length} / ${LEVELS.length} cleared`);
    const list = element('course-list'); list.replaceChildren();
    LEVELS.forEach((course, index) => {
      const button = document.createElement('button');
      button.className = `course-card${selectedCourse === index && !testing ? ' selected' : ''}`;
      button.dataset.level = String(index);
      button.setAttribute('aria-pressed', String(selectedCourse === index && !testing));
      const number = document.createElement('span'); number.className = 'course-number'; number.textContent = String(index + 1).padStart(2, '0');
      const body = document.createElement('span'), title = document.createElement('strong'), subtitle = document.createElement('small');
      title.textContent = course.name;
      const best = progress[course.id];
      subtitle.textContent = best ? `Best ${timeLabel(best.ticks)} · ${best.deaths} retries` : 'Ready to play';
      body.append(title, subtitle);
      const arrow = document.createElement('span'); arrow.textContent = best ? '✓' : '↗';
      button.append(number, body, arrow); list.append(button);
    });
  }
  function overlay() {
    element('overlay').hidden = menu.open || mode === 'edit' || started && !paused && !state.won;
    element('finish-stats').hidden = !state.won;
    element('finish-comparison').hidden = !state.won || testing;
    element('intro-audio').hidden = started || mode === 'edit';
    element('retry-course').hidden = !started || mode === 'edit';
    if (mode === 'edit') return;
    if (state.won) {
      const next = nextCourse(LEVELS, progress, selectedCourse);
      const complete = !testing && next === null;
      text('overlay-kicker', testing ? 'PLAYTEST COMPLETE' : state.deaths === 0 ? 'CLEAN RUN · ZERO RETRIES' : 'NICE FINISH');
      text('overlay-title', complete ? 'Campaign complete.' : 'Level clear.');
      text('overlay-copy', testing ? 'Back to the editor, or give it another run.'
        : complete ? `All ${LEVELS.length} levels cleared. Go again and chase your best times.`
        : next !== null ? `Up next: ${LEVELS[next].name}.` : 'Choose another route to master.');
      text('finish-time', timeLabel(state.tick));
      text('finish-retries', String(state.deaths));
      text('finish-best', testing ? 'PLAYTEST' : timeLabel(progress[level.id]?.ticks ?? state.tick));
      const delta = result ? (Math.abs(result.deltaTicks) * DT).toFixed(2) : '0.00';
      text('finish-comparison', !result || result.kind === 'first' ? 'First clear. Your next run is a new challenge.'
        : result.kind === 'best' ? result.deltaTicks < 0 ? `Personal best! ${delta}s faster.` : `Personal best! ${result.fewerRetries} fewer retries.`
        : result.kind === 'equal' ? 'Matched your personal best.'
        : result.deltaTicks > 0 ? `${delta}s from your best. Find your next clean line.` : 'Matched your best time. Try fewer retries.');
      text('primary-action', testing ? 'Back to editor ↗' : complete ? 'Choose a level →' : 'Next level →');
      text('overlay-foot', testing ? 'PLAYTESTS DO NOT CHANGE LEVEL RECORDS'
        : progressSaved ? 'BEST TIMES SAVED ON THIS DEVICE' : 'NOT SAVED · RECORDS LAST ONLY THIS SESSION');
    } else if (started) {
      text('overlay-kicker', 'TAKE YOUR TIME');
      text('overlay-title', 'Paused.');
      text('overlay-copy', lastDeath ? `Last retry: ${lastDeath}` : 'Your next move can wait. R restarts the whole level.');
      text('primary-action', 'Resume →'); text('overlay-foot', 'SPACE TO RESUME');
    } else {
      const continuing = LEVELS.some(course => progress[course.id]);
      text('overlay-kicker', 'READ THE RHYTHM. MAKE YOUR MOVE.');
      text('overlay-title', continuing ? 'Find your next flow.' : 'Small tracks. Big flow.');
      text('overlay-copy', 'Move with WASD, arrow keys or the touch arrows. Reach the golden EXIT. Checkpoints catch your next attempt.');
      text('primary-action', continuing ? 'Continue →' : 'Play →');
      text('overlay-foot', 'NO LIVES. NO RUSH. ONE MORE TRY.');
    }
  }
  function hud() {
    text('timer', timeLabel(state.tick)); text('deaths', String(state.deaths).padStart(2, '0'));
    text('run-status', mode === 'edit' ? 'Click or drag to paint' : state.won ? 'Complete' : !started ? 'Ready' : paused ? 'Paused' : '');
    const guide = courseGuide(level, state);
    text('route-hint', state.won ? 'A clean line. A better time. Your next challenge is yours.' : guide.hint);
    const hint = element('route-hint'), feedback = element('game-feedback'), pause = element<HTMLButtonElement>('pause');
    if (hint.title !== guide.title) hint.title = guide.title;
    const hideFeedback = state.tick >= feedbackUntil || mode === 'edit' || state.won;
    if (feedback.hidden !== hideFeedback) feedback.hidden = hideFeedback;
    const disablePause = mode === 'edit' || !started || state.won;
    if (pause.disabled !== disablePause) pause.disabled = disablePause;
    document.querySelectorAll<HTMLButtonElement>('[data-direction]').forEach(button => {
      const disabled = mode !== 'play' || !started || paused || state.won || menu.open;
      if (button.disabled !== disabled) button.disabled = disabled;
    });
  }
  function updateLayout() {
    text('course-title', mode === 'edit' ? 'Level editor' : level.name);
    text('course-number', mode === 'edit' || testing ? 'YOUR LEVEL' : `LEVEL ${selectedCourse + 1} / ${LEVELS.length}`);
    document.querySelector('.workspace')!.classList.toggle('editing', mode === 'edit');
    element('editor-panel').hidden = mode !== 'edit';
    element('test-badge').hidden = !testing || mode === 'edit';
    element('editor-coordinates').hidden = mode !== 'edit';
    element('touch-controls').hidden = mode === 'edit';
    element('route-hint').hidden = mode === 'edit';
    element('editor-return').hidden = !testing;
    element<HTMLButtonElement>('restart').disabled = mode === 'edit';
    text('controls-note', mode === 'edit' ? 'Choose a brush, then click or drag on the board. Control or Command Z undoes a change. Escape opens the menu.'
      : 'WASD or arrow keys to move. Space pauses and resumes. R restarts the level. Escape opens the menu. On touch screens, hold the direction buttons to move.');
    viewport.setAttribute('aria-label', mode === 'edit' ? 'Level editor. Choose a brush, then click or drag on the board.' : 'Boundstoy course. WASD or arrows to move; R to restart; Space to pause.');
    courseCards(); overlay(); hud();
  }
  function load(next: Level, entry: 'ready' | 'play' | 'paused' = 'ready') {
    level = next; state = createState(level); started = entry !== 'ready'; paused = entry !== 'play';
    accumulator = 0; feedbackUntil = 0; lastDeath = ''; result = null;
    clearInput(); scene.setLevel(level); scene.highlight(null);
    // Transfer focus before hiding the action that started this run.
    if (!paused) viewport.focus({ preventScroll: true });
    updateLayout();
    syncRendering();
    if (entry === 'play') activateSound();
  }
  function loadCourse(index: number, entry: 'play' | 'paused' = 'play') {
    if (!Number.isInteger(index) || !LEVELS[index]) throw new Error('Unknown course index.');
    selectedCourse = index; mode = 'play'; testing = false; load(LEVELS[index], entry);
    if (entry === 'paused') element('primary-action').focus({ preventScroll: true });
  }
  function play() {
    if (menu.open || mode === 'edit') return;
    activateSound();
    if (state.won) {
      if (testing) { enterEditor(); return; }
      const next = nextCourse(LEVELS, progress, selectedCourse);
      if (next === null) openMenu();
      else loadCourse(next);
      return;
    }
    clearInput(); started = true; paused = false; accumulator = 0;
    viewport.focus({ preventScroll: true }); overlay(); hud();
    syncRendering();
  }
  function setPaused(value: boolean) {
    if (!started || state.won || mode === 'edit') return;
    paused = value; clearInput(); accumulator = 0;
    if (!value) viewport.focus({ preventScroll: true });
    overlay(); hud(); syncRendering();
  }
  function showHelp(show: boolean) {
    element('menu-home').hidden = show; element('help-panel').hidden = !show;
    text('menu-title', show ? 'How to play' : 'Take a breather.');
    menu.scrollTop = 0;
  }
  function fillHelp() {
    text('help-level-title', level.name);
    text('help-description', level.description);
    const list = element('help-terrain'); list.replaceChildren();
    const add = (name: string, hint: string, color: string) => {
      const item = document.createElement('li'), title = document.createElement('strong');
      title.textContent = name; item.style.setProperty('--swatch', color);
      item.append(title, document.createTextNode(hint)); list.append(item);
    };
    for (const [tile, terrain] of Object.entries(TERRAIN)) {
      if (level.tiles.some(row => row.includes(tile))) add(terrain.name, terrain.hint, terrain.color);
    }
    if (level.hazards.some(hazard => hazard.kind === 'pulse')) add('Pulse pads', 'Amber warns of an instant blast. The tile is safe immediately afterwards, even while debris fades.', '#ecae6a');
    if (level.hazards.some(hazard => hazard.kind === 'saw')) add('Saws', 'Watch the patrol and cross when the way is clear.', '#e35b80');
  }
  function openMenu() {
    if (menu.open) return;
    clearInput(); setPaused(true); showHelp(false); courseCards();
    text('menu-play', mode === 'edit' ? 'Back to editor →' : state.won ? 'View results →' : started ? 'Resume →' : 'Play →');
    menu.append(element('notice'));
    menu.showModal(); element('menu-toggle').setAttribute('aria-expanded', 'true');
    overlay(); hud(); element('menu-play').focus({ preventScroll: true });
    syncRendering();
  }
  function closeMenu(target: HTMLElement = element('menu-toggle')) {
    menu.close(); element('menu-toggle').setAttribute('aria-expanded', 'false');
    element('boundstoy').append(element('notice'));
    overlay(); hud(); target.focus({ preventScroll: true });
    syncRendering();
  }
  function tick(input: Point) {
    const previousTick = state.tick;
    state = step(level, state, input);
    if (level.hazards.some(hazard => hazard.kind === 'pulse'
      && !hazardSample(hazard, previousTick).active && hazardSample(hazard, state.tick).active)) audio.play('blast');
    if (state.event !== 'none') audio.play(state.event);
    if (state.event === 'death' && state.deathCause) {
      lastDeath = deathMessage(state.deathCause);
      text('game-feedback', `Retry ${state.deaths}: ${lastDeath}`);
      element('game-feedback').classList.add('hit');
      feedbackUntil = state.tick + 240;
    }
    if (state.event === 'checkpoint') {
      text('game-feedback', `Checkpoint ${String(state.visited.length).padStart(2, '0')} saved. Next attempt starts here.`);
      element('game-feedback').classList.remove('hit');
      feedbackUntil = state.tick + 180;
    }
    if (state.event === 'win') {
      clearInput();
      if (!testing) {
        result = finishResult(progress[level.id], { ticks: state.tick, deaths: state.deaths });
        progress = recordFinish(progress, level.id, state.tick, state.deaths);
        try { localStorage.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, runs: progress })); progressSaved = true; }
        catch (error) { progressSaved = false; report('Could not save your best time', error); }
        courseCards();
      }
      overlay();
      element('primary-action').focus({ preventScroll: true });
    }
  }
  function commit(next: Level) {
    history = [...history.slice(-39), level]; draft = next; level = next; state = createState(level);
    scene.setLevel(level); saveDraft(); element<HTMLButtonElement>('undo').disabled = false;
  }
  function enterEditor() {
    mode = 'edit'; testing = false; sawStart = null; history = [];
    if (!draft) {
      try {
        const saved = localStorage.getItem(DRAFT_KEY);
        if (saved) {
          draft = importLevel(saved);
          if (draft.hazards.some(hazard => hazard.kind === 'pulse'))
            notify('Draft restored. Pulse pads now explode for one tick; fading debris is harmless.');
        }
      } catch (error) { report('Could not load editor draft', error); }
    }
    draft ??= parseLevel({ ...LEVELS[selectedCourse], id: 'my-course', name: `${LEVELS[selectedCourse].name} remix` });
    load(draft); element<HTMLInputElement>('level-name').value = draft.name;
    element<HTMLButtonElement>('undo').disabled = true;
    viewport.focus();
  }
  const brushes: { id: Brush; label: string; color: string; mark: string; help: string }[] = [
    ...Object.entries(TERRAIN).map(([id, value]) => ({ id: id as Tile, label: value.name.replace(' ground', ''), color: value.color, mark: id === ' ' ? '·' : id, help: `${value.hint} Click or drag to paint.` })),
    { id: 'spawn', label: 'Start', color: '#3c887c', mark: 'S', help: 'Place the starting point. This also creates safe floor.' },
    { id: 'goal', label: 'Exit', color: '#9e7951', mark: 'G', help: 'Place the golden exit. This also creates safe floor.' },
    { id: 'checkpoint', label: 'Checkpoint', color: '#3c887c', mark: 'C', help: 'Place a saved respawn point. Erase removes it.' },
    { id: 'pulse', label: 'Pulse', color: '#943552', mark: '◉', help: 'An instant explosion every 3 seconds. Fading debris is harmless. JSON changes period and phase; legacy on durations become one tick.' },
    { id: 'saw', label: 'Saw', color: '#943552', mark: 'X', help: 'Click the start, then the end of a patrol. Travels out and back every 3 seconds.' },
    { id: 'erase', label: 'Erase object', color: '#253549', mark: '×', help: 'Remove a checkpoint or hazard at its starting tile. Floor stays unchanged.' },
  ];
  for (const definition of brushes) {
    const button = document.createElement('button'); button.dataset.brush = definition.id;
    button.setAttribute('aria-pressed', String(brush === definition.id));
    button.classList.toggle('selected', brush === definition.id);
    const chip = document.createElement('span'); chip.className = 'brush-chip'; chip.style.background = definition.color; chip.textContent = definition.mark;
    button.append(chip, document.createTextNode(definition.label));
    button.addEventListener('click', () => {
      brush = definition.id; sawStart = null; text('brush-help', definition.help);
      element('palette').querySelectorAll('button').forEach(node => {
        node.classList.toggle('selected', node === button); node.setAttribute('aria-pressed', String(node === button));
      });
    }, options);
    element('palette').append(button);
  }
  function paintAt(event: PointerEvent, initial: boolean) {
    const point = scene.pick(event.clientX, event.clientY);
    scene.highlight(point);
    if (!point) return;
    text('editor-coordinates', `X ${String(point.x).padStart(2, '0')} / Y ${String(point.y).padStart(2, '0')}`);
    const key = `${point.x},${point.y}`;
    if (!initial && (!painting || lastPaint === key || brush === 'saw')) return;
    lastPaint = key;
    try {
      if (brush === 'saw') {
        if (!sawStart) { sawStart = point; text('brush-help', `Start at (${point.x}, ${point.y}). Click the patrol's other end.`); }
        else { commit(placeSaw(level, sawStart, point)); sawStart = null; text('brush-help', 'Patrol placed. Click two new points to add another.'); }
      } else commit(paint(level, point, brush));
    } catch (error) { notify(error instanceof Error ? error.message : String(error), true); }
  }
  viewport.addEventListener('pointerdown', event => {
    if (event.target !== scene.renderer.domElement) return;
    viewport.focus();
    if (mode !== 'edit' || event.button !== 0) return;
    painting = true; paintingPointer = event.pointerId; lastPaint = ''; viewport.setPointerCapture(event.pointerId); paintAt(event, true);
  }, options);
  viewport.addEventListener('pointermove', event => {
    if (mode === 'edit') paintAt(event, false);
  }, options);
  const stopPainting = () => { painting = false; paintingPointer = null; lastPaint = ''; };
  viewport.addEventListener('pointerup', stopPainting, options);
  viewport.addEventListener('pointercancel', stopPainting, options);
  viewport.addEventListener('lostpointercapture', stopPainting, options);
  viewport.addEventListener('pointerleave', () => { if (!painting) scene.highlight(null); }, options);
  viewport.addEventListener('keydown', event => {
    if (event.target !== viewport) return;
    if (event.code in keyDirections && mode === 'play') {
      event.preventDefault();
      if (!event.repeat && started && !paused && !state.won && !menu.open) keys.add(event.code);
    } else if (event.code === 'Space' && mode === 'play') {
      event.preventDefault();
      if (!event.repeat) { if (!started) play(); else setPaused(!paused); }
    } else if (event.code === 'KeyR' && mode === 'play' && !event.repeat) {
      event.preventDefault(); load(level, 'play');
    } else if (event.code === 'Enter' && mode === 'play' && (!started || state.won || paused)) {
      event.preventDefault(); play();
    } else if ((event.ctrlKey || event.metaKey) && event.code === 'KeyZ' && mode === 'edit') {
      event.preventDefault(); undo();
    }
  }, options);
  window.addEventListener('keyup', event => keys.delete(event.code), options);
  viewport.addEventListener('focusout', event => {
    clearInput();
    if (event.relatedTarget !== viewport) setPaused(true);
  }, options);
  window.addEventListener('blur', () => { clearInput(); setPaused(true); }, options);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearInput(); setPaused(true); }
    loop.setVisible(!document.hidden);
  }, options);
  document.querySelectorAll<HTMLButtonElement>('[data-direction]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      if (mode !== 'play' || state.won || !started || paused || menu.open) return;
      touchPointers.set(event.pointerId, button.dataset.direction!);
      button.classList.add('pressed'); button.setPointerCapture(event.pointerId);
    }, options);
    const release = (event: PointerEvent) => { touchPointers.delete(event.pointerId); button.classList.remove('pressed'); };
    button.addEventListener('pointerup', release, options);
    button.addEventListener('pointercancel', release, options);
    button.addEventListener('lostpointercapture', release, options);
  });
  function undo() {
    const previous = history.pop();
    if (!previous) return;
    draft = previous; level = previous; state = createState(level); sawStart = null;
    scene.setLevel(level); saveDraft(); element<HTMLInputElement>('level-name').value = level.name;
    element<HTMLButtonElement>('undo').disabled = history.length === 0;
  }
  function rename() {
    if (mode !== 'edit') return true;
    try {
      const name = element<HTMLInputElement>('level-name').value.trim();
      if (name !== level.name) commit(parseLevel({ ...level, name }));
      return true;
    } catch (error) { notify(error instanceof Error ? error.message : String(error), true); return false; }
  }
  function exportDraft() {
    if (!rename()) return null;
    const source = JSON.stringify(level, null, 2);
    element<HTMLTextAreaElement>('level-json').value = source;
    return source;
  }
  element('primary-action').addEventListener('click', play, options);
  element('retry-course').addEventListener('click', () => load(level, 'play'), options);
  element('pause').addEventListener('click', () => {
    setPaused(true); element('primary-action').focus({ preventScroll: true });
  }, options);
  element('restart').addEventListener('click', () => {
    if (mode === 'edit') return;
    load(level, 'play');
  }, options);
  element('play-tab').addEventListener('click', () => loadCourse(selectedCourse), options);
  element('editor-return').addEventListener('click', enterEditor, options);
  element('menu-toggle').addEventListener('click', openMenu, options);
  element('menu-close').addEventListener('click', () => closeMenu(), options);
  menu.addEventListener('cancel', event => { event.preventDefault(); closeMenu(); }, options);
  menu.addEventListener('keydown', event => {
    if (event.code !== 'Tab') return;
    const buttons = [...menu.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')].filter(button => button.getClientRects().length);
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === element('menu-title'))) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first?.focus();
    }
  }, options);
  element('menu-play').addEventListener('click', () => {
    closeMenu(mode === 'edit' ? viewport : element('primary-action'));
    if (mode === 'play' && !state.won) play();
  }, options);
  element('help').addEventListener('click', () => {
    fillHelp(); showHelp(true); element('menu-title').focus({ preventScroll: true });
  }, options);
  element('help-back').addEventListener('click', () => {
    showHelp(false); element('help').focus();
  }, options);
  element('editor-tab').addEventListener('click', () => {
    closeMenu(); if (mode !== 'edit') enterEditor(); else viewport.focus();
  }, options);
  document.addEventListener('keydown', event => {
    if (event.code !== 'Escape' || menu.open || event.repeat) return;
    event.preventDefault(); openMenu();
  }, options);
  element('course-list').addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-level]');
    if (button) { closeMenu(); loadCourse(Number(button.dataset.level)); }
  }, options);
  for (const id of ['audio', 'intro-audio']) element(id).addEventListener('click', () => { void setSound(!preferences.sound); }, options);
  element('sound-volume').addEventListener('input', () => {
    const volume = Number(element<HTMLInputElement>('sound-volume').value) / 100;
    audio.setVolume(volume); preferences = { ...preferences, volume }; soundControls();
  }, options);
  element('sound-volume').addEventListener('change', savePreferences, options);
  element('fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await element('boundstoy').requestFullscreen();
    } catch (error) { report('Fullscreen is not available here', error); }
  }, options);
  document.addEventListener('fullscreenchange', () => {
    const active = Boolean(document.fullscreenElement);
    text('fullscreen', active ? 'Exit fullscreen ⛶' : 'Fullscreen ⛶');
    element('fullscreen').setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
  }, options);
  element('dismiss-notice').addEventListener('click', () => { element('notice').hidden = true; }, options);
  element('undo').addEventListener('click', undo, options);
  element('new-course').addEventListener('click', () => {
    commit(blankLevel()); element<HTMLInputElement>('level-name').value = level.name;
  }, options);
  element('copy-course').addEventListener('click', () => {
    commit(parseLevel({ ...LEVELS[selectedCourse], id: 'my-course', name: `${LEVELS[selectedCourse].name} remix` }));
    element<HTMLInputElement>('level-name').value = level.name;
  }, options);
  element('level-name').addEventListener('change', rename, options);
  element('playtest').addEventListener('click', () => {
    if (!rename()) return;
    draft = parseLevel(level); saveDraft(); mode = 'play'; testing = true;
    load(draft, 'play');
  }, options);
  element('export').addEventListener('click', () => {
    if (exportDraft()) { element<HTMLTextAreaElement>('level-json').select(); notify('Level JSON is ready. Copy it or download a file.'); }
  }, options);
  element('import').addEventListener('click', () => {
    try {
      commit(importLevel(element<HTMLTextAreaElement>('level-json').value));
      element<HTMLInputElement>('level-name').value = level.name;
      notify(level.hazards.some(hazard => hazard.kind === 'pulse')
        ? 'Level imported. Pulse pads explode for one tick; legacy on durations are converted. Fading debris is harmless.'
        : 'Level imported. Ready to playtest.');
    } catch (error) { notify(`Import rejected: ${error instanceof Error ? error.message : String(error)}`, true); }
  }, options);
  element('download').addEventListener('click', () => {
    const source = exportDraft(); if (!source) return;
    const url = URL.createObjectURL(new Blob([source], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `${level.id}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, options);
  scene.renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault(); setPaused(true); notify('The graphics context was lost. Reload this page to restore the game.', true);
  }, options);

  const debug = {
    snapshot: () => structuredClone({ state, level, mode, paused, started, testing, input: movement() }),
    ascii: () => ascii(level, state),
    load: (index: number) => {
      if (abort.signal.aborted) throw new Error('The game has been disposed.');
      loadCourse(index, 'paused'); visualTime = 0; loop.drawNow();
    },
    advance: (ticks: number, input: Point = STILL) => {
      if (abort.signal.aborted) throw new Error('The game has been disposed.');
      if (!Number.isInteger(ticks) || ticks < 0 || ticks > 100_000) throw new Error('advance accepts 0-100000 ticks.');
      if (mode !== 'play') throw new Error('Use Play or Playtest before advancing the simulation.');
      paused = true; started = true; accumulator = 0; clearInput();
      for (let i = 0; i < ticks && !state.won; i++) tick(input);
      visualTime = state.tick * DT; hud(); overlay(); syncRendering(); loop.drawNow();
      return structuredClone(state);
    },
    project: (point: Point) => scene.project(point),
    export: () => JSON.stringify(level),
    metrics: () => ({ frames: scene.renderer.info.render.frame, drawCalls: scene.renderer.info.render.calls, triangles: scene.renderer.info.render.triangles, geometries: scene.renderer.info.memory.geometries, textures: scene.renderer.info.memory.textures }),
  };
  if (new URLSearchParams(location.search).has('debug')) window.__BOUNDSTOY__ = debug;

  function frame(elapsed: number) {
    if (!menu.open && !paused && mode === 'play' && !state.won) {
      visualTime += elapsed;
      const pending = fixedSteps(accumulator, elapsed);
      accumulator = pending.remainder;
      const input = movement();
      for (let i = 0; i < pending.count && !state.won; i++) tick(input);
    } else if (!menu.open && (!started || mode === 'edit' || state.won)) visualTime += elapsed;
    hud(); scene.draw(state, visualTime, mode === 'edit');
  }
  selectedCourse = nextCourse(LEVELS, progress) ?? 0;
  load(LEVELS[selectedCourse]); element('primary-action').focus({ preventScroll: true });
  window.addEventListener('pagehide', event => {
    clearInput(); setPaused(true); loop.setVisible(false);
    if (event.persisted) return;
    loop.dispose(); abort.abort(); clearTimeout(noticeTimer); scene.dispose(); audio.dispose(); delete window.__BOUNDSTOY__;
  }, options);
  window.addEventListener('pageshow', () => loop.setVisible(!document.hidden), options);
  return debug;
}

declare global {
  interface Window { __BOUNDSTOY__?: ReturnType<typeof boot>; }
}
try {
  boot(new Scene(element('viewport')));
} catch (error) {
  element('overlay').hidden = false;
  text('overlay-title', 'The game could not start.');
  text('overlay-copy', 'This game needs a browser with WebGL2 and hardware acceleration. Nothing was sent over the network.');
  element<HTMLButtonElement>('primary-action').disabled = true;
  text('primary-action', 'Reload after enabling WebGL2');
  report('Game startup failed', error);
}
