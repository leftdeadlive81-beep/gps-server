// Split out of the former monolithic mortar_fdc_game.js.
import { computeDispersionAt, currentPlacementUnit, estPos, isSuppressed, isTargetDetected, smoothVisualPos, state, unitAlive, unitAliveCount } from './combat.js';
import { CANVAS_H, CANVAS_W, CONTOUR_LINES_CANVAS, ENEMY_MARK_COLOR, ESTIMATE_MARKER_RADIUS_UNITS, FEBA_LINE_COLOR, FEBA_LINE_WIDTH, FRIENDLY_MARK_COLOR, GRID_LINES, ILLUM_BURST_HEIGHT, ILLUM_DURATION_TURNS, ILLUM_FALL_DURATION, ILLUM_RADIUS_UNITS, LABEL_TEXT_COLOR, MAP_VIEW, MORTAR_MAINLINE_HALF_FOV, MORTAR_MAINLINE_RANGE_UNITS, MORTAR_MIN_RANGE_UNITS, MORTAR_RELOAD_MS, MUZZLE_STYLE, ORDER_ICON, HELI_MAX_RANGE_UNITS, SCOUT_MAX_RANGE_UNITS, SMOKE_DURATION_TURNS, SNIPER_AIM_RANGE_UNITS, SQUAD_ENGAGE_RANGE, TRENCH_LINE_COLOR, TRENCH_LINE_WIDTH, UNCERTAINTY_CIRCLE_CAP, UNCERTAINTY_CIRCLE_MIN, UNCERTAINTY_CIRCLE_SCALE, WEATHER_TYPES, WORLD, enemyInfantryIcon, infantryIcon, mortarIcon } from './constants.js';
import { isMultiSelected } from './input.js';
import { choppedLineSegments, febaLineSegments } from './terrain.js';
import { project, projectAtWorldY, scaledIconH, threeReady } from './three.js';
import { bearingToXY, clamp } from './utils.js';
import { currentShakeOffset, debrisParticles, enemyTracers, ensureWeatherParticles, flashes, killBanners, projectileArcWorldY, projectiles, ripples, setDebrisParticles, setKillBanners, setRipples, setShockwaves, setWreckSmokes, shockwaves, tracerWorldY, weatherParticles, wreckSmokes } from './vfx.js';
import { drawCallouts } from './voice.js';

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

export function estMarkerOffsetFor(t){
  if(!t._estMarkerOffset){
    const ang = Math.random()*Math.PI*2;
    const dist = Math.sqrt(Math.random())*ESTIMATE_MARKER_RADIUS_UNITS; // uniform over the disc, not biased toward center
    t._estMarkerOffset = {dx: Math.cos(ang)*dist, dy: Math.sin(ang)*dist};
  }
  return t._estMarkerOffset;
}

export function drawEstimatedPositionMarker(ctx, t){
  const off = estMarkerOffsetFor(t);
  const mx = t.trueX+off.dx, my = t.trueY+off.dy;
  const m = project(mx, my);
  if(!m.visible) return;
  ctx.beginPath();
  ctx.fillStyle = '#e8d23a';
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1;
  ctx.arc(m.x, m.y, 6, 0, Math.PI*2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e8d23a';
  ctx.font = '12px "JetBrains Mono"';
  ctx.textAlign = 'center';
  ctx.fillText(`${t.id} 見積もり位置`, m.x, m.y-12);
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

export function drawMinimap(){
  const cv = document.getElementById('minimap');
  if(!cv || !state) return;
  const ctx = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  ctx.clearRect(0,0,w,h);
  const sx = wx => (wx/CANVAS_W)*w;
  const sy = wy => (wy/CANVAS_H)*h;
  (state.roads||[]).forEach((road, roadIdx)=>{
    const kind = (state.roadKinds||[])[roadIdx] || 'main';
    ctx.beginPath();
    road.forEach((p, i)=>{
      if(i===0) ctx.moveTo(sx(p.x), sy(p.y));
      else ctx.lineTo(sx(p.x), sy(p.y));
    });
    ctx.strokeStyle = kind==='dirt' ? 'rgba(150,110,70,0.8)' : kind==='branch' ? 'rgba(145,145,120,0.85)' : 'rgba(185,181,155,0.9)';
    ctx.lineWidth = kind==='dirt' ? 1 : 1.5;
    ctx.stroke();
  });

  const friendlyPts = [];
  if(state.hq && state.hq.hp>0) friendlyPts.push([state.hq.x, state.hq.y]);
  state.mortars.forEach(m=>{ if(m.hp>0) friendlyPts.push([m.x, m.y]); });
  state.tanks.forEach(tk=>{ if(tk.hp>0) friendlyPts.push([tk.x, tk.y]); });
  state.sams.forEach(sam=>{ if(sam.hp>0) friendlyPts.push([sam.x, sam.y]); });
  state.scouts.forEach(s=>{ if(unitAlive(s)) friendlyPts.push([s.x, s.y]); });
  (state.helis||[]).forEach(h=>{ if(h.hp>0) friendlyPts.push([h.x, h.y]); });
  state.squads.forEach(sq=>{ if(sq.soldiers.some(s=>s.alive)) friendlyPts.push([sq.x, sq.y]); });
  state.snipers.forEach(sn=>{ if(sn.soldiers.some(s=>s.alive)) friendlyPts.push([sn.x, sn.y]); });
  ctx.fillStyle = FRIENDLY_MARK_COLOR;
  friendlyPts.forEach(([x,y])=>{
    ctx.beginPath();
    ctx.arc(sx(x), sy(y), 1.6, 0, Math.PI*2);
    ctx.fill();
  });

  ctx.fillStyle = ENEMY_MARK_COLOR;
  state.targets.forEach(t=>{
    if(t.destroyed || !isTargetDetected(t)) return;
    const e = estPos(t);
    ctx.beginPath();
    ctx.arc(sx(e.x), sy(e.y), 1.6, 0, Math.PI*2);
    ctx.fill();
  });

  // combat hotspots -- any still-live flash (impact/hit effect) reads as "fighting is
  // happening here right now", pulsing/fading exactly in step with the flash it mirrors.
  const now = performance.now();
  flashes.forEach(f=>{
    const age = now-f.born;
    if(age>f.life) return;
    const frac = 1-(age/f.life);
    ctx.beginPath();
    ctx.fillStyle = `rgba(240,113,95,${(0.25+0.55*frac).toFixed(2)})`;
    ctx.arc(sx(f.x), sy(f.y), (f.big?4.5:3)*(0.6+0.6*frac), 0, Math.PI*2);
    ctx.fill();
  });

  // rough current-viewport rectangle, so the minimap also shows where the main camera is
  // currently looking, not just where units/combat are.
  const viewW = clamp(w/MAP_VIEW.zoom, 8, w);
  const viewH = clamp(h/MAP_VIEW.zoom, 6, h);
  ctx.strokeStyle = 'rgba(217,164,65,0.8)';
  ctx.lineWidth = 1;
  ctx.strokeRect(sx(MAP_VIEW.cx)-viewW/2, sy(MAP_VIEW.cy)-viewH/2, viewW, viewH);
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
  const nowWander = performance.now();

  // Roads are drawn over the 3D terrain as a crisp tactical-map overlay. The
  // terrain texture carries the broad road surface; this pass adds lane/edge
  // definition without making distant segments connect through the camera.
  if(state.roads){
    const projectRoad = road=>{
      const points = [];
      for(let i=0;i<road.length-1;i++){
        const a = road[i], b = road[i+1];
        const steps = Math.max(1, Math.ceil(Math.hypot(b.x-a.x, b.y-a.y)/18));
        for(let j=0;j<steps;j++){
          const t = j/steps;
          points.push(project(a.x+(b.x-a.x)*t, a.y+(b.y-a.y)*t));
        }
      }
      const last = road[road.length-1];
      if(last) points.push(project(last.x,last.y));
      return points;
    };
    const strokePath = (proj, color, width, dash)=>{
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if(dash) ctx.setLineDash(dash);
      let started = false;
      proj.forEach(p=>{
        if(!p.visible){ started = false; return; }
        if(!started){ ctx.moveTo(p.x,p.y); started = true; }
        else ctx.lineTo(p.x,p.y);
      });
      ctx.stroke();
      if(dash) ctx.setLineDash([]);
    };
    state.roads.forEach((road, roadIdx)=>{
      const proj = projectRoad(road);
      const kind = (state.roadKinds||[])[roadIdx] || 'main';
      const width = kind==='dirt' ? 3 : kind==='branch' ? 5 : 7;
      const base = kind==='dirt' ? 'rgba(139,106,67,0.72)' : kind==='branch' ? 'rgba(123,122,103,0.72)' : 'rgba(145,143,127,0.78)';
      const center = kind==='dirt' ? 'rgba(196,157,107,0.45)' : 'rgba(218,211,180,0.58)';
      strokePath(proj, base, width, null);
      strokePath(proj, center, kind==='dirt' ? 1 : 2, kind==='dirt' ? [4,6] : [10,8]);
    });
  }

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
  strokeGridBucket(GRID_LINES.minor, 'rgba(220,225,235,0.12)', 1);
  strokeGridBucket(GRID_LINES.major, 'rgba(220,225,235,0.28)', 1);

  // per user request: topographic-map-style contour lines (see buildContourLines()), drawn
  // the same way roads were above -- endpoints whose height was cached per-wave (see
  // cacheGroundLineHeights() in three.js) use projectAtWorldY() directly instead of
  // re-deriving it from project()'s own elevation lookup every frame; segments whose
  // endpoints fall off-screen just aren't drawn rather than being connected through.
  if(CONTOUR_LINES_CANVAS.length){
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(150,110,55,0.55)';
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

  // per user request: FEBA (主戦闘地域前縁) line -- the X that the "前進"/"後退" standing
  // orders advance to/fall back to, now tracking our infantry's own frontmost position
  // automatically (computeFebaX(), recomputed every simulationStep) instead of being
  // player-draggable. Drawn thick and blue so it reads clearly against the terrain/units.
  strokeGridBucket(febaLineSegments(state.febaX), FEBA_LINE_COLOR, FEBA_LINE_WIDTH);

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
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.font = 'bold 15px "JetBrains Mono"';
    ctx.textAlign = 'center';
    ctx.fillText(hqAlive?'指揮所':'指揮所(壊滅)', 0, 34);
    if(hqAlive && hq.pendingDest){
      ctx.font = 'bold 13px "JetBrains Mono"';
      ctx.fillText('[移転中]', 0, 50);
    }
    ctx.restore();

    if(hqAlive){
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
    ctx.font = '12px "JetBrains Mono"';
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
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.font = '15px "JetBrains Mono"';
    ctx.textAlign='center';
    ctx.fillText(mAlive?`迫撃砲${mortar.id+1} ${mortarStatusIcon(mortar)}`:`迫撃砲${mortar.id+1}(戦闘不能)`, 0, 44);
    ctx.restore();

    if(mAlive){
      drawAttritionBar(ctx, mVis.x+18, mVis.y-2, mortar.hp/mortar.maxHp);
    }
  });

  // scout/heli detection radius, all-around ― drawn before the markers so it sits underneath.
  // per user request: replaces the former ~45deg scout observation cone -- detection no longer
  // depends on facing, so this is just an outline circle showing how far a unit can spot
  // targets in any direction (still subject to line-of-sight, see inScoutRangeFor). The heli
  // previously had no matching circle at all (its own separate rectangular observation-area
  // display was removed per user request) -- it now shares this exact same drawing, just with
  // its own (larger) range.
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
  const drawGroundDetectionCircle = (centerL, radius)=>{
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
    ctx.strokeStyle = 'rgba(111,155,191,0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
  };
  state.scouts.forEach(scout=>{
    const scoutVisL = smoothVisualPos(scout, scout.x, scout.y);
    const scoutVis = project(scoutVisL.x, scoutVisL.y);
    if(unitAlive(scout) && scoutVis.visible) drawGroundDetectionCircle(scoutVisL, SCOUT_MAX_RANGE_UNITS);
  });
  (state.helis||[]).forEach(heli=>{
    const heliVisL = smoothVisualPos(heli, heli.x, heli.y);
    const heliVis = project(heliVisL.x, heliVisL.y);
    if(heli.hp>0 && heliVis.visible) drawGroundDetectionCircle(heliVisL, HELI_MAX_RANGE_UNITS);
  });

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
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.font = '15px "JetBrains Mono"';
    ctx.textAlign = 'center';
    ctx.fillText(`ヘリ${heliIdx+1} [観測]`, 0, -20);
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
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.font = '15px "JetBrains Mono"';
    ctx.textAlign='center';
    ctx.fillText(scoutAlive?`斥候${scout.id+1} ${aliveCount}/${scout.soldiers.length}`:`斥候${scout.id+1}(戦闘不能)`, 0, -20);
    if(scoutAlive){
      let scoutOrderLabel = '[観測]';
      if(scout.resting) scoutOrderLabel = '[大休止]';
      else if(scout.pendingReconTargetId) scoutOrderLabel = '[偵察]';
      else if(scout.pendingDest) scoutOrderLabel = '[移動]';
      ctx.fillStyle = LABEL_TEXT_COLOR;
      ctx.font = 'bold 13px "JetBrains Mono"';
      ctx.fillText(scoutOrderLabel, 0, 28);
    }
    ctx.restore();

    if(scoutAlive){
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
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.font = '15px "JetBrains Mono"';
    ctx.textAlign='center';
    // per user request: order status shown as a single icon glyph (see ORDER_ICON) instead of
    // bracketed Japanese text, and merged onto the name's own line -- packed friendly deployment
    // areas were an unreadable wall of overlapping two-line labels on small screens.
    const tOrderIcon = ORDER_ICON[tank.order] + (tank.pendingDest ? '→' : '');
    ctx.fillText(tAlive?`戦車${tank.id+1} ${tOrderIcon}`:`戦車${tank.id+1}(撃破)`, 0, 44);
    ctx.restore();

    if(tAlive){
      drawAttritionBar(ctx, tVis.x+18, tVis.y-2, tank.hp/tank.maxHp);
      if(tank.order==='hunt' && tank.huntTargetId){
        const t = state.targets.find(x=>x.id===tank.huntTargetId);
        if(t && !t.destroyed && isTargetDetected(t)){
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
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.font = '15px "JetBrains Mono"';
    ctx.textAlign='center';
    const samOrderIcon = ORDER_ICON[sam.order] + (sam.pendingDest ? '→' : '');
    ctx.fillText(samAlive?`対空${sam.id+1} ${samOrderIcon}`:`対空${sam.id+1}(撃破)`, 0, 44);
    ctx.restore();

    if(samAlive){
      drawAttritionBar(ctx, samVis.x+18, samVis.y-2, sam.hp/sam.maxHp);
      if(sam.order==='hunt' && sam.huntTargetId){
        const t = state.targets.find(x=>x.id===sam.huntTargetId);
        if(t && !t.destroyed && isTargetDetected(t)){
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
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.font = '14px "JetBrains Mono"';
    ctx.textAlign='center';
    const enOrderIcon = aliveSoldiers.length>0 ? ` ${ORDER_ICON[en.order]}${en.pendingDest?'→':''}` : '';
    ctx.fillText(`工兵 ${aliveSoldiers.length}/${en.soldiers.length}${enOrderIcon}`, 0, 28);
    ctx.restore();
    if(aliveSoldiers.length>0) drawAttritionBar(ctx, enVis.x+18, enVis.y, aliveSoldiers.length/en.soldiers.length);
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
      if(aliveSoldiers.length>0) drawAttritionBar(ctx, sqVis.x+32, sqVis.y, aliveSoldiers.length/sq.soldiers.length);
      ctx.fillStyle = aliveSoldiers.length>0 ? LABEL_TEXT_COLOR : '#5c2a25';
      ctx.font = '14px "JetBrains Mono"';
      ctx.textAlign='center';
      const sqOrderIcon = ORDER_ICON[sq.order] + (sq.pendingDest ? '→' : '');
      ctx.fillText(`第${sqIdx+1}小隊 ${aliveSoldiers.length}/${sq.soldiers.length} ${sqOrderIcon}`, sqVis.x, sqVis.y+28);

      if(aliveSoldiers.length>0){
        state.targets.filter(t=>!t.destroyed && t.type==='infantry' && isTargetDetected(t)).forEach(t=>{
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

  // friendly sniper teams (自軍) ― precision long-range fire teams
  if(state.snipers && state.snipers.length){
    state.snipers.forEach((sn, snIdx)=>{
      const snVisL = smoothVisualPos(sn, sn.x, sn.y);
      const snVis = project(snVisL.x, snVisL.y);
      const aliveSoldiers = sn.soldiers.filter(s=>s.alive);
      drawSelectionRing(ctx, snVis.x, snVis.y, (state.commandBox && state.commandBox.kind==='sniper' && state.commandBox.idx===snIdx) || isMultiSelected('sniper', snIdx));
      if(aliveSoldiers.length>0) drawAttritionBar(ctx, snVis.x+20, snVis.y, aliveSoldiers.length/sn.soldiers.length);
      ctx.fillStyle = aliveSoldiers.length>0 ? LABEL_TEXT_COLOR : '#5c2a25';
      ctx.font = '14px "JetBrains Mono"';
      ctx.textAlign='center';
      const snOrderIcon = ORDER_ICON[sn.order] + (sn.pendingDest ? '→' : '');
      ctx.fillText(`狙撃${snIdx+1}班 ${aliveSoldiers.length}/${sn.soldiers.length} ${snOrderIcon}`, snVis.x, snVis.y+27);

      if(aliveSoldiers.length>0 && sn.pendingSnipeTargetId){
        const t = state.targets.find(x=>x.id===sn.pendingSnipeTargetId);
        if(t && !t.destroyed && isTargetDetected(t)){
          const eL = estPos(t);
          const e = project(eL.x, eL.y);
          ctx.beginPath();
          ctx.setLineDash([2,4]);
          ctx.strokeStyle = 'rgba(111,155,191,0.5)';
          ctx.lineWidth = 1;
          ctx.moveTo(snVis.x, snVis.y);
          ctx.lineTo(e.x, e.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // firing-direction line ― solid blue, SNIPER_AIM_RANGE_UNITS long; any
      // enemy that overlaps it is auto-engaged (see findTargetOnSniperLine).
      if(aliveSoldiers.length>0 && sn.aimAngle!==null && sn.aimAngle!==undefined){
        const rad = sn.aimAngle*Math.PI/180;
        const endL = {x: sn.x+Math.sin(rad)*SNIPER_AIM_RANGE_UNITS, y: sn.y-Math.cos(rad)*SNIPER_AIM_RANGE_UNITS};
        const endVis = project(endL.x, endL.y);
        if(endVis.visible){
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(80,150,230,0.65)';
          ctx.lineWidth = 2;
          ctx.moveTo(snVis.x, snVis.y);
          ctx.lineTo(endVis.x, endVis.y);
          ctx.stroke();
        }
      }
    });
  }

  state.targets.forEach(t=>{
    // uncertainty circle
    if(!t.destroyed){
      if(!isTargetDetected(t)){
        // Known to exist (identified at some point) but not currently
        // pinned down by any detector -- show a rough last-known-area
        // marker instead of nothing.
        if(t.revealed) drawEstimatedPositionMarker(ctx, t);
        return;
      }
      const eLogical = estPos(t);
      const eVisL = smoothVisualPos(t, eLogical.x, eLogical.y);
      const e = project(eVisL.x, eVisL.y);
      // per user request: also highlight a target the player has merely opened the
      // attack-assignment box on (enemyCommandBox), not just one a mortar is actively
      // aimed at (selectedId) -- previously clicking a target to open that box gave no
      // on-map confirmation of which one was selected.
      const selected = t.id===state.selectedId || t.id===state.enemyCommandBox;
      ctx.beginPath();
      ctx.setLineDash([5,4]);
      ctx.strokeStyle = selected ? 'rgba(217,164,65,0.9)' : 'rgba(217,164,65,0.35)';
      ctx.lineWidth = 1.5;
      ctx.arc(e.x, e.y, clamp(t.posErr*UNCERTAINTY_CIRCLE_SCALE, UNCERTAINTY_CIRCLE_MIN, UNCERTAINTY_CIRCLE_CAP), 0, Math.PI*2);
      ctx.stroke();
      ctx.setLineDash([]);

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
        if(t.revealed) drawAttritionBar(ctx, e.x+14, e.y, t.hp/t.maxHp);
        labelY = e.y+26;
        if(t.revealed){
          ctx.fillStyle = LABEL_TEXT_COLOR;
          ctx.font = '14px "JetBrains Mono"';
          ctx.textAlign='center';
          ctx.fillText(`敵${t.def.label} ${aliveTroops.length}/${t.troops.length}`, e.x, labelY);
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
        if(t.revealed){
          ctx.fillStyle = LABEL_TEXT_COLOR;
          ctx.font = '14px "JetBrains Mono"';
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
        if(t.revealed){
          ctx.fillStyle = LABEL_TEXT_COLOR;
          ctx.font = '14px "JetBrains Mono"';
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
        if(t.revealed){
          ctx.fillStyle = LABEL_TEXT_COLOR;
          ctx.font = 'bold 14px "JetBrains Mono"';
          ctx.textAlign='center';
          ctx.fillText(t.def.label, e.x, labelY);
        }
      } else {
        ctx.fillStyle = t.revealed ? t.def.mark : '#8f9678';
        ctx.beginPath();
        ctx.arc(e.x,e.y,5,0,Math.PI*2);
        ctx.fill();
        if(t.revealed){
          ctx.fillStyle = LABEL_TEXT_COLOR;
          ctx.font = '14px "JetBrains Mono"';
          ctx.textAlign='center';
          ctx.fillText(t.def.label, e.x, labelY);
        }
      }

      // small HP bar above the marker
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
      ctx.font = 'bold 17px "JetBrains Mono"';
      ctx.textAlign='left';
      ctx.fillText(t.id, e.x+11, e.y-11);
      if(isSuppressed(t)){
        ctx.fillStyle = LABEL_TEXT_COLOR;
        ctx.font = 'bold 13px "JetBrains Mono"';
        ctx.textAlign = 'center';
        ctx.fillText('[制圧]', e.x, e.y-30);
      }
    } else {
      // reveal true position, destroyed mark
      const dp = project(t.trueX, t.trueY);
      ctx.strokeStyle = '#c1453b'; ctx.lineWidth=2;
      ctx.beginPath();
      ctx.moveTo(dp.x-8,dp.y-8); ctx.lineTo(dp.x+8,dp.y+8);
      ctx.moveTo(dp.x+8,dp.y-8); ctx.lineTo(dp.x-8,dp.y+8);
      ctx.stroke();
      ctx.fillStyle=LABEL_TEXT_COLOR; ctx.font='15px "JetBrains Mono"'; ctx.textAlign='center';
      ctx.fillText(t.id+' 撃破', dp.x, dp.y-16);
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

  // pending fire points ― effect radius + crosshair, awaiting execute/cancel
  if(!state.animating){
    const pendDispersion = computeDispersionAt() * WEATHER_TYPES[state.weather].dispersionMult;
    state.mortars.forEach(mortar=>{
      if(!mortar.pendingFire) return;
      const pp = project(mortar.pendingFire.x, mortar.pendingFire.y);
      const px = pp.x, py = pp.y;
      ctx.beginPath();
      ctx.setLineDash([4,4]);
      ctx.strokeStyle = 'rgba(193,69,59,0.85)';
      ctx.lineWidth = 1.5;
      ctx.arc(px, py, pendDispersion, 0, Math.PI*2);
      ctx.stroke();
      ctx.setLineDash([]);
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

    // rifle (small arms: squad/sniper/anti-drone point defense/generic enemy infantry),
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
    ctx.font = 'bold 20px "JetBrains Mono"';
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

  // weather tint overlay
  const weatherTint = state.weather && WEATHER_TYPES[state.weather].tint;
  if(weatherTint){
    ctx.fillStyle = weatherTint;
    ctx.fillRect(0,0,cv.width,cv.height);
  }

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
      ctx.font = 'bold 13px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText(`▼ ${item.label} を配置`, up.x, up.y-30-pulse);
    }
  }

  drawCallouts(ctx);
  ctx.restore();
}


Object.assign(window, { mortarStatusIcon, drawUnitBase, drawUnitIcon, drawTankIcon, drawSamIcon, drawEngineerIcon, drawWallShape, estMarkerOffsetFor, drawEstimatedPositionMarker, drawAttritionBar, drawSelectionRing, drawMinimap, drawBoard });
