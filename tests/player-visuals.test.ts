import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPlayerModel, playerDetailsVisible } from '../presentation/player-visuals.ts';
import { Scene } from '../presentation/scene.ts';

const luma = (color: THREE.Color) => 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;

test('Player_FootprintRingAndHeading_ReadAsABoldSilhouette', () => {
  const model = createPlayerModel();
  assert.ok(model.ring.geometry instanceof THREE.TorusGeometry);
  assert.equal(model.ring.geometry.parameters.radius, 0.32, 'same footprint read as before');
  assert.ok(model.ring.geometry.parameters.tube >= 0.03, 'ring stays visible at world scale');
  assert.equal(model.ring.material.toneMapped, false);
  assert.ok(luma(model.ring.material.color) >= luma(new THREE.Color(0x79ffe4)), 'at least as bright as before');
  const arrow: THREE.Mesh[] = [];
  model.headingArrow.traverse(object => { if (object instanceof THREE.Mesh) arrow.push(object); });
  assert.ok(arrow.length >= 2);
  for (const part of arrow) {
    const material = part.material as THREE.MeshBasicMaterial;
    assert.ok(material.opacity >= 0.9 && material.toneMapped === false, 'heading reads against any floor');
  }
  assert.ok(model.headingArrow.scale.x >= 1.2, 'heading cue is larger than before');
});

test('Player_FineDetails_HideBelowTheirReadablePixelSize', () => {
  const model = createPlayerModel();
  const details: THREE.Object3D[] = [];
  model.details.traverse(object => { if (object instanceof THREE.Mesh) details.push(object); });
  assert.equal(details.length, 3, 'visor and two eyes');
  assert.ok(details.every(mesh => mesh.parent === model.details));
  assert.ok(model.rig.children.includes(model.antenna) && model.rig.children.includes(model.details));
  assert.equal(playerDetailsVisible(38), false, 'desktop world scale: a clean silhouette, no sub-pixel eyes');
  assert.equal(playerDetailsVisible(85), true, 'close legacy view keeps the face');
  assert.match(Scene.prototype.draw.toString(), /playerDetailsVisible\(/, 'applied every frame from the camera scale');
});
