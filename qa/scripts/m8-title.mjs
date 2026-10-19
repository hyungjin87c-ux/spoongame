// QA-003 M8 첫 화면 인생 길이 영역(D-92 설명 문구·「약 1시간 · 준비 중」): 공통 뷰포트 11 × 글자 100·200% × 라이트·다크·강제 색상에서 넘침·가려짐·잘림·대비를 잰다. 진행 중인 판이 있는 첫 화면(「이어서 살기」)도 함께.
// 사용: node qa/scripts/m8-title.mjs   결과: qa/results/m8/title-layout.jsonl, cases.jsonl(TL01)
import { launch, openOracle, plainLife, openSeeded, openSeededRaw, mkctx, shot, sleep, runCase, appendJsonl, STD_VIEWPORTS, setRootFont, SET_MANUAL, PROD, TOUCH, GAME_KEY, SAVE_VERSION } from './m8-lib.mjs';

const browser = await launch();
const { page: oracle } = await openOracle(browser);
const life = await plainLife(oracle, { era: 'present', seed: 4242, age: 9, paused: true });

const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const L = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a, b) => { const la = L(a); const lb = L(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };

const MEASURE = () => {
  const q = (s) => document.querySelector(s);
  const R = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, h: r.height }; };
  const parseC = (s) => { const m = /rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[, /]+([\d.]+))?/.exec(s); return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])] : null; };
  const bgOf = (e) => { let x = e; while (x) { const c = parseC(getComputedStyle(x).backgroundColor); if (c && c[3] > 0.99) return c; x = x.parentElement; } return [255, 255, 255, 1]; };
  const hint = q('[data-testid="life-length-hint"]');
  const group = q('[data-testid="life-length-group"]');
  const l60 = q('[data-testid="life-long60"]').closest('label');
  const meta = l60.querySelector('.radio-card__meta');
  hint.scrollIntoView({ block: 'center', behavior: 'instant' });
  const hr = R(hint);
  const gr = R(group);
  // 가려짐: 힌트 가운데 점의 최상단 요소
  const cx = (hr.l + hr.r) / 2;
  const cy = Math.min(Math.max(hr.t + hr.h / 2, 0), window.innerHeight - 1);
  const top = document.elementFromPoint(cx, cy);
  const covered = !(top && hint.contains(top));
  const lh = parseFloat(getComputedStyle(hint).lineHeight) || 20;
  const metaC = meta ? { fg: parseC(getComputedStyle(meta).color), bg: bgOf(meta) } : null;
  const hintC = { fg: parseC(getComputedStyle(hint).color), bg: bgOf(hint) };
  return {
    vw: window.innerWidth,
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    hint: hr,
    group: gr,
    hintLines: Math.round(hr.h / lh),
    clippedHint: hint.scrollWidth > hint.clientWidth + 1,
    covered,
    metaText: meta ? meta.textContent.trim() : null,
    metaVisible: meta ? R(meta).b > R(meta).t : false,
    hintC,
    metaC,
    hintText: hint.textContent.replace(/\\s+/g, ' ').trim(),
  };
};

const states = [['new', null], ['saved', life]];
const schemes = [['light', { colorScheme: 'light' }], ['dark', { colorScheme: 'dark' }], ['forced', { forcedColors: 'active', colorScheme: 'light' }]];
let total = 0;
const bad = [];
let minC = { light: 99, dark: 99 };
for (const [sname, st] of states) {
  for (const vp of STD_VIEWPORTS) {
    for (const [schName, schOpts] of schemes) {
      let ctx;
      let page;
      if (st === null) {
        ctx = await mkctx(browser, { viewport: { width: vp.width, height: vp.height }, ...(vp.touch ? TOUCH : {}), ...schOpts });
        await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__c')) { localStorage.clear(); sessionStorage.setItem('__c', '1'); } } catch {} });
        page = await ctx.newPage();
        await page.goto(PROD, { waitUntil: 'load' });
        await page.waitForSelector('[data-testid="title-screen"]');
      } else {
        // 진행 중인 판이 있는 첫 화면: 나가기를 눌러 다시 연 상태(showTitle)
        const o = await openSeeded(browser, { ...st }, { vp, touch: !!vp.touch, extraCtx: schOpts, localFlag: true });
        ctx = o.ctx;
        page = o.page;
        await page.getByTestId('tool-exit').click({ timeout: 4000 }).catch(() => {});
        await page.getByTestId('exit-yes').click({ timeout: 4000 }).catch(() => {});
        await page.waitForSelector('[data-testid="title-screen"]', { timeout: 6000 }).catch(() => {});
      }
      for (const pct of [100, 200]) {
        await setRootFont(page, pct);
        await sleep(150);
        const m = await page.evaluate(MEASURE);
        total++;
        const issues = [];
        if (m.overflowX) issues.push('문서 가로 넘침');
        if (m.hint.l < -0.5 || m.hint.r > m.vw + 0.5) issues.push('설명 문구가 화면 밖');
        if (m.group.l < -0.5 || m.group.r > m.vw + 0.5) issues.push('인생 길이 묶음이 화면 밖');
        if (m.clippedHint) issues.push('설명 문구 잘림');
        if (m.covered) issues.push('설명 문구가 가려짐(하단 띠 등)');
        if (m.metaText !== '준비 중') issues.push(`메타 ${m.metaText}`);
        if (schName !== 'forced') {
          const r1 = ratio(m.hintC.fg, m.hintC.bg);
          const r2 = ratio(m.metaC.fg, m.metaC.bg);
          if (r1 < minC[schName]) minC[schName] = r1;
          if (r2 < minC[schName]) minC[schName] = r2;
          if (r1 < 4.5) issues.push(`설명 대비 ${r1.toFixed(2)}`);
          if (r2 < 4.5) issues.push(`준비 중 대비 ${r2.toFixed(2)}`);
        }
        const rec = { state: sname, vp: vp.name, scheme: schName, pct, issues, lines: m.hintLines };
        appendJsonl('title-layout.jsonl', rec);
        if (issues.length) bad.push(rec);
      }
      const key = (sname === 'new' && ['360x740-touch', '320x568'].includes(vp.name)) || (sname === 'saved' && vp.name === '360x740-touch');
      if (key) {
        for (const pct of [100, 200]) {
          if (pct === 200 && vp.name !== '320x568') continue;
          await setRootFont(page, pct);
          await sleep(150);
          await page.evaluate(() => document.querySelector('[data-testid="life-length-group"]').scrollIntoView({ block: 'center', behavior: 'instant' }));
          await sleep(200);
          await shot(page, `TL-${sname}-${vp.name}-${schName}`, `text${pct}`);
        }
      }
      await ctx.close();
    }
  }
}
await runCase({ id: 'TL01', title: `첫 화면 인생 길이 영역 레이아웃 ${total}조합 (새 판·진행 중 판 × 뷰포트 11 × 라이트·다크·강제 색상 × 글자 100·200%)` }, async () => ({
  verdict: bad.length === 0 ? 'PASS' : 'FAIL',
  actual: `${total}조합 중 문제 ${bad.length}건, 최저 대비 라이트 ${minC.light.toFixed(2)} 다크 ${minC.dark.toFixed(2)}${bad.length ? ' · 예: ' + JSON.stringify(bad.slice(0, 4)) : ''}`,
  shots: [],
}));
await browser.close();
