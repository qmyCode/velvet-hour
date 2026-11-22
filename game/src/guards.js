// Guard minds for Velvet Hour. Each guard walks a learnable patrol — waypoints, pauses, a
// slow scan at each stop — and carries a suspicion meter that fills while the thief is in his
// vision cone (faster in lamplight, slower in shadow, barely at all in tall grass) and drains
// while she is unseen, so a near miss can still be escaped. A full meter raises the alarm:
// every guard converges on the last seen place, but break line of sight, stay hidden, and
// the vault cools down again. Noise — footsteps on boards, a thrown coin — sends the nearest
// guards to investigate, wearing a "What was that?" bubble while they go.

import { CONE_RANGE, seenStrength, circleHits } from './vision.js';

export const STATE_PATROL = 'patrol';
export const STATE_PAUSE = 'pause';
export const STATE_SUSPICIOUS = 'suspicious';
export const STATE_INVESTIGATE = 'investigate';
export const STATE_SEARCH = 'search';
export const STATE_HUNT = 'hunt';

const SPEED_PATROL = 82;
const SPEED_INVESTIGATE = 118;
const SPEED_HUNT = 148;
const TURN_RATE = 3.4;
const METER_SUSPICIOUS = 0.35;
const METER_FILL = 0.62;
const METER_DRAIN = 0.20;
const ALARM_MEMORY = 3.5;

function angleLerpTurn(from, to, maxStep) {
  let diff = to - from;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) <= maxStep) return to;
  return from + Math.sign(diff) * maxStep;
}

function moveToward(guard, tx, ty, speed, dt, solids) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return true;
  const step = Math.min(dist, speed * dt);
  const nx = guard.x + (dx / dist) * step;
  const ny = guard.y + (dy / dist) * step;
  if (!circleHits(nx, guard.y, guard.r, solids)) guard.x = nx;
  if (!circleHits(guard.x, ny, guard.r, solids)) guard.y = ny;
  guard.angle = angleLerpTurn(guard.angle, Math.atan2(dy, dx), TURN_RATE * dt);
  guard.moving = true;
  return dist <= Math.max(10, speed * dt);
}

/** Build the guard objects for a level from its patrol data. */
export function createGuards(level) {
  return level.guards.map((spec, index) => {
    const [sx, sy] = spec.path[0];
    const [tx, ty] = spec.path[1] ?? spec.path[0];
    return {
      x: sx, y: sy, r: 13,
      angle: Math.atan2(ty - sy, tx - sx),
      path: spec.path, pause: spec.pause ?? 1.5, loop: spec.loop ?? false,
      wp: 1, dir: 1, state: STATE_PATROL, waitT: 0, scanBase: 0, scanT: index * 1.7,
      meter: 0, target: null, bubbleT: 0, bubbleText: '', stepT: Math.random() * 0.3,
      moving: false, heardCd: 0,
    };
  });
}

function startInvestigate(guard, x, y, bubble) {
  if (guard.state === STATE_HUNT) return;
  guard.state = STATE_INVESTIGATE;
  guard.target = { x, y };
  if (bubble) {
    guard.bubbleText = bubble;
    guard.bubbleT = 1.8;
  }
}

/** Send every guard within earshot of a noise to look at its source. */
export function guardsHear(state, x, y, radius, bubble) {
  for (const guard of state.guards) {
    if (guard.heardCd > 0) continue;
    if (Math.hypot(guard.x - x, guard.y - y) <= radius + CONE_RANGE * 0.25) {
      startInvestigate(guard, x, y, bubble);
      guard.heardCd = 1.4;
    }
  }
}

/**
 * Advance every guard one step. `state` carries the level, solids, lanterns, the player
 * (with player.hideMul precomputed: tall grass and sneak shrink how visible she is) and the
 * shared alarm fields. Returns events: {type:'alarm'|'caught'|'gstep', guard?}.
 */
export function updateGuards(state, dt) {
  const events = [];
  const { player, solids, lanterns } = state;
  let anySeeing = false;

  for (const guard of state.guards) {
    guard.moving = false;
    guard.heardCd = Math.max(0, guard.heardCd - dt);
    guard.bubbleT = Math.max(0, guard.bubbleT - dt);
    guard.scanT += dt;

    // --- sensing -------------------------------------------------------------
    const seen = seenStrength(guard, player.x, player.y, solids, lanterns, player.sneaking) * player.hideMul;
    if (seen > 0) {
      anySeeing = true;
      guard.meter = Math.min(1, guard.meter + seen * METER_FILL * dt);
      state.lastSeen = { x: player.x, y: player.y };
      state.sinceSeen = 0;
      if (guard.meter >= 1 && !state.alarm) {
        state.alarm = true;
        events.push({ type: 'alarm' });
        for (const other of state.guards) {
          other.state = STATE_HUNT;
          other.meter = Math.max(other.meter, 0.7);
          other.target = { ...state.lastSeen };
        }
      } else if (guard.meter > METER_SUSPICIOUS && (guard.state === STATE_PATROL || guard.state === STATE_PAUSE)) {
        guard.state = STATE_SUSPICIOUS;
        guard.waitT = 0.85;
      }
      if (state.alarm) {
        guard.state = STATE_HUNT;
        guard.target = { x: player.x, y: player.y };
      }
    } else {
      const drain = state.alarm ? METER_DRAIN * 0.6 : METER_DRAIN;
      guard.meter = Math.max(0, guard.meter - drain * dt);
    }

    // --- caught ---------------------------------------------------------------
    if (guard.meter > 0.55 && Math.hypot(guard.x - player.x, guard.y - player.y) < 27) {
      events.push({ type: 'caught', guard });
      return events;
    }

    // --- acting ---------------------------------------------------------------
    switch (guard.state) {
      case STATE_PATROL: {
        const [tx, ty] = guard.path[guard.wp];
        if (moveToward(guard, tx, ty, SPEED_PATROL, dt, solids)) {
          guard.state = STATE_PAUSE;
          guard.waitT = guard.pause;
          guard.scanBase = guard.angle;
        }
        break;
      }
      case STATE_PAUSE: {
        guard.angle = guard.scanBase + Math.sin(guard.scanT * 0.9) * 0.65;
        guard.waitT -= dt;
        if (guard.waitT <= 0) {
          if (guard.loop) guard.wp = (guard.wp + 1) % guard.path.length;
          else {
            guard.wp += guard.dir;
            if (guard.wp >= guard.path.length) { guard.wp = guard.path.length - 2; guard.dir = -1; }
            if (guard.wp < 0) { guard.wp = 1; guard.dir = 1; }
          }
          guard.state = STATE_PATROL;
        }
        break;
      }
      case STATE_SUSPICIOUS: {
        const want = Math.atan2(player.y - guard.y, player.x - guard.x);
        guard.angle = angleLerpTurn(guard.angle, want, TURN_RATE * 1.4 * dt);
        guard.waitT -= dt;
        if (guard.waitT <= 0) {
          if (guard.meter > 0.28) startInvestigate(guard, player.x, player.y, null);
          else guard.state = STATE_PAUSE, guard.waitT = 0.4;
        }
        break;
      }
      case STATE_INVESTIGATE: {
        if (guard.target && moveToward(guard, guard.target.x, guard.target.y, SPEED_INVESTIGATE, dt, solids)) {
          guard.state = STATE_SEARCH;
          guard.waitT = 2.2;
          guard.scanBase = guard.angle;
        }
        break;
      }
      case STATE_SEARCH: {
        guard.angle = guard.scanBase + Math.sin(guard.scanT * 1.6) * 0.9;
        guard.waitT -= dt;
        if (guard.waitT <= 0) {
          guard.state = STATE_PATROL;
          // Resume at the nearest waypoint so the patrol stays learnable.
          let best = 0;
          let bestD = Infinity;
          guard.path.forEach(([px, py], i) => {
            const d = Math.hypot(px - guard.x, py - guard.y);
            if (d < bestD) { bestD = d; best = i; }
          });
          guard.wp = best;
        }
        break;
      }
      case STATE_HUNT: {
        const target = guard.target ?? state.lastSeen;
        if (target && moveToward(guard, target.x, target.y, SPEED_HUNT, dt, solids)) {
          guard.state = STATE_SEARCH;
          guard.waitT = 2.6;
          guard.scanBase = guard.angle;
        }
        break;
      }
      default:
        guard.state = STATE_PATROL;
    }

    // Footstep ticks for the audio layer: pan/volume are worked out by the caller.
    if (guard.moving) {
      guard.stepT -= dt;
      if (guard.stepT <= 0) {
        guard.stepT = 0.37;
        events.push({ type: 'gstep', guard });
      }
    }
  }

  // --- the alarm cools when nobody has seen the thief for a while -------------
  if (state.alarm) {
    if (!anySeeing) state.sinceSeen += dt;
    if (state.sinceSeen > ALARM_MEMORY) {
      state.alarm = false;
      for (const guard of state.guards) {
        if (guard.state === STATE_HUNT) guard.state = STATE_SEARCH, guard.waitT = 1.2;
        guard.meter = Math.min(guard.meter, 0.45);
      }
    }
  }
  state.anySeeing = anySeeing;
  return events;
}
