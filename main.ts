// main.ts — EMBERLINE 11 hand-in program (Node 22, standard library only).
// Copies game/ and screenshots/ from this repository into the output directory
// and writes /output/dossier.json with buildDossier from vendor/makefun-game.ts.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { buildDossier } from './vendor/makefun-game.ts';

const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
mkdirSync(outDir, { recursive: true });
cpSync('game', outDir + '/game', { recursive: true });
cpSync('screenshots', outDir + '/screenshots', { recursive: true });
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(outDir + '/dossier.json', dossier);
console.log('EMBERLINE 11: wrote ' + outDir + '/dossier.json (' + dossier.length + ' bytes)');
