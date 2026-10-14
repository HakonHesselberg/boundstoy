import './style.css';
import { LEVELS, MASTERY_TARGETS } from '../data/levels.ts';
import type { ExplosionPuzzle } from '../data/explosion-puzzles.ts';
import { SOUND_DEMO, SOUND_ICE_DEMO, isSoundDemo } from '../data/sound-demo.ts';
import { ICE_PALETTE, ICE_PALETTE_IDS, ICE_PALETTE_AUDIO, isIceSound, type IceSoundId } from '../data/ice-palette.ts';
import { SOUNDS, SOUND_IDS } from '../data/sounds.ts';
import { TERRAIN, type Tile } from '../data/terrain.ts';
import { EXPLOSION_STYLES, EXPLOSION_STYLE_IDS, DEFAULT_EXPLOSION_STYLE, type ExplosionStyleId } from '../data/explosion-styles.ts';
import { createState, restartCheckpoint, step, hazardTick, ascii, DT, STILL } from '../core/simulation.ts';
import { importLevel, parseLevel, type Level, type Point } from '../core/level.ts';
import { checkpointPuzzles, worldSectionIndex } from '../core/world.ts';
import { paint, placeSaw, blankLevel, type Brush } from '../core/editor.ts';
import { recordFinish, bestClean, runRank, readWorldRecords, getWorldRecord, recordWorldFinish, type Progress } from '../application/storage.ts';
import { nextCourse, finishResult, worldFinishResult } from '../application/campaign.ts';
import { openBrowserRunStorage } from '../application/run-storage.ts';
import { createCheckpointSnapshot, createRunSnapshot, type RunSnapshot } from '../application/run-snapshot.ts';
import { RunContinuation, shouldSave, type SaveStatus } from '../application/run-continuation.ts';
import { DEFAULT_PREFERENCES, PREFERENCES_KEY, readPreferences } from '../application/preferences.ts';
import { trialSets, findTrial, nextTrial, trialCredit, isDevMode } from '../application/level-catalogue.ts';
import { worldSummary, sectionProgress, sectionPips, controlsHint, formatTime, ROUTE_HINT_TICKS } from '../application/menu-model.ts';
import { Audio, iceMotion, soundEvents } from './audio.ts';
import { courseGuide, deathMessage } from '../application/guidance.ts';
import { createRenderLoop, fixedSteps } from '../application/render-loop.ts';
import { Scene } from './scene.ts';
import { GraphicsRecovery } from './graphics-recovery.ts';

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing UI element: ${id}`);
  return node as T;
}
const text = (id: string, value: string) => {
  const node = element(id);
  if (node.textContent !== value) node.textContent = value;
};
const timeLabel = formatTime;
let noticeTimer = 0;
function notify(message: string, error = false) {
  clearTimeout(noticeTimer);
  const settings = element<HTMLDialogElement>('settings');
  (settings.open ? settings : element('boundstoy')).append(element('notice'));
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

const recoveryDialog = element<HTMLDialogElement>('graphics-recovery');
element('graphics-reload').addEventListener('click', () => location.reload());
recoveryDialog.addEventListener('cancel', event => event.preventDefault());
recoveryDialog.addEventListener('keydown', event => { if (event.repeat) event.preventDefault(); });
function showGraphicsFailure(message?: string) {
  if (message) text('graphics-copy', message);
  if (!recoveryDialog.open) recoveryDialog.showModal();
  element('graphics-reload').focus();
}

function boot(scene: Scene) {
  const viewport = element('viewport'), settingsDialog = element<HTMLDialogElement>('settings'), audio = new Audio(import.meta.env.BASE_URL);
  const root = element('boundstoy');
  const dev = isDevMode(location.search), sets = trialSets({ dev });
  const coarsePointer = matchMedia('(pointer: coarse)');
  /** Which full-screen surface is shown. The board stays mounted for every screen. */
  let screen: 'home' | 'levels' | 'play' | 'edit' = 'home';
  let levelSet = sets[0].id, settingsReturn: HTMLElement | null = null;
  let hintSection = -1, hintUntil = 0, pipsKey = '';
  const abort = new AbortController(), options = { signal: abort.signal };
  let level = LEVELS[0], state = createState(level), selectedCourse = 0;
  let mode: 'play' | 'edit' = 'play', draft: Level | null = null;
  let history: Level[] = [], brush: Brush = '.', sawStart: Point | null = null;
  let pulseStyle: ExplosionStyleId = DEFAULT_EXPLOSION_STYLE;
  let editorSection = 0;
  let painting = false, lastPaint = '', testing = false, started = false, paused = true;
  let puzzle: ExplosionPuzzle | null = null;
  const puzzleTrials = new Map<string, Readonly<{ ticks: number; deaths: number }>>();
  let paintingPointer: number | null = null;
  let accumulator = 0, visualTime = 0;
  // Debug stepping pins idle/victory animation to explicit animate() calls until play resumes.
  let manualClock = false;
  let progress: Progress = {};
  let legacyDraft: string | null = null;
  let worldRecords = readWorldRecords(null);
  let continuation: RunContinuation | null = null;
  let activeRun: RunSnapshot | null = null, currentRunId: string | null = null;
  let persistenceReady = false, memoryOnly = false, storageBusy = false, pageGone = false;
  let suspension = 0, pendingNew: (() => void) | null = null;
  const saveDialog = element<HTMLDialogElement>('save-recovery');
  const newRunDialog = element<HTMLDialogElement>('new-run-confirm');
  const resolveWorld = (id: string, revision: number) => {
    const course = LEVELS.find(course => course.version === 2 && course.id === id && course.revision === revision);
    return course?.version === 2 ? course : undefined;
  };
  // Activate only with the approved production revision, never for fixtures or
  // arbitrary unavailable saves. Prior revision records/drafts stay untouched.
  const obsoleteWorldRevisions = LEVELS.some(course =>
    course.id === 'aftershock' && checkpointPuzzles(course) && course.revision === 2)
    ? [{ worldId: 'aftershock', revision: 1 }] : [];
  let storage = openBrowserRunStorage(resolveWorld, obsoleteWorldRevisions);
  let closingStorage: Promise<void> = Promise.resolve();
  let feedbackUntil = 0;
  let lastDeath = '';
  let result: ReturnType<typeof finishResult> | null = null;
  let progressSaved = true;
  let preferences = DEFAULT_PREFERENCES, audioBusy = false, audioReady = false;
  let iceVariant: IceSoundId = 'weightless';
  const iceSelect = element<HTMLSelectElement>('ice-sound');
  const iceGroups = new Map<string, HTMLOptGroupElement>();
  for (const [index, id] of ICE_PALETTE_IDS.entries()) {
    const sound = ICE_PALETTE[id];
    let group = iceGroups.get(sound.family);
    if (!group) {
      group = document.createElement('optgroup'); group.label = sound.family;
      iceGroups.set(sound.family, group); iceSelect.append(group);
    }
    const option = document.createElement('option');
    option.value = id; option.textContent = `${String(index + 1).padStart(2, '0')} — ${sound.label}`;
    group.append(option);
  }
  const loop = createRenderLoop({
    request: callback => requestAnimationFrame(callback),
    cancel: id => cancelAnimationFrame(id),
    render: frame,
  });
  const graphics = new GraphicsRecovery(() => {
    suspension++;
    audio.stop();
    paused = true; accumulator = 0; clearInput(); loop.setActive(false);
    scene.releaseGraphics();
  }, graphicsUnavailable);
  function graphicsUnavailable() {
    saveCurrent();
    showGraphicsFailure();
    hud();
  }
  // Defense in depth for DOM actions (including synthetic clicks on enabled
  // controls). State-changing functions and the frame/tick paths also gate.
  for (const type of ['click', 'input', 'change', 'pointerdown', 'pointermove', 'keydown']) {
    element('boundstoy').addEventListener(type, event => {
      const target = event.target as Node;
      if (recoveryDialog.contains(target)) return;
      if ((!persistenceReady || storageBusy || saveDialog.open || newRunDialog.open)
        && !saveDialog.contains(target) && !newRunDialog.contains(target)) {
        event.preventDefault(); event.stopImmediatePropagation(); return;
      }
      if (graphics.awaitingResume && event instanceof KeyboardEvent && event.repeat) {
        event.preventDefault(); event.stopImmediatePropagation(); return;
      }
      if (graphics.available || recoveryDialog.contains(event.target as Node)) return;
      event.preventDefault(); event.stopImmediatePropagation();
    }, { ...options, capture: true });
  }
  loop.setVisible(!document.hidden);
  scene.onInvalidate = loop.invalidate;
  try { preferences = readPreferences(localStorage.getItem(PREFERENCES_KEY)); }
  catch (error) { report('Could not load sound preferences', error); }
  audio.setVolume(preferences.volume);

  function soundControls() {
    for (const id of ['audio', 'demo-audio']) {
      const button = element<HTMLButtonElement>(id);
      text(id, audioBusy ? 'Updating sound...' : preferences.sound ? 'Sound on' : 'Sound off');
      // Keep the toggle focusable while busy (disabling it drops keyboard focus); setSound ignores repeats.
      button.setAttribute('aria-pressed', String(preferences.sound));
      button.setAttribute('aria-label', preferences.sound ? 'Mute sound' : 'Enable sound');
      button.setAttribute('aria-disabled', String(audioBusy));
    }
    for (const id of ['sound-volume', 'demo-volume']) {
      element<HTMLInputElement>(id).value = String(preferences.volume * 100);
      text(`${id}-label`, `Volume ${Math.round(preferences.volume * 100)}%`);
    }
    iceControls();
  }
  function iceControls() {
    iceSelect.value = iceVariant; iceSelect.disabled = audioBusy;
    for (const id of ['ice-prev', 'ice-next', 'ice-preview']) element<HTMLButtonElement>(id).disabled = audioBusy;
    text('ice-description', ICE_PALETTE[iceVariant].description);
    element<HTMLAnchorElement>('ice-source').href = `${import.meta.env.BASE_URL}audio/ice-palette/${iceVariant}.strudel.js`;
  }
  function savePreferences() {
    try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)); }
    catch (error) { report('Could not save sound preferences', error); }
  }
  /** The player's latest request; a toggle pressed mid-change is applied when the change settles. */
  let soundTarget: boolean | null = null, soundInFlight = false;
  async function setSound(enabled: boolean, variant = iceVariant) {
    if (audioBusy) { soundTarget = enabled; return false; }
    audioBusy = true; soundTarget = null; soundInFlight = enabled; soundControls();
    let failed = false;
    try {
      await audio.setEnabled(enabled, isSoundDemo(puzzle) ? variant : undefined); audioReady = enabled;
      preferences = { ...preferences, sound: enabled };
      savePreferences();
      return true;
    } catch (error) {
      failed = true;
      audioReady = audio.inspect().enabled; preferences = { ...preferences, sound: audioReady };
      report('Could not change sound', error); return false;
    }
    finally {
      audioBusy = false; soundControls();
      const queued = soundTarget; soundTarget = null;
      if (!failed && queued !== null && queued !== preferences.sound) void setSound(queued, variant);
    }
  }
  function activateSound() {
    if (preferences.sound && !audioReady) void setSound(true);
  }
  soundControls();

  function canPlay() {
    return persistenceReady && !storageBusy && !pageGone && !saveDialog.open && !newRunDialog.open && graphics.available;
  }
  function recordFor(course: Level) {
    return course.version === 2 ? getWorldRecord(worldRecords, course)
      : Object.hasOwn(progress, course.id) ? progress[course.id] : undefined;
  }
  function campaignProgress(): Progress {
    const records = { ...progress };
    for (const course of LEVELS) if (course.version === 2) {
      delete records[course.id];
      const best = getWorldRecord(worldRecords, course);
      if (best) records[course.id] = best;
    }
    return records;
  }
  function freezeForStorage() {
    suspension++; paused = true; accumulator = 0; clearInput(); syncRendering(); overlay(); hud();
  }
  function storageFailure(reason: string) {
    console.warn('[Boundstoy] Save unavailable:', reason);
    freezeForStorage();
    text('save-status', 'Not saved');
    element<HTMLButtonElement>('save-export').disabled = storage.status !== 'ok';
    element<HTMLButtonElement>('save-reset').disabled = storage.status !== 'ok';
    text('save-copy', `${reason} Your existing data has not been discarded. Retry, export it, or explicitly play without saving.`);
    if (graphics.available && !saveDialog.open) saveDialog.showModal();
  }
  function saveChanged(status: SaveStatus) {
    if (pageGone) return;
    progressSaved = status.phase === 'saved';
    text('save-status', memoryOnly ? 'Not saving' : status.phase === 'saving' ? 'Saving...'
      : status.phase === 'saved' ? 'Saved' : status.phase === 'error' ? 'Not saved' : 'Save options');
    if (status.phase === 'error') storageFailure(status.reason ?? 'Saving failed.');
    overlay(); hud();
  }
  function saveCurrent() {
    if (testing || mode !== 'play' || level.version !== 2 || !currentRunId) return;
    const snapshot = createRunSnapshot(level, currentRunId, state);
    activeRun = state.won ? null : snapshot;
    if (!memoryOnly && continuation && persistenceReady)
      void continuation.save(createCheckpointSnapshot(level, currentRunId, state));
  }
  function restoreRun(snapshot: RunSnapshot) {
    if (!graphics.available) return;
    const index = LEVELS.findIndex(course => course.version === 2 && course.id === snapshot.worldId
      && course.revision === snapshot.revision);
    if (index < 0) { storageFailure('The saved world revision is unavailable.'); return; }
    selectedCourse = index; mode = 'play'; testing = false; puzzle = null;
    load(LEVELS[index], 'paused');
    currentRunId = snapshot.runId; state = snapshot.state;
    visualTime = state.tick * DT; manualClock = true;
    lastDeath = state.deathCause ? deathMessage(state.deathCause) : '';
    updateLayout(); loop.drawNow();
  }
  async function connectStorage() {
    if (storageBusy || pageGone) return;
    storageBusy = true; text('save-status', 'Loading save...');
    try {
      if (storage.status !== 'ok') storage = openBrowserRunStorage(resolveWorld, obsoleteWorldRevisions);
      if (storage.status !== 'ok') { storageFailure(storage.reason); return; }
      const acquired = await storage.value.acquire();
      if (acquired.status !== 'ok') { storageFailure(`${acquired.status}: ${acquired.reason}`); return; }
      if (pageGone) { await acquired.value.release(); return; }
      const owner = new RunContinuation(acquired.value, saveChanged);
      continuation = owner;
      const legacy = await acquired.value.readLegacy();
      if (pageGone || continuation !== owner) { await owner.close(); return; }
      if (legacy.status !== 'ok') {
        await continuation.close(); continuation = null;
        storageFailure(legacy.reason); return;
      }
      progress = legacy.value.progress; legacyDraft = legacy.value.draft;
      worldRecords = acquired.value.initial.records; activeRun = acquired.value.initial.active;
      if (memoryOnly) { started = false; testing = false; mode = 'play'; puzzle = null; }
      currentRunId = null;
      persistenceReady = true; memoryOnly = false;
      text('save-retry', 'Retry saving');
      element<HTMLButtonElement>('save-export').disabled = false;
      element<HTMLButtonElement>('save-reset').disabled = false;
      saveDialog.close();
      if (activeRun) restoreRun(activeRun);
      else if (!started && mode === 'play' && graphics.available) {
        selectedCourse = nextCourse(LEVELS, campaignProgress()) ?? 0;
        load(LEVELS[selectedCourse]);
      }
      text('save-status', activeRun ? 'Saved' : 'Save options');
    } finally {
      storageBusy = false;
      if (!pageGone) {
        updateLayout(); syncRendering();
        if (new URLSearchParams(location.search).has('debug')) window.__BOUNDSTOY__ = debug;
      }
    }
  }
  function beginWorld(index: number, entry: 'play' | 'paused') {
    const next = LEVELS[index];
    if (!canPlay() || next.version !== 2) return;
    const begin = () => {
      if (!canPlay()) return;
      selectedCourse = index; mode = 'play'; testing = false; puzzle = null; screen = 'play'; load(next, 'paused');
      currentRunId = crypto.randomUUID();
      const snapshot = createRunSnapshot(next, currentRunId, state);
      activeRun = snapshot;
      if (memoryOnly) { if (entry === 'play') play(); return; }
      if (!continuation) { storageFailure('Save ownership is unavailable.'); return; }
      storageBusy = true;
      const intent = suspension;
      void continuation.replace(snapshot).then(answer => {
        storageBusy = false;
        if (pageGone || currentRunId !== snapshot.runId) return;
        if (answer.status === 'ok' && entry === 'play' && suspension === intent
          && !document.hidden && !settingsDialog.open && !graphics.awaitingResume) play();
        overlay(); hud();
      });
    };
    if (activeRun) {
      setPaused(true);
      pendingNew = begin; newRunDialog.showModal();
      clearInput(); syncRendering();
      element('new-run-cancel').focus();
    } else begin();
  }
  function restartRun() {
    if (!canPlay() || mode === 'edit') return;
    if (checkpointPuzzles(level) && !state.won && (testing || currentRunId)) {
      state = restartCheckpoint(level, state);
      accumulator = 0; feedbackUntil = 0; clearInput();
      // Existing scene rebuild is the public reset boundary for interpolation,
      // trails and hazard effects. Do not record a teleport as player movement.
      scene.setLevel(level); scene.highlight(null);
      saveCurrent(); play(); loop.drawNow();
    } else if (level.version === 2 && !testing) beginWorld(selectedCourse, 'play');
    else load(level, 'play');
  }

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
    // Home and Levels show a static backdrop/preview: redraw on change only, never a continuous idle loop.
    loop.setActive(persistenceReady && !storageBusy && !saveDialog.open && !newRunDialog.open
      && graphics.available && !graphics.awaitingResume && !settingsDialog.open && (screen === 'play' || screen === 'edit')
      && (!started || mode === 'edit' || state.won || !paused));
  }
  function saveDraft() {
    if (!draft) return;
    legacyDraft = JSON.stringify(draft);
    if (memoryOnly || !continuation) { text('draft-status', 'Not saved. Export JSON to keep your work.'); return; }
    const source = legacyDraft;
    text('draft-status', 'Saving draft...');
    void continuation.execute(lease => lease.writeLegacyDraft(source)).then(answer => {
      if (!pageGone && legacyDraft === source)
        text('draft-status', answer.status === 'ok' ? 'Draft saved.' : 'Not saved. Export JSON to keep your work.');
    });
  }
  function showScreen(next: typeof screen) {
    screen = next;
    updateLayout(); syncRendering();
  }
  /** World backdrop for Home: the saved run (paused) or a fresh, unstarted world. */
  function goHome() {
    if (!canPlay()) return;
    setPaused(true);
    const world = LEVELS[selectedCourse];
    if (mode === 'edit' || puzzle || testing || level !== world) {
      mode = 'play'; testing = false; puzzle = null; screen = 'home';
      if (activeRun && world.version === 2 && activeRun.worldId === world.id && activeRun.revision === world.revision) restoreRun(activeRun);
      else load(world);
    }
    showScreen('home');
    element('home-play').focus({ preventScroll: true });
  }
  function homeWorldRun() {
    const world = LEVELS[selectedCourse];
    if (world.version !== 2) return null;
    if (level === world && currentRunId && !state.won) return { state };
    return activeRun?.worldId === world.id && activeRun.revision === world.revision ? activeRun : null;
  }
  function renderHome() {
    const world = LEVELS[selectedCourse], record = recordFor(world);
    text('home-world-title', world.name);
    text('home-world-copy', world.version === 2
      ? `One continuous escape in ${world.sections.length} sections. Read the blasts, reach each checkpoint, find the golden exit.`
      : world.description);
    const summary = world.version === 2 ? worldSummary(world, homeWorldRun(), record) : null;
    const pips = element('home-pips');
    pips.replaceChildren(...sectionPips(summary?.section ?? null).map(kind => {
      const item = document.createElement('li'); item.className = kind; return item;
    }));
    pips.setAttribute('aria-label', summary?.section ? `Section ${summary.section.index + 1} of ${summary.section.total}` : 'Section progress');
    text('home-progress', summary?.progressLine ?? '');
    text('home-best', summary?.bestLine ?? (record ? `Best ${timeLabel(record.ticks)}` : 'No record yet'));
    element('home-deathless').hidden = !(summary?.deathless ?? bestClean(record) !== undefined);
    text('home-play', `${summary?.primaryLabel ?? (record ? 'Play again' : 'Play')} →`);
    element('new-run').hidden = !summary?.canNewRun;
    // Several worlds (fixtures today) get a selector; worlds start at their own entry, never mid-section.
    element('course-strip').hidden = LEVELS.length < 2;
    text('completion-count', `${LEVELS.filter(course => recordFor(course)).length} / ${LEVELS.length} cleared`);
    if (LEVELS.length > 1) element('course-list').replaceChildren(...LEVELS.map((course, index) => {
      const button = document.createElement('button'), number = document.createElement('span');
      button.dataset.level = String(index);
      button.setAttribute('aria-pressed', String(index === selectedCourse));
      const name = document.createElement('span');
      number.className = 'course-number'; number.textContent = String(index + 1).padStart(2, '0');
      name.className = 'course-name'; name.textContent = course.name;
      button.append(number, name, recordFor(course) ? ' ✓' : '');
      const target = MASTERY_TARGETS[course.id];
      if (course.version === 1 && typeof target === 'number') {
        // Retired V1 courses keep their mastery rank; worlds have no preset targets.
        const best = recordFor(course), clean = bestClean(best), rank = document.createElement('small');
        rank.className = 'course-rank';
        rank.textContent = `${runRank(best, target)} · ${clean === undefined ? 'Mastery' : 'Clean'} ${timeLabel(clean ?? target)}`;
        button.append(rank);
      }
      return button;
    }));
    const playerSets = sets.filter(set => set.id !== 'sound');
    text('home-levels-count', `${playerSets.reduce((sum, set) => sum + set.items.length, 0)} short levels in ${playerSets.length} sets`);
  }
  function renderLevels() {
    const set = sets.find(candidate => candidate.id === levelSet) ?? sets[0];
    const tabs = element('level-tabs');
    tabs.replaceChildren(...sets.map(candidate => {
      const tab = document.createElement('button');
      tab.id = `tab-${candidate.id}`; tab.dataset.set = candidate.id; tab.textContent = candidate.title;
      tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', 'level-grid');
      tab.setAttribute('aria-selected', String(candidate === set)); tab.tabIndex = candidate === set ? 0 : -1;
      return tab;
    }));
    element('level-grid').setAttribute('aria-labelledby', `tab-${set.id}`);
    text('level-set-summary', set.summary);
    element('level-grid').replaceChildren(...set.items.map((item, index) => {
      const tile = document.createElement('button'), done = puzzleTrials.has(item.level.id);
      tile.className = 'level-tile'; tile.id = `choose-${item.level.id}`; tile.dataset.puzzle = item.level.id;
      tile.setAttribute('aria-pressed', String(puzzle === item));
      tile.setAttribute('aria-label', `${index + 1}. ${item.level.name}${done ? ', cleared' : ''}`);
      const number = document.createElement('span'), name = document.createElement('span');
      number.className = 'tile-number'; number.textContent = String(index + 1);
      name.className = 'tile-name'; name.textContent = item.level.name;
      tile.append(number, name);
      if (done) { const mark = document.createElement('span'); mark.className = 'tile-mark'; mark.textContent = '✓'; tile.append(mark); }
      return tile;
    }));
    const selected = puzzle && set.items.includes(puzzle) ? puzzle : null;
    element('level-detail').hidden = !selected;
    if (!selected) return;
    text('level-detail-title', selected.level.name);
    text('level-detail-copy', selected.question);
    text('level-detail-credit', trialCredit(selected) ?? '');
    const best = puzzleTrials.get(selected.level.id);
    text('level-detail-result', best ? `Best this session ${timeLabel(best.ticks)} · ${best.deaths} ${best.deaths === 1 ? 'retry' : 'retries'}` : '');
    text('level-play', isSoundDemo(selected) ? 'Start walk →' : 'Play →');
  }
  /** Load a trial without starting it. On the level screen this is the live preview. */
  function previewTrial(id: string) {
    if (!canPlay()) return;
    const entry = findTrial(sets, id);
    if (!entry) throw new Error('Unknown puzzle.');
    saveCurrent();
    puzzle = entry.puzzle; levelSet = entry.set.id; testing = true; mode = 'play';
    load(entry.puzzle.level);
    if (isSoundDemo(entry.puzzle) && audioReady) void setSound(true);
  }
  function openLevels(focus = true) {
    if (!canPlay()) return;
    setPaused(true);
    const current = puzzle && findTrial(sets, puzzle.level.id) ? puzzle.level.id
      : (sets.find(set => set.id === levelSet) ?? sets[0]).items[0].level.id;
    screen = 'levels';
    previewTrial(current);
    showScreen('levels');
    if (focus) element(`choose-${current}`).focus({ preventScroll: true });
  }
  function loadExplosionPuzzle(id: string) {
    if (settingsDialog.open) closeSettings();
    screen = 'play';
    previewTrial(id);
    element('primary-action').focus({ preventScroll: true });
  }
  function overlay() {
    const card = element('overlay');
    element('restart').setAttribute('aria-label', checkpointPuzzles(level) && !state.won ? 'Restart puzzle'
      : level.version === 2 && !testing ? 'New run' : 'Restart level');
    element('restart').title = checkpointPuzzles(level) && !state.won
      ? 'Restart puzzle (R) — return to checkpoint, keeping time and retries'
      : level.version === 2 && !testing ? 'New run (R) — asks before replacing your run' : 'Restart level (R)';
    const exit = puzzle ? 'Levels' : testing ? 'Editor' : 'Home';
    if (graphics.awaitingResume) {
      card.hidden = settingsDialog.open || screen !== 'play' && mode !== 'edit';
      card.classList.remove('won');
      for (const id of ['finish-stats', 'finish-comparison', 'finish-mastery', 'mastery-target', 'retry-course', 'overlay-settings', 'overlay-exit']) element(id).hidden = true;
      text('overlay-kicker', 'GRAPHICS RESTORED');
      text('overlay-title', 'Still paused.');
      text('overlay-copy', 'Your state is unchanged. Resume when you are ready.');
      text('primary-action', mode === 'edit' ? 'Resume editor →' : 'Resume →');
      return;
    }
    const target = MASTERY_TARGETS[level.id], ranked = level.version === 1 && !testing && typeof target === 'number';
    card.hidden = screen !== 'play' || mode === 'edit' || started && !paused && !state.won;
    card.classList.toggle('won', state.won);
    element('finish-stats').hidden = !state.won;
    element('finish-comparison').hidden = !state.won || testing;
    element('finish-mastery').hidden = !state.won || !ranked;
    element('mastery-target').hidden = state.won || !ranked || mode === 'edit';
    if (ranked) text('mastery-target', `Mastery: ${timeLabel(target)} or faster, with zero retries.`);
    element('retry-course').hidden = !started || mode === 'edit';
    text('retry-course', puzzle && state.won ? 'New trial ↻' : checkpointPuzzles(level) && !state.won ? 'Restart puzzle ↻'
      : level.version === 2 && (!testing || checkpointPuzzles(level)) ? 'New run ↻' : 'Retry level ↻');
    element('overlay-settings').hidden = state.won;
    element('overlay-exit').hidden = false;
    text('overlay-exit', exit);
    if (mode === 'edit') return;
    const guide = courseGuide(level, state);
    if (state.won) {
      const next = nextCourse(LEVELS, campaignProgress(), selectedCourse);
      const complete = !testing && next === null;
      text('overlay-kicker', testing ? 'PLAYTEST COMPLETE' : state.deaths === 0 ? 'CLEAN RUN · ZERO RETRIES' : 'NICE FINISH');
      text('overlay-title', level.version === 2 && !testing ? 'World complete.' : complete ? 'Campaign complete.' : 'Level clear.');
      text('overlay-copy', testing ? 'Back to the editor, or give it another run.'
        : level.version === 2 ? 'Try for a faster time or a deathless run.'
        : complete ? `All ${LEVELS.length} encounters cleared. Chase the mastery targets.`
        : next !== null ? `Up next: ${LEVELS[next].name}.` : 'Choose another route to master.');
      if (!testing) text('overlay-copy', `${element('overlay-copy').textContent} ${progressSaved ? 'Record saved.'
        : continuation?.status.phase === 'saving' ? 'Saving record…' : 'Record not saved.'}`);
      text('finish-time', timeLabel(state.tick));
      text('finish-retries', String(state.deaths));
      const best = recordFor(level), clean = bestClean(best);
      text('finish-best', testing ? 'PLAYTEST' : level.version === 2 ? best ? timeLabel(best.ticks) : '—'
        : clean === undefined ? '—' : timeLabel(clean));
      element('finish-best').previousElementSibling!.textContent = level.version === 2 ? 'Best time' : 'Best clean';
      if (level.version === 2 && !testing) {
        element('finish-mastery').hidden = false;
        text('finish-mastery', clean === undefined ? 'Deathless completion still ahead.' : 'Deathless completion achieved.');
      }
      if (ranked) text('finish-mastery', state.deaths > 0 ? `Assisted clear · Clean target ${timeLabel(target)}.`
        : state.tick <= target ? `Mastered · Target ${timeLabel(target)}.`
        : `Clean · Mastery target ${timeLabel(target)}.`);
      const delta = result ? (Math.abs(result.deltaTicks) * DT).toFixed(2) : '0.00';
      text('finish-comparison', !result || result.kind === 'first' ? level.version === 2 ? 'First world clear. Your time is the next challenge.' : state.deaths === 0
        ? 'First clear. Your next run is a new challenge.' : 'Assisted clear. Go again without retries for a clean record.'
        : result.kind === 'best' ? result.deltaTicks < 0 ? `Personal best! ${delta}s faster.` : `Personal best! ${result.fewerRetries} fewer retries.`
        : result.kind === 'equal' ? 'Matched your personal best.'
        : result.deltaTicks > 0 ? `${delta}s from your best. Find your next clean line.` : 'Matched your best time. Try fewer retries.');
      text('primary-action', testing ? 'Back to editor ↗' : level.version === 2 ? 'Home →' : complete ? 'Choose a level →' : 'Next level →');
      element('overlay-exit').hidden = !testing || !puzzle;
    } else if (started) {
      text('overlay-kicker', 'PAUSED');
      text('overlay-title', level.version === 2 && level.sections.length > 1 ? `Section ${guide.index + 1}: ${guide.title}` : level.name);
      text('overlay-copy', lastDeath ? `Last retry: ${lastDeath}` : puzzle ? puzzle.hints[guide.index] ?? puzzle.question : guide.hint);
      text('primary-action', 'Resume →');
    } else {
      text('overlay-kicker', 'READY');
      text('overlay-title', level.name);
      text('overlay-copy', `${puzzle ? puzzle.question : level.description} ${controlsHint(coarsePointer.matches)}`);
      text('primary-action', 'Start →');
    }
    if (puzzle) {
      if (state.won) {
        const next = nextTrial(sets, level.id);
        text('overlay-kicker', 'LEVEL COMPLETE');
        text('overlay-title', 'Trial complete.');
        text('overlay-copy', next ? `Up next: ${next.level.name}.` : 'That was the last level in this set.');
        text('primary-action', next ? 'Next level →' : 'All levels →');
        element('overlay-exit').hidden = !next;
        element('finish-best').previousElementSibling!.textContent = 'Session best';
        const best = puzzleTrials.get(level.id);
        text('finish-best', best ? timeLabel(best.ticks) : '—');
      }
      if (isSoundDemo(puzzle)) {
        text('overlay-kicker', 'SOUND GARDEN');
        if (!started) text('primary-action', 'Start walk →');
        if (state.won) {
          text('overlay-title', 'The listening walk is complete.');
          text('overlay-copy', 'That was the full mix. Walk again or audition individual sounds.');
          text('primary-action', 'Walk again →');
          element('finish-best').previousElementSibling!.textContent = 'Sound palette';
          text('finish-best', 'CC0');
        }
      }
    }
  }
  function hud() {
    text('timer', timeLabel(state.tick)); text('deaths', String(state.deaths).padStart(2, '0'));
    const guide = courseGuide(level, state);
    if (guide.index !== hintSection) { hintSection = guide.index; hintUntil = state.tick + ROUTE_HINT_TICKS; }
    if (level.version === 2 && mode === 'play' && !testing)
      text('course-number', `SECTION ${guide.index + 1} / ${guide.total} · ${guide.title}`);
    const pips = level.version === 2 && level.sections.length > 1 && mode === 'play' ? sectionPips(sectionProgress(level, state)) : [];
    if (pips.join() !== pipsKey) {
      pipsKey = pips.join();
      element('section-pips').replaceChildren(...pips.map(kind => {
        const item = document.createElement('li'); item.className = kind; return item;
      }));
    }
    const intro = guide.index === 0 && state.visited.length === 0 && state.tick < ROUTE_HINT_TICKS / 2;
    text('route-hint', intro ? controlsHint(coarsePointer.matches) : puzzle ? puzzle.hints[guide.index] ?? '' : guide.hint);
    const hint = element('route-hint'), feedback = element('game-feedback'), pause = element<HTMLButtonElement>('pause');
    if (hint.title !== guide.title) hint.title = guide.title;
    hint.classList.toggle('faded', !started || paused || state.won || state.tick >= hintUntil || !hint.textContent);
    const hideFeedback = state.tick >= feedbackUntil || mode === 'edit' || state.won;
    if (feedback.hidden !== hideFeedback) feedback.hidden = hideFeedback;
    const disablePause = mode === 'edit' || !started || state.won;
    if (pause.disabled !== disablePause) pause.disabled = disablePause;
    const unsaved = !puzzle && !testing && (memoryOnly || continuation?.status.phase === 'error');
    if (element('save-warning').hidden === unsaved) element('save-warning').hidden = !unsaved;
    document.querySelectorAll<HTMLButtonElement>('[data-direction]').forEach(button => {
      const disabled = mode !== 'play' || !started || paused || state.won || settingsDialog.open;
      if (button.disabled !== disabled) button.disabled = disabled;
    });
  }
  function updateLayout() {
    if (mode === 'edit') screen = 'edit';
    else if (screen === 'edit') screen = 'play';
    if (root.dataset.screen !== screen) root.dataset.screen = screen;
    element('home-screen').hidden = screen !== 'home';
    element('levels-screen').hidden = screen !== 'levels';
    element('editor-panel').hidden = screen !== 'edit';
    text('course-title', mode === 'edit' ? 'Level editor' : level.name);
    const trial = puzzle ? findTrial(sets, puzzle.level.id) : undefined;
    text('course-number', puzzle === SOUND_ICE_DEMO ? 'SOUND GARDEN · ICE SOUNDS'
      : isSoundDemo(puzzle) ? 'SOUND GARDEN · MATERIALS & RHYTHM'
      : trial ? `${trial.set.title} · ${trial.index + 1} / ${trial.set.items.length}`
      : mode === 'edit' || testing ? 'YOUR LEVEL' : `${selectedCourse + 1} / ${LEVELS.length}`);
    text('help-restart-label', checkpointPuzzles(level) ? 'Restart puzzle' : level.version === 2 && !testing ? 'New run' : 'Restart level');
    text('help-restart-note', puzzle ? ' (returns to the start or checkpoint and resets the pattern, keeping time and retries)'
      : checkpointPuzzles(level)
      ? ' (returns to checkpoint and resets its pattern, keeping time and retries; use New run on Home to start over)'
      : level.version === 2 && !testing ? ' (asks before replacing an unfinished world run)' : ' (resets the level)');
    element('sound-demo-controls').hidden = !isSoundDemo(puzzle);
    element<HTMLButtonElement>('ice-room-open').disabled = puzzle === SOUND_ICE_DEMO;
    element<HTMLButtonElement>('sound-lane-open').disabled = puzzle === SOUND_DEMO;
    element('dev-tools').hidden = !dev;
    element('editor-coordinates').hidden = mode !== 'edit';
    element('touch-controls').hidden = mode === 'edit';
    element('route-hint').hidden = mode === 'edit';
    element('editor-return').hidden = !testing || Boolean(puzzle);
    element<HTMLButtonElement>('restart').disabled = mode === 'edit';
    text('controls-note', mode === 'edit' ? 'Choose a brush, then click or drag on the board. Control or Command Z undoes a change. Escape opens settings.'
      : isSoundDemo(puzzle) ? 'WASD or arrows to move. Space or Escape pauses. R restarts. Open Audition sounds to compare twelve ice sounds, choose the ice room or hear individual cues.'
      : puzzle ? 'WASD or arrows to move. Space or Escape pauses. R restarts at the start or checkpoint, keeping time and retries.'
      : checkpointPuzzles(level)
      ? 'WASD or arrow keys to move. Space or Escape pauses and resumes. R restarts the current puzzle at its checkpoint, keeping time and retries. New run on the home screen starts the world over. On touch screens, hold the direction buttons to move.'
      : level.version === 2 && !testing
      ? 'WASD or arrow keys to move. Space or Escape pauses and resumes. R requests a new run, with confirmation before replacing an unfinished run. On touch screens, hold the direction buttons to move.'
      : 'WASD or arrow keys to move. Space or Escape pauses and resumes. R restarts the level. On touch screens, hold the direction buttons to move.');
    viewport.setAttribute('aria-label', mode === 'edit' ? 'Level editor. Choose a brush, then click or drag on the board.'
      : checkpointPuzzles(level) ? 'Boundstoy world. WASD or arrows to move; R to restart the current puzzle at its checkpoint; Space to pause.'
      : level.version === 2 && !testing ? 'Boundstoy world. WASD or arrows to move; R to request a new run; Space to pause.'
      : 'Boundstoy course. WASD or arrows to move; R to restart; Space to pause.');
    editorControls();
    if (screen === 'home') renderHome();
    if (screen === 'levels') renderLevels();
    overlay(); hud();
  }
  function load(next: Level, entry: 'ready' | 'play' | 'paused' = 'ready') {
    if (!graphics.resume()) return;
    audio.stop();
    currentRunId = null;
    level = next; state = createState(level); started = entry !== 'ready'; paused = entry !== 'play';
    accumulator = 0; feedbackUntil = 0; lastDeath = ''; result = null; manualClock = false; hintSection = -1;
    clearInput(); scene.setLevel(level); scene.highlight(null);
    // Transfer focus before hiding the action that started this run.
    if (!paused && screen === 'play') viewport.focus({ preventScroll: true });
    updateLayout();
    syncRendering();
    if (entry === 'play') activateSound();
  }
  function loadCourse(index: number, entry: 'play' | 'paused' = 'play') {
    if (!canPlay()) return;
    if (!Number.isInteger(index) || !LEVELS[index]) throw new Error('Unknown course index.');
    saveCurrent();
    const next = LEVELS[index];
    if (next.version === 2) {
      if (activeRun?.worldId === next.id && activeRun.revision === next.revision) {
        restoreRun(activeRun); if (entry === 'play') play();
      } else beginWorld(index, entry);
      return;
    }
    selectedCourse = index; mode = 'play'; testing = false; puzzle = null; screen = 'play'; load(LEVELS[index], entry);
    if (entry === 'paused') element('primary-action').focus({ preventScroll: true });
  }
  function play() {
    if (!canPlay() || settingsDialog.open) return;
    if (mode === 'edit') {
      if (graphics.awaitingResume) { graphics.resume(); clearInput(); overlay(); syncRendering(); viewport.focus(); }
      return;
    }
    graphics.resume();
    activateSound();
    if (screen !== 'play') showScreen('play');
    if (state.won) {
      if (isSoundDemo(puzzle)) { load(level); return; }
      if (puzzle) {
        const next = nextTrial(sets, level.id);
        if (next) { previewTrial(next.level.id); play(); } else openLevels();
        return;
      }
      if (testing) { enterEditor(); return; }
      const next = nextCourse(LEVELS, campaignProgress(), selectedCourse);
      if (next === null) goHome();
      else loadCourse(next);
      return;
    }
    if (level.version === 2 && !testing && !currentRunId) { beginWorld(selectedCourse, 'play'); return; }
    if (isSoundDemo(puzzle)) audio.stop();
    clearInput(); started = true; paused = false; accumulator = 0; manualClock = false;
    viewport.focus({ preventScroll: true }); overlay(); hud();
    syncRendering();
  }
  function setPaused(value: boolean) {
    if (value || isSoundDemo(puzzle)) audio.stop();
    if (!graphics.available) return;
    if (value) suspension++;
    else if (!canPlay()) return;
    if (!started || state.won || mode === 'edit') return;
    if (!value) graphics.resume();
    paused = value; clearInput(); accumulator = 0; if (!value) manualClock = false;
    if (!value) viewport.focus({ preventScroll: true });
    overlay(); hud(); syncRendering();
    if (value) saveCurrent();
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
    if (level.hazards.some(hazard => hazard.kind === 'pulse')) add('Explosive tiles', 'A framed tile burns round its edge, then explodes instantly. Each colour fires as one group. The tile is safe immediately afterwards, even while debris fades.', '#ff9a2e');
    if (level.hazards.some(hazard => hazard.kind === 'saw')) add('Saws', 'Watch the patrol and cross when the way is clear.', '#e35b80');
  }
  function openSettings(focus: HTMLElement = element('settings-title')) {
    if (!canPlay() || settingsDialog.open) return;
    settingsReturn = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    clearInput(); setPaused(true); fillHelp();
    settingsDialog.append(element('notice'));
    settingsDialog.showModal(); settingsDialog.scrollTop = 0;
    overlay(); hud(); focus.focus({ preventScroll: focus === element('settings-title') });
    syncRendering();
  }
  function closeSettings() {
    settingsDialog.close();
    root.append(element('notice'));
    overlay(); hud(); syncRendering();
    const target = settingsReturn && settingsReturn.isConnected && settingsReturn.getClientRects().length ? settingsReturn
      : screen === 'home' ? element('home-play') : screen === 'levels' ? element('level-play') : element('primary-action');
    settingsReturn = null;
    target.focus({ preventScroll: true });
  }
  function tick(input: Point) {
    if (!canPlay() || graphics.awaitingResume) return;
    const before = state;
    state = step(level, state, input);
    scene.record(before, state, input);
    if (isSoundDemo(puzzle)) {
      const motion = iceMotion(level, before, state);
      if (!motion) audio.updateGlide(null, iceVariant);
      else if (audioReady && !audioBusy) {
        if (audio.isGlideReady(iceVariant)) audio.updateGlide(motion, iceVariant);
        else void setSound(true);
      }
    }
    for (const cue of soundEvents(level, before, state)) {
      if (isSoundDemo(puzzle) && (cue === 'soft' || cue === 'hard')) continue;
      audio.play(cue);
      if (isSoundDemo(puzzle)) text('sound-last', `${SOUNDS[cue].label}: ${SOUNDS[cue].description}`);
    }
    if (state.event === 'death' && state.deathCause) {
      lastDeath = deathMessage(state.deathCause);
      text('game-feedback', `Retry ${state.deaths}: ${lastDeath}`);
      element('game-feedback').classList.add('hit');
      feedbackUntil = state.tick + 240;
    }
    if (state.event === 'checkpoint') {
      text('game-feedback', `Checkpoint ${String(state.visited.length).padStart(2, '0')} ${testing ? 'reached' : 'saved'}. Next attempt starts here.`);
      element('game-feedback').classList.remove('hit');
      feedbackUntil = state.tick + 180;
    }
    if (state.event === 'win') {
      clearInput();
      if (puzzle && !isSoundDemo(puzzle)) puzzleTrials.set(level.id, { ticks: state.tick, deaths: state.deaths });
      if (!testing) {
        progressSaved = false;
        if (level.version === 2) {
          result = worldFinishResult(worldRecords, level, { ticks: state.tick, deaths: state.deaths });
          worldRecords = recordWorldFinish(worldRecords, level, state.tick, state.deaths);
        } else {
          result = finishResult(recordFor(level), { ticks: state.tick, deaths: state.deaths });
          progress = recordFinish(progress, level.id, state.tick, state.deaths);
          if (!memoryOnly && continuation) {
            const { id } = level, { tick, deaths } = state;
            void continuation.execute(lease => lease.recordLegacyFinish(id, tick, deaths));
          }
        }
      }
      overlay();
      element('primary-action').focus({ preventScroll: true });
    }
    if (shouldSave(before, state, level)) saveCurrent();
  }
  function commit(next: Level) {
    if (mode !== 'edit' || !graphics.available || graphics.awaitingResume) return;
    history = [...history.slice(-39), level]; draft = next; level = next; state = createState(level);
    sawStart = null;
    scene.setLevel(level); editorControls(); saveDraft(); element<HTMLButtonElement>('undo').disabled = false;
  }
  function editorControls() {
    const enabled = mode === 'edit' && level.version === 2;
    const select = element<HTMLSelectElement>('section-focus');
    element('section-focus-field').hidden = !enabled;
    select.disabled = !enabled;
    select.replaceChildren();
    if (level.version === 2) {
      editorSection = Math.min(editorSection, level.sections.length - 1);
      level.sections.forEach((section, index) => {
        const option = document.createElement('option');
        option.value = String(index); option.textContent = `${index + 1} · ${section.name}`;
        select.append(option);
      });
      select.value = String(editorSection);
    } else editorSection = 0;
    for (const id of ['spawn', 'goal', 'checkpoint']) {
      const button = element('palette').querySelector<HTMLButtonElement>(`[data-brush="${id}"]`);
      if (!button) continue; // Initial layout precedes palette construction.
      button.disabled = level.version === 2;
      button.title = level.version === 2 ? 'World markers require validated section JSON.' : '';
    }
    if (level.version === 2 && ['spawn', 'goal', 'checkpoint'].includes(brush))
      element('palette').querySelector<HTMLButtonElement>('[data-brush="."]')?.click();
  }
  // This copy is presentation-only. Never feed editor focus into step(), saves,
  // snapshots, checkpoint history or the campaign continuation.
  function sceneState() {
    if (mode !== 'edit' || level.version !== 2) return state;
    const bounds = level.sections[editorSection].bounds;
    return { ...state, position: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 } };
  }
  element('section-focus').addEventListener('change', () => {
    if (mode !== 'edit' || level.version !== 2 || !canPlay() || graphics.awaitingResume) return;
    const value = element<HTMLSelectElement>('section-focus').value, index = Number(value);
    if (value === '' || !Number.isInteger(index) || !level.sections[index]) {
      element<HTMLSelectElement>('section-focus').value = String(editorSection);
      notify('Select an existing world section.', true); return;
    }
    editorSection = index; sawStart = null; clearInput(); scene.highlight(null); loop.drawNow();
  }, options);
  function enterEditor() {
    if (!canPlay()) return;
    saveCurrent();
    if (!testing) history = [];
    mode = 'edit'; testing = false; puzzle = null; sawStart = null;
    if (!draft) {
      try {
        const saved = legacyDraft;
        if (saved) {
          draft = importLevel(saved);
          if (draft.hazards.some(hazard => hazard.kind === 'pulse'))
            notify('Draft restored. Pulse pads now explode for one tick; fading debris is harmless.');
        }
      } catch (error) { report('Could not load editor draft', error); }
    }
    draft ??= parseLevel({ ...LEVELS[selectedCourse], id: 'my-course', name: `${LEVELS[selectedCourse].name} remix` });
    load(draft); element<HTMLInputElement>('level-name').value = draft.name;
    element<HTMLButtonElement>('undo').disabled = history.length === 0;
    viewport.focus();
  }
  const brushes: { id: Brush; label: string; color: string; mark: string; help: string }[] = [
    ...Object.entries(TERRAIN).map(([id, value]) => ({ id: id as Tile, label: value.name.replace(' ground', ''), color: value.color, mark: id === ' ' ? '·' : id, help: `${value.hint} Click or drag to paint.` })),
    { id: 'spawn', label: 'Start', color: '#3c887c', mark: 'S', help: 'Place the starting point. This also creates safe floor.' },
    { id: 'goal', label: 'Exit', color: '#9e7951', mark: 'G', help: 'Place the golden exit. This also creates safe floor.' },
    { id: 'checkpoint', label: 'Checkpoint', color: '#3c887c', mark: 'C', help: 'Place between puzzles, never next to the exit. Its ring is the collection zone. Erase removes it.' },
    { id: 'pulse', label: 'Pulse', color: '#943552', mark: '◉', help: 'An instant explosion every 3 seconds. Pick a colour per rhythm group; painting a pad again changes only its colour. Fading debris is harmless. JSON changes period and phase.' },
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
      element('pulse-styles').hidden = brush !== 'pulse';
      element('palette').querySelectorAll('button').forEach(node => {
        node.classList.toggle('selected', node === button); node.setAttribute('aria-pressed', String(node === button));
      });
    }, options);
    element('palette').append(button);
  }
  for (const id of EXPLOSION_STYLE_IDS) {
    const style = EXPLOSION_STYLES[id], button = document.createElement('button');
    button.dataset.style = id; button.title = `${style.name} (${style.inspiration})`;
    button.setAttribute('aria-pressed', String(id === pulseStyle));
    button.classList.toggle('selected', id === pulseStyle);
    const chip = document.createElement('span'); chip.className = 'style-chip';
    chip.style.borderColor = `#${style.frame.toString(16).padStart(6, '0')}`;
    button.append(chip, document.createTextNode(style.name));
    button.addEventListener('click', () => {
      pulseStyle = id;
      element('pulse-styles').querySelectorAll('button').forEach(node => {
        node.classList.toggle('selected', node === button); node.setAttribute('aria-pressed', String(node === button));
      });
    }, options);
    element('pulse-styles').append(button);
  }
  function paintAt(event: PointerEvent, initial: boolean) {
    if (!graphics.available || graphics.awaitingResume) return;
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
        else { commit(placeSaw(level, sawStart, point, level.version === 2 ? level.sections[editorSection].id : undefined)); sawStart = null; text('brush-help', 'Patrol placed. Click two new points to add another.'); }
      } else commit(paint(level, point, brush, level.version === 2 ? level.sections[editorSection].id : undefined, pulseStyle));
    } catch (error) { notify(error instanceof Error ? error.message : String(error), true); }
  }
  viewport.addEventListener('pointerdown', event => {
    if (event.target !== scene.renderer.domElement || screen === 'home' || screen === 'levels') return;
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
    if (!graphics.available || event.target !== viewport || screen === 'home' || screen === 'levels') return;
    if (event.code in keyDirections && mode === 'play') {
      event.preventDefault();
      if (!event.repeat && started && !paused && !state.won && !settingsDialog.open) keys.add(event.code);
    } else if (event.code === 'Space' && mode === 'play') {
      event.preventDefault();
      if (!event.repeat) { if (!started) play(); else setPaused(!paused); }
    } else if (event.code === 'KeyR' && mode === 'play' && !event.repeat) {
      event.preventDefault(); restartRun();
    } else if (event.code === 'Enter' && !event.repeat && mode === 'play' && (!started || state.won || paused)) {
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
    else if (graphics.status === 'lost' && !scene.renderer.getContext().isContextLost()) restoreGraphics();
    loop.setVisible(!document.hidden);
  }, options);
  document.querySelectorAll<HTMLButtonElement>('[data-direction]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      if (!graphics.available || mode !== 'play' || state.won || !started || paused || settingsDialog.open) return;
      touchPointers.set(event.pointerId, button.dataset.direction!);
      button.classList.add('pressed'); button.setPointerCapture(event.pointerId);
    }, options);
    const release = (event: PointerEvent) => { touchPointers.delete(event.pointerId); button.classList.remove('pressed'); };
    button.addEventListener('pointerup', release, options);
    button.addEventListener('pointercancel', release, options);
    button.addEventListener('lostpointercapture', release, options);
  });
  function undo() {
    if (mode !== 'edit' || !graphics.available || graphics.awaitingResume) return;
    const previous = history.pop();
    if (!previous) return;
    draft = previous; level = previous; state = createState(level); sawStart = null;
    scene.setLevel(level); editorControls(); saveDraft(); element<HTMLInputElement>('level-name').value = level.name;
    element<HTMLButtonElement>('undo').disabled = history.length === 0;
  }
  function rename() {
    if (!graphics.available || graphics.awaitingResume) return false;
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
  element('retry-course').addEventListener('click', restartRun, options);
  element('overlay-settings').addEventListener('click', () => openSettings(), options);
  element('overlay-exit').addEventListener('click', () => {
    if (puzzle) openLevels(); else if (testing) enterEditor(); else goHome();
  }, options);
  function togglePause() {
    if (!started || state.won || mode !== 'play') return;
    if (paused) play();
    else { setPaused(true); element('primary-action').focus({ preventScroll: true }); }
  }
  // The HUD button only pauses (repeat presses are harmless); Resume lives on the pause card.
  element('pause').addEventListener('click', () => {
    if (!started || state.won || mode !== 'play') return;
    setPaused(true);
    element('primary-action').focus({ preventScroll: true });
  }, options);
  // Pressing a HUD button must not blur the board: focus loss would pause
  // before the click and turn Pause into an immediate Resume.
  for (const id of ['pause', 'restart']) element(id).addEventListener('mousedown', event => event.preventDefault(), options);
  element('restart').addEventListener('click', () => {
    if (mode === 'edit') return;
    restartRun();
  }, options);
  element('home-play').addEventListener('click', () => {
    if (!canPlay()) return;
    screen = 'play';
    loadCourse(selectedCourse);
  }, options);
  element('new-run').addEventListener('click', () => {
    if (!canPlay() || mode === 'edit' || testing || level.version !== 2) return;
    beginWorld(selectedCourse, 'play');
  }, options);
  element('home-levels').addEventListener('click', () => openLevels(), options);
  element('course-list').addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-level]');
    if (!button || !canPlay()) return;
    screen = 'play';
    loadCourse(Number(button.dataset.level));
  }, options);
  element('levels-back').addEventListener('click', goHome, options);
  element('home-settings').addEventListener('click', () => openSettings(), options);
  element('home-help').addEventListener('click', () => openSettings(element('help-heading')), options);
  element('save-warning').addEventListener('click', () => element('save-status').click(), options);
  element('play-tab').addEventListener('click', goHome, options);
  element('editor-return').addEventListener('click', enterEditor, options);
  element('settings-close').addEventListener('click', closeSettings, options);
  settingsDialog.addEventListener('cancel', event => { event.preventDefault(); closeSettings(); }, options);
  settingsDialog.addEventListener('keydown', event => {
    if (event.code !== 'Tab') return;
    const buttons = [...settingsDialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)')].filter(button => button.getClientRects().length);
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === element('settings-title'))) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first?.focus();
    }
  }, options);
  element('editor-tab').addEventListener('click', () => {
    if (!dev) return;
    closeSettings(); if (mode !== 'edit') enterEditor(); else viewport.focus();
  }, options);
  document.addEventListener('keydown', event => {
    if (event.code !== 'Escape' || event.repeat || settingsDialog.open || newRunDialog.open || saveDialog.open || recoveryDialog.open) return;
    if (screen === 'levels') { event.preventDefault(); goHome(); }
    else if (screen === 'edit') { event.preventDefault(); openSettings(); }
    else if (screen === 'play' && started && !state.won) { event.preventDefault(); togglePause(); }
  }, options);
  element('level-tabs').addEventListener('click', event => {
    const tab = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-set]');
    const set = sets.find(candidate => candidate.id === tab?.dataset.set);
    if (!set || set.id === levelSet) return;
    levelSet = set.id; previewTrial(set.items[0].level.id);
    element(`tab-${set.id}`).focus({ preventScroll: true });
  }, options);
  element('level-tabs').addEventListener('keydown', event => {
    if (event.code !== 'ArrowRight' && event.code !== 'ArrowLeft') return;
    event.preventDefault();
    const index = sets.findIndex(set => set.id === levelSet), step = event.code === 'ArrowRight' ? 1 : -1;
    const set = sets[(index + step + sets.length) % sets.length];
    levelSet = set.id; previewTrial(set.items[0].level.id);
    element(`tab-${set.id}`).focus({ preventScroll: true });
  }, options);
  element('level-grid').addEventListener('click', event => {
    const tile = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-puzzle]');
    if (!tile?.dataset.puzzle) return;
    if (puzzle?.level.id !== tile.dataset.puzzle) previewTrial(tile.dataset.puzzle);
    element(`choose-${tile.dataset.puzzle}`).focus({ preventScroll: true });
  }, options);
  element('level-grid').addEventListener('dblclick', event => {
    if ((event.target as HTMLElement).closest('[data-puzzle]')) play();
  }, options);
  element('level-play').addEventListener('click', play, options);
  element('sounds-open').addEventListener('click', () => loadExplosionPuzzle(SOUND_DEMO.level.id), options);
  element('ice-room-open').addEventListener('click', () => loadExplosionPuzzle(SOUND_ICE_DEMO.level.id), options);
  element('sound-lane-open').addEventListener('click', () => loadExplosionPuzzle(SOUND_DEMO.level.id), options);
  async function chooseIce(variant: IceSoundId, preview = false) {
    if (!canPlay() || audioBusy || !isSoundDemo(puzzle)) return;
    if (preview) setPaused(true);
    const stamp = suspension, room = puzzle, wasPaused = paused || !started || state.won;
    if (!await setSound(true, variant)) { iceControls(); return; }
    iceVariant = variant; iceControls();
    if (pageGone || document.hidden || suspension !== stamp || puzzle !== room || !canPlay()) return;
    if (wasPaused) audio.auditionGlide('soft', variant);
    else {
      const glide = audio.inspect().glide;
      if (glide) audio.updateGlide(glide.surface, variant);
    }
    text('sound-last', preferences.volume === 0 ? 'Volume is zero. Raise it to hear the sound.'
      : `${ICE_PALETTE[variant].label}: ${wasPaused ? '12-second preview.' : 'Selected for your glide.'}`);
  }
  iceSelect.addEventListener('change', () => {
    const id = iceSelect.value;
    if (!isIceSound(id)) { report('Could not select ice sound', new Error('Unknown ice sound.')); iceControls(); return; }
    void chooseIce(id);
  }, options);
  for (const [id, direction] of [['ice-prev', -1], ['ice-next', 1]] as const) {
    element(id).addEventListener('click', () => {
      const index = (ICE_PALETTE_IDS.indexOf(iceVariant) + direction + ICE_PALETTE_IDS.length) % ICE_PALETTE_IDS.length;
      void chooseIce(ICE_PALETTE_IDS[index]);
    }, options);
  }
  element('ice-preview').addEventListener('click', () => { void chooseIce(iceVariant, true); }, options);
  element('ice-stop').addEventListener('click', () => {
    setPaused(true); text('sound-last', 'Stopped. Start the walk or tap a cue to listen again.');
  }, options);
  for (const id of ['audio', 'demo-audio']) element(id).addEventListener('click', () => {
    void setSound(!(audioBusy ? soundTarget ?? soundInFlight : preferences.sound));
  }, options);
  for (const id of ['sound-volume', 'demo-volume']) {
    element(id).addEventListener('input', () => {
      const volume = Number(element<HTMLInputElement>(id).value) / 100;
      audio.setVolume(volume); preferences = { ...preferences, volume }; soundControls();
    }, options);
    element(id).addEventListener('change', savePreferences, options);
  }
  for (const cue of SOUND_IDS) {
    const button = document.createElement('button');
    button.id = `audition-${cue}`; button.textContent = SOUNDS[cue].label;
    button.title = cue === 'soft' || cue === 'hard' ? `${ICE_PALETTE_AUDIO.previewSeconds}-second preview of the selected ice sound.` : SOUNDS[cue].description;
    button.addEventListener('click', async () => {
      if (!canPlay() || audioBusy || !isSoundDemo(puzzle)) return;
      setPaused(true);
      if (!audioReady && !await setSound(true)) return;
      if (pageGone || document.hidden || !isSoundDemo(puzzle)) return;
      audio.stop();
      if (cue === 'soft' || cue === 'hard') audio.auditionGlide(cue, iceVariant);
      else audio.play(cue);
      text('sound-last', preferences.volume === 0 ? 'Volume is zero. Raise it to hear the cue.'
        : cue === 'soft' || cue === 'hard' ? `${SOUNDS[cue].label}: ${ICE_PALETTE_AUDIO.previewSeconds}-second ${ICE_PALETTE[iceVariant].label} preview.`
        : `${SOUNDS[cue].label}: ${SOUNDS[cue].description}`);
    }, options);
    element('sound-auditions').append(button);
  }
  element('boundstoy').addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest('button');
    if (button && !button.id.startsWith('audition-') && !button.id.startsWith('ice-') && !['audio', 'demo-audio'].includes(button.id))
      audio.play('ui');
  }, { ...options, capture: true });
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
    draft = parseLevel(level); saveDraft(); mode = 'play'; testing = true; screen = 'play';
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
  element('new-run-accept').addEventListener('click', () => {
    const begin = pendingNew; pendingNew = null; newRunDialog.close(); begin?.();
  }, options);
  const cancelNewRun = () => {
    pendingNew = null; newRunDialog.close(); overlay(); syncRendering();
    element(screen === 'home' ? 'new-run' : 'primary-action').focus({ preventScroll: true });
  };
  element('new-run-cancel').addEventListener('click', cancelNewRun, options);
  newRunDialog.addEventListener('cancel', event => { event.preventDefault(); cancelNewRun(); }, options);
  element('save-status').addEventListener('click', () => {
    setPaused(true);
    if (continuation?.status.phase !== 'error') text('save-copy', memoryOnly
      ? 'This session is not being saved. Reloading or closing it loses unsaved play.'
      : checkpointPuzzles(level)
        ? 'Reload returns to your checkpoint with the latest saved time, retries and progress, and a fresh puzzle pattern. Totals save on checkpoints, death, pause and leaving, not periodically. Resume here keeps your live position and paused pattern.'
        : 'Saves finish asynchronously. After an abrupt closure, Continue restores the latest completed save, not necessarily your last input.');
    saveDialog.showModal(); syncRendering();
  }, options);
  const closeSaveDialog = () => {
    if (!persistenceReady || storageBusy || continuation?.status.phase === 'error') return;
    saveDialog.close(); overlay(); hud(); syncRendering();
    element(settingsDialog.open ? 'save-status' : screen === 'home' ? 'home-play' : 'primary-action').focus();
  };
  element('save-close').addEventListener('click', closeSaveDialog, options);
  saveDialog.addEventListener('cancel', event => { event.preventDefault(); closeSaveDialog(); }, options);
  element('save-retry').addEventListener('click', async () => {
    if (storageBusy) return;
    if (memoryOnly && !window.confirm('Restore the last committed save? Unsaved play from this session will be discarded.')) return;
    if (!continuation) { await connectStorage(); return; }
    storageBusy = true;
    try {
      const answer = await continuation.retry();
      if (answer.status === 'ok') {
        saveCurrent();
        if (draft && legacyDraft === JSON.stringify(draft)) text('draft-status', 'Draft saved.');
        saveDialog.close();
      }
    } finally { storageBusy = false; overlay(); syncRendering(); }
  }, options);
  element('save-memory').addEventListener('click', async () => {
    if (storageBusy) return;
    storageBusy = true; freezeForStorage();
    try {
      await continuation?.close(); continuation = null;
      memoryOnly = true; persistenceReady = true; progressSaved = false;
      text('save-retry', 'Restore saved game');
      text('save-status', 'Not saving'); saveDialog.close();
    } finally { storageBusy = false; overlay(); syncRendering(); }
  }, options);
  async function releaseForRecovery() {
    freezeForStorage(); saveCurrent();
    persistenceReady = false;
    await continuation?.close(); continuation = null;
  }
  element('save-export').addEventListener('click', async () => {
    if (storageBusy || storage.status !== 'ok') return;
    storageBusy = true;
    try {
      await releaseForRecovery();
      const answer = await storage.value.exportRecovery();
      if (answer.status !== 'ok') { storageFailure(answer.reason); return; }
      const url = URL.createObjectURL(new Blob([JSON.stringify(answer.value, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url; link.download = 'boundstoy-recovery.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      text('save-copy', 'Recovery data exported. Retry to reacquire saving, or choose play without saving.');
    } finally { storageBusy = false; }
  }, options);
  element('save-reset').addEventListener('click', async () => {
    if (storageBusy || storage.status !== 'ok' || !window.confirm(
      'Reset the saved world and current run? A recovery copy will preserve the stored world and records. Legacy records and the editor draft stay unchanged.')) return;
    storageBusy = true;
    try {
      await releaseForRecovery();
      const answer = await storage.value.resetRecovery();
      if (answer.status !== 'ok') { storageFailure(answer.reason); return; }
      activeRun = null; currentRunId = null; started = false; testing = false; puzzle = null; mode = 'play';
    } finally { storageBusy = false; }
    await connectStorage();
  }, options);
  scene.renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault(); graphics.lose();
  }, options);
  function restoreGraphics() {
    // Native Three cache restoration may happen in the background; defer our
    // GPU rebake/draw until visible, without opening any play entry meanwhile.
    if (document.hidden) return;
    try {
      graphics.restore(() => {
        scene.restoreGraphics();
        scene.draw(sceneState(), visualTime, mode === 'edit');
        scene.verifyGraphics();
      });
      if (!graphics.available) return;
      clearInput(); accumulator = 0; paused = true;
      recoveryDialog.close();
      if (activeRun && !currentRunId && mode === 'play' && !testing) restoreRun(activeRun);
      if (!persistenceReady || continuation?.status.phase === 'error') {
        if (!saveDialog.open) saveDialog.showModal();
      }
      overlay(); hud(); syncRendering();
      (settingsDialog.open ? element('settings-close') : screen === 'home' ? element('home-play') : element('primary-action')).focus({ preventScroll: true });
    } catch (error) {
      console.warn('[Boundstoy] Graphics recovery failed', error);
      showGraphicsFailure('Graphics could not be restored. The game remains frozen. Reload the page to try again; unsaved play may be lost.');
    }
  }
  scene.renderer.domElement.addEventListener('webglcontextrestored', restoreGraphics, options);

  const debug = {
    snapshot: () => structuredClone({ state, level, mode, paused, started, testing, input: movement() }),
    inspect: () => {
      const index = level.version === 2 ? worldSectionIndex(level, state.visited) : null;
      const section = level.version === 2 && index !== null ? level.sections[index] : null;
      return structuredClone({
        identity: { version: level.version, id: level.id, ...(level.version === 2 ? { revision: level.revision } : {}) },
        tick: state.tick, hazardTick: hazardTick(state), patternOffset: state.patternOffset,
        deaths: state.deaths, respawnTicks: state.respawnTicks, checkpoints: state.visited,
        section: section ? { index, id: section.id, name: section.name } : null,
        editorSection: mode === 'edit' && level.version === 2
          ? { index: editorSection, id: level.sections[editorSection].id } : null,
      });
    },
    graphics: () => ({ status: graphics.status, visualTime, accumulator }),
    sound: () => audio.inspect(),
    persistence: () => ({
      ready: persistenceReady && !storageBusy,
      phase: memoryOnly ? 'memory' : continuation?.status.phase ?? 'unavailable',
      runId: currentRunId,
    }),
    ascii: () => ascii(level, state),
    load: (index: number) => {
      if (!graphics.available) return;
      if (abort.signal.aborted) throw new Error('The game has been disposed.');
      screen = 'play'; loadCourse(index, 'paused'); visualTime = 0; loop.drawNow();
    },
    advance: (ticks: number, input: Point = STILL) => {
      if (!canPlay() || graphics.awaitingResume) return structuredClone(state);
      if (abort.signal.aborted) throw new Error('The game has been disposed.');
      if (!Number.isInteger(ticks) || ticks < 0 || ticks > 100_000) throw new Error('advance accepts 0-100000 ticks.');
      if (mode !== 'play') throw new Error('Use Play or Playtest before advancing the simulation.');
      if (screen !== 'play') showScreen('play');
      paused = true; started = true; accumulator = 0; clearInput();
      for (let i = 0; i < ticks && !state.won; i++) tick(input);
      if (isSoundDemo(puzzle)) audio.stop();
      visualTime = state.tick * DT; manualClock = true; hud(); overlay(); syncRendering(); loop.drawNow();
      return structuredClone(state);
    },
    /** Advance only the visual clock (victory/menu-free animation) for deterministic captures. */
    animate: (seconds: number) => {
      if (!graphics.available || graphics.awaitingResume) return;
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > 10) throw new Error('animate accepts 0-10 seconds.');
      manualClock = true; visualTime += seconds; loop.drawNow();
    },
    project: (point: Point) => scene.project(point),
    pick: (x: number, y: number) => scene.pick(x, y),
    camera: () => structuredClone(scene.inspectView()),
    export: () => JSON.stringify(level),
    metrics: () => ({ frames: scene.renderer.info.render.frame, drawCalls: scene.renderer.info.render.calls, triangles: scene.renderer.info.render.triangles, geometries: scene.renderer.info.memory.geometries, textures: scene.renderer.info.memory.textures }),
  };
  function frame(elapsed: number) {
    if (!graphics.available) return;
    if (!canPlay()) { hud(); scene.draw(sceneState(), visualTime, mode === 'edit'); return; }
    if (graphics.awaitingResume) { hud(); scene.draw(sceneState(), visualTime, mode === 'edit'); return; }
    if (!settingsDialog.open && !paused && mode === 'play' && screen === 'play' && !state.won) {
      visualTime += elapsed;
      const pending = fixedSteps(accumulator, elapsed);
      accumulator = pending.remainder;
      const input = movement();
      for (let i = 0; i < pending.count && !state.won; i++) tick(input);
    } else if (!manualClock && !settingsDialog.open && (!started || mode === 'edit' || state.won)) visualTime += elapsed;
    const live = !settingsDialog.open && !paused && mode === 'play' && !state.won;
    hud(); scene.draw(sceneState(), visualTime, mode === 'edit', live ? accumulator / DT : 1);
  }
  load(LEVELS[selectedCourse]); element('home-play').focus({ preventScroll: true });
  window.addEventListener('pagehide', event => {
    clearInput(); setPaused(true); saveCurrent(); loop.setVisible(false);
    pageGone = true; persistenceReady = false;
    closingStorage = continuation?.close() ?? Promise.resolve();
    if (event.persisted) return;
    loop.dispose(); abort.abort(); clearTimeout(noticeTimer); scene.dispose(); audio.dispose(); delete window.__BOUNDSTOY__;
  }, options);
  window.addEventListener('pageshow', async event => {
    if (event.persisted) {
      await closingStorage;
      pageGone = false; continuation = null;
      if (memoryOnly) persistenceReady = true;
      else await connectStorage();
    }
    loop.setVisible(!document.hidden);
  }, options);
  void connectStorage();
  return debug;
}

declare global {
  interface Window { __BOUNDSTOY__?: ReturnType<typeof boot>; }
}
try {
  boot(new Scene(element('viewport')));
} catch (error) {
  console.warn('[Boundstoy] Game startup failed', error);
  for (const control of element('boundstoy').querySelectorAll<HTMLButtonElement>('button, input, textarea')) control.disabled = true;
  element<HTMLButtonElement>('graphics-reload').disabled = false;
  text('graphics-title', 'The game could not start.');
  showGraphicsFailure('Graphics could not start. This game requires WebGL2. Enable hardware acceleration or try a supported browser, then reload this page.');
}
