import './style.css';
import { LEVELS } from '../data/levels.ts';
import { TERRAIN, type Tile } from '../data/terrain.ts';
import { createState, step, terrainAt, hazardSample, ascii, DT, STILL } from '../core/simulation.ts';
import { importLevel, parseLevel, type Level, type Point } from '../core/level.ts';
import { paint, placeSaw, blankLevel, type Brush } from '../core/editor.ts';
import { readProgress, recordFinish, PROGRESS_KEY, DRAFT_KEY, type Progress } from '../application/storage.ts';
import { Audio } from './audio.ts';
import { courseGuide, deathMessage } from '../application/guidance.ts';
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
  const viewport = element('viewport'), audio = new Audio();
  const abort = new AbortController(), options = { signal: abort.signal };
  let level = LEVELS[0], state = createState(level), selectedCourse = 0;
  let mode: 'play' | 'edit' = 'play', draft: Level | null = null;
  let history: Level[] = [], brush: Brush = '.', sawStart: Point | null = null;
  let painting = false, lastPaint = '', testing = false, started = false, paused = true;
  let accumulator = 0, lastFrame = 0, visualTime = 0, animation = 0;
  let progress: Progress = {};
  let lastHudSurface = '';
  let storageFailed = false;
  let feedbackUntil = 0;
  try { progress = readProgress(localStorage.getItem(PROGRESS_KEY)); }
  catch (error) { report('Could not load local progress', error); }

  function clearInput() {
    keys.clear(); touchPointers.clear();
    document.querySelectorAll('.touch-controls button').forEach(button => button.classList.remove('pressed'));
  }
  function movement(): Point {
    const active = new Set([...keys].map(key => keyDirections[key]).filter(Boolean));
    for (const dir of touchPointers.values()) active.add(dir);
    let x = 0, y = 0;
    for (const dir of active) { x += directions[dir].x; y += directions[dir].y; }
    return { x, y };
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
    text('completion-count', `${String(LEVELS.filter(course => progress[course.id]).length).padStart(2, '0')} / 02`);
    const list = element('course-list'); list.replaceChildren();
    LEVELS.forEach((course, index) => {
      const button = document.createElement('button');
      button.className = `course-card${selectedCourse === index && !testing ? ' selected' : ''}`;
      button.dataset.level = String(index);
      button.setAttribute('aria-pressed', String(selectedCourse === index && !testing));
      const number = document.createElement('span'); number.className = 'course-number'; number.textContent = `0${index + 1}`;
      const body = document.createElement('span'), title = document.createElement('strong'), subtitle = document.createElement('small');
      title.textContent = course.name;
      const best = progress[course.id];
      subtitle.textContent = best ? `Best ${timeLabel(best.ticks)} / ${best.deaths} retries` : index === 0 ? 'Learn the glide. Find your line.' : 'A launch, a curve, a clean crossing.';
      body.append(title, subtitle);
      const arrow = document.createElement('span'); arrow.textContent = best ? '✓' : '↗';
      button.append(number, body, arrow); list.append(button);
    });
  }
  function overlay() {
    element('overlay').hidden = mode === 'edit' || started && !paused && !state.won;
    element('intro-rules').hidden = started || mode === 'edit';
    element('finish-stats').hidden = !state.won;
    element('retry-course').hidden = !started || mode === 'edit';
    if (mode === 'edit') return;
    if (state.won) {
      const complete = !testing && selectedCourse === LEVELS.length - 1 && LEVELS.every(course => progress[course.id]);
      text('overlay-kicker', testing ? 'EXPERIMENT COMPLETE' : state.deaths === 0 ? 'CLEAN RUN / ZERO RETRIES' : 'EVERY ATTEMPT COUNTS');
      text('overlay-title', complete ? 'Momentum mastered.' : 'Course clear.');
      text('overlay-copy', testing ? 'Your course works. Take it back to the workshop or run it again.'
        : complete ? 'Both courses cleared. You have the glide, the timing, and the landing. Chase a cleaner run or make your own.'
        : selectedCourse === 0 ? 'You have the glide. Next: time a launch, catch the island, and thread the saw.'
        : 'A clean crossing. The first course is ready whenever you are.');
      text('finish-time', timeLabel(state.tick));
      text('finish-retries', String(state.deaths));
      text('finish-best', testing ? 'PLAYTEST' : timeLabel(progress[level.id]?.ticks ?? state.tick));
      text('primary-action', testing ? 'Back to workshop ↗' : selectedCourse === 0 ? 'Next course →' : 'Run from the beginning →');
      text('overlay-foot', testing ? 'PLAYTESTS DO NOT CHANGE COURSE RECORDS' : 'BEST TIMES ARE SAVED ONLY ON THIS DEVICE');
    } else if (started) {
      text('overlay-kicker', 'TAKE YOUR TIME');
      text('overlay-title', 'A moment of stillness.');
      text('overlay-copy', 'Your run is paused. The floor, the hazards, and your momentum can wait.');
      text('primary-action', 'Keep rolling →'); text('overlay-foot', 'SPACE TO RESUME');
    } else {
      text('overlay-kicker', testing ? 'YOUR FLOOR. YOUR RULES.' : 'SMALL ROBOT. BIG MOMENTUM.');
      text('overlay-title', selectedCourse === 0 || testing ? 'Stay in motion.' : 'Make your move.');
      text('overlay-copy', level.description);
      text('primary-action', "Let's roll →"); text('overlay-foot', 'WASD / ARROW KEYS TO MOVE');
    }
  }
  function hud() {
    text('timer', timeLabel(state.tick)); text('deaths', String(state.deaths).padStart(2, '0'));
    text('run-status', mode === 'edit' ? 'WORKSHOP / PAINT YOUR COURSE' : state.won ? 'COURSE COMPLETE' : !started ? 'READY WHEN YOU ARE' : paused ? 'PAUSED' : state.respawnTicks > 0 ? 'BACK IN A MOMENT' : 'FOLLOW THE MOMENTUM');
    const surface = terrainAt(level, state.position);
    text('speed-readout', `${Math.hypot(state.velocity.x, state.velocity.y).toFixed(1)} u/s`);
    element('speed-readout').classList.toggle('gliding', surface.id === 'soft' && state.respawnTicks === 0 && !state.won);
    const guide = courseGuide(level, state);
    text('route-step', `${String(guide.index + 1).padStart(2, '0')} / ${String(guide.total).padStart(2, '0')}`);
    text('route-title', state.won ? 'Route complete' : guide.title);
    text('route-hint', state.won ? 'Your best run stays on this device. Try again or build a course in the workshop.' : guide.hint);
    element('game-feedback').hidden = state.tick >= feedbackUntil || mode === 'edit' || state.won;
    const surfaceName = mode === 'edit' ? 'CLICK OR DRAG TO PAINT' : surface.name.toUpperCase();
    if (surfaceName !== lastHudSurface) {
      const node = element('surface-readout'); node.replaceChildren();
      const dot = document.createElement('i'); dot.style.background = surface.color;
      node.append(dot, document.createTextNode(surfaceName)); node.title = surface.hint; lastHudSurface = surfaceName;
    }
    text('checkpoint-note', state.visited.length ? `${state.visited.length}/${level.checkpoints.length} checkpoints found` : 'Checkpoints keep you rolling');
    element<HTMLButtonElement>('pause').disabled = mode === 'edit' || !started || state.won;
    element('pause').firstChild!.textContent = started && paused ? 'Resume ' : 'Pause ';
  }
  function updateLayout() {
    text('course-title', mode === 'edit' ? 'Make it your own.' : level.name);
    text('course-number', mode === 'edit' || testing ? 'WORKSHOP' : `0${selectedCourse + 1}`);
    text('map-id', mode === 'edit' || testing ? 'CUSTOM' : `0${selectedCourse + 1}`);
    text('level-description', level.description);
    element('play-panel').hidden = mode === 'edit';
    element('editor-panel').hidden = mode !== 'edit';
    element('test-badge').hidden = !testing || mode === 'edit';
    element('editor-coordinates').hidden = mode !== 'edit';
    element('touch-controls').hidden = mode === 'edit';
    element('route-coach').hidden = mode === 'edit';
    element<HTMLButtonElement>('restart').disabled = mode === 'edit';
    element('play-tab').classList.toggle('selected', mode === 'play');
    element('editor-tab').classList.toggle('selected', mode === 'edit');
    element('play-tab').setAttribute('aria-pressed', String(mode === 'play'));
    element('editor-tab').setAttribute('aria-pressed', String(mode === 'edit'));
    viewport.setAttribute('aria-label', mode === 'edit' ? 'Level editor. Choose a brush, then click or drag on the board.' : 'Boundstoy course. WASD or arrows to move; R to restart; Space to pause.');
    courseCards(); overlay(); hud();
  }
  function load(next: Level, autoStart = false) {
    level = next; state = createState(level); started = autoStart; paused = !autoStart;
    accumulator = 0; feedbackUntil = 0; clearInput(); scene.setLevel(level); scene.highlight(null); updateLayout();
  }
  function loadCourse(index: number) {
    if (!Number.isInteger(index) || !LEVELS[index]) throw new Error('Unknown course index.');
    selectedCourse = index; mode = 'play'; testing = false; load(LEVELS[index]);
  }
  function play() {
    if (state.won) {
      if (testing) { enterEditor(); return; }
      loadCourse(selectedCourse === LEVELS.length - 1 ? 0 : selectedCourse + 1);
      element('primary-action').focus({ preventScroll: true });
      return;
    }
    started = true; paused = false; accumulator = 0; overlay(); viewport.focus();
  }
  function setPaused(value: boolean) {
    if (!started || state.won || mode === 'edit') return;
    paused = value; clearInput(); accumulator = 0; overlay(); hud();
    if (!value) viewport.focus();
  }
  function tick(input: Point) {
    const previousTick = state.tick;
    state = step(level, state, input);
    if (level.hazards.some(hazard => hazard.kind === 'pulse'
      && !hazardSample(hazard, previousTick).active && hazardSample(hazard, state.tick).active)) audio.play('blast');
    if (state.event !== 'none') audio.play(state.event);
    if (state.event === 'death' && state.deathCause) {
      text('game-feedback', deathMessage(state.deathCause));
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
        progress = recordFinish(progress, level.id, state.tick, state.deaths);
        try { localStorage.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, runs: progress })); }
        catch (error) { report('Could not save your best time', error); }
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
        if (saved) draft = importLevel(saved);
      } catch (error) { report('Could not load workshop draft', error); }
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
    { id: 'pulse', label: 'Pulse', color: '#943552', mark: '◉', help: 'A timed pad: 0.75 seconds active, then 2.25 seconds safe. JSON can change its timing.' },
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
    painting = true; lastPaint = ''; viewport.setPointerCapture(event.pointerId); paintAt(event, true);
  }, options);
  viewport.addEventListener('pointermove', event => {
    if (mode === 'edit') paintAt(event, false);
  }, options);
  viewport.addEventListener('pointerup', () => { painting = false; lastPaint = ''; }, options);
  viewport.addEventListener('pointercancel', () => { painting = false; }, options);
  viewport.addEventListener('pointerleave', () => { if (!painting) scene.highlight(null); }, options);
  viewport.addEventListener('keydown', event => {
    if (event.target !== viewport) return;
    if (event.code in keyDirections && mode === 'play') {
      event.preventDefault(); keys.add(event.code);
    } else if (event.code === 'Space' && mode === 'play') {
      event.preventDefault();
      if (!event.repeat) { if (!started) play(); else setPaused(!paused); }
    } else if (event.code === 'KeyR' && mode === 'play' && !event.repeat) {
      event.preventDefault(); load(level, true); viewport.focus();
    } else if (event.code === 'Enter' && mode === 'play' && (!started || state.won || paused)) {
      event.preventDefault(); play();
    } else if ((event.ctrlKey || event.metaKey) && event.code === 'KeyZ' && mode === 'edit') {
      event.preventDefault(); undo();
    }
  }, options);
  window.addEventListener('keyup', event => keys.delete(event.code), options);
  viewport.addEventListener('focusout', event => {
    clearInput();
    const next = event.relatedTarget;
    if (next instanceof HTMLElement && !viewport.contains(next) && !next.closest('.touch-controls')) setPaused(true);
  }, options);
  window.addEventListener('blur', () => { clearInput(); setPaused(true); }, options);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); setPaused(true); } }, options);
  document.querySelectorAll<HTMLButtonElement>('[data-direction]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      if (mode !== 'play' || state.won) return;
      if (!started || paused) play();
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
  element('retry-course').addEventListener('click', () => { load(level, true); viewport.focus(); }, options);
  element('pause').addEventListener('click', () => setPaused(!paused), options);
  element('restart').addEventListener('click', () => {
    if (mode === 'edit') return;
    load(level, true); viewport.focus();
  }, options);
  element('play-tab').addEventListener('click', () => { if (mode === 'edit' || testing) loadCourse(selectedCourse); }, options);
  element('editor-tab').addEventListener('click', () => { if (mode !== 'edit') enterEditor(); }, options);
  element('remix').addEventListener('click', enterEditor, options);
  element('course-list').addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-level]');
    if (button) loadCourse(Number(button.dataset.level));
  }, options);
  element('audio').addEventListener('click', async () => {
    try {
      const enabled = await audio.toggle();
      text('audio', enabled ? 'Sound on' : 'Sound off');
      element('audio').setAttribute('aria-pressed', String(enabled));
      element('audio').setAttribute('aria-label', enabled ? 'Mute sound' : 'Enable sound');
      element('audio').title = enabled ? 'Sound is on' : 'Sound is off';
    } catch (error) { report('Could not enable audio', error); }
  }, options);
  element('fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await element('boundstoy').requestFullscreen();
    } catch (error) { report('Fullscreen is not available here', error); }
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
    load(draft, true); viewport.focus();
  }, options);
  element('export').addEventListener('click', () => {
    if (exportDraft()) { element<HTMLTextAreaElement>('level-json').select(); notify('Level JSON is ready. Copy it or download a file.'); }
  }, options);
  element('import').addEventListener('click', () => {
    try {
      commit(importLevel(element<HTMLTextAreaElement>('level-json').value));
      element<HTMLInputElement>('level-name').value = level.name;
      notify('Level imported. Ready to playtest.');
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
    load: (index: number) => { loadCourse(index); scene.draw(state, 0, false); },
    advance: (ticks: number, input: Point = STILL) => {
      if (!Number.isInteger(ticks) || ticks < 0 || ticks > 100_000) throw new Error('advance accepts 0-100000 ticks.');
      if (mode !== 'play') throw new Error('Use Play or Playtest before advancing the simulation.');
      paused = true; started = true; accumulator = 0;
      for (let i = 0; i < ticks && !state.won; i++) tick(input);
      hud(); overlay(); scene.draw(state, state.tick * DT, false);
      return structuredClone(state);
    },
    project: (point: Point) => scene.project(point),
    export: () => JSON.stringify(level),
    metrics: () => ({ drawCalls: scene.renderer.info.render.calls, triangles: scene.renderer.info.render.triangles, geometries: scene.renderer.info.memory.geometries, textures: scene.renderer.info.memory.textures }),
  };
  if (new URLSearchParams(location.search).has('debug')) window.__BOUNDSTOY__ = debug;

  function frame(now: number) {
    const elapsed = lastFrame ? Math.min((now - lastFrame) / 1000, 0.1) : 0;
    lastFrame = now;
    if (!paused && mode === 'play' && !state.won) {
      visualTime += elapsed; accumulator += elapsed;
      const input = movement();
      while (accumulator >= DT && !state.won) { tick(input); accumulator -= DT; }
    } else if (!started || mode === 'edit' || state.won) visualTime += elapsed;
    hud(); scene.draw(state, visualTime, mode === 'edit');
    animation = requestAnimationFrame(frame);
  }
  load(level); animation = requestAnimationFrame(frame);
  window.addEventListener('pagehide', event => {
    setPaused(true);
    if (event.persisted) return;
    cancelAnimationFrame(animation); abort.abort(); scene.dispose(); audio.dispose(); delete window.__BOUNDSTOY__;
  }, options);
  return debug;
}

declare global {
  interface Window { __BOUNDSTOY__?: ReturnType<typeof boot>; }
}
try {
  boot(new Scene(element('viewport')));
} catch (error) {
  element('overlay').hidden = false;
  text('overlay-title', 'The lab could not start.');
  text('overlay-copy', 'This game needs a browser with WebGL2 and hardware acceleration. Nothing was sent over the network.');
  element<HTMLButtonElement>('primary-action').disabled = true;
  text('primary-action', 'Reload after enabling WebGL2');
  report('Game startup failed', error);
}
