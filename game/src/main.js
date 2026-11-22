// Velvet Hour: boot, the fixed-step loop, the screens, and the thief's own actions — moving,
// sneaking, throwing coins, lifting loot and the Star, and slipping out of the hatch. Guard
// minds live in guards.js, sight and light in vision.js, drawing in render.js; this file is
// the conductor. It also stages the screenshot scenes behind ?shot=cover|nearmiss|coin|star:
// each poses a real mid-heist moment from a real level state, paints it, and sets
// window.__shotReady — the frames in screenshots/ are renders of this code, nothing else.

import { LEVELS, solidsOf } from './levels.js';
import { createGuards, updateGuards, guardsHear } from './guards.js';
import { circleHits, insideAny, lightAt } from './vision.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer, viewFor,
  SCREEN_CAUGHT, SCREEN_CLEAR, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN,
} from './render.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const WALK_SPEED = 178;
const SNEAK_SPEED = 96;
const COINS_PER_VAULT = 3;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const audio = createAudio();
const input = createInput(canvas);

function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

// ---------------------------------------------------------------- state
let screen = SCREEN_TITLE;
let state = null;
let clearT = 0;
let totals = { time: 0, loot: 0, alarms: 0 };

function loadLevel(index) {
  const level = LEVELS[index];
  state = {
    levelIndex: index,
    level,
    solids: solidsOf(level),
    lanterns: level.lanterns,
    player: {
      x: level.start.x, y: level.start.y, r: 12, angle: -Math.PI / 2,
      sneaking: false, moving: false, noiseR: 0, onCreak: false,
      hideMul: 1, hiddenTag: false, stepT: 0,
    },
    guards: createGuards(level),
    coins: [],
    coinsLeft: COINS_PER_VAULT,
    coinsTotal: COINS_PER_VAULT,
    loot: level.loot.map((p) => ({ x: p.x, y: p.y, taken: false })),
    lootTaken: 0,
    hasStar: false,
    alarm: false,
    lastSeen: null,
    sinceSeen: 0,
    anySeeing: false,
    time: 0,
    tGlobal: 0,
    hint: null,
    hintT: 0,
    particles: [],
    notesOn: false,
    nextText: '',
    totalTime: totals.time,
    totalLoot: totals.loot,
    alarms: totals.alarms,
  };
}

function burst(x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random() * 0.7);
    state.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 12,
      life: 0.55, maxLife: 0.55, color, size: 2 + Math.random() * 2,
    });
  }
}

function setHint(text, seconds = 2.6) {
  state.hint = text;
  state.hintT = seconds;
}

// ---------------------------------------------------------------- the thief
function updatePlayer(dt) {
  const p = state.player;
  const level = state.level;
  const dir = input.direction();
  p.sneaking = input.sneaking();
  p.moving = dir.x !== 0 || dir.y !== 0;
  if (p.moving) {
    const len = Math.hypot(dir.x, dir.y);
    const speed = p.sneaking ? SNEAK_SPEED : WALK_SPEED;
    const nx = p.x + (dir.x / len) * speed * dt;
    const ny = p.y + (dir.y / len) * speed * dt;
    if (!circleHits(nx, p.y, p.r, state.solids)) p.x = nx;
    if (!circleHits(p.x, ny, p.r, state.solids)) p.y = ny;
    p.angle = Math.atan2(dir.y, dir.x);
  }
  p.onCreak = insideAny(p.x, p.y, level.creak ?? []);
  const inGrass = insideAny(p.x, p.y, level.grass ?? []);
  p.hideMul = inGrass ? (p.sneaking ? 0.12 : 0.5) : 1;

  // Noise: walking is heard, sneaking is not — except on creaky boards, which always talk.
  p.noiseR = 0;
  if (p.moving) {
    if (p.onCreak) p.noiseR = p.sneaking ? 95 : 135;
    else if (!p.sneaking) p.noiseR = 115;
  }
  if (p.noiseR > 0) {
    // guardsHear adds the cone's fringe to its radius; hand it the bare floor radius.
    guardsHear(state, p.x, p.y, p.noiseR - 61, null);
    p.stepT -= dt;
    if (p.stepT <= 0) {
      p.stepT = p.sneaking ? 0.5 : 0.33;
      audio.step(0, 0.35, p.sneaking);
    }
  }

  // The Star.
  if (!state.hasStar && Math.hypot(p.x - level.star.x, p.y - level.star.y) < 28) {
    state.hasStar = true;
    audio.chime();
    burst(level.star.x, level.star.y, '#ffe066', 16, 90);
    setHint('The Star is yours — reach the EXIT hatch, unseen');
  }
  // Loose valuables.
  for (const item of state.loot) {
    if (!item.taken && Math.hypot(p.x - item.x, p.y - item.y) < 24) {
      item.taken = true;
      state.lootTaken += 1;
      totals.loot += 1;
      burst(item.x, item.y, '#ffd76a', 7, 55);
    }
  }
  // The hatch.
  const e = level.exit;
  if (p.x > e.x && p.x < e.x + e.w && p.y > e.y && p.y < e.y + e.h) {
    if (state.hasStar) {
      screen = SCREEN_CLEAR;
      clearT = 2.4;
      const next = LEVELS[state.levelIndex + 1];
      state.nextText = next ? `${next.name} — ${next.sub}` : '';
      status.textContent = 'Vault cleared.';
    } else if (state.hintT <= 0) {
      setHint('The hatch is locked — steal the Star first');
    }
  }
}

function updateCoins(dt) {
  for (const coin of state.coins) {
    if (coin.landed) continue;
    coin.t += dt;
    const k = Math.min(1, coin.t / 0.38);
    coin.x = coin.x0 + (coin.tx - coin.x0) * k;
    coin.y = coin.y0 + (coin.ty - coin.y0) * k;
    coin.h = Math.sin(k * Math.PI) * 46;
    if (k >= 1) {
      coin.landed = true;
      coin.h = 0;
      const pan = Math.max(-1, Math.min(1, (coin.x - state.player.x) / 320));
      audio.clink(pan);
      guardsHear(state, coin.x, coin.y, 280, 'What was that?');
    }
  }
}

function throwCoin(point) {
  if (state.coinsLeft <= 0) {
    setHint('No coins left in this vault');
    return;
  }
  if (circleHits(point.x, point.y, 5, state.solids)) return;
  state.coinsLeft -= 1;
  state.coins.push({
    x0: state.player.x, y0: state.player.y, x: state.player.x, y: state.player.y,
    tx: point.x, ty: point.y, t: 0, h: 0, landed: false,
  });
}

function updateParticles(dt) {
  state.particles = state.particles.filter((dot) => {
    dot.x += dot.vx * dt;
    dot.y += dot.vy * dt;
    dot.vy += 26 * dt;
    dot.life -= dt;
    return dot.life > 0;
  });
}

function handleGuardEvents(events) {
  for (const event of events) {
    if (event.type === 'alarm') {
      audio.sting();
      totals.alarms += 1;
      setHint('The alarm is up — break line of sight and hide', 3);
    } else if (event.type === 'caught') {
      screen = SCREEN_CAUGHT;
      status.textContent = 'Caught.';
    } else if (event.type === 'gstep') {
      const g = event.guard;
      const d = Math.hypot(g.x - state.player.x, g.y - state.player.y);
      if (d < 460) {
        const pan = Math.max(-1, Math.min(1, (g.x - state.player.x) / 300));
        audio.step(pan, 0.85 * (1 - d / 460), false);
      }
    }
  }
}

function stepPlay(dt) {
  state.time += dt;
  totals.time += dt;
  state.totalTime = totals.time;
  state.totalLoot = totals.loot;
  state.alarms = totals.alarms;
  if (state.hintT > 0) {
    state.hintT -= dt;
    if (state.hintT <= 0) state.hint = null;
  }
  updatePlayer(dt);
  if (screen !== SCREEN_PLAY) return; // the hatch may have ended the vault mid-step
  updateCoins(dt);
  handleGuardEvents(updateGuards(state, dt));
  const p = state.player;
  const inGrass = insideAny(p.x, p.y, state.level.grass ?? []);
  p.hiddenTag = (inGrass && p.sneaking) || (!state.anySeeing && lightAt(p.x, p.y, state.level.lanterns) < 0.42);
  updateParticles(dt);
}

// ---------------------------------------------------------------- screens
function handleActions() {
  const actions = input.takeActions();
  const clicks = input.takeClicks();
  if (screen === SCREEN_TITLE && (actions & ACTION_CONFIRM)) {
    audio.unlock();
    loadLevel(0);
    screen = SCREEN_PLAY;
    status.textContent = 'Playing. Vault 1.';
  } else if (screen === SCREEN_CAUGHT && (actions & (ACTION_CONFIRM | ACTION_RESTART))) {
    loadLevel(state.levelIndex);
    screen = SCREEN_PLAY;
  } else if (screen === SCREEN_WIN && (actions & ACTION_CONFIRM)) {
    totals = { time: 0, loot: 0, alarms: 0 };
    loadLevel(0);
    screen = SCREEN_TITLE;
  } else if (screen === SCREEN_PLAY) {
    if (actions & ACTION_PAUSE) screen = SCREEN_PAUSED;
    else if (actions & ACTION_RESTART) loadLevel(state.levelIndex);
    else for (const click of clicks) throwCoin(click);
  } else if (screen === SCREEN_PAUSED && (actions & (ACTION_PAUSE | ACTION_CONFIRM))) {
    screen = SCREEN_PLAY;
  }
}

window.addEventListener('keydown', (event) => {
  audio.unlock();
  if (event.code === 'KeyH' && screen === SCREEN_PLAY) state.notesOn = !state.notesOn;
});
canvas.addEventListener('pointerdown', () => audio.unlock());
document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === SCREEN_PLAY) screen = SCREEN_PAUSED;
});

function runGame() {
  loadLevel(0);
  let accumulator = 0;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    state.tGlobal = now / 1000;
    handleActions();
    if (screen === SCREEN_CLEAR) {
      clearT -= Math.min((now - (frame.prev ?? now)) / 1000, MAX_FRAME);
      if (clearT <= 0) {
        if (state.levelIndex + 1 < LEVELS.length) {
          loadLevel(state.levelIndex + 1);
          screen = SCREEN_PLAY;
        } else {
          screen = SCREEN_WIN;
        }
      }
    }
    frame.prev = now;
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        stepPlay(STEP);
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) { accumulator = 0; break; }
      }
    } else if (screen === SCREEN_TITLE) {
      // The foyer idles behind the title: guards walk their patrols, nobody is hunted.
      while (accumulator >= STEP) {
        state.player.hideMul = 0;
        updateGuards(state, STEP);
        accumulator -= STEP;
      }
      for (const guard of state.guards) guard.meter = 0;
      state.alarm = false;
    } else {
      accumulator = 0;
    }
    renderer.draw(state, screen);
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- screenshots
function stageShot(name) {
  const guardAt = (i, x, y, angle, patch = {}) => {
    const guard = state.guards[i];
    guard.x = x; guard.y = y; guard.angle = angle;
    Object.assign(guard, patch);
    return guard;
  };
  if (name === 'nearmiss') {
    loadLevel(1);
    state.player.x = 830; state.player.y = 392;
    guardAt(0, 1010, 385, Math.PI, { meter: 0.82, state: 'suspicious' });
    guardAt(1, 300, 640, 0, {});
    state.time = 64;
  } else if (name === 'coin') {
    loadLevel(2);
    state.player.x = 550; state.player.y = 470;
    state.player.sneaking = true;
    state.player.hiddenTag = true;
    state.coins.push({ x0: 300, y0: 470, x: 300, y: 470, tx: 300, ty: 470, t: 1, h: 0, landed: true });
    state.coinsLeft = 2;
    guardAt(0, 430, 430, Math.atan2(470 - 430, 300 - 430), { state: 'investigate', bubbleT: 1.8, bubbleText: 'What was that?', target: { x: 300, y: 470 } });
    guardAt(1, 900, 110, Math.PI, {});
    state.time = 41;
  } else if (name === 'star') {
    loadLevel(4);
    state.hasStar = true;
    state.player.x = 1080; state.player.y = 690;
    state.player.angle = 0.5;
    state.player.noiseR = 115;
    state.lootTaken = 2;
    state.loot[0].taken = true;
    state.loot[2].taken = true;
    guardAt(2, 940, 300, Math.PI / 2, { meter: 0.45, state: 'suspicious' });
    guardAt(1, 760, 290, 0, {});
    guardAt(0, 300, 290, Math.PI, {});
    state.time = 97;
  } else {
    // cover: Vault 3, the Counting House — the thief in the chamber wall's blind spot while
    // the Star guard's cone pours through the door and stops at the wall, a second guard off
    // to a coin across the room, the hatch labelled at the far corner.
    loadLevel(2);
    state.notesOn = true;
    state.player.x = 415; state.player.y = 470;
    state.player.hiddenTag = true;
    guardAt(0, 640, 380, Math.PI, {});
    state.coins.push({ x0: 1050, y0: 470, x: 1050, y: 470, tx: 1050, ty: 470, t: 1, h: 0, landed: true });
    state.coinsLeft = 2;
    guardAt(1, 950, 430, Math.atan2(470 - 430, 1050 - 430), { state: 'investigate', bubbleT: 1.8, bubbleText: 'What was that?', target: { x: 1050, y: 470 } });
    state.time = 83;
    state.lootTaken = 1;
    state.loot[2].taken = true;
  }
  state.tGlobal = 1.25;
  let painted = 0;
  function paint() {
    renderer.draw(state, SCREEN_PLAY);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

if (shot) stageShot(shot);
else runGame();
