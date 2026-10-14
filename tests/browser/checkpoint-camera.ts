import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { main } from '../../scripts/browser-check.ts';
import { EIGHT_SECTION_ROUTES } from '../../data/aftershock-world-replays.ts';
import type { Bounds } from '../../core/world.ts';
import { restartCheckpoint } from '../../core/simulation.ts';
import type { BrowserContext } from './scenarios.ts';
import { worldDriver, roughWorldStops, sliceRoute } from './rough-world.ts';

export async function checkCheckpointCamera(context: BrowserContext) {
  const { page, signal, log } = context, d = worldDriver(context);
  await mkdir(resolve('artifacts/checkpoint-camera'), { recursive: true });
  const out = await mkdtemp(resolve('artifacts/checkpoint-camera/run-'));
  const evidence: object[] = [];
  const probe = () => d.evaluate<{
    frame: Bounds; extent: number; sections: number[]; kind: string; builds: number;
    playerVisible: boolean; requiredVisible: boolean; landingVisible: boolean; roundTrips: boolean; hazardsCorrect: boolean;
  }>(`(() => {
    const debug = __BOUNDSTOY__, camera = debug.camera(), {state,level} = debug.snapshot();
    const rect = document.querySelector('#viewport canvas').getBoundingClientRect();
    const project = p => debug.project({x:p.x-0.5,y:p.y-0.5});
    const inside = p => {const s=project(p); return s.x>=rect.left && s.x<=rect.right && s.y>=rect.top && s.y<=rect.bottom;};
    const corners = b => [{x:b.x,y:b.y},{x:b.x+b.width,y:b.y},{x:b.x,y:b.y+b.height},{x:b.x+b.width,y:b.y+b.height}];
    const index = camera.view.sections[0], section = level.sections[index], b = section.bounds;
    const required = [...corners(section.camera.frame), ...corners(b)];
    for (const hazard of level.hazards) {
      const a=hazard.kind==='pulse'?hazard:hazard.from, z=hazard.kind==='pulse'?hazard:hazard.to;
      const sweep={x:Math.min(a.x,z.x),y:Math.min(a.y,z.y),width:Math.abs(a.x-z.x)+1,height:Math.abs(a.y-z.y)+1};
      if(sweep.x<b.x+b.width+0.2 && sweep.x+sweep.width>b.x-0.2 && sweep.y<b.y+b.height+0.2 && sweep.y+sweep.height>b.y-0.2)
        required.push(...corners(sweep));
    }
    const cp=index?level.checkpoints[index-1]:null, r=cp?cp.radius+0.2:0;
    const landing=cp?corners({x:cp.x+0.5-r,y:cp.y+0.5-r,width:2*r,height:2*r}):[];
    return {frame:camera.view.frame,extent:camera.extent,sections:camera.view.sections,kind:camera.view.kind,
      builds:camera.levelBuilds,
      hazardsCorrect:camera.hazards.every((h,i) => {
        const expected=!state.won && level.hazards[i].sectionId === level.sections[state.visited.length].id;
        return h.enabled===expected && (expected || (!h.warning && !h.burst && h.glow===0
          && (level.hazards[i].kind==='pulse' || !h.visible)));
      }),
      playerVisible:corners({x:camera.player.x-0.2,y:camera.player.y-0.2,width:0.4,height:0.4}).every(inside),
      requiredVisible:required.every(inside),landingVisible:landing.every(inside),
      roundTrips:[section.entry,level.spawn,level.goal].every(p=>{const s=debug.project(p), q=debug.pick(s.x,s.y); return q?.x===p.x && q?.y===p.y;})};
  })()`);
  for (const [width, height] of [[1280, 900], [390, 844], [844, 390]]) for (const reduced of [false, true]) {
    await page.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await page.call('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }],
    });
    await d.reload(); await d.newRun();
    const initial = await probe(), tag = `${width}x${height}-${reduced ? 'reduced' : 'full'}`;
    let cursor = 0, previous = initial;
    // Completion replaces the footer and may resize the canvas. Measure the
    // last playable frame; layout resizing is allowed to refit the camera.
    const stops = roughWorldStops().map(([tick, name]) => tick === 5752 ? [5751, 'final-approach'] as const : [tick, name] as const);
    for (const [tick, name] of stops) {
      const state = await d.run(sliceRoute(EIGHT_SECTION_ROUTES.ordinary, cursor, tick)); cursor = tick;
      assert.equal(state.tick, tick); assert.equal(state.deaths, 0);
      const p = await probe();
      assert.equal(p.extent, initial.extent, `${tag}/${name}: no zoom at any checkpoint, intermediate pan or puzzle`);
      assert.equal(p.builds, initial.builds, 'panning never rebuilds the level');
      assert.equal(p.playerVisible, true, `${tag}/${name}: whole live player stays visible`);
      assert.equal(p.hazardsCorrect, true, `${tag}/${name}: only the active puzzle animates; ${
        p.hazardsCorrect ? '' : JSON.stringify(await d.evaluate(`(() => {
          const {state,level}=__BOUNDSTOY__.snapshot();
          return __BOUNDSTOY__.camera().hazards.map((h,i)=>({...h,kind:level.hazards[i].kind,
            expected:!state.won && level.hazards[i].sectionId===level.sections[state.visited.length].id}))
            .filter(h=>h.enabled!==h.expected || !h.expected && (h.warning || h.burst || h.glow || h.kind==='saw' && h.visible)).slice(0,4);
        })()`))}`);
      assert.equal(p.roundTrips, true, 'global project/pick survives intermediate pans');
      assert.deepEqual(p.sections, [Math.min(state.visited.length, 7)]);
      if (name === 'start' || name.includes('revealed') || reduced && name.startsWith('checkpoint')) {
        assert.equal(p.requiredVisible, true, `${tag}/${name}: complete puzzle and every threatening hazard sweep`);
        assert.equal(p.landingVisible, true, `${tag}/${name}: incoming checkpoint collection disk`);
      }
      if (!reduced && name.endsWith('-pan')) {
        assert.notDeepEqual(p.frame, previous.frame, 'halfway frame visibly pans, not an endpoint jump');
        assert.equal(p.kind, 'reveal');
        const frozen = await d.snapshot();
        await delay(120, undefined, { signal });
        assert.deepEqual(await probe(), p, 'paused mid-pan camera stays frozen');
        assert.deepEqual(await d.snapshot(), frozen, 'camera does not advance simulation');
      }
      await d.evaluate("document.getElementById('overlay').style.visibility = 'hidden'");
      const image = await page.call<{ data: string }>('Page.captureScreenshot', { format: 'png' });
      const path = resolve(out, `${tag}-${name}-t${tick}.png`);
      await writeFile(path, Buffer.from(image.data, 'base64'));
      evidence.push({ path, tick, ...p }); previous = p;
    }
    await d.evaluate("document.getElementById('overlay').style.visibility = ''");
    const beforeReload = (await d.snapshot()).state;
    await d.evaluate("document.getElementById('home-settings').click()");
    await d.saved(); await d.reload();
    // Reload lands on Home; compare the camera in the play layout (advance(0) only switches screens).
    await d.evaluate('__BOUNDSTOY__.advance(0); new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
    const afterReload = await d.snapshot();
    assert.deepEqual(afterReload.state, restartCheckpoint(afterReload.level, beforeReload),
      'reload retains totals but returns to the current checkpoint and resets its pattern');
    const restored = await probe();
    assert.equal(restored.kind, 'fixed', 'restored run snaps immediately to its complete puzzle');
    assert.equal(restored.requiredVisible, true); assert.equal(restored.playerVisible, true);
    assert.equal(restored.landingVisible, true); assert.equal(restored.extent, initial.extent);
    evidence.push({ tag, restored });
    log(`PASS ${tag}: seven whole-puzzle reveals, active-only hazards, fixed scale, frozen pause and checkpoint reload.`);
  }
  await writeFile(resolve(out, 'endstates.json'), JSON.stringify(evidence, null, 2));
  log(`Checkpoint camera evidence: ${out}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main(process.argv.slice(2), checkCheckpointCamera);
