import '../src/data/installAll';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { buildGrid, buildProgress, serializeGrid, serializeProgress } from '../tests/helpers/eligibilityGolden';

/**
 * 기존 사건 자격 골든 만들기 (SPEC-018 1단계, docs/data/persona-model.md 3절 `[CX-002-004]`).
 *
 *   npm run gen:golden                      tests/fixtures/eligibility-golden.json(사건 격자)과 eligibility-golden-progress.json(진행 표본)을 쓴다
 *   npm run gen:golden -- --out-dir <폴더>  다른 폴더에 쓴다(결정론 확인용 — 덮어쓰기 보호가 없다)
 *   npm run gen:golden -- --force           이미 있는 골든을 덮어쓴다 — **마스터 승인 필요**
 *
 * **변경 전 코드에서만 생성한다**: 기준 커밋 SHA = BASE_SHA(SPEC-018 구현 전 `src/`). 구현이 시작된 뒤에는 이 스크립트를 돌려 골든을 만들지 않는다 —
 * 골든은 「변경 전 동작」이어야 의미가 있고, 다시 만들면 회귀를 못 잡는다(One-way에 가깝다). 재생성은 마스터 승인.
 * 결과는 결정론이다(키 정렬 · LF · 시계·난수 없음). 시험은 이 파일을 쓰지 않는다.
 */

/** 골든을 만든 코드의 커밋 — `src/`는 이 커밋 그대로였다(작업 트리의 다른 변경은 문서·QA 스크립트뿐) */
const BASE_SHA = '2f0239e134be687773b7d3e39385fb21dea09a09';

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out-dir');
const outDir = outIdx >= 0 ? args[outIdx + 1] : 'tests/fixtures';
const force = args.includes('--force') || outIdx >= 0;
const GRID_PATH = `${outDir}/eligibility-golden.json`;
const PROGRESS_PATH = `${outDir}/eligibility-golden-progress.json`;

if (!force && (existsSync(GRID_PATH) || existsSync(PROGRESS_PATH))) {
  console.error(`골든이 이미 있다(${GRID_PATH}). 재생성은 One-way에 가까워 마스터 승인이 필요하다 — 승인되면 --force.`);
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const grid = buildGrid(undefined, BASE_SHA);
writeFileSync(GRID_PATH, serializeGrid(grid), 'utf-8');
const progress = buildProgress(undefined, BASE_SHA);
writeFileSync(PROGRESS_PATH, serializeProgress(progress), 'utf-8');
console.log(`격자: 사건 ${grid.meta.events}개 · 칸 ${grid.meta.cells}개 · 상태 ${grid.meta.states}개 → ${GRID_PATH}`);
console.log(`진행 표본: ${progress.meta.lives}판 → ${PROGRESS_PATH}`);
