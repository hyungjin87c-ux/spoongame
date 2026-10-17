import { readFileSync, writeFileSync } from 'node:fs';
import { PAIRS, checkTheme, darkMismatch, docCssPairs, formatReport, readThemeBlocks, themeTokens, type PairResult } from './checkContrastLib';

/**
 * 색 토큰 대비 점검 실행기 (SPEC-003 DS3, designer).
 *   npx vite-node scripts/checkContrast.ts            — 점검만 (실패가 있으면 종료 코드 1)
 *   npx vite-node scripts/checkContrast.ts --write    — docs/design/contrast-report.md 도 새로 쓴다
 * 계산은 scripts/checkContrastLib.ts (새 의존성 없음, 순수 함수).
 */
const TOKENS_PATH = 'src/styles/tokens.css';
const DOC_CSS_PATH = 'src/styles/doc.css';
const REPORT_PATH = 'docs/design/contrast-report.md';

const blocks = readThemeBlocks(readFileSync(TOKENS_PATH, 'utf-8'));
const mismatch = darkMismatch(blocks);
// 토큰 쌍 + 화면 CSS가 불투명도로 합성하는 장식 글자·도형(도장 「접수」 등 — 면제 없음, QM3-5)
const pairs = [...PAIRS, ...docCssPairs(readFileSync(DOC_CSS_PATH, 'utf-8'))];
const results: PairResult[] = [...checkTheme(themeTokens(blocks, 'light'), 'light', pairs), ...checkTheme(themeTokens(blocks, 'dark'), 'dark', pairs)];
const fails = results.filter((r) => !r.pass);

for (const r of fails) {
  console.error(`실패 [${r.theme}] ${r.pair.use}: ${r.pair.fg}${r.pair.alpha !== undefined ? `×${r.pair.alpha}` : ''} ${r.fgValue} on ${r.pair.bg} ${r.bgValue} = ${r.ratio.toFixed(2)}:1 (기준 ${r.pair.min}:1)`);
}
if (mismatch.length > 0) console.error(`다크 토큰 블록 불일치: ${mismatch.join(', ')}`);
console.log(`대비 점검: 라이트 ${results.filter((r) => r.theme === 'light').length}쌍 + 다크 ${results.filter((r) => r.theme === 'dark').length}쌍, 실패 ${fails.length}, 다크 블록 불일치 ${mismatch.length}`);

if (process.argv.includes('--write')) {
  writeFileSync(REPORT_PATH, formatReport(results, { mismatch }), 'utf-8');
  console.log(`보고서 저장: ${REPORT_PATH}`);
}
if (fails.length > 0 || mismatch.length > 0) process.exit(1);
