// Split out of the former monolithic mortar_fdc_game.js.
import { BGM_TRACKS, SFX_SRC, audioSettings, bgmAudio, combatAudio } from './constants.js';
import { choice } from './utils.js';

export let bgmStarted = false;

export function loadAudioSettings(){
  try{
    const raw = localStorage.getItem('mortarFdcAudioSettings');
    if(raw) return Object.assign({bgmMuted:false, sfxMuted:false}, JSON.parse(raw));
  }catch(e){}
  return {bgmMuted:false, sfxMuted:false};
}

export function saveAudioSettings(){
  try{ localStorage.setItem('mortarFdcAudioSettings', JSON.stringify(audioSettings)); }catch(e){}
}

export function renderAudioSettingsPanel(){
  const el = document.getElementById('audio-settings-panel');
  if(!el) return;
  el.innerHTML = `
    <span class="audio-settings-label">音声設定</span>
    <button class="btn audio-toggle-btn ${audioSettings.bgmMuted?'':'active'}" onclick="toggleBgmMute()">BGM: ${audioSettings.bgmMuted?'OFF':'ON'}</button>
    <button class="btn audio-toggle-btn ${audioSettings.sfxMuted?'':'active'}" onclick="toggleSfxMute()">SE: ${audioSettings.sfxMuted?'OFF':'ON'}</button>
  `;
}

export function toggleBgmMute(){
  audioSettings.bgmMuted = !audioSettings.bgmMuted;
  saveAudioSettings();
  if(audioSettings.bgmMuted){
    bgmAudio.pause();
    combatAudio.pause();
  } else if(bgmStarted){
    bgmAudio.play().catch(()=>{});
  }
  renderAudioSettingsPanel();
}

export function toggleSfxMute(){
  audioSettings.sfxMuted = !audioSettings.sfxMuted;
  saveAudioSettings();
  renderAudioSettingsPanel();
}

export function pickWaveBgm(){
  bgmAudio.pause();
  bgmAudio.src = choice(BGM_TRACKS);
  if(bgmStarted && !audioSettings.bgmMuted) bgmAudio.play().catch(()=>{});
}

export function startBgm(){
  if(bgmStarted) return;
  bgmStarted = true;
  if(!bgmAudio.src) pickWaveBgm();
  if(!audioSettings.bgmMuted) bgmAudio.play().catch(()=>{});
}

export function playCombatAmbience(){
  if(audioSettings.bgmMuted) return;
  if(combatAudio.paused) combatAudio.play().catch(()=>{});
}

export function stopCombatAmbience(){
  if(!combatAudio.paused) combatAudio.pause();
}

export function playSfx(name, volume){
  if(audioSettings.sfxMuted) return;
  const src = SFX_SRC[name];
  if(!src) return;
  const a = new Audio(src);
  a.volume = volume!==undefined ? volume : 0.3;
  a.play().catch(()=>{});
}


Object.assign(window, { loadAudioSettings, saveAudioSettings, renderAudioSettingsPanel, toggleBgmMute, toggleSfxMute, pickWaveBgm, startBgm, playCombatAmbience, stopCombatAmbience, playSfx });
