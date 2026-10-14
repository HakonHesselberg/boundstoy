import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../../scripts/browser-check.ts';
import { waitFor } from './runtime.ts';
import type { BrowserContext } from './scenarios.ts';

type Entry = { id: string; role: string; file: string; seconds: number; repeat: boolean; interval?: number; kind: string; approved?: boolean };
type Start = { time: number; duration: number; loop: boolean };

export async function checkSoundBoard({ page, origin, signal, requests, log }: BrowserContext) {
  const manifest: { entries: Entry[] } = JSON.parse(readFileSync('public/audio/sound-board/manifest.json', 'utf8'));
  const before = await page.evaluate('Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])');
  assert.equal(await page.evaluate("document.getElementById('other-sounds-board').getAttribute('href')"), './audio/sound-board/index.html');
  await page.call('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__starts = []; window.__active = new Set(); window.__contexts = new Set(); window.__gains = []; window.__ceilings = [];
    const create = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function() {
      if (!window.__contexts.has(this)) this.addEventListener('statechange', () => {
        if (this.state === 'closed') for (const source of window.__active) {
          if (source.context === this) window.__active.delete(source);
        }
      });
      window.__contexts.add(this);
      const source = create.call(this), start = source.start;
      source.start = function(time, ...args) {
        window.__starts.push({duration: source.buffer.duration, time, loop: source.loop});
        window.__active.add(source); return start.call(source, time, ...args);
      };
      source.addEventListener('ended', () => window.__active.delete(source));
      return source;
    };
    const gain = AudioContext.prototype.createGain, shaper = AudioContext.prototype.createWaveShaper;
    AudioContext.prototype.createGain = function() {const node = gain.call(this); window.__gains.push(node); return node;};
    AudioContext.prototype.createWaveShaper = function() {const node = shaper.call(this); window.__ceilings.push(node); return node;};
  ` });
  const until = (expression: string, timeout = 10000) => waitFor(expression, () => page.evaluate<boolean>(expression), timeout, signal);
  const click = async (id: string) => {
    const response = await page.call('Runtime.evaluate', {
      expression: `document.getElementById(${JSON.stringify(id)}).click()`, userGesture: true,
    });
    assert.ok(!response.exceptionDetails, JSON.stringify(response.exceptionDetails));
  };
  const stop = async () => { await click('stop'); await until('window.__active.size === 0'); };
  const ready = () => until("Boolean(document.getElementById('ice-warm-reed-once'))");
  const url = `${origin}/audio/sound-board/index.html`;
  await page.call('Page.navigate', { url }); await ready();
  assert.equal(requests.filter(request => request.endsWith('.wav')).length, 0);
  assert.equal(await page.evaluate('window.__contexts.size'), 0);
  assert.equal(await page.evaluate("document.querySelectorAll('#groups button').length"), 9);
  assert.equal(await page.evaluate("document.querySelectorAll('#candidates article:not([hidden])').length"), 3);
  assert.equal(await page.evaluate("document.querySelectorAll('#candidates a[download]').length"), 36);
  let controls = 0;
  for (const entry of manifest.entries) {
    await click(`group-${entry.role}`);
    assert.equal(await page.evaluate(`document.getElementById(${JSON.stringify(entry.id)}).hidden`), false);
    if (entry.approved) assert.match(await page.evaluate<string>(
      `document.getElementById(${JSON.stringify(entry.id)}).querySelector('.badge').textContent`), /Approved - in game/);
    for (const mode of entry.repeat ? ['once', 'repeat', 'context'] : ['once', 'context']) {
      const previous = await page.evaluate<number>('window.__starts.length');
      const count = mode === 'repeat' ? 4 : mode === 'context' ? 2 : 1;
      await click(`${entry.id}-${mode}`); await until(`window.__starts.length === ${previous + count}`);
      const starts = await page.evaluate<Start[]>(`window.__starts.slice(${previous})`);
      assert.equal(starts[0].duration, entry.seconds);
      assert.ok(starts.every(start => !start.loop));
      if (mode === 'repeat') for (const [index, start] of starts.entries()) {
        assert.equal(start.duration, entry.seconds);
        assert.ok(Math.abs(start.time - starts[0].time - index * entry.interval!) < 1e-8);
      }
      if (mode === 'context') {
        assert.equal(starts[1].duration, .2);
        const delay = entry.role === 'warning' ? .225 : entry.kind === 'ice-option' ? 2 : entry.seconds + .2;
        assert.ok(Math.abs(starts[1].time - starts[0].time - delay) < 1e-8);
      }
      assert.ok(await page.evaluate<number>('window.__active.size') <= 4);
      await stop(); controls++;
    }
  }
  assert.equal(controls, 96);
  assert.equal(requests.filter(request => request.endsWith('.wav')).length, 37, '36 choices and one approved puff, cached');
  assert.equal(await page.evaluate('window.__ceilings.length'), 1);
  assert.ok(Math.abs(await page.evaluate<number>('window.__gains[0].gain.value') - 10 ** (12 / 20)) < .00001);
  await click('mono');
  assert.equal(await page.evaluate("window.__gains.find(node => node.channelCountMode === 'explicit').channelCount"), 1);
  await click('group-win'); await click('win-fanfare-repeat'); await until('window.__active.size === 4');
  await click('group-step'); await until('window.__active.size === 0');
  assert.equal(await page.evaluate("document.querySelectorAll('article[data-playing]').length"), 0);
  await click('step-shoe-repeat'); await until('window.__active.size === 4');
  await click('step-patter-repeat');
  await until("window.__active.size === 4 && document.getElementById('step-patter').hasAttribute('data-playing')");
  await until("document.getElementById('status').textContent === 'Preview finished.'");
  await click('group-ice'); await click('ice-weightless-once');
  await until("document.getElementById('status').textContent === 'Preview finished.'", 12000);
  assert.equal(await page.evaluate('window.__active.size'), 0);
  log('PASS all 96 controls, 37 lazy cached assets, approvals, 225 ms warnings, correct context timing, shared output, bounded replacement and finite ice expiry.');

  await click('ice-veil-context'); await until('window.__active.size === 2');
  await page.evaluate("document.getElementById('volume').value='0'; document.getElementById('volume').dispatchEvent(new Event('input'))");
  await until('window.__active.size === 0');
  const zeroStarts = await page.evaluate('window.__starts.length');
  await click('ice-veil-once');
  assert.equal(await page.evaluate('window.__starts.length'), zeroStarts);
  await page.evaluate("document.getElementById('volume').value='65'; document.getElementById('volume').dispatchEvent(new Event('input'))");
  for (const event of ["window.dispatchEvent(new Event('blur'))",
    "Object.defineProperty(document,'hidden',{value:true,configurable:true}); document.dispatchEvent(new Event('visibilitychange')); delete document.hidden;"]) {
    await click('ice-veil-context'); await until('window.__active.size === 2');
    await page.evaluate(event); await until('window.__active.size === 0');
  }
  await click('ice-veil-context'); await until('window.__active.size === 2');
  await page.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}))");
  await until("[...window.__contexts].every(context => context.state === 'closed')");
  await page.evaluate("window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))");
  await click('ice-veil-once'); await until('window.__contexts.size === 2'); await stop();

  await page.call('Page.navigate', { url }); await ready();
  await page.evaluate(`(async () => {
    window.__fetch = window.fetch;
    window.__puffBytes = await (await fetch('../explosion-candidates/airy-puff-blast.wav')).arrayBuffer();
    window.fetch = (url, options) => url === 'step-shoe.wav' ? Promise.resolve(new Response('',{status:503}))
      : url === '../explosion-candidates/airy-puff-blast.wav' ? Promise.resolve(new Response(window.__puffBytes))
      : window.__fetch(url,options);
  })()`);
  await click('step-shoe-context'); await until("document.getElementById('status').textContent.includes('HTTP 503')");
  assert.equal(await page.evaluate('window.__active.size'), 0);
  await page.evaluate('window.fetch = window.__fetch');
  await click('step-shoe-once'); await until('window.__starts.length === 1'); await stop();
  await page.evaluate(`(async () => { window.__bytes = await (await fetch('step-patter.wav')).arrayBuffer();
    window.fetch = async (url, options) => {
      if(url !== 'step-patter.wav') return window.__fetch(url,options);
      window.__signal = options.signal; await new Promise(resolve => {window.__release = resolve;});
      return new Response(window.__bytes);
    }; })()`);
  await click('step-patter-repeat'); await until("typeof window.__release === 'function'");
  await click('group-warning'); assert.equal(await page.evaluate('window.__signal.aborted'), true);
  await page.evaluate('window.__release(); window.fetch = window.__fetch');
  await page.evaluate('new Promise(resolve => setTimeout(resolve,150))');
  assert.equal(await page.evaluate('window.__active.size'), 0);
  assert.match(await page.evaluate<string>("document.getElementById('status').textContent"), /^Ready: Buildup/);
  assert.deepEqual(await page.evaluate('Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])'), before);
  log('PASS group-change cancellation, zero volume, mono, blur/hidden/pagehide, restored playback, explicit failure/retry and unchanged storage.');

  await page.evaluate(`void (async () => {
    const m = await (await fetch('./manifest.json')).json();
    const {createAudioOutput} = await import('../output.js');
    const files = [...new Set([...m.entries,m.approvedExplosion].map(entry => entry.file))];
    const bytes = new Map(await Promise.all(files.map(async file => [file,await (await fetch(file)).arrayBuffer()])));
    const mixes = [];
    for (const rate of [44100,48000]) {
      const decoder = new OfflineAudioContext(2,1,rate), buffers = new Map();
      for (const [file,data] of bytes) buffers.set(file,await decoder.decodeAudioData(data.slice(0)));
      for (const entry of m.entries) for(const mode of entry.repeat ? ['repeat','context'] : ['context']) {
        const events = mode === 'repeat' ? Array.from({length:4},(_,i)=>({...entry,time:i*entry.interval}))
          : [{...entry,time:0},{...m.approvedExplosion,time:entry.role==='warning'?.225:entry.kind==='ice-option'?2:entry.seconds+.2}];
        const seconds = Math.max(...events.map(event=>event.time+event.seconds));
        const context = new OfflineAudioContext(2,Math.ceil(seconds*rate),rate), output=createAudioOutput(context);
        for (const event of events) {
          const source=context.createBufferSource(),gain=context.createGain(); source.buffer=buffers.get(event.file);
          gain.gain.setValueAtTime(0,event.time);
          gain.gain.linearRampToValueAtTime(event.gain,event.time+Math.min(event.attack,event.seconds/4));
          gain.gain.setValueAtTime(event.gain,event.time+event.seconds-Math.min(event.release,event.seconds/3));
          gain.gain.linearRampToValueAtTime(0,event.time+event.seconds);
          source.connect(gain).connect(output.input); source.start(event.time);
        }
        const rendered=await context.startRendering(); let peak=0,energy=0,monoEnergy=0;
        const l=rendered.getChannelData(0),r=rendered.getChannelData(1);
        for(let i=0;i<l.length;i++){peak=Math.max(peak,Math.abs(l[i]),Math.abs(r[i]));energy+=(l[i]**2+r[i]**2)/2;monoEnergy+=((l[i]+r[i])/2)**2;}
        mixes.push({id:entry.id,mode,rate,peak,monoRatio:monoEnergy/energy}); output.dispose();
      }
    }
    window.__mixes=mixes;
  })().catch(error=>{window.__mixError=String(error.stack||error);});`);
  await until('Boolean(window.__mixes || window.__mixError)', 90000);
  assert.equal(await page.evaluate('window.__mixError ?? null'), null);
  const mixes = await page.evaluate<Array<{ peak: number; monoRatio: number }>>('window.__mixes');
  assert.equal(mixes.length, 120);
  assert.ok(mixes.every(mix => mix.peak > .01 && mix.peak <= .851 && mix.monoRatio > .65));
  await mkdir(resolve('artifacts/sound-board'), { recursive: true });
  const output = await mkdtemp(resolve('artifacts/sound-board/run-'));
  await writeFile(resolve(output, 'mixes.json'), JSON.stringify(mixes, null, 2));
  for (const [width,height] of [[1280,900],[390,844],[844,390]]) {
    await page.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await click('group-step');
    assert.equal(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    const point = await page.evaluate<{x:number;y:number}>(`(() => {
      const button=document.getElementById('step-shoe-once');button.scrollIntoView({block:'center'});
      const r=button.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
      if(r.height<44||!button.contains(document.elementFromPoint(x,y)))throw new Error('Obscured or undersized preview');
      return {x,y};
    })()`);
    const startsBefore = await page.evaluate<number>('window.__starts.length');
    await page.call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
    await page.call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
    await until(`window.__starts.length === ${startsBefore + 1}`); await stop();
    await page.evaluate('scrollTo(0,0)');
    const screenshot=await page.call<{data:string}>('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
    await writeFile(resolve(output,`${width}x${height}.png`),Buffer.from(screenshot.data,'base64'));
  }
  await page.evaluate("document.getElementById('group-warning').focus()");
  await page.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,
    text:'\r',unmodifiedText:'\r'});
  await page.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  assert.equal(await page.evaluate("document.getElementById('group-warning').getAttribute('aria-pressed')"), 'true');
  log(`PASS 120 repeated/context mixes at 44.1/48 kHz, max peak ${Math.max(...mixes.map(mix=>mix.peak))}; responsive pointer/keyboard controls. Evidence: ${output}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2), checkSoundBoard);
