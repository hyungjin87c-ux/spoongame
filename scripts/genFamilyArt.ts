import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { figureMarkup, infantCarriedMarkup } from '../src/data/familyArt/figure';
import { detachedH1Markup } from '../src/data/familyArt/house';
import { FIGURE_ID, INFANT_CARRIED, type FigureGroup, type OutfitEra } from '../src/data/sceneTables';

/**
 * 집과 가족 그림 조각 덩어리 만들기 (SPEC-009 FM5): designer가 그린 조각 SVG(`docs/design/mockups/family/pieces/s1/<id>.svg`)의 안쪽 마크업을 뽑아 `src/data/familyArt/pieces.json`을 다시 만든다.
 * 새 조각이 도착하면 SVG 파일을 그 폴더에 두고 `src/data/sceneTables.ts`의 `drawn`을 true로 바꾼 뒤 이 스크립트를 한 번 돌린다(designer의 파일은 고치지 않는다 — 읽기만 한다).
 *
 * 뽑지 않는 것: 식구(`fig-*`)·업힌 아기 · 지붕 파라미터가 있는 `house-detached-h1`은 코드(`familyArt/figure.ts`·`house.ts`)가 만든다 — 시안 SVG와 **바이트가 같은지** 이 스크립트가 대조한다(다르면 실패).
 * 시대의 창 그림(`era-*`)은 승인된 것만 `data/eraWindows/`에 들어가므로 여기서 뽑지 않는다.
 * 실행: `npm run gen:art` (= vite-node scripts/genFamilyArt.ts). 점검만: `--check` (파일을 쓰지 않고 지금 파일과 같은지 본다).
 */

const DIR = 'docs/design/mockups/family/pieces/s1/';
const OUT = 'src/data/familyArt/pieces.json';
const check = process.argv.includes('--check');

function innerOf(file: string): string {
  const raw = readFileSync(DIR + file, 'utf-8');
  const m = /<g>([\s\S]*)<\/g><\/svg>\s*$/.exec(raw);
  if (m === null) throw new Error(`${file}: 조각 마크업을 찾지 못했다`);
  return m[1];
}

const pieces: Record<string, string> = {};
const mismatches: string[] = [];
let figuresChecked = 0;
for (const file of readdirSync(DIR).sort()) {
  if (!file.endsWith('.svg')) continue;
  const id = file.slice(0, -4);
  if (id.startsWith('era-')) continue;
  const inner = innerOf(file);
  const fig = FIGURE_ID.exec(id);
  if (fig !== null) {
    figuresChecked++;
    const code = figureMarkup(fig[1] as FigureGroup, fig[2] as 'f' | 'm', fig[3] as OutfitEra);
    if (code !== inner) mismatches.push(`${id}: 코드가 만든 식구 조각이 시안과 다르다`);
    continue;
  }
  if (id === INFANT_CARRIED) {
    if (infantCarriedMarkup() !== inner) mismatches.push(`${id}: 코드가 만든 업힌 아기가 시안과 다르다`);
    continue;
  }
  if (id === 'house-detached-h1') {
    if (detachedH1Markup('thatch') !== inner) mismatches.push(`${id}: 코드가 만든 초가 집이 시안과 다르다`);
    continue;
  }
  pieces[id] = inner;
}
if (mismatches.length > 0) {
  console.error(mismatches.join('\n'));
  process.exit(1);
}

const text = JSON.stringify(pieces, null, 1) + '\n';
if (check) {
  const now = readFileSync(OUT, 'utf-8');
  if (now !== text) {
    console.error(`${OUT}가 시안 SVG와 다르다 — npm run gen:art로 다시 만든다`);
    process.exit(1);
  }
  console.log(`통과: 조각 ${Object.keys(pieces).length}개, 식구 ${figuresChecked}개가 시안과 바이트 일치`);
} else {
  writeFileSync(OUT, text, 'utf-8');
  console.log(`${OUT}: 조각 ${Object.keys(pieces).length}개 (식구 ${figuresChecked}개가 시안과 바이트 일치)`);
}
