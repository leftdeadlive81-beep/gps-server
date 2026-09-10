// Split out of the former monolithic mortar_fdc_game.js.
import { unlockAchievement } from './achievements.js';
import { pickWaveBgm, playCombatAmbience, playSfx, startBgm, stopCombatAmbience } from './audio.js';
import { AA_ATTACK_DAMAGE, AA_COOLDOWN_TICKS, AA_ENGAGE_RANGE, ANOMALOUS_JUMP_UNITS, ARTILLERY_FIRE_RANGE_UNITS, ARTILLERY_MOVE_CAP, ARTILLERY_STANDOFF_RANGE_UNITS, CANVAS_H, CANVAS_W, COUNTER_CHANCE, COUNTER_DAMAGE, DECOY_LURE_MULT_DAY, DECOY_LURE_MULT_NIGHT, DECOY_MAX_HP, DECOY_MODES, DEPLOYMENT_MODES, DEPLOY_BOX_METERS, DIFFICULTIES, DRONE_DETONATE_DAMAGE, DRONE_DETONATE_RANGE, DRONE_INTRO_STAGE, DRONE_SPEED, ENEMY_FORMATION_BASE_SIZE, ENEMY_FORMATION_NAMES, ENEMY_FORMATION_TEMPLATES, ENEMY_HQ_EXPOSURE, ENEMY_INFANTRY_TOTAL_TARGET, ENEMY_SPAWN_MIN_X, ENGINEER_POS, ESTIMATE_CLAMP_MARGIN, EXPOSURE_DEFAULT, FLANK_OFFSET_RANGE_UNITS, FLIGHT_DURATION, FRIENDLY_HELI_MOVE_UNITS, FRIENDLY_INF_POS, FRIENDLY_KIND_LIST, FRIENDLY_MARK_COLOR, FRIENDLY_SPACING_PUSH, FRIENDLY_SPACING_RADIUS, FUZES, GAME_SPEED_INTERVALS, GAME_SPEED_LABEL, GAME_SPEED_ORDER, GAME_START_DATETIME, GAME_VERSION, HELI_ATTACK_BURST, HELI_ATTACK_DAMAGE, HELI_COOLDOWN_TICKS, HELI_ENGAGE_RANGE, HELI_EXPOSURE, HELI_MAX_RANGE_UNITS, HELI_MOVE_CAP, HELI_WITHDRAW_DIST, HQ_COVER_EXPOSURE_BONUS, HQ_COVER_EXPOSURE_CAP, HQ_DEFENSE_ATTACKER_WINDOW_MS, HQ_DEFENSE_DMG_MULT, HQ_DEFENSE_RANGE_UNITS, HQ_DETECT_RANGE_UNITS, HQ_MAX_HP, HQ_REPAIR_COST_PER_HP, HQ_REPAIR_HP_PER_CALL, HQ_X, HQ_Y, ILLUM_DURATION_TURNS, ILLUM_RADIUS_M, INFANTRY_DRONE_COOLDOWN_TICKS, INFANTRY_DRONE_LAUNCH_CHANCE, INFANTRY_DRONE_SWARM_SIZE, INFANTRY_DUEL_DMG_TO_ENEMY, INFANTRY_MOVE_CAP, INFANTRY_STANDOFF_UNITS, INITIAL_DEPLOY_SPACING_MULT, LAST_STAND_THRESHOLD, LAUNCH_INTERVAL, MAP_SEED_CANDIDATE_COUNT, MARKER_REVEAL_RADIUS_UNITS, MAX_DECOYS, MAX_TRENCHES, MAX_WALLS, MERGE_HP_THRESHOLD, METERS_PER_UNIT, MINE_DAMAGE, MINE_MAX_ACTIVE, MINE_PLACEMENT_CHANCE, MINE_TRIGGER_RADIUS_UNITS, MORTAR_BEST_LOADOUT, MORTAR_CB_DETECT_BASE, MORTAR_CB_SHOTS_THRESHOLD, MORTAR_CB_STRIKE_DMG, MORTAR_CB_WARN_TURNS, MORTAR_CREW_SIZE, MORTAR_DISPERSION_UNITS, MORTAR_FIRE_READY_DELAY_MS, MORTAR_MAX_RANGE_M, MORTAR_MAX_RANGE_UNITS, MORTAR_MIN_RANGE_M, MORTAR_MIN_RANGE_UNITS, MORTAR_MOVE_CAP, MORTAR_ORDER_LABEL, MORTAR_RELOAD_MS, MORTAR_ZONE_MAX_X, MORTAR_ZONE_MIN_X, NUM_ENGINEERS, NUM_MORTARS, NUM_SAMS, NUM_SCOUTS, NUM_SNIPERS, NUM_SQUADS, NUM_TANKS, OP, OP_HOME_X, OP_HOME_Y, ORDER_LABEL, PERSONNEL_ROSTER, REINFORCE_COST_PER_SOLDIER, REINFORCE_MAX_PER_CALL, RESERVE_SIZE, REST_DURATION_TURNS, ROAD_PULL_RADIUS, ROSTER_ENGINEER_TEAMS, ROSTER_MORTAR_CREWS, ROSTER_RESERVE_INITIAL, ROSTER_SCOUT_TEAMS, ROSTER_SNIPER_TEAMS, ROSTER_SQUADS, SAM_DUEL_DMG_TO_ENEMY, SAM_ENGAGE_RANGE, SAM_EXPOSURE, SAM_MAX_HP, SAM_MOVE_CAP, SAM_POS, SAM_REPAIR_COST_PER_HP, SAM_REPAIR_HP_PER_CALL, SCOUT_ADVANCE_LIMIT_X, SCOUT_EXPOSURE, SCOUT_LOWER_Y, SCOUT_MAX_RANGE_UNITS, SCOUT_MOVE_CAP, SCOUT_SQUAD_SIZE, SCOUT_UPPER_Y, SCOUT_X, SHELLS, SHELL_DISPERSION_MULT, SHELL_KILL_RADIUS_UNITS, SIM_STEP_MAX_CATCHUP, SIM_STEP_MS, SMART_ACTIONS, SMART_UNIT_TYPES, SMOKE_DURATION_TURNS, SMOKE_RADIUS_M, SMOKE_RADIUS_UNITS, SNIPER_AIM_LINE_WIDTH_UNITS, SNIPER_AIM_RANGE_UNITS, SNIPER_DMG, SNIPER_EXECUTE_HP_THRESHOLD, SNIPER_MOVE_CAP, SNIPER_POS, SNIPER_RANGE_UNITS, SQUAD_ADVANCE_LIMIT_X, SQUAD_ANTI_DRONE_DMG, SQUAD_ANTI_DRONE_HIT_CHANCE, SQUAD_ANTI_DRONE_RANGE_UNITS, SQUAD_ASSAULT_LIMIT_X, SQUAD_ENGAGE_RANGE, SQUAD_FORMATION_ADJUST_M, SQUAD_GRID_OFFSETS, SQUAD_RETREAT_LIMIT_X, SQUAD_SIZE, STAGE_COUNT, STEP_RENDER_MIN_INTERVAL_MS, SUPPRESSION_CASUALTY_MULT, SUPPRESSION_COUNTER_MULT, SUPPRESSION_DUEL_DMG_BONUS, SUPPRESSION_MOVE_MULT, SUPPRESSION_NEARMISS_TURNS, SUPPRESSION_RETREAT_CHANCE, SUPPRESSION_TURNS, TANK_DUEL_DMG_TO_ENEMY, TANK_ENGAGE_RANGE, TANK_EXPOSURE, TANK_INCOMING_DMG, TANK_MAX_HP, TANK_MOVE_CAP, TANK_POS, TANK_REPAIR_COST_PER_HP, TANK_REPAIR_HP_PER_CALL, TARGET_GRID_CELL_SIZE, TARGET_GRID_MAX_RINGS, TARGET_TYPES, TERRAIN_TYPE_FOREST, TRENCH_BUILD_COST, VEHICLE_ASSAULT_DAMAGE, VEHICLE_ASSAULT_RANGE, VEHICLE_MOVE_CAP, VET_DMG_BONUS_PER_LEVEL, VET_EXPOSURE_BONUS_PER_LEVEL, VET_MAX_LEVEL, VET_XP_PER_LEVEL, HQ_MORTAR_COOLDOWN_TICKS, HQ_MORTAR_COUNT, HQ_MORTAR_DAMAGE, HQ_TANKGUN_COOLDOWN_TICKS, HQ_TANKGUN_COUNT, HQ_TANKGUN_DAMAGE, WALL_BUILD_COST, WALL_MAX_HP, WALL_RADIUS, WAVE_CLEAR_EFFECT_WAIT_MS, WAVE_CLEAR_FANFARE_HOLD_MS, WAVE_SPAWN_DELAY_MS, WAVE_SPAWN_WINDOW_MS, WEAPON_FIRE_INTERVAL, WEAPON_FIRE_OFFSET, WEATHER_TYPES, WORLD } from './constants.js';
import { resetClickCycle } from './input.js';
import { render } from './main.js';
import { ROAD_GRAPH, advanceAlongPath, airborneStep, altitudeBonus, applyWallBlock, computeFebaX, damageWall, elevationAt, generateProceduralTerrain, generateSpots, getCachedRoadPath, nearestRoadPoint, nearestWallHit, pickArchetypeForStage, pickTerrainForStage, pickTypesForCount, scoutTerrainAwareStep, terrainAwareStep, terrainCoverTotal, terrainTypeAt, trenchCoverBonusAt, wallBlockingLineOfFire } from './terrain.js';
import { disposeMarker3d, regenerateTerrain } from './three.js';
import { announceTicker, closeSmartOrder, log, renderMapSelectOverlay, showGameClear, showStageClear, showStageFailed, showWaveRewardChoice, smartWizard } from './ui.js';
import { bearingBetween, choice, clamp, exposureNormalizedMult, gauss, hitChanceFromExposure, rnd, smoothstep01, unitsToMeters, visualTweenDurationMs } from './utils.js';
import { fireTracer, onTargetDestroyed, projectiles, resetAllVfx, ripples, spawn3dImpactEffect, spawn3dProjectile, spawnDestructionEffect } from './vfx.js';
import { speakCoordination, speakRandomAliveUnit, unitSpeak, unitSpeakInjury, unitSpeakOrder } from './voice.js';

export function totalSquadCapacity(){ return state.squads.reduce((s,sq)=>s+sq.soldiers.length, 0); }

export function totalRosterCapacity(){
  return totalSquadCapacity()
    + state.scouts.reduce((s,sc)=>s+sc.soldiers.length, 0)
    + state.snipers.reduce((s,sn)=>s+sn.soldiers.length, 0)
    + state.engineers.reduce((s,en)=>s+en.soldiers.length, 0)
    + state.mortars.length*MORTAR_CREW_SIZE
    + state.reserve;
}

export function roundRobinDistribute(items, weights){
  const pools = weights.map(w=>({target:w, list:[]}));
  items.forEach(item=>{
    let best=null, bestShare=Infinity;
    pools.forEach(p=>{
      if(p.list.length>=p.target) return;
      const share = p.target>0 ? p.list.length/p.target : Infinity;
      if(share<bestShare){ bestShare=share; best=p; }
    });
    if(best) best.list.push(item);
  });
  return pools.map(p=>p.list);
}

export function gameClockNow(){
  return new Date(GAME_START_DATETIME.getTime() + (state.missionMinutes||0)*60000);
}

export function formatGameClock(d){
  const pad = n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 ${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function mortarTooCloseToFire(mortar, x, y){
  return Math.hypot(x-mortar.x, y-mortar.y) < MORTAR_MIN_RANGE_UNITS;
}

// per user request: mortar max range fixed at 6km.
export function mortarTooFarToFire(mortar, x, y){
  return Math.hypot(x-mortar.x, y-mortar.y) > MORTAR_MAX_RANGE_UNITS;
}

export function setGameSpeedByIndex(idx){ setGameSpeed(GAME_SPEED_ORDER[idx]); }

export function unitMayFire(kind, index, tick){
  const interval = WEAPON_FIRE_INTERVAL[kind] || 3;
  return ((tick + index*2 + WEAPON_FIRE_OFFSET[kind]) % interval) === 0;
}

// per user request: when a multi-figure unit (a friendly squad, an enemy infantry group)
// fires, each currently-alive stick figure should show its own muzzle flash rather than one
// flash pretending to come from the unit's single aggregate marker point. soldiers/offsets are
// parallel arrays (same index order buildHumanoidFigures used to place each figure), so this
// just filters offsets down to the ones still alive.
function aliveFigureOffsets(soldiers, offsets){
  if(!soldiers || !offsets) return null;
  const pts = [];
  soldiers.forEach((s,i)=>{ if(s.alive && offsets[i]) pts.push(offsets[i]); });
  return pts;
}

export let simAccumMs = 0;

export function deltaTurns(){
  return SIM_STEP_MS / GAME_SPEED_INTERVALS[(state && state.gameSpeed) || 'normal'];
}

export let currentTurnFloorValue = -1;

export let turnJustCrossedFlag = false;

export function updateTurnBoundary(){
  const f = Math.floor(state.turns);
  turnJustCrossedFlag = f !== currentTurnFloorValue;
  currentTurnFloorValue = f;
}

export function currentTurnFloor(){ return currentTurnFloorValue; }

export function turnJustCrossed(){ return turnJustCrossedFlag; }

export function isSuppressed(t){ return (t.suppressed||0) > 0; }

export function maintainFriendlySpacing(){
  const units = [
    ...state.squads.map((u,i)=>({u, kind:'squad', idx:i})),
    ...state.snipers.map((u,i)=>({u, kind:'sniper', idx:i})),
    ...state.tanks.map((u,i)=>({u, kind:'tank', idx:i})),
    ...state.sams.map((u,i)=>({u, kind:'sam', idx:i})),
    ...state.engineers.map((u,i)=>({u, kind:'engineer', idx:i})),
  ].filter(({u})=>u.hp===undefined ? unitAlive(u) : u.hp>0);
  for(let i=0;i<units.length;i++){
    for(let j=i+1;j<units.length;j++){
      const a = units[i].u, b = units[j].u;
      const dx = b.x-a.x, dy = b.y-a.y, dist = Math.hypot(dx,dy);
      if(dist>=FRIENDLY_SPACING_RADIUS) continue;
      const nx = dist>0 ? dx/dist : 1, ny = dist>0 ? dy/dist : 0;
      const push = Math.min(FRIENDLY_SPACING_PUSH, (FRIENDLY_SPACING_RADIUS-dist)/2);
      a.x = clamp(a.x-nx*push, SQUAD_RETREAT_LIMIT_X, SQUAD_ASSAULT_LIMIT_X);
      a.y = clamp(a.y-ny*push, 30, CANVAS_H-30);
      b.x = clamp(b.x+nx*push, SQUAD_RETREAT_LIMIT_X, SQUAD_ASSAULT_LIMIT_X);
      b.y = clamp(b.y+ny*push, 30, CANVAS_H-30);
    }
  }
}

export function smoothVisualPos(obj, targetX, targetY){
  const now = performance.now();
  if(obj._visX===undefined || obj._visY===undefined){
    // First time this object is drawn -- no prior visual position to tween from, so it
    // simply appears at its real position instead of sliding in from nowhere.
    obj._visX = targetX; obj._visY = targetY;
    obj._tweenFromX = targetX; obj._tweenFromY = targetY;
    obj._tweenToX = targetX; obj._tweenToY = targetY;
    obj._tweenStartAt = now;
    return {x:obj._visX, y:obj._visY};
  }
  if(obj._tweenToX!==targetX || obj._tweenToY!==targetY){
    if(Math.hypot(targetX-obj._visX, targetY-obj._visY) > ANOMALOUS_JUMP_UNITS){
      obj._visX = targetX; obj._visY = targetY;
      obj._tweenFromX = targetX; obj._tweenFromY = targetY;
      obj._tweenToX = targetX; obj._tweenToY = targetY;
      obj._tweenStartAt = now;
      return {x:obj._visX, y:obj._visY};
    }
    // The underlying logical position moved since the last tween's target -- start a new
    // tween from wherever the marker visually is *right now* (which may still be mid-tween)
    // so redirecting never pops/snaps.
    obj._tweenFromX = obj._visX; obj._tweenFromY = obj._visY;
    obj._tweenToX = targetX; obj._tweenToY = targetY;
    obj._tweenStartAt = now;
  }
  const t = clamp((now-obj._tweenStartAt)/visualTweenDurationMs(), 0, 1);
  const te = smoothstep01(t);
  obj._visX = obj._tweenFromX + (obj._tweenToX-obj._tweenFromX)*te;
  obj._visY = obj._tweenFromY + (obj._tweenToY-obj._tweenFromY)*te;
  return {x:obj._visX, y:obj._visY};
}

export function buildEnemyInfantryGroups(stage){
  // ramp up toward full strength over the first several stages rather than dropping
  // the whole ~50-soldier force on the player from stage 1
  const targetTotal = Math.min(ENEMY_INFANTRY_TOTAL_TARGET, 16 + stage*5);
  const groups = [];
  let total = 0;
  while(total < targetTotal){
    const name = choice(ENEMY_FORMATION_NAMES);
    groups.push({formationName:name, offsets:ENEMY_FORMATION_TEMPLATES[name]});
    total += ENEMY_FORMATION_TEMPLATES[name].length;
  }
  return groups;
}

export function effectMultiplier(shell, fuze, type){
  if(type==='infantry'){
    if(shell==='he' && fuze==='proximity') return 2.5;
    if(shell==='he' && fuze==='impact') return 1.2;
    if(shell==='he' && fuze==='delay') return 0.8;
    return 0.4;
  }
  if(type==='vehicle'){
    if(shell==='heat' && fuze==='impact') return 2.5;
    if(shell==='heat') return 1.3;
    if(shell==='he' && fuze==='delay') return 0.7;
    return 0.4;
  }
  if(type==='artillery'){
    if(shell==='he' && fuze==='impact') return 2.5;
    if(shell==='he' && fuze==='delay') return 1.3;
    if(shell==='heat' && fuze==='impact') return 1.1;
    return 0.4;
  }
  if(type==='drone'){
    if(shell==='he' && fuze==='proximity') return 2.8;
    if(shell==='he' && fuze==='impact') return 1.0;
    if(shell==='heat') return 0.5;
    return 0.5;
  }
  // per user request: a hardened structure rewards bunker-busting loadouts (delay-fused HE
  // penetrates before detonating; HEAT's shaped charge also works against fortifications)
  // over the proximity/impact fuzes that are actually best against soft/aerial targets.
  if(type==='hq'){
    if(shell==='he' && fuze==='delay') return 2.2;
    if(shell==='heat') return 1.6;
    if(shell==='he' && fuze==='impact') return 1.3;
    return 0.5;
  }
  return 0.5;
}

export function bestMortarLoadoutFor(type){
  const pick = MORTAR_BEST_LOADOUT[type] || {shell:'he', fuze:'impact', count:2};
  const fuze = state.fuzeUnlocked[pick.fuze] ? pick.fuze : 'impact';
  return {shell:pick.shell, fuze, count:pick.count};
}

export function applyBestMortarLoadout(mortar, target){
  const loadout = bestMortarLoadoutFor(target.type);
  mortar.fireShell = loadout.shell;
  mortar.fireFuze = loadout.fuze;
  mortar.fireCount = loadout.count;
}

export let state = null;

export function makeSoldiers(people){
  return people.map((p,i)=>({id:i, alive:true, seed:Math.random()*1000, rank:p.rank, name:p.name, vetXp:0}));
}

export function vetLevelOf(soldier){ return Math.min(VET_MAX_LEVEL, Math.floor((soldier.vetXp||0)/VET_XP_PER_LEVEL)); }

export function unitAvgVetLevel(soldiers){
  const alive = soldiers.filter(s=>s.alive);
  if(!alive.length) return 0;
  return alive.reduce((sum,s)=>sum+vetLevelOf(s), 0) / alive.length;
}

export function unitAliveCount(u){ return u.soldiers.filter(s=>s.alive).length; }

export function makeFreshRoster(size, prefix){
  return Array.from({length:size}, (_,i)=>({rank:'2等陸士', name:`${prefix}${i+1}`}));
}

export function addNewSquad(){
  const id = state.squads.length;
  state.squads.push({
    id, order:'hold', pendingDest:null, huntTargetId:null, standingOrder:null,
    x: FRIENDLY_INF_POS.x, y: clamp(FRIENDLY_INF_POS.y + rnd(-60,60), 30, CANVAS_H-30),
    soldiers: makeSoldiers(makeFreshRoster(SQUAD_SIZE, '新兵')),
    reinforceUsed:false, exposure: EXPOSURE_DEFAULT,
  });
  return id;
}

export function addNewScout(){
  const id = state.scouts.length;
  state.scouts.push({
    id, x: SCOUT_X, y: clamp(SCOUT_UPPER_Y + rnd(0, SCOUT_LOWER_Y-SCOUT_UPPER_Y), 20, CANVAS_H-20),
    soldiers: makeSoldiers(makeFreshRoster(SCOUT_SQUAD_SIZE, '新兵')),
    pendingDest:null, exposure: SCOUT_EXPOSURE,
  });
  return id;
}

export function unitAlive(u){ return unitAliveCount(u) > 0; }

export function initGame(){
  simAccumMs = 0;
  lastSimFrameAt = null;
  mortarFireCursor = 0;
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('shop-overlay').classList.remove('show');
  state = {
    stage: 1,
    difficulty: 'normal',
    money: 0,
    ammo: {he:0, heat:0},
    fuzeUnlocked: {impact:true, proximity:false, delay:false},
    equipment: {armor:false, optics:false, extMag:false},
    mortars: Array.from({length:NUM_MORTARS}, (_,i)=>({
      id:i, x:OP_HOME_X, y:OP_HOME_Y+(i-(NUM_MORTARS-1)/2)*40, hp:100, maxHp:100,
      order:'standby', pendingFire:null, pendingDest:null,
      fireShell:'he', fireFuze:'impact', fireCount:2,
      mainlineAngle: null,
      shotsSinceMove: 0, cbWarnTurns: null,
      exposure: EXPOSURE_DEFAULT,
    })),
    squads: [],
    tanks: [],
    sams: [],
    engineers: [],
    walls: [],
    trenches: [],
    scouts: Array.from({length:NUM_SCOUTS}, (_,i)=>({
      id:i, x:SCOUT_X, y:SCOUT_UPPER_Y+i*40,
      soldiers: makeSoldiers(ROSTER_SCOUT_TEAMS[i]), pendingDest:null,
      exposure: SCOUT_EXPOSURE,
    })),
    helis: [],
    snipers: [],
    hq: {x:HQ_X, y:HQ_Y, hp:HQ_MAX_HP, maxHp:HQ_MAX_HP, exposure:EXPOSURE_DEFAULT},
    reserve: RESERVE_SIZE,
    reserveRoster: ROSTER_RESERVE_INITIAL.slice(),
    orderMode: null,
    smartOrderMode: null,
    weather: 'clear',
    terrainGen: null,
    roads: [],
    smokeClouds: [],
    illumFlares: [],
    mines: [],
    turns: 0,
    // per user request: in-game mission clock -- unlike turns (reset to 0 every wave, see
    // startStage()), this counts every action-turn across the WHOLE campaign since
    // initGame(), so the displayed date/time (see gameClockNow()) advances continuously
    // instead of jumping backward each time a new wave starts.
    missionMinutes: 0,
    targets: [],
    // per user request: enemies for a wave don't all appear at once -- see the spawn-staggering
    // block in startStage() and processSpawnQueue(). Holds targets already built for the wave
    // but not yet due to spawn; moved into state.targets one by one as their spawnAt arrives.
    pendingSpawns: [],
    selectedId: null,
    commandBox: null,
    enemyCommandBox: null,
    snipeMortarStrikesPending: 0,
    animating: false,
    inFlightVolleys: 0,
    simRunning: false,
    stageResolved: false,
    gameSpeed: 'normal',
    deploymentMode: 'auto',
    decoyPlacementMode: 'auto',
    placementPending: false,
    placementQueue: [],
    placementIndex: 0,
    decoys: [],
    decoyPlacementPending: false,
    decoyCommandBox: null,
    selectedSeedIndex: 0,
    pendingTerrainGen: null,
    // per user request: FEBA (主戦闘地域前縁) line -- the player-adjustable X the "前進"
    // standing order advances to and the "後退" standing order falls back to (see
    // applySquadMovement/applyEngineerMovement/applyTankMovement/applySniperMovement).
    // Persists across waves (not reset in startStage()) since it's a player-set control.
    febaX: SQUAD_ADVANCE_LIMIT_X,
  };
  resetAllVfx();
  log('sys', 'システム', `コンシム v${GAME_VERSION} 起動。マップと配置方法を選択し、作戦を開始せよ。`);
  rollMapSeedCandidates();
  renderMapSelectOverlay();
  document.getElementById('map-select-overlay').classList.add('show');
}

export let mapSeedCandidates = [];

export function rollMapSeedCandidates(){
  mapSeedCandidates = [];
  for(let i=0;i<MAP_SEED_CANDIDATE_COUNT;i++){
    const seed = Math.floor(Math.random()*0xFFFFFFFF);
    mapSeedCandidates.push(generateProceduralTerrain(seed, pickArchetypeForStage(1, Math.random)));
  }
  state.selectedSeedIndex = 0;
}

export function startSetup(){
  const gen = mapSeedCandidates[state.selectedSeedIndex];
  if(!gen) return;
  state.pendingTerrainGen = gen;
  const d = DIFFICULTIES[state.difficulty];
  state.money = d.startMoney;
  state.ammo = {he:d.startHe, heat:d.startHeat};
  state.fuzeUnlocked = {impact:true, proximity:true, delay:true};
  document.getElementById('map-select-overlay').classList.remove('show');
  log('sys','システム', `戦場「${gen.label}」・${DEPLOYMENT_MODES[state.deploymentMode].label}・擬陣地${DECOY_MODES[state.decoyPlacementMode].label}で作戦開始。全弾種・信管を装備済み。`);
  startBgm();
  deployStage();
}

export function buildHeliTarget(hpMult){
  const spot = generateSpots(1)[0];
  const def = TARGET_TYPES.heli;
  const hp = Math.round(def.hp*hpMult);
  const dx = spot.x-OP.x, dy = spot.y-OP.y;
  const trueBearing = (Math.atan2(dx,-dy)*180/Math.PI+360)%360;
  const trueDistance = Math.sqrt(dx*dx+dy*dy);
  return {
    id:'HELI', type:'heli', def,
    trueX:spot.x, trueY:spot.y,
    trueBearing, trueDistance,
    hp, maxHp:hp,
    // per user request: position estimation and detection are gone entirely -- every unit is
    // always visible at its exact true position, and revealed (type identification) is true
    // from the moment it spawns.
    destroyed:false, revealed:true,
    impacts:[], troops:null, formationOffsets:null, formationName:null, speedMult:1,
    suppressed:0,
    exposure: HELI_EXPOSURE,
    heliPhase:'approach', heliCooldown:0, heliBurstLeft:HELI_ATTACK_BURST, heliAnchor:null,
  };
}

export function buildEnemyHqTarget(hpMult){
  const def = TARGET_TYPES.hq;
  const x = rnd(CANVAS_W-70, CANVAS_W-30);
  const y = rnd(60, CANVAS_H-60);
  const hp = Math.round(def.hp*hpMult);
  const dx = x-OP.x, dy = y-OP.y;
  const trueBearing = (Math.atan2(dx,-dy)*180/Math.PI+360)%360;
  const trueDistance = Math.sqrt(dx*dx+dy*dy);
  return {
    id:'HQ', type:'hq', def,
    trueX:x, trueY:y,
    trueBearing, trueDistance,
    hp, maxHp:hp,
    // per user request: unlike every other target, the enemy HQ starts hidden -- it's only
    // revealed once a friendly unit gets within detection range of it (see updateHqDetection()).
    destroyed:false, revealed:false,
    impacts:[], troops:null, formationOffsets:null, formationName:null, speedMult:1,
    suppressed:0,
    exposure: ENEMY_HQ_EXPOSURE,
  };
}

export function deployBoxSize(){
  const w = clamp(DEPLOY_BOX_METERS/(WORLD.scaleX||1), 40, CANVAS_W*0.6);
  const h = clamp(DEPLOY_BOX_METERS/(WORLD.scaleZ||1), 40, CANVAS_H*0.9);
  return {w, h};
}

export function startStage(){
  const stage = state.stage;
  resetClickCycle();
  pickWaveBgm();
  regenerateTerrain(pickTerrainForStage(stage));
  state.smokeClouds = [];
  state.illumFlares = [];
  state.mines = [];
  state.lastStandAnnounced = false;
  // per user request: no more flat "3 units per wave" cap -- infantry now spawns as
  // several formation groups (buildEnemyInfantryGroups) totalling ~50 soldiers, generated
  // independently from the small mixed pool of artillery/vehicle/drone below.
  // per user request: doubled simultaneous enemy count -- two independent group-building
  // passes (each already reaching its own ~50-soldier target) roughly doubles the number of
  // infantry groups, and otherCount (artillery/vehicle/drone) is doubled outright.
  const infantryGroups = [...buildEnemyInfantryGroups(stage), ...buildEnemyInfantryGroups(stage)];
  const otherCount = Math.min(2+Math.floor((stage-1)/3), 6) * 2;
  const diff = DIFFICULTIES[state.difficulty];
  const hpMult = (1 + (stage-1)*0.08) * diff.hpMult * 2; // per user request: enemy defense doubled
  state.weather = stage===1 ? 'clear' : choice(Object.keys(WEATHER_TYPES));
  const weather = WEATHER_TYPES[state.weather];
  const totalCount = infantryGroups.length + otherCount;
  const spots = generateSpots(totalCount);
  const otherTypes = pickTypesForCount(otherCount, stage);

  const centroidX = spots.reduce((s,p)=>s+p.x,0)/spots.length;
  const centroidY = spots.reduce((s,p)=>s+p.y,0)/spots.length;

  const targets = spots.map((p,i)=>{
    const isInfantry = i < infantryGroups.length;
    const type = isInfantry ? 'infantry' : otherTypes[i-infantryGroups.length];
    const def = TARGET_TYPES[type];
    const group = isInfantry ? infantryGroups[i] : null;
    const squadSize = isInfantry ? group.offsets.length : 0;
    // per user request: each soldier in an infantry group is now tracked (and rendered)
    // individually rather than the group sharing one HP pool -- soldierMaxHp is the same
    // per-soldier baseline the old aggregate formula implied (def.hp / a 6-man squad).
    const soldierMaxHp = Math.max(1, Math.round((def.hp/ENEMY_FORMATION_BASE_SIZE) * hpMult));
    const hp = isInfantry
      ? soldierMaxHp * squadSize
      : Math.round(def.hp*hpMult);
    const dx = p.x-OP.x, dy = p.y-OP.y;
    const trueBearing = (Math.atan2(dx,-dy)*180/Math.PI+360)%360;
    const trueDistance = Math.sqrt(dx*dx+dy*dy);
    return {
      id: 'T'+(i+1),
      type, def,
      trueX:p.x, trueY:p.y,
      trueBearing, trueDistance,
      hp, maxHp: hp,
      destroyed:false,
      revealed:true,
      impacts:[],
      // per-soldier state for this infantry group -- named "troops" (not "soldiers") to stay
      // visually distinct from the friendly-unit .soldiers shape ({alive,rank,name}) used on
      // state.squads/scouts/snipers/mortars, since this shape carries hp/maxHp instead.
      troops: isInfantry ? Array.from({length:squadSize},()=>({
        alive:true, hp:soldierMaxHp, maxHp:soldierMaxHp, seed:Math.random()*1000,
      })) : null,
      formationOffsets: isInfantry ? group.offsets : null,
      formationName: isInfantry ? group.formationName : null,
      // per user request: groups should read as scattered swarms converging rather than a
      // single wall advancing in lockstep -- each infantry group keeps its own pace.
      speedMult: isInfantry ? rnd(0.82, 1.18) : 1,
      suppressed: 0,
      exposure: EXPOSURE_DEFAULT,
    };
  });

  targets.push(buildHeliTarget(hpMult));
  // per user request: an alternate win condition -- see checkEnd()/computeReward() -- always
  // present, every wave, placed deep in enemy territory rather than drawn from the spots pool.
  const enemyHqTarget = buildEnemyHqTarget(hpMult);
  targets.push(enemyHqTarget);

  // Tear down every leftover 3D marker from whatever the previous state.targets held
  // (normally already empty via resolveEnemyTurn's pruning, but retryStage() can jump
  // here with a still-live previous wave abandoned mid-fight) so nothing orphaned lingers.
  if(state.targets){
    state.targets.forEach(t=>disposeMarker3d('target'+t.id));
  }
  state.turns = 0;
  // per user request: nothing spawns for the first WAVE_SPAWN_DELAY_MS of a wave, then the
  // rest of the roster trickles in individually (randomized spawnAt within the window) rather
  // than all appearing at once, finishing by WAVE_SPAWN_WINDOW_MS after wave start. The enemy
  // HQ is exempt (see buildEnemyHqTarget) -- it already exists, just hidden until detected.
  const stageStartAt = performance.now();
  state.stageStartAt = stageStartAt;
  targets.forEach(t=>{
    t.spawnAt = t.type==='hq' ? stageStartAt
      : stageStartAt + WAVE_SPAWN_DELAY_MS + Math.random()*(WAVE_SPAWN_WINDOW_MS-WAVE_SPAWN_DELAY_MS);
  });
  state.targets = targets.filter(t=>t.spawnAt<=stageStartAt);
  state.pendingSpawns = targets.filter(t=>t.spawnAt>stageStartAt);
  // per user request: destroyed targets are now pruned from state.targets during the wave
  // (see resolveEnemyTurn) rather than staying in the array flagged destroyed, so anything
  // that needs "how many enemies has this wave thrown in total" (reward par, achievements,
  // the stat-left display, and drone ID generation below) must track it separately from
  // state.targets.length, which now only reflects the currently-live (spawned) count.
  state.targetsSpawnedTotal = targets.length;
  state.selectedId = state.targets[0].id;

  // per user request: a fully wiped-out unit (squad/scout/sniper/mortar) no longer lingers
  // on the map as an inert "destroyed" marker into future waves -- discard it from the
  // roster entirely at wave transition. HQ isn't included here: HQ reaching 0 HP is an
  // immediate game-over (see checkEnd), so it can never still be at 0 HP by the time a new
  // wave starts. No-op on the very first call (stage 1), since these arrays don't exist yet.
  if(state.squads) state.squads = state.squads.filter(sq=>unitAlive(sq));
  if(state.scouts) state.scouts = state.scouts.filter(s=>unitAlive(s));
  if(state.snipers) state.snipers = state.snipers.filter(sn=>unitAlive(sn));
  if(state.mortars) state.mortars = state.mortars.filter(m=>m.hp>0);
  if(state.tanks) state.tanks = state.tanks.filter(tk=>tk.hp>0);
  if(state.sams) state.sams = state.sams.filter(sam=>sam.hp>0);
  if(state.engineers) state.engineers = state.engineers.filter(e=>unitAlive(e));
  // per user request: 防壁(壁)は迫撃砲/戦車と同じく、決心のたびにリセットされる擬陣地とは違い、
  // 波を跨いで恒久的に残る(現実の陣地構築なので、破壊されない限り消えない)。
  if(state.walls) state.walls = state.walls.filter(w=>w.hp>0);

  if(stage===1){
    // first wave ― fresh deployment at full roster strength, confined to a real 1km x 1km
    // box on the map's west edge (see deployBoxSize()). Reuses the original constants'
    // relative left-to-right ordering (HQ, mortars, scouts, snipers, squads) and vertical
    // spread pattern, rescaled to fit inside the box for whatever map is currently loaded.
    const {w: deployBoxW, h: deployBoxH} = deployBoxSize();
    const origSpanX = FRIENDLY_INF_POS.x - HQ_X;
    const deployXScale = origSpanX>0 ? deployBoxW/origSpanX : 1;
    const deployX = origX => HQ_X + (origX-HQ_X)*deployXScale;
    const origSpanY = SCOUT_LOWER_Y - SCOUT_UPPER_Y;
    const deployYScale = origSpanY>0 ? deployBoxH/origSpanY : 1;
    const deployYMid = CANVAS_H/2;
    const deployYMin = deployYMid - deployBoxH/2, deployYMax = deployYMid + deployBoxH/2;

    state.scouts = Array.from({length:NUM_SCOUTS}, (_,i)=>{
      const scoutX = deployX(SCOUT_X);
      const scoutStep = (NUM_SCOUTS>1 ? (SCOUT_LOWER_Y-SCOUT_UPPER_Y)/(NUM_SCOUTS-1) : 0) * INITIAL_DEPLOY_SPACING_MULT * deployYScale;
      const sy = clamp(deployYMid + (i-(NUM_SCOUTS-1)/2)*scoutStep, deployYMin, deployYMax);
      return {
        id: i, x: scoutX, y: sy,
        soldiers: makeSoldiers(ROSTER_SCOUT_TEAMS[i]), pendingDest: null,
        exposure: SCOUT_EXPOSURE,
      };
    });
    if(!state.helis || state.helis.length===0){
      state.helis = [{id:0, x:deployX(OP_HOME_X+180), y:deployYMid- deployBoxH*0.35,
        hp:120, maxHp:120, exposure:EXPOSURE_DEFAULT, orbitAngle:0, observationBonus:0}];
    }
    state.mortars = Array.from({length:NUM_MORTARS}, (_,i)=>({
      id:i, x:deployX(OP_HOME_X), y:clamp(deployYMid+(i-(NUM_MORTARS-1)/2)*40*INITIAL_DEPLOY_SPACING_MULT*deployYScale, deployYMin, deployYMax), hp:100, maxHp:100,
      order:'standby', pendingFire:null, pendingDest:null,
      fireShell:'he', fireFuze:'impact', fireCount:2,
      mainlineAngle: null,
      shotsSinceMove: 0, cbWarnTurns: null,
      crew: ROSTER_MORTAR_CREWS[i],
      exposure: EXPOSURE_DEFAULT,
    }));
    state.squads = Array.from({length:NUM_SQUADS}, (_,si)=>({
      id: si,
      order: 'hold',
      pendingDest: null,
      huntTargetId: null,
      standingOrder: null,
      x: deployX(FRIENDLY_INF_POS.x),
      y: clamp(deployYMid + (si-(NUM_SQUADS-1)/2)*52*INITIAL_DEPLOY_SPACING_MULT*deployYScale, deployYMin, deployYMax),
      soldiers: makeSoldiers(ROSTER_SQUADS[si]),
      reinforceUsed: false,
      exposure: EXPOSURE_DEFAULT,
    }));
    state.snipers = Array.from({length:NUM_SNIPERS}, (_,si)=>({
      id: si,
      order: 'hold',
      pendingDest: null,
      pendingSnipeTargetId: null,
      aimAngle: null,
      standingOrder: null,
      x: deployX(SNIPER_POS.x),
      y: clamp(deployYMid + (si-(NUM_SNIPERS-1)/2)*52*INITIAL_DEPLOY_SPACING_MULT*deployYScale, deployYMin, deployYMax),
      soldiers: makeSoldiers(ROSTER_SNIPER_TEAMS[si]),
      reinforceUsed: false,
      exposure: EXPOSURE_DEFAULT,
    }));
    state.tanks = Array.from({length:NUM_TANKS}, (_,i)=>({
      id: i,
      order: 'hold',
      pendingDest: null,
      huntTargetId: null,
      x: deployX(TANK_POS.x),
      y: clamp(deployYMid + (i-(NUM_TANKS-1)/2)*60*INITIAL_DEPLOY_SPACING_MULT*deployYScale, deployYMin, deployYMax),
      hp: TANK_MAX_HP, maxHp: TANK_MAX_HP,
      exposure: TANK_EXPOSURE,
    }));
    state.sams = Array.from({length:NUM_SAMS}, (_,i)=>({
      id: i,
      order: 'hold',
      pendingDest: null,
      huntTargetId: null,
      x: deployX(SAM_POS.x),
      y: clamp(deployYMid + (i-(NUM_SAMS-1)/2)*60*INITIAL_DEPLOY_SPACING_MULT*deployYScale, deployYMin, deployYMax),
      hp: SAM_MAX_HP, maxHp: SAM_MAX_HP,
      exposure: SAM_EXPOSURE,
    }));
    state.engineers = Array.from({length:NUM_ENGINEERS}, (_,ei)=>({
      id: ei,
      order: 'hold',
      pendingDest: null,
      standingOrder: null,
      x: deployX(ENGINEER_POS.x),
      y: clamp(deployYMid + (ei-(NUM_ENGINEERS-1)/2)*52*INITIAL_DEPLOY_SPACING_MULT*deployYScale, deployYMin, deployYMax),
      soldiers: makeSoldiers(ROSTER_ENGINEER_TEAMS[ei]),
      reinforceUsed: false,
      exposure: EXPOSURE_DEFAULT,
    }));
    state.walls = [];
    state.trenches = [];
    state.hq = {x:HQ_X, y:HQ_Y, hp:HQ_MAX_HP, maxHp:HQ_MAX_HP, exposure:EXPOSURE_DEFAULT, coverBuilt:false, pendingDest:null};
    state.reserve = RESERVE_SIZE;
    state.reserveRoster = ROSTER_RESERVE_INITIAL.slice();
  } else {
    // subsequent waves ― survivors continue from their current position (no
    // redeploy-to-formation-line reset); casualties, HQ/mortar damage, ammo
    // and reserve carry over as before. Orders/pending actions still clear
    // since a new wave needs fresh orders regardless of where units are standing.
    state.scouts.forEach(s=>{
      s.pendingDest = null;
    });
    state.mortars.forEach(m=>{
      m.order = 'standby'; m.pendingFire = null; m.pendingDest = null; m.mainlineAngle = null;
    });
    state.squads.forEach(sq=>{
      // per user request: 大休止中は次のウェーブが始まっても中断されない(orderを'hold'に
      // 戻してしまうと大休止中の表示が消えてしまうため)。
      if(sq.resting) return;
      sq.order = 'hold'; sq.pendingDest = null; sq.huntTargetId = null; sq.reinforceUsed = false;
    });
    state.snipers.forEach(sn=>{
      if(sn.resting) return;
      sn.order = 'hold'; sn.pendingDest = null; sn.pendingSnipeTargetId = null; sn.aimAngle = null; sn.reinforceUsed = false;
    });
    state.tanks.forEach(tk=>{
      tk.order = 'hold'; tk.pendingDest = null; tk.huntTargetId = null;
    });
    state.sams.forEach(sam=>{
      sam.order = 'hold'; sam.pendingDest = null; sam.huntTargetId = null;
    });
    state.engineers.forEach(e=>{
      if(e.resting) return;
      e.order = 'hold'; e.pendingDest = null; e.reinforceUsed = false;
    });
    state.hq.coverBuilt = false;
    state.hq.pendingDest = null;
  }
  state.animating = false;
  state.inFlightVolleys = 0;
  simAccumMs = 0;
  currentTurnFloorValue = -1;
  turnJustCrossedFlag = false;
  state.stageResolved = false;
  state.hpDroppedLow = false;
  state.orderMode = null;
  state.commandBox = null;
  state.enemyCommandBox = null;
  state.snipeMortarStrikesPending = 0;
  // per user request: tanks/engineers/walls weren't captured here (a gap dating from when
  // each was added), so retryStage() left their HP/existence from the failed attempt in
  // place instead of resetting to how this wave actually started, unlike every other roster.
  state.stageStartSnapshot = JSON.parse(JSON.stringify({
    ammo: state.ammo, turns: state.turns, reserve: state.reserve, reserveRoster: state.reserveRoster, hq: state.hq,
    mortars: state.mortars, squads: state.squads, scouts: state.scouts, snipers: state.snipers,
    tanks: state.tanks, sams: state.sams, helis: state.helis, engineers: state.engineers, walls: state.walls, trenches: state.trenches,
  }));
  resetAllVfx();

  document.getElementById('overlay').classList.remove('show');
  log('sys','システム', `WAVE ${stage} / ${STAGE_COUNT} ― 目標${state.targets.length}件を確認。天候: ${weather.label}(${weather.desc})。`);
  log('sys','警報', '戦闘ヘリ1機を確認。ヒットアンドアウェイ戦術(接近→攻撃→離脱)に警戒せよ。');
  // per user request (idea 3): flags the HQ's existence without giving away its position --
  // bearing/distance still need the normal recon flow (revealTarget) like any other target.
  log('sys','情報部', '偵察情報: 敵展開域の奥深くに指揮系統の中枢と思われる陣地を確認。優先撃破に成功すれば残存兵力を問わずWAVEを制圧できる可能性がある(要偵察)。');
  if(stage===1){
    const co = PERSONNEL_ROSTER[0];
    log('sys','司令部', `戦闘団編成完了、総員${PERSONNEL_ROSTER.length}名。総指揮官: ${co.rank} ${co.name}。`);
  }
  state.decoys = [];
  state.decoyPlacementPending = false;
  state.decoyCommandBox = null;
  if(state.deploymentMode === 'manual'){
    state.placementQueue = buildPlacementQueue();
    state.placementIndex = 0;
    state.placementPending = true;
    log('sys','司令部', '手動配置モード。地図をクリックして各ユニットの初期位置を順に指定せよ。');
  } else {
    state.placementPending = false;
    log('sys','システム', '作戦開始。');
    log('op','斥候', '前線に展開完了。各斥候の観測方向を指示せよ。');
  }
  render();
  if(!state.placementPending) applyDecoyPlacementMode(state.decoyPlacementMode);
}

export function buildPlacementQueue(){
  const queue = [];
  state.mortars.forEach((m,idx)=>queue.push({kind:'mortar', idx, label:`迫撃砲${idx+1}`}));
  state.scouts.forEach((s,idx)=>queue.push({kind:'scout', idx, label:`斥候${idx+1}`}));
  state.squads.forEach((sq,idx)=>queue.push({kind:'squad', idx, label:`第${idx+1}小隊`}));
  state.snipers.forEach((sn,idx)=>queue.push({kind:'sniper', idx, label:`狙撃${idx+1}班`}));
  return queue;
}

export function currentPlacementUnit(item){
  if(!item) return null;
  if(item.kind==='mortar') return state.mortars[item.idx];
  if(item.kind==='scout') return state.scouts[item.idx];
  if(item.kind==='squad') return state.squads[item.idx];
  return state.snipers[item.idx];
}

export function handlePlacementClick(px, py){
  const item = state.placementQueue[state.placementIndex];
  if(!item){ finishPlacement(); return; }
  const unit = currentPlacementUnit(item);
  let minX, maxX;
  if(item.kind==='mortar'){ minX = MORTAR_ZONE_MIN_X; maxX = MORTAR_ZONE_MAX_X; }
  else if(item.kind==='scout'){ minX = SQUAD_RETREAT_LIMIT_X; maxX = SCOUT_ADVANCE_LIMIT_X; }
  else { minX = SQUAD_RETREAT_LIMIT_X; maxX = SQUAD_ADVANCE_LIMIT_X; }
  unit.x = clamp(px, minX, maxX);
  unit.y = clamp(py, 20, CANVAS_H-20);
  unit._visX = unit.x; unit._visY = unit.y;
  state.placementIndex++;
  const remaining = state.placementQueue.length - state.placementIndex;
  if(remaining>0){
    log('sys','司令部', `${item.label}、配置完了(残り${remaining}ユニット)。`);
    render();
  } else {
    log('sys','司令部', `${item.label}、配置完了。`);
    finishPlacement();
  }
}

export function skipRemainingPlacement(){
  if(!state.placementPending) return;
  finishPlacement();
}

export function finishPlacement(){
  state.placementPending = false;
  log('sys','司令部', '配置完了。作戦開始。');
  log('op','斥候', '前線に展開完了。各斥候の観測方向を指示せよ。');
  render();
  applyDecoyPlacementMode(state.decoyPlacementMode);
}

export function makeDecoy(x,y){ return {x, y, hp:DECOY_MAX_HP, maxHp:DECOY_MAX_HP, destroyed:false}; }

export function randomDecoySpot(){
  return { x: rnd(SQUAD_RETREAT_LIMIT_X, SQUAD_ADVANCE_LIMIT_X*0.8), y: rnd(30, CANVAS_H-30) };
}

export function applyDecoyPlacementMode(mode){
  state.decoys = [];
  if(mode==='auto'){
    for(let i=0;i<MAX_DECOYS;i++){
      const p = randomDecoySpot();
      state.decoys.push(makeDecoy(p.x, p.y));
    }
    log('sys','工兵', `擬陣地を自動設置(${MAX_DECOYS}箇所)。`);
  } else {
    state.decoyPlacementPending = true;
    log('sys','工兵', `擬陣地、手動設置モード。地図を長押しして最大${MAX_DECOYS}箇所を指定せよ。`);
  }
  render();
  if(!state.decoyPlacementPending) startRealtimeLoop();
}

export function placeDecoyAt(x, y){
  if(!state.decoyPlacementPending || state.decoys.length>=MAX_DECOYS) return;
  state.decoys.push(makeDecoy(clamp(x, SQUAD_RETREAT_LIMIT_X, SQUAD_ADVANCE_LIMIT_X), clamp(y, 30, CANVAS_H-30)));
  log('sys','工兵', `擬陣地を設置(${state.decoys.length}/${MAX_DECOYS})。`);
  if(state.decoys.length>=MAX_DECOYS) finishDecoyPlacement();
  render();
}

export function finishDecoyPlacement(){
  if(!state.decoyPlacementPending) return;
  state.decoyPlacementPending = false;
  log('sys','工兵', `擬陣地の設置完了(${state.decoys.length}箇所)。`);
  render();
  startRealtimeLoop();
}

export function retryStage(){
  const snap = JSON.parse(JSON.stringify(state.stageStartSnapshot));
  state.ammo = snap.ammo;
  state.reserve = snap.reserve;
  state.reserveRoster = snap.reserveRoster;
  state.hq = snap.hq;
  state.mortars = snap.mortars;
  state.squads = snap.squads;
  state.scouts = snap.scouts;
  state.snipers = snap.snipers;
  state.tanks = snap.tanks;
  state.sams = snap.sams;
  state.helis = snap.helis || [];
  state.engineers = snap.engineers;
  state.walls = snap.walls;
  state.trenches = snap.trenches;
  startStage();
}

export function deployStage(){
  document.getElementById('shop-overlay').classList.remove('show');
  startStage();
}

// per user request: the position-estimation feature (jitter, stale last-known tracking) is
// gone entirely -- every unit has exactly one position, its true one. This still clamps to
// keep on-map labels/markers from drawing off the edge of the canvas.
export function estimatedTargetPos(t){
  return {
    x: clamp(t.trueX, ESTIMATE_CLAMP_MARGIN, CANVAS_W-ESTIMATE_CLAMP_MARGIN),
    y: clamp(t.trueY, ESTIMATE_CLAMP_MARGIN, CANVAS_H-ESTIMATE_CLAMP_MARGIN),
  };
}

export function estPos(t){
  const p = estimatedTargetPos(t);
  return { x:p.x, y:p.y, bearing: bearingBetween(OP.x, OP.y, p.x, p.y), dist: Math.hypot(p.x-OP.x, p.y-OP.y) };
}

export function computeDispersionAt(){
  return MORTAR_DISPERSION_UNITS;
}

export function estPosFromMortar(mortar, t){
  const p = estimatedTargetPos(t);
  return { x:p.x, y:p.y, bearing: bearingBetween(mortar.x, mortar.y, p.x, p.y), dist: Math.hypot(p.x-mortar.x, p.y-mortar.y) };
}

export function hasLineOfSight(fromX,fromY,toX,toY){
  const EYE_HEIGHT = 0.12;
  const dist = Math.hypot(toX-fromX, toY-fromY);
  if(terrainTypeAt(toX,toY)===TERRAIN_TYPE_FOREST) return false;
  const steps = Math.max(6, Math.floor(dist/25));
  const fromE = elevationAt(fromX,fromY)+EYE_HEIGHT;
  const toE = elevationAt(toX,toY)+EYE_HEIGHT;
  const smokeClouds = state && state.smokeClouds;
  const walls = state && state.walls;
  for(let i=1;i<steps;i++){
    const t = i/steps;
    const x = fromX+(toX-fromX)*t;
    const y = fromY+(toY-fromY)*t;
    const sightE = fromE+(toE-fromE)*t;
    if(elevationAt(x,y) > sightE+0.02) return false;
    if(terrainTypeAt(x,y)===TERRAIN_TYPE_FOREST) return false;
    if(smokeClouds && smokeClouds.some(c=>Math.hypot(x-c.x,y-c.y) <= SMOKE_RADIUS_UNITS)) return false;
    // per user request: 工兵の防壁(壁)も視線を遮る -- 地形/煙と同じ扱いで、壁の向こうは見えない。
    if(walls && walls.some(w=>w.hp>0 && Math.hypot(x-w.x,y-w.y) <= WALL_RADIUS)) return false;
  }
  return true;
}

export function lastStandActive(){
  return !!state && state.targets.filter(t=>!t.destroyed).length <= LAST_STAND_THRESHOLD;
}

// per user request: detection (sensor range, scout line-of-sight, "recon to identify") is
// gone entirely -- every unit is always visible, so combat outcomes rest solely on cover
// (exposure/concealment, see getUnitExposure/getTargetExposure/rollExposureHit) rather than
// on whether a target has been spotted yet.
export function isTargetDetected(){
  return true;
}

export function clearHqDest(){
  state.hq.pendingDest = null;
  state.orderMode = null;
  render();
}

export function clearTankDest(idx){
  if(!state.tanks[idx]) return;
  state.tanks[idx].pendingDest = null;
  state.orderMode = null;
  render();
}

export function clearSamDest(idx){
  if(!state.sams[idx]) return;
  state.sams[idx].pendingDest = null;
  state.orderMode = null;
  render();
}

export function setEngineerOrder(idx, order){
  if(!state.engineers[idx] || state.engineers[idx].resting) return;
  state.engineers[idx].order = order;
  render();
}

export function armEngineerMoveOrder(idx){
  if(state.engineers[idx] && state.engineers[idx].resting) return;
  state.orderMode = {kind:'engineer-move', idx};
  state.commandBox = null;
  render();
}

export function clearEngineerDest(idx){
  if(!state.engineers[idx]) return;
  state.engineers[idx].pendingDest = null;
  state.orderMode = null;
  render();
}

export let wallIdCounter = 0;

export function armWallBuildOrder(idx){
  if(!state.engineers[idx] || !unitAlive(state.engineers[idx]) || state.engineers[idx].resting) return;
  state.orderMode = {kind:'wall-build', idx};
  state.commandBox = null;
  render();
}

export function buildWallAt(x, y){
  if(state.walls.length >= MAX_WALLS){
    log('sys','システム', `防壁は最大${MAX_WALLS}基まで。既存の壁を破壊してから再構築せよ。`);
    return false;
  }
  if(state.money < WALL_BUILD_COST){
    log('sys','システム', `資金が不足しています(防壁建設 ¥${WALL_BUILD_COST})。`);
    return false;
  }
  state.money -= WALL_BUILD_COST;
  wallIdCounter += 1;
  state.walls.push({ id: wallIdCounter, x, y, hp: WALL_MAX_HP, maxHp: WALL_MAX_HP });
  log('sys','工兵', `工兵小隊、指定地点に防壁を構築(¥${WALL_BUILD_COST}を消費)。`);
  return true;
}

export let trenchIdCounter = 0;

export function armTrenchBuildOrder(idx){
  if(!state.engineers[idx] || !unitAlive(state.engineers[idx]) || state.engineers[idx].resting) return;
  state.orderMode = {kind:'trench-build-p1', idx};
  state.commandBox = null;
  render();
}

export function buildTrenchAt(x1, y1, x2, y2){
  if(state.trenches.length >= MAX_TRENCHES){
    log('sys','システム', `塹壕は最大${MAX_TRENCHES}本まで。`);
    return false;
  }
  if(state.money < TRENCH_BUILD_COST){
    log('sys','システム', `資金が不足しています(塹壕構築 ¥${TRENCH_BUILD_COST})。`);
    return false;
  }
  state.money -= TRENCH_BUILD_COST;
  trenchIdCounter += 1;
  const lengthM = Math.round(Math.hypot(x2-x1, y2-y1) * METERS_PER_UNIT);
  state.trenches.push({ id: trenchIdCounter, x1, y1, x2, y2 });
  log('sys','工兵', `工兵小隊、指定区間に塹壕を構築(全長約${lengthM}m・¥${TRENCH_BUILD_COST}を消費)。`);
  return true;
}

export function clearSquadDest(idx){
  if(!state.squads[idx]) return;
  state.squads[idx].pendingDest = null;
  state.orderMode = null;
  render();
}

export function armScoutMoveOrder(idx){
  if(state.scouts[idx] && state.scouts[idx].resting) return;
  state.orderMode = {kind:'scout-move', idx};
  state.commandBox = null;
  unitSpeakOrder('scout', idx);
  render();
}

export function clearScoutOrder(idx){
  const scout = state.scouts[idx];
  if(!scout) return;
  scout.pendingDest = null;
  state.orderMode = null;
  render();
}

// per user request: updateRevealed's whole detection-reason machinery (sensor contact,
// proximity, squad force-reveal) is gone along with detection itself -- every target except
// the enemy HQ already spawns revealed (see startStage()/buildHeliTarget/etc.; the HQ is the
// one deliberate exception, see updateHqDetection() below). revealTarget() itself stays: many
// engagement call sites below still gate a one-time "first contact" log line on it, and for
// every already-revealed target it now always returns false there -- correctly a no-op.
export function revealTarget(t){
  if(t.revealed) return false;
  t.revealed = true;
  playSfx('identify', 0.4);
  return true;
}

// per user request: the enemy HQ starts hidden and is only revealed once a friendly unit gets
// within detection range of it -- scouts/helis use their own (longer) dedicated sensor range,
// every other friendly unit type only spots it at short (HQ_DETECT_RANGE_UNITS) range.
export function updateHqDetection(){
  const hq = state.targets.find(t=>t.type==='hq');
  if(!hq || hq.destroyed || hq.revealed) return;
  const within = (units, range)=>units.some(u=>Math.hypot(hq.trueX-u.x, hq.trueY-u.y) <= range);
  const spotted =
    within(state.scouts.filter(unitAlive), SCOUT_MAX_RANGE_UNITS) ||
    within((state.helis||[]).filter(h=>h.hp>0), HELI_MAX_RANGE_UNITS) ||
    within(state.squads.filter(sq=>sq.soldiers.some(s=>s.alive)), HQ_DETECT_RANGE_UNITS) ||
    within(state.snipers.filter(sn=>sn.soldiers.some(s=>s.alive)), HQ_DETECT_RANGE_UNITS) ||
    within(state.tanks.filter(tk=>tk.hp>0), HQ_DETECT_RANGE_UNITS) ||
    within(state.sams.filter(sam=>sam.hp>0), HQ_DETECT_RANGE_UNITS) ||
    within(state.mortars.filter(m=>m.hp>0), HQ_DETECT_RANGE_UNITS);
  if(spotted && revealTarget(hq)){
    log('op','斥候', `${hq.id} を発見、<b>${hq.def.label}</b>と識別。`);
  }
}

// per user request: the enemy defends its own HQ -- any friendly unit within
// HQ_DEFENSE_RANGE_UNITS of it, or one that just hit it with mortar fire from further out
// (see the _hqDefenseAttacker* tagging in launchMortarVolley's impact handling), becomes the
// nearby enemy's top priority target. Returns {x,y} to move toward/engage, or null.
export function findHqDefenseThreat(){
  const hq = state.targets.find(t=>t.type==='hq');
  if(!hq || hq.destroyed) return null;
  if(hq._hqDefenseAttackerKind && performance.now()-hq._hqDefenseAttackedAt <= HQ_DEFENSE_ATTACKER_WINDOW_MS){
    const kind = hq._hqDefenseAttackerKind, idx = hq._hqDefenseAttackerIdx;
    const attacker = kind==='mortar' ? state.mortars.find(m=>m.id===idx) : null;
    if(attacker && attacker.hp>0) return {x:attacker.x, y:attacker.y, kind, idx};
  }
  const near = nearestFriendlyAsset(hq.trueX, hq.trueY, true);
  if(near && near.dist <= HQ_DEFENSE_RANGE_UNITS) return near;
  return null;
}

export function resolveOneScoutDecision(scout, idx, dt){
  if(!unitAlive(scout)) return;
  if(scout.resting){ tickUnitRest(scout, `斥候${idx+1}班`, dt); return; }
  if(scout.pendingDest){
    const next = scoutTerrainAwareStep(scout.x, scout.y, scout.pendingDest.x, scout.pendingDest.y, SCOUT_MOVE_CAP*dt);
    scout.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SCOUT_ADVANCE_LIMIT_X);
    scout.y = clamp(next.y, 20, CANVAS_H-20);
    checkMineTrigger('scout', idx, scout.x, scout.y);
    if(Math.hypot(scout.x-scout.pendingDest.x, scout.y-scout.pendingDest.y) < 12){
      scout.pendingDest = null;
      log('op','斥候', `斥候${idx+1}、指定地点に到着。`);
    }
  }
}

export function resolveScoutDecision(dt){
  state.scouts.forEach((scout,idx)=>resolveOneScoutDecision(scout, idx, dt));
}

export function resolveFriendlyHeliTurn(dt){
  (state.helis||[]).forEach(heli=>{
    if(heli.hp<=0) return;
    heli.orbitAngle = (heli.orbitAngle + 0.22*dt) % (Math.PI*2);
    const targetX = clamp(900 + Math.cos(heli.orbitAngle)*260, 520, CANVAS_W-260);
    const targetY = clamp(CANVAS_H/2 + Math.sin(heli.orbitAngle)*150, 40, CANVAS_H-40);
    const next = airborneStep(heli.x, heli.y, targetX, targetY, FRIENDLY_HELI_MOVE_UNITS*dt);
    heli.x = next.x;
    heli.y = next.y;
  });
}

export function allScoutsWiped(){
  return state.scouts.every(s=>!unitAlive(s));
}

export function allSnipersWiped(){
  return state.snipers.every(sn=>!unitAlive(sn));
}

export function allMortarsWiped(){
  return state.mortars.every(m=>m.hp<=0);
}

export function setMortarOrder(idx, order){
  const mortar = state.mortars[idx];
  if(!mortar || !MORTAR_ORDER_LABEL[order]) return;
  mortar.order = order;
  unitSpeakOrder('mortar', idx);
  if(order==='fire'){
    mortar.pendingDest = null;
    state.orderMode = null;
  } else if(order==='standby'){
    mortar.pendingFire = null;
    mortar.pendingDest = null;
    state.orderMode = null;
  } else if(order==='move'){
    mortar.pendingFire = null;
    state.orderMode = {kind:'mortar-move', idx};
    state.commandBox = null;
  }
  render();
}

export function armMortarTargetOrder(idx){
  const mortar = state.mortars[idx];
  if(!mortar) return;
  mortar.order = 'fire';
  mortar.pendingDest = null;
  state.orderMode = {kind:'mortar-target', idx};
  state.commandBox = null;
  render();
}

export function resolveOneMortarDecision(mortar, dt){
  if(mortar.order!=='move' || !mortar.pendingDest) return;
  const now = performance.now();
  // per user request: 10 seconds of packing up before the mortar actually starts moving
  // toward its new position.
  if(mortar.moveDelayUntil!==undefined && now < mortar.moveDelayUntil) return;
  const next = terrainAwareStep(mortar.x, mortar.y, mortar.pendingDest.x, mortar.pendingDest.y, MORTAR_MOVE_CAP*dt);
  mortar.x = clamp(next.x, MORTAR_ZONE_MIN_X, MORTAR_ZONE_MAX_X);
  mortar.y = clamp(next.y, 30, CANVAS_H-30);
  checkMineTrigger('mortar', mortar.id, mortar.x, mortar.y);
  if(Math.hypot(mortar.x-mortar.pendingDest.x, mortar.y-mortar.pendingDest.y) < 12){
    mortar.pendingDest = null;
    mortar.moveDelayUntil = undefined;
    mortar.order = 'standby';
    mortar.shotsSinceMove = 0;
    // per user request: another 10 seconds of setting up before it can fire from the new
    // position -- see mortarNotReadyToFire(), checked wherever a shot is actually queued.
    mortar.fireReadyAt = now + MORTAR_FIRE_READY_DELAY_MS;
    log('mortar','迫撃砲班', `迫撃砲${mortar.id+1}、陣地転換完了。射撃準備中(約${Math.round(MORTAR_FIRE_READY_DELAY_MS/1000)}秒)。`);
    if(mortar.cbWarnTurns!==null && mortar.cbWarnTurns!==undefined){
      mortar.cbWarnTurns = null;
      log('mortar','迫撃砲班', `迫撃砲${mortar.id+1}、対砲兵射撃圏内から離脱に成功。`);
    }
  }
}

// per user request: a mortar that just relocated needs MORTAR_FIRE_READY_DELAY_MS of real time
// to set up before it can fire again.
export function mortarNotReadyToFire(mortar){
  return mortar.fireReadyAt!==undefined && performance.now() < mortar.fireReadyAt;
}

export function resolveMortarDecision(dt){
  state.mortars.forEach(m=>resolveOneMortarDecision(m, dt));
}

export function enemyCounterAttack(dt){
  let anyHit = false;
  const remaining = state.targets.filter(t=>!t.destroyed);
  // Balance note: infantry now arrives as several independent formation groups (see
  // buildEnemyInfantryGroups) instead of one squad-sized target, so without this correction
  // the total number of infantry units rolling for a counter-attack each turn -- and hence
  // total incoming fire on forward assets like scouts -- scales with however many groups the
  // wave happened to split into (up to ~7), silently multiplying threat well beyond what
  // COUNTER_CHANCE.infantry was tuned for. Dividing by the live infantry group count keeps
  // the AGGREGATE attack-attempt rate equivalent to a single infantry unit's, regardless of
  // formation count, so SCOUT_EXPOSURE's intended survivability isn't eaten by this.
  const infantryGroupCount = remaining.filter(t=>t.type==='infantry').length;
  const hqThreat = findHqDefenseThreat();
  {
    remaining.forEach(t=>{
      if(t.destroyed) return;
      // The counter-attack chance roll below is a discrete once-per-turn event (not a
      // continuous rate), so it only evaluates the instant a whole turn is crossed.
      // per user request (correction of an earlier request that had the direction backwards):
      // firing interval shortened, not lengthened -- this used to also stagger across turns
      // (a % 3 turn-modulo, briefly % 30) on top of the once-per-turn gate; that extra stagger
      // is gone now, so the roll is evaluated every single turn, the fastest this gate can go.
      if(!turnJustCrossed()) return;
      // per user request: the enemy HQ is a fixed structure, not a unit with a weapon of its
      // own -- it never counter-attacks (COUNTER_CHANCE/COUNTER_DAMAGE have no 'hq' entry,
      // same as 'heli', whose attacks are instead handled entirely by resolveHeliAssault).
      // 'aa' is excluded the same way -- it's a dedicated anti-air system handled entirely by
      // resolveEnemyAntiAir, not a generic ground-engagement roll here.
      if(t.type==='hq' || t.type==='aa') return;
      if(allScoutsWiped() && allMortarsWiped()) return;
      const suppressionMult = isSuppressed(t) ? SUPPRESSION_COUNTER_MULT : 1;
      const groupCorrection = t.type==='infantry' ? 1/Math.max(1, infantryGroupCount) : 1;
      const chance = (COUNTER_CHANCE[t.type] + state.stage*0.008) * DIFFICULTIES[state.difficulty].counterMult * WEATHER_TYPES[state.weather].counterMult * suppressionMult * groupCorrection;
      if(Math.random() < chance){
        const near = nearestFriendlyAsset(t.trueX, t.trueY, false);
        if(!near) return;
        // per user request: fixed the range asymmetry where enemy infantry could snipe
        // scouts/mortars/HQ from unlimited range here while friendly squads can only engage
        // enemy infantry within SQUAD_ENGAGE_RANGE (see the duel loop in resolveSquadOrders).
        // Artillery is now capped at ARTILLERY_FIRE_RANGE_UNITS too (per user request: cut to
        // 70% of its previous effectively-unlimited reach). vehicle/drone keep unlimited range
        // here -- indirect/stand-off fire is their whole identity, unlike infantry's expected
        // close-range engagement.
        if(t.type==='infantry' && near.dist > SQUAD_ENGAGE_RANGE) return;
        if(t.type==='artillery' && near.dist > ARTILLERY_FIRE_RANGE_UNITS) return;
        // per user request: 工兵の防壁は地上の直接照準射撃(歩兵/車両)も遮る -- 曲射弾を
        // 撃つ砲兵と、上空を飛ぶドローンは対象外(壁は防がない)。丘などの地形も同様に直接照準
        // 射撃だけを遮る -- 味方のresolveSquadOrders/resolveTankOrdersに揃えた対称な扱い。
        if(t.type==='infantry' || t.type==='vehicle'){
          if(!hasLineOfSight(t.trueX, t.trueY, near.x, near.y)) return;
          const blockWall = wallBlockingLineOfFire(t.trueX, t.trueY, near.x, near.y);
          if(blockWall){
            const [wlo,whi] = COUNTER_DAMAGE[t.type];
            damageWall(blockWall, Math.round(rnd(wlo,whi)), `${t.id}(${t.revealed?t.def.label:'未識別目標'})からの攻撃`);
            anyHit = true;
            return;
          }
        }
        const [lo,hi] = COUNTER_DAMAGE[t.type];
        const armorMult = (near.kind==='mortar' && state.equipment.armor) ? 0.75 : 1;
        const altMult = altitudeBonus(t.trueX, t.trueY, near.x, near.y);
        // per user request: hit harder ("全力で攻撃") when the target is whoever's currently
        // threatening the enemy HQ (see findHqDefenseThreat()).
        const hqDefenseMult = (hqThreat && near.kind===hqThreat.kind && near.idx===hqThreat.idx) ? HQ_DEFENSE_DMG_MULT : 1;
        const dmg = Math.round((rnd(lo,hi) + state.stage*0.4) * DIFFICULTIES[state.difficulty].counterMult * armorMult * altMult * hqDefenseMult);
        const sourceLabel = `${t.id}(${t.revealed?t.def.label:'未識別目標'})からの攻撃`;
        anyHit = true;
        const e = estPos(t);
        if(revealTarget(t)){
          log('op','斥候', `${t.id} からの攻撃を確認、<b>${t.def.label}</b>と識別。`);
        }
        if(t.type==='artillery'){
          // per user request: 敵の迫撃砲(砲兵)発射時にも発射音を鳴らす
          playSfx('mortarFire', 0.14);
          projectiles.push({
            startX: e.x, startY: e.y,
            endX: near.x, endY: near.y,
            born: performance.now(),
            duration: FLIGHT_DURATION,
            trajectory: 'arc',
            onLand: ()=>{
              if(rollExposureHit(getUnitExposure(near))){
                damageFriendlyAsset(near, dmg, sourceLabel);
              } else {
                log('sys','回避', `${sourceLabel}は着弾したが、${friendlyFireCandidateLabel(near)}は掩蔽率により被弾を免れた。`);
              }
              render();
            }
          });
          spawn3dProjectile(e.x, e.y, near.x, near.y, FLIGHT_DURATION);
        } else if(rollExposureHit(getUnitExposure(near))){
          damageFriendlyAsset(near, dmg, sourceLabel);
          // per user request: an enemy infantry group's return fire shows a muzzle flash on
          // every one of its still-alive stick figures, not just one flash at the group's
          // aggregate position.
          fireTracer(e.x, e.y, near.x, near.y, 320, t.type==='vehicle' ? 'cannon' : 'rifle',
            t.type==='infantry' ? aliveFigureOffsets(t.troops, t.formationOffsets) : null);
        } else {
          log('sys','回避', `${sourceLabel}を受けたが、${friendlyFireCandidateLabel(near)}は掩蔽率により被弾を免れた。`);
        }
      }
    });
  }
  return anyHit;
}

export function totalAliveSoldiers(){
  return state.squads.reduce((sum,sq)=>sum+sq.soldiers.filter(s=>s.alive).length, 0);
}

export function allSquadsWiped(){
  return state.squads.every(sq=>sq.soldiers.every(s=>!s.alive));
}

export function applyStandingOrder(unit, prefix, assaultAllowed){
  if(!unit.standingOrder) return;
  const aliveSoldiers = unit.soldiers.filter(s=>s.alive);
  if(aliveSoldiers.length===0) return;
  if(unit.standingOrder==='low_hp_retreat'){
    if(aliveSoldiers.length/unit.soldiers.length <= 0.5 && unit.order!=='retreat'){
      unit.order = 'retreat';
      log('sys','司令部', `${prefix} 損耗50%超、既定行動により後退を発令。`);
    }
    return;
  }
  const targetOrder = (unit.standingOrder==='contact_assault' && assaultAllowed) ? 'assault' : 'hold';
  const inContact = state.targets.some(t=>!t.destroyed && Math.hypot(t.trueX-unit.x, t.trueY-unit.y) <= SQUAD_ENGAGE_RANGE);
  if(inContact && unit.order!==targetOrder){
    unit.order = targetOrder;
    log('sys','司令部', `${prefix} 敵と接触、既定行動により${ORDER_LABEL[targetOrder]}を発令。`);
  }
}

export function applyHqMovement(dt){
  const hq = state.hq;
  if(!hq.pendingDest) return;
  const next = terrainAwareStep(hq.x, hq.y, hq.pendingDest.x, hq.pendingDest.y, INFANTRY_MOVE_CAP*dt);
  hq.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ASSAULT_LIMIT_X);
  hq.y = clamp(next.y, 30, CANVAS_H-30);
  checkMineTrigger('hq', 0, hq.x, hq.y);
  if(Math.hypot(hq.x-hq.pendingDest.x, hq.y-hq.pendingDest.y) < 12){
    hq.pendingDest = null;
    log('sys','前線', `指揮所、指定地点への移転完了。`);
  }
}

export function resolveHqMovement(dt){
  if(state.hq.hp<=0 || !state.hq.pendingDest) return false;
  applyHqMovement(dt);
  return true;
}

export function applySquadMovement(sq, sqIdx, dt){
  if(sq.pendingDest){
    const next = terrainAwareStep(sq.x, sq.y, sq.pendingDest.x, sq.pendingDest.y, INFANTRY_MOVE_CAP*dt);
    sq.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ASSAULT_LIMIT_X);
    sq.y = clamp(next.y, 30, CANVAS_H-30);
    checkMineTrigger('squad', sqIdx, sq.x, sq.y);
    if(Math.hypot(sq.x-sq.pendingDest.x, sq.y-sq.pendingDest.y) < 12){
      sq.pendingDest = null;
      log('sys','前線', `第${sqIdx+1}小隊、指定地点に到着。`);
    }
    return;
  }
  if(sq.order==='advance'){
    const next = terrainAwareStep(sq.x, sq.y, SQUAD_ADVANCE_LIMIT_X, sq.y, INFANTRY_MOVE_CAP*dt);
    sq.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ADVANCE_LIMIT_X);
    sq.y = clamp(next.y, 30, CANVAS_H-30);
  } else if(sq.order==='retreat'){
    const next = terrainAwareStep(sq.x, sq.y, SQUAD_ADVANCE_LIMIT_X, sq.y, INFANTRY_MOVE_CAP*dt);
    sq.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ADVANCE_LIMIT_X);
    sq.y = clamp(next.y, 30, CANVAS_H-30);
  } else if(sq.order==='assault'){
    const enemyInfantry = state.targets.filter(t=>!t.destroyed && t.type==='infantry');
    if(enemyInfantry.length){
      let nearest=null, nd=Infinity;
      enemyInfantry.forEach(t=>{
        const e = estPos(t);
        const d = Math.hypot(e.x-sq.x, e.y-sq.y);
        if(d<nd){ nd=d; nearest=e; }
      });
      // per user request: this used to walk straight to the enemy group's exact coordinates
      // with no standoff at all, so an assaulting squad would end up literally on top of the
      // enemy it was fighting. Now it stops closing once within INFANTRY_STANDOFF_UNITS (200m).
      if(nearest && nd > INFANTRY_STANDOFF_UNITS){
        const next = terrainAwareStep(sq.x, sq.y, nearest.x, nearest.y, INFANTRY_MOVE_CAP*dt);
        sq.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ASSAULT_LIMIT_X);
        sq.y = clamp(next.y, 30, CANVAS_H-30);
      }
    } else {
      const next = terrainAwareStep(sq.x, sq.y, SQUAD_ADVANCE_LIMIT_X, sq.y, INFANTRY_MOVE_CAP*dt);
      sq.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ADVANCE_LIMIT_X);
      sq.y = clamp(next.y, 30, CANVAS_H-30);
    }
  } else if(sq.order==='hunt' && sq.huntTargetId){
    const target = state.targets.find(t=>t.id===sq.huntTargetId);
    if(!target || target.destroyed){
      sq.huntTargetId = null;
      sq.order = 'hold';
      log('sys','前線', `第${sqIdx+1}小隊、攻撃目標を喪失(撃破/消失)。待機に移行。`);
    } else {
      const e = estPos(target);
      const dist = Math.hypot(e.x-sq.x, e.y-sq.y);
      if(dist > SQUAD_ENGAGE_RANGE*0.8){
        const next = terrainAwareStep(sq.x, sq.y, e.x, e.y, INFANTRY_MOVE_CAP*dt);
        sq.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ASSAULT_LIMIT_X);
        sq.y = clamp(next.y, 30, CANVAS_H-30);
      }
      // else: already within engage range -- hold position, resolveSquadOrders' duel loop handles the attack
    }
  }
  checkMineTrigger('squad', sqIdx, sq.x, sq.y);
}

export function applyEngineerMovement(en, enIdx, dt){
  if(en.pendingDest){
    const next = terrainAwareStep(en.x, en.y, en.pendingDest.x, en.pendingDest.y, INFANTRY_MOVE_CAP*dt);
    en.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ASSAULT_LIMIT_X);
    en.y = clamp(next.y, 30, CANVAS_H-30);
    checkMineTrigger('engineer', enIdx, en.x, en.y);
    if(Math.hypot(en.x-en.pendingDest.x, en.y-en.pendingDest.y) < 12){
      en.pendingDest = null;
      log('sys','前線', `工兵小隊、指定地点に到着。`);
    }
    return;
  }
  if(en.order==='advance'){
    const next = terrainAwareStep(en.x, en.y, SQUAD_ADVANCE_LIMIT_X, en.y, INFANTRY_MOVE_CAP*dt);
    en.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ADVANCE_LIMIT_X);
    en.y = clamp(next.y, 30, CANVAS_H-30);
  } else if(en.order==='retreat'){
    const next = terrainAwareStep(en.x, en.y, SQUAD_ADVANCE_LIMIT_X, en.y, INFANTRY_MOVE_CAP*dt);
    en.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ADVANCE_LIMIT_X);
    en.y = clamp(next.y, 30, CANVAS_H-30);
  }
  checkMineTrigger('engineer', enIdx, en.x, en.y);
}

export function allEngineersWiped(){
  return !state.engineers.length || state.engineers.every(e=>!unitAlive(e));
}

export function resolveEngineerOrders(dt){
  let anyEvent = false;
  state.engineers.forEach((en, enIdx)=>{
    const aliveSoldiers = en.soldiers.filter(s=>s.alive);
    if(aliveSoldiers.length===0) return;
    if(en.resting){ tickUnitRest(en, '工兵小隊', dt); return; }
    applyStandingOrder(en, '工兵小隊', false);
    const beforeX = en.x, beforeY = en.y;
    applyEngineerMovement(en, enIdx, dt);
    if(en.x!==beforeX || en.y!==beforeY) anyEvent = true;
  });
  return anyEvent;
}

export function resolveSquadOrders(dt){
  let anyEvent = false;
  {
    state.squads.forEach((sq, sqIdx)=>{
      const aliveSoldiers = sq.soldiers.filter(s=>s.alive);
      if(aliveSoldiers.length===0) return;
      // Movement/rest used to be gated by unitMayFire too (on a turn residue offset by 1 from
      // the fire gate below, so the two could never coincide) -- that made squads advance in
      // intermittent pulses. Now that movement is continuous like every other unit, that gate
      // is dropped here; only the fire gate further down keeps its original turn cadence.
      if(sq.resting){ tickUnitRest(sq, `第${sqIdx+1}小隊`, dt); return; }
      applyStandingOrder(sq, `第${sqIdx+1}小隊`, true);
      applySquadMovement(sq, sqIdx, dt);

      // per user request: 砲兵は無装甲の砲側員なので、歩兵と同じ通常の交戦対象に含める
      // (以前は歩兵タイプのみが対象で、真横にいる砲兵さえ無視して撃たなかった)。
      let engageTargets = state.targets.filter(t=>!t.destroyed && (t.type==='infantry' || t.type==='artillery'));
      if(sq.order==='hunt' && sq.huntTargetId){
        // per user request: small arms can't effectively engage aircraft -- anti-air is the
        // SAM's job now (see resolveSamOrders).
        const huntTarget = state.targets.find(t=>t.id===sq.huntTargetId && !t.destroyed && t.type!=='heli' && t.type!=='drone');
        if(huntTarget && !engageTargets.includes(huntTarget)) engageTargets = engageTargets.concat([huntTarget]);
      }
      if(engageTargets.length===0) return;
      // Firing is a discrete once-per-turn event (unitMayFire's tick-modulo stagger is
      // deterministic, not a rate) -- only evaluate it the instant a whole turn is crossed,
      // using the original tick formula unchanged.
      if(!turnJustCrossed() || !unitMayFire('squad', sqIdx, currentTurnFloor())) return;
      let dmgMult=1, casualtyMult=1;
      if(sq.order==='assault' || sq.order==='hunt'){ dmgMult=1.6; casualtyMult=1.5; }
      else if(sq.order==='hold'){ dmgMult=0.9; casualtyMult=0.6; }
      else if(sq.order==='retreat'){ dmgMult=0.5; casualtyMult=0.7; }

      let firedThisTick = false;
      engageTargets.forEach(t=>{
        if(firedThisTick) return;
        if(t.destroyed) return;
        const e = estPos(t);
        const dist = Math.hypot(e.x-sq.x, e.y-sq.y);
        if(dist > SQUAD_ENGAGE_RANGE) return;
        // per user request: 丘などの地形に完全に遮蔽された目標とは交戦できない -- 狙撃兵は
        // 既にhasLineOfSightでこれを判定しているが、歩兵小隊にはこのチェックが漏れていて、
        // 丘の向こうの敵も普通に撃ち抜けてしまっていた。
        if(!hasLineOfSight(sq.x, sq.y, t.trueX, t.trueY)) return;
        // per user request: 工兵の防壁(壁)は直接照準の銃撃も遮る -- 射線上に壁があれば、
        // 目標の代わりに壁が被弾する。
        const blockWall = wallBlockingLineOfFire(sq.x, sq.y, t.trueX, t.trueY);
        if(blockWall){
          anyEvent = true;
          damageWall(blockWall, Math.round(rnd(INFANTRY_DUEL_DMG_TO_ENEMY[0], INFANTRY_DUEL_DMG_TO_ENEMY[1])), `第${sqIdx+1}小隊の射撃`);
          return;
        }
        if(revealTarget(t)){
          log('op','斥候', `第${sqIdx+1}小隊が${t.id}と交戦、<b>${t.def.label}</b>と識別。`);
        }
        const curAlive = sq.soldiers.filter(s=>s.alive);
        if(curAlive.length===0) return;
        const suppressed = isSuppressed(t);
        const strengthFrac = curAlive.length/sq.soldiers.length;
        const squadAltMult = altitudeBonus(sq.x, sq.y, t.trueX, t.trueY);
        const suppressionDmgMult = suppressed ? SUPPRESSION_DUEL_DMG_BONUS : 1;
        const enemyExposureMult = exposureNormalizedMult(getTargetExposure(t));
        const vetDmgMult = 1 + unitAvgVetLevel(sq.soldiers)*VET_DMG_BONUS_PER_LEVEL;
        const dmgToEnemy = Math.round(rnd(INFANTRY_DUEL_DMG_TO_ENEMY[0], INFANTRY_DUEL_DMG_TO_ENEMY[1]) * strengthFrac * dmgMult * squadAltMult * suppressionDmgMult * enemyExposureMult * vetDmgMult);
        applyDamageToTarget(t, dmgToEnemy);
        anyEvent = true;
        firedThisTick = true;
        // per user request: show a shooting animation for the squad's own outgoing fire too,
        // not just the enemy's return fire on a casualty (see fireTracer() below). Each alive
        // soldier's own stick figure gets its own muzzle flash (aliveFigureOffsets), not one
        // flash pretending to come from the squad's single aggregate marker point.
        fireTracer(sq.x, sq.y, e.x, e.y, 220, 'rifle', aliveFigureOffsets(sq.soldiers, SQUAD_GRID_OFFSETS));
        if(t.hp<=0 && !t.destroyed){
          t.destroyed = true; t.hp = 0;
          log('op','斥候', `${t.id} 第${sqIdx+1}小隊との交戦で撃破を確認。`);
          onTargetDestroyed(t);
        }
        const enemyAltMult = altitudeBonus(t.trueX, t.trueY, sq.x, sq.y);
        const suppressionCasualtyMult = suppressed ? SUPPRESSION_CASUALTY_MULT : 1;
        const casualtyChance = (0.08 + state.stage*0.008) * casualtyMult * enemyAltMult * suppressionCasualtyMult * exposureNormalizedMult(getUnitExposure({kind:'squad', idx:sqIdx}));
        if(Math.random() < casualtyChance){
          const victim = choice(curAlive);
          victim.alive = false;
          log('sys','前線', `第${sqIdx+1}小隊、${t.id}との交戦で<b>${victim.rank} ${victim.name}</b> 戦死。残存 ${sq.soldiers.filter(s=>s.alive).length}/${sq.soldiers.length}名。`);
          announceTicker(`${victim.rank} ${victim.name} 殉職`, 'death');
          // per user request: the enemy infantry group's return fire also shows a muzzle flash
          // on each of its still-alive stick figures rather than one flash at its aggregate
          // position (t.type check since this branch also covers artillery targets, which have
          // no individual troop figures to flash from).
          fireTracer(e.x, e.y, sq.x, sq.y, 280, 'rifle', t.type==='infantry' ? aliveFigureOffsets(t.troops, t.formationOffsets) : null);
          unitSpeakInjury('squad', sqIdx);
        }
      });
    });
  }
  if(allSquadsWiped()){
    log('sys','前線', '自軍歩兵、全小隊が壊滅。前線が崩壊した。');
    anyEvent = true;
  }
  return anyEvent;
}

export function applyTankMovement(tank, idx, dt){
  if(tank.pendingDest){
    const next = terrainAwareStep(tank.x, tank.y, tank.pendingDest.x, tank.pendingDest.y, TANK_MOVE_CAP*dt);
    tank.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ASSAULT_LIMIT_X);
    tank.y = clamp(next.y, 30, CANVAS_H-30);
    checkMineTrigger('tank', idx, tank.x, tank.y);
    if(Math.hypot(tank.x-tank.pendingDest.x, tank.y-tank.pendingDest.y) < 12){
      tank.pendingDest = null;
      log('sys','前線', `戦車${idx+1}、指定地点に到着。`);
    }
    return;
  }
  if(tank.order==='advance'){
    const next = terrainAwareStep(tank.x, tank.y, SQUAD_ADVANCE_LIMIT_X, tank.y, TANK_MOVE_CAP*dt);
    tank.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ADVANCE_LIMIT_X);
    tank.y = clamp(next.y, 30, CANVAS_H-30);
  } else if(tank.order==='retreat'){
    const next = terrainAwareStep(tank.x, tank.y, SQUAD_ADVANCE_LIMIT_X, tank.y, TANK_MOVE_CAP*dt);
    tank.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ADVANCE_LIMIT_X);
    tank.y = clamp(next.y, 30, CANVAS_H-30);
  } else if(tank.order==='hunt' && tank.huntTargetId){
    const target = state.targets.find(t=>t.id===tank.huntTargetId);
    if(!target || target.destroyed){
      tank.huntTargetId = null;
      tank.order = 'hold';
      log('sys','前線', `戦車${idx+1}、攻撃目標を喪失(撃破/消失)。待機に移行。`);
    } else {
      const e = estPos(target);
      const dist = Math.hypot(e.x-tank.x, e.y-tank.y);
      if(dist > TANK_ENGAGE_RANGE*0.8){
        const next = terrainAwareStep(tank.x, tank.y, e.x, e.y, TANK_MOVE_CAP*dt);
        tank.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ASSAULT_LIMIT_X);
        tank.y = clamp(next.y, 30, CANVAS_H-30);
      }
    }
  }
  checkMineTrigger('tank', idx, tank.x, tank.y);
}

export function allTanksWiped(){
  return !state.tanks.length || state.tanks.every(tk=>tk.hp<=0);
}

export function applySamMovement(sam, idx, dt){
  if(sam.pendingDest){
    const next = terrainAwareStep(sam.x, sam.y, sam.pendingDest.x, sam.pendingDest.y, SAM_MOVE_CAP*dt);
    sam.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ASSAULT_LIMIT_X);
    sam.y = clamp(next.y, 30, CANVAS_H-30);
    checkMineTrigger('sam', idx, sam.x, sam.y);
    if(Math.hypot(sam.x-sam.pendingDest.x, sam.y-sam.pendingDest.y) < 12){
      sam.pendingDest = null;
      log('sys','前線', `対空${idx+1}、指定地点に到着。`);
    }
    return;
  }
  if(sam.order==='advance'){
    const next = terrainAwareStep(sam.x, sam.y, SQUAD_ADVANCE_LIMIT_X, sam.y, SAM_MOVE_CAP*dt);
    sam.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ADVANCE_LIMIT_X);
    sam.y = clamp(next.y, 30, CANVAS_H-30);
  } else if(sam.order==='retreat'){
    const next = terrainAwareStep(sam.x, sam.y, SQUAD_ADVANCE_LIMIT_X, sam.y, SAM_MOVE_CAP*dt);
    sam.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ADVANCE_LIMIT_X);
    sam.y = clamp(next.y, 30, CANVAS_H-30);
  } else if(sam.order==='hunt' && sam.huntTargetId){
    const target = state.targets.find(t=>t.id===sam.huntTargetId);
    if(!target || target.destroyed){
      sam.huntTargetId = null;
      sam.order = 'hold';
      log('sys','前線', `対空${idx+1}、攻撃目標を喪失(撃破/消失)。待機に移行。`);
    } else {
      const e = estPos(target);
      const dist = Math.hypot(e.x-sam.x, e.y-sam.y);
      if(dist > SAM_ENGAGE_RANGE*0.8){
        const next = terrainAwareStep(sam.x, sam.y, e.x, e.y, SAM_MOVE_CAP*dt);
        sam.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ASSAULT_LIMIT_X);
        sam.y = clamp(next.y, 30, CANVAS_H-30);
      }
    }
  }
  checkMineTrigger('sam', idx, sam.x, sam.y);
}

export function allSamsWiped(){
  return !state.sams.length || state.sams.every(sam=>sam.hp<=0);
}

export function resolveSamOrders(dt){
  let anyEvent = false;
  {
    state.sams.forEach((sam, idx)=>{
      if(sam.hp<=0) return;
      applySamMovement(sam, idx, dt);

      let engageTargets = state.targets.filter(t=>!t.destroyed && (t.type==='heli' || t.type==='drone'));
      if(sam.order==='hunt' && sam.huntTargetId){
        const huntTarget = state.targets.find(t=>t.id===sam.huntTargetId && !t.destroyed && (t.type==='heli' || t.type==='drone'));
        if(huntTarget && !engageTargets.includes(huntTarget)) engageTargets = engageTargets.concat([huntTarget]);
      }
      if(engageTargets.length===0) return;
      if(!turnJustCrossed() || !unitMayFire('sam', idx, currentTurnFloor())) return;
      let dmgMult=1;
      if(sam.order==='hunt'){ dmgMult=1.5; }
      else if(sam.order==='hold'){ dmgMult=0.9; }
      else if(sam.order==='retreat'){ dmgMult=0.5; }

      let firedThisTick = false;
      engageTargets.forEach(t=>{
        if(firedThisTick) return;
        if(t.destroyed) return;
        const e = estPos(t);
        const dist = Math.hypot(e.x-sam.x, e.y-sam.y);
        if(dist > SAM_ENGAGE_RANGE) return;
        if(revealTarget(t)){
          log('op','斥候', `対空${idx+1}が${t.id}と交戦、<b>${t.def.label}</b>と識別。`);
        }
        const samAltMult = altitudeBonus(sam.x, sam.y, t.trueX, t.trueY);
        const enemyExposureMult = exposureNormalizedMult(getTargetExposure(t));
        const dmgToEnemy = Math.round(rnd(SAM_DUEL_DMG_TO_ENEMY[0], SAM_DUEL_DMG_TO_ENEMY[1]) * dmgMult * samAltMult * enemyExposureMult);
        applyDamageToTarget(t, dmgToEnemy);
        anyEvent = true;
        firedThisTick = true;
        fireTracer(sam.x, sam.y, e.x, e.y, 220, 'missile');
        if(t.hp<=0 && !t.destroyed){
          t.destroyed = true; t.hp = 0;
          log('op','斥候', `${t.id} 対空${idx+1}との交戦で撃破を確認。`);
          onTargetDestroyed(t);
        }
      });
    });
  }
  return anyEvent;
}

export function resolveTankOrders(dt){
  let anyEvent = false;
  {
    state.tanks.forEach((tank, idx)=>{
      if(tank.hp<=0) return;
      applyTankMovement(tank, idx, dt);

      let engageTargets = state.targets.filter(t=>!t.destroyed && (t.type==='infantry' || t.type==='vehicle'));
      if(tank.order==='hunt' && tank.huntTargetId){
        // per user request: direct-fire tank guns can't effectively engage aircraft -- anti-air
        // is the SAM's job now (see resolveSamOrders).
        const huntTarget = state.targets.find(t=>t.id===tank.huntTargetId && !t.destroyed && t.type!=='heli' && t.type!=='drone');
        if(huntTarget && !engageTargets.includes(huntTarget)) engageTargets = engageTargets.concat([huntTarget]);
      }
      if(engageTargets.length===0) return;
      if(!turnJustCrossed() || !unitMayFire('tank', idx, currentTurnFloor())) return;
      let dmgMult=1, incomingMult=1;
      if(tank.order==='hunt'){ dmgMult=1.5; incomingMult=1.3; }
      else if(tank.order==='hold'){ dmgMult=0.9; incomingMult=0.7; }
      else if(tank.order==='retreat'){ dmgMult=0.5; incomingMult=0.6; }

      let firedThisTick = false;
      engageTargets.forEach(t=>{
        if(firedThisTick) return;
        if(t.destroyed || tank.hp<=0) return;
        const e = estPos(t);
        const dist = Math.hypot(e.x-tank.x, e.y-tank.y);
        if(dist > TANK_ENGAGE_RANGE) return;
        // per user request: 丘に完全に遮蔽された目標とは交戦できない(狙撃兵と同じ扱い -- 詳細は
        // resolveSquadOrdersの同様のhasLineOfSightチェックのコメントを参照)。
        if(!hasLineOfSight(tank.x, tank.y, t.trueX, t.trueY)) return;
        const blockWall = wallBlockingLineOfFire(tank.x, tank.y, t.trueX, t.trueY);
        if(blockWall){
          anyEvent = true;
          damageWall(blockWall, Math.round(rnd(TANK_DUEL_DMG_TO_ENEMY[0], TANK_DUEL_DMG_TO_ENEMY[1])), `戦車${idx+1}の砲撃`);
          return;
        }
        if(revealTarget(t)){
          log('op','斥候', `戦車${idx+1}が${t.id}と交戦、<b>${t.def.label}</b>と識別。`);
        }
        const suppressed = isSuppressed(t);
        const tankAltMult = altitudeBonus(tank.x, tank.y, t.trueX, t.trueY);
        const suppressionDmgMult = suppressed ? SUPPRESSION_DUEL_DMG_BONUS : 1;
        const enemyExposureMult = exposureNormalizedMult(getTargetExposure(t));
        const dmgToEnemy = Math.round(rnd(TANK_DUEL_DMG_TO_ENEMY[0], TANK_DUEL_DMG_TO_ENEMY[1]) * dmgMult * tankAltMult * suppressionDmgMult * enemyExposureMult);
        applyDamageToTarget(t, dmgToEnemy);
        anyEvent = true;
        firedThisTick = true;
        fireTracer(tank.x, tank.y, e.x, e.y, 220, 'cannon');
        if(t.hp<=0 && !t.destroyed){
          t.destroyed = true; t.hp = 0;
          log('op','斥候', `${t.id} 戦車${idx+1}との交戦で撃破を確認。`);
          onTargetDestroyed(t);
        }
        const enemyAltMult = altitudeBonus(t.trueX, t.trueY, tank.x, tank.y);
        const suppressionCasualtyMult = suppressed ? SUPPRESSION_CASUALTY_MULT : 1;
        const hitChance = (0.10 + state.stage*0.006) * incomingMult * enemyAltMult * suppressionCasualtyMult * exposureNormalizedMult(getUnitExposure({kind:'tank', idx}));
        if(Math.random() < hitChance){
          const dmg = Math.round(rnd(TANK_INCOMING_DMG[0], TANK_INCOMING_DMG[1]));
          const wasAlive = tank.hp>0;
          tank.hp = Math.max(0, tank.hp-dmg);
          log('sys','前線', `戦車${idx+1}、${t.id}との交戦で被弾(-${dmg}HP、残り${tank.hp}/${tank.maxHp})。`);
          fireTracer(e.x, e.y, tank.x, tank.y, 280, t.type==='vehicle' ? 'cannon' : 'rifle');
          if(wasAlive && tank.hp<=0){
            log('sys','前線', `戦車${idx+1}、撃破される。`);
            spawnDestructionEffect(tank.x, tank.y, `戦車${idx+1} 撃破!`, FRIENDLY_MARK_COLOR);
          }
        }
      });
    });
  }
  return anyEvent;
}

export function applySniperMovement(sn, dt){
  if(sn.pendingDest){
    const next = terrainAwareStep(sn.x, sn.y, sn.pendingDest.x, sn.pendingDest.y, SNIPER_MOVE_CAP*dt);
    sn.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ADVANCE_LIMIT_X);
    sn.y = clamp(next.y, 30, CANVAS_H-30);
    checkMineTrigger('sniper', sn.id, sn.x, sn.y);
    if(Math.hypot(sn.x-sn.pendingDest.x, sn.y-sn.pendingDest.y) < 12){
      sn.pendingDest = null;
      log('sys','前線', `狙撃${sn.id+1}班、指定地点に到着。`);
    }
    return;
  }
  if(sn.order==='advance'){
    const next = terrainAwareStep(sn.x, sn.y, SQUAD_ADVANCE_LIMIT_X, sn.y, SNIPER_MOVE_CAP*dt);
    sn.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ADVANCE_LIMIT_X);
    sn.y = clamp(next.y, 30, CANVAS_H-30);
  } else if(sn.order==='retreat'){
    const next = terrainAwareStep(sn.x, sn.y, SQUAD_ADVANCE_LIMIT_X, sn.y, SNIPER_MOVE_CAP*dt);
    sn.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ADVANCE_LIMIT_X);
    sn.y = clamp(next.y, 30, CANVAS_H-30);
  }
  checkMineTrigger('sniper', sn.id, sn.x, sn.y);
}

export function sniperEngageTarget(sn, t){
  if(revealTarget(t)){
    log('op','斥候', `狙撃${sn.id+1}班が${t.id}を捕捉、<b>${t.def.label}</b>と識別。`);
  }
  if(!rollExposureHit(getTargetExposure(t))){
    log('mortar','狙撃', `狙撃${sn.id+1}班、${t.id}へ発砲するも掩蔽率により外す。`);
    return;
  }
  const curAlive = sn.soldiers.filter(s=>s.alive);
  const strengthFrac = curAlive.length/sn.soldiers.length;
  const altMult = altitudeBonus(sn.x, sn.y, t.trueX, t.trueY);
  const suppressionDmgMult = isSuppressed(t) ? SUPPRESSION_DUEL_DMG_BONUS : 1;
  const vetDmgMult = 1 + unitAvgVetLevel(sn.soldiers)*VET_DMG_BONUS_PER_LEVEL;
  const dmg = Math.round(rnd(SNIPER_DMG[0], SNIPER_DMG[1]) * strengthFrac * altMult * suppressionDmgMult * vetDmgMult);
  // per user request: 処刑(execute) -- a target already worn down to
  // SNIPER_EXECUTE_HP_THRESHOLD or below is finished off outright on a connecting hit,
  // regardless of remaining HP. Makes snipers the dedicated finisher once mortars/squads
  // have softened a target up, rather than just another (weaker) damage source.
  const isExecute = t.maxHp>0 && (t.hp/t.maxHp) <= SNIPER_EXECUTE_HP_THRESHOLD;
  applyDamageToTarget(t, isExecute ? t.hp : dmg);
  log('mortar','狙撃', isExecute
    ? `狙撃${sn.id+1}班、${t.id}へ<b>止めの一撃</b>。撃破を確認。`
    : `狙撃${sn.id+1}班、${t.id}に精密射撃(効果 ${dmg})。`);
  fireTracer(sn.x, sn.y, t.trueX, t.trueY, 180, 'rifle');
  if(t.hp<=0 && !t.destroyed){
    t.destroyed = true; t.hp = 0;
    log('fdc','FDC', `${t.id} 狙撃により<b>撃破を確認</b>。`);
    onTargetDestroyed(t);
    if(sn.pendingSnipeTargetId===t.id) sn.pendingSnipeTargetId = null;
  }
}

export function findTargetOnSniperLine(sn){
  if(sn.aimAngle===null || sn.aimAngle===undefined) return null;
  const rad = sn.aimAngle*Math.PI/180;
  const dirX = Math.sin(rad), dirY = -Math.cos(rad);
  let best=null, bestProj=Infinity;
  state.targets.forEach(t=>{
    if(t.destroyed) return;
    // per user request: small arms can't effectively engage aircraft -- anti-air is the SAM's
    // job now (see resolveSamOrders).
    if(t.type==='heli' || t.type==='drone') return;
    const vx = t.trueX-sn.x, vy = t.trueY-sn.y;
    const proj = vx*dirX + vy*dirY;
    if(proj<0 || proj>SNIPER_AIM_RANGE_UNITS) return;
    const perp = Math.abs(vx*dirY - vy*dirX);
    if(perp > SNIPER_AIM_LINE_WIDTH_UNITS/2) return;
    if(proj<bestProj){ bestProj=proj; best=t; }
  });
  // per user request: 工兵の防壁もこの射撃ラインを遮る -- ビーム上の的より手前に壁があれば
  // そちらが優先され(的には届かない)、狙撃班はその壁を撃つ。
  const wallHit = nearestWallHit(sn.x, sn.y, sn.x+dirX*SNIPER_AIM_RANGE_UNITS, sn.y+dirY*SNIPER_AIM_RANGE_UNITS);
  if(wallHit && wallHit.t*SNIPER_AIM_RANGE_UNITS < bestProj){
    return {wall: wallHit.wall};
  }
  return best;
}

export function findAutoSniperTarget(sn){
  let best=null, bd=Infinity;
  state.targets.forEach(t=>{
    if(t.destroyed) return;
    if(t.type==='heli' || t.type==='drone') return;
    if(!isTargetDetected(t)) return;
    const dist = Math.hypot(t.trueX-sn.x, t.trueY-sn.y);
    if(dist > SNIPER_RANGE_UNITS) return;
    if(!hasLineOfSight(sn.x, sn.y, t.trueX, t.trueY)) return;
    if(dist<bd){ bd=dist; best=t; }
  });
  return best;
}

export function callInMortarHeatStrike(target, sn){
  const aliveMortars = state.mortars.filter(m=>m.hp>0);
  if(!aliveMortars.length) return;
  let nearest=null, nd=Infinity;
  aliveMortars.forEach(m=>{
    const d = Math.hypot(m.x-target.trueX, m.y-target.trueY);
    if(d<nd){ nd=d; nearest=m; }
  });
  if(!nearest) return;
  if(mortarTooFarToFire(nearest, target.trueX, target.trueY)){
    log('sys','システム', `狙撃${sn.id+1}班より対装甲目標発見も、最寄りの迫撃砲${nearest.id+1}が射程外(最大射程${MORTAR_MAX_RANGE_M}m)。徹甲弾射撃を断念。`);
    return;
  }
  if(mortarNotReadyToFire(nearest)){
    log('sys','システム', `狙撃${sn.id+1}班より対装甲目標発見も、最寄りの迫撃砲${nearest.id+1}は陣地転換直後で射撃準備中。徹甲弾射撃を断念。`);
    return;
  }
  if(revealTarget(target)){
    log('op','斥候', `狙撃${sn.id+1}班が${target.id}を捕捉、<b>${target.def.label}</b>と識別。`);
  }
  if(state.ammo.heat <= 0){
    log('sys','システム', `狙撃${sn.id+1}班より対装甲目標発見、迫撃砲${nearest.id+1}へ徹甲弾射撃を要求するも弾薬不足。`);
    return;
  }
  log('fdc','FDC', `狙撃${sn.id+1}班より対装甲目標発見の報告。迫撃砲${nearest.id+1}が${target.id}へ徹甲弾射撃。`);
  state.ammo.heat -= 1;
  state.snipeMortarStrikesPending += 1;
  launchMortarVolley(nearest, 'heat', 'impact', 1, {x:target.trueX, y:target.trueY, snappedId:target.id}, target, ()=>{
    state.snipeMortarStrikesPending -= 1;
    checkEnd();
    render();
  });
}

export function resolveSniperOrders(dt){
  let anyEvent = false;
  {
    state.snipers.forEach(sn=>{
      const aliveSoldiers = sn.soldiers.filter(s=>s.alive);
      if(aliveSoldiers.length===0) return;
      if(sn.resting){ tickUnitRest(sn, `狙撃${sn.id+1}班`, dt); return; }
      applyStandingOrder(sn, `狙撃${sn.id+1}班`, false);
      applySniperMovement(sn, dt);
      if(!turnJustCrossed() || !unitMayFire('sniper', sn.id, currentTurnFloor())) return;

      if(sn.pendingSnipeTargetId){
        const t = state.targets.find(x=>x.id===sn.pendingSnipeTargetId);
        if(!t || t.destroyed || t.type==='heli' || t.type==='drone'){
          sn.pendingSnipeTargetId = null;
        } else if(isTargetDetected(t)){
          const dist = Math.hypot(t.trueX-sn.x, t.trueY-sn.y);
          if(dist <= SNIPER_RANGE_UNITS && hasLineOfSight(sn.x, sn.y, t.trueX, t.trueY)){
            anyEvent = true;
            sniperEngageTarget(sn, t);
          }
        }
      }

      const lineTarget = findTargetOnSniperLine(sn);
      if(lineTarget){
        if(lineTarget.wall){
          anyEvent = true;
          damageWall(lineTarget.wall, Math.round(rnd(SNIPER_DMG[0], SNIPER_DMG[1])), `狙撃${sn.id+1}班の射撃`);
        } else if(lineTarget.type==='vehicle'){
          anyEvent = true;
          callInMortarHeatStrike(lineTarget, sn);
        } else if(hasLineOfSight(sn.x, sn.y, lineTarget.trueX, lineTarget.trueY)){
          anyEvent = true;
          sniperEngageTarget(sn, lineTarget);
        }
      }

      // per user request: auto-engage fallback -- only when the player hasn't
      // designated a snipe target or aim line, so manual designation still takes priority.
      const hasAimLine = sn.aimAngle!==null && sn.aimAngle!==undefined;
      if(!sn.pendingSnipeTargetId && !hasAimLine){
        const auto = findAutoSniperTarget(sn);
        if(auto){
          anyEvent = true;
          if(auto.type==='vehicle') callInMortarHeatStrike(auto, sn);
          else sniperEngageTarget(sn, auto);
        }
      }
    });
  }
  return anyEvent;
}

export function setSquadOrder(idx, order){
  if(!state.squads[idx] || state.squads[idx].resting) return;
  state.squads[idx].order = order;
  unitSpeakOrder('squad', idx);
  render();
}

export function setTankOrder(idx, order){
  if(!state.tanks[idx]) return;
  state.tanks[idx].order = order;
  render();
}

export function setSamOrder(idx, order){
  if(!state.sams[idx]) return;
  state.sams[idx].order = order;
  render();
}

export function setSniperOrder(idx, order){
  if(!state.snipers[idx] || state.snipers[idx].resting) return;
  state.snipers[idx].order = order;
  unitSpeakOrder('sniper', idx);
  render();
}

export function setStandingOrder(kind, idx, value){
  const unit = kind==='squad' ? state.squads[idx] : state.snipers[idx];
  if(!unit) return;
  unit.standingOrder = value || null;
  render();
}

export function resolveSmartUnitIdxs(unitType, unitScope){
  const typeDef = SMART_UNIT_TYPES[unitType];
  if(!typeDef) return [];
  const list = typeDef.list();
  if(unitScope==='all') return list.map((u,i)=>i).filter(i=>typeDef.isAlive(list[i]));
  const idx = parseInt(unitScope, 10);
  return (list[idx] && typeDef.isAlive(list[idx])) ? [idx] : [];
}

export function randomMoveOffsetCanvasUnits(meters){
  const ang = Math.random()*Math.PI*2;
  return {
    dx: (meters*Math.sin(ang))/(WORLD.scaleX||1),
    dy: (meters*Math.cos(ang))/(WORLD.scaleZ||1),
  };
}

export function directedMoveOffsetCanvasUnits(fromDx, fromDy, meters){
  const scaleX = WORLD.scaleX||1, scaleZ = WORLD.scaleZ||1;
  let worldDx = fromDx*scaleX, worldDz = fromDy*scaleZ;
  let worldDist = Math.hypot(worldDx, worldDz);
  if(worldDist < 0.01){
    const ang = Math.random()*Math.PI*2;
    worldDx = Math.sin(ang); worldDz = Math.cos(ang); worldDist = 1;
  }
  const ux = worldDx/worldDist, uz = worldDz/worldDist;
  return { dx: (ux*meters)/scaleX, dy: (uz*meters)/scaleZ, worldDist };
}

export function applySmartMortarScatter(){
  const idxs = resolveSmartUnitIdxs('mortar', 'all');
  idxs.forEach(idx=>{
    const m = state.mortars[idx];
    const {dx, dy} = randomMoveOffsetCanvasUnits(100);
    m.order = 'move';
    m.pendingFire = null;
    m.pendingDest = {
      x: clamp(m.x+dx, MORTAR_ZONE_MIN_X, MORTAR_ZONE_MAX_X),
      y: clamp(m.y+dy, 30, CANVAS_H-30),
    };
  });
  log('sys','司令部', `スマート操作: 迫撃砲 全${idxs.length}隊に分散移動(各隊ランダム方向へ100m)を指示。`);
  closeSmartOrder();
  render();
}

export function applySmartOrder(targetId){
  const unitType = smartWizard.unitType;
  const actionKey = smartWizard.actionKey;
  const typeDef = SMART_UNIT_TYPES[unitType];
  const idxs = resolveSmartUnitIdxs(unitType, smartWizard.unitScope);
  const target = targetId ? state.targets.find(t=>t.id===targetId && !t.destroyed) : null;
  // per user request: 間隔をとれ/密集せよ move each squad toward/away from the group's own
  // centroid (computed once, from every squad in this order) rather than a fixed point.
  let squadCentroid = null;
  if(unitType==='squad' && (actionKey==='spread' || actionKey==='mass')){
    const pts = idxs.map(i=>state.squads[i]);
    squadCentroid = {
      x: pts.reduce((s,sq)=>s+sq.x,0)/pts.length,
      y: pts.reduce((s,sq)=>s+sq.y,0)/pts.length,
    };
  }
  idxs.forEach(idx=>{
    if(unitType==='mortar'){
      const m = state.mortars[idx];
      if(actionKey==='standby') setMortarOrder(idx, 'standby');
      else if(actionKey==='fire_target' && target){
        const e = estPosFromMortar(m, target);
        if(mortarNotReadyToFire(m)){
          log('sys','システム', `迫撃砲${idx+1}、陣地転換直後で射撃準備中。攻撃指示を却下。`);
        } else if(mortarTooCloseToFire(m, e.x, e.y)){
          log('sys','システム', `迫撃砲${idx+1}、${target.id}は近すぎます(最低射程${MORTAR_MIN_RANGE_M}m)。攻撃指示を却下。`);
        } else if(mortarTooFarToFire(m, e.x, e.y)){
          log('sys','システム', `迫撃砲${idx+1}、${target.id}は遠すぎます(最大射程${MORTAR_MAX_RANGE_M}m)。攻撃指示を却下。`);
        } else {
          m.pendingFire = {x:e.x, y:e.y, snappedId:target.id};
          applyBestMortarLoadout(m, target);
          m.order = 'fire';
        }
      }
    } else if(unitType==='squad'){
      const sq = state.squads[idx];
      if(['advance','hold','assault','retreat'].includes(actionKey)) setSquadOrder(idx, actionKey);
      else if(actionKey==='hunt_target' && target && target.type!=='heli' && target.type!=='drone'){
        sq.order = 'hunt';
        sq.huntTargetId = target.id;
        sq.pendingDest = null;
      } else if(actionKey==='spread' || actionKey==='mass'){
        const away = directedMoveOffsetCanvasUnits(sq.x-squadCentroid.x, sq.y-squadCentroid.y, SQUAD_FORMATION_ADJUST_M);
        const {dx, dy} = actionKey==='spread' ? away
          : {dx: -away.dx*Math.min(1, away.worldDist/SQUAD_FORMATION_ADJUST_M), dy: -away.dy*Math.min(1, away.worldDist/SQUAD_FORMATION_ADJUST_M)};
        sq.pendingDest = {
          x: clamp(sq.x+dx, SQUAD_RETREAT_LIMIT_X, SQUAD_ASSAULT_LIMIT_X),
          y: clamp(sq.y+dy, 30, CANVAS_H-30),
        };
      }
    } else if(unitType==='sniper'){
      const sn = state.snipers[idx];
      if(['advance','hold','retreat'].includes(actionKey)) setSniperOrder(idx, actionKey);
      else if(actionKey==='snipe_target' && target && target.type!=='heli' && target.type!=='drone'){
        sn.pendingSnipeTargetId = target.id;
      }
    } else if(unitType==='tank'){
      const tk = state.tanks[idx];
      if(['advance','hold','retreat'].includes(actionKey)) setTankOrder(idx, actionKey);
      else if(actionKey==='hunt_target' && target && target.type!=='heli' && target.type!=='drone'){
        tk.order = 'hunt';
        tk.huntTargetId = target.id;
        tk.pendingDest = null;
      }
    } else if(unitType==='sam'){
      const sam = state.sams[idx];
      if(['advance','hold','retreat'].includes(actionKey)) setSamOrder(idx, actionKey);
      else if(actionKey==='hunt_target' && target && (target.type==='heli' || target.type==='drone')){
        sam.order = 'hunt';
        sam.huntTargetId = target.id;
        sam.pendingDest = null;
      }
    }
  });
  const actionDef = SMART_ACTIONS[unitType].find(a=>a.key===actionKey);
  log('sys','司令部', `スマート操作: ${typeDef.label} ${idxs.length}隊に「${actionDef.label}」を指示。`);
  closeSmartOrder();
  render();
}

export function armSniperMoveOrder(idx){
  if(!state.snipers[idx] || state.snipers[idx].resting) return;
  state.orderMode = {kind:'sniper-move', idx};
  state.commandBox = null;
  render();
}

export function clearSniperDest(idx){
  if(!state.snipers[idx]) return;
  state.snipers[idx].pendingDest = null;
  state.orderMode = null;
  render();
}

export function armSniperTargetOrder(idx){
  if(!state.snipers[idx] || state.snipers[idx].resting) return;
  state.orderMode = {kind:'sniper-target', idx};
  state.commandBox = null;
  render();
}

export function clearSniperTarget(idx){
  if(!state.snipers[idx]) return;
  state.snipers[idx].pendingSnipeTargetId = null;
  render();
}

export function armSniperAimOrder(idx){
  const sn = state.snipers[idx];
  if(!sn || sn.resting) return;
  state.orderMode = {kind:'sniper-aim', idx};
  state.commandBox = null;
  unitSpeakOrder('sniper', idx);
  render();
}

export function clearSniperAim(idx){
  if(!state.snipers[idx]) return;
  state.snipers[idx].aimAngle = null;
  render();
}

export function armMortarMainlineOrder(idx){
  const mortar = state.mortars[idx];
  if(!mortar) return;
  state.orderMode = {kind:'mortar-mainline', idx};
  state.commandBox = null;
  unitSpeakOrder('mortar', idx);
  render();
}

export function clearMortarMainline(idx){
  if(!state.mortars[idx]) return;
  state.mortars[idx].mainlineAngle = null;
  render();
}

export function reinforceUnitLabel(kind, idx){
  if(kind==='squad') return `第${idx+1}小隊`;
  if(kind==='scout') return `斥候${idx+1}班`;
  return `狙撃${idx+1}班`;
}

export function requestReinforcement(kind, idx){
  if(!state || state.stageResolved) return;
  const unit = kind==='squad' ? state.squads[idx] : kind==='scout' ? state.scouts[idx] : state.snipers[idx];
  if(!unit || unit.reinforceUsed || unit.resting) return;
  const deadCount = unit.soldiers.filter(s=>!s.alive).length;
  if(deadCount===0) return;
  const restoreCount = Math.min(REINFORCE_MAX_PER_CALL, deadCount, state.reserve);
  if(restoreCount<=0){ log('sys','システム','予備兵力が残っていません。'); return; }
  const cost = REINFORCE_COST_PER_SOLDIER*restoreCount;
  if(state.money < cost){ log('sys','システム','資金が不足しています。'); return; }
  state.money -= cost;
  state.turns += 1;
  state.reserve -= restoreCount;
  let revived = 0;
  const arrivedNames = [];
  unit.soldiers.forEach(s=>{
    if(!s.alive && revived<restoreCount){
      const replacement = state.reserveRoster.shift() || {rank:'2等陸士', name:'(補充兵)'};
      // a fresh recruit is filling this slot, not the fallen soldier returning -- reset
      // veterancy so reinforcements don't inherit a dead veteran's accumulated experience
      s.alive=true; s.seed=Math.random()*1000; s.rank=replacement.rank; s.name=replacement.name; s.vetXp=0;
      arrivedNames.push(`${replacement.rank} ${replacement.name}`);
      revived++;
    }
  });
  unit.reinforceUsed = true;
  log('op','斥候', `${reinforceUnitLabel(kind,idx)}に予備兵力${revived}名(${arrivedNames.join('、')})が到着。¥${cost}を消費(残り予備 ${state.reserve}名)。`);
  // per continuous-sim conversion: no longer forces an extra resolveEnemyTurn(1) here -- the
  // enemy already advances continuously via loop()'s accumulator, so this would double-apply.
  checkEnd();
  render();
}

export function restUnitRef(kind, idx){
  if(kind==='squad') return state.squads[idx];
  if(kind==='scout') return state.scouts[idx];
  if(kind==='sniper') return state.snipers[idx];
  if(kind==='engineer') return state.engineers[idx];
  return null;
}

export function restUnitLabel(kind, idx){
  if(kind==='squad') return `第${idx+1}小隊`;
  if(kind==='scout') return `斥候${idx+1}班`;
  if(kind==='sniper') return `狙撃${idx+1}班`;
  if(kind==='engineer') return `工兵小隊`;
  return '';
}

export function startRest(kind, idx){
  if(!state || state.stageResolved) return;
  const unit = restUnitRef(kind, idx);
  if(!unit || unitAliveCount(unit)<=0 || unit.resting) return;
  const deadCount = unit.soldiers.length - unitAliveCount(unit);
  if(deadCount<=0){ log('sys','システム','欠員がないため大休止の必要がありません。'); return; }
  unit.resting = true;
  unit.restTurnsLeft = REST_DURATION_TURNS;
  unit.restDeficitStart = deadCount;
  unit.restRevived = 0;
  unit.pendingDest = null;
  if('order' in unit) unit.order = 'resting';
  if('huntTargetId' in unit) unit.huntTargetId = null;
  if('pendingSnipeTargetId' in unit) unit.pendingSnipeTargetId = null;
  if('aimAngle' in unit) unit.aimAngle = null;
  log('sys','前線', `${restUnitLabel(kind,idx)}、大休止を開始。以後${REST_DURATION_TURNS}ターンは一切の命令を受け付けない代わりに、欠員(${deadCount}名)が徐々に戦列へ復帰する。`);
  render();
}

export function tickUnitRest(unit, label, dt){
  if(!unit.resting) return;
  unit.restTurnsLeft -= dt;
  const elapsed = REST_DURATION_TURNS - unit.restTurnsLeft;
  const shouldBeRevived = Math.floor(unit.restDeficitStart * elapsed / REST_DURATION_TURNS);
  while(unit.restRevived < shouldBeRevived){
    const victim = unit.soldiers.find(s=>!s.alive);
    if(!victim) break;
    victim.alive = true;
    unit.restRevived += 1;
  }
  if(unit.restTurnsLeft<=0){
    unit.resting = false;
    unit.restTurnsLeft = 0;
    if('order' in unit) unit.order = 'hold';
    log('sys','前線', `${label}、大休止終了。戦列に復帰。`);
  }
}

export function buildHqCover(){
  if(!state || state.stageResolved || state.hq.hp<=0) return;
  if(state.hq.coverBuilt || state.hq.exposure>=HQ_COVER_EXPOSURE_CAP) return;
  state.hq.exposure = Math.min(HQ_COVER_EXPOSURE_CAP, state.hq.exposure+HQ_COVER_EXPOSURE_BONUS);
  state.hq.coverBuilt = true;
  state.turns += 1;
  log('sys','工兵', `指揮所、掩体構築完了。掩蔽率 ${state.hq.exposure}に向上(このWAVE中の再実施は不可)。`);
  // per continuous-sim conversion: no longer forces an extra resolveEnemyTurn(1) here -- the
  // enemy already advances continuously via loop()'s accumulator, so this would double-apply.
  checkEnd();
  render();
}

export function repairHq(){
  if(!state || state.stageResolved || state.hq.hp<=0 || state.hq.hp>=state.hq.maxHp) return;
  const restoreHp = Math.min(HQ_REPAIR_HP_PER_CALL, state.hq.maxHp-state.hq.hp);
  const cost = Math.round(HQ_REPAIR_COST_PER_HP*restoreHp);
  if(state.money < cost){ log('sys','システム','資金が不足しています。'); return; }
  state.money -= cost;
  state.hq.hp = Math.min(state.hq.maxHp, state.hq.hp+restoreHp);
  state.turns += 1;
  log('sys','工兵', `指揮所、応急修復完了(+${restoreHp}HP)。¥${cost}を消費(現在HP ${state.hq.hp}/${state.hq.maxHp})。`);
  // per continuous-sim conversion: no longer forces an extra resolveEnemyTurn(1) here -- the
  // enemy already advances continuously via loop()'s accumulator, so this would double-apply.
  checkEnd();
  render();
}

export function friendlyFireCandidateLabel(c){
  if(c.kind==='hq') return '指揮所';
  if(c.kind==='decoy') return '擬陣地';
  const entry = FRIENDLY_KIND_LIST.find(e=>e.kind===c.kind);
  return entry ? entry.label(c.idx) : '不明部隊';
}

export function checkFriendlyFireAt(ix, iy, killRadius){
  const candidates = [];
  if(state.hq.hp>0) candidates.push({kind:'hq', idx:0, x:state.hq.x, y:state.hq.y});
  FRIENDLY_KIND_LIST.forEach(({kind,list,alive})=>{
    list().forEach((u,idx)=>{ if(alive(u)) candidates.push({kind, idx, x:u.x, y:u.y}); });
  });
  let hit = null, bestD = Infinity;
  candidates.forEach(c=>{
    const d = Math.hypot(ix-c.x, iy-c.y);
    if(d<=killRadius && d<bestD){ bestD=d; hit=c; }
  });
  return hit;
}

export function getUnitExposure(candidate){
  if(candidate.kind==='hq') return state.hq.exposure + terrainCoverTotal(state.hq.x, state.hq.y);
  if(candidate.kind==='mortar'){
    const m = state.mortars[candidate.idx];
    return m.exposure + terrainCoverTotal(m.x, m.y);
  }
  if(candidate.kind==='heli'){
    const h = state.helis[candidate.idx];
    return h.exposure + terrainCoverTotal(h.x, h.y);
  }
  if(candidate.kind==='tank'){
    const tk = state.tanks[candidate.idx];
    return tk.exposure + terrainCoverTotal(tk.x, tk.y);
  }
  if(candidate.kind==='sam'){
    const sam = state.sams[candidate.idx];
    return sam.exposure + terrainCoverTotal(sam.x, sam.y);
  }
  if(candidate.kind==='scout'){
    const u = state.scouts[candidate.idx];
    return u.exposure + unitAvgVetLevel(u.soldiers)*VET_EXPOSURE_BONUS_PER_LEVEL + terrainCoverTotal(u.x, u.y) + trenchCoverBonusAt(u.x, u.y);
  }
  if(candidate.kind==='squad'){
    const u = state.squads[candidate.idx];
    return u.exposure + unitAvgVetLevel(u.soldiers)*VET_EXPOSURE_BONUS_PER_LEVEL + terrainCoverTotal(u.x, u.y) + trenchCoverBonusAt(u.x, u.y);
  }
  if(candidate.kind==='sniper'){
    const u = state.snipers[candidate.idx];
    return u.exposure + unitAvgVetLevel(u.soldiers)*VET_EXPOSURE_BONUS_PER_LEVEL + terrainCoverTotal(u.x, u.y) + trenchCoverBonusAt(u.x, u.y);
  }
  if(candidate.kind==='engineer'){
    const u = state.engineers[candidate.idx];
    return u.exposure + unitAvgVetLevel(u.soldiers)*VET_EXPOSURE_BONUS_PER_LEVEL + terrainCoverTotal(u.x, u.y) + trenchCoverBonusAt(u.x, u.y);
  }
  return EXPOSURE_DEFAULT;
}

export function rollExposureHit(exposure){
  return Math.random() < hitChanceFromExposure(exposure);
}

export function getTargetExposure(t){
  return t.exposure + terrainCoverTotal(t.trueX, t.trueY);
}

export function nearestFriendlyAsset(x, y, includeSquads){
  const candidates = [];
  if(state.hq.hp>0) candidates.push({kind:'hq', idx:0, x:state.hq.x, y:state.hq.y});
  state.scouts.forEach((s,idx)=>{
    if(unitAlive(s)) candidates.push({kind:'scout', idx, x:s.x, y:s.y});
  });
  state.mortars.forEach((m,idx)=>{
    if(m.hp>0) candidates.push({kind:'mortar', idx, x:m.x, y:m.y});
  });
  (state.helis||[]).forEach((h,idx)=>{
    if(h.hp>0) candidates.push({kind:'heli', idx, x:h.x, y:h.y});
  });
  if(includeSquads){
    state.squads.forEach((sq,idx)=>{
      if(sq.soldiers.some(s=>s.alive)) candidates.push({kind:'squad', idx, x:sq.x, y:sq.y});
    });
    state.snipers.forEach((sn,idx)=>{
      if(sn.soldiers.some(s=>s.alive)) candidates.push({kind:'sniper', idx, x:sn.x, y:sn.y});
    });
    state.tanks.forEach((tk,idx)=>{
      if(tk.hp>0) candidates.push({kind:'tank', idx, x:tk.x, y:tk.y});
    });
    state.sams.forEach((sam,idx)=>{
      if(sam.hp>0) candidates.push({kind:'sam', idx, x:sam.x, y:sam.y});
    });
    state.engineers.forEach((en,idx)=>{
      if(en.soldiers.some(s=>s.alive)) candidates.push({kind:'engineer', idx, x:en.x, y:en.y});
    });
  }
  // per user request: 擬陣地 lure enemy indirect fire/vehicle assaults away from real assets
  // -- scoring their distance as if it were much shorter makes them "win" nearest-target
  // selection more often than a real asset at the same actual range, more so at night.
  state.decoys.forEach((d,idx)=>{
    if(!d.destroyed) candidates.push({kind:'decoy', idx, x:d.x, y:d.y});
  });
  const decoyLureMult = state.weather==='night' ? DECOY_LURE_MULT_NIGHT : DECOY_LURE_MULT_DAY;
  let best=null, bestScore=Infinity;
  candidates.forEach(c=>{
    const d = Math.hypot(x-c.x, y-c.y);
    const score = c.kind==='hq' ? d*0.55 : c.kind==='decoy' ? d*decoyLureMult : d;
    if(score<bestScore){ bestScore=score; best={...c, dist:d}; }
  });
  return best;
}

export function applyDamageToTarget(t, dmg){
  if(dmg<=0) return;
  if(t.type==='infantry' && t.troops){
    let remaining = dmg;
    const order = t.troops.map((s,i)=>i).filter(i=>t.troops[i].alive);
    for(let k=order.length-1;k>0;k--){ const j=Math.floor(Math.random()*(k+1)); [order[k],order[j]]=[order[j],order[k]]; }
    for(const i of order){
      if(remaining<=0) break;
      const s = t.troops[i];
      const take = Math.min(s.hp, remaining);
      s.hp -= take;
      remaining -= take;
      if(s.hp<=0){ s.hp = 0; s.alive = false; }
    }
    t.hp = t.troops.reduce((sum,s)=>sum+s.hp, 0);
  } else {
    t.hp -= dmg;
  }
}

export function damageFriendlyAsset(target, dmg, sourceLabel){
  if(target.kind==='decoy'){
    const d = state.decoys[target.idx];
    if(!d || d.destroyed) return;
    d.hp = Math.max(0, d.hp-dmg);
    log('sys','被弾', `${sourceLabel}が擬陣地を攻撃。被害 ${dmg}。`);
    if(d.hp<=0){
      d.destroyed = true;
      log('sys','被弾', `擬陣地が破壊された。`);
      spawnDestructionEffect(d.x, d.y, '擬陣地 破壊', FRIENDLY_MARK_COLOR);
    }
  } else if(target.kind==='hq'){
    const wasAlive = state.hq.hp>0;
    state.hq.hp = Math.max(0, state.hq.hp-dmg);
    if(state.hq.hp <= state.hq.maxHp*0.3) state.hpDroppedLow = true;
    log('sys','被弾', `${sourceLabel}が<b>指揮所</b>を攻撃。被害 ${dmg}。`);
    if(wasAlive && state.hq.hp<=0){
      spawnDestructionEffect(state.hq.x, state.hq.y, '指揮所 陥落!', FRIENDLY_MARK_COLOR);
      announceTicker('指揮所 陥落!', 'death');
    }
  } else if(target.kind==='scout'){
    const scout = state.scouts[target.idx];
    if(!scout) return;
    const aliveSoldiers = scout.soldiers.filter(s=>s.alive);
    if(aliveSoldiers.length>0){
      const victim = choice(aliveSoldiers);
      victim.alive = false;
      log('sys','被弾', `${sourceLabel}が斥候${target.idx+1}を攻撃。<b>${victim.rank} ${victim.name}</b> 戦死。`);
      announceTicker(`${victim.rank} ${victim.name} 殉職`, 'death');
      unitSpeakInjury('scout', target.idx);
      if(aliveSoldiers.length===1){
        spawnDestructionEffect(scout.x, scout.y, `斥候${target.idx+1} 全滅!`, FRIENDLY_MARK_COLOR);
        announceTicker(`斥候${target.idx+1} 全滅!`, 'death');
        speakRandomAliveUnit('outburst');
      }
    }
  } else if(target.kind==='squad'){
    const sq = state.squads[target.idx];
    if(!sq) return;
    const aliveSoldiers = sq.soldiers.filter(s=>s.alive);
    if(aliveSoldiers.length>0){
      const victim = choice(aliveSoldiers);
      victim.alive = false;
      log('sys','被弾', `${sourceLabel}が第${target.idx+1}小隊を攻撃。<b>${victim.rank} ${victim.name}</b> 戦死。`);
      announceTicker(`${victim.rank} ${victim.name} 殉職`, 'death');
      unitSpeakInjury('squad', target.idx);
      if(aliveSoldiers.length===1){
        spawnDestructionEffect(sq.x, sq.y, `第${target.idx+1}小隊 全滅!`, FRIENDLY_MARK_COLOR);
        announceTicker(`第${target.idx+1}小隊 全滅!`, 'death');
        speakRandomAliveUnit('outburst');
      }
    }
  } else if(target.kind==='sniper'){
    const sn = state.snipers[target.idx];
    if(!sn) return;
    const aliveSoldiers = sn.soldiers.filter(s=>s.alive);
    if(aliveSoldiers.length>0){
      const victim = choice(aliveSoldiers);
      victim.alive = false;
      log('sys','被弾', `${sourceLabel}が狙撃${target.idx+1}班を攻撃。<b>${victim.rank} ${victim.name}</b> 戦死。`);
      announceTicker(`${victim.rank} ${victim.name} 殉職`, 'death');
      unitSpeakInjury('sniper', target.idx);
      if(aliveSoldiers.length===1){
        spawnDestructionEffect(sn.x, sn.y, `狙撃${target.idx+1}班 全滅!`, FRIENDLY_MARK_COLOR);
        announceTicker(`狙撃${target.idx+1}班 全滅!`, 'death');
        speakRandomAliveUnit('outburst');
      }
    }
  } else if(target.kind==='mortar'){
    const mortar = state.mortars[target.idx];
    if(!mortar) return;
    const wasAlive = mortar.hp>0;
    mortar.hp = Math.max(0, mortar.hp-dmg);
    if(mortar.hp <= mortar.maxHp*0.2) state.hpDroppedLow = true;
    log('sys','被弾', `${sourceLabel}が迫撃砲${target.idx+1}を攻撃。被害 ${dmg}。`);
    if(mortar.hp>0) unitSpeak('mortar', target.idx, 'warning');
    else if(wasAlive){
      spawnDestructionEffect(mortar.x, mortar.y, `迫撃砲${target.idx+1} 戦闘不能!`, FRIENDLY_MARK_COLOR);
      announceTicker(`迫撃砲${target.idx+1} 戦闘不能!`, 'death');
    }
  } else if(target.kind==='heli'){
    const heli = state.helis && state.helis[target.idx];
    if(!heli) return;
    const wasAlive = heli.hp>0;
    heli.hp = Math.max(0, heli.hp-dmg);
    log('sys','被弾', `${sourceLabel}がヘリ${target.idx+1}を攻撃。被害 ${dmg}。`);
    if(wasAlive && heli.hp<=0){
      spawnDestructionEffect(heli.x, heli.y, `ヘリ${target.idx+1} 撃墜!`, FRIENDLY_MARK_COLOR);
      announceTicker(`ヘリ${target.idx+1} 撃墜!`, 'death');
    }
  } else if(target.kind==='tank'){
    const tank = state.tanks[target.idx];
    if(!tank) return;
    const wasAlive = tank.hp>0;
    tank.hp = Math.max(0, tank.hp-dmg);
    if(tank.hp <= tank.maxHp*0.2) state.hpDroppedLow = true;
    log('sys','被弾', `${sourceLabel}が戦車${target.idx+1}を攻撃。被害 ${dmg}。`);
    if(wasAlive && tank.hp<=0){
      spawnDestructionEffect(tank.x, tank.y, `戦車${target.idx+1} 撃破!`, FRIENDLY_MARK_COLOR);
      announceTicker(`戦車${target.idx+1} 撃破!`, 'death');
    }
  } else if(target.kind==='sam'){
    const sam = state.sams[target.idx];
    if(!sam) return;
    const wasAlive = sam.hp>0;
    sam.hp = Math.max(0, sam.hp-dmg);
    if(sam.hp <= sam.maxHp*0.2) state.hpDroppedLow = true;
    log('sys','被弾', `${sourceLabel}が対空${target.idx+1}を攻撃。被害 ${dmg}。`);
    if(wasAlive && sam.hp<=0){
      spawnDestructionEffect(sam.x, sam.y, `対空${target.idx+1} 撃破!`, FRIENDLY_MARK_COLOR);
      announceTicker(`対空${target.idx+1} 撃破!`, 'death');
    }
  } else if(target.kind==='engineer'){
    const en = state.engineers[target.idx];
    if(!en) return;
    const aliveSoldiers = en.soldiers.filter(s=>s.alive);
    if(aliveSoldiers.length>0){
      const victim = choice(aliveSoldiers);
      victim.alive = false;
      log('sys','被弾', `${sourceLabel}が工兵小隊を攻撃。<b>${victim.rank} ${victim.name}</b> 戦死。`);
      announceTicker(`${victim.rank} ${victim.name} 殉職`, 'death');
      unitSpeakInjury('engineer', target.idx);
      if(aliveSoldiers.length===1){
        spawnDestructionEffect(en.x, en.y, '工兵小隊 全滅!', FRIENDLY_MARK_COLOR);
        announceTicker('工兵小隊 全滅!', 'death');
        speakRandomAliveUnit('outburst');
      }
    }
  }
}

export function spawnInfantryDrone(source){
  const def = TARGET_TYPES.drone;
  const hpMult = (1 + (state.stage-1)*0.08) * DIFFICULTIES[state.difficulty].hpMult * 2; // per user request: enemy defense doubled
  const hp = Math.round(def.hp * hpMult);
  const trueX = clamp(source.trueX + rnd(-20,20), 20, CANVAS_W-20);
  const trueY = clamp(source.trueY + rnd(-20,20), 20, CANVAS_H-20);
  const dx = trueX-OP.x, dy = trueY-OP.y;
  const trueBearing = (Math.atan2(dx,-dy)*180/Math.PI+360)%360;
  const trueDistance = Math.sqrt(dx*dx+dy*dy);
  state.targetsSpawnedTotal += 1;
  const drone = {
    id: 'T'+state.targetsSpawnedTotal,
    type:'drone', def,
    trueX, trueY, trueBearing, trueDistance,
    hp, maxHp:hp,
    destroyed:false, revealed:true,
    impacts:[],
    troops: null,
    suppressed:0,
    exposure: EXPOSURE_DEFAULT,
  };
  state.targets.push(drone);
  return drone;
}

export function spawnInfantryDroneSwarm(source){
  const count = Math.round(rnd(INFANTRY_DRONE_SWARM_SIZE[0], INFANTRY_DRONE_SWARM_SIZE[1]));
  const spawned = [];
  for(let i=0;i<count;i++) spawned.push(spawnInfantryDrone(source));
  log('sys','警報', `${source.id} が自爆ドローン${count}機を同時発進させた。`);
  return spawned;
}

export let targetGrid = null;

export function targetGridCellKey(cx, cy){ return cx+','+cy; }

export function rebuildTargetGrid(){
  targetGrid = new Map();
  state.targets.forEach(t=>{
    if(t.destroyed) return;
    const key = targetGridCellKey(Math.floor(t.trueX/TARGET_GRID_CELL_SIZE), Math.floor(t.trueY/TARGET_GRID_CELL_SIZE));
    let bucket = targetGrid.get(key);
    if(!bucket){ bucket = []; targetGrid.set(key, bucket); }
    bucket.push(t);
  });
}

export function nearestOtherAliveTarget(t){
  if(!targetGrid) return null;
  const cx = Math.floor(t.trueX/TARGET_GRID_CELL_SIZE), cy = Math.floor(t.trueY/TARGET_GRID_CELL_SIZE);
  let best=null, bd=Infinity, foundAtRadius=-1;
  for(let radius=0; radius<=TARGET_GRID_MAX_RINGS; radius++){
    if(foundAtRadius>=0 && radius>foundAtRadius+1) break;
    for(let dx=-radius; dx<=radius; dx++){
      for(let dy=-radius; dy<=radius; dy++){
        if(Math.max(Math.abs(dx),Math.abs(dy))!==radius) continue;
        const bucket = targetGrid.get(targetGridCellKey(cx+dx, cy+dy));
        if(!bucket) continue;
        bucket.forEach(o=>{
          if(o===t) return;
          const d = Math.hypot(o.trueX-t.trueX, o.trueY-t.trueY);
          if(d<bd){ bd=d; best=o; if(foundAtRadius<0) foundAtRadius=radius; }
        });
      }
    }
  }
  return best;
}

export function mergeAdjustedGoal(t, defaultGoal){
  if(t.hp/t.maxHp > MERGE_HP_THRESHOLD) return defaultGoal;
  const ally = nearestOtherAliveTarget(t);
  if(!ally) return defaultGoal;
  return {x: ally.trueX, y: ally.trueY};
}

export function maybePlaceMine(){
  if(!turnJustCrossed()) return;
  if(!state.roads || state.roads.length===0) return;
  if(state.mines.length >= MINE_MAX_ACTIVE) return;
  if(Math.random() > MINE_PLACEMENT_CHANCE) return;
  const candidateRoads = state.roads.filter(r=>r.length>1);
  if(!candidateRoads.length) return;
  const road = choice(candidateRoads);
  const pt = choice(road);
  state.mines.push({x:pt.x, y:pt.y});
  log('sys','警報', `敵が付近の道路に地雷を敷設した形跡がある。`);
}

export function checkMineTrigger(kind, idx, x, y){
  if(!state.mines || !state.mines.length) return;
  const hitIdx = state.mines.findIndex(m=>Math.hypot(m.x-x, m.y-y) <= MINE_TRIGGER_RADIUS_UNITS);
  if(hitIdx<0) return;
  state.mines.splice(hitIdx,1);
  const dmg = Math.round(rnd(MINE_DAMAGE[0], MINE_DAMAGE[1]));
  damageFriendlyAsset({kind, idx}, dmg, '地雷');
  unitSpeak(kind, idx, 'warning');
}

export function advanceEnemyArtillery(dt){
  const artillery = state.targets.filter(t=>!t.destroyed && t.type==='artillery');
  if(artillery.length===0) return false;
  let moved = false;
  {
    artillery.forEach(t=>{
      if(t.destroyed) return;
      const near = nearestFriendlyAsset(t.trueX, t.trueY, true);
      if(!near || near.dist <= ARTILLERY_STANDOFF_RANGE_UNITS) return;
      const step = ARTILLERY_MOVE_CAP * dt * (isSuppressed(t) ? SUPPRESSION_MOVE_MULT : 1);
      const moveGoal = mergeAdjustedGoal(t, near);
      const next = terrainAwareStep(t.trueX, t.trueY, moveGoal.x, moveGoal.y, step);
      t.trueX = next.x; t.trueY = clamp(next.y, 30, CANVAS_H-30);
      const dx = t.trueX-OP.x, dy = t.trueY-OP.y;
      t.trueBearing = (Math.atan2(dx,-dy)*180/Math.PI+360)%360;
      t.trueDistance = Math.sqrt(dx*dx+dy*dy);
      moved = true;
    });
  }
  return moved;
}

export function resolveVehicleAssault(dt){
  const vehicles = state.targets.filter(t=>!t.destroyed && t.type==='vehicle');
  if(vehicles.length===0) return false;
  let anyEvent = false;
  // per user request: "last stand" -- once few enough enemies remain, vehicles ignore
  // whatever's nearest and drive straight at the HQ instead, faster than their normal advance.
  const lastStand = lastStandActive();
  {
    vehicles.forEach(t=>{
      if(t.destroyed) return;
      const near = (lastStand && state.hq.hp>0)
        ? {kind:'hq', idx:0, x:state.hq.x, y:state.hq.y, dist:Math.hypot(t.trueX-state.hq.x, t.trueY-state.hq.y)}
        : nearestFriendlyAsset(t.trueX, t.trueY, true);
      if(!near) return;
      if(near.dist <= VEHICLE_ASSAULT_RANGE && hasLineOfSight(t.trueX, t.trueY, near.x, near.y)){
        // The attack itself is a discrete once-per-turn event (not a continuous rate), so it
        // only fires the instant a whole turn is crossed -- the vehicle otherwise just holds
        // here (matching the original "hold and slug it out" behavior in this range branch).
        // per user request (correction of an earlier request that had the direction backwards):
        // firing interval shortened, not lengthened -- this briefly had a % 10 stagger added
        // on top of this gate; removed again, so it's back to firing every single turn once in
        // range, the fastest this gate can go.
        if(!turnJustCrossed()) return;
        anyEvent = true;
        const blockWall = wallBlockingLineOfFire(t.trueX, t.trueY, near.x, near.y);
        if(blockWall){
          damageWall(blockWall, Math.round(rnd(VEHICLE_ASSAULT_DAMAGE[0], VEHICLE_ASSAULT_DAMAGE[1])), `${t.id}(装甲車)の突撃`);
          return;
        }
        const e = estPos(t);
        if(revealTarget(t)){
          log('op','斥候', `${t.id} が至近距離で接触、<b>${t.def.label}</b>と識別。`);
        }
        if(rollExposureHit(getUnitExposure(near))){
          const altMult = altitudeBonus(t.trueX, t.trueY, near.x, near.y);
          const dmg = Math.round(rnd(VEHICLE_ASSAULT_DAMAGE[0], VEHICLE_ASSAULT_DAMAGE[1]) * altMult);
          damageFriendlyAsset(near, dmg, `${t.id}(装甲車)の突撃`);
          fireTracer(e.x, e.y, near.x, near.y, 260, 'cannon');
        } else {
          log('sys','回避', `${t.id}(装甲車)の突撃を受けたが、${friendlyFireCandidateLabel(near)}は掩蔽率により被弾を免れた。`);
        }
        if(near.kind==='squad'){
          const aliveSoldiers = state.squads[near.idx].soldiers.filter(s=>s.alive);
          if(aliveSoldiers.length>0 && Math.random()<0.5 && rollExposureHit(getTargetExposure(t))){
            const antiTankMult = altitudeBonus(near.x, near.y, t.trueX, t.trueY);
            const antiTankDmg = Math.round(rnd(2,6) * antiTankMult);
            t.hp -= antiTankDmg;
            if(t.hp<=0 && !t.destroyed){
              t.destroyed = true; t.hp = 0;
              log('op','斥候', `${t.id} 対戦車射撃により撃破を確認。`);
              onTargetDestroyed(t);
            }
          }
        }
      } else {
        const suppressionMoveMult = (isSuppressed(t) && !lastStand) ? SUPPRESSION_MOVE_MULT : 1;
        const step = Math.min((45 + state.stage*2.6) * DIFFICULTIES[state.difficulty].advanceMult, VEHICLE_MOVE_CAP) * dt * suppressionMoveMult * (lastStand ? 1.6 : 1);
        // per user request: no falling back to regroup with a wounded ally during the last
        // stand -- straight at the HQ, full speed, regardless of own condition.
        const moveGoal = lastStand ? {x:near.x, y:near.y} : mergeAdjustedGoal(t, near);
        let next = null;
        // Vehicles are road-bound: route along the real road network via A*
        // rather than cutting cross-country. Only the final short hop from
        // the nearest road node to the actual (usually off-road) target is
        // a direct line. Falls back to the old free-roaming terrainAwareStep
        // if the road graph never loaded (e.g. 3D terrain/road data failed).
        if(ROAD_GRAPH && ROAD_GRAPH.nodes.length){
          const roadPath = getCachedRoadPath(t, t.trueX, t.trueY, moveGoal.x, moveGoal.y);
          if(roadPath && roadPath.length){
            const fullPath = roadPath.concat([{x:moveGoal.x, y:moveGoal.y}]);
            next = advanceAlongPath(t.trueX, t.trueY, fullPath, step);
          }
        }
        if(!next) next = terrainAwareStep(t.trueX, t.trueY, moveGoal.x, moveGoal.y, step);
        // per user request: 工兵の防壁は道路沿いのA*経路(advanceAlongPath、terrainAwareStepを
        // 通らない)による車両移動も遮る必要がある -- ここで最終座標に一括して適用する。
        next = applyWallBlock(t.trueX, t.trueY, next.x, next.y);
        t.trueX = next.x; t.trueY = clamp(next.y, 30, CANVAS_H-30);
        const dx = t.trueX-OP.x, dy = t.trueY-OP.y;
        t.trueBearing = (Math.atan2(dx,-dy)*180/Math.PI+360)%360;
        t.trueDistance = Math.sqrt(dx*dx+dy*dy);
      }
    });
  }
  return anyEvent;
}

// per user request: enemy anti-air -- a stationary, dedicated ground unit that specifically
// hunts the friendly heli (kept out of the generic ground-engagement roll in
// enemyCounterAttack, same treatment as the enemy heli itself there).
export function resolveEnemyAntiAir(dt){
  const aaUnits = state.targets.filter(t=>!t.destroyed && t.type==='aa');
  if(aaUnits.length===0) return false;
  let anyEvent = false;
  aaUnits.forEach(t=>{
    if(t._aaCooldown === undefined) t._aaCooldown = 0;
    if(t._aaCooldown > 0){
      t._aaCooldown -= dt;
      return;
    }
    const heliIdx = (state.helis||[]).findIndex(h=>h.hp>0);
    if(heliIdx<0) return;
    const heli = state.helis[heliIdx];
    const dist = Math.hypot(t.trueX-heli.x, t.trueY-heli.y);
    if(dist > AA_ENGAGE_RANGE) return;
    if(!hasLineOfSight(t.trueX, t.trueY, heli.x, heli.y)) return;
    // The attack itself is a discrete once-per-turn event, so it only resolves the instant a
    // whole turn is crossed -- same pattern as every other enemy attack roll in this file.
    if(!turnJustCrossed()) return;
    anyEvent = true;
    const e = estPos(t);
    if(revealTarget(t)){
      log('op','斥候', `${t.id} が対空砲火用意、<b>${t.def.label}</b>と識別。`);
    }
    if(rollExposureHit(getUnitExposure({kind:'heli', idx:heliIdx}))){
      const altMult = altitudeBonus(t.trueX, t.trueY, heli.x, heli.y);
      const dmg = Math.round(rnd(AA_ATTACK_DAMAGE[0], AA_ATTACK_DAMAGE[1]) * altMult);
      damageFriendlyAsset({kind:'heli', idx:heliIdx}, dmg, `${t.id}(対空)の攻撃`);
      fireTracer(e.x, e.y, heli.x, heli.y, 260, 'cannon');
    } else {
      log('sys','回避', `${t.id}(対空)の攻撃を受けたが、ヘリは掩蔽率により被弾を免れた。`);
    }
    t._aaCooldown = AA_COOLDOWN_TICKS;
  });
  return anyEvent;
}

// per user request: the enemy HQ isn't just a passive objective to destroy -- it's armed and
// defends itself, with 2 integrated mortar tubes (indirect fire, no line-of-sight needed, the
// same MORTAR_MAX_RANGE_UNITS reach as every mortar) and 3 tank guns (direct fire, needs
// line-of-sight, the same TANK_ENGAGE_RANGE as a friendly tank duel). Each of the 5 weapons
// has its own independent cooldown and engages whichever friendly asset is currently nearest.
export function resolveEnemyHqAttack(dt){
  const hqTarget = state.targets.find(t=>!t.destroyed && t.type==='hq');
  if(!hqTarget) return false;
  let anyEvent = false;

  if(hqTarget._hqMortarCooldowns === undefined){
    // staggered initial cooldowns so both tubes don't always fire in lockstep
    hqTarget._hqMortarCooldowns = Array.from({length:HQ_MORTAR_COUNT}, ()=>rnd(0, HQ_MORTAR_COOLDOWN_TICKS));
  }
  if(hqTarget._hqTankgunCooldowns === undefined){
    hqTarget._hqTankgunCooldowns = Array.from({length:HQ_TANKGUN_COUNT}, ()=>rnd(0, HQ_TANKGUN_COOLDOWN_TICKS));
  }

  hqTarget._hqMortarCooldowns = hqTarget._hqMortarCooldowns.map(cd=>{
    if(cd > 0) return cd - dt;
    const near = nearestFriendlyAsset(hqTarget.trueX, hqTarget.trueY, true);
    if(!near || near.dist > MORTAR_MAX_RANGE_UNITS || !turnJustCrossed()) return 0;
    anyEvent = true;
    if(revealTarget(hqTarget)){
      log('op','斥候', `${hqTarget.id} から迫撃砲の発射炎を確認、<b>${hqTarget.def.label}</b>と識別。`);
    }
    projectiles.push({
      startX: hqTarget.trueX, startY: hqTarget.trueY,
      endX: near.x, endY: near.y,
      born: performance.now(),
      duration: FLIGHT_DURATION,
      trajectory: 'arc',
      onLand: ()=>{
        if(rollExposureHit(getUnitExposure(near))){
          const dmg = Math.round(rnd(HQ_MORTAR_DAMAGE[0], HQ_MORTAR_DAMAGE[1]));
          damageFriendlyAsset(near, dmg, `${hqTarget.id}(敵本部迫撃砲)の砲撃`);
        } else {
          log('sys','回避', `${hqTarget.id}(敵本部迫撃砲)の砲撃を受けたが、${friendlyFireCandidateLabel(near)}は掩蔽率により被弾を免れた。`);
        }
        render();
      }
    });
    return HQ_MORTAR_COOLDOWN_TICKS;
  });

  hqTarget._hqTankgunCooldowns = hqTarget._hqTankgunCooldowns.map(cd=>{
    if(cd > 0) return cd - dt;
    const near = nearestFriendlyAsset(hqTarget.trueX, hqTarget.trueY, true);
    if(!near || near.dist > TANK_ENGAGE_RANGE || !hasLineOfSight(hqTarget.trueX, hqTarget.trueY, near.x, near.y) || !turnJustCrossed()) return 0;
    anyEvent = true;
    if(revealTarget(hqTarget)){
      log('op','斥候', `${hqTarget.id} から戦車砲の砲撃を確認、<b>${hqTarget.def.label}</b>と識別。`);
    }
    const blockWall = wallBlockingLineOfFire(hqTarget.trueX, hqTarget.trueY, near.x, near.y);
    if(blockWall){
      damageWall(blockWall, Math.round(rnd(HQ_TANKGUN_DAMAGE[0], HQ_TANKGUN_DAMAGE[1])), `${hqTarget.id}(敵本部戦車砲)の砲撃`);
    } else if(rollExposureHit(getUnitExposure(near))){
      const altMult = altitudeBonus(hqTarget.trueX, hqTarget.trueY, near.x, near.y);
      const dmg = Math.round(rnd(HQ_TANKGUN_DAMAGE[0], HQ_TANKGUN_DAMAGE[1]) * altMult);
      damageFriendlyAsset(near, dmg, `${hqTarget.id}(敵本部戦車砲)の砲撃`);
      fireTracer(hqTarget.trueX, hqTarget.trueY, near.x, near.y, 260, 'cannon');
    } else {
      log('sys','回避', `${hqTarget.id}(敵本部戦車砲)の砲撃を受けたが、${friendlyFireCandidateLabel(near)}は掩蔽率により被弾を免れた。`);
    }
    return HQ_TANKGUN_COOLDOWN_TICKS;
  });

  return anyEvent;
}

export function resolveHeliAssault(dt){
  const helis = state.targets.filter(t=>!t.destroyed && t.type==='heli');
  if(helis.length===0) return false;
  let anyEvent = false;
  {
    helis.forEach(h=>{
      if(h.destroyed) return;
      const recomputeBearing = ()=>{
        const dx = h.trueX-OP.x, dy = h.trueY-OP.y;
        h.trueBearing = (Math.atan2(dx,-dy)*180/Math.PI+360)%360;
        h.trueDistance = Math.sqrt(dx*dx+dy*dy);
      };
      if(h.heliCooldown>0){
        h.heliCooldown -= dt;
        return;
      }
      if(h.heliPhase==='withdraw'){
        const dx = h.trueX-h.heliAnchor.x, dy = h.trueY-h.heliAnchor.y;
        const dist = Math.hypot(dx,dy) || 1;
        const fleeX = h.trueX + (dx/dist)*500, fleeY = h.trueY + (dy/dist)*500;
        const next = airborneStep(h.trueX, h.trueY, fleeX, fleeY, HELI_MOVE_CAP*dt);
        h.trueX = next.x; h.trueY = clamp(next.y, 30, CANVAS_H-30);
        recomputeBearing();
        anyEvent = true;
        if(Math.hypot(h.trueX-h.heliAnchor.x, h.trueY-h.heliAnchor.y) >= HELI_WITHDRAW_DIST){
          h.heliPhase = 'approach';
          h.heliCooldown = HELI_COOLDOWN_TICKS;
          h.heliBurstLeft = HELI_ATTACK_BURST;
          log('sys','警報', `${h.id}(戦闘ヘリ)、安全距離まで離脱。再攻撃に備え待機。`);
        }
        return;
      }
      const near = nearestFriendlyAsset(h.trueX, h.trueY, true);
      if(!near) return;
      if(near.dist > HELI_ENGAGE_RANGE){
        h.heliPhase = 'approach';
        const next = airborneStep(h.trueX, h.trueY, near.x, near.y, HELI_MOVE_CAP*dt);
        h.trueX = next.x; h.trueY = clamp(next.y, 30, CANVAS_H-30);
        recomputeBearing();
        anyEvent = true;
        return;
      }
      // in range -- attack. Each shot in the burst is a discrete once-per-turn event, so it
      // only fires the instant a whole turn is crossed (heliBurstLeft is a shot counter, not a
      // duration, so it isn't scaled by dt the way heliCooldown above is).
      h.heliPhase = 'attack';
      if(!turnJustCrossed()) return;
      anyEvent = true;
      const e = estPos(h);
      if(revealTarget(h)){
        log('op','斥候', `${h.id} が接近、<b>${h.def.label}</b>と識別。`);
      }
      if(rollExposureHit(getUnitExposure(near))){
        const altMult = altitudeBonus(h.trueX, h.trueY, near.x, near.y);
        const dmg = Math.round(rnd(HELI_ATTACK_DAMAGE[0], HELI_ATTACK_DAMAGE[1]) * altMult);
        damageFriendlyAsset(near, dmg, `${h.id}(戦闘ヘリ)の攻撃`);
        fireTracer(e.x, e.y, near.x, near.y, 260, 'heli');
      } else {
        log('sys','回避', `${h.id}(戦闘ヘリ)の攻撃を受けたが、${friendlyFireCandidateLabel(near)}は掩蔽率により被弾を免れた。`);
      }
      h.heliBurstLeft -= 1;
      if(h.heliBurstLeft<=0){
        h.heliPhase = 'withdraw';
        h.heliAnchor = {x:near.x, y:near.y};
        log('sys','警報', `${h.id}(戦闘ヘリ)、攻撃を終え離脱を開始。`);
      }
    });
  }
  return anyEvent;
}

export function resolveSquadAntiDrone(dt){
  let anyEvent = false;
  {
    if(!turnJustCrossed()) return anyEvent;
    state.squads.forEach((sq, sqIdx)=>{
      const aliveSoldiers = sq.soldiers.filter(s=>s.alive);
      if(aliveSoldiers.length===0) return;
      state.targets.forEach(t=>{
        if(t.destroyed || t.type!=='drone') return;
        if(Math.hypot(t.trueX-sq.x, t.trueY-sq.y) > SQUAD_ANTI_DRONE_RANGE_UNITS) return;
        anyEvent = true;
        if(revealTarget(t)){
          log('op','斥候', `${t.id} を至近距離で捕捉、<b>${t.def.label}</b>と識別。`);
        }
        if(Math.random() < SQUAD_ANTI_DRONE_HIT_CHANCE){
          const dmg = Math.round(rnd(SQUAD_ANTI_DRONE_DMG[0], SQUAD_ANTI_DRONE_DMG[1]));
          t.hp -= dmg;
          fireTracer(sq.x, sq.y, t.trueX, t.trueY, 150, 'rifle', aliveFigureOffsets(sq.soldiers, SQUAD_GRID_OFFSETS));
          if(t.hp<=0 && !t.destroyed){
            t.destroyed = true; t.hp = 0;
            log('op','前線', `第${sqIdx+1}小隊が${t.id}を対空射撃で<b>撃墜</b>。`);
            onTargetDestroyed(t);
          } else {
            log('op','前線', `第${sqIdx+1}小隊が${t.id}に対空射撃(効果 ${dmg})。`);
          }
        } else {
          log('sys','対空', `第${sqIdx+1}小隊が${t.id}へ対空射撃するも外す。`);
        }
      });
    });
  }
  return anyEvent;
}

export function resolveSquadAntiVehicle(dt){
  let anyEvent = false;
  {
    state.squads.forEach((sq, sqIdx)=>{
      const curAlive = sq.soldiers.filter(s=>s.alive);
      if(curAlive.length===0) return;
      if(!turnJustCrossed() || !unitMayFire('squad', sqIdx, currentTurnFloor()+2)) return;
      state.targets.forEach(t=>{
        if(t.destroyed || t.type!=='vehicle') return;
        if(Math.hypot(t.trueX-sq.x, t.trueY-sq.y) > VEHICLE_ASSAULT_RANGE) return;
        if(!hasLineOfSight(sq.x, sq.y, t.trueX, t.trueY)) return;
        if(wallBlockingLineOfFire(sq.x, sq.y, t.trueX, t.trueY)) return;
        anyEvent = true;
        if(revealTarget(t)){
          log('op','斥候', `${t.id} を至近距離で捕捉、<b>${t.def.label}</b>と識別。`);
        }
        if(Math.random() < 0.5 && rollExposureHit(getTargetExposure(t))){
          const antiTankMult = altitudeBonus(sq.x, sq.y, t.trueX, t.trueY);
          const antiTankDmg = Math.round(rnd(2,6) * antiTankMult);
          t.hp -= antiTankDmg;
          fireTracer(sq.x, sq.y, t.trueX, t.trueY, 220, 'rifle', aliveFigureOffsets(sq.soldiers, SQUAD_GRID_OFFSETS));
          if(t.hp<=0 && !t.destroyed){
            t.destroyed = true; t.hp = 0;
            log('op','前線', `第${sqIdx+1}小隊が${t.id}を対戦車射撃で<b>撃破</b>。`);
            onTargetDestroyed(t);
          } else {
            log('op','前線', `第${sqIdx+1}小隊が至近距離の${t.id}へ対戦車射撃(効果 ${antiTankDmg})。`);
          }
        }
      });
    });
  }
  return anyEvent;
}

export function resolveDroneSwarm(dt){
  const drones = state.targets.filter(t=>!t.destroyed && t.type==='drone');
  if(drones.length===0) return false;
  let anyEvent = false;
  {
    drones.forEach(t=>{
      if(t.destroyed) return;
      const near = nearestFriendlyAsset(t.trueX, t.trueY, true);
      if(!near) return;
      if(near.dist <= DRONE_DETONATE_RANGE){
        anyEvent = true;
        const e = estPos(t);
        if(revealTarget(t)){
          log('op','斥候', `${t.id} の自爆攻撃を確認、<b>${t.def.label}</b>と識別。`);
        }
        if(rollExposureHit(getUnitExposure(near))){
          const dmg = Math.round(rnd(DRONE_DETONATE_DAMAGE[0], DRONE_DETONATE_DAMAGE[1]));
          damageFriendlyAsset(near, dmg, `${t.id}(ドローン)の自爆`);
          fireTracer(e.x, e.y, near.x, near.y, 180, 'drone');
        } else {
          log('sys','回避', `${t.id}(ドローン)が自爆したが、${friendlyFireCandidateLabel(near)}は掩蔽率により被弾を免れた。`);
        }
        // per user request: a self-detonating drone is consumed by its own attack run
        // rather than flying back to spawn to try again -- otherwise state.targets grows
        // without bound over a long wave (see resolveEnemyTurn's end-of-tick pruning).
        t.destroyed = true; t.hp = 0;
        onTargetDestroyed(t);
      } else {
        const dx = near.x-t.trueX, dy = near.y-t.trueY;
        const dist = Math.hypot(dx,dy) || 1;
        const step = Math.min(DRONE_SPEED*dt*DIFFICULTIES[state.difficulty].advanceMult, dist);
        t.trueX += dx/dist*step;
        t.trueY = clamp(t.trueY + dy/dist*step, 20, CANVAS_H-20);
        const bx = t.trueX-OP.x, by = t.trueY-OP.y;
        t.trueBearing = (Math.atan2(bx,-by)*180/Math.PI+360)%360;
        t.trueDistance = Math.sqrt(bx*bx+by*by);
      }
    });
  }
  return anyEvent;
}

export function resolveEnemyEvasion(dt){
  let moved = false;
  // Already fired once per commit regardless of turnCost before this conversion (unlike its
  // siblings' for(i<actionTurns) loops) -- now consistently gated to once per whole turn.
  if(!turnJustCrossed()) return moved;
  state.targets.filter(t=>!t.destroyed && t.revealed && (t.type==='infantry' || t.type==='vehicle')).forEach(t=>{
    if(Math.random() > 0.35) return;
    const near = nearestFriendlyAsset(t.trueX, t.trueY, false);
    if(!near || near.dist>900/METERS_PER_UNIT) return;
    const dx = t.trueX-near.x, dy = t.trueY-near.y;
    const dist = Math.hypot(dx,dy)||1;
    const goal = {x:clamp(t.trueX+dx/dist*180, 40, CANVAS_W-30), y:clamp(t.trueY+dy/dist*100, 30, CANVAS_H-30)};
    const next = terrainAwareStep(t.trueX, t.trueY, goal.x, goal.y, t.type==='vehicle' ? TANK_MOVE_CAP : INFANTRY_MOVE_CAP);
    t.trueX = next.x; t.trueY = next.y;
    t._alertState = 'withdraw';
    moved = true;
  });
  if(moved) log('sys','敵AI','発見された敵部隊が散開・退避を開始。');
  return moved;
}

export function advanceEnemyInfantry(dt){
  const enemyInfantry = state.targets.filter(t=>!t.destroyed && t.type==='infantry');
  if(enemyInfantry.length===0) return false;
  const aliveSquads = state.squads.filter(sq=>sq.soldiers.some(s=>s.alive));
  const squadsAlive = aliveSquads.length>0;
  // per user request: "last stand" -- once few enough enemies remain (lastStandActive), they
  // stop trying to reach/hold the normal front line and instead beeline straight for the HQ,
  // faster, without stopping to fight squad contact or flinching under suppression.
  const lastStand = lastStandActive();
  // per user request: defending their own HQ takes priority over the normal advance (but not
  // over an already-desperate last stand) -- see findHqDefenseThreat().
  const hqThreat = lastStand ? null : findHqDefenseThreat();
  const targetHq = lastStand || (!hqThreat && !squadsAlive);
  const goal = hqThreat || (targetHq ? state.hq : FRIENDLY_INF_POS);
  const minX = hqThreat ? 20 : (targetHq ? state.hq.x+20 : FRIENDLY_INF_POS.x+20);
  let moved = false;
  {
    enemyInfantry.forEach(t=>{
      if(t.destroyed) return;
      if(state.stage >= DRONE_INTRO_STAGE && performance.now()-(state.stageStartAt||0) >= 3000){
        if(t._droneCooldown === undefined) t._droneCooldown = Math.floor(rnd(2, INFANTRY_DRONE_COOLDOWN_TICKS));
        if(t._droneCooldown > 0){
          t._droneCooldown -= dt;
        // per-group chance is divided by the live group count (see the matching
        // correction in enemyCounterAttack) so splitting infantry into more formation
        // groups doesn't also multiply total drone-swarm launch volume per tick. A discrete
        // once-per-turn roll, so it only fires the instant a whole turn is crossed.
        } else if(turnJustCrossed() && Math.random() < INFANTRY_DRONE_LAUNCH_CHANCE/Math.max(1, enemyInfantry.length)){
          spawnInfantryDroneSwarm(t);
          t._droneCooldown = INFANTRY_DRONE_COOLDOWN_TICKS;
        }
      }
      // per user request: when defending the HQ, "in contact" is measured against the threat
      // itself (whatever unit type it is), not just squads.
      const inContact = !lastStand && (hqThreat
        ? Math.hypot(t.trueX-hqThreat.x, t.trueY-hqThreat.y) <= SQUAD_ENGAGE_RANGE
        : aliveSquads.some(sq=>Math.hypot(t.trueX-sq.x, t.trueY-sq.y) <= SQUAD_ENGAGE_RANGE));
      if(inContact){
        if(!t._contactLogged){
          t._contactLogged = true;
          log('op','斥候', `${t.id} が自軍小隊と接触。前進を停止し交戦中。`);
        }
        return;
      }
      if(targetHq && state.hq.hp>0){
        const hqDist = Math.hypot(t.trueX-state.hq.x, t.trueY-state.hq.y);
        if(hqDist <= SQUAD_ENGAGE_RANGE){
          // Melee attempts on the HQ are a discrete once-per-turn event, so they only
          // resolve the instant a whole turn is crossed.
          if(!turnJustCrossed()) return;
          if(rollExposureHit(getUnitExposure({kind:'hq'}))){
            const dmg = Math.round(rnd(6,16) * DIFFICULTIES[state.difficulty].counterMult); // per user request: enemy attack power doubled
            state.hq.hp = Math.max(0, state.hq.hp-dmg);
            if(state.hq.hp <= state.hq.maxHp*0.3) state.hpDroppedLow = true;
            log('sys','被弾', `${t.id} が指揮所に肉薄、突入攻撃(被害 ${dmg})。`);
          } else {
            log('sys','回避', `${t.id} が指揮所に肉薄したが、掩蔽率により突入攻撃を回避。`);
          }
          moved = true;
          return;
        }
      }
      const suppressed = isSuppressed(t);
      const step = INFANTRY_MOVE_CAP * dt * (t.speedMult||1) * (suppressed && !lastStand ? SUPPRESSION_MOVE_MULT : 1) * (lastStand ? 1.6 : 1);
      if(t.trueX > minX){
        if(lastStand){
          // per user request: no flanking spread or suppression-flinch during the last
          // stand -- a straight line at the HQ, ignoring being pinned down (already
          // desperate, nothing left to lose).
          const next = terrainAwareStep(t.trueX, t.trueY, goal.x, goal.y, step);
          t.trueX = Math.max(minX, next.x);
          t.trueY = clamp(next.y, 30, CANVAS_H-30);
          const dx = t.trueX-OP.x, dy = t.trueY-OP.y;
          t.trueBearing = (Math.atan2(dx,-dy)*180/Math.PI+360)%360;
          t.trueDistance = Math.sqrt(dx*dx+dy*dy);
          moved = true;
          return;
        }
        // per user request: flanking -- each group keeps a persistent lateral offset from
        // the main approach point so groups spread out and press from multiple angles
        // instead of all funneling onto the exact same spot.
        if(t._flankOffset===undefined) t._flankOffset = rnd(-FLANK_OFFSET_RANGE_UNITS, FLANK_OFFSET_RANGE_UNITS);
        const flankGoal = {x: goal.x, y: clamp(goal.y + t._flankOffset, 30, CANVAS_H-30)};
        const moveGoal = mergeAdjustedGoal(t, flankGoal);
        // per user request: suppression retreat -- pinned down under fire, a suppressed
        // group has a chance to flinch back away from its goal this tick instead of
        // advancing (on top of the existing move-speed penalty). The coin flip itself is a
        // discrete once-per-turn decision -- re-rolled only when a whole turn is crossed,
        // then held for the whole turn so continuous movement doesn't flicker direction
        // every SIM_STEP_MS.
        if(turnJustCrossed() || t._retreatingThisTurn===undefined){
          t._retreatingThisTurn = suppressed && Math.random() < SUPPRESSION_RETREAT_CHANCE;
        }
        const retreating = t._retreatingThisTurn;
        const aimX = retreating ? t.trueX + (t.trueX-moveGoal.x) : moveGoal.x;
        const aimY = retreating ? t.trueY + (t.trueY-moveGoal.y) : moveGoal.y;
        const roadNear = nearestRoadPoint(t.trueX, t.trueY);
        const roadPath = roadNear && roadNear.dist < ROAD_PULL_RADIUS*1.5
          ? getCachedRoadPath(t, t.trueX, t.trueY, aimX, aimY) : null;
        const next = roadPath
          ? advanceAlongPath(t.trueX, t.trueY, roadPath, step)
          : terrainAwareStep(t.trueX, t.trueY, aimX, aimY, step);
        t.trueX = Math.max(minX, next.x);
        t.trueY = clamp(next.y, 30, CANVAS_H-30);
        const dx = t.trueX-OP.x, dy = t.trueY-OP.y;
        t.trueBearing = (Math.atan2(dx,-dy)*180/Math.PI+360)%360;
        t.trueDistance = Math.sqrt(dx*dx+dy*dy);
        moved = true;
      }
    });
  }
  return moved;
}

export function resolveMortarCounterBattery(dt){
  let anyEvent = false;
  {
    state.mortars.forEach(mortar=>{
      if(mortar.hp<=0) return;
      if(mortar.cbWarnTurns!==null && mortar.cbWarnTurns!==undefined){
        mortar.cbWarnTurns -= dt;
        if(mortar.cbWarnTurns<=0){
          mortar.cbWarnTurns = null;
          mortar.shotsSinceMove = 0;
          anyEvent = true;
          log('sys','警報', `迫撃砲${mortar.id+1}、対砲兵射撃着弾!`);
          projectiles.push({
            startX: ENEMY_SPAWN_MIN_X, startY: clamp(mortar.y, 60, CANVAS_H-60),
            endX: mortar.x, endY: mortar.y,
            born: performance.now(),
            duration: FLIGHT_DURATION,
            trajectory: 'arc',
            onLand: ()=>{
              const dmg = Math.round(rnd(MORTAR_CB_STRIKE_DMG[0], MORTAR_CB_STRIKE_DMG[1]) * DIFFICULTIES[state.difficulty].counterMult);
              damageFriendlyAsset({kind:'mortar', idx:mortar.id}, dmg, '敵対砲兵レーダーによる制圧射撃');
              render();
            }
          });
        }
        return;
      }
      // Detection is a discrete once-per-turn roll (re-tried every turn once eligible), so it
      // only evaluates the instant a whole turn is crossed, using the original odds unchanged.
      if(mortar.shotsSinceMove > MORTAR_CB_SHOTS_THRESHOLD && turnJustCrossed()){
        const chance = MORTAR_CB_DETECT_BASE + state.stage*0.01;
        if(Math.random() < chance){
          mortar.cbWarnTurns = MORTAR_CB_WARN_TURNS;
          anyEvent = true;
          log('sys','警告', `迫撃砲${mortar.id+1}、同一陣地からの連続射撃を敵対砲兵レーダーに捕捉された可能性!${MORTAR_CB_WARN_TURNS}ターン以内に陣地転換せよ。`);
          unitSpeak('mortar', mortar.id, 'warning');
        }
      }
    });
  }
  return anyEvent;
}

export function resolveEnemyTurn(dt){
  rebuildTargetGrid();
  maybePlaceMine();
  updateHqDetection();
  // per user request: "last stand" -- reveal every remaining enemy the instant the wave drops
  // to LAST_STAND_THRESHOLD or fewer (see isTargetDetected/lastStandActive), and announce it
  // once per wave rather than spamming the log every tick it stays true.
  if(lastStandActive()){
    if(!state.lastStandAnnounced){
      state.lastStandAnnounced = true;
      log('sys','警報', '敵残存わずか。全戦力が本部へ死に物狂いの突撃を開始した模様!');
    }
    state.targets.forEach(t=>{ if(!t.destroyed) revealTarget(t); });
  }
  resolveHqMovement(dt);
  advanceEnemyInfantry(dt);
  advanceEnemyArtillery(dt);
  resolveVehicleAssault(dt);
  const heliEvent = resolveHeliAssault(dt);
  const aaEvent = resolveEnemyAntiAir(dt);
  resolveEnemyHqAttack(dt);
  resolveEnemyEvasion(dt);
  const antiDroned = resolveSquadAntiDrone(dt);
  resolveSquadAntiVehicle(dt);
  resolveDroneSwarm(dt);
  enemyCounterAttack(dt);
  resolveMortarCounterBattery(dt);
  let infEvent = false;
  if(!allSquadsWiped()){
    infEvent = resolveSquadOrders(dt);
  }
  let sniperEvent = false;
  if(!allSnipersWiped()){
    sniperEvent = resolveSniperOrders(dt);
  }
  let tankEvent = false;
  if(!allTanksWiped()){
    tankEvent = resolveTankOrders(dt);
  }
  let samEvent = false;
  if(!allSamsWiped()){
    samEvent = resolveSamOrders(dt);
  }
  if(!allEngineersWiped()){
    resolveEngineerOrders(dt);
  }
  // Keep independently commanded formations from collapsing into one marker while
  // they advance toward the same FEBA or contact point in real time.
  maintainFriendlySpacing();
  // per continuous-sim conversion: the "目立った動きなし" turn-marker log line is gone --
  // resolveEnemyTurn now runs every SIM_STEP_MS, so printing it every step (the common case,
  // since most steps fall between turn crossings) would flood the log instead of marking a
  // discrete turn.
  // per user request: 交戦時のサウンド -- looping battlefield-combat ambience plays while
  // squads/snipers are actively engaging this turn, and pauses again once nothing is
  // actively engaging.
  if(infEvent || sniperEvent || tankEvent || samEvent || antiDroned || heliEvent || aaEvent) playCombatAmbience(); else stopCombatAmbience();
  state.targets.forEach(t=>{
    if(t.suppressed>0) t.suppressed = Math.max(0, t.suppressed-dt);
  });
  // per user request: destroyed targets were never actually removed from state.targets
  // (only flagged), so a long wave with heavy drone-swarm spawning could grow this array
  // (and the per-tick/per-frame work that scans it) without bound. Prune here, once per
  // decision cycle, well after every resolve* pass above has finished reading it this tick.
  if(state.targets.some(t=>t.destroyed)){
    state.targets.forEach(t=>{ if(t.destroyed) disposeMarker3d('target'+t.id); });
    state.targets = state.targets.filter(t=>!t.destroyed);
  }
  if(state.walls.some(w=>w.hp<=0)){
    state.walls.forEach(w=>{ if(w.hp<=0) disposeMarker3d('wall'+w.id); });
    state.walls = state.walls.filter(w=>w.hp>0);
  }
}

export function launchMortarVolley(mortar, shell, fuze, count, aim, snappedTarget, onVolleyDone){
  // shoot-and-scoot: every volley fired counts against the same-position streak (see
  // resolveMortarCounterBattery); resolveOneMortarDecision resets this back to 0 once the
  // mortar actually completes a relocation.
  mortar.shotsSinceMove = (mortar.shotsSinceMove||0) + 1;
  // per user request: impact is always exactly the aimed coordinate (plus normal dispersion)
  // -- no more silent correction toward a snapped target's true position. Accuracy against an
  // identified target comes entirely from how good the aim point (the current estimate,
  // see estPos/posErr) already is, and from walking fire onto target across volleys (see
  // finalizeVolley's posErr reduction), not from the game quietly fixing a bad aim for you.
  const aimX = aim.x, aimY = aim.y;
  const dispersion = computeDispersionAt() * WEATHER_TYPES[state.weather].dispersionMult * (SHELL_DISPERSION_MULT[shell]||1);
  const base = 25;

  const brg = bearingBetween(mortar.x, mortar.y, aimX, aimY);
  const dist = Math.hypot(aimX-mortar.x, aimY-mortar.y);
  const aimLabel = snappedTarget ? snappedTarget.id : `座標(方位${Math.round(brg)}°/距離${unitsToMeters(dist)}m)`;
  log('fdc','FDC', `迫撃砲${mortar.id+1}: ${aimLabel} へ射撃要求。${SHELLS[shell]}・${FUZES[fuze]}・${count}発。`);
  log('mortar','迫撃砲班', `迫撃砲${mortar.id+1} 了解。${count}発装填、撃て!`);

  let pending = count;
  let hitAny = false;
  const volleyImpacts = [];
  const reloadStart = performance.now();
  mortar.reloadingUntil = reloadStart + MORTAR_RELOAD_MS + Math.max(0, count-1)*LAUNCH_INTERVAL;
  render();

  for(let i=0;i<count;i++){
    setTimeout(()=>{
      playSfx('mortarFire', 0.14);
      mortar.reloadingUntil = performance.now() + MORTAR_RELOAD_MS;
      const ix = aimX + gauss()*dispersion;
      const iy = aimY + gauss()*dispersion;
      projectiles.push({
        startX: mortar.x, startY: mortar.y-16,
        endX: ix, endY: iy,
        born: performance.now(),
        duration: FLIGHT_DURATION,
        trajectory: 'arc',
        onLand: ()=>{
          volleyImpacts.push({x:ix,y:iy});
          if(shell==='illum' || shell==='smoke' || shell==='marker'){
            hitAny = true;
            if(shell==='illum'){
              state.illumFlares.push({x:ix, y:iy, born:performance.now(), turnsLeft:ILLUM_DURATION_TURNS});
              spawn3dImpactEffect(ix, iy, 'explosion');
              log('mortar','観測', `弾着${i+1}: 照明弾、上空で破裂。光弾が降下しながら半径${Math.round(ILLUM_RADIUS_M)}mを照射(${ILLUM_DURATION_TURNS}ターン持続)。`);
            } else if(shell==='smoke'){
              state.smokeClouds.push({x:ix, y:iy, turnsLeft:SMOKE_DURATION_TURNS, born:performance.now()});
              spawn3dImpactEffect(ix, iy, 'smoke');
              log('mortar','観測', `弾着${i+1}: 発煙弾展開。半径${Math.round(SMOKE_RADIUS_M)}mを遮蔽(${SMOKE_DURATION_TURNS}ターン持続)。`);
            } else {
              let revealedCount = 0;
              state.targets.forEach(target=>{
                if(target.destroyed) return;
                if(Math.hypot(ix-target.trueX, iy-target.trueY) <= MARKER_REVEAL_RADIUS_UNITS){
                  if(revealTarget(target)) revealedCount += 1;
                }
              });
              log('mortar','観測', `弾着${i+1}: マーカー弾(試射)着弾。半径200m以内の目標${revealedCount}件を捕捉、以後表示継続。`);
            }
            pending -= 1;
            if(pending <= 0){
              mortar.reloadingUntil = 0;
              finalizeVolley(snappedTarget, hitAny, volleyImpacts);
              onVolleyDone();
            }
            render();
            return;
          }
          const killRadius = SHELL_KILL_RADIUS_UNITS[shell];
          // per user request: proximity-fused HE bursts in the air, so it catches every drone
          // within the kill radius at once instead of only ever downing one drone per round --
          // the intended counter to a whole swarm arriving together. Every other shell/fuze
          // (and proximity HE against anything that isn't a drone) keeps the normal
          // single-nearest-target resolution below.
          const isProximityAirburst = shell==='he' && fuze==='proximity';
          const dronesInBurst = isProximityAirburst
            ? state.targets.filter(target=>!target.destroyed && target.type==='drone' && Math.hypot(ix-target.trueX, iy-target.trueY)<=killRadius)
            : [];
          if(dronesInBurst.length>0){
            hitAny = true;
            dronesInBurst.forEach(target=>{
              const wasFullHp = target.hp === target.maxHp;
              const dmg = Math.round(base*effectMultiplier(shell, fuze, target.type));
              applyDamageToTarget(target, dmg);
              target.impacts.push({x:ix,y:iy});
              target.suppressed = SUPPRESSION_TURNS;
              if(wasFullHp && target.hp<=0) unlockAchievement('oneShotKill');
              if(target.hp<=0 && !target.destroyed){
                target.destroyed = true;
                target.hp = 0;
                onTargetDestroyed(target);
              }
            });
            log('mortar','観測', `弾着${i+1}: <b>空中炸裂</b>。近接信管がドローン${dronesInBurst.length}機を同時に捕捉、一掃した。`);
            pending -= 1;
            if(pending <= 0){
              mortar.reloadingUntil = 0;
              finalizeVolley(snappedTarget, hitAny, volleyImpacts);
              onVolleyDone();
            }
            render();
            return;
          }
          let hitTarget = null, nearMiss = false;
          state.targets.forEach(target=>{
            if(target.destroyed || hitTarget) return;
            const dToTrue = Math.hypot(ix-target.trueX, iy-target.trueY);
            if(dToTrue <= killRadius) hitTarget = target;
            else if(dToTrue <= killRadius*1.6) nearMiss = true;
          });
          if(hitTarget){
            const wasFullHp = hitTarget.hp === hitTarget.maxHp;
            const tmult = effectMultiplier(shell, fuze, hitTarget.type);
            const dmg = Math.round(base*tmult);
            applyDamageToTarget(hitTarget, dmg);
            hitTarget.impacts.push({x:ix,y:iy});
            hitAny = true;
            // per user request: a mortar strike landing on the enemy HQ marks the firing
            // mortar as a priority threat (see findHqDefenseThreat()) even if it's well
            // outside HQ_DEFENSE_RANGE_UNITS -- mortars can hit it from up to 6km away.
            if(hitTarget.type==='hq'){
              hitTarget._hqDefenseAttackerKind = 'mortar';
              hitTarget._hqDefenseAttackerIdx = mortar.id;
              hitTarget._hqDefenseAttackedAt = performance.now();
            }
            const wasSuppressed = isSuppressed(hitTarget);
            hitTarget.suppressed = SUPPRESSION_TURNS;
            log('mortar','観測', `弾着${i+1}: <b>命中</b> (${hitTarget.id} 算定効果 ${dmg})${wasSuppressed?'':' ― 制圧'}`);
            if(wasFullHp && hitTarget.hp<=0) unlockAchievement('oneShotKill');
            if(hitTarget.hp<=0 && !hitTarget.destroyed){
              hitTarget.destroyed = true;
              hitTarget.hp = 0;
              log('fdc','FDC', `${hitTarget.id} <b>撃破を確認</b>。`);
              onTargetDestroyed(hitTarget);
            }
          } else {
            const ffTarget = checkFriendlyFireAt(ix, iy, killRadius);
            if(ffTarget){
              const dmg = base;
              damageFriendlyAsset(ffTarget, dmg, `迫撃砲${mortar.id+1}の誤射`);
              log('sys','誤射', `弾着${i+1}: <b>味方への誤射</b> (${friendlyFireCandidateLabel(ffTarget)} 被害 ${dmg})。目標との距離・信管を確認せよ。`);
            } else {
              if(nearMiss){
                state.targets.forEach(target=>{
                  if(target.destroyed) return;
                  if(Math.hypot(ix-target.trueX, iy-target.trueY) <= killRadius*1.6){
                    target.suppressed = Math.max(target.suppressed||0, SUPPRESSION_NEARMISS_TURNS);
                  }
                });
              }
              if(snappedTarget && !snappedTarget.destroyed) snappedTarget.impacts.push({x:ix,y:iy});
              log('mortar','観測', nearMiss ? `弾着${i+1}: 至近弾。効果は限定的だが制圧効果あり。` : `弾着${i+1}: 外れ。修正が必要。`);
            }
          }
          pending -= 1;
          if(pending <= 0){
            mortar.reloadingUntil = 0;
            finalizeVolley(snappedTarget, hitAny, volleyImpacts);
            onVolleyDone();
          }
          render();
        }
      });
      spawn3dProjectile(mortar.x, mortar.y-16, ix, iy, FLIGHT_DURATION);
    }, i*LAUNCH_INTERVAL);
  }
}

export function isAutoCommitRunning(){ return !!(state && state.simRunning); }

export function startRealtimeLoop(){
  if(!state || state.stageResolved || state.placementPending || state.decoyPlacementPending || state.simRunning) return;
  state.simRunning = true;
  simAccumMs = 0;
  log('sys','システム', `リアルタイム戦闘開始(${GAME_SPEED_LABEL[state.gameSpeed]})。命令は即時反映されます。`);
  render();
}

export function toggleAutoCommit(){
  if(!state) return;
  if(state.simRunning){
    state.simRunning = false;
    log('sys','システム', 'リアルタイム戦闘を一時停止。');
  } else {
    startRealtimeLoop();
    return;
  }
  render();
}

export function setGameSpeed(speed){
  if(!state || !GAME_SPEED_INTERVALS[speed] || state.gameSpeed===speed) return;
  state.gameSpeed = speed;
  log('sys','システム', `リアルタイム速度を${GAME_SPEED_LABEL[speed]}に変更。`);
  render();
}

export let mortarFireCursor = 0;

export let lastStepRenderAt = 0;

export function renderThrottledForStep(){
  const now = performance.now();
  if(now - lastStepRenderAt < STEP_RENDER_MIN_INTERVAL_MS) return;
  lastStepRenderAt = now;
  render();
}

// per user request: moves any queued enemy whose spawnAt has arrived from state.pendingSpawns
// into the live state.targets, one wave-start delay + trickle-in at a time (see startStage()).
export function processSpawnQueue(){
  if(!state.pendingSpawns || state.pendingSpawns.length===0) return;
  const now = performance.now();
  const due = state.pendingSpawns.filter(t=>t.spawnAt<=now);
  if(due.length===0) return;
  state.pendingSpawns = state.pendingSpawns.filter(t=>t.spawnAt>now);
  state.targets.push(...due);
}

export function simulationStep(){
  if(!state || state.stageResolved || state.snipeMortarStrikesPending>0 || state.placementPending || state.decoyPlacementPending) return;
  processSpawnQueue();
  const dt = deltaTurns();
  state.turns += dt;
  state.missionMinutes += dt;
  state.febaX = computeFebaX();
  updateTurnBoundary();

  // A mortar whose queued shot can't be afforded only cancels THAT mortar's
  // order (reverts to standby) -- it must never block the whole step, or the
  // entire game (including the enemy's advancement) softlocks permanently
  // once ammo runs low.
  let heBudget = state.ammo.he, heatBudget = state.ammo.heat;
  const firingMortars = [];
  const queuedMortars = state.mortars.filter(m=>m.hp>0 && m.pendingFire);
  const selectedMortarId = queuedMortars.length
    ? queuedMortars[mortarFireCursor % queuedMortars.length].id
    : null;
  if(queuedMortars.length) mortarFireCursor++;
  state.mortars.forEach(m=>{
    if(m.hp<=0 || !m.pendingFire || m.id!==selectedMortarId) return;
    if(m.fireShell==='he' || m.fireShell==='heat'){
      const budget = m.fireShell==='he' ? heBudget : heatBudget;
      if(m.fireCount > budget){
        log('sys','システム', `迫撃砲${m.id+1}: 弾薬不足のため射撃指示を取消。`);
        unitSpeak('mortar', m.id, 'ammo');
        m.pendingFire = null;
        m.order = 'standby';
        return;
      }
      if(m.fireShell==='he') heBudget -= m.fireCount; else heatBudget -= m.fireCount;
    }
    firingMortars.push(m);
  });
  const ammoNeeded = {he: state.ammo.he-heBudget, heat: state.ammo.heat-heatBudget};
  state.ammo.he -= ammoNeeded.he;
  state.ammo.heat -= ammoNeeded.heat;

  state.smokeClouds.forEach(c=>{ c.turnsLeft -= dt; });
  state.smokeClouds = state.smokeClouds.filter(c=>c.turnsLeft>0);
  state.illumFlares.forEach(f=>{ f.turnsLeft -= dt; });
  state.illumFlares = state.illumFlares.filter(f=>f.turnsLeft>0);

  if(turnJustCrossed()) speakCoordination();
  resolveScoutDecision(dt);
  resolveMortarDecision(dt);
  resolveFriendlyHeliTurn(dt);
  resolveEnemyTurn(dt);

  // per user request: wiping out the enemy via direct fire (squad/tank/sniper/SAM/anti-drone/
  // anti-vehicle, all resolved inside resolveEnemyTurn above) never triggered wave-clear --
  // checkEnd() was previously only called from a mortar volley's async impact callback and the
  // loss-condition branch just below, so killing the last enemy any other way left the wave
  // stuck in "戦闘中" forever. checkEnd() itself is idempotent (state.stageResolved guards it)
  // and cheap, so it's safe to just check every step here.
  checkEnd();
  if(state.stageResolved){ render(); return; }

  if(allMortarsWiped() || allSquadsWiped()){
    checkEnd(); render(); return;
  }

  firingMortars.forEach(m=>{
    const aim = m.pendingFire;
    m.pendingFire = null;
    if(m.hp<=0) return;
    const snappedTarget = aim.snappedId ? state.targets.find(x=>x.id===aim.snappedId) : null;
    if(snappedTarget && snappedTarget.destroyed){
      log('fdc','FDC', `${snappedTarget.id} は既に撃破済み。迫撃砲${m.id+1}の射撃指示を中止。`);
      return;
    }
    // Mortars now fire independently and can overlap in flight, so in-flight state is a
    // counter (state.inFlightVolleys), not the single boolean state.animating used to be.
    state.inFlightVolleys += 1;
    state.animating = true;
    launchMortarVolley(m, m.fireShell, m.fireFuze, m.fireCount, aim, snappedTarget, ()=>{
      state.inFlightVolleys -= 1;
      if(state.inFlightVolleys<=0) state.animating = false;
      checkEnd();
      render();
    });
  });

  renderThrottledForStep();
}

export function finalizeVolley(snappedTarget, hitAny, volleyImpacts){
  if(!hitAny){
    log('fdc','FDC', `着弾効果不十分。情報精度が低ければ弾種・信管を見直せ。`);
  }
  if(snappedTarget && !snappedTarget.destroyed && volleyImpacts.length){
    const n = volleyImpacts.length;
    const avgX = volleyImpacts.reduce((s,p)=>s+p.x,0)/n;
    const avgY = volleyImpacts.reduce((s,p)=>s+p.y,0)/n;
    const dx = snappedTarget.trueX-avgX, dy = snappedTarget.trueY-avgY;
    const ewDir = dx>=0?'東':'西', nsDir = dy<0?'北':'南';
    const ewAmt = unitsToMeters(Math.abs(dx)), nsAmt = unitsToMeters(Math.abs(dy));
    log('op', '斥候', `弾着観測。目標は着弾点より${ewDir}${ewAmt}m、${nsDir}${nsAmt}m。`);
  }
}

export function checkEnd(){
  if(state.stageResolved) return;

  if(state.hq.hp<=0){
    state.stageResolved = true;
    showStageFailed('hq');
    return;
  }
  if(allMortarsWiped()){
    state.stageResolved = true;
    showStageFailed('hp');
    return;
  }
  if(state.squads.length>0 && allSquadsWiped()){
    state.stageResolved = true;
    showStageFailed('infantry');
    return;
  }

  const remaining = state.targets.filter(t=>!t.destroyed);
  // per user request: enemies trickle in over the first WAVE_SPAWN_WINDOW_MS of the wave (see
  // startStage()/processSpawnQueue()) -- wiping out everyone spawned so far must not count as
  // a clear while reinforcements are still queued in state.pendingSpawns.
  const allSpawned = !state.pendingSpawns || state.pendingSpawns.length===0;
  // per user request (idea 4): destroying the enemy HQ clears the wave immediately,
  // regardless of how many other enemies are still alive -- an alternate, high-risk/
  // high-reward win condition alongside the usual "every target destroyed".
  const enemyHqTarget = state.targets.find(t=>t.type==='hq');
  const enemyHqDown = enemyHqTarget && enemyHqTarget.destroyed;
  if((remaining.length===0 && allSpawned) || enemyHqDown){
    state.stageResolved = true;
    if(enemyHqDown && remaining.length>0){
      log('sys','司令部', '敵指揮系統の中枢を撃破。残存する敵部隊は指揮を失い、WAVEの制圧を確認。');
    }
    triggerWaveClearSequence();
    return;
  }

  const hasAmmo = state.ammo.he>0 || state.ammo.heat>0;
  const canFightOn = hasAmmo || state.snipers.some(sn=>sn.soldiers.some(s=>s.alive)) || state.squads.some(sq=>sq.soldiers.some(s=>s.alive));
  if(!canFightOn){
    state.stageResolved = true;
    log('sys','システム','全弾薬を消費し、交戦可能な部隊も残っていない。任務継続不能。');
    showStageFailed('ammo');
  }
}

export function triggerWaveClearSequence(){
  setTimeout(()=>{
    playSfx('fanfare', 0.5);
    setTimeout(()=>{
      // per user request: on top of the usual money reward, the player picks one of three
      // bonuses (see showWaveRewardChoice/chooseWaveReward) before the WAVE CLEAR summary
      // shows -- skipped on the final wave, since there's no next wave to carry a bonus into.
      if(state.stage >= STAGE_COUNT){
        handleStageClear();
      } else {
        showWaveRewardChoice();
      }
      render();
    }, WAVE_CLEAR_FANFARE_HOLD_MS);
  }, WAVE_CLEAR_EFFECT_WAIT_MS);
}

export function computeReward(){
  const base = 150 + state.stage*70;
  const turnsPar = state.targetsSpawnedTotal*6;
  const turnsBonus = Math.max(0, Math.round((turnsPar - state.turns) * 8));
  const ammoBonus = (state.ammo.he+state.ammo.heat)*6;
  const hpFrac = state.mortars.length ? state.mortars.reduce((s,m)=>s+m.hp/m.maxHp,0)/state.mortars.length : 0;
  const hpBonus = Math.round(hpFrac*300);
  const infFrac = totalAliveSoldiers()/totalSquadCapacity();
  const infBonus = Math.round(infFrac*150);
  const scoutFrac = state.scouts.length ? state.scouts.reduce((s,sc)=>s+unitAliveCount(sc)/sc.soldiers.length,0)/state.scouts.length : 0;
  const scoutBonus = Math.round(scoutFrac*100);
  const sniperFrac = state.snipers.length ? state.snipers.reduce((s,sn)=>s+sn.soldiers.filter(x=>x.alive).length/sn.soldiers.length,0)/state.snipers.length : 0;
  const sniperBonus = Math.round(sniperFrac*100);
  const hqFrac = state.hq.hp/state.hq.maxHp;
  const hqBonus = Math.round(hqFrac*200);
  // per user request (idea 5): destroying the enemy HQ (see checkEnd()) is a flat bonus on
  // top of everything else, so rushing it isn't a worse payout than grinding out every
  // target -- it's the reward for identifying and hitting a small, well-defended objective
  // fast, even if that means less time to also clear (and less loot-relevant survival from)
  // the rest of the wave.
  const enemyHqTarget = state.targets.find(t=>t.type==='hq');
  const enemyHqBonus = (enemyHqTarget && enemyHqTarget.destroyed) ? 250 : 0;
  const total = Math.round((base+turnsBonus+ammoBonus+hpBonus+infBonus+scoutBonus+sniperBonus+hqBonus+enemyHqBonus) * DIFFICULTIES[state.difficulty].rewardMult);
  return {base,turnsBonus,ammoBonus,hpBonus,infBonus,scoutBonus,sniperBonus,hqBonus,enemyHqBonus,total};
}

export function applyWaveResupply(){
  const hpFrac = state.mortars.length ? state.mortars.reduce((s,m)=>s+m.hp/m.maxHp,0)/state.mortars.length : 0;
  const infFrac = totalAliveSoldiers()/totalSquadCapacity();
  const scoutFrac = state.scouts.length ? state.scouts.reduce((s,sc)=>s+unitAliveCount(sc)/sc.soldiers.length,0)/state.scouts.length : 0;
  const sniperFrac = state.snipers.length ? state.snipers.reduce((s,sn)=>s+sn.soldiers.filter(x=>x.alive).length/sn.soldiers.length,0)/state.snipers.length : 0;
  const hqFrac = state.hq.hp/state.hq.maxHp;
  const perf = (hpFrac+infFrac+scoutFrac+sniperFrac+hqFrac)/5;
  const ammoHe = Math.round(10*perf);
  const ammoHeat = Math.round(5*perf);
  const personnel = Math.round(4*perf);
  state.ammo.he += ammoHe;
  state.ammo.heat += ammoHeat;
  state.reserve += personnel;
  return {ammoHe, ammoHeat, personnel, perf};
}

export function awardVeteranXp(){
  const groups = [
    {units:state.squads,  label:i=>`第${i+1}小隊`},
    {units:state.scouts,  label:i=>`斥候${i+1}`},
    {units:state.snipers, label:i=>`狙撃${i+1}班`},
  ];
  const levelUps = [];
  groups.forEach(group=>{
    group.units.forEach((unit,uIdx)=>{
      unit.soldiers.forEach(s=>{
        if(!s.alive) return;
        const before = vetLevelOf(s);
        s.vetXp = (s.vetXp||0) + 1;
        const after = vetLevelOf(s);
        if(after>before){
          levelUps.push(`${group.label(uIdx)} ${s.rank} ${s.name}(Lv.${after})`);
          if(after>=VET_MAX_LEVEL) unlockAchievement('veteranMaster');
        }
      });
    });
  });
  if(levelUps.length) log('fdc','戦果', `古参兵昇進: ${levelUps.join('、')}`);
}

export function handleStageClear(){
  speakRandomAliveUnit('victory');
  awardVeteranXp();
  const reward = computeReward();
  state.money += reward.total;

  if(state.mortars.every(m=>m.hp === m.maxHp) && state.hq.hp === state.hq.maxHp) unlockAchievement('flawlessStage');
  if(totalAliveSoldiers() === totalSquadCapacity()) unlockAchievement('perfectSquad');
  const startAmmo = state.stageStartSnapshot.ammo.he + state.stageStartSnapshot.ammo.heat;
  const nowAmmo = state.ammo.he + state.ammo.heat;
  if(startAmmo>0 && nowAmmo >= startAmmo*0.5) unlockAchievement('ammoSaver');
  if(state.turns <= state.targetsSpawnedTotal*4) unlockAchievement('speedClear');
  if(state.hpDroppedLow) unlockAchievement('ironWall');
  if(state.money >= 5000) unlockAchievement('millionaire');

  if(state.stage >= STAGE_COUNT){
    showGameClear(reward);
  } else {
    const resupply = applyWaveResupply();
    showStageClear(reward, resupply);
  }
}

export function assignSquadHunt(idx){
  const sq = state.squads[idx];
  if(!sq || !sq.soldiers.some(s=>s.alive) || sq.resting) return;
  const targetId = state.enemyCommandBox;
  const target = targetId ? state.targets.find(t=>t.id===targetId && !t.destroyed) : null;
  if(!target || target.type==='heli' || target.type==='drone') return;
  if(sq.order==='hunt' && sq.huntTargetId===target.id){
    clearSquadHunt(idx);
    log('sys','前線', `第${idx+1}小隊、${target.id}への攻撃指示を解除。`);
    return;
  }
  sq.order = 'hunt';
  sq.huntTargetId = target.id;
  sq.pendingDest = null;
  unitSpeakOrder('squad', idx);
  log('sys','前線', `第${idx+1}小隊、${target.id} を攻撃目標に指示。接敵まで前進する。`);
  render();
}

export function clearSquadHunt(idx){
  const sq = state.squads[idx];
  if(!sq) return;
  sq.huntTargetId = null;
  if(sq.order==='hunt') sq.order = 'hold';
  render();
}

export function assignTankHunt(idx){
  const tank = state.tanks[idx];
  if(!tank || tank.hp<=0) return;
  const targetId = state.enemyCommandBox;
  const target = targetId ? state.targets.find(t=>t.id===targetId && !t.destroyed) : null;
  if(!target || target.type==='heli' || target.type==='drone') return;
  if(tank.order==='hunt' && tank.huntTargetId===target.id){
    clearTankHunt(idx);
    log('sys','前線', `戦車${idx+1}、${target.id}への攻撃指示を解除。`);
    return;
  }
  tank.order = 'hunt';
  tank.huntTargetId = target.id;
  tank.pendingDest = null;
  log('sys','前線', `戦車${idx+1}、${target.id} を攻撃目標に指示。接敵まで前進する。`);
  render();
}

export function clearTankHunt(idx){
  const tank = state.tanks[idx];
  if(!tank) return;
  tank.huntTargetId = null;
  if(tank.order==='hunt') tank.order = 'hold';
  render();
}

export function repairTank(idx){
  const tank = state.tanks[idx];
  if(!state || state.stageResolved || !tank || tank.hp<=0 || tank.hp>=tank.maxHp) return;
  const restoreHp = Math.min(TANK_REPAIR_HP_PER_CALL, tank.maxHp-tank.hp);
  const cost = Math.round(TANK_REPAIR_COST_PER_HP*restoreHp);
  if(state.money < cost){ log('sys','システム','資金が不足しています。'); return; }
  state.money -= cost;
  tank.hp = Math.min(tank.maxHp, tank.hp+restoreHp);
  state.turns += 1;
  log('sys','工兵', `戦車${idx+1}、応急修復完了(+${restoreHp}HP)。¥${cost}を消費(現在HP ${tank.hp}/${tank.maxHp})。`);
  // per continuous-sim conversion: no longer forces an extra resolveEnemyTurn(1) here -- the
  // enemy already advances continuously via loop()'s accumulator, so this would double-apply.
  checkEnd();
  render();
}

export function assignSamHunt(idx){
  const sam = state.sams[idx];
  if(!sam || sam.hp<=0) return;
  const targetId = state.enemyCommandBox;
  const target = targetId ? state.targets.find(t=>t.id===targetId && !t.destroyed) : null;
  if(!target || (target.type!=='heli' && target.type!=='drone')) return;
  if(sam.order==='hunt' && sam.huntTargetId===target.id){
    clearSamHunt(idx);
    log('sys','前線', `対空${idx+1}、${target.id}への攻撃指示を解除。`);
    return;
  }
  sam.order = 'hunt';
  sam.huntTargetId = target.id;
  sam.pendingDest = null;
  log('sys','前線', `対空${idx+1}、${target.id} を攻撃目標に指示。`);
  render();
}

export function clearSamHunt(idx){
  const sam = state.sams[idx];
  if(!sam) return;
  sam.huntTargetId = null;
  if(sam.order==='hunt') sam.order = 'hold';
  render();
}

export function repairSam(idx){
  const sam = state.sams[idx];
  if(!state || state.stageResolved || !sam || sam.hp<=0 || sam.hp>=sam.maxHp) return;
  const restoreHp = Math.min(SAM_REPAIR_HP_PER_CALL, sam.maxHp-sam.hp);
  const cost = Math.round(SAM_REPAIR_COST_PER_HP*restoreHp);
  if(state.money < cost){ log('sys','システム','資金が不足しています。'); return; }
  state.money -= cost;
  sam.hp = Math.min(sam.maxHp, sam.hp+restoreHp);
  state.turns += 1;
  log('sys','工兵', `対空${idx+1}、応急修復完了(+${restoreHp}HP)。¥${cost}を消費(現在HP ${sam.hp}/${sam.maxHp})。`);
  // per continuous-sim conversion: no longer forces an extra resolveEnemyTurn(1) here -- the
  // enemy already advances continuously via loop()'s accumulator, so this would double-apply.
  checkEnd();
  render();
}

export function assignMortarFire(idx){
  const mortar = state.mortars[idx];
  if(!mortar || mortar.hp<=0) return;
  const targetId = state.enemyCommandBox;
  const target = targetId ? state.targets.find(t=>t.id===targetId && !t.destroyed) : null;
  if(!target) return;
  if(mortar.order==='fire' && mortar.pendingFire && mortar.pendingFire.snappedId===target.id){
    mortar.pendingFire = null;
    mortar.order = 'standby';
    log('fdc','FDC', `迫撃砲${idx+1}、${target.id}への攻撃指示を解除。`);
    render();
    return;
  }
  if(mortarNotReadyToFire(mortar)){
    log('sys','システム', `迫撃砲${idx+1}、陣地転換直後で射撃準備中。攻撃指示を却下。`);
    render();
    return;
  }
  const e = estPosFromMortar(mortar, target);
  if(mortarTooCloseToFire(mortar, e.x, e.y)){
    log('sys','システム', `迫撃砲${idx+1}、${target.id}は近すぎます(最低射程${MORTAR_MIN_RANGE_M}m)。攻撃指示を却下。`);
    render();
    return;
  }
  if(mortarTooFarToFire(mortar, e.x, e.y)){
    log('sys','システム', `迫撃砲${idx+1}、${target.id}は遠すぎます(最大射程${MORTAR_MAX_RANGE_M}m)。攻撃指示を却下。`);
    render();
    return;
  }
  mortar.pendingFire = {x:e.x, y:e.y, snappedId:target.id};
  applyBestMortarLoadout(mortar, target);
  mortar.order = 'fire';
  mortar.pendingDest = null;
  state.selectedId = target.id;
  unitSpeakOrder('mortar', idx);
  log('fdc','FDC', `迫撃砲${idx+1}、${target.id} を攻撃目標に指示。${SHELLS[mortar.fireShell]}・${FUZES[mortar.fireFuze]}・${mortar.fireCount}発を自動選択。`);
  render();
}

export function updateFireConfig(idx, field, value){
  const mortar = state.mortars[idx];
  if(!mortar) return;
  mortar[field] = field==='fireCount' ? parseInt(value,10) : value;
  render();
}

export let lastSimFrameAt = null;

export function advanceSimulation(){
  const now = performance.now();
  if(lastSimFrameAt===null){ lastSimFrameAt = now; return; }
  const elapsed = now - lastSimFrameAt;
  lastSimFrameAt = now;
  if(!state || !state.simRunning || state.stageResolved || state.commandBox || state.enemyCommandBox || state.decoyCommandBox || state.placementPending || state.decoyPlacementPending){
    simAccumMs = 0;
    return;
  }
  simAccumMs += elapsed;
  let steps = 0;
  while(simAccumMs >= SIM_STEP_MS && steps < SIM_STEP_MAX_CATCHUP){
    simulationStep();
    simAccumMs -= SIM_STEP_MS;
    steps++;
  }
  if(steps >= SIM_STEP_MAX_CATCHUP) simAccumMs = 0;
}


Object.assign(window, { totalSquadCapacity, totalRosterCapacity, roundRobinDistribute, gameClockNow, formatGameClock, mortarTooCloseToFire, mortarNotReadyToFire, setGameSpeedByIndex, unitMayFire, deltaTurns, updateTurnBoundary, currentTurnFloor, turnJustCrossed, isSuppressed, maintainFriendlySpacing, smoothVisualPos, buildEnemyInfantryGroups, effectMultiplier, bestMortarLoadoutFor, applyBestMortarLoadout, makeSoldiers, vetLevelOf, unitAvgVetLevel, unitAliveCount, makeFreshRoster, addNewSquad, addNewScout, unitAlive, initGame, rollMapSeedCandidates, startSetup, buildHeliTarget, buildEnemyHqTarget, deployBoxSize, startStage, buildPlacementQueue, currentPlacementUnit, handlePlacementClick, skipRemainingPlacement, finishPlacement, makeDecoy, randomDecoySpot, applyDecoyPlacementMode, placeDecoyAt, finishDecoyPlacement, retryStage, deployStage, estimatedTargetPos, estPos, computeDispersionAt, estPosFromMortar, hasLineOfSight, lastStandActive, isTargetDetected, clearHqDest, clearTankDest, clearSamDest, setEngineerOrder, armEngineerMoveOrder, clearEngineerDest, armWallBuildOrder, buildWallAt, armTrenchBuildOrder, buildTrenchAt, clearSquadDest, armScoutMoveOrder, clearScoutOrder, revealTarget, updateHqDetection, findHqDefenseThreat, resolveOneScoutDecision, resolveScoutDecision, resolveFriendlyHeliTurn, allScoutsWiped, allSnipersWiped, allMortarsWiped, setMortarOrder, armMortarTargetOrder, resolveOneMortarDecision, resolveMortarDecision, enemyCounterAttack, totalAliveSoldiers, allSquadsWiped, applyStandingOrder, applyHqMovement, resolveHqMovement, applySquadMovement, applyEngineerMovement, allEngineersWiped, resolveEngineerOrders, resolveSquadOrders, applyTankMovement, allTanksWiped, applySamMovement, allSamsWiped, resolveSamOrders, resolveTankOrders, applySniperMovement, sniperEngageTarget, findTargetOnSniperLine, findAutoSniperTarget, callInMortarHeatStrike, resolveSniperOrders, setSquadOrder, setTankOrder, setSamOrder, setSniperOrder, setStandingOrder, resolveSmartUnitIdxs, randomMoveOffsetCanvasUnits, directedMoveOffsetCanvasUnits, applySmartMortarScatter, applySmartOrder, armSniperMoveOrder, clearSniperDest, armSniperTargetOrder, clearSniperTarget, armSniperAimOrder, clearSniperAim, armMortarMainlineOrder, clearMortarMainline, reinforceUnitLabel, requestReinforcement, restUnitRef, restUnitLabel, startRest, tickUnitRest, buildHqCover, repairHq, friendlyFireCandidateLabel, checkFriendlyFireAt, getUnitExposure, rollExposureHit, getTargetExposure, nearestFriendlyAsset, applyDamageToTarget, damageFriendlyAsset, spawnInfantryDrone, spawnInfantryDroneSwarm, targetGridCellKey, rebuildTargetGrid, nearestOtherAliveTarget, mergeAdjustedGoal, maybePlaceMine, checkMineTrigger, advanceEnemyArtillery, resolveVehicleAssault, resolveHeliAssault, resolveEnemyAntiAir, resolveSquadAntiDrone, resolveSquadAntiVehicle, resolveDroneSwarm, resolveEnemyEvasion, advanceEnemyInfantry, resolveMortarCounterBattery, resolveEnemyTurn, launchMortarVolley, isAutoCommitRunning, startRealtimeLoop, toggleAutoCommit, setGameSpeed, renderThrottledForStep, simulationStep, finalizeVolley, checkEnd, triggerWaveClearSequence, computeReward, applyWaveResupply, awardVeteranXp, handleStageClear, assignSquadHunt, clearSquadHunt, assignTankHunt, clearTankHunt, repairTank, assignSamHunt, clearSamHunt, repairSam, assignMortarFire, updateFireConfig, advanceSimulation });
