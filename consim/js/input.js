// Split out of the former monolithic mortar_fdc_game.js.
import { applyBestMortarLoadout, buildTrenchAt, buildWallAt, estPos, estPosFromMortar, handlePlacementClick, mortarNotReadyToFire, mortarTooCloseToFire, mortarTooFarToFire, placeDecoyAt, resolveSmartUnitIdxs, state, unitAlive } from './combat.js';
import { CAMERA_PRESETS, CAMERA_SWOOP_HOLD_MS, CANVAS_H, CANVAS_W, DECOY_LONGPRESS_MOVE_TOLERANCE_PX, DECOY_LONGPRESS_MS, DIRECT_MOVE_KINDS, FRIENDLY_KIND_LIST, MAP_DOUBLETAP_ZOOM_LEVEL, MAP_INITIAL_AZIMUTH, MAP_POLAR_MAX, MAP_POLAR_MIN, MAP_VIEW, MAP_ZOOM_MAX, MAP_ZOOM_MIN, MORTAR_FIRE_READY_DELAY_MS, MORTAR_MAX_RANGE_M, MORTAR_MIN_RANGE_M, MORTAR_MOVE_START_DELAY_MS, MULTI_SELECT_FORMATION_SPACING, MULTI_SELECT_KINDS, MULTI_SELECT_ORDER_SETTER, ORDER_LABEL, SCOUT_ADVANCE_LIMIT_X, SMART_UNIT_TYPES, SQUAD_ADVANCE_LIMIT_X, SQUAD_ASSAULT_LIMIT_X, SQUAD_RETREAT_LIMIT_X } from './constants.js';
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
  if(kind==='antitank') return state.antitanks[idx];
  if(kind==='hq') return state.hq;
  if(kind==='band') return state.bands[idx];
  if(kind==='scout') return state.scouts[idx];
  if(kind==='engineer') return state.engineers[idx];
  if(kind==='medic') return state.medics[idx];
  if(kind==='supply') return state.supplies[idx];
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
  if(kind==='band'){
    const band = state.bands[idx];
    if(!band || band.resting) return false;
    band.pendingDest = { x: clamp(px, SQUAD_RETREAT_LIMIT_X, SQUAD_ASSAULT_LIMIT_X), y: clamp(py, 30, CANVAS_H-30) };
    if(!silent) log('sys','前線', `音楽隊に移動目標を指示。`);
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
  if(kind==='medic'){
    const me = state.medics[idx];
    if(!me || !unitAlive(me) || me.resting) return false;
    me.pendingDest = { x: clamp(px, SQUAD_RETREAT_LIMIT_X, SQUAD_ASSAULT_LIMIT_X), y: clamp(py, 30, CANVAS_H-30) };
    if(!silent) log('sys','前線', `衛生${idx+1}小隊に移動目標を指示。`);
    return true;
  }
  if(kind==='supply'){
    const su = state.supplies[idx];
    if(!su || !unitAlive(su) || su.resting) return false;
    su.pendingDest = { x: clamp(px, SQUAD_RETREAT_LIMIT_X, SQUAD_ASSAULT_LIMIT_X), y: clamp(py, 30, CANVAS_H-30) };
    if(!silent) log('sys','前線', `補給${idx+1}に移動目標を指示。`);
    return true;
  }
  if(kind==='antitank'){
    const at = state.antitanks[idx];
    if(!at || at.hp<=0) return false;
    at.pendingDest = { x: clamp(px, SQUAD_RETREAT_LIMIT_X, SQUAD_ASSAULT_LIMIT_X), y: clamp(py, 30, CANVAS_H-30) };
    if(!silent) log('sys','前線', `対戦車${idx+1}に移動目標を指示。`);
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
    // per user request: 迫撃砲は後方の狭いゾーン(MORTAR_ZONE_MIN_X/MAX_X)に縛られず、
    // マップ全域を移動先として指定できるようにする(他ユニットのY方向クランプと同じ余白のみ)。
    mortar.pendingDest = { x: clamp(px, 30, CANVAS_W-30), y: clamp(py, 30, CANVAS_H-30) };
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

// shared by pruneMultiSelected() and the saved unit-groups below, so a group's roster and the
// live multi-selection always agree on what counts as "still a valid unit reference".
function unitRefAlive({kind, idx}){
  if(kind==='squad') return state.squads[idx] && state.squads[idx].soldiers.some(s=>s.alive);
  if(kind==='tank') return state.tanks[idx] && state.tanks[idx].hp>0;
  if(kind==='sam') return state.sams[idx] && state.sams[idx].hp>0;
  if(kind==='antitank') return state.antitanks[idx] && state.antitanks[idx].hp>0;
  if(kind==='engineer') return state.engineers[idx] && unitAlive(state.engineers[idx]);
  if(kind==='band') return state.bands[idx] && unitAlive(state.bands[idx]);
  return false;
}

export function pruneMultiSelected(){
  multiSelected = multiSelected.filter(unitRefAlive);
}

// per user request: 部隊のグループ化 -- 1〜9のスロットに現在の複数選択を保存し、後で
// ワンタップで呼び出せる(古典的なRTSのコントロールグループと同じ発想)。既存の複数選択の
// 仕組み(multiSelected/isMultiSelected/multiSelectSetOrder)をそのまま再利用する。
export let unitGroups = Array.from({length:9}, ()=>[]);

export function saveUnitGroup(groupNum){
  if(!multiSelected.length) return;
  unitGroups[groupNum-1] = multiSelected.map(e=>({...e}));
  log('sys','司令部', `選択中の${multiSelected.length}隊をグループ${groupNum}に保存。`);
  render();
}

export function recallUnitGroup(groupNum){
  unitGroups[groupNum-1] = unitGroups[groupNum-1].filter(unitRefAlive);
  const group = unitGroups[groupNum-1];
  if(!group.length) return;
  if(!multiSelectMode){
    multiSelectMode = true;
    const btn = document.getElementById('multiSelectBtn');
    if(btn) btn.classList.add('active');
    state.commandBox = null;
    state.enemyCommandBox = null;
    state.decoyCommandBox = null;
    state.orderMode = null;
    state.smartOrderMode = null;
  }
  multiSelected = group.map(e=>({...e}));
  log('sys','司令部', `グループ${groupNum}(${multiSelected.length}隊)を選択。`);
  render();
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
    // per user request(操作性向上): 全隊が同じ1点に向かうと目的地で重なってしまうため、
    // 目的地を中心にグリッド状へ散開配置する(1隊だけの場合はオフセット0で従来と同じ)。
    let moved = 0;
    const n = multiSelected.length;
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n/cols);
    multiSelected.forEach(({kind, idx}, i)=>{
      const col = i%cols, row = Math.floor(i/cols);
      const ox = (col-(cols-1)/2)*MULTI_SELECT_FORMATION_SPACING;
      const oy = (row-(rows-1)/2)*MULTI_SELECT_FORMATION_SPACING;
      if(setUnitMoveDest(kind, idx, px+ox, py+oy, true)) moved++;
    });
    if(moved>0) log('sys','司令部', `選択中の${moved}隊に散開移動目標を指示。`);
  }
}

// per user request(操作性向上): マルチセレクトモード中は左ドラッグで矩形範囲を描いて、
// 範囲内の友軍(MULTI_SELECT_KINDS)を一括選択できる(1隊ずつタップして追加する従来方式に
// 加えての手段)。#box-select-rectはCSS側でposition:fixedにしてある -- .board-wrapが
// position:fixed;inset:0で画面全体を覆っており#boardはそれをinset:0で埋めているため、
// clientX/clientYをそのままleft/topに使ってよい(#boardのgetBoundingClientRectと一致する)。
const BOX_SELECT_MOVE_THRESHOLD_PX = 6;

let boxSelectStartClient = null;

let boxSelectActive = false;

export let boxSelectRect = null;

function updateBoxSelectOverlay(){
  const el = document.getElementById('box-select-rect');
  if(!el) return;
  if(!boxSelectRect){ el.style.display = 'none'; return; }
  const {x1, y1, x2, y2} = boxSelectRect;
  el.style.display = 'block';
  el.style.left = `${Math.min(x1,x2)}px`;
  el.style.top = `${Math.min(y1,y2)}px`;
  el.style.width = `${Math.abs(x2-x1)}px`;
  el.style.height = `${Math.abs(y2-y1)}px`;
}

function unitsInScreenRect({x1, y1, x2, y2}){
  const cv = document.getElementById('board');
  const rect = cv.getBoundingClientRect();
  const minX = Math.min(x1,x2)-rect.left, maxX = Math.max(x1,x2)-rect.left;
  const minY = Math.min(y1,y2)-rect.top, maxY = Math.max(y1,y2)-rect.top;
  const found = [];
  FRIENDLY_KIND_LIST.forEach(({kind, list, alive})=>{
    if(!MULTI_SELECT_KINDS.includes(kind)) return;
    list().forEach((u,idx)=>{
      if(!alive(u)) return;
      const ux = u._visX!==undefined ? u._visX : u.x;
      const uy = u._visY!==undefined ? u._visY : u.y;
      const p = project(ux, uy);
      if(!p.visible) return;
      if(p.x>=minX && p.x<=maxX && p.y>=minY && p.y<=maxY) found.push({kind, idx});
    });
  });
  return found;
}

function startBoxSelect(clientX, clientY){
  boxSelectStartClient = {x:clientX, y:clientY};
  boxSelectActive = false;
  boxSelectRect = null;
  mapFocusTarget = null;
  cameraSwoopActive = false;
  mapDragMoved = false;
}

function moveBoxSelect(clientX, clientY){
  if(!boxSelectStartClient) return;
  const dx = clientX-boxSelectStartClient.x, dy = clientY-boxSelectStartClient.y;
  if(Math.abs(dx)>BOX_SELECT_MOVE_THRESHOLD_PX || Math.abs(dy)>BOX_SELECT_MOVE_THRESHOLD_PX) boxSelectActive = true;
  if(boxSelectActive){
    boxSelectRect = {x1:boxSelectStartClient.x, y1:boxSelectStartClient.y, x2:clientX, y2:clientY};
    updateBoxSelectOverlay();
  }
}

function cancelBoxSelect(){
  boxSelectStartClient = null;
  boxSelectActive = false;
  boxSelectRect = null;
  updateBoxSelectOverlay();
}

function finishBoxSelect(){
  if(boxSelectActive && boxSelectRect){
    const found = unitsInScreenRect(boxSelectRect);
    if(found.length){
      multiSelected = found;
      log('sys','司令部', `ドラッグ選択で${found.length}隊を選択。`);
      render();
    }
    // 実際にドラッグ範囲選択が成立した場合、続けて発火するネイティブclickが
    // handleCanvasClick経由でこの位置への移動指示を出してしまわないよう抑止する
    // (地図ドラッグ後にmapDragMovedでclickを無視する既存の仕組みと同じ)。
    mapDragMoved = true;
  }
  cancelBoxSelect();
}

export function handleCanvasClick(evt){
  if(!state || state.stageResolved || state.animating) return;
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
  // per user request: while a squad/tank/SAM/antitank/HQ's command box is open, a plain click
  // on empty ground now moves it there directly instead of requiring "移動先を指定" first --
  // these are the only kinds where a click can unambiguously only ever mean "move" (mortar/
  // scout/engineer each have other click-based actions that still need their own
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

// per user request: inverse of drawMinimap()'s proj() in render2d.js -- the minimap is a fixed
// square that (on narrow/mobile screens) draws rotated to match the main map's own
// MAP_INITIAL_AZIMUTH rotation, with x/y scaled independently to fill the square. Tapping the
// minimap used to assume a plain unrotated CANVAS_W:CANVAS_H mapping, which silently stopped
// matching what was actually drawn once the minimap became rotated+square -- a tap on, say, the
// friendly cluster no longer panned there at all. This mirrors proj() exactly, just inverted.
function minimapScreenToWorld(px, py, rectW, rectH){
  const az = MAP_INITIAL_AZIMUTH, cosA = Math.cos(az), sinA = Math.sin(az);
  const rotated = az !== 0;
  const scaleX = rotated ? rectW/CANVAS_H : rectW/CANVAS_W;
  const scaleY = rotated ? rectH/CANVAS_W : rectH/CANVAS_H;
  const rx = (px-rectW/2)/scaleX, ry = (py-rectH/2)/scaleY;
  const dx = rx*cosA + ry*sinA, dy = -rx*sinA + ry*cosA;
  return {
    x: clamp(dx+CANVAS_W/2, 0, CANVAS_W),
    y: clamp(dy+CANVAS_H/2, 0, CANVAS_H),
  };
}

export function handleMinimapClick(e){
  if(!state || anyOverlayShown()) return;
  const cv = document.getElementById('minimap');
  const rect = cv.getBoundingClientRect();
  const clientX = e.touches && e.touches.length ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches && e.touches.length ? e.touches[0].clientY : e.clientY;
  const { x: wx, y: wy } = minimapScreenToWorld(clientX-rect.left, clientY-rect.top, rect.width, rect.height);
  focusMapOn(wx, wy);
}

export let mapDragMoved = false;

export let mapFocusTarget = null;

export function focusMapOn(cx, cy, zoom){
  mapFocusTarget = { x: cx, y: cy, zoom };
}

// per user request(プレイヤーが驚くような演出): HQ危機・地雷奇襲などここぞという瞬間に、
// カメラを自動でその地点へ一時的にスウィング→保持→元の視点へ戻す演出。既存の
// focusMapOn/updateMapFocusEaseのイージングをそのまま使い、「戻る」動作だけ
// setTimeoutで追加する。cameraSwoopActiveは、保持時間中にプレイヤーが地図を手動操作
// (ドラッグ/ホイール/タップ、いずれもmapFocusTarget=nullにする既存ハンドラ側で一緒に
// falseにする -- setupMapControls参照)した場合、無理に元の視点へ戻さないための目印。
export let cameraSwoopActive = false;

export function triggerDramaticCameraSwoop(cx, cy, zoom){
  const originalCx = MAP_VIEW.cx, originalCy = MAP_VIEW.cy, originalZoom = MAP_VIEW.zoom;
  cameraSwoopActive = true;
  focusMapOn(cx, cy, zoom!==undefined ? zoom : MAP_VIEW.zoom);
  setTimeout(()=>{
    if(!cameraSwoopActive) return; // プレイヤーが保持時間中に手動操作 -- 戻さず現在の視点を尊重
    cameraSwoopActive = false;
    focusMapOn(originalCx, originalCy, originalZoom);
  }, CAMERA_SWOOP_HOLD_MS);
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
    // per user request(操作性向上): マルチセレクトモード中の左ドラッグは地図パンではなく
    // 矩形範囲選択として扱う(右ドラッグの回転は従来通り)。
    if(multiSelectMode && e.button===0){
      startBoxSelect(e.clientX, e.clientY);
      return;
    }
    mode = e.button===2 ? 'rotate' : 'pan';
    lastX = e.clientX; lastY = e.clientY;
    mapFocusTarget = null;
    cameraSwoopActive = false;
    decoyLongPressStart(e.clientX, e.clientY);
    if(mode==='pan'){
      const rect = el.getBoundingClientRect();
      dragGround = groundPlaneCanvasUnitAt(e.clientX-rect.left, e.clientY-rect.top);
    }
  });
  window.addEventListener('mousemove', e=>{
    if(boxSelectStartClient){ moveBoxSelect(e.clientX, e.clientY); return; }
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
  window.addEventListener('mouseup', ()=>{
    if(boxSelectStartClient){ finishBoxSelect(); return; }
    mode = null; dragGround = null; decoyLongPressEnd();
  });

  el.addEventListener('wheel', e=>{
    e.preventDefault();
    mapFocusTarget = null;
    cameraSwoopActive = false;
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
    cameraSwoopActive = false;
    if(e.touches.length===1){
      // per user request(操作性向上): マルチセレクトモード中は1本指ドラッグをパンではなく
      // 矩形範囲選択として扱う。
      if(multiSelectMode){
        startBoxSelect(e.touches[0].clientX, e.touches[0].clientY);
        return;
      }
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
      // (reported as gestures sometimes just not working). A box-select armed by the first
      // finger is canceled here for the same reason.
      decoyLongPressEnd();
      cancelBoxSelect();
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
    if(boxSelectStartClient && e.touches.length===1){
      moveBoxSelect(e.touches[0].clientX, e.touches[0].clientY);
      return;
    }
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
    if(boxSelectStartClient){ finishBoxSelect(); return; }
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

// per user request: cycle through 3 fixed camera-angle presets (俯瞰/標準/低角) via a button,
// instead of only free polar/zoom dragging. Index starts at 1 (標準), matching MAP_VIEW's own
// default polar/zoom so the button's label is correct before any tap.
let cameraPresetIdx = 1;

export function setupCameraPresetButton(){
  const btn = document.getElementById('camera-preset-btn');
  if(!btn) return;
  btn.textContent = CAMERA_PRESETS[cameraPresetIdx].name;
  btn.addEventListener('click', ()=>{
    cameraPresetIdx = (cameraPresetIdx+1) % CAMERA_PRESETS.length;
    const preset = CAMERA_PRESETS[cameraPresetIdx];
    MAP_VIEW.polar = preset.polar;
    MAP_VIEW.zoom = clamp(preset.zoom, MAP_ZOOM_MIN, MAP_ZOOM_MAX);
    updateCameraFromView();
    btn.textContent = preset.name;
  });
}

// per user request: one-tap "自軍へ" button -- centers the view on the centroid of every alive
// friendly unit (HQ included), so the player can get back to their own force without precisely
// tapping the small minimap or dragging/panning manually. Falls back to HQ alone if somehow
// nothing else is alive, and to the map center if even HQ is gone (shouldn't happen -- HQ
// reaching 0 HP is an immediate game over -- but keeps this from silently no-op-ing).
export function focusOnOwnForces(){
  const pts = [];
  if(state.hq && state.hq.hp>0) pts.push({x:state.hq.x, y:state.hq.y});
  state.mortars.forEach(m=>{ if(m.hp>0) pts.push({x:m.x, y:m.y}); });
  state.tanks.forEach(t=>{ if(t.hp>0) pts.push({x:t.x, y:t.y}); });
  state.sams.forEach(s=>{ if(s.hp>0) pts.push({x:s.x, y:s.y}); });
  state.squads.forEach(sq=>{ if(sq.soldiers.some(s=>s.alive)) pts.push({x:sq.x, y:sq.y}); });
  state.antitanks.forEach(at=>{ if(at.hp>0) pts.push({x:at.x, y:at.y}); });
  state.engineers.forEach(en=>{ if(unitAlive(en)) pts.push({x:en.x, y:en.y}); });
  state.medics.forEach(me=>{ if(unitAlive(me)) pts.push({x:me.x, y:me.y}); });
  state.bands.forEach(b=>{ if(unitAlive(b)) pts.push({x:b.x, y:b.y}); });
  (state.supplies||[]).forEach(su=>{ if(unitAlive(su)) pts.push({x:su.x, y:su.y}); });
  state.scouts.forEach(sc=>{ if(unitAlive(sc)) pts.push({x:sc.x, y:sc.y}); });
  (state.helis||[]).forEach(h=>{ if(h.hp>0) pts.push({x:h.x, y:h.y}); });
  if(!pts.length){
    if(state.hq) focusMapOn(state.hq.x, state.hq.y);
    return;
  }
  const cx = pts.reduce((s,p)=>s+p.x, 0)/pts.length;
  const cy = pts.reduce((s,p)=>s+p.y, 0)/pts.length;
  focusMapOn(cx, cy);
}

export function setupFocusOwnForcesButton(){
  const btn = document.getElementById('focus-own-forces-btn');
  if(!btn) return;
  btn.addEventListener('click', focusOnOwnForces);
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

Object.assign(window, { selectNextTarget, setUnitMoveDest, toggleMultiSelectMode, isMultiSelected, pruneMultiSelected, saveUnitGroup, recallUnitGroup, multiSelectCommonOrders, multiSelectSetOrder, handleMultiSelectClick, handleCanvasClick, nearestVisibleTargetForScreen, setPendingFireAt, canvasToScreen, collectClickCandidates, resolveClickHit, selectForceUnit, handleMinimapClick, focusMapOn, updateMapFocusEase, toggleDoubleTapZoom, decoyLongPressStart, decoyLongPressMove, decoyLongPressEnd, setupMapControls, assignMortarFireAtDecoy, resetClickCycle });
