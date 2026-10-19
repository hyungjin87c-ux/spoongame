/**
 * 시안 한 장의 접근성 감사 (designer 도구, 2026-10-18 M7e — M5 r1~r3의 저장소 밖 감사 스크립트를 도구로 들여온 것).
 * 실행: npx vite-node scripts/design/auditMockup.mjs <시안 파일> [--states=,zero,past] [--out=<폴더>]
 *   예: npx vite-node scripts/design/auditMockup.mjs ending.html --states=,zero,past,early,down
 * 조합: 뷰포트 320×568 · 360×740 · 1280×800 · 320×256(low) × 글자 100·200% × 라이트·다크·강제 색상, 상태(`?state=`)마다.
 * 재는 것(구현 e2e와 **같은 측정기**를 가져다 쓴다 — 시안과 구현이 같은 자로 재인다):
 *   ① 가로 넘침(문서·요소 단위, shootMockups.mjs와 같은 규칙) ② 낱말 끊김 `e2e/lineBreaks.ts#measureWordBreaks`(QM3-1 — broken 0, 글자 100%에서는 unavoidable도 0)
 *   ③ CM10 포커스 가림 `e2e/focusObscured.ts#auditFocus`(320×256 × 200%는 SPEC r5 메모대로 제외) ④ 렌더 픽셀 대비 `e2e/renderedContrast.ts#measureRenderedContrast`(색 바탕 상자의 글자 ≥ 4.5:1).
 * 결과는 표준 출력(요약 + 위반 목록)과 `--out` 폴더의 JSON. 위반이 하나라도 있으면 종료 코드 1. 스크린샷은 찍지 않는다(샷은 shootMockups.mjs).
 * 2026-10-19(M7b): 모달 시트 상태에서는 ①②를 잰 뒤 `[inert]`(스크림 뒤 바깥)를 visibility: hidden으로 두고 ③④를 잰다. ④ 앞에는 닫힌 <details> 본문을 숨기고 안쪽 스크롤 목록을 펼친다(측정기 사각지대 — 본문 주석).
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { auditFocus, summarize } from '../../e2e/focusObscured.ts';
import { describeWordBreak, measureWordBreaks } from '../../e2e/lineBreaks.ts';
import { measureRenderedContrast } from '../../e2e/renderedContrast.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MOCK = 'file:///' + ROOT.replace(/\\/g, '/') + 'docs/design/mockups/';
const file = process.argv[2];
if (!file) throw new Error('시안 파일 이름을 주세요 (예: ending.html)');
const states = (process.argv.find((a) => a.startsWith('--states='))?.slice('--states='.length) ?? '').split(',');
const outDir = process.argv.find((a) => a.startsWith('--out='))?.slice('--out='.length) ?? null;

const VIEWPORTS = [
  { name: '320x568', width: 320, height: 568 },
  { name: '360x740', width: 360, height: 740 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: 'low320x256', width: 320, height: 256 },
];
const TEXTS = [100, 200];
const SCHEMES = ['light', 'dark', 'forced'];

/** 페이지 안: 문서·요소 단위 가로 넘침 (shootMockups.mjs#overflowReport와 같은 규칙) */
function overflowReport() {
  const out = [];
  const de = document.documentElement;
  if (de.scrollWidth > de.clientWidth + 1) out.push(`document scrollWidth ${de.scrollWidth} > ${de.clientWidth}`);
  const vw = de.clientWidth;
  const describe = (el) => {
    const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    return `<${el.tagName.toLowerCase()}${cls}> "${text}"`;
  };
  const clipped = [...document.querySelectorAll('body *')].filter((el) => getComputedStyle(el).clip === 'rect(0px, 0px, 0px, 0px)');
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg') || el.classList.contains('sr-only') || el.closest('.sr-only') || el.closest('template')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.display === 'inline' || cs.display === 'contents' || cs.visibility === 'hidden') continue;
    if (cs.clip === 'rect(0px, 0px, 0px, 0px)' || clipped.some((c) => c.contains(el))) continue;
    if (el.clientWidth === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (!['auto', 'scroll'].includes(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) out.push(`${describe(el)} scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}`);
    if (r.right > vw + 1 || r.left < -1) out.push(`${describe(el)} 화면 밖 (left ${Math.round(r.left)}, right ${Math.round(r.right)}, 화면 ${vw})`);
  }
  return out;
}

const browser = await chromium.launch();
const problems = [];
const rows = [];
let minContrast = { light: Infinity, dark: Infinity, forced: Infinity };
for (const state of states) {
  for (const vp of VIEWPORTS) {
    for (const text of TEXTS) {
      for (const scheme of SCHEMES) {
        const label = `${file}${state ? `?state=${state}` : ''} ${vp.name} ${text}% ${scheme}`;
        const ctx = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: 1,
          forcedColors: scheme === 'forced' ? 'active' : 'none',
          colorScheme: scheme === 'dark' ? 'dark' : 'light',
        });
        const page = await ctx.newPage();
        const query = [scheme === 'dark' ? 'theme=dark' : '', state ? `state=${state}` : ''].filter(Boolean).join('&');
        await page.goto(MOCK + file + (query ? `?${query}` : ''));
        await page.waitForLoadState('load');
        if (text !== 100) {
          await page.addStyleTag({ content: `html { font-size: ${text}%; }` });
          await page.evaluate(() => window.dispatchEvent(new Event('resize')));
        }
        await page.waitForTimeout(80);
        const row = { label, overflow: [], broken: [], unavoidable: [], focus: null, contrastMin: null, contrastLow: [] };
        // ① 넘침
        row.overflow = await page.evaluate(overflowReport);
        for (const p of row.overflow) problems.push(`[${label}] 넘침: ${p}`);
        // ② 낱말 끊김
        const wb = await measureWordBreaks(page);
        row.broken = wb.broken.map(describeWordBreak);
        row.unavoidable = wb.unavoidable.map(describeWordBreak);
        row.checked = wb.checked;
        for (const p of row.broken) problems.push(`[${label}] 끊김: ${p}`);
        if (text === 100) for (const p of row.unavoidable) problems.push(`[${label}] 글자 100%의 한 줄보다 긴 낱말: ${p}`);
        // 모달 시트가 떠 있는 상태(M7b 중대 결정 카드 — 바깥이 `inert`): 스크림 뒤의 헤더·진행 줄·본문은 닿을 수도 읽을 수도 없는 글자다. 측정기(focusObscured·renderedContrast)는 겹침 순서를 모르므로
        // 뒤에 깔린 sticky 헤더·하단 띠를 「가리는 고정 요소」로, 스크림에 어두워진 글자를 「대비 미달」로 센다 — ①②(넘침·끊김)를 잰 뒤 `[inert]`를 visibility: hidden으로 두고 ③④를 잰다(배치는 그대로, 측정기가 숨김으로 건너뛴다).
        // 구현 e2e도 모달 상태에서는 같은 처리가 필요하다(docs/design/diff-003.md D-59).
        if ((await page.locator('[inert]').count()) > 0) await page.addStyleTag({ content: '[inert] { visibility: hidden !important; }' });
        // ③ CM10 (320×256 × 200%는 제외 — SPEC-003 r5 메모)
        if (!(vp.name === 'low320x256' && text === 200)) {
          const audit = await auditFocus(page, label, { headingTestId: null });
          row.focus = summarize(audit);
          for (const v of audit.violations) problems.push(`[${label}] CM10: ${v}`);
        }
        // ④ 렌더 대비 — 글자 100%의 세 뷰포트에서만(요소 샷 기반이라 느리다; 글자 200%는 같은 색 쌍이다)
        // 측정기의 두 사각지대(대시보드 시안에서 처음 드러남, 2026-10-19): 닫힌 <details>의 본문은 그려지지 않는데 글자 상자가 잡혀 경계선 색을 글자색으로 읽고, 안쪽 스크롤 목록(.log__list)에서 화면 밖으로 밀린 줄은 요소 샷에 글자가 없어 1.00:1이 된다.
        // 앞의 것은 숨기고 뒤의 것은 목록을 펼쳐(색 쌍은 그대로) 잰다 — 대비 단계는 마지막이라 다른 측정에 영향이 없다.
        // 셋째: 측정기는 하단 띠만 숨기고 요소를 화면 안으로 스크롤해 찍는데, 대시보드의 sticky 헤더가 그 요소의 윗부분을 덮어 머리 글자(「인생 기록」「카드 접기」)가 헤더 바탕색으로 읽혔다 — 대비 단계에서만 헤더 고정을 푼다(색 쌍은 그대로).
        await page.addStyleTag({ content: 'details:not([open]) > :not(summary) { visibility: hidden !important; } .log__list { max-height: none !important; overflow: visible !important; } .dash-head { position: static !important; }' });
        if (text === 100 && vp.name !== 'low320x256') {
          const rc = await measureRenderedContrast(page, { min: 4.5 });
          row.contrastMin = rc.min;
          row.contrastLow = rc.low;
          row.contrastBoxes = rc.boxes;
          if (Number.isFinite(rc.min)) minContrast[scheme] = Math.min(minContrast[scheme], rc.min);
          for (const p of rc.low) problems.push(`[${label}] 대비: ${p}`);
        }
        rows.push(row);
        console.log(`${label}: 넘침 ${row.overflow.length} · 끊김 ${row.broken.length}(한 줄보다 긴 낱말 ${row.unavoidable.length}, 잰 낱말 ${row.checked}) · ${row.focus ?? 'CM10 제외'}${row.contrastMin !== null ? ` · 대비 최저 ${row.contrastMin.toFixed(2)} (상자 ${row.contrastBoxes})` : ''}`);
        await ctx.close();
      }
    }
  }
}
await browser.close();
if (outDir) {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/audit-${file.replace(/\W+/g, '_')}.json`, JSON.stringify({ file, states, rows, problems, minContrast }, null, 2), 'utf-8');
}
const uniq = [...new Set(problems)];
console.log(`\n요약: 조합 ${rows.length} · 위반 ${uniq.length} · 렌더 대비 최저 라이트 ${minContrast.light.toFixed(2)} / 다크 ${minContrast.dark.toFixed(2)} / 강제 색상 ${minContrast.forced.toFixed(2)}`);
if (uniq.length > 0) {
  console.log(uniq.join('\n'));
  process.exit(1);
}
