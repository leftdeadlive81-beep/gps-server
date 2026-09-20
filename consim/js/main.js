// Split out of the former monolithic mortar_fdc_game.js.
import { loadAchievements } from './achievements.js';
import { renderAudioSettingsPanel } from './audio.js';
import { advanceSimulation, initGame, state } from './combat.js';
import { handleCanvasClick, handleMinimapClick, selectNextTarget, setupCameraPresetButton, setupFocusOwnForcesButton, setupMapControls } from './input.js';
import { drawBoard, drawMinimap } from './render2d.js';
import { initThree, renderThreeFrame } from './three.js';
import { anyOverlayShown, renderCommandBox, renderDecisionPanel, renderDecoyCommandBox, renderEnemyCommandBox, renderMoveOrderPrompt, renderMultiSelectBox, renderStats, repositionOpenCommandBoxes } from './ui.js';
import { update3dEffects, updateEnemyTracers, updateImpactLights, updateProjectiles } from './vfx.js';

// per user request: keep the screen from sleeping while a battle is actively running
// (state.simRunning) -- Screen Wake Lock is released by the browser whenever the tab
// is hidden, so it's re-requested on visibilitychange rather than assumed to persist.
let wakeLock = null;
let wakeLockWanted = false;

async function requestWakeLock(){
  if(!('wakeLock' in navigator)) return;
  try{
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', ()=>{ wakeLock = null; });
  }catch(e){
    wakeLock = null;
  }
}

function releaseWakeLock(){
  if(wakeLock){
    wakeLock.release().catch(()=>{});
    wakeLock = null;
  }
}

function syncWakeLock(){
  const wanted = !!(state && state.simRunning && !state.stageResolved);
  if(wanted === wakeLockWanted) return;
  wakeLockWanted = wanted;
  if(wanted) requestWakeLock(); else releaseWakeLock();
}

document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState==='visible' && wakeLockWanted && !wakeLock) requestWakeLock();
});

export function render(){
  renderStats();
  selectNextTarget();
  renderDecisionPanel();
  renderCommandBox();
  renderEnemyCommandBox();
  renderDecoyCommandBox();
  renderMultiSelectBox();
  renderMoveOrderPrompt();
  drawBoard();
}

// per user request(バグ調査: マップ画面が固まって以後一切更新されなくなる報告): この
// loop()自体、および内部で呼んでいるadvanceSimulation()(=全ての resolve* を含む毎ターンの
// シミュレーション全体)がrequestAnimationFrame(loop)の呼び出し「より前」にあり、間で何か
// 一つでも例外を投げると最終行のrequestAnimationFrame(loop)が二度と実行されず、ループ自体が
// 永久に停止する(render2d.jsのctx.arc()負の半径バグの記録にある通り、過去にも同種の
// フリーズが実際に起きている)。一方、コマンドボックス等のボタンはrender()を個別に直接
// 呼ぶ別経路なので、この停止の影響を受けず動き続ける -- 報告された「ボタンは反応するが
// マップだけ固まる」という症状と一致する。
// 広範なストレステスト(通常ターン数百回分、全確率イベントを高頻度化した状態での長時間
// 実行、対戦車部隊/戦車の撃破エフェクト、歩兵スプライトの全滅・破棄)では特定の再現手順は
// 見つからなかったが、根本原因のクラス(ループ本体のどこか一箇所でも未捕捉の例外が起きると
// 全体が完全に停止する、という設計そのもの)は明確なので、個別のバグを潰すより先に
// ループ自体を「1フレームで何が起きても次のフレームは必ず来る」よう堅牢化する。
let lastLoopErrorMsg = null, lastLoopErrorAt = 0;
export function loop(){
  try{
    advanceSimulation();
    updateProjectiles();
    updateEnemyTracers();
    update3dEffects();
    updateImpactLights();
    if(state){
      repositionOpenCommandBoxes();
    }
    if(!anyOverlayShown()){
      if(state) drawBoard();
      if(state) drawMinimap();
      renderThreeFrame();
    }
    syncWakeLock();
  }catch(e){
    // Rate-limit identical repeat errors (e.g. a bad state that keeps throwing every frame)
    // so this doesn't flood the console at 60fps -- one log per distinct message per 3s.
    const now = performance.now();
    if(e.message !== lastLoopErrorMsg || now-lastLoopErrorAt > 3000){
      lastLoopErrorMsg = e.message;
      lastLoopErrorAt = now;
      console.error('[loop] frame error (次フレームへ継続):', e);
    }
  }
  requestAnimationFrame(loop);
}

document.getElementById('board').addEventListener('click', handleCanvasClick);

document.getElementById('minimap').addEventListener('click', handleMinimapClick);

document.addEventListener('contextmenu', e=>e.preventDefault());

loadAchievements();

renderAudioSettingsPanel();

initThree();

initGame();

setupMapControls();

setupCameraPresetButton();

setupFocusOwnForcesButton();

loop();


Object.assign(window, { render, loop });
