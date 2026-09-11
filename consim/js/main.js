// Split out of the former monolithic mortar_fdc_game.js.
import { loadAchievements } from './achievements.js';
import { renderAudioSettingsPanel } from './audio.js';
import { advanceSimulation, initGame, state } from './combat.js';
import { handleCanvasClick, handleMinimapClick, selectNextTarget, setupMapControls } from './input.js';
import { drawBoard, drawMinimap } from './render2d.js';
import { initThree, renderThreeFrame } from './three.js';
import { anyOverlayShown, renderCommandBox, renderDecisionPanel, renderDecoyCommandBox, renderEnemyCommandBox, renderMultiSelectBox, renderStats, repositionOpenCommandBoxes } from './ui.js';
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
  drawBoard();
}

export function loop(){
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

loop();


Object.assign(window, { render, loop });
