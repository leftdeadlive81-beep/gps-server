// Split out of the former monolithic mortar_fdc_game.js.
import { loadAchievements } from './achievements.js';
import { renderAudioSettingsPanel } from './audio.js';
import { advanceSimulation, initGame, state, updateRevealed } from './combat.js';
import { handleCanvasClick, handleMinimapClick, selectNextTarget, setupMapControls } from './input.js';
import { drawBoard, drawMinimap } from './render2d.js';
import { initThree, renderThreeFrame } from './three.js';
import { anyOverlayShown, renderCommandBox, renderDecisionPanel, renderDecoyCommandBox, renderEnemyCommandBox, renderMultiSelectBox, renderStats, repositionOpenCommandBoxes } from './ui.js';
import { update3dEffects, updateEnemyTracers, updateImpactLights, updateProjectiles } from './vfx.js';

export function render(){
  state.targets.forEach(t=>{ delete t._detectedThisRender; });
  updateRevealed();
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
