// Split out of the former monolithic mortar_fdc_game.js.
import { state, turnJustCrossed, unitAlive } from './combat.js';
import { CANVAS_H, CANVAS_W, CONTOUR_CELL, CONTOUR_LEVELS, CONTOUR_LINES_CANVAS, DRONE_INTRO_STAGE, ENEMY_SPAWN_MAX_X, ENEMY_SPAWN_MIN_X, FEBA_MAX_X, FEBA_MIN_X, FRIENDLY_MARK_COLOR, GRID_LINE_SEGMENT, GRID_MAJOR_EVERY, GRID_MINOR_SPACING_UNITS, OFF_ROAD_SPEED_MULT, REAL_ROADS_CANVAS, RIVER_VALLEY_DEPTH, ROAD_NODE_SNAP_RADIUS_UNITS, ROAD_PULL_RADIUS, SCOUT_TERRAIN_MIN_SPEED_MULT, SCOUT_TERRAIN_SPEED_PENALTY, SQUAD_ADVANCE_LIMIT_X, STEP_ANGLE_OFFSETS, TERRAIN_ARCHETYPES, TERRAIN_COVER_RANGE, TERRAIN_COVER_RELIEF_SATURATION, TERRAIN_COVER_SAMPLE_COUNT, TERRAIN_COVER_SAMPLE_RADIUS, TERRAIN_SLOPE_PENALTY, TERRAIN_TYPE_COVER_BONUS, TERRAIN_TYPE_FOREST, TERRAIN_TYPE_OPEN, TERRAIN_TYPE_SPEED_MULT, TERRAIN_TYPE_WATER, TRENCH_COVER_BONUS, TRENCH_RADIUS, WALL_AVOID_PENALTY, WALL_RADIUS } from './constants.js';
import { log } from './ui.js';
import { choice, clamp, distanceToSegment, mulberry32, rnd, rngRange, rngRangeArr } from './utils.js';
import { spawnDestructionEffect } from './vfx.js';

export function pickTerrainForStage(stage){
  if(stage===1 && state.pendingTerrainGen){
    const gen = state.pendingTerrainGen;
    state.pendingTerrainGen = null;
    return gen;
  }
  const seed = Math.floor(Math.random()*0xFFFFFFFF);
  return generateProceduralTerrain(seed, pickArchetypeForStage(stage, Math.random));
}

export function pickTypesForCount(count, stage){
  // infantry is generated separately now (see buildEnemyInfantryGroups) as several
  // formation groups rather than one slot in this mixed pool
  // per user request: enemy anti-air, hunting the friendly heli (see resolveEnemyAntiAir())
  const base = ['vehicle','artillery','aa'];
  if(stage>=DRONE_INTRO_STAGE) base.push('drone');
  for(let i=base.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [base[i],base[j]] = [base[j],base[i]];
  }
  const types = base.slice(0, Math.min(count,base.length));
  while(types.length < count) types.push(choice(base));
  return types;
}

export function generateSpots(n){
  const spots = [];
  let attempts = 0;
  while(spots.length < n && attempts < 500){
    attempts++;
    const p = {x: rnd(ENEMY_SPAWN_MIN_X, ENEMY_SPAWN_MAX_X), y: rnd(60, CANVAS_H-60)};
    const tooClose = spots.some(s => Math.hypot(s.x-p.x, s.y-p.y) < 110);
    if(!tooClose) spots.push(p);
  }
  while(spots.length < n) spots.push({x: rnd(ENEMY_SPAWN_MIN_X, ENEMY_SPAWN_MAX_X), y: rnd(60, CANVAS_H-60)});
  return spots;
}

export let ROAD_GRAPH = null;

export function nearestPointOnRoad(road, px, py){
  let best=null, bestD=Infinity, bestIdx=0;
  for(let i=0;i<road.length-1;i++){
    const a=road[i], b=road[i+1];
    const dx=b.x-a.x, dy=b.y-a.y;
    const len2 = dx*dx+dy*dy || 1;
    let t = ((px-a.x)*dx+(py-a.y)*dy)/len2;
    t = clamp(t,0,1);
    const x=a.x+dx*t, y=a.y+dy*t;
    const d = Math.hypot(px-x, py-y);
    if(d<bestD){ bestD=d; best={x,y}; bestIdx=i; }
  }
  return {point:best, dist:bestD, segIdx:bestIdx};
}

export function nearestRoadPoint(px,py){
  let best=null;
  (state.roads||[]).forEach(road=>{
    const r = nearestPointOnRoad(road, px, py);
    if(r.point && (!best || r.dist<best.dist)) best = {...r, road};
  });
  return best;
}

export function nearestWallHit(fromX, fromY, toX, toY){
  if(!state || !state.walls || !state.walls.length) return null;
  const dx = toX-fromX, dy = toY-fromY;
  const a = dx*dx+dy*dy;
  let best = null, bestT = Infinity;
  state.walls.forEach(w=>{
    if(w.hp<=0) return;
    const fx = fromX-w.x, fy = fromY-w.y;
    if(a < 0.0001){
      if(Math.hypot(fx,fy) <= WALL_RADIUS && 0 < bestT){ bestT = 0; best = w; }
      return;
    }
    const b = 2*(fx*dx+fy*dy);
    const c = fx*fx+fy*fy-WALL_RADIUS*WALL_RADIUS;
    const disc = b*b-4*a*c;
    if(disc<0) return;
    const sq = Math.sqrt(disc);
    const t1 = (-b-sq)/(2*a), t2 = (-b+sq)/(2*a);
    let tHit = null;
    if(t1>=0 && t1<=1) tHit = t1;
    else if(t2>=0 && t2<=1) tHit = Math.max(0,t2);
    else if(t1<0 && t2>0) tHit = 0; // already inside the wall's radius
    if(tHit!==null && tHit<bestT){ bestT = tHit; best = w; }
  });
  return best ? {wall:best, t:bestT} : null;
}

export function applyWallBlock(fromX, fromY, toX, toY){
  const hit = nearestWallHit(fromX, fromY, toX, toY);
  if(!hit) return {x:toX, y:toY};
  const stopT = Math.max(0, hit.t-0.05);
  return { x: fromX+(toX-fromX)*stopT, y: fromY+(toY-fromY)*stopT };
}

export function wallBlockingLineOfFire(fromX, fromY, toX, toY){
  const hit = nearestWallHit(fromX, fromY, toX, toY);
  return hit ? hit.wall : null;
}

export function damageWall(wall, dmg, sourceLabel){
  if(!wall || wall.hp<=0 || dmg<=0) return;
  wall.hp = Math.max(0, wall.hp-dmg);
  log('sys','被弾', `${sourceLabel}が防壁に着弾、これを阻止(壁 残りHP ${wall.hp}/${wall.maxHp})。`);
  if(wall.hp<=0){
    log('sys','工兵', `防壁が破壊された。`);
    spawnDestructionEffect(wall.x, wall.y, '防壁 破壊', FRIENDLY_MARK_COLOR);
  }
}

export function terrainAwareStep(fromX, fromY, targetX, targetY, stepLen, ignoreWalls){
  const straightDx = targetX-fromX, straightDy = targetY-fromY;
  const straightDist = Math.hypot(straightDx,straightDy) || 1;
  if(straightDist < 0.01) return {x:fromX, y:fromY};

  const near = nearestRoadPoint(fromX, fromY);
  const onRoad = near && near.dist < ROAD_PULL_RADIUS;
  // per user request: forest/water (see terrainTypeAt/generateProceduralTerrain) slow off-road movement
  // further still -- a road already represents a cleared path, so it's exempt.
  const terrainTypeMult = onRoad ? 1 : (TERRAIN_TYPE_SPEED_MULT[terrainTypeAt(fromX, fromY)] || 1);
  const effStepLen = Math.min(stepLen * (onRoad ? 1 : OFF_ROAD_SPEED_MULT) * terrainTypeMult, straightDist);
  if(straightDist <= effStepLen){
    return ignoreWalls ? {x: targetX, y: targetY} : applyWallBlock(fromX, fromY, targetX, targetY);
  }

  const baseAngle = Math.atan2(straightDy, straightDx);
  const fromElev = elevationAt(fromX, fromY);
  let best = null, bestScore = -Infinity;
  STEP_ANGLE_OFFSETS.forEach(offset=>{
    const angle = baseAngle + offset;
    const nx = fromX + Math.cos(angle)*effStepLen;
    const ny = fromY + Math.sin(angle)*effStepLen;
    const elevChange = Math.abs(elevationAt(nx,ny) - fromElev);
    const progressFrac = Math.cos(offset);
    let score = progressFrac - elevChange*TERRAIN_SLOPE_PENALTY;
    // per user request: a unit walking straight into a wall used to just stop dead at its
    // edge every tick (STEP_ANGLE_OFFSETS' fan of candidate headings was scored purely on
    // progress/terrain, oblivious to walls, so the wall-blocked heading usually still "won").
    // Heavily penalizing a wall-blocked candidate here -- rather than only clamping the
    // final chosen step in applyWallBlock -- lets an unblocked heading within the fan win
    // instead, so units steer around a wall when there's room to (±45°), and only get stuck
    // at its edge when truly boxed in (every candidate blocked).
    if(!ignoreWalls && nearestWallHit(fromX, fromY, nx, ny)) score -= WALL_AVOID_PENALTY;
    if(score > bestScore){ bestScore = score; best = {x:nx, y:ny}; }
  });
  return ignoreWalls ? best : applyWallBlock(fromX, fromY, best.x, best.y);
}

export function airborneStep(fromX, fromY, targetX, targetY, stepLen){
  const dx = targetX-fromX, dy = targetY-fromY;
  const dist = Math.hypot(dx,dy) || 1;
  if(dist <= stepLen) return {x: targetX, y: targetY};
  return {x: fromX + (dx/dist)*stepLen, y: fromY + (dy/dist)*stepLen};
}

export function scoutTerrainAwareStep(fromX, fromY, targetX, targetY, stepLen){
  const next = terrainAwareStep(fromX, fromY, targetX, targetY, stepLen);
  const elevChange = Math.abs(elevationAt(next.x, next.y) - elevationAt(fromX, fromY));
  const mult = clamp(1 - elevChange*SCOUT_TERRAIN_SPEED_PENALTY, SCOUT_TERRAIN_MIN_SPEED_MULT, 1);
  if(mult >= 0.999) return next;
  return { x: fromX + (next.x-fromX)*mult, y: fromY + (next.y-fromY)*mult };
}

export function elevationAtFor(gen, x, y){
  if(!gen) return 0;
  let e = 0;
  for(let i=0;i<gen.hills.length;i++){
    const hill = gen.hills[i];
    const d = Math.hypot(x-hill.x, y-hill.y);
    const t = clamp(1-d/hill.r, 0, 1);
    e += hill.h * t*t*(3-2*t);
  }
  if(gen.river){
    const rx = riverXAt(gen.river, y);
    const dx = Math.abs(x-rx);
    const t = clamp(1-dx/(gen.river.width*1.5), 0, 1);
    e -= RIVER_VALLEY_DEPTH * t*t*(3-2*t);
  }
  return clamp(e, 0, 1.3);
}

export function elevationAt(x,y){
  return elevationAtFor(state && state.terrainGen, x, y);
}

export function elevationLabel(e){
  if(e < 0.25) return '低地';
  if(e < 0.6) return '丘陵';
  return '高地';
}

export function altitudeBonus(attackerX, attackerY, defenderX, defenderY){
  const diff = elevationAt(attackerX, attackerY) - elevationAt(defenderX, defenderY);
  return clamp(1 + diff*0.35, 0.75, 1.4);
}

export function terrainCoverBonus(x, y){
  if(!state || !state.terrainGen) return 0;
  const here = elevationAt(x, y);
  let sum = 0;
  for(let i=0;i<TERRAIN_COVER_SAMPLE_COUNT;i++){
    const ang = (i/TERRAIN_COVER_SAMPLE_COUNT) * Math.PI*2;
    const nx = x + Math.cos(ang)*TERRAIN_COVER_SAMPLE_RADIUS;
    const ny = y + Math.sin(ang)*TERRAIN_COVER_SAMPLE_RADIUS;
    sum += elevationAt(nx, ny);
  }
  const relief = (sum/TERRAIN_COVER_SAMPLE_COUNT) - here; // >0 = local dip, <0 = local high point
  return clamp(relief/TERRAIN_COVER_RELIEF_SATURATION, -1, 1) * (TERRAIN_COVER_RANGE/2);
}

export function terrainTypeCoverBonus(x, y){
  return TERRAIN_TYPE_COVER_BONUS[terrainTypeAt(x, y)] || 0;
}

export function terrainCoverTotal(x, y){
  return terrainCoverBonus(x, y) + terrainTypeCoverBonus(x, y);
}

export function trenchCoverBonusAt(x, y){
  if(!state || !state.trenches || !state.trenches.length) return 0;
  for(const tr of state.trenches){
    if(distanceToSegment(x, y, tr.x1, tr.y1, tr.x2, tr.y2) <= TRENCH_RADIUS) return TRENCH_COVER_BONUS;
  }
  return 0;
}

export function computeFebaX(){
  const aliveSquads = state.squads.filter(sq=>unitAlive(sq));
  if(!aliveSquads.length) return clamp(SQUAD_ADVANCE_LIMIT_X, FEBA_MIN_X, FEBA_MAX_X);
  const frontX = Math.max(...aliveSquads.map(sq=>sq.x));
  return clamp(frontX, FEBA_MIN_X, FEBA_MAX_X);
}

export function buildGridLineSegments(){
  const minor = [], major = [];
  const addSegments = (bucket, fixedIsX, fixedVal, lenMax)=>{
    for(let t=0; t<lenMax; t+=GRID_LINE_SEGMENT){
      const t2 = Math.min(t+GRID_LINE_SEGMENT, lenMax);
      if(fixedIsX) bucket.push({x1:fixedVal, y1:t, x2:fixedVal, y2:t2});
      else bucket.push({x1:t, y1:fixedVal, x2:t2, y2:fixedVal});
    }
  };
  let idx = 0;
  for(let x=0; x<=CANVAS_W+0.001; x+=GRID_MINOR_SPACING_UNITS){
    addSegments((idx % GRID_MAJOR_EVERY === 0) ? major : minor, true, x, CANVAS_H);
    idx++;
  }
  idx = 0;
  for(let y=0; y<=CANVAS_H+0.001; y+=GRID_MINOR_SPACING_UNITS){
    addSegments((idx % GRID_MAJOR_EVERY === 0) ? major : minor, false, y, CANVAS_W);
    idx++;
  }
  return {minor, major};
}

export function febaLineSegments(x){
  const segs = [];
  for(let y=0; y<CANVAS_H; y+=GRID_LINE_SEGMENT){
    segs.push({x1:x, y1:y, x2:x, y2:Math.min(y+GRID_LINE_SEGMENT, CANVAS_H)});
  }
  return segs;
}

export function choppedLineSegments(x1, y1, x2, y2){
  const totalLen = Math.hypot(x2-x1, y2-y1);
  const steps = Math.max(1, Math.ceil(totalLen/GRID_LINE_SEGMENT));
  const segs = [];
  for(let i=0;i<steps;i++){
    const t0 = i/steps, t1 = (i+1)/steps;
    segs.push({x1:x1+(x2-x1)*t0, y1:y1+(y2-y1)*t0, x2:x1+(x2-x1)*t1, y2:y1+(y2-y1)*t1});
  }
  return segs;
}

export function pickArchetypeForStage(stage, rng){
  if(stage<=3) return 'hills';
  if(stage<=8) return rng()<0.5 ? 'hills' : 'forest';
  const roll = rng();
  if(roll<0.4) return 'river';
  if(roll<0.7) return 'forest';
  if(roll<0.9) return 'hills';
  return 'urban';
}

export function riverXAt(river, y){
  return river.baseX + Math.sin((y/CANVAS_H)*river.freq + river.phase)*river.amplitude;
}

export function generateProceduralTerrain(seed, archetypeKey){
  const rng = mulberry32(seed);
  const key = TERRAIN_ARCHETYPES[archetypeKey] ? archetypeKey : 'hills';
  const arch = TERRAIN_ARCHETYPES[key];

  const hills = [];
  hills.push({
    x: rngRange(rng, CANVAS_W*0.42, CANVAS_W*0.58),
    y: rngRange(rng, CANVAS_H*0.35, CANVAS_H*0.65),
    r: rngRangeArr(rng, arch.hillRadius) * 1.15,
    h: rngRangeArr(rng, arch.hillHeight) * 1.1,
  });
  const hillCount = Math.round(rngRangeArr(rng, arch.hillCount));
  for(let i=1;i<hillCount;i++){
    hills.push({
      x: rngRange(rng, 120, CANVAS_W-120),
      y: rngRange(rng, 40, CANVAS_H-40),
      r: rngRangeArr(rng, arch.hillRadius),
      h: rngRangeArr(rng, arch.hillHeight),
    });
  }

  let river = null;
  if(arch.river){
    river = {
      baseX: rngRange(rng, CANVAS_W*0.38, CANVAS_W*0.55),
      amplitude: rngRange(rng, 20, 45),
      freq: rngRange(rng, 2.5, 4),
      phase: rngRange(rng, 0, Math.PI*2),
      width: rngRange(rng, 20, 32),
      fordY: rngRange(rng, CANVAS_H*0.25, CANVAS_H*0.75),
      fordHalfHeight: 26,
    };
  }

  const forestCount = Math.round(rngRangeArr(rng, arch.forestPatches));
  const forestPatches = [];
  for(let i=0;i<forestCount;i++){
    forestPatches.push({
      x: rngRange(rng, 100, CANVAS_W-100),
      y: rngRange(rng, 30, CANVAS_H-30),
      r: rngRange(rng, 60, 130),
    });
  }

  // per user request: noticeably more irregular road angles than before -- jitter is now
  // expressed as CANVAS_W/CANVAS_H fractions (so it stays proportionally irregular regardless of
  // map size) and, unlike before, also perturbs waypoints' X position (previously locked to
  // exact fractions of CANVAS_W, which made every road's bends line up at the same few X
  // positions and read as a rigid grid). An extra bend point per main road adds more distinct
  // segment angles instead of one long gentle sweep.
  const roadY1 = CANVAS_H*0.3;
  const roadY2 = CANVAS_H*0.7;
  const roadX = [CANVAS_W*0.27, CANVAS_W*0.5, CANVAS_W*0.73];
  const endJitterY = CANVAS_H*0.012, endJitterX = CANVAS_W*0.015;
  const midJitterY = CANVAS_H*0.07, midJitterX = CANVAS_W*0.035;
  const mkMainRoad = (roadY)=> [
    {x:20, y:roadY+rngRange(rng,-endJitterY,endJitterY)},
    {x:CANVAS_W*0.2+rngRange(rng,-midJitterX,midJitterX), y:roadY+rngRange(rng,-midJitterY,midJitterY)},
    {x:CANVAS_W*0.38+rngRange(rng,-midJitterX,midJitterX), y:roadY+rngRange(rng,-midJitterY,midJitterY)},
    {x:CANVAS_W*0.5+rngRange(rng,-endJitterX,endJitterX), y:roadY+rngRange(rng,-midJitterY,midJitterY)},
    {x:CANVAS_W*0.62+rngRange(rng,-midJitterX,midJitterX), y:roadY+rngRange(rng,-midJitterY,midJitterY)},
    {x:CANVAS_W*0.8+rngRange(rng,-midJitterX,midJitterX), y:roadY+rngRange(rng,-midJitterY,midJitterY)},
    {x:CANVAS_W-20, y:roadY+rngRange(rng,-endJitterY,endJitterY)},
  ];
  const mainRoad1 = mkMainRoad(roadY1);
  const mainRoad2 = mkMainRoad(roadY2);
  const fordIdx = 3; // the CANVAS_W*0.5 waypoint above, kept as the one both roads share for the crossing
  if(river){
    const fordX = riverXAt(river, river.fordY);
    mainRoad1[fordIdx] = {x:fordX, y:river.fordY};
    mainRoad2[fordIdx] = {x:fordX, y:river.fordY};
  }
  // nearest mainRoad waypoint to a given road-x fraction, used so branch/dirt roads still hand
  // off close to where the (now-jittered) main road actually passes rather than a fixed fraction.
  const nearestWaypoint = (mainRoad, xFrac)=>{
    const targetX = CANVAS_W*xFrac;
    return mainRoad.reduce((best,p)=> Math.abs(p.x-targetX)<Math.abs(best.x-targetX) ? p : best);
  };
  const branchRoads = roadX.map((x, i)=>{
    const topY = nearestWaypoint(mainRoad1, [0.27,0.5,0.73][i]).y;
    const botY = nearestWaypoint(mainRoad2, [0.27,0.5,0.73][i]).y;
    return [
      {x:x+rngRange(rng,-endJitterX,endJitterX), y:topY},
      {x:x+rngRange(rng,-midJitterX*1.4,midJitterX*1.4), y:CANVAS_H*0.5+rngRange(rng,-midJitterY*0.9,midJitterY*0.9)},
      {x:x+rngRange(rng,-endJitterX,endJitterX), y:botY},
    ];
  });
  const dirtRoads = [
    [{x:20, y:CANVAS_H*0.9}, {x:CANVAS_W*0.18+rngRange(rng,-midJitterX,midJitterX), y:CANVAS_H*0.78+rngRange(rng,-midJitterY,midJitterY)}, {x:roadX[0], y:nearestWaypoint(mainRoad2,0.27).y}],
    [{x:CANVAS_W-20, y:CANVAS_H*0.1}, {x:CANVAS_W*0.82+rngRange(rng,-midJitterX,midJitterX), y:CANVAS_H*0.22+rngRange(rng,-midJitterY,midJitterY)}, {x:roadX[2], y:nearestWaypoint(mainRoad1,0.73).y}],
    [{x:CANVAS_W*0.5, y:CANVAS_H-20}, {x:CANVAS_W*0.54+rngRange(rng,-midJitterX,midJitterX), y:CANVAS_H*0.82+rngRange(rng,-midJitterY,midJitterY)}, {x:roadX[1], y:nearestWaypoint(mainRoad2,0.5).y}],
  ];
  const roadPaths = [mainRoad1, mainRoad2, ...branchRoads, ...dirtRoads];
  const roadKinds = ['main', 'main', 'branch', 'branch', 'branch', 'dirt', 'dirt', 'dirt'];

  // per user request (idea 1): tree/rock placements are part of the descriptor (drawn from
  // the same rng, after everything else) so they're just as deterministic/reproducible from
  // seed as the hills/forest/river -- see buildTerrainProps() for how these turn into meshes.
  const trees = [];
  forestPatches.forEach(f=>{
    const count = Math.max(3, Math.round(f.r/16));
    for(let i=0;i<count;i++){
      const ang = rng()*Math.PI*2;
      const rad = Math.sqrt(rng())*f.r*0.85;
      trees.push({ x: f.x+Math.cos(ang)*rad, y: f.y+Math.sin(ang)*rad, scale: rngRange(rng,0.8,1.3) });
    }
  });
  const ROCK_COUNT = 10;
  const rocks = [];
  for(let i=0;i<ROCK_COUNT;i++){
    let rx, ry, tries=0;
    do {
      rx = rngRange(rng, 60, CANVAS_W-60);
      ry = rngRange(rng, 30, CANVAS_H-30);
      tries++;
    } while(tries<20 && river && Math.abs(rx-riverXAt(river,ry))<(river.width/2+15) && Math.abs(ry-river.fordY)>=river.fordHalfHeight);
    rocks.push({ x:rx, y:ry, scale: rngRange(rng,0.7,1.5), rotX: rng()*Math.PI, rotY: rng()*Math.PI, rotZ: rng()*Math.PI });
  }

  return { seed, archetype: key, label: arch.label, hills, forestPatches, river, roadPaths, roadKinds, trees, rocks };
}

export function terrainTypeAtFor(gen, x, y){
  if(!gen) return TERRAIN_TYPE_OPEN;
  if(gen.river){
    const inFord = Math.abs(y-gen.river.fordY) < gen.river.fordHalfHeight;
    if(!inFord){
      const rx = riverXAt(gen.river, y);
      if(Math.abs(x-rx) < gen.river.width/2) return TERRAIN_TYPE_WATER;
    }
  }
  for(let i=0;i<gen.forestPatches.length;i++){
    const f = gen.forestPatches[i];
    if(Math.hypot(x-f.x, y-f.y) < f.r) return TERRAIN_TYPE_FOREST;
  }
  return TERRAIN_TYPE_OPEN;
}

export function terrainTypeAt(x, y){
  return terrainTypeAtFor(state && state.terrainGen, x, y);
}

export function terrainTypeLabel(type){
  if(type===TERRAIN_TYPE_FOREST) return '森林';
  if(type===TERRAIN_TYPE_WATER) return '水域';
  return '開けた土地';
}

export function buildProceduralRoads(roadPaths, roadKinds){
  REAL_ROADS_CANVAS.length = 0;
  (roadPaths||[]).forEach(poly=> REAL_ROADS_CANVAS.push(poly));
  if(state){
    state.roads = REAL_ROADS_CANVAS;
    state.roadKinds = roadKinds || [];
  }
  buildRoadGraph();
}

export function buildContourLines(){
  CONTOUR_LINES_CANVAS.length = 0;
  CONTOUR_LEVELS.forEach(level=>{
    for(let gy=0; gy<CANVAS_H; gy+=CONTOUR_CELL){
      for(let gx=0; gx<CANVAS_W; gx+=CONTOUR_CELL){
        const x0=gx, x1=Math.min(gx+CONTOUR_CELL,CANVAS_W), y0=gy, y1=Math.min(gy+CONTOUR_CELL,CANVAS_H);
        const vTL=elevationAt(x0,y0), vTR=elevationAt(x1,y0), vBR=elevationAt(x1,y1), vBL=elevationAt(x0,y1);
        const pts=[];
        if((vTL>level)!==(vTR>level)){ const t=(level-vTL)/(vTR-vTL); pts.push({x:x0+t*(x1-x0), y:y0}); }
        if((vTR>level)!==(vBR>level)){ const t=(level-vTR)/(vBR-vTR); pts.push({x:x1, y:y0+t*(y1-y0)}); }
        if((vBL>level)!==(vBR>level)){ const t=(level-vBL)/(vBR-vBL); pts.push({x:x0+t*(x1-x0), y:y1}); }
        if((vTL>level)!==(vBL>level)){ const t=(level-vTL)/(vBL-vTL); pts.push({x:x0, y:y0+t*(y1-y0)}); }
        if(pts.length===2){
          CONTOUR_LINES_CANVAS.push({x1:pts[0].x, y1:pts[0].y, x2:pts[1].x, y2:pts[1].y});
        } else if(pts.length===4){
          CONTOUR_LINES_CANVAS.push({x1:pts[0].x, y1:pts[0].y, x2:pts[1].x, y2:pts[1].y});
          CONTOUR_LINES_CANVAS.push({x1:pts[2].x, y1:pts[2].y, x2:pts[3].x, y2:pts[3].y});
        }
      }
    }
  });
}

export function buildRoadGraph(){
  const snapR = ROAD_NODE_SNAP_RADIUS_UNITS;
  const cellSize = Math.max(1, snapR);
  const buckets = new Map();
  const nodes = [];
  const adj = [];
  function bucketKeyFor(bx, by){ return bx+','+by; }
  function findOrCreateNode(x, y){
    const bx = Math.floor(x/cellSize), by = Math.floor(y/cellSize);
    for(let dx=-1; dx<=1; dx++){
      for(let dy=-1; dy<=1; dy++){
        const arr = buckets.get(bucketKeyFor(bx+dx, by+dy));
        if(!arr) continue;
        for(const idx of arr){
          if(Math.hypot(nodes[idx].x-x, nodes[idx].y-y) <= snapR) return idx;
        }
      }
    }
    const idx = nodes.length;
    nodes.push({x, y});
    adj.push([]);
    const key = bucketKeyFor(bx, by);
    if(!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(idx);
    return idx;
  }
  function addEdge(a, b, dist){
    if(a===b) return;
    if(!adj[a].some(e=>e.to===b)) adj[a].push({to:b, dist});
    if(!adj[b].some(e=>e.to===a)) adj[b].push({to:a, dist});
  }
  REAL_ROADS_CANVAS.forEach(road=>{
    let prevIdx = null, prevPt = null;
    road.forEach(pt=>{
      const idx = findOrCreateNode(pt.x, pt.y);
      if(prevIdx!==null){
        addEdge(prevIdx, idx, Math.hypot(pt.x-prevPt.x, pt.y-prevPt.y));
      }
      prevIdx = idx; prevPt = pt;
    });
  });
  ROAD_GRAPH = {nodes, adj};
}

export function nearestRoadNodeIdx(x, y){
  if(!ROAD_GRAPH || !ROAD_GRAPH.nodes.length) return -1;
  let best=-1, bd=Infinity;
  ROAD_GRAPH.nodes.forEach((n,i)=>{
    const d = Math.hypot(n.x-x, n.y-y);
    if(d<bd){ bd=d; best=i; }
  });
  return best;
}

export function getCachedRoadPath(unit, fromX, fromY, goalX, goalY){
  const goalMoved = unit._roadPathGoalX===undefined
    || Math.hypot(goalX-unit._roadPathGoalX, goalY-unit._roadPathGoalY) > 20;
  if(goalMoved || turnJustCrossed() || unit._roadPathRaw===undefined){
    unit._roadPathRaw = findRoadPath(fromX, fromY, goalX, goalY);
    unit._roadPathGoalX = goalX;
    unit._roadPathGoalY = goalY;
  }
  return unit._roadPathRaw;
}

export function findRoadPath(fromX, fromY, toX, toY){
  if(!ROAD_GRAPH || !ROAD_GRAPH.nodes.length) return null;
  const startIdx = nearestRoadNodeIdx(fromX, fromY);
  const goalIdx = nearestRoadNodeIdx(toX, toY);
  if(startIdx<0 || goalIdx<0) return null;
  const nodes = ROAD_GRAPH.nodes, adj = ROAD_GRAPH.adj;
  if(startIdx===goalIdx) return [nodes[startIdx]];
  const goalNode = nodes[goalIdx];
  const gScore = new Map([[startIdx, 0]]);
  const fScore = new Map([[startIdx, Math.hypot(nodes[startIdx].x-goalNode.x, nodes[startIdx].y-goalNode.y)]]);
  const cameFrom = new Map();
  const open = new Set([startIdx]);
  const closed = new Set();
  while(open.size){
    let cur=-1, bestF=Infinity;
    open.forEach(idx=>{
      const f = fScore.has(idx) ? fScore.get(idx) : Infinity;
      if(f<bestF){ bestF=f; cur=idx; }
    });
    if(cur===goalIdx){
      const path = [nodes[cur]];
      let c = cur;
      while(cameFrom.has(c)){ c = cameFrom.get(c); path.unshift(nodes[c]); }
      return path;
    }
    open.delete(cur);
    closed.add(cur);
    (adj[cur]||[]).forEach(e=>{
      if(closed.has(e.to)) return;
      const tentG = (gScore.has(cur)?gScore.get(cur):Infinity) + e.dist;
      if(tentG < (gScore.has(e.to)?gScore.get(e.to):Infinity)){
        cameFrom.set(e.to, cur);
        gScore.set(e.to, tentG);
        fScore.set(e.to, tentG + Math.hypot(nodes[e.to].x-goalNode.x, nodes[e.to].y-goalNode.y));
        open.add(e.to);
      }
    });
  }
  return null;
}

export function advanceAlongPath(fromX, fromY, path, stepLen){
  let remaining = stepLen;
  let curX = fromX, curY = fromY;
  for(let i=0; i<path.length && remaining>0; i++){
    const wp = path[i];
    const segDist = Math.hypot(wp.x-curX, wp.y-curY);
    if(segDist <= remaining){
      curX = wp.x; curY = wp.y;
      remaining -= segDist;
    } else {
      const t = segDist>0 ? remaining/segDist : 0;
      curX = curX + (wp.x-curX)*t;
      curY = curY + (wp.y-curY)*t;
      remaining = 0;
    }
  }
  return {x:curX, y:curY};
}


Object.assign(window, { pickTerrainForStage, pickTypesForCount, generateSpots, nearestPointOnRoad, nearestRoadPoint, nearestWallHit, applyWallBlock, wallBlockingLineOfFire, damageWall, terrainAwareStep, airborneStep, scoutTerrainAwareStep, elevationAtFor, elevationAt, elevationLabel, altitudeBonus, terrainCoverBonus, terrainTypeCoverBonus, terrainCoverTotal, trenchCoverBonusAt, computeFebaX, buildGridLineSegments, febaLineSegments, choppedLineSegments, pickArchetypeForStage, riverXAt, generateProceduralTerrain, terrainTypeAtFor, terrainTypeAt, terrainTypeLabel, buildProceduralRoads, buildContourLines, buildRoadGraph, nearestRoadNodeIdx, getCachedRoadPath, findRoadPath, advanceAlongPath });
