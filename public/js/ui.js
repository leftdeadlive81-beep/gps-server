// Split out of the former monolithic mortar_fdc_game.js.
import { unlockAchievement, unlockedAchievements } from './achievements.js';
import { addNewScout, addNewSquad, applySmartMortarScatter, applySmartOrder, deployStage, estPos, estPosFromMortar, formatGameClock, gameClockNow, getUnitExposure, handleStageClear, isAutoCommitRunning, isTargetDetected, mapSeedCandidates, scoutHalfFov, state, totalAliveSoldiers, totalRosterCapacity, unitAlive, unitAliveCount, vetLevelOf } from './combat.js';
import { ACHIEVEMENTS, AMMO_PACK, DECOY_MODES, DEPLOYMENT_MODES, DIFFICULTIES, EQUIP_LABEL, GAME_SPEED_LABEL, GAME_SPEED_ORDER, GEMINI_API_KEY_STORAGE, GEMINI_MODEL, HQ_COVER_EXPOSURE_BONUS, HQ_COVER_EXPOSURE_CAP, HQ_REPAIR_COST_PER_HP, HQ_REPAIR_HP_PER_CALL, ILLUM_RADIUS_M, LOG_MAX_ENTRIES, MAP_SEED_THUMB_H, MAP_SEED_THUMB_W, MAX_DECOYS, MAX_TRENCHES, MAX_WALLS, MORTAR_CB_SHOTS_THRESHOLD, MORTAR_CREW_SIZE, MORTAR_MAINLINE_RANGE_M, MORTAR_ORDER_ICON, MORTAR_ORDER_LABEL, ORDER_ICON, ORDER_LABEL, PRICE_EQUIP, PRICE_FUZE, PRICE_HE, PRICE_HEAT, REINFORCE_COST_PER_SOLDIER, REINFORCE_MAX_PER_CALL, RESERVE_SIZE, REST_DURATION_TURNS, SAM_REPAIR_COST_PER_HP, SAM_REPAIR_HP_PER_CALL, SCOUT_SQUAD_SIZE, SMART_ACTIONS, SMART_UNIT_TYPES, SNIPER_AIM_RANGE_M, SNIPER_RANGE_M, SQUAD_SIZE, STAGE_COUNT, STANDING_ORDER_LABEL, TANK_REPAIR_COST_PER_HP, TANK_REPAIR_HP_PER_CALL, TARGET_TYPES, TRENCH_BUILD_COST, WALL_BUILD_COST, WEATHER_TYPES } from './constants.js';
import { canvasToScreen, multiSelectCommonOrders, multiSelectMode, multiSelected, pruneMultiSelected } from './input.js';
import { render } from './main.js';
import { elevationAt, elevationLabel, terrainTypeAt, terrainTypeLabel } from './terrain.js';
import { paintTerrainColors } from './three.js';
import { bearingBetween, clamp, hitChanceFromExposure, precisionDots, rnd, unitsToMeters } from './utils.js';
import { speakRandomAliveUnit } from './voice.js';

export function renderMapSelectOverlay(){
  renderMapSelectBody();
  renderDeploymentSelectBody();
  renderDecoySelectBody();
}

export function renderMapSelectBody(){
  const body = document.getElementById('map-select-body');
  body.innerHTML = mapSeedCandidates.map((gen, idx)=>{
    const selected = state.selectedSeedIndex===idx;
    return `
      <div class="shop-row seed-candidate-row ${selected?'selected':''}">
        <canvas class="seed-thumb" id="seed-thumb-${idx}" width="${MAP_SEED_THUMB_W}" height="${MAP_SEED_THUMB_H}"></canvas>
        <div style="flex:1;">
          <div class="label">候補${idx+1}: ${gen.label}</div>
          <div class="sub">シード #${gen.seed}${gen.river?' ・ 渡河点あり':''}</div>
        </div>
        <div class="actions"><button class="btn primary" onclick="selectMapSeed(${idx})">${selected?'選択中':'選択'}</button></div>
      </div>
    `;
  }).join('');
  mapSeedCandidates.forEach((gen, idx)=>{
    const canvas = document.getElementById('seed-thumb-'+idx);
    if(canvas) paintTerrainColors(canvas.getContext('2d'), MAP_SEED_THUMB_W, MAP_SEED_THUMB_H, gen);
  });
}

export function selectMapSeed(idx){
  if(!mapSeedCandidates[idx]) return;
  state.selectedSeedIndex = idx;
  renderMapSelectBody();
}

export function renderDeploymentSelectBody(){
  const body = document.getElementById('deployment-select-body');
  body.innerHTML = Object.keys(DEPLOYMENT_MODES).map(key=>{
    const d = DEPLOYMENT_MODES[key];
    const selected = state.deploymentMode===key;
    return `
      <div class="shop-row ${selected?'selected':''}">
        <div>
          <div class="label">${d.label}</div>
          <div class="sub">${d.sub}</div>
        </div>
        <div class="actions"><button class="btn primary" onclick="selectDeploymentMode('${key}')">${selected?'選択中':'選択'}</button></div>
      </div>
    `;
  }).join('');
}

export function selectDeploymentMode(key){
  if(!DEPLOYMENT_MODES[key]) return;
  state.deploymentMode = key;
  renderDeploymentSelectBody();
}

export function renderDecoySelectBody(){
  const body = document.getElementById('decoy-select-body');
  body.innerHTML = Object.keys(DECOY_MODES).map(key=>{
    const d = DECOY_MODES[key];
    const selected = state.decoyPlacementMode===key;
    return `
      <div class="shop-row ${selected?'selected':''}">
        <div>
          <div class="label">${d.label}</div>
          <div class="sub">${d.sub}</div>
        </div>
        <div class="actions"><button class="btn primary" onclick="selectDecoyMode('${key}')">${selected?'選択中':'選択'}</button></div>
      </div>
    `;
  }).join('');
}

export function selectDecoyMode(key){
  if(!DECOY_MODES[key]) return;
  state.decoyPlacementMode = key;
  renderDecoySelectBody();
}

export function openShop(){
  renderShop();
  document.getElementById('shop-overlay').classList.add('show');
}

export function closeShop(){
  document.getElementById('shop-overlay').classList.remove('show');
}

export function renderShop(){
  const heCost = PRICE_HE*AMMO_PACK, heatCost = PRICE_HEAT*AMMO_PACK;
  const canBuyHe = state.money >= heCost;
  const canBuyHeat = state.money >= heatCost;
  const canBuyFuze = state.money >= PRICE_FUZE;

  document.getElementById('shop-body').innerHTML = `
    <div class="shop-money">所持金 ¥${state.money.toLocaleString()}</div>
    <p style="color:var(--muted);font-size:12px;margin:0 0 14px;">WAVE ${state.stage} / ${STAGE_COUNT} ― 現有弾薬 HE ${state.ammo.he} ／ HEAT ${state.ammo.heat}</p>

    <div class="shop-row">
      <div><div class="label">榴弾 (HE) ${AMMO_PACK}発</div><div class="sub">¥${PRICE_HE}/発</div></div>
      <div class="actions"><button class="btn" ${canBuyHe?'':'disabled'} onclick="buyAmmo('he',${AMMO_PACK})">¥${heCost} 購入</button></div>
    </div>
    <div class="shop-row">
      <div><div class="label">対戦車榴弾 (HEAT) ${AMMO_PACK}発</div><div class="sub">¥${PRICE_HEAT}/発</div></div>
      <div class="actions"><button class="btn" ${canBuyHeat?'':'disabled'} onclick="buyAmmo('heat',${AMMO_PACK})">¥${heatCost} 購入</button></div>
    </div>
    <div class="shop-row">
      <div><div class="label">近接信管 解放</div><div class="sub">${state.fuzeUnlocked.proximity?'解放済み':'未解放 ・ ¥'+PRICE_FUZE}</div></div>
      <div class="actions"><button class="btn" ${state.fuzeUnlocked.proximity || !canBuyFuze?'disabled':''} onclick="unlockFuze('proximity')">${state.fuzeUnlocked.proximity?'解放済':'解放する'}</button></div>
    </div>
    <div class="shop-row">
      <div><div class="label">遅延信管 解放</div><div class="sub">${state.fuzeUnlocked.delay?'解放済み':'未解放 ・ ¥'+PRICE_FUZE}</div></div>
      <div class="actions"><button class="btn" ${state.fuzeUnlocked.delay || !canBuyFuze?'disabled':''} onclick="unlockFuze('delay')">${state.fuzeUnlocked.delay?'解放済':'解放する'}</button></div>
    </div>

    <p style="color:var(--muted);font-size:11px;margin:12px 0 8px;">特殊装備(恒久アップグレード)</p>
    ${Object.keys(PRICE_EQUIP).map(key=>{
      const owned = state.equipment[key];
      const price = PRICE_EQUIP[key];
      const canBuy = state.money >= price;
      const descs = {
        armor:'FDCへの反撃ダメージ -25%',
        optics:'初期照準誤差 -20%',
        wideView:'斥候視野 45°→65°',
        extMag:'最大発射数 4発→6発',
      };
      return `
        <div class="shop-row">
          <div><div class="label">${EQUIP_LABEL[key]}</div><div class="sub">${descs[key]} ・ ${owned?'装備済み':'¥'+price}</div></div>
          <div class="actions"><button class="btn" ${owned || !canBuy?'disabled':''} onclick="buyEquipment('${key}')">${owned?'装備済':'購入する'}</button></div>
        </div>
      `;
    }).join('')}
  `;
}

export function buyEquipment(key){
  if(state.equipment[key] || state.money < PRICE_EQUIP[key]) return;
  state.money -= PRICE_EQUIP[key];
  state.equipment[key] = true;
  renderShop();
  renderStats();
}

export function buyAmmo(type, qty){
  const price = (type==='he'?PRICE_HE:PRICE_HEAT) * qty;
  if(state.money < price) return;
  state.money -= price;
  state.ammo[type] += qty;
  renderShop();
  renderStats();
}

export function unlockFuze(name){
  if(state.fuzeUnlocked[name] || state.money < PRICE_FUZE) return;
  state.money -= PRICE_FUZE;
  state.fuzeUnlocked[name] = true;
  renderShop();
  renderStats();
}

export function toggleStatbar(){
  const content = document.getElementById('statbar-content');
  const caret = document.getElementById('statbar-caret');
  const expanded = content.classList.toggle('expanded');
  caret.textContent = expanded ? '▾' : '▸';
}

export function toggleBoardNote(){
  document.getElementById('board-note').classList.toggle('expanded');
}

export function toggleDrawer(name){
  const drawer = document.getElementById(name+'-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  if(!drawer || !backdrop) return;
  const wasOpen = drawer.classList.contains('open');
  document.querySelectorAll('.drawer.open').forEach(d=>d.classList.remove('open'));
  if(wasOpen){
    backdrop.classList.remove('show');
  } else {
    drawer.classList.add('open');
    backdrop.classList.add('show');
  }
}

export function closeAllDrawers(){
  document.querySelectorAll('.drawer.open').forEach(d=>d.classList.remove('open'));
  document.getElementById('drawer-backdrop').classList.remove('show');
}

export function appendGeminiMessage(role, text){
  const messages = document.getElementById('gemini-messages');
  if(!messages) return;
  const message = document.createElement('div');
  message.className = `gemini-message ${role}`;
  const label = document.createElement('span');
  label.className = 'gemini-message-label';
  label.textContent = role === 'user' ? 'あなた' : role === 'error' ? 'エラー' : 'Gemini';
  message.append(label, document.createTextNode(text));
  messages.appendChild(message);
  messages.scrollTop = messages.scrollHeight;
}

export function saveGeminiApiKey(){
  const input = document.getElementById('gemini-api-key');
  const key = input ? input.value.trim() : '';
  if(!key){
    appendGeminiMessage('error', 'APIキーを入力してください。');
    return;
  }
  localStorage.setItem(GEMINI_API_KEY_STORAGE, key);
  input.value = '';
  appendGeminiMessage('model', 'APIキーを保存しました。作戦について質問できます。');
}

export function clearGeminiApiKey(){
  localStorage.removeItem(GEMINI_API_KEY_STORAGE);
  const input = document.getElementById('gemini-api-key');
  if(input) input.value = '';
  appendGeminiMessage('model', '保存済みのAPIキーを削除しました。');
}

export async function sendGeminiMessage(event){
  event.preventDefault();
  const input = document.getElementById('gemini-input');
  const text = input ? input.value.trim() : '';
  const apiKey = localStorage.getItem(GEMINI_API_KEY_STORAGE);
  if(!text) return;
  if(!apiKey){
    appendGeminiMessage('error', '先にGoogle AI StudioのAPIキーを保存してください。');
    return;
  }
  input.value = '';
  appendGeminiMessage('user', text);
  const prompt = [
    'あなたは汎用AIアシスタントです。日本語で、質問の意図に沿って簡潔かつ実用的に回答してください。',
    `ユーザーの質問: ${text}`,
  ].join('\n');
  try{
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({contents:[{role:'user', parts:[{text:prompt}]}]}),
      },
    );
    const data = await response.json();
    if(!response.ok){
      throw new Error(data.error && data.error.message ? data.error.message : `HTTP ${response.status}`);
    }
    const candidates = data.candidates && data.candidates[0];
    const parts = candidates && candidates.content && candidates.content.parts;
    const answer = Array.isArray(parts) ? parts.map(part=>part.text || '').join('').trim() : '';
    if(!answer) throw new Error('Geminiから有効な応答がありませんでした。');
    appendGeminiMessage('model', answer);
  }catch(error){
    appendGeminiMessage('error', `通信に失敗しました: ${error.message}`);
  }
}

export function toggleMapFullscreen(){
  const el = document.documentElement;
  const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
  if(!fsEl){
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if(req) req.call(el);
  } else {
    const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
    if(exit) exit.call(document);
  }
}

export function updateFullscreenBtnIcon(){
  const btn = document.getElementById('mapFullscreenBtn');
  if(!btn) return;
  const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
  btn.textContent = fsEl ? '⤢' : '⛶';
  btn.title = fsEl ? '全画面表示を解除' : '全画面表示にする';
}

document.addEventListener('fullscreenchange', updateFullscreenBtnIcon);

document.addEventListener('webkitfullscreenchange', updateFullscreenBtnIcon);

export function log(role, who, text){
  const el = document.getElementById('log');
  const cls = role==='op'?'l-op':role==='fdc'?'l-fdc':role==='mortar'?'l-mortar':'l-sys';
  const div = document.createElement('div');
  div.className = cls;
  div.innerHTML = `<b>[${who}]</b> ${text}`;
  el.insertBefore(div, el.firstChild);
  while(el.childElementCount > LOG_MAX_ENTRIES) el.removeChild(el.lastChild);
  el.scrollTo({top:0, behavior:'smooth'});
}

export let smartWizard = {step:1, unitType:null, unitScope:null, actionKey:null};

export function openSmartOrder(){
  // per user request: fixes a bug where a unit/enemy/decoy command box left open from a
  // previous map tap stayed stacked on top of this drawer through every step, blocking its
  // content -- close any open command box first so the wizard is never obscured.
  state.commandBox = null;
  state.enemyCommandBox = null;
  state.decoyCommandBox = null;
  smartWizard = {step:1, unitType:null, unitScope:null, actionKey:null};
  renderSmartOrder();
  document.getElementById('smart-order-drawer').classList.add('open');
  document.getElementById('drawer-backdrop').classList.add('show');
  render();
}

export function closeSmartOrder(){
  document.getElementById('smart-order-drawer').classList.remove('open');
  document.getElementById('drawer-backdrop').classList.remove('show');
}

export function smartOrderBack(){
  if(smartWizard.step>1) smartWizard.step -= 1;
  renderSmartOrder();
}

export function smartOrderPickType(key){
  smartWizard.unitType = key;
  smartWizard.step = 2;
  renderSmartOrder();
}

export function smartOrderPickScope(scope){
  smartWizard.unitScope = scope;
  smartWizard.step = 3;
  renderSmartOrder();
}

export function smartOrderPickAction(key){
  smartWizard.actionKey = key;
  const def = SMART_ACTIONS[smartWizard.unitType].find(a=>a.key===key);
  // per user request: 迫撃砲+全隊+移動 doesn't wait for a map tap -- sending every mortar to
  // one shared point clusters them into an easy counter-battery target, so instead each
  // mortar scatters 100m in its own random direction, applied immediately.
  if(smartWizard.unitType==='mortar' && key==='move' && smartWizard.unitScope==='all'){
    applySmartMortarScatter();
    return;
  }
  if(def.kind==='map'){
    state.smartOrderMode = {unitType:smartWizard.unitType, unitScope:smartWizard.unitScope, actionKey:key};
    closeSmartOrder();
    log('sys','システム', '地図をタップして移動先を指定してください。');
    return;
  }
  smartWizard.step = 4;
  renderSmartOrder();
}

export function smartOrderPickTarget(targetId){
  applySmartOrder(targetId);
}

export function smartOrderConfirmInstant(){
  applySmartOrder(null);
}

export function renderSmartOrder(){
  const titleEl = document.getElementById('smart-order-title');
  const body = document.getElementById('smart-order-body');
  if(!body) return;
  const step = smartWizard.step;
  const backBtn = step>1 ? `<button class="btn" onclick="smartOrderBack()" style="margin-bottom:10px;">◄ 戻る</button>` : '';
  titleEl.textContent = `スマート操作 (${step}/4)`;

  if(step===1){
    body.innerHTML = `
      <div class="meta" style="margin-bottom:8px;">誰が行動しますか?</div>
      ${Object.keys(SMART_UNIT_TYPES).map(key=>{
        const t = SMART_UNIT_TYPES[key];
        const aliveCount = t.list().filter((u,i)=>t.isAlive(u)).length;
        return `<div class="shop-row"><div><div class="label">${t.label}</div><div class="sub">${aliveCount}隊が活動可能</div></div>
          <div class="actions"><button class="btn primary" ${aliveCount<=0?'disabled':''} onclick="smartOrderPickType('${key}')">選択</button></div></div>`;
      }).join('')}
    `;
    return;
  }
  if(step===2){
    const typeDef = SMART_UNIT_TYPES[smartWizard.unitType];
    const list = typeDef.list();
    const aliveIdxs = list.map((u,i)=>i).filter(i=>typeDef.isAlive(list[i]));
    body.innerHTML = backBtn + `
      <div class="meta" style="margin-bottom:8px;">${typeDef.label} ― どの部隊ですか?</div>
      <div class="shop-row"><div><div class="label">全隊</div><div class="sub">活動可能な${typeDef.label}全${aliveIdxs.length}隊</div></div>
        <div class="actions"><button class="btn primary" onclick="smartOrderPickScope('all')">選択</button></div></div>
      ${aliveIdxs.map(i=>`<div class="shop-row"><div><div class="label">${typeDef.nameOf(i)}</div></div>
        <div class="actions"><button class="btn primary" onclick="smartOrderPickScope('${i}')">選択</button></div></div>`).join('')}
    `;
    return;
  }
  if(step===3){
    const actions = SMART_ACTIONS[smartWizard.unitType];
    body.innerHTML = backBtn + `
      <div class="meta" style="margin-bottom:8px;">何をさせますか?</div>
      ${actions.map(a=>`<div class="shop-row"><div><div class="label">${a.label}</div></div>
        <div class="actions"><button class="btn primary" onclick="smartOrderPickAction('${a.key}')">選択</button></div></div>`).join('')}
    `;
    return;
  }
  if(step===4){
    const actionDef = SMART_ACTIONS[smartWizard.unitType].find(a=>a.key===smartWizard.actionKey);
    if(actionDef.kind==='target'){
      // per user request: SAM can only be assigned air targets (heli/drone); squad/tank/
      // sniper direct-fire weapons can no longer be assigned air targets at all -- anti-air is
      // the SAM's job now.
      const typeGate = smartWizard.unitType==='sam' ? (t=>t.type==='heli'||t.type==='drone')
        : ['squad','tank','sniper'].includes(smartWizard.unitType) ? (t=>t.type!=='heli'&&t.type!=='drone')
        : ()=>true;
      const knownTargets = state.targets.filter(t=>!t.destroyed && isTargetDetected(t) && typeGate(t));
      body.innerHTML = backBtn + `
        <div class="meta" style="margin-bottom:8px;">どの目標ですか?</div>
        ${knownTargets.length ? knownTargets.map(t=>`<div class="shop-row"><div>
          <div class="label">${t.id}</div><div class="sub">${t.revealed?t.def.label:'識別不能'}</div></div>
          <div class="actions"><button class="btn primary" onclick="smartOrderPickTarget('${t.id}')">選択</button></div></div>`).join('')
          : '<div class="empty-hint">捕捉中の目標がありません</div>'}
      `;
    } else {
      // 'instant' -- nothing more to pick, just confirm and fire
      body.innerHTML = backBtn + `
        <div class="decision-box">
          <div class="decision-summary">${SMART_UNIT_TYPES[smartWizard.unitType].label}(${smartWizard.unitScope==='all'?'全隊':SMART_UNIT_TYPES[smartWizard.unitType].nameOf(parseInt(smartWizard.unitScope,10))})に「${actionDef.label}」を指示します。</div>
          <button class="btn primary decision-btn" onclick="smartOrderConfirmInstant()" style="width:100%;">実施せよ</button>
        </div>
      `;
    }
    return;
  }
}

export function hqBoxHtml(){
  const hq = state.hq;
  if(hq.hp<=0) return `<div class="empty-hint" style="padding:4px 0;color:var(--red);">壊滅</div>`;
  const repairAmount = Math.min(HQ_REPAIR_HP_PER_CALL, hq.maxHp-hq.hp);
  const repairCost = Math.round(HQ_REPAIR_COST_PER_HP*repairAmount);
  const canRepair = hq.hp<hq.maxHp && state.money>=repairCost;
  const canCover = !hq.coverBuilt && hq.exposure<HQ_COVER_EXPOSURE_CAP;
  return `
    <div class="meta">HP: ${hq.hp} / ${hq.maxHp}</div>
    <div class="hpbar big" style="margin-bottom:8px;"><div style="width:${Math.max(0,hq.hp/hq.maxHp*100)}%"></div></div>
    ${exposureMetaHtml(getUnitExposure({kind:'hq'}))}
    <button class="btn" ${canCover?'':'disabled'} onclick="buildHqCover()" style="margin:8px 0 4px;">掩体構築(掩蔽率+${HQ_COVER_EXPOSURE_BONUS}${hq.coverBuilt?' ・ このWAVEは実施済み':hq.exposure>=HQ_COVER_EXPOSURE_CAP?' ・ 上限到達':''})</button>
    <button class="btn" ${canRepair?'':'disabled'} onclick="repairHq()">応急修復(+${repairAmount}HP ・ ¥${repairCost})${hq.hp>=hq.maxHp?' ・ HP満タン':''}</button>
    <div class="meta" style="margin:8px 0 4px;">${hq.pendingDest ? '移転先: 設定済み(地図クリックで変更)' : '地図をクリックすると移転先を指定できます'}(移動速度: 歩兵と同一)</div>
    ${hq.pendingDest ? `<button class="btn" onclick="clearHqDest()">移転先を解除</button>` : ''}
  `;
}

export function showWaveRewardChoice(){
  const body = document.getElementById('wave-reward-body');
  body.innerHTML = `
    <div class="shop-row reward-squad">
      <div><div class="label">小隊を1個追加</div><div class="sub">新たな歩兵小隊(${SQUAD_SIZE}名)が編成され前線に加わる</div></div>
      <div class="actions"><button class="btn primary" onclick="chooseWaveReward('squad')">選択</button></div>
    </div>
    <div class="shop-row reward-scout">
      <div><div class="label">斥候班を1個追加</div><div class="sub">新たな斥候班(${SCOUT_SQUAD_SIZE}名)が編成され前線に加わる</div></div>
      <div class="actions"><button class="btn primary" onclick="chooseWaveReward('scout')">選択</button></div>
    </div>
    <div class="shop-row reward-ammo">
      <div><div class="label">迫撃砲弾を補充</div><div class="sub">HE・HEATをランダムな数量だけ補給する</div></div>
      <div class="actions"><button class="btn primary" onclick="chooseWaveReward('ammo')">選択</button></div>
    </div>
  `;
  document.getElementById('wave-reward-overlay').classList.add('show');
}

export function chooseWaveReward(kind){
  document.getElementById('wave-reward-overlay').classList.remove('show');
  if(kind==='squad'){
    const id = addNewSquad();
    log('fdc','増援', `WAVEクリアボーナス: 新編成の第${id+1}小隊(${SQUAD_SIZE}名)が前線に加わった。`);
  } else if(kind==='scout'){
    const id = addNewScout();
    log('fdc','増援', `WAVEクリアボーナス: 新編成の斥候${id+1}班(${SCOUT_SQUAD_SIZE}名)が前線に加わった。`);
  } else if(kind==='ammo'){
    const he = Math.round(rnd(10,30));
    const heat = Math.round(rnd(5,15));
    state.ammo.he += he;
    state.ammo.heat += heat;
    log('fdc','補給', `WAVEクリアボーナス: 迫撃砲弾を補充。HE+${he}・HEAT+${heat}。`);
  }
  handleStageClear();
  render();
}

export function setOverlayAccent(kind, kicker){
  document.getElementById('overlay-card').className = 'card' + (kind ? ' accent-'+kind : '');
  document.getElementById('overlay-kicker').textContent = kicker;
}

export function showStageClear(reward, resupply){
  const ov = document.getElementById('overlay');
  setOverlayAccent('', 'After-Action Report');
  document.getElementById('overlay-title').textContent = 'WAVE CLEAR';
  document.getElementById('overlay-text').textContent =
    `WAVE ${state.stage} 撃退成功。報酬 ¥${reward.total.toLocaleString()}(基本¥${reward.base}+速攻¥${reward.turnsBonus}+残弾¥${reward.ammoBonus}+指揮所無傷¥${reward.hqBonus}+砲兵無傷¥${reward.hpBonus}+歩兵無傷¥${reward.infBonus}+斥候無傷¥${reward.scoutBonus}+狙撃無傷¥${reward.sniperBonus}+敵本部撃破¥${reward.enemyHqBonus}) ／ 所持金 ¥${state.money.toLocaleString()} ／ 補給: 戦果${Math.round(resupply.perf*100)}%によりHE+${resupply.ammoHe}・HEAT+${resupply.ammoHeat}・予備兵力+${resupply.personnel}名`;
  document.getElementById('overlay-buttons').innerHTML =
    `<button class="btn primary" onclick="proceedToShop()">次のWAVEへ</button>`;
  ov.classList.add('show');
  log('fdc','FDC', `WAVE ${state.stage} 撃退成功。報酬 ¥${reward.total.toLocaleString()}を受領。補給: HE+${resupply.ammoHe}/HEAT+${resupply.ammoHeat}/予備兵力+${resupply.personnel}名。`);
}

export function proceedToShop(){
  document.getElementById('overlay').classList.remove('show');
  state.stage += 1;
  deployStage();
}

export function showGameClear(reward){
  unlockAchievement('campaignComplete');
  const ov = document.getElementById('overlay');
  setOverlayAccent('green', 'Campaign Complete');
  document.getElementById('overlay-title').textContent = 'ALL WAVES SURVIVED';
  document.getElementById('overlay-text').textContent =
    `全${STAGE_COUNT}WAVEの猛攻を耐え抜いた。最終報酬 ¥${reward.total.toLocaleString()}。総資産 ¥${state.money.toLocaleString()}。お疲れ様でした、THUNDER-6。`;
  document.getElementById('overlay-buttons').innerHTML =
    `<button class="btn primary" onclick="initGame()">最初から (RESTART)</button>`;
  ov.classList.add('show');
  log('fdc','FDC', `全${STAGE_COUNT}WAVEを耐え抜き作戦完了。最終報酬 ¥${reward.total.toLocaleString()}。`);
}

export function showStageFailed(reason){
  speakRandomAliveUnit('panic');
  const ov = document.getElementById('overlay');
  setOverlayAccent('red', 'After-Action Report');
  document.getElementById('overlay-title').textContent = 'MISSION FAILED';
  const remaining = state.targets.filter(t=>!t.destroyed).length;
  let text;
  if(reason==='hq') text = `指揮所が陥落。作戦指揮系統が崩壊し、任務は完全に失敗した。GAME OVER ― WAVE ${state.stage}。`;
  else if(reason==='hp') text = `迫撃砲部隊が全滅、任務継続不能。WAVE ${state.stage} 失敗。`;
  else if(reason==='scout') text = `斥候が戦闘不能。観測能力を喪失し作戦継続不能。WAVE ${state.stage} 失敗。`;
  else if(reason==='infantry') text = `前線歩兵が壊滅、突破を許した。WAVE ${state.stage} 失敗。`;
  else if(reason==='ammo') text = `弾薬・交戦可能部隊を喪失。目標を${remaining}件残してWAVE ${state.stage} 失敗。`;
  else text = `WAVE ${state.stage} 失敗。`;
  document.getElementById('overlay-text').textContent = text;
  document.getElementById('overlay-buttons').innerHTML = `
    <button class="btn primary" onclick="retryStage()">同WAVEを再挑戦</button>
    <div style="height:8px"></div>
    <button class="btn" onclick="initGame()">最初からやり直す</button>
  `;
  ov.classList.add('show');
  log('sys','システム', `WAVE ${state.stage} 失敗。`);
  state.animating = false;
  state.inFlightVolleys = 0;
}

export function renderMultiSelectBox(){
  const box = document.getElementById('multi-select-box');
  if(!box) return;
  if(!multiSelectMode){ box.style.display = 'none'; return; }
  pruneMultiSelected();
  const orders = multiSelectCommonOrders();
  const btns = orders.map(o=>
    `<button class="btn squad-order-btn" ${multiSelected.length?'':'disabled'} onclick="multiSelectSetOrder('${o}')">${ORDER_ICON[o]} ${ORDER_LABEL[o]}</button>`
  ).join('');
  box.style.display = 'block';
  box.innerHTML = `
    <div class="cb-head">
      <span class="cb-title">複数選択(${multiSelected.length}隊)</span>
      <button class="cb-close" onclick="toggleMultiSelectMode()">×</button>
    </div>
    <div class="meta" style="margin-bottom:6px;">${multiSelected.length ? '地図をクリックで選択中の全隊に移動先を指示。ユニットを再タップで選択解除。' : '小隊/戦車/対空/狙撃/工兵をタップして選択してください。'}</div>
    <div class="squad-orders" style="grid-template-columns:repeat(${orders.length},1fr);margin-bottom:4px;">${btns}</div>
  `;
}

export function closeCommandBox(){
  state.commandBox = null;
  render();
}

export function closeEnemyCommandBox(){
  state.enemyCommandBox = null;
  render();
}

export function mortarBoxHtml(idx){
  const mortar = state.mortars[idx];
  const dead = mortar.hp<=0;
  const aim = mortar.pendingFire;
  const snapped = aim && aim.snappedId ? state.targets.find(x=>x.id===aim.snappedId) : null;
  const order = mortar.order;
  const armingTarget = state.orderMode && state.orderMode.kind==='mortar-target' && state.orderMode.idx===idx;
  const armingMove = state.orderMode && state.orderMode.kind==='mortar-move' && state.orderMode.idx===idx;

  const stanceBtns = ['fire','standby','move'].map(o=>
    `<button class="btn squad-order-btn ${order===o?'active':''}" ${dead?'disabled':''} onclick="setMortarOrder(${idx},'${o}')">${MORTAR_ORDER_ICON[o]} ${MORTAR_ORDER_LABEL[o]}</button>`
  ).join('');

  let bodyHtml = '';
  if(dead){
    bodyHtml = `<div class="empty-hint" style="padding:4px 0;color:var(--red);">戦闘不能</div>`;
  } else if(order==='move'){
    let moveStatus = '移動先: 未設定';
    if(armingMove) moveStatus = '地図をクリックして移動先指定…';
    else if(mortar.pendingDest) moveStatus = '移動先: 設定済み(陣地転換予定)';
    bodyHtml = `
      <div class="meta">標高: ${elevationLabel(elevationAt(mortar.x,mortar.y))} ・ 地形: ${terrainTypeLabel(terrainTypeAt(mortar.x,mortar.y))}</div>
      <button class="btn ${armingMove?'active squad-order-btn':''}" onclick="setMortarOrder(${idx},'move')" style="margin:6px 0;">移動先を指定</button>
      <div class="meta">${moveStatus}</div>
    `;
  } else if(order==='standby'){
    bodyHtml = `<div class="empty-hint" style="padding:4px 0;">待機中(このサイクルは行動しません)</div>`;
  } else {
    let infoHtml;
    if(!aim){
      infoHtml = armingTarget
        ? '<div class="empty-hint" style="padding:4px 0;">地図をクリックして攻撃地点を指定</div>'
        : '<div class="empty-hint" style="padding:4px 0;">「攻撃地点設定」を押してから地図をクリック</div>';
    } else if(snapped){
      const e = estPosFromMortar(mortar, snapped);
      const typeHtml = snapped.revealed
        ? `<span class="type" style="color:${snapped.def.mark}">${snapped.def.label}</span>`
        : `<span class="type unknown">識別不能</span>`;
      infoHtml = `
        <div class="sel-target-info">
          <div class="row1"><span class="id">${snapped.id}</span> ${typeHtml} ${precisionDots(snapped.reconCount)}</div>
          <div class="meta">本砲基準 方位約${Math.round(e.bearing)}° / 距離約${unitsToMeters(e.dist)}m / 誤差±${unitsToMeters(snapped.posErr)}m</div>
          <div class="hpbar"><div style="width:${Math.max(0,snapped.hp/snapped.maxHp*100)}%"></div></div>
        </div>
      `;
    } else {
      const brg = bearingBetween(mortar.x, mortar.y, aim.x, aim.y);
      const dist = Math.hypot(aim.x-mortar.x, aim.y-mortar.y);
      const isDecoyAim = aim.decoyIdx!==undefined && aim.decoyIdx!==null;
      infoHtml = `<div class="sel-target-info"><div class="row1"><span class="id">${isDecoyAim ? `擬陣地${aim.decoyIdx+1}(座標既知)` : '自由射撃座標'}</span></div><div class="meta">方位約${Math.round(brg)}° / 距離約${unitsToMeters(dist)}m${isDecoyAim ? '' : '(未確認地点)'}</div></div>`;
    }
    bodyHtml = `
      <button class="btn ${armingTarget?'active squad-order-btn':''}" onclick="armMortarTargetOrder(${idx})" style="margin-bottom:8px;">攻撃地点設定</button>
      ${infoHtml}
      <div class="field">
        <label>弾種</label>
        <select onchange="updateFireConfig(${idx},'fireShell', this.value)">
          <option value="he" ${mortar.fireShell==='he'?'selected':''}>榴弾 (HE) ― 対人・対集団</option>
          <option value="heat" ${mortar.fireShell==='heat'?'selected':''}>対戦車榴弾 (HEAT) ― 対装甲</option>
          <option value="smoke" ${mortar.fireShell==='smoke'?'selected':''}>発煙弾 ― 視界遮蔽</option>
          <option value="marker" ${mortar.fireShell==='marker'?'selected':''}>マーカー弾 ― 試射・半径200m捕捉</option>
          <option value="illum" ${mortar.fireShell==='illum'?'selected':''}>照明弾 ― 半径${ILLUM_RADIUS_M}mを照射</option>
        </select>
      </div>
      <div class="row-2">
        <div class="field">
          <label>信管</label>
          <select onchange="updateFireConfig(${idx},'fireFuze', this.value)">
            <option value="impact" ${mortar.fireFuze==='impact'?'selected':''}>着発信管</option>
            <option value="proximity" ${!state.fuzeUnlocked.proximity?'disabled':''} ${mortar.fireFuze==='proximity'?'selected':''}>近接信管 ― 榴弾併用でドローン群を一斉撃破${!state.fuzeUnlocked.proximity?'(未解放)':''}</option>
            <option value="delay" ${!state.fuzeUnlocked.delay?'disabled':''} ${mortar.fireFuze==='delay'?'selected':''}>遅延信管${!state.fuzeUnlocked.delay?'(未解放)':''}</option>
          </select>
        </div>
        <div class="field">
          <label>発射数</label>
          <select onchange="updateFireConfig(${idx},'fireCount', this.value)">
            ${Array.from({length: state.equipment.extMag?6:4}, (_,i)=>i+1).map(n=>`<option value="${n}" ${mortar.fireCount===n?'selected':''}>${n}発</option>`).join('')}
          </select>
        </div>
      </div>
      ${aim ? `<button class="btn" onclick="updateFireConfigCancel(${idx})">射撃目標を解除</button>` : ''}
    `;
  }

  const crewHtml = `
    <div class="roster-list">
      ${mortar.crew.map(p=>`<div class="roster-row"><span class="r-rank">${p.rank}</span><span class="r-name">${p.name}</span></div>`).join('')}
    </div>
  `;

  const cbWarnHtml = (!dead && mortar.cbWarnTurns!==null && mortar.cbWarnTurns!==undefined)
    ? `<div class="meta" style="color:var(--red);margin-bottom:6px;">⚠ 対砲兵射撃警戒中 ― あと${Math.ceil(mortar.cbWarnTurns)}ターンで着弾。直ちに陣地転換せよ</div>`
    : (!dead && mortar.shotsSinceMove>MORTAR_CB_SHOTS_THRESHOLD
        ? `<div class="meta" style="margin-bottom:6px;">同一陣地からの連続射撃 ${mortar.shotsSinceMove}回 ― 対砲兵レーダーに捕捉される危険あり</div>`
        : '');

  return `
    <div class="squad-orders" style="grid-template-columns:repeat(3,1fr);margin-bottom:8px;">${stanceBtns}</div>
    ${cbWarnHtml}
    ${bodyHtml}
    ${!dead ? mortarMainlineHtml(idx, mortar) : ''}
    ${exposureMetaHtml(getUnitExposure({kind:'mortar', idx}))}
    ${crewHtml}
  `;
}

export function mortarMainlineHtml(idx, mortar){
  const arming = state.orderMode && state.orderMode.kind==='mortar-mainline' && state.orderMode.idx===idx;
  const hasAngle = mortar.mainlineAngle!==null && mortar.mainlineAngle!==undefined;
  const status = arming
    ? '地図をクリックして主線方位角を指定…'
    : (hasAngle ? `主線方位角: ${Math.round(mortar.mainlineAngle)}° (射程${MORTAR_MAINLINE_RANGE_M}m、表示のみ)` : '主線方位角: 未設定');
  return `
    <div class="row-2" style="margin:8px 0 4px;">
      <button class="btn ${arming?'active squad-order-btn':''}" onclick="armMortarMainlineOrder(${idx})">主線方位角を指定</button>
      <button class="btn" ${hasAngle?'':'disabled'} onclick="clearMortarMainline(${idx})">解除</button>
    </div>
    <div class="meta" style="margin-bottom:6px;">${status}</div>
  `;
}

export function updateFireConfigCancel(idx){
  const mortar = state.mortars[idx];
  if(mortar) mortar.pendingFire = null;
  render();
}

export function exposureMetaHtml(exposure){
  const pct = Math.round(hitChanceFromExposure(exposure)*100);
  // terrainCoverTotal (elevation defilade + terrain type) adds a non-integer bonus on top
  // of what used to always be a whole-number constant -- round for display only, the raw
  // float is still what hitChanceFromExposure above and every combat roll actually use.
  return `<div class="meta">掩蔽率: ${Math.round(exposure)} (被弾率目安 ${pct}%)</div>`;
}

export function soldierRosterHtml(soldiers){
  const rows = soldiers.map(s=>{
    const lvl = s.alive ? vetLevelOf(s) : 0;
    const vetBadge = lvl>0 ? `<span style="color:var(--amber);letter-spacing:-1px;margin-left:3px;" title="古参兵 Lv.${lvl}">${'★'.repeat(lvl)}</span>` : '';
    return `<div class="roster-row${s.alive?'':' dead'}"><span class="r-rank">${s.rank}</span><span class="r-name">${s.name}${vetBadge}</span></div>`;
  }).join('');
  return `<div class="roster-list">${rows}</div>`;
}

export function restButtonHtml(kind, idx, unit){
  if(unit.resting){
    return `<div class="meta" style="margin-bottom:8px;color:var(--amber);">大休止中 ― 残り${unit.restTurnsLeft}ターン(回復 ${unit.restRevived}/${unit.restDeficitStart}名)。命令は一切受け付けません。</div>`;
  }
  const deadCount = unit.soldiers.length - unitAliveCount(unit);
  if(deadCount<=0) return '';
  return `<button class="btn" style="margin-bottom:8px;" onclick="startRest('${kind}',${idx})">大休止を命じる(${REST_DURATION_TURNS}ターン・欠員${deadCount}名が徐々に回復)</button>`;
}

export function reinforceButtonHtml(kind, idx, unit){
  const alive = unitAliveCount(unit);
  const deadCount = unit.soldiers.length-alive;
  if(deadCount<=0) return '';
  const restoreCount = Math.min(REINFORCE_MAX_PER_CALL, deadCount, state.reserve);
  const reinforceCost = REINFORCE_COST_PER_SOLDIER*Math.max(restoreCount,1);
  const reinforceDisabled = unit.reinforceUsed || unit.resting || restoreCount<=0 || state.money<reinforceCost;
  const reinforceLabel = unit.resting ? '大休止中は要請不可'
    : unit.reinforceUsed ? '予備兵力要請済み'
    : restoreCount<=0 ? '予備兵力なし'
    : `予備兵力要請 (${restoreCount}名 ¥${reinforceCost})`;
  return `<button class="btn" ${reinforceDisabled?'disabled':''} onclick="requestReinforcement('${kind}',${idx})">${reinforceLabel}</button>`;
}

export function scoutBoxHtml(idx){
  const scout = state.scouts[idx];
  const alive = unitAliveCount(scout);
  const dead = alive<=0 || scout.resting;
  const armingMove = state.orderMode && state.orderMode.kind==='scout-move' && state.orderMode.idx===idx;
  const armingRecon = state.orderMode && state.orderMode.kind==='scout-recon' && state.orderMode.idx===idx;
  let orderStatus = '行動: 未設定(観測のみ)';
  if(armingMove) orderStatus = '地図をクリックして移動先指定…';
  else if(armingRecon) orderStatus = '捕捉中の目標をクリックして偵察指示…';
  else if(scout.pendingDest) orderStatus = '行動: 移動先へ前進予定';
  else if(scout.pendingReconTargetId) orderStatus = `行動: ${scout.pendingReconTargetId} を偵察予定`;
  return `
    <div class="meta">${alive<=0?'戦闘不能':alive+'/'+scout.soldiers.length+'名'} ・ 標高: ${elevationLabel(elevationAt(scout.x,scout.y))} ・ 地形: ${terrainTypeLabel(terrainTypeAt(scout.x,scout.y))}</div>
    ${exposureMetaHtml(getUnitExposure({kind:'scout', idx}))}
    <div class="meta">観測方向: ${Math.round(scout.watchAngle)}° (視野約${Math.round(scoutHalfFov()*2)}°)</div>
    <div class="hpbar" style="margin-bottom:8px;"><div style="width:${Math.max(0,alive/scout.soldiers.length*100)}%"></div></div>
    ${restButtonHtml('scout', idx, scout)}
    <div class="row-2" style="margin-bottom:6px;">
      <button class="btn ${armingMove?'active squad-order-btn':''}" ${dead?'disabled':''} onclick="armScoutMoveOrder(${idx})">移動先を指定</button>
      <button class="btn ${armingRecon?'active squad-order-btn':''}" ${dead?'disabled':''} onclick="armScoutReconOrder(${idx})">偵察目標を指定</button>
    </div>
    <div class="meta" style="margin-bottom:8px;">${orderStatus}</div>
    <div class="row-2" style="margin-bottom:6px;">
      <button class="btn" ${dead?'disabled':''} onclick="rotateScout(${idx},-15)">◄ 左へ旋回</button>
      <button class="btn" ${dead?'disabled':''} onclick="rotateScout(${idx},15)">右へ旋回 ►</button>
    </div>
    <button class="btn" ${dead||(!scout.pendingDest&&!scout.pendingReconTargetId)?'disabled':''} onclick="clearScoutOrder(${idx})">行動を解除</button>
    ${soldierRosterHtml(scout.soldiers)}
    ${reinforceButtonHtml('scout', idx, scout)}
  `;
}

export function standingOrderSelectHtml(kind, idx, unit, allowAssault){
  const options = ['', 'contact_hold', 'low_hp_retreat'];
  if(allowAssault) options.splice(2, 0, 'contact_assault');
  const optionsHtml = options.map(v=>
    `<option value="${v}" ${(unit.standingOrder||'')===v?'selected':''}>${v?STANDING_ORDER_LABEL[v]:'なし(手動のみ)'}</option>`
  ).join('');
  return `
    <div class="field" style="margin-bottom:6px;">
      <label>既定行動(自動反応)</label>
      <select onchange="setStandingOrder('${kind}',${idx},this.value)">${optionsHtml}</select>
    </div>
  `;
}

export function squadBoxHtml(idx){
  const sq = state.squads[idx];
  const alive = sq.soldiers.filter(s=>s.alive).length;
  const wiped = alive===0 || sq.resting;
  const btns = ['advance','hold','assault','retreat'].map(o=>
    `<button class="btn squad-order-btn ${sq.order===o?'active':''}" ${wiped?'disabled':''} onclick="setSquadOrder(${idx},'${o}')">${ORDER_ICON[o]} ${ORDER_LABEL[o]}</button>`
  ).join('');
  const huntTarget = sq.huntTargetId ? state.targets.find(t=>t.id===sq.huntTargetId) : null;
  const huntStatus = (huntTarget && !huntTarget.destroyed)
    ? `攻撃目標: ${huntTarget.id} (${huntTarget.revealed?huntTarget.def.label:'識別不能'})`
    : null;
  return `
    <div class="meta">${alive} / ${sq.soldiers.length}名 ・ 標高: ${elevationLabel(elevationAt(sq.x,sq.y))} ・ 地形: ${terrainTypeLabel(terrainTypeAt(sq.x,sq.y))}</div>
    ${exposureMetaHtml(getUnitExposure({kind:'squad', idx}))}
    ${restButtonHtml('squad', idx, sq)}
    <div class="squad-orders" style="margin:6px 0;">${btns}</div>
    <div class="meta" style="margin-bottom:6px;">${wiped ? '移動先: 指定不可' : (sq.pendingDest ? '移動先: 設定済み(地図クリックで変更)' : '地図をクリックすると移動先を指定できます')}</div>
    ${sq.pendingDest ? `<button class="btn" style="margin-bottom:6px;" onclick="clearSquadDest(${idx})">移動先を解除</button>` : ''}
    ${huntStatus ? `<div class="meta" style="margin-bottom:4px;">${huntStatus}</div><button class="btn" style="margin-bottom:6px;" onclick="clearSquadHunt(${idx})">攻撃目標を解除</button>` : ''}
    ${standingOrderSelectHtml('squad', idx, sq, true)}
    ${soldierRosterHtml(sq.soldiers)}
    ${reinforceButtonHtml('squad', idx, sq)}
  `;
}

export function tankBoxHtml(idx){
  const tank = state.tanks[idx];
  const dead = tank.hp<=0;
  const btns = ['advance','hold','retreat'].map(o=>
    `<button class="btn squad-order-btn ${tank.order===o?'active':''}" ${dead?'disabled':''} onclick="setTankOrder(${idx},'${o}')">${ORDER_ICON[o]} ${ORDER_LABEL[o]}</button>`
  ).join('');
  const huntTarget = tank.huntTargetId ? state.targets.find(t=>t.id===tank.huntTargetId) : null;
  const huntStatus = (huntTarget && !huntTarget.destroyed)
    ? `攻撃目標: ${huntTarget.id} (${huntTarget.revealed?huntTarget.def.label:'識別不能'})`
    : null;
  if(dead) return `<div class="empty-hint" style="padding:4px 0;color:var(--red);">撃破</div>`;
  const repairAmount = Math.min(TANK_REPAIR_HP_PER_CALL, tank.maxHp-tank.hp);
  const repairCost = Math.round(TANK_REPAIR_COST_PER_HP*repairAmount);
  const canRepair = tank.hp<tank.maxHp && state.money>=repairCost;
  return `
    <div class="meta">HP: ${tank.hp} / ${tank.maxHp}</div>
    <div class="hpbar" style="margin-bottom:8px;"><div style="width:${Math.max(0,tank.hp/tank.maxHp*100)}%"></div></div>
    ${exposureMetaHtml(getUnitExposure({kind:'tank', idx}))}
    <div class="squad-orders" style="grid-template-columns:repeat(3,1fr);margin:6px 0;">${btns}</div>
    <div class="meta" style="margin-bottom:6px;">${tank.pendingDest ? '移動先: 設定済み(地図クリックで変更)' : '地図をクリックすると移動先を指定できます'}</div>
    ${tank.pendingDest ? `<button class="btn" style="margin-bottom:6px;" onclick="clearTankDest(${idx})">移動先を解除</button>` : ''}
    ${huntStatus ? `<div class="meta" style="margin-bottom:4px;">${huntStatus}</div><button class="btn" style="margin-bottom:6px;" onclick="clearTankHunt(${idx})">攻撃目標を解除</button>` : ''}
    <button class="btn" ${canRepair?'':'disabled'} onclick="repairTank(${idx})">応急修復(+${repairAmount}HP ・ ¥${repairCost})${tank.hp>=tank.maxHp?' ・ HP満タン':''}</button>
  `;
}

export function samBoxHtml(idx){
  const sam = state.sams[idx];
  const dead = sam.hp<=0;
  const btns = ['advance','hold','retreat'].map(o=>
    `<button class="btn squad-order-btn ${sam.order===o?'active':''}" ${dead?'disabled':''} onclick="setSamOrder(${idx},'${o}')">${ORDER_ICON[o]} ${ORDER_LABEL[o]}</button>`
  ).join('');
  const huntTarget = sam.huntTargetId ? state.targets.find(t=>t.id===sam.huntTargetId) : null;
  const huntStatus = (huntTarget && !huntTarget.destroyed)
    ? `攻撃目標: ${huntTarget.id} (${huntTarget.revealed?huntTarget.def.label:'識別不能'})`
    : null;
  if(dead) return `<div class="empty-hint" style="padding:4px 0;color:var(--red);">撃破</div>`;
  const repairAmount = Math.min(SAM_REPAIR_HP_PER_CALL, sam.maxHp-sam.hp);
  const repairCost = Math.round(SAM_REPAIR_COST_PER_HP*repairAmount);
  const canRepair = sam.hp<sam.maxHp && state.money>=repairCost;
  return `
    <div class="meta">HP: ${sam.hp} / ${sam.maxHp}</div>
    <div class="hpbar" style="margin-bottom:8px;"><div style="width:${Math.max(0,sam.hp/sam.maxHp*100)}%"></div></div>
    ${exposureMetaHtml(getUnitExposure({kind:'sam', idx}))}
    <div class="meta" style="margin-bottom:6px;color:var(--muted);">対空目標(ヘリ・ドローン)専任 ― 対地目標には交戦不可</div>
    <div class="squad-orders" style="grid-template-columns:repeat(3,1fr);margin:6px 0;">${btns}</div>
    <div class="meta" style="margin-bottom:6px;">${sam.pendingDest ? '移動先: 設定済み(地図クリックで変更)' : '地図をクリックすると移動先を指定できます'}</div>
    ${sam.pendingDest ? `<button class="btn" style="margin-bottom:6px;" onclick="clearSamDest(${idx})">移動先を解除</button>` : ''}
    ${huntStatus ? `<div class="meta" style="margin-bottom:4px;">${huntStatus}</div><button class="btn" style="margin-bottom:6px;" onclick="clearSamHunt(${idx})">攻撃目標を解除</button>` : ''}
    <button class="btn" ${canRepair?'':'disabled'} onclick="repairSam(${idx})">応急修復(+${repairAmount}HP ・ ¥${repairCost})${sam.hp>=sam.maxHp?' ・ HP満タン':''}</button>
  `;
}

export function engineerBoxHtml(idx){
  const en = state.engineers[idx];
  const alive = unitAliveCount(en);
  const dead = alive<=0;
  if(dead) return `<div class="empty-hint" style="padding:4px 0;color:var(--red);">全滅</div>`;
  const resting = en.resting;
  const btns = ['advance','hold','retreat'].map(o=>
    `<button class="btn squad-order-btn ${en.order===o?'active':''}" ${resting?'disabled':''} onclick="setEngineerOrder(${idx},'${o}')">${ORDER_ICON[o]} ${ORDER_LABEL[o]}</button>`
  ).join('');
  const armingMove = state.orderMode && state.orderMode.kind==='engineer-move' && state.orderMode.idx===idx;
  const armingWall = state.orderMode && state.orderMode.kind==='wall-build' && state.orderMode.idx===idx;
  const armingTrench = state.orderMode && (state.orderMode.kind==='trench-build-p1' || state.orderMode.kind==='trench-build-p2') && state.orderMode.idx===idx;
  const destStatus = armingMove ? '地図をクリックして移動先指定…' : (en.pendingDest ? '移動先: 設定済み' : '移動先: 未設定');
  const wallCapReached = state.walls.length >= MAX_WALLS;
  const wallMoneyShort = state.money < WALL_BUILD_COST;
  const trenchCapReached = state.trenches.length >= MAX_TRENCHES;
  const trenchMoneyShort = state.money < TRENCH_BUILD_COST;
  const wallStatus = armingWall ? '地図をクリックして防壁の建設地点を指定…'
    : wallCapReached ? `防壁は上限(${MAX_WALLS}基)に達しています`
    : wallMoneyShort ? `資金不足(建設費 ¥${WALL_BUILD_COST})`
    : `現在の防壁: ${state.walls.length}/${MAX_WALLS}基`;
  const trenchStatus = state.orderMode && state.orderMode.kind==='trench-build-p2' && state.orderMode.idx===idx
    ? '地図をクリックして塹壕の終点を指定…'
    : armingTrench ? '地図をクリックして塹壕の始点を指定…'
    : trenchCapReached ? `塹壕は上限(${MAX_TRENCHES}本)に達しています`
    : trenchMoneyShort ? `資金不足(建設費 ¥${TRENCH_BUILD_COST})`
    : `現在の塹壕: ${state.trenches.length}/${MAX_TRENCHES}本`;
  return `
    <div class="meta">${alive}/${en.soldiers.length}名</div>
    ${exposureMetaHtml(getUnitExposure({kind:'engineer', idx}))}
    <div class="hpbar" style="margin-bottom:8px;"><div style="width:${Math.max(0,alive/en.soldiers.length*100)}%"></div></div>
    ${restButtonHtml('engineer', idx, en)}
    <div class="squad-orders" style="grid-template-columns:repeat(3,1fr);margin:6px 0;">${btns}</div>
    <div class="row-2" style="margin-bottom:6px;">
      <button class="btn ${armingMove?'active squad-order-btn':''}" ${resting?'disabled':''} onclick="armEngineerMoveOrder(${idx})">移動先を指定</button>
      <button class="btn" ${!en.pendingDest?'disabled':''} onclick="clearEngineerDest(${idx})">解除</button>
    </div>
    <div class="meta" style="margin-bottom:8px;">${destStatus}</div>
    <button class="btn ${armingWall?'active squad-order-btn':''}" ${resting||wallCapReached||wallMoneyShort?'disabled':''} style="width:100%;margin-bottom:4px;" onclick="armWallBuildOrder(${idx})">防壁を構築(¥${WALL_BUILD_COST}・地図で地点指定)</button>
    <div class="meta" style="margin-bottom:8px;">${wallStatus}</div>
    <button class="btn ${armingTrench?'active squad-order-btn':''}" ${resting||trenchCapReached||trenchMoneyShort?'disabled':''} style="width:100%;margin-bottom:4px;" onclick="armTrenchBuildOrder(${idx})">塹壕を構築(¥${TRENCH_BUILD_COST}・地図で始点→終点指定)</button>
    <div class="meta" style="margin-bottom:8px;">${trenchStatus}</div>
    ${soldierRosterHtml(en.soldiers)}
  `;
}

export function sniperBoxHtml(idx){
  const sn = state.snipers[idx];
  const alive = sn.soldiers.filter(s=>s.alive).length;
  const wiped = alive===0 || sn.resting;
  const btns = ['advance','hold','retreat'].map(o=>
    `<button class="btn squad-order-btn ${sn.order===o?'active':''}" ${wiped?'disabled':''} onclick="setSniperOrder(${idx},'${o}')">${ORDER_ICON[o]} ${ORDER_LABEL[o]}</button>`
  ).join('');
  const arming = state.orderMode && state.orderMode.kind==='sniper-move' && state.orderMode.idx===idx;
  const armingTarget = state.orderMode && state.orderMode.kind==='sniper-target' && state.orderMode.idx===idx;
  const armingAim = state.orderMode && state.orderMode.kind==='sniper-aim' && state.orderMode.idx===idx;
  const destStatus = arming ? '地図をクリックして移動先指定…' : (sn.pendingDest ? '移動先: 設定済み' : '移動先: 未設定');
  const snipeTarget = sn.pendingSnipeTargetId ? state.targets.find(t=>t.id===sn.pendingSnipeTargetId) : null;
  let snipeStatus;
  if(armingTarget) snipeStatus = '狙撃する目標をクリックして指定…';
  else if(snipeTarget && !snipeTarget.destroyed) snipeStatus = `狙撃目標: ${snipeTarget.id} (${snipeTarget.revealed?snipeTarget.def.label:'識別不能'})`;
  else snipeStatus = '狙撃目標: 未設定';
  let aimStatus;
  if(armingAim) aimStatus = '射撃方向にする地点をクリック…';
  else if(sn.aimAngle!==null && sn.aimAngle!==undefined) aimStatus = `射撃方向: ${Math.round(sn.aimAngle)}° (射程${SNIPER_AIM_RANGE_M}m、自動交戦)`;
  else aimStatus = '射撃方向: 未設定';
  return `
    <div class="meta">${alive} / ${sn.soldiers.length}名 ・ 標高: ${elevationLabel(elevationAt(sn.x,sn.y))} ・ 地形: ${terrainTypeLabel(terrainTypeAt(sn.x,sn.y))} ・ 有効射程約${SNIPER_RANGE_M}m</div>
    ${exposureMetaHtml(getUnitExposure({kind:'sniper', idx}))}
    ${restButtonHtml('sniper', idx, sn)}
    <div class="squad-orders" style="grid-template-columns:repeat(3,1fr);margin:6px 0;">${btns}</div>
    <div class="row-2" style="margin-bottom:6px;">
      <button class="btn ${arming?'active squad-order-btn':''}" ${wiped?'disabled':''} onclick="armSniperMoveOrder(${idx})">移動先を指定</button>
      <button class="btn" ${wiped||!sn.pendingDest?'disabled':''} onclick="clearSniperDest(${idx})">解除</button>
    </div>
    <div class="meta" style="margin-bottom:6px;">${destStatus}</div>
    <button class="btn ${armingTarget?'active squad-order-btn':''}" ${wiped?'disabled':''} onclick="armSniperTargetOrder(${idx})" style="margin-bottom:6px;">狙撃目標を指定</button>
    <div class="meta" style="margin-bottom:6px;">${snipeStatus}</div>
    ${sn.pendingSnipeTargetId ? `<button class="btn" onclick="clearSniperTarget(${idx})" style="margin-bottom:6px;">狙撃目標を解除</button>` : ''}
    <button class="btn ${armingAim?'active squad-order-btn':''}" ${wiped?'disabled':''} onclick="armSniperAimOrder(${idx})" style="margin-bottom:6px;">射撃方向を指定</button>
    <div class="meta" style="margin-bottom:6px;">${aimStatus}</div>
    ${(sn.aimAngle!==null && sn.aimAngle!==undefined) ? `<button class="btn" onclick="clearSniperAim(${idx})">射撃方向を解除</button>` : ''}
    ${standingOrderSelectHtml('sniper', idx, sn, false)}
    ${soldierRosterHtml(sn.soldiers)}
    ${reinforceButtonHtml('sniper', idx, sn)}
  `;
}

export function renderCommandBox(){
  const box = document.getElementById('command-box');
  if(!state.commandBox){ box.style.display='none'; return; }
  const kind = state.commandBox.kind;
  let title, bodyHtml, pos;
  if(kind==='hq'){
    if(state.hq.hp<=0){ box.style.display='none'; return; }
    title = '指揮所';
    bodyHtml = hqBoxHtml();
    pos = canvasToScreen(state.hq._visX!==undefined?state.hq._visX:state.hq.x, state.hq._visY!==undefined?state.hq._visY:state.hq.y);
  } else if(kind==='mortar'){
    const mortar = state.mortars[state.commandBox.idx];
    if(!mortar){ box.style.display='none'; return; }
    title = `迫撃砲${state.commandBox.idx+1}`;
    bodyHtml = mortarBoxHtml(state.commandBox.idx);
    pos = canvasToScreen(mortar._visX!==undefined?mortar._visX:mortar.x, mortar._visY!==undefined?mortar._visY:mortar.y);
  } else if(kind==='scout'){
    const scout = state.scouts[state.commandBox.idx];
    if(!scout){ box.style.display='none'; return; }
    title = `斥候${state.commandBox.idx+1}`;
    bodyHtml = scoutBoxHtml(state.commandBox.idx);
    pos = canvasToScreen(scout._visX!==undefined?scout._visX:scout.x, scout._visY!==undefined?scout._visY:scout.y);
  } else if(kind==='squad'){
    const sq = state.squads[state.commandBox.idx];
    if(!sq){ box.style.display='none'; return; }
    title = `第${state.commandBox.idx+1}小隊`;
    bodyHtml = squadBoxHtml(state.commandBox.idx);
    pos = canvasToScreen(sq._visX!==undefined?sq._visX:sq.x, sq._visY!==undefined?sq._visY:sq.y);
  } else if(kind==='tank'){
    const tank = state.tanks[state.commandBox.idx];
    if(!tank || tank.hp<=0){ box.style.display='none'; return; }
    title = `戦車${state.commandBox.idx+1}`;
    bodyHtml = tankBoxHtml(state.commandBox.idx);
    pos = canvasToScreen(tank._visX!==undefined?tank._visX:tank.x, tank._visY!==undefined?tank._visY:tank.y);
  } else if(kind==='sam'){
    const sam = state.sams[state.commandBox.idx];
    if(!sam || sam.hp<=0){ box.style.display='none'; return; }
    title = `対空${state.commandBox.idx+1}`;
    bodyHtml = samBoxHtml(state.commandBox.idx);
    pos = canvasToScreen(sam._visX!==undefined?sam._visX:sam.x, sam._visY!==undefined?sam._visY:sam.y);
  } else if(kind==='sniper'){
    const sn = state.snipers[state.commandBox.idx];
    if(!sn){ box.style.display='none'; return; }
    title = `狙撃${state.commandBox.idx+1}班`;
    bodyHtml = sniperBoxHtml(state.commandBox.idx);
    pos = canvasToScreen(sn._visX!==undefined?sn._visX:sn.x, sn._visY!==undefined?sn._visY:sn.y);
  } else if(kind==='engineer'){
    const en = state.engineers[state.commandBox.idx];
    if(!en || !unitAlive(en)){ box.style.display='none'; return; }
    title = '工兵小隊';
    bodyHtml = engineerBoxHtml(state.commandBox.idx);
    pos = canvasToScreen(en._visX!==undefined?en._visX:en.x, en._visY!==undefined?en._visY:en.y);
  } else {
    box.style.display='none';
    return;
  }
  box.innerHTML = `
    <div class="cb-head">
      <span class="cb-title">${title}</span>
      <button class="cb-close" onclick="closeCommandBox()">×</button>
    </div>
    ${bodyHtml}
  `;
  positionCommandBox(box, pos, 230);
}

export function positionCommandBox(box, pos, boxW){
  const left = clamp(pos.x-boxW/2, 8, window.innerWidth-boxW-8);
  box.style.left = left+'px';
  box.style.display = 'block';
  const boxH = box.offsetHeight || 220;
  let top = pos.y + 26;
  if(top + boxH > window.innerHeight - 8) top = window.innerHeight - boxH - 8;
  if(top < 8) top = 8;
  box.style.top = top+'px';
}

export function renderEnemyCommandBox(){
  const box = document.getElementById('enemy-command-box');
  if(!box) return;
  if(!state.enemyCommandBox){ box.style.display='none'; return; }
  const t = state.targets.find(x=>x.id===state.enemyCommandBox);
  if(!t || t.destroyed){
    state.enemyCommandBox = null;
    box.style.display='none';
    return;
  }
  const vx = t._visX!==undefined ? t._visX : estPos(t).x;
  const vy = t._visY!==undefined ? t._visY : estPos(t).y;
  const pos = canvasToScreen(vx, vy);
  const mortarBtns = state.mortars.map((m,idx)=>{
    if(m.hp<=0) return '';
    const active = m.order==='fire' && m.pendingFire && m.pendingFire.snappedId===t.id;
    return `<button class="btn ${active?'active squad-order-btn':''}" onclick="assignMortarFire(${idx})">迫撃砲${idx+1}に攻撃させる${active?'(照準中)':''}</button>`;
  }).filter(Boolean).join('');
  // per user request: 対地の直接照準兵器(小隊/戦車/狙撃)はもはや対空目標(ヘリ・ドローン)を
  // 直接狙い撃てない -- 対空はSAM専任(下のsamBtns)。
  const isAirTarget = t.type==='heli' || t.type==='drone';
  // per user request: snipers are no longer assignable from here -- they already
  // auto-engage anything crossing their own aim line (see resolveSniperOrders),
  // and are aimed via the "狙撃目標を指定"/"射撃方向を指定" buttons in their own unit box.
  const squadBtns = isAirTarget ? '' : state.squads.map((sq,idx)=>{
    if(!sq.soldiers.some(s=>s.alive)) return '';
    const active = sq.order==='hunt' && sq.huntTargetId===t.id;
    return `<button class="btn ${active?'active squad-order-btn':''}" onclick="assignSquadHunt(${idx})">第${idx+1}小隊に攻撃させる${active?'(攻撃中)':''}</button>`;
  }).filter(Boolean).join('');
  const tankBtns = isAirTarget ? '' : state.tanks.map((tank,idx)=>{
    if(tank.hp<=0) return '';
    const active = tank.order==='hunt' && tank.huntTargetId===t.id;
    return `<button class="btn ${active?'active squad-order-btn':''}" onclick="assignTankHunt(${idx})">戦車${idx+1}に攻撃させる${active?'(攻撃中)':''}</button>`;
  }).filter(Boolean).join('');
  const samBtns = !isAirTarget ? '' : state.sams.map((sam,idx)=>{
    if(sam.hp<=0) return '';
    const active = sam.order==='hunt' && sam.huntTargetId===t.id;
    return `<button class="btn ${active?'active squad-order-btn':''}" onclick="assignSamHunt(${idx})">対空${idx+1}に攻撃させる${active?'(攻撃中)':''}</button>`;
  }).filter(Boolean).join('');
  const allBtns = mortarBtns + tankBtns + samBtns + squadBtns;
  // per user request: fire always lands exactly where aimed (plus dispersion) -- no hidden
  // correction toward the true position -- so this just shows how far off the current
  // estimate (what you'd actually be aiming at) might still be. Falls with 偵察 (see
  // performRecon) and with each volley fired at this target (see finalizeVolley).
  const staleTurns = t.lastSeenTurn===undefined ? null : Math.floor(Math.max(0, state.turns-t.lastSeenTurn));
  const contactHtml = t.lastKnownX===undefined
    ? '最終確認位置: 未取得'
    : `最終確認: ${staleTurns===0?'現在接触':`${staleTurns}ターン前`} / ${t.lastSeenBy==='heli'?'ヘリ':t.lastSeenBy==='scout'?'斥候':'地上部隊'} / 信頼度 ${Math.round((t.trackingConfidence||0.4)*100)}%`;
  const precisionHtml = `<div class="meta" style="margin-bottom:8px;color:var(--amber);">${contactHtml}<br>見積り誤差: 最大約${Math.round(unitsToMeters(t.posErr))}m(偵察・弾着観測で縮小)</div>`;
  box.innerHTML = `
    <div class="cb-head">
      <span class="cb-title">${t.id} ― ${t.revealed?t.def.label:'識別不能'}</span>
      <button class="cb-close" onclick="closeEnemyCommandBox()">×</button>
    </div>
    ${precisionHtml}
    <div class="meta" style="margin-bottom:8px;">この目標を攻撃させるユニットを選択:</div>
    <div style="display:flex;flex-direction:column;gap:6px;">
      ${allBtns || '<div class="empty-hint" style="padding:4px 0;">出撃可能なユニットがありません</div>'}
    </div>
  `;
  positionCommandBox(box, pos, 230);
}

export function renderStats(){
  document.querySelector('#stat-datetime .value').textContent = formatGameClock(gameClockNow());
  document.querySelector('#stat-stage .value').textContent = state.stage+' / '+STAGE_COUNT;
  document.querySelector('#stat-difficulty .value').textContent = DIFFICULTIES[state.difficulty].label;
  document.querySelector('#stat-weather .value').textContent = WEATHER_TYPES[state.weather].label;
  document.querySelector('#stat-achievements .value').textContent = unlockedAchievements.size+' / '+Object.keys(ACHIEVEMENTS).length;
  document.querySelector('#stat-turns .value').textContent = `${Math.floor(state.missionMinutes)}分`;
  document.querySelector('#stat-money .value').textContent = '¥'+state.money.toLocaleString();
  const remainingTargets = state.targets.filter(t=>!t.destroyed).length;
  document.getElementById('stat-left').textContent = remainingTargets + ' / ' + state.targetsSpawnedTotal;
  const aliveMortarPersonnel = state.mortars.filter(m=>m.hp>0).length * MORTAR_CREW_SIZE;
  const aliveScoutPersonnel = state.scouts.reduce((s,sc)=>s+unitAliveCount(sc),0);
  const aliveSquadPersonnel = totalAliveSoldiers();
  const aliveSniperPersonnel = state.snipers.reduce((s,sn)=>s+sn.soldiers.filter(x=>x.alive).length,0);
  const aliveEngineerPersonnel = state.engineers.reduce((s,en)=>s+en.soldiers.filter(x=>x.alive).length,0);
  const aliveTotal = aliveMortarPersonnel + aliveScoutPersonnel + aliveSquadPersonnel + aliveSniperPersonnel + aliveEngineerPersonnel + state.reserve;
  document.querySelector('#stat-roster .value').textContent = aliveTotal + ' / ' + totalRosterCapacity();
  document.getElementById('board-note').textContent = state.placementPending
    ? '手動配置モード ― 地図上の指定範囲内をクリックして、表示中のユニットの初期位置を指定してください'
    : '自軍は左側、敵軍は右側遠方に展開。ドラッグでパン・ホイールでズーム。目標をクリックして選択';
  const clockNow = gameClockNow();
  const clockTimeOnly = `${String(clockNow.getHours()).padStart(2,'0')}${String(clockNow.getMinutes()).padStart(2,'0')}`;
  document.getElementById('statbar-mini').textContent =
    `${clockTimeOnly} ・ WAVE ${state.stage}/${STAGE_COUNT} ・ 経過${Math.floor(state.missionMinutes)}分 ・ ¥${state.money.toLocaleString()} ・ 兵力${aliveTotal}/${totalRosterCapacity()}`;

  const revealed = state.targets.filter(t=>t.revealed && !t.destroyed);
  const byType = {};
  revealed.forEach(t=>{
    if(!byType[t.type]) byType[t.type] = [];
    byType[t.type].push(t);
  });
  const ebRows = Object.keys(byType).map(type=>{
    const group = byType[type];
    const totalHp = group.reduce((s,t)=>s+t.hp,0);
    const totalMax = group.reduce((s,t)=>s+t.maxHp,0);
    const pct = totalMax>0 ? Math.round(totalHp/totalMax*100) : 0;
    return `<div class="eb-row"><span class="eb-dot" style="background:${TARGET_TYPES[type].mark}"></span><span class="eb-type">${TARGET_TYPES[type].label}</span><span class="eb-scale">×${group.length} 戦力${pct}%</span></div>`;
  });
  document.getElementById('enemy-breakdown').innerHTML = ebRows.length ? ebRows.join('') : '<div class="eb-empty">敵情報なし ― 偵察未了</div>';

  function forceRow(label, frac, pctText, barColor, kind, idx){
    const dead = frac<=0;
    const selectable = kind && !dead;
    return `
      <div class="force-row${dead?' dead':''}${selectable?' selectable':''}" ${selectable?`onclick="selectForceUnit('${kind}',${idx})"`:''}>
        <span class="force-label">${label}</span>
        <div class="hpbar"><div style="width:${Math.max(0,frac*100)}%;background:${dead?'var(--red)':barColor}"></div></div>
        <span class="force-pct">${pctText}</span>
      </div>
    `;
  }
  const rows = [];
  // per user request: friendly force-status bars are unified to blue across the board
  // (HQ was red, mortar amber, scout/squad green -- now all match sniper's existing blue)
  rows.push(forceRow('指揮所', state.hq.hp/state.hq.maxHp, state.hq.hp>0?Math.round(state.hq.hp/state.hq.maxHp*100)+'%':'陥落', 'var(--blue-id)'));
  state.mortars.forEach((m,i)=>{
    rows.push(forceRow(`迫${i+1}`, m.hp/m.maxHp, m.hp>0?Math.round(m.hp/m.maxHp*100)+'%':'不能', 'var(--blue-id)', 'mortar', i));
  });
  state.tanks.forEach((tk,i)=>{
    rows.push(forceRow(`戦${i+1}`, tk.hp/tk.maxHp, tk.hp>0?Math.round(tk.hp/tk.maxHp*100)+'%':'撃破', 'var(--blue-id)', 'tank', i));
  });
  state.sams.forEach((sam,i)=>{
    rows.push(forceRow(`対空${i+1}`, sam.hp/sam.maxHp, sam.hp>0?Math.round(sam.hp/sam.maxHp*100)+'%':'撃破', 'var(--blue-id)', 'sam', i));
  });
  (state.helis||[]).forEach((heli,i)=>{
    rows.push(forceRow(`ヘリ${i+1}`, heli.hp/heli.maxHp, heli.hp>0?Math.round(heli.hp/heli.maxHp*100)+'%':'撃墜', 'var(--blue-id)'));
  });
  state.scouts.forEach((s,i)=>{
    const alive = unitAliveCount(s);
    rows.push(forceRow(`斥${i+1}`, alive/s.soldiers.length, `${alive}/${s.soldiers.length}`, 'var(--blue-id)', 'scout', i));
  });
  state.squads.forEach((sq,i)=>{
    const alive = sq.soldiers.filter(s=>s.alive).length;
    rows.push(forceRow(`小隊${i+1}`, alive/sq.soldiers.length, `${alive}/${sq.soldiers.length}`, 'var(--blue-id)', 'squad', i));
  });
  state.snipers.forEach((sn,i)=>{
    const alive = sn.soldiers.filter(s=>s.alive).length;
    rows.push(forceRow(`狙${i+1}`, alive/sn.soldiers.length, `${alive}/${sn.soldiers.length}`, 'var(--blue-id)', 'sniper', i));
  });
  state.engineers.forEach((en,i)=>{
    const alive = en.soldiers.filter(s=>s.alive).length;
    rows.push(forceRow(`工${i+1}`, alive/en.soldiers.length, `${alive}/${en.soldiers.length}`, 'var(--blue-id)', 'engineer', i));
  });
  rows.push(forceRow('予備', state.reserve/RESERVE_SIZE, `${state.reserve}/${RESERVE_SIZE}`, 'var(--muted)'));
  document.getElementById('force-list').innerHTML = rows.join('');

  // per user request: this panel is collapsed by default and duplicates the on-map
  // per-unit attrition bars, so give the collapsed header a one-glance answer to "is
  // anything wrong" (dead or below half strength) instead of making the player expand
  // it just to find out nothing needs attention.
  let troubledUnits = 0;
  if(state.hq.hp<=0 || state.hq.hp/state.hq.maxHp<0.5) troubledUnits++;
  state.mortars.forEach(m=>{ if(m.hp<=0 || m.hp/m.maxHp<0.5) troubledUnits++; });
  state.scouts.forEach(s=>{ const a=unitAliveCount(s); if(a===0 || a/s.soldiers.length<0.5) troubledUnits++; });
  state.squads.forEach(sq=>{ const a=sq.soldiers.filter(x=>x.alive).length; if(a===0 || a/sq.soldiers.length<0.5) troubledUnits++; });
  state.snipers.forEach(sn=>{ const a=sn.soldiers.filter(x=>x.alive).length; if(a===0 || a/sn.soldiers.length<0.5) troubledUnits++; });
  document.getElementById('force-list-badge').textContent = troubledUnits>0 ? `⚠ ${troubledUnits}` : '';

  document.getElementById('self-ammo-line').textContent = `現有弾薬: HE ${state.ammo.he} ／ HEAT ${state.ammo.heat}`;
}

export function renderDecisionPanel(){
  const holders = document.querySelectorAll('.decision-panel-holder');
  if(!state){ holders.forEach(h=>h.innerHTML=''); return; }
  if(state.placementPending){
    const item = state.placementQueue[state.placementIndex];
    const remaining = state.placementQueue.length - state.placementIndex;
    holders.forEach(h=>{ h.innerHTML = `
      <div class="decision-box">
        <div class="decision-summary">次に配置: <b>${item?item.label:'―'}</b>(残り${remaining})</div>
        <button class="btn" onclick="skipRemainingPlacement()">残りを既定配置で開始</button>
      </div>
    `; });
    return;
  }
  if(state.decoyPlacementPending){
    holders.forEach(h=>{ h.innerHTML = `
      <div class="decision-box">
        <div class="decision-summary">擬陣地を長押しで設置(${state.decoys.length}/${MAX_DECOYS})</div>
        <button class="btn" onclick="finishDecoyPlacement()">設置完了</button>
      </div>
    `; });
    return;
  }
  const disabled = state.animating;
  const queued = [];
  state.mortars.forEach((m,idx)=>{
    if(m.pendingFire) queued.push(`迫撃砲${idx+1}: 射撃`);
    else if(m.order==='move' && m.pendingDest) queued.push(`迫撃砲${idx+1}: 陣地転換`);
  });
  state.scouts.forEach((s,idx)=>{
    if(s.pendingReconTargetId) queued.push(`斥候${idx+1}: 偵察`);
    else if(s.pendingDest) queued.push(`斥候${idx+1}: 移動`);
  });
  state.squads.forEach((sq,idx)=>{ if(sq.pendingDest) queued.push(`第${idx+1}小隊: 移動`); });
  state.snipers.forEach((sn,idx)=>{
    if(sn.pendingSnipeTargetId) queued.push(`狙撃${idx+1}班: 狙撃`);
    else if(sn.pendingDest) queued.push(`狙撃${idx+1}班: 移動`);
  });
  const summary = queued.join(' / ');
  holders.forEach(h=>{ h.innerHTML = `
    <div class="decision-box">
      ${summary ? `<div class="decision-summary">${summary}</div>` : ''}
      <div class="decision-controls-row">
        <div class="speed-slider-row">
          <input type="range" class="speed-slider" min="0" max="2" step="1"
            value="${GAME_SPEED_ORDER.indexOf(state.gameSpeed)}"
            oninput="setGameSpeedByIndex(this.value)" title="進行速度">
          <span class="speed-slider-label">${GAME_SPEED_LABEL[state.gameSpeed]}</span>
        </div>
        <button class="btn primary decision-btn" ${state.stageResolved?'disabled':''} onclick="toggleAutoCommit()">${isAutoCommitRunning()?'戦闘中':'戦闘開始'}</button>
      </div>
    </div>
  `; });
}

export function closeDecoyCommandBox(){
  state.decoyCommandBox = null;
  render();
}

export function renderDecoyCommandBox(){
  const box = document.getElementById('decoy-command-box');
  if(!box) return;
  if(state.decoyCommandBox===null || state.decoyCommandBox===undefined){ box.style.display='none'; return; }
  const idx = state.decoyCommandBox;
  const d = state.decoys[idx];
  if(!d || d.destroyed){
    state.decoyCommandBox = null;
    box.style.display='none';
    return;
  }
  const pos = canvasToScreen(d.x, d.y);
  const rows = state.mortars.map((m,mIdx)=>{
    if(m.hp<=0) return '';
    const active = m.order==='fire' && m.pendingFire && m.pendingFire.decoyIdx===idx;
    return `
      <div class="shop-row" style="align-items:flex-start;">
        <div style="flex:1;">
          <div class="label" style="font-size:11px;">迫撃砲${mIdx+1}</div>
          <div class="row-2" style="margin-top:4px;">
            <select onchange="updateFireConfig(${mIdx},'fireShell', this.value)">
              <option value="he" ${m.fireShell==='he'?'selected':''}>榴弾(HE)</option>
              <option value="heat" ${m.fireShell==='heat'?'selected':''}>対戦車榴弾(HEAT)</option>
              <option value="smoke" ${m.fireShell==='smoke'?'selected':''}>発煙弾</option>
              <option value="marker" ${m.fireShell==='marker'?'selected':''}>マーカー弾</option>
              <option value="illum" ${m.fireShell==='illum'?'selected':''}>照明弾</option>
            </select>
            <select onchange="updateFireConfig(${mIdx},'fireFuze', this.value)">
              <option value="impact" ${m.fireFuze==='impact'?'selected':''}>着発信管</option>
              <option value="proximity" ${!state.fuzeUnlocked.proximity?'disabled':''} ${m.fireFuze==='proximity'?'selected':''}>近接信管</option>
              <option value="delay" ${!state.fuzeUnlocked.delay?'disabled':''} ${m.fireFuze==='delay'?'selected':''}>遅延信管</option>
            </select>
          </div>
        </div>
        <div class="actions"><button class="btn ${active?'active squad-order-btn':''}" onclick="assignMortarFireAtDecoy(${mIdx})">${active?'照準中':'射撃'}</button></div>
      </div>
    `;
  }).filter(Boolean).join('');
  box.innerHTML = `
    <div class="cb-head">
      <span class="cb-title">擬陣地${idx+1} ― 座標既知</span>
      <button class="cb-close" onclick="closeDecoyCommandBox()">×</button>
    </div>
    <div class="meta" style="margin-bottom:8px;">HP ${d.hp}/${d.maxHp} ・ この地点へ観測誤差なしで精密射撃可能</div>
    <div style="display:flex;flex-direction:column;gap:6px;">
      ${rows || '<div class="empty-hint" style="padding:4px 0;">出撃可能な迫撃砲がありません</div>'}
    </div>
  `;
  positionCommandBox(box, pos, 260);
}

export function repositionOpenCommandBoxes(){
  if(state.commandBox){
    const box = document.getElementById('command-box');
    if(box && box.style.display!=='none'){
      const {kind, idx} = state.commandBox;
      const unit = kind==='hq' ? state.hq
        : kind==='mortar' ? state.mortars[idx]
        : kind==='tank' ? state.tanks[idx]
        : kind==='sam' ? state.sams[idx]
        : kind==='scout' ? state.scouts[idx]
        : kind==='squad' ? state.squads[idx]
        : kind==='sniper' ? state.snipers[idx]
        : kind==='engineer' ? state.engineers[idx]
        : null;
      if(unit){
        const ux = unit._visX!==undefined ? unit._visX : unit.x;
        const uy = unit._visY!==undefined ? unit._visY : unit.y;
        positionCommandBox(box, canvasToScreen(ux, uy), 230);
      }
    }
  }
  if(state.enemyCommandBox){
    const box = document.getElementById('enemy-command-box');
    if(box && box.style.display!=='none'){
      const t = state.targets.find(x=>x.id===state.enemyCommandBox);
      if(t && !t.destroyed){
        const vx = t._visX!==undefined ? t._visX : estPos(t).x;
        const vy = t._visY!==undefined ? t._visY : estPos(t).y;
        positionCommandBox(box, canvasToScreen(vx, vy), 230);
      }
    }
  }
  if(state.decoyCommandBox!==null && state.decoyCommandBox!==undefined){
    const box = document.getElementById('decoy-command-box');
    if(box && box.style.display!=='none'){
      const d = state.decoys[state.decoyCommandBox];
      if(d && !d.destroyed) positionCommandBox(box, canvasToScreen(d.x, d.y), 260);
    }
  }
}

export function anyOverlayShown(){
  return !!document.querySelector('.overlay.show');
}


Object.assign(window, { renderMapSelectOverlay, renderMapSelectBody, selectMapSeed, renderDeploymentSelectBody, selectDeploymentMode, renderDecoySelectBody, selectDecoyMode, openShop, closeShop, renderShop, buyEquipment, buyAmmo, unlockFuze, toggleStatbar, toggleBoardNote, toggleDrawer, closeAllDrawers, appendGeminiMessage, saveGeminiApiKey, clearGeminiApiKey, sendGeminiMessage, toggleMapFullscreen, updateFullscreenBtnIcon, log, openSmartOrder, closeSmartOrder, smartOrderBack, smartOrderPickType, smartOrderPickScope, smartOrderPickAction, smartOrderPickTarget, smartOrderConfirmInstant, renderSmartOrder, hqBoxHtml, showWaveRewardChoice, chooseWaveReward, setOverlayAccent, showStageClear, proceedToShop, showGameClear, showStageFailed, renderMultiSelectBox, closeCommandBox, closeEnemyCommandBox, mortarBoxHtml, mortarMainlineHtml, updateFireConfigCancel, exposureMetaHtml, soldierRosterHtml, restButtonHtml, reinforceButtonHtml, scoutBoxHtml, standingOrderSelectHtml, squadBoxHtml, tankBoxHtml, samBoxHtml, engineerBoxHtml, sniperBoxHtml, renderCommandBox, positionCommandBox, renderEnemyCommandBox, renderStats, renderDecisionPanel, closeDecoyCommandBox, renderDecoyCommandBox, repositionOpenCommandBoxes, anyOverlayShown });
