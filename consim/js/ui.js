// Split out of the former monolithic mortar_fdc_game.js.
import { unlockAchievement, unlockedAchievements } from './achievements.js';
import { abandonSavedCampaign, addNewAntitank, addNewHeli, addNewMortar, addNewSquad, applySmartMortarScatter, applySmartOrder, deployStage, estPos, estPosFromMortar, formatGameClock, gameClockNow, getUnitExposure, handleStageClear, healAllForces, isAutoCommitRunning, isJammed, isObservedByScout, mapSeedCandidates, mortarNotReadyToFire, mortarTooCloseToFire, mortarTooFarToFire, resumedFromSave, state, totalAliveSoldiers, totalRosterCapacity, unitAlive, unitAliveCount, vetLevelOf } from './combat.js';
import { ACHIEVEMENTS, AMMO_PACK, ANTITANK_AA_RANGE, ANTITANK_ENGAGE_RANGE, BAND_ENGAGE_RANGE, DECOY_MODES, DEPLOYMENT_MODES, DIFFICULTIES, EQUIP_LABEL, GAME_SPEED_LABEL, GAME_SPEED_ORDER, HQ_COVER_EXPOSURE_BONUS, HQ_COVER_EXPOSURE_CAP, HQ_REPAIR_COST_PER_HP, HQ_REPAIR_HP_PER_CALL, ILLUM_RADIUS_M, MAP_SEED_THUMB_H, MAP_SEED_THUMB_W, MAX_DECOYS, MAX_TRENCHES, MAX_WALLS, MEDAL_EXCHANGE_COST, MEDAL_EXCHANGE_REWARD_HE, MEDAL_EXCHANGE_REWARD_HEAT, MEDAL_EXCHANGE_REWARD_MONEY, MORTAR_CB_SHOTS_THRESHOLD, MORTAR_CREW_SIZE, MORTAR_MAINLINE_RANGE_M, MORTAR_MAX_RANGE_M, MORTAR_MIN_RANGE_M, MORTAR_ORDER_ICON, MORTAR_ORDER_LABEL, ORDER_ICON, ORDER_LABEL, PRICE_EQUIP, PRICE_FUZE, PRICE_HE, PRICE_HEAT, REINFORCE_COST_PER_SOLDIER, REINFORCE_MAX_PER_CALL, RESERVE_SIZE, REST_DURATION_TURNS, SAM_ENGAGE_RANGE, SAM_REPAIR_COST_PER_HP, SAM_REPAIR_HP_PER_CALL, SMART_ACTIONS, SMART_UNIT_TYPES, SQUAD_ENGAGE_RANGE, SQUAD_SIZE, STAGE_COUNT, STANDING_ORDER_LABEL, SUPPLY_CARRY_MAX, UNIT_AMMO_MAX, ANTITANK_REPAIR_COST_PER_HP, ANTITANK_REPAIR_HP_PER_CALL, TANK_ENGAGE_RANGE, TANK_REPAIR_COST_PER_HP,TANK_REPAIR_HP_PER_CALL, TARGET_TYPES, TICKER_MAX_ENTRIES, TRENCH_BUILD_COST, WALL_BUILD_COST, WEATHER_TYPES } from './constants.js';
import { canvasToScreen, multiSelectCommonOrders, multiSelectMode, multiSelected, pruneMultiSelected, unitGroups } from './input.js';
import { render } from './main.js';
import { altitudeBonus, elevationAt, elevationLabel, terrainTypeAt, terrainTypeLabel } from './terrain.js';
import { paintTerrainColors } from './three.js';
import { bearingBetween, clamp, hitChanceFromExposure, rnd, unitsToMeters } from './utils.js';
import { speakRandomAliveUnit } from './voice.js';

const terrainThumbCache = new Map();

function drawCachedTerrainThumb(canvas, gen){
  const key = `${gen.seed}:${gen.archetype}:${canvas.width}x${canvas.height}`;
  let thumb = terrainThumbCache.get(key);
  if(!thumb){
    thumb = document.createElement('canvas');
    thumb.width = canvas.width;
    thumb.height = canvas.height;
    paintTerrainColors(thumb.getContext('2d'), thumb.width, thumb.height, gen);
    terrainThumbCache.set(key, thumb);
  }
  canvas.getContext('2d').drawImage(thumb, 0, 0);
}

// per user request: shown at the top of the setup overlay when a saved campaign was found and
// applied (see initGame()/savegame.js) -- confirms what's being resumed and offers a way to
// discard it and start fresh instead.
export function renderResumeBanner(){
  const el = document.getElementById('resume-banner');
  if(!el) return;
  if(!resumedFromSave){
    el.innerHTML = '';
    return;
  }
  el.innerHTML = `
    <div class="shop-row selected" style="margin-bottom:10px;">
      <div>
        <div class="label">セーブデータから再開</div>
        <div class="sub">WAVE ${state.stage} ・ 所持金 ¥${state.money.toLocaleString()}</div>
      </div>
      <div class="actions"><button class="btn" onclick="if(confirm('セーブデータを削除して新規に開始しますか？この操作は取り消せません。')) abandonSavedCampaign();">新規に開始</button></div>
    </div>
  `;
}

export function renderMapSelectOverlay(){
  renderResumeBanner();
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
    if(canvas) drawCachedTerrainThumb(canvas, gen);
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
        extMag:'最大発射数 4発→6発',
      };
      return `
        <div class="shop-row">
          <div><div class="label">${EQUIP_LABEL[key]}</div><div class="sub">${descs[key]} ・ ${owned?'装備済み':'¥'+price}</div></div>
          <div class="actions"><button class="btn" ${owned || !canBuy?'disabled':''} onclick="buyEquipment('${key}')">${owned?'装備済':'購入する'}</button></div>
        </div>
      `;
    }).join('')}

    <p style="color:var(--muted);font-size:11px;margin:12px 0 8px;">ちいさなメダル交換(ドラクエファン向け追加要素)</p>
    <div class="shop-row">
      <div><div class="label">メダル交換</div><div class="sub">所持: ${state.medals||0}枚 ・ ${MEDAL_EXCHANGE_COST}枚で¥${MEDAL_EXCHANGE_REWARD_MONEY}+HE${MEDAL_EXCHANGE_REWARD_HE}発+HEAT${MEDAL_EXCHANGE_REWARD_HEAT}発と交換</div></div>
      <div class="actions"><button class="btn" ${(state.medals||0)>=MEDAL_EXCHANGE_COST?'':'disabled'} onclick="exchangeMedals()">交換する</button></div>
    </div>
  `;
}

// per user request(ドラクエファン向け追加要素): 強敵撃破でドロップする「ちいさなメダル」
// (onTargetDestroyed、vfx.js参照)を、貯めた枚数分だけ商店でボーナス報酬と交換できる。
export function exchangeMedals(){
  if((state.medals||0) < MEDAL_EXCHANGE_COST) return;
  state.medals -= MEDAL_EXCHANGE_COST;
  state.money += MEDAL_EXCHANGE_REWARD_MONEY;
  state.ammo.he += MEDAL_EXCHANGE_REWARD_HE;
  state.ammo.heat += MEDAL_EXCHANGE_REWARD_HEAT;
  log('fdc','戦果', `ちいさなメダル${MEDAL_EXCHANGE_COST}枚と交換: ¥${MEDAL_EXCHANGE_REWARD_MONEY}・HE+${MEDAL_EXCHANGE_REWARD_HE}・HEAT+${MEDAL_EXCHANGE_REWARD_HEAT}を入手。`);
  renderShop();
  renderStats();
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

// per user request: the 通信記録(Radio Log) drawer this fed is gone -- important events now
// surface via the on-screen ticker (see announceTicker() below) instead of a scrollable panel.
// log() is kept as a no-op rather than ripped out of its ~150 call sites across combat.js.
export function log(role, who, text){
}

export let tickerMessages = [];

// per user request: replaces the removed Radio Log drawer -- important battlefield events
// scroll across a fixed ticker bar instead of sitting in a scrollable panel. cls is an
// optional CSS class (e.g. 'death' for a KIA announcement) to color that one entry.
export function announceTicker(text, cls){
  tickerMessages.push({text, cls: cls||''});
  if(tickerMessages.length > TICKER_MAX_ENTRIES) tickerMessages.shift();
  renderTicker();
  // per user request: 隊員死亡のテロップが地味なので強調したい -- スクロールするテロップ欄
  // (下記renderTicker、変更なし)に流れて「収まる」のはそのままに、流れ込む瞬間だけ画面上部に
  // 骸骨アイコン付きの警告をポップイン→フラッシュ→フェードで一瞬強調表示する2段構成にした。
  if(cls==='death') flashKiaAlert(text);
}

// per user request: 死亡テロップの強調演出。showBattleStartBanner()と同じ「タイマーで
// 前回分を打ち切って上書き」パターンだが、画面中央に大きく出す戦闘開始バナーとは違い、
// 隊員が頻繁に死ぬ局面で鬱陶しくならないよう画面上部の小さめの警告カードに留める
// (CSSのkia-flashクラス側でポップイン+フラッシュ+フェードのタイミングを管理)。
let kiaFlashTimer = null;
export function flashKiaAlert(text){
  const el = document.getElementById('kia-flash');
  if(!el) return;
  el.innerHTML = `<span class="kia-flash-icon">💀</span><span>${text}</span>`;
  el.classList.remove('show');
  void el.offsetWidth; // force reflow so re-triggering the class restarts the CSS animation
  el.classList.add('show');
  if(kiaFlashTimer) clearTimeout(kiaFlashTimer);
  kiaFlashTimer = setTimeout(()=>{ el.classList.remove('show'); }, 1800);
}

export function renderTicker(){
  const bar = document.getElementById('ticker-bar');
  const track = document.getElementById('ticker-track');
  if(!bar || !track) return;
  if(tickerMessages.length===0){
    bar.classList.add('empty');
    track.innerHTML = '';
    return;
  }
  bar.classList.remove('empty');
  const itemsHtml = tickerMessages.map(m=>`<span class="ticker-item ${m.cls}">${m.text}</span>`).join('');
  // duplicated back-to-back so a -50% translateX loop is seamless regardless of content length
  track.innerHTML = itemsHtml + itemsHtml;
  requestAnimationFrame(()=>{
    const halfWidth = track.scrollWidth/2;
    const pxPerSec = 55;
    track.style.animationDuration = Math.max(8, halfWidth/pxPerSec) + 's';
  });
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
      // per user request: SAM can only be assigned air targets (heli/drone); squad/tank
      // direct-fire weapons can no longer be assigned air targets at all -- anti-air is
      // primarily the SAM's job. Antitank carries both a主兵装(対戦車ロケットランチャー、
      // vehicle専任)と副武装(対空自衛火器、heli/drone)なので、その両方を選べる。
      const typeGate = smartWizard.unitType==='sam' ? (t=>t.type==='heli'||t.type==='drone')
        : smartWizard.unitType==='antitank' ? (t=>t.type==='vehicle'||t.type==='at_gun'||t.type==='heli'||t.type==='drone')
        : ['squad','tank'].includes(smartWizard.unitType) ? (t=>t.type!=='heli'&&t.type!=='drone')
        : ()=>true;
      const knownTargets = state.targets.filter(t=>!t.destroyed && t.revealed && typeGate(t));
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

// per user request(ドラクエ風の階層コマンドメニュー): 各コマンドボックスを「命令/攻撃目標/
// 修理/その他」等の大分類ボタンだけのトップレベルと、選んだ大分類の中身(既存のボタン/一覧を
// そのまま流用)の2階層に分ける共通ヘルパー。categoriesの各要素は
// {key, label, onclick?, disabled?} -- keyを渡すとopenCommandCategory(key)を、onclickを
// 渡せばそれを直接呼ぶ(「移動」のように大分類自体が即座にアクション -- armDirectMoveOrder
// 等 -- を実行し、サブメニューを持たない場合に使う)。state.commandBoxMenuと一致するkeyの
// ボタンはactive表示にする。
function categoryMenuHtml(categories){
  const menu = state.commandBoxMenu;
  const btns = categories.map(c=>{
    const action = c.onclick ? c.onclick : `openCommandCategory('${c.key}')`;
    const active = c.key && menu===c.key;
    return `<button class="btn ${active?'active squad-order-btn':''}" ${c.disabled?'disabled':''} onclick="${action}">${c.label}</button>`;
  }).join('');
  return `<div class="squad-orders" style="grid-template-columns:repeat(${categories.length},1fr);margin-bottom:8px;">${btns}</div>`;
}

const BACK_TO_MENU_BTN = `<button class="btn" style="width:100%;margin-bottom:8px;" onclick="closeCommandCategory()">← 戻る</button>`;

export function hqBoxHtml(){
  const hq = state.hq;
  if(hq.hp<=0) return `<div class="empty-hint" style="padding:4px 0;color:var(--red);">壊滅</div>`;
  const repairAmount = Math.min(HQ_REPAIR_HP_PER_CALL, hq.maxHp-hq.hp);
  const repairCost = Math.round(HQ_REPAIR_COST_PER_HP*repairAmount);
  const canRepair = hq.hp<hq.maxHp && state.money>=repairCost;
  const canCover = !hq.coverBuilt && hq.exposure<HQ_COVER_EXPOSURE_CAP;
  const menu = state.commandBoxMenu;
  return `
    <div class="meta">HP: ${hq.hp} / ${hq.maxHp}</div>
    <div class="hpbar big" style="margin-bottom:8px;"><div style="width:${Math.max(0,hq.hp/hq.maxHp*100)}%"></div></div>
    ${exposureMetaHtml(getUnitExposure({kind:'hq'}))}
    ${categoryMenuHtml([
      {label:'移転', onclick:"armDirectMoveOrder('hq',0)"},
      {key:'defense', label:'防衛'},
      {key:'repair', label:'修理'},
    ])}
    ${menu==='defense' ? `${BACK_TO_MENU_BTN}<button class="btn" ${canCover?'':'disabled'} onclick="buildHqCover()">掩体構築(掩蔽率+${HQ_COVER_EXPOSURE_BONUS}${hq.coverBuilt?' ・ このWAVEは実施済み':hq.exposure>=HQ_COVER_EXPOSURE_CAP?' ・ 上限到達':''})</button>` : ''}
    ${menu==='repair' ? `${BACK_TO_MENU_BTN}<button class="btn" ${canRepair?'':'disabled'} onclick="repairHq()">応急修復(+${repairAmount}HP ・ ¥${repairCost})${hq.hp>=hq.maxHp?' ・ HP満タン':''}</button>` : ''}
    <div class="meta" style="margin-top:6px;">${hq.pendingDest ? '移転先: 設定済み(地図クリックで変更)' : '地図をクリックすると移転先を指定できます'}(移動速度: 歩兵と同一)</div>
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
    <div class="shop-row reward-mortar">
      <div><div class="label">迫撃砲班を1個追加</div><div class="sub">新たな迫撃砲班(${MORTAR_CREW_SIZE}名)が編成され前線に加わる</div></div>
      <div class="actions"><button class="btn primary" onclick="chooseWaveReward('mortar')">選択</button></div>
    </div>
    <div class="shop-row reward-antitank">
      <div><div class="label">対戦車部隊を1個追加</div><div class="sub">戦車に対して有効なロケットランチャーを装備する軽車両部隊が前線に加わる</div></div>
      <div class="actions"><button class="btn primary" onclick="chooseWaveReward('antitank')">選択</button></div>
    </div>
    <div class="shop-row reward-heli">
      <div><div class="label">攻撃ヘリを1機追加</div><div class="sub">新たなヘリが前線に加わる</div></div>
      <div class="actions"><button class="btn primary" onclick="chooseWaveReward('heli')">選択</button></div>
    </div>
    <div class="shop-row reward-heal">
      <div><div class="label">全体回復</div><div class="sub">全部隊のHPを満タンに回復し、倒れた兵員も戦列に復帰する</div></div>
      <div class="actions"><button class="btn primary" onclick="chooseWaveReward('heal')">選択</button></div>
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
  } else if(kind==='mortar'){
    const id = addNewMortar();
    log('fdc','増援', `WAVEクリアボーナス: 新編成の迫撃砲${id+1}班(${MORTAR_CREW_SIZE}名)が前線に加わった。`);
  } else if(kind==='antitank'){
    const id = addNewAntitank();
    log('fdc','増援', `WAVEクリアボーナス: 新編成の対戦車${id+1}が前線に加わった。`);
  } else if(kind==='heli'){
    const id = addNewHeli();
    log('fdc','増援', `WAVEクリアボーナス: 新編成のヘリ${id+1}が前線に加わった。`);
  } else if(kind==='heal'){
    healAllForces();
    log('fdc','衛生', `WAVEクリアボーナス: 全部隊が全回復した。`);
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
  // per user request(陸上自衛隊の「服務事故」の多さをエッセンスとして): WAVE中に発生した
  // 軽微な服務事故の件数を表示する(resolveServiceIncidents参照)。0件なら模範部隊として讃える。
  const incidentsThisWave = state.serviceIncidentsThisWave||0;
  const incidentNote = incidentsThisWave===0 ? '0件(模範部隊)' : `${incidentsThisWave}件`;
  document.getElementById('overlay-text').textContent =
    `WAVE ${state.stage} 撃退成功。報酬 ¥${reward.total.toLocaleString()}(基本¥${reward.base}+速攻¥${reward.turnsBonus}+残弾¥${reward.ammoBonus}+指揮所無傷¥${reward.hqBonus}+砲兵無傷¥${reward.hpBonus}+歩兵無傷¥${reward.infBonus}+斥候無傷¥${reward.scoutBonus}+対戦車無傷¥${reward.antitankBonus}+敵本部撃破¥${reward.enemyHqBonus}) ／ 所持金 ¥${state.money.toLocaleString()} ／ 補給: 戦果${Math.round(resupply.perf*100)}%によりHE+${resupply.ammoHe}・HEAT+${resupply.ammoHeat}・予備兵力+${resupply.personnel}名 ／ 今回の服務事故: ${incidentNote}`;
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
    `全${STAGE_COUNT}WAVEの猛攻を耐え抜いた。最終報酬 ¥${reward.total.toLocaleString()}。総資産 ¥${state.money.toLocaleString()}。道中の服務事故 合計${state.serviceIncidentsTotal||0}件。お疲れ様でした、THUNDER-6。`;
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
  // per user request: 部隊のグループ化 -- 現在の選択を1〜9のスロットに保存/呼び出しできる
  // (classic RTS control groups)。保存は空でないスロットも上書き可能、呼び出しは空スロット
  // なら無反応(disabled)にしてある。
  const groupSaveBtns = unitGroups.map((g,i)=>
    `<button class="btn" ${multiSelected.length?'':'disabled'} onclick="saveUnitGroup(${i+1})" title="現在の選択をグループ${i+1}に保存">${i+1}</button>`
  ).join('');
  const groupRecallBtns = unitGroups.map((g,i)=>
    `<button class="btn" ${g.length?'':'disabled'} onclick="recallUnitGroup(${i+1})" title="グループ${i+1}を呼び出し">${i+1}${g.length?`(${g.length})`:''}</button>`
  ).join('');
  box.style.display = 'block';
  box.innerHTML = `
    <div class="cb-head">
      <span class="cb-title">複数選択(${multiSelected.length}隊)</span>
      <button class="cb-close" onclick="toggleMultiSelectMode()">×</button>
    </div>
    <div class="meta" style="margin-bottom:6px;">${multiSelected.length ? '地図をクリックで選択中の全隊に移動先を指示。ユニットを再タップで選択解除。' : '小隊/戦車/対空/対戦車/工兵をタップして選択してください。'}</div>
    <div class="squad-orders" style="grid-template-columns:repeat(${orders.length},1fr);margin-bottom:8px;">${btns}</div>
    <div class="meta" style="margin-bottom:4px;">グループとして保存:</div>
    <div class="squad-orders" style="grid-template-columns:repeat(9,1fr);margin-bottom:8px;">${groupSaveBtns}</div>
    <div class="meta" style="margin-bottom:4px;">グループを呼び出し:</div>
    <div class="squad-orders" style="grid-template-columns:repeat(9,1fr);">${groupRecallBtns}</div>
  `;
}

// per user request(移動先指定時にコマンドボックスが地図を覆って指定しづらいとの声を受けて
// 追加): 「移動」ボタン(各種ボックスのarmDirectMoveOrder呼び出し)を押した瞬間、詳細な
// コマンドボックスは閉じる(armDirectMoveOrder側でstate.commandBox=null済み)ので、代わりに
// この最小限のプロンプトだけを表示する。multi-select-boxと同じく画面下端に固定表示し、
// クリックした地点周辺を塞がない。
export function renderMoveOrderPrompt(){
  const box = document.getElementById('move-order-prompt');
  if(!box) return;
  if(!state.orderMode || state.orderMode.kind!=='direct-move'){ box.style.display = 'none'; return; }
  box.style.display = 'block';
  box.innerHTML = `
    <div class="meta" style="margin-bottom:8px;text-align:center;font-weight:700;">地点を指定せよ</div>
    <button class="btn" style="width:100%;" onclick="cancelDirectMoveOrder()">キャンセル</button>
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

// per user request(標高が実際どう影響するか分かりにくいとの声を受けて追加): 各部隊の
// 「標高: 高地/丘陵/低地」表示だけでは、それが与ダメージ/被ダメージに具体的にどう効いて
// いるのか(altitudeBonus、±40%まで)が分からなかった。hunt中の目標があればそれ、なければ
// 射程内で最も近い視認済みの目標との標高差から、実際に生じている倍率をパーセントで添える。
// 比較対象になる目標がなければ空文字(標高ラベルだけを表示)。
function altitudeEffectNote(x, y, engageRangeUnits, huntTargetId, targetTypeGate){
  let target = huntTargetId ? state.targets.find(t=>t.id===huntTargetId && !t.destroyed) : null;
  if(!target){
    let bestDist = Infinity;
    state.targets.forEach(t=>{
      if(t.destroyed || !t.revealed) return;
      if(targetTypeGate && !targetTypeGate(t)) return;
      const range = typeof engageRangeUnits==='function' ? engageRangeUnits(t) : engageRangeUnits;
      const d = Math.hypot(t.trueX-x, t.trueY-y);
      if(d<=range && d<bestDist){ bestDist=d; target=t; }
    });
  }
  if(!target) return '';
  const fmt = p => (p>=0?'+':'')+p+'%';
  const outPct = Math.round((altitudeBonus(x, y, target.trueX, target.trueY)-1)*100);
  const inPct = Math.round((altitudeBonus(target.trueX, target.trueY, x, y)-1)*100);
  return ` (対${target.id}: 与${fmt(outPct)}/被${fmt(inPct)})`;
}

// per user request: 部隊自身の指令ボックスから直接、目標を選んで攻撃を指示できるように --
// 従来は一度このボックスを閉じて敵側のパネル(renderEnemyCommandBox)を開き直す必要が
// あった。距離/射程の表示・並び替え(射程内を先、距離が近い順)は敵パネルと同じロジック。
// 小隊/戦車/対戦車/対空へのhunt指示は射程外でも受け付ける(接敵まで前進する)ので、
// 射程外の行はボタン自体は押せるまま薄く表示するだけに留める。
function huntTargetListHtml(idx, unit, engageRangeUnits, assignFnName, targetTypeGate, activeTargetId){
  const candidates = state.targets.filter(t=>!t.destroyed && t.revealed && targetTypeGate(t));
  if(!candidates.length) return '<div class="empty-hint" style="padding:4px 0;">捕捉中の目標がありません</div>';
  // per user request(対戦車の対空ウェポン追加): engageRangeUnitsは固定値の他、対象ごとに
  // 射程が異なるユニット(主兵装/副武装で射程が違う対戦車部隊)向けに関数も受け付ける。
  const rows = candidates.map(t=>{
    const rangeForTarget = typeof engageRangeUnits==='function' ? engageRangeUnits(t) : engageRangeUnits;
    const dist = Math.hypot(t.trueX-unit.x, t.trueY-unit.y);
    const outOfRange = dist > rangeForTarget;
    const distM = unitsToMeters(dist), rangeM = unitsToMeters(rangeForTarget);
    const active = activeTargetId===t.id;
    return {
      outOfRange, dist,
      html: `<button class="btn ${active?'active squad-order-btn':''} ${outOfRange?'range-out':''}" onclick="${assignFnName}(${idx},'${t.id}')">${t.id} ― ${t.revealed?t.def.label:'識別不能'}${active?'(攻撃中)':''}<span class="range-note">距離${distM}m ／ 射程${rangeM}m${outOfRange?' ・ 要接近':''}</span></button>`,
    };
  });
  const sorted = rows.slice().sort((a,b)=>(a.outOfRange-b.outOfRange)||(a.dist-b.dist));
  return `<div style="display:flex;flex-direction:column;gap:6px;max-height:180px;overflow-y:auto;">${sorted.map(r=>r.html).join('')}</div>`;
}

// per user request: 迫撃砲は「陣地から動かず、射程外だと発射自体ができない」既存仕様
// (mortarTooCloseToFire/mortarTooFarToFire)があるため、hunt系ユニットと違い射程外の
// 行はボタンを押せなくする(assignMortarFireの既存の却下ロジックと表示を揃える)。
function mortarTargetListHtml(idx, mortar){
  const candidates = state.targets.filter(t=>!t.destroyed && t.revealed);
  if(!candidates.length) return '<div class="empty-hint" style="padding:4px 0;">捕捉中の目標がありません</div>';
  const active = mortar.order==='fire' && mortar.pendingFire && mortar.pendingFire.snappedId;
  const rows = candidates.map(t=>{
    const dist = Math.hypot(t.trueX-mortar.x, t.trueY-mortar.y);
    const tooClose = mortarTooCloseToFire(mortar, t.trueX, t.trueY);
    const tooFar = mortarTooFarToFire(mortar, t.trueX, t.trueY);
    const disabled = mortarNotReadyToFire(mortar) || tooClose || tooFar;
    const distM = unitsToMeters(dist);
    const reason = tooClose ? '近すぎ' : tooFar ? '射程外' : null;
    const isActive = active===t.id;
    // per user request(斥候の効果を分かりやすく): 目標選択の時点で、斥候の観測圏内にあるか
    // (=命中率補正が掛かるか)を一目で分かるようにする。
    const observedNote = isObservedByScout(t.trueX, t.trueY) ? ' <span style="color:#e0b84a;">👁観測中</span>' : '';
    return {
      outOfRange: disabled, dist,
      html: `<button class="btn ${isActive?'active squad-order-btn':''} ${disabled?'range-out':''}" ${disabled?'disabled':''} onclick="assignMortarFire(${idx},'${t.id}')">${t.id} ― ${t.revealed?t.def.label:'識別不能'}${isActive?'(照準中)':''}${observedNote}<span class="range-note">距離${distM}m ／ 射程${MORTAR_MIN_RANGE_M}-${MORTAR_MAX_RANGE_M}m${reason?` ・ ${reason}`:''}</span></button>`,
    };
  });
  const sorted = rows.slice().sort((a,b)=>(a.outOfRange-b.outOfRange)||(a.dist-b.dist));
  return `<div style="display:flex;flex-direction:column;gap:6px;max-height:180px;overflow-y:auto;">${sorted.map(r=>r.html).join('')}</div>`;
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
    else if(mortar.pendingDest){
      // per user request: relocating now takes real time on both ends -- 10s of packing up
      // before it actually starts moving, then another 10s after arrival before it can fire.
      const packingUp = mortar.moveDelayUntil!==undefined && performance.now() < mortar.moveDelayUntil;
      moveStatus = packingUp
        ? `撤収準備中(あと約${Math.ceil((mortar.moveDelayUntil-performance.now())/1000)}秒で移動開始)`
        : '陣地転換中…';
    }
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
          <div class="row1"><span class="id">${snapped.id}</span> ${typeHtml}</div>
          <div class="meta">本砲基準 方位${Math.round(e.bearing)}° / 距離${unitsToMeters(e.dist)}m</div>
          <div class="hpbar"><div style="width:${Math.max(0,snapped.hp/snapped.maxHp*100)}%"></div></div>
        </div>
      `;
    } else {
      const brg = bearingBetween(mortar.x, mortar.y, aim.x, aim.y);
      const dist = Math.hypot(aim.x-mortar.x, aim.y-mortar.y);
      const isDecoyAim = aim.decoyIdx!==undefined && aim.decoyIdx!==null;
      infoHtml = `<div class="sel-target-info"><div class="row1"><span class="id">${isDecoyAim ? `擬陣地${aim.decoyIdx+1}(座標既知)` : '自由射撃座標'}</span></div><div class="meta">方位約${Math.round(brg)}° / 距離約${unitsToMeters(dist)}m${isDecoyAim ? '' : '(未確認地点)'}</div></div>`;
    }
    // per user request: 10s of setup time after arriving from a relocation before it can fire.
    const notReady = mortarNotReadyToFire(mortar);
    const notReadyHtml = notReady
      ? `<div class="meta" style="color:var(--red);margin-bottom:6px;">陣地転換直後、射撃準備中(あと約${Math.ceil((mortar.fireReadyAt-performance.now())/1000)}秒)</div>`
      : '';
    bodyHtml = `
      ${notReadyHtml}
      <button class="btn ${armingTarget?'active squad-order-btn':''}" onclick="armMortarTargetOrder(${idx})" style="margin-bottom:8px;">攻撃地点設定</button>
      ${infoHtml}
      ${notReady ? '' : `<div class="meta" style="margin:8px 0 4px;">捕捉中の目標から選択:</div>${mortarTargetListHtml(idx, mortar)}`}
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

  // per user request: 工兵は迫撃砲も修理できるようにする -- 戦車/対戦車パネルと同じ導線
  // (無償・近接が必要な野戦修理)を迫撃砲パネルにも用意する。損傷時のみHPを表示する。
  const hpHtml = (!dead && mortar.hp<mortar.maxHp) ? `
    <div class="meta">HP: ${mortar.hp} / ${mortar.maxHp}</div>
    <div class="hpbar" style="margin-bottom:8px;"><div style="width:${Math.max(0,mortar.hp/mortar.maxHp*100)}%"></div></div>
  ` : '';
  const engineerBtns = (!dead && mortar.hp<mortar.maxHp) ? state.engineers.map((en,enIdx)=>{
    if(unitAliveCount(en)<=0 || en.resting) return '';
    const active = en.order==='repair' && en.repairTargetKind==='mortar' && en.repairTargetId===mortar.id;
    return `<button class="btn ${active?'active squad-order-btn':''}" onclick="assignEngineerRepair(${enIdx},'mortar',${idx})">工兵${enIdx+1}に修理させる(無償)${active?'(修理中)':''}</button>`;
  }).filter(Boolean).join('') : '';

  const menu = state.commandBoxMenu;
  return `
    <div class="squad-orders" style="grid-template-columns:repeat(3,1fr);margin-bottom:8px;">${stanceBtns}</div>
    ${hpHtml}
    ${cbWarnHtml}
    ${bodyHtml}
    ${exposureMetaHtml(getUnitExposure({kind:'mortar', idx}))}
    ${!dead ? categoryMenuHtml([
      {key:'mainline', label:'主線方位角'},
      {key:'other', label:'その他'},
    ]) : ''}
    ${!dead && menu==='mainline' ? `${BACK_TO_MENU_BTN}${mortarMainlineHtml(idx, mortar)}` : ''}
    ${!dead && menu==='other' ? `${BACK_TO_MENU_BTN}${engineerBtns ? `<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:6px;">${engineerBtns}</div>` : ''}${standingOrderSelectHtml('mortar', idx, mortar, false)}${crewHtml}` : ''}
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
    // per user request: 衛生小隊による蘇生(「真の医療コンセプト」)-- 負傷中(wounded)の兵は
    // 戦死(dead)とは別に、救護待ちであることが一目で分かるようバッジと残り猶予を表示する。
    const woundedBadge = (s.alive && s.wounded)
      ? `<span class="r-wounded-badge" title="衛生小隊の救護を待っている">🩹負傷 ― 手当まであと約${Math.max(0,Math.ceil((s.bleedOutAt-performance.now())/1000))}秒</span>`
      : '';
    const rowCls = !s.alive ? ' dead' : (s.wounded ? ' wounded' : '');
    return `<div class="roster-row${rowCls}"><span class="r-rank">${s.rank}</span><span class="r-name">${s.name}${vetBadge}</span>${woundedBadge}</div>`;
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
  const menu = state.commandBoxMenu;
  return `
    <div class="meta">${alive<=0?'戦闘不能':alive+'/'+scout.soldiers.length+'名'} ・ 標高: ${elevationLabel(elevationAt(scout.x,scout.y))} ・ 地形: ${terrainTypeLabel(terrainTypeAt(scout.x,scout.y))}</div>
    ${exposureMetaHtml(getUnitExposure({kind:'scout', idx}))}
    <div class="hpbar" style="margin-bottom:8px;"><div style="width:${Math.max(0,alive/scout.soldiers.length*100)}%"></div></div>
    ${categoryMenuHtml([
      {label:'移動', onclick:`armDirectMoveOrder('scout',${idx})`, disabled:dead},
      {key:'other', label:'その他'},
    ])}
    ${menu==='other' ? `${BACK_TO_MENU_BTN}${restButtonHtml('scout', idx, scout)}${soldierRosterHtml(scout.soldiers)}${reinforceButtonHtml('scout', idx, scout)}` : ''}
    <div class="meta" style="margin-top:6px;">${dead ? '移動先: 指定不可' : (scout.pendingDest ? '移動先: 設定済み(地図クリックで変更)' : '地図をクリックすると移動先を指定できます')}</div>
    ${scout.pendingDest ? `<button class="btn" style="margin-bottom:6px;" onclick="clearScoutOrder(${idx})">移動先を解除</button>` : ''}
  `;
}

// per user request(モバイル操作とマイクロマネジメント負荷の軽減): 工兵/衛生/補給隊は
// 戦闘用の既定行動(接敵時の防御/突撃、損耗時の後退)ではなく、「対象を毎回手動で選ばず、
// 最寄りの要対応先へ自動的に向かう」auto_assistのみを選択肢とする(applyEngineerAutoAssist/
// applyMedicAutoAssist/applySupplyAutoAssist、combat.js参照)。
const AUTO_ASSIST_KINDS = ['engineer', 'medic', 'supply'];

export function standingOrderSelectHtml(kind, idx, unit, allowAssault){
  const options = kind==='mortar' ? ['', 'auto_fire']
    : AUTO_ASSIST_KINDS.includes(kind)
    ? ['', 'auto_assist']
    : (allowAssault ? ['', 'contact_hold', 'contact_assault', 'low_hp_retreat'] : ['', 'contact_hold', 'low_hp_retreat']);
  const optionsHtml = options.map(v=>
    `<option value="${v}" ${(unit.standingOrder||'')===v?'selected':''}>${v?STANDING_ORDER_LABEL[v]:'なし(手動のみ)'}</option>`
  ).join('');
  // per user request(通信の要素): 電子妨害車両の圏内にいる間は既定行動が機能しないことを
  // ドロップダウンの直下に明示する(見えない原因で自動化が止まって困惑しないように)。
  const jamHtml = (unit.standingOrder && isJammed(unit.x, unit.y))
    ? `<div class="meta" style="color:var(--red);margin-bottom:6px;">⚠ 電波妨害の影響下 ― 既定行動が機能停止中</div>`
    : '';
  return `
    <div class="field" style="margin-bottom:6px;">
      <label>既定行動(自動反応)</label>
      <select onchange="setStandingOrder('${kind}',${idx},this.value)">${optionsHtml}</select>
    </div>
    ${jamHtml}
  `;
}

export function squadBoxHtml(idx){
  const sq = state.squads[idx];
  const alive = sq.soldiers.filter(s=>s.alive).length;
  const shaken = !!sq.shakenUntil;
  const wiped = alive===0 || sq.resting || shaken;
  const btns = ['advance','hold','assault','retreat'].map(o=>
    `<button class="btn squad-order-btn ${sq.order===o?'active':''}" ${wiped?'disabled':''} onclick="setSquadOrder(${idx},'${o}')">${ORDER_ICON[o]} ${ORDER_LABEL[o]}</button>`
  ).join('');
  const huntTarget = sq.huntTargetId ? state.targets.find(t=>t.id===sq.huntTargetId) : null;
  const huntStatus = (huntTarget && !huntTarget.destroyed)
    ? `攻撃目標: ${huntTarget.id} (${huntTarget.revealed?huntTarget.def.label:'識別不能'})`
    : null;
  const menu = state.commandBoxMenu;
  return `
    <div class="meta">${alive} / ${sq.soldiers.length}名 ・ 標高: ${elevationLabel(elevationAt(sq.x,sq.y))}${altitudeEffectNote(sq.x, sq.y, SQUAD_ENGAGE_RANGE, sq.huntTargetId, tt=>tt.type!=='heli'&&tt.type!=='drone')} ・ 地形: ${terrainTypeLabel(terrainTypeAt(sq.x,sq.y))}</div>
    ${shaken ? `<div class="meta" style="margin-bottom:6px;color:var(--red);font-weight:700;">⚠ 動揺・統制喪失中 ― 独断で後退中(命令不能、残り約${Math.max(0,Math.ceil((sq.shakenUntil-performance.now())/1000))}秒)</div>` : ''}
    ${exposureMetaHtml(getUnitExposure({kind:'squad', idx}))}
    ${categoryMenuHtml([
      {key:'order', label:'命令'},
      {label:'移動', onclick:`armDirectMoveOrder('squad',${idx})`, disabled:wiped},
      {key:'hunt', label:'攻撃目標'},
      {key:'other', label:'その他'},
    ])}
    ${menu==='order' ? `${BACK_TO_MENU_BTN}<div class="squad-orders" style="margin-bottom:6px;">${btns}</div>` : ''}
    ${menu==='hunt' ? `${BACK_TO_MENU_BTN}${huntStatus ? `<div class="meta" style="margin-bottom:4px;">${huntStatus}</div><button class="btn" style="margin-bottom:6px;" onclick="clearSquadHunt(${idx})">攻撃目標を解除</button>` : ''}${wiped ? '<div class="meta">交戦不能</div>' : huntTargetListHtml(idx, sq, SQUAD_ENGAGE_RANGE, 'assignSquadHunt', tt=>tt.type!=='heli'&&tt.type!=='drone', sq.huntTargetId)}` : ''}
    ${menu==='other' ? `${BACK_TO_MENU_BTN}${restButtonHtml('squad', idx, sq)}${standingOrderSelectHtml('squad', idx, sq, true)}${soldierRosterHtml(sq.soldiers)}${reinforceButtonHtml('squad', idx, sq)}` : ''}
    <div class="meta" style="margin-top:6px;">${wiped ? '移動先: 指定不可' : (sq.pendingDest ? '移動先: 設定済み(地図クリックで変更)' : '地図をクリックすると移動先を指定できます')}</div>
    ${sq.pendingDest ? `<button class="btn" style="margin-bottom:6px;" onclick="clearSquadDest(${idx})">移動先を解除</button>` : ''}
  `;
}

export function bandBoxHtml(idx){
  const band = state.bands[idx];
  const alive = band.soldiers.filter(s=>s.alive).length;
  const wiped = alive===0 || band.resting;
  const btns = ['advance','hold','assault','retreat'].map(o=>
    `<button class="btn squad-order-btn ${band.order===o?'active':''}" ${wiped?'disabled':''} onclick="setBandOrder(${idx},'${o}')">${ORDER_ICON[o]} ${ORDER_LABEL[o]}</button>`
  ).join('');
  const huntTarget = band.huntTargetId ? state.targets.find(t=>t.id===band.huntTargetId) : null;
  const huntStatus = (huntTarget && !huntTarget.destroyed)
    ? `攻撃目標: ${huntTarget.id} (${huntTarget.revealed?huntTarget.def.label:'識別不能'})`
    : null;
  const menu = state.commandBoxMenu;
  return `
    <div class="meta">${alive} / ${band.soldiers.length}名 ・ 標高: ${elevationLabel(elevationAt(band.x,band.y))}${altitudeEffectNote(band.x, band.y, BAND_ENGAGE_RANGE, band.huntTargetId, tt=>tt.type!=='heli'&&tt.type!=='drone')} ・ 地形: ${terrainTypeLabel(terrainTypeAt(band.x,band.y))}</div>
    <div class="meta" style="margin-bottom:6px;color:var(--muted);">近接戦闘専任(射程は小隊よりずっと短いが威力は高い) ― 本部警備が主任務</div>
    ${exposureMetaHtml(getUnitExposure({kind:'band', idx}))}
    ${categoryMenuHtml([
      {key:'order', label:'命令'},
      {label:'移動', onclick:`armDirectMoveOrder('band',${idx})`, disabled:wiped},
      {key:'hunt', label:'攻撃目標'},
      {key:'other', label:'その他'},
    ])}
    ${menu==='order' ? `${BACK_TO_MENU_BTN}<div class="squad-orders" style="margin-bottom:6px;">${btns}</div>` : ''}
    ${menu==='hunt' ? `${BACK_TO_MENU_BTN}${huntStatus ? `<div class="meta" style="margin-bottom:4px;">${huntStatus}</div><button class="btn" style="margin-bottom:6px;" onclick="clearBandHunt(${idx})">攻撃目標を解除</button>` : ''}${wiped ? '<div class="meta">交戦不能</div>' : huntTargetListHtml(idx, band, BAND_ENGAGE_RANGE, 'assignBandHunt', tt=>tt.type!=='heli'&&tt.type!=='drone', band.huntTargetId)}` : ''}
    ${menu==='other' ? `${BACK_TO_MENU_BTN}${restButtonHtml('band', idx, band)}${standingOrderSelectHtml('band', idx, band, true)}${soldierRosterHtml(band.soldiers)}${reinforceButtonHtml('band', idx, band)}` : ''}
    <div class="meta" style="margin-top:6px;">${wiped ? '移動先: 指定不可' : (band.pendingDest ? '移動先: 設定済み(地図クリックで変更)' : '地図をクリックすると移動先を指定できます')}</div>
    ${band.pendingDest ? `<button class="btn" style="margin-bottom:6px;" onclick="clearBandDest(${idx})">移動先を解除</button>` : ''}
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
  // per user request: 工兵による無償の野戦修理 -- 対象は既にこの戦車の修理に向かっている工兵か、
  // 待機中で修理可能な工兵のみ。応急修復(有償・即時)とは別の選択肢として併記する。
  const engineerBtns = tank.hp<tank.maxHp ? state.engineers.map((en,enIdx)=>{
    if(unitAliveCount(en)<=0 || en.resting) return '';
    const active = en.order==='repair' && en.repairTargetKind==='tank' && en.repairTargetId===tank.id;
    return `<button class="btn ${active?'active squad-order-btn':''}" onclick="assignEngineerRepair(${enIdx},'tank',${idx})">工兵${enIdx+1}に修理させる(無償)${active?'(修理中)':''}</button>`;
  }).filter(Boolean).join('') : '';
  const menu = state.commandBoxMenu;
  return `
    <div class="meta">HP: ${tank.hp} / ${tank.maxHp}</div>
    <div class="hpbar" style="margin-bottom:8px;"><div style="width:${Math.max(0,tank.hp/tank.maxHp*100)}%"></div></div>
    <div class="meta">標高: ${elevationLabel(elevationAt(tank.x,tank.y))}${altitudeEffectNote(tank.x, tank.y, TANK_ENGAGE_RANGE, tank.huntTargetId, tt=>tt.type!=='heli'&&tt.type!=='drone')} ・ 地形: ${terrainTypeLabel(terrainTypeAt(tank.x,tank.y))}</div>
    ${exposureMetaHtml(getUnitExposure({kind:'tank', idx}))}
    ${categoryMenuHtml([
      {key:'order', label:'命令'},
      {label:'移動', onclick:`armDirectMoveOrder('tank',${idx})`},
      {key:'hunt', label:'攻撃目標'},
      {key:'repair', label:'修理'},
    ])}
    ${menu==='order' ? `${BACK_TO_MENU_BTN}<div class="squad-orders" style="grid-template-columns:repeat(3,1fr);margin-bottom:6px;">${btns}</div>` : ''}
    ${menu==='hunt' ? `${BACK_TO_MENU_BTN}${huntStatus ? `<div class="meta" style="margin-bottom:4px;">${huntStatus}</div><button class="btn" style="margin-bottom:6px;" onclick="clearTankHunt(${idx})">攻撃目標を解除</button>` : ''}${huntTargetListHtml(idx, tank, TANK_ENGAGE_RANGE, 'assignTankHunt', tt=>tt.type!=='heli'&&tt.type!=='drone', tank.huntTargetId)}` : ''}
    ${menu==='repair' ? `${BACK_TO_MENU_BTN}<button class="btn" ${canRepair?'':'disabled'} onclick="repairTank(${idx})">応急修復(+${repairAmount}HP ・ ¥${repairCost})${tank.hp>=tank.maxHp?' ・ HP満タン':''}</button>${engineerBtns ? `<div style="display:flex;flex-direction:column;gap:6px;margin-top:6px;">${engineerBtns}</div>` : ''}` : ''}
    <div class="meta" style="margin-top:6px;">${tank.pendingDest ? '移動先: 設定済み(地図クリックで変更)' : '地図をクリックすると移動先を指定できます'}</div>
    ${tank.pendingDest ? `<button class="btn" style="margin-bottom:6px;" onclick="clearTankDest(${idx})">移動先を解除</button>` : ''}
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
  const menu = state.commandBoxMenu;
  return `
    <div class="meta">HP: ${sam.hp} / ${sam.maxHp}</div>
    <div class="hpbar" style="margin-bottom:8px;"><div style="width:${Math.max(0,sam.hp/sam.maxHp*100)}%"></div></div>
    <div class="meta">標高: ${elevationLabel(elevationAt(sam.x,sam.y))}${altitudeEffectNote(sam.x, sam.y, SAM_ENGAGE_RANGE, sam.huntTargetId, tt=>tt.type==='heli'||tt.type==='drone')} ・ 地形: ${terrainTypeLabel(terrainTypeAt(sam.x,sam.y))}</div>
    ${exposureMetaHtml(getUnitExposure({kind:'sam', idx}))}
    <div class="meta" style="margin-bottom:6px;color:var(--muted);">対空目標(ヘリ・ドローン)専任 ― 対地目標には交戦不可</div>
    ${categoryMenuHtml([
      {key:'order', label:'命令'},
      {label:'移動', onclick:`armDirectMoveOrder('sam',${idx})`},
      {key:'hunt', label:'攻撃目標'},
      {key:'repair', label:'修理'},
    ])}
    ${menu==='order' ? `${BACK_TO_MENU_BTN}<div class="squad-orders" style="grid-template-columns:repeat(3,1fr);margin-bottom:6px;">${btns}</div>` : ''}
    ${menu==='hunt' ? `${BACK_TO_MENU_BTN}${huntStatus ? `<div class="meta" style="margin-bottom:4px;">${huntStatus}</div><button class="btn" style="margin-bottom:6px;" onclick="clearSamHunt(${idx})">攻撃目標を解除</button>` : ''}${huntTargetListHtml(idx, sam, SAM_ENGAGE_RANGE, 'assignSamHunt', tt=>tt.type==='heli'||tt.type==='drone', sam.huntTargetId)}` : ''}
    ${menu==='repair' ? `${BACK_TO_MENU_BTN}<button class="btn" ${canRepair?'':'disabled'} onclick="repairSam(${idx})">応急修復(+${repairAmount}HP ・ ¥${repairCost})${sam.hp>=sam.maxHp?' ・ HP満タン':''}</button>` : ''}
    <div class="meta" style="margin-top:6px;">${sam.pendingDest ? '移動先: 設定済み(地図クリックで変更)' : '地図をクリックすると移動先を指定できます'}</div>
    ${sam.pendingDest ? `<button class="btn" style="margin-bottom:6px;" onclick="clearSamDest(${idx})">移動先を解除</button>` : ''}
  `;
}

export function engineerBoxHtml(idx){
  const en = state.engineers[idx];
  const alive = unitAliveCount(en);
  const dead = alive<=0;
  if(dead) return `<div class="empty-hint" style="padding:4px 0;color:var(--red);">全滅</div>`;
  const shaken = !!en.shakenUntil;
  const resting = en.resting || shaken;
  const btns = ['advance','hold','retreat'].map(o=>
    `<button class="btn squad-order-btn ${en.order===o?'active':''}" ${resting?'disabled':''} onclick="setEngineerOrder(${idx},'${o}')">${ORDER_ICON[o]} ${ORDER_LABEL[o]}</button>`
  ).join('');
  const armingWall = state.orderMode && state.orderMode.kind==='wall-build' && state.orderMode.idx===idx;
  const armingTrench = state.orderMode && (state.orderMode.kind==='trench-build-p1' || state.orderMode.kind==='trench-build-p2') && state.orderMode.idx===idx;
  const destStatus = en.pendingDest ? '移動先: 設定済み(地図クリックで変更)' : '地図をクリックすると移動先を指定できます';
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
  // per user request: 工兵による戦車/対戦車/迫撃砲の野戦修理(無償・近接が必要) -- 応急修復
  // (有償・即時、各ユニット側パネル)とは別の手段として工兵側にも導線を用意する。迫撃砲も
  // 戦車/対戦車と同様にここへ統合(per user request: 工兵は迫撃砲も修理できるようにする)。
  const repairCandidates = [
    ...state.tanks.map((t,i)=>({kind:'tank', idx:i, unit:t, label:`戦車${t.id+1}`})),
    ...state.antitanks.map((t,i)=>({kind:'antitank', idx:i, unit:t, label:`対戦車${t.id+1}`})),
    ...state.mortars.map((t,i)=>({kind:'mortar', idx:i, unit:t, label:`迫撃砲${t.id+1}`})),
  ];
  const repairTargetEntry = en.repairTargetKind!=null && en.repairTargetId!=null
    ? repairCandidates.find(c=>c.kind===en.repairTargetKind && c.unit.id===en.repairTargetId)
    : null;
  const repairTarget = repairTargetEntry ? repairTargetEntry.unit : null;
  const repairableCandidates = repairCandidates.filter(c=>c.unit.hp>0 && c.unit.hp<c.unit.maxHp);
  const repairBtns = repairableCandidates.map(c=>{
    const active = en.order==='repair' && en.repairTargetKind===c.kind && en.repairTargetId===c.unit.id;
    return `<button class="btn ${active?'active squad-order-btn':''}" ${resting?'disabled':''} onclick="assignEngineerRepair(${idx},'${c.kind}',${c.idx})">${c.label}を修理${active?'(修理中)':''}</button>`;
  }).join('');
  const repairStatus = repairTarget
    ? `修理対象: ${repairTargetEntry.label} (HP ${Math.round(repairTarget.hp)}/${repairTarget.maxHp}) ・ 近接すると自動で回復`
    : (repairableCandidates.length ? '損傷した戦車・対戦車・迫撃砲を選んで無償で修理を指示できます(近接が必要)' : '損傷した装備はありません');
  const menu = state.commandBoxMenu;
  return `
    <div class="meta">${alive}/${en.soldiers.length}名</div>
    ${shaken ? `<div class="meta" style="margin-bottom:6px;color:var(--red);font-weight:700;">⚠ 動揺・統制喪失中 ― 独断で後退中(命令不能、残り約${Math.max(0,Math.ceil((en.shakenUntil-performance.now())/1000))}秒)</div>` : ''}
    ${exposureMetaHtml(getUnitExposure({kind:'engineer', idx}))}
    <div class="hpbar" style="margin-bottom:8px;"><div style="width:${Math.max(0,alive/en.soldiers.length*100)}%"></div></div>
    ${categoryMenuHtml([
      {key:'order', label:'命令'},
      {label:'移動', onclick:`armDirectMoveOrder('engineer',${idx})`, disabled:resting},
      {key:'build', label:'建設'},
      {key:'repair', label:'修理'},
      {key:'other', label:'その他'},
    ])}
    ${menu==='order' ? `${BACK_TO_MENU_BTN}<div class="squad-orders" style="grid-template-columns:repeat(3,1fr);margin-bottom:6px;">${btns}</div>` : ''}
    ${menu==='build' ? `${BACK_TO_MENU_BTN}
      <button class="btn ${armingWall?'active squad-order-btn':''}" ${resting||wallCapReached||wallMoneyShort?'disabled':''} style="width:100%;margin-bottom:4px;" onclick="armWallBuildOrder(${idx})">防壁を構築(¥${WALL_BUILD_COST}・地図で地点指定)</button>
      <div class="meta" style="margin-bottom:8px;">${wallStatus}</div>
      <button class="btn ${armingTrench?'active squad-order-btn':''}" ${resting||trenchCapReached||trenchMoneyShort?'disabled':''} style="width:100%;margin-bottom:4px;" onclick="armTrenchBuildOrder(${idx})">塹壕を構築(¥${TRENCH_BUILD_COST}・地図で始点→終点指定)</button>
      <div class="meta" style="margin-bottom:8px;">${trenchStatus}</div>
    ` : ''}
    ${menu==='repair' ? `${BACK_TO_MENU_BTN}${repairBtns ? `<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:6px;">${repairBtns}</div>` : ''}<div class="meta" style="margin-bottom:8px;">${repairStatus}</div>${repairTarget ? `<button class="btn" style="margin-bottom:8px;" onclick="clearEngineerRepair(${idx})">修理を解除</button>` : ''}` : ''}
    ${menu==='other' ? `${BACK_TO_MENU_BTN}${restButtonHtml('engineer', idx, en)}${standingOrderSelectHtml('engineer', idx, en, false)}${soldierRosterHtml(en.soldiers)}` : ''}
    <div class="meta" style="margin-top:6px;">${destStatus}</div>
    ${en.pendingDest ? `<button class="btn" style="margin-bottom:6px;" onclick="clearEngineerDest(${idx})">移動先を解除</button>` : ''}
  `;
}

export function supplyBoxHtml(idx){
  const su = state.supplies[idx];
  const alive = unitAliveCount(su);
  const dead = alive<=0;
  if(dead) return `<div class="empty-hint" style="padding:4px 0;color:var(--red);">全滅</div>`;
  const resting = su.resting;
  const btns = ['advance','hold','retreat'].map(o=>
    `<button class="btn squad-order-btn ${su.order===o?'active':''}" ${resting?'disabled':''} onclick="setSupplyOrder(${idx},'${o}')">${ORDER_ICON[o]} ${ORDER_LABEL[o]}</button>`
  ).join('');
  const destStatus = su.pendingDest ? '移動先: 設定済み(地図クリックで変更)' : '地図をクリックすると移動先を指定できます';
  // per user request: 補給隊 -- 対象小隊を指定すると解除するまで自動で本部⇔対象を往復する
  // (工兵の野戦修理/衛生小隊の蘇生と同じ「指定→解除するまで継続」の導線)。
  const supplyCandidates = state.squads.map((sq,i)=>({idx:i, unit:sq, label:`第${i+1}小隊`}));
  const targetEntry = su.supplyTargetId!=null
    ? supplyCandidates.find(c=>c.unit.id===su.supplyTargetId)
    : null;
  const needyCandidates = supplyCandidates.filter(c=>unitAlive(c.unit) && (c.unit.ammo===undefined || c.unit.ammo<c.unit.maxAmmo));
  const supplyBtns = needyCandidates.map(c=>{
    const active = su.order==='supply' && su.supplyTargetId===c.unit.id;
    return `<button class="btn ${active?'active squad-order-btn':''}" ${resting?'disabled':''} onclick="assignSupplyRun(${idx},${c.idx})">${c.label}へ補給${active?'(補給中)':''}</button>`;
  }).join('');
  const phaseLabel = su.supplyPhase==='toHq' ? '本部で補充中/移動中' : su.supplyPhase==='toTarget' ? '対象へ補給移動中' : '';
  const supplyStatus = targetEntry
    ? `補給対象: ${targetEntry.label} (弾薬 ${Math.round(targetEntry.unit.ammo!==undefined?targetEntry.unit.ammo:UNIT_AMMO_MAX)}/${targetEntry.unit.maxAmmo||UNIT_AMMO_MAX}) ・ 携行弾薬 ${Math.round(su.carry)}/${SUPPLY_CARRY_MAX} ・ ${phaseLabel}`
    : (needyCandidates.length ? '弾薬が不足している小隊を選んで補給を指示できます(解除するまで本部と自動往復)' : '弾薬不足の小隊はありません');
  const menu = state.commandBoxMenu;
  return `
    <div class="meta">${alive}/${su.soldiers.length}名</div>
    ${exposureMetaHtml(getUnitExposure({kind:'supply', idx}))}
    <div class="hpbar" style="margin-bottom:8px;"><div style="width:${Math.max(0,alive/su.soldiers.length*100)}%"></div></div>
    ${categoryMenuHtml([
      {key:'order', label:'命令'},
      {label:'移動', onclick:`armDirectMoveOrder('supply',${idx})`, disabled:resting},
      {key:'target', label:'補給対象'},
      {key:'other', label:'その他'},
    ])}
    ${menu==='order' ? `${BACK_TO_MENU_BTN}<div class="squad-orders" style="grid-template-columns:repeat(3,1fr);margin-bottom:6px;">${btns}</div>` : ''}
    ${menu==='target' ? `${BACK_TO_MENU_BTN}${supplyBtns ? `<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:6px;">${supplyBtns}</div>` : ''}<div class="meta" style="margin-bottom:8px;">${supplyStatus}</div>${targetEntry ? `<button class="btn" style="margin-bottom:8px;" onclick="clearSupplyRun(${idx})">補給を解除</button>` : ''}` : ''}
    ${menu==='other' ? `${BACK_TO_MENU_BTN}${restButtonHtml('supply', idx, su)}${standingOrderSelectHtml('supply', idx, su, false)}${soldierRosterHtml(su.soldiers)}` : ''}
    <div class="meta" style="margin-top:6px;">${destStatus}</div>
    ${su.pendingDest ? `<button class="btn" style="margin-bottom:6px;" onclick="clearSupplyDest(${idx})">移動先を解除</button>` : ''}
  `;
}

export function medicBoxHtml(idx){
  const me = state.medics[idx];
  const alive = unitAliveCount(me);
  const dead = alive<=0;
  if(dead) return `<div class="empty-hint" style="padding:4px 0;color:var(--red);">全滅</div>`;
  const resting = me.resting;
  const btns = ['advance','hold','retreat'].map(o=>
    `<button class="btn squad-order-btn ${me.order===o?'active':''}" ${resting?'disabled':''} onclick="setMedicOrder(${idx},'${o}')">${ORDER_ICON[o]} ${ORDER_LABEL[o]}</button>`
  ).join('');
  const destStatus = me.pendingDest ? '移動先: 設定済み(地図クリックで変更)' : '地図をクリックすると移動先を指定できます';
  // per user request: 衛生小隊による蘇生(「真の医療コンセプト」)-- 負傷者を抱える友軍ユニット
  // (小隊/斥候/工兵/他の衛生小隊)から選んで無償で救護を指示できる(工兵の野戦修理と同型の
  // 導線 -- see assignEngineerRepair/engineerBoxHtml)。
  const reviveCandidates = [
    ...state.squads.map((u,i)=>({kind:'squad', idx:i, unit:u, label:`第${i+1}小隊`})),
    ...state.scouts.map((u,i)=>({kind:'scout', idx:i, unit:u, label:`斥候${i+1}班`})),
    ...state.engineers.map((u,i)=>({kind:'engineer', idx:i, unit:u, label:'工兵小隊'})),
    ...state.medics.map((u,i)=>({kind:'medic', idx:i, unit:u, label:`衛生${i+1}小隊`})),
    ...state.bands.map((u,i)=>({kind:'band', idx:i, unit:u, label:'音楽隊'})),
  ].filter(c=>c.unit.soldiers.some(s=>s.alive && s.wounded));
  const reviveTargetEntry = me.reviveTargetKind!=null && me.reviveTargetIdx!=null
    ? reviveCandidates.find(c=>c.kind===me.reviveTargetKind && c.idx===me.reviveTargetIdx)
    : null;
  const reviveBtns = reviveCandidates.map(c=>{
    const woundedCount = c.unit.soldiers.filter(s=>s.alive && s.wounded).length;
    const active = me.order==='revive' && me.reviveTargetKind===c.kind && me.reviveTargetIdx===c.idx;
    return `<button class="btn ${active?'active squad-order-btn':''}" ${resting?'disabled':''} onclick="assignMedicRevive(${idx},'${c.kind}',${c.idx})">${c.label}を救護(負傷${woundedCount}名)${active?'(救護中)':''}</button>`;
  }).join('');
  const reviveStatus = reviveTargetEntry
    ? `救護対象: ${reviveTargetEntry.label} ・ 近接すると自動で処置開始`
    : (reviveCandidates.length ? '負傷者を抱える部隊を選んで無償で救護を指示できます(近接が必要)' : '救護を要する負傷者はいません');
  const menu = state.commandBoxMenu;
  return `
    <div class="meta">${alive}/${me.soldiers.length}名</div>
    ${exposureMetaHtml(getUnitExposure({kind:'medic', idx}))}
    <div class="hpbar" style="margin-bottom:8px;"><div style="width:${Math.max(0,alive/me.soldiers.length*100)}%"></div></div>
    ${categoryMenuHtml([
      {key:'order', label:'命令'},
      {label:'移動', onclick:`armDirectMoveOrder('medic',${idx})`, disabled:resting},
      {key:'target', label:'救護対象'},
      {key:'other', label:'その他'},
    ])}
    ${menu==='order' ? `${BACK_TO_MENU_BTN}<div class="squad-orders" style="grid-template-columns:repeat(3,1fr);margin-bottom:6px;">${btns}</div>` : ''}
    ${menu==='target' ? `${BACK_TO_MENU_BTN}${reviveBtns ? `<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:6px;">${reviveBtns}</div>` : ''}<div class="meta" style="margin-bottom:8px;">${reviveStatus}</div>${reviveTargetEntry ? `<button class="btn" style="margin-bottom:8px;" onclick="clearMedicRevive(${idx})">救護を解除</button>` : ''}` : ''}
    ${menu==='other' ? `${BACK_TO_MENU_BTN}${restButtonHtml('medic', idx, me)}${standingOrderSelectHtml('medic', idx, me, false)}${soldierRosterHtml(me.soldiers)}` : ''}
    <div class="meta" style="margin-top:6px;">${destStatus}</div>
    ${me.pendingDest ? `<button class="btn" style="margin-bottom:6px;" onclick="clearMedicDest(${idx})">移動先を解除</button>` : ''}
  `;
}

export function antitankBoxHtml(idx){
  const at = state.antitanks[idx];
  const dead = at.hp<=0;
  const btns = ['advance','hold','retreat'].map(o=>
    `<button class="btn squad-order-btn ${at.order===o?'active':''}" ${dead?'disabled':''} onclick="setAntitankOrder(${idx},'${o}')">${ORDER_ICON[o]} ${ORDER_LABEL[o]}</button>`
  ).join('');
  const huntTarget = at.huntTargetId ? state.targets.find(t=>t.id===at.huntTargetId) : null;
  const huntStatus = (huntTarget && !huntTarget.destroyed)
    ? `攻撃目標: ${huntTarget.id} (${huntTarget.revealed?huntTarget.def.label:'識別不能'})`
    : null;
  if(dead) return `<div class="empty-hint" style="padding:4px 0;color:var(--red);">撃破</div>`;
  const repairAmount = Math.min(ANTITANK_REPAIR_HP_PER_CALL, at.maxHp-at.hp);
  const repairCost = Math.round(ANTITANK_REPAIR_COST_PER_HP*repairAmount);
  const canRepair = at.hp<at.maxHp && state.money>=repairCost;
  const engineerBtns = at.hp<at.maxHp ? state.engineers.map((en,enIdx)=>{
    if(unitAliveCount(en)<=0 || en.resting) return '';
    const active = en.order==='repair' && en.repairTargetKind==='antitank' && en.repairTargetId===at.id;
    return `<button class="btn ${active?'active squad-order-btn':''}" onclick="assignEngineerRepair(${enIdx},'antitank',${idx})">工兵${enIdx+1}に修理させる(無償)${active?'(修理中)':''}</button>`;
  }).filter(Boolean).join('') : '';
  const menu = state.commandBoxMenu;
  return `
    <div class="meta">HP: ${at.hp} / ${at.maxHp}</div>
    <div class="hpbar" style="margin-bottom:8px;"><div style="width:${Math.max(0,at.hp/at.maxHp*100)}%"></div></div>
    <div class="meta">標高: ${elevationLabel(elevationAt(at.x,at.y))}${altitudeEffectNote(at.x, at.y, tt=>(tt.type==='vehicle'||tt.type==='at_gun')?ANTITANK_ENGAGE_RANGE:ANTITANK_AA_RANGE, at.huntTargetId, tt=>tt.type==='vehicle'||tt.type==='at_gun'||tt.type==='heli'||tt.type==='drone')} ・ 地形: ${terrainTypeLabel(terrainTypeAt(at.x,at.y))}</div>
    ${exposureMetaHtml(getUnitExposure({kind:'antitank', idx}))}
    <div class="meta" style="margin-bottom:6px;color:var(--muted);">対戦車ロケットランチャー(vehicle) + 対空自衛火器(heli/drone) ― 歩兵/砲兵には無力</div>
    ${categoryMenuHtml([
      {key:'order', label:'命令'},
      {label:'移動', onclick:`armDirectMoveOrder('antitank',${idx})`},
      {key:'hunt', label:'攻撃目標'},
      {key:'repair', label:'修理'},
    ])}
    ${menu==='order' ? `${BACK_TO_MENU_BTN}<div class="squad-orders" style="grid-template-columns:repeat(3,1fr);margin-bottom:6px;">${btns}</div>` : ''}
    ${menu==='hunt' ? `${BACK_TO_MENU_BTN}${huntStatus ? `<div class="meta" style="margin-bottom:4px;">${huntStatus}</div><button class="btn" style="margin-bottom:6px;" onclick="clearAntitankHunt(${idx})">攻撃目標を解除</button>` : ''}${huntTargetListHtml(idx, at, tt=>(tt.type==='vehicle'||tt.type==='at_gun')?ANTITANK_ENGAGE_RANGE:ANTITANK_AA_RANGE, 'assignAntitankHunt', tt=>tt.type==='vehicle'||tt.type==='at_gun'||tt.type==='heli'||tt.type==='drone', at.huntTargetId)}` : ''}
    ${menu==='repair' ? `${BACK_TO_MENU_BTN}<button class="btn" ${canRepair?'':'disabled'} onclick="repairAntitank(${idx})">応急修復(+${repairAmount}HP ・ ¥${repairCost})${at.hp>=at.maxHp?' ・ HP満タン':''}</button>${engineerBtns ? `<div style="display:flex;flex-direction:column;gap:6px;margin-top:6px;">${engineerBtns}</div>` : ''}` : ''}
    <div class="meta" style="margin-top:6px;">${at.pendingDest ? '移動先: 設定済み(地図クリックで変更)' : '地図をクリックすると移動先を指定できます'}</div>
    ${at.pendingDest ? `<button class="btn" style="margin-bottom:6px;" onclick="clearAntitankDest(${idx})">移動先を解除</button>` : ''}
  `;
}

// per user request(ドラクエ風の階層コマンドメニュー): renderCommandBox()はrenderThrottledForStep
// 経由で1秒間に何度も呼ばれる(戦闘中も同じユニットのボックスを開き続けられるため)ので、
// 呼ばれるたびにcommandBoxMenuをリセットしてしまうと選んだ大分類の中身を一切見られなくなる。
// 前回描画したユニット(kind:idx)と変わった時だけ(=別ユニットを選び直した/開き直した時だけ)
// トップレベルへ戻す。
let lastCommandBoxKey = null;

export function renderCommandBox(){
  const box = document.getElementById('command-box');
  if(!state.commandBox){ lastCommandBoxKey = null; box.style.display='none'; return; }
  const commandBoxKey = `${state.commandBox.kind}:${state.commandBox.idx}`;
  if(commandBoxKey !== lastCommandBoxKey){
    state.commandBoxMenu = null;
    lastCommandBoxKey = commandBoxKey;
  }
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
  } else if(kind==='antitank'){
    const at = state.antitanks[state.commandBox.idx];
    if(!at){ box.style.display='none'; return; }
    title = `対戦車${state.commandBox.idx+1}`;
    bodyHtml = antitankBoxHtml(state.commandBox.idx);
    pos = canvasToScreen(at._visX!==undefined?at._visX:at.x, at._visY!==undefined?at._visY:at.y);
  } else if(kind==='engineer'){
    const en = state.engineers[state.commandBox.idx];
    if(!en || !unitAlive(en)){ box.style.display='none'; return; }
    title = '工兵小隊';
    bodyHtml = engineerBoxHtml(state.commandBox.idx);
    pos = canvasToScreen(en._visX!==undefined?en._visX:en.x, en._visY!==undefined?en._visY:en.y);
  } else if(kind==='medic'){
    const me = state.medics[state.commandBox.idx];
    if(!me || !unitAlive(me)){ box.style.display='none'; return; }
    title = `衛生${state.commandBox.idx+1}小隊`;
    bodyHtml = medicBoxHtml(state.commandBox.idx);
    pos = canvasToScreen(me._visX!==undefined?me._visX:me.x, me._visY!==undefined?me._visY:me.y);
  } else if(kind==='band'){
    const band = state.bands[state.commandBox.idx];
    if(!band || !unitAlive(band)){ box.style.display='none'; return; }
    title = '音楽隊';
    bodyHtml = bandBoxHtml(state.commandBox.idx);
    pos = canvasToScreen(band._visX!==undefined?band._visX:band.x, band._visY!==undefined?band._visY:band.y);
  } else if(kind==='supply'){
    const su = state.supplies[state.commandBox.idx];
    if(!su || !unitAlive(su)){ box.style.display='none'; return; }
    title = `補給${state.commandBox.idx+1}`;
    bodyHtml = supplyBoxHtml(state.commandBox.idx);
    pos = canvasToScreen(su._visX!==undefined?su._visX:su.x, su._visY!==undefined?su._visY:su.y);
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

  // per user request: 攻撃部隊選択パネルに目標までの距離/射程を表示し、射程外のユニットを
  // 後方へ並べ替える -- 部隊数が増えるほど「どれを充てるのが妥当か」を一覧だけで判断
  // しづらくなっていたのに対応。小隊/戦車/対戦車/対空へのhunt指示は射程外でも受け付け
  // (接敵まで前進する既存仕様のまま)なので、射程外でもボタン自体は押せるが薄く表示する
  // だけに留める。迫撃砲だけは陣地から動かず射程外だと発射自体ができない
  // (assignMortarFireの既存の却下ロジックと同じmortarTooCloseToFire/mortarTooFarToFireで
  // 判定し、その場合はボタンを押せなくする)。
  const rangeNote = (distM, rangeLabel, extra)=>
    `<span class="range-note">距離${distM}m ／ 射程${rangeLabel}${extra?` ・ ${extra}`:''}</span>`;
  const huntRow = (kind, idx, unit, label, engageRangeUnits, onclickAttr)=>{
    const active = unit.order==='hunt' && unit.huntTargetId===t.id;
    const dist = Math.hypot(vx-unit.x, vy-unit.y);
    const outOfRange = dist > engageRangeUnits;
    const distM = unitsToMeters(dist), rangeM = unitsToMeters(engageRangeUnits);
    return {
      outOfRange,
      dist,
      html: `<button class="btn ${active?'active squad-order-btn':''} ${outOfRange?'range-out':''}" onclick="${onclickAttr}">${label}${active?'(攻撃中)':''}${rangeNote(distM, rangeM+'m', outOfRange?'要接近':null)}</button>`,
    };
  };
  const mortarRows = state.mortars.map((m,idx)=>{
    if(m.hp<=0) return null;
    const active = m.order==='fire' && m.pendingFire && m.pendingFire.snappedId===t.id;
    const dist = Math.hypot(vx-m.x, vy-m.y);
    const tooClose = mortarTooCloseToFire(m, vx, vy);
    const tooFar = mortarTooFarToFire(m, vx, vy);
    const disabled = !active && (tooClose || tooFar);
    const distM = unitsToMeters(dist);
    const reason = tooClose ? '近すぎ' : tooFar ? '射程外' : null;
    return {
      outOfRange: disabled,
      dist,
      html: `<button class="btn ${active?'active squad-order-btn':''} ${disabled?'range-out':''}" ${disabled?'disabled':''} onclick="assignMortarFire(${idx})">迫撃砲${idx+1}に攻撃させる${active?'(照準中)':''}${rangeNote(distM, `${MORTAR_MIN_RANGE_M}-${MORTAR_MAX_RANGE_M}m`, reason)}</button>`,
    };
  }).filter(Boolean);
  // per user request: 対地の直接照準兵器(小隊/戦車)はもはや対空目標(ヘリ・ドローン)を
  // 直接狙い撃てない -- 対空はSAM専任(下のsamBtns)。
  const isAirTarget = t.type==='heli' || t.type==='drone';
  const isVehicleTarget = t.type==='vehicle' || t.type==='at_gun';
  const squadRows = isAirTarget ? [] : state.squads.map((sq,idx)=>{
    if(!sq.soldiers.some(s=>s.alive)) return null;
    return huntRow('squad', idx, sq, `第${idx+1}小隊に攻撃させる`, SQUAD_ENGAGE_RANGE, `assignSquadHunt(${idx})`);
  }).filter(Boolean);
  const tankRows = isAirTarget ? [] : state.tanks.map((tank,idx)=>{
    if(tank.hp<=0) return null;
    return huntRow('tank', idx, tank, `戦車${idx+1}に攻撃させる`, TANK_ENGAGE_RANGE, `assignTankHunt(${idx})`);
  }).filter(Boolean);
  const samRows = !isAirTarget ? [] : state.sams.map((sam,idx)=>{
    if(sam.hp<=0) return null;
    return huntRow('sam', idx, sam, `対空${idx+1}に攻撃させる`, SAM_ENGAGE_RANGE, `assignSamHunt(${idx})`);
  }).filter(Boolean);
  // per user request: 対戦車部隊は主兵装(対戦車ロケットランチャー、vehicle専任)に加え、
  // 対空戦闘ウェポン(副武装、heli/drone向け・ANTITANK_AA_RANGE)も搭載する。
  const antitankRows = (!isVehicleTarget && !isAirTarget) ? [] : state.antitanks.map((at,idx)=>{
    if(at.hp<=0) return null;
    return huntRow('antitank', idx, at, `対戦車${idx+1}に攻撃させる`, isAirTarget ? ANTITANK_AA_RANGE : ANTITANK_ENGAGE_RANGE, `assignAntitankHunt(${idx})`);
  }).filter(Boolean);
  // 各兵科ごとに「射程内(使用可能)を先、距離が近い順」に並べ替える -- 射程情報を出す
  // だけでなく、一覧の並び自体が「どれが妥当か」の第一の判断材料になるようにする。
  const sortRows = rows => rows.slice().sort((a,b)=> (a.outOfRange-b.outOfRange) || (a.dist-b.dist));
  const allBtns = [mortarRows, tankRows, samRows, antitankRows, squadRows]
    .map(rows=>sortRows(rows).map(r=>r.html).join(''))
    .join('');
  box.innerHTML = `
    <div class="cb-head">
      <span class="cb-title">${t.id} ― ${t.revealed?t.def.label:'識別不能'}</span>
      <button class="cb-close" onclick="closeEnemyCommandBox()">×</button>
    </div>
    <div class="meta" style="margin-bottom:8px;">この目標を攻撃させるユニットを選択:</div>
    <div style="display:flex;flex-direction:column;gap:6px;">
      ${allBtns || '<div class="empty-hint" style="padding:4px 0;">出撃可能なユニットがありません</div>'}
    </div>
  `;
  positionCommandBox(box, pos, 230);
}

// per user request(モバイル操作とマイクロマネジメント負荷の軽減): 「対応が必要な
// ユニット」を一箇所で判定する共通関数。force-list-badgeの件数表示と、
// focusNextTroubledUnit()(input.js)の巡回ジャンプ先の両方がこれを使う。撃破/全滅済み
// (もう何も指示できない)ユニットは対象外 -- あくまで「今プレイヤーが手を打てる」ものだけを
// 拾う。
export function getTroubledUnits(){
  const list = [];
  if(state.hq.hp>0 && state.hq.hp/state.hq.maxHp<0.5) list.push({kind:'hq', idx:0, x:state.hq.x, y:state.hq.y});
  state.mortars.forEach((m,i)=>{ if(m.hp>0 && m.hp/m.maxHp<0.5) list.push({kind:'mortar', idx:i, x:m.x, y:m.y}); });
  state.tanks.forEach((tk,i)=>{ if(tk.hp>0 && tk.hp/tk.maxHp<0.5) list.push({kind:'tank', idx:i, x:tk.x, y:tk.y}); });
  state.sams.forEach((sam,i)=>{ if(sam.hp>0 && sam.hp/sam.maxHp<0.5) list.push({kind:'sam', idx:i, x:sam.x, y:sam.y}); });
  state.antitanks.forEach((at,i)=>{ if(at.hp>0 && at.hp/at.maxHp<0.5) list.push({kind:'antitank', idx:i, x:at.x, y:at.y}); });
  state.scouts.forEach((s,i)=>{ const a=unitAliveCount(s); if(a>0 && a/s.soldiers.length<0.5) list.push({kind:'scout', idx:i, x:s.x, y:s.y}); });
  state.squads.forEach((sq,i)=>{
    const a = sq.soldiers.filter(x=>x.alive).length;
    if(sq.shakenUntil || (a>0 && a/sq.soldiers.length<0.5)) list.push({kind:'squad', idx:i, x:sq.x, y:sq.y});
  });
  state.engineers.forEach((en,i)=>{
    const a = unitAliveCount(en);
    if(en.shakenUntil || (a>0 && a/en.soldiers.length<0.5)) list.push({kind:'engineer', idx:i, x:en.x, y:en.y});
  });
  state.medics.forEach((me,i)=>{ const a=unitAliveCount(me); if(a>0 && a/me.soldiers.length<0.5) list.push({kind:'medic', idx:i, x:me.x, y:me.y}); });
  state.bands.forEach((b,i)=>{ const a=unitAliveCount(b); if(a>0 && a/b.soldiers.length<0.5) list.push({kind:'band', idx:i, x:b.x, y:b.y}); });
  (state.supplies||[]).forEach((su,i)=>{ const a=unitAliveCount(su); if(a>0 && a/su.soldiers.length<0.5) list.push({kind:'supply', idx:i, x:su.x, y:su.y}); });
  return list;
}

export function renderStats(){
  document.querySelector('#stat-datetime .value').textContent = formatGameClock(gameClockNow());
  document.querySelector('#stat-stage .value').textContent = state.stage+' / '+STAGE_COUNT;
  document.querySelector('#stat-difficulty .value').textContent = DIFFICULTIES[state.difficulty].label;
  document.querySelector('#stat-weather .value').textContent = WEATHER_TYPES[state.weather].label;
  // per user request(地雷の存在を分かりやすく): 正確な位置は明かさないが、現在敷設されて
  // いる(state.mines、maybePlaceMine参照)推定数は常時把握できるようにする。
  document.querySelector('#stat-mines .value').textContent = (state.mines?state.mines.length:0);
  document.querySelector('#stat-achievements .value').textContent = unlockedAchievements.size+' / '+Object.keys(ACHIEVEMENTS).length;
  document.querySelector('#stat-turns .value').textContent = `${Math.floor(state.missionMinutes)}分`;
  document.querySelector('#stat-money .value').textContent = '¥'+state.money.toLocaleString();
  // per user request(ドラクエファン向け追加要素): 「ちいさなメダル」所持数の常時表示。
  document.querySelector('#stat-medals .value').textContent = (state.medals||0)+'枚';
  // per user request: enemies trickle in over the wave rather than all spawning at once --
  // still-queued reinforcements (state.pendingSpawns) count as "remaining" too, so this
  // doesn't read as a near-clear while most of the wave hasn't arrived yet.
  const remainingTargets = state.targets.filter(t=>!t.destroyed).length + (state.pendingSpawns?state.pendingSpawns.length:0);
  const targetsSpawnedTotal = state.targetsSpawnedTotal || remainingTargets;
  document.getElementById('stat-left').textContent = remainingTargets + ' / ' + targetsSpawnedTotal;
  const aliveMortarPersonnel = state.mortars.filter(m=>m.hp>0).length * MORTAR_CREW_SIZE;
  const aliveScoutPersonnel = state.scouts.reduce((s,sc)=>s+unitAliveCount(sc),0);
  const aliveSquadPersonnel = totalAliveSoldiers();
  const aliveEngineerPersonnel = state.engineers.reduce((s,en)=>s+en.soldiers.filter(x=>x.alive).length,0);
  const aliveTotal = aliveMortarPersonnel + aliveScoutPersonnel + aliveSquadPersonnel + aliveEngineerPersonnel + state.reserve;
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
  // per user request: 敵が攻めてくる際のバリエーション(WAVE_ARCHETYPES)の表示 -- ログの
  // 警告だけだと見落とされうるので、常時表示の敵状パネルにも編成名を出す。「混成部隊」
  // (balanced)は目立たせる情報が無いので表示しない。
  const archetypeBadge = (state.waveArchetype && state.waveArchetype!=='balanced' && state.waveArchetypeLabel)
    ? `<div class="eb-archetype">敵編成: ${state.waveArchetypeLabel}</div>` : '';
  document.getElementById('enemy-breakdown').innerHTML = archetypeBadge + (ebRows.length ? ebRows.join('') : '<div class="eb-empty">敵情報なし</div>');

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
  // (HQ was red, mortar amber, scout/squad green -- now all match this shared blue)
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
  state.antitanks.forEach((at,i)=>{
    rows.push(forceRow(`対戦車${i+1}`, at.hp/at.maxHp, at.hp>0?Math.round(at.hp/at.maxHp*100)+'%':'撃破', 'var(--blue-id)', 'antitank', i));
  });
  state.engineers.forEach((en,i)=>{
    const alive = en.soldiers.filter(s=>s.alive).length;
    rows.push(forceRow(`工${i+1}`, alive/en.soldiers.length, `${alive}/${en.soldiers.length}`, 'var(--blue-id)', 'engineer', i));
  });
  state.medics.forEach((me,i)=>{
    const alive = me.soldiers.filter(s=>s.alive).length;
    rows.push(forceRow(`衛生${i+1}`, alive/me.soldiers.length, `${alive}/${me.soldiers.length}`, 'var(--blue-id)', 'medic', i));
  });
  state.bands.forEach((band,i)=>{
    const alive = band.soldiers.filter(s=>s.alive).length;
    rows.push(forceRow(`音楽隊`, alive/band.soldiers.length, `${alive}/${band.soldiers.length}`, 'var(--blue-id)', 'band', i));
  });
  (state.supplies||[]).forEach((su,i)=>{
    const alive = su.soldiers.filter(s=>s.alive).length;
    rows.push(forceRow(`補給${i+1}`, alive/su.soldiers.length, `${alive}/${su.soldiers.length}`, 'var(--blue-id)', 'supply', i));
  });
  rows.push(forceRow('予備', state.reserve/RESERVE_SIZE, `${state.reserve}/${RESERVE_SIZE}`, 'var(--muted)'));
  document.getElementById('force-list').innerHTML = rows.join('');

  // per user request: this panel is collapsed by default and duplicates the on-map
  // per-unit attrition bars, so give the collapsed header a one-glance answer to "is
  // anything wrong" (below half strength, or shaken) instead of making the player expand
  // it just to find out nothing needs attention. The badge count and the "次の要対応部隊へ"
  // jump button (see focusNextTroubledUnit() in input.js) share this same list.
  const troubled = getTroubledUnits();
  document.getElementById('force-list-badge').textContent = troubled.length>0 ? `⚠ ${troubled.length}` : '';

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
    if(s.pendingDest) queued.push(`斥候${idx+1}: 移動`);
  });
  state.squads.forEach((sq,idx)=>{ if(sq.pendingDest) queued.push(`第${idx+1}小隊: 移動`); });
  state.antitanks.forEach((at,idx)=>{
    if(at.order==='hunt' && at.huntTargetId) queued.push(`対戦車${idx+1}: 攻撃`);
    else if(at.pendingDest) queued.push(`対戦車${idx+1}: 移動`);
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
        : kind==='antitank' ? state.antitanks[idx]
        : kind==='engineer' ? state.engineers[idx]
        : kind==='medic' ? state.medics[idx]
        : kind==='band' ? state.bands[idx]
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

// per user request: 毎WAVE開始時に画面中央へ「戦闘開始」を大きく3秒間表示する -- 戦闘を
// 止めない(pointer-events:noneの非ブロッキング演出、CSSのbattle-start-bannerクラス側で
// ポップイン→3秒キープ→フェードアウトのタイミングを管理)。
let battleStartBannerTimer = null;
// per user request: 敵全逃亡(ROUT)の演出にも同じバナーを流用 -- 第2引数variantで色違いの
// CSS修飾クラス(例:'rout'、'critical' -- 後者はtriggerDramaticMoment用)を付けられる
// ようにした(省略時は従来通りの琥珀色)。
export function showBattleStartBanner(text, variant){
  const el = document.getElementById('battle-start-banner');
  if(!el) return;
  el.innerHTML = `<span>${text || '戦闘開始'}</span>`;
  el.classList.remove('show', 'rout', 'critical');
  void el.offsetWidth; // force reflow so re-triggering the class restarts the CSS animation
  if(variant) el.classList.add(variant);
  el.classList.add('show');
  if(battleStartBannerTimer) clearTimeout(battleStartBannerTimer);
  battleStartBannerTimer = setTimeout(()=>{ el.classList.remove('show'); }, 3000);
}

// per user request(プレイヤーが驚くような演出): HQ危機・地雷奇襲などここぞという瞬間に
// 画面(地図部分のみ、HUDは対象外)を短く揺らす。showBattleStartBannerと同じ
// remove→reflow→addパターンで、連続発生時も毎回アニメーションを最初から再生する。
let screenShakeTimer = null;
export function triggerScreenShake(){
  const el = document.querySelector('.board-wrap');
  if(!el) return;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  if(screenShakeTimer) clearTimeout(screenShakeTimer);
  screenShakeTimer = setTimeout(()=>{ el.classList.remove('shake'); }, 500);
}

// per user request: 戦闘中いつでも選べる「降伏」-- 同WAVEを再挑戦(retryStage)、または
// ゲームをやめる(abandonSavedCampaign、既存の新規開始ボタンと同じ確認ダイアログ付き
// 破壊的操作)のどちらかを選べる。他のオーバーレイと同じ.overlay.showパターンなので、
// 表示中はmain.jsのloop()側で自動的に3D描画が止まる(anyOverlayShown()を参照)。
export function openSurrenderOverlay(){
  document.getElementById('surrender-overlay').classList.add('show');
}

export function closeSurrenderOverlay(){
  document.getElementById('surrender-overlay').classList.remove('show');
}


Object.assign(window, { renderMapSelectOverlay, renderMapSelectBody, selectMapSeed, renderDeploymentSelectBody, selectDeploymentMode, renderDecoySelectBody, selectDecoyMode, openShop, closeShop, renderShop, buyEquipment, buyAmmo, unlockFuze, exchangeMedals, toggleStatbar, toggleBoardNote, toggleDrawer, closeAllDrawers, toggleMapFullscreen, updateFullscreenBtnIcon, log, openSmartOrder, closeSmartOrder, smartOrderBack, smartOrderPickType, smartOrderPickScope, smartOrderPickAction, smartOrderPickTarget, smartOrderConfirmInstant, renderSmartOrder, hqBoxHtml, showWaveRewardChoice, chooseWaveReward, setOverlayAccent, showStageClear, proceedToShop, showGameClear, showStageFailed, renderMultiSelectBox, closeCommandBox, closeEnemyCommandBox, mortarBoxHtml, mortarMainlineHtml, updateFireConfigCancel, exposureMetaHtml, soldierRosterHtml, restButtonHtml, reinforceButtonHtml, scoutBoxHtml, standingOrderSelectHtml, squadBoxHtml, bandBoxHtml, tankBoxHtml, samBoxHtml, engineerBoxHtml, medicBoxHtml, supplyBoxHtml, antitankBoxHtml, renderCommandBox, positionCommandBox, renderEnemyCommandBox, getTroubledUnits, renderStats, renderDecisionPanel, closeDecoyCommandBox, renderDecoyCommandBox, repositionOpenCommandBoxes, anyOverlayShown, showBattleStartBanner, triggerScreenShake, openSurrenderOverlay, closeSurrenderOverlay });
