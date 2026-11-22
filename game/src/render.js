// The renderer for Velvet Hour: everything is drawn on canvas, no image assets. The world is
// framed like a heist dossier — a top bar carries the vault, the objective, the alarm banner
// and the thief's readouts (visibility, noise, coins, valuables, time); a bottom bar carries
// the controls. Inside the frame: two floor materials (stone tile and board), lamplight pools
// with soft falloff over a darkness sheet, vision cones that stop at cover, dashed patrol
// routes with pause badges, guards in red coats with suspicion meters and speech bubbles,
// and — when Field Notes are on (H) — a legend panel and callouts that teach the systems
// right on the scene, the way a field agent would annotate a photograph of the vault.

import { conePolygon, lightAt, insideAny } from './vision.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_WIN = 'win';

export const WORLD_W = 1280;
export const WORLD_H = 800;
const BAR_TOP = 58;
const BAR_BOTTOM = 30;

const INK = '#0a0e1d';
const AMBER = '#e8b64c';
const PARCH = '#f2e7c8';
const FAINT = '#8fa0c8';

/** Where the world lands on a canvas of w by h: fitted between the two bars, aspect kept. */
export function viewFor(w, h) {
  const availH = h - BAR_TOP - BAR_BOTTOM;
  const s = Math.min(w / WORLD_W, availH / WORLD_H);
  return { s, ox: (w - WORLD_W * s) / 2, oy: BAR_TOP + (availH - WORLD_H * s) / 2 };
}

/** Deterministic 0..1 hash for texture variation — the same floor every frame, every run. */
function hash(x, y) {
  const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dark = document.createElement('canvas');
  dark.width = WORLD_W;
  dark.height = WORLD_H;
  const dctx = dark.getContext('2d');

  // ------------------------------------------------------------- world pieces
  function drawFloor(level) {
    ctx.fillStyle = '#1d2440';
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    // Stone tiles: 64px grid, each tile a shade apart, grout dark between.
    for (let ty = 0; ty < WORLD_H / 64; ty += 1) {
      for (let tx = 0; tx < WORLD_W / 64; tx += 1) {
        const v = hash(tx, ty);
        ctx.fillStyle = `rgb(${36 + v * 13}, ${43 + v * 13}, ${66 + v * 15})`;
        ctx.fillRect(tx * 64 + 1, ty * 64 + 1, 62, 62);
      }
    }
    // Board floors: warm planks with grain — the second material, laid over the stone.
    for (const zone of level.boards ?? []) {
      ctx.fillStyle = '#4a3823';
      ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
      const rows = Math.max(1, Math.round(zone.h / 26));
      for (let i = 0; i < rows; i += 1) {
        const y = zone.y + (zone.h / rows) * i;
        const v = hash(zone.x, i * 13);
        ctx.fillStyle = `rgb(${76 + v * 19}, ${58 + v * 14}, ${36 + v * 9})`;
        ctx.fillRect(zone.x + 1, y + 1, zone.w - 2, zone.h / rows - 2);
        ctx.strokeStyle = 'rgba(46,30,14,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(zone.x + 6, y + zone.h / rows / 2);
        ctx.bezierCurveTo(
          zone.x + zone.w * 0.3, y + zone.h / rows / 2 - 2,
          zone.x + zone.w * 0.6, y + zone.h / rows / 2 + 2,
          zone.x + zone.w - 6, y + zone.h / rows / 2,
        );
        ctx.stroke();
        // Plank end seams, staggered like real boards.
        const seam = zone.x + ((i * 173) % Math.max(60, zone.w - 40)) + 20;
        ctx.strokeStyle = 'rgba(30,19,8,0.65)';
        ctx.beginPath(); ctx.moveTo(seam, y + 1); ctx.lineTo(seam, y + zone.h / rows - 1); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(16,10,4,0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(zone.x + 1, zone.y + 1, zone.w - 2, zone.h - 2);
    }
    for (const rug of level.rugs) {
      ctx.fillStyle = rug.c;
      ctx.fillRect(rug.x, rug.y, rug.w, rug.h);
      ctx.strokeStyle = 'rgba(232,182,76,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(rug.x + 5, rug.y + 5, rug.w - 10, rug.h - 10);
    }
    // Creaky boards: pale planks with nail heads — loud ground, readable at a glance.
    for (const patch of level.creak ?? []) {
      ctx.fillStyle = '#4d3a24';
      ctx.fillRect(patch.x, patch.y, patch.w, patch.h);
      ctx.strokeStyle = 'rgba(20,12,4,0.6)';
      ctx.lineWidth = 1;
      for (let y = patch.y + 10; y < patch.y + patch.h; y += 10) {
        ctx.beginPath(); ctx.moveTo(patch.x, y); ctx.lineTo(patch.x + patch.w, y); ctx.stroke();
      }
      ctx.fillStyle = '#c9a86a';
      for (const [nx, ny] of [[4, 4], [patch.w - 7, 4], [4, patch.h - 7], [patch.w - 7, patch.h - 7]]) {
        ctx.fillRect(patch.x + nx, patch.y + ny, 3, 3);
      }
      ctx.strokeStyle = 'rgba(232,182,76,0.5)';
      ctx.strokeRect(patch.x + 0.5, patch.y + 0.5, patch.w - 1, patch.h - 1);
    }
    // Tall grass: a dark bed with bright tufts — crouch in it and vanish.
    (level.grass ?? []).forEach((bed, bi) => {
      ctx.fillStyle = 'rgba(18,38,24,0.9)';
      ctx.fillRect(bed.x, bed.y, bed.w, bed.h);
      for (let i = 0; i < bed.w * bed.h / 90; i += 1) {
        const gx = bed.x + hash(i, bi * 7) * bed.w;
        const gy = bed.y + bed.h - hash(bi * 3, i) * bed.h * 0.4;
        const tall = 9 + hash(i, bi) * 10;
        ctx.strokeStyle = ['#3f7a44', '#57a05a', '#2c5a34'][i % 3];
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.quadraticCurveTo(gx + 2, gy - tall * 0.6, gx + (hash(i, 99) - 0.5) * 6, gy - tall);
        ctx.stroke();
      }
    });
  }

  function drawCover(level) {
    for (const item of level.cover) {
      if (item.kind === 'crate') {
        ctx.fillStyle = '#6e5133';
        ctx.fillRect(item.x, item.y, item.w, item.h);
        ctx.strokeStyle = 'rgba(30,19,8,0.55)';
        ctx.lineWidth = 1;
        const rows = Math.max(1, Math.round(item.h / 22));
        for (let i = 1; i < rows; i += 1) {
          ctx.beginPath(); ctx.moveTo(item.x, item.y + (item.h / rows) * i); ctx.lineTo(item.x + item.w, item.y + (item.h / rows) * i); ctx.stroke();
        }
        ctx.strokeStyle = '#3d2c1a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(item.x, item.y); ctx.lineTo(item.x + item.w, item.y + item.h);
        ctx.moveTo(item.x + item.w, item.y); ctx.lineTo(item.x, item.y + item.h);
        ctx.stroke();
        ctx.strokeRect(item.x + 1, item.y + 1, item.w - 2, item.h - 2);
      } else {
        // A bookshelf: dark carcass, two shelves of bright book spines.
        ctx.fillStyle = '#2c2438';
        ctx.fillRect(item.x, item.y, item.w, item.h);
        const palette = ['#7a3b3b', '#3b5a7a', '#3f7a4e', '#7a623b', '#5a3b7a', '#8a4a2c'];
        const horizontal = item.w >= item.h;
        const bands = 2;
        for (let b = 0; b < bands; b += 1) {
          const along = horizontal ? item.w : item.h;
          let cursor = 4;
          let seed = item.x + item.y + b * 31;
          while (cursor < along - 10) {
            const bw = 5 + hash(seed, cursor) * 6;
            ctx.fillStyle = palette[Math.floor(hash(cursor, seed) * palette.length)];
            if (horizontal) ctx.fillRect(item.x + cursor, item.y + 4 + (b * (item.h - 8)) / bands, bw, (item.h - 10) / bands);
            else ctx.fillRect(item.x + 4 + (b * (item.w - 8)) / bands, item.y + cursor, (item.w - 10) / bands, bw);
            cursor += bw + 1.5;
          }
        }
        ctx.strokeStyle = '#171126';
        ctx.lineWidth = 2;
        ctx.strokeRect(item.x + 1, item.y + 1, item.w - 2, item.h - 2);
      }
    }
  }

  function drawWalls(level) {
    for (const wall of level.walls) {
      ctx.fillStyle = '#242e4d';
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.fillStyle = '#31406a';
      ctx.fillRect(wall.x, wall.y, wall.w, Math.min(5, wall.h));
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      for (let y = wall.y + 12; y < wall.y + wall.h; y += 12) {
        ctx.beginPath(); ctx.moveTo(wall.x, y); ctx.lineTo(wall.x + wall.w, y); ctx.stroke();
      }
      ctx.strokeStyle = '#0d1120';
      ctx.lineWidth = 2;
      ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
    }
  }

  function drawDarkness(state) {
    const { level, player } = state;
    dctx.clearRect(0, 0, WORLD_W, WORLD_H);
    dctx.globalCompositeOperation = 'source-over';
    dctx.fillStyle = 'rgba(5,7,18,0.50)';
    dctx.fillRect(0, 0, WORLD_W, WORLD_H);
    dctx.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, strength) => {
      const g = dctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${strength})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = g;
      dctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    for (const lamp of level.lanterns) hole(lamp.x, lamp.y, lamp.r, 0.95);
    hole(player.x, player.y, 100, 0.55);
    if (!state.hasStar) hole(level.star.x, level.star.y, 74, 0.6);
    if (state.hasStar) {
      const e = level.exit;
      hole(e.x + e.w / 2, e.y + e.h / 2, 95, 0.6);
    }
    ctx.drawImage(dark, 0, 0);
    // The warm pools themselves, laid over the darkness so lamplight reads as light.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const lamp of level.lanterns) {
      const g = ctx.createRadialGradient(lamp.x, lamp.y, 0, lamp.x, lamp.y, lamp.r);
      g.addColorStop(0, 'rgba(255,178,84,0.44)');
      g.addColorStop(0.45, 'rgba(255,156,62,0.20)');
      g.addColorStop(1, 'rgba(255,140,50,0)');
      ctx.fillStyle = g;
      ctx.fillRect(lamp.x - lamp.r, lamp.y - lamp.r, lamp.r * 2, lamp.r * 2);
    }
    ctx.restore();
    for (const lamp of level.lanterns) drawLampFixture(lamp);
  }

  /**
   * A lantern drawn as an object, not a dot: a brass ring with four spokes around a warm
   * glass core, sitting in its own pool. Standing lamps get a heavy base disc under the
   * ring; hanging lanterns get a ceiling medallion and a short chain of links above.
   */
  function drawLampFixture(lamp) {
    const { x, y } = lamp;
    if (lamp.kind === 'stand') {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath(); ctx.ellipse(x, y + 4, 19, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#241a10';
      ctx.beginPath(); ctx.arc(x, y, 16.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#6a5326';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 16.5, 0, Math.PI * 2); ctx.stroke();
    } else {
      // Hanging: three chain links rising from the ring, and a faint ceiling medallion.
      ctx.strokeStyle = 'rgba(140,110,55,0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y - 27, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#57431f';
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath(); ctx.arc(x, y - 15 - i * 5.5, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    // The warm glass, brightest at its heart.
    const glass = ctx.createRadialGradient(x, y, 0, x, y, 11.5);
    glass.addColorStop(0, '#fff6d8');
    glass.addColorStop(0.55, '#ffd98a');
    glass.addColorStop(1, '#e89a3c');
    ctx.fillStyle = glass;
    ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill();
    // Brass ring and spokes over the glass.
    ctx.strokeStyle = '#a87f34';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, 13.5, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,86,32,0.9)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4);
      ctx.lineTo(x + Math.cos(a) * 13, y + Math.sin(a) * 13);
      ctx.stroke();
    }
    ctx.fillStyle = '#fffbe9';
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
  }

  function drawPatrols(state) {
    ctx.save();
    ctx.strokeStyle = state.notesOn ? 'rgba(240,220,170,0.34)' : 'rgba(240,220,170,0.15)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([7, 9]);
    for (const guard of state.guards) {
      ctx.beginPath();
      guard.path.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
      if (guard.loop) ctx.closePath();
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Pause badges: how long he lingers at each stop — the timetable, printed on the floor.
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const guard of state.guards) {
      for (const [px, py] of guard.path) {
        ctx.fillStyle = 'rgba(8,11,24,0.85)';
        ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(240,220,170,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#e8d9ae';
        ctx.fillText(`${Math.round(guard.pause)}s`, px, py + 3.5);
      }
    }
    ctx.restore();
  }

  function drawExit(state) {
    const e = state.level.exit;
    const cx = e.x + e.w / 2;
    const cy = e.y + e.h / 2;
    if (state.hasStar) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90);
      g.addColorStop(0, 'rgba(90,255,175,0.30)');
      g.addColorStop(1, 'rgba(90,255,175,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - 90, cy - 90, 180, 180);
    }
    ctx.fillStyle = '#16241e';
    ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.fillStyle = state.hasStar ? '#2f5a41' : '#274434';
    const doorW = (e.w - 6) / 2;
    ctx.fillRect(e.x + 3, e.y + 3, doorW, e.h - 6);
    ctx.fillRect(e.x + 3 + doorW, e.y + 3, doorW, e.h - 6);
    ctx.fillStyle = '#c9a227';
    ctx.beginPath(); ctx.arc(e.x + e.w / 2 - 5, cy, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(e.x + e.w / 2 + 5, cy, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = state.hasStar ? '#7dffb0' : '#3c5a49';
    ctx.lineWidth = 2;
    ctx.strokeRect(e.x + 1, e.y + 1, e.w - 2, e.h - 2);
    // The EXIT sign, lit green once the Star is held, dim iron before.
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const label = 'EXIT';
    const tw = ctx.measureText(label).width + 14;
    const sx = Math.max(30, Math.min(WORLD_W - 30 - tw, cx - tw / 2));
    const sy = e.y < WORLD_H / 2 ? e.y + e.h + 6 : e.y - 24;
    ctx.fillStyle = state.hasStar ? '#0d3320' : '#101a14';
    roundRect(ctx, sx, sy, tw, 18, 4); ctx.fill();
    ctx.strokeStyle = state.hasStar ? '#7dffb0' : '#3c5a49';
    ctx.lineWidth = 1;
    roundRect(ctx, sx, sy, tw, 18, 4); ctx.stroke();
    ctx.fillStyle = state.hasStar ? '#7dffb0' : '#5a7a66';
    ctx.fillText(label, sx + tw / 2, sy + 13);
  }

  function drawStarAndLoot(state, t) {
    const { level } = state;
    if (!state.hasStar) {
      const { x, y } = level.star;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 46);
      g.addColorStop(0, 'rgba(255,224,102,0.5)');
      g.addColorStop(1, 'rgba(255,224,102,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 46, y - 46, 92, 92);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 0.8);
      ctx.fillStyle = '#ffe066';
      ctx.strokeStyle = '#fff7cc';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const r = i % 2 === 0 ? 15 : 6;
        const a = (i / 8) * Math.PI * 2;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    state.loot.forEach((item, i) => {
      if (item.taken) return;
      const bob = Math.sin(t * 2 + i * 1.7) * 2.5;
      ctx.save();
      ctx.translate(item.x, item.y + bob);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffd76a';
      ctx.strokeStyle = '#8a6a1c';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-6, -6, 12, 12);
      ctx.strokeRect(-6, -6, 12, 12);
      ctx.restore();
    });
  }

  function drawCones(state) {
    for (const guard of state.guards) {
      const poly = conePolygon(guard.x, guard.y, guard.angle, state.solids);
      const alert = state.alarm || guard.state === 'hunt';
      const wary = guard.meter > 0.05 || guard.state === 'investigate' || guard.state === 'suspicious';
      const inner = alert ? 'rgba(255,92,70,0.40)' : wary ? 'rgba(255,166,80,0.36)' : 'rgba(255,208,116,0.32)';
      const outer = alert ? 'rgba(255,92,70,0.03)' : wary ? 'rgba(255,166,80,0.03)' : 'rgba(255,208,116,0.02)';
      const gx = guard.x + Math.cos(guard.angle) * 245;
      const gy = guard.y + Math.sin(guard.angle) * 245;
      const grad = ctx.createLinearGradient(guard.x, guard.y, gx, gy);
      grad.addColorStop(0, inner);
      grad.addColorStop(1, outer);
      ctx.fillStyle = grad;
      ctx.beginPath();
      poly.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,150,0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawGuard(state, guard) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(guard.x, guard.y + 10, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b3312c';
    ctx.strokeStyle = '#6e1a16';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(guard.x, guard.y, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#8f2622';
    ctx.beginPath(); ctx.arc(guard.x, guard.y, 8, 0, Math.PI * 2); ctx.fill();
    const hx = guard.x + Math.cos(guard.angle) * 4;
    const hy = guard.y + Math.sin(guard.angle) * 4;
    ctx.fillStyle = '#e8c39e';
    ctx.beginPath(); ctx.arc(hx, hy, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5a1713';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(hx, hy, 5.5, guard.angle + 2.2, guard.angle + 4.1);
    ctx.stroke();
    // Suspicion meter: a slim bar over his head that fills amber, then red.
    if (guard.meter > 0.02) {
      const w = 32;
      ctx.fillStyle = 'rgba(5,7,15,0.7)';
      roundRect(ctx, guard.x - w / 2, guard.y - 30, w, 5, 2); ctx.fill();
      ctx.fillStyle = guard.meter > 0.7 ? '#ff6a5e' : '#ffb050';
      roundRect(ctx, guard.x - w / 2, guard.y - 30, w * guard.meter, 5, 2); ctx.fill();
    }
    // State glyph: ? while wary, ! while hunting — his mind, worn on his sleeve.
    const glyph = guard.state === 'hunt' || state.alarm ? '!' : (guard.meter > 0.3 || guard.state === 'investigate' || guard.state === 'search') ? '?' : null;
    if (glyph) {
      ctx.font = 'bold 17px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = glyph === '!' ? '#ff6a5e' : '#ffd76a';
      ctx.fillText(glyph, guard.x + 16, guard.y - 18);
    }
    // Speech bubble while he goes to look at a noise.
    if (guard.bubbleT > 0 && guard.bubbleText) {
      ctx.font = '11px system-ui, sans-serif';
      const tw = ctx.measureText(guard.bubbleText).width + 16;
      const bx = Math.max(6, Math.min(WORLD_W - tw - 6, guard.x - tw / 2));
      const by = guard.y - 62;
      ctx.fillStyle = 'rgba(250,247,238,0.96)';
      roundRect(ctx, bx, by, tw, 20, 6); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(guard.x - 4, by + 20);
      ctx.lineTo(guard.x + 4, by + 20);
      ctx.lineTo(guard.x, by + 27);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1c1c22';
      ctx.textAlign = 'center';
      ctx.fillText(guard.bubbleText, bx + tw / 2, by + 14);
    }
  }

  function drawPlayer(state, t) {
    const p = state.player;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 9, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
    if (p.noiseR > 0) {
      ctx.strokeStyle = 'rgba(255,200,120,0.30)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.noiseR, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = p.hiddenTag ? 0.82 : 1;
    ctx.fillStyle = '#d7dee9';
    ctx.strokeStyle = '#7f8ba1';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#93a0b8';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8.5, p.angle + 2.4, p.angle + 3.9);
    ctx.lineTo(p.x, p.y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = AMBER;
    ctx.beginPath(); ctx.arc(p.x - Math.cos(p.angle) * 8, p.y - Math.sin(p.angle) * 8, 3, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    if (p.hiddenTag) {
      ctx.font = 'bold 9px system-ui, sans-serif';
      const label = 'HIDDEN';
      const tw = ctx.measureText(label).width + 12;
      ctx.fillStyle = 'rgba(8,20,12,0.88)';
      roundRect(ctx, p.x - tw / 2, p.y - 34, tw, 15, 7); ctx.fill();
      ctx.strokeStyle = '#57a05a';
      ctx.lineWidth = 1;
      roundRect(ctx, p.x - tw / 2, p.y - 34, tw, 15, 7); ctx.stroke();
      ctx.fillStyle = '#bfe3c0';
      ctx.textAlign = 'center';
      ctx.fillText(label, p.x, p.y - 23);
    }
    void t;
  }

  function drawCoinsAndParticles(state) {
    for (const coin of state.coins) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(coin.x, coin.y, 6, 2.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd76a';
      ctx.strokeStyle = '#8a6a1c';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(coin.x, coin.y - coin.h, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (coin.landed) {
        ctx.strokeStyle = 'rgba(255,215,106,0.35)';
        ctx.beginPath(); ctx.arc(coin.x, coin.y, 10 + Math.sin(state.tGlobal * 5) * 1.5, 0, Math.PI * 2); ctx.stroke();
      }
    }
    for (const dot of state.particles) {
      ctx.globalAlpha = Math.max(0, dot.life / dot.maxLife);
      ctx.fillStyle = dot.color;
      ctx.beginPath(); ctx.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------- Field Notes
  function callout(anchorX, anchorY, text, placeAbove = true) {
    ctx.font = 'bold 12px system-ui, sans-serif';
    const tw = ctx.measureText(text).width + 20;
    const view = viewFor(canvas.width, canvas.height);
    // Work in screen space: convert the world anchor.
    const ax = view.ox + anchorX * view.s;
    const ay = view.oy + anchorY * view.s;
    let bx = Math.max(8, Math.min(canvas.width - tw - 8, ax - tw / 2));
    let by = placeAbove ? ay - 64 : ay + 40;
    by = Math.max(BAR_TOP + 8, Math.min(canvas.height - BAR_BOTTOM - 30, by));
    // Never bury a callout under the Field Notes panel: slide it right of the panel.
    const panel = { x: 14, y: BAR_TOP + 12, w: 262, h: 210 };
    if (bx < panel.x + panel.w + 8 && bx + tw > panel.x && by < panel.y + panel.h + 8 && by + 24 > panel.y) {
      bx = Math.min(canvas.width - tw - 8, panel.x + panel.w + 10);
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = 'rgba(245,239,221,0.65)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx + tw / 2, placeAbove ? by + 24 : by);
    ctx.lineTo(ax, ay);
    ctx.stroke();
    ctx.fillStyle = 'rgba(10,13,26,0.93)';
    roundRect(ctx, bx, by, tw, 24, 4); ctx.fill();
    ctx.strokeStyle = '#e8e2d0';
    roundRect(ctx, bx, by, tw, 24, 4); ctx.stroke();
    ctx.fillStyle = '#f5efdd';
    ctx.textAlign = 'center';
    ctx.fillText(text, bx + tw / 2, by + 16);
    ctx.restore();
  }

  function drawFieldNotes(state) {
    // Legend panel, top-left inside the frame.
    const px = 14;
    const py = BAR_TOP + 12;
    const pw = 262;
    const rows = [
      ['cone', 'Guard + vision cone (what he sees)'],
      ['cover', 'Blind spot behind cover: safe'],
      ['lamp', 'Lamplight: you are seen from afar'],
      ['grass', 'Tall grass: crouch (SHIFT) to vanish'],
      ['boards', 'Creaky boards: loud even sneaking'],
      ['ring', 'Dashed line + badge: his patrol'],
      ['exit', 'Exit hatch: opens once you hold the Star'],
    ];
    const ph = 34 + rows.length * 24 + 8;
    ctx.fillStyle = 'rgba(8,11,24,0.90)';
    roundRect(ctx, px, py, pw, ph, 6); ctx.fill();
    ctx.strokeStyle = AMBER;
    ctx.lineWidth = 1.5;
    roundRect(ctx, px, py, pw, ph, 6); ctx.stroke();
    ctx.fillStyle = AMBER;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('FIELD NOTES', px + 12, py + 21);
    ctx.font = '11.5px system-ui, sans-serif';
    rows.forEach(([kind, text], i) => {
      const ry = py + 34 + i * 24;
      const sx = px + 12;
      const sy = ry + 2;
      if (kind === 'cone') {
        ctx.fillStyle = '#b3312c';
        ctx.beginPath(); ctx.arc(sx + 5, sy + 6, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,208,116,0.5)';
        ctx.beginPath(); ctx.moveTo(sx + 8, sy + 1); ctx.lineTo(sx + 24, sy + 6); ctx.lineTo(sx + 8, sy + 11); ctx.closePath(); ctx.fill();
      } else if (kind === 'cover') {
        ctx.fillStyle = '#6e5133';
        ctx.fillRect(sx, sy, 24, 12);
        ctx.strokeStyle = '#3d2c1a';
        ctx.strokeRect(sx, sy, 24, 12);
      } else if (kind === 'lamp') {
        const g = ctx.createRadialGradient(sx + 12, sy + 6, 0, sx + 12, sy + 6, 12);
        g.addColorStop(0, 'rgba(255,200,110,0.95)');
        g.addColorStop(1, 'rgba(255,200,110,0)');
        ctx.fillStyle = g;
        ctx.fillRect(sx, sy - 6, 24, 24);
      } else if (kind === 'grass') {
        ctx.strokeStyle = '#57a05a';
        ctx.lineWidth = 2;
        for (let s = 0; s < 5; s += 1) {
          ctx.beginPath(); ctx.moveTo(sx + 3 + s * 5, sy + 12); ctx.lineTo(sx + 2 + s * 5, sy + 1); ctx.stroke();
        }
      } else if (kind === 'boards') {
        ctx.fillStyle = '#4d3a24';
        ctx.fillRect(sx, sy, 24, 12);
        ctx.strokeStyle = 'rgba(20,12,4,0.7)';
        ctx.strokeRect(sx, sy, 24, 12);
        ctx.beginPath(); ctx.moveTo(sx, sy + 6); ctx.lineTo(sx + 24, sy + 6); ctx.stroke();
      } else if (kind === 'ring') {
        ctx.strokeStyle = 'rgba(240,220,170,0.8)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(sx + 12, sy + 6, 8, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      } else if (kind === 'exit') {
        ctx.fillStyle = '#2f5a41';
        ctx.fillRect(sx + 3, sy, 18, 12);
        ctx.strokeStyle = '#7dffb0';
        ctx.strokeRect(sx + 3, sy, 18, 12);
      }
      ctx.fillStyle = '#dfe6f5';
      ctx.fillText(text, sx + 32, ry + 12);
    });

    // Callouts onto the live scene, each tied to a real system at work.
    const { level, player } = state;
    const e = level.exit;
    callout(e.x + e.w / 2, e.y + e.h / 2, state.hasStar ? 'EXIT HATCH: open — go!' : 'EXIT HATCH: opens once you hold the Star', e.y > WORLD_H / 2);
    let nearestGuard = null;
    let nearestD = Infinity;
    for (const guard of state.guards) {
      const d = Math.hypot(guard.x - player.x, guard.y - player.y);
      if (d < nearestD) { nearestD = d; nearestGuard = guard; }
    }
    if (nearestGuard) {
      callout(
        nearestGuard.x + Math.cos(nearestGuard.angle) * 190,
        nearestGuard.y + Math.sin(nearestGuard.angle) * 190,
        'VISION CONE: what he sees',
        nearestGuard.y > WORLD_H / 2,
      );
    }
    let nearestLamp = null;
    let lampD = Infinity;
    for (const lamp of level.lanterns) {
      const d = Math.hypot(lamp.x - player.x, lamp.y - player.y);
      if (d < lampD) { lampD = d; nearestLamp = lamp; }
    }
    if (nearestLamp) callout(nearestLamp.x, nearestLamp.y, 'LAMPLIGHT: seen from across the room', nearestLamp.y > 200);
    const investigator = state.guards.find((g) => g.state === 'investigate');
    if (investigator) callout(investigator.x, investigator.y, '? HEARD THE COIN: off to look', false);
    if (!state.anySeeing && insideAny(player.x, player.y, level.grass ?? [])) {
      callout(player.x, player.y, 'YOU: hidden in the tall grass', false);
    } else if (!state.anySeeing && lightAt(player.x, player.y, level.lanterns) < 0.42) {
      callout(player.x, player.y, 'YOU: hidden where the cone stops', false);
    }
  }

  // ------------------------------------------------------------- HUD + screens
  function fmtTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function drawBars(state, screen) {
    const W = canvas.width;
    const H = canvas.height;
    const { level, player } = state;
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, BAR_TOP);
    ctx.fillRect(0, H - BAR_BOTTOM, W, BAR_BOTTOM);
    ctx.fillStyle = '#2a3350';
    ctx.fillRect(0, BAR_TOP - 1, W, 1);
    ctx.fillRect(0, H - BAR_BOTTOM, W, 1);

    // Left: the game and the vault.
    ctx.textAlign = 'left';
    ctx.fillStyle = AMBER;
    ctx.font = 'bold 19px Georgia, serif';
    ctx.fillText('VELVET HOUR', 16, 25);
    ctx.fillStyle = FAINT;
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(level.name.toUpperCase(), 16, 44);

    // Centre: the objective, and the vault's mood as a banner.
    const maxMeter = Math.max(0, ...state.guards.map((g) => g.meter));
    ctx.textAlign = 'center';
    ctx.fillStyle = PARCH;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(state.hasStar ? 'ESCAPE THROUGH THE HATCH, UNSEEN' : 'STEAL THE AURELIAN STAR', W / 2, 24);
    const banner = state.alarm
      ? ['#ff6a5e', 'THE ALARM IS UP — BREAK LINE OF SIGHT']
      : maxMeter > 0.35
        ? ['#ffb050', 'A GUARD IS SUSPICIOUS']
        : ['#7dc98a', 'THE VAULT IS QUIET'];
    ctx.fillStyle = banner[0];
    ctx.beginPath(); ctx.arc(W / 2 - ctx.measureText(banner[1]).width / 2 - 12, 39, 4, 0, Math.PI * 2); ctx.fill();
    ctx.font = 'bold 11.5px system-ui, sans-serif';
    ctx.fillText(banner[1], W / 2, 43);

    // Right: readouts — visibility, noise, coins, valuables, time.
    const lit = lightAt(player.x, player.y, level.lanterns);
    const inGrass = insideAny(player.x, player.y, level.grass ?? []);
    const visibility = inGrass ? ['IN TALL GRASS', '#8fe3a0'] : lit > 0.55 ? ['IN LAMPLIGHT', '#ffcf7a'] : ['IN SHADOW', '#8fd0ff'];
    const noise = player.onCreak ? ['CREAKY BOARDS', '#ff9a7a'] : player.noiseR > 0 ? ['FOOTSTEPS', '#ffcf7a'] : ['SILENT', '#8fe3a0'];
    ctx.textAlign = 'right';
    ctx.font = 'bold 12.5px system-ui, sans-serif';
    ctx.fillStyle = visibility[1];
    ctx.fillText(`◉ ${visibility[0]}`, W - 196, 24);
    ctx.fillStyle = noise[1];
    ctx.fillText(noise[0], W - 196, 44);
    // Coins as pips, valuables as a count, time at the far right.
    for (let i = 0; i < state.coinsTotal; i += 1) {
      ctx.beginPath();
      ctx.arc(W - 176 + i * 15, 19, 5.5, 0, Math.PI * 2);
      if (i < state.coinsLeft) { ctx.fillStyle = '#ffd76a'; ctx.fill(); }
      else { ctx.strokeStyle = '#5a6a8a'; ctx.stroke(); }
    }
    ctx.fillStyle = PARCH;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`◆ ${state.lootTaken}/${state.loot.length}`, W - 92, 24);
    ctx.fillStyle = FAINT;
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('VALUABLES', W - 92, 44);
    ctx.fillStyle = PARCH;
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillText(fmtTime(state.time), W - 16, 26);
    ctx.fillStyle = FAINT;
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('TIME', W - 16, 44);

    // Bottom: the controls, always on show — and the hint line when there is one.
    ctx.textAlign = 'center';
    ctx.fillStyle = FAINT;
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('WASD / ARROWS move · SHIFT sneak · CLICK throw a coin · H field notes · R restart · P pause', W / 2, H - 11);
    if (state.hint && screen === SCREEN_PLAY) {
      ctx.font = 'bold 13px system-ui, sans-serif';
      const tw = ctx.measureText(state.hint).width + 24;
      ctx.fillStyle = 'rgba(10,13,26,0.92)';
      roundRect(ctx, W / 2 - tw / 2, H - BAR_BOTTOM - 34, tw, 24, 5); ctx.fill();
      ctx.strokeStyle = AMBER;
      roundRect(ctx, W / 2 - tw / 2, H - BAR_BOTTOM - 34, tw, 24, 5); ctx.stroke();
      ctx.fillStyle = PARCH;
      ctx.fillText(state.hint, W / 2, H - BAR_BOTTOM - 18);
    }
  }

  function overlay(alpha) {
    ctx.fillStyle = `rgba(4,6,14,${alpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawScreen(state, screen) {
    const W = canvas.width;
    const H = canvas.height;
    ctx.textAlign = 'center';
    if (screen === SCREEN_TITLE) {
      overlay(0.62);
      ctx.fillStyle = AMBER;
      ctx.font = 'bold 56px Georgia, serif';
      ctx.shadowColor = 'rgba(232,182,76,0.6)';
      ctx.shadowBlur = 24;
      ctx.fillText('VELVET HOUR', W / 2, H / 2 - 110);
      ctx.shadowBlur = 0;
      ctx.fillStyle = PARCH;
      ctx.font = '16px Georgia, serif';
      ctx.fillText('Six lantern-lit vaults. Fifteen guards. One star.', W / 2, H / 2 - 76);
      ctx.font = '14.5px system-ui, sans-serif';
      ctx.fillStyle = '#c9d4ee';
      const lines = [
        'Move with WASD or the arrow keys. Hold SHIFT to sneak — slow, silent, hard to see.',
        'Lamplight betrays you; shadow and tall grass hide you. Cover stops a cone dead.',
        'Click to throw a coin and send a guard to look the other way.',
        'Steal the Aurelian Star, then reach the EXIT hatch unseen. Do not be touched while a guard is sure.',
        'Press H in play for Field Notes — every system, labelled on the scene.',
      ];
      lines.forEach((line, i) => ctx.fillText(line, W / 2, H / 2 - 30 + i * 24));
      ctx.fillStyle = AMBER;
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText('CLICK OR PRESS ENTER TO BEGIN', W / 2, H / 2 + 118);
    } else if (screen === SCREEN_CAUGHT) {
      ctx.fillStyle = 'rgba(70,8,8,0.5)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ff8a7a';
      ctx.font = 'bold 46px Georgia, serif';
      ctx.fillText('CAUGHT', W / 2, H / 2 - 30);
      ctx.fillStyle = PARCH;
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillText('The vault wakes, and the Star stays where it lies.', W / 2, H / 2 + 4);
      ctx.fillStyle = AMBER;
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText('CLICK OR PRESS R TO TRY THE VAULT AGAIN', W / 2, H / 2 + 38);
    } else if (screen === SCREEN_CLEAR) {
      overlay(0.45);
      ctx.fillStyle = AMBER;
      ctx.font = 'bold 38px Georgia, serif';
      ctx.fillText('VAULT CLEARED', W / 2, H / 2 - 16);
      ctx.fillStyle = PARCH;
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillText(state.nextText ?? '', W / 2, H / 2 + 16);
    } else if (screen === SCREEN_WIN) {
      overlay(0.66);
      ctx.fillStyle = AMBER;
      ctx.font = 'bold 46px Georgia, serif';
      ctx.shadowColor = 'rgba(232,182,76,0.6)';
      ctx.shadowBlur = 22;
      ctx.fillText('THE STAR IS YOURS', W / 2, H / 2 - 60);
      ctx.shadowBlur = 0;
      ctx.fillStyle = PARCH;
      ctx.font = '15.5px system-ui, sans-serif';
      ctx.fillText(`Six vaults in ${fmtTime(state.totalTime)} · valuables ${state.totalLoot}/18 · the alarm rose ${state.alarms} ${state.alarms === 1 ? 'time' : 'times'}`, W / 2, H / 2 - 22);
      ctx.fillStyle = AMBER;
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText('CLICK OR PRESS ENTER TO PLAY AGAIN', W / 2, H / 2 + 22);
    } else if (screen === SCREEN_PAUSED) {
      overlay(0.5);
      ctx.fillStyle = PARCH;
      ctx.font = 'bold 34px Georgia, serif';
      ctx.fillText('PAUSED', W / 2, H / 2);
    }
  }

  // ------------------------------------------------------------- the frame
  function draw(state, screen) {
    const W = canvas.width;
    const H = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, H);
    const view = viewFor(W, H);
    ctx.save();
    ctx.translate(view.ox, view.oy);
    ctx.scale(view.s, view.s);
    ctx.beginPath();
    ctx.rect(0, 0, WORLD_W, WORLD_H);
    ctx.clip();
    drawFloor(state.level);
    drawPatrols(state);
    drawExit(state);
    drawCover(state.level);
    drawWalls(state.level);
    drawDarkness(state);
    drawStarAndLoot(state, state.tGlobal);
    drawCones(state);
    drawCoinsAndParticles(state);
    for (const guard of state.guards) drawGuard(state, guard);
    drawPlayer(state, state.tGlobal);
    ctx.restore();
    if (state.notesOn && screen === SCREEN_PLAY) drawFieldNotes(state);
    drawBars(state, screen);
    if (screen !== SCREEN_PLAY) drawScreen(state, screen);
  }

  return { draw };
}
