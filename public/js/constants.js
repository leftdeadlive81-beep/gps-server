// Split out of the former monolithic mortar_fdc_game.js.
import { loadAudioSettings } from './audio.js';
import { roundRobinDistribute, state, unitAlive, unitAliveCount } from './combat.js';
import { buildGridLineSegments } from './terrain.js';
import { kmhToUnitsPerTurn } from './utils.js';

export const GAME_VERSION = '0.2';

export const CANVAS_W = 2600, CANVAS_H = 1040;

export const OP_HOME_X = 180, OP_HOME_Y = CANVAS_H/2;

export const OP = {x: OP_HOME_X, y: OP_HOME_Y};

export const HQ_X = 60, HQ_Y = CANVAS_H/2;

export const HQ_MAX_HP = 200;

export const HQ_COVER_EXPOSURE_BONUS = 20;

export const HQ_COVER_EXPOSURE_CAP = 90;

export const HQ_REPAIR_HP_PER_CALL = 20;

export const HQ_REPAIR_COST_PER_HP = 50;

export const EXPOSURE_DEFAULT = 50;

export const SCOUT_EXPOSURE = 74;

export const SCOUT_X = 460;

export const SCOUT_UPPER_Y = 55;

export const SCOUT_LOWER_Y = 405;

export const INITIAL_DEPLOY_SPACING_MULT = 1.4;

export const PRICE_EQUIP = {armor:1200, optics:1000, extMag:800};

export const REINFORCE_COST_PER_SOLDIER = 220;

export const REINFORCE_MAX_PER_CALL = 2;

export const REST_DURATION_TURNS = 120;

export const VET_XP_PER_LEVEL = 3;

export const VET_MAX_LEVEL = 5;

export const VET_DMG_BONUS_PER_LEVEL = 0.04;

export const VET_EXPOSURE_BONUS_PER_LEVEL = 5;

export const ACHIEVEMENTS = {
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

export const WEATHER_TYPES = {
  clear: {label:'晴天', dispersionMult:1,    counterMult:1,    errMult:1,    tint:null,                desc:'視界良好、影響なし'},
  rain:  {label:'雨天', dispersionMult:1.35, counterMult:0.85, errMult:1.1,  tint:'rgba(90,130,170,0.10)', desc:'着弾散布拡大、敵反撃精度低下'},
  fog:   {label:'濃霧', dispersionMult:1.15, counterMult:0.8,  errMult:1.35, tint:'rgba(160,170,150,0.14)', desc:'索敵誤差拡大、双方視界不良'},
  night: {label:'夜間', dispersionMult:1.2,  counterMult:0.7,  errMult:1.2,  tint:'rgba(10,15,35,0.28)',    desc:'敵反撃頻度低下、照準精度も低下'},
};

export const EQUIP_LABEL = {armor:'強化装甲', optics:'精密照準器', extMag:'予備弾倉'};

export const FRIENDLY_INF_POS = {x: 700, y: CANVAS_H/2};

export const SNIPER_POS = {x: 290, y: CANVAS_H/2};

export const STAGE_COUNT = 50;

export const PRICE_HE = 35;

export const PRICE_HEAT = 70;

export const PRICE_FUZE = 800;

export const AMMO_PACK = 5;

export const DIFFICULTIES = {
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

export const ENEMY_MARK_COLOR = '#c1453b';

export const FRIENDLY_MARK_COLOR = '#6f9bbf';

export const LABEL_TEXT_COLOR = '#e8e3ce';

export const TARGET_TYPES = {
  infantry:  {label:'歩兵',         hp:60,  radius:26, mark:ENEMY_MARK_COLOR},
  artillery: {label:'砲兵',         hp:100, radius:16, mark:ENEMY_MARK_COLOR},
  vehicle:   {label:'装甲車',       hp:95,  radius:18, mark:ENEMY_MARK_COLOR},
  drone:     {label:'ドローン',     hp:12,  radius:20, mark:ENEMY_MARK_COLOR},
  heli:      {label:'戦闘ヘリ',     hp:150, radius:22, mark:ENEMY_MARK_COLOR},
  // per user request: enemy anti-air -- a dedicated, stationary ground unit that specifically
  // hunts the friendly heli (see resolveEnemyAntiAir()) rather than joining the generic
  // ground-engagement roll in enemyCounterAttack (same treatment as 'heli' itself, which is
  // excluded there and handled by its own resolveHeliAssault).
  aa:        {label:'対空',         hp:80,  radius:16, mark:ENEMY_MARK_COLOR},
  // per user request: a fixed, hardened objective placed deep in enemy territory --
  // destroying it clears the wave immediately regardless of how many other enemies remain
  // (see checkEnd()), a high-risk/high-reward alternative to grinding out every target. Its
  // much higher base HP (scaled by the same hpMult every other type gets) and low base
  // exposure (see buildEnemyHqTarget/ENEMY_HQ_EXPOSURE -- bunkered) make it meaningfully
  // tougher than any single normal target, on top of not sharing any type's AI behavior
  // (it never moves, advances, or counter-attacks -- see enemyCounterAttack's explicit skip).
  hq:        {label:'敵本部',       hp:400, radius:20, mark:ENEMY_MARK_COLOR},
};

export const DRONE_INTRO_STAGE = 3;

export const CONTOUR_LEVELS = [0.25, 0.5, 0.75, 1.0, 1.25];

export const CONTOUR_CELL = 22;

export const SHELLS = {he:'榴弾(HE)', heat:'対戦車榴弾(HEAT)', smoke:'発煙弾', marker:'マーカー弾', illum:'照明弾'};

export const FUZES  = {impact:'着発信管', proximity:'近接信管', delay:'遅延信管'};

export const COUNTER_CHANCE = {infantry:0.06, artillery:0.22, vehicle:0.05, drone:0.04};

export const COUNTER_DAMAGE = {infantry:[8,18], artillery:[30,50], vehicle:[10,18], drone:[4,10]};

export const VEHICLE_ASSAULT_RANGE = 100;

export const VEHICLE_ASSAULT_DAMAGE = [20,36];

export const DRONE_SPEED = 70;

export const DRONE_DETONATE_RANGE = 38;

export const DRONE_DETONATE_DAMAGE = [16,32];

export const INFANTRY_DRONE_LAUNCH_CHANCE = 0.16/3;

export const INFANTRY_DRONE_COOLDOWN_TICKS = 3;

export const INFANTRY_DRONE_SWARM_SIZE = [5, 8];

export const HELI_EXPOSURE = 65;

export const HELI_ENGAGE_RANGE = 260;

export const HELI_WITHDRAW_DIST = 380;

export const HELI_ATTACK_BURST = 2;

// per user request (correction of an earlier request that had the direction backwards):
// firing interval shortened, not lengthened (was 5, briefly 50) -- 1 turn between attack
// passes is the fastest the heli can re-engage under this turn-based cooldown.
export const HELI_COOLDOWN_TICKS = 1;

export const HELI_ATTACK_DAMAGE = [18, 34];

// per user request: enemy anti-air -- engagement range mirrors the friendly SAM's
// (SAM_ENGAGE_RANGE) for symmetry. Fires often (short cooldown, once-per-turn-crossing gate
// like every other discrete attack roll in this game) and hits hard -- a dedicated system, not
// incidental ground fire.
export const AA_ENGAGE_RANGE = 715;

export const AA_ATTACK_DAMAGE = [16, 30];

export const AA_COOLDOWN_TICKS = 2;

export const MINE_DAMAGE = [16,36];

export const MINE_PLACEMENT_CHANCE = 0.12;

export const MINE_MAX_ACTIVE = 4;

export const MERGE_HP_THRESHOLD = 0.4;

export const INFANTRY_DUEL_DMG_TO_ENEMY = [4,9];

export const SQUAD_SIZE = 10;

export const NUM_SQUADS = 4;

export const SCOUT_SQUAD_SIZE = 5;

export const NUM_SCOUTS = 3;

export const SNIPER_SQUAD_SIZE = 5;

export const NUM_SNIPERS = 3;

export const MORTAR_CREW_SIZE = 5;

export const NUM_MORTARS = 4;

export const NUM_TANKS = 2;

export const TANK_MAX_HP = 220;

export const TANK_POS = {x: 320, y: CANVAS_H/2};

export const TANK_EXPOSURE = 65;

export const TANK_ENGAGE_RANGE = 325;

export const TANK_DUEL_DMG_TO_ENEMY = [18, 32];

export const TANK_INCOMING_DMG = [8, 20];

export const TANK_REPAIR_HP_PER_CALL = 30;

export const TANK_REPAIR_COST_PER_HP = 40;

export const NUM_SAMS = 1;

export const SAM_MAX_HP = 70;

export const SAM_POS = {x: 200, y: CANVAS_H/2 + 120};

export const SAM_EXPOSURE = 45;

export const SAM_ENGAGE_RANGE = 715;

export const SAM_DUEL_DMG_TO_ENEMY = [45, 75];

export const SAM_REPAIR_HP_PER_CALL = 20;

export const SAM_REPAIR_COST_PER_HP = 50;

export const NUM_ENGINEERS = 1;

export const ENGINEER_SQUAD_SIZE = 6;

export const ENGINEER_POS = {x: 260, y: CANVAS_H/2};

export const RESERVE_SIZE = 10;

export const MAX_DECOYS = 5;

export const DECOY_MAX_HP = 50;

export const DECOY_LURE_MULT_DAY = 0.6;

export const DECOY_LURE_MULT_NIGHT = 0.3;

export const DECOY_LONGPRESS_MS = 550;

export const DECOY_LONGPRESS_MOVE_TOLERANCE_PX = 10;

export const WALL_RADIUS = 22;

export const WALL_MAX_HP = 140;

export const WALL_BUILD_COST = 900;

export const MAX_WALLS = 6;

export const WALL_AVOID_PENALTY = 10;

export const TRENCH_BUILD_COST = 500;

export const TRENCH_RADIUS = 20;

export const TRENCH_COVER_BONUS = 25;

export const MAX_TRENCHES = 6;

export const TRENCH_LINE_COLOR = 'rgba(139,105,60,0.9)';

export const TRENCH_LINE_WIDTH = 3;

export const PERSONNEL_ROSTER = [
  {rank:'1等陸尉', name:'佐藤'},
  {rank:'2等陸尉', name:'鈴木'},
  {rank:'3等陸尉', name:'高橋'},
  {rank:'3等陸尉', name:'田中'},
  {rank:'1等陸曹', name:'伊藤'},
  {rank:'1等陸曹', name:'渡辺'},
  {rank:'1等陸曹', name:'山本'},
  {rank:'1等陸曹', name:'中村'},
  {rank:'2等陸曹', name:'小林'},
  {rank:'2等陸曹', name:'加藤'},
  {rank:'2等陸曹', name:'吉田'},
  {rank:'2等陸曹', name:'山田'},
  {rank:'2等陸曹', name:'佐々木'},
  {rank:'2等陸曹', name:'山口'},
  {rank:'3等陸曹', name:'松本'},
  {rank:'3等陸曹', name:'井上'},
  {rank:'3等陸曹', name:'木村'},
  {rank:'3等陸曹', name:'林'},
  {rank:'3等陸曹', name:'斎藤'},
  {rank:'3等陸曹', name:'清水'},
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
  // per user request: 工兵小隊を追加。既存の roundRobinDistribute はこの配列をきっちり100名分
  // (既存4兵科+予備)で使い切っていたため、工兵の枠を追加するには新規に人員を足す必要がある
  // (足さずに重みだけ増やすと他部隊の人数が静かに削られてしまう)。
  {rank:'3等陸尉', name:'岩崎'},
  {rank:'1等陸曹', name:'木下'},
  {rank:'2等陸曹', name:'野口'},
  {rank:'2等陸曹', name:'工藤'},
  {rank:'3等陸曹', name:'今村'},
  {rank:'陸士長', name:'柴田'},
];

export const [ROSTER_MORTAR_POOL, ROSTER_SCOUT_POOL, ROSTER_SNIPER_POOL, ROSTER_SQUAD_POOL, ROSTER_ENGINEER_POOL, ROSTER_RESERVE_INITIAL] =
  roundRobinDistribute(PERSONNEL_ROSTER, [
    MORTAR_CREW_SIZE*NUM_MORTARS, SCOUT_SQUAD_SIZE*NUM_SCOUTS, SNIPER_SQUAD_SIZE*NUM_SNIPERS,
    SQUAD_SIZE*NUM_SQUADS, ENGINEER_SQUAD_SIZE*NUM_ENGINEERS, RESERVE_SIZE,
  ]);

export const ROSTER_MORTAR_CREWS = roundRobinDistribute(ROSTER_MORTAR_POOL, Array(NUM_MORTARS).fill(MORTAR_CREW_SIZE));

export const ROSTER_SCOUT_TEAMS  = roundRobinDistribute(ROSTER_SCOUT_POOL, Array(NUM_SCOUTS).fill(SCOUT_SQUAD_SIZE));

export const ROSTER_SNIPER_TEAMS = roundRobinDistribute(ROSTER_SNIPER_POOL, Array(NUM_SNIPERS).fill(SNIPER_SQUAD_SIZE));

export const ROSTER_ENGINEER_TEAMS = roundRobinDistribute(ROSTER_ENGINEER_POOL, Array(NUM_ENGINEERS).fill(ENGINEER_SQUAD_SIZE));

export const ROSTER_SQUADS = roundRobinDistribute(ROSTER_SQUAD_POOL, Array(NUM_SQUADS).fill(SQUAD_SIZE));

export const FORMATION_OFFSETS = [
  {dx:-24,dy:-14},{dx:-8,dy:-16},{dx:8,dy:-16},{dx:24,dy:-14},{dx:-16,dy:-2},
  {dx:16,dy:-2},{dx:-24,dy:12},{dx:-8,dy:14},{dx:8,dy:14},{dx:24,dy:12},
];

export const SCOUT_FORMATION_OFFSETS = [
  {dx:-14,dy:-8},{dx:0,dy:-12},{dx:14,dy:-8},{dx:-8,dy:9},{dx:8,dy:9},
];

export const SNIPER_FORMATION_OFFSETS = [
  {dx:-14,dy:-8},{dx:0,dy:-12},{dx:14,dy:-8},{dx:-8,dy:9},{dx:8,dy:9},
];

export const SCOUT_ADVANCE_LIMIT_X = 2200;

export const SQUAD_RETREAT_LIMIT_X = 300;

export const SQUAD_ADVANCE_LIMIT_X = 1240;

export const SQUAD_ASSAULT_LIMIT_X = 2300;

export const FEBA_MIN_X = SQUAD_RETREAT_LIMIT_X;

export const FEBA_MAX_X = SQUAD_ASSAULT_LIMIT_X;

export const FEBA_LINE_COLOR = 'rgba(50,130,255,0.95)';

export const FEBA_LINE_WIDTH = 4;

export const SQUAD_ENGAGE_RANGE = 100;

export const MAP_WIDTH_KM = 20;

export const METERS_PER_UNIT = (MAP_WIDTH_KM*1000) / CANVAS_W;

export const SQUAD_ANTI_DRONE_RANGE_M = 200;

export const SQUAD_ANTI_DRONE_RANGE_UNITS = SQUAD_ANTI_DRONE_RANGE_M / METERS_PER_UNIT;

// per user request: infantry closing on infantry (a squad on "assault" order walking straight
// at the nearest enemy infantry group's exact position) must stop at least this far out --
// units should never end up standing on top of each other.
export const INFANTRY_STANDOFF_M = 200;

export const INFANTRY_STANDOFF_UNITS = INFANTRY_STANDOFF_M / METERS_PER_UNIT;

export const SQUAD_ANTI_DRONE_HIT_CHANCE = 0.65;

export const SQUAD_ANTI_DRONE_DMG = [8,16];

export const SNIPER_RANGE_UNITS = SQUAD_ENGAGE_RANGE * 3;

export const SNIPER_RANGE_M = Math.round(SNIPER_RANGE_UNITS * METERS_PER_UNIT);

export const SNIPER_AIM_RANGE_M = 2000;

export const SNIPER_AIM_RANGE_UNITS = SNIPER_AIM_RANGE_M / METERS_PER_UNIT;

export const SNIPER_AIM_LINE_WIDTH_M = 20;

export const SNIPER_AIM_LINE_WIDTH_UNITS = SNIPER_AIM_LINE_WIDTH_M / METERS_PER_UNIT;

export const SNIPER_DMG = [20,32];

export const SNIPER_EXECUTE_HP_THRESHOLD = 0.3;

export const MORTAR_MAINLINE_RANGE_M = 6000;

export const MORTAR_MAINLINE_RANGE_UNITS = MORTAR_MAINLINE_RANGE_M / METERS_PER_UNIT;

export const MORTAR_MAINLINE_HALF_FOV = 15;

export const SCOUT_MAX_RANGE_UNITS = 700 / METERS_PER_UNIT;

export const HELI_MAX_RANGE_UNITS = 1000 / METERS_PER_UNIT;

// per user request: the enemy HQ (unlike every other target) starts hidden and is only
// revealed once a friendly unit gets close enough to spot it -- scouts/helis use their own
// (longer) SCOUT_MAX_RANGE_UNITS/HELI_MAX_RANGE_UNITS sensor range for this, while every other
// friendly unit type (not a dedicated recon asset) only spots it at this shorter range.
export const HQ_DETECT_RANGE_M = 300;

export const HQ_DETECT_RANGE_UNITS = HQ_DETECT_RANGE_M / METERS_PER_UNIT;

// per user request: any friendly unit within this range of the enemy HQ (or that just hit it
// with mortar fire from further out, see findHqDefenseThreat()) becomes the enemy's top
// priority -- nearby enemy infantry redirect to engage it instead of their normal advance.
export const HQ_DEFENSE_RANGE_M = 3000;

export const HQ_DEFENSE_RANGE_UNITS = HQ_DEFENSE_RANGE_M / METERS_PER_UNIT;

// per user request: a mortar strike that hits the enemy HQ marks the firing mortar as a
// priority threat for this long, even if the mortar itself sits well outside
// HQ_DEFENSE_RANGE_UNITS (mortars can fire from up to MORTAR_MAX_RANGE_UNITS away).
export const HQ_DEFENSE_ATTACKER_WINDOW_MS = 15000;

// per user request: enemy fire against the current HQ-defense threat hits harder
// ("全力で攻撃" -- attacking with full force), on top of redirecting nearby infantry to
// converge on it.
export const HQ_DEFENSE_DMG_MULT = 1.6;

// per user request: enemy AI coordinates fire -- whichever friendly asset one attacker
// actually lands a hit on becomes the group's shared "focus target" for this long, so other
// nearby attackers (within their own normal engagement range) pile onto the same target
// instead of each independently picking their own nearest. See enemyCounterAttack().
export const ENEMY_FOCUS_FIRE_WINDOW_MS = 10000;

export const ROAD_SPEED_KMH = {vehicle:60, infantry:10, sniper:5, scout:12, mortar:40, artillery:5};

export const OFF_ROAD_SPEED_MULT = 0.7;

export const GAME_START_DATETIME = new Date(2033, 4, 7, 8, 0, 0);

export const VEHICLE_MOVE_CAP = kmhToUnitsPerTurn(ROAD_SPEED_KMH.vehicle);

export const INFANTRY_MOVE_CAP = kmhToUnitsPerTurn(ROAD_SPEED_KMH.infantry);

export const SNIPER_MOVE_CAP = kmhToUnitsPerTurn(ROAD_SPEED_KMH.sniper);

export const SCOUT_MOVE_CAP = kmhToUnitsPerTurn(ROAD_SPEED_KMH.scout);

export const MORTAR_MOVE_CAP = kmhToUnitsPerTurn(ROAD_SPEED_KMH.mortar) * 0.25;

export const TANK_MOVE_CAP = VEHICLE_MOVE_CAP * 0.6;

export const SAM_MOVE_CAP = VEHICLE_MOVE_CAP * 0.4;

export const HELI_MOVE_CAP = VEHICLE_MOVE_CAP * 1.8;

export const FRIENDLY_HELI_MOVE_UNITS = HELI_MOVE_CAP * 0.8;

export const ARTILLERY_MOVE_CAP = kmhToUnitsPerTurn(ROAD_SPEED_KMH.artillery) * 0.5;

export const ARTILLERY_STANDOFF_RANGE_M = 300;

export const ARTILLERY_STANDOFF_RANGE_UNITS = ARTILLERY_STANDOFF_RANGE_M / METERS_PER_UNIT;

// per user request: matches the friendly mortar's 6km max range (MORTAR_MAX_RANGE_M) -- was
// 5000m.
export const ARTILLERY_FIRE_RANGE_M = 6000;

export const ARTILLERY_FIRE_RANGE_UNITS = ARTILLERY_FIRE_RANGE_M / METERS_PER_UNIT;

export const KM_UNIT = 1000 / METERS_PER_UNIT;

export const ENEMY_SPAWN_RANGE_M = 1500;

export const ENEMY_SPAWN_RANGE_UNITS = ENEMY_SPAWN_RANGE_M / METERS_PER_UNIT;

export const ENEMY_SPAWN_MARGIN = 25;

export const ENEMY_SPAWN_MIN_X = CANVAS_W - ENEMY_SPAWN_RANGE_UNITS;

export const ENEMY_SPAWN_MAX_X = CANVAS_W - ENEMY_SPAWN_MARGIN;

export const SHELL_KILL_RADIUS_M = {he:100, heat:40};

export const SHELL_KILL_RADIUS_UNITS = {
  he: SHELL_KILL_RADIUS_M.he / METERS_PER_UNIT,
  heat: SHELL_KILL_RADIUS_M.heat / METERS_PER_UNIT,
};

export const SMOKE_RADIUS_M = 60;

export const SMOKE_RADIUS_UNITS = SMOKE_RADIUS_M / METERS_PER_UNIT;

export const SMOKE_DURATION_TURNS = 3;

export const ILLUM_RADIUS_M = 200;

export const ILLUM_RADIUS_UNITS = ILLUM_RADIUS_M / METERS_PER_UNIT;

export const ILLUM_DURATION_TURNS = 3;

export const ILLUM_BURST_HEIGHT = 130;

export const ILLUM_FALL_DURATION = 3000;

export const MARKER_REVEAL_RADIUS_UNITS = 200 / METERS_PER_UNIT;

export const MINE_TRIGGER_RADIUS_M = 20;

export const MINE_TRIGGER_RADIUS_UNITS = MINE_TRIGGER_RADIUS_M / METERS_PER_UNIT;

export const ROAD_NODE_SNAP_RADIUS_M = 60;

export const ROAD_NODE_SNAP_RADIUS_UNITS = ROAD_NODE_SNAP_RADIUS_M / METERS_PER_UNIT;

export const MORTAR_DISPERSION_M = 60;

export const MORTAR_DISPERSION_UNITS = MORTAR_DISPERSION_M / METERS_PER_UNIT;

export const MORTAR_MIN_RANGE_M = 150;

export const MORTAR_MIN_RANGE_UNITS = MORTAR_MIN_RANGE_M / METERS_PER_UNIT;

// per user request: mortar max range fixed at 6km for both sides (a future arms-dealer
// "booster shell" purchase is meant to extend this later -- not implemented yet).
export const MORTAR_MAX_RANGE_M = 6000;

export const MORTAR_MAX_RANGE_UNITS = MORTAR_MAX_RANGE_M / METERS_PER_UNIT;

// per user request: relocating a mortar now takes real time on both ends -- 10s after the
// move order before it actually breaks position and starts moving (packing up), and another
// 10s after arriving at the new position before it can fire again (setting up).
export const MORTAR_MOVE_START_DELAY_MS = 10000;

export const MORTAR_FIRE_READY_DELAY_MS = 10000;

// per user request: nothing spawns in the first 8s of a wave, then the rest of the enemy
// roster trickles in one at a time (randomized spawnAt within the window) instead of all
// appearing at once, finishing within 3 minutes of wave start. See startStage()/
// processSpawnQueue() in combat.js. The enemy HQ is exempt -- it's a fixed structure that
// already exists, just hidden until detected (see updateHqDetection()), not a spawning unit.
export const WAVE_SPAWN_DELAY_MS = 8000;

export const WAVE_SPAWN_WINDOW_MS = 180000;

// per user request: the enemy HQ isn't just a passive objective -- it's armed with 2 mortar
// tubes (indirect, same MORTAR_MAX_RANGE_UNITS reach as every mortar) and 3 tank guns (direct
// fire, same TANK_ENGAGE_RANGE as a friendly tank duel), each engaging the nearest friendly
// asset independently. See resolveEnemyHqAttack() in combat.js.
export const HQ_MORTAR_COUNT = 2;

export const HQ_MORTAR_DAMAGE = [30, 50];

export const HQ_MORTAR_COOLDOWN_TICKS = 8;

export const HQ_TANKGUN_COUNT = 3;

export const HQ_TANKGUN_DAMAGE = [18, 32];

export const HQ_TANKGUN_COOLDOWN_TICKS = 2;

export const SHELL_DISPERSION_MULT = {heat:0.6};

export const MORTAR_CB_SHOTS_THRESHOLD = 3;

export const MORTAR_CB_DETECT_BASE = 0.3;

export const MORTAR_CB_WARN_TURNS = 2;

export const MORTAR_CB_STRIKE_DMG = [56, 84];

// per user request: overall game pace halved -- each tier's interval doubled (so the same
// relative slow/normal/fast ratios still hold, just twice as long between simulation steps).
export const GAME_SPEED_INTERVALS = { slow: 4000, normal: 2000, fast: 1000 };

export const GAME_SPEED_LABEL = { slow: '0.5x', normal: '1x', fast: '2x' };

export const GAME_SPEED_ORDER = ['slow', 'normal', 'fast'];

export const MORTAR_RELOAD_MS = 650;

// per user request (correction of an earlier request that had the direction backwards):
// firing interval shortened, not lengthened -- was {squad:3, tank:4, sam:3, sniper:5} turns
// between shots. Every value here divided by 10 rounds below 1, and 1 (fire every eligible
// turn) is the fastest rate the turn-based unitMayFire() modulo can express, so that's the
// floor for all four -- this is "as fast as the simulation's turn granularity allows".
export const WEAPON_FIRE_INTERVAL = { squad:1, tank:1, sam:1, sniper:1 };

export const WEAPON_FIRE_OFFSET = { squad:0, tank:1, sam:2, sniper:3 };

export const SIM_STEP_MS = 100;

export const SIM_STEP_MAX_CATCHUP = 5;

export const SUPPRESSION_TURNS = 3;

export const SUPPRESSION_NEARMISS_TURNS = 1;

export const SUPPRESSION_COUNTER_MULT = 0.3;

export const SUPPRESSION_DUEL_DMG_BONUS = 1.5;

export const SUPPRESSION_CASUALTY_MULT = 0.4;

export const SUPPRESSION_MOVE_MULT = 0.5;

export const SUPPRESSION_RETREAT_CHANCE = 0.35;

export const FLANK_OFFSET_RANGE_UNITS = 160;

export const STANDING_ORDER_LABEL = {
  contact_hold: '接敵時: 防御',
  contact_assault: '接敵時: 突撃',
  low_hp_retreat: '損耗50%で後退',
};

export const FRIENDLY_SPACING_RADIUS = 34;

export const FRIENDLY_SPACING_PUSH = 8;

export const ANOMALOUS_JUMP_UNITS = 400;

export const ENEMY_FORMATION_TEMPLATES = {
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

export const ENEMY_FORMATION_NAMES = Object.keys(ENEMY_FORMATION_TEMPLATES);

export const SOLDIER_FORMATION_SCALE = 1.4;

export const ENEMY_FORMATION_BASE_SIZE = 6;

export const ENEMY_INFANTRY_TOTAL_TARGET = 50;

export const ENEMY_INFANTRY_DOCTRINES = [
  {id:'assault', label:'強襲', speedMult:1.12, flankOffset:0, contactRangeMult:1},
  {id:'flank', label:'側面', speedMult:0.96, flankOffset:1, contactRangeMult:1},
  {id:'support', label:'支援', speedMult:0.82, flankOffset:0.45, contactRangeMult:1.45},
];

export const ORDER_LABEL = {advance:'前進', retreat:'後退', hold:'防御', assault:'突撃', hunt:'追跡攻撃', resting:'大休止'};

export const MORTAR_ORDER_LABEL = {fire:'射撃', standby:'待機', move:'移動'};

export const ORDER_ICON = {advance:'▲', retreat:'▼', hold:'■', assault:'◆', hunt:'◎', resting:'Z'};

export const MORTAR_ORDER_ICON = {fire:'●', standby:'■', move:'✦'};

export const MORTAR_ZONE_MIN_X = 40, MORTAR_ZONE_MAX_X = 380;

export const MORTAR_BEST_LOADOUT = {
  infantry:  {shell:'he',   fuze:'proximity', count:3},
  vehicle:   {shell:'heat', fuze:'impact',    count:2},
  artillery: {shell:'he',   fuze:'impact',    count:2},
  drone:     {shell:'he',   fuze:'proximity', count:2},
  hq:        {shell:'he',   fuze:'delay',     count:3},
};

export const MUZZLE_STYLE = {
  rifle:   {color:'255,235,180', scale:1,   life:120},
  cannon:  {color:'255,225,150', scale:2.2, life:170},
  missile: {color:'255,210,140', scale:1.6, life:150},
  heli:    {color:'255,190,150', scale:1.4, life:130},
  drone:   {color:'255,120,90',  scale:1.1, life:110},
};

export const MAX_IMPACT_LIGHTS = 6;

// per user request: every hit (not just a kill) should feel punchier -- a graze under
// HIT_EFFECT_MIN_DMG only gets a small flash (no shockwave/light/shake, to avoid nonstop
// background noise from routine small-arms chip damage); anything at or above
// HIT_EFFECT_HEAVY_DMG (mortar/tank/artillery-caliber) gets the full "heavy" treatment plus a
// brief hit-stop (HIT_STOP_MS) for extra weight. See spawnHitEffect() in vfx.js.
export const HIT_EFFECT_MIN_DMG = 6;

export const HIT_EFFECT_HEAVY_DMG = 25;

export const HIT_STOP_MS = 70;

export const MAX_EFFECTS_3D = 80;

export const infantryIcon = new Image();

infantryIcon.src = 'icons/infant.png';

export const mortarIcon = new Image();

mortarIcon.src = 'icons/mortar.png';

export const enemyInfantryIcon = new Image();

enemyInfantryIcon.src = 'icons/e-infant.png';

export const SFX_SRC = {
  combat: 'audio/combat.mp3',
  explosion: 'audio/explosion.mp3',
  mortarFire: 'audio/mortar_fire.mp3',
  identify: 'audio/identify.mp3',
  fanfare: 'audio/fanfare.mp3',
};

export const BGM_TRACKS = ['audio/bgm.mp3', 'audio/bgm2.mp3'];

export const bgmAudio = new Audio();

bgmAudio.loop = true;

bgmAudio.volume = 0.175;

export const combatAudio = new Audio(SFX_SRC.combat);

combatAudio.loop = true;

combatAudio.volume = 0.2;

export const audioSettings = loadAudioSettings();

export const FLIGHT_DURATION = 1400;

export const LAUNCH_INTERVAL = 420;

export const ARC_HEIGHT = 700;

export const MAP_SEED_CANDIDATE_COUNT = 3;

export const DEPLOYMENT_MODES = {
  auto:   {label:'自動配置', sub:'既定の隊形で各ユニットを自動的に展開する'},
  manual: {label:'手動配置', sub:'地図をクリックして全ユニットの初期位置を1つずつ指定する'},
};

export const DECOY_MODES = {
  auto:   {label:'自動設置', sub:`最大${MAX_DECOYS}箇所の擬陣地を自動配置する`},
  manual: {label:'手動設置', sub:`地図を長押しして最大${MAX_DECOYS}箇所を自分で指定する`},
};

export const MAP_SEED_THUMB_W = 150, MAP_SEED_THUMB_H = 53;

export const ENEMY_HQ_EXPOSURE = 15;

export const DEPLOY_BOX_METERS = 2000;

export const ESTIMATE_CLAMP_MARGIN = 20;

export const REAL_ROADS_CANVAS = [];

export const ROAD_PULL_RADIUS = 140;

export const TERRAIN_SLOPE_PENALTY = 4;

export const STEP_ANGLE_OFFSETS = [0, -0.26,0.26, -0.52,0.52, -0.79,0.79];

export const SCOUT_TERRAIN_SPEED_PENALTY = 2.2;

export const SCOUT_TERRAIN_MIN_SPEED_MULT = 0.35;

export const TERRAIN_COVER_SAMPLE_RADIUS = 40;

export const TERRAIN_COVER_SAMPLE_COUNT = 8;

export const TERRAIN_COVER_RANGE = 20;

export const TERRAIN_COVER_RELIEF_SATURATION = 0.15;

export const LAST_STAND_THRESHOLD = 3;

export const MAX_DEBRIS_PARTICLES = 140;

export const MAX_CRATERS = 90;

export const EXPLOSION_SFX_MIN_GAP_MS = 90;

// per user request: the Radio Log drawer (and its LOG_MAX_ENTRIES cap) is gone -- replaced by
// a ticker of important events (see announceTicker() in ui.js), capped at this many entries.
export const TICKER_MAX_ENTRIES = 12;

export const SMART_UNIT_TYPES = {
  mortar: {label:'迫撃砲', list:()=>state.mortars, isAlive:m=>m.hp>0, nameOf:i=>`迫撃砲${i+1}`},
  // per user request: 大休止中のユニットはスマート操作の選択リストにも出さない(命令を一切
  // 受け付けないため)。
  scout:  {label:'斥候',   list:()=>state.scouts,  isAlive:s=>unitAliveCount(s)>0 && !s.resting, nameOf:i=>`斥候${i+1}`},
  squad:  {label:'小隊',   list:()=>state.squads,  isAlive:sq=>sq.soldiers.some(s=>s.alive) && !sq.resting, nameOf:i=>`第${i+1}小隊`},
  sniper: {label:'狙撃',   list:()=>state.snipers, isAlive:sn=>sn.soldiers.some(s=>s.alive) && !sn.resting, nameOf:i=>`狙撃${i+1}班`},
  tank:   {label:'戦車',   list:()=>state.tanks,   isAlive:tk=>tk.hp>0, nameOf:i=>`戦車${i+1}`},
  sam:    {label:'対空',   list:()=>state.sams,    isAlive:sam=>sam.hp>0, nameOf:i=>`対空${i+1}`},
};

export const SMART_ACTIONS = {
  mortar: [
    {key:'fire_target', label:'攻撃(目標選択)', kind:'target'},
    {key:'move', label:'移動', kind:'map'},
    {key:'standby', label:'待機', kind:'instant'},
  ],
  scout: [
    {key:'move', label:'移動', kind:'map'},
  ],
  squad: [
    {key:'advance', label:'前進', kind:'instant'},
    {key:'hold', label:'防御', kind:'instant'},
    {key:'assault', label:'突撃', kind:'instant'},
    {key:'retreat', label:'後退', kind:'instant'},
    {key:'move', label:'移動(精密指定)', kind:'map'},
    {key:'hunt_target', label:'攻撃目標指定', kind:'target'},
    {key:'spread', label:'間隔をとれ', kind:'instant'},
    {key:'mass', label:'密集せよ', kind:'instant'},
  ],
  sniper: [
    {key:'advance', label:'前進', kind:'instant'},
    {key:'hold', label:'防御', kind:'instant'},
    {key:'retreat', label:'後退', kind:'instant'},
    {key:'move', label:'移動(精密指定)', kind:'map'},
    {key:'snipe_target', label:'狙撃目標指定', kind:'target'},
  ],
  tank: [
    {key:'advance', label:'前進', kind:'instant'},
    {key:'hold', label:'防御', kind:'instant'},
    {key:'retreat', label:'後退', kind:'instant'},
    {key:'move', label:'移動(精密指定)', kind:'map'},
    {key:'hunt_target', label:'攻撃目標指定', kind:'target'},
  ],
  sam: [
    {key:'advance', label:'前進', kind:'instant'},
    {key:'hold', label:'防御', kind:'instant'},
    {key:'retreat', label:'後退', kind:'instant'},
    {key:'move', label:'移動(精密指定)', kind:'map'},
    {key:'hunt_target', label:'攻撃目標指定', kind:'target'},
  ],
};

export const SQUAD_FORMATION_ADJUST_M = 50;

export const FRIENDLY_KIND_LIST = [
  { kind:'scout',    list:()=>state.scouts,    alive:u=>unitAlive(u),                label:i=>`斥候${i+1}` },
  { kind:'mortar',   list:()=>state.mortars,   alive:u=>u.hp>0,                       label:i=>`迫撃砲${i+1}` },
  { kind:'heli',     list:()=>state.helis||[], alive:u=>u.hp>0,                      label:i=>`ヘリ${i+1}` },
  { kind:'tank',     list:()=>state.tanks,     alive:u=>u.hp>0,                       label:i=>`戦車${i+1}` },
  { kind:'sam',      list:()=>state.sams,      alive:u=>u.hp>0,                       label:i=>`対空${i+1}` },
  { kind:'squad',    list:()=>state.squads,    alive:u=>u.soldiers.some(s=>s.alive),  label:i=>`第${i+1}小隊` },
  { kind:'sniper',   list:()=>state.snipers,   alive:u=>u.soldiers.some(s=>s.alive),  label:i=>`狙撃${i+1}班` },
  { kind:'engineer', list:()=>state.engineers, alive:u=>u.soldiers.some(s=>s.alive),  label:()=>'工兵小隊' },
];

export const TARGET_GRID_CELL_SIZE = 200;

export const TARGET_GRID_MAX_RINGS = 12;

export const STEP_RENDER_MIN_INTERVAL_MS = 150;

export const WAVE_CLEAR_EFFECT_WAIT_MS = 1900;

export const WAVE_CLEAR_FANFARE_HOLD_MS = 2000;

export const DIRECT_MOVE_KINDS = ['squad','tank','sam','hq'];

export const MULTI_SELECT_KINDS = ['squad','tank','sam','sniper','engineer'];

export const MULTI_SELECT_ORDER_SETTER = {
  squad: (idx, order)=>{ if(state.squads[idx] && !state.squads[idx].resting) state.squads[idx].order = order; },
  tank: (idx, order)=>{ if(state.tanks[idx]) state.tanks[idx].order = order; },
  sam: (idx, order)=>{ if(state.sams[idx]) state.sams[idx].order = order; },
  sniper: (idx, order)=>{ if(state.snipers[idx] && !state.snipers[idx].resting) state.snipers[idx].order = order; },
  engineer: (idx, order)=>{ if(state.engineers[idx] && !state.engineers[idx].resting) state.engineers[idx].order = order; },
};

export const COMBAT_CALLOUTS = {
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

export const CALLOUT_DURATION_MS = 4000;

export const CALLOUT_OCCURRENCE_CHANCE = 0.5;

export const RANK_ABBR = {
  '1等陸佐':'1佐', '2等陸佐':'2佐', '3等陸佐':'3佐',
  '1等陸曹':'1曹', '2等陸曹':'2曹', '3等陸曹':'3曹',
  '准陸曹':'准曹',
  '陸曹長':'曹長',
  '1等陸曹':'1曹', '2等陸曹':'2曹', '3等陸曹':'3曹',
  '陸士長':'士長',
  '1等陸士':'1士', '2等陸士':'2士',
};

export const CONTOUR_LINES_CANVAS = [];

export const GRID_MINOR_SPACING_UNITS = 100/METERS_PER_UNIT;

export const GRID_MAJOR_EVERY = 10;

export const GRID_LINE_SEGMENT = CONTOUR_CELL;

export const GRID_LINES = buildGridLineSegments();

export const MAP_INITIAL_AZIMUTH = (window.innerWidth||0) <= 600 ? -Math.PI/2 : 0;

export const MAP_VIEW = {
  cx: CANVAS_W/2, cy: CANVAS_H/2,      // look-at point, in canvas-unit space
  zoom: 1, azimuth: MAP_INITIAL_AZIMUTH, polar: 0.82, // lower cinematic angle gives the battlefield a longer horizon and stronger depth
  containerW: 1, containerH: 1,
};

export const MAP_ZOOM_MIN = 0.35, MAP_ZOOM_MAX = 9;

// per user request: virtual joystick (next to the minimap) for panning the main combat map
// without dragging the board itself. Base pan speed in canvas units/sec at zoom 1, scaled by
// sqrt(zoom) (same relationship cameraHeightForZoom uses) so screen-space pan speed stays
// roughly constant across zoom levels rather than crawling when zoomed out.
export const JOYSTICK_PAN_SPEED = 500;

// max knob travel from the base's center, in CSS px -- see renderJoystickKnob() in input.js.
export const JOYSTICK_MAX_KNOB_PX = 24;

export const MAP_POLAR_MIN = 0.12, MAP_POLAR_MAX = 1.45;

export const MAP_DETAIL_LABEL_ZOOM = 0.72;

export const MAP_FULL_DETAIL_ZOOM = 1.05;

export const MAP_DETAIL_EFFECT_ZOOM = 0.58;

export const WALK_ANIM_DETAIL_ZOOM = 0.78;

export const WALK_ANIM_MIN_INTERVAL_MS = 140;

export const PROC_TERRAIN_HEIGHT_SCALE = 110 * METERS_PER_UNIT;

export const WORLD = {
  originX: 0, originZ: 0, scaleX: METERS_PER_UNIT, scaleZ: METERS_PER_UNIT,
  minY: 0, maxY: PROC_TERRAIN_HEIGHT_SCALE*1.3, refY: PROC_TERRAIN_HEIGHT_SCALE*0.65,
};

export const unitMarkers3d = {};

export const TERRAIN_TEXTURE_BRIGHTNESS = 0.55;

export const PROC_TEXTURE_SIZE_X = 1040, PROC_TEXTURE_SIZE_Z = 416;

export const PROC_COLOR_LOW = [0x4a,0x52,0x36], PROC_COLOR_HIGH = [0x9a,0x8f,0x66];

export const PROC_COLOR_FOREST = [0x23,0x38,0x1e], PROC_COLOR_WATER = [0x2c,0x4a,0x5e];

export const PROC_CANOPY_CELL = 22, PROC_CANOPY_DARK = [0x16,0x24,0x12], PROC_CANOPY_LIGHT = [0x36,0x52,0x2c];

export const PROC_CLEARING_CELL = 24, PROC_CLEARING_EDGE0 = 0.82, PROC_CLEARING_EDGE1 = 0.9, PROC_CLEARING_COLOR = [0xb3,0x8a,0x66];

export const PROC_OPEN_MOTTLE_CELL = 40, PROC_OPEN_MOTTLE_AMOUNT = 40;

export const PROC_DRY_PATCH_CELL = 60, PROC_DRY_PATCH_EDGE0 = 0.58, PROC_DRY_PATCH_EDGE1 = 0.72, PROC_DRY_PATCH_COLOR = [0x8c,0x7a,0x4c];

export const PROC_TEXTURE_NOISE_COARSE_CELL = 55, PROC_TEXTURE_NOISE_COARSE_AMOUNT = 22;

export const PROC_TEXTURE_NOISE_FINE_CELL = 12, PROC_TEXTURE_NOISE_FINE_AMOUNT = 12;

export const PROC_MESH_SEGMENTS_X = 90, PROC_MESH_SEGMENTS_Z = 72;

export const SKY_COLOR = 0x2b3440;

export const SHADOW_FRUSTUM_HALF = 900;

export const SUN_OFFSET = {x:800, y:950, z:450};

export const TERRAIN_ARCHETYPES = {
  hills:  { label:'丘陵地帯', hillCount:[4,6], hillHeight:[0.5,0.85],  hillRadius:[90,180],  river:false, forestPatches:[3,5] },
  river:  { label:'河川地帯', hillCount:[2,3], hillHeight:[0.3,0.55],  hillRadius:[100,200], river:true,  forestPatches:[2,4] },
  forest: { label:'森林地帯', hillCount:[2,4], hillHeight:[0.25,0.5],  hillRadius:[90,160],  river:false, forestPatches:[5,8] },
  urban:  { label:'市街地',   hillCount:[1,2], hillHeight:[0.15,0.3],  hillRadius:[80,140],  river:false, forestPatches:[1,2] },
};

export const RIVER_VALLEY_DEPTH = 0.15;

export const TERRAIN_TYPE_OPEN = 0, TERRAIN_TYPE_FOREST = 1, TERRAIN_TYPE_WATER = 2;

export const TERRAIN_TYPE_COVER_BONUS = { [TERRAIN_TYPE_FOREST]: 12, [TERRAIN_TYPE_WATER]: -8 };

export const TERRAIN_TYPE_SPEED_MULT = { [TERRAIN_TYPE_FOREST]: 0.7, [TERRAIN_TYPE_WATER]: 0.35 };

export const MAP_DOUBLETAP_ZOOM_LEVEL = 2.5;

export const SQUAD_GRID_OFFSETS = Array.from({length:SQUAD_SIZE}, (_,i)=>{
  const col = i%5, row = Math.floor(i/5);
  return {dx:(col-2)*10, dy:(row-0.5)*14};
});

export const WALK_CYCLE_SPEED = 6.5;

export const WALK_SWING_MAX = 0.55;

export const WALK_AMP_EASE = 6;

export const FRIENDLY_MARK_COLOR_3D = 0x6f9bbf;

export const HELI_FLIGHT_ALTITUDE = PROC_TERRAIN_HEIGHT_SCALE * 0.35;

export const TARGET_TYPE_COLOR = { infantry:0xc1453b, artillery:0xc1453b, vehicle:0xc1453b, drone:0xc1453b };
