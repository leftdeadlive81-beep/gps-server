// Split out of the former monolithic mortar_fdc_game.js.
import { applyBestMortarLoadout, buildTrenchAt, buildWallAt, estPos, estPosFromMortar, handlePlacementClick, mortarNotReadyToFire, mortarTooCloseToFire, mortarTooFarToFire, placeDecoyAt, resolveSmartUnitIdxs, state, unitAlive } from './combat.js';
import { CANVAS_H, CANVAS_W, DECOY_LONGPRESS_MOVE_TOLERANCE_PX, DECOY_LONGPRESS_MS, DIRECT_MOVE_KINDS, FRIENDLY_KIND_LIST, MAP_DOUBLETAP_ZOOM_LEVEL, MAP_POLAR_MAX, MAP_POLAR_MIN, MAP_VIEW, MAP_ZOOM_MAX, MAP_ZOOM_MIN, MORTAR_FIRE_READY_DELAY_MS, MORTAR_MAX_RANGE_M, MORTAR_MIN_RANGE_M, MORTAR_MOVE_START_DELAY_MS, MORTAR_ZONE_MAX_X, MORTAR_ZONE_MIN_X, MULTI_SELECT_KINDS, MULTI_SELECT_ORDER_SETTER, ORDER_LABEL, SCOUT_ADVANCE_LIMIT_X, SMART_UNIT_TYPES, SQUAD_ADVANCE_LIMIT_X, SQUAD_ASSAULT_LIMIT_X, SQUAD_RETREAT_LIMIT_X } from './constants.js';
import { render } from './main.js';
import { clampMapView, groundPlaneCanvasUnitAt, project, resizeThree, terrainCanvasUnitAt, threeReady, updateCameraFromView } from './three.js';
import { anyOverlayShown, log } from './ui.js';
import { bearingBetween, clamp } from './utils.js';

export function selectNextTarget(){
  const live = state.targets.filter(t=>!t.destroyed);
  if(live.length===0){ state.selectedId=null; return; }
  if(!live.some(t=>t.id===state.selectedId)) state.selectedId = live[0].id;
}

function directMoveTargetUnit(kind, idx){
  if(kind==='squad') return state.squads[idx];
  if(kind==='tank') return state.tanks[idx];
  if(kind==='sam') return state.sams[idx];
  if(kind==='hq') return state.hq;
  return null;
}

export function setUnitMoveDest(kind, idx, px, py, silent){
  if(kind==='squad'){
    const sq = state.squads[idx];
    if(!sq || sq.resting) return false;
    sq.pendingDest = { x: clamp(px, SQUAD_RETREAT_LIMIT_X, SQUAD_ASSAULT_LIMIT_X), y: clamp(py, 30, CANVAS_H-30) };
    if(!silent) log('sys','前線', `第${idx+1}小隊に移動目標を指示。`);
    return true;
  }
  if(kind==='tank'){
    const tank = state.tanks[idx];
    if(!tank || tank.hp<=0) return false;
    tank.pendingDest = { x: clamp(px, SQUAD_RETREAT_LIMIT_X, SQUAD_ASSAULT_LIMIT_X), y: clamp(py, 30, CANVAS_H-30) };
    if(!silent) log('sys','前線', `戦車${idx+1}に移動目標を指示。`);
    return true;
  }
  if(kind==='sam'){
    const sam = state.sams[idx];
    if(!sam || sam.hp<=0) return false;
    sam.pendingDest = { x: clamp(px, SQUAD_RETREAT_LIMIT_X, SQUAD_ASSAULT_LIMIT_X), y: clamp(py, 30, CANVAS_H-30) };
    if(!silent) log('sys','前線', `対空${idx+1}に移動目標を指示。`);
    return true;
  }
  if(kind==='hq'){
    if(state.hq.hp<=0) return false;
    state.hq.pendingDest = { x: clamp(px, SQUAD_RETREAT_LIMIT_X, SQUAD_ASSAULT_LIMIT_X), y: clamp(py, 30, CANVAS_H-30) };
    if(!silent) log('sys','前線', `指揮所に移転先を指示。`);
    return true;
  }
  if(kind==='engineer'){
    const en = state.engineers[idx];
    if(!en || !unitAlive(en) || en.resting) return false;
    en.pendingDest = { x: clamp(px, SQUAD_RETREAT_LIMIT_X, SQUAD_ASSAULT_LIMIT_X), y: clamp(py, 30, CANVAS_H-30) };
    if(!silent) log('sys','前線', `工兵小隊に移動目標を指示。`);
    return true;
  }
  if(kind==='sniper'){
    const sn = state.snipers[idx];
    if(!sn || !sn.soldiers.some(s=>s.alive) || sn.resting) return false;
    sn.pendingDest = { x: clamp(px, SQUAD_RETREAT_LIMIT_X, SQUAD_ADVANCE_LIMIT_X), y: clamp(py, 30, CANVAS_H-30) };
    if(!silent) log('sys','前線', `狙撃${idx+1}班に移動目標を指示。`);
    return true;
  }
  if(kind==='scout'){
    const scout = state.scouts[idx];
    if(!scout || !unitAlive(scout) || scout.resting) return false;
    scout.pendingDest = { x: clamp(px, SQUAD_RETREAT_LIMIT_X, SCOUT_ADVANCE_LIMIT_X), y: clamp(py, 20, CANVAS_H-20) };
    if(!silent) log('op','斥候', `斥候${idx+1}、移動目標を了解。`);
    return true;
  }
  if(kind==='mortar'){
    const mortar = state.mortars[idx];
    if(!mortar || mortar.hp<=0) return false;
    mortar.pendingDest = { x: clamp(px, MORTAR_ZONE_MIN_X, MORTAR_ZONE_MAX_X), y: clamp(py, 30, CANVAS_H-30) };
    // per user request: 10 seconds of packing up before it actually starts moving.
    mortar.moveDelayUntil = performance.now() + MORTAR_MOVE_START_DELAY_MS;
    if(!silent) log('mortar','迫撃砲班', `迫撃砲${idx+1}、陣地転換先を了解。撤収準備中(約${Math.round(MORTAR_MOVE_START_DELAY_MS/1000)}秒後に移動開始)。`);
    return true;
  }
  return false;
}

export let multiSelectMode = false;

export let multiSelected = [];

export function toggleMultiSelectMode(){
  multiSelectMode = !multiSelectMode;
  const btn = document.getElementById('multiSelectBtn');
  if(btn) btn.classList.toggle('active', multiSelectMode);
  if(multiSelectMode){
    state.commandBox = null;
    state.enemyCommandBox = null;
    state.decoyCommandBox = null;
    state.orderMode = null;
    state.smartOrderMode = null;
  } else {
    multiSelected = [];
  }
  render();
}

export function isMultiSelected(kind, idx){
  return multiSelectMode && multiSelected.some(e=>e.kind===kind && e.idx===idx);
}

export function pruneMultiSelected(){
  multiSelected = multiSelected.filter(({kind, idx})=>{
    if(kind==='squad') return state.squads[idx] && state.squads[idx].soldiers.some(s=>s.alive);
    if(kind==='tank') return state.tanks[idx] && state.tanks[idx].hp>0;
    if(kind==='sam') return state.sams[idx] && state.sams[idx].hp>0;
    if(kind==='sniper') return state.snipers[idx] && state.snipers[idx].soldiers.some(s=>s.alive);
    if(kind==='engineer') return state.engineers[idx] && unitAlive(state.engineers[idx]);
    return false;
  });
}

export function multiSelectCommonOrders(){
  if(!multiSelected.length) return ['advance','hold','retreat'];
  const allSquads = multiSelected.every(e=>e.kind==='squad');
  return allSquads ? ['advance','hold','assault','retreat'] : ['advance','hold','retreat'];
}

export function multiSelectSetOrder(order){
  if(!multiSelected.length) return;
  let count = 0;
  multiSelected.forEach(({kind, idx})=>{
    const setter = MULTI_SELECT_ORDER_SETTER[kind];
    if(setter){ setter(idx, order); count++; }
  });
  if(count>0) log('sys','司令部', `選択中の${count}隊に「${ORDER_LABEL[order]}」を指示。`);
  render();
}

export function handleMultiSelectClick(sx, sy, px, py){
  const hit = resolveClickHit(sx, sy);
  if(hit && hit.type==='friendly' && MULTI_SELECT_KINDS.includes(hit.payload.kind)){
    const {kind, idx} = hit.payload;
    const i = multiSelected.findIndex(e=>e.kind===kind && e.idx===idx);
    if(i>=0) multiSelected.splice(i,1);
    else multiSelected.push({kind, idx});
    return;
  }
  if(!hit && multiSelected.length){
    let moved = 0;
    multiSelected.forEach(({kind, idx})=>{ if(setUnitMoveDest(kind, idx, px, py, true)) moved++; });
    if(moved>0) log('sys','司令部', `選択中の${moved}隊に移動目標を指示。`);
  }
}

export function handleCanvasClick(evt){
  if(!state || state.stageResolved || state.animating || state.snipeMortarStrikesPending>0) return;
  if(mapDragMoved) return;
  const cv = document.getElementById('board');
  const rect = cv.getBoundingClientRect();
  const pxPixel = evt.clientX-rect.left, pyPixel = evt.clientY-rect.top;
  let px, py;
  if(threeReady){
    const g = terrainCanvasUnitAt(pxPixel, pyPixel);
    if(!g) return;
    px = g.x; py = g.y;
  } else {
    px = pxPixel/rect.width*CANVAS_W;
    py = pyPixel/rect.height*CANVAS_H;
  }
  // per user request: selecting an existing unit/target used to raycast the click onto the
  // terrain mesh and compare GROUND (x,y) distances -- exact when the camera looks straight
  // down, but under a tilted camera a tiny mismatch between the analytic terrainHeightAt()
  // used to place icons and the actual (triangulated) mesh surface the raycaster hits gets
  // magnified into a large screen-space offset, so you had to tap noticeably above a unit to
  // hit it. sx/sy is the click in the SAME space icons are drawn in (project()'s output), so
  // hit-testing against it is exactly WYSIWYG regardless of camera angle.
  const sx = threeReady ? pxPixel : px;
  const sy = threeReady ? pyPixel : py;

  if(state.placementPending){
    handlePlacementClick(px, py);
    return;
  }

  // per user request: "スマート操作" move orders (誰が→対象→移動) apply to every unit
  // resolved by resolveSmartUnitIdxs at once, using the exact same per-type zone clamps
  // as each unit's own individual move-order handling below.
  if(state.smartOrderMode){
    const mode = state.smartOrderMode;
    state.smartOrderMode = null;
    const idxs = resolveSmartUnitIdxs(mode.unitType, mode.unitScope);
    if(mode.unitType==='mortar'){
      idxs.forEach(idx=>{ const m = state.mortars[idx]; m.order = 'move'; m.pendingFire = null; });
    }
    idxs.forEach(idx=>setUnitMoveDest(mode.unitType, idx, px, py, true));
    log('sys','司令部', `スマート操作: ${SMART_UNIT_TYPES[mode.unitType].label} ${idxs.length}隊に移動目標を指示。`);
    render();
    return;
  }

  if(multiSelectMode){
    handleMultiSelectClick(sx, sy, px, py);
    render();
    return;
  }

  if(state.orderMode){
    const mode = state.orderMode;
    state.orderMode = null;
    if(mode.kind==='squad'){
      setUnitMoveDest('squad', mode.idx, px, py);
    } else if(mode.kind==='tank-move'){
      setUnitMoveDest('tank', mode.idx, px, py);
    } else if(mode.kind==='sam-move'){
      setUnitMoveDest('sam', mode.idx, px, py);
    } else if(mode.kind==='hq-move'){
      setUnitMoveDest('hq', mode.idx, px, py);
    } else if(mode.kind==='engineer-move'){
      setUnitMoveDest('engineer', mode.idx, px, py);
    } else if(mode.kind==='wall-build'){
      buildWallAt(clamp(px, 10, CANVAS_W-10), clamp(py, 20, CANVAS_H-20));
    } else if(mode.kind==='trench-build-p1'){
      // per user request: 塹壕は2点指定 -- 1回目のクリックで始点を記録し、orderModeを次の
      // ステップに付け替えて2回目のクリック(終点)を待つ。
      state.orderMode = { kind:'trench-build-p2', idx:mode.idx,
        x1: clamp(px, 10, CANVAS_W-10), y1: clamp(py, 20, CANVAS_H-20) };
      log('sys','工兵', `塹壕: 始点を指定。終点を地図でクリックしてください。`);
    } else if(mode.kind==='trench-build-p2'){
      buildTrenchAt(mode.x1, mode.y1, clamp(px, 10, CANVAS_W-10), clamp(py, 20, CANVAS_H-20));
    } else if(mode.kind==='scout-move'){
      setUnitMoveDest('scout', mode.idx, px, py);
    } else if(mode.kind==='mortar-target'){
      const mortar = state.mortars[mode.idx];
      if(mortar){
        const result = setPendingFireAt(px, py, sx, sy, mortar);
        if(result===true){
          log('fdc','FDC', `迫撃砲${mode.idx+1}、攻撃地点を了解。`);
        } else if(result==='far'){
          log('sys','システム', `迫撃砲${mode.idx+1}、目標が遠すぎます(最大射程${MORTAR_MAX_RANGE_M}m)。攻撃地点を再指定してください。`);
        } else if(result==='notready'){
          log('sys','システム', `迫撃砲${mode.idx+1}、陣地転換直後で射撃準備中。攻撃指示を却下。`);
        } else {
          log('sys','システム', `迫撃砲${mode.idx+1}、目標が近すぎます(最低射程${MORTAR_MIN_RANGE_M}m)。攻撃地点を再指定してください。`);
        }
      }
    } else if(mode.kind==='mortar-move'){
      setUnitMoveDest('mortar', mode.idx, px, py);
    } else if(mode.kind==='sniper-move'){
      setUnitMoveDest('sniper', mode.idx, px, py);
    } else if(mode.kind==='sniper-target'){
      const sn = state.snipers[mode.idx];
      const best = nearestVisibleTargetForScreen(sx, sy, 42);
      if(sn && best){
        sn.pendingSnipeTargetId = best.id;
        log('mortar','狙撃', `狙撃${mode.idx+1}班、${best.id} を狙撃目標に指示。`);
      } else {
        log('sys','システム','狙撃目標が見つかりません。捕捉中の目標付近をクリックしてください。');
      }
    } else if(mode.kind==='sniper-aim'){
      const sn = state.snipers[mode.idx];
      if(sn){
        sn.aimAngle = bearingBetween(sn.x, sn.y, px, py);
        log('mortar','狙撃', `狙撃${mode.idx+1}班、射撃方向 ${Math.round(sn.aimAngle)}° を指示。`);
      }
    } else if(mode.kind==='mortar-mainline'){
      const mortar = state.mortars[mode.idx];
      if(mortar){
        mortar.mainlineAngle = bearingBetween(mortar.x, mortar.y, px, py);
        log('mortar','迫撃砲班', `迫撃砲${mode.idx+1}、主線方位角 ${Math.round(mortar.mainlineAngle)}° を設定。`);
      }
    }
    render();
    return;
  }

  const hit = resolveClickHit(sx, sy);
  // per user request: while a squad/tank/SAM/HQ's command box is open, a plain click on
  // empty ground now moves it there directly instead of requiring "移動先を指定" first --
  // these are the only kinds where a click can unambiguously only ever mean "move" (mortar/
  // sniper/scout/engineer each have other click-based actions that still need their own
  // explicit arm button to stay unambiguous, see DIRECT_MOVE_KINDS above).
  if(!hit && state.commandBox && DIRECT_MOVE_KINDS.includes(state.commandBox.kind)){
    // per user request: this used to fire on ANY empty-ground click while the box was open,
    // including reopening an already-moving unit's box just to check on it -- the very next
    // click, even one only meant to look elsewhere on the map, silently overwrote its
    // pendingDest and yanked it off course (reported as the unit "suddenly returning to its
    // original position"). Now a plain empty-ground click only re-routes a unit that ISN'T
    // already mid-move; once it has a pendingDest in flight, the same click just closes the
    // box -- click the unit itself again to arm a fresh move order.
    const unit = directMoveTargetUnit(state.commandBox.kind, state.commandBox.idx);
    if(unit && !unit.pendingDest && setUnitMoveDest(state.commandBox.kind, state.commandBox.idx, px, py)){
      state.commandBox = null;
      render();
      return;
    }
    if(unit && unit.pendingDest){
      state.commandBox = null;
      render();
      return;
    }
  }
  state.decoyCommandBox = (hit && hit.type==='decoy') ? hit.payload : null;
  state.enemyCommandBox = (hit && hit.type==='enemy') ? hit.payload.id : null;
  state.commandBox = (hit && hit.type==='friendly') ? hit.payload : null;
  render();
}

export function nearestVisibleTargetForScreen(sx, sy, maxPx){
  let best=null, bestD=Infinity;
  state.targets.forEach(t=>{
    if(t.destroyed || !t.revealed) return;
    const vx = t._visX!==undefined ? t._visX : estPos(t).x;
    const vy = t._visY!==undefined ? t._visY : estPos(t).y;
    const p = project(vx, vy);
    const d = Math.hypot(p.x-sx, p.y-sy);
    if(d<bestD){ bestD=d; best=t; }
  });
  return (best && bestD<=maxPx) ? best : null;
}

export function setPendingFireAt(px, py, sx, sy, mortar){
  if(mortarNotReadyToFire(mortar)) return 'notready';
  const best = nearestVisibleTargetForScreen(sx, sy, 42);
  if(best){
    const e = estPosFromMortar(mortar, best);
    if(mortarTooCloseToFire(mortar, e.x, e.y)) return 'close';
    if(mortarTooFarToFire(mortar, e.x, e.y)) return 'far';
    state.selectedId = best.id;
    mortar.pendingFire = {x:e.x, y:e.y, snappedId:best.id};
    applyBestMortarLoadout(mortar, best);
  } else {
    if(mortarTooCloseToFire(mortar, px, py)) return 'close';
    if(mortarTooFarToFire(mortar, px, py)) return 'far';
    state.selectedId = null;
    mortar.pendingFire = {x:px, y:py, snappedId:null};
  }
  mortar.order = 'fire';
  return true;
}

export function canvasToScreen(cx, cy){
  const cv = document.getElementById('board');
  const rect = cv.getBoundingClientRect();
  if(threeReady){
    const p = project(cx, cy);
    return { x: rect.left + p.x, y: rect.top + p.y };
  }
  return { x: rect.left + cx/CANVAS_W*rect.width, y: rect.top + cy/CANVAS_H*rect.height };
}

export let clickCycleState = null;

export function collectClickCandidates(sx, sy){
  const candidates = [];
  state.decoys.forEach((d,idx)=>{
    if(d.destroyed) return;
    const p = project(d.x, d.y);
    const dist = Math.hypot(p.x-sx, p.y-sy);
    if(dist<=20) candidates.push({ type:'decoy', payload:idx, dist, sig:`decoy:${idx}` });
  });
  state.targets.forEach(t=>{
    if(t.destroyed || !t.revealed) return;
    const vx = t._visX!==undefined ? t._visX : estPos(t).x;
    const vy = t._visY!==undefined ? t._visY : estPos(t).y;
    const p = project(vx, vy);
    const dist = Math.hypot(p.x-sx, p.y-sy);
    if(dist<=42) candidates.push({ type:'enemy', payload:t, dist, sig:`enemy:${t.id}` });
  });
  if(state.hq.hp>0){
    const hqx = state.hq._visX!==undefined ? state.hq._visX : state.hq.x;
    const hqy = state.hq._visY!==undefined ? state.hq._visY : state.hq.y;
    const p = project(hqx, hqy);
    const dist = Math.hypot(p.x-sx, p.y-sy);
    if(dist<=22) candidates.push({ type:'friendly', payload:{kind:'hq'}, dist, sig:'friendly:hq' });
  }
  FRIENDLY_KIND_LIST.forEach(({kind, list, alive})=>{
    list().forEach((u,idx)=>{
      if(!alive(u)) return;
      const ux = u._visX!==undefined ? u._visX : u.x;
      const uy = u._visY!==undefined ? u._visY : u.y;
      const p = project(ux, uy);
      const dist = Math.hypot(p.x-sx, p.y-sy);
      if(dist<=22) candidates.push({ type:'friendly', payload:{kind, idx}, dist, sig:`friendly:${kind}:${idx}` });
    });
  });
  return candidates;
}

export function resolveClickHit(sx, sy){
  const candidates = collectClickCandidates(sx, sy);
  if(candidates.length===0){ clickCycleState = null; return null; }
  const sigSet = candidates.map(c=>c.sig).sort().join('|');
  if(clickCycleState && clickCycleState.sigSet===sigSet){
    clickCycleState.idx = (clickCycleState.idx+1) % clickCycleState.order.length;
    return clickCycleState.order[clickCycleState.idx];
  }
  const order = candidates.slice().sort((a,b)=>a.dist-b.dist);
  clickCycleState = { sigSet, order, idx:0 };
  return order[0];
}

export function selectForceUnit(kind, idx){
  state.commandBox = {kind, idx};
  render();
}

export function handleMinimapClick(e){
  if(!state || anyOverlayShown()) return;
  const cv = document.getElementById('minimap');
  const rect = cv.getBoundingClientRect();
  const clientX = e.touches && e.touches.length ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches && e.touches.length ? e.touches[0].clientY : e.clientY;
  const wx = clamp(((clientX-rect.left)/rect.width)*CANVAS_W, 0, CANVAS_W);
  const wy = clamp(((clientY-rect.top)/rect.height)*CANVAS_H, 0, CANVAS_H);
  focusMapOn(wx, wy);
}

export let mapDragMoved = false;

export let mapFocusTarget = null;

export function focusMapOn(cx, cy, zoom){
  mapFocusTarget = { x: cx, y: cy, zoom };
}

export function updateMapFocusEase(){
  if(!mapFocusTarget) return;
  MAP_VIEW.cx += (mapFocusTarget.x-MAP_VIEW.cx)*0.15;
  MAP_VIEW.cy += (mapFocusTarget.y-MAP_VIEW.cy)*0.15;
  let zoomSettled = true;
  if(mapFocusTarget.zoom!==undefined){
    MAP_VIEW.zoom += (mapFocusTarget.zoom-MAP_VIEW.zoom)*0.15;
    zoomSettled = Math.abs(mapFocusTarget.zoom-MAP_VIEW.zoom) < 0.01;
  }
  if(Math.hypot(mapFocusTarget.x-MAP_VIEW.cx, mapFocusTarget.y-MAP_VIEW.cy) < 0.5 && zoomSettled) mapFocusTarget = null;
  clampMapView();
  updateCameraFromView();
}

export let mapDoubleTapZoomed = false;

export function toggleDoubleTapZoom(pxPixel, pyPixel){
  if(mapDoubleTapZoomed){
    focusMapOn(CANVAS_W/2, CANVAS_H/2, 1);
    mapDoubleTapZoomed = false;
  } else {
    const g = groundPlaneCanvasUnitAt(pxPixel, pyPixel);
    if(!g) return;
    focusMapOn(g.x, g.y, MAP_DOUBLETAP_ZOOM_LEVEL);
    mapDoubleTapZoomed = true;
  }
}

export let decoyLongPressTimer = null;

export let decoyLongPressX = 0, decoyLongPressY = 0, decoyLongPressMoved = false;

export function decoyLongPressStart(clientX, clientY){
  if(!state || !state.decoyPlacementPending) return;
  decoyLongPressX = clientX; decoyLongPressY = clientY; decoyLongPressMoved = false;
  clearTimeout(decoyLongPressTimer);
  decoyLongPressTimer = setTimeout(()=>{
    if(decoyLongPressMoved || !state.decoyPlacementPending) return;
    const el = document.getElementById('board');
    const rect = el.getBoundingClientRect();
    const px = decoyLongPressX-rect.left, py = decoyLongPressY-rect.top;
    const g = threeReady ? terrainCanvasUnitAt(px, py) : {x:px/rect.width*CANVAS_W, y:py/rect.height*CANVAS_H};
    if(g) placeDecoyAt(g.x, g.y);
  }, DECOY_LONGPRESS_MS);
}

export function decoyLongPressMove(clientX, clientY){
  if(Math.hypot(clientX-decoyLongPressX, clientY-decoyLongPressY) > DECOY_LONGPRESS_MOVE_TOLERANCE_PX){
    decoyLongPressMoved = true;
    clearTimeout(decoyLongPressTimer);
  }
}

export function decoyLongPressEnd(){
  clearTimeout(decoyLongPressTimer);
}

export function setupMapControls(){
  // Attached to #board (the topmost overlay canvas) since it visually covers
  // #board3d and would otherwise swallow all pointer events before they reach it.
  const el = document.getElementById('board');
  if(!el) return;
  el.addEventListener('contextmenu', e=>e.preventDefault());

  let mode = null, lastX=0, lastY=0, dragGround=null;
  el.addEventListener('mousedown', e=>{
    mapDragMoved = false;
    mode = e.button===2 ? 'rotate' : 'pan';
    lastX = e.clientX; lastY = e.clientY;
    mapFocusTarget = null;
    decoyLongPressStart(e.clientX, e.clientY);
    if(mode==='pan'){
      const rect = el.getBoundingClientRect();
      dragGround = groundPlaneCanvasUnitAt(e.clientX-rect.left, e.clientY-rect.top);
    }
  });
  window.addEventListener('mousemove', e=>{
    decoyLongPressMove(e.clientX, e.clientY);
    if(!mode) return;
    const dx = e.clientX-lastX, dy = e.clientY-lastY;
    if(Math.abs(dx)>2 || Math.abs(dy)>2) mapDragMoved = true;
    lastX = e.clientX; lastY = e.clientY;
    if(mode==='rotate'){
      MAP_VIEW.azimuth -= dx*0.006;
      MAP_VIEW.polar = clamp(MAP_VIEW.polar - dy*0.005, MAP_POLAR_MIN, MAP_POLAR_MAX);
      updateCameraFromView();
    } else if(mode==='pan' && dragGround){
      const rect = el.getBoundingClientRect();
      const now = groundPlaneCanvasUnitAt(e.clientX-rect.left, e.clientY-rect.top);
      if(now){
        MAP_VIEW.cx += dragGround.x-now.x;
        MAP_VIEW.cy += dragGround.y-now.y;
        clampMapView();
        updateCameraFromView();
      }
    }
  });
  window.addEventListener('mouseup', ()=>{ mode = null; dragGround = null; decoyLongPressEnd(); });

  el.addEventListener('wheel', e=>{
    e.preventDefault();
    mapFocusTarget = null;
    const factor = e.deltaY<0 ? 1.12 : 1/1.12;
    MAP_VIEW.zoom = clamp(MAP_VIEW.zoom*factor, MAP_ZOOM_MIN, MAP_ZOOM_MAX);
    clampMapView();
    updateCameraFromView();
  }, {passive:false});

  // per user request: double-click zooms in on the clicked area; a second double-click
  // returns to the original default view (see toggleDoubleTapZoom).
  el.addEventListener('dblclick', e=>{
    const rect = el.getBoundingClientRect();
    toggleDoubleTapZoom(e.clientX-rect.left, e.clientY-rect.top);
  });

  // Single finger = pan (as before). Two fingers = pinch to zoom + twist/
  // vertical-drag to rotate/tilt, mirroring the desktop wheel=zoom and
  // right-drag=rotate gestures.
  let touchMode=null, touchLastX=0, touchLastY=0;
  let pinchStartDist=0, pinchStartZoom=1, twoTouchLastAngle=0, twoTouchLastMidY=0;
  // per user request: manual double-tap detection for toggleDoubleTapZoom (mobile has no
  // native 'dblclick' from two taps, unlike desktop)
  const DOUBLETAP_MAX_INTERVAL_MS = 350, DOUBLETAP_MAX_DIST_PX = 30;
  let lastTapTime = 0, lastTapX = 0, lastTapY = 0;
  const touchMid = touches => ({
    x:(touches[0].clientX+touches[1].clientX)/2,
    y:(touches[0].clientY+touches[1].clientY)/2,
  });
  el.addEventListener('touchstart', e=>{
    mapFocusTarget = null;
    if(e.touches.length===1){
      touchLastX=e.touches[0].clientX; touchLastY=e.touches[0].clientY;
      const rect = el.getBoundingClientRect();
      const lx = touchLastX-rect.left, ly = touchLastY-rect.top;
      // No preventDefault here: a plain tap (touchstart+touchend with no
      // movement) must still synthesize its native 'click' so unit selection
      // keeps working. touch-action:none on #board (CSS) already stops the
      // browser's native pan/zoom gesture from engaging over the map.
      touchMode = 'pan';
      mapDragMoved=false;
      decoyLongPressStart(touchLastX, touchLastY);
      dragGround = groundPlaneCanvasUnitAt(lx, ly);
    } else if(e.touches.length===2){
      // A second finger means this is a pinch/rotate gesture, never a tap, so
      // it's safe (and necessary, as a fallback if touch-action isn't fully
      // honored) to preventDefault here without risking a lost click.
      e.preventDefault();
      // per user request: a long-press timer armed by the FIRST finger (see
      // decoyLongPressStart above) was never canceled when a second finger joined to start
      // a pinch -- it could still fire mid-pinch/mid-gesture, placing a decoy out of
      // nowhere and hijacking the gesture the player was actually in the middle of
      // (reported as gestures sometimes just not working).
      decoyLongPressEnd();
      touchMode='pinch'; mapDragMoved=true; dragGround=null;
      const [t0,t1] = e.touches;
      pinchStartDist = Math.hypot(t1.clientX-t0.clientX, t1.clientY-t0.clientY);
      pinchStartZoom = MAP_VIEW.zoom;
      twoTouchLastAngle = Math.atan2(t1.clientY-t0.clientY, t1.clientX-t0.clientX);
      twoTouchLastMidY = touchMid(e.touches).y;
    }
  }, {passive:false});
  el.addEventListener('touchmove', e=>{
    e.preventDefault();
    if(touchMode==='pan' && e.touches.length===1){
      decoyLongPressMove(e.touches[0].clientX, e.touches[0].clientY);
      const dx = e.touches[0].clientX-touchLastX, dy = e.touches[0].clientY-touchLastY;
      if(Math.abs(dx)>2 || Math.abs(dy)>2) mapDragMoved = true;
      touchLastX = e.touches[0].clientX; touchLastY = e.touches[0].clientY;
      if(dragGround){
        const rect = el.getBoundingClientRect();
        const now = groundPlaneCanvasUnitAt(touchLastX-rect.left, touchLastY-rect.top);
        if(now){
          MAP_VIEW.cx += dragGround.x-now.x;
          MAP_VIEW.cy += dragGround.y-now.y;
          clampMapView();
          updateCameraFromView();
        }
      }
    } else if(touchMode==='pinch' && e.touches.length===2){
      const [t0,t1] = e.touches;
      const dist = Math.hypot(t1.clientX-t0.clientX, t1.clientY-t0.clientY);
      if(pinchStartDist>10){
        MAP_VIEW.zoom = clamp(pinchStartZoom*(dist/pinchStartDist), MAP_ZOOM_MIN, MAP_ZOOM_MAX);
      }
      const angle = Math.atan2(t1.clientY-t0.clientY, t1.clientX-t0.clientX);
      MAP_VIEW.azimuth += (angle-twoTouchLastAngle);
      twoTouchLastAngle = angle;
      const midY = touchMid(e.touches).y;
      MAP_VIEW.polar = clamp(MAP_VIEW.polar - (midY-twoTouchLastMidY)*0.005, MAP_POLAR_MIN, MAP_POLAR_MAX);
      twoTouchLastMidY = midY;
      clampMapView();
      updateCameraFromView();
    }
  }, {passive:false});
  el.addEventListener('touchend', e=>{
    decoyLongPressEnd();
    if(e.touches.length===1){
      // Dropping from two fingers to one: resume panning from the remaining
      // finger's current position instead of snapping/jumping.
      touchMode='pan'; mapDragMoved=true;
      touchLastX=e.touches[0].clientX; touchLastY=e.touches[0].clientY;
      const rect = el.getBoundingClientRect();
      dragGround = groundPlaneCanvasUnitAt(touchLastX-rect.left, touchLastY-rect.top);
    } else if(e.touches.length===0){
      touchMode=null; dragGround=null;
      if(!mapDragMoved && e.changedTouches && e.changedTouches.length){
        const ct = e.changedTouches[0];
        const now = performance.now();
        const dist = Math.hypot(ct.clientX-lastTapX, ct.clientY-lastTapY);
        const rect = el.getBoundingClientRect();
        const pxPixel = ct.clientX-rect.left, pyPixel = ct.clientY-rect.top;
        // per user request: two quick taps close together used to always count as a
        // double-tap-zoom, even when each tap actually landed ON a unit/enemy/decoy icon --
        // rapidly tapping several nearby units (completely normal play, e.g. checking a
        // cluster of squads back to back) easily satisfies the interval/distance check and
        // triggered an unintended zoom. Only treat it as a double-tap-zoom when the tap hit
        // empty ground (collectClickCandidates finds nothing there), the same WYSIWYG
        // screen-space hit-test handleCanvasClick itself uses.
        const sx = threeReady ? pxPixel : pxPixel/rect.width*CANVAS_W;
        const sy = threeReady ? pyPixel : pyPixel/rect.height*CANVAS_H;
        const hitEmptyGround = collectClickCandidates(sx, sy).length===0;
        if(hitEmptyGround && now-lastTapTime < DOUBLETAP_MAX_INTERVAL_MS && dist < DOUBLETAP_MAX_DIST_PX){
          toggleDoubleTapZoom(pxPixel, pyPixel);
          lastTapTime = 0;
        } else {
          lastTapTime = now; lastTapX = ct.clientX; lastTapY = ct.clientY;
        }
      }
    }
  });
  window.addEventListener('resize', resizeThree);
}

export function assignMortarFireAtDecoy(idx){
  const mortar = state.mortars[idx];
  const decoyIdx = state.decoyCommandBox;
  const d = state.decoys[decoyIdx];
  if(!mortar || mortar.hp<=0 || !d || d.destroyed) return;
  if(mortar.order==='fire' && mortar.pendingFire && mortar.pendingFire.decoyIdx===decoyIdx){
    mortar.pendingFire = null;
    mortar.order = 'standby';
    log('fdc','FDC', `迫撃砲${idx+1}、擬陣地への攻撃指示を解除。`);
    render();
    return;
  }
  mortar.pendingFire = {x:d.x, y:d.y, snappedId:null, decoyIdx};
  mortar.order = 'fire';
  mortar.pendingDest = null;
  log('fdc','FDC', `迫撃砲${idx+1}、擬陣地${decoyIdx+1}周辺へ座標既知の精密射撃を指示。`);
  render();
}


export function resetClickCycle(){ clickCycleState = null; }

Object.assign(window, { selectNextTarget, setUnitMoveDest, toggleMultiSelectMode, isMultiSelected, pruneMultiSelected, multiSelectCommonOrders, multiSelectSetOrder, handleMultiSelectClick, handleCanvasClick, nearestVisibleTargetForScreen, setPendingFireAt, canvasToScreen, collectClickCandidates, resolveClickHit, selectForceUnit, handleMinimapClick, focusMapOn, updateMapFocusEase, toggleDoubleTapZoom, decoyLongPressStart, decoyLongPressMove, decoyLongPressEnd, setupMapControls, assignMortarFireAtDecoy, resetClickCycle });
