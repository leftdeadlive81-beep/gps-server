// Split out of the former monolithic mortar_fdc_game.js.
import { estPos, smoothVisualPos, state, unitAlive } from './combat.js';
import { BAND_SQUAD_SIZE, CANVAS_H, CANVAS_W, CONTOUR_LINES_CANVAS, FORTRESS_NEUTRAL_COLOR_3D, FRIENDLY_MARK_COLOR_3D, GRID_LINES, HELI_FLIGHT_ALTITUDE, MAP_INITIAL_AZIMUTH, MAP_POLAR_MAX, MAP_POLAR_MIN, MAP_VIEW, MAP_ZOOM_MAX, MAP_ZOOM_MIN, PROC_CANOPY_CELL, PROC_CANOPY_DARK, PROC_CANOPY_LIGHT, PROC_CLEARING_CELL, PROC_CLEARING_COLOR, PROC_CLEARING_EDGE0, PROC_CLEARING_EDGE1, PROC_COLOR_FOREST, PROC_COLOR_HIGH, PROC_COLOR_LOW, PROC_COLOR_WATER, PROC_DRY_PATCH_CELL, PROC_DRY_PATCH_COLOR, PROC_DRY_PATCH_EDGE0, PROC_DRY_PATCH_EDGE1, PROC_MESH_SEGMENTS_X, PROC_MESH_SEGMENTS_Z, PROC_OPEN_MOTTLE_AMOUNT, PROC_OPEN_MOTTLE_CELL, PROC_TERRAIN_HEIGHT_SCALE, PROC_TEXTURE_NOISE_COARSE_AMOUNT, PROC_TEXTURE_NOISE_COARSE_CELL, PROC_TEXTURE_NOISE_FINE_AMOUNT, PROC_TEXTURE_NOISE_FINE_CELL, PROC_TEXTURE_SIZE_X, PROC_TEXTURE_SIZE_Z, SCOUT_SQUAD_SIZE, SHADOW_FRUSTUM_HALF, SKY_COLOR, SQUAD_GRID_OFFSETS, SUN_OFFSET, TARGET_TYPE_COLOR, TERRAIN_TEXTURE_BRIGHTNESS, TERRAIN_TYPE_FOREST, TERRAIN_TYPE_WATER, WALK_AMP_EASE, WALK_ANIM_DETAIL_ZOOM, WALK_ANIM_MIN_INTERVAL_MS, WALK_CYCLE_SPEED, WALK_SWING_MAX, WORLD, unitMarkers3d } from './constants.js';
import { updateMapFocusEase } from './input.js';
import { buildContourLines, buildProceduralRoads, elevationAt, elevationAtFor, nearestPointOnRoad, riverXAt, terrainTypeAtFor } from './terrain.js';
import { clamp, smoothstep01, valueNoise2D } from './utils.js';

// per user request: スマホプレイ時、地図上のユニット記号が全体的に小さいという指摘への
// 対応 -- 狭い(≒スマホ)ビューポートでは記号の基準サイズを底上げする。mortar_fdc_game.css
// 側のモバイル向けテキスト底上げと同じ600pxのブレークポイントを使い、見た目の基準を揃える。
const MOBILE_ICON_BREAKPOINT = 600;
const MOBILE_ICON_MULT = 1.35;
function mobileIconMult(){
  return (window.innerWidth||0) <= MOBILE_ICON_BREAKPOINT ? MOBILE_ICON_MULT : 1;
}

export function scaledIconH(baseH){
  return baseH * mobileIconMult() * clamp(Math.sqrt(MAP_VIEW.zoom), 0.6, 2.2);
}

export let threeReady = false;

export let cameraNeedsInitialFit = true;

export let scene3d, camera3d, renderer3d, terrainObject3d, sunLight;

export let lastCameraDist = 0;

export let treeTrunkMesh3d = null, treeFoliageMesh3d = null, rockMesh3d = null;

export let roadMeshes3d = [];

export let tankModelTemplate3d = null;

export let tankModelLoadStarted = false;

export let heliModelTemplate3d = null;

export let heliModelLoadStarted = false;

export let heliAnimationMixer = null;

export let heliAnimationAction = null;

function blendTerrainColor(r, g, b, color, amount){
  return [
    r + (color[0]-r)*amount,
    g + (color[1]-g)*amount,
    b + (color[2]-b)*amount,
  ];
}

function forestInfluenceAt(gen, x, y){
  let best = 0;
  (gen.forestPatches||[]).forEach(f=>{
    const d = Math.hypot(x-f.x, y-f.y);
    if(d > f.r+26) return;
    const t = clamp((f.r+26-d)/38, 0, 1);
    best = Math.max(best, smoothstep01(t));
  });
  return best;
}

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
      const forestAlpha = forestInfluenceAt(gen, cx, cy);
      let r,g,b,noiseMult;
      if(type===TERRAIN_TYPE_WATER){ [r,g,b] = PROC_COLOR_WATER; noiseMult = 0.35; }
      else if(type===TERRAIN_TYPE_FOREST){
        const canopyN = valueNoise2D(cx/PROC_CANOPY_CELL, cy/PROC_CANOPY_CELL, gen.seed+7);
        r = PROC_CANOPY_DARK[0] + (PROC_CANOPY_LIGHT[0]-PROC_CANOPY_DARK[0])*canopyN;
        g = PROC_CANOPY_DARK[1] + (PROC_CANOPY_LIGHT[1]-PROC_CANOPY_DARK[1])*canopyN;
        b = PROC_CANOPY_DARK[2] + (PROC_CANOPY_LIGHT[2]-PROC_CANOPY_DARK[2])*canopyN;
        const crown = smoothstep01(clamp((valueNoise2D(cx/5.5, cy/5.5, gen.seed+41)-0.46)/0.28, 0, 1));
        const gap = smoothstep01(clamp((valueNoise2D(cx/8, cy/8, gen.seed+43)-0.72)/0.18, 0, 1));
        r += crown*22 - gap*26;
        g += crown*30 - gap*30;
        b += crown*13 - gap*20;
        const clearingN = valueNoise2D(cx/PROC_CLEARING_CELL, cy/PROC_CLEARING_CELL, gen.seed+13);
        const clearingT = smoothstep01(clamp((clearingN-PROC_CLEARING_EDGE0)/(PROC_CLEARING_EDGE1-PROC_CLEARING_EDGE0), 0, 1));
        if(clearingT > 0){
          r += (PROC_CLEARING_COLOR[0]-r)*clearingT;
          g += (PROC_CLEARING_COLOR[1]-g)*clearingT;
          b += (PROC_CLEARING_COLOR[2]-b)*clearingT;
        }
        if(forestAlpha < 0.92){
          const edgeColor = [0x57,0x62,0x38];
          const edgeBlend = 1-forestAlpha;
          [r,g,b] = blendTerrainColor(r, g, b, edgeColor, edgeBlend*0.55);
        }
        noiseMult = 0.6;
      }
      else {
        r = PROC_COLOR_LOW[0] + (PROC_COLOR_HIGH[0]-PROC_COLOR_LOW[0])*e;
        g = PROC_COLOR_LOW[1] + (PROC_COLOR_HIGH[1]-PROC_COLOR_LOW[1])*e;
        b = PROC_COLOR_LOW[2] + (PROC_COLOR_HIGH[2]-PROC_COLOR_LOW[2])*e;
        const grassStreak = Math.sin(cx*0.23 + valueNoise2D(cx/38, cy/22, gen.seed+37)*Math.PI*2) * 0.5 + 0.5;
        const scrub = smoothstep01(clamp((valueNoise2D(cx/18, cy/18, gen.seed+39)-0.58)/0.24, 0, 1));
        r += grassStreak*8 - scrub*13;
        g += grassStreak*13 + scrub*12;
        b += grassStreak*4 - scrub*7;
        const mottleN = (valueNoise2D(cx/PROC_OPEN_MOTTLE_CELL, cy/PROC_OPEN_MOTTLE_CELL, gen.seed+19) - 0.5) * PROC_OPEN_MOTTLE_AMOUNT;
        r += mottleN; g += mottleN*0.85; b += mottleN*0.55;
        const dryN = valueNoise2D(cx/PROC_DRY_PATCH_CELL, cy/PROC_DRY_PATCH_CELL, gen.seed+23);
        const dryT = smoothstep01(clamp((dryN-PROC_DRY_PATCH_EDGE0)/(PROC_DRY_PATCH_EDGE1-PROC_DRY_PATCH_EDGE0), 0, 1));
        if(dryT > 0){
          r += (PROC_DRY_PATCH_COLOR[0]-r)*dryT;
          g += (PROC_DRY_PATCH_COLOR[1]-g)*dryT;
          b += (PROC_DRY_PATCH_COLOR[2]-b)*dryT;
        }
        if(forestAlpha > 0.02){
          const fringe = Math.min(0.45, forestAlpha*0.5);
          [r,g,b] = blendTerrainColor(r, g, b, PROC_COLOR_FOREST, fringe);
        }
        noiseMult = 1;
      }
      const noise = ((valueNoise2D(cx/PROC_TEXTURE_NOISE_COARSE_CELL, cy/PROC_TEXTURE_NOISE_COARSE_CELL, gen.seed)-0.5)*PROC_TEXTURE_NOISE_COARSE_AMOUNT
                   + (valueNoise2D(cx/PROC_TEXTURE_NOISE_FINE_CELL, cy/PROC_TEXTURE_NOISE_FINE_CELL, gen.seed+1)-0.5)*PROC_TEXTURE_NOISE_FINE_AMOUNT) * noiseMult;
      r = clamp(r+noise, 0, 255); g = clamp(g+noise*0.9, 0, 255); b = clamp(b+noise*0.7, 0, 255);
      const eEast = elevationAtFor(gen, Math.min(CANVAS_W, cx+10), cy);
      const eSouth = elevationAtFor(gen, cx, Math.min(CANVAS_H, cy+10));
      const slopeX = eEast-e;
      const slopeY = eSouth-e;
      const slopeMag = Math.abs(slopeX)+Math.abs(slopeY);
      const hillshade = clamp(0.78 + (-slopeX*1.1 - slopeY*0.55), 0.56, 1.24);
      const ridge = clamp(slopeMag*2.8, 0, 0.22);
      r = clamp(r*hillshade + 255*ridge, 0, 255);
      g = clamp(g*hillshade + 245*ridge, 0, 255);
      b = clamp(b*hillshade + 220*ridge, 0, 255);
      if(type!==TERRAIN_TYPE_WATER){
        const rockBlend = smoothstep01(clamp((slopeMag-0.035)/0.09, 0, 1)) * (type===TERRAIN_TYPE_FOREST ? 0.28 : 0.52);
        if(rockBlend > 0){
          const striation = 0.7 + 0.3*Math.sin((cx+cy*0.45)*0.18);
          [r,g,b] = blendTerrainColor(r, g, b, [0x70,0x68,0x58], rockBlend*striation);
        }
      }
      if(type===TERRAIN_TYPE_WATER){
        const rx = gen.river ? riverXAt(gen.river, cy) : cx;
        const depth = gen.river ? clamp(Math.abs(cx-rx)/(gen.river.width/2), 0, 1) : 0.5;
        const flow = Math.sin(cy*0.2 + valueNoise2D(cx/24, cy/18, gen.seed+31)*Math.PI*2);
        const ripple = Math.sin((cy+cx*0.18)*0.62 + gen.seed*0.01);
        const shimmer = (flow*8 + ripple*4) * (0.35+depth*0.65);
        const deepColor = [0x19,0x35,0x4d];
        const shallowColor = [0x5d,0x72,0x6a];
        [r,g,b] = blendTerrainColor(r, g, b, deepColor, (1-depth)*0.55);
        [r,g,b] = blendTerrainColor(r, g, b, shallowColor, depth*0.38);
        r = clamp(r + shimmer*0.25, 0, 255);
        g = clamp(g + shimmer*0.55, 0, 255);
        b = clamp(b + shimmer, 0, 255);
      }
      const road = roadDistance(cx, cy);
      if(road && road.dist < road.width + 5){
        const edge = clamp((road.dist-road.width)/5, 0, 1);
        const roadColor = road.kind==='dirt' ? [0x8b,0x6a,0x43] : road.kind==='branch' ? [0x6f,0x6d,0x5d] : [0x7e,0x7d,0x70];
        const roadBlend = 1-edge;
        r += (roadColor[0]-r)*roadBlend;
        g += (roadColor[1]-g)*roadBlend;
        b += (roadColor[2]-b)*roadBlend;
        if(road.dist < road.width){
          const rut = Math.exp(-Math.pow((road.dist-road.width*0.48)/1.35, 2));
          const crown = Math.exp(-Math.pow(road.dist/Math.max(1, road.width*0.28), 2));
          r = clamp(r - rut*32 + crown*10, 0, 255);
          g = clamp(g - rut*30 + crown*9, 0, 255);
          b = clamp(b - rut*25 + crown*8, 0, 255);
        }
        if(road.dist > road.width){
          const shoulderBlend = 1-clamp((road.dist-road.width)/5, 0, 1);
          r += (0x9a-r)*shoulderBlend*0.35;
          g += (0x86-g)*shoulderBlend*0.35;
          b += (0x5b-b)*shoulderBlend*0.35;
        }
      } else if(gen.river){
        const rx = riverXAt(gen.river, cy);
        const shoreDist = Math.abs(cx-rx) - gen.river.width/2;
        if(shoreDist > 0 && shoreDist < 9){
          const shore = 1 - shoreDist/9;
          r += (0x8d-r)*shore*0.28;
          g += (0x83-g)*shore*0.28;
          b += (0x64-b)*shore*0.28;
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
      obj.traverse(o=>{ if(o.isMesh){ o.castShadow = false; o.receiveShadow = true; } });
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
  buildRoadMeshes3d(gen.roadPaths, gen.roadKinds);
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

// per user request: roads used to be drawn as a flat pass on the 2D `#board` overlay canvas,
// which sits compositely ABOVE the 3D WebGL canvas -- so a road always rendered on top of every
// unit, regardless of which was actually nearer the camera. Building them as real ground-
// following ribbon meshes IN the 3D scene instead lets the normal depth buffer sort them against
// unit meshes correctly, the same way it already sorts terrain against units.
const ROAD_KIND_STYLE = {
  main: { color: 0xb9b59b, borderColor: 0x231d16, width: 26, opacity: 0.92 },
  branch: { color: 0x93917a, borderColor: 0x231d16, width: 18, opacity: 0.88 },
  dirt: { color: 0x8b6a43, borderColor: 0x231d16, width: 13, opacity: 0.82 },
};

const ROAD_SAMPLE_STEP_UNITS = 18;
const ROAD_SURFACE_Y_OFFSET = 1.1;
const ROAD_BORDER_Y_OFFSET = 0.7;
const ROAD_BORDER_WIDTH_EXTRA = 6;

function densifyRoadPoints(road){
  const pts = [];
  for(let i=0;i<road.length-1;i++){
    const a = road[i], b = road[i+1];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x-a.x, b.y-a.y)/ROAD_SAMPLE_STEP_UNITS));
    for(let j=0;j<steps;j++){
      const t = j/steps;
      pts.push({x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t});
    }
  }
  const last = road[road.length-1];
  if(last) pts.push(last);
  return pts;
}

function buildRoadRibbonGeometry(canvasPts, widthUnits, yOffset){
  const n = canvasPts.length;
  if(n<2) return null;
  const worldPts = canvasPts.map(p=>{
    const {x,z} = canvasUnitToWorldXZ(p.x, p.y);
    return { x, z, y: terrainHeightAt(p.x, p.y)+yOffset };
  });
  const halfW = widthUnits*WORLD.scaleX/2;
  const positions = new Float32Array(n*2*3);
  for(let i=0;i<n;i++){
    const prev = worldPts[Math.max(0,i-1)], next = worldPts[Math.min(n-1,i+1)];
    let dx = next.x-prev.x, dz = next.z-prev.z;
    const len = Math.hypot(dx,dz) || 1;
    dx/=len; dz/=len;
    const px = -dz, pz = dx;
    const w = worldPts[i];
    positions[i*6+0] = w.x+px*halfW; positions[i*6+1] = w.y; positions[i*6+2] = w.z+pz*halfW;
    positions[i*6+3] = w.x-px*halfW; positions[i*6+4] = w.y; positions[i*6+5] = w.z-pz*halfW;
  }
  const indices = [];
  for(let i=0;i<n-1;i++){
    const a=i*2, b=i*2+1, c=(i+1)*2, d=(i+1)*2+1;
    indices.push(a,b,c, b,d,c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function disposeRoadMeshes3d(){
  roadMeshes3d.forEach(mesh=>{
    scene3d.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });
  roadMeshes3d = [];
}

export function buildRoadMeshes3d(roadPaths, roadKinds){
  disposeRoadMeshes3d();
  (roadPaths||[]).forEach((road, idx)=>{
    const style = ROAD_KIND_STYLE[(roadKinds||[])[idx]] || ROAD_KIND_STYLE.main;
    const pts = densifyRoadPoints(road);
    const borderGeo = buildRoadRibbonGeometry(pts, style.width+ROAD_BORDER_WIDTH_EXTRA, ROAD_BORDER_Y_OFFSET);
    const surfaceGeo = buildRoadRibbonGeometry(pts, style.width, ROAD_SURFACE_Y_OFFSET);
    if(borderGeo){
      const borderMesh = new THREE.Mesh(borderGeo, new THREE.MeshStandardMaterial({
        color: style.borderColor, roughness: 1, transparent:true, opacity: style.opacity*0.85,
      }));
      borderMesh.receiveShadow = true;
      scene3d.add(borderMesh);
      roadMeshes3d.push(borderMesh);
    }
    if(surfaceGeo){
      const surfaceMesh = new THREE.Mesh(surfaceGeo, new THREE.MeshStandardMaterial({
        color: style.color, roughness: 0.95, transparent:true, opacity: style.opacity,
      }));
      surfaceMesh.receiveShadow = true;
      scene3d.add(surfaceMesh);
      roadMeshes3d.push(surfaceMesh);
    }
  });
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
  const viewCx = MAP_VIEW.cx, viewCy = MAP_VIEW.cy;
  let viewZoom = MAP_VIEW.zoom;
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

    // per user request: on narrow/mobile-portrait screens (MAP_INITIAL_AZIMUTH rotates the
    // camera 90° there), the "keep every corner on screen" pass above ends up dominated by the
    // map's now-sideways-running long edge, leaving large empty bands above/below the map that
    // its vertical extent never reaches. Zoom in further, specifically until the map's vertical
    // span fills the container's height, accepting that the map's sides may now run off-screen
    // (still reachable by panning) since only the vertical gap was ever wasted space.
    if(MAP_INITIAL_AZIMUTH !== 0){
      const vCorners = [[0,0],[CANVAS_W,0],[0,CANVAS_H],[CANVAS_W,CANVAS_H]];
      const verticalSpanAt = (d)=>{
        applyDist(d);
        const ys = vCorners.map(([cx,cy])=>project(cx,cy).y);
        return Math.max(...ys) - Math.min(...ys);
      };
      const targetSpan = MAP_VIEW.containerH * 0.97;
      const maxFitDist = (diag*0.9)/MAP_ZOOM_MAX;
      let i = 0;
      while(i<40 && fitDist>maxFitDist && verticalSpanAt(fitDist)<targetSpan){
        fitDist /= 1.06;
        i++;
      }
      if(fitDist < maxFitDist) fitDist = maxFitDist;
    }

    MAP_VIEW.zoom = clamp((diag*0.9)/fitDist, MAP_ZOOM_MIN, MAP_ZOOM_MAX);
    // the fitted zoom must also drive the applyDist call below on this very first pass --
    // otherwise this call would render one frame at the pre-fit distance and only pick up the
    // fit on whatever later call happens to run next (a pan, a zoom, a resize), which may not
    // happen before the player already sees the unfit frame.
    viewZoom = MAP_VIEW.zoom;
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

// per user request: convert per-soldier THREE.Group figures (each built from ~6 separate
// THREE.Mesh children with their own freshly-allocated materials -- 2 legs, 2 arms, 1 torso,
// 1 head, plus an optional weapon/pack) into a small fixed set of shared THREE.InstancedMesh
// pools, one per body-part type, so the whole battlefield's soldiers cost 6 draw calls total
// instead of hundreds. Each soldier gets a permanently-assigned slot index per part pool
// (freed back to a free-list when its unit marker is disposed -- see freeSoldierFigureSlots/
// disposeMarker3d below); per-frame posing (walk-cycle limb swing, following the marker's own
// moving/rotating position) writes matrices directly into each pool's instance buffer via
// flushSoldierInstances3d instead of relying on the scene graph to compose transforms for us.
const SOLDIER_SLOT_CAPACITY = 160; // friendly squads+scouts+band max 63, enemy infantry capped at ENEMY_INFANTRY_TOTAL_TARGET=50 -- generous buffer above their sum
const SOLDIER_WEAPON_CAPACITY = 16; // only 音楽隊(band) figures carry one
const SOLDIER_PACK_CAPACITY = 24; // only 斥候(scout) figures carry one

let soldierPool = null;

const _ZERO_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);
const _UNIT_X = new THREE.Vector3(1, 0, 0);
const _UNIT_Z = new THREE.Vector3(0, 0, 1);
const _pV = new THREE.Vector3(), _pQ = new THREE.Quaternion(), _pS = new THREE.Vector3(1, 1, 1);
const _lV = new THREE.Vector3(), _lQ = new THREE.Quaternion(), _lS = new THREE.Vector3();
const _mPivot = new THREE.Matrix4(), _mLocal = new THREE.Matrix4(), _mWorld = new THREE.Matrix4();

function buildSoldierPool(){
  // per-soldier world size is baked once here (from the map's fixed WORLD.scale and the
  // current mobile/desktop breakpoint) since one shared pool geometry can't vary in size per
  // instance -- see makeMarkerMesh3d's own (still per-call) `s` for why that's normally fine:
  // both are the same formula and WORLD.scale never changes after terrain generation, so this
  // only drifts from a marker's own `s` in the rare case a window resize crosses the 600px
  // breakpoint mid-game, which is an acceptable cosmetic edge case for a perf-motivated change.
  const s = Math.max(0.6, (WORLD.scaleX+WORLD.scaleZ)/2*7.5) * mobileIconMult();
  const SC = s*2.2; // FIGURE_SCALE=2.2, matching every existing call site (none ever overrides it)
  const legGeo = new THREE.CylinderGeometry(0.045, 0.05, 0.22, 5);
  const armGeo = new THREE.CylinderGeometry(0.04, 0.045, 0.26, 5);
  const torsoGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.34, 6);
  const headGeo = new THREE.SphereGeometry(0.11, 6, 5);
  const weaponGeo = new THREE.CylinderGeometry(0.022, 0.022, 1, 5); // unit height -- actual length applied via per-instance Y scale
  const packGeo = new THREE.BoxGeometry(0.13, 0.17, 0.09);
  // Legs/head/weapon/pack colors never varied per-soldier even before this change (the old
  // matFn calls only ever passed colorHex for arms/torso -- everything else used a fixed
  // color), so only the arm/torso pools need per-instance color (set once at allocation below).
  const legs = new THREE.InstancedMesh(legGeo, new THREE.MeshStandardMaterial({color:0x3b342a, roughness:0.7, metalness:0.05}), SOLDIER_SLOT_CAPACITY*2);
  const arms = new THREE.InstancedMesh(armGeo, new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.7, metalness:0.05}), SOLDIER_SLOT_CAPACITY*2);
  const torsos = new THREE.InstancedMesh(torsoGeo, new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.7, metalness:0.05}), SOLDIER_SLOT_CAPACITY);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({color:0xd1b28a, roughness:0.7, metalness:0.05}), SOLDIER_SLOT_CAPACITY);
  const weapons = new THREE.InstancedMesh(weaponGeo, new THREE.MeshStandardMaterial({color:0x242a2b, roughness:0.7, metalness:0.05}), SOLDIER_WEAPON_CAPACITY);
  const packs = new THREE.InstancedMesh(packGeo, new THREE.MeshStandardMaterial({color:0x4a5a3a, roughness:0.7, metalness:0.05}), SOLDIER_PACK_CAPACITY);
  [legs, arms, torsos, heads, weapons, packs].forEach(mesh=>{
    mesh.receiveShadow = true;
    mesh.frustumCulled = false; // instances span the whole battlefield -- the geometry's own tiny bounding sphere would cull everyone incorrectly
    for(let i=0; i<mesh.count; i++) mesh.setMatrixAt(i, _ZERO_MATRIX);
    mesh.instanceMatrix.needsUpdate = true;
    scene3d.add(mesh);
  });
  soldierPool = {
    SC, legs, arms, torsos, heads, weapons, packs,
    freeSlots: Array.from({length:SOLDIER_SLOT_CAPACITY}, (_,i)=>SOLDIER_SLOT_CAPACITY-1-i),
    freeWeapons: Array.from({length:SOLDIER_WEAPON_CAPACITY}, (_,i)=>SOLDIER_WEAPON_CAPACITY-1-i),
    freePacks: Array.from({length:SOLDIER_PACK_CAPACITY}, (_,i)=>SOLDIER_PACK_CAPACITY-1-i),
  };
}

function allocSoldierSlot(){
  if(!soldierPool) buildSoldierPool();
  if(!soldierPool.freeSlots.length){ console.warn('兵士インスタンスの上限に達しました -- SOLDIER_SLOT_CAPACITYを増やしてください'); return -1; }
  return soldierPool.freeSlots.pop();
}
function allocWeaponSlot(){
  if(!soldierPool) buildSoldierPool();
  return soldierPool.freeWeapons.length ? soldierPool.freeWeapons.pop() : -1;
}
function allocPackSlot(){
  if(!soldierPool) buildSoldierPool();
  return soldierPool.freePacks.length ? soldierPool.freePacks.pop() : -1;
}

// Composes pivotTransform*partLocalOffset*marker.matrixWorld for a swinging leg/arm mesh,
// replicating what the old THREE.Group parenting (marker -> legPivot -> leg) did automatically.
function composeLimbWorldMatrix(marker, pivotX, pivotY, pivotZ, swingAngle, localY, SC){
  _pQ.setFromAxisAngle(_UNIT_X, swingAngle);
  _mPivot.compose(_pV.set(pivotX, pivotY, pivotZ), _pQ, _pS);
  _lQ.identity();
  _mLocal.compose(_lV.set(0, localY*SC, 0), _lQ, _lS.set(SC, SC, SC));
  _mPivot.multiply(_mLocal);
  return _mWorld.multiplyMatrices(marker.matrixWorld, _mPivot);
}

// Same idea for torso/head/weapon/pack, which (unlike legs/arms) attach straight to the
// marker with no swinging pivot in between.
function composeStaticWorldMatrix(marker, localX, localY, localZ, scaleX, scaleY, scaleZ, rotZ){
  if(rotZ) _lQ.setFromAxisAngle(_UNIT_Z, rotZ); else _lQ.identity();
  _mLocal.compose(_lV.set(localX, localY, localZ), _lQ, _lS.set(scaleX, scaleY, scaleZ));
  return _mWorld.multiplyMatrices(marker.matrixWorld, _mLocal);
}

export function buildHumanoidFigures(group, colorHex, offsets, opts){
  opts = opts || {};
  if(!soldierPool) buildSoldierPool();
  const pool = soldierPool;
  const SC = pool.SC;
  const clusterR = SC*1.1;
  const maxR = Math.max(1, ...offsets.map(o=>Math.hypot(o.dx,o.dy)));
  const factionColor = new THREE.Color(colorHex);
  const legH = SC*0.22, bodyH = SC*0.34, armH = SC*0.26;
  const hipY = legH, bodyY = legH + bodyH*0.5, shoulderY = bodyY + bodyH*0.5;
  const weaponLenRatio = opts.weapon==='longrifle' ? 0.62 : 0.42;
  return offsets.map(o=>{
    const x = (o.dx/maxR)*clusterR, z = (o.dy/maxR)*clusterR;
    const slot = allocSoldierSlot();
    const fig = {
      slot,
      legA: slot>=0 ? slot*2 : -1, legB: slot>=0 ? slot*2+1 : -1,
      armA: slot>=0 ? slot*2 : -1, armB: slot>=0 ? slot*2+1 : -1,
      weaponSlot: -1, packSlot: -1, weaponLenRatio,
      x, z, hipY, bodyY, shoulderY,
      _walkPhase: Math.random()*Math.PI*2, _walkAmp: 0, _swing: 0,
      alive: true,
    };
    if(slot>=0){
      pool.arms.setColorAt(fig.armA, factionColor);
      pool.arms.setColorAt(fig.armB, factionColor);
      pool.torsos.setColorAt(slot, factionColor);
      if(pool.arms.instanceColor) pool.arms.instanceColor.needsUpdate = true;
      if(pool.torsos.instanceColor) pool.torsos.instanceColor.needsUpdate = true;
    }
    if(opts.weapon) fig.weaponSlot = allocWeaponSlot();
    if(opts.pack) fig.packSlot = allocPackSlot();
    return fig;
  });
}

// Writes this marker's current pose (position/heading, already applied to `marker` by the
// caller, plus each figure's alive-state and walk-cycle swing) into the shared instance pools.
// Must run every frame for every unit with humanoid figures -- see syncUnitMarkers3d.
function flushSoldierInstances3d(marker){
  const figs = marker._soldierFigures;
  if(!figs || !figs.length || !soldierPool) return;
  marker.updateMatrixWorld(true);
  const pool = soldierPool;
  const SC = pool.SC;
  figs.forEach(fig=>{
    if(fig.slot<0) return;
    if(!fig.alive){ zeroSoldierFigureMatrices(fig); return; }
    const swing = fig._swing||0;
    pool.legs.setMatrixAt(fig.legA, composeLimbWorldMatrix(marker, fig.x-SC*0.05, fig.hipY, fig.z, swing, -0.11, SC));
    pool.legs.setMatrixAt(fig.legB, composeLimbWorldMatrix(marker, fig.x+SC*0.05, fig.hipY, fig.z, -swing, -0.11, SC));
    pool.arms.setMatrixAt(fig.armA, composeLimbWorldMatrix(marker, fig.x-SC*0.16, fig.shoulderY, fig.z, -swing, -0.13, SC));
    pool.arms.setMatrixAt(fig.armB, composeLimbWorldMatrix(marker, fig.x+SC*0.16, fig.shoulderY, fig.z, swing, -0.13, SC));
    pool.torsos.setMatrixAt(fig.slot, composeStaticWorldMatrix(marker, fig.x, fig.bodyY, fig.z, SC, SC, SC, 0));
    pool.heads.setMatrixAt(fig.slot, composeStaticWorldMatrix(marker, fig.x, fig.shoulderY+SC*0.05, fig.z, SC, SC, SC, 0));
    // Attached straight to the marker origin, not a swinging arm pivot, so it stays a calm,
    // readable silhouette instead of flailing around with the walk-cycle arm swing.
    if(fig.weaponSlot>=0) pool.weapons.setMatrixAt(fig.weaponSlot, composeStaticWorldMatrix(marker, fig.x+SC*0.15, fig.bodyY, fig.z+SC*0.09, SC, SC*fig.weaponLenRatio, SC, Math.PI/2.3));
    if(fig.packSlot>=0) pool.packs.setMatrixAt(fig.packSlot, composeStaticWorldMatrix(marker, fig.x, fig.bodyY, fig.z-SC*0.1, SC, SC, SC, 0));
  });
}

function zeroSoldierFigureMatrices(fig){
  if(!soldierPool || fig.slot<0) return;
  const pool = soldierPool;
  pool.legs.setMatrixAt(fig.legA, _ZERO_MATRIX);
  pool.legs.setMatrixAt(fig.legB, _ZERO_MATRIX);
  pool.arms.setMatrixAt(fig.armA, _ZERO_MATRIX);
  pool.arms.setMatrixAt(fig.armB, _ZERO_MATRIX);
  pool.torsos.setMatrixAt(fig.slot, _ZERO_MATRIX);
  pool.heads.setMatrixAt(fig.slot, _ZERO_MATRIX);
  if(fig.weaponSlot>=0) pool.weapons.setMatrixAt(fig.weaponSlot, _ZERO_MATRIX);
  if(fig.packSlot>=0) pool.packs.setMatrixAt(fig.packSlot, _ZERO_MATRIX);
}

// Called when a unit's marker is torn down (wave transition, target pruned/destroyed, stale-
// key cleanup) -- unlike hideMarker3d (which only zero-scales, keeping the slots reserved in
// case the same marker becomes visible again), this returns the slots to the free-list so a
// later unit can reuse them, which is what keeps the fixed-capacity pools from ever filling up
// across a long game with many waves of enemy infantry spawning under fresh target ids.
function freeSoldierFigureSlots(fig){
  zeroSoldierFigureMatrices(fig);
  if(!soldierPool) return;
  const pool = soldierPool;
  if(fig.slot>=0){ pool.freeSlots.push(fig.slot); fig.slot = fig.legA = fig.legB = fig.armA = fig.armB = -1; }
  if(fig.weaponSlot>=0){ pool.freeWeapons.push(fig.weaponSlot); fig.weaponSlot = -1; }
  if(fig.packSlot>=0){ pool.freePacks.push(fig.packSlot); fig.packSlot = -1; }
}

function flagSoldierPoolMatricesDirty(){
  if(!soldierPool) return;
  soldierPool.legs.instanceMatrix.needsUpdate = true;
  soldierPool.arms.instanceMatrix.needsUpdate = true;
  soldierPool.torsos.instanceMatrix.needsUpdate = true;
  soldierPool.heads.instanceMatrix.needsUpdate = true;
  soldierPool.weapons.instanceMatrix.needsUpdate = true;
  soldierPool.packs.instanceMatrix.needsUpdate = true;
}

export function makeMarkerMesh3d(shape, colorHex, formationOffsets){
  const group = new THREE.Group();
  const s = Math.max(0.6, (WORLD.scaleX+WORLD.scaleZ)/2*7.5) * mobileIconMult();
  const mat = color=>new THREE.MeshStandardMaterial({color, roughness:0.7, metalness:0.05});
  const add = (geometry, material, y=0, z=0)=>{
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, y, z);
    // per user request: casting shadows from every one of these small primitive-shape
    // markers (mortars, squads, antitanks, etc. -- ~200 individual draw calls in the shadow
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
    group._soldierFigures = buildHumanoidFigures(group, colorHex, offsets);
    addFlag(colorHex);
  } else if(shape==='scout'){
    // per user request: 斥候も小隊と同じ人型フィギュア(buildHumanoidFigures)にする一方、
    // 兵種が見分けられるよう小道具で差別化する -- 背嚢(偵察装備)のみで武器は目立たせない。
    const offsets = SQUAD_GRID_OFFSETS.slice(0, SCOUT_SQUAD_SIZE);
    group._soldierFigures = buildHumanoidFigures(group, colorHex, offsets, {pack:true});
    addFlag(colorHex);
  } else if(shape==='band'){
    // per user request: 音楽隊 -- 近接戦闘に秀でた本部警備専任の実戦部隊。小隊と同じ人型
    // フィギュアに、近接武器の小道具(weapon: 'longrifle'以外を渡すと短めの得物になる)を
    // 持たせて見分けられるようにする。
    const offsets = SQUAD_GRID_OFFSETS.slice(0, BAND_SQUAD_SIZE);
    group._soldierFigures = buildHumanoidFigures(group, colorHex, offsets, {weapon:'melee'});
    addFlag(colorHex);
  } else if(shape==='antitank'){
    // per user request: 狙撃部隊を置き換えた対戦車部隊 -- 戦車(tank)/対空(sam)と同じ装軌+
    // 箱型車体パターンを踏襲しつつ、前方へ斜めに据え付けたロケットランチャーの発射管で
    // 兵科を識別できるようにする。当初は軽車両らしく一回り小さく作っていたが、地図上で
    // シンボルが小さすぎるという指摘を受け、SAMとほぼ同等のサイズまで底上げした。
    addTrack(-s*0.55);
    addTrack(s*0.55);
    add(new THREE.BoxGeometry(s*1.15, s*0.28, s*1.15), mat(colorHex), s*0.16);
    add(new THREE.BoxGeometry(s*0.62, s*0.34, s*0.62), mat(0x39454d), s*0.44);
    const launcher = add(new THREE.CylinderGeometry(s*0.12, s*0.12, s*0.95, 8), mat(0x2c3436), s*0.58);
    launcher.rotation.z = -Math.PI*0.12;
    addFlag(colorHex);
  } else if(shape==='engineer'){
    add(new THREE.BoxGeometry(s*0.9, s*0.3, s*0.7), mat(colorHex), s*0.2);
    add(new THREE.CylinderGeometry(s*0.22, s*0.22, s*0.8, 8), mat(0x6b573f), s*0.7);
    addFlag(colorHex);
  } else if(shape==='medic'){
    // per user request: 衛生小隊 -- 工兵と同じ箱型車体パターンを踏襲しつつ、赤十字を模した
    // 十字マーカー(自軍/敵の色分けとは独立した固定の赤)で医療部隊であることを識別できる
    // ようにする。
    add(new THREE.BoxGeometry(s*0.85, s*0.3, s*0.65), mat(colorHex), s*0.2);
    const crossMat = mat(0xd23c3c);
    add(new THREE.BoxGeometry(s*0.54, s*0.08, s*0.16), crossMat, s*0.56);
    add(new THREE.BoxGeometry(s*0.16, s*0.08, s*0.54), crossMat, s*0.56);
    addFlag(colorHex);
  } else if(shape==='supply'){
    // per user request: 補給隊 -- 工兵/衛生小隊と同じ箱型車体パターンを踏襲しつつ、荷台に
    // 積んだ補給物資(木箱、自軍/敵の色分けとは独立した固定の茶色)を乗せて識別できるように
    // する。
    add(new THREE.BoxGeometry(s*0.9, s*0.3, s*0.7), mat(colorHex), s*0.2);
    const crateMat = mat(0x8a6a3d);
    add(new THREE.BoxGeometry(s*0.26, s*0.24, s*0.26), crateMat, s*0.47, -s*0.14);
    add(new THREE.BoxGeometry(s*0.26, s*0.24, s*0.26), crateMat, s*0.47, s*0.14);
    addFlag(colorHex);
  } else if(shape==='hq'){
    add(new THREE.BoxGeometry(s*1.2, s*0.8, s*1.2), mat(colorHex), s*0.4);
    add(new THREE.ConeGeometry(s*0.85, s*0.7, 4), mat(0x4b5961), s*1.15);
    addFlag(colorHex);
  } else if(shape==='fortress'){
    // per user request: 要塞 -- 占領可能な固定拠点。壁(box)より一回り大きい土台+本体+
    // 四隅の胸壁で「陣地」らしいシルエットにし、色は占領側(colorHexで既に自軍/敵/中立の
    // どれかに解決済み)で塗り分ける。
    add(new THREE.BoxGeometry(s*1.9, s*0.22, s*1.9), mat(0x4b4034), s*0.11);
    add(new THREE.BoxGeometry(s*1.5, s*0.9, s*1.5), mat(colorHex), s*0.57);
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>{
      add(new THREE.BoxGeometry(s*0.22, s*0.5, s*0.22), mat(colorHex)).position.set(sx*s*0.72, s*1.27, sz*s*0.72);
    });
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
  marker._soldierFigures.forEach((fig,i)=>{ fig.alive = !!(aliveFlags && aliveFlags[i]); });
}

export function updateSoldierWalkCycle(marker, moving, dtSeconds){
  if(!marker || !marker._soldierFigures) return;
  marker._soldierFigures.forEach(fig=>{
    if(!fig.alive) return;
    const targetAmp = moving ? 1 : 0;
    fig._walkAmp += (targetAmp-fig._walkAmp) * Math.min(1, dtSeconds*WALK_AMP_EASE);
    if(fig._walkAmp < 0.01){
      fig._walkAmp = 0;
      fig._swing = 0;
      return;
    }
    fig._walkPhase += dtSeconds*WALK_CYCLE_SPEED;
    fig._swing = Math.sin(fig._walkPhase) * WALK_SWING_MAX * fig._walkAmp;
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
  if(!m) return;
  m.visible = false;
  // per user request(instanced soldiers): unlike the marker's own THREE.Group, its soldier
  // figures no longer live inside it as real children -- m.visible=false alone wouldn't hide
  // them. Zero-scale their instances too, but keep the slots reserved (not freed) in case this
  // same marker becomes visible again (e.g. an enemy HQ target toggling !revealed).
  if(m._soldierFigures){
    m._soldierFigures.forEach(zeroSoldierFigureMatrices);
    flagSoldierPoolMatricesDirty();
  }
}

export function disposeMarker3d(key){
  const m = unitMarkers3d[key];
  if(!m) return;
  if(scene3d) scene3d.remove(m);
  if(m._soldierFigures){
    m._soldierFigures.forEach(freeSoldierFigureSlots);
    flagSoldierPoolMatricesDirty();
    m._soldierFigures = null;
  }
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
export let walkAnimDue = true;

export function walkDtSeconds(){
  const now = performance.now();
  if(MAP_VIEW.zoom < WALK_ANIM_DETAIL_ZOOM){
    walkAnimDue = false;
    if(lastWalkAnimAt===null) lastWalkAnimAt = now;
    return 0;
  }
  if(lastWalkAnimAt===null){ lastWalkAnimAt = now; walkAnimDue = true; return 0; }
  const elapsed = now-lastWalkAnimAt;
  if(elapsed < WALK_ANIM_MIN_INTERVAL_MS){
    walkAnimDue = false;
    return 0;
  }
  // capped so a long stall (tab backgrounded, a slow frame) can't jerk the swing forward
  const dt = Math.min(0.25, elapsed/1000);
  lastWalkAnimAt = now;
  walkAnimDue = true;
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
    if(shape==='tank' || shape==='antitank') updateTankHeading3d(unitMarkers3d[key], unit, p.x, p.y);
    if(shape==='heli') updateHeliHeading3d(unitMarkers3d[key], unit, p.x, p.y);
    if(shape==='infantry' || shape==='scout' || shape==='band'){
      updateSoldierFigures3d(unitMarkers3d[key], unit.soldiers.map(s=>s.alive));
      const moving = isVisuallyMoving(unit, p.x, p.y);
      if(walkAnimDue) updateSoldierWalkCycle(unitMarkers3d[key], moving, walkDt);
      updateSoldierHeading3d(unitMarkers3d[key], unit, p.x, p.y);
      flushSoldierInstances3d(unitMarkers3d[key]);
    }
  };
  state.mortars.forEach((m,i)=>friendlyUnit('mortar'+i, m, 'mortar', m.hp>0));
  state.tanks.forEach((tk,i)=>friendlyUnit('tank'+i, tk, 'tank', tk.hp>0));
  state.sams.forEach((sam,i)=>friendlyUnit('sam'+i, sam, 'sam', sam.hp>0));
  (state.helis||[]).forEach((heli,i)=>friendlyUnit('heli'+i, heli, 'heli', heli.hp>0));
  state.scouts.forEach((s,i)=>friendlyUnit('scout'+i, s, 'scout', unitAlive(s)));
  state.squads.forEach((sq,i)=>friendlyUnit('squad'+i, sq, 'infantry', unitAlive(sq)));
  state.bands.forEach((band,i)=>friendlyUnit('band'+i, band, 'band', unitAlive(band)));
  state.antitanks.forEach((at,i)=>friendlyUnit('antitank'+i, at, 'antitank', at.hp>0));
  state.engineers.forEach((en,i)=>friendlyUnit('engineer'+i, en, 'engineer', unitAlive(en)));
  state.medics.forEach((me,i)=>friendlyUnit('medic'+i, me, 'medic', unitAlive(me)));
  (state.supplies||[]).forEach((su,i)=>friendlyUnit('supply'+i, su, 'supply', unitAlive(su)));
  // per user request: 防壁(壁) -- 他の自軍ユニットと違い専用の2Dベクター描画に加えて、
  // 3Dミニマップ上でも障害物として視認できるよう箱形メッシュを配置する。
  state.walls.forEach(w=>{
    const key = 'wall'+w.id;
    seen[key] = true;
    place(key, w.x, w.y, 'box', w.hp>0 ? FRIENDLY_MARK_COLOR_3D : 0x5c2a25, w.hp>0);
  });
  // per user request: 要塞 -- 占領側で色分け(自軍=青、敵=赤、中立=タン)。壁と同様の
  // seen{}パターンでキー管理するが、wave毎に全て作り直される(壁と違い恒久物ではない)ので
  // 古いidの掃除はhideMarker3d任せで十分。
  (state.fortresses||[]).forEach(f=>{
    const key = 'fortress'+f.id;
    seen[key] = true;
    const color = f.owner==='friendly' ? FRIENDLY_MARK_COLOR_3D : f.owner==='enemy' ? TARGET_TYPE_COLOR.infantry : FORTRESS_NEUTRAL_COLOR_3D;
    place(key, f.x, f.y, 'fortress', color, true);
  });
  state.targets.forEach((t,i)=>{
    const key = 'target'+t.id;
    if(t.destroyed){ place(key, t.trueX, t.trueY, 'sphere', 0x5c2a25, false); return; }
    // per user request: the enemy HQ is the one target type that can still be !revealed (every
    // other type spawns already revealed -- see buildEnemyHqTarget/updateHqDetection in
    // combat.js) -- it must not be placed at all until then, not just recolored dim, or its
    // exact position on the 3D map would give it away regardless of color/label.
    if(!t.revealed){ place(key, 0, 0, 'sphere', 0, false); return; }
    const eLogical = estPos(t);
    const e = smoothVisualPos(t, eLogical.x, eLogical.y);
    const shape = t.type==='hq' ? 'hq' : t.type==='vehicle' ? 'tank' : t.type==='artillery' ? 'cylinder' : t.type==='aa' ? 'box' : t.type==='drone' ? 'diamond' : t.type==='heli' ? 'heli' : t.type==='infantry' ? 'infantry' : 'sphere';
    place(key, e.x, e.y, shape, TARGET_TYPE_COLOR[t.type]||0xc1453b, true, t.formationOffsets);
    if(shape==='heli') updateHeliHeading3d(unitMarkers3d[key], t, e.x, e.y);
    if(shape==='infantry' && t.troops){
      updateSoldierFigures3d(unitMarkers3d[key], t.troops.map(s=>s.alive));
      const moving = isVisuallyMoving(t, e.x, e.y);
      if(walkAnimDue) updateSoldierWalkCycle(unitMarkers3d[key], moving, walkDt);
      updateSoldierHeading3d(unitMarkers3d[key], t, e.x, e.y);
      flushSoldierInstances3d(unitMarkers3d[key]);
    }
  });

  // per user request(instanced soldiers): changed from hideMarker3d to disposeMarker3d --
  // a key that's vanished from every place() call this frame (not just this tick's `visible`
  // toggle, an actual gone-for-good key, e.g. a pre-wave-transition teardown this loop somehow
  // missed) has nothing left referencing it, so its soldier instance slots (if any) should be
  // freed back to the pool rather than held hidden-but-reserved forever.
  Object.keys(unitMarkers3d).forEach(key=>{
    if(!seen[key]) disposeMarker3d(key);
  });
  flagSoldierPoolMatricesDirty();
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
