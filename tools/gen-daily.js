/* Makes the daily-challenge bank: three levels for every day (easy, medium, hard), each one a SHIELD level: its best solution needs a guard standing in a camera's beam
   (without that the best way out is at least 2 actions longer, or there is none). Medium and hard levels mix in the day's extra item.
   usage: node tools/gen-daily.js <fromDay> <toDay> <out.jsonl> [--worker i --of n] [--only rejects.txt]       (resumes: levels already in the file are skipped)
   env: GEN_SCALE (multiplies the time budgets, default 1) */
'use strict';
const fs = require('fs'), P = require('../src/prison.js');
const [from, to, out] = [Number(process.argv[2]), Number(process.argv[3]), process.argv[4]];
const arg = n => { const i = process.argv.indexOf('--' + n); return i > 0 ? Number(process.argv[i + 1]) : null; };
const onlyF = process.argv.indexOf('--only') > 0 ? process.argv[process.argv.indexOf('--only') + 1] : null;       // a rejects file from build-daily: only these "day tier" pairs
const only = onlyF ? new Set(fs.readFileSync(onlyF, 'utf8').split('\n').filter(Boolean).map(l => l.trim().replace(/\s+/, ':'))) : null;
const worker = arg('worker') || 0, of = arg('of') || 1, scale = Number(process.env.GEN_SCALE || 1);
const done = new Set(); if (fs.existsSync(out)) for (const l of fs.readFileSync(out, 'utf8').split('\n')) if (l.trim()) { const d = JSON.parse(l); done.add(d.day + ':' + d.tier); }
/* what the day's extra is: 0 doors, 1 mirrors, 2 dogs (with two doors), 3 searchlights, 4 a power panel (wired to a camera and a door), 5 glass, 6 door + mirror */
const THEMES = ['door', 'mirror', 'dog', 'light', 'panel', 'glass', 'door+mirror'];
function specFor(day, tier, attempt) {
  const rnd = P.mulberry32(day * 31 + tier * 7 + 5), pick = a => a[(rnd() * a.length) | 0], theme = day % 7;
  const extra = { doors: 0, mirrors: 0, dogs: 0, lights: 0, panels: 0, glass: 0, wire: 2 };
  const addTheme = (big) => {
    if (attempt >= 2 && ((theme === 6 && tier === 0) || (theme === 1 && tier === 2))) { if (theme === 6) extra.doors = 1; else extra.mirrors = 1; return; }       // a lighter extra when the full one does not fit the board
    if (theme === 0) extra.doors = big ? 2 : 1; else if (theme === 1) extra.mirrors = big ? 2 : 1;
    else if (theme === 2) { if (big) { extra.dogs = 1; extra.doors = 2; } else extra.doors = 1; }
    else if (theme === 3) extra.lights = 1; else if (theme === 4) { extra.panels = 1; extra.doors = 1; } else if (theme === 5) extra.glass = big ? 2 : 1;
    else { extra.doors = 1; extra.mirrors = 1; }
  };
  let spec;
  if (tier === 0) { const [w, h] = pick(process.env.EASY_BIG ? [[7, 6], [6, 7], [7, 7]] : [[6, 6], [7, 6], [6, 7]]); spec = { w, h, blocks: pick([1, 2]), cams: 2, guards: 2, par: pick([4, 4, 5]), timeMs: 12000, cap: 30000 }; if (day % 7 >= 5) addTheme(false); }
  else if (tier === 1) { spec = { w: 7, h: 7, blocks: pick([2, 3]), cams: 2, guards: 2, par: pick([6, 7]), timeMs: 10000, cap: 40000 }; addTheme(false); }
  else { const [w, h] = pick([[8, 7], [8, 8]]); spec = { w, h, blocks: pick([3, 4]), cams: theme === 2 ? 2 : 3, guards: 2, par: pick([8, 9, 10]), timeMs: 14000, cap: 60000 }; addTheme(true); }
  spec = Object.assign(spec, extra, { needShield: true, shieldMin: tier === 0 || attempt >= (tier === 2 ? 2 : 3) ? 1 : 2, minUnused: tier === 0 ? 1 : 2, phasesLo: 1, phasesHi: 99 });
  spec.par = Math.max(2, spec.par - (attempt >= (tier === 2 ? 3 : 4) ? 1 : 0) - (attempt >= (tier === 2 ? 6 : 7) ? 1 : 0));
  spec.timeMs = Math.round(spec.timeMs * scale);
  return { spec, theme: THEMES[theme] };
}
const t00 = Date.now(); let made = 0, failed = 0;
for (let day = from; day <= to; day++) {
  if (day % of !== worker) continue;
  for (let tier = 0; tier < 3; tier++) {
    if (done.has(day + ':' + tier) || (only && !only.has(day + ':' + tier))) continue;
    let res = null, used = null, t0 = Date.now();
    for (let attempt = 0; attempt < (tier === 2 ? 9 : 12) && !res; attempt++) {
      const { spec, theme } = specFor(day, tier, attempt), seed = day * 1000 + tier * 100 + attempt + (Number(process.env.SEED_OFFSET) || 0);
      const r = P.genLevel(spec, seed, spec.par, 2500); if (!r) continue;
      const m = P.toMap(r.level), back = P.parseLevel(m.map, m.meta); P.prepare(back);
      const chk = P.solve(back, { maxDepth: 40 }); if (!chk || !chk.solvable || chk.par !== r.par) continue;       // the ASCII form must give the same level back
      const G = P.ghostOf(back); P.prepare(G); const e = P.evalConfig(G, P.initialDigits(G), false); if (e.lit[back.S] || e.occ[back.S]) continue;
      const rg = P.solve(G, { maxDepth: 40 }); if (rg && rg.solvable && rg.par < r.par + spec.shieldMin) continue;   // (the generator checked this already; this is the independent re-check)
      res = { day, tier, theme, map: m.map, meta: m.meta, par: r.par, phases: r.phases, used: r.used, total: r.total, ghostPar: rg && rg.solvable ? rg.par : null, seed, attempt, ms: Date.now() - t0 };
    }
    if (res) { fs.appendFileSync(out, JSON.stringify(res) + '\n'); made++; console.error(`day ${day} tier ${tier} (${res.theme}) par ${res.par} ghost ${res.ghostPar == null ? 'none' : res.ghostPar} attempt ${res.attempt} ${res.ms}ms | ${made} made, ${failed} failed, ${Math.round((Date.now() - t00) / 1000)}s`); }
    else { failed++; console.error(`day ${day} tier ${tier}: FAILED`); }
  }
}
console.error(`worker ${worker}/${of} done: ${made} made, ${failed} failed, ${Math.round((Date.now() - t00) / 1000)}s`);
