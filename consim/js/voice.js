// Split out of the former monolithic mortar_fdc_game.js.
import { state, unitAlive } from './combat.js';
import { CALLOUT_DURATION_MS, CALLOUT_OCCURRENCE_CHANCE, COMBAT_CALLOUTS, RANK_ABBR } from './constants.js';
import { project } from './three.js';

export let activeCallouts = [];

export function calloutUnitRef(kind, idx){
  if(kind==='mortar') return state.mortars[idx];
  if(kind==='scout') return state.scouts[idx];
  if(kind==='squad') return state.squads[idx];
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
  const now = performance.now();
  // per user request(同じ位置に吹き出しが延々と次々に出続けるバグの修正): 迫撃砲の自動照準
  // (MORTAR_RELOAD_MS=650msごとに再発射しうる)のように短い間隔で繰り返し発生するイベントが
  // unitSpeakを高頻度で呼ぶと、表示中の吹き出し(CALLOUT_DURATION_MS=4000ms)が消える前に
  // 次の発言へ差し替わり続け、見た目上そのユニットの位置に吹き出しが途切れず残り続けて
  // しまっていた。同一ユニットの吹き出しがまだ表示中なら、自然に消えるまで新規発言を控える。
  if(activeCallouts.some(c=>c.kind===kind && c.idx===idx && c.expiresAt>now)) return;
  const text = list[Math.floor(Math.random()*list.length)];
  activeCallouts = activeCallouts.filter(c=>!(c.kind===kind && c.idx===idx));
  activeCallouts.push({kind, idx, name, text, expiresAt: now+CALLOUT_DURATION_MS});
}

export function randomAliveUnitRef(){
  const pool = [];
  state.mortars.forEach((m,i)=>{ if(m.hp>0) pool.push({kind:'mortar', idx:i}); });
  state.scouts.forEach((s,i)=>{ if(unitAlive(s)) pool.push({kind:'scout', idx:i}); });
  state.squads.forEach((sq,i)=>{ if(sq.soldiers.some(s=>s.alive)) pool.push({kind:'squad', idx:i}); });
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

// per user request(ドラクエファン向け追加要素): 台詞の吹き出しを、DQシリーズの
// メッセージウィンドウ(濃紺の背景+白枠の二重罫線+右下に点滅する「▼」の待機カーソル)
// 風のデザインに変更。ふきだしの三角ポインタは廃止し、DQの固定ウィンドウらしい矩形のみに。
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

    ctx.save();
    ctx.font = '700 12px "Noto Sans JP", sans-serif';
    const nameW = ctx.measureText(c.name).width;
    ctx.font = '400 12px "Noto Sans JP", sans-serif';
    const textW = ctx.measureText(c.text).width;
    const boxW = Math.max(96, nameW+6+textW+26), boxH = 30;
    const bx = p.x - boxW/2, by = p.y - 46 - boxH;

    // outer frame (light border, classic DQ window edge) then the dark navy interior.
    ctx.fillStyle = '#e6ebf6';
    ctx.fillRect(bx-3, by-3, boxW+6, boxH+6);
    ctx.fillStyle = 'rgba(16,22,56,0.96)';
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeStyle = '#2a3a70';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx+2.5, by+2.5, boxW-5, boxH-5);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f0bd55';
    ctx.font = '700 12px "Noto Sans JP", sans-serif';
    ctx.fillText(c.name, bx+10, by+boxH/2);
    ctx.fillStyle = '#f4f2ea';
    ctx.font = '400 12px "Noto Sans JP", sans-serif';
    ctx.fillText(c.text, bx+10+nameW+6, by+boxH/2);

    // blinking "▼" wait-for-input cursor in the bottom-right corner, DQ-style.
    ctx.globalAlpha = 0.45 + 0.55*Math.sin(now/220);
    ctx.fillStyle = '#f4f2ea';
    ctx.font = '700 11px "Noto Sans JP", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('▼', bx+boxW-6, by+boxH-7);
    ctx.restore();
  });
}


Object.assign(window, { calloutUnitRef, calloutSpeakerName, unitSpeak, randomAliveUnitRef, speakRandomAliveUnit, unitSpeakOrder, unitSpeakInjury, speakCoordination, drawCallouts });
