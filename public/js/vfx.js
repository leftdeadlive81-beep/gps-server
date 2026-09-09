// Split out of the former monolithic mortar_fdc_game.js.
import { unlockAchievement } from './achievements.js';
import { playSfx } from './audio.js';
import { state } from './combat.js';
import { ARC_HEIGHT, ENEMY_MARK_COLOR, EXPLOSION_SFX_MIN_GAP_MS, MAP_VIEW, MAX_DEBRIS_PARTICLES, MAX_EFFECTS_3D, MAX_IMPACT_LIGHTS, MUZZLE_STYLE } from './constants.js';
import { canvasUnitToWorldXZ, project, scene3d, terrainHeightAt } from './three.js';
import { clamp, rnd } from './utils.js';
import { speakRandomAliveUnit } from './voice.js';

export let ripples = [];

export let projectiles = [];

export let flashes = [];

export let enemyTracers = [];

export function fireTracer(startX, startY, endX, endY, duration, weaponType){
  const wt = weaponType || 'rifle';
  const now = performance.now();
  enemyTracers.push({startX, startY, endX, endY, born:now, duration, weaponType:wt});
  const st = MUZZLE_STYLE[wt] || MUZZLE_STYLE.rifle;
  flashes.push({x:startX, y:startY, born:now, life:st.life, muzzle:true, weaponType:wt});
  spawn3dMuzzleFlash(startX, startY, wt);
}

export let debrisParticles = [];

export let wreckSmokes = [];

export let killBanners = [];

export let weatherParticles = [];

export let weatherParticleKind = null;

export function ensureWeatherParticles(w, h){
  const kind = state && state.weather;
  if(kind === weatherParticleKind) return;
  weatherParticleKind = kind;
  weatherParticles = [];
  if(kind === 'rain'){
    for(let i=0;i<90;i++) weatherParticles.push({x:Math.random()*w, y:Math.random()*h, len:rnd(10,22), speed:rnd(9,15)});
  } else if(kind === 'fog'){
    for(let i=0;i<14;i++) weatherParticles.push({x:Math.random()*w, y:Math.random()*h, r:rnd(30,70), speed:rnd(0.15,0.4), alpha:rnd(0.03,0.07)});
  }
}

export let shockwaves = [];

export let impactLights = [];

export let effects3d = [];

export function effectWorldPosition(x, y, lift){
  const pos = canvasUnitToWorldXZ(x, y);
  return new THREE.Vector3(pos.x, terrainHeightAt(x, y)+(lift||0), pos.z);
}

export function disposeEffect3d(effect){
  if(scene3d) scene3d.remove(effect.group);
  effect.group.traverse(child=>{
    if(child.geometry) child.geometry.dispose();
    if(child.material) child.material.dispose();
  });
}

export function addEffect3d(group, born, life, update){
  if(!scene3d) return;
  scene3d.add(group);
  effects3d.push({group, born, life, lastUpdate:born, update});
  while(effects3d.length > MAX_EFFECTS_3D) disposeEffect3d(effects3d.shift());
}

export function spawn3dMuzzleFlash(x, y, weaponType){
  if(typeof THREE === 'undefined' || !scene3d) return;
  const p = effectWorldPosition(x, y, 18);
  const group = new THREE.Group();
  const color = weaponType==='drone' ? 0xff7048 : weaponType==='cannon' ? 0xffc15d : 0xffe0a0;
  const core = new THREE.Mesh(
    new THREE.SphereGeometry((weaponType==='cannon'?16:10), 8, 6),
    new THREE.MeshBasicMaterial({color, transparent:true})
  );
  group.add(core);
  group.position.copy(p);
  addEffect3d(group, performance.now(), weaponType==='cannon'?180:110, (e,t)=>{
    const scale = 1 + t*2.5;
    e.group.scale.set(scale, scale, scale);
    core.material.opacity = 1-t;
  });
}

export function spawn3dImpactEffect(x, y, kind){
  if(typeof THREE === 'undefined' || !scene3d) return;
  const p = effectWorldPosition(x, y, kind==='smoke' ? 8 : 4);
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(8, 13, 20),
    new THREE.MeshBasicMaterial({color:kind==='smoke'?0x8b927d:0xffb45d, transparent:true, side:THREE.DoubleSide})
  );
  ring.rotation.x = -Math.PI/2;
  group.add(ring);
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(kind==='smoke'?18:13, 8, 6),
    new THREE.MeshBasicMaterial({color:kind==='smoke'?0x7b8274:0xff7b35, transparent:true})
  );
  core.position.y = 10;
  group.add(core);
  for(let i=0;i<6;i++){
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(3.5, 6, 5),
      new THREE.MeshBasicMaterial({color:0xffd18a, transparent:true})
    );
    spark.userData.v = new THREE.Vector3(rnd(-55,55), rnd(35,95), rnd(-55,55));
    group.add(spark);
  }
  group.position.copy(p);
  const life = kind==='smoke' ? 1800 : 650;
  addEffect3d(group, performance.now(), life, (e,t,dt)=>{
    ring.scale.setScalar(1+t*8);
    ring.material.opacity = (1-t)*0.8;
    core.scale.setScalar(1+t*1.5);
    core.material.opacity = (1-t)*0.8;
    e.group.children.slice(2).forEach(spark=>{
      spark.position.addScaledVector(spark.userData.v, dt/1000);
      spark.userData.v.y -= 130*dt/1000;
      spark.material.opacity = 1-t;
    });
    if(kind==='smoke') e.group.rotation.y += dt*0.0004;
  });
}

export function spawn3dProjectile(startX, startY, endX, endY, duration){
  if(typeof THREE === 'undefined' || !scene3d) return;
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(5, 8, 6),
    new THREE.MeshBasicMaterial({color:0xffd38a, transparent:true})
  );
  group.add(mesh);
  const born = performance.now();
  addEffect3d(group, born, duration, (e,t)=>{
    const x = startX+(endX-startX)*t;
    const y = startY+(endY-startY)*t;
    e.group.position.copy(effectWorldPosition(x, y, 35+Math.sin(t*Math.PI)*100));
    mesh.material.opacity = 0.95;
  });
}

export function update3dEffects(){
  if(!effects3d.length) return;
  const now = performance.now();
  effects3d = effects3d.filter(effect=>{
    const elapsed = now-effect.born;
    if(elapsed >= effect.life){ disposeEffect3d(effect); return false; }
    effect.update(effect, elapsed/effect.life, Math.min(50, now-effect.lastUpdate));
    effect.lastUpdate = now;
    return true;
  });
}

export function spawnImpactLight(x, y){
  if(typeof THREE === 'undefined' || !scene3d) return;
  if(impactLights.length >= MAX_IMPACT_LIGHTS){
    const oldest = impactLights.shift();
    scene3d.remove(oldest.light);
  }
  const {x:wx, z:wz} = canvasUnitToWorldXZ(x, y);
  const wy = terrainHeightAt(x, y) + 40; // above ground so it doesn't clip into the terrain mesh
  const baseIntensity = 6;
  const light = new THREE.PointLight(0xffb060, baseIntensity, 900, 2);
  light.position.set(wx, wy, wz);
  scene3d.add(light);
  impactLights.push({light, born:performance.now(), life:450, baseIntensity});
}

export function updateImpactLights(){
  if(!impactLights.length) return;
  const now = performance.now();
  impactLights = impactLights.filter(l=>{
    const t = (now-l.born)/l.life;
    if(t>=1){ scene3d && scene3d.remove(l.light); return false; }
    l.light.intensity = l.baseIntensity*(1-t);
    return true;
  });
}

export let shakeStartedAt = 0, shakeDurationMs = 0, shakeMag = 0;

export function triggerShake(mag, durationMs){
  if(mag <= shakeMag && performance.now() < shakeStartedAt+shakeDurationMs) return;
  shakeStartedAt = performance.now();
  shakeDurationMs = durationMs;
  shakeMag = mag;
}

export function currentShakeOffset(){
  const t = performance.now() - shakeStartedAt;
  if(t < 0 || t > shakeDurationMs) return {x:0, y:0};
  const amt = shakeMag * (1 - t/shakeDurationMs);
  return { x:(Math.random()*2-1)*amt, y:(Math.random()*2-1)*amt };
}

export function projectileArcWorldY(startX, startY, endX, endY, prog){
  const h0 = terrainHeightAt(startX, startY), h1 = terrainHeightAt(endX, endY);
  return h0 + (h1-h0)*prog + Math.sin(prog*Math.PI)*ARC_HEIGHT;
}

export function tracerWorldY(startX, startY, endX, endY, prog){
  const h0 = terrainHeightAt(startX, startY), h1 = terrainHeightAt(endX, endY);
  return h0 + (h1-h0)*prog;
}

export function onTargetDestroyed(t){
  unlockAchievement('firstBlood');
  if(t.type==='artillery') unlockAchievement('mortarHunter');
  speakRandomAliveUnit('morale');
  spawnDestructionEffect(t.trueX, t.trueY, `${t.def.label} 撃破!`, ENEMY_MARK_COLOR);
}

export let lastExplosionSfxAt = -Infinity;

export function spawnDestructionEffect(x, y, label, color){
  const born = performance.now();
  if(born - lastExplosionSfxAt > EXPLOSION_SFX_MIN_GAP_MS){
    lastExplosionSfxAt = born;
    playSfx('explosion', 0.325);
  }
  flashes.push({x, y, born, life:800, big:true});
  flashes.push({x, y, born: born+130, life:650, big:true});
  shockwaves.push({x, y, born, life:520});
  spawnImpactLight(x, y);
  spawn3dImpactEffect(x, y, 'explosion');
  // screen shake, scaled by how close the impact lands to screen center -- full strength near
  // the middle of the view, fading to none past ~420px so an explosion off in a corner of a
  // wide-angle view doesn't jolt the whole screen.
  const sp = project(x, y);
  if(sp.visible){
    // project() returns pixels in the actual on-screen container space (MAP_VIEW.containerW/H,
    // set from the board canvas's real CSS size in resizeThree()) -- NOT CANVAS_W/CANVAS_H,
    // which are the logical 1300x460 world-unit space -- so the center must use the same space.
    const distFromCenter = Math.hypot(sp.x-MAP_VIEW.containerW/2, sp.y-MAP_VIEW.containerH/2);
    const near = clamp(1 - distFromCenter/420, 0, 1);
    if(near > 0) triggerShake(7*near, 260);
  }
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

export function updateProjectiles(){
  const now = performance.now();
  projectiles = projectiles.filter(p=>{
    const prog = (now-p.born)/p.duration;
    if(prog >= 1){
      flashes.push({x:p.endX, y:p.endY, born:now, life:400});
      spawn3dImpactEffect(p.endX, p.endY, 'impact');
      p.onLand();
      return false;
    }
    return true;
  });
  flashes = flashes.filter(f => now - f.born < f.life);
}

export function updateEnemyTracers(){
  const now = performance.now();
  enemyTracers = enemyTracers.filter(tr=>{
    const prog = (now-tr.born)/tr.duration;
    if(prog >= 1){
      flashes.push({x:tr.endX, y:tr.endY, born:now, life:350});
      spawn3dImpactEffect(tr.endX, tr.endY, 'impact');
      return false;
    }
    return true;
  });
}


export function resetAllVfx(){
  ripples = []; projectiles = []; flashes = []; enemyTracers = [];
  debrisParticles = []; wreckSmokes = []; killBanners = []; shockwaves = [];
  impactLights.forEach(l=>scene3d && scene3d.remove(l.light)); impactLights = [];
}
export function setShockwaves(v){ shockwaves = v; }
export function setDebrisParticles(v){ debrisParticles = v; }
export function setWreckSmokes(v){ wreckSmokes = v; }
export function setKillBanners(v){ killBanners = v; }
export function setRipples(v){ ripples = v; }

Object.assign(window, { fireTracer, ensureWeatherParticles, effectWorldPosition, disposeEffect3d, addEffect3d, spawn3dMuzzleFlash, spawn3dImpactEffect, spawn3dProjectile, update3dEffects, spawnImpactLight, updateImpactLights, triggerShake, currentShakeOffset, projectileArcWorldY, tracerWorldY, onTargetDestroyed, spawnDestructionEffect, updateProjectiles, updateEnemyTracers, resetAllVfx, setShockwaves, setDebrisParticles, setWreckSmokes, setKillBanners, setRipples });
