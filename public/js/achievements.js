// Split out of the former monolithic mortar_fdc_game.js.
import { ACHIEVEMENTS } from './constants.js';
import { log } from './ui.js';

export let unlockedAchievements = new Set();

export function loadAchievements(){
  try{
    const raw = localStorage.getItem('mortarFdcAchievements');
    if(raw) unlockedAchievements = new Set(JSON.parse(raw));
  }catch(e){}
}

export function saveAchievements(){
  try{ localStorage.setItem('mortarFdcAchievements', JSON.stringify([...unlockedAchievements])); }catch(e){}
}

export function unlockAchievement(key){
  if(unlockedAchievements.has(key)) return;
  unlockedAchievements.add(key);
  saveAchievements();
  const a = ACHIEVEMENTS[key];
  log('fdc','実績', `実績解除: ${a.label} ― ${a.desc}`);
  const chip = document.getElementById('stat-achievements');
  if(chip) chip.querySelector('.value').textContent = unlockedAchievements.size+' / '+Object.keys(ACHIEVEMENTS).length;
}

export function openAchievements(){
  const total = Object.keys(ACHIEVEMENTS).length;
  document.getElementById('achievements-progress').textContent = `解放 ${unlockedAchievements.size} / ${total}`;
  const body = document.getElementById('achievements-body');
  body.innerHTML = Object.keys(ACHIEVEMENTS).map(key=>{
    const a = ACHIEVEMENTS[key];
    const got = unlockedAchievements.has(key);
    return `
      <div class="shop-row ${got?'ach-unlocked':'ach-locked'}">
        <div><div class="label">${a.label}</div><div class="sub">${a.desc}</div></div>
        <div class="ach-status ${got?'unlocked':'locked'}">${got?'達成 ✓':'未達成'}</div>
      </div>
    `;
  }).join('');
  document.getElementById('achievements-overlay').classList.add('show');
}

export function closeAchievements(){
  document.getElementById('achievements-overlay').classList.remove('show');
}


Object.assign(window, { loadAchievements, saveAchievements, unlockAchievement, openAchievements, closeAchievements });
