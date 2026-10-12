import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../../scripts/browser-check.ts';
import { EIGHT_SECTION_ROUTES } from '../../data/aftershock-world-replays.ts';
import { worldDriver, sliceRoute } from './rough-world.ts';
import type { BrowserContext } from './scenarios.ts';

const baseline = process.argv.includes('--baseline');
export async function checkWalls(context: BrowserContext) {
  const { page, log } = context, d = worldDriver(context);
  await mkdir(resolve('artifacts/walls'), { recursive: true });
  const out = await mkdtemp(resolve(`artifacts/walls/${baseline ? 'before' : 'after'}-`));
  const evidence: object[] = [];
  for (const [width, height] of [[1280, 900], [390, 844], [844, 390]]) {
    await page.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await d.reload(); await d.newRun();
    let cursor = 0;
    for (const [tick, label] of [[0, 'opening'], [591, 'shelters'], [3356, 'arc-corners'], [4857, 'finale']] as const) {
      for (const command of sliceRoute(EIGHT_SECTION_ROUTES.ordinary, cursor, tick)) {
        await d.run([command]);
        await d.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      }
      const state = (await d.snapshot()).state; cursor = tick;
      assert.equal(state.deaths, 0); assert.equal(state.tick, tick);
      await d.evaluate("__BOUNDSTOY__.animate(0.71); document.getElementById('overlay').style.visibility='hidden'");
      const pixels = await d.evaluate<{ walls: number; floor: number; wallCount: number; floorCount: number }>(`(() => {
        const d=__BOUNDSTOY__; d.animate(0);
        const {level}=d.snapshot(), source=document.querySelector('#viewport canvas');
        const rect=source.getBoundingClientRect(), canvas=document.createElement('canvas');
        canvas.width=source.width; canvas.height=source.height;
        const c=canvas.getContext('2d'); c.drawImage(source,0,0);
        const data=c.getImageData(0,0,canvas.width,canvas.height).data, ratio=canvas.width/rect.width;
        const a=d.project({x:0,y:0}), b=d.project({x:1,y:0}), pixelsPerTile=b.x-a.x;
        const samples={walls:[],floor:[]};
        const linear=v=>{const s=v/255;return s<=0.04045?s/12.92:((s+0.055)/1.055)**2.4;};
        level.tiles.forEach((row,y)=>[...row].forEach((tile,x)=>{
          if(tile!=='#' && !'.~=:'.includes(tile))return;
          if(tile==='#' && [[-1,0],[1,0],[0,-1],[0,1]].some(([dx,dy])=>level.tiles[y+dy]?.[x+dx]!=='#'))return;
          if([level.spawn,level.goal,...level.checkpoints].some(p=>Math.hypot(p.x-x,p.y-y)<1.5))return;
          const p=d.project({x,y}); if(tile==='#')p.y-=pixelsPerTile*0.24*17/Math.hypot(25,17);
          if(p.x<rect.left+12 || p.x>rect.right-12 || p.y<rect.top+75 || p.y>rect.bottom-12)return;
          for(const dx of [-0.2,0,0.2])for(const dy of [-0.15,0,0.15]){
            const xx=Math.round((p.x-rect.left+dx*pixelsPerTile)*ratio), yy=Math.round((p.y-rect.top+dy*pixelsPerTile)*ratio);
            const i=(yy*canvas.width+xx)*4;
            samples[tile==='#'?'walls':'floor'].push(0.2126*linear(data[i])+0.7152*linear(data[i+1])+0.0722*linear(data[i+2]));
          }
        }));
        const mean=v=>v.reduce((a,b)=>a+b,0)/v.length;
        return {walls:mean(samples.walls),floor:mean(samples.floor),wallCount:samples.walls.length,floorCount:samples.floor.length};
      })()`);
      assert.ok(pixels.wallCount >= 45 && pixels.floorCount >= 18, `${label}: actual wall and playable-floor pixel samples`);
      if (!baseline) assert.ok(pixels.walls < pixels.floor * 0.45,
        `${width}x${height}/${label}: wall-cap luminance ${pixels.walls} must recede below floor ${pixels.floor}`);
      const image = await page.call<{ data: string }>('Page.captureScreenshot', { format: 'png' });
      const path = resolve(out, `${width}x${height}-${label}.png`);
      await writeFile(path, Buffer.from(image.data, 'base64'));
      evidence.push({ path, tick, pixels, camera: await d.evaluate('__BOUNDSTOY__.camera()') });
      log(`${baseline ? 'BASELINE' : 'PASS'} ${width}x${height}/${label}: ${JSON.stringify(pixels)}`);
    }
    await d.evaluate("document.getElementById('overlay').style.visibility=''");
  }
  await writeFile(resolve(out, 'evidence.json'), JSON.stringify(evidence, null, 2));
  log(`Wall hierarchy captures: ${out}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main(process.argv.slice(2).filter(arg => arg !== '--baseline'), checkWalls);
