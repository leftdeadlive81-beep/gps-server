// per user request: the game had no way to persist campaign progress across a page reload --
// only achievements/audio settings were saved (see achievements.js/audio.js). Every close of
// the tab lost money, roster, veteran soldiers, and wave progress, forcing a restart from WAVE 1
// even though the game is built around a 50-wave campaign with cross-wave progression (money,
// equipment, veteran XP). This module persists just the campaign-level fields -- not mid-battle
// state (targets/projectiles/UI state), which is too complex/risky to round-trip safely -- so
// the natural checkpoint is "the roster/economy as of the start of a wave", the same moment
// startStage() already snapshots for retryStage() (see state.stageStartSnapshot there).

const SAVE_KEY = 'mortarFdcCampaignSave';

const SAVE_VERSION = 1;

export function hasSavedCampaign(){
  try{
    return !!localStorage.getItem(SAVE_KEY);
  }catch(e){
    return false;
  }
}

// per user request: called every time a wave begins (including a retry) -- see startStage() in
// combat.js. Captures only the persistent campaign fields; anything not listed here (current
// battle's targets, UI overlay state, etc.) is intentionally left out.
export function saveCampaign(state){
  if(!state) return;
  try{
    const snap = {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      stage: state.stage,
      difficulty: state.difficulty,
      money: state.money,
      ammo: state.ammo,
      fuzeUnlocked: state.fuzeUnlocked,
      equipment: state.equipment,
      reserve: state.reserve,
      reserveRoster: state.reserveRoster,
      missionMinutes: state.missionMinutes,
      gameSpeed: state.gameSpeed,
      deploymentMode: state.deploymentMode,
      decoyPlacementMode: state.decoyPlacementMode,
      hq: state.hq,
      mortars: state.mortars,
      squads: state.squads,
      scouts: state.scouts,
      snipers: state.snipers,
      tanks: state.tanks,
      sams: state.sams,
      helis: state.helis,
      engineers: state.engineers,
      walls: state.walls,
      trenches: state.trenches,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(snap));
  }catch(e){
    // localStorage can throw (quota, private-mode restrictions) -- losing the save is not
    // worth crashing the game over.
  }
}

// per user request: returns the saved snapshot (or null if none/invalid/wrong version), for
// initGame() to apply onto a freshly-built default state before the setup overlay shows.
export function loadCampaign(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return null;
    const data = JSON.parse(raw);
    if(!data || data.version !== SAVE_VERSION) return null;
    return data;
  }catch(e){
    return null;
  }
}

export function clearCampaignSave(){
  try{
    localStorage.removeItem(SAVE_KEY);
  }catch(e){
    // ignore
  }
}

// per user request: applies a loaded snapshot's campaign fields onto a live state object
// (already built fresh by initGame()) -- only overwrites the fields the snapshot actually
// carries, so anything added to state's shape since the save was taken keeps its fresh default.
export function applySavedCampaign(state, saved){
  if(!state || !saved) return;
  const fields = [
    'stage','difficulty','money','ammo','fuzeUnlocked','equipment','reserve','reserveRoster',
    'missionMinutes','gameSpeed','deploymentMode','decoyPlacementMode',
    'hq','mortars','squads','scouts','snipers','tanks','sams','helis','engineers','walls','trenches',
  ];
  fields.forEach(f=>{
    if(saved[f]!==undefined) state[f] = saved[f];
  });
}

Object.assign(window, { hasSavedCampaign, saveCampaign, loadCampaign, clearCampaignSave, applySavedCampaign });
