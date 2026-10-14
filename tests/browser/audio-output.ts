import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../../scripts/browser-check.ts';
import { SOUNDS, SOUND_MIX } from '../../data/sounds.ts';
import { ICE_PALETTE, ICE_PALETTE_AUDIO } from '../../data/ice-palette.ts';
import { AUDIO_OUTPUT } from '../../public/audio/output.js';
import { waitFor } from './runtime.ts';
import type { BrowserContext } from './scenarios.ts';

export async function checkAudioOutput({ page, origin, signal, log }: BrowserContext) {
  const until = (expression: string) => waitFor(expression, () => page.evaluate<boolean>(expression), 10000, signal);
  const gesture = async (expression: string) => {
    const result = await page.call('Runtime.evaluate', { expression, userGesture: true });
    assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
  };
  const instrument = `(() => {
    window.__links = []; window.__ceilings = [];
    const connect = AudioNode.prototype.connect, shaper = AudioContext.prototype.createWaveShaper;
    AudioNode.prototype.connect = function(to, ...args) {window.__links.push({from: this, to}); return connect.call(this, to, ...args);};
    AudioContext.prototype.createWaveShaper = function() {const node = shaper.call(this); window.__ceilings.push(node); return node;};
    window.__outputState = () => {
      const node = window.__ceilings.at(-1);
      const input = window.__links.find(link => link.to === node)?.from;
      const volume = window.__links.find(link => link.from === node)?.to;
      return {count: window.__ceilings.length, boost: input?.gain.value, ceiling: node?.curve.at(-1),
        volume: volume?.gain.value, output: window.__links.some(link => link.from === volume && link.to === node.context.destination)};
    };
  })()`;
  await page.evaluate(instrument);
  await page.call('Page.addScriptToEvaluateOnNewDocument', { source: instrument });
  await gesture("document.getElementById('home-settings').click(); document.getElementById('audio').click()");
  await until('__BOUNDSTOY__.sound().enabled');
  const checkGraph = async () => {
    const graph = await page.evaluate<{ count: number; boost: number; ceiling: number; volume: number; output: boolean }>('__outputState()');
    assert.equal(graph.count, 1);
    assert.ok(Math.abs(graph.boost - 10 ** (AUDIO_OUTPUT.boostDb / 20)) < .00001);
    assert.ok(Math.abs(graph.ceiling - AUDIO_OUTPUT.ceiling) < .00001);
    assert.equal(graph.output, true, 'Volume must control the protected output, not peak-ceiling drive');
  };
  await checkGraph();
  await gesture("document.getElementById('sound-volume').value='100'; document.getElementById('sound-volume').dispatchEvent(new Event('input'))");
  await until('__outputState().volume > .99');
  await gesture("document.getElementById('sound-volume').value='0'; document.getElementById('sound-volume').dispatchEvent(new Event('input'))");
  await until('__outputState().volume < .001 && __BOUNDSTOY__.sound().voices === 0');
  log('PASS actual game output uses shared +12 dB calibration, peak control and post-ceiling volume.');

  await page.evaluate(`void (async () => {
    const {createAudioOutput} = await import(${JSON.stringify(`${origin}/audio/output.js`)});
    const physical = ${JSON.stringify(SOUNDS)}, mix = ${JSON.stringify(SOUND_MIX)};
    const ice = ${JSON.stringify(ICE_PALETTE)}, iceMix = ${JSON.stringify(ICE_PALETTE_AUDIO)};
    const explosions = await (await fetch('/audio/explosion-candidates/manifest.json')).json();
    const archived = await (await fetch('/audio/ice-candidates/manifest.json')).json();
    const cases = [
      ...Object.entries(physical).map(([id, cue]) => ({id: 'game/'+id, events: [{file: '/audio/'+cue.sample+'.wav', gain: cue.gain*mix.masterGain}]})),
      ...Object.entries(ice).map(([id, cue]) => ({id: 'ice/'+id, events: [{file: '/audio/'+cue.sample+'.wav', gain: iceMix.gain*mix.masterGain, filter: iceMix.softCutoff, q: iceMix.filterQ}]})),
      ...explosions.candidates.flatMap(cue => ['warning','blast'].map(part => ({id: 'explosion/'+cue.id+'/'+part, events: [{file: '/audio/explosion-candidates/'+cue[part].file, gain: 1}]}))),
      ...archived.candidates.map(cue => ({id: 'archive/'+cue.id, events: [{file: '/audio/ice-candidates/'+cue.file, gain: 1}]})),
    ];
    const blast = {file: '/audio/'+physical.blast.sample+'.wav', gain: physical.blast.gain*mix.masterGain, at: .5};
    const dense = [
      {id: 'dense/eight-blasts', events: Array.from({length: 8}, () => blast)},
      ...Object.entries(ice).map(([id, cue]) => ({id: 'dense/'+id, events: [
        {file: '/audio/'+cue.sample+'.wav', gain: iceMix.gain*mix.masterGain, filter: iceMix.softCutoff, q: iceMix.filterQ},
        {file: '/audio/'+ice.veil.sample+'.wav', gain: iceMix.gain*mix.masterGain, filter: iceMix.hardCutoff, q: iceMix.filterQ},
        ...Array.from({length: 6}, () => blast)]})),
    ];
    const files = [...new Set([...cases,...dense].flatMap(item => item.events.map(event => event.file)))];
    const raw = new Map(await Promise.all(files.map(async file => [file, await (await fetch(file)).arrayBuffer()])));
    const metrics = [];
    for (const rate of [44100,48000]) {
      const decode = new OfflineAudioContext(2,1,rate);
      const buffers = new Map(await Promise.all(files.map(async file => [file, await decode.decodeAudioData(raw.get(file).slice(0))])));
      const render = async (item, boosted, volume = 1) => {
        const context = new OfflineAudioContext(2, Math.ceil(rate*2.7), rate);
        const output = boosted ? createAudioOutput(context) : null;
        if (output) output.volume.gain.value = volume;
        for (const event of item.events) {
          const source = context.createBufferSource(), gain = context.createGain();
          source.buffer = buffers.get(event.file); gain.gain.value = event.gain;
          if (event.filter) {
            const filter = context.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=event.filter; filter.Q.value=event.q;
            source.connect(filter).connect(gain);
          } else source.connect(gain);
          gain.connect(output?.input ?? context.destination);
          source.start(event.at ?? 0); source.stop((event.at ?? 0) + Math.min(source.buffer.duration,2));
        }
        const buffer = await context.startRendering();
        let peak=0, energy=0;
        for(let channel=0;channel<2;channel++) for(const value of buffer.getChannelData(channel)) {peak=Math.max(peak,Math.abs(value));energy+=value*value;}
        let reconstructedPeak=peak;
        if(boosted) {
          const reconstruction=new OfflineAudioContext(2,buffer.length*4,rate*4), source=reconstruction.createBufferSource();
          source.buffer=buffer; source.connect(reconstruction.destination); source.start();
          const upsampled=await reconstruction.startRendering();
          for(let channel=0;channel<2;channel++) for(const value of upsampled.getChannelData(channel)) reconstructedPeak=Math.max(reconstructedPeak,Math.abs(value));
        }
        output?.dispose();
        return {peak,reconstructedPeak,rms:Math.sqrt(energy/(buffer.length*2))};
      };
      for (const item of [...cases,...dense]) {
        const before=await render(item,false), after=await render(item,true);
        metrics.push({id:item.id,rate,peak:after.peak,reconstructedPeak:after.reconstructedPeak,gainDb:20*Math.log10(after.rms/before.rms)});
      }
      const full=await render(dense[0],true), quiet=await render(dense[0],true,.25), muted=await render(dense[0],true,0);
      if(Math.abs(quiet.rms/full.rms-.25)>.001 || muted.peak!==0) throw new Error('Post-ceiling volume or mute is not linear');
    }
    return metrics;
  })().then(result => {window.__outputMeasurements=result;}, error => {window.__outputMeasurementError=String(error.stack ?? error);}); true`);
  await waitFor('Offline output and reconstruction measurements',
    () => page.evaluate<boolean>('Boolean(window.__outputMeasurements || window.__outputMeasurementError)'), 60000, signal);
  assert.equal(await page.evaluate('window.__outputMeasurementError ?? null'), null);
  const metrics = await page.evaluate<Array<{ id: string; rate: number; gainDb: number; peak: number; reconstructedPeak: number }>>('window.__outputMeasurements');
  await mkdir(resolve('artifacts/audio-output'), { recursive: true });
  const output = await mkdtemp(resolve('artifacts/audio-output/run-'));
  await writeFile(resolve(output, 'measurements.json'), JSON.stringify(metrics, null, 2));
  log(`Output-level evidence: ${output}`);
  for (const metric of metrics) {
    assert.ok(metric.peak > 0 && metric.peak < .9, `${metric.id}/${metric.rate}: clipping/headroom ${metric.peak}`);
    assert.ok(metric.reconstructedPeak < .98, `${metric.id}/${metric.rate}: reconstructed output clips ${metric.reconstructedPeak}`);
    if (!metric.id.startsWith('dense/')) assert.ok(metric.gainDb > 11.8 && metric.gainDb < 12.2,
      `${metric.id}/${metric.rate}: insufficient audible increase ${metric.gainDb} dB`);
  }
  log(`PASS all individual sounds gain 12 dB (+/-0.2) at maximum; ${metrics.length} 44.1/48 kHz output measurements, max peak ${Math.max(...metrics.map(item => item.peak))}; dense-mix volume linear and mute silent.`);

  for (const [path, button] of [['explosion-candidates', 'soft-magic-pattern'], ['ice-candidates', 'weightless-context']]) {
    await page.call('Page.navigate', { url: `${origin}/audio/${path}/index.html` });
    await until(`Boolean(document.getElementById(${JSON.stringify(button)}))`);
    await gesture(`document.getElementById(${JSON.stringify(button)}).click()`);
    await until('window.__ceilings.length === 1 && document.querySelector("[data-playing]") !== null');
    await checkGraph();
    await gesture("document.getElementById('volume').value='100'; document.getElementById('volume').dispatchEvent(new Event('input'))");
    await until('__outputState().volume > .99');
    await gesture("document.getElementById('stop').click()");
  }
  log('PASS both standalone listening rooms use the same calibrated output as gameplay.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2), checkAudioOutput);
