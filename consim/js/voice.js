// Split out of the former monolithic mortar_fdc_game.js.
import { state, unitAlive } from './combat.js';
import { CALLOUT_DURATION_MS, CALLOUT_OCCURRENCE_CHANCE, COMBAT_CALLOUTS, RANK_ABBR } from './constants.js';
import { project } from './three.js';

export let activeCallouts = [];

export function calloutUnitRef(kind, idx){
  if(kind==='mortar') return state.mortars[idx];
  if(kind==='scout') return state.scouts[idx];
  if(kind==='squad') return state.squads[idx];
  if(kind==='sniper') return state.snipers[idx];
  return null;
}

export function calloutSpeakerName(kind, idx){
  const u = calloutUnitRef(kind, idx);
  if(!u) return null;
  const person = kind==='mortar'
    ? ((u.hp>0 && u.crew && u.crew[0]) ? u.crew[0] : null)
    : (u.soldiers && u.soldiers.find(s=>s.alive));
  if(!person) return null;
  const abbr = RANK_ABBR[person.rank] || person.rank;
  return `${person.name}${abbr}`;
}

export function unitSpeak(kind, idx, category){
  if(Math.random() >= CALLOUT_OCCURRENCE_CHANCE) return;
  const list = COMBAT_CALLOUTS[category];
  if(!list || !list.length) return;
  const name = calloutSpeakerName(kind, idx);
  if(!name) return;
  const text = list[Math.floor(Math.random()*list.length)];
  activeCallouts = activeCallouts.filter(c=>!(c.kind===kind && c.idx===idx));
  activeCallouts.push({kind, idx, name, text, expiresAt: performance.now()+CALLOUT_DURATION_MS});
}

export function randomAliveUnitRef(){
  const pool = [];
  state.mortars.forEach((m,i)=>{ if(m.hp>0) pool.push({kind:'mortar', idx:i}); });
  state.scouts.forEach((s,i)=>{ if(unitAlive(s)) pool.push({kind:'scout', idx:i}); });
  state.squads.forEach((sq,i)=>{ if(sq.soldiers.some(s=>s.alive)) pool.push({kind:'squad', idx:i}); });
  state.snipers.forEach((sn,i)=>{ if(sn.soldiers.some(s=>s.alive)) pool.push({kind:'sniper', idx:i}); });
  if(!pool.length) return null;
  return pool[Math.floor(Math.random()*pool.length)];
}

export function speakRandomAliveUnit(category){
  const ref = randomAliveUnitRef();
  if(ref) unitSpeak(ref.kind, ref.idx, category);
}

export function unitSpeakOrder(kind, idx){
  unitSpeak(kind, idx, Math.random()<0.2 ? 'defyOrder' : 'order');
}

export function unitSpeakInjury(kind, idx){
  unitSpeak(kind, idx, Math.random()<0.3 ? 'blame' : 'injury');
}

export function speakCoordination(){
  speakRandomAliveUnit(Math.random()<0.25 ? 'irritation' : 'coordination');
}

export function drawCallouts(ctx){
  const now = performance.now();
  activeCallouts = activeCallouts.filter(c=>c.expiresAt>now);
  activeCallouts.forEach(c=>{
    const unit = calloutUnitRef(c.kind, c.idx);
    if(!unit) return;
    const ux = unit._visX!==undefined ? unit._visX : unit.x;
    const uy = unit._visY!==undefined ? unit._visY : unit.y;
    const p = project(ux, uy);
    if(!p.visible) return;
    const label = `${c.name}: ${c.text}`;
    ctx.font = '700 12px "Noto Sans JP", sans-serif';
    const textW = ctx.measureText(label).width;
    const boxW = textW+16, boxH = 22;
    const bx = p.x - boxW/2, by = p.y - 44 - boxH;
    ctx.fillStyle = 'rgba(20,24,15,0.92)';
    ctx.strokeStyle = 'rgba(217,164,65,0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(bx, by, boxW, boxH);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x-6, by+boxH);
    ctx.lineTo(p.x+6, by+boxH);
    ctx.lineTo(p.x, by+boxH+8);
    ctx.closePath();
    ctx.fillStyle = 'rgba(20,24,15,0.92)';
    ctx.fill();
    ctx.fillStyle = '#e8e3ce';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, p.x, by+boxH/2+1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  });
}


Object.assign(window, { calloutUnitRef, calloutSpeakerName, unitSpeak, randomAliveUnitRef, speakRandomAliveUnit, unitSpeakOrder, unitSpeakInjury, speakCoordination, drawCallouts });
