// QA-003 M7c 가상 키보드(K1~K7): 가짜 window.visualViewport로 보이는 높이 340~740(+offsetTop 60)에서 기록 시트의 입력란 + 두 버튼이 보이는 영역 안에 있는지,
// 입력란 글자 ≥ 16px, compact·복귀(K6), 문서 scrollY 불변. 폭 320·360 × 글자 100·200% × 인용 있는(자동 ①)·없는(수동) 시트. 실기기는 SKIP(M9).
// 사용: node qa/scripts/m7c-vv.mjs
import { launch, openOracle, plainLife, dueStateFor, openSeeded, sheetReady, readNote, shot, sleep, runCase, setRootFont, appendJsonl, SET_MANUAL } from './m7c-lib.mjs';

const FAKE_VV = () => {
  class FakeVV extends EventTarget {
    constructor() {
      super();
      this.height = window.innerHeight;
      this.width = window.innerWidth;
      this.offsetTop = 0;
      this.offsetLeft = 0;
      this.pageTop = 0;
      this.pageLeft = 0;
      this.scale = 1;
    }
  }
  const vv = new FakeVV();
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
  window.__setVV = (h, top = 0) => {
    vv.height = h;
    vv.offsetTop = top;
    vv.dispatchEvent(new Event('resize'));
    vv.dispatchEvent(new Event('scroll'));
  };
};

const b = await launch();
const { page: oracle } = await openOracle(b);
const base = await plainLife(oracle, { era: 'present', seed: 4242, age: 9 });
const infant = await dueStateFor(oracle, 'note-infant-memory', { era: 'present', paused: true });

const HEIGHTS = [340, 380, 420, 460, 520, 600, 700, 740];
const KINDS = [
  { id: 'cite', label: '인용 있는 카드(자동 ①)', state: infant, open: async () => {} },
  { id: 'nocite', label: '인용 없는 카드(수동)', state: base, open: null },
];
const WIDTHS = [
  { w: 360, h: 740 },
  { w: 320, h: 568 },
];
const FONTS = [100, 200];

const rows = [];
for (const K of KINDS) {
  for (const W of WIDTHS) {
    for (const F of FONTS) {
      const id = `V-${K.id}-${W.w}-${F}`;
      await runCase(
        { id, cat: '가상 키보드', title: `${K.label} · 폭 ${W.w} · 글자 ${F}% — 보이는 높이 ${HEIGHTS.filter((h) => h <= W.h).join('·')}에서 입력란과 두 버튼`, steps: '가짜 visualViewport 높이를 바꾸고 입력란에 포커스', expected: 'K3: 글자 100%는 전 구간에서 입력란 + 1번 + 2번이 보이는 영역 안, 글자 200%는 입력란은 보이고 두 버튼은 시트 안 스크롤로 닿음(K7). 입력란 글자 ≥16px, 문서 scrollY 불변' },
        async () => {
          const checks = [];
          const chk = (name, ok, detail) => checks.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail).slice(0, 260) });
          const shots = [];
          const { ctx, page } = await openSeeded(b, K.state, { vp: { width: W.w, height: W.h }, init: FAKE_VV, wait: K.open === null ? '[data-testid="life-screen"]' : '[data-testid="note-sheet"]' });
          if (K.open === null) {
            await page.getByTestId('tool-note').tap();
          }
          await sheetReady(page);
          await setRootFont(page, F);
          await sleep(250);
          const scrollY0 = await page.evaluate(() => Math.round(window.scrollY));
          for (const h of HEIGHTS.filter((x) => x <= W.h)) {
            for (const top of h === 740 ? [0] : [0, 60]) {
              if (top + h > W.h + 1) continue;
              await page.evaluate(([hh, tt]) => window.__setVV(hh, tt), [h, top]);
              await page.getByTestId('note-input').evaluate((el) => el.blur());
              await sleep(120);
              await page.getByTestId('note-input').tap().catch(() => {});
              await page.evaluate(() => document.querySelector('[data-testid="note-input"]').focus());
              await sleep(300);
              const m = await page.evaluate(([hh, tt]) => {
                const q = (s) => document.querySelector(s);
                const r = (e) => {
                  if (!e) return null;
                  const x = e.getBoundingClientRect();
                  return { top: x.top, bottom: x.bottom };
                };
                const sheet = q('[data-testid="note-sheet"]');
                const overlay = q('[data-testid="note-overlay"]');
                const input = q('[data-testid="note-input"]');
                const save = q('[data-testid="note-save"]');
                const skip = q('[data-testid="note-skip"]');
                const vTop = tt;
                const vBot = tt + hh;
                const inside = (x) => x && x.top >= vTop - 0.75 && x.bottom <= vBot + 0.75;
                // 시트 안 스크롤로 닿는가: 버튼을 시트 안에서 보이는 영역까지 스크롤해 본다
                const reach = (el) => {
                  el.scrollIntoView({ block: 'nearest' });
                  const x = el.getBoundingClientRect();
                  return inside({ top: x.top, bottom: x.bottom });
                };
                const sr = sheet.getBoundingClientRect();
                const ir = r(input);
                const sv = r(save);
                const sk = r(skip);
                const out = {
                  compact: sheet.getAttribute('data-compact'),
                  vvH: overlay.style.getPropertyValue('--vv-h'),
                  vvTop: overlay.style.getPropertyValue('--vv-top'),
                  sheetTop: Math.round(sr.top * 10) / 10,
                  sheetBottom: Math.round(sr.bottom * 10) / 10,
                  sheetInView: inside({ top: sr.top, bottom: sr.bottom }),
                  inputInView: inside(ir),
                  saveInView: inside(sv),
                  skipInView: inside(sk),
                  inputFont: parseFloat(getComputedStyle(input).fontSize),
                  sheetScrollable: Math.round(sheet.scrollHeight - sheet.clientHeight),
                  scrollY: Math.round(window.scrollY),
                  inputRect: ir && { top: Math.round(ir.top), bottom: Math.round(ir.bottom) },
                  saveRect: sv && { top: Math.round(sv.top), bottom: Math.round(sv.bottom) },
                  skipRect: sk && { top: Math.round(sk.top), bottom: Math.round(sk.bottom) },
                  cite: !!q('[data-testid="cite"]') && getComputedStyle(q('[data-testid="cite"]')).display !== 'none',
                  subShown: !!q('.note-choice__sub') && getComputedStyle(q('.note-choice__sub')).display !== 'none',
                  hintShown: !!q('[data-testid="note-hint"]') && getComputedStyle(q('[data-testid="note-hint"]')).display !== 'none',
                  countShown: !!q('[data-testid="note-count"]'),
                };
                // 도달 가능성은 마지막에(스크롤을 건드린다)
                out.inputReach = reach(input);
                out.saveReach = reach(save);
                out.skipReach = reach(skip);
                out.inputInViewAfter = inside(r(input));
                return out;
              }, [h, top]);
              const rec = { id, kind: K.id, width: W.w, font: F, vvH: h, top, ...m };
              rows.push(rec);
              appendJsonl('vv.jsonl', rec);
              const tag = `h${h}${top ? '-top' + top : ''}`;
              const tallOK = m.inputInView && m.saveInView && m.skipInView;
              if (F === 100) chk(`${tag}: 입력란+1번+2번이 보이는 영역 안(K3)`, tallOK, JSON.stringify({ input: m.inputRect, save: m.saveRect, skip: m.skipRect, area: [top, top + h], compact: m.compact, scrollable: m.sheetScrollable }));
              else chk(`${tag}: 입력란이 보이는 영역 안 + 두 버튼은 스크롤로 닿음(K7)`, m.inputInView && m.saveReach && m.skipReach, JSON.stringify({ inputInView: m.inputInView, saveReach: m.saveReach, skipReach: m.skipReach, compact: m.compact }));
              chk(`${tag}: 시트 전체가 보이는 영역 안`, m.sheetInView, JSON.stringify({ sheet: [m.sheetTop, m.sheetBottom], area: [top, top + h] }));
              chk(`${tag}: 입력란 글자 ≥ 16px`, m.inputFont >= 16, m.inputFont);
              chk(`${tag}: 문서 scrollY 불변`, m.scrollY === scrollY0, `${scrollY0}→${m.scrollY}`);
              chk(`${tag}: --vv-h·--vv-top 반영`, m.vvH === `${h}px` && m.vvTop === `${top}px`, `${m.vvH}/${m.vvTop}`);
            }
          }
          // K6: 키보드가 내려가면(포커스 해제 + 높이 복귀) compact가 풀리고 원래 높이로
          await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.__setVV(window.innerHeight, 0); });
          await page.getByTestId('note-title').evaluate((el) => el.focus());
          await sleep(300);
          const back = await page.evaluate(() => {
            const s = document.querySelector('[data-testid="note-sheet"]');
            return { compact: s.getAttribute('data-compact'), cite: !!document.querySelector('[data-testid="cite"]') };
          });
          chk('K6: 키보드가 내려가면 compact가 풀림', back.compact === 'false', JSON.stringify(back));
          shots.push(await shot(page, id, 'back'));
          // 대표 화면: 340·520 compact
          await page.evaluate(() => window.__setVV(340, 0));
          await page.getByTestId('note-input').evaluate((el) => el.focus());
          await sleep(300);
          shots.push(await shot(page, id, 'h340'));
          await ctx.close();
          const bad = checks.filter((x) => !x.ok);
          return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? `실패 ${bad.length}/${checks.length}: ${bad.slice(0, 6).map((x) => `${x.name} [${x.detail}]`).join(' | ')}` : `검사 ${checks.length}건 통과`, checks, shots };
        },
      );
    }
  }
}
await b.close();
