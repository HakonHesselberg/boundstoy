import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../../scripts/browser-check.ts';
import { SOUND_DEMO, SOUND_DEMO_REPLAY, SOUND_DEMO_RECOVERY, SOUND_ICE_DEMO, SOUND_ICE_REPLAY } from '../../data/sound-demo.ts';
import { SOUNDS, SOUND_IDS, SOUND_MIX, SOUND_SAMPLES } from '../../data/sounds.ts';
import { AUDIO_SAMPLES } from '../../presentation/audio.ts';
import { ICE_AUDIO, ICE_SAMPLES } from '../../data/ice-audio.ts';
import { ICE_PALETTE_IDS, ICE_PALETTE_AUDIO } from '../../data/ice-palette.ts';
import { waitFor } from './runtime.ts';
import { createState } from '../../core/simulation.ts';
import { DRAFT_KEY, PROGRESS_KEY } from '../../application/storage.ts';
import { RUN_STORAGE_KEY } from '../../application/run-storage.ts';
import { readStored, settledPersistence } from './persistence.ts';
import { worldDriver } from './rough-world.ts';
import type { BrowserContext } from './scenarios.ts';

export async function checkSoundDemo(context: BrowserContext) {
  const { page, signal, log, requests } = context, d = worldDriver(context);
  const chooseIce = async (id: string) => {
    await d.until('Ice controls ready', "!document.getElementById('ice-sound').disabled");
    const result = await page.call('Runtime.evaluate', {
      expression: `document.getElementById('ice-sound').value=${JSON.stringify(id)};
        document.getElementById('ice-sound').dispatchEvent(new Event('change', { bubbles: true }))`,
      userGesture: true,
    });
    assert.ok(!result.exceptionDetails);
    await d.until(`Selected ${id}`, `!document.getElementById('ice-sound').disabled && __BOUNDSTOY__.sound().glide?.variant === ${JSON.stringify(id)}`);
  };
  await mkdir(resolve('artifacts/sound-demo'), { recursive: true });
  const out = await mkdtemp(resolve('artifacts/sound-demo/run-'));
  await d.newRun();
  await d.run([{ ticks: 80, x: 1, y: 0 }]);
  const worldState = (await d.snapshot()).state;
  await d.click('overlay-settings');
  await d.click('editor-tab');
  await d.click('new-course');
  await settledPersistence(page, signal);
  const draft = (await d.snapshot()).level;
  await d.evaluate("document.getElementById('play-tab').click(); window.dispatchEvent(new Event('blur'))");
  await d.click('home-settings');
  await settledPersistence(page, signal);
  const before = await Promise.all([RUN_STORAGE_KEY, DRAFT_KEY, PROGRESS_KEY].map(key => readStored(page, key, signal)));
  assert.equal(requests.filter(url => url.endsWith('.wav')).length, 0, 'no audio fetch before opting in');
  await d.click('sounds-open');
  assert.deepEqual((await d.snapshot()).level, SOUND_DEMO.level);
  assert.deepEqual((await d.snapshot()).state, createState(SOUND_DEMO.level));
  assert.equal((await d.snapshot()).testing, true);
  assert.equal(await d.evaluate("document.getElementById('boundstoy').dataset.screen"), 'play');
  assert.equal(await d.text('primary-action'), 'Start walk →', 'the listening walk waits for an explicit start');
  await d.evaluate(`window.__soundStarts = [];
    const create = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function() {
      const source = create.call(this), start = source.start;
      source.start = function(...args) {
        window.__soundStarts.push({ rate: source.playbackRate.value, duration: source.buffer.duration,
          channels: source.buffer.numberOfChannels, loop: source.loop });
        return start.apply(source, args);
      };
      return source;
    };
    document.getElementById('sound-demo-controls').open = true;`);
  await d.click('demo-audio');
  await d.until('Audio samples decoded after gesture', '__BOUNDSTOY__.sound().enabled');
  assert.equal(await d.evaluate('__BOUNDSTOY__.sound().loaded'), AUDIO_SAMPLES.length + 1);
  assert.equal(requests.filter(url => /ice-palette\/.*\.wav$/.test(url)).length, 1, 'Only the selected ice loop loads initially');
  assert.equal(await d.text('audio'), 'Sound on');
  assert.equal(requests.filter(url => url.includes('/explosion-candidates/')).length, 1);
  assert.ok(requests.some(url => url.endsWith('/explosion-candidates/airy-puff-blast.wav')));
  assert.ok(!requests.some(url => url.endsWith('/physical-v2/blast/sound.wav')));
  assert.deepEqual(requests.filter(url => /sound-board\/.*\.wav$/.test(url)).map(url => url.split('/').at(-1)).sort(),
    ['death-feather.wav', 'ui-tick.wav'], 'Only approved board assets enter the gameplay bank');
  assert.ok(!requests.some(url => /physical-v2\/(death|ui)\/sound\.wav$/.test(url)));
  for (const cue of SOUND_IDS) {
    const count = await d.evaluate<number>('window.__soundStarts.length');
    await d.click(`audition-${cue}`);
    const voices = SOUNDS[cue].rates.length;
    await d.until(`Source nodes for ${cue}`, `window.__soundStarts.length === ${count + voices}`);
    if (cue === 'blast') {
      assert.deepEqual(await d.evaluate('window.__soundStarts.at(-1)'),
        { rate: 1, duration: .2, channels: 2, loop: false }, 'The actual game player uses the approved puff');
    }
    if (cue === 'death' || cue === 'ui') {
      assert.deepEqual(await d.evaluate('window.__soundStarts.at(-1)'),
        { rate: 1, duration: cue === 'death' ? .34 : .09, channels: 2, loop: false },
        'The actual game player uses the exact approved retry/button source');
    }
    assert.match(await d.text('sound-last'), new RegExp(SOUNDS[cue].label));
    assert.equal((await d.snapshot()).state.tick, 0, 'audition never advances gameplay');
  }
  log('PASS real gesture unlock, all sample decodes and all eleven cue buttons start expected source voices.');
  assert.equal(await d.evaluate("document.querySelectorAll('#ice-sound option').length"), 12);
  assert.equal(await d.evaluate("document.querySelectorAll('#ice-sound optgroup').length"), 4);
  for (const id of ICE_PALETTE_IDS) {
    await chooseIce(id);
    assert.equal(await d.evaluate('__BOUNDSTOY__.sound().loops'), 1);
    assert.equal((await d.snapshot()).state.tick, 0, 'Selecting a sound never advances the course');
    assert.match(await d.evaluate<string>("document.getElementById('ice-source').href"), new RegExp(`${id}\\.strudel\\.js$`));
  }
  assert.equal(await d.evaluate('__BOUNDSTOY__.sound().loaded'), AUDIO_SAMPLES.length + 12);
  assert.equal(requests.filter(url => /ice-palette\/.*\.wav$/.test(url)).length, 12, 'Each selected loop is fetched once');
  await d.evaluate("document.getElementById('ice-next').click(); document.getElementById('ice-stop').click()");
  await d.until('Cancelled selection settled', "!document.getElementById('ice-sound').disabled");
  assert.equal(await d.evaluate('__BOUNDSTOY__.sound().voices'), 0, 'Stop cancels late selection playback');
  log('PASS all twelve grouped choices, lazy/cache loading, source links and cancelled selection.');
  const offline = await d.evaluate<{ peak: number; rms: number; peaks: number[] }>(`(async () => {
    const definitions = ${JSON.stringify(SOUNDS)}, mix = ${JSON.stringify(SOUND_MIX)};
    const context = new OfflineAudioContext(1, 48000 * 15, 48000);
    const buffers = Object.fromEntries(await Promise.all(${JSON.stringify(SOUND_SAMPLES)}.map(async name =>
      [name, await context.decodeAudioData(await (await fetch('audio/'+name+'.wav')).arrayBuffer())])));
    const master = context.createGain(); master.gain.value = mix.masterGain; master.connect(context.destination);
    const cue = (definition, time) => definition.rates.forEach((rate, i) => {
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffers[definition.sample]; source.playbackRate.value = rate;
      const start = time + i * definition.spacing, duration = source.buffer.duration / rate;
      gain.gain.setValueAtTime(0,start);
      gain.gain.linearRampToValueAtTime(definition.gain,start + Math.min(mix.attack,duration/4));
      gain.gain.setValueAtTime(definition.gain,start + duration - Math.min(mix.release,duration/3));
      gain.gain.linearRampToValueAtTime(0,start+duration);
      source.connect(gain).connect(master); source.start(start); source.stop(start+duration);
    });
    Object.values(definitions).forEach((definition,i) => cue(definition,i));
    for(let i=0;i<8;i++) cue(definitions.blast,12);
    const data = (await context.startRendering()).getChannelData(0);
    let peak=0, energy=0;
    const peaks=Array(11).fill(0);
    data.forEach((value,i) => {
      peak=Math.max(peak,Math.abs(value)); energy+=value*value;
      const second=Math.floor(i/48000);
      if(second<11) peaks[second]=Math.max(peaks[second],Math.abs(value));
    });
    return {peak,rms:Math.sqrt(energy/data.length),peaks};
  })()`);
  assert.ok(offline.peak < 0.7 && offline.peak > 0.1, JSON.stringify(offline));
  assert.ok(offline.peaks.every(peak => peak > 0.002), 'all cues produce non-silent rendered audio');
  await writeFile(resolve(out, 'mix-measurements.json'), JSON.stringify(offline, null, 2));
  log(`PASS offline rendered cue/mix peaks: ${JSON.stringify(offline)}`);
  const paletteMix: { rate: number; peaks: number[] }[] = [];
  for (const rate of [44100, 48000]) {
    const peaks = await d.evaluate<number[]>(`(async () => {
      const rate = ${rate}, settings = ${JSON.stringify(ICE_PALETTE_AUDIO)};
      const ids = ${JSON.stringify(ICE_PALETTE_IDS)};
      const decodeContext = new OfflineAudioContext(2, 1, rate);
      const decode = async file => decodeContext.decodeAudioData(await (await fetch(file)).arrayBuffer());
      const buffers = await Promise.all(ids.map(id => decode('audio/ice-palette/' + id + '.wav')));
      const blast = await decode('audio/${SOUNDS.blast.sample}.wav');
      const peaks = [];
      for (let index = 0; index < ids.length; index++) {
        const context = new OfflineAudioContext(2, rate * 10, rate);
        const master = context.createGain(); master.gain.value = ${SOUND_MIX.masterGain}; master.connect(context.destination);
        for (const incoming of [false, true]) {
          const source = context.createBufferSource(), gain = context.createGain(), filter = context.createBiquadFilter();
          source.buffer = buffers[(index + (incoming ? 1 : 0)) % buffers.length]; source.loop = true;
          const start = incoming ? 4 : 0;
          filter.type = 'lowpass'; filter.Q.value = settings.filterQ;
          filter.frequency.value = incoming ? settings.hardCutoff : settings.softCutoff;
          gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(settings.gain, start + settings.attack);
          if (!incoming) {
            gain.gain.setValueAtTime(settings.gain, 4); gain.gain.linearRampToValueAtTime(0, 4 + settings.release);
          }
          source.connect(filter).connect(gain).connect(master); source.start(start); source.stop(incoming ? 10 : 4 + settings.release);
        }
        for (let i = 0; i < 6; i++) {
          const source = context.createBufferSource(), gain = context.createGain(), start = 4.225;
          source.buffer = blast;
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(${SOUNDS.blast.gain}, start + ${SOUND_MIX.attack});
          gain.gain.setValueAtTime(${SOUNDS.blast.gain}, start + blast.duration - ${SOUND_MIX.release});
          gain.gain.linearRampToValueAtTime(0, start + blast.duration);
          source.connect(gain).connect(master); source.start(start);
        }
        const rendered = await context.startRendering(); let peak = 0;
        for (let channel = 0; channel < 2; channel++) for (const value of rendered.getChannelData(channel)) peak = Math.max(peak, Math.abs(value));
        peaks.push(peak);
      }
      return peaks;
    })()`);
    assert.equal(peaks.length, 12);
    assert.ok(peaks.every(peak => peak > .1 && peak < .75), JSON.stringify(peaks));
    paletteMix.push({ rate, peaks });
  }
  await writeFile(resolve(out, 'palette-mix.json'), JSON.stringify(paletteMix, null, 2));
  log(`PASS all twelve crossfades plus six aligned blasts at 44.1/48 kHz: max ${Math.max(...paletteMix.flatMap(result => result.peaks))}`);
  const iceMix = await d.evaluate<Array<{ sampleRate: number; peak: number; windRms: number; padRms: number; cycleDifference: number }>>(`(async () => {
    const settings = ${JSON.stringify(ICE_AUDIO)}, files = ${JSON.stringify(ICE_SAMPLES)};
    const results = [];
    for (const sampleRate of [44100, 48000]) {
      const context = new OfflineAudioContext(3, sampleRate * 12, sampleRate);
      const merger = context.createChannelMerger(3); merger.connect(context.destination);
      const buffers = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([name, path]) =>
        [name, await context.decodeAudioData(await (await fetch('audio/' + path + '.wav')).arrayBuffer())])));
      for (const [name, channel] of [['wind', 0], ['pad', 1]]) {
        const source = context.createBufferSource(), gain = context.createGain();
        source.buffer = buffers[name]; source.loop = true;
        if (name === 'wind') {
          const filter = context.createBiquadFilter();
          filter.type = 'lowpass'; filter.frequency.value = settings.soft.cutoff; filter.Q.value = settings.windQ;
          source.connect(filter).connect(gain);
          gain.gain.setValueAtTime(0, 0);
          gain.gain.linearRampToValueAtTime(settings.soft.windGain * ${SOUND_MIX.masterGain}, settings.attack);
        } else {
          source.connect(gain);
          gain.gain.setValueAtTime(0, 0); gain.gain.setValueAtTime(0, 4);
          gain.gain.linearRampToValueAtTime(settings.soft.padGain * ${SOUND_MIX.masterGain}, 4 + settings.attack);
          gain.gain.setValueAtTime(settings.soft.padGain * ${SOUND_MIX.masterGain}, 8);
          gain.gain.linearRampToValueAtTime(0, 8 + settings.release);
        }
        gain.connect(merger, 0, channel); gain.connect(merger, 0, 2);
        source.start(); source.stop(12);
      }
      const blastBuffer = await context.decodeAudioData(await (await fetch('audio/${SOUNDS.blast.sample}.wav')).arrayBuffer());
      for (let i = 0; i < 6; i++) {
        const source = context.createBufferSource(), gain = context.createGain();
        source.buffer = blastBuffer;
        gain.gain.setValueAtTime(0, 6);
        gain.gain.linearRampToValueAtTime(${SOUNDS.blast.gain * SOUND_MIX.masterGain}, 6 + ${SOUND_MIX.attack});
        gain.gain.setValueAtTime(${SOUNDS.blast.gain * SOUND_MIX.masterGain}, 6 + blastBuffer.duration - ${SOUND_MIX.release});
        gain.gain.linearRampToValueAtTime(0, 6 + blastBuffer.duration);
        source.connect(gain).connect(merger, 0, 2); source.start(6);
      }
      const rendered = await context.startRendering(), wind = rendered.getChannelData(0), pad = rendered.getChannelData(1), mix = rendered.getChannelData(2);
      let peak = 0, windEnergy = 0, padEnergy = 0, cycleDifference = 0;
      for (const value of mix) peak = Math.max(peak, Math.abs(value));
      for (let i = sampleRate * 7; i < sampleRate * 8; i++) {
        windEnergy += wind[i] * wind[i]; padEnergy += pad[i] * pad[i];
        cycleDifference = Math.max(cycleDifference, Math.abs(wind[i] - wind[i - sampleRate * 4]));
      }
      results.push({sampleRate, peak, windRms: Math.sqrt(windEnergy / sampleRate), padRms: Math.sqrt(padEnergy / sampleRate), cycleDifference});
    }
    return results;
  })()`);
  for (const mix of iceMix) {
    assert.ok(mix.peak > 0.1 && mix.peak < 0.7, 'two loops plus six simultaneous blasts retain headroom');
    assert.ok(mix.windRms > 0.002 && mix.padRms > mix.windRms * 0.25 && mix.padRms < mix.windRms * 0.65,
      `restrained but audible pad: ${JSON.stringify(mix)}`);
    assert.ok(mix.cycleDifference < 0.0001, 'wind remains identical across loop seam and A/B change');
  }
  await writeFile(resolve(out, 'ice-mix-measurements.json'), JSON.stringify(iceMix, null, 2));
  log('PASS periodic wind, restrained pad and eight-voice mixed headroom at 44.1/48 kHz: ' + JSON.stringify(iceMix));
  await d.evaluate(`document.getElementById('demo-volume').value=0;
    document.getElementById('demo-volume').dispatchEvent(new Event('input',{bubbles:true}));
    document.getElementById('demo-volume').dispatchEvent(new Event('change',{bubbles:true}));`);
  const count = await d.evaluate<number>('window.__soundStarts.length');
  await d.click('audition-win');
  assert.equal(await d.evaluate('window.__soundStarts.length'), count);
  assert.match(await d.text('sound-last'), /Volume is zero/);
  await d.evaluate(`document.getElementById('demo-volume').value=50;
    document.getElementById('demo-volume').dispatchEvent(new Event('input',{bubbles:true}));
    document.getElementById('demo-volume').dispatchEvent(new Event('change',{bubbles:true}));`);
  await d.click('audition-win');
  await d.evaluate("window.dispatchEvent(new Event('blur'))");
  assert.equal(await d.evaluate('__BOUNDSTOY__.sound().voices'), 0, 'blur cancels all effect tails');
  await d.click('demo-audio');
  await d.until('Muted', '!__BOUNDSTOY__.sound().enabled');
  assert.equal(await d.text('audio'), 'Sound off');
  await d.click('audition-checkpoint');
  await d.until('Explicit audition opts back in', '__BOUNDSTOY__.sound().enabled');
  for (const [width, height] of [[1280, 900], [390, 844], [844, 390]]) {
    await page.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await d.evaluate("document.getElementById('sound-demo-controls').open = false");
    await d.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    assert.equal(await d.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    const image = await page.call<{ data: string }>('Page.captureScreenshot', { format: 'png' });
    await writeFile(resolve(out, `garden-${width}x${height}.png`), Buffer.from(image.data, 'base64'));
    await d.evaluate("document.getElementById('sound-demo-controls').open = true");
    await d.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    assert.equal(await d.evaluate('document.documentElement.scrollWidth <= innerWidth'), true,
      `expanded sound controls overflow at ${width}x${height}`);
    await chooseIce('weightless');
    await d.click('ice-next');
    await d.until('Next sound selected', "__BOUNDSTOY__.sound().glide?.variant === 'warm-organ' && !document.getElementById('ice-next').disabled");
    await d.click('ice-prev');
    await d.until('Previous sound selected', "__BOUNDSTOY__.sound().glide?.variant === 'weightless' && !document.getElementById('ice-prev').disabled");
    await d.click('audition-blast');
    await d.until('Audition enabled before muting', "__BOUNDSTOY__.sound().enabled && !document.getElementById('demo-audio').disabled");
    await d.click('demo-audio');
    await d.until('Muted on resized layout', '!__BOUNDSTOY__.sound().enabled');
  }
  await page.call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await d.click('demo-audio');
  await d.until('Enable live gameplay audio', '__BOUNDSTOY__.sound().enabled');
  await d.evaluate("document.getElementById('sound-demo-controls').open = false");
  await d.click('primary-action');
  const liveStarts = await d.evaluate<number>('window.__soundStarts.length');
  await page.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await d.until('Live demo keyboard movement', '__BOUNDSTOY__.snapshot().state.velocity.x > 0');
  await d.until('Live movement plays material audio', `window.__soundStarts.length > ${liveStarts}`);
  await page.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await d.click('pause');
  assert.equal(await d.evaluate('__BOUNDSTOY__.sound().voices'), 0);
  await d.click('overlay-settings'); await d.click('sounds-open');
  const won = await d.run(SOUND_DEMO_REPLAY);
  assert.equal(won.won, true); assert.equal(won.tick, 769); assert.equal(won.deaths, 0);
  assert.match(await d.text('primary-action'), /Walk again/);
  await d.click('primary-action');
  await d.run([{ ticks: 436, x: 1, y: 0 }]);
  await d.evaluate("document.getElementById('restart').click(); window.dispatchEvent(new Event('blur'))");
  const recovered = await d.run(SOUND_DEMO_RECOVERY);
  assert.equal(recovered.won, true); assert.equal(recovered.deaths, 0);
  await d.evaluate("document.getElementById('sound-demo-controls').open = true");
  await d.click('ice-room-open');
  assert.deepEqual((await d.snapshot()).level, SOUND_ICE_DEMO.level);
  await chooseIce('weightless'); await d.click('audition-soft');
  const previewStarts = await d.evaluate<number>('window.__soundStarts.filter(s => s.loop).length');
  await chooseIce('veil');
  assert.equal(await d.evaluate('window.__soundStarts.filter(s => s.loop).length'), previewStarts + 1);
  assert.deepEqual(await d.evaluate('__BOUNDSTOY__.sound().glide'), { surface: 'soft', variant: 'veil' });
  await waitFor('Twelve-second preview ends without interaction', () => d.evaluate<boolean>('__BOUNDSTOY__.sound().loops === 0'),
    (ICE_PALETTE_AUDIO.previewSeconds + 3) * 1000, signal);
  await d.click('audition-hard');
  assert.deepEqual(await d.evaluate('__BOUNDSTOY__.sound().glide'), { surface: 'hard', variant: 'veil' });
  await d.click('ice-stop');
  assert.equal(await d.evaluate('__BOUNDSTOY__.sound().voices'), 0);
  await d.evaluate("document.getElementById('sound-demo-controls').open = false");
  await d.click('primary-action');
  await page.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await d.until('Real motion enters soft ice', "__BOUNDSTOY__.sound().glide?.surface === 'soft'");
  await page.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await chooseIce('warm-organ');
  await chooseIce('veil');
  await d.until('Crossfade retires the previous sound', '__BOUNDSTOY__.sound().loops === 1');
  const glideStarts = await d.evaluate<number>('window.__soundStarts.filter(s => s.loop).length');
  const effectsBefore = await d.evaluate<number>('window.__soundStarts.filter(s => !s.loop).length');
  await d.until('Released-key glide reaches and reflects off far wall', '__BOUNDSTOY__.snapshot().state.velocity.x < 0');
  assert.equal(await d.evaluate('window.__soundStarts.filter(s => s.loop).length'), glideStarts, 'no four-Hz retrigger across a full loop and wall reflection');
  assert.ok(await d.evaluate<number>('window.__soundStarts.filter(s => !s.loop).length') > effectsBefore, 'nearby hazard/contact cues coexist with the selected loop');
  assert.ok(await d.evaluate<number>('__BOUNDSTOY__.sound().voices') <= SOUND_MIX.maxVoices);
  await d.click('pause');
  assert.equal(await d.evaluate('__BOUNDSTOY__.sound().voices'), 0);
  for (const [width, height] of [[1280, 900], [390, 844], [844, 390]]) {
    await page.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await d.evaluate("document.getElementById('sound-demo-controls').open = true");
    await chooseIce('weightless'); await chooseIce('veil');
    assert.equal(await d.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    const image = await page.call<{ data: string }>('Page.captureScreenshot', { format: 'png' });
    await writeFile(resolve(out, `ice-${width}x${height}.png`), Buffer.from(image.data, 'base64'));
  }
  await page.call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await d.click('sound-lane-open'); await d.click('ice-room-open');
  const iceWon = await d.run(SOUND_ICE_REPLAY);
  assert.equal(iceWon.won, true); assert.equal(iceWon.tick, 820); assert.equal(iceWon.deaths, 0);
  log('PASS twelve-sound selection, live crossfades, finite preview, released-key glide, reflection, nearby effects, responsive ice room and safe exit.');
  await d.evaluate("document.getElementById('home-settings').click()"); await d.click('editor-tab');
  assert.deepEqual((await d.snapshot()).level, draft);
  await d.evaluate("document.getElementById('play-tab').click(); window.dispatchEvent(new Event('blur'))");
  assert.deepEqual((await d.snapshot()).state, worldState);
  await settledPersistence(page, signal);
  const after = await Promise.all([RUN_STORAGE_KEY, DRAFT_KEY, PROGRESS_KEY].map(key => readStored(page, key, signal)));
  assert.deepEqual(after, before, 'demo never writes world saves, records or drafts');
  await d.click('home-settings'); await d.click('sounds-open'); await d.reload();
  assert.equal((await d.snapshot()).level.id, 'aftershock');
  assert.equal((await d.snapshot()).state.tick, worldState.tick);
  assert.equal(await d.evaluate('__BOUNDSTOY__.sound().state'), 'uncreated', 'reload never bypasses gesture unlock');
  log('PASS mobile audition controls, volume zero, mute, blur, live keyboard, exact route, recovery and save isolation.');
  log(`Sound garden evidence: ${out}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main(process.argv.slice(2), checkSoundDemo);
