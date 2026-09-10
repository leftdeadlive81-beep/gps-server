// Split out of the former monolithic mortar_fdc_game.js.
import { EXPOSURE_DEFAULT, METERS_PER_UNIT, SIM_STEP_MS } from './constants.js';

export function hitChanceFromExposure(exposure){
  const e = clamp(exposure===undefined?EXPOSURE_DEFAULT:exposure, 1, 100);
  return clamp(80-e, 0, 100)/100;
}

export function exposureNormalizedMult(exposure){
  return hitChanceFromExposure(exposure) / hitChanceFromExposure(EXPOSURE_DEFAULT);
}

export function kmhToUnitsPerTurn(kmh){ return (kmh*1000/60) / METERS_PER_UNIT; }

export function visualTweenDurationMs(){
  // Now a small constant tied to the fixed sim step (rather than the old whole-turn interval)
  // -- see SIM_STEP_MS above. Motion still finishes just ahead of the next step at any speed.
  return Math.round(SIM_STEP_MS*1.15);
}

export function smoothstep01(t){ return t*t*(3-2*t); }

export function unitsToMeters(u){ return Math.round(u*METERS_PER_UNIT); }

export function rnd(a,b){ return a + Math.random()*(b-a); }

export function choice(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

export function gauss(){
  let u=1-Math.random(), v=Math.random();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
}

export function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }

export function wanderPos(homeX, homeY, seed, radius, now){
  const a1 = now*0.0011 + seed*7.13;
  const a2 = now*0.0007 + seed*3.31;
  return {
    x: homeX + Math.sin(a1)*radius*0.6 + Math.sin(a2*1.7)*radius*0.4,
    y: homeY + Math.cos(a1*1.3)*radius*0.6 + Math.cos(a2)*radius*0.4,
  };
}

export function bearingBetween(fromX, fromY, toX, toY){
  const dx = toX-fromX, dy = toY-fromY;
  return (Math.atan2(dx,-dy)*180/Math.PI+360)%360;
}

export function angleDiff(a,b){
  let d = Math.abs(a-b)%360;
  if(d>180) d = 360-d;
  return d;
}

export function bearingToXY(bearingDeg, dist, originX, originY){
  const rad = bearingDeg*Math.PI/180;
  return { x: originX + dist*Math.sin(rad), y: originY - dist*Math.cos(rad) };
}

export function distanceToSegment(px, py, x1, y1, x2, y2){
  const dx = x2-x1, dy = y2-y1;
  const lenSq = dx*dx+dy*dy;
  if(lenSq < 1e-6) return Math.hypot(px-x1, py-y1);
  const t = clamp(((px-x1)*dx + (py-y1)*dy) / lenSq, 0, 1);
  return Math.hypot(px-(x1+dx*t), py-(y1+dy*t));
}

export function hash2(x, y, seed){
  let h = Math.imul(x|0, 374761393) ^ Math.imul(y|0, 668265263) ^ Math.imul(seed|0, 2246822519);
  h = Math.imul(h ^ (h>>>15), 2246822519);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489917);
  h ^= h >>> 16;
  return (h>>>0) / 4294967296;
}

export function valueNoise2D(x, y, seed){
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const tx = smoothstep01(x-x0), ty = smoothstep01(y-y0);
  const n00 = hash2(x0,   y0,   seed), n10 = hash2(x0+1, y0,   seed);
  const n01 = hash2(x0,   y0+1, seed), n11 = hash2(x0+1, y0+1, seed);
  const a = n00 + (n10-n00)*tx;
  const b = n01 + (n11-n01)*tx;
  return a + (b-a)*ty; // 0..1
}

export function mulberry32(seed){
  let a = seed>>>0;
  return function(){
    a |= 0; a = (a+0x6D2B79F5)|0;
    let t = Math.imul(a ^ (a>>>15), 1|a);
    t = (t + Math.imul(t ^ (t>>>7), 61|t)) ^ t;
    return ((t ^ (t>>>14))>>>0) / 4294967296;
  };
}

export function rngRange(rng, lo, hi){ return lo + (hi-lo)*rng(); }

export function rngRangeArr(rng, [lo,hi]){ return lo + (hi-lo)*rng(); }


Object.assign(window, { hitChanceFromExposure, exposureNormalizedMult, kmhToUnitsPerTurn, visualTweenDurationMs, smoothstep01, unitsToMeters, rnd, choice, gauss, clamp, wanderPos, bearingBetween, angleDiff, bearingToXY, distanceToSegment, hash2, valueNoise2D, mulberry32, rngRange, rngRangeArr });
