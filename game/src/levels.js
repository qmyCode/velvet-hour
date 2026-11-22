// The six vaults of Velvet Hour, as data: walls and cover (both solid, both block sight),
// lantern light pools, guard patrols, the Aurelian Star, the exit door and the thief's entry
// point. Each vault also carries tall-grass beds (a crouched thief inside is nearly invisible),
// creaky board patches (loud underfoot even sneaking) and three loose valuables worth lifting
// on the way. The floor is 1280 by 800 with a 24px stone border.
//
// Every vault is a floor plan, not a field: partitioned chambers joined by offset doorways,
// so sightlines break at every threshold and each room poses its own problem — its own lamp
// pool, its own cover, its own patrol. There are always two ways through: the lit fast route
// past the lamps, and the shadowed slow route along the walls. Lanterns are furniture, not
// weather: each entry names its fixture — 'hang' for a lantern on a chain, 'stand' for a
// floor lamp — and the renderer draws the object inside its pool. Patrols run along open
// floor and through doorways; each later vault adds a guard, a room or a longer route.

const W = (x, y, w, h) => ({ x, y, w, h, kind: 'wall' });
const CRATE = (x, y, w, h) => ({ x, y, w, h, kind: 'crate' });
const SHELF = (x, y, w, h) => ({ x, y, w, h, kind: 'shelf' });
const LAMP = (x, y, r, kind = 'hang') => ({ x, y, r, kind });
const RUG = (x, y, w, h, c) => ({ x, y, w, h, c });

/** The stone border every vault shares. */
function border() {
  return [W(0, 0, 1280, 24), W(0, 776, 1280, 24), W(0, 0, 24, 800), W(1256, 0, 24, 800)];
}

export const LEVELS = [
  {
    name: 'Vault 1 — The Foyer',
    sub: 'Three rooms, one guard. Learn his walk.',
    walls: [
      ...border(),
      W(430, 24, 20, 332), W(430, 444, 20, 332),
      W(850, 24, 20, 96), W(850, 208, 20, 568),
      W(870, 470, 130, 20), W(1084, 470, 172, 20),
    ],
    cover: [
      CRATE(150, 560, 80, 44), CRATE(300, 150, 44, 80),
      SHELF(560, 560, 180, 38), CRATE(720, 180, 44, 44),
      SHELF(920, 330, 200, 38), CRATE(1150, 300, 44, 44), CRATE(930, 560, 80, 44),
    ],
    lanterns: [
      LAMP(230, 240, 160, 'stand'), LAMP(650, 390, 190), LAMP(650, 150, 150),
      LAMP(1060, 240, 165), LAMP(1060, 620, 165, 'stand'),
    ],
    guards: [{ path: [[170, 400], [770, 400]], pause: 2.2 }],
    star: { x: 1120, y: 130 },
    exit: { x: 1196, y: 664, w: 60, h: 112 },
    start: { x: 95, y: 690 },
    boards: [{ x: 24, y: 24, w: 406, h: 230 }, { x: 450, y: 300, w: 400, h: 200 }],
    rugs: [RUG(520, 320, 260, 160, '#4a2a3d'), RUG(950, 90, 220, 110, '#2c3d63')],
    grass: [{ x: 890, y: 50, w: 110, h: 75 }, { x: 56, y: 470, w: 96, h: 70 }],
    creak: [{ x: 786, y: 124, w: 56, h: 76 }],
    loot: [{ x: 1130, y: 640 }, { x: 180, y: 120 }, { x: 640, y: 690 }],
  },
  {
    name: 'Vault 2 — The Gallery',
    sub: 'Four galleries around a crossing. Corridors make timetables.',
    walls: [
      ...border(),
      W(580, 24, 20, 150), W(580, 254, 20, 96), W(580, 450, 20, 140), W(580, 670, 20, 106),
      W(680, 24, 20, 220), W(680, 324, 20, 26), W(680, 450, 20, 90), W(680, 620, 20, 156),
      W(24, 350, 226, 20), W(330, 350, 250, 20), W(700, 350, 250, 20), W(1030, 350, 226, 20),
      W(24, 430, 180, 20), W(284, 430, 296, 20), W(700, 430, 330, 20), W(1110, 430, 146, 20),
    ],
    cover: [
      SHELF(140, 140, 240, 38), SHELF(140, 250, 240, 38), CRATE(470, 90, 44, 44),
      SHELF(900, 140, 240, 38), SHELF(880, 250, 200, 38), CRATE(760, 90, 44, 44),
      SHELF(140, 540, 240, 38), CRATE(470, 650, 44, 44),
      SHELF(900, 540, 240, 38), CRATE(760, 650, 44, 44),
    ],
    lanterns: [
      LAMP(300, 190, 170), LAMP(980, 190, 170),
      LAMP(300, 610, 170, 'stand'), LAMP(980, 610, 170, 'stand'),
      LAMP(640, 400, 155),
    ],
    guards: [
      { path: [[80, 400], [1200, 400]], pause: 1.6 },
      { path: [[640, 80], [640, 720]], pause: 1.6 },
    ],
    star: { x: 90, y: 110 },
    exit: { x: 1196, y: 664, w: 60, h: 112 },
    start: { x: 90, y: 690 },
    boards: [{ x: 24, y: 24, w: 556, h: 180 }, { x: 700, y: 596, w: 556, h: 180 }],
    rugs: [RUG(560, 360, 160, 80, '#4a2a3d'), RUG(120, 600, 200, 90, '#2c3d63'), RUG(960, 90, 200, 90, '#2c3d63')],
    grass: [{ x: 60, y: 470, w: 110, h: 80 }, { x: 1110, y: 250, w: 110, h: 80 }],
    creak: [{ x: 520, y: 378, w: 60, h: 44 }],
    loot: [{ x: 1180, y: 140 }, { x: 120, y: 700 }, { x: 665, y: 60 }],
  },
  {
    name: 'Vault 3 — The Counting House',
    sub: 'Six rooms around a locked chamber. The guard has the run of it.',
    walls: [
      ...border(),
      W(480, 200, 110, 24), W(670, 200, 130, 24), W(480, 536, 320, 24),
      W(480, 200, 24, 150), W(480, 410, 24, 150),
      W(776, 200, 24, 150), W(776, 410, 24, 150),
      W(480, 140, 20, 60), W(780, 140, 20, 60),
      W(24, 380, 276, 20), W(380, 380, 100, 20),
      W(800, 380, 100, 20), W(980, 380, 276, 20),
    ],
    cover: [
      SHELF(90, 160, 220, 38), SHELF(90, 270, 220, 38), CRATE(370, 180, 44, 44),
      CRATE(120, 470, 80, 44), CRATE(330, 640, 44, 80),
      CRATE(700, 462, 56, 40),
      SHELF(860, 300, 150, 36),
      CRATE(880, 470, 80, 44), CRATE(880, 540, 80, 44), CRATE(1120, 660, 44, 44),
    ],
    lanterns: [
      LAMP(390, 300, 165), LAMP(250, 580, 170, 'stand'), LAMP(640, 105, 160),
      LAMP(640, 300, 150), LAMP(1030, 190, 170), LAMP(1030, 580, 170, 'stand'),
    ],
    guards: [
      { path: [[540, 380], [740, 380]], pause: 1.2 },
      { path: [[180, 110], [1100, 110]], pause: 1.8 },
    ],
    star: { x: 706, y: 296 },
    exit: { x: 24, y: 664, w: 60, h: 112 },
    start: { x: 1190, y: 120 },
    boards: [{ x: 24, y: 24, w: 456, h: 356 }, { x: 800, y: 400, w: 456, h: 376 }],
    rugs: [RUG(545, 285, 190, 170, '#4a2a3d'), RUG(140, 430, 220, 100, '#2c3d63'), RUG(565, 55, 150, 95, '#2c3d63')],
    grass: [
      { x: 505, y: 455, w: 85, h: 60 },
      { x: 860, y: 80, w: 150, h: 95 }, { x: 1080, y: 230, w: 140, h: 85 },
      { x: 120, y: 650, w: 110, h: 75 },
    ],
    creak: [{ x: 428, y: 404, w: 44, h: 48 }, { x: 600, y: 86, w: 80, h: 40 }],
    loot: [{ x: 420, y: 700 }, { x: 1180, y: 520 }, { x: 1200, y: 200 }],
  },
  {
    name: 'Vault 4 — The Archive',
    sub: 'Three chambers of shelves, three guards, and a long way home.',
    walls: [
      ...border(),
      W(420, 24, 20, 296), W(420, 400, 20, 200), W(420, 670, 20, 106),
      W(860, 24, 20, 106), W(860, 200, 20, 120), W(860, 400, 20, 200), W(860, 680, 20, 96),
    ],
    cover: [
      SHELF(120, 120, 240, 38), SHELF(120, 520, 240, 38), CRATE(300, 240, 44, 44),
      SHELF(520, 110, 38, 220), SHELF(700, 440, 38, 240), CRATE(560, 600, 44, 44),
      SHELF(930, 150, 120, 38), SHELF(930, 560, 120, 38), CRATE(1120, 300, 44, 44), CRATE(930, 660, 44, 44),
    ],
    lanterns: [
      LAMP(230, 220, 165), LAMP(230, 640, 150, 'stand'), LAMP(640, 400, 180),
      LAMP(1040, 220, 165), LAMP(1040, 640, 150, 'stand'),
    ],
    guards: [
      { path: [[120, 360], [1160, 360]], pause: 1.4 },
      { path: [[640, 110], [640, 690]], pause: 1.4 },
      { path: [[1080, 690], [1080, 110]], pause: 1.4 },
    ],
    star: { x: 1150, y: 720 },
    exit: { x: 24, y: 48, w: 60, h: 100 },
    start: { x: 620, y: 720 },
    boards: [{ x: 440, y: 24, w: 420, h: 110 }, { x: 24, y: 600, w: 396, h: 176 }],
    rugs: [RUG(470, 330, 340, 60, '#4a2a3d'), RUG(90, 600, 180, 90, '#2c3d63')],
    grass: [{ x: 48, y: 180, w: 110, h: 80 }, { x: 1100, y: 460, w: 120, h: 85 }],
    creak: [{ x: 448, y: 332, w: 64, h: 56 }],
    loot: [{ x: 90, y: 470 }, { x: 700, y: 120 }, { x: 1150, y: 130 }],
  },
  {
    name: 'Vault 5 — The Treasury',
    sub: 'Four treasuries around a spine, three guards, no wasted shadow.',
    walls: [
      ...border(),
      W(628, 24, 24, 200), W(628, 330, 24, 180), W(628, 616, 24, 160),
      W(24, 380, 256, 20), W(360, 380, 268, 20),
      W(652, 380, 248, 20), W(980, 380, 276, 20),
    ],
    cover: [
      SHELF(150, 170, 220, 38), SHELF(150, 560, 220, 38), CRATE(480, 640, 44, 44),
      CRATE(1020, 170, 80, 44), CRATE(1020, 560, 80, 44), CRATE(760, 600, 44, 44),
    ],
    lanterns: [
      LAMP(470, 130, 170), LAMP(300, 690, 170, 'stand'),
      LAMP(960, 190, 170), LAMP(960, 590, 170, 'stand'),
      LAMP(640, 277, 140),
    ],
    guards: [
      { path: [[140, 290], [560, 290]], pause: 1.5 },
      { path: [[700, 290], [1140, 290]], pause: 1.5 },
      { path: [[940, 140], [940, 660]], pause: 1.2 },
    ],
    star: { x: 140, y: 110 },
    exit: { x: 1196, y: 664, w: 60, h: 112 },
    start: { x: 140, y: 690 },
    boards: [{ x: 24, y: 24, w: 604, h: 150 }, { x: 652, y: 626, w: 604, h: 150 }],
    rugs: [RUG(240, 320, 220, 50, '#4a2a3d'), RUG(820, 320, 220, 50, '#4a2a3d'), RUG(240, 430, 220, 120, '#2c3d63')],
    grass: [{ x: 700, y: 470, w: 120, h: 80 }, { x: 80, y: 300, w: 100, h: 64 }],
    creak: [{ x: 580, y: 250, w: 44, h: 64 }],
    loot: [{ x: 320, y: 650 }, { x: 1100, y: 120 }, { x: 170, y: 470 }],
  },
  {
    name: 'Vault 6 — The Star Vault',
    sub: 'Four guards around one room. The Star is already shining.',
    walls: [
      ...border(),
      W(490, 250, 300, 24), W(490, 526, 300, 24),
      W(490, 250, 24, 110), W(490, 440, 24, 110),
      W(766, 250, 24, 110), W(766, 440, 24, 110),
      W(24, 390, 196, 20), W(340, 390, 150, 20),
      W(790, 390, 130, 20), W(1030, 390, 226, 20),
    ],
    cover: [
      CRATE(150, 215, 70, 40), CRATE(1060, 215, 70, 40),
      CRATE(180, 600, 80, 44), CRATE(1000, 600, 80, 44),
      SHELF(330, 290, 140, 36), SHELF(810, 290, 140, 36),
    ],
    lanterns: [
      LAMP(640, 388, 125), LAMP(210, 180, 155), LAMP(1070, 180, 155),
      LAMP(310, 695, 155, 'stand'), LAMP(970, 695, 155, 'stand'),
      LAMP(640, 105, 145),
    ],
    guards: [
      { path: [[170, 290], [640, 100], [1110, 290], [640, 720]], pause: 0.6, loop: true },
      { path: [[640, 720], [1110, 290], [640, 100], [170, 290]], pause: 0.6, loop: true },
      { path: [[300, 600], [980, 600]], pause: 1.0 },
      { path: [[200, 110], [1080, 110]], pause: 2.0 },
    ],
    star: { x: 640, y: 388 },
    exit: { x: 590, y: 700, w: 100, h: 76 },
    start: { x: 90, y: 110 },
    boards: [{ x: 24, y: 24, w: 1232, h: 86 }, { x: 24, y: 690, w: 1232, h: 86 }],
    rugs: [RUG(545, 300, 190, 176, '#4a2a3d'), RUG(120, 90, 160, 90, '#2c3d63'), RUG(1000, 620, 160, 90, '#2c3d63')],
    grass: [{ x: 330, y: 560, w: 110, h: 70 }, { x: 840, y: 170, w: 110, h: 70 }],
    creak: [{ x: 600, y: 150, w: 80, h: 40 }, { x: 600, y: 640, w: 80, h: 40 }],
    loot: [{ x: 760, y: 655 }, { x: 120, y: 690 }, { x: 1160, y: 120 }],
  },
];

/** Every solid rect of a level (walls plus cover), the list sight and movement test against. */
export function solidsOf(level) {
  return level.walls.concat(level.cover);
}
