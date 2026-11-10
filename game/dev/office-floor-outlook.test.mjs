import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../vendor/three.module.min.js';
import { createOfficeWindowBinding } from '../src/office-window-binding.js';

function fixture({skin = .4, height = 15, levels = 5, foreign = false} = {}) {
  const owner = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(20 + skin * 2, height, 20 + skin * 2), new THREE.MeshBasicMaterial());
  wall.position.y = height / 2; owner.add(wall);
  const ring = [[-10,-10],[10,-10],[10,10],[-10,10]];
  const data = {proj:{scale:1}, buildingIds:['w28240279'], buildingFootprints:[ring], buildingHoleFootprints:[[]], buildings:[[0,height*10,0,0,0,0,levels]], buildingDimensions:[[height,0]]};
  if (foreign) { data.buildingIds.push('foreign'); data.buildingFootprints.push(ring); data.buildingDimensions.push([height,0]); }
  const world = {data, landmarks:[{id:'rosetti',mesh:owner}], stats:{landmarkSourceReplacements:[{landmark:'rosetti',replaced:['w28240279']}]}, nearestEdge:()=>({d:4})};
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(4,3),new THREE.MeshBasicMaterial()); pane.position.set(0,2,-4);
  const office = {stop:{id:'rosetti'},windowPane:pane,bounds:{minX:-3,maxX:3,minZ:-3,maxZ:3}};
  const unchanged = () => JSON.stringify({position:[...wall.geometry.attributes.position.array], index:[...wall.geometry.index.array], transform:wall.matrixWorld.toArray(), source:data});
  owner.updateWorldMatrix(true,true);
  return {world,office,unchanged};
}

test('owner floor outlook retains source geometry and records an estimated opening', () => {
  const f=fixture(), before=f.unchanged(), b=createOfficeWindowBinding(f.world,f.office);
  assert.equal(b.known,true); assert.equal(b.actualOfficeFloor,2); assert.equal(b.floorModelY,6);
  assert.equal(b.viewKind,'owner-floor-outlook'); assert.equal(b.sourceFacadeCoverage,false);
  assert.equal(b.architecturalApertureVerified,false); assert(b.skinOffsetM>.39 && b.skinOffsetM<.41);
  assert(b.facadeEvidence.originalCoverage.blocked); assert.equal(f.unchanged(),before);
  assert.equal(b.mapPoint(new THREE.Vector3(0,1.65,0)).y,7.65);
});

test('deep projections, absent height conversion and foreign ownership remain unavailable', () => {
  for (const options of [{skin:1.4},{height:3,levels:1},{levels:0},{foreign:true}]) {
    const f=fixture(options),before=f.unchanged(),b=createOfficeWindowBinding(f.world,f.office);
    assert.equal(b.known,false,JSON.stringify(options)); assert.equal(f.unchanged(),before);
  }
});

test('an existing compatible source facade also does not prove a real window', () => {
  const f=fixture({skin:0}), b=createOfficeWindowBinding(f.world,f.office);
  assert.equal(b.known,true); assert.equal(b.sourceFacadeCoverage,true);
  assert.equal(b.architecturalApertureVerified,false);
});
