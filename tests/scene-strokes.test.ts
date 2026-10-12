import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Scene } from '../presentation/scene.ts';
import { parseLevel } from '../core/level.ts';

function build(tiles: string[], hazards: object[] = []) {
  const proto = Scene.prototype as unknown as Record<string, unknown>;
  const view: Record<string, unknown> = {
    board: new THREE.Group(), decorations: new THREE.Group(),
    boardGeometries: new Set<THREE.BufferGeometry>(), boardMaterials: new Set<THREE.Material>(),
    boardTextures: new Set<THREE.Texture>(), pulses: new Map(), lines: new Map(), levelBuilds: 0,
    marker() { return new THREE.Group(); }, halo() { return new THREE.Group(); },
    track: proto.track, mesh: proto.mesh, line: proto.line, tileDetails: proto.tileDetails, addSpikes() {},
    resize() {}, motion: { reset() {} },
  };
  const level = parseLevel({ version: 1, id: 'strokes', name: 'Strokes', description: 'Stroke fixture.',
    tiles, spawn: { x: 1, y: 1 }, goal: { x: tiles[0].length - 2, y: 1 }, checkpoints: [], hazards });
  Reflect.apply(Scene.prototype.setLevel, view, [level]);
  const dispose = () => {
    (view.boardGeometries as Set<THREE.BufferGeometry>).forEach(g => g.dispose());
    (view.boardMaterials as Set<THREE.Material>).forEach(m => m.dispose());
  };
  return { view, board: view.board as THREE.Group, dispose };
}

test('Scene_GameplayStrokes_UseWorldUnitMeshesNotOnePixelLines', () => {
  const { board, dispose } = build(['#########', '#.~~==..#', '#.~~== .#', '#.......#', '#.......#', '#########'],
    [{ kind: 'saw', from: { x: 1, y: 3 }, to: { x: 6, y: 3 }, period: 240, phase: 0 }]);
  try {
    const lines: THREE.Object3D[] = [];
    board.traverse(object => { if (object instanceof THREE.LineSegments || object instanceof THREE.Line) lines.push(object); });
    assert.deepEqual(lines.map(line => line.name), ['editor-grid'], 'only the editor grid may use GL lines');
    const strokes = board.children.filter(object => object.name === 'strokes');
    assert.ok(strokes.length >= 3, 'soft-ice waves, hard-ice streaks and void edges are stroke meshes');
    for (const stroke of strokes) assert.ok(stroke instanceof THREE.Mesh && stroke.material instanceof THREE.MeshBasicMaterial);
    assert.equal(board.children.filter(object => object.name === 'saw-path').length, 1, 'saw patrol uses the groove');
  } finally { dispose(); }
});

test('Scene_EditorGrid_IsShownOnlyWhileEditing', () => {
  const { view, board, dispose } = build(Array(6).fill('........'));
  try {
    const grid = board.getObjectByName('editor-grid');
    assert.ok(grid);
    const sync = Reflect.get(Scene.prototype, 'syncEditorAids') as (editing: boolean) => void;
    Reflect.apply(sync, view, [false]);
    assert.equal(grid.visible, false, 'no workshop grid behind play');
    Reflect.apply(sync, view, [true]);
    assert.equal(grid.visible, true, 'the editor keeps its cell grid');
    assert.match(Scene.prototype.draw.toString(), /this\.syncEditorAids\(editing\)/, 'every frame applies the current mode');
  } finally { dispose(); }
});
