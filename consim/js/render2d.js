// Split out of the former monolithic mortar_fdc_game.js.
import { computeDispersionAt, currentPlacementUnit, estPos, isObservedByScout, isSuppressed, smoothVisualPos, state, unitAlive, unitAliveCount } from './combat.js';
import { BAND_ENGAGE_RANGE, CANVAS_H, CANVAS_W, CONTOUR_LINES_CANVAS, ENEMY_MARK_COLOR, FEBA_LINE_COLOR, FEBA_LINE_WIDTH, FORTRESS_NEUTRAL_COLOR, FRIENDLY_MARK_COLOR, GRID_LINES, HQ_SUPPLY_ZONE_RADIUS_UNITS, ILLUM_BURST_HEIGHT, ILLUM_DURATION_TURNS, ILLUM_FALL_DURATION, ILLUM_RADIUS_UNITS, LABEL_TEXT_COLOR, MAP_DETAIL_EFFECT_ZOOM, MAP_DETAIL_LABEL_ZOOM, MAP_FULL_DETAIL_ZOOM, MAP_INITIAL_AZIMUTH, MAP_VIEW, METERS_PER_UNIT, MORTAR_MAINLINE_HALF_FOV, MORTAR_MAINLINE_RANGE_UNITS, MORTAR_MIN_RANGE_UNITS, MORTAR_RELOAD_MS, MUZZLE_STYLE, ORDER_ICON, HELI_MAX_RANGE_UNITS, SCOUT_MAX_RANGE_UNITS, SMOKE_DURATION_TURNS, SQUAD_ENGAGE_RANGE, TRENCH_LINE_COLOR, UNIT_AMMO_MAX, TRENCH_LINE_WIDTH, WEATHER_TYPES, WORLD, enemyInfantryIcon, infantryIcon, mortarIcon } from './constants.js';
import { isMultiSelected } from './input.js';
import { choppedLineSegments, febaLineSegments, isOnRoad } from './terrain.js';
import { project, projectAtWorldY, scaledIconH, threeReady } from './three.js';
import { bearingToXY, clamp } from './utils.js';
import { craters, currentShakeOffset, debrisParticles, enemyTracers, ensureWeatherParticles, flashes, killBanners, projectileArcWorldY, projectiles, ripples, setDebrisParticles, setKillBanners, setRipples, setShockwaves, setWreckSmokes, shockwaves, tracerWorldY, weatherParticles, wreckSmokes } from './vfx.js';
import { drawCallouts } from './voice.js';

// per user request: スマホプレイ時、地図上のラベル文字が全体的に小さいという指摘への対応 --
// three.js側のscaledIconH()/makeMarkerMesh3d()と同じ600pxブレークポイントでctx.fontの
// px数値部分だけを底上げする(既存のフォント文字列リテラルはそのまま、代入時にこの
// ヘルパーを通すだけで済む)。
const MOBILE_LABEL_BREAKPOINT = 600;
const MOBILE_LABEL_MULT = 1.2;
function mfont(fontStr){
  if((window.innerWidth||0) > MOBILE_LABEL_BREAKPOINT) return fontStr;
  return fontStr.replace(/(\d+(?:\.\d+)?)px/, (_, n) => `${Math.round(parseFloat(n)*MOBILE_LABEL_MULT)}px`);
}

export function mortarStatusIcon(mortar){
  if(mortar.reloadingUntil && performance.now() < mortar.reloadingUntil) return '⟳';
  if(mortar.order==='move') return mortar.pendingDest ? '➤' : '✦';
  if(mortar.pendingFire) return '●';
  if(mortar.order==='fire') return '◐';
  return '■';
}

export function drawUnitBase(ctx, size, dead){
  ctx.save();
  ctx.fillStyle = dead ? 'rgba(35,18,18,.88)' : 'rgba(8,18,24,.9)';
  ctx.strokeStyle = dead ? 'rgba(224,90,79,.9)' : 'rgba(160,205,232,.9)';
  ctx.lineWidth = 1.5;
  ctx.shadowColor = dead ? 'rgba(224,90,79,.45)' : 'rgba(80,180,255,.4)';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.ellipse(0, size*.2, size*.72, size*.28, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function drawUnitIcon(ctx, img, cx, cy, targetH, dead){
  ctx.save();
  ctx.translate(cx, cy);
  drawUnitBase(ctx, targetH, dead);
  ctx.restore();
  if(!img.complete || !img.naturalWidth) return;
  const w = targetH * (img.naturalWidth/img.naturalHeight);
  ctx.save();
  if(dead) ctx.filter = 'grayscale(1) brightness(0.5)';
  ctx.shadowColor = dead ? 'rgba(224,90,79,.4)' : 'rgba(70,170,255,.5)';
  ctx.shadowBlur = 7;
  ctx.drawImage(img, cx-w/2, cy-targetH/2, w, targetH);
  ctx.restore();
}

export function drawTankIcon(ctx, cx, cy, size, dead){
  const w = size*1.6, h = size*0.9;
  ctx.save();
  ctx.translate(cx, cy);
  drawUnitBase(ctx, size, dead);
  ctx.fillStyle = dead ? '#5c2a25' : FRIENDLY_MARK_COLOR;
  ctx.strokeStyle = dead ? '#3a1b18' : '#3d5a70';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if(ctx.roundRect) ctx.roundRect(-w/2, -h/2, w, h, 3);
  else ctx.rect(-w/2, -h/2, w, h);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -h*0.1, size*0.32, 0, Math.PI*2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -h*0.1);
  ctx.lineTo(w*0.55, -h*0.1);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
}

export function drawSamIcon(ctx, cx, cy, size, dead){
  const w = size*1.5, h = size*0.7;
  ctx.save();
  ctx.translate(cx, cy);
  drawUnitBase(ctx, size, dead);
  const col = dead ? '#5c2a25' : FRIENDLY_MARK_COLOR;
  ctx.fillStyle = col;
  ctx.strokeStyle = dead ? '#3a1b18' : '#3d5a70';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if(ctx.roundRect) ctx.roundRect(-w/2, -h*0.4, w, h, 3);
  else ctx.rect(-w/2, -h*0.4, w, h);
  ctx.fill();
  ctx.stroke();
  const railTipX = w*0.3, railTipY = -size*1.05;
  ctx.beginPath();
  ctx.moveTo(-w*0.15, -h*0.3);
  ctx.lineTo(railTipX, railTipY);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(railTipX, railTipY, size*0.14, 0, Math.PI*2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function drawEngineerIcon(ctx, cx, cy, size, dead){
  ctx.save();
  ctx.translate(cx, cy);
  drawUnitBase(ctx, size, dead);
  const col = dead ? '#5c2a25' : FRIENDLY_MARK_COLOR;
  ctx.fillStyle = col;
  ctx.strokeStyle = dead ? '#3a1b18' : '#3d5a70';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, size*0.42, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = col;
  ctx.beginPath();
  ctx.moveTo(-size*0.4, size*0.4); ctx.lineTo(size*0.4, size*0.08);
  ctx.moveTo(-size*0.4, size*0.08); ctx.lineTo(size*0.4, size*0.4);
  ctx.stroke();
  ctx.restore();
}

export function drawMedicIcon(ctx, cx, cy, size, dead){
  ctx.save();
  ctx.translate(cx, cy);
  drawUnitBase(ctx, size, dead);
  ctx.fillStyle = dead ? '#5c2a25' : '#d23c3c';
  ctx.beginPath();
  ctx.rect(-size*0.09, -size*0.32, size*0.18, size*0.64);
  ctx.rect(-size*0.32, -size*0.09, size*0.64, size*0.18);
  ctx.fill();
  ctx.restore();
}

export function drawSupplyIcon(ctx, cx, cy, size, dead){
  ctx.save();
  ctx.translate(cx, cy);
  drawUnitBase(ctx, size, dead);
  const col = dead ? '#5c2a25' : '#c9975a';
  ctx.fillStyle = col;
  ctx.strokeStyle = dead ? '#3a1b18' : '#7a5a30';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(-size*0.3, -size*0.24, size*0.6, size*0.48);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-size*0.3, 0); ctx.lineTo(size*0.3, 0);
  ctx.moveTo(0, -size*0.24); ctx.lineTo(0, size*0.24);
  ctx.stroke();
  ctx.restore();
}

export function drawWallShape(ctx, cx, cy, dead){
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = dead ? 'rgba(92,42,37,0.5)' : 'rgba(111,155,191,0.45)';
  ctx.strokeStyle = dead ? '#5c2a25' : FRIENDLY_MARK_COLOR;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-18,10); ctx.lineTo(-13,-10); ctx.lineTo(13,-10); ctx.lineTo(18,10); ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// per user request: 要塞 -- 壁より一回り大きい八角形の陣地シルエットに、占領側の色を塗る
// (自軍=青/敵=赤/中立=タン)。中立は無人のグレーがかった輪郭で「まだ誰のものでもない」と
// 一目でわかるようにする。
export function drawFortressShape(ctx, cx, cy, owner){
  const color = owner==='friendly' ? FRIENDLY_MARK_COLOR : owner==='enemy' ? ENEMY_MARK_COLOR : FORTRESS_NEUTRAL_COLOR;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = owner ? color+'73' : 'rgba(156,148,120,0.28)';
  ctx.strokeStyle = color;
  ctx.lineWidth = owner ? 2.5 : 2;
  if(!owner) ctx.setLineDash([4,3]);
  ctx.beginPath();
  const r = 24;
  for(let i=0;i<8;i++){
    const a = Math.PI/8 + i*Math.PI/4;
    const px = Math.sin(a)*r, py = -Math.cos(a)*r*0.68;
    if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

export function drawAttritionBar(ctx, x, y, frac){
  const w = 4, h = 26;
  const bx = x - w/2, by = y - h/2;
  frac = clamp(frac, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(bx-1, by-1, w+2, h+2);
  ctx.fillStyle = '#232a18';
  ctx.fillRect(bx, by, w, h);
  const filledH = h*frac;
  ctx.fillStyle = frac>0.5 ? '#7fc76b' : frac>0.25 ? '#e0b84a' : '#d9524a';
  ctx.fillRect(bx, by+(h-filledH), w, filledH);
}

export function drawSelectionRing(ctx, x, y, active, r){
  if(!active) return;
  const pulse = 1.5 + Math.sin(performance.now()*0.006)*1.5;
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(217,164,65,0.9)';
  ctx.lineWidth = 2;
  ctx.arc(x, y, (r||19)+pulse, 0, Math.PI*2);
  ctx.stroke();
}

// per user request: friendly units packed close together used to each draw their own label,
// overlapping into an unreadable block of text. Units whose screen anchors fall within this
// many px of each other are now treated as one cluster by drawPendingFriendlyLabels() below.
const FRIENDLY_LABEL_CLUSTER_PX = 60;

// per user request: units within a crowded cluster collapse into one "by type" summary line
// instead of each drawing their own label -- EXCEPT any unit that's currently selected (via
// commandBox or multi-select), which still shows its own full label. Tapping/selecting a unit
// inside a cluster is how it "expands" back out of the summary.
export function drawPendingFriendlyLabels(ctx, labels){
  if(!labels.length) return;
  const n = labels.length;
  const parent = Array.from({length:n}, (_,i)=>i);
  const find = i => { while(parent[i]!==i){ parent[i]=parent[parent[i]]; i=parent[i]; } return i; };
  for(let i=0;i<n;i++){
    for(let j=i+1;j<n;j++){
      if(Math.hypot(labels[i].x-labels[j].x, labels[i].y-labels[j].y) < FRIENDLY_LABEL_CLUSTER_PX){
        const ri = find(i), rj = find(j);
        if(ri!==rj) parent[ri] = rj;
      }
    }
  }
  const groups = new Map();
  for(let i=0;i<n;i++){
    const root = find(i);
    if(!groups.has(root)) groups.set(root, []);
    groups.get(root).push(labels[i]);
  }
  groups.forEach(group=>{
    const drawFull = g=>{
      g.lines.forEach(line=>{
        ctx.fillStyle = line.color || LABEL_TEXT_COLOR;
        ctx.font = mfont(line.font);
        ctx.textAlign = 'center';
        ctx.fillText(line.text, g.x, g.y+line.dy);
      });
    };
    if(group.length===1){ drawFull(group[0]); return; }
    const selected = group.filter(g=>g.selected);
    const rest = group.filter(g=>!g.selected);
    selected.forEach(drawFull);
    if(!rest.length) return;
    const counts = new Map();
    rest.forEach(g=>{ counts.set(g.kind, (counts.get(g.kind)||0)+1); });
    const summary = Array.from(counts.entries()).map(([kind,count])=>`${kind}x${count}`).join(' ');
    const cx = rest.reduce((s,g)=>s+g.x,0)/rest.length;
    const cy = rest.reduce((s,g)=>s+g.y,0)/rest.length;
    ctx.fillStyle = 'rgba(217,164,65,0.95)';
    ctx.font = mfont('bold 13px "JetBrains Mono"');
    ctx.textAlign = 'center';
    ctx.fillText(summary, cx, cy+38);
  });
}

export function drawMinimap(){
  const cv = document.getElementById('minimap');
  if(!cv || !state) return;
  // per user request: the minimap is now a fixed 1:1 square regardless of screen size/rotation
  // (previously it matched the main map's aspect ratio, rotated or not) -- since a square box
  // generally can't match the world's own aspect ratio exactly, x/y are scaled independently to
  // fill it, same as the very first version of this function did.
  //
  // On narrow/mobile screens the main 3D camera starts rotated 90° (see MAP_INITIAL_AZIMUTH) so
  // the enemy side reads as "up" on a portrait screen; rotate the minimap's drawing to match.
  const az = MAP_INITIAL_AZIMUTH, cosA = Math.cos(az), sinA = Math.sin(az);
  const rotated = az !== 0;
  const targetSize = 130;
  if(cv.width!==targetSize || cv.height!==targetSize){ cv.width = targetSize; cv.height = targetSize; }
  const ctx = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  ctx.clearRect(0,0,w,h);
  const scaleX = rotated ? w/CANVAS_H : w/CANVAS_W;
  const scaleY = rotated ? h/CANVAS_W : h/CANVAS_H;
  const proj = (wx, wy) => {
    const dx = wx-CANVAS_W/2, dy = wy-CANVAS_H/2;
    const rx = dx*cosA - dy*sinA, ry = dx*sinA + dy*cosA;
    return { x: w/2 + rx*scaleX, y: h/2 + ry*scaleY };
  };
  (state.roads||[]).forEach((road, roadIdx)=>{
    const kind = (state.roadKinds||[])[roadIdx] || 'main';
    const baseColor = kind==='dirt' ? 'rgba(150,110,70,0.8)' : kind==='branch' ? 'rgba(145,145,120,0.85)' : 'rgba(185,181,155,0.9)';
    const lineW = kind==='dirt' ? 1 : 1.5;
    // per user request(地雷の存在を分かりやすく): 斥候の観測圏内(既存のisObservedByScout、
    // 迫撃砲の観測補正/地雷回避と同じ判定)にある区間は、地雷を敷設されない安全な道として
    // 琥珀色で塗り分ける。位置そのものは明かさず、「守れている範囲」だけを示す。
    for(let i=1;i<road.length;i++){
      const a = road[i-1], b = road[i];
      const safe = isObservedByScout(a.x, a.y) || isObservedByScout(b.x, b.y);
      const pa = proj(a.x, a.y), pb = proj(b.x, b.y);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.strokeStyle = safe ? 'rgba(224,184,74,0.95)' : baseColor;
      ctx.lineWidth = safe ? lineW+0.5 : lineW;
      ctx.stroke();
    }
  });

  const friendlyPts = [];
  if(state.hq && state.hq.hp>0) friendlyPts.push([state.hq.x, state.hq.y]);
  state.mortars.forEach(m=>{ if(m.hp>0) friendlyPts.push([m.x, m.y]); });
  state.tanks.forEach(tk=>{ if(tk.hp>0) friendlyPts.push([tk.x, tk.y]); });
  state.sams.forEach(sam=>{ if(sam.hp>0) friendlyPts.push([sam.x, sam.y]); });
  state.scouts.forEach(s=>{ if(unitAlive(s)) friendlyPts.push([s.x, s.y]); });
  (state.helis||[]).forEach(h=>{ if(h.hp>0) friendlyPts.push([h.x, h.y]); });
  state.squads.forEach(sq=>{ if(sq.soldiers.some(s=>s.alive)) friendlyPts.push([sq.x, sq.y]); });
  state.antitanks.forEach(at=>{ if(at.hp>0) friendlyPts.push([at.x, at.y]); });
  ctx.fillStyle = FRIENDLY_MARK_COLOR;
  friendlyPts.forEach(([x,y])=>{
    const pt = proj(x,y);
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 1.6, 0, Math.PI*2);
    ctx.fill();
  });

  ctx.fillStyle = ENEMY_MARK_COLOR;
  state.targets.forEach(t=>{
    // per user request: the enemy HQ stays hidden (including on the minimap) until revealed --
    // see the matching fix in the main 3D/2D target-drawing loops above/in three.js.
    if(t.destroyed || !t.revealed) return;
    const e = estPos(t);
    const pt = proj(e.x, e.y);
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 1.6, 0, Math.PI*2);
    ctx.fill();
  });

  // 要塞 -- 占領を争う固定目標なので、ドット表示のユニットと区別できるよう小さい四角形で
  // 描く(占領側で色分け、無人はタン系)。
  (state.fortresses||[]).forEach(f=>{
    const pt = proj(f.x, f.y);
    ctx.fillStyle = f.owner==='friendly' ? FRIENDLY_MARK_COLOR : f.owner==='enemy' ? ENEMY_MARK_COLOR : FORTRESS_NEUTRAL_COLOR;
    ctx.fillRect(pt.x-2.2, pt.y-2.2, 4.4, 4.4);
  });

  // combat hotspots -- any still-live flash (impact/hit effect) reads as "fighting is
  // happening here right now", pulsing/fading exactly in step with the flash it mirrors.
  const now = performance.now();
  flashes.forEach(f=>{
    const age = now-f.born;
    if(age>f.life) return;
    const frac = 1-(age/f.life);
    const pt = proj(f.x, f.y);
    ctx.beginPath();
    ctx.fillStyle = `rgba(240,113,95,${(0.25+0.55*frac).toFixed(2)})`;
    ctx.arc(pt.x, pt.y, (f.big?4.5:3)*(0.6+0.6*frac), 0, Math.PI*2);
    ctx.fill();
  });

  // rough current-viewport rectangle, so the minimap also shows where the main camera is
  // currently looking, not just where units/combat are.
  const viewW = clamp(w/MAP_VIEW.zoom, 8, w);
  const viewH = clamp(h/MAP_VIEW.zoom, 6, h);
  const viewCenter = proj(MAP_VIEW.cx, MAP_VIEW.cy);
  ctx.strokeStyle = 'rgba(217,164,65,0.8)';
  ctx.lineWidth = 1;
  ctx.strokeRect(viewCenter.x-viewW/2, viewCenter.y-viewH/2, viewW, viewH);
}

export function drawBoard(){
  const cv = document.getElementById('board');
  const ctx = cv.getContext('2d');
  ctx.clearRect(0,0,cv.width,cv.height);
  // screen shake (see triggerShake(), fired by spawnDestructionEffect) -- a plain draw-time
  // offset around the whole board, restored at the very end of this function.
  ctx.save();
  const shakeOff = currentShakeOffset();
  ctx.translate(shakeOff.x, shakeOff.y);

  // per user request: weather tint (night/rain/fog, see WEATHER_TYPES) used to be painted
  // near the end of this function, on top of every unit icon/label/HP-bar already drawn --
  // at night that made unit symbols themselves hard to read, not just the background, since
  // the flat semi-transparent rect covered the whole canvas regardless of what was already
  // on it. Painted first instead, everything drawn afterward (grid/contours, unit icons,
  // labels, HP bars, tracers) composites cleanly on top at full brightness, while the map
  // background still reads as dim/tinted through any pixel nothing else covers.
  const weatherTint = state.weather && WEATHER_TYPES[state.weather].tint;
  if(weatherTint){
    ctx.fillStyle = weatherTint;
    ctx.fillRect(0,0,cv.width,cv.height);
  }

  const nowWander = performance.now();
  const showDetailLabels = MAP_VIEW.zoom >= MAP_DETAIL_LABEL_ZOOM;
  const showFullDetail = MAP_VIEW.zoom >= MAP_FULL_DETAIL_ZOOM;
  const showDetailEffects = MAP_VIEW.zoom >= MAP_DETAIL_EFFECT_ZOOM;

  // per user request: when several friendly units end up close together on screen, their
  // labels used to all draw individually and overlap into an unreadable block of text. Each
  // friendly unit's label is now queued here (instead of drawn immediately) and resolved by
  // drawPendingFriendlyLabels() near the end of this function: units within
  // LABEL_CLUSTER_PX of each other collapse into one "by type" summary line UNLESS one of them
  // is currently selected, in which case that unit's own full label still shows (selecting a
  // unit inside a cluster is the way to "expand" it back to a full label).
  const pendingFriendlyLabels = [];
  const queueFriendlyLabel = (x, y, lines, selected, kind)=> pendingFriendlyLabels.push({x, y, lines, selected, kind});
  // per user request(道路の効果を分かりやすく): オフロード減速が免除される道路上にいる間、
  // ユニットのラベルに小さな印を付ける(isOnRoad、terrain.js -- terrainAwareStepの
  // オフロード減速判定と同じ基準)。ワールド座標(unit.x/y)を渡す。
  const roadTag = (wx, wy) => isOnRoad(wx, wy) ? ' 🛣️' : '';

  // per user request: roads used to be drawn here as a 2D overlay pass, but this whole `#board`
  // canvas sits compositely ABOVE the 3D `#three` WebGL canvas -- so a road always rendered on
  // top of every unit regardless of actual depth, which read as a bug. Roads are now real
  // ground-following ribbon meshes built directly into the 3D scene (see buildRoadMeshes3d() in
  // three.js, called from regenerateTerrain()), so the normal depth buffer sorts them against
  // unit meshes correctly. state.roads/state.roadKinds are unchanged and still drive pathfinding
  // (see terrain.js) and the minimap's road drawing -- only this on-map visual pass is gone.

  // per user request: a terrain-conforming 100m/1km coordinate grid (see
  // buildGridLineSegments()), drawn the same way as the contour lines below but as its own
  // base layer underneath them -- minor (100m) lines very faint so they read as a map's grid
  // squares rather than clutter, major (1km) lines a touch more visible.
  // per user request: uses the per-wave cached seg.h1/h2 (see cacheGroundLineHeights() in
  // three.js) via projectAtWorldY() instead of project(), which would otherwise re-run the
  // procedural elevation noise for both endpoints of every segment on every single frame --
  // by far the most expensive part of drawing this grid. Segments built fresh each call (the
  // FEBA line below, whose x position moves every step) have no cached height, so fall back
  // to project() for those -- there are few enough of them that it doesn't matter.
  const strokeGridBucket = (segs, color, width)=>{
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    segs.forEach(seg=>{
      const p0 = seg.h1!==undefined ? projectAtWorldY(seg.x1, seg.y1, seg.h1) : project(seg.x1, seg.y1);
      const p1 = seg.h2!==undefined ? projectAtWorldY(seg.x2, seg.y2, seg.h2) : project(seg.x2, seg.y2);
      if(!p0.visible || !p1.visible) return;
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
    });
    ctx.stroke();
  };
  strokeGridBucket(GRID_LINES.minor, 'rgba(210,225,235,0.07)', 1);
  strokeGridBucket(GRID_LINES.major, 'rgba(210,225,235,0.18)', 1);

  // per user request: topographic-map-style contour lines (see buildContourLines()), drawn
  // the same way roads were above -- endpoints whose height was cached per-wave (see
  // cacheGroundLineHeights() in three.js) use projectAtWorldY() directly instead of
  // re-deriving it from project()'s own elevation lookup every frame; segments whose
  // endpoints fall off-screen just aren't drawn rather than being connected through.
  if(CONTOUR_LINES_CANVAS.length){
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(72,50,28,0.36)';
    ctx.lineWidth = 3;
    CONTOUR_LINES_CANVAS.forEach(seg=>{
      const p0 = seg.h1!==undefined ? projectAtWorldY(seg.x1, seg.y1, seg.h1) : project(seg.x1, seg.y1);
      const p1 = seg.h2!==undefined ? projectAtWorldY(seg.x2, seg.y2, seg.h2) : project(seg.x2, seg.y2);
      if(!p0.visible || !p1.visible) return;
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
    });
    ctx.stroke();
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(203,157,86,0.47)';
    ctx.lineWidth = 1;
    CONTOUR_LINES_CANVAS.forEach(seg=>{
      const p0 = seg.h1!==undefined ? projectAtWorldY(seg.x1, seg.y1, seg.h1) : project(seg.x1, seg.y1);
      const p1 = seg.h2!==undefined ? projectAtWorldY(seg.x2, seg.y2, seg.h2) : project(seg.x2, seg.y2);
      if(!p0.visible || !p1.visible) return;
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
    });
    ctx.stroke();
  }

  // Subtle operational map frame and 1km grid labels give the view a finished commercial
  // wargame-map feel without adding new controls.
  ctx.save();
  ctx.fillStyle = 'rgba(232,227,206,0.44)';
  ctx.font = mfont('bold 10px "JetBrains Mono"');
  ctx.textAlign = 'center';
  for(let x=0; x<=CANVAS_W+0.001; x+=1000/METERS_PER_UNIT){
    const p = project(x, 18);
    if(p.visible) ctx.fillText(String(Math.round(x*WORLD.scaleX/1000)).padStart(2,'0'), p.x, p.y);
  }
  ctx.textAlign = 'left';
  for(let y=0; y<=CANVAS_H+0.001; y+=1000/METERS_PER_UNIT){
    const p = project(18, y);
    if(p.visible) ctx.fillText(String(Math.round(y*WORLD.scaleZ/1000)).padStart(2,'0'), p.x, p.y);
  }
  ctx.restore();

  // per user request: FEBA (主戦闘地域前縁) line -- the X that the "前進"/"後退" standing
  // orders advance to/fall back to, now tracking our infantry's own frontmost position
  // automatically (computeFebaX(), recomputed every simulationStep) instead of being
  // player-draggable. Drawn thick and blue so it reads clearly against the terrain/units.
  strokeGridBucket(febaLineSegments(state.febaX), FEBA_LINE_COLOR, FEBA_LINE_WIDTH);

  const movingUnits = [
    {unit:state.hq, label:'指揮所'},
    ...state.mortars.map((unit,i)=>({unit, label:`迫撃砲${i+1}`})),
    ...state.scouts.map((unit,i)=>({unit, label:`斥候${i+1}`})),
    ...state.squads.map((unit,i)=>({unit, label:`第${i+1}小隊`})),
    ...state.antitanks.map((unit,i)=>({unit, label:`対戦車${i+1}`})),
    ...state.tanks.map((unit,i)=>({unit, label:`戦車${i+1}`})),
    ...state.sams.map((unit,i)=>({unit, label:`対空${i+1}`})),
    ...state.engineers.map((unit,i)=>({unit, label:`工兵${i+1}`})),
    ...state.medics.map((unit,i)=>({unit, label:`衛生${i+1}`})),
    ...state.bands.map((unit,i)=>({unit, label:'音楽隊'})),
    ...(state.supplies||[]).map((unit,i)=>({unit, label:`補給${i+1}`})),
  ];
  movingUnits.forEach(({unit, label})=>{
    if(!unit || !unit.pendingDest) return;
    const from = project(unit.x, unit.y);
    const to = project(unit.pendingDest.x, unit.pendingDest.y);
    if(!from.visible || !to.visible) return;
    ctx.save();
    ctx.setLineDash([7,5]);
    ctx.strokeStyle = 'rgba(105,205,240,0.78)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(190,235,255,0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(to.x, to.y, 9, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = 'rgba(190,235,255,0.95)';
    ctx.font = mfont('bold 11px "JetBrains Mono"');
    ctx.textAlign = 'center';
    ctx.fillText(label, to.x, to.y-13);
    ctx.restore();
  });

  if(showDetailEffects){
    craters.forEach(crater=>{
      const p = project(crater.x, crater.y);
      if(!p.visible) return;
      const r = Math.max(3, crater.radius*(MAP_VIEW.zoom||1)*0.12);
      ctx.save();
      ctx.fillStyle = 'rgba(28,22,16,0.55)';
      ctx.strokeStyle = 'rgba(104,76,49,0.65)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y+2, r, Math.max(2, r*0.42), 0, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    });
  }

  // HQ marker (指揮所) ― per user request: now movable (see setUnitMoveDest/applyHqMovement),
  // so it uses smoothVisualPos like every other mobile unit instead of a bare project(hq.x,hq.y).
  {
    const hq = state.hq;
    const hqAlive = hq.hp>0;
    const hqCol = hqAlive ? FRIENDLY_MARK_COLOR : '#5c2a25';
    const hqVisL = smoothVisualPos(hq, hq.x, hq.y);
    const hqP = project(hqVisL.x, hqVisL.y);
    ctx.save();
    ctx.translate(hqP.x, hqP.y);
    ctx.fillStyle = hqCol;
    ctx.fillRect(-11,-6,22,16);
    ctx.beginPath();
    ctx.moveTo(0,-6); ctx.lineTo(0,-22);
    ctx.strokeStyle = hqCol; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0,-22); ctx.lineTo(14,-17); ctx.lineTo(0,-12); ctx.closePath();
    ctx.fillStyle = hqAlive ? FRIENDLY_MARK_COLOR : '#5c2a25';
    ctx.fill();
    if(showDetailLabels){
      const hqLines = [{text: (hqAlive?'指揮所':'指揮所(壊滅)')+(hqAlive?roadTag(hq.x,hq.y):''), dy:34, font:'bold 15px "JetBrains Mono"'}];
      if(hqAlive && hq.pendingDest) hqLines.push({text:'[移転中]', dy:50, font:'bold 13px "JetBrains Mono"'});
      queueFriendlyLabel(hqP.x, hqP.y, hqLines, state.commandBox && state.commandBox.kind==='hq', '指揮所');
    }
    ctx.restore();

    if(showDetailLabels && hqAlive){
      drawAttritionBar(ctx, hqP.x+20, hqP.y-6, hq.hp/hq.maxHp);
    }
  }

  // mortar mainline (主線方位角) fans ― pale-yellow reference sector out to
  // MORTAR_MAINLINE_RANGE_UNITS, drawn before the markers so they sit underneath. Purely a
  // visual reference (see armMortarMainlineOrder) -- it doesn't affect targeting or fire.
  // per user request: restored -- this is not the primitive that was meant to go (that was
  // the 3D minimap's leftover box/cone/etc. meshes, see syncUnitMarkers3d).
  state.mortars.forEach(mortar=>{
    if(mortar.hp<=0 || mortar.mainlineAngle===null || mortar.mainlineAngle===undefined) return;
    const mVisL = smoothVisualPos(mortar, mortar.x, mortar.y);
    const originP = project(mVisL.x, mVisL.y);
    const steps = 24;
    ctx.beginPath();
    ctx.moveTo(originP.x, originP.y);
    for(let i=0;i<=steps;i++){
      const ang = mortar.mainlineAngle - MORTAR_MAINLINE_HALF_FOV + (MORTAR_MAINLINE_HALF_FOV*2)*(i/steps);
      const pL = bearingToXY(ang, MORTAR_MAINLINE_RANGE_UNITS, mVisL.x, mVisL.y);
      const p = project(pL.x, pL.y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(232,210,58,0.047)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(232,210,58,0.167)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // 擬陣地 (decoy positions) -- dashed diamond outline in the friendly color, plus a vertical
  // attrition bar. Selectable (see handleCanvasClick) to direct mortar fire at its exact,
  // known coordinates.
  state.decoys.forEach((d,idx)=>{
    if(d.destroyed) return;
    const dp = project(d.x, d.y);
    ctx.save();
    ctx.translate(dp.x, dp.y);
    ctx.beginPath();
    ctx.setLineDash([3,2]);
    ctx.strokeStyle = FRIENDLY_MARK_COLOR;
    ctx.lineWidth = 2;
    ctx.moveTo(0,-10); ctx.lineTo(9,0); ctx.lineTo(0,10); ctx.lineTo(-9,0); ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    drawSelectionRing(ctx, 0, 0, state.decoyCommandBox===idx, 16);
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.font = mfont('12px "JetBrains Mono"');
    ctx.textAlign = 'center';
    ctx.fillText(`擬陣地${idx+1}`, 0, 24);
    ctx.restore();
    drawAttritionBar(ctx, dp.x+16, dp.y, d.hp/d.maxHp);
  });

  // mortar markers (自軍, left side)
  state.mortars.forEach((mortar, mIdx)=>{
    const mVisL = smoothVisualPos(mortar, mortar.x, mortar.y);
    const mVis = project(mVisL.x, mVisL.y);
    const mAlive = mortar.hp>0;
    // per user request: minimum effective range dead zone (see MORTAR_MIN_RANGE_UNITS) drawn
    // as a true world-space circle -- same ground-plane-projection + anisotropy correction as
    // the scout observation cone below, NOT a fixed screen-space arc (see that block's comment
    // for why a screen-space arc would misrepresent an actual world-space distance under a
    // tilted camera).
    if(mAlive){
      const aniso = (WORLD.scaleZ>0.0001) ? (WORLD.scaleX/WORLD.scaleZ) : 1;
      const steps = 24;
      ctx.beginPath();
      for(let i=0;i<=steps;i++){
        const rad = (i/steps)*Math.PI*2;
        const pL = {
          x: mVisL.x + MORTAR_MIN_RANGE_UNITS*Math.sin(rad),
          y: mVisL.y - MORTAR_MIN_RANGE_UNITS*aniso*Math.cos(rad),
        };
        const p = project(pL.x, pL.y);
        if(i===0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(217,80,60,0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3,3]);
      ctx.stroke();
      ctx.setLineDash([]);
      // per user request: mortar max range fixed at 6km -- enforced in setPendingFireAt/
      // assignMortarFire/applySmartOrder (all reject a shot beyond
      // MORTAR_MAX_RANGE_UNITS). No matching outer ring drawn here: at 6km radius it would
      // cover nearly the entire map width and, drawn per mortar, add real per-frame cost for
      // little practical benefit over the existing "target too far" rejection message.
    }
    ctx.save();
    ctx.translate(mVis.x,mVis.y);
    // per user request: custom mortar icon image (our side only) in place of the old triangle
    drawUnitIcon(ctx, mortarIcon, 0, 0, scaledIconH(22), !mAlive);
    drawSelectionRing(ctx, 0, 0, state.commandBox && state.commandBox.kind==='mortar' && state.commandBox.idx===mIdx);
    // shoot-and-scoot: a pulsing red ring while a counter-battery strike is inbound, so the
    // threat reads clearly on the map itself and not just in the mortar's own panel
    if(mAlive && mortar.cbWarnTurns!==null && mortar.cbWarnTurns!==undefined){
      const pulse = 3 + Math.sin(performance.now()*0.008)*3;
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(217,80,60,0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4,3]);
      ctx.arc(0, 0, 20+pulse, 0, Math.PI*2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if(mAlive && mortar.reloadingUntil && performance.now() < mortar.reloadingUntil){
      const reloadLeft = clamp((mortar.reloadingUntil-performance.now())/MORTAR_RELOAD_MS, 0, 1);
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(232,210,58,0.9)';
      ctx.lineWidth = 2;
      ctx.arc(0, 0, 16, -Math.PI/2, -Math.PI/2 + Math.PI*2*(1-reloadLeft));
      ctx.stroke();
    }
    if(showDetailLabels) queueFriendlyLabel(mVis.x, mVis.y, [{text: (mAlive?`迫撃砲${mortar.id+1} ${mortarStatusIcon(mortar)}`:`迫撃砲${mortar.id+1}(戦闘不能)`)+(mAlive?roadTag(mortar.x,mortar.y):''), dy:44, font:'15px "JetBrains Mono"'}],
      state.commandBox && state.commandBox.kind==='mortar' && state.commandBox.idx===mIdx, '迫撃砲');
    ctx.restore();

    if(showDetailLabels && mAlive){
      drawAttritionBar(ctx, mVis.x+18, mVis.y-2, mortar.hp/mortar.maxHp);
    }
  });

  // scout/heli sensor-range radius, all-around ― drawn before the markers so it sits
  // underneath. Purely a reference indicator now: detection itself (and the line-of-sight
  // gating it used to have) was removed per user request -- every unit is always visible
  // regardless of range, so this circle no longer affects what you can see or engage.
  //
  // drawn as a ground-plane circle (projected through the real 3D camera per point), NOT as a
  // screen-space arc -- a screen-space arc kept its apparent size constant, but under a
  // near-horizontal camera it pointed toward the horizon (i.e. up into the sky on screen)
  // instead of laying along the ground, since "far along the ground" and "toward the vanishing
  // point" become nearly the same screen direction at a grazing viewing angle. A real
  // ground-plane circle can never point into the sky.
  //
  // bearingToXY's sin/cos assumed canvas-unit X and Y cover equal real-world distances, which
  // stopped being true once WORLD.scaleX/scaleZ became independent per-axis (see
  // canvasUnitToWorldXZ) -- on any map whose real terrain isn't exactly canvas-aspect-shaped,
  // that made a canvas-space "circle" project as a real-world ELLIPSE, reaching a different
  // real distance north/south than east/west even before the camera saw it. Scaling the
  // north/south (Y) component by scaleX/scaleZ below cancels that out, so this is a true circle
  // in real-world meters. The remaining direction-dependent foreshortening once the tilted
  // camera renders that true circle is normal, correct 3D perspective (the same reason distant
  // objects look smaller) -- not something to eliminate.
  const drawGroundDetectionCircle = (centerL, radius, color, fill)=>{
    const steps = 48;
    const aniso = (WORLD.scaleZ>0.0001) ? (WORLD.scaleX/WORLD.scaleZ) : 1;
    const boundary = [];
    for(let i=0;i<=steps;i++){
      const ang = 360*(i/steps);
      const rad = ang*Math.PI/180;
      const pL = {
        x: centerL.x + radius*Math.sin(rad),
        y: centerL.y - radius*aniso*Math.cos(rad),
      };
      const p = project(pL.x, pL.y);
      if(!p.visible || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
      boundary.push(p);
    }
    ctx.beginPath();
    boundary.forEach((p,i)=>{
      if(i===0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    if(fill){ ctx.fillStyle = fill; ctx.fill(); }
    ctx.strokeStyle = color || 'rgba(111,155,191,0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
  };
  // per user request: HQ本部の周りの補給ゾーン -- 中に入っている損傷ユニット(迫撃砲/戦車/対戦車/SAM)は
  // 徐々に回復し、歩兵小隊は弾薬を再補給する(see applyHqSupplyZone() in combat.js)。
  // 常時表示(showDetailLabels条件なし)にして、遠くから見てもゾーンの存在に気付けるようにした。
  if(state.hq && state.hq.hp>0){
    drawGroundDetectionCircle(state.hq, HQ_SUPPLY_ZONE_RADIUS_UNITS, 'rgba(122,201,138,0.55)', 'rgba(122,201,138,0.07)');
  }
  if(showDetailLabels){
    // per user request(斥候の効果を分かりやすく): 以前はHQ/ヘリと同じ既定色で「何のための円か」
    // が伝わらなかった -- 迫撃砲の観測補正(computeDispersionAt/isObservedByScout)と揃えた
    // 琥珀色にし、円の上端にラベルを添えて意味を明示する。
    state.scouts.forEach(scout=>{
      const scoutVisL = smoothVisualPos(scout, scout.x, scout.y);
      const scoutVis = project(scoutVisL.x, scoutVisL.y);
      if(!unitAlive(scout) || !scoutVis.visible) return;
      drawGroundDetectionCircle(scoutVisL, SCOUT_MAX_RANGE_UNITS, 'rgba(224,184,74,0.55)', 'rgba(224,184,74,0.06)');
      const topL = { x: scoutVisL.x, y: scoutVisL.y - SCOUT_MAX_RANGE_UNITS*((WORLD.scaleZ>0.0001)?(WORLD.scaleX/WORLD.scaleZ):1) };
      const topP = project(topL.x, topL.y);
      if(topP.visible){
        ctx.fillStyle = 'rgba(224,184,74,0.9)';
        ctx.font = mfont('11px "Noto Sans JP"');
        ctx.textAlign = 'center';
        ctx.fillText('観測圏(迫撃砲高精度)', topP.x, topP.y-4);
      }
    });
    (state.helis||[]).forEach(heli=>{
      const heliVisL = smoothVisualPos(heli, heli.x, heli.y);
      const heliVis = project(heliVisL.x, heliVisL.y);
      if(heli.hp>0 && heliVis.visible) drawGroundDetectionCircle(heliVisL, HELI_MAX_RANGE_UNITS);
    });
  }

  // scout markers (自軍, left side) ― 斥候, vulnerable to enemy attack
  (state.helis||[]).forEach((heli, heliIdx)=>{
    const p = project(heli.x, heli.y);
    if(heli.hp<=0) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = FRIENDLY_MARK_COLOR;
    ctx.strokeStyle = '#d9a441';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0,-12); ctx.lineTo(16,0); ctx.lineTo(0,12); ctx.lineTo(-16,0); ctx.closePath();
    ctx.fill(); ctx.stroke();
    if(showDetailLabels) queueFriendlyLabel(p.x, p.y, [{text:`ヘリ${heliIdx+1} [観測]`, dy:-20, font:'15px "JetBrains Mono"'}], false, 'ヘリ');
    ctx.restore();
  });
  state.scouts.forEach((scout, scIdx)=>{
    const scoutVisL = smoothVisualPos(scout, scout.x, scout.y);
    const scoutVis = project(scoutVisL.x, scoutVisL.y);
    const aliveCount = unitAliveCount(scout);
    const scoutAlive = aliveCount>0;
    ctx.save();
    ctx.translate(scoutVis.x, scoutVis.y);
    drawSelectionRing(ctx, 0, 0, state.commandBox && state.commandBox.kind==='scout' && state.commandBox.idx===scIdx);
    if(showDetailLabels){
      const scoutLines = [{text: (scoutAlive?`斥候${scout.id+1} ${aliveCount}/${scout.soldiers.length}`:`斥候${scout.id+1}(戦闘不能)`)+(scoutAlive?roadTag(scout.x,scout.y):''), dy:-20, font:'15px "JetBrains Mono"'}];
      if(scoutAlive){
        let scoutOrderLabel = '[観測]';
        if(scout.resting) scoutOrderLabel = '[大休止]';
        else if(scout.pendingDest) scoutOrderLabel = '[移動]';
        scoutLines.push({text: scoutOrderLabel, dy:28, font:'bold 13px "JetBrains Mono"'});
      }
      queueFriendlyLabel(scoutVis.x, scoutVis.y, scoutLines, state.commandBox && state.commandBox.kind==='scout' && state.commandBox.idx===scIdx, '斥候');
    }
    ctx.restore();

    if(showDetailLabels && scoutAlive){
      drawAttritionBar(ctx, scoutVis.x+18, scoutVis.y, aliveCount/scout.soldiers.length);
    }
  });

  // tank markers (自軍, left side) ― the 3D FBX is the sole tank body representation.
  state.tanks.forEach((tank, tIdx)=>{
    const tVisL = smoothVisualPos(tank, tank.x, tank.y);
    const tVis = project(tVisL.x, tVisL.y);
    const tAlive = tank.hp>0;
    ctx.save();
    ctx.translate(tVis.x, tVis.y);
    drawSelectionRing(ctx, 0, 0, (state.commandBox && state.commandBox.kind==='tank' && state.commandBox.idx===tIdx) || isMultiSelected('tank', tIdx));
    // per user request: order status shown as a single icon glyph (see ORDER_ICON) instead of
    // bracketed Japanese text, and merged onto the name's own line -- packed friendly deployment
    // areas were an unreadable wall of overlapping two-line labels on small screens.
    const tOrderIcon = ORDER_ICON[tank.order] + (tank.pendingDest ? '→' : '');
    if(showDetailLabels) queueFriendlyLabel(tVis.x, tVis.y, [{text: (tAlive?`戦車${tank.id+1} ${tOrderIcon}`:`戦車${tank.id+1}(撃破)`)+(tAlive?roadTag(tank.x,tank.y):''), dy:44, font:'15px "JetBrains Mono"'}],
      (state.commandBox && state.commandBox.kind==='tank' && state.commandBox.idx===tIdx) || isMultiSelected('tank', tIdx), '戦車');
    ctx.restore();

    if(tAlive){
      if(showDetailLabels) drawAttritionBar(ctx, tVis.x+18, tVis.y-2, tank.hp/tank.maxHp);
      if(tank.order==='hunt' && tank.huntTargetId){
        const t = state.targets.find(x=>x.id===tank.huntTargetId);
        if(t && !t.destroyed && t.revealed){
          const eL = estPos(t);
          const e = project(eL.x, eL.y);
          ctx.beginPath();
          ctx.setLineDash([3,3]);
          ctx.strokeStyle = 'rgba(193,69,59,0.35)';
          ctx.lineWidth = 1;
          ctx.moveTo(tVis.x, tVis.y);
          ctx.lineTo(e.x, e.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
  });

  // per user request: 対空ミサイル部隊マーカー -- 戦車と同じ描画パターン(drawSamIconのベクター
  // アイコン)。攻撃線はヘリ/ドローンのみに引かれる(戦車の攻撃目標線と同様の見た目)。
  state.sams.forEach((sam, samIdx)=>{
    const samVisL = smoothVisualPos(sam, sam.x, sam.y);
    const samVis = project(samVisL.x, samVisL.y);
    const samAlive = sam.hp>0;
    ctx.save();
    ctx.translate(samVis.x, samVis.y);
    drawSamIcon(ctx, 0, 0, scaledIconH(22), !samAlive);
    drawSelectionRing(ctx, 0, 0, (state.commandBox && state.commandBox.kind==='sam' && state.commandBox.idx===samIdx) || isMultiSelected('sam', samIdx));
    const samOrderIcon = ORDER_ICON[sam.order] + (sam.pendingDest ? '→' : '');
    if(showDetailLabels) queueFriendlyLabel(samVis.x, samVis.y, [{text: (samAlive?`対空${sam.id+1} ${samOrderIcon}`:`対空${sam.id+1}(撃破)`)+(samAlive?roadTag(sam.x,sam.y):''), dy:44, font:'15px "JetBrains Mono"'}],
      (state.commandBox && state.commandBox.kind==='sam' && state.commandBox.idx===samIdx) || isMultiSelected('sam', samIdx), '対空');
    ctx.restore();

    if(samAlive){
      if(showDetailLabels) drawAttritionBar(ctx, samVis.x+18, samVis.y-2, sam.hp/sam.maxHp);
      if(sam.order==='hunt' && sam.huntTargetId){
        const t = state.targets.find(x=>x.id===sam.huntTargetId);
        if(t && !t.destroyed && t.revealed){
          const eL = estPos(t);
          const e = project(eL.x, eL.y);
          ctx.beginPath();
          ctx.setLineDash([3,3]);
          ctx.strokeStyle = 'rgba(193,69,59,0.35)';
          ctx.lineWidth = 1;
          ctx.moveTo(samVis.x, samVis.y);
          ctx.lineTo(e.x, e.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
  });

  // 防壁(壁) ― 工兵が構築する障害物。敵味方どちらのユニットからも見える固定物なので
  // 検知/未検知の区別はない。
  state.walls.forEach(w=>{
    const wVis = project(w.x, w.y);
    drawWallShape(ctx, wVis.x, wVis.y, w.hp<=0);
    if(w.hp>0) drawAttritionBar(ctx, wVis.x+20, wVis.y, w.hp/w.maxHp);
  });

  // 要塞 ― 占領可能な固定拠点。歩兵/戦車/擬陣地と違い、フレンドリー・ラベルの集約対象外
  // (queueFriendlyLabelはfriendly-onlyのクラスタリング前提なので、中立/敵占領もありうる
  // 要塞はここで直接ラベルを描く)。
  (state.fortresses||[]).forEach(f=>{
    const fVis = project(f.x, f.y);
    drawFortressShape(ctx, fVis.x, fVis.y, f.owner);
    drawAttritionBar(ctx, fVis.x+26, fVis.y, f.hp/f.maxHp);
    if(showDetailLabels){
      const ownerLabel = f.owner==='friendly' ? '要塞(自軍)' : f.owner==='enemy' ? '要塞(敵)' : '要塞(無人)';
      ctx.save();
      ctx.font = mfont('13px "JetBrains Mono"');
      ctx.textAlign = 'center';
      ctx.fillStyle = f.owner==='friendly' ? FRIENDLY_MARK_COLOR : f.owner==='enemy' ? ENEMY_MARK_COLOR : FORTRESS_NEUTRAL_COLOR;
      ctx.fillText(ownerLabel, fVis.x, fVis.y+38);
      ctx.restore();
    }
  });

  // per user request: 塹壕(線方式) -- 壁と違い射線を遮らないので身代わり被弾やHPバーはない。
  // 地形に沿う短いコードで描画(FEBA線/グリッド線と同じ技法)。
  state.trenches.forEach(tr=>{
    strokeGridBucket(choppedLineSegments(tr.x1, tr.y1, tr.x2, tr.y2), TRENCH_LINE_COLOR, TRENCH_LINE_WIDTH);
  });

  // 工兵小隊 (自軍) ― HP制ではなく小隊と同じ soldiers ロスター制、戦闘はせず移動+壁構築のみ
  state.engineers.forEach((en, enIdx)=>{
    const enVisL = smoothVisualPos(en, en.x, en.y);
    const enVis = project(enVisL.x, enVisL.y);
    const aliveSoldiers = en.soldiers.filter(s=>s.alive);
    ctx.save();
    ctx.translate(enVis.x, enVis.y);
    drawEngineerIcon(ctx, 0, 0, scaledIconH(22), aliveSoldiers.length===0);
    drawSelectionRing(ctx, 0, 0, (state.commandBox && state.commandBox.kind==='engineer' && state.commandBox.idx===enIdx) || isMultiSelected('engineer', enIdx));
    const enOrderIcon = aliveSoldiers.length>0 ? ` ${ORDER_ICON[en.order]}${en.pendingDest?'→':''}` : '';
    if(showDetailLabels) queueFriendlyLabel(enVis.x, enVis.y, [{text:`工兵 ${aliveSoldiers.length}/${en.soldiers.length}${enOrderIcon}${aliveSoldiers.length>0?roadTag(en.x,en.y):''}`, dy:28, font:'14px "JetBrains Mono"'}],
      (state.commandBox && state.commandBox.kind==='engineer' && state.commandBox.idx===enIdx) || isMultiSelected('engineer', enIdx), '工兵');
    ctx.restore();
    if(showDetailLabels && aliveSoldiers.length>0) drawAttritionBar(ctx, enVis.x+18, enVis.y, aliveSoldiers.length/en.soldiers.length);
  });

  // 衛生小隊 (自軍) ― 工兵と同じ soldiers ロスター制。戦闘はせず移動+負傷者の蘇生のみ。
  state.medics.forEach((me, meIdx)=>{
    const meVisL = smoothVisualPos(me, me.x, me.y);
    const meVis = project(meVisL.x, meVisL.y);
    const aliveSoldiers = me.soldiers.filter(s=>s.alive);
    ctx.save();
    ctx.translate(meVis.x, meVis.y);
    drawMedicIcon(ctx, 0, 0, scaledIconH(22), aliveSoldiers.length===0);
    drawSelectionRing(ctx, 0, 0, (state.commandBox && state.commandBox.kind==='medic' && state.commandBox.idx===meIdx));
    const meOrderIcon = aliveSoldiers.length>0 ? ` ${ORDER_ICON[me.order]}${me.pendingDest?'→':''}` : '';
    if(showDetailLabels) queueFriendlyLabel(meVis.x, meVis.y, [{text:`衛生 ${aliveSoldiers.length}/${me.soldiers.length}${meOrderIcon}${aliveSoldiers.length>0?roadTag(me.x,me.y):''}`, dy:28, font:'14px "JetBrains Mono"'}],
      (state.commandBox && state.commandBox.kind==='medic' && state.commandBox.idx===meIdx), '衛生');
    ctx.restore();
    if(showDetailLabels && aliveSoldiers.length>0) drawAttritionBar(ctx, meVis.x+18, meVis.y, aliveSoldiers.length/me.soldiers.length);
  });

  // 補給隊 (自軍) ― 工兵/衛生小隊と同じ soldiers ロスター制。戦闘はせず移動+小隊への
  // 弾薬補給(本部⇔対象の自動往復)のみ。
  (state.supplies||[]).forEach((su, suIdx)=>{
    const suVisL = smoothVisualPos(su, su.x, su.y);
    const suVis = project(suVisL.x, suVisL.y);
    const aliveSoldiers = su.soldiers.filter(s=>s.alive);
    ctx.save();
    ctx.translate(suVis.x, suVis.y);
    drawSupplyIcon(ctx, 0, 0, scaledIconH(22), aliveSoldiers.length===0);
    drawSelectionRing(ctx, 0, 0, (state.commandBox && state.commandBox.kind==='supply' && state.commandBox.idx===suIdx));
    const suOrderIcon = aliveSoldiers.length>0 ? ` ${ORDER_ICON[su.order]}${su.pendingDest?'→':''}` : '';
    if(showDetailLabels) queueFriendlyLabel(suVis.x, suVis.y, [{text:`補給 ${aliveSoldiers.length}/${su.soldiers.length}${suOrderIcon}${aliveSoldiers.length>0?roadTag(su.x,su.y):''}`, dy:28, font:'14px "JetBrains Mono"'}],
      (state.commandBox && state.commandBox.kind==='supply' && state.commandBox.idx===suIdx), '補給');
    ctx.restore();
    if(showDetailLabels && aliveSoldiers.length>0) drawAttritionBar(ctx, suVis.x+18, suVis.y, aliveSoldiers.length/su.soldiers.length);
  });

  // friendly infantry squads (自軍) ― orderly formation, moves as a unit per order
  if(state.squads && state.squads.length){
    state.squads.forEach((sq, sqIdx)=>{
      const sqVisL = smoothVisualPos(sq, sq.x, sq.y);
      const sqVis = project(sqVisL.x, sqVisL.y);
      const aliveSoldiers = sq.soldiers.filter(s=>s.alive);
      // per user request: now a cluster of individual 3D figures (one per living soldier --
      // see makeMarkerMesh3d's 'infantry' branch) instead of one flat icon, matching how
      // tank/heli already rely on their own 3D model instead of a 2D sprite. Still falls
      // back to the flat icon when 3D isn't available at all.
      if(!threeReady) drawUnitIcon(ctx, infantryIcon, sqVis.x, sqVis.y, scaledIconH(22), aliveSoldiers.length===0);
      drawSelectionRing(ctx, sqVis.x, sqVis.y, (state.commandBox && state.commandBox.kind==='squad' && state.commandBox.idx===sqIdx) || isMultiSelected('squad', sqIdx));
      if(showDetailLabels && aliveSoldiers.length>0) drawAttritionBar(ctx, sqVis.x+32, sqVis.y, aliveSoldiers.length/sq.soldiers.length);
      const sqOrderIcon = ORDER_ICON[sq.order] + (sq.pendingDest ? '→' : '');
      // per user request: 弾薬残数の表示 -- 0になった場合は視認しやすいよう明示的に「弾切れ」
      // と表示する(see applyHqSupplyZone()/UNIT_AMMO_EMPTY_DMG_MULT in combat.js)。
      const sqAmmoLabel = (sq.ammo===undefined || sq.ammo>0) ? ` 弾${Math.ceil(sq.ammo ?? UNIT_AMMO_MAX)}` : ' 弾切れ';
      if(showDetailLabels) queueFriendlyLabel(sqVis.x, sqVis.y, [{text:`第${sqIdx+1}小隊 ${aliveSoldiers.length}/${sq.soldiers.length} ${sqOrderIcon}${sqAmmoLabel}${aliveSoldiers.length>0?roadTag(sq.x,sq.y):''}`, dy:28, font:'14px "JetBrains Mono"', color: aliveSoldiers.length>0 ? LABEL_TEXT_COLOR : '#5c2a25'}],
        (state.commandBox && state.commandBox.kind==='squad' && state.commandBox.idx===sqIdx) || isMultiSelected('squad', sqIdx), '小隊');

      if(aliveSoldiers.length>0){
        state.targets.filter(t=>!t.destroyed && t.type==='infantry' && t.revealed).forEach(t=>{
          const eL = estPos(t);
          const dist = Math.hypot(eL.x-sq.x, eL.y-sq.y);
          if(dist > SQUAD_ENGAGE_RANGE) return;
          const e = project(eL.x, eL.y);
          ctx.beginPath();
          ctx.setLineDash([3,3]);
          ctx.strokeStyle = 'rgba(193,69,59,0.35)';
          ctx.lineWidth = 1;
          ctx.moveTo(sqVis.x, sqVis.y);
          ctx.lineTo(e.x, e.y);
          ctx.stroke();
          ctx.setLineDash([]);
        });
      }
    });
  }

  // 音楽隊マーカー(自軍) ― 近接戦闘専任の本部警備部隊。小隊と同じ人型フィギュア描画パターン
  // (弾薬(ammo)の概念は持たない点、射程がBAND_ENGAGE_RANGEと短い点が異なる)。
  if(state.bands && state.bands.length){
    state.bands.forEach((band, bandIdx)=>{
      const bandVisL = smoothVisualPos(band, band.x, band.y);
      const bandVis = project(bandVisL.x, bandVisL.y);
      const aliveSoldiers = band.soldiers.filter(s=>s.alive);
      if(!threeReady) drawUnitIcon(ctx, infantryIcon, bandVis.x, bandVis.y, scaledIconH(22), aliveSoldiers.length===0);
      drawSelectionRing(ctx, bandVis.x, bandVis.y, (state.commandBox && state.commandBox.kind==='band' && state.commandBox.idx===bandIdx) || isMultiSelected('band', bandIdx));
      if(showDetailLabels && aliveSoldiers.length>0) drawAttritionBar(ctx, bandVis.x+32, bandVis.y, aliveSoldiers.length/band.soldiers.length);
      const bandOrderIcon = ORDER_ICON[band.order] + (band.pendingDest ? '→' : '');
      if(showDetailLabels) queueFriendlyLabel(bandVis.x, bandVis.y, [{text:`音楽隊 ${aliveSoldiers.length}/${band.soldiers.length} ${bandOrderIcon}${aliveSoldiers.length>0?roadTag(band.x,band.y):''}`, dy:28, font:'14px "JetBrains Mono"', color: aliveSoldiers.length>0 ? LABEL_TEXT_COLOR : '#5c2a25'}],
        (state.commandBox && state.commandBox.kind==='band' && state.commandBox.idx===bandIdx) || isMultiSelected('band', bandIdx), '音楽隊');

      if(aliveSoldiers.length>0){
        state.targets.filter(t=>!t.destroyed && t.type==='infantry' && t.revealed).forEach(t=>{
          const eL = estPos(t);
          const dist = Math.hypot(eL.x-band.x, eL.y-band.y);
          if(dist > BAND_ENGAGE_RANGE) return;
          const e = project(eL.x, eL.y);
          ctx.beginPath();
          ctx.setLineDash([3,3]);
          ctx.strokeStyle = 'rgba(193,69,59,0.35)';
          ctx.lineWidth = 1;
          ctx.moveTo(bandVis.x, bandVis.y);
          ctx.lineTo(e.x, e.y);
          ctx.stroke();
          ctx.setLineDash([]);
        });
      }
    });
  }

  // 対戦車部隊マーカー(自軍) ― 戦車と同じ描画パターン(単一HP制の車両)。
  state.antitanks.forEach((at, atIdx)=>{
    const atVisL = smoothVisualPos(at, at.x, at.y);
    const atVis = project(atVisL.x, atVisL.y);
    const atAlive = at.hp>0;
    ctx.save();
    ctx.translate(atVis.x, atVis.y);
    drawSelectionRing(ctx, 0, 0, (state.commandBox && state.commandBox.kind==='antitank' && state.commandBox.idx===atIdx) || isMultiSelected('antitank', atIdx));
    const atOrderIcon = ORDER_ICON[at.order] + (at.pendingDest ? '→' : '');
    if(showDetailLabels) queueFriendlyLabel(atVis.x, atVis.y, [{text: (atAlive?`対戦車${at.id+1} ${atOrderIcon}`:`対戦車${at.id+1}(撃破)`)+(atAlive?roadTag(at.x,at.y):''), dy:44, font:'15px "JetBrains Mono"'}],
      (state.commandBox && state.commandBox.kind==='antitank' && state.commandBox.idx===atIdx) || isMultiSelected('antitank', atIdx), '対戦車');
    ctx.restore();

    if(atAlive){
      if(showDetailLabels) drawAttritionBar(ctx, atVis.x+18, atVis.y-2, at.hp/at.maxHp);
      if(at.order==='hunt' && at.huntTargetId){
        const t = state.targets.find(x=>x.id===at.huntTargetId);
        if(t && !t.destroyed && t.revealed){
          const eL = estPos(t);
          const e = project(eL.x, eL.y);
          ctx.beginPath();
          ctx.setLineDash([3,3]);
          ctx.strokeStyle = 'rgba(193,69,59,0.35)';
          ctx.lineWidth = 1;
          ctx.moveTo(atVis.x, atVis.y);
          ctx.lineTo(e.x, e.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
  });

  drawPendingFriendlyLabels(ctx, pendingFriendlyLabels);

  state.targets.forEach(t=>{
    // per user request: detection/estimation is gone -- every non-destroyed target is always
    // shown at its exact true position, so there's no "undetected" fallback marker and no
    // position-uncertainty ring to draw here anymore (both used to depend on isTargetDetected/
    // t.posErr, which no longer exist). The one exception is the enemy HQ (see
    // buildEnemyHqTarget/updateHqDetection in combat.js): it alone can still be !revealed, and
    // must not be drawn at all -- not even as a dim/unlabeled marker -- until then, or its
    // exact position would give it away regardless of the missing label.
    if(t.destroyed){
      // reveal true position, destroyed mark
      const dp = project(t.trueX, t.trueY);
      ctx.strokeStyle = '#c1453b'; ctx.lineWidth=2;
      ctx.beginPath();
      ctx.moveTo(dp.x-8,dp.y-8); ctx.lineTo(dp.x+8,dp.y+8);
      ctx.moveTo(dp.x+8,dp.y-8); ctx.lineTo(dp.x-8,dp.y+8);
      ctx.stroke();
      ctx.fillStyle=LABEL_TEXT_COLOR; ctx.font = mfont('15px "JetBrains Mono"'); ctx.textAlign='center';
      ctx.fillText(t.id+' 撃破', dp.x, dp.y-16);
    } else if(t.revealed){
      const eLogical = estPos(t);
      const eVisL = smoothVisualPos(t, eLogical.x, eLogical.y);
      const e = project(eVisL.x, eVisL.y);
      // per user request: also highlight a target the player has merely opened the
      // attack-assignment box on (enemyCommandBox), not just one a mortar is actively
      // aimed at (selectedId) -- previously clicking a target to open that box gave no
      // on-map confirmation of which one was selected.
      const selected = t.id===state.selectedId || t.id===state.enemyCommandBox;

      drawSelectionRing(ctx, e.x, e.y, selected, 15);

      // estimated center marker ― one simple symbol per formation group
      let labelY = e.y+20;
      if(t.type==='infantry' && t.troops){
        // per user request: custom enemy infantry icon image in place of the plain circle --
        // muted (grayscale) until identified, same treatment as a friendly unit with no survivors.
        const aliveTroops = t.troops.filter(s=>s.alive);
        // per user request: now a cluster of individual 3D figures in its real tactical
        // formation (see makeMarkerMesh3d's 'infantry' branch) instead of one flat icon --
        // still falls back to the flat icon when 3D isn't available at all.
        if(!threeReady) drawUnitIcon(ctx, enemyInfantryIcon, e.x, e.y, scaledIconH(22), !t.revealed);
        if(showDetailLabels && t.revealed) drawAttritionBar(ctx, e.x+14, e.y, t.hp/t.maxHp);
        labelY = e.y+26;
        if(showDetailLabels && t.revealed){
          ctx.fillStyle = LABEL_TEXT_COLOR;
          ctx.font = mfont('14px "JetBrains Mono"');
          ctx.textAlign='center';
          const doctrine = t.doctrine==='flank' ? '側面' : t.doctrine==='support' ? '支援' : '強襲';
          ctx.fillText(`敵${t.def.label}(${doctrine}) ${aliveTroops.length}/${t.troops.length}`, e.x, labelY);
          // per user request: 空挺強襲アーキタイプ -- 着陸直後で行動不能な間は、通常の
          // ドクトリン表示の代わりに一目で分かる警告色のラベルを出す(反撃してこない理由が
          // 分かるように)。
          const landingImmune = t.landingUntil && performance.now() < t.landingUntil;
          if(landingImmune){
            ctx.font = mfont('bold 11px "Noto Sans JP"');
            ctx.fillStyle = '#f0bd55';
            ctx.fillText('▼ 降下直後(無防備)', e.x, labelY-38);
          } else if(showFullDetail){
            ctx.font = mfont('bold 11px "Noto Sans JP"');
            ctx.fillStyle = t.doctrine==='flank' ? '#e0b84a' : t.doctrine==='support' ? '#b0d3ed' : '#ef927d';
            ctx.fillText(doctrine==='強襲' ? '▲ 強襲中' : doctrine==='側面' ? '◀ 側面展開' : '■ 支援射撃', e.x, labelY-38);
          }
        }
      } else if(t.type==='drone'){
        // per user request: dropped the rotor-arm satellite dots -- a single diamond
        // (matching the 3D minimap's drone shape) distinguishes it from the plain
        // circle used for vehicle/artillery, with no clutter around it.
        const dcolor = t.revealed ? t.def.mark : '#8f9678';
        ctx.fillStyle = dcolor;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y-7);
        ctx.lineTo(e.x+6, e.y);
        ctx.lineTo(e.x, e.y+7);
        ctx.lineTo(e.x-6, e.y);
        ctx.closePath();
        ctx.fill();
        if(showDetailLabels && t.revealed){
          ctx.fillStyle = LABEL_TEXT_COLOR;
          ctx.font = mfont('14px "JetBrains Mono"');
          ctx.textAlign='center';
          ctx.fillText(t.def.label, e.x, labelY);
        }
      } else if(t.type==='heli'){
        // per user request: 戦闘ヘリ -- fuselage ellipse + rotor bar + tail boom, distinct
        // from the plain circle/diamond used by ground vehicles/drones (no icon asset exists).
        const hcolor = t.revealed ? t.def.mark : '#8f9678';
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.strokeStyle = hcolor;
        ctx.fillStyle = hcolor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-11,0); ctx.lineTo(11,0);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0, 0, 7, 4, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-7,0); ctx.lineTo(-14,-4);
        ctx.stroke();
        ctx.restore();
        if(showDetailLabels && t.revealed){
          ctx.fillStyle = LABEL_TEXT_COLOR;
          ctx.font = mfont('14px "JetBrains Mono"');
          ctx.textAlign='center';
          ctx.fillText(t.def.label, e.x, labelY);
        }
      } else if(t.type==='hq'){
        // per user request (idea 1/4): reads as a fortified structure, not a mobile unit --
        // a bordered square (matching the 3D minimap's box shape) instead of the plain circle
        // used for artillery/vehicle, so it's immediately recognizable as the wave's
        // alternate win condition.
        const hqColor = t.revealed ? t.def.mark : '#8f9678';
        ctx.fillStyle = hqColor;
        ctx.fillRect(e.x-8, e.y-8, 16, 16);
        ctx.strokeStyle = LABEL_TEXT_COLOR;
        ctx.lineWidth = 1;
        ctx.strokeRect(e.x-8, e.y-8, 16, 16);
        labelY = e.y+26;
        if(showDetailLabels && t.revealed){
          ctx.fillStyle = LABEL_TEXT_COLOR;
          ctx.font = mfont('bold 14px "JetBrains Mono"');
          ctx.textAlign='center';
          ctx.fillText(t.def.label, e.x, labelY);
        }
      } else {
        ctx.fillStyle = t.revealed ? t.def.mark : '#8f9678';
        ctx.beginPath();
        ctx.arc(e.x,e.y,5,0,Math.PI*2);
        ctx.fill();
        if(showDetailLabels && t.revealed){
          ctx.fillStyle = LABEL_TEXT_COLOR;
          ctx.font = mfont('14px "JetBrains Mono"');
          ctx.textAlign='center';
          ctx.fillText(t.def.label, e.x, labelY);
        }
      }

      // small HP bar above the marker
      if(showDetailLabels){
        const hpPct = clamp(t.hp/t.maxHp, 0, 1);
        const tBarW=32, tBarH=4;
        const tbx = e.x-tBarW/2, tby = e.y-22;
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(tbx-1,tby-1,tBarW+2,tBarH+2);
        ctx.fillStyle = '#3a4128';
        ctx.fillRect(tbx,tby,tBarW,tBarH);
        ctx.fillStyle = hpPct>0.3 ? '#c1453b' : '#f0715f';
        ctx.fillRect(tbx,tby,tBarW*hpPct,tBarH);

        ctx.fillStyle = LABEL_TEXT_COLOR;
        ctx.font = mfont('bold 17px "JetBrains Mono"');
        ctx.textAlign='left';
        ctx.fillText(t.id, e.x+11, e.y-11);
      }
      if(isSuppressed(t)){
        ctx.fillStyle = LABEL_TEXT_COLOR;
        ctx.font = mfont('bold 13px "JetBrains Mono"');
        ctx.textAlign = 'center';
        ctx.fillText('[制圧]', e.x, e.y-30);
      }
    }

    // impact marks
    t.impacts.forEach(imp=>{
      const ip = project(imp.x, imp.y);
      ctx.fillStyle = 'rgba(193,69,59,0.75)';
      ctx.beginPath();
      ctx.arc(ip.x, ip.y, 3, 0, Math.PI*2);
      ctx.fill();
    });
  });

  // per user request(道路の効果を分かりやすく): 移動先を指定済みの全ユニットについて、
  // 現在地から移動先までの経路プレビューを破線で表示する。実際の移動(terrainAwareStep)は
  // 道路を探して迂回するわけではなく直線移動+その場の速度倍率なので、プレビューも直線を
  // 細かく区切り、区間ごとにisOnRoad()で色分けする(琥珀=道路上で速い、灰=オフロード)。
  const drawMovePathPreview = (fromX, fromY, toX, toY)=>{
    const STEPS = 24;
    for(let i=0;i<STEPS;i++){
      const t0 = i/STEPS, t1 = (i+1)/STEPS;
      const ax = fromX+(toX-fromX)*t0, ay = fromY+(toY-fromY)*t0;
      const bx = fromX+(toX-fromX)*t1, by = fromY+(toY-fromY)*t1;
      const midOnRoad = isOnRoad((ax+bx)/2, (ay+by)/2);
      const pa = project(ax, ay), pb = project(bx, by);
      if(!pa.visible && !pb.visible) continue;
      ctx.beginPath();
      ctx.setLineDash([6,4]);
      ctx.strokeStyle = midOnRoad ? 'rgba(224,184,74,0.85)' : 'rgba(160,160,160,0.55)';
      ctx.lineWidth = midOnRoad ? 2 : 1.3;
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  };
  if(state.hq && state.hq.hp>0 && state.hq.pendingDest) drawMovePathPreview(state.hq.x, state.hq.y, state.hq.pendingDest.x, state.hq.pendingDest.y);
  state.mortars.forEach(m=>{ if(m.hp>0 && m.pendingDest) drawMovePathPreview(m.x, m.y, m.pendingDest.x, m.pendingDest.y); });
  state.scouts.forEach(s=>{ if(unitAlive(s) && s.pendingDest) drawMovePathPreview(s.x, s.y, s.pendingDest.x, s.pendingDest.y); });
  state.squads.forEach(sq=>{ if(sq.soldiers.some(x=>x.alive) && sq.pendingDest) drawMovePathPreview(sq.x, sq.y, sq.pendingDest.x, sq.pendingDest.y); });
  state.bands.forEach(b=>{ if(unitAliveCount(b)>0 && b.pendingDest) drawMovePathPreview(b.x, b.y, b.pendingDest.x, b.pendingDest.y); });
  state.engineers.forEach(en=>{ if(unitAliveCount(en)>0 && en.pendingDest) drawMovePathPreview(en.x, en.y, en.pendingDest.x, en.pendingDest.y); });
  state.medics.forEach(me=>{ if(unitAliveCount(me)>0 && me.pendingDest) drawMovePathPreview(me.x, me.y, me.pendingDest.x, me.pendingDest.y); });
  (state.supplies||[]).forEach(su=>{ if(unitAliveCount(su)>0 && su.pendingDest) drawMovePathPreview(su.x, su.y, su.pendingDest.x, su.pendingDest.y); });
  state.tanks.forEach(t=>{ if(t.hp>0 && t.pendingDest) drawMovePathPreview(t.x, t.y, t.pendingDest.x, t.pendingDest.y); });
  state.sams.forEach(s=>{ if(s.hp>0 && s.pendingDest) drawMovePathPreview(s.x, s.y, s.pendingDest.x, s.pendingDest.y); });
  state.antitanks.forEach(a=>{ if(a.hp>0 && a.pendingDest) drawMovePathPreview(a.x, a.y, a.pendingDest.x, a.pendingDest.y); });

  // pending fire points ― effect radius + crosshair, awaiting execute/cancel
  if(!state.animating){
    state.mortars.forEach(mortar=>{
      if(!mortar.pendingFire) return;
      // per user request(斥候の効果を分かりやすく): 斥候の観測圏内は散布界が縮小するため、
      // 着弾点ごとに実際の散布界を計算し直す(以前は斥候の有無を無視した固定値だった)。
      // 観測補正が効いている間は円の色を琥珀色にして、斥候の存在が結果に効いていると分かる
      // ようにする。
      const observed = isObservedByScout(mortar.pendingFire.x, mortar.pendingFire.y);
      const pendDispersion = computeDispersionAt(mortar.pendingFire.x, mortar.pendingFire.y) * WEATHER_TYPES[state.weather].dispersionMult;
      const pp = project(mortar.pendingFire.x, mortar.pendingFire.y);
      const px = pp.x, py = pp.y;
      ctx.beginPath();
      ctx.setLineDash([4,4]);
      ctx.strokeStyle = observed ? 'rgba(224,184,74,0.9)' : 'rgba(193,69,59,0.85)';
      ctx.lineWidth = 1.5;
      ctx.arc(px, py, pendDispersion, 0, Math.PI*2);
      ctx.stroke();
      ctx.setLineDash([]);
      if(observed){
        ctx.fillStyle = 'rgba(224,184,74,0.95)';
        ctx.font = mfont('bold 11px "Noto Sans JP"');
        ctx.textAlign = 'center';
        ctx.fillText('👁 斥候観測(高精度)', px, py-pendDispersion-8);
      }
      ctx.beginPath();
      ctx.strokeStyle = '#c1453b';
      ctx.lineWidth = 2;
      ctx.moveTo(px-10,py); ctx.lineTo(px+10,py);
      ctx.moveTo(px,py-10); ctx.lineTo(px,py+10);
      ctx.stroke();
    });
  }

  // flying projectiles ― arced trajectory. per user request: the arc's height baseline is a
  // smooth interpolation between the launch and impact points' OWN terrain heights (see
  // projectileArcWorldY()), not the local terrain directly beneath the shell's current XY --
  // sampling local terrain there made the drawn trajectory hug every bump along the flight
  // path on hilly ground instead of reading as a clean ballistic arc between two elevations.
  const nowP = performance.now();
  projectiles.forEach(p=>{
    const prog = clamp((nowP-p.born)/p.duration, 0, 1);
    const gx = p.startX + (p.endX-p.startX)*prog;
    const gy = p.startY + (p.endY-p.startY)*prog;
    const isArc = p.trajectory === 'arc';
    const gp = isArc
      ? projectAtWorldY(gx, gy, projectileArcWorldY(p.startX, p.startY, p.endX, p.endY, prog))
      : project(gx, gy);
    const x = gp.x, y = gp.y;
    const startG = project(p.startX, p.startY);
    const endG = project(p.endX, p.endY);

    // per user request: full parabolic arc curve for the whole flight (敵味方問わず --
    // this projectiles[] array is shared by friendly mortar volleys and enemy indirect
    // fire/counter-battery alike), shown in addition to the existing moving-dot + trail.
    if(isArc){
      ctx.beginPath();
      const arcSteps = 20;
      for(let k=0;k<=arcSteps;k++){
        const tt = k/arcSteps;
        const agx = p.startX + (p.endX-p.startX)*tt;
        const agy = p.startY + (p.endY-p.startY)*tt;
        const agp = projectAtWorldY(agx, agy, projectileArcWorldY(p.startX, p.startY, p.endX, p.endY, tt));
        const ax = agp.x, ay = agp.y;
        if(k===0) ctx.moveTo(ax,ay); else ctx.lineTo(ax,ay);
      }
      ctx.strokeStyle = 'rgba(217,164,65,0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // faint dashed ground track + aim point ring
    ctx.beginPath();
    ctx.setLineDash([2,4]);
    ctx.strokeStyle = 'rgba(217,164,65,0.25)';
    ctx.lineWidth = 1;
    ctx.moveTo(startG.x,startG.y); ctx.lineTo(endG.x,endG.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(193,69,59,0.6)';
    ctx.arc(endG.x,endG.y,4,0,Math.PI*2);
    ctx.stroke();

    // short motion trail
    for(let k=1;k<=3;k++){
      const tp = clamp(prog-k*0.04,0,1);
      const tgx = p.startX + (p.endX-p.startX)*tp;
      const tgy = p.startY + (p.endY-p.startY)*tp;
      const tgp = isArc
        ? projectAtWorldY(tgx, tgy, projectileArcWorldY(p.startX, p.startY, p.endX, p.endY, tp))
        : project(tgx, tgy);
      const tx = tgp.x, ty = tgp.y;
      ctx.beginPath();
      ctx.fillStyle = `rgba(217,164,65,${0.35-k*0.1})`;
      ctx.arc(tx,ty,3-k*0.5,0,Math.PI*2);
      ctx.fill();
    }

    // shell itself
    ctx.beginPath();
    ctx.fillStyle = '#f2c869';
    ctx.arc(x,y,4,0,Math.PI*2);
    ctx.fill();
  });

  // enemy tracers ― incoming/outgoing direct fire (counter-attack on FDC / infantry duel
  // casualties / all outgoing friendly fire, see fireTracer()). Rendering branches on
  // tr.weaponType so each weapon family reads distinctly instead of one shared straight
  // orange tracer for every shot in the game (per user request).
  enemyTracers.forEach(tr=>{
    const prog = clamp((nowP-tr.born)/tr.duration, 0, 1);
    const wt = tr.weaponType || 'rifle';

    if(wt === 'missile'){
      // guided SAM missile: a wobbling smoke trail (not an instant straight line) so it
      // reads as something flying rather than a hitscan shot, with a bright flame at the tip.
      const dx = tr.endX-tr.startX, dy = tr.endY-tr.startY;
      const len = Math.hypot(dx,dy) || 1;
      const nx = -dy/len, ny = dx/len;
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(215,215,210,0.55)';
      ctx.lineWidth = 2.2;
      const SEGS = 10;
      for(let s=0;s<=SEGS;s++){
        const sp = Math.min(prog, s/SEGS);
        const lx = tr.startX+dx*sp, ly = tr.startY+dy*sp;
        const wob = Math.sin(sp*Math.PI*3 + tr.born*0.01) * 6 * Math.sin(sp*Math.PI);
        const wp = projectAtWorldY(lx+nx*wob, ly+ny*wob, tracerWorldY(tr.startX,tr.startY,tr.endX,tr.endY,sp));
        if(s===0) ctx.moveTo(wp.x, wp.y); else ctx.lineTo(wp.x, wp.y);
      }
      ctx.stroke();
      const tip = projectAtWorldY(tr.startX+dx*prog, tr.startY+dy*prog, tracerWorldY(tr.startX,tr.startY,tr.endX,tr.endY,prog));
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255,170,80,0.95)';
      ctx.arc(tip.x, tip.y, 3.4, 0, Math.PI*2);
      ctx.fill();
      return;
    }

    if(wt === 'drone'){
      // suicide drone dive: an accelerating red point punching straight at the target,
      // not a tracer line -- reads as a body/warhead closing in, not a shot being fired.
      const ease = prog*prog;
      const dp = projectAtWorldY(tr.startX+(tr.endX-tr.startX)*ease, tr.startY+(tr.endY-tr.startY)*ease, tracerWorldY(tr.startX,tr.startY,tr.endX,tr.endY,ease));
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255,90,70,0.9)';
      ctx.arc(dp.x, dp.y, 3+prog*2, 0, Math.PI*2);
      ctx.fill();
      return;
    }

    // rifle (small arms: squad/anti-drone point defense/generic enemy infantry),
    // cannon (tank/vehicle direct-fire guns), and heli (attack helicopter gun/rocket runs)
    // all share this trailing-tracer-with-shell shape, differing only in color/thickness.
    const style = wt==='cannon' ? {trail:'255,235,200,0.4', core:'255,235,205,0.95', shell:'#fff6dd', width:4,   shellR:4.2}
                : wt==='heli'   ? {trail:'255,110,90,0.35',  core:'255,120,95,0.95',  shell:'#ffcabe', width:2.4, shellR:3}
                :                 {trail:'255,120,80,0.3',   core:'255,140,80,0.9',   shell:'#ffcf9e', width:2,   shellR:2.8};
    const gx = tr.startX + (tr.endX-tr.startX)*prog;
    const gy = tr.startY + (tr.endY-tr.startY)*prog;
    const gp = projectAtWorldY(gx, gy, tracerWorldY(tr.startX,tr.startY,tr.endX,tr.endY,prog));
    const x = gp.x, y = gp.y;
    const trailProg = Math.max(0, prog-0.25);
    const tgx = tr.startX + (tr.endX-tr.startX)*trailProg;
    const tgy = tr.startY + (tr.endY-tr.startY)*trailProg;
    const tgp = projectAtWorldY(tgx, tgy, tracerWorldY(tr.startX,tr.startY,tr.endX,tr.endY,trailProg));
    const startG = project(tr.startX, tr.startY);
    const endG = project(tr.endX, tr.endY);
    ctx.beginPath();
    ctx.strokeStyle = `rgba(${style.trail})`;
    ctx.lineWidth = 1;
    ctx.moveTo(startG.x, startG.y);
    ctx.lineTo(endG.x, endG.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.strokeStyle = `rgba(${style.core})`;
    ctx.lineWidth = style.width;
    ctx.moveTo(tgp.x, tgp.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = style.shell;
    ctx.arc(x, y, style.shellR, 0, Math.PI*2);
    ctx.fill();
  });

  // impact flashes ― a "big" flash (destruction events, see spawnDestructionEffect) is a
  // much larger, whiter-hot version of the same ring+core rather than a separate visual
  // language; spawnDestructionEffect pushes two staggered big flashes per kill for a
  // boom-BOOM double pulse instead of one flat pop.
  flashes.forEach(f=>{
    const p = (nowP-f.born)/f.life;
    const fp = project(f.x, f.y);
    // muzzle flashes (see fireTracer()) are a tiny, near-instant bright core at the shooter's
    // own position -- no ring, no big/small scaling -- kept visually distinct from the
    // ring+core impact/explosion language below.
    if(f.muzzle){
      const mst = MUZZLE_STYLE[f.weaponType] || MUZZLE_STYLE.rifle;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${mst.color},${Math.max(0,1-p)})`;
      ctx.arc(fp.x, fp.y, Math.max(0, 4.5*mst.scale*(1-p)), 0, Math.PI*2);
      ctx.fill();
      return;
    }
    const scale = f.big ? 3.4 : 1;
    ctx.beginPath();
    ctx.strokeStyle = f.big ? `rgba(255,235,205,${1-p})` : `rgba(255,140,60,${1-p})`;
    ctx.lineWidth = f.big ? 5 : 2.5;
    // spawnDestructionEffect schedules a second flash with born set ~130ms in the future
    // (for the boom-BOOM double pulse) -- until that time arrives, p is negative here, and
    // without clamping to 0 this radius goes negative too. ctx.arc() throws on a negative
    // radius, which was silently killing the whole requestAnimationFrame loop (the map
    // freezing) on every single kill, not just multi-kill bursts.
    ctx.arc(fp.x, fp.y, Math.max(0, (6+p*38)*scale), 0, Math.PI*2);
    ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = f.big ? `rgba(255,240,210,${(1-p)*0.9})` : `rgba(255,200,120,${(1-p)*0.8})`;
    ctx.arc(fp.x, fp.y, Math.max(0,(f.big?22:6)-p*(f.big?22:6)), 0, Math.PI*2);
    ctx.fill();
  });

  // explosion shockwaves ― a fast, bright expanding ring layered on top of the flash/debris
  // for a physically forceful "boom" (see spawnDestructionEffect). Kept separate from
  // `ripples` (the slower amber recon-ping animation below) so the two don't compete visually.
  setShockwaves(shockwaves.filter(s => nowP-s.born < s.life));
  shockwaves.forEach(s=>{
    const p = (nowP-s.born)/s.life;
    const sp2 = project(s.x, s.y);
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255,255,240,${(1-p)*0.85})`;
    ctx.lineWidth = 4*(1-p*0.6);
    ctx.arc(sp2.x, sp2.y, 10+p*95, 0, Math.PI*2);
    ctx.stroke();
  });

  // debris particles ― fragments flung outward from a destruction, falling with gravity
  setDebrisParticles(debrisParticles.filter(d=>nowP-d.born < d.life));
  debrisParticles.forEach(d=>{
    const t = (nowP-d.born)/1000;
    const gx = d.x + d.vx*t;
    const gy = d.y + d.vy*t + 55*t*t;
    const dp = project(gx, gy);
    const age = (nowP-d.born)/d.life;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1-age);
    ctx.fillStyle = d.color || '#ffb45a';
    ctx.beginPath();
    ctx.arc(dp.x, dp.y, 3.5, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  });

  // wreck smoke ― a dark column that drifts up and fades over several seconds, marking
  // where something was destroyed
  setWreckSmokes(wreckSmokes.filter(w=>nowP-w.born < w.life));
  wreckSmokes.forEach(w=>{
    const age = (nowP-w.born)/w.life;
    const wp = project(w.x, w.y - age*55);
    const alpha = (1-age)*0.58;
    if(alpha<=0) return;
    [
      {dx:0,dy:0,r:24+age*16},{dx:-10,dy:-6,r:18+age*13},{dx:10,dy:-8,r:18+age*13},
      {dx:-16,dy:6,r:14+age*10},{dx:15,dy:8,r:14+age*10},
    ].forEach(pf=>{
      ctx.beginPath();
      ctx.fillStyle = `rgba(28,26,24,${alpha})`;
      ctx.arc(wp.x+pf.dx, wp.y+pf.dy, pf.r, 0, Math.PI*2);
      ctx.fill();
    });
  });

  // kill banners ― a floating "撃破!" (or friendly-loss equivalent) that pops in big, then
  // settles, rises and fades
  setKillBanners(killBanners.filter(b=>nowP-b.born < b.life));
  killBanners.forEach(b=>{
    const age = (nowP-b.born)/b.life;
    const bp = project(b.x, b.y - age*30);
    const alpha = 1 - Math.max(0, (age-0.6)/0.4);
    const popIn = 200;
    const elapsedMs = nowP-b.born;
    const popScale = elapsedMs<popIn ? 1.7 - 0.7*(elapsedMs/popIn) : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.translate(bp.x, bp.y);
    ctx.scale(popScale, popScale);
    ctx.font = mfont('bold 20px "JetBrains Mono"');
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    ctx.strokeText(b.text, 0, 0);
    ctx.fillStyle = b.color || LABEL_TEXT_COLOR;
    ctx.fillText(b.text, 0, 0);
    ctx.restore();
  });

  // ripples (recon ping animation)
  const now = performance.now();
  setRipples(ripples.filter(r => now - r.born < r.life));
  ripples.forEach(r=>{
    const p = (now-r.born)/r.life;
    const rp = project(r.x, r.y);
    ctx.beginPath();
    ctx.strokeStyle = `rgba(217,164,65,${1-p})`;
    ctx.lineWidth = 2;
    ctx.arc(rp.x, rp.y, 10+p*40, 0, Math.PI*2);
    ctx.stroke();
  });

  // smoke clouds (発煙弾) ― billowing, semi-transparent blobs that fade as they age. The
  // billow/drift/wobble below runs on real elapsed time (c.born) rather than c.turnsLeft
  // (which only ticks once per game turn) so the cloud keeps moving continuously between
  // turns instead of sitting frozen as a static image.
  (state.smokeClouds||[]).forEach(c=>{
    const cp = project(c.x, c.y);
    if(!cp.visible) return;
    const age = 1 - clamp(c.turnsLeft/SMOKE_DURATION_TURNS, 0, 1);
    const alpha = 0.5 - age*0.2;
    const t = (performance.now() - (c.born||0)) / 1000;
    const grow = 1 + t*0.06;
    const rise = t*3;
    const puffs = [
      {dx:0, dy:0, r:26}, {dx:-14, dy:6, r:18}, {dx:14, dy:5, r:19},
      {dx:-6, dy:-12, r:16}, {dx:9, dy:-10, r:15},
    ];
    puffs.forEach((pf,i)=>{
      const wob = Math.sin(t*0.7 + i*1.7) * 4;
      ctx.beginPath();
      ctx.fillStyle = `rgba(210,210,205,${alpha})`;
      ctx.arc(cp.x+pf.dx*grow+wob, cp.y+pf.dy*grow-rise, pf.r*grow, 0, Math.PI*2);
      ctx.fill();
    });
  });

  // illumination flares (照明弾) ― bursts high above the ground point, then a bright light
  // ball drifts slowly down over ILLUM_FALL_DURATION while a soft glow lights up the ground
  // below it; the ground glow itself persists for the flare's full turnsLeft lifetime.
  (state.illumFlares||[]).forEach(f=>{
    const gp = project(f.x, f.y);
    if(!gp.visible) return;
    const lifeAge = 1 - clamp(f.turnsLeft/ILLUM_DURATION_TURNS, 0, 1);
    const groundAlpha = 0.4 - lifeAge*0.22;
    if(groundAlpha > 0){
      const glowR = ILLUM_RADIUS_UNITS;
      const grad = ctx.createRadialGradient(gp.x, gp.y, 0, gp.x, gp.y, glowR);
      grad.addColorStop(0, `rgba(255,248,210,${groundAlpha})`);
      grad.addColorStop(0.6, `rgba(255,240,180,${groundAlpha*0.5})`);
      grad.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.beginPath();
      ctx.fillStyle = grad;
      ctx.arc(gp.x, gp.y, glowR, 0, Math.PI*2);
      ctx.fill();
    }
    const fallAge = nowP - f.born;
    if(fallAge < ILLUM_FALL_DURATION){
      const fallP = clamp(fallAge/ILLUM_FALL_DURATION, 0, 1);
      const flareX = gp.x, flareY = gp.y - ILLUM_BURST_HEIGHT*(1-fallP);
      if(fallAge < 260){
        const burstP = fallAge/260;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(255,250,220,${1-burstP})`;
        ctx.lineWidth = 2;
        ctx.arc(flareX, flareY, 6+burstP*20, 0, Math.PI*2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,244,200,0.35)';
      ctx.lineWidth = 1.5;
      ctx.moveTo(flareX, gp.y);
      ctx.lineTo(flareX, flareY);
      ctx.stroke();
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255,250,225,0.3)';
      ctx.arc(flareX, flareY, 9, 0, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255,250,225,0.95)';
      ctx.arc(flareX, flareY, 3.5, 0, Math.PI*2);
      ctx.fill();
    }
  });

  // weather particles (rain streaks / drifting fog wisps) ― see ensureWeatherParticles()
  ensureWeatherParticles(cv.width, cv.height);
  if(state.weather === 'rain'){
    ctx.strokeStyle = 'rgba(200,215,230,0.35)';
    ctx.lineWidth = 1;
    weatherParticles.forEach(p=>{
      p.y += p.speed; p.x -= p.speed*0.25;
      if(p.y > cv.height){ p.y = -p.len; p.x = Math.random()*cv.width; }
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.len*0.25, p.y + p.len);
      ctx.stroke();
    });
  } else if(state.weather === 'fog'){
    weatherParticles.forEach(p=>{
      p.x += p.speed;
      if(p.x - p.r > cv.width) p.x = -p.r;
      ctx.beginPath();
      ctx.fillStyle = `rgba(210,215,205,${p.alpha})`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fill();
    });
  }

  // manual placement highlight ― pulses around the unit awaiting a click-placed position
  if(state.placementPending){
    const item = state.placementQueue[state.placementIndex];
    const unit = currentPlacementUnit(item);
    if(unit){
      const up = project(unit.x, unit.y);
      const pulse = 6 + Math.sin(performance.now()*0.006)*4;
      ctx.beginPath();
      ctx.strokeStyle = '#d9a441';
      ctx.lineWidth = 2;
      ctx.setLineDash([4,3]);
      ctx.arc(up.x, up.y, 20+pulse, 0, Math.PI*2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#d9a441';
      ctx.font = mfont('bold 13px "JetBrains Mono"');
      ctx.textAlign = 'center';
      ctx.fillText(`▼ ${item.label} を配置`, up.x, up.y-30-pulse);
    }
  }

  drawCallouts(ctx);
  ctx.restore();
}


Object.assign(window, { mortarStatusIcon, drawUnitBase, drawUnitIcon, drawTankIcon, drawSamIcon, drawEngineerIcon, drawMedicIcon, drawWallShape, drawAttritionBar, drawSelectionRing, drawMinimap, drawBoard });
