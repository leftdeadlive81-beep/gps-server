const GAME_VERSION = '0.2';
const CANVAS_W = 1300, CANVAS_H = 460;
const OP_HOME_X = 90, OP_HOME_Y = 230;
const OP = {x: OP_HOME_X, y: OP_HOME_Y};
const HQ_X = 30, HQ_Y = 230;
const HQ_MAX_HP = 200;
const EXPOSURE_DEFAULT = 50;
// per user request: scouts should be found/hit by the enemy at only 20% of the previous rate.
// hitChanceFromExposure(EXPOSURE_DEFAULT) = (80-50)/100 = 30% -- solving (80-e)/100 = 30%*0.2 gives e=74.
const SCOUT_EXPOSURE = 74;
function hitChanceFromExposure(exposure){
  const e = clamp(exposure===undefined?EXPOSURE_DEFAULT:exposure, 1, 100);
  return clamp(80-e, 0, 100)/100;
}
function exposureNormalizedMult(exposure){
  return hitChanceFromExposure(exposure) / hitChanceFromExposure(EXPOSURE_DEFAULT);
}
const SCOUT_X = 230;
const SCOUT_UPPER_Y = 55;
const SCOUT_LOWER_Y = 405;
const INITIAL_DEPLOY_SPACING_MULT = 1.4; // widens the gap between units of the same type at first-wave deployment
const SCOUT_HALF_FOV_BASE = 22.5;
const SCOUT_HALF_FOV_WIDE = 32.5;
const PRICE_EQUIP = {armor:1200, optics:1000, wideView:900, extMag:800};
const REINFORCE_COST_PER_SOLDIER = 220;
const REINFORCE_MAX_PER_CALL = 2;

// per user request: a veteran system for retention -- soldiers (squad/scout/sniper, the
// front-line personnel with individual alive-state) who survive a wave gain XP; every
// VET_XP_PER_LEVEL waves survived earns a level, up to VET_MAX_LEVEL. Levels raise both
// survivability (folded into getUnitExposure, so it flows through every existing
// damage-avoidance path for free) and combat output (applied directly where each unit type
// deals damage). Losing a leveled-up soldier is a real loss, which is the point -- it's what
// makes keeping specific named soldiers alive matter run after run.
const VET_XP_PER_LEVEL = 3;
const VET_MAX_LEVEL = 5;
const VET_DMG_BONUS_PER_LEVEL = 0.04;
const VET_EXPOSURE_BONUS_PER_LEVEL = 5;

const ACHIEVEMENTS = {
  firstBlood:       {label:'初陣',         desc:'初めて目標を撃破する'},
  oneShotKill:      {label:'一撃必殺',     desc:'無傷の目標を1発の命中で撃破する'},
  mortarHunter:     {label:'対砲兵戦の達人', desc:'敵砲兵を撃破する'},
  flawlessStage:    {label:'無傷撃退',     desc:'指揮所・迫撃砲が無傷のままWAVEを撃退する'},
  perfectSquad:     {label:'完全掃討',     desc:'兵士を一人も失わずWAVEを撃退する'},
  ammoSaver:        {label:'弾薬節約家',   desc:'弾薬を半分以上残してWAVEを撃退する'},
  speedClear:       {label:'電撃戦',       desc:'少ないターン数でWAVEを撃退する'},
  ironWall:         {label:'鉄壁',         desc:'HPが20%以下から立て直しWAVEを撃退する'},
  millionaire:      {label:'戦時成金',     desc:'所持金¥5000に到達する'},
  campaignComplete: {label:'全WAVE制覇',   desc:'全50WAVEを耐え抜く'},
  veteranMaster:    {label:'歴戦の勇士',   desc:'兵士1名を最高練度(Lv.5)まで生き延びさせる'},
};

const WEATHER_TYPES = {
  clear: {label:'晴天', dispersionMult:1,    counterMult:1,    errMult:1,    tint:null,                desc:'視界良好、影響なし'},
  rain:  {label:'雨天', dispersionMult:1.35, counterMult:0.85, errMult:1.1,  tint:'rgba(90,130,170,0.10)', desc:'着弾散布拡大、敵反撃精度低下'},
  fog:   {label:'濃霧', dispersionMult:1.15, counterMult:0.8,  errMult:1.35, tint:'rgba(160,170,150,0.14)', desc:'索敵誤差拡大、双方視界不良'},
  night: {label:'夜間', dispersionMult:1.2,  counterMult:0.7,  errMult:1.2,  tint:'rgba(10,15,35,0.28)',    desc:'敵反撃頻度低下、照準精度も低下'},
};
const EQUIP_LABEL = {armor:'強化装甲', optics:'精密照準器', wideView:'広角観測機材', extMag:'予備弾倉'};
const FRIENDLY_INF_POS = {x: 350, y: 230};
const SNIPER_POS = {x: 290, y: 230};
const STAGE_COUNT = 50;
const PRICE_HE = 35;
const PRICE_HEAT = 70;
const PRICE_FUZE = 800;
const AMMO_PACK = 5;

const DIFFICULTIES = {
  // per user request: initial mortar ammo (HE/HEAT) is 5x what it used to be, across all difficulties
  easy: {
    label:'易しい', hpMult:0.85, counterMult:0.7, advanceMult:0.7, turnsMult:1.15,
    startMoney:400, startHe:100, startHeat:50, rewardMult:0.9,
  },
  normal: {
    label:'普通', hpMult:1, counterMult:1, advanceMult:1, turnsMult:1,
    startMoney:300, startHe:80, startHeat:40, rewardMult:1,
  },
  hard: {
    label:'難しい', hpMult:1.2, counterMult:1.3, advanceMult:1.25, turnsMult:0.9,
    startMoney:220, startHe:60, startHeat:30, rewardMult:1.15,
  },
};

// per user request: enemy symbols are unified to red (all four target types share the
// same mark color now, rather than a distinct hue per type); friendly units are unified
// to blue the same way (see HQ/mortar/scout/squad/sniper marker drawing in drawBoard).
const ENEMY_MARK_COLOR = '#c1453b';
const FRIENDLY_MARK_COLOR = '#6f9bbf';
// per user request: text labels attached to a unit/target symbol are unified to white for
// both sides, instead of inheriting each unit's identity color (red/blue/muted/etc.)
const LABEL_TEXT_COLOR = '#e8e3ce';
const TARGET_TYPES = {
  infantry:  {label:'歩兵',         hp:60,  radius:26, mark:ENEMY_MARK_COLOR},
  artillery: {label:'砲兵',         hp:100, radius:16, mark:ENEMY_MARK_COLOR},
  vehicle:   {label:'装甲車',       hp:95,  radius:18, mark:ENEMY_MARK_COLOR},
  drone:     {label:'ドローン',     hp:12,  radius:20, mark:ENEMY_MARK_COLOR},
};
const DRONE_INTRO_STAGE = 3;
const CONTOUR_LEVELS = [0.25, 0.5, 0.75, 1.0, 1.25];
const CONTOUR_CELL = 22;
const SHELLS = {he:'榴弾(HE)', heat:'対戦車榴弾(HEAT)', smoke:'発煙弾', marker:'マーカー弾', illum:'照明弾'};
const FUZES  = {impact:'着発信管', proximity:'近接信管', delay:'遅延信管'};
const COUNTER_CHANCE = {infantry:0.06, artillery:0.19, vehicle:0.05, drone:0.04};
const COUNTER_DAMAGE = {infantry:[4,9], artillery:[14,24], vehicle:[5,9], drone:[2,5]};
const VEHICLE_ASSAULT_RANGE = 100;
const VEHICLE_ASSAULT_DAMAGE = [10,18];
const DRONE_SPEED = 70;
const DRONE_DETONATE_RANGE = 38;
const DRONE_DETONATE_DAMAGE = [8,16];
const INFANTRY_DRONE_LAUNCH_CHANCE = 0.16/3; // per user request: drone spawn volume cut to 1/3
const INFANTRY_DRONE_COOLDOWN_TICKS = 3;
const INFANTRY_DRONE_SWARM_SIZE = [5, 8]; // a successful launch releases a whole swarm at once, not a single drone
const MINE_DAMAGE = [8,18];
const MINE_PLACEMENT_CHANCE = 0.12; // per enemy-turn resolution
const MINE_MAX_ACTIVE = 4;
const MERGE_HP_THRESHOLD = 0.4; // below this HP fraction, an enemy unit regroups toward the nearest surviving unit instead of advancing
const INFANTRY_DUEL_DMG_TO_ENEMY = [4,9];
const SQUAD_SIZE = 10;
const NUM_SQUADS = 4;
const SCOUT_SQUAD_SIZE = 5;
const NUM_SCOUTS = 3;
const SNIPER_SQUAD_SIZE = 5;
const NUM_SNIPERS = 3;
const MORTAR_CREW_SIZE = 5;
const NUM_MORTARS = 4;
const RESERVE_SIZE = 10;
// per user request: 擬陣地 (decoy positions) -- placed at the start of each wave (auto or
// manual, player's choice), these lure enemy indirect fire/vehicle assaults away from real
// assets (see the decoy lure weighting in nearestFriendlyAsset), more so at night. They have
// their own HP and can be destroyed. Since the player places them, their coordinates are
// known exactly -- selecting one lets a chosen mortar fire on that exact point (no
// spotting-error correction needed, unlike firing at an enemy target).
const MAX_DECOYS = 5;
const DECOY_MAX_HP = 50;
const DECOY_LURE_MULT_DAY = 0.6;
const DECOY_LURE_MULT_NIGHT = 0.3;
const DECOY_LONGPRESS_MS = 550;
const DECOY_LONGPRESS_MOVE_TOLERANCE_PX = 10;
// per user request: a wave-clear reward can add a whole new squad/scout team at runtime
// (see addNewSquad/addNewScout), so these can no longer be fixed constants -- they're
// recomputed from the live roster each time so the roster display/perfectSquad achievement
// stay correct after a bonus unit joins.
function totalSquadCapacity(){ return state.squads.reduce((s,sq)=>s+sq.soldiers.length, 0); }
function totalRosterCapacity(){
  return totalSquadCapacity()
    + state.scouts.reduce((s,sc)=>s+sc.soldiers.length, 0)
    + state.snipers.reduce((s,sn)=>s+sn.soldiers.length, 0)
    + state.mortars.length*MORTAR_CREW_SIZE
    + state.reserve;
}

const PERSONNEL_ROSTER = [
  {rank:'1等陸佐', name:'佐藤'},
  {rank:'2等陸佐', name:'鈴木'},
  {rank:'3等陸佐', name:'高橋'},
  {rank:'3等陸佐', name:'田中'},
  {rank:'1等陸尉', name:'伊藤'},
  {rank:'1等陸尉', name:'渡辺'},
  {rank:'1等陸尉', name:'山本'},
  {rank:'1等陸尉', name:'中村'},
  {rank:'2等陸尉', name:'小林'},
  {rank:'2等陸尉', name:'加藤'},
  {rank:'2等陸尉', name:'吉田'},
  {rank:'2等陸尉', name:'山田'},
  {rank:'2等陸尉', name:'佐々木'},
  {rank:'2等陸尉', name:'山口'},
  {rank:'3等陸尉', name:'松本'},
  {rank:'3等陸尉', name:'井上'},
  {rank:'3等陸尉', name:'木村'},
  {rank:'3等陸尉', name:'林'},
  {rank:'3等陸尉', name:'斎藤'},
  {rank:'3等陸尉', name:'清水'},
  {rank:'准陸尉', name:'山崎'},
  {rank:'准陸尉', name:'森'},
  {rank:'准陸尉', name:'池田'},
  {rank:'准陸尉', name:'橋本'},
  {rank:'陸曹長', name:'阿部'},
  {rank:'陸曹長', name:'石川'},
  {rank:'陸曹長', name:'山下'},
  {rank:'陸曹長', name:'中島'},
  {rank:'陸曹長', name:'石井'},
  {rank:'陸曹長', name:'小川'},
  {rank:'1等陸曹', name:'前田'},
  {rank:'1等陸曹', name:'岡田'},
  {rank:'1等陸曹', name:'長谷川'},
  {rank:'1等陸曹', name:'藤田'},
  {rank:'1等陸曹', name:'後藤'},
  {rank:'1等陸曹', name:'近藤'},
  {rank:'1等陸曹', name:'村上'},
  {rank:'1等陸曹', name:'遠藤'},
  {rank:'1等陸曹', name:'青木'},
  {rank:'1等陸曹', name:'坂本'},
  {rank:'1等陸曹', name:'斉藤'},
  {rank:'1等陸曹', name:'福田'},
  {rank:'1等陸曹', name:'太田'},
  {rank:'1等陸曹', name:'西村'},
  {rank:'2等陸曹', name:'藤井'},
  {rank:'2等陸曹', name:'岡本'},
  {rank:'2等陸曹', name:'松田'},
  {rank:'2等陸曹', name:'中川'},
  {rank:'2等陸曹', name:'中野'},
  {rank:'2等陸曹', name:'原田'},
  {rank:'2等陸曹', name:'小野'},
  {rank:'2等陸曹', name:'田村'},
  {rank:'2等陸曹', name:'竹内'},
  {rank:'2等陸曹', name:'金子'},
  {rank:'2等陸曹', name:'和田'},
  {rank:'2等陸曹', name:'中山'},
  {rank:'2等陸曹', name:'石田'},
  {rank:'2等陸曹', name:'上田'},
  {rank:'2等陸曹', name:'森田'},
  {rank:'2等陸曹', name:'平野'},
  {rank:'2等陸曹', name:'藤原'},
  {rank:'2等陸曹', name:'小島'},
  {rank:'2等陸曹', name:'松井'},
  {rank:'2等陸曹', name:'内田'},
  {rank:'3等陸曹', name:'河野'},
  {rank:'3等陸曹', name:'高木'},
  {rank:'3等陸曹', name:'安藤'},
  {rank:'3等陸曹', name:'谷口'},
  {rank:'3等陸曹', name:'大野'},
  {rank:'3等陸曹', name:'丸山'},
  {rank:'3等陸曹', name:'今井'},
  {rank:'3等陸曹', name:'高田'},
  {rank:'3等陸曹', name:'増田'},
  {rank:'3等陸曹', name:'三浦'},
  {rank:'3等陸曹', name:'藤本'},
  {rank:'3等陸曹', name:'村田'},
  {rank:'3等陸曹', name:'武田'},
  {rank:'3等陸曹', name:'上野'},
  {rank:'3等陸曹', name:'杉山'},
  {rank:'3等陸曹', name:'千葉'},
  {rank:'3等陸曹', name:'岩崎'},
  {rank:'3等陸曹', name:'松尾'},
  {rank:'3等陸曹', name:'菅原'},
  {rank:'3等陸曹', name:'木下'},
  {rank:'陸士長', name:'野口'},
  {rank:'陸士長', name:'松浦'},
  {rank:'陸士長', name:'大塚'},
  {rank:'陸士長', name:'落合'},
  {rank:'陸士長', name:'桜井'},
  {rank:'陸士長', name:'横山'},
  {rank:'陸士長', name:'宮崎'},
  {rank:'陸士長', name:'岡崎'},
  {rank:'陸士長', name:'平田'},
  {rank:'陸士長', name:'高山'},
  {rank:'1等陸士', name:'池上'},
  {rank:'1等陸士', name:'服部'},
  {rank:'1等陸士', name:'早川'},
  {rank:'1等陸士', name:'川口'},
  {rank:'1等陸士', name:'新井'},
  {rank:'1等陸士', name:'大西'},
];
function roundRobinDistribute(items, weights){
  const pools = weights.map(w=>({target:w, list:[]}));
  items.forEach(item=>{
    let best=null, bestShare=Infinity;
    pools.forEach(p=>{
      if(p.list.length>=p.target) return;
      const share = p.target>0 ? p.list.length/p.target : Infinity;
      if(share<bestShare){ bestShare=share; best=p; }
    });
    if(best) best.list.push(item);
  });
  return pools.map(p=>p.list);
}
const [ROSTER_MORTAR_POOL, ROSTER_SCOUT_POOL, ROSTER_SNIPER_POOL, ROSTER_SQUAD_POOL, ROSTER_RESERVE_INITIAL] =
  roundRobinDistribute(PERSONNEL_ROSTER, [
    MORTAR_CREW_SIZE*NUM_MORTARS, SCOUT_SQUAD_SIZE*NUM_SCOUTS, SNIPER_SQUAD_SIZE*NUM_SNIPERS,
    SQUAD_SIZE*NUM_SQUADS, RESERVE_SIZE,
  ]);
const ROSTER_MORTAR_CREWS = roundRobinDistribute(ROSTER_MORTAR_POOL, Array(NUM_MORTARS).fill(MORTAR_CREW_SIZE));
const ROSTER_SCOUT_TEAMS  = roundRobinDistribute(ROSTER_SCOUT_POOL, Array(NUM_SCOUTS).fill(SCOUT_SQUAD_SIZE));
const ROSTER_SNIPER_TEAMS = roundRobinDistribute(ROSTER_SNIPER_POOL, Array(NUM_SNIPERS).fill(SNIPER_SQUAD_SIZE));
const ROSTER_SQUADS = roundRobinDistribute(ROSTER_SQUAD_POOL, Array(NUM_SQUADS).fill(SQUAD_SIZE));
const FORMATION_OFFSETS = [
  {dx:-24,dy:-14},{dx:-8,dy:-16},{dx:8,dy:-16},{dx:24,dy:-14},{dx:-16,dy:-2},
  {dx:16,dy:-2},{dx:-24,dy:12},{dx:-8,dy:14},{dx:8,dy:14},{dx:24,dy:12},
];
const SCOUT_FORMATION_OFFSETS = [
  {dx:-14,dy:-8},{dx:0,dy:-12},{dx:14,dy:-8},{dx:-8,dy:9},{dx:8,dy:9},
];
const SNIPER_FORMATION_OFFSETS = [
  {dx:-14,dy:-8},{dx:0,dy:-12},{dx:14,dy:-8},{dx:-8,dy:9},{dx:8,dy:9},
];
const SCOUT_ADVANCE_LIMIT_X = 1100;
const SQUAD_RETREAT_LIMIT_X = 150;
const SQUAD_ADVANCE_LIMIT_X = 620;
const SQUAD_ASSAULT_LIMIT_X = 1150;
const SQUAD_ENGAGE_RANGE = 100;
const DETECTION_RANGE = {infantry:100, artillery:50};
const MAP_WIDTH_KM = 10;
const METERS_PER_UNIT = (MAP_WIDTH_KM*1000) / CANVAS_W;
const CONTACT_RANGE_M = 200;
const CONTACT_RANGE_UNITS = CONTACT_RANGE_M / METERS_PER_UNIT;
const SQUAD_FORCE_REVEAL_RANGE_M = 500;
const SQUAD_FORCE_REVEAL_RANGE_UNITS = SQUAD_FORCE_REVEAL_RANGE_M / METERS_PER_UNIT;
const ESTIMATE_MARKER_RADIUS_M = 500;
const ESTIMATE_MARKER_RADIUS_UNITS = ESTIMATE_MARKER_RADIUS_M / METERS_PER_UNIT;
// per user request: infantry's default anti-drone point defense -- any alive squad
// automatically fires on any drone within this radius, always active regardless of
// the squad's current order/standing order (see resolveSquadAntiDrone)
const SQUAD_ANTI_DRONE_RANGE_M = 200;
const SQUAD_ANTI_DRONE_RANGE_UNITS = SQUAD_ANTI_DRONE_RANGE_M / METERS_PER_UNIT;
const SQUAD_ANTI_DRONE_HIT_CHANCE = 0.65;
const SQUAD_ANTI_DRONE_DMG = [8,16];
// per user request: sniper effective range is 3x infantry's (squad) engagement range
const SNIPER_RANGE_UNITS = SQUAD_ENGAGE_RANGE * 3;
const SNIPER_RANGE_M = Math.round(SNIPER_RANGE_UNITS * METERS_PER_UNIT);
const SNIPER_AIM_RANGE_M = 2000;
const SNIPER_AIM_RANGE_UNITS = SNIPER_AIM_RANGE_M / METERS_PER_UNIT;
const SNIPER_AIM_LINE_WIDTH_M = 20;
const SNIPER_AIM_LINE_WIDTH_UNITS = SNIPER_AIM_LINE_WIDTH_M / METERS_PER_UNIT;
const SNIPER_DMG = [20,32];
// per user request: HP fraction at/below which a connecting sniper shot executes the target
// outright regardless of remaining HP (see sniperEngageTarget)
const SNIPER_EXECUTE_HP_THRESHOLD = 0.3;
// per user request: mortar's effective range (used for the 主線方位角 fan's length)
const MORTAR_MAINLINE_RANGE_M = 6000;
const MORTAR_MAINLINE_RANGE_UNITS = MORTAR_MAINLINE_RANGE_M / METERS_PER_UNIT;
const MORTAR_MAINLINE_HALF_FOV = 15; // degrees either side of the set azimuth (30 deg fan)
const SCOUT_MAX_RANGE_UNITS = 2000 / METERS_PER_UNIT;
const ROAD_SPEED_KMH = {vehicle:60, infantry:10, sniper:5, mortar:40, artillery:5};
const OFF_ROAD_SPEED_MULT = 0.7;
function kmhToUnitsPerTurn(kmh){ return (kmh*1000/60) / METERS_PER_UNIT; }
const VEHICLE_MOVE_CAP = kmhToUnitsPerTurn(ROAD_SPEED_KMH.vehicle);
const INFANTRY_MOVE_CAP = kmhToUnitsPerTurn(ROAD_SPEED_KMH.infantry);
const SNIPER_MOVE_CAP = kmhToUnitsPerTurn(ROAD_SPEED_KMH.sniper);
const MORTAR_MOVE_CAP = kmhToUnitsPerTurn(ROAD_SPEED_KMH.mortar);
const ARTILLERY_MOVE_CAP = kmhToUnitsPerTurn(ROAD_SPEED_KMH.artillery);
const ARTILLERY_STANDOFF_RANGE_M = 300; // artillery repositions closer but holds once within this range of its nearest target
const ARTILLERY_STANDOFF_RANGE_UNITS = ARTILLERY_STANDOFF_RANGE_M / METERS_PER_UNIT;
const KM_UNIT = 1000 / METERS_PER_UNIT;
const ENEMY_SPAWN_RANGE_M = 1500;
const ENEMY_SPAWN_RANGE_UNITS = ENEMY_SPAWN_RANGE_M / METERS_PER_UNIT;
const ENEMY_SPAWN_MARGIN = 25;
const ENEMY_SPAWN_MIN_X = CANVAS_W - ENEMY_SPAWN_RANGE_UNITS;
const ENEMY_SPAWN_MAX_X = CANVAS_W - ENEMY_SPAWN_MARGIN;
const SHELL_KILL_RADIUS_M = {he:100, heat:40};
const SHELL_KILL_RADIUS_UNITS = {
  he: SHELL_KILL_RADIUS_M.he / METERS_PER_UNIT,
  heat: SHELL_KILL_RADIUS_M.heat / METERS_PER_UNIT,
};
const SMOKE_RADIUS_M = 60;
const SMOKE_RADIUS_UNITS = SMOKE_RADIUS_M / METERS_PER_UNIT;
const SMOKE_DURATION_TURNS = 3;
// per user request: illumination round -- bursts high up, a light ball then drifts slowly
// down (ILLUM_FALL_DURATION, a real-time screen-space animation), lighting up the terrain
// in ILLUM_RADIUS_M below it for ILLUM_DURATION_TURNS turns (same turn-based persistence
// style as smoke clouds above).
const ILLUM_RADIUS_M = 200;
const ILLUM_RADIUS_UNITS = ILLUM_RADIUS_M / METERS_PER_UNIT;
const ILLUM_DURATION_TURNS = 3;
const ILLUM_BURST_HEIGHT = 130; // screen-space px the flare bursts at above its ground point
const ILLUM_FALL_DURATION = 3000; // ms to drift from burst height down to the ground
const MARKER_REVEAL_RADIUS_UNITS = CONTACT_RANGE_UNITS; // 200m, same as normal contact-reveal range
const MINE_TRIGGER_RADIUS_M = 20;
const MINE_TRIGGER_RADIUS_UNITS = MINE_TRIGGER_RADIUS_M / METERS_PER_UNIT;
const ROAD_NODE_SNAP_RADIUS_M = 60; // road points within this distance of each other merge into one graph node (bridges gaps from the earlier road-simplification pass and links crossing ways)
const ROAD_NODE_SNAP_RADIUS_UNITS = ROAD_NODE_SNAP_RADIUS_M / METERS_PER_UNIT;
// Balance pass: 140 (a prior request, meant to widen scatter after 15 felt like guaranteed
// hits) turned out to overshoot badly. For a 2D gaussian scatter, single-shot hit chance is
// 1-exp(-R^2/2*sigma^2); at sigma=140 that's only ~22% for HE (kill radius 100m) and ~4% for
// HEAT (kill radius 40m) even against a fully spotted target with zero aim bias -- both far
// below what a 2-3 round volley should reliably achieve. 60 brings HE to a healthy ~75%,
// while SHELL_DISPERSION_MULT below tightens HEAT specifically so anti-armor fire isn't left
// far worse off than HE just because its kill radius is smaller.
const MORTAR_DISPERSION_M = 60;
const MORTAR_DISPERSION_UNITS = MORTAR_DISPERSION_M / METERS_PER_UNIT;
// HEAT's kill radius (40m) is much tighter than HE's (100m), so sharing one dispersion value
// would leave anti-armor fire (~20% hit/shot at sigma=60) far less reliable than HE (~75%).
// Tightening HEAT's effective dispersion (sigma=60*0.6=36) brings it to ~46%/shot -- still
// harder to land than HE (fitting for a precision anti-armor round) but no longer a coin
// flip stacked three times over just to connect once.
const SHELL_DISPERSION_MULT = {heat:0.6};
// mortar crews correct fire onto a snapped (identified) target's true position by this
// fraction, on top of the raw (often much less accurate) spotted estimate -- halves the
// effective aiming bias specifically for mortar fire, without touching the shared
// bearingErr/distErr estimate used elsewhere (sniper aiming, the UI uncertainty circle,
// squad/sniper approach).
const MORTAR_FIRE_CORRECTION_FRAC = 0.75;
// per user request ("面白くなる要素" -> 対砲兵レーダー/Shoot & Scoot): firing repeatedly from the
// same position risks the enemy's counter-battery radar triangulating it. Once a mortar has
// fired more than MORTAR_CB_SHOTS_THRESHOLD volleys without relocating, each further volley
// risks detection; once detected the player has MORTAR_CB_WARN_TURNS turns to actually
// complete a relocation (see resolveOneMortarDecision's "陣地転換完了") before a guaranteed,
// heavy counter-battery strike lands on that mortar. Encourages shoot-and-scoot instead of
// parking a mortar in one spot for the whole stage.
const MORTAR_CB_SHOTS_THRESHOLD = 3;
const MORTAR_CB_DETECT_BASE = 0.3;
const MORTAR_CB_WARN_TURNS = 2;
const MORTAR_CB_STRIKE_DMG = [28, 42];
// per user request: switched from a frame-rate-dependent exponential lerp (which either
// visibly lagged behind combat at a low rate, or converged in a fraction of a decision
// interval and then sat frozen -- stutter-stepping in time with 自動's 0.5s auto-commit tick
// -- to a time-based tween matched to that same interval. Every call whose target has moved
// starts a fresh tween from the marker's current (possibly still in-flight) visual position
// to the new one, taking VISUAL_TWEEN_DURATION_MS of *wall-clock* time regardless of frame
// rate, so motion stays continuous for the whole gap between decisions and still finishes
// (tracers/destruction effects use the raw logical position, never _visX/_visY) essentially
// exactly when the next commit is due, matching auto-commit's cadence.
const VISUAL_TWEEN_DURATION_MS = 480;
function smoothstep01(t){ return t*t*(3-2*t); }
const SUPPRESSION_TURNS = 3;
const SUPPRESSION_NEARMISS_TURNS = 1;
const SUPPRESSION_COUNTER_MULT = 0.3;
const SUPPRESSION_DUEL_DMG_BONUS = 1.5;
const SUPPRESSION_CASUALTY_MULT = 0.4;
const SUPPRESSION_MOVE_MULT = 0.5;
function isSuppressed(t){ return (t.suppressed||0) > 0; }
const STANDING_ORDER_LABEL = {
  contact_hold: '接敵時: 防御',
  contact_assault: '接敵時: 突撃',
  low_hp_retreat: '損耗50%で後退',
};
function unitsToMeters(u){ return Math.round(u*METERS_PER_UNIT); }
function smoothVisualPos(obj, targetX, targetY){
  const now = performance.now();
  if(obj._visX===undefined || obj._visY===undefined){
    // First time this object is drawn -- no prior visual position to tween from, so it
    // simply appears at its real position instead of sliding in from nowhere.
    obj._visX = targetX; obj._visY = targetY;
    obj._tweenFromX = targetX; obj._tweenFromY = targetY;
    obj._tweenToX = targetX; obj._tweenToY = targetY;
    obj._tweenStartAt = now;
    return {x:obj._visX, y:obj._visY};
  }
  if(obj._tweenToX!==targetX || obj._tweenToY!==targetY){
    // The underlying logical position moved since the last tween's target -- start a new
    // tween from wherever the marker visually is *right now* (which may still be mid-tween)
    // so redirecting never pops/snaps.
    obj._tweenFromX = obj._visX; obj._tweenFromY = obj._visY;
    obj._tweenToX = targetX; obj._tweenToY = targetY;
    obj._tweenStartAt = now;
  }
  const t = clamp((now-obj._tweenStartAt)/VISUAL_TWEEN_DURATION_MS, 0, 1);
  const te = smoothstep01(t);
  obj._visX = obj._tweenFromX + (obj._tweenToX-obj._tweenFromX)*te;
  obj._visY = obj._tweenFromY + (obj._tweenToY-obj._tweenFromY)*te;
  return {x:obj._visX, y:obj._visY};
}
// per user request: enemy infantry is no longer a single fixed 6-man cluster --
// each infantry group now picks one of several formation shapes, and its soldier
// count is simply that shape's point count (see buildEnemyInfantryGroups).
const ENEMY_FORMATION_TEMPLATES = {
  box: [ // 密集方陣 (original tight cluster)
    {dx:-13,dy:-9},{dx:0,dy:-11},{dx:13,dy:-9},
    {dx:-13,dy:9},{dx:0,dy:11},{dx:13,dy:9},
  ],
  line: [ // 横一列 (line abreast)
    {dx:-27,dy:-3},{dx:-21,dy:2},{dx:-15,dy:-4},{dx:-9,dy:3},{dx:-3,dy:-2},
    {dx:3,dy:3},{dx:9,dy:-3},{dx:15,dy:2},{dx:21,dy:-2},{dx:27,dy:4},
  ],
  wedge: [ // 楔形 (wedge / arrowhead)
    {dx:0,dy:-14},
    {dx:-6,dy:-8},{dx:6,dy:-8},
    {dx:-12,dy:-2},{dx:12,dy:-2},
    {dx:-18,dy:4},{dx:18,dy:4},
    {dx:-24,dy:10},{dx:24,dy:10},
  ],
  column: [ // 単縦陣 (column)
    {dx:-2,dy:-18},{dx:2,dy:-13},{dx:-2,dy:-8},{dx:2,dy:-3},
    {dx:-2,dy:2},{dx:2,dy:7},{dx:-2,dy:12},{dx:2,dy:17},
  ],
  skirmish: [ // 散兵線 (loose scattered skirmish line)
    {dx:-22,dy:-10},{dx:-9,dy:-14},{dx:6,dy:-9},{dx:19,dy:-13},
    {dx:-26,dy:2},{dx:-11,dy:4},{dx:2,dy:-2},{dx:14,dy:3},{dx:25,dy:-1},
    {dx:-15,dy:13},{dx:0,dy:15},{dx:16,dy:12},
  ],
  echelon: [ // 梯形/千鳥 (staggered echelon)
    {dx:-24,dy:-10},{dx:-18,dy:-4},{dx:-12,dy:2},{dx:-6,dy:8},{dx:0,dy:14},
    {dx:6,dy:-10},{dx:12,dy:-4},{dx:18,dy:2},{dx:24,dy:8},{dx:30,dy:14},
  ],
};
const ENEMY_FORMATION_NAMES = Object.keys(ENEMY_FORMATION_TEMPLATES);
// per user request: individual soldier symbols were made bigger/easier to read -- this scales
// up each formation template's spacing to match, so the larger glyphs don't overlap.
const SOLDIER_FORMATION_SCALE = 1.4;
const ENEMY_FORMATION_BASE_SIZE = 6; // legacy single-squad size that TARGET_TYPES.infantry.hp was tuned against
// per user request: the old "3 units per wave" cap is gone -- enemy infantry now
// splits into several groups totalling roughly this many soldiers instead of one squad.
const ENEMY_INFANTRY_TOTAL_TARGET = 50;

function buildEnemyInfantryGroups(stage){
  // ramp up toward full strength over the first several stages rather than dropping
  // the whole ~50-soldier force on the player from stage 1
  const targetTotal = Math.min(ENEMY_INFANTRY_TOTAL_TARGET, 16 + stage*5);
  const groups = [];
  let total = 0;
  while(total < targetTotal){
    const name = choice(ENEMY_FORMATION_NAMES);
    groups.push({formationName:name, offsets:ENEMY_FORMATION_TEMPLATES[name]});
    total += ENEMY_FORMATION_TEMPLATES[name].length;
  }
  return groups;
}
const FIELD_MARGIN = 130;
const UNCERTAINTY_CIRCLE_CAP = 120;
const ORDER_LABEL = {advance:'前進', retreat:'後退', hold:'防御', assault:'突撃', hunt:'追跡攻撃'};
const MORTAR_ORDER_LABEL = {fire:'射撃', standby:'待機', move:'移動'};
const MORTAR_ZONE_MIN_X = 40, MORTAR_ZONE_MAX_X = 380;

function effectMultiplier(shell, fuze, type){
  if(type==='infantry'){
    if(shell==='he' && fuze==='proximity') return 2.5;
    if(shell==='he' && fuze==='impact') return 1.2;
    if(shell==='he' && fuze==='delay') return 0.8;
    return 0.4;
  }
  if(type==='vehicle'){
    if(shell==='heat' && fuze==='impact') return 2.5;
    if(shell==='heat') return 1.3;
    if(shell==='he' && fuze==='delay') return 0.7;
    return 0.4;
  }
  if(type==='artillery'){
    if(shell==='he' && fuze==='impact') return 2.5;
    if(shell==='he' && fuze==='delay') return 1.3;
    if(shell==='heat' && fuze==='impact') return 1.1;
    return 0.4;
  }
  if(type==='drone'){
    if(shell==='he' && fuze==='proximity') return 2.8;
    if(shell==='he' && fuze==='impact') return 1.0;
    if(shell==='heat') return 0.5;
    return 0.5;
  }
  return 0.5;
}

// per user request: firing at an identified target auto-loads the shell/fuze/round-count
// combo effectMultiplier() rates best for that target type, instead of just reusing whatever
// the mortar's panel was last left on. Falls back to 'impact' if the ideal fuze somehow isn't
// unlocked yet (impact is always unlocked, see selectDifficulty).
const MORTAR_BEST_LOADOUT = {
  infantry:  {shell:'he',   fuze:'proximity', count:3},
  vehicle:   {shell:'heat', fuze:'impact',    count:2},
  artillery: {shell:'he',   fuze:'impact',    count:2},
  drone:     {shell:'he',   fuze:'proximity', count:2},
};
function bestMortarLoadoutFor(type){
  const pick = MORTAR_BEST_LOADOUT[type] || {shell:'he', fuze:'impact', count:2};
  const fuze = state.fuzeUnlocked[pick.fuze] ? pick.fuze : 'impact';
  return {shell:pick.shell, fuze, count:pick.count};
}
function applyBestMortarLoadout(mortar, target){
  const loadout = bestMortarLoadoutFor(target.type);
  mortar.fireShell = loadout.shell;
  mortar.fireFuze = loadout.fuze;
  mortar.fireCount = loadout.count;
}

let state = null;
let ripples = [];
let projectiles = [];
let flashes = [];
let enemyTracers = [];
// per user request: a bigger "destroyed" flourish (explosion+debris, rising wreck smoke,
// a floating kill banner), shared by both sides -- see spawnDestructionEffect().
let debrisParticles = [];
let wreckSmokes = [];
let killBanners = [];

// per user request: friendly (our side only) infantry squad icon, drawn as a flat
// screen-space sprite via ctx.drawImage() at the marker's already-projected 2D point --
// never rotated/skewed to match the 3D camera's azimuth/tilt, so it always reads the same
// regardless of camera orientation (see the squad-marker block in drawBoard()).
const infantryIcon = new Image();
infantryIcon.src = 'icons/infant.png';
// per user request: same treatment for the mortar, sniper team, and scout markers.
const mortarIcon = new Image();
mortarIcon.src = 'icons/mortar.png';
const sniperIcon = new Image();
sniperIcon.src = 'icons/sniper.png';
const scoutIcon = new Image();
scoutIcon.src = 'icons/rcn.png';
// per user request: enemy infantry group icon.
const enemyInfantryIcon = new Image();
enemyInfantryIcon.src = 'icons/e-infant.png';
// Draws one of the custom unit-icon images centered at (cx,cy), flat in screen space (never
// rotated to match the 3D camera), height pinned to targetH with width following the source
// image's own aspect ratio. Grayed out when the unit has no survivors. Draws nothing (no
// fallback primitive) until the image itself has finished loading.
function drawUnitIcon(ctx, img, cx, cy, targetH, dead){
  if(!img.complete || !img.naturalWidth) return;
  const w = targetH * (img.naturalWidth/img.naturalHeight);
  ctx.save();
  if(dead) ctx.filter = 'grayscale(1) brightness(0.5)';
  ctx.drawImage(img, cx-w/2, cy-targetH/2, w, targetH);
  ctx.restore();
}

// per user request: BGM + sound effects. bgmAudio/combatAudio are single persistent,
// looping <audio> elements (started/stopped as state changes); one-shot sfx (explosion,
// mortar fire) each get a fresh Audio() instance per play so overlapping plays (several
// kills in one proximity-fuse burst, a multi-round mortar volley) don't cut each other off.
// .play() is wrapped in .catch(()=>{}) since browsers reject it until a user gesture has
// occurred -- selectDifficulty() (the player's first click) is what actually starts the BGM.
const SFX_SRC = {
  combat: 'audio/combat.mp3',
  explosion: 'audio/explosion.mp3',
  mortarFire: 'audio/mortar_fire.mp3',
  identify: 'audio/identify.mp3',
  fanfare: 'audio/fanfare.mp3',
};
// per user request: a second BGM track, randomly picked between the two whenever a wave
// starts (see pickWaveBgm(), called from startStage()) rather than one fixed track for
// the whole session.
const BGM_TRACKS = ['audio/bgm.mp3', 'audio/bgm2.mp3'];
const bgmAudio = new Audio();
bgmAudio.loop = true;
bgmAudio.volume = 0.175;
const combatAudio = new Audio(SFX_SRC.combat);
combatAudio.loop = true;
combatAudio.volume = 0.2;
let bgmStarted = false;

// per user request: a settings panel to mute BGM/SE independently, persisted across
// sessions the same way achievements are (see loadAchievements/saveAchievements below).
function loadAudioSettings(){
  try{
    const raw = localStorage.getItem('mortarFdcAudioSettings');
    if(raw) return Object.assign({bgmMuted:false, sfxMuted:false}, JSON.parse(raw));
  }catch(e){}
  return {bgmMuted:false, sfxMuted:false};
}
const audioSettings = loadAudioSettings();
function saveAudioSettings(){
  try{ localStorage.setItem('mortarFdcAudioSettings', JSON.stringify(audioSettings)); }catch(e){}
}
function renderAudioSettingsPanel(){
  const el = document.getElementById('audio-settings-panel');
  if(!el) return;
  el.innerHTML = `
    <span class="audio-settings-label">音声設定</span>
    <button class="btn audio-toggle-btn ${audioSettings.bgmMuted?'':'active'}" onclick="toggleBgmMute()">BGM: ${audioSettings.bgmMuted?'OFF':'ON'}</button>
    <button class="btn audio-toggle-btn ${audioSettings.sfxMuted?'':'active'}" onclick="toggleSfxMute()">SE: ${audioSettings.sfxMuted?'OFF':'ON'}</button>
  `;
}
function toggleBgmMute(){
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
function toggleSfxMute(){
  audioSettings.sfxMuted = !audioSettings.sfxMuted;
  saveAudioSettings();
  renderAudioSettingsPanel();
}

function pickWaveBgm(){
  bgmAudio.pause();
  bgmAudio.src = choice(BGM_TRACKS);
  if(bgmStarted && !audioSettings.bgmMuted) bgmAudio.play().catch(()=>{});
}
function startBgm(){
  if(bgmStarted) return;
  bgmStarted = true;
  if(!bgmAudio.src) pickWaveBgm();
  if(!audioSettings.bgmMuted) bgmAudio.play().catch(()=>{});
}
function playCombatAmbience(){
  if(audioSettings.bgmMuted) return;
  if(combatAudio.paused) combatAudio.play().catch(()=>{});
}
function stopCombatAmbience(){
  if(!combatAudio.paused) combatAudio.pause();
}
function playSfx(name, volume){
  if(audioSettings.sfxMuted) return;
  const src = SFX_SRC[name];
  if(!src) return;
  const a = new Audio(src);
  a.volume = volume!==undefined ? volume : 0.3;
  a.play().catch(()=>{});
}

const FLIGHT_DURATION = 700;
const LAUNCH_INTERVAL = 420;
const ARC_HEIGHT = 90;

function rnd(a,b){ return a + Math.random()*(b-a); }
function choice(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function gauss(){
  let u=1-Math.random(), v=Math.random();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
}
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }

function wanderPos(homeX, homeY, seed, radius, now){
  const a1 = now*0.0011 + seed*7.13;
  const a2 = now*0.0007 + seed*3.31;
  return {
    x: homeX + Math.sin(a1)*radius*0.6 + Math.sin(a2*1.7)*radius*0.4,
    y: homeY + Math.cos(a1*1.3)*radius*0.6 + Math.cos(a2)*radius*0.4,
  };
}

function makeSoldiers(people){
  return people.map((p,i)=>({id:i, alive:true, seed:Math.random()*1000, rank:p.rank, name:p.name, vetXp:0}));
}
function vetLevelOf(soldier){ return Math.min(VET_MAX_LEVEL, Math.floor((soldier.vetXp||0)/VET_XP_PER_LEVEL)); }
function unitAvgVetLevel(soldiers){
  const alive = soldiers.filter(s=>s.alive);
  if(!alive.length) return 0;
  return alive.reduce((sum,s)=>sum+vetLevelOf(s), 0) / alive.length;
}
function unitAliveCount(u){ return u.soldiers.filter(s=>s.alive).length; }

// per user request: one of the three wave-clear bonus choices adds a brand new squad/scout
// team, over and above the fixed NUM_SQUADS/NUM_SCOUTS the campaign starts with. Their roster
// is generated fresh (not drawn from state.reserveRoster, which stays reserved for replacing
// casualties in existing units via 予備兵力要請) so picking this bonus never quietly drains
// the reinforcement pool.
function makeFreshRoster(size, prefix){
  return Array.from({length:size}, (_,i)=>({rank:'2等陸士', name:`${prefix}${i+1}`}));
}
function addNewSquad(){
  const id = state.squads.length;
  state.squads.push({
    id, order:'hold', pendingDest:null, huntTargetId:null, standingOrder:null,
    x: FRIENDLY_INF_POS.x, y: clamp(FRIENDLY_INF_POS.y + rnd(-60,60), 30, CANVAS_H-30),
    soldiers: makeSoldiers(makeFreshRoster(SQUAD_SIZE, '新兵')),
    reinforceUsed:false, exposure: EXPOSURE_DEFAULT,
  });
  return id;
}
function addNewScout(){
  const id = state.scouts.length;
  state.scouts.push({
    id, x: SCOUT_X, y: clamp(SCOUT_UPPER_Y + rnd(0, SCOUT_LOWER_Y-SCOUT_UPPER_Y), 20, CANVAS_H-20),
    watchAngle: 90, soldiers: makeSoldiers(makeFreshRoster(SCOUT_SQUAD_SIZE, '新兵')),
    pendingDest:null, pendingReconTargetId:null, exposure: SCOUT_EXPOSURE,
  });
  return id;
}
function unitAlive(u){ return unitAliveCount(u) > 0; }

function initGame(){
  if(autoCommitTimer){ clearInterval(autoCommitTimer); autoCommitTimer = null; }
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('shop-overlay').classList.remove('show');
  state = {
    stage: 1,
    difficulty: 'normal',
    money: 0,
    ammo: {he:0, heat:0},
    fuzeUnlocked: {impact:true, proximity:false, delay:false},
    equipment: {armor:false, optics:false, wideView:false, extMag:false},
    mortars: Array.from({length:NUM_MORTARS}, (_,i)=>({
      id:i, x:OP_HOME_X, y:OP_HOME_Y+(i-(NUM_MORTARS-1)/2)*40, hp:100, maxHp:100,
      order:'standby', pendingFire:null, pendingDest:null,
      fireShell:'he', fireFuze:'impact', fireCount:2,
      mainlineAngle: null,
      shotsSinceMove: 0, cbWarnTurns: null,
      exposure: EXPOSURE_DEFAULT,
    })),
    squads: [],
    scouts: Array.from({length:NUM_SCOUTS}, (_,i)=>({
      id:i, x:SCOUT_X, y:SCOUT_UPPER_Y+i*40, watchAngle:90,
      soldiers: makeSoldiers(ROSTER_SCOUT_TEAMS[i]), pendingDest:null, pendingReconTargetId:null,
      exposure: SCOUT_EXPOSURE,
    })),
    snipers: [],
    hq: {x:HQ_X, y:HQ_Y, hp:HQ_MAX_HP, maxHp:HQ_MAX_HP, exposure:EXPOSURE_DEFAULT},
    reserve: RESERVE_SIZE,
    reserveRoster: ROSTER_RESERVE_INITIAL.slice(),
    orderMode: null,
    weather: 'clear',
    terrain: [],
    contours: null,
    roads: [],
    smokeClouds: [],
    illumFlares: [],
    mines: [],
    turns: 0,
    targets: [],
    selectedId: null,
    commandBox: null,
    enemyCommandBox: null,
    snipeMortarStrikesPending: 0,
    animating: false,
    stageResolved: false,
    deploymentMode: 'auto',
    placementPending: false,
    placementQueue: [],
    placementIndex: 0,
    decoys: [],
    decoyPlacementPending: false,
    decoyCommandBox: null,
  };
  ripples = []; projectiles = []; flashes = []; enemyTracers = [];
  debrisParticles = []; wreckSmokes = []; killBanners = [];
  document.getElementById('log').innerHTML='';
  log('sys', 'システム', `コンシム v${GAME_VERSION} 起動。難易度を選択せよ。`);
  renderDifficultyOverlay();
  document.getElementById('difficulty-overlay').classList.add('show');
}

function renderDifficultyOverlay(){
  const body = document.getElementById('difficulty-body');
  body.innerHTML = Object.keys(DIFFICULTIES).map(key=>{
    const d = DIFFICULTIES[key];
    return `
      <div class="shop-row">
        <div>
          <div class="label">${d.label}</div>
          <div class="sub">初期資金¥${d.startMoney} ・ 弾薬HE${d.startHe}/HEAT${d.startHeat} ・ 敵HP×${d.hpMult} ・ 反撃×${d.counterMult}</div>
        </div>
        <div class="actions"><button class="btn primary" onclick="selectDifficulty('${key}')">選択</button></div>
      </div>
    `;
  }).join('');
}

function selectDifficulty(key){
  const d = DIFFICULTIES[key];
  if(!d) return;
  state.difficulty = key;
  state.money = d.startMoney;
  state.ammo = {he:d.startHe, heat:d.startHeat};
  state.fuzeUnlocked = {impact:true, proximity:true, delay:true};
  document.getElementById('difficulty-overlay').classList.remove('show');
  log('sys','システム', `難易度「${d.label}」で作戦開始。全弾種・信管を装備済み。`);
  startBgm();
  openDeploymentChoice();
}

function openDeploymentChoice(){
  const body = document.getElementById('deployment-body');
  body.innerHTML = `
    <div class="shop-row">
      <div>
        <div class="label">自動配置</div>
        <div class="sub">既定の隊形で各ユニットを自動的に展開する</div>
      </div>
      <div class="actions"><button class="btn primary" onclick="chooseDeploymentMode('auto')">選択</button></div>
    </div>
    <div class="shop-row">
      <div>
        <div class="label">手動配置</div>
        <div class="sub">地図をクリックして全ユニットの初期位置を1つずつ指定する</div>
      </div>
      <div class="actions"><button class="btn primary" onclick="chooseDeploymentMode('manual')">選択</button></div>
    </div>
  `;
  document.getElementById('deployment-overlay').classList.add('show');
}

function chooseDeploymentMode(mode){
  state.deploymentMode = mode;
  document.getElementById('deployment-overlay').classList.remove('show');
  deployStage();
}

function pickTypesForCount(count, stage){
  // infantry is generated separately now (see buildEnemyInfantryGroups) as several
  // formation groups rather than one slot in this mixed pool
  const base = ['vehicle','artillery'];
  if(stage>=DRONE_INTRO_STAGE) base.push('drone');
  for(let i=base.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [base[i],base[j]] = [base[j],base[i]];
  }
  const types = base.slice(0, Math.min(count,base.length));
  while(types.length < count) types.push(choice(base));
  return types;
}

function generateSpots(n){
  const spots = [];
  let attempts = 0;
  while(spots.length < n && attempts < 500){
    attempts++;
    const p = {x: rnd(ENEMY_SPAWN_MIN_X, ENEMY_SPAWN_MAX_X), y: rnd(60, CANVAS_H-60)};
    const tooClose = spots.some(s => Math.hypot(s.x-p.x, s.y-p.y) < 110);
    if(!tooClose) spots.push(p);
  }
  while(spots.length < n) spots.push({x: rnd(ENEMY_SPAWN_MIN_X, ENEMY_SPAWN_MAX_X), y: rnd(60, CANVAS_H-60)});
  return spots;
}

function startStage(){
  const stage = state.stage;
  pickWaveBgm();
  state.terrain = generateTerrain();
  state.contours = computeContours();
  state.roads = REAL_ROADS_CANVAS;
  state.smokeClouds = [];
  state.illumFlares = [];
  state.mines = [];
  // per user request: no more flat "3 units per wave" cap -- infantry now spawns as
  // several formation groups (buildEnemyInfantryGroups) totalling ~50 soldiers, generated
  // independently from the small mixed pool of artillery/vehicle/drone below.
  const infantryGroups = buildEnemyInfantryGroups(stage);
  const otherCount = Math.min(2+Math.floor((stage-1)/3), 6);
  const diff = DIFFICULTIES[state.difficulty];
  const hpMult = (1 + (stage-1)*0.08) * diff.hpMult;
  state.weather = stage===1 ? 'clear' : choice(Object.keys(WEATHER_TYPES));
  const weather = WEATHER_TYPES[state.weather];
  const opticsMult = (state.equipment.optics ? 0.8 : 1) * weather.errMult;
  // per user request: eased the growth of observation error over stages -- both the base
  // error and its per-stage growth were roughly halved (bearing 45->30 base, +2->+1/stage;
  // distance 180->120 base, +8->+4/stage) so unguided fire misses by less at high stages.
  const bearingErrBase = (30 + (stage-1)*1) * opticsMult;
  const distErrBase = (120 + (stage-1)*4) * opticsMult;
  const totalCount = infantryGroups.length + otherCount;
  const spots = generateSpots(totalCount);
  const otherTypes = pickTypesForCount(otherCount, stage);

  const centroidX = spots.reduce((s,p)=>s+p.x,0)/spots.length;
  const centroidY = spots.reduce((s,p)=>s+p.y,0)/spots.length;

  const targets = spots.map((p,i)=>{
    const isInfantry = i < infantryGroups.length;
    const type = isInfantry ? 'infantry' : otherTypes[i-infantryGroups.length];
    const def = TARGET_TYPES[type];
    const group = isInfantry ? infantryGroups[i] : null;
    const squadSize = isInfantry ? group.offsets.length : 0;
    // per user request: each soldier in an infantry group is now tracked (and rendered)
    // individually rather than the group sharing one HP pool -- soldierMaxHp is the same
    // per-soldier baseline the old aggregate formula implied (def.hp / a 6-man squad).
    const soldierMaxHp = Math.max(1, Math.round((def.hp/ENEMY_FORMATION_BASE_SIZE) * hpMult));
    const hp = isInfantry
      ? soldierMaxHp * squadSize
      : Math.round(def.hp*hpMult);
    const dx = p.x-OP.x, dy = p.y-OP.y;
    const trueBearing = (Math.atan2(dx,-dy)*180/Math.PI+360)%360;
    const trueDistance = Math.sqrt(dx*dx+dy*dy);
    return {
      id: 'T'+(i+1),
      type, def,
      trueX:p.x, trueY:p.y,
      trueBearing, trueDistance,
      hp, maxHp: hp,
      destroyed:false,
      revealed:false,
      reconCount:0,
      bearingErr:bearingErrBase, distErr:distErrBase,
      bOffset: rnd(-1,1), dOffset: rnd(-1,1),
      impacts:[],
      // per-soldier state for this infantry group -- named "troops" (not "soldiers") to stay
      // visually distinct from the friendly-unit .soldiers shape ({alive,rank,name}) used on
      // state.squads/scouts/snipers/mortars, since this shape carries hp/maxHp instead.
      troops: isInfantry ? Array.from({length:squadSize},()=>({
        alive:true, hp:soldierMaxHp, maxHp:soldierMaxHp, seed:Math.random()*1000,
      })) : null,
      formationOffsets: isInfantry ? group.offsets : null,
      formationName: isInfantry ? group.formationName : null,
      // per user request: groups should read as scattered swarms converging rather than a
      // single wall advancing in lockstep -- each infantry group keeps its own pace.
      speedMult: isInfantry ? rnd(0.82, 1.18) : 1,
      suppressed: 0,
      exposure: EXPOSURE_DEFAULT,
    };
  });

  // Tear down every leftover 3D marker from whatever the previous state.targets held
  // (normally already empty via resolveEnemyTurn's pruning, but retryStage() can jump
  // here with a still-live previous wave abandoned mid-fight) so nothing orphaned lingers.
  if(state.targets){
    state.targets.forEach(t=>disposeMarker3d('target'+t.id));
  }
  state.targets = targets;
  // per user request: destroyed targets are now pruned from state.targets during the wave
  // (see resolveEnemyTurn) rather than staying in the array flagged destroyed, so anything
  // that needs "how many enemies has this wave thrown in total" (reward par, achievements,
  // the stat-left display, and drone ID generation below) must track it separately from
  // state.targets.length, which now only reflects the currently-live count.
  state.targetsSpawnedTotal = targets.length;
  state.selectedId = targets[0].id;
  state.turns = 0;

  // per user request: a fully wiped-out unit (squad/scout/sniper/mortar) no longer lingers
  // on the map as an inert "destroyed" marker into future waves -- discard it from the
  // roster entirely at wave transition. HQ isn't included here: HQ reaching 0 HP is an
  // immediate game-over (see checkEnd), so it can never still be at 0 HP by the time a new
  // wave starts. No-op on the very first call (stage 1), since these arrays don't exist yet.
  if(state.squads) state.squads = state.squads.filter(sq=>unitAlive(sq));
  if(state.scouts) state.scouts = state.scouts.filter(s=>unitAlive(s));
  if(state.snipers) state.snipers = state.snipers.filter(sn=>unitAlive(sn));
  if(state.mortars) state.mortars = state.mortars.filter(m=>m.hp>0);

  if(stage===1){
    // first wave ― fresh deployment at full roster strength
    state.scouts = Array.from({length:NUM_SCOUTS}, (_,i)=>{
      const scoutMidY = (SCOUT_UPPER_Y+SCOUT_LOWER_Y)/2;
      const scoutStep = (NUM_SCOUTS>1 ? (SCOUT_LOWER_Y-SCOUT_UPPER_Y)/(NUM_SCOUTS-1) : 0) * INITIAL_DEPLOY_SPACING_MULT;
      const sy = clamp(scoutMidY + (i-(NUM_SCOUTS-1)/2)*scoutStep, 20, CANVAS_H-20);
      return {
        id: i, x: SCOUT_X, y: sy,
        watchAngle: bearingBetween(SCOUT_X, sy, centroidX, centroidY),
        soldiers: makeSoldiers(ROSTER_SCOUT_TEAMS[i]), pendingDest: null, pendingReconTargetId: null,
        exposure: SCOUT_EXPOSURE,
      };
    });
    state.mortars = Array.from({length:NUM_MORTARS}, (_,i)=>({
      id:i, x:OP_HOME_X, y:clamp(OP_HOME_Y+(i-(NUM_MORTARS-1)/2)*40*INITIAL_DEPLOY_SPACING_MULT, 30, CANVAS_H-30), hp:100, maxHp:100,
      order:'standby', pendingFire:null, pendingDest:null,
      fireShell:'he', fireFuze:'impact', fireCount:2,
      mainlineAngle: null,
      shotsSinceMove: 0, cbWarnTurns: null,
      crew: ROSTER_MORTAR_CREWS[i],
      exposure: EXPOSURE_DEFAULT,
    }));
    state.squads = Array.from({length:NUM_SQUADS}, (_,si)=>({
      id: si,
      order: 'hold',
      pendingDest: null,
      huntTargetId: null,
      standingOrder: null,
      x: FRIENDLY_INF_POS.x,
      y: clamp(FRIENDLY_INF_POS.y + (si-(NUM_SQUADS-1)/2)*52*INITIAL_DEPLOY_SPACING_MULT, 30, CANVAS_H-30),
      soldiers: makeSoldiers(ROSTER_SQUADS[si]),
      reinforceUsed: false,
      exposure: EXPOSURE_DEFAULT,
    }));
    state.snipers = Array.from({length:NUM_SNIPERS}, (_,si)=>({
      id: si,
      order: 'hold',
      pendingDest: null,
      pendingSnipeTargetId: null,
      aimAngle: null,
      standingOrder: null,
      x: SNIPER_POS.x,
      y: clamp(SNIPER_POS.y + (si-(NUM_SNIPERS-1)/2)*52*INITIAL_DEPLOY_SPACING_MULT, 30, CANVAS_H-30),
      soldiers: makeSoldiers(ROSTER_SNIPER_TEAMS[si]),
      reinforceUsed: false,
      exposure: EXPOSURE_DEFAULT,
    }));
    state.hq = {x:HQ_X, y:HQ_Y, hp:HQ_MAX_HP, maxHp:HQ_MAX_HP, exposure:EXPOSURE_DEFAULT};
    state.reserve = RESERVE_SIZE;
    state.reserveRoster = ROSTER_RESERVE_INITIAL.slice();
  } else {
    // subsequent waves ― survivors continue from their current position (no
    // redeploy-to-formation-line reset); casualties, HQ/mortar damage, ammo
    // and reserve carry over as before. Orders/pending actions still clear
    // since a new wave needs fresh orders regardless of where units are standing.
    state.scouts.forEach(s=>{
      s.watchAngle = bearingBetween(s.x, s.y, centroidX, centroidY);
      s.pendingDest = null; s.pendingReconTargetId = null;
    });
    state.mortars.forEach(m=>{
      m.order = 'standby'; m.pendingFire = null; m.pendingDest = null; m.mainlineAngle = null; m.preAlertOrder = null;
    });
    state.squads.forEach(sq=>{
      sq.order = 'hold'; sq.pendingDest = null; sq.huntTargetId = null; sq.reinforceUsed = false; sq.preAlertOrder = null;
    });
    state.snipers.forEach(sn=>{
      sn.order = 'hold'; sn.pendingDest = null; sn.pendingSnipeTargetId = null; sn.aimAngle = null; sn.reinforceUsed = false; sn.preAlertOrder = null;
    });
  }
  state.alertLevel = null;
  state.animating = false;
  state.stageResolved = false;
  state.hpDroppedLow = false;
  state.orderMode = null;
  state.commandBox = null;
  state.enemyCommandBox = null;
  state.snipeMortarStrikesPending = 0;
  state.stageStartSnapshot = JSON.parse(JSON.stringify({
    ammo: state.ammo, turns: state.turns, reserve: state.reserve, reserveRoster: state.reserveRoster, hq: state.hq,
    mortars: state.mortars, squads: state.squads, scouts: state.scouts, snipers: state.snipers,
  }));
  ripples = []; projectiles = []; flashes = []; enemyTracers = [];
  debrisParticles = []; wreckSmokes = []; killBanners = [];

  document.getElementById('overlay').classList.remove('show');
  log('sys','システム', `WAVE ${stage} / ${STAGE_COUNT} ― 目標${totalCount}件を確認。天候: ${weather.label}(${weather.desc})。`);
  if(stage===1){
    const co = PERSONNEL_ROSTER[0];
    log('sys','司令部', `戦闘団編成完了、総員100名。総指揮官: ${co.rank} ${co.name}。`);
  }
  state.decoys = [];
  state.decoyPlacementPending = false;
  state.decoyCommandBox = null;
  if(state.deploymentMode === 'manual'){
    state.placementQueue = buildPlacementQueue();
    state.placementIndex = 0;
    state.placementPending = true;
    log('sys','司令部', '手動配置モード。地図をクリックして各ユニットの初期位置を順に指定せよ。');
  } else {
    state.placementPending = false;
    log('sys','システム', '作戦開始。');
    log('op','斥候', '前線に展開完了。各斥候の観測方向を指示せよ。');
  }
  render();
  if(!state.placementPending) openDecoyPlacementChoice();
}

function buildPlacementQueue(){
  const queue = [];
  state.mortars.forEach((m,idx)=>queue.push({kind:'mortar', idx, label:`迫撃砲${idx+1}`}));
  state.scouts.forEach((s,idx)=>queue.push({kind:'scout', idx, label:`斥候${idx+1}`}));
  state.squads.forEach((sq,idx)=>queue.push({kind:'squad', idx, label:`第${idx+1}小隊`}));
  state.snipers.forEach((sn,idx)=>queue.push({kind:'sniper', idx, label:`狙撃${idx+1}班`}));
  return queue;
}

function currentPlacementUnit(item){
  if(!item) return null;
  if(item.kind==='mortar') return state.mortars[item.idx];
  if(item.kind==='scout') return state.scouts[item.idx];
  if(item.kind==='squad') return state.squads[item.idx];
  return state.snipers[item.idx];
}

function handlePlacementClick(px, py){
  const item = state.placementQueue[state.placementIndex];
  if(!item){ finishPlacement(); return; }
  const unit = currentPlacementUnit(item);
  let minX, maxX;
  if(item.kind==='mortar'){ minX = MORTAR_ZONE_MIN_X; maxX = MORTAR_ZONE_MAX_X; }
  else if(item.kind==='scout'){ minX = SQUAD_RETREAT_LIMIT_X; maxX = SCOUT_ADVANCE_LIMIT_X; }
  else { minX = SQUAD_RETREAT_LIMIT_X; maxX = SQUAD_ADVANCE_LIMIT_X; }
  unit.x = clamp(px, minX, maxX);
  unit.y = clamp(py, 20, CANVAS_H-20);
  unit._visX = unit.x; unit._visY = unit.y;
  state.placementIndex++;
  const remaining = state.placementQueue.length - state.placementIndex;
  if(remaining>0){
    log('sys','司令部', `${item.label}、配置完了(残り${remaining}ユニット)。`);
    render();
  } else {
    log('sys','司令部', `${item.label}、配置完了。`);
    finishPlacement();
  }
}

function skipRemainingPlacement(){
  if(!state.placementPending) return;
  finishPlacement();
}

function finishPlacement(){
  state.placementPending = false;
  log('sys','司令部', '配置完了。作戦開始。');
  log('op','斥候', '前線に展開完了。各斥候の観測方向を指示せよ。');
  render();
  openDecoyPlacementChoice();
}

// 擬陣地 (decoy positions) -- placement flow. See MAX_DECOYS etc.
function makeDecoy(x,y){ return {x, y, hp:DECOY_MAX_HP, maxHp:DECOY_MAX_HP, destroyed:false}; }
function randomDecoySpot(){
  return { x: rnd(SQUAD_RETREAT_LIMIT_X, SQUAD_ADVANCE_LIMIT_X*0.8), y: rnd(30, CANVAS_H-30) };
}
function openDecoyPlacementChoice(){
  const body = document.getElementById('decoy-placement-body');
  body.innerHTML = `
    <div class="shop-row">
      <div><div class="label">自動設置</div><div class="sub">最大${MAX_DECOYS}箇所の擬陣地を自動配置する</div></div>
      <div class="actions"><button class="btn primary" onclick="chooseDecoyPlacementMode('auto')">選択</button></div>
    </div>
    <div class="shop-row">
      <div><div class="label">手動設置</div><div class="sub">地図を長押しして最大${MAX_DECOYS}箇所を自分で指定する</div></div>
      <div class="actions"><button class="btn primary" onclick="chooseDecoyPlacementMode('manual')">選択</button></div>
    </div>
  `;
  document.getElementById('decoy-placement-overlay').classList.add('show');
}
function chooseDecoyPlacementMode(mode){
  document.getElementById('decoy-placement-overlay').classList.remove('show');
  state.decoys = [];
  if(mode==='auto'){
    for(let i=0;i<MAX_DECOYS;i++){
      const p = randomDecoySpot();
      state.decoys.push(makeDecoy(p.x, p.y));
    }
    log('sys','工兵', `擬陣地を自動設置(${MAX_DECOYS}箇所)。`);
  } else {
    state.decoyPlacementPending = true;
    log('sys','工兵', `擬陣地、手動設置モード。地図を長押しして最大${MAX_DECOYS}箇所を指定せよ。`);
  }
  render();
}
function placeDecoyAt(x, y){
  if(!state.decoyPlacementPending || state.decoys.length>=MAX_DECOYS) return;
  state.decoys.push(makeDecoy(clamp(x, SQUAD_RETREAT_LIMIT_X, SQUAD_ADVANCE_LIMIT_X), clamp(y, 30, CANVAS_H-30)));
  log('sys','工兵', `擬陣地を設置(${state.decoys.length}/${MAX_DECOYS})。`);
  if(state.decoys.length>=MAX_DECOYS) finishDecoyPlacement();
  render();
}
function finishDecoyPlacement(){
  if(!state.decoyPlacementPending) return;
  state.decoyPlacementPending = false;
  log('sys','工兵', `擬陣地の設置完了(${state.decoys.length}箇所)。`);
  render();
}

function retryStage(){
  const snap = JSON.parse(JSON.stringify(state.stageStartSnapshot));
  state.ammo = snap.ammo;
  state.reserve = snap.reserve;
  state.reserveRoster = snap.reserveRoster;
  state.hq = snap.hq;
  state.mortars = snap.mortars;
  state.squads = snap.squads;
  state.scouts = snap.scouts;
  state.snipers = snap.snipers;
  startStage();
}

// per user request: revived as an anytime-accessible purchase menu (opened by clicking the
// 所持金 stat) rather than a pre-wave-only step -- closeShop() just hides the overlay, it no
// longer doubles as "confirm and deploy" (see deployStage(), now only reached via the
// deployment-mode/wave-clear-reward flow, never through this overlay).
function openShop(){
  renderShop();
  document.getElementById('shop-overlay').classList.add('show');
}
function closeShop(){
  document.getElementById('shop-overlay').classList.remove('show');
}

function renderShop(){
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

function buyEquipment(key){
  if(state.equipment[key] || state.money < PRICE_EQUIP[key]) return;
  state.money -= PRICE_EQUIP[key];
  state.equipment[key] = true;
  renderShop();
  renderStats();
}

function buyAmmo(type, qty){
  const price = (type==='he'?PRICE_HE:PRICE_HEAT) * qty;
  if(state.money < price) return;
  state.money -= price;
  state.ammo[type] += qty;
  renderShop();
  renderStats();
}

function unlockFuze(name){
  if(state.fuzeUnlocked[name] || state.money < PRICE_FUZE) return;
  state.money -= PRICE_FUZE;
  state.fuzeUnlocked[name] = true;
  renderShop();
  renderStats();
}

function deployStage(){
  document.getElementById('shop-overlay').classList.remove('show');
  startStage();
}

function estPos(t){
  const bearing = t.trueBearing + t.bOffset*t.bearingErr;
  const dist = clamp(t.trueDistance + t.dOffset*t.distErr, 20, 1900);
  const rad = bearing*Math.PI/180;
  const x = OP.x + dist*Math.sin(rad);
  const y = OP.y - dist*Math.cos(rad);
  return {
    x: clamp(x, FIELD_MARGIN, CANVAS_W-FIELD_MARGIN),
    y: clamp(y, FIELD_MARGIN, CANVAS_H-FIELD_MARGIN),
    bearing, dist,
  };
}

function computeDispersionAt(){
  return MORTAR_DISPERSION_UNITS;
}

function estPosFromMortar(mortar, t){
  const dx = t.trueX-mortar.x, dy = t.trueY-mortar.y;
  const trueBrg = (Math.atan2(dx,-dy)*180/Math.PI+360)%360;
  const trueDist = Math.sqrt(dx*dx+dy*dy);
  const bearing = trueBrg + t.bOffset*t.bearingErr;
  const dist = clamp(trueDist + t.dOffset*t.distErr, 20, 1900);
  const rad = bearing*Math.PI/180;
  const x = mortar.x + dist*Math.sin(rad);
  const y = mortar.y - dist*Math.cos(rad);
  return {
    x: clamp(x, FIELD_MARGIN, CANVAS_W-FIELD_MARGIN),
    y: clamp(y, FIELD_MARGIN, CANVAS_H-FIELD_MARGIN),
    bearing, dist,
  };
}

function bearingBetween(fromX, fromY, toX, toY){
  const dx = toX-fromX, dy = toY-fromY;
  return (Math.atan2(dx,-dy)*180/Math.PI+360)%360;
}
function angleDiff(a,b){
  let d = Math.abs(a-b)%360;
  if(d>180) d = 360-d;
  return d;
}
function bearingToXY(bearingDeg, dist, originX, originY){
  const rad = bearingDeg*Math.PI/180;
  return { x: originX + dist*Math.sin(rad), y: originY - dist*Math.cos(rad) };
}
function generateTerrain(){
  const hillCount = 3 + Math.floor(Math.random()*3);
  const hills = [];
  for(let i=0;i<hillCount;i++){
    hills.push({
      x: rnd(140, CANVAS_W-100),
      y: rnd(50, CANVAS_H-50),
      r: rnd(100,220),
      h: rnd(0.35,0.75),
    });
  }
  return hills;
}

// Real-world road network (from OSM, via mapcreate/roads_data.js) replaces the
// old procedural line-only roads. Converted from raw terrain-local meters to
// canvas-unit space once, asynchronously, as soon as the 3D terrain finishes
// loading (see buildRealRoads() in the 3D map section below).
const REAL_ROADS_CANVAS = [];
// Road-network graph (nodes + adjacency) built once from REAL_ROADS_CANVAS by
// buildRoadGraph() (see 3D map section) -- used to constrain vehicle movement
// to roads via A* pathfinding (findRoadPath). Stays null if the 3D terrain
// (and therefore road data) never loads; vehicle movement falls back to the
// normal terrainAwareStep in that case.
let ROAD_GRAPH = null;

function nearestPointOnRoad(road, px, py){
  let best=null, bestD=Infinity, bestIdx=0;
  for(let i=0;i<road.length-1;i++){
    const a=road[i], b=road[i+1];
    const dx=b.x-a.x, dy=b.y-a.y;
    const len2 = dx*dx+dy*dy || 1;
    let t = ((px-a.x)*dx+(py-a.y)*dy)/len2;
    t = clamp(t,0,1);
    const x=a.x+dx*t, y=a.y+dy*t;
    const d = Math.hypot(px-x, py-y);
    if(d<bestD){ bestD=d; best={x,y}; bestIdx=i; }
  }
  return {point:best, dist:bestD, segIdx:bestIdx};
}
function nearestRoadPoint(px,py){
  let best=null;
  (state.roads||[]).forEach(road=>{
    const r = nearestPointOnRoad(road, px, py);
    if(r.point && (!best || r.dist<best.dist)) best = {...r, road};
  });
  return best;
}
const ROAD_PULL_RADIUS = 140;
const TERRAIN_SLOPE_PENALTY = 4;
const STEP_ANGLE_OFFSETS = [0, -0.26,0.26, -0.52,0.52, -0.79,0.79]; // 0°, ±15°, ±30°, ±45°

// Movement no longer steers toward roads. Units advance by the shortest path
// toward their target while favoring headings with the least elevation change
// (a cheap local greedy approximation of least-climb pathfinding: sample a fan
// of candidate headings around the direct line to the target and pick the one
// that best balances progress vs. slope). Road proximity (nearestRoadPoint) is
// kept purely as a speed check: on a road = full speed, off-road = reduced.
function terrainAwareStep(fromX, fromY, targetX, targetY, stepLen){
  const straightDx = targetX-fromX, straightDy = targetY-fromY;
  const straightDist = Math.hypot(straightDx,straightDy) || 1;
  if(straightDist < 0.01) return {x:fromX, y:fromY};

  const near = nearestRoadPoint(fromX, fromY);
  const onRoad = near && near.dist < ROAD_PULL_RADIUS;
  const effStepLen = Math.min(stepLen * (onRoad ? 1 : OFF_ROAD_SPEED_MULT), straightDist);
  if(straightDist <= effStepLen){
    return {x: targetX, y: targetY};
  }

  const baseAngle = Math.atan2(straightDy, straightDx);
  const fromElev = elevationAt(fromX, fromY);
  let best = null, bestScore = -Infinity;
  STEP_ANGLE_OFFSETS.forEach(offset=>{
    const angle = baseAngle + offset;
    const nx = fromX + Math.cos(angle)*effStepLen;
    const ny = fromY + Math.sin(angle)*effStepLen;
    const elevChange = Math.abs(elevationAt(nx,ny) - fromElev);
    const progressFrac = Math.cos(offset);
    const score = progressFrac - elevChange*TERRAIN_SLOPE_PENALTY;
    if(score > bestScore){ bestScore = score; best = {x:nx, y:ny}; }
  });
  return best;
}

// terrainAwareStep only lets elevation nudge the HEADING (a small subset of
// candidate headings score better on flatter ground) -- it never actually
// slows movement down for climbing/descending, so in practice units barely
// feel terrain at all. Scouts specifically should be genuinely limited by
// rough ground (that's the whole point of a light recon team picking a
// careful route), so this wraps the normal step and scales the distance
// actually covered down when the chosen step crosses a steep elevation change.
const SCOUT_TERRAIN_SPEED_PENALTY = 2.2;
const SCOUT_TERRAIN_MIN_SPEED_MULT = 0.35;
function scoutTerrainAwareStep(fromX, fromY, targetX, targetY, stepLen){
  const next = terrainAwareStep(fromX, fromY, targetX, targetY, stepLen);
  const elevChange = Math.abs(elevationAt(next.x, next.y) - elevationAt(fromX, fromY));
  const mult = clamp(1 - elevChange*SCOUT_TERRAIN_SPEED_PENALTY, SCOUT_TERRAIN_MIN_SPEED_MULT, 1);
  if(mult >= 0.999) return next;
  return { x: fromX + (next.x-fromX)*mult, y: fromY + (next.y-fromY)*mult };
}

function elevationAt(x,y){
  if(!state || !state.terrain) return 0;
  let e = 0;
  for(let i=0;i<state.terrain.length;i++){
    const hill = state.terrain[i];
    const d = Math.hypot(x-hill.x, y-hill.y);
    const t = clamp(1-d/hill.r, 0, 1);
    e += hill.h * t*t*(3-2*t);
  }
  return e;
}
function elevationLabel(e){
  if(e < 0.25) return '低地';
  if(e < 0.6) return '丘陵';
  return '高地';
}
function altitudeBonus(attackerX, attackerY, defenderX, defenderY){
  const diff = elevationAt(attackerX, attackerY) - elevationAt(defenderX, defenderY);
  return clamp(1 + diff*0.35, 0.75, 1.4);
}

function computeContours(){
  const byLevel = {};
  CONTOUR_LEVELS.forEach(level=>{
    const segs = [];
    for(let gy=0; gy<CANVAS_H; gy+=CONTOUR_CELL){
      for(let gx=0; gx<CANVAS_W; gx+=CONTOUR_CELL){
        const x0=gx, x1=Math.min(gx+CONTOUR_CELL,CANVAS_W), y0=gy, y1=Math.min(gy+CONTOUR_CELL,CANVAS_H);
        const vTL=elevationAt(x0,y0), vTR=elevationAt(x1,y0), vBR=elevationAt(x1,y1), vBL=elevationAt(x0,y1);
        const pts=[];
        if((vTL>level)!==(vTR>level)){ const t=(level-vTL)/(vTR-vTL); pts.push({x:x0+t*(x1-x0), y:y0}); }
        if((vTR>level)!==(vBR>level)){ const t=(level-vTR)/(vBR-vTR); pts.push({x:x1, y:y0+t*(y1-y0)}); }
        if((vBL>level)!==(vBR>level)){ const t=(level-vBL)/(vBR-vBL); pts.push({x:x0+t*(x1-x0), y:y1}); }
        if((vTL>level)!==(vBL>level)){ const t=(level-vTL)/(vBL-vTL); pts.push({x:x0, y:y0+t*(y1-y0)}); }
        if(pts.length===2) segs.push([pts[0],pts[1]]);
        else if(pts.length===4){ segs.push([pts[0],pts[1]]); segs.push([pts[2],pts[3]]); }
      }
    }
    byLevel[level] = segs;
  });
  return byLevel;
}

function hasLineOfSight(fromX,fromY,toX,toY){
  const EYE_HEIGHT = 0.12;
  const dist = Math.hypot(toX-fromX, toY-fromY);
  const steps = Math.max(6, Math.floor(dist/25));
  const fromE = elevationAt(fromX,fromY)+EYE_HEIGHT;
  const toE = elevationAt(toX,toY)+EYE_HEIGHT;
  const smokeClouds = state && state.smokeClouds;
  for(let i=1;i<steps;i++){
    const t = i/steps;
    const x = fromX+(toX-fromX)*t;
    const y = fromY+(toY-fromY)*t;
    const sightE = fromE+(toE-fromE)*t;
    if(elevationAt(x,y) > sightE+0.02) return false;
    if(smokeClouds && smokeClouds.some(c=>Math.hypot(x-c.x,y-c.y) <= SMOKE_RADIUS_UNITS)) return false;
  }
  return true;
}

function scoutHalfFov(){
  return (state.equipment && state.equipment.wideView) ? SCOUT_HALF_FOV_WIDE : SCOUT_HALF_FOV_BASE;
}
function inScoutConeFor(scout, t){
  if(!unitAlive(scout)) return false;
  if(Math.hypot(t.trueX-scout.x, t.trueY-scout.y) > SCOUT_MAX_RANGE_UNITS) return false;
  const brg = bearingBetween(scout.x, scout.y, t.trueX, t.trueY);
  if(angleDiff(brg, scout.watchAngle) > scoutHalfFov()) return false;
  if(t.type==='drone') return true;
  return hasLineOfSight(scout.x, scout.y, t.trueX, t.trueY);
}
function inScoutCone(t){
  if(!state.scouts || state.scouts.length===0) return true;
  return state.scouts.some(s=>inScoutConeFor(s,t));
}
function localDetection(t){
  const nearMortar = state.mortars.some(m=>m.hp>0 && Math.hypot(t.trueX-m.x, t.trueY-m.y) <= DETECTION_RANGE.artillery);
  if(nearMortar) return true;
  const nearSquad = state.squads.some(sq=>{
    if(!sq.soldiers.some(s=>s.alive)) return false;
    return Math.hypot(t.trueX-sq.x, t.trueY-sq.y) <= DETECTION_RANGE.infantry;
  });
  if(nearSquad) return true;
  const nearSniper = state.snipers.some(sn=>{
    if(!sn.soldiers.some(s=>s.alive)) return false;
    return Math.hypot(t.trueX-sn.x, t.trueY-sn.y) <= DETECTION_RANGE.infantry;
  });
  if(nearSniper) return true;
  // Scouts previously had NO proximity fallback here, relying entirely on
  // inScoutCone's narrow ~45 deg facing cone -- a scout not aimed exactly at
  // an approaching enemy would never spot it until the much shorter general
  // "contact" reveal range kicked in, making them feel nearly blind. Give
  // scouts the same all-around passive awareness radius as squads/snipers,
  // on top of (not instead of) their much longer aimed cone.
  return state.scouts.some(s=>{
    if(!unitAlive(s)) return false;
    return Math.hypot(t.trueX-s.x, t.trueY-s.y) <= DETECTION_RANGE.infantry;
  });
}
function isTargetDetected(t){
  return inScoutCone(t) || localDetection(t);
}
function visibilityBlockReasonFor(scout, t){
  if(!unitAlive(scout)) return 'angle';
  if(Math.hypot(t.trueX-scout.x, t.trueY-scout.y) > SCOUT_MAX_RANGE_UNITS) return 'angle';
  const brg = bearingBetween(scout.x, scout.y, t.trueX, t.trueY);
  if(angleDiff(brg, scout.watchAngle) > scoutHalfFov()) return 'angle';
  if(t.type==='drone') return null;
  if(!hasLineOfSight(scout.x, scout.y, t.trueX, t.trueY)) return 'terrain';
  return null;
}
function visibilityBlockReason(t){
  if(localDetection(t)) return null;
  if(!state.scouts || state.scouts.length===0) return null;
  let best = 'angle';
  for(const s of state.scouts){
    const r = visibilityBlockReasonFor(s, t);
    if(r===null) return null;
    if(r==='terrain') best = 'terrain';
  }
  return best;
}
function rotateScout(idx, delta){
  const scout = state.scouts[idx];
  if(!scout) return;
  scout.watchAngle = (scout.watchAngle + delta + 360) % 360;
  render();
}
function armSquadMoveOrder(idx){
  state.orderMode = {kind:'squad', idx};
  state.commandBox = null;
  render();
}
function clearSquadDest(idx){
  if(!state.squads[idx]) return;
  state.squads[idx].pendingDest = null;
  state.orderMode = null;
  render();
}
function armScoutMoveOrder(idx){
  state.orderMode = {kind:'scout-move', idx};
  state.commandBox = null;
  unitSpeakOrder('scout', idx);
  render();
}
function armScoutReconOrder(idx){
  state.orderMode = {kind:'scout-recon', idx};
  state.commandBox = null;
  unitSpeakOrder('scout', idx);
  render();
}
function clearScoutOrder(idx){
  const scout = state.scouts[idx];
  if(!scout) return;
  scout.pendingDest = null;
  scout.pendingReconTargetId = null;
  state.orderMode = null;
  render();
}
function revealTarget(t){
  if(t.revealed) return false;
  t.revealed = true;
  playSfx('identify', 0.4);
  return true;
}
function updateRevealed(){
  if(!state) return;
  const contactFriendlies = [];
  state.scouts.forEach((s,i)=>{ if(unitAlive(s)) contactFriendlies.push({kind:'scout', idx:i, u:s}); });
  state.mortars.forEach((m,i)=>{ if(m.hp>0) contactFriendlies.push({kind:'mortar', idx:i, u:m}); });
  state.squads.forEach((sq,i)=>{ if(sq.soldiers.some(s=>s.alive)) contactFriendlies.push({kind:'squad', idx:i, u:sq}); });
  state.snipers.forEach((sn,i)=>{ if(sn.soldiers.some(s=>s.alive)) contactFriendlies.push({kind:'sniper', idx:i, u:sn}); });
  state.targets.forEach(t=>{
    if(t.destroyed || t.revealed) return;
    let reason = null;
    let detector = null;
    if(inScoutCone(t)){
      reason = '視認';
      detector = contactFriendlies.find(f=>f.kind==='scout');
    } else {
      const near = contactFriendlies.find(f=>Math.hypot(f.u.x-t.trueX, f.u.y-t.trueY) <= CONTACT_RANGE_UNITS);
      if(near){ reason = '接触'; detector = near; }
    }
    if(!reason){
      // 自軍歩兵(小隊)が500m以内に接近した場合は視界・地形に関わらず強制的に識別する
      const nearSquad = contactFriendlies.find(f=>f.kind==='squad' && Math.hypot(f.u.x-t.trueX, f.u.y-t.trueY) <= SQUAD_FORCE_REVEAL_RANGE_UNITS);
      if(nearSquad){ reason = '接近'; detector = nearSquad; }
    }
    if(reason && revealTarget(t)){
      log('op','斥候', `${t.id} を${reason}、<b>${t.def.label}</b>と識別。`);
      if(detector) unitSpeak(detector.kind, detector.idx, 'warning');
    }
  });
}
function performRecon(t){
  t.reconCount += 1;
  t.bearingErr *= 0.5;
  t.distErr *= 0.5;
  const e = estPos(t);
  ripples.push({x:e.x, y:e.y, born:performance.now(), life:900});
  if(t.reconCount===2){
    if(revealTarget(t)){
      log('op','斥候', `${t.id} を目視識別。<b>${t.def.label}</b>と判断します。`);
    }
  } else {
    log('op','斥候', `${t.id} 方位・方位角修正。${Math.round(e.bearing)}°、距離${unitsToMeters(e.dist)}m付近に反応。`);
  }
  if(t.reconCount>=3){
    log('fdc','FDC', `${t.id} の情報精度は限界に達した。これ以上の座標補正は望めない。`);
  }
}
function resolveOneScoutDecision(scout, idx){
  if(!unitAlive(scout)) return;
  if(scout.pendingReconTargetId){
    const t = state.targets.find(x=>x.id===scout.pendingReconTargetId);
    scout.pendingReconTargetId = null;
    if(t && !t.destroyed && t.reconCount<3){
      const blockReason = visibilityBlockReasonFor(scout, t);
      if(!blockReason) performRecon(t);
      else log('sys','FDC', `${t.id} は斥候${idx+1}から視認できず偵察失敗。`);
    }
  } else if(scout.pendingDest){
    const next = scoutTerrainAwareStep(scout.x, scout.y, scout.pendingDest.x, scout.pendingDest.y, 50);
    scout.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SCOUT_ADVANCE_LIMIT_X);
    scout.y = clamp(next.y, 20, CANVAS_H-20);
    checkMineTrigger('scout', idx, scout.x, scout.y);
    if(Math.hypot(scout.x-scout.pendingDest.x, scout.y-scout.pendingDest.y) < 12){
      scout.pendingDest = null;
      log('op','斥候', `斥候${idx+1}、指定地点に到着。`);
    }
  }
}
function resolveScoutDecision(){
  state.scouts.forEach((scout,idx)=>resolveOneScoutDecision(scout, idx));
}
function allScoutsWiped(){
  return state.scouts.every(s=>!unitAlive(s));
}
function allSnipersWiped(){
  return state.snipers.every(sn=>!unitAlive(sn));
}
function allMortarsWiped(){
  return state.mortars.every(m=>m.hp<=0);
}

function setMortarOrder(idx, order){
  const mortar = state.mortars[idx];
  if(!mortar || !MORTAR_ORDER_LABEL[order]) return;
  mortar.order = order;
  unitSpeakOrder('mortar', idx);
  if(order==='fire'){
    mortar.pendingDest = null;
    state.orderMode = null;
  } else if(order==='standby'){
    mortar.pendingFire = null;
    mortar.pendingDest = null;
    state.orderMode = null;
  } else if(order==='move'){
    mortar.pendingFire = null;
    state.orderMode = {kind:'mortar-move', idx};
    state.commandBox = null;
  }
  render();
}
function armMortarTargetOrder(idx){
  const mortar = state.mortars[idx];
  if(!mortar) return;
  mortar.order = 'fire';
  mortar.pendingDest = null;
  state.orderMode = {kind:'mortar-target', idx};
  state.commandBox = null;
  render();
}
function resolveOneMortarDecision(mortar){
  if(mortar.order!=='move' || !mortar.pendingDest) return;
  const next = terrainAwareStep(mortar.x, mortar.y, mortar.pendingDest.x, mortar.pendingDest.y, MORTAR_MOVE_CAP);
  mortar.x = clamp(next.x, MORTAR_ZONE_MIN_X, MORTAR_ZONE_MAX_X);
  mortar.y = clamp(next.y, 30, CANVAS_H-30);
  checkMineTrigger('mortar', mortar.id, mortar.x, mortar.y);
  if(Math.hypot(mortar.x-mortar.pendingDest.x, mortar.y-mortar.pendingDest.y) < 12){
    mortar.pendingDest = null;
    mortar.order = 'standby';
    mortar.shotsSinceMove = 0;
    log('mortar','迫撃砲班', `迫撃砲${mortar.id+1}、陣地転換完了。新位置から射撃準備。`);
    if(mortar.cbWarnTurns!==null && mortar.cbWarnTurns!==undefined){
      mortar.cbWarnTurns = null;
      log('mortar','迫撃砲班', `迫撃砲${mortar.id+1}、対砲兵射撃圏内から離脱に成功。`);
    }
  }
}
function resolveMortarDecision(){
  state.mortars.forEach(m=>resolveOneMortarDecision(m));
}

let unlockedAchievements = new Set();
function loadAchievements(){
  try{
    const raw = localStorage.getItem('mortarFdcAchievements');
    if(raw) unlockedAchievements = new Set(JSON.parse(raw));
  }catch(e){}
}
function saveAchievements(){
  try{ localStorage.setItem('mortarFdcAchievements', JSON.stringify([...unlockedAchievements])); }catch(e){}
}
function onTargetDestroyed(t){
  unlockAchievement('firstBlood');
  if(t.type==='artillery') unlockAchievement('mortarHunter');
  speakRandomAliveUnit('morale');
  spawnDestructionEffect(t.trueX, t.trueY, `${t.def.label} 撃破!`, ENEMY_MARK_COLOR);
}

// per user request: a MUCH bigger, more dramatic "destroyed" flourish shared by both sides --
// a double-pulse explosion ring (flashes, tagged big:true, staggered so it reads as a
// boom-BOOM rather than one flat flash), a flung debris shower, a rising column of black
// wreck smoke that lingers for several seconds, and a floating kill banner that pops in
// before settling.
//
// Perf/freeze fix: a single proximity-fuse HE burst can kill several drones in the same
// instant (see the airburst branch in launchMortarVolley), each calling this function --
// unbounded per-kill work (debris count, a fresh Audio() per kill) stacked across a
// multi-kill burst was cheap for one kill but expensive enough across several at once to
// stutter/hang a frame. MAX_DEBRIS_PARTICLES hard-caps the shared pool (trimming the oldest
// first) and EXPLOSION_SFX_MIN_GAP_MS dedupes the explosion sound so a multi-kill burst plays
// it once instead of once per kill; the visuals themselves still spawn per kill.
const MAX_DEBRIS_PARTICLES = 140;
const EXPLOSION_SFX_MIN_GAP_MS = 90;
let lastExplosionSfxAt = -Infinity;
function spawnDestructionEffect(x, y, label, color){
  const born = performance.now();
  if(born - lastExplosionSfxAt > EXPLOSION_SFX_MIN_GAP_MS){
    lastExplosionSfxAt = born;
    playSfx('explosion', 0.325);
  }
  flashes.push({x, y, born, life:800, big:true});
  flashes.push({x, y, born: born+130, life:650, big:true});
  for(let i=0;i<14;i++){
    const ang = Math.random()*Math.PI*2;
    const spd = rnd(40, 150);
    debrisParticles.push({
      x, y, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd*0.5 - rnd(25,70),
      born, life: rnd(800,1400), color,
    });
  }
  if(debrisParticles.length > MAX_DEBRIS_PARTICLES){
    debrisParticles.splice(0, debrisParticles.length - MAX_DEBRIS_PARTICLES);
  }
  wreckSmokes.push({x, y, born, life:6000});
  if(label) killBanners.push({x, y, born, life:1900, text:label, color});
}

function unlockAchievement(key){
  if(unlockedAchievements.has(key)) return;
  unlockedAchievements.add(key);
  saveAchievements();
  const a = ACHIEVEMENTS[key];
  log('fdc','実績', `実績解除: ${a.label} ― ${a.desc}`);
  const chip = document.getElementById('stat-achievements');
  if(chip) chip.querySelector('.value').textContent = unlockedAchievements.size+' / '+Object.keys(ACHIEVEMENTS).length;
}

function toggleStatbar(){
  const content = document.getElementById('statbar-content');
  const caret = document.getElementById('statbar-caret');
  const expanded = content.classList.toggle('expanded');
  caret.textContent = expanded ? '▾' : '▸';
}

function toggleForceList(){
  const content = document.getElementById('force-list');
  const caret = document.getElementById('force-list-caret');
  const expanded = content.classList.toggle('expanded');
  caret.textContent = expanded ? '▾' : '▸';
}

function toggleBoardNote(){
  const note = document.getElementById('board-note');
  const hint = document.getElementById('board-note-caret');
  const expanded = note.classList.toggle('expanded');
  hint.textContent = expanded ? '▾ 使い方' : '▸ 使い方';
}

function toggleMapFullscreen(){
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

function updateFullscreenBtnIcon(){
  const btn = document.getElementById('mapFullscreenBtn');
  if(!btn) return;
  const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
  btn.textContent = fsEl ? '⤢' : '⛶';
  btn.title = fsEl ? '全画面表示を解除' : '全画面表示にする';
}
document.addEventListener('fullscreenchange', updateFullscreenBtnIcon);
document.addEventListener('webkitfullscreenchange', updateFullscreenBtnIcon);

function openAchievements(){
  const body = document.getElementById('achievements-body');
  body.innerHTML = Object.keys(ACHIEVEMENTS).map(key=>{
    const a = ACHIEVEMENTS[key];
    const got = unlockedAchievements.has(key);
    return `
      <div class="shop-row" style="${got?'':'opacity:.5;'}">
        <div><div class="label">${got?'✓ ':''}${a.label}</div><div class="sub">${a.desc}</div></div>
      </div>
    `;
  }).join('');
  document.getElementById('achievements-overlay').classList.add('show');
}
function closeAchievements(){
  document.getElementById('achievements-overlay').classList.remove('show');
}

function log(role, who, text){
  const el = document.getElementById('log');
  const cls = role==='op'?'l-op':role==='fdc'?'l-fdc':role==='mortar'?'l-mortar':'l-sys';
  const div = document.createElement('div');
  div.className = cls;
  div.innerHTML = `<b>[${who}]</b> ${text}`;
  el.insertBefore(div, el.firstChild);
  el.scrollTo({top:0, behavior:'smooth'});
}

function enemyCounterAttack(actionTurns){
  let anyHit = false;
  const remaining = state.targets.filter(t=>!t.destroyed);
  // Balance note: infantry now arrives as several independent formation groups (see
  // buildEnemyInfantryGroups) instead of one squad-sized target, so without this correction
  // the total number of infantry units rolling for a counter-attack each turn -- and hence
  // total incoming fire on forward assets like scouts -- scales with however many groups the
  // wave happened to split into (up to ~7), silently multiplying threat well beyond what
  // COUNTER_CHANCE.infantry was tuned for. Dividing by the live infantry group count keeps
  // the AGGREGATE attack-attempt rate equivalent to a single infantry unit's, regardless of
  // formation count, so SCOUT_EXPOSURE's intended survivability isn't eaten by this.
  const infantryGroupCount = remaining.filter(t=>t.type==='infantry').length;
  for(let i=0;i<actionTurns;i++){
    remaining.forEach(t=>{
      if(t.destroyed) return;
      if(allScoutsWiped() && allMortarsWiped()) return;
      const suppressionMult = isSuppressed(t) ? SUPPRESSION_COUNTER_MULT : 1;
      const groupCorrection = t.type==='infantry' ? 1/Math.max(1, infantryGroupCount) : 1;
      const chance = (COUNTER_CHANCE[t.type] + state.stage*0.008) * DIFFICULTIES[state.difficulty].counterMult * WEATHER_TYPES[state.weather].counterMult * suppressionMult * groupCorrection;
      if(Math.random() < chance){
        const near = nearestFriendlyAsset(t.trueX, t.trueY, false);
        if(!near) return;
        const [lo,hi] = COUNTER_DAMAGE[t.type];
        const armorMult = (near.kind==='mortar' && state.equipment.armor) ? 0.75 : 1;
        const altMult = altitudeBonus(t.trueX, t.trueY, near.x, near.y);
        const dmg = Math.round((rnd(lo,hi) + state.stage*0.4) * DIFFICULTIES[state.difficulty].counterMult * armorMult * altMult);
        const sourceLabel = `${t.id}(${t.revealed?t.def.label:'未識別目標'})からの攻撃`;
        anyHit = true;
        const e = estPos(t);
        if(revealTarget(t)){
          log('op','斥候', `${t.id} からの攻撃を確認、<b>${t.def.label}</b>と識別。`);
        }
        if(t.type==='artillery'){
          // per user request: 敵の迫撃砲(砲兵)発射時にも発射音を鳴らす
          playSfx('mortarFire', 0.14);
          projectiles.push({
            startX: e.x, startY: e.y,
            endX: near.x, endY: near.y,
            born: performance.now(),
            duration: FLIGHT_DURATION,
            onLand: ()=>{
              if(rollExposureHit(getUnitExposure(near))){
                damageFriendlyAsset(near, dmg, sourceLabel);
              } else {
                log('sys','回避', `${sourceLabel}は着弾したが、${friendlyFireCandidateLabel(near)}は掩蔽率により被弾を免れた。`);
              }
              render();
            }
          });
        } else if(rollExposureHit(getUnitExposure(near))){
          damageFriendlyAsset(near, dmg, sourceLabel);
          enemyTracers.push({startX:e.x, startY:e.y, endX:near.x, endY:near.y, born:performance.now(), duration:320});
        } else {
          log('sys','回避', `${sourceLabel}を受けたが、${friendlyFireCandidateLabel(near)}は掩蔽率により被弾を免れた。`);
        }
      }
    });
  }
  return anyHit;
}

function totalAliveSoldiers(){
  return state.squads.reduce((sum,sq)=>sum+sq.soldiers.filter(s=>s.alive).length, 0);
}
function allSquadsWiped(){
  return state.squads.every(sq=>sq.soldiers.every(s=>!s.alive));
}

function applyStandingOrder(unit, prefix, assaultAllowed){
  if(!unit.standingOrder) return;
  const aliveSoldiers = unit.soldiers.filter(s=>s.alive);
  if(aliveSoldiers.length===0) return;
  if(unit.standingOrder==='low_hp_retreat'){
    if(aliveSoldiers.length/unit.soldiers.length <= 0.5 && unit.order!=='retreat'){
      unit.order = 'retreat';
      log('sys','司令部', `${prefix} 損耗50%超、既定行動により後退を発令。`);
    }
    return;
  }
  const targetOrder = (unit.standingOrder==='contact_assault' && assaultAllowed) ? 'assault' : 'hold';
  const inContact = state.targets.some(t=>!t.destroyed && Math.hypot(t.trueX-unit.x, t.trueY-unit.y) <= SQUAD_ENGAGE_RANGE);
  if(inContact && unit.order!==targetOrder){
    unit.order = targetOrder;
    log('sys','司令部', `${prefix} 敵と接触、既定行動により${ORDER_LABEL[targetOrder]}を発令。`);
  }
}

function applySquadMovement(sq, sqIdx){
  if(sq.pendingDest){
    const next = terrainAwareStep(sq.x, sq.y, sq.pendingDest.x, sq.pendingDest.y, INFANTRY_MOVE_CAP);
    sq.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ASSAULT_LIMIT_X);
    sq.y = clamp(next.y, 30, CANVAS_H-30);
    checkMineTrigger('squad', sqIdx, sq.x, sq.y);
    if(Math.hypot(sq.x-sq.pendingDest.x, sq.y-sq.pendingDest.y) < 12){
      sq.pendingDest = null;
      log('sys','前線', `第${sqIdx+1}小隊、指定地点に到着。`);
    }
    return;
  }
  if(sq.order==='advance'){
    const next = terrainAwareStep(sq.x, sq.y, SQUAD_ADVANCE_LIMIT_X, sq.y, INFANTRY_MOVE_CAP);
    sq.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ADVANCE_LIMIT_X);
    sq.y = clamp(next.y, 30, CANVAS_H-30);
  } else if(sq.order==='retreat'){
    const next = terrainAwareStep(sq.x, sq.y, FRIENDLY_INF_POS.x, FRIENDLY_INF_POS.y, INFANTRY_MOVE_CAP);
    sq.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ADVANCE_LIMIT_X);
    sq.y = clamp(next.y, 30, CANVAS_H-30);
  } else if(sq.order==='assault'){
    const enemyInfantry = state.targets.filter(t=>!t.destroyed && t.type==='infantry');
    if(enemyInfantry.length){
      let nearest=null, nd=Infinity;
      enemyInfantry.forEach(t=>{
        const e = estPos(t);
        const d = Math.hypot(e.x-sq.x, e.y-sq.y);
        if(d<nd){ nd=d; nearest=e; }
      });
      if(nearest){
        const next = terrainAwareStep(sq.x, sq.y, nearest.x, nearest.y, INFANTRY_MOVE_CAP);
        sq.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ASSAULT_LIMIT_X);
        sq.y = clamp(next.y, 30, CANVAS_H-30);
      }
    } else {
      const next = terrainAwareStep(sq.x, sq.y, SQUAD_ADVANCE_LIMIT_X, sq.y, INFANTRY_MOVE_CAP);
      sq.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ADVANCE_LIMIT_X);
      sq.y = clamp(next.y, 30, CANVAS_H-30);
    }
  } else if(sq.order==='hunt' && sq.huntTargetId){
    const target = state.targets.find(t=>t.id===sq.huntTargetId);
    if(!target || target.destroyed){
      sq.huntTargetId = null;
      sq.order = 'hold';
      log('sys','前線', `第${sqIdx+1}小隊、攻撃目標を喪失(撃破/消失)。待機に移行。`);
    } else {
      const e = estPos(target);
      const dist = Math.hypot(e.x-sq.x, e.y-sq.y);
      if(dist > SQUAD_ENGAGE_RANGE*0.8){
        const next = terrainAwareStep(sq.x, sq.y, e.x, e.y, INFANTRY_MOVE_CAP);
        sq.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ASSAULT_LIMIT_X);
        sq.y = clamp(next.y, 30, CANVAS_H-30);
      }
      // else: already within engage range -- hold position, resolveSquadOrders' duel loop handles the attack
    }
  }
  checkMineTrigger('squad', sqIdx, sq.x, sq.y);
}

function resolveSquadOrders(actionTurns){
  let anyEvent = false;
  for(let i=0;i<actionTurns;i++){
    state.squads.forEach((sq, sqIdx)=>{
      const aliveSoldiers = sq.soldiers.filter(s=>s.alive);
      if(aliveSoldiers.length===0) return;
      applyStandingOrder(sq, `第${sqIdx+1}小隊`, true);
      applySquadMovement(sq, sqIdx);

      let engageTargets = state.targets.filter(t=>!t.destroyed && t.type==='infantry');
      if(sq.order==='hunt' && sq.huntTargetId){
        const huntTarget = state.targets.find(t=>t.id===sq.huntTargetId && !t.destroyed);
        if(huntTarget && !engageTargets.includes(huntTarget)) engageTargets = engageTargets.concat([huntTarget]);
      }
      if(engageTargets.length===0) return;
      let dmgMult=1, casualtyMult=1;
      if(sq.order==='assault' || sq.order==='hunt'){ dmgMult=1.6; casualtyMult=1.5; }
      else if(sq.order==='hold'){ dmgMult=0.9; casualtyMult=0.6; }
      else if(sq.order==='retreat'){ dmgMult=0.5; casualtyMult=0.7; }

      engageTargets.forEach(t=>{
        if(t.destroyed) return;
        const e = estPos(t);
        const dist = Math.hypot(e.x-sq.x, e.y-sq.y);
        if(dist > SQUAD_ENGAGE_RANGE) return;
        if(revealTarget(t)){
          log('op','斥候', `第${sqIdx+1}小隊が${t.id}と交戦、<b>${t.def.label}</b>と識別。`);
        }
        const curAlive = sq.soldiers.filter(s=>s.alive);
        if(curAlive.length===0) return;
        const suppressed = isSuppressed(t);
        const strengthFrac = curAlive.length/sq.soldiers.length;
        const squadAltMult = altitudeBonus(sq.x, sq.y, t.trueX, t.trueY);
        const suppressionDmgMult = suppressed ? SUPPRESSION_DUEL_DMG_BONUS : 1;
        const enemyExposureMult = exposureNormalizedMult(t.exposure);
        const vetDmgMult = 1 + unitAvgVetLevel(sq.soldiers)*VET_DMG_BONUS_PER_LEVEL;
        const dmgToEnemy = Math.round(rnd(INFANTRY_DUEL_DMG_TO_ENEMY[0], INFANTRY_DUEL_DMG_TO_ENEMY[1]) * strengthFrac * dmgMult * squadAltMult * suppressionDmgMult * enemyExposureMult * vetDmgMult);
        applyDamageToTarget(t, dmgToEnemy);
        anyEvent = true;
        // per user request: show a shooting animation for the squad's own outgoing fire too,
        // not just the enemy's return fire on a casualty (see the enemyTracers.push below)
        enemyTracers.push({startX:sq.x, startY:sq.y, endX:e.x, endY:e.y, born:performance.now(), duration:220});
        if(t.hp<=0 && !t.destroyed){
          t.destroyed = true; t.hp = 0;
          log('op','斥候', `${t.id} 第${sqIdx+1}小隊との交戦で撃破を確認。`);
          onTargetDestroyed(t);
        }
        const enemyAltMult = altitudeBonus(t.trueX, t.trueY, sq.x, sq.y);
        const suppressionCasualtyMult = suppressed ? SUPPRESSION_CASUALTY_MULT : 1;
        const casualtyChance = (0.08 + state.stage*0.008) * casualtyMult * enemyAltMult * suppressionCasualtyMult * exposureNormalizedMult(getUnitExposure({kind:'squad', idx:sqIdx}));
        if(Math.random() < casualtyChance){
          const victim = choice(curAlive);
          victim.alive = false;
          log('sys','前線', `第${sqIdx+1}小隊、${t.id}との交戦で<b>${victim.rank} ${victim.name}</b> 戦死。残存 ${sq.soldiers.filter(s=>s.alive).length}/${sq.soldiers.length}名。`);
          enemyTracers.push({startX:e.x, startY:e.y, endX:sq.x, endY:sq.y, born:performance.now(), duration:280});
          unitSpeakInjury('squad', sqIdx);
        }
      });
    });
  }
  if(allSquadsWiped()){
    log('sys','前線', '自軍歩兵、全小隊が壊滅。前線が崩壊した。');
    anyEvent = true;
  }
  return anyEvent;
}

function applySniperMovement(sn){
  if(sn.pendingDest){
    const next = terrainAwareStep(sn.x, sn.y, sn.pendingDest.x, sn.pendingDest.y, SNIPER_MOVE_CAP);
    sn.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ADVANCE_LIMIT_X);
    sn.y = clamp(next.y, 30, CANVAS_H-30);
    checkMineTrigger('sniper', sn.id, sn.x, sn.y);
    if(Math.hypot(sn.x-sn.pendingDest.x, sn.y-sn.pendingDest.y) < 12){
      sn.pendingDest = null;
      log('sys','前線', `狙撃${sn.id+1}班、指定地点に到着。`);
    }
    return;
  }
  if(sn.order==='advance'){
    const next = terrainAwareStep(sn.x, sn.y, SQUAD_ADVANCE_LIMIT_X, sn.y, SNIPER_MOVE_CAP);
    sn.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ADVANCE_LIMIT_X);
    sn.y = clamp(next.y, 30, CANVAS_H-30);
  } else if(sn.order==='retreat'){
    const next = terrainAwareStep(sn.x, sn.y, SNIPER_POS.x, SNIPER_POS.y, SNIPER_MOVE_CAP);
    sn.x = clamp(next.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ADVANCE_LIMIT_X);
    sn.y = clamp(next.y, 30, CANVAS_H-30);
  }
  checkMineTrigger('sniper', sn.id, sn.x, sn.y);
}

// Shared direct-fire resolution used both by the manual snipe-target lock
// and by the automatic aim-line engagement below.
function sniperEngageTarget(sn, t){
  if(revealTarget(t)){
    log('op','斥候', `狙撃${sn.id+1}班が${t.id}を捕捉、<b>${t.def.label}</b>と識別。`);
  }
  if(!rollExposureHit(t.exposure)){
    log('mortar','狙撃', `狙撃${sn.id+1}班、${t.id}へ発砲するも掩蔽率により外す。`);
    return;
  }
  const curAlive = sn.soldiers.filter(s=>s.alive);
  const strengthFrac = curAlive.length/sn.soldiers.length;
  const altMult = altitudeBonus(sn.x, sn.y, t.trueX, t.trueY);
  const suppressionDmgMult = isSuppressed(t) ? SUPPRESSION_DUEL_DMG_BONUS : 1;
  const vetDmgMult = 1 + unitAvgVetLevel(sn.soldiers)*VET_DMG_BONUS_PER_LEVEL;
  const dmg = Math.round(rnd(SNIPER_DMG[0], SNIPER_DMG[1]) * strengthFrac * altMult * suppressionDmgMult * vetDmgMult);
  // per user request: 処刑(execute) -- a target already worn down to
  // SNIPER_EXECUTE_HP_THRESHOLD or below is finished off outright on a connecting hit,
  // regardless of remaining HP. Makes snipers the dedicated finisher once mortars/squads
  // have softened a target up, rather than just another (weaker) damage source.
  const isExecute = t.maxHp>0 && (t.hp/t.maxHp) <= SNIPER_EXECUTE_HP_THRESHOLD;
  applyDamageToTarget(t, isExecute ? t.hp : dmg);
  log('mortar','狙撃', isExecute
    ? `狙撃${sn.id+1}班、${t.id}へ<b>止めの一撃</b>。撃破を確認。`
    : `狙撃${sn.id+1}班、${t.id}に精密射撃(効果 ${dmg})。`);
  enemyTracers.push({startX:sn.x, startY:sn.y, endX:t.trueX, endY:t.trueY, born:performance.now(), duration:180});
  if(t.hp<=0 && !t.destroyed){
    t.destroyed = true; t.hp = 0;
    log('fdc','FDC', `${t.id} 狙撃により<b>撃破を確認</b>。`);
    onTargetDestroyed(t);
    if(sn.pendingSnipeTargetId===t.id) sn.pendingSnipeTargetId = null;
  }
}

// Nearest live, non-destroyed enemy target lying within SNIPER_AIM_RANGE_UNITS
// along sn.aimAngle and within SNIPER_AIM_LINE_WIDTH_UNITS of that line.
function findTargetOnSniperLine(sn){
  if(sn.aimAngle===null || sn.aimAngle===undefined) return null;
  const rad = sn.aimAngle*Math.PI/180;
  const dirX = Math.sin(rad), dirY = -Math.cos(rad);
  let best=null, bestProj=Infinity;
  state.targets.forEach(t=>{
    if(t.destroyed) return;
    const vx = t.trueX-sn.x, vy = t.trueY-sn.y;
    const proj = vx*dirX + vy*dirY;
    if(proj<0 || proj>SNIPER_AIM_RANGE_UNITS) return;
    const perp = Math.abs(vx*dirY - vy*dirX);
    if(perp > SNIPER_AIM_LINE_WIDTH_UNITS/2) return;
    if(proj<bestProj){ bestProj=proj; best=t; }
  });
  return best;
}

// Fallback auto-engagement used only when the player hasn't designated a
// specific snipe target or aim line (see resolveSniperOrders) -- picks the
// nearest detected, in-range, line-of-sight-clear enemy so snipers still
// fight proactively instead of sitting idle waiting for manual orders.
function findAutoSniperTarget(sn){
  let best=null, bd=Infinity;
  state.targets.forEach(t=>{
    if(t.destroyed) return;
    if(!isTargetDetected(t)) return;
    const dist = Math.hypot(t.trueX-sn.x, t.trueY-sn.y);
    if(dist > SNIPER_RANGE_UNITS) return;
    if(!hasLineOfSight(sn.x, sn.y, t.trueX, t.trueY)) return;
    if(dist<bd){ bd=dist; best=t; }
  });
  return best;
}

// A vehicle target caught on a sniper's aim line can't be engaged directly
// (small arms vs. armor) -- the sniper instead calls it in, and the nearest
// live mortar fires a single HEAT round at it, consuming 1 HEAT round from
// the shared ammo pool. Uses state.snipeMortarStrikesPending (separate from
// state.animating) to block re-entry into commitDecision()/handleCanvasClick
// while this independent volley is still resolving, without touching the
// existing player-volley animating/remaining bookkeeping.
function callInMortarHeatStrike(target, sn){
  const aliveMortars = state.mortars.filter(m=>m.hp>0);
  if(!aliveMortars.length) return;
  let nearest=null, nd=Infinity;
  aliveMortars.forEach(m=>{
    const d = Math.hypot(m.x-target.trueX, m.y-target.trueY);
    if(d<nd){ nd=d; nearest=m; }
  });
  if(!nearest) return;
  if(revealTarget(target)){
    log('op','斥候', `狙撃${sn.id+1}班が${target.id}を捕捉、<b>${target.def.label}</b>と識別。`);
  }
  if(state.ammo.heat <= 0){
    log('sys','システム', `狙撃${sn.id+1}班より対装甲目標発見、迫撃砲${nearest.id+1}へ徹甲弾射撃を要求するも弾薬不足。`);
    return;
  }
  log('fdc','FDC', `狙撃${sn.id+1}班より対装甲目標発見の報告。迫撃砲${nearest.id+1}が${target.id}へ徹甲弾射撃。`);
  state.ammo.heat -= 1;
  state.snipeMortarStrikesPending += 1;
  launchMortarVolley(nearest, 'heat', 'impact', 1, {x:target.trueX, y:target.trueY, snappedId:target.id}, target, ()=>{
    state.snipeMortarStrikesPending -= 1;
    checkEnd();
    render();
  });
}

function resolveSniperOrders(actionTurns){
  let anyEvent = false;
  for(let i=0;i<actionTurns;i++){
    state.snipers.forEach(sn=>{
      const aliveSoldiers = sn.soldiers.filter(s=>s.alive);
      if(aliveSoldiers.length===0) return;
      applyStandingOrder(sn, `狙撃${sn.id+1}班`, false);
      applySniperMovement(sn);

      if(sn.pendingSnipeTargetId){
        const t = state.targets.find(x=>x.id===sn.pendingSnipeTargetId);
        if(!t || t.destroyed){
          sn.pendingSnipeTargetId = null;
        } else if(isTargetDetected(t)){
          const dist = Math.hypot(t.trueX-sn.x, t.trueY-sn.y);
          if(dist <= SNIPER_RANGE_UNITS && hasLineOfSight(sn.x, sn.y, t.trueX, t.trueY)){
            anyEvent = true;
            sniperEngageTarget(sn, t);
          }
        }
      }

      const lineTarget = findTargetOnSniperLine(sn);
      if(lineTarget){
        if(lineTarget.type==='vehicle'){
          anyEvent = true;
          callInMortarHeatStrike(lineTarget, sn);
        } else if(hasLineOfSight(sn.x, sn.y, lineTarget.trueX, lineTarget.trueY)){
          anyEvent = true;
          sniperEngageTarget(sn, lineTarget);
        }
      }

      // per user request: auto-engage fallback -- only when the player hasn't
      // designated a snipe target or aim line, so manual designation still takes priority.
      const hasAimLine = sn.aimAngle!==null && sn.aimAngle!==undefined;
      if(!sn.pendingSnipeTargetId && !hasAimLine){
        const auto = findAutoSniperTarget(sn);
        if(auto){
          anyEvent = true;
          if(auto.type==='vehicle') callInMortarHeatStrike(auto, sn);
          else sniperEngageTarget(sn, auto);
        }
      }
    });
  }
  return anyEvent;
}

function setSquadOrder(idx, order){
  if(!state.squads[idx]) return;
  state.squads[idx].order = order;
  unitSpeakOrder('squad', idx);
  render();
}

function setSniperOrder(idx, order){
  if(!state.snipers[idx]) return;
  state.snipers[idx].order = order;
  unitSpeakOrder('sniper', idx);
  render();
}
function setStandingOrder(kind, idx, value){
  const unit = kind==='squad' ? state.squads[idx] : state.snipers[idx];
  if(!unit) return;
  unit.standingOrder = value || null;
  render();
}
function armSniperMoveOrder(idx){
  if(!state.snipers[idx]) return;
  state.orderMode = {kind:'sniper-move', idx};
  state.commandBox = null;
  render();
}
function clearSniperDest(idx){
  if(!state.snipers[idx]) return;
  state.snipers[idx].pendingDest = null;
  state.orderMode = null;
  render();
}
function armSniperTargetOrder(idx){
  if(!state.snipers[idx]) return;
  state.orderMode = {kind:'sniper-target', idx};
  state.commandBox = null;
  render();
}
function clearSniperTarget(idx){
  if(!state.snipers[idx]) return;
  state.snipers[idx].pendingSnipeTargetId = null;
  render();
}
function armSniperAimOrder(idx){
  const sn = state.snipers[idx];
  if(!sn) return;
  state.orderMode = {kind:'sniper-aim', idx};
  state.commandBox = null;
  unitSpeakOrder('sniper', idx);
  render();
}
function clearSniperAim(idx){
  if(!state.snipers[idx]) return;
  state.snipers[idx].aimAngle = null;
  render();
}
// per user request: a mortar's "主線方位角" (primary line of fire) -- a reference direction
// drawn as a pale-yellow fire-sector fan out to MORTAR_MAINLINE_RANGE_UNITS, purely a visual
// reference like a real mortar's base line (unlike the sniper's aim line, it doesn't
// auto-engage anything -- fire missions still go through the normal target-snap flow).
function armMortarMainlineOrder(idx){
  const mortar = state.mortars[idx];
  if(!mortar) return;
  state.orderMode = {kind:'mortar-mainline', idx};
  state.commandBox = null;
  unitSpeakOrder('mortar', idx);
  render();
}
function clearMortarMainline(idx){
  if(!state.mortars[idx]) return;
  state.mortars[idx].mainlineAngle = null;
  render();
}

function reinforceUnitLabel(kind, idx){
  if(kind==='squad') return `第${idx+1}小隊`;
  if(kind==='scout') return `斥候${idx+1}班`;
  return `狙撃${idx+1}班`;
}
function requestReinforcement(kind, idx){
  if(!state || state.stageResolved) return;
  const unit = kind==='squad' ? state.squads[idx] : kind==='scout' ? state.scouts[idx] : state.snipers[idx];
  if(!unit || unit.reinforceUsed) return;
  const deadCount = unit.soldiers.filter(s=>!s.alive).length;
  if(deadCount===0) return;
  const restoreCount = Math.min(REINFORCE_MAX_PER_CALL, deadCount, state.reserve);
  if(restoreCount<=0){ log('sys','システム','予備兵力が残っていません。'); return; }
  const cost = REINFORCE_COST_PER_SOLDIER*restoreCount;
  if(state.money < cost){ log('sys','システム','資金が不足しています。'); return; }
  state.money -= cost;
  state.turns += 1;
  state.reserve -= restoreCount;
  let revived = 0;
  const arrivedNames = [];
  unit.soldiers.forEach(s=>{
    if(!s.alive && revived<restoreCount){
      const replacement = state.reserveRoster.shift() || {rank:'2等陸士', name:'(補充兵)'};
      // a fresh recruit is filling this slot, not the fallen soldier returning -- reset
      // veterancy so reinforcements don't inherit a dead veteran's accumulated experience
      s.alive=true; s.seed=Math.random()*1000; s.rank=replacement.rank; s.name=replacement.name; s.vetXp=0;
      arrivedNames.push(`${replacement.rank} ${replacement.name}`);
      revived++;
    }
  });
  unit.reinforceUsed = true;
  log('op','斥候', `${reinforceUnitLabel(kind,idx)}に予備兵力${revived}名(${arrivedNames.join('、')})が到着。¥${cost}を消費(残り予備 ${state.reserve}名)。`);
  resolveEnemyTurn(1);
  checkEnd();
  render();
}

function friendlyFireCandidateLabel(c){
  if(c.kind==='hq') return '指揮所';
  if(c.kind==='mortar') return `迫撃砲${c.idx+1}`;
  if(c.kind==='scout') return `斥候${c.idx+1}`;
  if(c.kind==='squad') return `第${c.idx+1}小隊`;
  return `狙撃${c.idx+1}班`;
}
function checkFriendlyFireAt(ix, iy, killRadius){
  const candidates = [];
  if(state.hq.hp>0) candidates.push({kind:'hq', idx:0, x:state.hq.x, y:state.hq.y});
  state.mortars.forEach((m,idx)=>{ if(m.hp>0) candidates.push({kind:'mortar', idx, x:m.x, y:m.y}); });
  state.scouts.forEach((s,idx)=>{ if(unitAlive(s)) candidates.push({kind:'scout', idx, x:s.x, y:s.y}); });
  state.squads.forEach((sq,idx)=>{ if(sq.soldiers.some(s=>s.alive)) candidates.push({kind:'squad', idx, x:sq.x, y:sq.y}); });
  state.snipers.forEach((sn,idx)=>{ if(sn.soldiers.some(s=>s.alive)) candidates.push({kind:'sniper', idx, x:sn.x, y:sn.y}); });
  let hit = null, bestD = Infinity;
  candidates.forEach(c=>{
    const d = Math.hypot(ix-c.x, iy-c.y);
    if(d<=killRadius && d<bestD){ bestD=d; hit=c; }
  });
  return hit;
}

// veteran soldiers are harder to hit (folded in here as a bonus on top of the unit's base
// exposure, so it flows through every existing damage-avoidance path -- enemyCounterAttack,
// resolveVehicleAssault, mortar friendly fire, the squad/infantry duel -- for free)
function getUnitExposure(candidate){
  if(candidate.kind==='hq') return state.hq.exposure;
  if(candidate.kind==='mortar') return state.mortars[candidate.idx].exposure;
  if(candidate.kind==='scout'){
    const u = state.scouts[candidate.idx];
    return u.exposure + unitAvgVetLevel(u.soldiers)*VET_EXPOSURE_BONUS_PER_LEVEL;
  }
  if(candidate.kind==='squad'){
    const u = state.squads[candidate.idx];
    return u.exposure + unitAvgVetLevel(u.soldiers)*VET_EXPOSURE_BONUS_PER_LEVEL;
  }
  if(candidate.kind==='sniper'){
    const u = state.snipers[candidate.idx];
    return u.exposure + unitAvgVetLevel(u.soldiers)*VET_EXPOSURE_BONUS_PER_LEVEL;
  }
  return EXPOSURE_DEFAULT;
}
function rollExposureHit(exposure){
  return Math.random() < hitChanceFromExposure(exposure);
}

function nearestFriendlyAsset(x, y, includeSquads){
  const candidates = [];
  if(state.hq.hp>0) candidates.push({kind:'hq', idx:0, x:state.hq.x, y:state.hq.y});
  state.scouts.forEach((s,idx)=>{
    if(unitAlive(s)) candidates.push({kind:'scout', idx, x:s.x, y:s.y});
  });
  state.mortars.forEach((m,idx)=>{
    if(m.hp>0) candidates.push({kind:'mortar', idx, x:m.x, y:m.y});
  });
  if(includeSquads){
    state.squads.forEach((sq,idx)=>{
      if(sq.soldiers.some(s=>s.alive)) candidates.push({kind:'squad', idx, x:sq.x, y:sq.y});
    });
    state.snipers.forEach((sn,idx)=>{
      if(sn.soldiers.some(s=>s.alive)) candidates.push({kind:'sniper', idx, x:sn.x, y:sn.y});
    });
  }
  // per user request: 擬陣地 lure enemy indirect fire/vehicle assaults away from real assets
  // -- scoring their distance as if it were much shorter makes them "win" nearest-target
  // selection more often than a real asset at the same actual range, more so at night.
  state.decoys.forEach((d,idx)=>{
    if(!d.destroyed) candidates.push({kind:'decoy', idx, x:d.x, y:d.y});
  });
  const decoyLureMult = state.weather==='night' ? DECOY_LURE_MULT_NIGHT : DECOY_LURE_MULT_DAY;
  let best=null, bestScore=Infinity;
  candidates.forEach(c=>{
    const d = Math.hypot(x-c.x, y-c.y);
    const score = c.kind==='hq' ? d*0.55 : c.kind==='decoy' ? d*decoyLureMult : d;
    if(score<bestScore){ bestScore=score; best={...c, dist:d}; }
  });
  return best;
}

// per user request: infantry groups no longer share one HP pool -- damage lands on
// individual troops (in random order, so hits don't always fall on the same soldier)
// until it's spent, killing whichever soldiers run out of HP. t.hp is kept as the sum
// of surviving troops' HP so every existing "aggregate" read site (HP bars, the
// enemy-breakdown panel, wasFullHp/destroyed checks) keeps working unchanged.
function applyDamageToTarget(t, dmg){
  if(dmg<=0) return;
  if(t.type==='infantry' && t.troops){
    let remaining = dmg;
    const order = t.troops.map((s,i)=>i).filter(i=>t.troops[i].alive);
    for(let k=order.length-1;k>0;k--){ const j=Math.floor(Math.random()*(k+1)); [order[k],order[j]]=[order[j],order[k]]; }
    for(const i of order){
      if(remaining<=0) break;
      const s = t.troops[i];
      const take = Math.min(s.hp, remaining);
      s.hp -= take;
      remaining -= take;
      if(s.hp<=0){ s.hp = 0; s.alive = false; }
    }
    t.hp = t.troops.reduce((sum,s)=>sum+s.hp, 0);
  } else {
    t.hp -= dmg;
  }
}

function damageFriendlyAsset(target, dmg, sourceLabel){
  if(target.kind==='decoy'){
    const d = state.decoys[target.idx];
    if(!d || d.destroyed) return;
    d.hp = Math.max(0, d.hp-dmg);
    log('sys','被弾', `${sourceLabel}が擬陣地を攻撃。被害 ${dmg}。`);
    if(d.hp<=0){
      d.destroyed = true;
      log('sys','被弾', `擬陣地が破壊された。`);
      spawnDestructionEffect(d.x, d.y, '擬陣地 破壊', FRIENDLY_MARK_COLOR);
    }
  } else if(target.kind==='hq'){
    const wasAlive = state.hq.hp>0;
    state.hq.hp = Math.max(0, state.hq.hp-dmg);
    if(state.hq.hp <= state.hq.maxHp*0.3) state.hpDroppedLow = true;
    log('sys','被弾', `${sourceLabel}が<b>指揮所</b>を攻撃。被害 ${dmg}。`);
    if(wasAlive && state.hq.hp<=0) spawnDestructionEffect(state.hq.x, state.hq.y, '指揮所 陥落!', FRIENDLY_MARK_COLOR);
  } else if(target.kind==='scout'){
    const scout = state.scouts[target.idx];
    if(!scout) return;
    const aliveSoldiers = scout.soldiers.filter(s=>s.alive);
    if(aliveSoldiers.length>0){
      const victim = choice(aliveSoldiers);
      victim.alive = false;
      log('sys','被弾', `${sourceLabel}が斥候${target.idx+1}を攻撃。<b>${victim.rank} ${victim.name}</b> 戦死。`);
      unitSpeakInjury('scout', target.idx);
      if(aliveSoldiers.length===1){
        spawnDestructionEffect(scout.x, scout.y, `斥候${target.idx+1} 全滅!`, FRIENDLY_MARK_COLOR);
        speakRandomAliveUnit('outburst');
      }
    }
  } else if(target.kind==='squad'){
    const sq = state.squads[target.idx];
    if(!sq) return;
    const aliveSoldiers = sq.soldiers.filter(s=>s.alive);
    if(aliveSoldiers.length>0){
      const victim = choice(aliveSoldiers);
      victim.alive = false;
      log('sys','被弾', `${sourceLabel}が第${target.idx+1}小隊を攻撃。<b>${victim.rank} ${victim.name}</b> 戦死。`);
      unitSpeakInjury('squad', target.idx);
      if(aliveSoldiers.length===1){
        spawnDestructionEffect(sq.x, sq.y, `第${target.idx+1}小隊 全滅!`, FRIENDLY_MARK_COLOR);
        speakRandomAliveUnit('outburst');
      }
    }
  } else if(target.kind==='sniper'){
    const sn = state.snipers[target.idx];
    if(!sn) return;
    const aliveSoldiers = sn.soldiers.filter(s=>s.alive);
    if(aliveSoldiers.length>0){
      const victim = choice(aliveSoldiers);
      victim.alive = false;
      log('sys','被弾', `${sourceLabel}が狙撃${target.idx+1}班を攻撃。<b>${victim.rank} ${victim.name}</b> 戦死。`);
      unitSpeakInjury('sniper', target.idx);
      if(aliveSoldiers.length===1){
        spawnDestructionEffect(sn.x, sn.y, `狙撃${target.idx+1}班 全滅!`, FRIENDLY_MARK_COLOR);
        speakRandomAliveUnit('outburst');
      }
    }
  } else if(target.kind==='mortar'){
    const mortar = state.mortars[target.idx];
    if(!mortar) return;
    const wasAlive = mortar.hp>0;
    mortar.hp = Math.max(0, mortar.hp-dmg);
    if(mortar.hp <= mortar.maxHp*0.2) state.hpDroppedLow = true;
    log('sys','被弾', `${sourceLabel}が迫撃砲${target.idx+1}を攻撃。被害 ${dmg}。`);
    if(mortar.hp>0) unitSpeak('mortar', target.idx, 'warning');
    else if(wasAlive) spawnDestructionEffect(mortar.x, mortar.y, `迫撃砲${target.idx+1} 戦闘不能!`, FRIENDLY_MARK_COLOR);
  }
}

// Enemy infantry occasionally launches a whole swarm of suicide drones as new
// independent targets, rather than drones only ever being pre-spawned at
// stage start. Each drone is its own weak, independent target (see
// TARGET_TYPES.drone's low hp) -- the threat is in the numbers, not any one
// drone's durability.
function spawnInfantryDrone(source){
  const def = TARGET_TYPES.drone;
  const hpMult = (1 + (state.stage-1)*0.08) * DIFFICULTIES[state.difficulty].hpMult;
  const hp = Math.round(def.hp * hpMult);
  const trueX = clamp(source.trueX + rnd(-20,20), 20, CANVAS_W-20);
  const trueY = clamp(source.trueY + rnd(-20,20), 20, CANVAS_H-20);
  const dx = trueX-OP.x, dy = trueY-OP.y;
  const trueBearing = (Math.atan2(dx,-dy)*180/Math.PI+360)%360;
  const trueDistance = Math.sqrt(dx*dx+dy*dy);
  state.targetsSpawnedTotal += 1;
  const drone = {
    id: 'T'+state.targetsSpawnedTotal,
    type:'drone', def,
    trueX, trueY, trueBearing, trueDistance,
    hp, maxHp:hp,
    destroyed:false, revealed:false, reconCount:0,
    bearingErr: source.bearingErr, distErr: source.distErr,
    bOffset: rnd(-1,1), dOffset: rnd(-1,1),
    impacts:[],
    troops: null,
    suppressed:0,
    exposure: EXPOSURE_DEFAULT,
  };
  state.targets.push(drone);
  return drone;
}
function spawnInfantryDroneSwarm(source){
  const count = Math.round(rnd(INFANTRY_DRONE_SWARM_SIZE[0], INFANTRY_DRONE_SWARM_SIZE[1]));
  const spawned = [];
  for(let i=0;i<count;i++) spawned.push(spawnInfantryDrone(source));
  log('sys','警報', `${source.id} が自爆ドローン${count}機を同時発進させた。`);
  return spawned;
}

// As an enemy unit's own losses (HP) mount, it tends to fall back and
// regroup with the nearest other surviving unit instead of continuing to
// press its own advance alone.
function nearestOtherAliveTarget(t){
  let best=null, bd=Infinity;
  state.targets.forEach(o=>{
    if(o===t || o.destroyed) return;
    const d = Math.hypot(o.trueX-t.trueX, o.trueY-t.trueY);
    if(d<bd){ bd=d; best=o; }
  });
  return best;
}
function mergeAdjustedGoal(t, defaultGoal){
  if(t.hp/t.maxHp > MERGE_HP_THRESHOLD) return defaultGoal;
  const ally = nearestOtherAliveTarget(t);
  if(!ally) return defaultGoal;
  return {x: ally.trueX, y: ally.trueY};
}

// Enemy-laid road mines. Roads are visually hidden but their geometry
// (state.roads) is still tracked purely as a "judgment" data source (see the
// terrainAwareStep comment) -- mines are placed along that same geometry.
function maybePlaceMine(){
  if(!state.roads || state.roads.length===0) return;
  if(state.mines.length >= MINE_MAX_ACTIVE) return;
  if(Math.random() > MINE_PLACEMENT_CHANCE) return;
  const candidateRoads = state.roads.filter(r=>r.length>1);
  if(!candidateRoads.length) return;
  const road = choice(candidateRoads);
  const pt = choice(road);
  state.mines.push({x:pt.x, y:pt.y});
  log('sys','警報', `敵が付近の道路に地雷を敷設した形跡がある。`);
}
function checkMineTrigger(kind, idx, x, y){
  if(!state.mines || !state.mines.length) return;
  const hitIdx = state.mines.findIndex(m=>Math.hypot(m.x-x, m.y-y) <= MINE_TRIGGER_RADIUS_UNITS);
  if(hitIdx<0) return;
  state.mines.splice(hitIdx,1);
  const dmg = Math.round(rnd(MINE_DAMAGE[0], MINE_DAMAGE[1]));
  damageFriendlyAsset({kind, idx}, dmg, '地雷');
  unitSpeak(kind, idx, 'warning');
}

// Artillery no longer sits fixed at spawn forever -- it slowly repositions
// toward the nearest friendly asset (still applying the loss-triggered
// regroup tendency), but holds once within ARTILLERY_STANDOFF_RANGE_UNITS
// rather than closing to melee, since it keeps attacking indirectly via
// enemyCounterAttack regardless of distance.
function advanceEnemyArtillery(actionTurns){
  const artillery = state.targets.filter(t=>!t.destroyed && t.type==='artillery');
  if(artillery.length===0) return false;
  let moved = false;
  for(let i=0;i<actionTurns;i++){
    artillery.forEach(t=>{
      if(t.destroyed) return;
      const near = nearestFriendlyAsset(t.trueX, t.trueY, true);
      if(!near || near.dist <= ARTILLERY_STANDOFF_RANGE_UNITS) return;
      const step = ARTILLERY_MOVE_CAP * (isSuppressed(t) ? SUPPRESSION_MOVE_MULT : 1);
      const moveGoal = mergeAdjustedGoal(t, near);
      const next = terrainAwareStep(t.trueX, t.trueY, moveGoal.x, moveGoal.y, step);
      t.trueX = next.x; t.trueY = clamp(next.y, 30, CANVAS_H-30);
      const dx = t.trueX-OP.x, dy = t.trueY-OP.y;
      t.trueBearing = (Math.atan2(dx,-dy)*180/Math.PI+360)%360;
      t.trueDistance = Math.sqrt(dx*dx+dy*dy);
      moved = true;
    });
  }
  return moved;
}

function resolveVehicleAssault(actionTurns){
  const vehicles = state.targets.filter(t=>!t.destroyed && t.type==='vehicle');
  if(vehicles.length===0) return false;
  let anyEvent = false;
  for(let i=0;i<actionTurns;i++){
    vehicles.forEach(t=>{
      if(t.destroyed) return;
      const near = nearestFriendlyAsset(t.trueX, t.trueY, true);
      if(!near) return;
      if(near.dist <= VEHICLE_ASSAULT_RANGE){
        anyEvent = true;
        const e = estPos(t);
        if(revealTarget(t)){
          log('op','斥候', `${t.id} が至近距離で接触、<b>${t.def.label}</b>と識別。`);
        }
        if(rollExposureHit(getUnitExposure(near))){
          const altMult = altitudeBonus(t.trueX, t.trueY, near.x, near.y);
          const dmg = Math.round(rnd(VEHICLE_ASSAULT_DAMAGE[0], VEHICLE_ASSAULT_DAMAGE[1]) * altMult);
          damageFriendlyAsset(near, dmg, `${t.id}(装甲車)の突撃`);
          enemyTracers.push({startX:e.x, startY:e.y, endX:near.x, endY:near.y, born:performance.now(), duration:260});
        } else {
          log('sys','回避', `${t.id}(装甲車)の突撃を受けたが、${friendlyFireCandidateLabel(near)}は掩蔽率により被弾を免れた。`);
        }
        if(near.kind==='squad'){
          const aliveSoldiers = state.squads[near.idx].soldiers.filter(s=>s.alive);
          if(aliveSoldiers.length>0 && Math.random()<0.5 && rollExposureHit(t.exposure)){
            const antiTankMult = altitudeBonus(near.x, near.y, t.trueX, t.trueY);
            const antiTankDmg = Math.round(rnd(2,6) * antiTankMult);
            t.hp -= antiTankDmg;
            if(t.hp<=0 && !t.destroyed){
              t.destroyed = true; t.hp = 0;
              log('op','斥候', `${t.id} 対戦車射撃により撃破を確認。`);
              onTargetDestroyed(t);
            }
          }
        }
      } else {
        const suppressionMoveMult = isSuppressed(t) ? SUPPRESSION_MOVE_MULT : 1;
        const step = Math.min((45 + state.stage*2.6) * DIFFICULTIES[state.difficulty].advanceMult, VEHICLE_MOVE_CAP) * suppressionMoveMult;
        const moveGoal = mergeAdjustedGoal(t, near);
        let next = null;
        // Vehicles are road-bound: route along the real road network via A*
        // rather than cutting cross-country. Only the final short hop from
        // the nearest road node to the actual (usually off-road) target is
        // a direct line. Falls back to the old free-roaming terrainAwareStep
        // if the road graph never loaded (e.g. 3D terrain/road data failed).
        if(ROAD_GRAPH && ROAD_GRAPH.nodes.length){
          const roadPath = findRoadPath(t.trueX, t.trueY, moveGoal.x, moveGoal.y);
          if(roadPath && roadPath.length){
            const fullPath = roadPath.concat([{x:moveGoal.x, y:moveGoal.y}]);
            next = advanceAlongPath(t.trueX, t.trueY, fullPath, step);
          }
        }
        if(!next) next = terrainAwareStep(t.trueX, t.trueY, moveGoal.x, moveGoal.y, step);
        t.trueX = next.x; t.trueY = clamp(next.y, 30, CANVAS_H-30);
        const dx = t.trueX-OP.x, dy = t.trueY-OP.y;
        t.trueBearing = (Math.atan2(dx,-dy)*180/Math.PI+360)%360;
        t.trueDistance = Math.sqrt(dx*dx+dy*dy);
      }
    });
  }
  return anyEvent;
}

// per user request: infantry's default anti-drone point defense. Runs before
// resolveDroneSwarm each action tick so a squad gets a shot at a drone closing
// in on it while it's still outside DRONE_DETONATE_RANGE, not just after the
// fact -- independent of the squad's current order/standing order (always on).
function resolveSquadAntiDrone(actionTurns){
  let anyEvent = false;
  for(let i=0;i<actionTurns;i++){
    state.squads.forEach((sq, sqIdx)=>{
      const aliveSoldiers = sq.soldiers.filter(s=>s.alive);
      if(aliveSoldiers.length===0) return;
      state.targets.forEach(t=>{
        if(t.destroyed || t.type!=='drone') return;
        if(Math.hypot(t.trueX-sq.x, t.trueY-sq.y) > SQUAD_ANTI_DRONE_RANGE_UNITS) return;
        anyEvent = true;
        if(revealTarget(t)){
          log('op','斥候', `${t.id} を至近距離で捕捉、<b>${t.def.label}</b>と識別。`);
        }
        if(Math.random() < SQUAD_ANTI_DRONE_HIT_CHANCE){
          const dmg = Math.round(rnd(SQUAD_ANTI_DRONE_DMG[0], SQUAD_ANTI_DRONE_DMG[1]));
          t.hp -= dmg;
          enemyTracers.push({startX:sq.x, startY:sq.y, endX:t.trueX, endY:t.trueY, born:performance.now(), duration:150});
          if(t.hp<=0 && !t.destroyed){
            t.destroyed = true; t.hp = 0;
            log('op','前線', `第${sqIdx+1}小隊が${t.id}を対空射撃で<b>撃墜</b>。`);
            onTargetDestroyed(t);
          } else {
            log('op','前線', `第${sqIdx+1}小隊が${t.id}に対空射撃(効果 ${dmg})。`);
          }
        } else {
          log('sys','対空', `第${sqIdx+1}小隊が${t.id}へ対空射撃するも外す。`);
        }
      });
    });
  }
  return anyEvent;
}

function resolveDroneSwarm(actionTurns){
  const drones = state.targets.filter(t=>!t.destroyed && t.type==='drone');
  if(drones.length===0) return false;
  let anyEvent = false;
  for(let i=0;i<actionTurns;i++){
    drones.forEach(t=>{
      if(t.destroyed) return;
      const near = nearestFriendlyAsset(t.trueX, t.trueY, true);
      if(!near) return;
      if(near.dist <= DRONE_DETONATE_RANGE){
        anyEvent = true;
        const e = estPos(t);
        if(revealTarget(t)){
          log('op','斥候', `${t.id} の自爆攻撃を確認、<b>${t.def.label}</b>と識別。`);
        }
        if(rollExposureHit(getUnitExposure(near))){
          const dmg = Math.round(rnd(DRONE_DETONATE_DAMAGE[0], DRONE_DETONATE_DAMAGE[1]));
          damageFriendlyAsset(near, dmg, `${t.id}(ドローン)の自爆`);
          enemyTracers.push({startX:e.x, startY:e.y, endX:near.x, endY:near.y, born:performance.now(), duration:180});
        } else {
          log('sys','回避', `${t.id}(ドローン)が自爆したが、${friendlyFireCandidateLabel(near)}は掩蔽率により被弾を免れた。`);
        }
        // per user request: a self-detonating drone is consumed by its own attack run
        // rather than flying back to spawn to try again -- otherwise state.targets grows
        // without bound over a long wave (see resolveEnemyTurn's end-of-tick pruning).
        t.destroyed = true; t.hp = 0;
        onTargetDestroyed(t);
      } else {
        const dx = near.x-t.trueX, dy = near.y-t.trueY;
        const dist = Math.hypot(dx,dy) || 1;
        const step = Math.min(DRONE_SPEED*DIFFICULTIES[state.difficulty].advanceMult, dist);
        t.trueX += dx/dist*step;
        t.trueY = clamp(t.trueY + dy/dist*step, 20, CANVAS_H-20);
        const bx = t.trueX-OP.x, by = t.trueY-OP.y;
        t.trueBearing = (Math.atan2(bx,-by)*180/Math.PI+360)%360;
        t.trueDistance = Math.sqrt(bx*bx+by*by);
      }
    });
  }
  return anyEvent;
}

function advanceEnemyInfantry(actionTurns){
  const enemyInfantry = state.targets.filter(t=>!t.destroyed && t.type==='infantry');
  if(enemyInfantry.length===0) return false;
  const aliveSquads = state.squads.filter(sq=>sq.soldiers.some(s=>s.alive));
  const squadsAlive = aliveSquads.length>0;
  const goal = squadsAlive ? FRIENDLY_INF_POS : state.hq;
  const minX = squadsAlive ? FRIENDLY_INF_POS.x+20 : state.hq.x+20;
  let moved = false;
  for(let i=0;i<actionTurns;i++){
    enemyInfantry.forEach(t=>{
      if(t.destroyed) return;
      if(state.stage >= DRONE_INTRO_STAGE){
        if(t._droneCooldown === undefined) t._droneCooldown = Math.floor(rnd(2, INFANTRY_DRONE_COOLDOWN_TICKS));
        if(t._droneCooldown > 0){
          t._droneCooldown -= 1;
        // per-group chance is divided by the live group count (see the matching
        // correction in enemyCounterAttack) so splitting infantry into more formation
        // groups doesn't also multiply total drone-swarm launch volume per tick
        } else if(Math.random() < INFANTRY_DRONE_LAUNCH_CHANCE/Math.max(1, enemyInfantry.length)){
          spawnInfantryDroneSwarm(t);
          t._droneCooldown = INFANTRY_DRONE_COOLDOWN_TICKS;
        }
      }
      const inContact = aliveSquads.some(sq=>Math.hypot(t.trueX-sq.x, t.trueY-sq.y) <= SQUAD_ENGAGE_RANGE);
      if(inContact){
        if(!t._contactLogged){
          t._contactLogged = true;
          log('op','斥候', `${t.id} が自軍小隊と接触。前進を停止し交戦中。`);
        }
        return;
      }
      if(!squadsAlive && state.hq.hp>0){
        const hqDist = Math.hypot(t.trueX-state.hq.x, t.trueY-state.hq.y);
        if(hqDist <= SQUAD_ENGAGE_RANGE){
          if(rollExposureHit(state.hq.exposure)){
            const dmg = Math.round(rnd(3,8) * DIFFICULTIES[state.difficulty].counterMult);
            state.hq.hp = Math.max(0, state.hq.hp-dmg);
            if(state.hq.hp <= state.hq.maxHp*0.3) state.hpDroppedLow = true;
            log('sys','被弾', `${t.id} が指揮所に肉薄、突入攻撃(被害 ${dmg})。`);
          } else {
            log('sys','回避', `${t.id} が指揮所に肉薄したが、掩蔽率により突入攻撃を回避。`);
          }
          moved = true;
          return;
        }
      }
      const step = INFANTRY_MOVE_CAP * (t.speedMult||1) * (isSuppressed(t) ? SUPPRESSION_MOVE_MULT : 1);
      if(t.trueX > minX){
        const moveGoal = mergeAdjustedGoal(t, goal);
        const next = terrainAwareStep(t.trueX, t.trueY, moveGoal.x, moveGoal.y, step);
        t.trueX = Math.max(minX, next.x);
        t.trueY = clamp(next.y, 30, CANVAS_H-30);
        const dx = t.trueX-OP.x, dy = t.trueY-OP.y;
        t.trueBearing = (Math.atan2(dx,-dy)*180/Math.PI+360)%360;
        t.trueDistance = Math.sqrt(dx*dx+dy*dy);
        moved = true;
      }
    });
  }
  return moved;
}

// shoot-and-scoot: a mortar that keeps firing from the same spot risks the enemy's
// counter-battery radar triangulating it (see the MORTAR_CB_* constants). Once flagged, the
// player has a couple of turns to actually complete a relocation (resolveOneMortarDecision
// clears cbWarnTurns on arrival) before a guaranteed, heavy strike lands on that position.
function resolveMortarCounterBattery(actionTurns){
  let anyEvent = false;
  for(let i=0;i<actionTurns;i++){
    state.mortars.forEach(mortar=>{
      if(mortar.hp<=0) return;
      if(mortar.cbWarnTurns!==null && mortar.cbWarnTurns!==undefined){
        mortar.cbWarnTurns -= 1;
        if(mortar.cbWarnTurns<=0){
          mortar.cbWarnTurns = null;
          mortar.shotsSinceMove = 0;
          anyEvent = true;
          log('sys','警報', `迫撃砲${mortar.id+1}、対砲兵射撃着弾!`);
          projectiles.push({
            startX: ENEMY_SPAWN_MIN_X, startY: clamp(mortar.y, 60, CANVAS_H-60),
            endX: mortar.x, endY: mortar.y,
            born: performance.now(),
            duration: FLIGHT_DURATION,
            onLand: ()=>{
              const dmg = Math.round(rnd(MORTAR_CB_STRIKE_DMG[0], MORTAR_CB_STRIKE_DMG[1]) * DIFFICULTIES[state.difficulty].counterMult);
              damageFriendlyAsset({kind:'mortar', idx:mortar.id}, dmg, '敵対砲兵レーダーによる制圧射撃');
              render();
            }
          });
        }
        return;
      }
      if(mortar.shotsSinceMove > MORTAR_CB_SHOTS_THRESHOLD){
        const chance = MORTAR_CB_DETECT_BASE + state.stage*0.01;
        if(Math.random() < chance){
          mortar.cbWarnTurns = MORTAR_CB_WARN_TURNS;
          anyEvent = true;
          log('sys','警告', `迫撃砲${mortar.id+1}、同一陣地からの連続射撃を敵対砲兵レーダーに捕捉された可能性!${MORTAR_CB_WARN_TURNS}ターン以内に陣地転換せよ。`);
          unitSpeak('mortar', mortar.id, 'warning');
        }
      }
    });
  }
  return anyEvent;
}

function resolveEnemyTurn(actionTurns){
  log('sys','敵ターン', '━━━ 敵が行動 ━━━');
  maybePlaceMine();
  const advanced = advanceEnemyInfantry(actionTurns);
  const repositioned = advanceEnemyArtillery(actionTurns);
  const assaulted = resolveVehicleAssault(actionTurns);
  const antiDroned = resolveSquadAntiDrone(actionTurns);
  const swarmed = resolveDroneSwarm(actionTurns);
  const hit = enemyCounterAttack(actionTurns);
  const cbEvent = resolveMortarCounterBattery(actionTurns);
  let infEvent = false;
  if(!allSquadsWiped()){
    infEvent = resolveSquadOrders(actionTurns);
  }
  let sniperEvent = false;
  if(!allSnipersWiped()){
    sniperEvent = resolveSniperOrders(actionTurns);
  }
  if(!hit && !infEvent && !sniperEvent && !advanced && !assaulted && !swarmed && !cbEvent && !antiDroned){
    log('sys','敵ターン', '目立った動きなし。');
  }
  // per user request: 交戦時のサウンド -- looping battlefield-combat ambience plays while
  // squads/snipers are actively engaging this turn, and pauses again once nothing is
  // actively engaging.
  if(infEvent || sniperEvent || antiDroned) playCombatAmbience(); else stopCombatAmbience();
  state.targets.forEach(t=>{
    if(t.suppressed>0) t.suppressed = Math.max(0, t.suppressed-actionTurns);
  });
  // per user request: destroyed targets were never actually removed from state.targets
  // (only flagged), so a long wave with heavy drone-swarm spawning could grow this array
  // (and the per-tick/per-frame work that scans it) without bound. Prune here, once per
  // decision cycle, well after every resolve* pass above has finished reading it this tick.
  if(state.targets.some(t=>t.destroyed)){
    state.targets.forEach(t=>{ if(t.destroyed) disposeMarker3d('target'+t.id); });
    state.targets = state.targets.filter(t=>!t.destroyed);
  }
}

// per user request: a scout currently holding eyes-on the target (inScoutConeFor, not the
// isTargetDetected-style inScoutCone which treats "no scouts left" as "everything visible" --
// that fallback would perversely make every shot perfectly precise once all scouts are dead)
// gives the mortar a full, error-free correction instead of the usual partial one. Gives
// scouts a clear, high-value job: babysit the one target you need a guaranteed kill on.
function scoutHasEyesOn(t){
  return state.scouts.some(s=>inScoutConeFor(s,t));
}
function launchMortarVolley(mortar, shell, fuze, count, aim, snappedTarget, onVolleyDone){
  // shoot-and-scoot: every volley fired counts against the same-position streak (see
  // resolveMortarCounterBattery); resolveOneMortarDecision resets this back to 0 once the
  // mortar actually completes a relocation.
  mortar.shotsSinceMove = (mortar.shotsSinceMove||0) + 1;
  // per user request: fire aimed at an identified target is corrected part of the way from
  // the raw (error-prone) spotted estimate toward the target's true position -- see
  // MORTAR_FIRE_CORRECTION_FRAC. A manually-clicked bare coordinate (no snappedTarget) has no
  // true position to correct toward, so it's unaffected. A scout actively watching the target
  // right now (see scoutHasEyesOn) instead gets the full 100% correction.
  const scoutGuided = !!(snappedTarget && scoutHasEyesOn(snappedTarget));
  const correctionFrac = scoutGuided ? 1 : MORTAR_FIRE_CORRECTION_FRAC;
  const aimX = snappedTarget ? aim.x + (snappedTarget.trueX-aim.x)*correctionFrac : aim.x;
  const aimY = snappedTarget ? aim.y + (snappedTarget.trueY-aim.y)*correctionFrac : aim.y;
  const dispersion = computeDispersionAt() * WEATHER_TYPES[state.weather].dispersionMult * (SHELL_DISPERSION_MULT[shell]||1);
  const base = 25;

  const brg = bearingBetween(mortar.x, mortar.y, aimX, aimY);
  const dist = Math.hypot(aimX-mortar.x, aimY-mortar.y);
  const aimLabel = snappedTarget ? snappedTarget.id : `座標(方位${Math.round(brg)}°/距離${unitsToMeters(dist)}m)`;
  log('fdc','FDC', `迫撃砲${mortar.id+1}: ${aimLabel} へ射撃要求。${SHELLS[shell]}・${FUZES[fuze]}・${count}発。`);
  log('mortar','迫撃砲班', `迫撃砲${mortar.id+1} 了解。${count}発装填、撃て!`);
  if(scoutGuided) log('op','斥候', `${snappedTarget.id} を観測中、着弾修正データを送る。`);

  let pending = count;
  let hitAny = false;
  const volleyImpacts = [];

  for(let i=0;i<count;i++){
    setTimeout(()=>{
      playSfx('mortarFire', 0.14);
      const ix = aimX + gauss()*dispersion;
      const iy = aimY + gauss()*dispersion;
      projectiles.push({
        startX: mortar.x, startY: mortar.y-16,
        endX: ix, endY: iy,
        born: performance.now(),
        duration: FLIGHT_DURATION,
        onLand: ()=>{
          volleyImpacts.push({x:ix,y:iy});
          if(shell==='illum' || shell==='smoke' || shell==='marker'){
            hitAny = true;
            if(shell==='illum'){
              state.illumFlares.push({x:ix, y:iy, born:performance.now(), turnsLeft:ILLUM_DURATION_TURNS});
              log('mortar','観測', `弾着${i+1}: 照明弾、上空で破裂。光弾が降下しながら半径${Math.round(ILLUM_RADIUS_M)}mを照射(${ILLUM_DURATION_TURNS}ターン持続)。`);
            } else if(shell==='smoke'){
              state.smokeClouds.push({x:ix, y:iy, turnsLeft:SMOKE_DURATION_TURNS});
              log('mortar','観測', `弾着${i+1}: 発煙弾展開。半径${Math.round(SMOKE_RADIUS_M)}mを遮蔽(${SMOKE_DURATION_TURNS}ターン持続)。`);
            } else {
              let revealedCount = 0;
              state.targets.forEach(target=>{
                if(target.destroyed) return;
                if(Math.hypot(ix-target.trueX, iy-target.trueY) <= MARKER_REVEAL_RADIUS_UNITS){
                  if(revealTarget(target)) revealedCount += 1;
                }
              });
              log('mortar','観測', `弾着${i+1}: マーカー弾(試射)着弾。半径200m以内の目標${revealedCount}件を捕捉、以後表示継続。`);
            }
            pending -= 1;
            if(pending <= 0){
              finalizeVolley(snappedTarget, hitAny, volleyImpacts);
              onVolleyDone();
            }
            render();
            return;
          }
          const killRadius = SHELL_KILL_RADIUS_UNITS[shell];
          // per user request: proximity-fused HE bursts in the air, so it catches every drone
          // within the kill radius at once instead of only ever downing one drone per round --
          // the intended counter to a whole swarm arriving together. Every other shell/fuze
          // (and proximity HE against anything that isn't a drone) keeps the normal
          // single-nearest-target resolution below.
          const isProximityAirburst = shell==='he' && fuze==='proximity';
          const dronesInBurst = isProximityAirburst
            ? state.targets.filter(target=>!target.destroyed && target.type==='drone' && Math.hypot(ix-target.trueX, iy-target.trueY)<=killRadius)
            : [];
          if(dronesInBurst.length>0){
            hitAny = true;
            dronesInBurst.forEach(target=>{
              const wasFullHp = target.hp === target.maxHp;
              const dmg = Math.round(base*effectMultiplier(shell, fuze, target.type));
              applyDamageToTarget(target, dmg);
              target.impacts.push({x:ix,y:iy});
              target.suppressed = SUPPRESSION_TURNS;
              if(wasFullHp && target.hp<=0) unlockAchievement('oneShotKill');
              if(target.hp<=0 && !target.destroyed){
                target.destroyed = true;
                target.hp = 0;
                onTargetDestroyed(target);
              }
            });
            log('mortar','観測', `弾着${i+1}: <b>空中炸裂</b>。近接信管がドローン${dronesInBurst.length}機を同時に捕捉、一掃した。`);
            pending -= 1;
            if(pending <= 0){
              finalizeVolley(snappedTarget, hitAny, volleyImpacts);
              onVolleyDone();
            }
            render();
            return;
          }
          let hitTarget = null, nearMiss = false;
          state.targets.forEach(target=>{
            if(target.destroyed || hitTarget) return;
            const dToTrue = Math.hypot(ix-target.trueX, iy-target.trueY);
            if(dToTrue <= killRadius) hitTarget = target;
            else if(dToTrue <= killRadius*1.6) nearMiss = true;
          });
          if(hitTarget){
            const wasFullHp = hitTarget.hp === hitTarget.maxHp;
            const tmult = effectMultiplier(shell, fuze, hitTarget.type);
            const dmg = Math.round(base*tmult);
            applyDamageToTarget(hitTarget, dmg);
            hitTarget.impacts.push({x:ix,y:iy});
            hitAny = true;
            const wasSuppressed = isSuppressed(hitTarget);
            hitTarget.suppressed = SUPPRESSION_TURNS;
            log('mortar','観測', `弾着${i+1}: <b>命中</b> (${hitTarget.id} 算定効果 ${dmg})${wasSuppressed?'':' ― 制圧'}`);
            if(wasFullHp && hitTarget.hp<=0) unlockAchievement('oneShotKill');
            if(hitTarget.hp<=0 && !hitTarget.destroyed){
              hitTarget.destroyed = true;
              hitTarget.hp = 0;
              log('fdc','FDC', `${hitTarget.id} <b>撃破を確認</b>。`);
              onTargetDestroyed(hitTarget);
            }
          } else {
            const ffTarget = checkFriendlyFireAt(ix, iy, killRadius);
            if(ffTarget){
              const dmg = base;
              damageFriendlyAsset(ffTarget, dmg, `迫撃砲${mortar.id+1}の誤射`);
              log('sys','誤射', `弾着${i+1}: <b>味方への誤射</b> (${friendlyFireCandidateLabel(ffTarget)} 被害 ${dmg})。目標との距離・信管を確認せよ。`);
            } else {
              if(nearMiss){
                state.targets.forEach(target=>{
                  if(target.destroyed) return;
                  if(Math.hypot(ix-target.trueX, iy-target.trueY) <= killRadius*1.6){
                    target.suppressed = Math.max(target.suppressed||0, SUPPRESSION_NEARMISS_TURNS);
                  }
                });
              }
              if(snappedTarget && !snappedTarget.destroyed) snappedTarget.impacts.push({x:ix,y:iy});
              log('mortar','観測', nearMiss ? `弾着${i+1}: 至近弾。効果は限定的だが制圧効果あり。` : `弾着${i+1}: 外れ。修正が必要。`);
            }
          }
          pending -= 1;
          if(pending <= 0){
            finalizeVolley(snappedTarget, hitAny, volleyImpacts);
            onVolleyDone();
          }
          render();
        }
      });
    }, i*LAUNCH_INTERVAL);
  }
}

// per user request: an "自動" toggle button beside 決心 that presses it automatically every
// 0.5s until pressed again. commitDecision() already no-ops safely whenever it isn't valid to
// commit (animating, stage resolved, placement pending, etc.), so the interval can just keep
// firing blindly without needing its own state checks.
let autoCommitTimer = null;
function isAutoCommitRunning(){ return autoCommitTimer!==null; }
function toggleAutoCommit(){
  if(autoCommitTimer){
    clearInterval(autoCommitTimer);
    autoCommitTimer = null;
    log('sys','システム', '自動決心を停止。');
  } else {
    autoCommitTimer = setInterval(()=>{
      // per user request: pause auto-commit while any unit instruction panel is open, so it
      // doesn't advance the turn out from under the player mid-decision
      if(state.commandBox || state.enemyCommandBox || state.decoyCommandBox) return;
      commitDecision();
    }, 500);
    log('sys','システム', '自動決心を開始(0.5秒間隔)。');
  }
  render();
}

function commitDecision(){
  if(!state || state.stageResolved || state.animating || state.snipeMortarStrikesPending>0 || state.placementPending || state.decoyPlacementPending) return;

  // A mortar whose queued shot can't be afforded only cancels THAT mortar's
  // order (reverts to standby) -- it must never block the whole decision
  // cycle, or the entire game (including the enemy's turn) softlocks
  // permanently once ammo runs low, since every future 決心 press would hit
  // the same shortfall and return before anything else ever resolves.
  let heBudget = state.ammo.he, heatBudget = state.ammo.heat;
  const firingMortars = [];
  state.mortars.forEach(m=>{
    if(m.hp<=0 || !m.pendingFire) return;
    if(m.fireShell==='he' || m.fireShell==='heat'){
      const budget = m.fireShell==='he' ? heBudget : heatBudget;
      if(m.fireCount > budget){
        log('sys','システム', `迫撃砲${m.id+1}: 弾薬不足のため射撃指示を取消。`);
        unitSpeak('mortar', m.id, 'ammo');
        m.pendingFire = null;
        m.order = 'standby';
        return;
      }
      if(m.fireShell==='he') heBudget -= m.fireCount; else heatBudget -= m.fireCount;
    }
    firingMortars.push(m);
  });
  const ammoNeeded = {he: state.ammo.he-heBudget, heat: state.ammo.heat-heatBudget};

  const turnCost = firingMortars.length>0 ? 2 : 1;

  state.turns += turnCost;
  state.ammo.he -= ammoNeeded.he;
  state.ammo.heat -= ammoNeeded.heat;

  state.smokeClouds.forEach(c=>{ c.turnsLeft -= 1; });
  state.smokeClouds = state.smokeClouds.filter(c=>c.turnsLeft>0);
  state.illumFlares.forEach(f=>{ f.turnsLeft -= 1; });
  state.illumFlares = state.illumFlares.filter(f=>f.turnsLeft>0);

  speakCoordination();
  log('sys','司令部', '━━━ 決心 ━━━');
  resolveScoutDecision();
  resolveMortarDecision();
  resolveEnemyTurn(turnCost);

  if(allMortarsWiped() || allSquadsWiped()){
    checkEnd(); render(); return;
  }

  const volleys = [];
  firingMortars.forEach(m=>{
    const aim = m.pendingFire;
    m.pendingFire = null;
    if(m.hp<=0) return;
    const snappedTarget = aim.snappedId ? state.targets.find(x=>x.id===aim.snappedId) : null;
    if(snappedTarget && snappedTarget.destroyed){
      log('fdc','FDC', `${snappedTarget.id} は既に撃破済み。迫撃砲${m.id+1}の射撃指示を中止。`);
      return;
    }
    volleys.push({mortar:m, shell:m.fireShell, fuze:m.fireFuze, count:m.fireCount, aim, snappedTarget});
  });

  if(volleys.length>0){
    state.animating = true;
    let remaining = volleys.length;
    volleys.forEach(v=>{
      launchMortarVolley(v.mortar, v.shell, v.fuze, v.count, v.aim, v.snappedTarget, ()=>{
        remaining -= 1;
        if(remaining<=0){
          state.animating = false;
          checkEnd();
          render();
        }
      });
    });
  } else {
    checkEnd();
  }
  render();
}

function finalizeVolley(snappedTarget, hitAny, volleyImpacts){
  if(!hitAny){
    log('fdc','FDC', `着弾効果不十分。情報精度が低ければ弾種・信管を見直せ。`);
  }
  if(snappedTarget && !snappedTarget.destroyed && volleyImpacts.length){
    const n = volleyImpacts.length;
    const avgX = volleyImpacts.reduce((s,p)=>s+p.x,0)/n;
    const avgY = volleyImpacts.reduce((s,p)=>s+p.y,0)/n;
    const dx = snappedTarget.trueX-avgX, dy = snappedTarget.trueY-avgY;
    const ewDir = dx>=0?'東':'西', nsDir = dy<0?'北':'南';
    const ewAmt = unitsToMeters(Math.abs(dx)), nsAmt = unitsToMeters(Math.abs(dy));
    log('op','斥候', `弾着観測。目標は着弾点より${ewDir}${ewAmt}m、${nsDir}${nsAmt}m。修正要求、次弾に反映せよ。`);
    snappedTarget.bearingErr *= 0.75;
    snappedTarget.distErr *= 0.75;
  }
}

function updateProjectiles(){
  const now = performance.now();
  projectiles = projectiles.filter(p=>{
    const prog = (now-p.born)/p.duration;
    if(prog >= 1){
      flashes.push({x:p.endX, y:p.endY, born:now, life:400});
      p.onLand();
      return false;
    }
    return true;
  });
  flashes = flashes.filter(f => now - f.born < f.life);
}

function updateEnemyTracers(){
  const now = performance.now();
  enemyTracers = enemyTracers.filter(tr=>{
    const prog = (now-tr.born)/tr.duration;
    if(prog >= 1){
      flashes.push({x:tr.endX, y:tr.endY, born:now, life:350});
      return false;
    }
    return true;
  });
}

function checkEnd(){
  if(state.stageResolved) return;

  if(state.hq.hp<=0){
    state.stageResolved = true;
    showStageFailed('hq');
    return;
  }
  if(allMortarsWiped()){
    state.stageResolved = true;
    showStageFailed('hp');
    return;
  }
  if(state.squads.length>0 && allSquadsWiped()){
    state.stageResolved = true;
    showStageFailed('infantry');
    return;
  }

  const remaining = state.targets.filter(t=>!t.destroyed);
  if(remaining.length===0){
    state.stageResolved = true;
    triggerWaveClearSequence();
    return;
  }

  const hasAmmo = state.ammo.he>0 || state.ammo.heat>0;
  const canFightOn = hasAmmo || state.snipers.some(sn=>sn.soldiers.some(s=>s.alive)) || state.squads.some(sq=>sq.soldiers.some(s=>s.alive));
  if(!canFightOn){
    state.stageResolved = true;
    log('sys','システム','全弾薬を消費し、交戦可能な部隊も残っていない。任務継続不能。');
    showStageFailed('ammo');
  }
}

// per user request: after the last enemy of a wave is destroyed, let the destruction effect
// (see spawnDestructionEffect) actually finish playing out before anything else happens, then
// hold a further 2 second beat with a fanfare before the WAVE CLEAR screen appears.
// state.stageResolved is already true by the time this runs (set in checkEnd), which already
// blocks further player actions/decisions for the whole sequence -- rendering itself keeps
// running so the hold doesn't look like the game hung.
const WAVE_CLEAR_EFFECT_WAIT_MS = 1900;
const WAVE_CLEAR_FANFARE_HOLD_MS = 2000;
function triggerWaveClearSequence(){
  setTimeout(()=>{
    playSfx('fanfare', 0.5);
    setTimeout(()=>{
      // per user request: on top of the usual money reward, the player picks one of three
      // bonuses (see showWaveRewardChoice/chooseWaveReward) before the WAVE CLEAR summary
      // shows -- skipped on the final wave, since there's no next wave to carry a bonus into.
      if(state.stage >= STAGE_COUNT){
        handleStageClear();
      } else {
        showWaveRewardChoice();
      }
      render();
    }, WAVE_CLEAR_FANFARE_HOLD_MS);
  }, WAVE_CLEAR_EFFECT_WAIT_MS);
}

function showWaveRewardChoice(){
  const body = document.getElementById('wave-reward-body');
  body.innerHTML = `
    <div class="shop-row">
      <div><div class="label">小隊を1個追加</div><div class="sub">新たな歩兵小隊(${SQUAD_SIZE}名)が編成され前線に加わる</div></div>
      <div class="actions"><button class="btn primary" onclick="chooseWaveReward('squad')">選択</button></div>
    </div>
    <div class="shop-row">
      <div><div class="label">斥候班を1個追加</div><div class="sub">新たな斥候班(${SCOUT_SQUAD_SIZE}名)が編成され前線に加わる</div></div>
      <div class="actions"><button class="btn primary" onclick="chooseWaveReward('scout')">選択</button></div>
    </div>
    <div class="shop-row">
      <div><div class="label">迫撃砲弾を補充</div><div class="sub">HE・HEATをランダムな数量だけ補給する</div></div>
      <div class="actions"><button class="btn primary" onclick="chooseWaveReward('ammo')">選択</button></div>
    </div>
  `;
  document.getElementById('wave-reward-overlay').classList.add('show');
}

function chooseWaveReward(kind){
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

function computeReward(){
  const base = 150 + state.stage*70;
  const turnsPar = state.targetsSpawnedTotal*6;
  const turnsBonus = Math.max(0, Math.round((turnsPar - state.turns) * 8));
  const ammoBonus = (state.ammo.he+state.ammo.heat)*6;
  const hpFrac = state.mortars.length ? state.mortars.reduce((s,m)=>s+m.hp/m.maxHp,0)/state.mortars.length : 0;
  const hpBonus = Math.round(hpFrac*300);
  const infFrac = totalAliveSoldiers()/totalSquadCapacity();
  const infBonus = Math.round(infFrac*150);
  const scoutFrac = state.scouts.length ? state.scouts.reduce((s,sc)=>s+unitAliveCount(sc)/sc.soldiers.length,0)/state.scouts.length : 0;
  const scoutBonus = Math.round(scoutFrac*100);
  const sniperFrac = state.snipers.length ? state.snipers.reduce((s,sn)=>s+sn.soldiers.filter(x=>x.alive).length/sn.soldiers.length,0)/state.snipers.length : 0;
  const sniperBonus = Math.round(sniperFrac*100);
  const hqFrac = state.hq.hp/state.hq.maxHp;
  const hqBonus = Math.round(hqFrac*200);
  const total = Math.round((base+turnsBonus+ammoBonus+hpBonus+infBonus+scoutBonus+sniperBonus+hqBonus) * DIFFICULTIES[state.difficulty].rewardMult);
  return {base,turnsBonus,ammoBonus,hpBonus,infBonus,scoutBonus,sniperBonus,hqBonus,total};
}

function applyWaveResupply(){
  const hpFrac = state.mortars.length ? state.mortars.reduce((s,m)=>s+m.hp/m.maxHp,0)/state.mortars.length : 0;
  const infFrac = totalAliveSoldiers()/totalSquadCapacity();
  const scoutFrac = state.scouts.length ? state.scouts.reduce((s,sc)=>s+unitAliveCount(sc)/sc.soldiers.length,0)/state.scouts.length : 0;
  const sniperFrac = state.snipers.length ? state.snipers.reduce((s,sn)=>s+sn.soldiers.filter(x=>x.alive).length/sn.soldiers.length,0)/state.snipers.length : 0;
  const hqFrac = state.hq.hp/state.hq.maxHp;
  const perf = (hpFrac+infFrac+scoutFrac+sniperFrac+hqFrac)/5;
  const ammoHe = Math.round(10*perf);
  const ammoHeat = Math.round(5*perf);
  const personnel = Math.round(4*perf);
  state.ammo.he += ammoHe;
  state.ammo.heat += ammoHeat;
  state.reserve += personnel;
  return {ammoHe, ammoHeat, personnel, perf};
}

// per user request: every soldier who survives a cleared wave earns veteran XP (see the
// VET_* constants) -- called once per wave-clear, before the reward/achievement checks below.
function awardVeteranXp(){
  const groups = [
    {units:state.squads,  label:i=>`第${i+1}小隊`},
    {units:state.scouts,  label:i=>`斥候${i+1}`},
    {units:state.snipers, label:i=>`狙撃${i+1}班`},
  ];
  const levelUps = [];
  groups.forEach(group=>{
    group.units.forEach((unit,uIdx)=>{
      unit.soldiers.forEach(s=>{
        if(!s.alive) return;
        const before = vetLevelOf(s);
        s.vetXp = (s.vetXp||0) + 1;
        const after = vetLevelOf(s);
        if(after>before){
          levelUps.push(`${group.label(uIdx)} ${s.rank} ${s.name}(Lv.${after})`);
          if(after>=VET_MAX_LEVEL) unlockAchievement('veteranMaster');
        }
      });
    });
  });
  if(levelUps.length) log('fdc','戦果', `古参兵昇進: ${levelUps.join('、')}`);
}

function handleStageClear(){
  speakRandomAliveUnit('victory');
  awardVeteranXp();
  const reward = computeReward();
  state.money += reward.total;

  if(state.mortars.every(m=>m.hp === m.maxHp) && state.hq.hp === state.hq.maxHp) unlockAchievement('flawlessStage');
  if(totalAliveSoldiers() === totalSquadCapacity()) unlockAchievement('perfectSquad');
  const startAmmo = state.stageStartSnapshot.ammo.he + state.stageStartSnapshot.ammo.heat;
  const nowAmmo = state.ammo.he + state.ammo.heat;
  if(startAmmo>0 && nowAmmo >= startAmmo*0.5) unlockAchievement('ammoSaver');
  if(state.turns <= state.targetsSpawnedTotal*4) unlockAchievement('speedClear');
  if(state.hpDroppedLow) unlockAchievement('ironWall');
  if(state.money >= 5000) unlockAchievement('millionaire');

  if(state.stage >= STAGE_COUNT){
    showGameClear(reward);
  } else {
    const resupply = applyWaveResupply();
    showStageClear(reward, resupply);
  }
}

function showStageClear(reward, resupply){
  const ov = document.getElementById('overlay');
  document.getElementById('overlay-title').textContent = 'WAVE CLEAR';
  document.getElementById('overlay-title').style.color = 'var(--amber)';
  document.getElementById('overlay-text').textContent =
    `WAVE ${state.stage} 撃退成功。報酬 ¥${reward.total.toLocaleString()}(基本¥${reward.base}+速攻¥${reward.turnsBonus}+残弾¥${reward.ammoBonus}+指揮所無傷¥${reward.hqBonus}+砲兵無傷¥${reward.hpBonus}+歩兵無傷¥${reward.infBonus}+斥候無傷¥${reward.scoutBonus}+狙撃無傷¥${reward.sniperBonus}) ／ 所持金 ¥${state.money.toLocaleString()} ／ 補給: 戦果${Math.round(resupply.perf*100)}%によりHE+${resupply.ammoHe}・HEAT+${resupply.ammoHeat}・予備兵力+${resupply.personnel}名`;
  document.getElementById('overlay-buttons').innerHTML =
    `<button class="btn primary" onclick="proceedToShop()">次のWAVEへ</button>`;
  ov.classList.add('show');
  log('fdc','FDC', `WAVE ${state.stage} 撃退成功。報酬 ¥${reward.total.toLocaleString()}を受領。補給: HE+${resupply.ammoHe}/HEAT+${resupply.ammoHeat}/予備兵力+${resupply.personnel}名。`);
}

function proceedToShop(){
  document.getElementById('overlay').classList.remove('show');
  state.stage += 1;
  deployStage();
}

function showGameClear(reward){
  unlockAchievement('campaignComplete');
  const ov = document.getElementById('overlay');
  document.getElementById('overlay-title').textContent = 'ALL WAVES SURVIVED';
  document.getElementById('overlay-title').style.color = 'var(--amber)';
  document.getElementById('overlay-text').textContent =
    `全${STAGE_COUNT}WAVEの猛攻を耐え抜いた。最終報酬 ¥${reward.total.toLocaleString()}。総資産 ¥${state.money.toLocaleString()}。お疲れ様でした、THUNDER-6。`;
  document.getElementById('overlay-buttons').innerHTML =
    `<button class="btn primary" onclick="initGame()">最初から (RESTART)</button>`;
  ov.classList.add('show');
  log('fdc','FDC', `全${STAGE_COUNT}WAVEを耐え抜き作戦完了。最終報酬 ¥${reward.total.toLocaleString()}。`);
}

function showStageFailed(reason){
  speakRandomAliveUnit('panic');
  const ov = document.getElementById('overlay');
  document.getElementById('overlay-title').textContent = 'MISSION FAILED';
  document.getElementById('overlay-title').style.color = 'var(--red)';
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
}

function precisionDots(n){
  let html = '<span class="prec-dots">';
  for(let i=0;i<3;i++) html += `<span class="prec-dot ${i<n?'on':''}"></span>`;
  return html+'</span>';
}

function selectNextTarget(){
  const live = state.targets.filter(t=>!t.destroyed);
  if(live.length===0){ state.selectedId=null; return; }
  if(!live.some(t=>t.id===state.selectedId)) state.selectedId = live[0].id;
}

function handleCanvasClick(evt){
  if(!state || state.stageResolved || state.animating || state.snipeMortarStrikesPending>0) return;
  if(mapDragMoved) return;
  const cv = document.getElementById('board');
  const rect = cv.getBoundingClientRect();
  const pxPixel = evt.clientX-rect.left, pyPixel = evt.clientY-rect.top;
  let px, py;
  if(threeReady){
    const g = terrainCanvasUnitAt(pxPixel, pyPixel);
    if(!g) return;
    px = g.x; py = g.y;
  } else {
    px = pxPixel/rect.width*CANVAS_W;
    py = pyPixel/rect.height*CANVAS_H;
  }

  if(state.placementPending){
    handlePlacementClick(px, py);
    return;
  }

  if(state.orderMode){
    const mode = state.orderMode;
    state.orderMode = null;
    if(mode.kind==='squad'){
      const sq = state.squads[mode.idx];
      if(sq){
        sq.pendingDest = {
          x: clamp(px, SQUAD_RETREAT_LIMIT_X, SQUAD_ASSAULT_LIMIT_X),
          y: clamp(py, 30, CANVAS_H-30),
        };
        log('sys','前線', `第${mode.idx+1}小隊に移動目標を指示。`);
      }
    } else if(mode.kind==='scout-move'){
      const scout = state.scouts[mode.idx];
      if(scout){
        scout.pendingDest = {
          x: clamp(px, SQUAD_RETREAT_LIMIT_X, SCOUT_ADVANCE_LIMIT_X),
          y: clamp(py, 20, CANVAS_H-20),
        };
        scout.pendingReconTargetId = null;
        log('op','斥候', `斥候${mode.idx+1}、移動目標を了解。`);
      }
    } else if(mode.kind==='scout-recon'){
      const scout = state.scouts[mode.idx];
      let best=null, bestD=Infinity;
      state.targets.forEach(t=>{
        if(t.destroyed || !isTargetDetected(t)) return;
        const vx = t._visX!==undefined ? t._visX : estPos(t).x;
        const vy = t._visY!==undefined ? t._visY : estPos(t).y;
        const d = Math.hypot(vx-px, vy-py);
        if(d<bestD){ bestD=d; best=t; }
      });
      if(scout && best && bestD<=42){
        scout.pendingReconTargetId = best.id;
        scout.pendingDest = null;
        log('op','斥候', `斥候${mode.idx+1}、${best.id} を偵察目標に指示。`);
      } else {
        log('sys','システム','偵察目標が見つかりません。捕捉中の目標付近をクリックしてください。');
      }
    } else if(mode.kind==='mortar-target'){
      const mortar = state.mortars[mode.idx];
      if(mortar){
        setPendingFireAt(px, py, mortar);
        log('fdc','FDC', `迫撃砲${mode.idx+1}、攻撃地点を了解。`);
      }
    } else if(mode.kind==='mortar-move'){
      const mortar = state.mortars[mode.idx];
      if(mortar){
        mortar.pendingDest = {
          x: clamp(px, MORTAR_ZONE_MIN_X, MORTAR_ZONE_MAX_X),
          y: clamp(py, 30, CANVAS_H-30),
        };
        log('mortar','迫撃砲班', `迫撃砲${mode.idx+1}、陣地転換先を了解。`);
      }
    } else if(mode.kind==='sniper-move'){
      const sn = state.snipers[mode.idx];
      if(sn){
        sn.pendingDest = {
          x: clamp(px, SQUAD_RETREAT_LIMIT_X, SQUAD_ADVANCE_LIMIT_X),
          y: clamp(py, 30, CANVAS_H-30),
        };
        log('sys','前線', `狙撃${mode.idx+1}班に移動目標を指示。`);
      }
    } else if(mode.kind==='sniper-target'){
      const sn = state.snipers[mode.idx];
      let best=null, bestD=Infinity;
      state.targets.forEach(t=>{
        if(t.destroyed || !isTargetDetected(t)) return;
        const vx = t._visX!==undefined ? t._visX : estPos(t).x;
        const vy = t._visY!==undefined ? t._visY : estPos(t).y;
        const d = Math.hypot(vx-px, vy-py);
        if(d<bestD){ bestD=d; best=t; }
      });
      if(sn && best && bestD<=42){
        sn.pendingSnipeTargetId = best.id;
        log('mortar','狙撃', `狙撃${mode.idx+1}班、${best.id} を狙撃目標に指示。`);
      } else {
        log('sys','システム','狙撃目標が見つかりません。捕捉中の目標付近をクリックしてください。');
      }
    } else if(mode.kind==='sniper-aim'){
      const sn = state.snipers[mode.idx];
      if(sn){
        sn.aimAngle = bearingBetween(sn.x, sn.y, px, py);
        log('mortar','狙撃', `狙撃${mode.idx+1}班、射撃方向 ${Math.round(sn.aimAngle)}° を指示。`);
      }
    } else if(mode.kind==='mortar-mainline'){
      const mortar = state.mortars[mode.idx];
      if(mortar){
        mortar.mainlineAngle = bearingBetween(mortar.x, mortar.y, px, py);
        log('mortar','迫撃砲班', `迫撃砲${mode.idx+1}、主線方位角 ${Math.round(mortar.mainlineAngle)}° を設定。`);
      }
    }
    render();
    return;
  }

  let decoyHit = -1, decoyBestD = Infinity;
  state.decoys.forEach((d,idx)=>{
    if(d.destroyed) return;
    const dist = Math.hypot(d.x-px, d.y-py);
    if(dist<=20 && dist<decoyBestD){ decoyBestD=dist; decoyHit=idx; }
  });
  if(decoyHit>=0){
    state.decoyCommandBox = decoyHit;
    state.commandBox = null;
    state.enemyCommandBox = null;
    render();
    return;
  }
  state.decoyCommandBox = null;

  const enemyHit = findEnemyTargetAt(px, py);
  if(enemyHit){
    state.enemyCommandBox = enemyHit.id;
    state.commandBox = null;
    render();
    return;
  }
  state.enemyCommandBox = null;

  const unitHit = findFriendlyUnitAt(px, py);
  if(unitHit){
    state.commandBox = unitHit;
  } else {
    state.commandBox = null;
  }
  render();
}

function setPendingFireAt(px, py, mortar){
  let best=null, bestD=Infinity;
  state.targets.forEach(t=>{
    if(t.destroyed || !isTargetDetected(t)) return;
    const vx = t._visX!==undefined ? t._visX : estPos(t).x;
    const vy = t._visY!==undefined ? t._visY : estPos(t).y;
    const d = Math.hypot(vx-px, vy-py);
    if(d<bestD){ bestD=d; best=t; }
  });
  if(best && bestD<=42){
    state.selectedId = best.id;
    const e = estPosFromMortar(mortar, best);
    mortar.pendingFire = {x:e.x, y:e.y, snappedId:best.id};
    applyBestMortarLoadout(mortar, best);
  } else {
    state.selectedId = null;
    mortar.pendingFire = {x:px, y:py, snappedId:null};
  }
  mortar.order = 'fire';
}

function canvasToScreen(cx, cy){
  const cv = document.getElementById('board');
  const rect = cv.getBoundingClientRect();
  if(threeReady){
    const p = project(cx, cy);
    return { x: rect.left + p.x, y: rect.top + p.y };
  }
  return { x: rect.left + cx/CANVAS_W*rect.width, y: rect.top + cy/CANVAS_H*rect.height };
}

function findEnemyTargetAt(px, py){
  let best=null, bestD=Infinity;
  state.targets.forEach(t=>{
    if(t.destroyed || !isTargetDetected(t)) return;
    const vx = t._visX!==undefined ? t._visX : estPos(t).x;
    const vy = t._visY!==undefined ? t._visY : estPos(t).y;
    const d = Math.hypot(vx-px, vy-py);
    if(d<bestD){ bestD=d; best=t; }
  });
  return (best && bestD<=42) ? best : null;
}

function findFriendlyUnitAt(px, py){
  const HIT_R = 22;
  for(let i=0;i<state.scouts.length;i++){
    const s = state.scouts[i];
    if(!unitAlive(s)) continue;
    const sx = s._visX!==undefined ? s._visX : s.x;
    const sy = s._visY!==undefined ? s._visY : s.y;
    if(Math.hypot(sx-px, sy-py) <= HIT_R) return {kind:'scout', idx:i};
  }
  for(let i=0;i<state.mortars.length;i++){
    const m = state.mortars[i];
    if(m.hp<=0) continue;
    const mx = m._visX!==undefined ? m._visX : m.x;
    const my = m._visY!==undefined ? m._visY : m.y;
    if(Math.hypot(mx-px, my-py) <= HIT_R) return {kind:'mortar', idx:i};
  }
  for(let i=0;i<state.squads.length;i++){
    const sq = state.squads[i];
    if(!sq.soldiers.some(s=>s.alive)) continue;
    const sx = sq._visX!==undefined ? sq._visX : sq.x;
    const sy = sq._visY!==undefined ? sq._visY : sq.y;
    if(Math.hypot(sx-px, sy-py) <= HIT_R) return {kind:'squad', idx:i};
  }
  for(let i=0;i<state.snipers.length;i++){
    const sn = state.snipers[i];
    if(!sn.soldiers.some(s=>s.alive)) continue;
    const sx = sn._visX!==undefined ? sn._visX : sn.x;
    const sy = sn._visY!==undefined ? sn._visY : sn.y;
    if(Math.hypot(sx-px, sy-py) <= HIT_R) return {kind:'sniper', idx:i};
  }
  return null;
}

function closeCommandBox(){
  state.commandBox = null;
  render();
}

function closeEnemyCommandBox(){
  state.enemyCommandBox = null;
  render();
}

// Assigns a squad to close distance on and repeatedly attack a specific
// player-chosen enemy target (any type), rather than the squad's normal
// orders which only auto-engage whatever enemy infantry happens to wander
// within range.
function assignSquadHunt(idx){
  const sq = state.squads[idx];
  if(!sq || !sq.soldiers.some(s=>s.alive)) return;
  const targetId = state.enemyCommandBox;
  const target = targetId ? state.targets.find(t=>t.id===targetId && !t.destroyed) : null;
  if(!target) return;
  if(sq.order==='hunt' && sq.huntTargetId===target.id){
    clearSquadHunt(idx);
    log('sys','前線', `第${idx+1}小隊、${target.id}への攻撃指示を解除。`);
    return;
  }
  sq.order = 'hunt';
  sq.huntTargetId = target.id;
  sq.pendingDest = null;
  unitSpeakOrder('squad', idx);
  log('sys','前線', `第${idx+1}小隊、${target.id} を攻撃目標に指示。接敵まで前進する。`);
  render();
}
function clearSquadHunt(idx){
  const sq = state.squads[idx];
  if(!sq) return;
  sq.huntTargetId = null;
  if(sq.order==='hunt') sq.order = 'hold';
  render();
}

// Arms a mortar's fire mission at the enemy-command-box target, same as
// manually pressing "攻撃地点設定" then clicking the target on the map --
// still requires 決心 (commitDecision) to actually fire.
function assignMortarFire(idx){
  const mortar = state.mortars[idx];
  if(!mortar || mortar.hp<=0) return;
  const targetId = state.enemyCommandBox;
  const target = targetId ? state.targets.find(t=>t.id===targetId && !t.destroyed) : null;
  if(!target) return;
  if(mortar.order==='fire' && mortar.pendingFire && mortar.pendingFire.snappedId===target.id){
    mortar.pendingFire = null;
    mortar.order = 'standby';
    log('fdc','FDC', `迫撃砲${idx+1}、${target.id}への攻撃指示を解除。`);
    render();
    return;
  }
  const e = estPosFromMortar(mortar, target);
  mortar.pendingFire = {x:e.x, y:e.y, snappedId:target.id};
  applyBestMortarLoadout(mortar, target);
  mortar.order = 'fire';
  mortar.pendingDest = null;
  state.selectedId = target.id;
  unitSpeakOrder('mortar', idx);
  log('fdc','FDC', `迫撃砲${idx+1}、${target.id} を攻撃目標に指示。${SHELLS[mortar.fireShell]}・${FUZES[mortar.fireFuze]}・${mortar.fireCount}発を自動選択。`);
  render();
}

// Lets a unit be selected from the 部隊稼働状況 (force status) list at the
// bottom of the screen, opening the same command box as clicking it on the
// map -- renderCommandBox() positions the box from the unit's own map
// coordinates, so no click position is needed here.
function selectForceUnit(kind, idx){
  state.commandBox = {kind, idx};
  render();
}

function updateFireConfig(idx, field, value){
  const mortar = state.mortars[idx];
  if(!mortar) return;
  mortar[field] = field==='fireCount' ? parseInt(value,10) : value;
  render();
}

function mortarBoxHtml(idx){
  const mortar = state.mortars[idx];
  const dead = mortar.hp<=0;
  const aim = mortar.pendingFire;
  const snapped = aim && aim.snappedId ? state.targets.find(x=>x.id===aim.snappedId) : null;
  const order = mortar.order;
  const armingTarget = state.orderMode && state.orderMode.kind==='mortar-target' && state.orderMode.idx===idx;
  const armingMove = state.orderMode && state.orderMode.kind==='mortar-move' && state.orderMode.idx===idx;

  const stanceBtns = ['fire','standby','move'].map(o=>
    `<button class="btn squad-order-btn ${order===o?'active':''}" ${dead?'disabled':''} onclick="setMortarOrder(${idx},'${o}')">${MORTAR_ORDER_LABEL[o]}</button>`
  ).join('');

  let bodyHtml = '';
  if(dead){
    bodyHtml = `<div class="empty-hint" style="padding:4px 0;color:var(--red);">戦闘不能</div>`;
  } else if(order==='move'){
    let moveStatus = '移動先: 未設定';
    if(armingMove) moveStatus = '地図をクリックして移動先指定…';
    else if(mortar.pendingDest) moveStatus = '移動先: 設定済み(陣地転換予定)';
    bodyHtml = `
      <div class="meta">標高: ${elevationLabel(elevationAt(mortar.x,mortar.y))}</div>
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
          <div class="meta">本砲基準 方位約${Math.round(e.bearing)}° / 距離約${unitsToMeters(e.dist)}m / 誤差±${unitsToMeters(snapped.distErr)}m</div>
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
    ? `<div class="meta" style="color:var(--red);margin-bottom:6px;">⚠ 対砲兵射撃警戒中 ― あと${mortar.cbWarnTurns}ターンで着弾。直ちに陣地転換せよ</div>`
    : (!dead && mortar.shotsSinceMove>MORTAR_CB_SHOTS_THRESHOLD
        ? `<div class="meta" style="margin-bottom:6px;">同一陣地からの連続射撃 ${mortar.shotsSinceMove}回 ― 対砲兵レーダーに捕捉される危険あり</div>`
        : '');

  return `
    <div class="squad-orders" style="grid-template-columns:repeat(3,1fr);margin-bottom:8px;">${stanceBtns}</div>
    ${cbWarnHtml}
    ${bodyHtml}
    ${!dead ? mortarMainlineHtml(idx, mortar) : ''}
    ${exposureMetaHtml(mortar.exposure)}
    ${crewHtml}
  `;
}

// per user request: a persistent reference-direction control, independent of the mortar's
// current order/fire-mission state (see armMortarMainlineOrder for what it draws on the map)
function mortarMainlineHtml(idx, mortar){
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

function updateFireConfigCancel(idx){
  const mortar = state.mortars[idx];
  if(mortar) mortar.pendingFire = null;
  render();
}

function exposureMetaHtml(exposure){
  const pct = Math.round(hitChanceFromExposure(exposure)*100);
  return `<div class="meta">掩蔽率: ${exposure} (被弾率目安 ${pct}%)</div>`;
}

function soldierRosterHtml(soldiers){
  const rows = soldiers.map(s=>{
    const lvl = s.alive ? vetLevelOf(s) : 0;
    const vetBadge = lvl>0 ? `<span style="color:var(--amber);letter-spacing:-1px;margin-left:3px;" title="古参兵 Lv.${lvl}">${'★'.repeat(lvl)}</span>` : '';
    return `<div class="roster-row${s.alive?'':' dead'}"><span class="r-rank">${s.rank}</span><span class="r-name">${s.name}${vetBadge}</span></div>`;
  }).join('');
  return `<div class="roster-list">${rows}</div>`;
}

function reinforceButtonHtml(kind, idx, unit){
  const alive = unitAliveCount(unit);
  const deadCount = unit.soldiers.length-alive;
  if(deadCount<=0) return '';
  const restoreCount = Math.min(REINFORCE_MAX_PER_CALL, deadCount, state.reserve);
  const reinforceCost = REINFORCE_COST_PER_SOLDIER*Math.max(restoreCount,1);
  const reinforceDisabled = unit.reinforceUsed || restoreCount<=0 || state.money<reinforceCost;
  const reinforceLabel = unit.reinforceUsed ? '予備兵力要請済み'
    : restoreCount<=0 ? '予備兵力なし'
    : `予備兵力要請 (${restoreCount}名 ¥${reinforceCost})`;
  return `<button class="btn" ${reinforceDisabled?'disabled':''} onclick="requestReinforcement('${kind}',${idx})">${reinforceLabel}</button>`;
}

function scoutBoxHtml(idx){
  const scout = state.scouts[idx];
  const alive = unitAliveCount(scout);
  const dead = alive<=0;
  const armingMove = state.orderMode && state.orderMode.kind==='scout-move' && state.orderMode.idx===idx;
  const armingRecon = state.orderMode && state.orderMode.kind==='scout-recon' && state.orderMode.idx===idx;
  let orderStatus = '行動: 未設定(観測のみ)';
  if(armingMove) orderStatus = '地図をクリックして移動先指定…';
  else if(armingRecon) orderStatus = '捕捉中の目標をクリックして偵察指示…';
  else if(scout.pendingDest) orderStatus = '行動: 移動先へ前進予定';
  else if(scout.pendingReconTargetId) orderStatus = `行動: ${scout.pendingReconTargetId} を偵察予定`;
  return `
    <div class="meta">${dead?'戦闘不能':alive+'/'+scout.soldiers.length+'名'} ・ 標高: ${elevationLabel(elevationAt(scout.x,scout.y))}</div>
    ${exposureMetaHtml(getUnitExposure({kind:'scout', idx}))}
    <div class="meta">観測方向: ${Math.round(scout.watchAngle)}° (視野約${Math.round(scoutHalfFov()*2)}°)</div>
    <div class="hpbar" style="margin-bottom:8px;"><div style="width:${Math.max(0,alive/scout.soldiers.length*100)}%"></div></div>
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

function standingOrderSelectHtml(kind, idx, unit, allowAssault){
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

function squadBoxHtml(idx){
  const sq = state.squads[idx];
  const alive = sq.soldiers.filter(s=>s.alive).length;
  const wiped = alive===0;
  const btns = ['advance','hold','assault','retreat'].map(o=>
    `<button class="btn squad-order-btn ${sq.order===o?'active':''}" ${wiped?'disabled':''} onclick="setSquadOrder(${idx},'${o}')">${ORDER_LABEL[o]}</button>`
  ).join('');
  const arming = state.orderMode && state.orderMode.kind==='squad' && state.orderMode.idx===idx;
  const destStatus = arming ? '地図をクリックして移動先指定…' : (sq.pendingDest ? '移動先: 設定済み' : '移動先: 未設定');
  const huntTarget = sq.huntTargetId ? state.targets.find(t=>t.id===sq.huntTargetId) : null;
  const huntStatus = (huntTarget && !huntTarget.destroyed)
    ? `攻撃目標: ${huntTarget.id} (${huntTarget.revealed?huntTarget.def.label:'識別不能'})`
    : null;
  return `
    <div class="meta">${alive} / ${sq.soldiers.length}名 ・ 標高: ${elevationLabel(elevationAt(sq.x,sq.y))}</div>
    ${exposureMetaHtml(getUnitExposure({kind:'squad', idx}))}
    <div class="squad-orders" style="margin:6px 0;">${btns}</div>
    <div class="row-2" style="margin-bottom:6px;">
      <button class="btn ${arming?'active squad-order-btn':''}" ${wiped?'disabled':''} onclick="armSquadMoveOrder(${idx})">移動先を指定</button>
      <button class="btn" ${wiped||!sq.pendingDest?'disabled':''} onclick="clearSquadDest(${idx})">解除</button>
    </div>
    <div class="meta" style="margin-bottom:6px;">${destStatus}</div>
    ${huntStatus ? `<div class="meta" style="margin-bottom:4px;">${huntStatus}</div><button class="btn" style="margin-bottom:6px;" onclick="clearSquadHunt(${idx})">攻撃目標を解除</button>` : ''}
    ${standingOrderSelectHtml('squad', idx, sq, true)}
    ${soldierRosterHtml(sq.soldiers)}
    ${reinforceButtonHtml('squad', idx, sq)}
  `;
}

function sniperBoxHtml(idx){
  const sn = state.snipers[idx];
  const alive = sn.soldiers.filter(s=>s.alive).length;
  const wiped = alive===0;
  const btns = ['advance','hold','retreat'].map(o=>
    `<button class="btn squad-order-btn ${sn.order===o?'active':''}" ${wiped?'disabled':''} onclick="setSniperOrder(${idx},'${o}')">${ORDER_LABEL[o]}</button>`
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
    <div class="meta">${alive} / ${sn.soldiers.length}名 ・ 標高: ${elevationLabel(elevationAt(sn.x,sn.y))} ・ 有効射程約${SNIPER_RANGE_M}m</div>
    ${exposureMetaHtml(getUnitExposure({kind:'sniper', idx}))}
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

function renderCommandBox(){
  const box = document.getElementById('command-box');
  if(!state.commandBox){ box.style.display='none'; return; }
  const kind = state.commandBox.kind;
  let title, bodyHtml, pos;
  if(kind==='mortar'){
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
  } else if(kind==='sniper'){
    const sn = state.snipers[state.commandBox.idx];
    if(!sn){ box.style.display='none'; return; }
    title = `狙撃${state.commandBox.idx+1}班`;
    bodyHtml = sniperBoxHtml(state.commandBox.idx);
    pos = canvasToScreen(sn._visX!==undefined?sn._visX:sn.x, sn._visY!==undefined?sn._visY:sn.y);
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

// Positions a .command-box near (pos.x,pos.y) so it never runs off-screen.
// Measures the box's ACTUAL rendered height (via offsetHeight, after its
// content/display are already set) instead of guessing a fixed height --
// these boxes' content length varies a lot (roster lists, standing-order
// dropdowns, and now the enemy box's per-unit-type attack buttons), so a
// hardcoded guess reliably goes stale and lets the box overflow the viewport.
function positionCommandBox(box, pos, boxW){
  const left = clamp(pos.x-boxW/2, 8, window.innerWidth-boxW-8);
  box.style.left = left+'px';
  box.style.display = 'block';
  const boxH = box.offsetHeight || 220;
  let top = pos.y + 26;
  if(top + boxH > window.innerHeight - 8) top = window.innerHeight - boxH - 8;
  if(top < 8) top = 8;
  box.style.top = top+'px';
}

function renderEnemyCommandBox(){
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
  // per user request: snipers are no longer assignable from here -- they already
  // auto-engage anything crossing their own aim line (see resolveSniperOrders),
  // and are aimed via the "狙撃目標を指定"/"射撃方向を指定" buttons in their own unit box.
  const squadBtns = state.squads.map((sq,idx)=>{
    if(!sq.soldiers.some(s=>s.alive)) return '';
    const active = sq.order==='hunt' && sq.huntTargetId===t.id;
    return `<button class="btn ${active?'active squad-order-btn':''}" onclick="assignSquadHunt(${idx})">第${idx+1}小隊に攻撃させる${active?'(攻撃中)':''}</button>`;
  }).filter(Boolean).join('');
  const allBtns = mortarBtns + squadBtns;
  // per user request: make the fire-correction mechanic visible before the player commits a
  // volley -- without a scout holding eyes-on, mortar fire only closes MORTAR_FIRE_CORRECTION_FRAC
  // of the observation error, so show how much miss margin (in meters) is still expected.
  const guided = scoutHasEyesOn(t);
  const residualErrM = Math.round(unitsToMeters(t.distErr) * (1-MORTAR_FIRE_CORRECTION_FRAC));
  const precisionHtml = guided
    ? `<div class="meta" style="margin-bottom:8px;color:var(--green-id);">斥候が観測中 ― 迫撃砲は精密射撃(誤差なし)</div>`
    : `<div class="meta" style="margin-bottom:8px;color:var(--amber);">未観測 ― 迫撃砲は着弾誤差約${residualErrM}m(斥候をこの目標に向けると誤差なしに)</div>`;
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

function renderStats(){
  document.querySelector('#stat-stage .value').textContent = state.stage+' / '+STAGE_COUNT;
  document.querySelector('#stat-difficulty .value').textContent = DIFFICULTIES[state.difficulty].label;
  document.querySelector('#stat-weather .value').textContent = WEATHER_TYPES[state.weather].label;
  document.querySelector('#stat-achievements .value').textContent = unlockedAchievements.size+' / '+Object.keys(ACHIEVEMENTS).length;
  document.querySelector('#stat-turns .value').textContent = state.turns;
  document.querySelector('#stat-money .value').textContent = '¥'+state.money.toLocaleString();
  const remainingTargets = state.targets.filter(t=>!t.destroyed).length;
  document.getElementById('stat-left').textContent = remainingTargets + ' / ' + state.targetsSpawnedTotal;
  const aliveMortarPersonnel = state.mortars.filter(m=>m.hp>0).length * MORTAR_CREW_SIZE;
  const aliveScoutPersonnel = state.scouts.reduce((s,sc)=>s+unitAliveCount(sc),0);
  const aliveSquadPersonnel = totalAliveSoldiers();
  const aliveSniperPersonnel = state.snipers.reduce((s,sn)=>s+sn.soldiers.filter(x=>x.alive).length,0);
  const aliveTotal = aliveMortarPersonnel + aliveScoutPersonnel + aliveSquadPersonnel + aliveSniperPersonnel + state.reserve;
  document.querySelector('#stat-roster .value').textContent = aliveTotal + ' / ' + totalRosterCapacity();
  document.getElementById('board-note').textContent = state.placementPending
    ? '手動配置モード ― 地図上の指定範囲内をクリックして、表示中のユニットの初期位置を指定してください'
    : '自軍は左側、敵軍は右側遠方に展開。ドラッグでパン・ホイールでズーム。目標をクリックして選択';
  document.getElementById('statbar-mini').textContent =
    `WAVE ${state.stage}/${STAGE_COUNT} ・ 経過ターン${state.turns} ・ ¥${state.money.toLocaleString()} ・ 兵力${aliveTotal}/${totalRosterCapacity()}`;

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
  rows.push(forceRow('予備', state.reserve/RESERVE_SIZE, `${state.reserve}/${RESERVE_SIZE}`, 'var(--muted)'));
  document.getElementById('force-list').innerHTML = rows.join('');

  document.getElementById('self-ammo-line').textContent = `現有弾薬: HE ${state.ammo.he} ／ HEAT ${state.ammo.heat}`;
}

function renderDecisionPanel(){
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
      <div class="row-2">
        <button class="btn primary decision-btn" ${disabled?'disabled':''} onclick="commitDecision()">決心</button>
        <button class="btn auto-commit-btn ${isAutoCommitRunning()?'active squad-order-btn':''}" onclick="toggleAutoCommit()">自動</button>
      </div>
      <div class="alert-row">
        <button class="btn alert-btn-red" ${disabled?'disabled':''} onclick="setAlertLevel('red')">赤警報</button>
        <button class="btn alert-btn-yellow" ${disabled?'disabled':''} onclick="setAlertLevel('yellow')">黄警報</button>
        <button class="btn alert-btn-white" ${disabled?'disabled':''} onclick="setAlertLevel('white')">白警報</button>
      </div>
    </div>
  `; });
}

// per user request: 赤警報 puts every combat unit (小隊/狙撃班/迫撃砲) on a defensive
// stance; 黄警報 puts only infantry (小隊) on a defensive stance; 白警報 releases
// everyone back to whatever order they had right before the alert was raised. Each
// unit's pre-alert order is stashed in .preAlertOrder the first time it's put on alert,
// and only restored (and cleared) when that unit is actually released -- so escalating
// 黄警報 -> 赤警報 doesn't clobber the order infantry had before 黄警報 was raised, and
// de-escalating 赤警報 -> 黄警報 correctly releases snipers/mortars while leaving
// infantry on hold.
function applyAlertToUnit(unit, wantHold, holdOrder){
  if(wantHold){
    if(unit.preAlertOrder===undefined || unit.preAlertOrder===null) unit.preAlertOrder = unit.order;
    unit.order = holdOrder;
  } else if(unit.preAlertOrder!==undefined && unit.preAlertOrder!==null){
    unit.order = unit.preAlertOrder;
    unit.preAlertOrder = null;
  }
}
function setAlertLevel(level){
  if(!state || state.stageResolved || state.animating) return;
  const wantInfantryHold = level==='red' || level==='yellow';
  const wantWideHold = level==='red';
  state.squads.forEach(sq=>applyAlertToUnit(sq, wantInfantryHold, 'hold'));
  state.snipers.forEach(sn=>applyAlertToUnit(sn, wantWideHold, 'hold'));
  state.mortars.forEach(m=>{
    applyAlertToUnit(m, wantWideHold, 'standby');
    if(wantWideHold) m.pendingFire = null;
  });
  state.alertLevel = level;
  const label = level==='red' ? '赤警報 ― 全部隊、防御態勢' : level==='yellow' ? '黄警報 ― 歩兵、防御態勢' : '白警報 ― 平常態勢に復帰';
  log('sys','司令部', `━━━ ${label} ━━━`);
  render();
}


// Stable (cached, not re-randomized every frame) offset within
// ESTIMATE_MARKER_RADIUS_UNITS of a target's true position, used for the
// "identified but not currently pinned down" marker.
function estMarkerOffsetFor(t){
  if(!t._estMarkerOffset){
    const ang = Math.random()*Math.PI*2;
    const dist = Math.sqrt(Math.random())*ESTIMATE_MARKER_RADIUS_UNITS; // uniform over the disc, not biased toward center
    t._estMarkerOffset = {dx: Math.cos(ang)*dist, dy: Math.sin(ang)*dist};
  }
  return t._estMarkerOffset;
}
function drawEstimatedPositionMarker(ctx, t){
  const off = estMarkerOffsetFor(t);
  const mx = t.trueX+off.dx, my = t.trueY+off.dy;
  const m = project(mx, my);
  if(!m.visible) return;
  ctx.beginPath();
  ctx.fillStyle = '#e8d23a';
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1;
  ctx.arc(m.x, m.y, 6, 0, Math.PI*2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e8d23a';
  ctx.font = '12px "JetBrains Mono"';
  ctx.textAlign = 'center';
  ctx.fillText(`${t.id} 見積もり位置`, m.x, m.y-12);
}

// per user request: a thin vertical attrition bar (3-4px wide) shown beside every friendly
// unit marker (指揮所/迫撃砲/斥候/小隊/狙撃班), replacing the old horizontal HP bars that used
// to sit above HQ/mortar/scout only (squads/snipers previously had no bar at all -- just the
// alive-count text). Fills bottom-to-top, colored green/yellow/red by the same tiers used for
// the individual enemy-soldier gauges (frac>0.5 healthy, >0.25 hurt, else critical).
function drawAttritionBar(ctx, x, y, frac){
  const w = 4, h = 26;
  const bx = x - w/2, by = y - h/2;
  frac = clamp(frac, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(bx-1, by-1, w+2, h+2);
  ctx.fillStyle = '#232a18';
  ctx.fillRect(bx, by, w, h);
  const filledH = h*frac;
  ctx.fillStyle = frac>0.5 ? '#7fc76b' : frac>0.25 ? '#e0b84a' : '#d9524a';
  ctx.fillRect(bx, by+(h-filledH), w, filledH);
}

// per user request: the FEBA line can be dragged directly, ordering every alive squad/scout
// to advance or retreat to match. febaDragX is the live preview position while a drag is in
// progress (null otherwise, see setupMapControls); febaLineScreenPts is the line's last-drawn
// screen-space polyline, used to hit-test whether a mousedown/touchstart landed on the line.
let febaDragX = null;
let febaLineScreenPts = null;
const FEBA_DRAG_HIT_TOLERANCE_PX = 16;
// per user request: temporarily disabled -- flip back to true to re-enable dragging.
// The rest of the drag mechanism (setupMapControls, commitFebaDrag) is left in place;
// this single flag just stops hitTestFebaLine from ever engaging a drag.
const FEBA_DRAG_ENABLED = false;
function hitTestFebaLine(lx, ly){
  if(!FEBA_DRAG_ENABLED) return false;
  if(!febaLineScreenPts) return false;
  return febaLineScreenPts.some(p=>Math.hypot(p.x-lx, p.y-ly) <= FEBA_DRAG_HIT_TOLERANCE_PX);
}
// Commits a drag: every alive squad/scout gets a pendingDest at the new line's X (keeping its
// own Y), reusing the same movement mechanism as an individual unit's "移動先を指定" order --
// so it advances/retreats there over the following decision cycles like any other move order.
function commitFebaDrag(newX){
  const clampedX = clamp(newX, SQUAD_RETREAT_LIMIT_X, SQUAD_ASSAULT_LIMIT_X);
  let moved = 0;
  state.squads.forEach(sq=>{
    if(!sq.soldiers.some(s=>s.alive)) return;
    sq.pendingDest = {x:clampedX, y:sq.y};
    moved += 1;
  });
  state.scouts.forEach(sc=>{
    if(!sc.soldiers.some(s=>s.alive)) return;
    sc.pendingDest = {x:clampedX, y:sc.y};
    moved += 1;
  });
  if(moved>0) log('sys','司令部', `FEBAを再指定。最前線部隊(${moved}個)へ新しい線への前進/後退を発令。`);
}

// FEBA (Forward Edge of the Battle Area / 戦闘地域前縁) ― X-coordinate of the
// most advanced alive squad/scout, used to draw a reference line for how far
// the front has pushed toward the enemy. Returns null if no maneuver unit is alive.
function computeFebaX(){
  let maxX = null;
  state.squads.forEach(sq=>{
    if(sq.soldiers.some(s=>s.alive)) maxX = maxX===null ? sq.x : Math.max(maxX, sq.x);
  });
  state.scouts.forEach(sc=>{
    if(sc.soldiers.some(s=>s.alive)) maxX = maxX===null ? sc.x : Math.max(maxX, sc.x);
  });
  return maxX;
}

function drawBoard(){
  const cv = document.getElementById('board');
  const ctx = cv.getContext('2d');
  ctx.clearRect(0,0,cv.width,cv.height);
  const nowWander = performance.now();

  // roads: graphics intentionally suppressed (movement no longer road-follows;
  // only the road judgment in nearestRoadPoint/state.roads remains, used for
  // the on-road speed bonus). Points that fall behind/outside the camera view
  // are skipped rather than connected-through, so distant road segments never
  // draw a stray line straight across the screen.
  if(false && state.roads){
    const strokePath = (proj, color, width, dash)=>{
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if(dash) ctx.setLineDash(dash);
      let started = false;
      proj.forEach(p=>{
        if(!p.visible){ started = false; return; }
        if(!started){ ctx.moveTo(p.x,p.y); started = true; }
        else ctx.lineTo(p.x,p.y);
      });
      ctx.stroke();
      if(dash) ctx.setLineDash([]);
    };
    state.roads.forEach(road=>{
      const proj = road.map(p=>project(p.x,p.y));
      strokePath(proj, 'rgba(196,168,110,0.55)', 5, null);
      strokePath(proj, 'rgba(232,214,172,0.5)', 1, [7,7]);
    });
  }

  // HQ marker (指揮所) ― fixed at the screen's left edge; mission-critical, enemies specifically target it
  {
    const hq = state.hq;
    const hqAlive = hq.hp>0;
    const hqCol = hqAlive ? FRIENDLY_MARK_COLOR : '#5c2a25';
    const hqP = project(hq.x, hq.y);
    ctx.save();
    ctx.translate(hqP.x, hqP.y);
    ctx.fillStyle = hqCol;
    ctx.fillRect(-11,-6,22,16);
    ctx.beginPath();
    ctx.moveTo(0,-6); ctx.lineTo(0,-22);
    ctx.strokeStyle = hqCol; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0,-22); ctx.lineTo(14,-17); ctx.lineTo(0,-12); ctx.closePath();
    ctx.fillStyle = hqAlive ? FRIENDLY_MARK_COLOR : '#5c2a25';
    ctx.fill();
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.font = 'bold 15px "JetBrains Mono"';
    ctx.textAlign = 'center';
    ctx.fillText(hqAlive?'指揮所':'指揮所(壊滅)', 0, 34);
    ctx.restore();

    if(hqAlive){
      drawAttritionBar(ctx, hqP.x+20, hqP.y-6, hq.hp/hq.maxHp);
    }
  }

  // FEBA (戦闘地域前縁) ― red dashed vertical reference line at the most advanced
  // alive squad/scout's X-coordinate. Sampled in world space and re-projected per
  // point (not a straight screen-space line) since the board renders via a 3D camera.
  {
    // per user request: draggable -- while a drag is in progress, follow the pointer
    // (febaDragX) instead of the live computed position, so the line previews where it
    // will end up before the move order is actually committed (see commitFebaDrag).
    const dragging = febaDragX !== null;
    const febaX = dragging ? febaDragX : computeFebaX();
    if(febaX === null){
      febaLineScreenPts = null;
    } else {
      ctx.save();
      const steps = 24;
      const pts = [];
      for(let i=0;i<=steps;i++){
        const y = CANVAS_H * (i/steps);
        pts.push(project(febaX, y));
      }
      febaLineScreenPts = pts;
      const tracePath = ()=>{
        ctx.beginPath();
        pts.forEach((p,i)=>{ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
      };
      // per user request: made much more prominent -- a dark halo stroke underneath so the
      // line reads clearly against both light and dark terrain, a bolder/near-opaque dash on
      // top, and a glow so it doesn't get lost among the map's other markers. Turns amber
      // while actively being dragged, to distinguish an uncommitted preview from the real line.
      const lineColor = dragging ? '#ffcc4d' : '#ff5c47';
      tracePath();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(20,8,6,0.85)';
      ctx.lineWidth = 6;
      ctx.stroke();
      tracePath();
      ctx.setLineDash([12,7]);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 3.5;
      ctx.shadowColor = lineColor;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.setLineDash([]);

      const labelP = project(febaX, 14);
      const labelText = dragging ? 'FEBA ▸移動先' : 'FEBA';
      ctx.font = 'bold 14px "JetBrains Mono"';
      ctx.textAlign = 'center';
      const labelW = ctx.measureText(labelText).width;
      ctx.fillStyle = 'rgba(20,8,6,0.85)';
      ctx.fillRect(labelP.x-labelW/2-5, labelP.y-19, labelW+10, 18);
      ctx.fillStyle = lineColor;
      ctx.fillText(labelText, labelP.x, labelP.y-5);
      ctx.restore();
    }
  }

  // mortar mainline (主線方位角) fans ― pale-yellow reference sector out to
  // MORTAR_MAINLINE_RANGE_UNITS, drawn before the markers so they sit underneath. Purely a
  // visual reference (see armMortarMainlineOrder) -- it doesn't affect targeting or fire.
  // per user request: restored -- this is not the primitive that was meant to go (that was
  // the 3D minimap's leftover box/cone/etc. meshes, see syncUnitMarkers3d).
  state.mortars.forEach(mortar=>{
    if(mortar.hp<=0 || mortar.mainlineAngle===null || mortar.mainlineAngle===undefined) return;
    const mVisL = smoothVisualPos(mortar, mortar.x, mortar.y);
    const originP = project(mVisL.x, mVisL.y);
    const steps = 24;
    ctx.beginPath();
    ctx.moveTo(originP.x, originP.y);
    for(let i=0;i<=steps;i++){
      const ang = mortar.mainlineAngle - MORTAR_MAINLINE_HALF_FOV + (MORTAR_MAINLINE_HALF_FOV*2)*(i/steps);
      const pL = bearingToXY(ang, MORTAR_MAINLINE_RANGE_UNITS, mVisL.x, mVisL.y);
      const p = project(pL.x, pL.y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(232,210,58,0.047)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(232,210,58,0.167)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // 擬陣地 (decoy positions) -- dashed diamond outline in the friendly color, plus a vertical
  // attrition bar. Selectable (see handleCanvasClick) to direct mortar fire at its exact,
  // known coordinates.
  state.decoys.forEach((d,idx)=>{
    if(d.destroyed) return;
    const dp = project(d.x, d.y);
    ctx.save();
    ctx.translate(dp.x, dp.y);
    ctx.beginPath();
    ctx.setLineDash([3,2]);
    ctx.strokeStyle = FRIENDLY_MARK_COLOR;
    ctx.lineWidth = 2;
    ctx.moveTo(0,-10); ctx.lineTo(9,0); ctx.lineTo(0,10); ctx.lineTo(-9,0); ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.font = '12px "JetBrains Mono"';
    ctx.textAlign = 'center';
    ctx.fillText(`擬陣地${idx+1}`, 0, 24);
    ctx.restore();
    drawAttritionBar(ctx, dp.x+16, dp.y, d.hp/d.maxHp);
  });

  // mortar markers (自軍, left side)
  state.mortars.forEach(mortar=>{
    const mVisL = smoothVisualPos(mortar, mortar.x, mortar.y);
    const mVis = project(mVisL.x, mVisL.y);
    const mAlive = mortar.hp>0;
    ctx.save();
    ctx.translate(mVis.x,mVis.y);
    // per user request: custom mortar icon image (our side only) in place of the old triangle
    drawUnitIcon(ctx, mortarIcon, 0, 0, 33, !mAlive);
    // shoot-and-scoot: a pulsing red ring while a counter-battery strike is inbound, so the
    // threat reads clearly on the map itself and not just in the mortar's own panel
    if(mAlive && mortar.cbWarnTurns!==null && mortar.cbWarnTurns!==undefined){
      const pulse = 3 + Math.sin(performance.now()*0.008)*3;
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(217,80,60,0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4,3]);
      ctx.arc(0, 0, 20+pulse, 0, Math.PI*2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.font = '15px "JetBrains Mono"';
    ctx.textAlign='center';
    ctx.fillText(mAlive?`迫撃砲${mortar.id+1}`:`迫撃砲${mortar.id+1}(戦闘不能)`, 0, 44);
    if(mAlive){
      let mOrderLabel = '[待機]';
      if(mortar.order==='move') mOrderLabel = mortar.pendingDest ? '[移動中]' : '[移動待ち]';
      else if(mortar.pendingFire) mOrderLabel = '[射撃準備]';
      else if(mortar.order==='fire') mOrderLabel = '[攻撃地点待ち]';
      ctx.fillStyle = LABEL_TEXT_COLOR;
      ctx.font = 'bold 13px "JetBrains Mono"';
      ctx.fillText(mOrderLabel, 0, 62);
    }
    ctx.restore();

    if(mAlive){
      drawAttritionBar(ctx, mVis.x+18, mVis.y-2, mortar.hp/mortar.maxHp);
    }
  });

  // scout observation cones (約45度) ― drawn before the markers so they sit underneath
  // per user request: restored -- this is not the primitive that was meant to go (that was
  // the 3D minimap's leftover box/cone/etc. meshes, see syncUnitMarkers3d).
  state.scouts.forEach(scout=>{
    const scoutVisL = smoothVisualPos(scout, scout.x, scout.y);
    const scoutVis = project(scoutVisL.x, scoutVisL.y);
    if(unitAlive(scout)){
      const coneLen = SCOUT_MAX_RANGE_UNITS;
      const steps = 24;
      ctx.beginPath();
      ctx.moveTo(scoutVis.x, scoutVis.y);
      for(let i=0;i<=steps;i++){
        const halfFov = scoutHalfFov();
        const ang = scout.watchAngle - halfFov + (halfFov*2)*(i/steps);
        const pL = bearingToXY(ang, coneLen, scoutVisL.x, scoutVisL.y);
        const p = project(pL.x, pL.y);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(111,155,191,0.14)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(111,155,191,0.55)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  });

  // scout markers (自軍, left side) ― 斥候, vulnerable to enemy attack
  state.scouts.forEach(scout=>{
    const scoutVisL = smoothVisualPos(scout, scout.x, scout.y);
    const scoutVis = project(scoutVisL.x, scoutVisL.y);
    const aliveCount = unitAliveCount(scout);
    const scoutAlive = aliveCount>0;
    ctx.save();
    ctx.translate(scoutVis.x, scoutVis.y);
    // per user request: custom scout icon image (our side only) in place of the cross+circle glyph
    drawUnitIcon(ctx, scoutIcon, 0, 0, 33, !scoutAlive);
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.font = '15px "JetBrains Mono"';
    ctx.textAlign='center';
    ctx.fillText(scoutAlive?`斥候${scout.id+1} ${aliveCount}/${scout.soldiers.length}`:`斥候${scout.id+1}(戦闘不能)`, 0, -20);
    if(scoutAlive){
      let scoutOrderLabel = '[観測]';
      if(scout.pendingReconTargetId) scoutOrderLabel = '[偵察]';
      else if(scout.pendingDest) scoutOrderLabel = '[移動]';
      ctx.fillStyle = LABEL_TEXT_COLOR;
      ctx.font = 'bold 13px "JetBrains Mono"';
      ctx.fillText(scoutOrderLabel, 0, 28);
    }
    ctx.restore();

    if(scoutAlive){
      drawAttritionBar(ctx, scoutVis.x+18, scoutVis.y, aliveCount/scout.soldiers.length);
    }
  });

  // friendly infantry squads (自軍) ― orderly formation, moves as a unit per order
  if(state.squads && state.squads.length){
    state.squads.forEach((sq, sqIdx)=>{
      const sqVisL = smoothVisualPos(sq, sq.x, sq.y);
      const sqVis = project(sqVisL.x, sqVisL.y);
      const aliveSoldiers = sq.soldiers.filter(s=>s.alive);
      drawUnitIcon(ctx, infantryIcon, sqVis.x, sqVis.y, 33, aliveSoldiers.length===0);
      if(aliveSoldiers.length>0) drawAttritionBar(ctx, sqVis.x+32, sqVis.y, aliveSoldiers.length/sq.soldiers.length);
      ctx.fillStyle = aliveSoldiers.length>0 ? LABEL_TEXT_COLOR : '#5c2a25';
      ctx.font = '14px "JetBrains Mono"';
      ctx.textAlign='center';
      const sqOrderLabel = sq.pendingDest ? `${ORDER_LABEL[sq.order]}→移動` : ORDER_LABEL[sq.order];
      ctx.fillText(`第${sqIdx+1}小隊 ${aliveSoldiers.length}/${sq.soldiers.length} [${sqOrderLabel}]`, sqVis.x, sqVis.y+28);

      if(aliveSoldiers.length>0){
        state.targets.filter(t=>!t.destroyed && t.type==='infantry' && isTargetDetected(t)).forEach(t=>{
          const eL = estPos(t);
          const dist = Math.hypot(eL.x-sq.x, eL.y-sq.y);
          if(dist > SQUAD_ENGAGE_RANGE) return;
          const e = project(eL.x, eL.y);
          ctx.beginPath();
          ctx.setLineDash([3,3]);
          ctx.strokeStyle = 'rgba(193,69,59,0.35)';
          ctx.lineWidth = 1;
          ctx.moveTo(sqVis.x, sqVis.y);
          ctx.lineTo(e.x, e.y);
          ctx.stroke();
          ctx.setLineDash([]);
        });
      }
    });
  }

  // friendly sniper teams (自軍) ― precision long-range fire teams
  if(state.snipers && state.snipers.length){
    state.snipers.forEach((sn, snIdx)=>{
      const snVisL = smoothVisualPos(sn, sn.x, sn.y);
      const snVis = project(snVisL.x, snVisL.y);
      const aliveSoldiers = sn.soldiers.filter(s=>s.alive);
      // per user request: custom sniper icon image (our side only) in place of the triangle
      drawUnitIcon(ctx, sniperIcon, snVis.x, snVis.y, 33, aliveSoldiers.length===0);
      if(aliveSoldiers.length>0) drawAttritionBar(ctx, snVis.x+20, snVis.y, aliveSoldiers.length/sn.soldiers.length);
      ctx.fillStyle = aliveSoldiers.length>0 ? LABEL_TEXT_COLOR : '#5c2a25';
      ctx.font = '14px "JetBrains Mono"';
      ctx.textAlign='center';
      const snOrderLabel = sn.pendingDest ? `${ORDER_LABEL[sn.order]}→移動` : ORDER_LABEL[sn.order];
      ctx.fillText(`狙撃${snIdx+1}班 ${aliveSoldiers.length}/${sn.soldiers.length} [${snOrderLabel}]`, snVis.x, snVis.y+27);

      if(aliveSoldiers.length>0 && sn.pendingSnipeTargetId){
        const t = state.targets.find(x=>x.id===sn.pendingSnipeTargetId);
        if(t && !t.destroyed && isTargetDetected(t)){
          const eL = estPos(t);
          const e = project(eL.x, eL.y);
          ctx.beginPath();
          ctx.setLineDash([2,4]);
          ctx.strokeStyle = 'rgba(111,155,191,0.5)';
          ctx.lineWidth = 1;
          ctx.moveTo(snVis.x, snVis.y);
          ctx.lineTo(e.x, e.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // firing-direction line ― solid blue, SNIPER_AIM_RANGE_UNITS long; any
      // enemy that overlaps it is auto-engaged (see findTargetOnSniperLine).
      if(aliveSoldiers.length>0 && sn.aimAngle!==null && sn.aimAngle!==undefined){
        const rad = sn.aimAngle*Math.PI/180;
        const endL = {x: sn.x+Math.sin(rad)*SNIPER_AIM_RANGE_UNITS, y: sn.y-Math.cos(rad)*SNIPER_AIM_RANGE_UNITS};
        const endVis = project(endL.x, endL.y);
        if(endVis.visible){
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(80,150,230,0.65)';
          ctx.lineWidth = 2;
          ctx.moveTo(snVis.x, snVis.y);
          ctx.lineTo(endVis.x, endVis.y);
          ctx.stroke();
        }
      }
    });
  }

  state.targets.forEach(t=>{
    // uncertainty circle
    if(!t.destroyed){
      if(!isTargetDetected(t)){
        // Known to exist (identified at some point) but not currently
        // pinned down by any detector -- show a rough last-known-area
        // marker instead of nothing.
        if(t.revealed) drawEstimatedPositionMarker(ctx, t);
        return;
      }
      const eLogical = estPos(t);
      const eVisL = smoothVisualPos(t, eLogical.x, eLogical.y);
      const e = project(eVisL.x, eVisL.y);
      const selected = t.id===state.selectedId;
      ctx.beginPath();
      ctx.setLineDash([5,4]);
      ctx.strokeStyle = selected ? 'rgba(217,164,65,0.9)' : 'rgba(217,164,65,0.35)';
      ctx.lineWidth = 1.5;
      ctx.arc(e.x, e.y, clamp(t.distErr, 20, UNCERTAINTY_CIRCLE_CAP), 0, Math.PI*2);
      ctx.stroke();
      ctx.setLineDash([]);

      if(selected){
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(217,164,65,0.9)';
        ctx.lineWidth = 1.5;
        ctx.arc(e.x, e.y, 15, 0, Math.PI*2);
        ctx.stroke();
      }

      // estimated center marker ― one simple symbol per formation group
      let labelY = e.y+20;
      if(t.type==='infantry' && t.troops){
        // per user request: custom enemy infantry icon image in place of the plain circle --
        // muted (grayscale) until identified, same treatment as a friendly unit with no survivors.
        const aliveTroops = t.troops.filter(s=>s.alive);
        drawUnitIcon(ctx, enemyInfantryIcon, e.x, e.y, 33, !t.revealed);
        if(t.revealed) drawAttritionBar(ctx, e.x+14, e.y, t.hp/t.maxHp);
        labelY = e.y+26;
        if(t.revealed){
          ctx.fillStyle = LABEL_TEXT_COLOR;
          ctx.font = '14px "JetBrains Mono"';
          ctx.textAlign='center';
          ctx.fillText(`敵${t.def.label} ${aliveTroops.length}/${t.troops.length}`, e.x, labelY);
        }
      } else if(t.type==='drone'){
        // per user request: dropped the rotor-arm satellite dots -- a single diamond
        // (matching the 3D minimap's drone shape) distinguishes it from the plain
        // circle used for vehicle/artillery, with no clutter around it.
        const dcolor = t.revealed ? t.def.mark : '#8f9678';
        ctx.fillStyle = dcolor;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y-7);
        ctx.lineTo(e.x+6, e.y);
        ctx.lineTo(e.x, e.y+7);
        ctx.lineTo(e.x-6, e.y);
        ctx.closePath();
        ctx.fill();
        if(t.revealed){
          ctx.fillStyle = LABEL_TEXT_COLOR;
          ctx.font = '14px "JetBrains Mono"';
          ctx.textAlign='center';
          ctx.fillText(t.def.label, e.x, labelY);
        }
      } else {
        ctx.fillStyle = t.revealed ? t.def.mark : '#8f9678';
        ctx.beginPath();
        ctx.arc(e.x,e.y,5,0,Math.PI*2);
        ctx.fill();
        if(t.revealed){
          ctx.fillStyle = LABEL_TEXT_COLOR;
          ctx.font = '14px "JetBrains Mono"';
          ctx.textAlign='center';
          ctx.fillText(t.def.label, e.x, labelY);
        }
      }

      // small HP bar above the marker
      const hpPct = clamp(t.hp/t.maxHp, 0, 1);
      const tBarW=32, tBarH=4;
      const tbx = e.x-tBarW/2, tby = e.y-22;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(tbx-1,tby-1,tBarW+2,tBarH+2);
      ctx.fillStyle = '#3a4128';
      ctx.fillRect(tbx,tby,tBarW,tBarH);
      ctx.fillStyle = hpPct>0.3 ? '#c1453b' : '#f0715f';
      ctx.fillRect(tbx,tby,tBarW*hpPct,tBarH);

      ctx.fillStyle = LABEL_TEXT_COLOR;
      ctx.font = 'bold 17px "JetBrains Mono"';
      ctx.textAlign='left';
      ctx.fillText(t.id, e.x+11, e.y-11);
      if(isSuppressed(t)){
        ctx.fillStyle = LABEL_TEXT_COLOR;
        ctx.font = 'bold 13px "JetBrains Mono"';
        ctx.textAlign = 'center';
        ctx.fillText('[制圧]', e.x, e.y-30);
      }
    } else {
      // reveal true position, destroyed mark
      const dp = project(t.trueX, t.trueY);
      ctx.strokeStyle = '#c1453b'; ctx.lineWidth=2;
      ctx.beginPath();
      ctx.moveTo(dp.x-8,dp.y-8); ctx.lineTo(dp.x+8,dp.y+8);
      ctx.moveTo(dp.x+8,dp.y-8); ctx.lineTo(dp.x-8,dp.y+8);
      ctx.stroke();
      ctx.fillStyle=LABEL_TEXT_COLOR; ctx.font='15px "JetBrains Mono"'; ctx.textAlign='center';
      ctx.fillText(t.id+' 撃破', dp.x, dp.y-16);
    }

    // impact marks
    t.impacts.forEach(imp=>{
      const ip = project(imp.x, imp.y);
      ctx.fillStyle = 'rgba(193,69,59,0.75)';
      ctx.beginPath();
      ctx.arc(ip.x, ip.y, 3, 0, Math.PI*2);
      ctx.fill();
    });
  });

  // pending fire points ― effect radius + crosshair, awaiting execute/cancel
  if(!state.animating){
    const pendDispersion = computeDispersionAt() * WEATHER_TYPES[state.weather].dispersionMult;
    state.mortars.forEach(mortar=>{
      if(!mortar.pendingFire) return;
      const pp = project(mortar.pendingFire.x, mortar.pendingFire.y);
      const px = pp.x, py = pp.y;
      ctx.beginPath();
      ctx.setLineDash([4,4]);
      ctx.strokeStyle = 'rgba(193,69,59,0.85)';
      ctx.lineWidth = 1.5;
      ctx.arc(px, py, pendDispersion, 0, Math.PI*2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.strokeStyle = '#c1453b';
      ctx.lineWidth = 2;
      ctx.moveTo(px-10,py); ctx.lineTo(px+10,py);
      ctx.moveTo(px,py-10); ctx.lineTo(px,py+10);
      ctx.stroke();
    });
  }

  // flying projectiles ― arced trajectory (ground track projected through the 3D camera;
  // the arc "hop" itself stays a simple screen-space offset, as in the original 2D view)
  const nowP = performance.now();
  projectiles.forEach(p=>{
    const prog = clamp((nowP-p.born)/p.duration, 0, 1);
    const gx = p.startX + (p.endX-p.startX)*prog;
    const gy = p.startY + (p.endY-p.startY)*prog;
    const gp = project(gx, gy);
    const x = gp.x, y = gp.y - Math.sin(prog*Math.PI)*ARC_HEIGHT;
    const startG = project(p.startX, p.startY);
    const endG = project(p.endX, p.endY);

    // faint dashed ground track + aim point ring
    ctx.beginPath();
    ctx.setLineDash([2,4]);
    ctx.strokeStyle = 'rgba(217,164,65,0.25)';
    ctx.lineWidth = 1;
    ctx.moveTo(startG.x,startG.y); ctx.lineTo(endG.x,endG.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(193,69,59,0.6)';
    ctx.arc(endG.x,endG.y,4,0,Math.PI*2);
    ctx.stroke();

    // short motion trail
    for(let k=1;k<=3;k++){
      const tp = clamp(prog-k*0.04,0,1);
      const tgx = p.startX + (p.endX-p.startX)*tp;
      const tgy = p.startY + (p.endY-p.startY)*tp;
      const tgp = project(tgx, tgy);
      const tx = tgp.x, ty = tgp.y - Math.sin(tp*Math.PI)*ARC_HEIGHT;
      ctx.beginPath();
      ctx.fillStyle = `rgba(217,164,65,${0.35-k*0.1})`;
      ctx.arc(tx,ty,3-k*0.5,0,Math.PI*2);
      ctx.fill();
    }

    // shell itself
    ctx.beginPath();
    ctx.fillStyle = '#f2c869';
    ctx.arc(x,y,4,0,Math.PI*2);
    ctx.fill();
  });

  // enemy tracers ― incoming fire (counter-attack on FDC / infantry duel casualties)
  enemyTracers.forEach(tr=>{
    const prog = clamp((nowP-tr.born)/tr.duration, 0, 1);
    const gx = tr.startX + (tr.endX-tr.startX)*prog;
    const gy = tr.startY + (tr.endY-tr.startY)*prog;
    const gp = project(gx, gy);
    const x = gp.x, y = gp.y;
    const trailProg = Math.max(0, prog-0.25);
    const tgx = tr.startX + (tr.endX-tr.startX)*trailProg;
    const tgy = tr.startY + (tr.endY-tr.startY)*trailProg;
    const tgp = project(tgx, tgy);
    const startG = project(tr.startX, tr.startY);
    const endG = project(tr.endX, tr.endY);
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,120,80,0.3)';
    ctx.lineWidth = 1;
    ctx.moveTo(startG.x, startG.y);
    ctx.lineTo(endG.x, endG.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,140,80,0.9)';
    ctx.lineWidth = 2;
    ctx.moveTo(tgp.x, tgp.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = '#ffcf9e';
    ctx.arc(x, y, 2.8, 0, Math.PI*2);
    ctx.fill();
  });

  // impact flashes ― a "big" flash (destruction events, see spawnDestructionEffect) is a
  // much larger, whiter-hot version of the same ring+core rather than a separate visual
  // language; spawnDestructionEffect pushes two staggered big flashes per kill for a
  // boom-BOOM double pulse instead of one flat pop.
  flashes.forEach(f=>{
    const p = (nowP-f.born)/f.life;
    const fp = project(f.x, f.y);
    const scale = f.big ? 3.4 : 1;
    ctx.beginPath();
    ctx.strokeStyle = f.big ? `rgba(255,235,205,${1-p})` : `rgba(255,140,60,${1-p})`;
    ctx.lineWidth = f.big ? 5 : 2.5;
    // spawnDestructionEffect schedules a second flash with born set ~130ms in the future
    // (for the boom-BOOM double pulse) -- until that time arrives, p is negative here, and
    // without clamping to 0 this radius goes negative too. ctx.arc() throws on a negative
    // radius, which was silently killing the whole requestAnimationFrame loop (the map
    // freezing) on every single kill, not just multi-kill bursts.
    ctx.arc(fp.x, fp.y, Math.max(0, (6+p*38)*scale), 0, Math.PI*2);
    ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = f.big ? `rgba(255,240,210,${(1-p)*0.9})` : `rgba(255,200,120,${(1-p)*0.8})`;
    ctx.arc(fp.x, fp.y, Math.max(0,(f.big?22:6)-p*(f.big?22:6)), 0, Math.PI*2);
    ctx.fill();
  });

  // debris particles ― fragments flung outward from a destruction, falling with gravity
  debrisParticles = debrisParticles.filter(d=>nowP-d.born < d.life);
  debrisParticles.forEach(d=>{
    const t = (nowP-d.born)/1000;
    const gx = d.x + d.vx*t;
    const gy = d.y + d.vy*t + 55*t*t;
    const dp = project(gx, gy);
    const age = (nowP-d.born)/d.life;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1-age);
    ctx.fillStyle = d.color || '#ffb45a';
    ctx.beginPath();
    ctx.arc(dp.x, dp.y, 3.5, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  });

  // wreck smoke ― a dark column that drifts up and fades over several seconds, marking
  // where something was destroyed
  wreckSmokes = wreckSmokes.filter(w=>nowP-w.born < w.life);
  wreckSmokes.forEach(w=>{
    const age = (nowP-w.born)/w.life;
    const wp = project(w.x, w.y - age*55);
    const alpha = (1-age)*0.58;
    if(alpha<=0) return;
    [
      {dx:0,dy:0,r:24+age*16},{dx:-10,dy:-6,r:18+age*13},{dx:10,dy:-8,r:18+age*13},
      {dx:-16,dy:6,r:14+age*10},{dx:15,dy:8,r:14+age*10},
    ].forEach(pf=>{
      ctx.beginPath();
      ctx.fillStyle = `rgba(28,26,24,${alpha})`;
      ctx.arc(wp.x+pf.dx, wp.y+pf.dy, pf.r, 0, Math.PI*2);
      ctx.fill();
    });
  });

  // kill banners ― a floating "撃破!" (or friendly-loss equivalent) that pops in big, then
  // settles, rises and fades
  killBanners = killBanners.filter(b=>nowP-b.born < b.life);
  killBanners.forEach(b=>{
    const age = (nowP-b.born)/b.life;
    const bp = project(b.x, b.y - age*30);
    const alpha = 1 - Math.max(0, (age-0.6)/0.4);
    const popIn = 200;
    const elapsedMs = nowP-b.born;
    const popScale = elapsedMs<popIn ? 1.7 - 0.7*(elapsedMs/popIn) : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.translate(bp.x, bp.y);
    ctx.scale(popScale, popScale);
    ctx.font = 'bold 20px "JetBrains Mono"';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    ctx.strokeText(b.text, 0, 0);
    ctx.fillStyle = b.color || LABEL_TEXT_COLOR;
    ctx.fillText(b.text, 0, 0);
    ctx.restore();
  });

  // ripples (recon ping animation)
  const now = performance.now();
  ripples = ripples.filter(r => now - r.born < r.life);
  ripples.forEach(r=>{
    const p = (now-r.born)/r.life;
    const rp = project(r.x, r.y);
    ctx.beginPath();
    ctx.strokeStyle = `rgba(217,164,65,${1-p})`;
    ctx.lineWidth = 2;
    ctx.arc(rp.x, rp.y, 10+p*40, 0, Math.PI*2);
    ctx.stroke();
  });

  // smoke clouds (発煙弾) ― billowing, semi-transparent blobs that fade as they age
  (state.smokeClouds||[]).forEach(c=>{
    const cp = project(c.x, c.y);
    if(!cp.visible) return;
    const age = 1 - clamp(c.turnsLeft/SMOKE_DURATION_TURNS, 0, 1);
    const alpha = 0.5 - age*0.2;
    const puffs = [
      {dx:0, dy:0, r:26}, {dx:-14, dy:6, r:18}, {dx:14, dy:5, r:19},
      {dx:-6, dy:-12, r:16}, {dx:9, dy:-10, r:15},
    ];
    puffs.forEach(pf=>{
      ctx.beginPath();
      ctx.fillStyle = `rgba(210,210,205,${alpha})`;
      ctx.arc(cp.x+pf.dx, cp.y+pf.dy, pf.r, 0, Math.PI*2);
      ctx.fill();
    });
  });

  // illumination flares (照明弾) ― bursts high above the ground point, then a bright light
  // ball drifts slowly down over ILLUM_FALL_DURATION while a soft glow lights up the ground
  // below it; the ground glow itself persists for the flare's full turnsLeft lifetime.
  (state.illumFlares||[]).forEach(f=>{
    const gp = project(f.x, f.y);
    if(!gp.visible) return;
    const lifeAge = 1 - clamp(f.turnsLeft/ILLUM_DURATION_TURNS, 0, 1);
    const groundAlpha = 0.4 - lifeAge*0.22;
    if(groundAlpha > 0){
      const glowR = ILLUM_RADIUS_UNITS;
      const grad = ctx.createRadialGradient(gp.x, gp.y, 0, gp.x, gp.y, glowR);
      grad.addColorStop(0, `rgba(255,248,210,${groundAlpha})`);
      grad.addColorStop(0.6, `rgba(255,240,180,${groundAlpha*0.5})`);
      grad.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.beginPath();
      ctx.fillStyle = grad;
      ctx.arc(gp.x, gp.y, glowR, 0, Math.PI*2);
      ctx.fill();
    }
    const fallAge = nowP - f.born;
    if(fallAge < ILLUM_FALL_DURATION){
      const fallP = clamp(fallAge/ILLUM_FALL_DURATION, 0, 1);
      const flareX = gp.x, flareY = gp.y - ILLUM_BURST_HEIGHT*(1-fallP);
      if(fallAge < 260){
        const burstP = fallAge/260;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(255,250,220,${1-burstP})`;
        ctx.lineWidth = 2;
        ctx.arc(flareX, flareY, 6+burstP*20, 0, Math.PI*2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,244,200,0.35)';
      ctx.lineWidth = 1.5;
      ctx.moveTo(flareX, gp.y);
      ctx.lineTo(flareX, flareY);
      ctx.stroke();
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255,250,225,0.3)';
      ctx.arc(flareX, flareY, 9, 0, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255,250,225,0.95)';
      ctx.arc(flareX, flareY, 3.5, 0, Math.PI*2);
      ctx.fill();
    }
  });

  // weather tint overlay
  const weatherTint = state.weather && WEATHER_TYPES[state.weather].tint;
  if(weatherTint){
    ctx.fillStyle = weatherTint;
    ctx.fillRect(0,0,cv.width,cv.height);
  }

  // manual placement highlight ― pulses around the unit awaiting a click-placed position
  if(state.placementPending){
    const item = state.placementQueue[state.placementIndex];
    const unit = currentPlacementUnit(item);
    if(unit){
      const up = project(unit.x, unit.y);
      const pulse = 6 + Math.sin(performance.now()*0.006)*4;
      ctx.beginPath();
      ctx.strokeStyle = '#d9a441';
      ctx.lineWidth = 2;
      ctx.setLineDash([4,3]);
      ctx.arc(up.x, up.y, 20+pulse, 0, Math.PI*2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#d9a441';
      ctx.font = 'bold 13px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText(`▼ ${item.label} を配置`, up.x, up.y-30-pulse);
    }
  }

  drawCallouts(ctx);
}

// ===================== Voice callouts (speech bubbles) =====================
// Combat radio-chatter lines, grouped by situation. unitSpeak(kind, idx,
// category) is called from gameplay events (orders given, contact spotted,
// casualties, low ammo, morale swings, coordination, panic, stage cleared)
// to have that unit's représentative soldier say a random line from the
// matching category. Bubbles are purely visual/transient (not persisted in
// state) and auto-expire after CALLOUT_DURATION_MS.
const COMBAT_CALLOUTS = {
  order: ['撃て！','前進！','伏せろ！','隠れろ！','動くな！','待て！','突撃！','退避！','後退！','集合！','散開！','援護しろ！','カバーしろ！','装填！','構え！','狙え！','撤退だ！','進め！','止まれ！','全員伏せろ！'],
  warning: ['敵だ！','敵発見！','狙撃手だ！','手榴弾！','伏兵だ！','地雷だ！','右から来るぞ！','左に敵！','後ろだ！','頭を下げろ！','爆発物だ！','火の海だ！','戦車だ！','空襲だ！','気をつけろ！','危ない！','伏せて！','撃たれてる！','弾幕だ！','包囲されてる！'],
  injury: ['誰か助けてくれ！','衛生兵！','撃たれた！','やられた！','動けない！','出血がひどい！','死ぬな！','しっかりしろ！','傷を見せろ！','すぐ運べ！','息をしてない！','まだ生きてる！','担架を持ってこい！'],
  ammo: ['弾切れだ！','弾をくれ！','予備弾倉！','リロード中！','銃が壊れた！','無線が繋がらない！','燃料が切れた！'],
  morale: ['諦めるな！','行けるぞ！','頑張れ！','まだやれる！','負けるな！','仲間を信じろ！','一緒に生き延びるぞ！','家族のために！','祖国のために！','俺たちならできる！'],
  coordination: ['こちら応答せよ！','状況を報告しろ！','位置を教えろ！','目標確認！','座標を送れ！','こちら小隊！','了解！','確認した！','進捗はどうだ！','応援を呼べ！'],
  panic: ['逃げろ！','どうすればいい！','もうダメだ！','終わりだ！','助けてくれ！','誰かいないのか！','こっちに来い！','何が起きてる！','パニックになるな！','落ち着け！','もう無理だ、俺は撤退する！','落ち着け、パニックになるな！','死にたくない、こんな場所嫌だ！','お前が弱気になったら全員がやられる！','怖いのはみんな同じだ！','もう弾がない、どうしろって言うんだ！','泣き言を言ってる暇はない！','お前だけ逃げるつもりか！','仲間を置いていけない！','これ以上は正気の沙汰じゃない！','震えてる場合か、銃を構えろ！','もう限界だ、体が動かない！','気をしっかり持て、まだ終わってない！','みんな死ぬ気か、正気に戻れ！','怖がってばかりじゃ生き残れないぞ！','俺を置いていくな、頼む！','感情論はやめろ、冷静に判断しろ！','こんな状況で冷静でいられるか！','お前まで取り乱すな！','大丈夫だ、絶対に生きて帰るぞ！'],
  victory: ['やったぞ！','制圧完了！','敵を撃退した！','安全確保！','戦闘終了！','全員無事か！','生きてるか！','帰るぞ！','よくやった！','任務完了！'],
  defyOrder: ['そんな命令、誰が出したんだ！','無茶を言うな、あの位置からじゃ援護できない！','本部は現場を分かってない！','今から迂回してたら間に合わない！','勝手に突っ込むな、隊列を乱すな！','お前が先に行けって言ったんだろ！','作戦変更なんて聞いてないぞ！','誰の判断だ、これは！','撤退の指示はまだ出てない！','待て、それは自殺行為だ！','お前の独断でみんな危険にさらされてる！','命令通りにやったら全滅する！','なんで確認もせず突撃した！','無線が通じてないのはお前のせいだろ！','そっちのルートは危険だと言ったはずだ！','指揮官、判断が遅すぎます！','これ以上前進する意味があるのか！','勝手な行動は許さんぞ！','誰が指揮を執ってるんだ、はっきりしろ！','机上の作戦と現場は違うんだよ！'],
  blame: ['お前が索敵をサボったからだろ！','弾薬の管理、お前の担当だったよな！','なんで援護に来なかった！','そっちが先に発砲したんじゃないか！','お前のミスで仲間が撃たれたんだぞ！','言い訳はいい、状況を見ろ！','誰のせいでもない、今は動くしかない！','お前が地図を読み違えたんだろう！','装備の点検、ちゃんとやったのか！','連絡が遅れたのはお前の落ち度だ！','なんで俺のせいにする！','みんなお前を頼りにしてたのに！','お前が油断したから見つかったんだ！','言われた通りにやっただけだ！','経験不足のくせに口を出すな！','新兵のミスをかばうのも限界がある！','こっちは必死にやってるんだ、文句を言うな！','お前が命令を無視したせいだ！','今更誰が悪いか議論してる場合か！','後で報告書に書いてやる、覚えとけ！'],
  irritation: ['動きが遅い、置いていくぞ！','なんでそんな場所に伏せてるんだ！','合図を見逃すな、集中しろ！','お前の射撃、味方に当たりそうだったぞ！','勝手に持ち場を離れるな！','そこは危険地帯だと言っただろ！','装備を忘れるとかあり得ない！','無線のチャンネル、間違えてるぞ！','お前、ちゃんと周り見てるのか！','足を引っ張るなら下がってろ！','新人だからって甘えるな！','お前の判断、いつも遅すぎるんだよ！','もっと声を出せ、聞こえないぞ！','なんでそっちに勝手に進んだ！','連携取れてないぞ、しっかりしろ！','お前が動くたびに位置がばれるんだよ！','無駄弾使うな、節約しろ！','そんな装備で来るなんて信じられない！','お前、寝てないのか、しっかりしろ！','言われたことだけやってりゃいいんだよ！'],
  outburst: ['もう嫌だ、こんな戦争！','なんでこんな所で死ななきゃいけないんだ！','家族のところに帰りたいだけなんだ！','お前にこの気持ちが分かるか！','仲間を見捨てるなんてできない！','誰かのために死ぬなんて意味あるのか！','もう何を信じればいいんだ！','これが正義だって言うのか！','お前は何も分かってない！','戦友を失ってなお戦えって言うのか！','命令だから仕方ないなんて言うな！','俺たちは駒じゃない！','もう誰も死なせたくないんだ！','なんでこんな作戦を許可したんだ！','怒りをぶつける相手を間違えるな！','お前まで俺を疑うのか！','信頼できるのはお前だけなんだ！','もう限界だと言ってるだろう！','終わったらすべて話し合おう、今は戦え！','絶対に、みんなで生きて帰るぞ！'],
};
const CALLOUT_DURATION_MS = 4000;
// per user request: halves how often squad-member speech bubbles actually appear at all
// (independent of which category/line gets picked once triggered) -- see unitSpeak.
const CALLOUT_OCCURRENCE_CHANCE = 0.5;
let activeCallouts = [];

function calloutUnitRef(kind, idx){
  if(kind==='mortar') return state.mortars[idx];
  if(kind==='scout') return state.scouts[idx];
  if(kind==='squad') return state.squads[idx];
  if(kind==='sniper') return state.snipers[idx];
  return null;
}
const RANK_ABBR = {
  '1等陸佐':'1佐', '2等陸佐':'2佐', '3等陸佐':'3佐',
  '1等陸尉':'1尉', '2等陸尉':'2尉', '3等陸尉':'3尉',
  '准陸尉':'准尉',
  '陸曹長':'曹長',
  '1等陸曹':'1曹', '2等陸曹':'2曹', '3等陸曹':'3曹',
  '陸士長':'士長',
  '1等陸士':'1士', '2等陸士':'2士',
};
function calloutSpeakerName(kind, idx){
  const u = calloutUnitRef(kind, idx);
  if(!u) return null;
  const person = kind==='mortar'
    ? ((u.hp>0 && u.crew && u.crew[0]) ? u.crew[0] : null)
    : (u.soldiers && u.soldiers.find(s=>s.alive));
  if(!person) return null;
  const abbr = RANK_ABBR[person.rank] || person.rank;
  return `${person.name}${abbr}`;
}
function unitSpeak(kind, idx, category){
  if(Math.random() >= CALLOUT_OCCURRENCE_CHANCE) return;
  const list = COMBAT_CALLOUTS[category];
  if(!list || !list.length) return;
  const name = calloutSpeakerName(kind, idx);
  if(!name) return;
  const text = list[Math.floor(Math.random()*list.length)];
  activeCallouts = activeCallouts.filter(c=>!(c.kind===kind && c.idx===idx));
  activeCallouts.push({kind, idx, name, text, expiresAt: performance.now()+CALLOUT_DURATION_MS});
}
// For situational lines (coordination, morale, panic, victory) not tied to
// one specific unit's own action -- picks any one currently alive unit to say it.
function randomAliveUnitRef(){
  const pool = [];
  state.mortars.forEach((m,i)=>{ if(m.hp>0) pool.push({kind:'mortar', idx:i}); });
  state.scouts.forEach((s,i)=>{ if(unitAlive(s)) pool.push({kind:'scout', idx:i}); });
  state.squads.forEach((sq,i)=>{ if(sq.soldiers.some(s=>s.alive)) pool.push({kind:'squad', idx:i}); });
  state.snipers.forEach((sn,i)=>{ if(sn.soldiers.some(s=>s.alive)) pool.push({kind:'sniper', idx:i}); });
  if(!pool.length) return null;
  return pool[Math.floor(Math.random()*pool.length)];
}
function speakRandomAliveUnit(category){
  const ref = randomAliveUnitRef();
  if(ref) unitSpeak(ref.kind, ref.idx, category);
}
// Wraps the plain 'order'/'injury'/'coordination' callouts with a chance of pulling from
// the "言い争い" (argument/conflict) vocabulary instead, so orders sometimes draw pushback,
// casualties sometimes draw blame, and radio chatter sometimes draws irritation.
function unitSpeakOrder(kind, idx){
  unitSpeak(kind, idx, Math.random()<0.2 ? 'defyOrder' : 'order');
}
function unitSpeakInjury(kind, idx){
  unitSpeak(kind, idx, Math.random()<0.3 ? 'blame' : 'injury');
}
function speakCoordination(){
  speakRandomAliveUnit(Math.random()<0.25 ? 'irritation' : 'coordination');
}
function drawCallouts(ctx){
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

// ===================== 3D terrain map (Three.js) =====================
// Perspective, orbit-style camera (drag=pan, right-drag=rotate/tilt, wheel=zoom).
// Every 2D overlay element (HP bars, labels, cones, roads...) is anchored via
// project(canvasUnitX, canvasUnitY) which converts logical game coordinates to
// real screen pixels through the current 3D camera each frame, so everything
// stays correctly placed no matter how the camera is rotated/tilted/panned.
let mapDragMoved = false;
let threeReady = false;
let scene3d, camera3d, renderer3d, terrainObject3d;
const HEIGHT_GRID = { cols:0, rows:0, values:null, minX:0, minZ:0, stepX:1, stepZ:1 };
// On phones, start the camera rotated -90 deg so the friendly<->enemy axis
// (canvas X: friendly at low X, enemy at high X) reads bottom-to-top on
// screen (friendly near/bottom, enemy far/top) instead of the desktop's
// left-to-right layout -- a better fit for a narrow, tall viewport. Free
// rotation via two-finger touch/right-drag still works from this starting
// point either way.
const MAP_INITIAL_AZIMUTH = (window.innerWidth||0) <= 600 ? -Math.PI/2 : 0;
const MAP_VIEW = {
  cx: CANVAS_W/2, cy: CANVAS_H/2,      // look-at point, in canvas-unit space
  zoom: 1, azimuth: MAP_INITIAL_AZIMUTH, polar: 0.6, // orbit distance factor / horizontal / tilt angle (rad)
  containerW: 1, containerH: 1,
};
const MAP_ZOOM_MIN = 0.35, MAP_ZOOM_MAX = 5;
const MAP_POLAR_MIN = 0.12, MAP_POLAR_MAX = 1.45;
const WORLD = { originX: 0, originZ: 0, unitsPerCanvasUnit: 1, minY: 0, maxY: 0, refY: 0 };
const unitMarkers3d = {};
let mapFocusTarget = null;

function applyTerrainTextureOverride(root){
  if(typeof TERRAIN_TEXTURE_BASE64 === 'undefined' || !TERRAIN_TEXTURE_BASE64) return;
  const dataUrl = 'data:image/jpeg;base64,'+TERRAIN_TEXTURE_BASE64;
  const loader = new THREE.TextureLoader();
  loader.load(dataUrl, tex=>{
    tex.flipY = false;
    if('encoding' in tex) tex.encoding = THREE.sRGBEncoding;
    if('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    root.traverse(o=>{
      if(o.isMesh && o.material){
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m=>{ m.map = tex; m.needsUpdate = true; });
      }
    });
  }, undefined, err=>{
    console.error('差し替えテクスチャの読み込みに失敗しました', err);
  });
}

function initThree(){
  const canvas3d = document.getElementById('board3d');
  if(typeof THREE === 'undefined' || !THREE.GLTFLoader || typeof TERRAIN_GLB_BASE64 === 'undefined'){
    console.warn('3D地形(Three.js/地形データ)を読み込めませんでした。地図は表示されません。');
    return;
  }
  renderer3d = new THREE.WebGLRenderer({ canvas: canvas3d, antialias:true });
  renderer3d.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  renderer3d.setClearColor(0x11140d, 1);
  // The terrain texture is tagged sRGBEncoding (see applyTerrainTextureOverride);
  // without matching output encoding on the renderer the final image comes out
  // noticeably darker/duller than the source texture.
  if('outputEncoding' in renderer3d) renderer3d.outputEncoding = THREE.sRGBEncoding;
  scene3d = new THREE.Scene();

  camera3d = new THREE.PerspectiveCamera(45, 1, 1, 100000);
  scene3d.add(camera3d);

  scene3d.add(new THREE.AmbientLight(0xffffff, 0.95));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.05);
  sun.position.set(600, 1200, 400);
  scene3d.add(sun);

  resizeThree();

  let arrayBuffer;
  try{
    const binStr = atob(TERRAIN_GLB_BASE64);
    const bytes = new Uint8Array(binStr.length);
    for(let i=0;i<binStr.length;i++) bytes[i] = binStr.charCodeAt(i);
    arrayBuffer = bytes.buffer;
  } catch(e){
    console.error('地形データのデコードに失敗しました', e);
    return;
  }

  const loader = new THREE.GLTFLoader();
  loader.parse(arrayBuffer, '', (gltf)=>{
    terrainObject3d = gltf.scene;
    scene3d.add(terrainObject3d);
    applyTerrainTextureOverride(terrainObject3d);

    const box = new THREE.Box3().setFromObject(terrainObject3d);
    const sizeX = box.max.x-box.min.x, sizeZ = box.max.z-box.min.z;
    WORLD.minY = box.min.y; WORLD.maxY = box.max.y;
    WORLD.refY = (box.min.y+box.max.y)/2;
    const scale = Math.min(sizeX/CANVAS_W, sizeZ/CANVAS_H);
    WORLD.unitsPerCanvasUnit = scale;
    const fieldW = CANVAS_W*scale, fieldH = CANVAS_H*scale;
    const cx = (box.min.x+box.max.x)/2, cz = (box.min.z+box.max.z)/2;
    WORLD.originX = cx - fieldW/2;
    WORLD.originZ = cz - fieldH/2;

    buildHeightGrid();
    buildRealRoads();
    threeReady = true;
    resizeThree();
  }, (err)=>{
    console.error('地形モデル(hijuudai.glb)の読み込みに失敗しました', err);
  });
}

// Precompute a coarse height field ONCE at load time (via real mesh raycasts) so that
// per-frame lookups (terrainHeightAt) are cheap O(1) bilinear reads instead of raycasts
// against a dense terrain mesh (which would be far too slow to do every frame).
function buildHeightGrid(){
  const COLS = 70, ROWS = 40;
  const rc = new THREE.Raycaster();
  const minX = WORLD.originX, minZ = WORLD.originZ;
  const stepX = (CANVAS_W*WORLD.unitsPerCanvasUnit)/(COLS-1);
  const stepZ = (CANVAS_H*WORLD.unitsPerCanvasUnit)/(ROWS-1);
  const values = new Float32Array(COLS*ROWS);
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const x = minX + c*stepX, z = minZ + r*stepZ;
      rc.set(new THREE.Vector3(x, WORLD.maxY+2000, z), new THREE.Vector3(0,-1,0));
      const hits = rc.intersectObject(terrainObject3d, true);
      values[r*COLS+c] = hits.length ? hits[0].point.y : WORLD.refY;
    }
  }
  HEIGHT_GRID.cols = COLS; HEIGHT_GRID.rows = ROWS; HEIGHT_GRID.values = values;
  HEIGHT_GRID.minX = minX; HEIGHT_GRID.minZ = minZ;
  HEIGHT_GRID.stepX = stepX; HEIGHT_GRID.stepZ = stepZ;
}

// Converts the real OSM road network (mapcreate/roads_data.js, raw local terrain
// meters as originally exported by gsi_terrain_to_obj.py) into canvas-unit
// polylines. Uses the terrain mesh node's own accumulated world matrix
// (localToWorld) rather than a hand-derived scale/rotation, so it stays correct
// regardless of exactly how the GLB was authored/exported.
function buildRealRoads(){
  if(typeof ROADS_RAW_DATA === 'undefined' || !terrainObject3d) return;
  let meshNode = null;
  terrainObject3d.traverse(o=>{ if(o.isMesh && !meshNode) meshNode = o; });
  if(!meshNode) return;
  meshNode.updateWorldMatrix(true, false);
  const v = new THREE.Vector3();
  REAL_ROADS_CANVAS.length = 0;
  ROADS_RAW_DATA.forEach(way=>{
    const poly = way.points.map(pt=>{
      v.set(pt.x, pt.z, 0);
      meshNode.localToWorld(v);
      return {
        x: (v.x-WORLD.originX)/WORLD.unitsPerCanvasUnit,
        y: (v.z-WORLD.originZ)/WORLD.unitsPerCanvasUnit,
      };
    });
    REAL_ROADS_CANVAS.push(poly);
  });
  if(state) state.roads = REAL_ROADS_CANVAS;
  buildRoadGraph();
}

// Builds a graph (nodes + adjacency list) from REAL_ROADS_CANVAS so vehicles
// can be routed along the actual road network via A* (findRoadPath) instead
// of just getting an off-road speed bonus for being near one. Points from
// different ways that fall within ROAD_NODE_SNAP_RADIUS_UNITS of each other
// are merged into a single node -- this both represents real intersections
// and bridges any small gaps introduced by the earlier road-simplification
// pass, using a spatial grid (bucketed by snap radius) so it stays roughly
// linear in the number of road points instead of comparing every pair.
function buildRoadGraph(){
  const snapR = ROAD_NODE_SNAP_RADIUS_UNITS;
  const cellSize = Math.max(1, snapR);
  const buckets = new Map();
  const nodes = [];
  const adj = [];
  function bucketKeyFor(bx, by){ return bx+','+by; }
  function findOrCreateNode(x, y){
    const bx = Math.floor(x/cellSize), by = Math.floor(y/cellSize);
    for(let dx=-1; dx<=1; dx++){
      for(let dy=-1; dy<=1; dy++){
        const arr = buckets.get(bucketKeyFor(bx+dx, by+dy));
        if(!arr) continue;
        for(const idx of arr){
          if(Math.hypot(nodes[idx].x-x, nodes[idx].y-y) <= snapR) return idx;
        }
      }
    }
    const idx = nodes.length;
    nodes.push({x, y});
    adj.push([]);
    const key = bucketKeyFor(bx, by);
    if(!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(idx);
    return idx;
  }
  function addEdge(a, b, dist){
    if(a===b) return;
    if(!adj[a].some(e=>e.to===b)) adj[a].push({to:b, dist});
    if(!adj[b].some(e=>e.to===a)) adj[b].push({to:a, dist});
  }
  REAL_ROADS_CANVAS.forEach(road=>{
    let prevIdx = null, prevPt = null;
    road.forEach(pt=>{
      const idx = findOrCreateNode(pt.x, pt.y);
      if(prevIdx!==null){
        addEdge(prevIdx, idx, Math.hypot(pt.x-prevPt.x, pt.y-prevPt.y));
      }
      prevIdx = idx; prevPt = pt;
    });
  });
  ROAD_GRAPH = {nodes, adj};
}

function nearestRoadNodeIdx(x, y){
  if(!ROAD_GRAPH || !ROAD_GRAPH.nodes.length) return -1;
  let best=-1, bd=Infinity;
  ROAD_GRAPH.nodes.forEach((n,i)=>{
    const d = Math.hypot(n.x-x, n.y-y);
    if(d<bd){ bd=d; best=i; }
  });
  return best;
}

// A* over the road graph from (fromX,fromY) to (toX,toY), both snapped to
// their nearest graph node. Returns an ordered array of {x,y} waypoints
// (graph nodes only -- the caller is responsible for the final off-road hop
// from the last node to the actual target position), or null if no path
// exists (e.g. disconnected road graph, or no road data loaded at all).
function findRoadPath(fromX, fromY, toX, toY){
  if(!ROAD_GRAPH || !ROAD_GRAPH.nodes.length) return null;
  const startIdx = nearestRoadNodeIdx(fromX, fromY);
  const goalIdx = nearestRoadNodeIdx(toX, toY);
  if(startIdx<0 || goalIdx<0) return null;
  const nodes = ROAD_GRAPH.nodes, adj = ROAD_GRAPH.adj;
  if(startIdx===goalIdx) return [nodes[startIdx]];
  const goalNode = nodes[goalIdx];
  const gScore = new Map([[startIdx, 0]]);
  const fScore = new Map([[startIdx, Math.hypot(nodes[startIdx].x-goalNode.x, nodes[startIdx].y-goalNode.y)]]);
  const cameFrom = new Map();
  const open = new Set([startIdx]);
  const closed = new Set();
  while(open.size){
    let cur=-1, bestF=Infinity;
    open.forEach(idx=>{
      const f = fScore.has(idx) ? fScore.get(idx) : Infinity;
      if(f<bestF){ bestF=f; cur=idx; }
    });
    if(cur===goalIdx){
      const path = [nodes[cur]];
      let c = cur;
      while(cameFrom.has(c)){ c = cameFrom.get(c); path.unshift(nodes[c]); }
      return path;
    }
    open.delete(cur);
    closed.add(cur);
    (adj[cur]||[]).forEach(e=>{
      if(closed.has(e.to)) return;
      const tentG = (gScore.has(cur)?gScore.get(cur):Infinity) + e.dist;
      if(tentG < (gScore.has(e.to)?gScore.get(e.to):Infinity)){
        cameFrom.set(e.to, cur);
        gScore.set(e.to, tentG);
        fScore.set(e.to, tentG + Math.hypot(nodes[e.to].x-goalNode.x, nodes[e.to].y-goalNode.y));
        open.add(e.to);
      }
    });
  }
  return null;
}

// Walks up to stepLen distance along a polyline of waypoints starting from
// (fromX,fromY), crossing as many waypoints as fit within the step.
function advanceAlongPath(fromX, fromY, path, stepLen){
  let remaining = stepLen;
  let curX = fromX, curY = fromY;
  for(let i=0; i<path.length && remaining>0; i++){
    const wp = path[i];
    const segDist = Math.hypot(wp.x-curX, wp.y-curY);
    if(segDist <= remaining){
      curX = wp.x; curY = wp.y;
      remaining -= segDist;
    } else {
      const t = segDist>0 ? remaining/segDist : 0;
      curX = curX + (wp.x-curX)*t;
      curY = curY + (wp.y-curY)*t;
      remaining = 0;
    }
  }
  return {x:curX, y:curY};
}

function canvasUnitToWorldXZ(cx, cy){
  return { x: WORLD.originX + cx*WORLD.unitsPerCanvasUnit, z: WORLD.originZ + cy*WORLD.unitsPerCanvasUnit };
}
function terrainHeightAt(cx, cy){
  if(!HEIGHT_GRID.values) return WORLD.refY||0;
  const {x,z} = canvasUnitToWorldXZ(cx,cy);
  const fc = clamp((x-HEIGHT_GRID.minX)/HEIGHT_GRID.stepX, 0, HEIGHT_GRID.cols-1.0001);
  const fr = clamp((z-HEIGHT_GRID.minZ)/HEIGHT_GRID.stepZ, 0, HEIGHT_GRID.rows-1.0001);
  const c0 = Math.floor(fc), r0 = Math.floor(fr), c1 = c0+1, r1 = r0+1;
  const tx = fc-c0, tz = fr-r0;
  const v = (r,c)=> HEIGHT_GRID.values[r*HEIGHT_GRID.cols+c];
  const top = v(r0,c0)*(1-tx) + v(r0,c1)*tx;
  const bot = v(r1,c0)*(1-tx) + v(r1,c1)*tx;
  return top*(1-tz) + bot*tz;
}

// Screen-space projection of a logical (canvas-unit) point through the live 3D camera.
// Returns {x,y,visible} in real CSS pixels relative to the board-wrap container.
let _projForward = null, _projToPoint = null;
function project(cx, cy){
  if(!threeReady || !camera3d) return { x:cx, y:cy, visible:true };
  if(!_projForward){ _projForward = new THREE.Vector3(); _projToPoint = new THREE.Vector3(); }
  const h = terrainHeightAt(cx,cy);
  const {x,z} = canvasUnitToWorldXZ(cx,cy);
  const worldPt = new THREE.Vector3(x, h, z);
  camera3d.getWorldDirection(_projForward);
  _projToPoint.copy(worldPt).sub(camera3d.position);
  const inFront = _projToPoint.dot(_projForward) > 0.01;
  const v = worldPt.project(camera3d);
  return {
    x: (v.x*0.5+0.5)*MAP_VIEW.containerW,
    y: (1-(v.y*0.5+0.5))*MAP_VIEW.containerH,
    visible: inFront && v.z < 1,
  };
}

function updateCameraFromView(){
  if(!camera3d) return;
  const look = canvasUnitToWorldXZ(MAP_VIEW.cx, MAP_VIEW.cy);
  const lookY = terrainHeightAt(MAP_VIEW.cx, MAP_VIEW.cy);
  const span = Math.max(CANVAS_W, CANVAS_H)*WORLD.unitsPerCanvasUnit || 200;
  const dist = (span*0.9)/MAP_VIEW.zoom;
  const camX = look.x + dist*Math.sin(MAP_VIEW.polar)*Math.sin(MAP_VIEW.azimuth);
  const camY = lookY + dist*Math.cos(MAP_VIEW.polar);
  const camZ = look.z + dist*Math.sin(MAP_VIEW.polar)*Math.cos(MAP_VIEW.azimuth);
  camera3d.position.set(camX, camY, camZ);
  camera3d.up.set(0,1,0);
  camera3d.lookAt(look.x, lookY, look.z);
  camera3d.aspect = (MAP_VIEW.containerW||1)/(MAP_VIEW.containerH||1);
  camera3d.near = Math.max(1, dist*0.02);
  camera3d.far = dist + (WORLD.maxY-WORLD.minY) + 8000;
  camera3d.updateProjectionMatrix();
}

function resizeThree(){
  const wrap = document.querySelector('.board-wrap');
  if(!wrap) return;
  const w = wrap.clientWidth, h = wrap.clientHeight;
  if(w<=0 || h<=0) return;
  MAP_VIEW.containerW = w; MAP_VIEW.containerH = h;
  if(renderer3d) renderer3d.setSize(w, h, false);
  const overlay = document.getElementById('board');
  if(overlay){ overlay.width = w; overlay.height = h; }
  updateCameraFromView();
}

function clampMapView(){
  MAP_VIEW.zoom = clamp(MAP_VIEW.zoom, MAP_ZOOM_MIN, MAP_ZOOM_MAX);
  MAP_VIEW.polar = clamp(MAP_VIEW.polar, MAP_POLAR_MIN, MAP_POLAR_MAX);
  const margin = CANVAS_W*0.4;
  MAP_VIEW.cx = clamp(MAP_VIEW.cx, -margin, CANVAS_W+margin);
  MAP_VIEW.cy = clamp(MAP_VIEW.cy, -margin, CANVAS_H+margin*0.6);
}

// Cheap flat-plane ray intersection (no mesh raycast) used for pan-dragging and
// cursor-anchored zoom, where per-mousemove precision against the real terrain
// surface doesn't matter and speed does.
function groundPlaneCanvasUnitAt(px, py){
  if(!camera3d) return null;
  const ndcX = (px/MAP_VIEW.containerW)*2-1;
  const ndcY = -(py/MAP_VIEW.containerH)*2+1;
  const vec = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera3d);
  const dir = vec.sub(camera3d.position).normalize();
  if(Math.abs(dir.y) < 1e-6) return null;
  const t = (WORLD.refY - camera3d.position.y)/dir.y;
  if(t<0) return null;
  const hitX = camera3d.position.x + dir.x*t;
  const hitZ = camera3d.position.z + dir.z*t;
  return { x: (hitX-WORLD.originX)/WORLD.unitsPerCanvasUnit, y: (hitZ-WORLD.originZ)/WORLD.unitsPerCanvasUnit };
}

// Precise mesh raycast, used only for clicks (infrequent enough to afford it).
function terrainCanvasUnitAt(px, py){
  if(!threeReady || !terrainObject3d) return groundPlaneCanvasUnitAt(px,py);
  const ndcX = (px/MAP_VIEW.containerW)*2-1;
  const ndcY = -(py/MAP_VIEW.containerH)*2+1;
  const rc = new THREE.Raycaster();
  rc.setFromCamera({x:ndcX,y:ndcY}, camera3d);
  const hits = rc.intersectObject(terrainObject3d, true);
  if(!hits.length) return groundPlaneCanvasUnitAt(px,py);
  const p = hits[0].point;
  return { x: (p.x-WORLD.originX)/WORLD.unitsPerCanvasUnit, y: (p.z-WORLD.originZ)/WORLD.unitsPerCanvasUnit };
}

// zoom is optional -- when given, it's eased alongside the look-at point (see
// toggleDoubleTapZoom, the only current caller that passes it).
function focusMapOn(cx, cy, zoom){
  mapFocusTarget = { x: cx, y: cy, zoom };
}

function updateMapFocusEase(){
  if(!mapFocusTarget) return;
  MAP_VIEW.cx += (mapFocusTarget.x-MAP_VIEW.cx)*0.15;
  MAP_VIEW.cy += (mapFocusTarget.y-MAP_VIEW.cy)*0.15;
  let zoomSettled = true;
  if(mapFocusTarget.zoom!==undefined){
    MAP_VIEW.zoom += (mapFocusTarget.zoom-MAP_VIEW.zoom)*0.15;
    zoomSettled = Math.abs(mapFocusTarget.zoom-MAP_VIEW.zoom) < 0.01;
  }
  if(Math.hypot(mapFocusTarget.x-MAP_VIEW.cx, mapFocusTarget.y-MAP_VIEW.cy) < 0.5 && zoomSettled) mapFocusTarget = null;
  clampMapView();
  updateCameraFromView();
}

// per user request: double-tap/double-click zooms in on the tapped area; a second
// double-tap/double-click returns to the original default view. groundPlaneCanvasUnitAt is
// the same cheap flat-plane conversion already used for pan-dragging.
let mapDoubleTapZoomed = false;
const MAP_DOUBLETAP_ZOOM_LEVEL = 2.5;
function toggleDoubleTapZoom(pxPixel, pyPixel){
  if(mapDoubleTapZoomed){
    focusMapOn(CANVAS_W/2, CANVAS_H/2, 1);
    mapDoubleTapZoomed = false;
  } else {
    const g = groundPlaneCanvasUnitAt(pxPixel, pyPixel);
    if(!g) return;
    focusMapOn(g.x, g.y, MAP_DOUBLETAP_ZOOM_LEVEL);
    mapDoubleTapZoomed = true;
  }
}

// per user request: long-press on the map places a 擬陣地 while manual placement is
// pending (state.decoyPlacementPending). Shared by mouse and touch input below.
let decoyLongPressTimer = null;
let decoyLongPressX = 0, decoyLongPressY = 0, decoyLongPressMoved = false;
function decoyLongPressStart(clientX, clientY){
  if(!state || !state.decoyPlacementPending) return;
  decoyLongPressX = clientX; decoyLongPressY = clientY; decoyLongPressMoved = false;
  clearTimeout(decoyLongPressTimer);
  decoyLongPressTimer = setTimeout(()=>{
    if(decoyLongPressMoved || !state.decoyPlacementPending) return;
    const el = document.getElementById('board');
    const rect = el.getBoundingClientRect();
    const px = decoyLongPressX-rect.left, py = decoyLongPressY-rect.top;
    const g = threeReady ? terrainCanvasUnitAt(px, py) : {x:px/rect.width*CANVAS_W, y:py/rect.height*CANVAS_H};
    if(g) placeDecoyAt(g.x, g.y);
  }, DECOY_LONGPRESS_MS);
}
function decoyLongPressMove(clientX, clientY){
  if(Math.hypot(clientX-decoyLongPressX, clientY-decoyLongPressY) > DECOY_LONGPRESS_MOVE_TOLERANCE_PX){
    decoyLongPressMoved = true;
    clearTimeout(decoyLongPressTimer);
  }
}
function decoyLongPressEnd(){
  clearTimeout(decoyLongPressTimer);
}

function setupMapControls(){
  // Attached to #board (the topmost overlay canvas) since it visually covers
  // #board3d and would otherwise swallow all pointer events before they reach it.
  const el = document.getElementById('board');
  if(!el) return;
  el.addEventListener('contextmenu', e=>e.preventDefault());

  let mode = null, lastX=0, lastY=0, dragGround=null;
  // per user request: dragging the FEBA line directly orders every alive squad/scout to
  // advance/retreat to match. Only engages on a plain left-button press that starts on the
  // line itself, and only outside other click-driven modes (placement/order-arming) that a
  // stray drag near the line could otherwise interfere with.
  const febaDragEligible = ()=> !state.placementPending && !state.decoyPlacementPending && !state.orderMode;
  el.addEventListener('mousedown', e=>{
    mapDragMoved = false;
    const rect = el.getBoundingClientRect();
    const lx = e.clientX-rect.left, ly = e.clientY-rect.top;
    if(e.button!==2 && febaDragEligible() && hitTestFebaLine(lx, ly)){
      mode = 'feba';
      febaDragX = computeFebaX();
      mapFocusTarget = null;
      return;
    }
    mode = e.button===2 ? 'rotate' : 'pan';
    lastX = e.clientX; lastY = e.clientY;
    mapFocusTarget = null;
    decoyLongPressStart(e.clientX, e.clientY);
    if(mode==='pan'){
      dragGround = groundPlaneCanvasUnitAt(lx, ly);
    }
  });
  window.addEventListener('mousemove', e=>{
    decoyLongPressMove(e.clientX, e.clientY);
    if(!mode) return;
    const dx = e.clientX-lastX, dy = e.clientY-lastY;
    if(Math.abs(dx)>2 || Math.abs(dy)>2) mapDragMoved = true;
    lastX = e.clientX; lastY = e.clientY;
    if(mode==='feba'){
      const rect = el.getBoundingClientRect();
      const g = groundPlaneCanvasUnitAt(e.clientX-rect.left, e.clientY-rect.top);
      if(g) febaDragX = clamp(g.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ASSAULT_LIMIT_X);
    } else if(mode==='rotate'){
      MAP_VIEW.azimuth -= dx*0.006;
      MAP_VIEW.polar = clamp(MAP_VIEW.polar - dy*0.005, MAP_POLAR_MIN, MAP_POLAR_MAX);
      updateCameraFromView();
    } else if(mode==='pan' && dragGround){
      const rect = el.getBoundingClientRect();
      const now = groundPlaneCanvasUnitAt(e.clientX-rect.left, e.clientY-rect.top);
      if(now){
        MAP_VIEW.cx += dragGround.x-now.x;
        MAP_VIEW.cy += dragGround.y-now.y;
        clampMapView();
        updateCameraFromView();
      }
    }
  });
  window.addEventListener('mouseup', ()=>{
    if(mode==='feba' && febaDragX!==null) commitFebaDrag(febaDragX);
    mode = null; dragGround = null; febaDragX = null; decoyLongPressEnd();
  });

  el.addEventListener('wheel', e=>{
    e.preventDefault();
    mapFocusTarget = null;
    const factor = e.deltaY<0 ? 1.12 : 1/1.12;
    MAP_VIEW.zoom = clamp(MAP_VIEW.zoom*factor, MAP_ZOOM_MIN, MAP_ZOOM_MAX);
    clampMapView();
    updateCameraFromView();
  }, {passive:false});

  // per user request: double-click zooms in on the clicked area; a second double-click
  // returns to the original default view (see toggleDoubleTapZoom).
  el.addEventListener('dblclick', e=>{
    const rect = el.getBoundingClientRect();
    toggleDoubleTapZoom(e.clientX-rect.left, e.clientY-rect.top);
  });

  // Single finger = pan (as before). Two fingers = pinch to zoom + twist/
  // vertical-drag to rotate/tilt, mirroring the desktop wheel=zoom and
  // right-drag=rotate gestures.
  let touchMode=null, touchLastX=0, touchLastY=0;
  let pinchStartDist=0, pinchStartZoom=1, twoTouchLastAngle=0, twoTouchLastMidY=0;
  // per user request: manual double-tap detection for toggleDoubleTapZoom (mobile has no
  // native 'dblclick' from two taps, unlike desktop)
  const DOUBLETAP_MAX_INTERVAL_MS = 350, DOUBLETAP_MAX_DIST_PX = 30;
  let lastTapTime = 0, lastTapX = 0, lastTapY = 0;
  const touchMid = touches => ({
    x:(touches[0].clientX+touches[1].clientX)/2,
    y:(touches[0].clientY+touches[1].clientY)/2,
  });
  el.addEventListener('touchstart', e=>{
    mapFocusTarget = null;
    if(e.touches.length===1){
      touchLastX=e.touches[0].clientX; touchLastY=e.touches[0].clientY;
      const rect = el.getBoundingClientRect();
      const lx = touchLastX-rect.left, ly = touchLastY-rect.top;
      if(febaDragEligible() && hitTestFebaLine(lx, ly)){
        touchMode='feba'; mapDragMoved=false;
        febaDragX = computeFebaX();
        return;
      }
      // No preventDefault here: a plain tap (touchstart+touchend with no
      // movement) must still synthesize its native 'click' so unit selection
      // keeps working. touch-action:none on #board (CSS) already stops the
      // browser's native pan/zoom gesture from engaging over the map.
      touchMode='pan'; mapDragMoved=false;
      decoyLongPressStart(touchLastX, touchLastY);
      dragGround = groundPlaneCanvasUnitAt(lx, ly);
    } else if(e.touches.length===2){
      // A second finger means this is a pinch/rotate gesture, never a tap, so
      // it's safe (and necessary, as a fallback if touch-action isn't fully
      // honored) to preventDefault here without risking a lost click.
      e.preventDefault();
      touchMode='pinch'; mapDragMoved=true; dragGround=null;
      const [t0,t1] = e.touches;
      pinchStartDist = Math.hypot(t1.clientX-t0.clientX, t1.clientY-t0.clientY);
      pinchStartZoom = MAP_VIEW.zoom;
      twoTouchLastAngle = Math.atan2(t1.clientY-t0.clientY, t1.clientX-t0.clientX);
      twoTouchLastMidY = touchMid(e.touches).y;
    }
  }, {passive:false});
  el.addEventListener('touchmove', e=>{
    e.preventDefault();
    if(touchMode==='feba' && e.touches.length===1){
      const t = e.touches[0];
      const dx = t.clientX-touchLastX, dy = t.clientY-touchLastY;
      if(Math.abs(dx)>2 || Math.abs(dy)>2) mapDragMoved = true;
      touchLastX = t.clientX; touchLastY = t.clientY;
      const rect = el.getBoundingClientRect();
      const g = groundPlaneCanvasUnitAt(touchLastX-rect.left, touchLastY-rect.top);
      if(g) febaDragX = clamp(g.x, SQUAD_RETREAT_LIMIT_X, SQUAD_ASSAULT_LIMIT_X);
    } else if(touchMode==='pan' && e.touches.length===1){
      decoyLongPressMove(e.touches[0].clientX, e.touches[0].clientY);
      const dx = e.touches[0].clientX-touchLastX, dy = e.touches[0].clientY-touchLastY;
      if(Math.abs(dx)>2 || Math.abs(dy)>2) mapDragMoved = true;
      touchLastX = e.touches[0].clientX; touchLastY = e.touches[0].clientY;
      if(dragGround){
        const rect = el.getBoundingClientRect();
        const now = groundPlaneCanvasUnitAt(touchLastX-rect.left, touchLastY-rect.top);
        if(now){
          MAP_VIEW.cx += dragGround.x-now.x;
          MAP_VIEW.cy += dragGround.y-now.y;
          clampMapView();
          updateCameraFromView();
        }
      }
    } else if(touchMode==='pinch' && e.touches.length===2){
      const [t0,t1] = e.touches;
      const dist = Math.hypot(t1.clientX-t0.clientX, t1.clientY-t0.clientY);
      if(pinchStartDist>10){
        MAP_VIEW.zoom = clamp(pinchStartZoom*(dist/pinchStartDist), MAP_ZOOM_MIN, MAP_ZOOM_MAX);
      }
      const angle = Math.atan2(t1.clientY-t0.clientY, t1.clientX-t0.clientX);
      MAP_VIEW.azimuth += (angle-twoTouchLastAngle);
      twoTouchLastAngle = angle;
      const midY = touchMid(e.touches).y;
      MAP_VIEW.polar = clamp(MAP_VIEW.polar - (midY-twoTouchLastMidY)*0.005, MAP_POLAR_MIN, MAP_POLAR_MAX);
      twoTouchLastMidY = midY;
      clampMapView();
      updateCameraFromView();
    }
  }, {passive:false});
  el.addEventListener('touchend', e=>{
    decoyLongPressEnd();
    if(e.touches.length===1){
      // Dropping from two fingers to one: resume panning from the remaining
      // finger's current position instead of snapping/jumping.
      touchMode='pan'; mapDragMoved=true;
      touchLastX=e.touches[0].clientX; touchLastY=e.touches[0].clientY;
      const rect = el.getBoundingClientRect();
      dragGround = groundPlaneCanvasUnitAt(touchLastX-rect.left, touchLastY-rect.top);
    } else if(e.touches.length===0){
      const wasFeba = touchMode==='feba';
      if(wasFeba && febaDragX!==null) commitFebaDrag(febaDragX);
      touchMode=null; dragGround=null; febaDragX=null;
      if(!wasFeba && !mapDragMoved && e.changedTouches && e.changedTouches.length){
        const ct = e.changedTouches[0];
        const now = performance.now();
        const dist = Math.hypot(ct.clientX-lastTapX, ct.clientY-lastTapY);
        if(now-lastTapTime < DOUBLETAP_MAX_INTERVAL_MS && dist < DOUBLETAP_MAX_DIST_PX){
          const rect = el.getBoundingClientRect();
          toggleDoubleTapZoom(ct.clientX-rect.left, ct.clientY-rect.top);
          lastTapTime = 0;
        } else {
          lastTapTime = now; lastTapX = ct.clientX; lastTapY = ct.clientY;
        }
      }
    }
  });
  window.addEventListener('resize', resizeThree);
}

function makeMarkerMesh3d(shape, colorHex){
  let geo;
  const s = ()=> Math.max(0.6, WORLD.unitsPerCanvasUnit*10);
  if(shape==='cone') geo = new THREE.ConeGeometry(s()*0.55, s()*1.3, 8);
  else if(shape==='diamond') geo = new THREE.OctahedronGeometry(s()*0.7);
  else if(shape==='box') geo = new THREE.BoxGeometry(s()*0.9, s()*0.7, s()*0.9);
  else if(shape==='cylinder') geo = new THREE.CylinderGeometry(s()*0.5, s()*0.5, s()*1.1, 10);
  else geo = new THREE.SphereGeometry(s()*0.6, 10, 8);
  const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness:0.7, metalness:0.05 });
  const mesh = new THREE.Mesh(geo, mat);
  return mesh;
}

function getMarker3d(key, shape, colorHex){
  let m = unitMarkers3d[key];
  if(!m){
    m = makeMarkerMesh3d(shape, colorHex);
    scene3d.add(m);
    unitMarkers3d[key] = m;
  }
  return m;
}
function hideMarker3d(key){
  const m = unitMarkers3d[key];
  if(m) m.visible = false;
}
// per user request: a destroyed target's marker was only ever hidden (visible=false),
// never actually removed -- since target IDs keep climbing across a long session
// (esp. with drones spawning continuously), unitMarkers3d/scene3d grew without bound.
// This fully tears the mesh down so the slot doesn't linger forever once its target is gone.
function disposeMarker3d(key){
  const m = unitMarkers3d[key];
  if(!m) return;
  if(scene3d) scene3d.remove(m);
  if(m.geometry) m.geometry.dispose();
  if(m.material) m.material.dispose();
  delete unitMarkers3d[key];
}

const FRIENDLY_MARK_COLOR_3D = 0x6f9bbf;
function syncUnitMarkers3d(){
  if(!threeReady || !state) return;
  const seen = {};
  const place = (key, cx, cy, shape, colorHex, visible)=>{
    seen[key] = true;
    if(!visible){ hideMarker3d(key); return; }
    const m = getMarker3d(key, shape, colorHex);
    const h = terrainHeightAt(cx, cy);
    const {x,z} = canvasUnitToWorldXZ(cx, cy);
    m.position.set(x, h + WORLD.unitsPerCanvasUnit*6, z);
    m.visible = true;
  };

  // per user request: friendly symbols unified to blue on the 3D minimap
  place('hq', state.hq.x, state.hq.y, 'box', state.hq.hp>0 ? FRIENDLY_MARK_COLOR_3D : 0x5c2a25, true);
  // per user request: mortar/scout/squad/sniper now have their own 2D icon image drawn on
  // the overlay canvas (see drawUnitIcon in drawBoard()) -- the old 3D primitive mesh for
  // each (cone/diamond/box/cylinder) was showing through behind/around that icon, so it's
  // hidden here instead of placed.
  state.mortars.forEach((m,i)=>{ seen['mortar'+i]=true; hideMarker3d('mortar'+i); });
  state.scouts.forEach((s,i)=>{ seen['scout'+i]=true; hideMarker3d('scout'+i); });
  state.squads.forEach((sq,i)=>{ seen['squad'+i]=true; hideMarker3d('squad'+i); });
  state.snipers.forEach((sn,i)=>{ seen['sniper'+i]=true; hideMarker3d('sniper'+i); });
  state.targets.forEach((t,i)=>{
    const key = 'target'+t.id;
    if(t.destroyed){ place(key, t.trueX, t.trueY, 'sphere', 0x5c2a25, false); return; }
    if(!isTargetDetected(t)){ place(key, 0, 0, 'sphere', 0, false); return; }
    const eLogical = estPos(t);
    const e = smoothVisualPos(t, eLogical.x, eLogical.y);
    const shape = t.type==='vehicle' ? 'box' : t.type==='artillery' ? 'cylinder' : t.type==='drone' ? 'diamond' : 'sphere';
    place(key, e.x, e.y, shape, t.revealed ? (TARGET_TYPE_COLOR[t.type]||0xc1453b) : 0x8f9678, true);
  });

  Object.keys(unitMarkers3d).forEach(key=>{
    if(!seen[key]) hideMarker3d(key);
  });
}

// per user request: enemy symbols unified to red on the 3D minimap too
const TARGET_TYPE_COLOR = { infantry:0xc1453b, artillery:0xc1453b, vehicle:0xc1453b, drone:0xc1453b };

function renderThreeFrame(){
  if(!threeReady || !renderer3d) return;
  updateMapFocusEase();
  syncUnitMarkers3d();
  renderer3d.render(scene3d, camera3d);
}

function render(){
  updateRevealed();
  renderStats();
  selectNextTarget();
  renderDecisionPanel();
  renderCommandBox();
  renderEnemyCommandBox();
  renderDecoyCommandBox();
  drawBoard();
}

function closeDecoyCommandBox(){
  state.decoyCommandBox = null;
  render();
}
function assignMortarFireAtDecoy(idx){
  const mortar = state.mortars[idx];
  const decoyIdx = state.decoyCommandBox;
  const d = state.decoys[decoyIdx];
  if(!mortar || mortar.hp<=0 || !d || d.destroyed) return;
  if(mortar.order==='fire' && mortar.pendingFire && mortar.pendingFire.decoyIdx===decoyIdx){
    mortar.pendingFire = null;
    mortar.order = 'standby';
    log('fdc','FDC', `迫撃砲${idx+1}、擬陣地への攻撃指示を解除。`);
    render();
    return;
  }
  mortar.pendingFire = {x:d.x, y:d.y, snappedId:null, decoyIdx};
  mortar.order = 'fire';
  mortar.pendingDest = null;
  log('fdc','FDC', `迫撃砲${idx+1}、擬陣地${decoyIdx+1}周辺へ座標既知の精密射撃を指示。`);
  render();
}
// per user request: selecting a 擬陣地 lets the player choose which mortar fires on its
// exact (known) coordinates, and pick shell/fuze per mortar -- reuses updateFireConfig(),
// the same function the mortar's own panel uses for its shell/fuze dropdowns.
function renderDecoyCommandBox(){
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

function loop(){
  updateProjectiles();
  updateEnemyTracers();
  if(state) drawBoard();
  renderThreeFrame();
  requestAnimationFrame(loop);
}

document.getElementById('board').addEventListener('click', handleCanvasClick);
loadAchievements();
renderAudioSettingsPanel();
initGame();
initThree();
setupMapControls();
loop();
