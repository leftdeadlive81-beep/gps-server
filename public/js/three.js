// Split out of the former monolithic mortar_fdc_game.js.
import { estPos, isTargetDetected, smoothVisualPos, state, unitAlive } from './combat.js';
import { CANVAS_H, CANVAS_W, CONTOUR_LINES_CANVAS, FRIENDLY_MARK_COLOR_3D, GRID_LINES, HELI_FLIGHT_ALTITUDE, MAP_POLAR_MAX, MAP_POLAR_MIN, MAP_VIEW, MAP_ZOOM_MAX, MAP_ZOOM_MIN, PROC_CANOPY_CELL, PROC_CANOPY_DARK, PROC_CANOPY_LIGHT, PROC_CLEARING_CELL, PROC_CLEARING_COLOR, PROC_CLEARING_EDGE0, PROC_CLEARING_EDGE1, PROC_COLOR_HIGH, PROC_COLOR_LOW, PROC_COLOR_WATER, PROC_DRY_PATCH_CELL, PROC_DRY_PATCH_COLOR, PROC_DRY_PATCH_EDGE0, PROC_DRY_PATCH_EDGE1, PROC_MESH_SEGMENTS_X, PROC_MESH_SEGMENTS_Z, PROC_OPEN_MOTTLE_AMOUNT, PROC_OPEN_MOTTLE_CELL, PROC_TERRAIN_HEIGHT_SCALE, PROC_TEXTURE_NOISE_COARSE_AMOUNT, PROC_TEXTURE_NOISE_COARSE_CELL, PROC_TEXTURE_NOISE_FINE_AMOUNT, PROC_TEXTURE_NOISE_FINE_CELL, PROC_TEXTURE_SIZE_X, PROC_TEXTURE_SIZE_Z, SCOUT_SQUAD_SIZE, SHADOW_FRUSTUM_HALF, SKY_COLOR, SNIPER_SQUAD_SIZE, SQUAD_GRID_OFFSETS, SUN_OFFSET, TARGET_TYPE_COLOR, TERRAIN_TEXTURE_BRIGHTNESS, TERRAIN_TYPE_FOREST, TERRAIN_TYPE_WATER, WALK_AMP_EASE, WALK_CYCLE_SPEED, WALK_SWING_MAX, WORLD, unitMarkers3d } from './constants.js';
import { updateMapFocusEase } from './input.js';
import { buildContourLines, buildProceduralRoads, elevationAt, elevationAtFor, nearestPointOnRoad, terrainTypeAtFor } from './terrain.js';
import { clamp, smoothstep01, valueNoise2D } from './utils.js';

export function scaledIconH(baseH){
  return baseH * clamp(Math.sqrt(MAP_VIEW.zoom), 0.6, 2.2);
}

export let threeReady = false;

export let cameraNeedsInitialFit = true;

export let scene3d, camera3d, renderer3d, terrainObject3d, sunLight;

export let lastCameraDist = 0;

export let treeTrunkMesh3d = null, treeFoliageMesh3d = null, rockMesh3d = null;

export let tankModelTemplate3d = null;

export let tankModelLoadStarted = false;

export let heliModelTemplate3d = null;

export let heliModelLoadStarted = false;

export let heliAnimationMixer = null;

export let heliAnimationAction = null;

export function paintTerrainColors(ctx, w, h, gen){
  const img = ctx.createImageData(w, h);
  const roadPaths = gen.roadPaths || [];
  const roadKinds = gen.roadKinds || [];
  const roadDistance = (cx, cy)=>{
    let best = null;
    roadPaths.forEach((road, roadIdx)=>{
      const hit = nearestPointOnRoad(road, cx, cy);
      if(!hit.point) return;
      const kind = roadKinds[roadIdx] || 'main';
      const width = kind==='dirt' ? 7 : kind==='branch' ? 13 : 18;
      if(!best || hit.dist < best.dist) best = {dist:hit.dist, width, kind};
    });
    return best;
  };
  for(let py=0; py<h; py++){
    const cy = (py/h)*CANVAS_H;
    for(let px=0; px<w; px++){
      const cx = (px/w)*CANVAS_W;
      const e = clamp(elevationAtFor(gen, cx, cy), 0, 1);
      const type = terrainTypeAtFor(gen, cx, cy);
      let r,g,b,noiseMult;
      if(type===TERRAIN_TYPE_WATER){ [r,g,b] = PROC_COLOR_WATER; noiseMult = 0.35; }
      else if(type===TERRAIN_TYPE_FOREST){
        const canopyN = valueNoise2D(cx/PROC_CANOPY_CELL, cy/PROC_CANOPY_CELL, gen.seed+7);
        r = PROC_CANOPY_DARK[0] + (PROC_CANOPY_LIGHT[0]-PROC_CANOPY_DARK[0])*canopyN;
        g = PROC_CANOPY_DARK[1] + (PROC_CANOPY_LIGHT[1]-PROC_CANOPY_DARK[1])*canopyN;
        b = PROC_CANOPY_DARK[2] + (PROC_CANOPY_LIGHT[2]-PROC_CANOPY_DARK[2])*canopyN;
        const clearingN = valueNoise2D(cx/PROC_CLEARING_CELL, cy/PROC_CLEARING_CELL, gen.seed+13);
        const clearingT = smoothstep01(clamp((clearingN-PROC_CLEARING_EDGE0)/(PROC_CLEARING_EDGE1-PROC_CLEARING_EDGE0), 0, 1));
        if(clearingT > 0){
          r += (PROC_CLEARING_COLOR[0]-r)*clearingT;
          g += (PROC_CLEARING_COLOR[1]-g)*clearingT;
          b += (PROC_CLEARING_COLOR[2]-b)*clearingT;
        }
        noiseMult = 0.6;
      }
      else {
        r = PROC_COLOR_LOW[0] + (PROC_COLOR_HIGH[0]-PROC_COLOR_LOW[0])*e;
        g = PROC_COLOR_LOW[1] + (PROC_COLOR_HIGH[1]-PROC_COLOR_LOW[1])*e;
        b = PROC_COLOR_LOW[2] + (PROC_COLOR_HIGH[2]-PROC_COLOR_LOW[2])*e;
        const mottleN = (valueNoise2D(cx/PROC_OPEN_MOTTLE_CELL, cy/PROC_OPEN_MOTTLE_CELL, gen.seed+19) - 0.5) * PROC_OPEN_MOTTLE_AMOUNT;
        r += mottleN; g += mottleN*0.85; b += mottleN*0.55;
        const dryN = valueNoise2D(cx/PROC_DRY_PATCH_CELL, cy/PROC_DRY_PATCH_CELL, gen.seed+23);
        const dryT = smoothstep01(clamp((dryN-PROC_DRY_PATCH_EDGE0)/(PROC_DRY_PATCH_EDGE1-PROC_DRY_PATCH_EDGE0), 0, 1));
        if(dryT > 0){
          r += (PROC_DRY_PATCH_COLOR[0]-r)*dryT;
          g += (PROC_DRY_PATCH_COLOR[1]-g)*dryT;
          b += (PROC_DRY_PATCH_COLOR[2]-b)*dryT;
        }
        noiseMult = 1;
      }
      const noise = ((valueNoise2D(cx/PROC_TEXTURE_NOISE_COARSE_CELL, cy/PROC_TEXTURE_NOISE_COARSE_CELL, gen.seed)-0.5)*PROC_TEXTURE_NOISE_COARSE_AMOUNT
                   + (valueNoise2D(cx/PROC_TEXTURE_NOISE_FINE_CELL, cy/PROC_TEXTURE_NOISE_FINE_CELL, gen.seed+1)-0.5)*PROC_TEXTURE_NOISE_FINE_AMOUNT) * noiseMult;
      r = clamp(r+noise, 0, 255); g = clamp(g+noise*0.9, 0, 255); b = clamp(b+noise*0.7, 0, 255);
      const road = roadDistance(cx, cy);
      if(road && road.dist < road.width + 5){
        const edge = clamp((road.dist-road.width)/5, 0, 1);
        const roadColor = road.kind==='dirt' ? [0x8b,0x6a,0x43] : road.kind==='branch' ? [0x6f,0x6d,0x5d] : [0x7e,0x7d,0x70];
        const roadBlend = 1-edge;
        r += (roadColor[0]-r)*roadBlend;
        g += (roadColor[1]-g)*roadBlend;
        b += (roadColor[2]-b)*roadBlend;
        if(road.dist > road.width){
          const shoulderBlend = 1-clamp((road.dist-road.width)/5, 0, 1);
          r += (0x9a-r)*shoulderBlend*0.35;
          g += (0x86-g)*shoulderBlend*0.35;
          b += (0x5b-b)*shoulderBlend*0.35;
        }
      }
      const idx = (py*w+px)*4;
      img.data[idx] = r; img.data[idx+1] = g; img.data[idx+2] = b; img.data[idx+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export function buildProceduralTexture(gen){
  const cv = document.createElement('canvas');
  cv.width = PROC_TEXTURE_SIZE_X; cv.height = PROC_TEXTURE_SIZE_Z;
  paintTerrainColors(cv.getContext('2d'), PROC_TEXTURE_SIZE_X, PROC_TEXTURE_SIZE_Z, gen);
  const tex = new THREE.CanvasTexture(cv);
  tex.flipY = true; // canvas y=0 is the top row, matching PlaneGeometry's default UV v=1 at the top after our rotateX below
  if('encoding' in tex) tex.encoding = THREE.sRGBEncoding;
  if('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildProceduralTerrainMesh(gen){
  const geo = new THREE.PlaneGeometry(CANVAS_W, CANVAS_H, PROC_MESH_SEGMENTS_X, PROC_MESH_SEGMENTS_Z);
  geo.rotateX(-Math.PI/2); // lie flat in the XZ plane, Y up
  geo.translate(CANVAS_W/2, 0, CANVAS_H/2); // shift from centered-at-origin to span X:[0,W], Z:[0,H]
  const pos = geo.attributes.position;
  for(let i=0;i<pos.count;i++){
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, elevationAtFor(gen, x, z)*PROC_TERRAIN_HEIGHT_SCALE);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    map: buildProceduralTexture(gen),
    color: new THREE.Color(TERRAIN_TEXTURE_BRIGHTNESS, TERRAIN_TEXTURE_BRIGHTNESS, TERRAIN_TEXTURE_BRIGHTNESS),
  });
  const mesh = new THREE.Mesh(geo, material);
  // per user request: the geometry above is built directly in raw canvas-unit space
  // (X:[0,CANVAS_W], Z:[0,CANVAS_H]) since elevationAtFor/terrainTypeAtFor take raw
  // canvas-unit coordinates -- but every OTHER 3D-facing consumer (camera position/lookAt,
  // unit/projectile/prop placement) maps canvas-unit XZ into world space via
  // canvasUnitToWorldXZ, which scales by WORLD.scaleX/scaleZ (METERS_PER_UNIT). Without this
  // scale, the mesh's actual world footprint (at most 1300x460 units) sat almost entirely
  // outside the camera's orbit around the correctly-scaled look-at point (thousands of units
  // out) -- only a sliver of it near the world origin ever fell in view. That's the real cause
  // behind "the battlefield is one flat color": the solid textured ground was rendering fine,
  // just almost never on screen -- everything that looked like terrain (grid lines, contour
  // lines, trees, unit markers) is drawn independently via canvasUnitToWorldXZ and so still
  // lined up correctly with each other, masking that the ground surface itself was missing.
  // Y is left unscaled since vertex heights above are already computed in world-height units
  // (elevation * PROC_TERRAIN_HEIGHT_SCALE, which itself already bakes in METERS_PER_UNIT).
  mesh.scale.set(WORLD.scaleX, 1, WORLD.scaleZ);
  mesh.receiveShadow = true;
  mesh.castShadow = true; // hills shadow their own far slopes and nearby valleys
  return mesh;
}

export function initThree(){
  const canvas3d = document.getElementById('board3d');
  if(typeof THREE === 'undefined'){
    console.warn('3D地形(Three.js)を読み込めませんでした。地図は表示されません。');
    return;
  }
  renderer3d = new THREE.WebGLRenderer({ canvas: canvas3d, antialias:true });
  renderer3d.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  // per user request: the map read as visually "lonely" -- partly because everything past the
  // terrain mesh's finite edges (sky, horizon, beyond the map boundary) was this same
  // near-black clear color with nothing to blend into it, so it looked like a void rather
  // than a horizon. A dusky sky tone, paired with scene3d.fog of the exact same color (set
  // in updateCameraFromView(), scaled to the current camera distance), lets distant terrain
  // fade smoothly into the background instead of cutting off sharply.
  renderer3d.setClearColor(SKY_COLOR, 1);
  // Without matching sRGB output encoding, lit colors (the flat terrain color, unit
  // markers, etc.) come out noticeably darker/duller than authored.
  if('outputEncoding' in renderer3d) renderer3d.outputEncoding = THREE.sRGBEncoding;
  // per user request: ACES filmic tone mapping instead of none, for a less flat/washed-out
  // look (highlights roll off instead of clipping straight to white). Exposure nudged up a
  // touch since ACES also compresses midtones darker than a 1:1 mapping would.
  renderer3d.toneMapping = THREE.ACESFilmicToneMapping;
  renderer3d.toneMappingExposure = 1.15;
  // per user request: real shadows (terrain relief, units, props) instead of flat lighting
  // with no depth cues at all -- soft-filtered (PCFSoftShadowMap) so shadow edges don't look
  // jagged at the shadow map's necessarily-limited resolution (see SHADOW_FRUSTUM_HALF).
  renderer3d.shadowMap.enabled = true;
  renderer3d.shadowMap.type = THREE.PCFSoftShadowMap;
  scene3d = new THREE.Scene();
  scene3d.fog = new THREE.Fog(SKY_COLOR, 1, 2); // near/far kept in sync with camera distance -- see updateCameraFromView()

  camera3d = new THREE.PerspectiveCamera(42, 1, 1, 100000);
  scene3d.add(camera3d);

  // per user request: a HemisphereLight (sky-tint from above, muted ground-tint from below)
  // replaces the old flat-white AmbientLight -- shadowed/indirect-lit areas now pick up a
  // believable cool-sky/warm-ground bounce instead of just being uniformly dimmer.
  scene3d.add(new THREE.HemisphereLight(0x8fa8c2, 0x4a4030, 0.55));
  sunLight = new THREE.DirectionalLight(0xfff4e0, 1.15);
  sunLight.position.set(SUN_OFFSET.x, SUN_OFFSET.y, SUN_OFFSET.z);
  sunLight.castShadow = true;
  // per user request: 2048 was too costly on top of ~200 shadow-casting draw calls: dropped
  // to 1024 alongside cutting most of those casters down to just terrain+tank+heli (see the
  // `add`/`addBarrel` helpers in makeMarkerMesh3d below) for a real perf win.
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.left = -SHADOW_FRUSTUM_HALF;
  sunLight.shadow.camera.right = SHADOW_FRUSTUM_HALF;
  sunLight.shadow.camera.top = SHADOW_FRUSTUM_HALF;
  sunLight.shadow.camera.bottom = -SHADOW_FRUSTUM_HALF;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = SUN_OFFSET.y * 4;
  sunLight.shadow.bias = -0.0015;
  scene3d.add(sunLight);
  scene3d.add(sunLight.target);

  loadTankModel3d();
  loadHeliModel3d();
  resizeThree();
}

export function loadTankModel3d(){
  if(tankModelLoadStarted || typeof THREE.FBXLoader !== 'function') return;
  tankModelLoadStarted = true;
  const loader = new THREE.FBXLoader();
  loader.load('./models/tank/tank.fbx', obj=>{
      const bounds = new THREE.Box3().setFromObject(obj);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      obj.position.sub(center);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      // FBX assets often contain a different authoring-unit scale than OBJ assets.
      // Normalize the imported bounds first, then apply the gameplay marker scale below.
      obj.scale.setScalar(1/maxDim);
      const normalizedBounds = new THREE.Box3().setFromObject(obj);
      obj.position.y -= normalizedBounds.min.y;
      obj.traverse(o=>{ if(o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
      tankModelTemplate3d = obj;
      Object.keys(unitMarkers3d).forEach(key=>{
        if(key.indexOf('tank')===0) disposeMarker3d(key);
      });
      syncUnitMarkers3d();
      console.info('戦車モデルを読み込みました');
    }, undefined, error=>console.warn('戦車FBXの読み込みに失敗しました', error));
}

export function loadHeliModel3d(){
  if(heliModelLoadStarted || typeof THREE.FBXLoader !== 'function') return;
  heliModelLoadStarted = true;
  const loader = new THREE.FBXLoader();
  loader.load('./models/heli/heli.fbx', obj=>{
      const bounds = new THREE.Box3().setFromObject(obj);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      obj.position.sub(center);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      obj.scale.setScalar(1/maxDim);
      const normalizedBounds = new THREE.Box3().setFromObject(obj);
      obj.position.y -= normalizedBounds.min.y;
      obj.traverse(o=>{ if(o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
      heliModelTemplate3d = obj;
      if(obj.animations && obj.animations.length > 0){
        heliAnimationMixer = new THREE.AnimationMixer(obj);
        heliAnimationAction = heliAnimationMixer.clipAction(obj.animations[0]);
        heliAnimationAction.play();
      }
      Object.keys(unitMarkers3d).forEach(key=>{
        if(key.indexOf('target')===0){
          const marker = unitMarkers3d[key];
          if(marker && marker._heliMarker) disposeMarker3d(key);
        }
      });
      syncUnitMarkers3d();
      console.info('ヘリモデルを読み込みました');
    }, undefined, error=>console.warn('ヘリFBXの読み込みに失敗しました', error));
}

export function regenerateTerrain(gen){
  if(typeof THREE === 'undefined' || !scene3d){
    console.warn('3D地形(Three.js)を読み込めませんでした。地図は表示されません。');
    return;
  }
  if(terrainObject3d){
    scene3d.remove(terrainObject3d);
    terrainObject3d.geometry.dispose();
    if(terrainObject3d.material.map) terrainObject3d.material.map.dispose();
    terrainObject3d.material.dispose();
  }
  state.terrainGen = gen;
  terrainObject3d = buildProceduralTerrainMesh(gen);
  scene3d.add(terrainObject3d);

  buildContourLines();
  buildProceduralRoads(gen.roadPaths, gen.roadKinds);
  buildTerrainProps(gen);
  cacheGroundLineHeights();
  threeReady = true;
  cameraNeedsInitialFit = true;
  resizeThree();
}

// per user request: the coordinate grid and contour lines are static per wave (same x/y
// positions the whole wave through -- GRID_LINES never changes shape at all, and
// buildContourLines() above only just rebuilt CONTOUR_LINES_CANVAS for this terrain) but were
// being reprojected via project()/projectAtHeight() every single frame, which re-runs the
// (expensive) procedural elevation noise for every segment endpoint on every draw. Caching each
// endpoint's terrain height here -- once per wave, not once per frame -- lets drawBoard() use
// projectAtWorldY() with the cached height directly instead, which was most of its cost.
function cacheGroundLineHeights(){
  const annotate = seg => { seg.h1 = terrainHeightAt(seg.x1, seg.y1); seg.h2 = terrainHeightAt(seg.x2, seg.y2); };
  GRID_LINES.minor.forEach(annotate);
  GRID_LINES.major.forEach(annotate);
  CONTOUR_LINES_CANVAS.forEach(annotate);
}

export function disposeTerrainProps(){
  [treeTrunkMesh3d, treeFoliageMesh3d, rockMesh3d].forEach(m=>{
    if(!m) return;
    scene3d.remove(m);
    m.geometry.dispose();
    m.material.dispose();
  });
  treeTrunkMesh3d = treeFoliageMesh3d = rockMesh3d = null;
}

export function buildTerrainProps(gen){
  disposeTerrainProps();
  const propScale = Math.max(1.4, (WORLD.scaleX+WORLD.scaleZ)/2*2.2);
  const m = new THREE.Matrix4();
  const trees = gen.trees||[];
  if(trees.length){
    const trunkGeo = new THREE.CylinderGeometry(0.5*propScale, 0.7*propScale, 5*propScale, 5);
    const trunkMat = new THREE.MeshStandardMaterial({color:0x4a3826, roughness:0.9});
    treeTrunkMesh3d = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
    const foliageGeo = new THREE.ConeGeometry(4*propScale, 10*propScale, 7);
    const foliageMat = new THREE.MeshStandardMaterial({color:0x2d4a22, roughness:0.85});
    treeFoliageMesh3d = new THREE.InstancedMesh(foliageGeo, foliageMat, trees.length);
    trees.forEach((t,i)=>{
      const groundY = elevationAtFor(gen, t.x, t.y)*PROC_TERRAIN_HEIGHT_SCALE;
      const {x,z} = canvasUnitToWorldXZ(t.x, t.y);
      const sc = t.scale;
      m.compose(new THREE.Vector3(x, groundY+2.5*propScale*sc, z), new THREE.Quaternion(), new THREE.Vector3(sc,sc,sc));
      treeTrunkMesh3d.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(x, groundY+7.5*propScale*sc, z), new THREE.Quaternion(), new THREE.Vector3(sc,sc,sc));
      treeFoliageMesh3d.setMatrixAt(i, m);
    });
    treeTrunkMesh3d.instanceMatrix.needsUpdate = true;
    treeFoliageMesh3d.instanceMatrix.needsUpdate = true;
    treeTrunkMesh3d.castShadow = treeTrunkMesh3d.receiveShadow = true;
    treeFoliageMesh3d.castShadow = treeFoliageMesh3d.receiveShadow = true;
    scene3d.add(treeTrunkMesh3d);
    scene3d.add(treeFoliageMesh3d);
  }
  const rocks = gen.rocks||[];
  if(rocks.length){
    const rockGeo = new THREE.IcosahedronGeometry(2.2*propScale, 0);
    const rockMat = new THREE.MeshStandardMaterial({color:0x5c5850, roughness:1, flatShading:true});
    rockMesh3d = new THREE.InstancedMesh(rockGeo, rockMat, rocks.length);
    rocks.forEach((r,i)=>{
      const groundY = elevationAtFor(gen, r.x, r.y)*PROC_TERRAIN_HEIGHT_SCALE;
      const {x,z} = canvasUnitToWorldXZ(r.x, r.y);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(r.rotX, r.rotY, r.rotZ));
      m.compose(new THREE.Vector3(x, groundY+1*propScale*r.scale, z), q, new THREE.Vector3(r.scale, r.scale*0.8, r.scale));
      rockMesh3d.setMatrixAt(i, m);
    });
    rockMesh3d.instanceMatrix.needsUpdate = true;
    rockMesh3d.castShadow = rockMesh3d.receiveShadow = true;
    scene3d.add(rockMesh3d);
  }
}

export function canvasUnitToWorldXZ(cx, cy){
  return { x: WORLD.originX + cx*WORLD.scaleX, z: WORLD.originZ + cy*WORLD.scaleZ };
}

export function terrainHeightAt(cx, cy){
  return WORLD.minY + elevationAt(cx, cy)*PROC_TERRAIN_HEIGHT_SCALE;
}

export let _projForward = null, _projToPoint = null;

export function project(cx, cy){
  return projectAtHeight(cx, cy, 0);
}

export function projectAtHeight(cx, cy, extraH){
  return projectAtWorldY(cx, cy, terrainHeightAt(cx,cy)+extraH);
}

export function projectAtWorldY(cx, cy, worldY){
  if(!threeReady || !camera3d) return { x:cx, y:cy, visible:true };
  // _projForward is kept up to date by updateCameraFromView()'s applyDist(), which is the only
  // place the camera's orientation actually changes -- see the comment there. Guard against the
  // (now purely defensive) case this is somehow called before that's ever run once.
  if(!_projForward){ _projForward = new THREE.Vector3(); _projToPoint = new THREE.Vector3(); camera3d.getWorldDirection(_projForward); }
  const {x,z} = canvasUnitToWorldXZ(cx,cy);
  const worldPt = new THREE.Vector3(x, worldY, z);
  _projToPoint.copy(worldPt).sub(camera3d.position);
  const inFront = _projToPoint.dot(_projForward) > 0.01;
  const v = worldPt.project(camera3d);
  return {
    x: (v.x*0.5+0.5)*MAP_VIEW.containerW,
    y: (1-(v.y*0.5+0.5))*MAP_VIEW.containerH,
    visible: inFront && v.z < 1,
  };
}

export function updateCameraFromView(){
  if(!camera3d) return;
  const viewCx = MAP_VIEW.cx, viewCy = MAP_VIEW.cy, viewZoom = MAP_VIEW.zoom;
  const look = canvasUnitToWorldXZ(viewCx, viewCy);
  const lookY = terrainHeightAt(viewCx, viewCy);
  // per user request: the sun's shadow camera is a small fixed-size box (SHADOW_FRUSTUM_HALF)
  // rather than one sized to the whole map, so it has to follow the view instead of covering
  // everything at once -- keep it centered on wherever the player is actually looking.
  if(sunLight){
    sunLight.position.set(look.x+SUN_OFFSET.x, lookY+SUN_OFFSET.y, look.z+SUN_OFFSET.z);
    sunLight.target.position.set(look.x, lookY, look.z);
  }
  camera3d.aspect = (MAP_VIEW.containerW||1)/(MAP_VIEW.containerH||1);
  const fieldW = (CANVAS_W*WORLD.scaleX) || 200;
  const fieldH = (CANVAS_H*WORLD.scaleZ) || 200;
  const diag = Math.hypot(fieldW, fieldH);

  const applyDist = (d)=>{
    const camX = look.x + d*Math.sin(MAP_VIEW.polar)*Math.sin(MAP_VIEW.azimuth);
    const camY = lookY + d*Math.cos(MAP_VIEW.polar);
    const camZ = look.z + d*Math.sin(MAP_VIEW.polar)*Math.cos(MAP_VIEW.azimuth);
    camera3d.position.set(camX, camY, camZ);
    camera3d.up.set(0,1,0);
    camera3d.lookAt(look.x, lookY, look.z);
    camera3d.near = Math.max(1, d*0.02);
    camera3d.far = d + (WORLD.maxY-WORLD.minY) + 8000;
    camera3d.updateProjectionMatrix();
    // per user request: projectAtWorldY() (the single choke point every on-map label/marker/
    // detection-circle-point projection goes through) used to call camera3d.getWorldDirection()
    // itself on EVERY call -- that walks the camera's world matrix chain and recomputes its
    // inverse from scratch every time, and with hundreds of project() calls in one drawBoard()
    // pass, that redundant per-call matrix work was most of drawBoard()'s cost. The camera's
    // orientation only actually changes here (once per camera update, not once per projected
    // point), so compute it here once and let projectAtWorldY just read the cached vector.
    if(!_projForward){ _projForward = new THREE.Vector3(); _projToPoint = new THREE.Vector3(); }
    camera3d.getWorldDirection(_projForward);
    // per user request: fog distance used to be recomputed right here too, but applyDist runs
    // on every touchmove/mousemove while panning (not just once per rendered frame) -- doing
    // the multi-ray scan below on every single input event, on top of everything else already
    // running per frame, was heavy enough to visibly stutter touch-drag panning on mobile.
    // Camera position/lookAt/projection above still update immediately every input event (that
    // part must stay instant for panning to feel responsive) but the fog band now only gets
    // recomputed once per animation frame from renderThreeFrame() -- see updateFogDistance().
    lastCameraDist = d;
  };

  // Once per map load, pick a default zoom that fits the whole map on screen. An
  // analytical FOV-based estimate isn't reliable for a TILTED camera -- the ground
  // footprint of an oblique perspective camera is a trapezoid, not a simple cone --
  // so this backs the camera off step by step, actually re-projecting the map's
  // corners each time, until all of them land on-screen. This must run only ONCE
  // (not on every call): forcing the whole map to stay on-screen on every update
  // fights the user's own zoom, since zooming in necessarily pushes the map's
  // corners off-screen -- that was the bug that made the zoom controls stop working.
  if(cameraNeedsInitialFit && MAP_VIEW.containerW && MAP_VIEW.containerH){
    let fitDist = diag*0.9;
    applyDist(fitDist);
    for(let i=0;i<20;i++){
      const corners = [[0,0],[CANVAS_W,0],[0,CANVAS_H],[CANVAS_W,CANVAS_H],[CANVAS_W/2,0],[CANVAS_W/2,CANVAS_H]];
      let allOk = true;
      for(const [cx,cy] of corners){
        const p = project(cx,cy);
        if(!p.visible || p.x<0 || p.x>MAP_VIEW.containerW || p.y<0 || p.y>MAP_VIEW.containerH){
          allOk = false;
          break;
        }
      }
      if(allOk) break;
      fitDist *= 1.15;
      applyDist(fitDist);
    }
    MAP_VIEW.zoom = clamp((diag*0.9)/fitDist, MAP_ZOOM_MIN, MAP_ZOOM_MAX);
    cameraNeedsInitialFit = false;
  }

  applyDist((diag*0.9)/viewZoom);
}

export function resizeThree(){
  const wrap = document.querySelector('.board-wrap');
  if(!wrap) return;
  const w = wrap.clientWidth, h = wrap.clientHeight;
  if(w<=0 || h<=0) return;
  MAP_VIEW.containerW = w; MAP_VIEW.containerH = h;
  if(renderer3d) renderer3d.setSize(w, h, false);
  const overlay = document.getElementById('board');
  if(overlay){ overlay.width = w; overlay.height = h; }
  updateCameraFromView();
}

export function clampMapView(){
  MAP_VIEW.zoom = clamp(MAP_VIEW.zoom, MAP_ZOOM_MIN, MAP_ZOOM_MAX);
  MAP_VIEW.polar = clamp(MAP_VIEW.polar, MAP_POLAR_MIN, MAP_POLAR_MAX);
  const margin = CANVAS_W*0.4;
  MAP_VIEW.cx = clamp(MAP_VIEW.cx, -margin, CANVAS_W+margin);
  MAP_VIEW.cy = clamp(MAP_VIEW.cy, -margin, CANVAS_H+margin*0.6);
}

export function groundPlaneCanvasUnitAt(px, py){
  if(!camera3d) return null;
  const ndcX = (px/MAP_VIEW.containerW)*2-1;
  const ndcY = -(py/MAP_VIEW.containerH)*2+1;
  const vec = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera3d);
  const dir = vec.sub(camera3d.position).normalize();
  const t = Math.abs(dir.y) < 1e-6 ? -1 : (WORLD.refY - camera3d.position.y)/dir.y;
  if(t<0){
    // The click's ray never crosses the ground plane in front of the camera (e.g. a
    // point above the horizon in a tilted view). Rather than reporting no position at
    // all -- which silently drops the move/fire order the click was meant to issue --
    // fall back to a plain screen-fraction mapping onto canvas-unit space so every
    // on-map click still resolves to *some* clampable position.
    return { x: (px/MAP_VIEW.containerW)*CANVAS_W, y: (py/MAP_VIEW.containerH)*CANVAS_H };
  }
  const hitX = camera3d.position.x + dir.x*t;
  const hitZ = camera3d.position.z + dir.z*t;
  return { x: (hitX-WORLD.originX)/WORLD.scaleX, y: (hitZ-WORLD.originZ)/WORLD.scaleZ };
}

export function terrainCanvasUnitAt(px, py){
  if(!threeReady || !terrainObject3d) return groundPlaneCanvasUnitAt(px,py);
  const ndcX = (px/MAP_VIEW.containerW)*2-1;
  const ndcY = -(py/MAP_VIEW.containerH)*2+1;
  const rc = new THREE.Raycaster();
  rc.setFromCamera({x:ndcX,y:ndcY}, camera3d);
  const hits = rc.intersectObject(terrainObject3d, true);
  if(!hits.length) return groundPlaneCanvasUnitAt(px,py);
  const p = hits[0].point;
  return { x: (p.x-WORLD.originX)/WORLD.scaleX, y: (p.z-WORLD.originZ)/WORLD.scaleZ };
}

export function buildHumanoidFigures(group, matFn, s, colorHex, offsets, opts){
  opts = opts || {};
  const FIGURE_SCALE = opts.figureScale || 2.2;
  const clusterR = s*1.1*FIGURE_SCALE;
  const maxR = Math.max(1, ...offsets.map(o=>Math.hypot(o.dx,o.dy)));
  const legMat = matFn(0x3b342a);
  return offsets.map(o=>{
    const x = (o.dx/maxR)*clusterR, z = (o.dy/maxR)*clusterR;
    const fig = new THREE.Group();
    const legH = s*0.22*FIGURE_SCALE, bodyH = s*0.34*FIGURE_SCALE, armH = s*0.26*FIGURE_SCALE;
    const hipY = legH, bodyY = legH + bodyH*0.5, shoulderY = bodyY + bodyH*0.5;
    const legPivots = [], armPivots = [];
    [-1,1].forEach(side=>{
      const legPivot = new THREE.Group();
      legPivot.position.set(x + side*s*0.05*FIGURE_SCALE, hipY, z);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(s*0.045*FIGURE_SCALE, s*0.05*FIGURE_SCALE, legH, 5), legMat);
      leg.position.set(0, -legH*0.5, 0);
      leg.receiveShadow = true;
      legPivot.add(leg);
      fig.add(legPivot);
      legPivots.push(legPivot);

      const armPivot = new THREE.Group();
      armPivot.position.set(x + side*s*0.16*FIGURE_SCALE, shoulderY, z);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(s*0.04*FIGURE_SCALE, s*0.045*FIGURE_SCALE, armH, 5), matFn(colorHex));
      arm.position.set(0, -armH*0.5, 0);
      arm.receiveShadow = true;
      armPivot.add(arm);
      fig.add(armPivot);
      armPivots.push(armPivot);
    });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(s*0.1*FIGURE_SCALE, s*0.12*FIGURE_SCALE, bodyH, 6), matFn(colorHex));
    body.position.set(x, bodyY, z);
    body.receiveShadow = true;
    fig.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(s*0.11*FIGURE_SCALE, 6, 5), matFn(0xd1b28a));
    head.position.set(x, shoulderY + s*0.05*FIGURE_SCALE, z);
    head.receiveShadow = true;
    fig.add(head);
    // Attached to the torso (fig), not a swinging arm pivot, so it stays a calm, readable
    // silhouette instead of flailing around with the walk-cycle arm swing.
    if(opts.weapon){
      const len = s*(opts.weapon==='longrifle'?0.62:0.42)*FIGURE_SCALE;
      const rifle = new THREE.Mesh(new THREE.CylinderGeometry(s*0.022*FIGURE_SCALE, s*0.022*FIGURE_SCALE, len, 5), matFn(0x242a2b));
      rifle.rotation.z = Math.PI/2.3;
      rifle.position.set(x + s*0.15*FIGURE_SCALE, bodyY, z + s*0.09*FIGURE_SCALE);
      rifle.receiveShadow = true;
      fig.add(rifle);
    }
    if(opts.pack){
      const pack = new THREE.Mesh(new THREE.BoxGeometry(s*0.13*FIGURE_SCALE, s*0.17*FIGURE_SCALE, s*0.09*FIGURE_SCALE), matFn(0x4a5a3a));
      pack.position.set(x, bodyY, z - s*0.1*FIGURE_SCALE);
      pack.receiveShadow = true;
      fig.add(pack);
    }
    fig._legPivots = legPivots;
    fig._armPivots = armPivots;
    fig._walkPhase = Math.random()*Math.PI*2;
    fig._walkAmp = 0;
    group.add(fig);
    return fig;
  });
}

export function makeMarkerMesh3d(shape, colorHex, formationOffsets){
  const group = new THREE.Group();
  const s = Math.max(0.6, (WORLD.scaleX+WORLD.scaleZ)/2*7.5);
  const mat = color=>new THREE.MeshStandardMaterial({color, roughness:0.7, metalness:0.05});
  const add = (geometry, material, y=0, z=0)=>{
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, y, z);
    // per user request: casting shadows from every one of these small primitive-shape
    // markers (mortars, squads, snipers, etc. -- ~200 individual draw calls in the shadow
    // pass) was too costly, especially on mobile GPUs. They still RECEIVE shadows (falling
    // under a tank/tree/hill's shadow still darkens them -- that's a cheap shader flag, not
    // an extra draw call) -- only the real FBX models (tank/heli) and terrain still cast.
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const addFlag = (color)=>{
    add(new THREE.CylinderGeometry(s*0.035, s*0.035, s*1.8, 6), mat(0x3b3024), s*0.9);
    const flag = add(new THREE.PlaneGeometry(s*0.65, s*0.32), mat(color), s*1.58);
    flag.position.x = s*0.32;
    flag.rotation.y = Math.PI/2;
  };
  const addBarrel = (color, length, height)=>{
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(s*0.08, s*0.1, length, 8), mat(color));
    barrel.rotation.x = Math.PI/2;
    barrel.position.set(0, height, length/2);
    barrel.receiveShadow = true;
    group.add(barrel);
  };
  const addTrack = (x)=>{
    add(new THREE.BoxGeometry(s*0.28, s*0.25, s*1.72), mat(0x202a2b), s*0.18, 0).position.x = x;
  };
  if(shape==='tank'){
    if(tankModelTemplate3d){
      const model = tankModelTemplate3d.clone(true);
      model.scale.setScalar(s*0.0025);
      model.rotation.y = Math.PI;
      group.add(model);
    }
  } else if(shape==='heli'){
    if(heliModelTemplate3d){
      const model = heliModelTemplate3d.clone(true);
      model.scale.setScalar(s*0.004); // per user request: half the previous size
      model.rotation.y = Math.PI;
      group.add(model);
      group._heliMarker = true;
    }
  } else if(shape==='mortar'){
    add(new THREE.CylinderGeometry(s*0.5, s*0.58, s*0.24, 8), mat(colorHex), s*0.12);
    const tube = add(new THREE.CylinderGeometry(s*0.12, s*0.16, s*0.95, 8), mat(0x3d4649), s*0.65);
    tube.rotation.z = -Math.PI*0.28;
    addFlag(colorHex);
  } else if(shape==='sam'){
    addTrack(-s*0.58);
    addTrack(s*0.58);
    add(new THREE.BoxGeometry(s*1.2, s*0.28, s*1.2), mat(colorHex), s*0.16);
    add(new THREE.CylinderGeometry(s*0.18, s*0.24, s*0.65, 8), mat(0x39454d), s*0.55);
    addBarrel(0x9aafbd, s*0.75, s*0.7);
    addFlag(colorHex);
  } else if(shape==='infantry'){
    // per user request: one small stick-figure per soldier (matching the unit's actual
    // roster, toggled visible/hidden per-soldier each frame as casualties happen -- see
    // updateSoldierFigures3d()) instead of a fixed 5 figures regardless of squad strength.
    // The offset pattern is the unit's real tactical formation for enemy infantry groups
    // (ENEMY_FORMATION_TEMPLATES, generated at spawn but never actually rendered until now)
    // or a plain grid for friendly squads (SQUAD_GRID_OFFSETS, which have no such template).
    // Each pattern is normalized to its own bounding radius so box/line/wedge/skirmish/etc.
    // all read as a similarly-sized cluster instead of some being tiny and others huge.
    const offsets = formationOffsets && formationOffsets.length ? formationOffsets : SQUAD_GRID_OFFSETS;
    group._soldierFigures = buildHumanoidFigures(group, mat, s, colorHex, offsets);
    addFlag(colorHex);
  } else if(shape==='scout' || shape==='sniper'){
    // per user request: 斥候・狙撃班も小隊と同じ人型フィギュア(buildHumanoidFigures)にする一方、
    // 兵種が見分けられるよう小道具で差別化する -- 斥候は背嚢(偵察装備)のみで武器は目立たせず、
    // 狙撃班は長い狙撃銃を携行し、旗の色も従来通りタン系(0xc5c0a5)のまま維持する。
    const offsets = SQUAD_GRID_OFFSETS.slice(0, shape==='scout' ? SCOUT_SQUAD_SIZE : SNIPER_SQUAD_SIZE);
    group._soldierFigures = buildHumanoidFigures(group, mat, s, colorHex, offsets,
      shape==='sniper' ? {weapon:'longrifle'} : {pack:true});
    addFlag(shape==='sniper' ? 0xc5c0a5 : colorHex);
  } else if(shape==='engineer'){
    add(new THREE.BoxGeometry(s*0.9, s*0.3, s*0.7), mat(colorHex), s*0.2);
    add(new THREE.CylinderGeometry(s*0.22, s*0.22, s*0.8, 8), mat(0x6b573f), s*0.7);
    addFlag(colorHex);
  } else if(shape==='hq'){
    add(new THREE.BoxGeometry(s*1.2, s*0.8, s*1.2), mat(colorHex), s*0.4);
    add(new THREE.ConeGeometry(s*0.85, s*0.7, 4), mat(0x4b5961), s*1.15);
    addFlag(colorHex);
  } else {
    let geo;
    if(shape==='cone') geo = new THREE.ConeGeometry(s*0.55, s*1.3, 8);
    else if(shape==='diamond') geo = new THREE.OctahedronGeometry(s*0.7);
    else if(shape==='box') geo = new THREE.BoxGeometry(s*0.9, s*0.7, s*0.9);
    else if(shape==='cylinder') geo = new THREE.CylinderGeometry(s*0.5, s*0.5, s*1.1, 10);
    else geo = new THREE.SphereGeometry(s*0.6, 10, 8);
    add(geo, mat(colorHex), s*0.5);
  }
  return group;
}

export function getMarker3d(key, shape, colorHex, formationOffsets){
  let m = unitMarkers3d[key];
  if(!m){
    m = makeMarkerMesh3d(shape, colorHex, formationOffsets);
    scene3d.add(m);
    unitMarkers3d[key] = m;
  }
  return m;
}

export function updateSoldierFigures3d(marker, aliveFlags){
  if(!marker || !marker._soldierFigures) return;
  marker._soldierFigures.forEach((fig,i)=>{ fig.visible = !!(aliveFlags && aliveFlags[i]); });
}

export function updateSoldierWalkCycle(marker, moving, dtSeconds){
  if(!marker || !marker._soldierFigures) return;
  marker._soldierFigures.forEach(fig=>{
    if(!fig.visible || !fig._legPivots) return;
    const targetAmp = moving ? 1 : 0;
    fig._walkAmp += (targetAmp-fig._walkAmp) * Math.min(1, dtSeconds*WALK_AMP_EASE);
    if(fig._walkAmp < 0.01){
      fig._walkAmp = 0;
      fig._legPivots[0].rotation.x = 0; fig._legPivots[1].rotation.x = 0;
      fig._armPivots[0].rotation.x = 0; fig._armPivots[1].rotation.x = 0;
      return;
    }
    fig._walkPhase += dtSeconds*WALK_CYCLE_SPEED;
    const swing = Math.sin(fig._walkPhase) * WALK_SWING_MAX * fig._walkAmp;
    fig._legPivots[0].rotation.x = swing;
    fig._legPivots[1].rotation.x = -swing;
    fig._armPivots[0].rotation.x = -swing;
    fig._armPivots[1].rotation.x = swing;
  });
}

export function updateSoldierHeading3d(marker, unit, visualX, visualY){
  const prevX = unit._soldierMarkerX;
  const prevY = unit._soldierMarkerY;
  unit._soldierMarkerX = visualX;
  unit._soldierMarkerY = visualY;
  if(prevX===undefined || prevY===undefined) return;
  const dx = visualX-prevX;
  const dz = visualY-prevY;
  if(Math.hypot(dx,dz) < 0.01) return;
  marker.rotation.y = Math.atan2(dx, dz);
}

export function updateTankHeading3d(marker, unit, visualX, visualY){
  const prevX = unit._tankMarkerX;
  const prevY = unit._tankMarkerY;
  unit._tankMarkerX = visualX;
  unit._tankMarkerY = visualY;
  if(prevX===undefined || prevY===undefined) return;
  const dx = visualX-prevX;
  const dz = visualY-prevY;
  if(Math.hypot(dx,dz) < 0.01) return;
  const travelHeading = Math.atan2(dx, dz);
  // The imported OBJ's nose points toward local -Z; the procedural fallback points +Z.
  marker.rotation.y = travelHeading + (tankModelTemplate3d ? Math.PI : 0);
}

export function updateHeliHeading3d(marker, target, visualX, visualY){
  const prevX = target._heliMarkerX;
  const prevY = target._heliMarkerY;
  target._heliMarkerX = visualX;
  target._heliMarkerY = visualY;
  if(prevX===undefined || prevY===undefined) return;
  const dx = visualX-prevX;
  const dz = visualY-prevY;
  if(Math.hypot(dx,dz) < 0.01) return;
  const travelHeading = Math.atan2(dx, dz);
  // The imported FBX helicopter's nose points toward local -Z.
  marker.rotation.y = travelHeading + Math.PI;
}

export function hideMarker3d(key){
  const m = unitMarkers3d[key];
  if(m) m.visible = false;
}

export function disposeMarker3d(key){
  const m = unitMarkers3d[key];
  if(!m) return;
  if(scene3d) scene3d.remove(m);
  m.traverse(child=>{
    if(child.geometry) child.geometry.dispose();
    if(child.material){
      if(Array.isArray(child.material)) child.material.forEach(material=>material.dispose());
      else child.material.dispose();
    }
  });
  delete unitMarkers3d[key];
}

export let lastWalkAnimAt = null;

export function walkDtSeconds(){
  const now = performance.now();
  if(lastWalkAnimAt===null){ lastWalkAnimAt = now; return 0; }
  // capped so a long stall (tab backgrounded, a slow frame) can't jerk the swing forward
  const dt = Math.min(0.25, (now-lastWalkAnimAt)/1000);
  lastWalkAnimAt = now;
  return dt;
}

export function isVisuallyMoving(entity, x, y){
  const prevX = entity._walkPrevX, prevY = entity._walkPrevY;
  entity._walkPrevX = x; entity._walkPrevY = y;
  if(prevX===undefined) return false;
  return Math.hypot(x-prevX, y-prevY) > 0.05;
}

export function syncUnitMarkers3d(){
  if(!threeReady || !state) return;
  const walkDt = walkDtSeconds();
  const seen = {};
  const place = (key, cx, cy, shape, colorHex, visible, formationOffsets)=>{
    seen[key] = true;
    if(!visible){ hideMarker3d(key); return; }
    const m = getMarker3d(key, shape, colorHex, formationOffsets);
    const h = terrainHeightAt(cx, cy);
    const {x,z} = canvasUnitToWorldXZ(cx, cy);
    const clearance = shape==='heli' ? HELI_FLIGHT_ALTITUDE : (WORLD.scaleX+WORLD.scaleZ)/2*6;
    m.position.set(x, h + clearance, z);
    m.visible = true;
  };

  // per user request: friendly symbols unified to blue on the 3D minimap
  // per user request: HQ is now movable -- use its smoothed visual position (set by
  // drawBoard's smoothVisualPos call) so this 3D box marker eases along with the 2D icon
  // instead of snapping straight to the logical position each tick.
  place('hq', state.hq._visX!==undefined?state.hq._visX:state.hq.x, state.hq._visY!==undefined?state.hq._visY:state.hq.y, 'hq', state.hq.hp>0 ? FRIENDLY_MARK_COLOR_3D : 0x5c2a25, true);
  // Primitive 3D unit markers are intentionally kept separate from the 2D labels/HUD.
  // This is the first full-3D pass: the shapes can later be replaced by GLTF models
  // without changing game state or order logic.
  const friendlyUnit = (key, unit, shape, alive)=>{
    const p = smoothVisualPos(unit, unit.x, unit.y);
    place(key, p.x, p.y, shape, alive ? FRIENDLY_MARK_COLOR_3D : 0x5c2a25, true);
    if(shape==='tank') updateTankHeading3d(unitMarkers3d[key], unit, p.x, p.y);
    if(shape==='heli') updateHeliHeading3d(unitMarkers3d[key], unit, p.x, p.y);
    if(shape==='infantry' || shape==='scout' || shape==='sniper'){
      updateSoldierFigures3d(unitMarkers3d[key], unit.soldiers.map(s=>s.alive));
      updateSoldierWalkCycle(unitMarkers3d[key], isVisuallyMoving(unit, p.x, p.y), walkDt);
      updateSoldierHeading3d(unitMarkers3d[key], unit, p.x, p.y);
    }
  };
  state.mortars.forEach((m,i)=>friendlyUnit('mortar'+i, m, 'mortar', m.hp>0));
  state.tanks.forEach((tk,i)=>friendlyUnit('tank'+i, tk, 'tank', tk.hp>0));
  state.sams.forEach((sam,i)=>friendlyUnit('sam'+i, sam, 'sam', sam.hp>0));
  (state.helis||[]).forEach((heli,i)=>friendlyUnit('heli'+i, heli, 'heli', heli.hp>0));
  state.scouts.forEach((s,i)=>friendlyUnit('scout'+i, s, 'scout', unitAlive(s)));
  state.squads.forEach((sq,i)=>friendlyUnit('squad'+i, sq, 'infantry', unitAlive(sq)));
  state.snipers.forEach((sn,i)=>friendlyUnit('sniper'+i, sn, 'sniper', unitAlive(sn)));
  state.engineers.forEach((en,i)=>friendlyUnit('engineer'+i, en, 'engineer', unitAlive(en)));
  // per user request: 防壁(壁) -- 他の自軍ユニットと違い専用の2Dベクター描画に加えて、
  // 3Dミニマップ上でも障害物として視認できるよう箱形メッシュを配置する。
  state.walls.forEach(w=>{
    const key = 'wall'+w.id;
    seen[key] = true;
    place(key, w.x, w.y, 'box', w.hp>0 ? FRIENDLY_MARK_COLOR_3D : 0x5c2a25, w.hp>0);
  });
  state.targets.forEach((t,i)=>{
    const key = 'target'+t.id;
    if(t.destroyed){ place(key, t.trueX, t.trueY, 'sphere', 0x5c2a25, false); return; }
    if(!isTargetDetected(t)){ place(key, 0, 0, 'sphere', 0, false); return; }
    const eLogical = estPos(t);
    const e = smoothVisualPos(t, eLogical.x, eLogical.y);
    const shape = t.type==='hq' ? 'hq' : t.type==='vehicle' ? 'tank' : t.type==='artillery' ? 'cylinder' : t.type==='drone' ? 'diamond' : t.type==='heli' ? 'heli' : t.type==='infantry' ? 'infantry' : 'sphere';
    place(key, e.x, e.y, shape, t.revealed ? (TARGET_TYPE_COLOR[t.type]||0xc1453b) : 0x8f9678, true, t.formationOffsets);
    if(shape==='heli') updateHeliHeading3d(unitMarkers3d[key], t, e.x, e.y);
    if(shape==='infantry' && t.troops){
      updateSoldierFigures3d(unitMarkers3d[key], t.troops.map(s=>s.alive));
      updateSoldierWalkCycle(unitMarkers3d[key], isVisuallyMoving(t, e.x, e.y), walkDt);
      updateSoldierHeading3d(unitMarkers3d[key], t, e.x, e.y);
    }
  });

  Object.keys(unitMarkers3d).forEach(key=>{
    if(!seen[key]) hideMarker3d(key);
  });
}

export let _fogRayVec = null, _fogRayDir = null;

export function updateFogDistance(){
  if(!camera3d || !scene3d || !scene3d.fog) return;
  if(!_fogRayVec){ _fogRayVec = new THREE.Vector3(); _fogRayDir = new THREE.Vector3(); }
  let maxDepth = 0;
  for(const fx of [0, 0.25, 0.5, 0.75, 1]){
    for(const fy of [1, 0.85, 0.65]){ // top edge first; fall back lower if it's above the horizon
      _fogRayVec.set(fx*2-1, fy*2-1, 0.5).unproject(camera3d);
      _fogRayDir.copy(_fogRayVec).sub(camera3d.position).normalize();
      const t = Math.abs(_fogRayDir.y) < 1e-6 ? -1 : (WORLD.refY - camera3d.position.y)/_fogRayDir.y;
      if(t > maxDepth) maxDepth = t;
    }
  }
  if(maxDepth > 0){
    scene3d.fog.near = maxDepth*0.45;
    scene3d.fog.far = maxDepth*1.15;
  } else {
    // every sampled ray pointed above the horizon (e.g. looking mostly at open sky) --
    // fall back to the old distance-based estimate rather than leaving fog at a stale value.
    scene3d.fog.near = lastCameraDist*0.7;
    scene3d.fog.far = lastCameraDist*2.0;
  }
}

export function renderThreeFrame(){
  if(!threeReady || !renderer3d) return;
  updateMapFocusEase();
  syncUnitMarkers3d();
  updateFogDistance();
  if(heliAnimationMixer){
    const delta = 1/60;
    heliAnimationMixer.update(delta);
  }
  renderer3d.render(scene3d, camera3d);
}


Object.assign(window, { scaledIconH, paintTerrainColors, buildProceduralTexture, buildProceduralTerrainMesh, initThree, loadTankModel3d, loadHeliModel3d, regenerateTerrain, disposeTerrainProps, buildTerrainProps, canvasUnitToWorldXZ, terrainHeightAt, project, projectAtHeight, projectAtWorldY, updateCameraFromView, resizeThree, clampMapView, groundPlaneCanvasUnitAt, terrainCanvasUnitAt, buildHumanoidFigures, makeMarkerMesh3d, getMarker3d, updateSoldierFigures3d, updateSoldierWalkCycle, updateSoldierHeading3d, updateTankHeading3d, updateHeliHeading3d, hideMarker3d, disposeMarker3d, walkDtSeconds, isVisuallyMoving, syncUnitMarkers3d, updateFogDistance, renderThreeFrame });
