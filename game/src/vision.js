// Sight and light for Velvet Hour. A guard's vision cone is a fan of rays, each ray stopped by
// the first wall or piece of cover it meets, so crates and shelves cast true cone shadows.
// Lanterns pool light on the floor: a thief standing in a pool is seen quickly, one standing
// in shadow is seen slowly, and one behind cover is not seen at all. All geometry here is
// pure — guards.js asks who can be seen, render.js asks for the cone to draw.

/** How far a guard sees, and the half-angle of his cone, in radians. */
export const CONE_RANGE = 245;
export const CONE_HALF = 0.61;

/** Ambient light everywhere (moonlight through high windows); lanterns add on top. */
const AMBIENT = 0.3;

/** Distance from (px,py) along the unit ray (dx,dy) to the nearest solid rect, or `max`. */
function rayHit(px, py, dx, dy, solids, max) {
  let best = max;
  for (const r of solids) {
    // Slab test: intersect the ray with the rect's x span and y span.
    let tmin = 0;
    let tmax = best;
    if (Math.abs(dx) < 1e-9) {
      if (px < r.x || px > r.x + r.w) continue;
    } else {
      let t1 = (r.x - px) / dx;
      let t2 = (r.x + r.w - px) / dx;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }
    if (Math.abs(dy) < 1e-9) {
      if (py < r.y || py > r.y + r.h) continue;
    } else {
      let t1 = (r.y - py) / dy;
      let t2 = (r.y + r.h - py) / dy;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }
    if (tmin < best) best = tmin;
  }
  return best;
}

/** True when the straight line from (ax,ay) to (bx,by) crosses no solid rect. */
export function lineOfSight(ax, ay, bx, by, solids) {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return true;
  // Stop a hair short of the target so standing against cover does not block one's own view.
  return rayHit(ax, ay, dx / dist, dy / dist, solids, dist) >= dist - 2;
}

/** The cone polygon for a guard at (x,y) facing `angle`: his position plus the fan's rim. */
export function conePolygon(x, y, angle, solids, rays = 26) {
  const points = [{ x, y }];
  for (let i = 0; i <= rays; i += 1) {
    const a = angle - CONE_HALF + (2 * CONE_HALF * i) / rays;
    const d = rayHit(x, y, Math.cos(a), Math.sin(a), solids, CONE_RANGE);
    points.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d });
  }
  return points;
}

/** Light level 0..1 at a point: ambient plus the strongest lantern pool covering it. */
export function lightAt(x, y, lanterns) {
  let light = AMBIENT;
  for (const lamp of lanterns) {
    const d = Math.hypot(x - lamp.x, y - lamp.y);
    if (d < lamp.r) light = Math.max(light, AMBIENT + (1 - AMBIENT) * (1 - d / lamp.r));
  }
  return light;
}

/** A point is in shadow when the lantern light there is low — the thief's safe ground. */
export function inShadow(x, y, lanterns) {
  return lightAt(x, y, lanterns) < 0.42;
}

/**
 * Can the guard see the target? Inside the cone, inside range, with clear line of sight.
 * Returns 0 when unseen, else a 0..1 strength: nearer and better lit means seen harder.
 * `hideMul` shrinks the result for a target the ground itself hides — a thief crouched in
 * tall grass is a rumour, not a sighting (guards.js works the factor out per frame).
 */
export function seenStrength(guard, tx, ty, solids, lanterns, sneaking, hideMul = 1) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > CONE_RANGE) return 0;
  let diff = Math.atan2(dy, dx) - guard.angle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) > CONE_HALF) return 0;
  if (!lineOfSight(guard.x, guard.y, tx, ty, solids)) return 0;
  const proximity = 1.55 - dist / CONE_RANGE;
  const light = lightAt(tx, ty, lanterns);
  const lightFactor = light > 0.55 ? 1.5 : light > 0.42 ? 1.0 : 0.5;
  return proximity * lightFactor * (sneaking ? 0.72 : 1) * hideMul;
}

/** True when a point lies inside any rect of a list (grass beds, creaky board patches). */
export function insideAny(x, y, rects) {
  if (!rects) return false;
  for (const r of rects) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
  }
  return false;
}

/** True when a circle at (x,y) with radius r overlaps a solid rect (for movement collision). */
export function circleHits(x, y, r, solids) {
  for (const s of solids) {
    const nx = Math.max(s.x, Math.min(x, s.x + s.w));
    const ny = Math.max(s.y, Math.min(y, s.y + s.h));
    if ((x - nx) * (x - nx) + (y - ny) * (y - ny) < r * r) return true;
  }
  return false;
}
