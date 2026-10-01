/* The difficulty ramp: what every level n (1..120) is made of. Twelve blocks of ten.
   cams/guards/doors/mirrors are counts, par is the number of actions the best solution takes. */
'use strict';
const BLOCKS = [
  { name: 'Cells I',    grid: [[5,5],[5,5],[5,6],[6,5],[6,5],[6,6],[6,6],[6,6],[6,6],[6,6]], blocks: [1,1,2,2,2,3,3,3,3,3], cams: [1,1,1,2,2,2,2,2,2,2], guards: 0, doors: 0, mirrors: 0, par: [1,2,3,2,3,3,4,4,5,5] },
  { name: 'Cells II',   grid: [[6,6],[6,6],[6,7],[6,7],[7,6],[7,6],[7,7],[7,7],[7,7],[7,7]], blocks: [3,3,4,4,4,4,5,5,5,5], cams: [2,2,2,3,3,3,3,3,3,3], guards: 0, doors: 0, mirrors: 0, par: [4,4,5,5,6,6,6,7,7,7] },
  { name: 'Cells III',  grid: [[7,7],[7,7],[7,7],[7,8],[8,7],[8,7],[8,8],[8,8],[8,8],[8,8]], blocks: [5,5,5,6,6,6,7,7,7,7], cams: [3,3,4,4,4,4,5,5,5,6], guards: 0, doors: 0, mirrors: 0, par: [6,7,8,8,9,9,10,10,11,12], cap: 60000, timeMs: 40000 },
  { name: 'Yard I',     grid: [[6,6],[6,6],[6,6],[7,6],[7,6],[7,7],[7,7],[7,7],[7,7],[7,7]], blocks: [2,2,3,3,3,4,4,4,4,4], cams: [1,1,1,2,2,2,1,2,2,2], guards: 1, doors: 0, mirrors: 0, par: [2,3,4,5,5,6,6,7,7,8] },
  { name: 'Yard II',    grid: [[7,7],[7,7],[7,7],[7,7],[7,7],[7,7],[8,7],[8,7],[8,7],[8,7]], blocks: [3,3,3,4,4,4,5,5,5,5], cams: [2,2,2,2,3,3,3,3,3,3], guards: [1,1,1,2,2,2,2,2,2,2], doors: 0, mirrors: 0, par: [5,6,6,7,7,8,8,9,9,10], cap: 40000, timeMs: 40000 },
  { name: 'Yard III',   grid: [[7,7],[7,7],[7,7],[8,7],[8,7],[8,7],[8,8],[8,8],[8,8],[8,8]], blocks: [4,4,4,5,5,5,6,6,6,6], cams: [2,2,3,3,3,3,3,3,3,3], guards: 2, doors: 0, mirrors: 0, par: [7,8,8,9,9,10,10,11,11,12], cap: 60000, timeMs: 45000 },
  { name: 'Block A I',  grid: [[6,6],[6,6],[6,6],[6,7],[7,6],[7,6],[7,7],[7,7],[7,7],[7,7]], blocks: [2,2,2,3,3,3,4,4,4,4], cams: [1,1,2,2,2,2,2,2,1,2], guards: [0,0,0,0,0,0,0,1,1,1], doors: [1,1,1,1,2,2,2,2,2,2], mirrors: 0, par: [3,4,4,5,5,6,6,7,8,9] },
  { name: 'Block A II', grid: [[7,7],[7,7],[7,7],[7,7],[7,7],[8,7],[8,7],[8,7],[8,8],[8,8]], blocks: [3,3,4,4,4,5,5,5,6,6], cams: 2, guards: [0,0,0,1,1,1,1,1,1,1], doors: [2,2,2,2,3,3,3,3,3,3], mirrors: 0, par: [5,6,6,7,7,8,8,9,10,11], cap: 50000, timeMs: 45000 },
  { name: 'Mirrors I',  grid: [[6,6],[6,6],[6,6],[6,7],[6,7],[7,6],[7,7],[7,7],[7,7],[7,7]], blocks: [2,2,2,3,3,3,4,4,4,4], cams: [1,1,1,2,2,2,2,2,2,2], guards: 0, doors: 0, mirrors: [1,1,1,2,2,2,2,2,2,2], par: [2,3,3,4,4,5,5,6,6,7] },
  { name: 'Mirrors II', grid: [[7,7],[7,7],[7,7],[7,7],[7,7],[7,7],[8,7],[8,7],[8,8],[8,8]], blocks: [3,3,4,4,4,4,5,5,6,6], cams: [2,2,2,2,2,3,3,3,3,3], guards: 0, doors: [0,0,0,1,1,1,1,1,1,1], mirrors: [2,2,3,3,3,3,3,3,3,3], par: [4,5,5,6,6,7,7,8,8,9], cap: 50000, timeMs: 45000, minUnused: 2 },
  { name: 'Control I',  grid: [[7,7],[7,7],[7,7],[7,7],[8,7],[8,7],[8,7],[8,8],[8,8],[8,8]], blocks: [3,3,4,4,5,5,5,6,6,6], cams: [2,2,2,3,2,2,3,3,3,3], guards: 1, doors: [1,1,1,1,2,2,2,2,2,2], mirrors: [0,0,1,0,0,1,0,1,1,1], par: [8,8,9,9,10,10,11,11,12,12], cap: 60000, timeMs: 60000, minUnused: 2 },
  { name: 'Control II', grid: [[8,7],[8,7],[8,7],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8],[8,8]], blocks: [4,4,5,5,5,6,6,6,6,6], cams: [2,2,3,3,3,3,3,3,3,3], guards: [1,1,1,1,1,1,2,2,2,2], doors: [1,1,2,2,2,2,2,2,2,2], mirrors: [1,1,1,1,1,1,1,1,2,2], par: [9,9,10,10,11,11,12,12,13,14], cap: 80000, timeMs: 80000, minUnused: 2 },
];
const pick = (v, i) => Array.isArray(v) ? v[i] : v;
function specFor(n) {
  const b = BLOCKS[Math.floor((n - 1) / 10)], i = (n - 1) % 10;
  return { name: b.name, w: b.grid[i][0], h: b.grid[i][1], blocks: pick(b.blocks, i), cams: pick(b.cams, i), guards: pick(b.guards, i), doors: pick(b.doors, i), mirrors: pick(b.mirrors, i),
    par: b.par[i], cap: b.cap || 20000, timeMs: b.timeMs || 25000, minUnused: b.minUnused };
}
module.exports = { BLOCKS, specFor };
