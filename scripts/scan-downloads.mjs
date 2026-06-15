// scan-downloads.mjs — classify which ~/Downloads Bing CSVs are PAWN scrapes,
// so the same folder can hold scrapes for sibling verticals without confusion.
//
//   node scripts/scan-downloads.mjs            # report each CSV's pawn-row share
//   node scripts/scan-downloads.mjs --list     # print only the pawn CSV paths
//
// A file counts as "pawn" when >= 60% of its GA rows classify as pawn/valuables.

import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { rowsOf, isPawnRow, isGA } from './gate.mjs';

const DOWNLOADS = `${process.env.HOME}/Downloads`;
const LIST_ONLY = process.argv.includes('--list');
const THRESHOLD = 0.6;

const files = existsSync(DOWNLOADS)
  ? readdirSync(DOWNLOADS).filter(f => /^Bing_Maps_Scraper_.*\.csv$/i.test(f)).sort()
  : [];

const pawnFiles = [];
for (const f of files) {
  const path = join(DOWNLOADS, f);
  let rows = [];
  try { rows = rowsOf(path); } catch { continue; }
  const ga = rows.filter(r => isGA(r['Address'] || ''));
  if (!ga.length) continue;
  const pawn = ga.filter(isPawnRow).length;
  const share = pawn / ga.length;
  const isPawn = share >= THRESHOLD;
  if (isPawn) pawnFiles.push(path);
  if (!LIST_ONLY) {
    console.log(`${isPawn ? 'PAWN ' : '     '} ${(share * 100).toFixed(0).padStart(3)}%  ${pawn}/${ga.length} GA rows  ${f}`);
  }
}

if (LIST_ONLY) pawnFiles.forEach(p => console.log(p));
else console.log(`\n${pawnFiles.length} of ${files.length} CSV(s) are pawn scrapes (>= ${THRESHOLD * 100}% GA pawn rows).`);
