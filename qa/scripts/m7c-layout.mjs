// QA-003 M7c 레이아웃·접근성: 공통 뷰포트 11종 × 시트 상태(기본·입력 중·확인·40개·compact) × 글자 100·200%에서 가로 넘침·낱말 끊김(사용자 글 제외)·가려진 포커스(CM10)·Tab이 시트 안에서만.
// 사용: node qa/scripts/m7c-layout.mjs [부분 케이스ID]
import { launch, openOracle, plainLife, dueStateFor, openSeeded, withNotes, sheetReady, readNote, shot, sleep, runCase, appendJsonl, STD_VIEWPORTS, setRootFont, SET_MANUAL } from './m7c-lib.mjs';

const ONLY = process.argv[2] || '';
const FAKE_VV = () => {
  class FakeVV extends EventTarget {
    constructor() {
      super();
      this.height = window.innerHeight;
      this.width = window.innerWidth;
      this.offsetTop = 0;
      this.offsetLeft = 0;
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
const full = await withNotes(oracle, base, 40);
const LONG_KO = '평범한 하루가 지나갔다. 비가 오다 그쳤고 저녁에는 오랜만에 가족과 둘러앉아 밥을 먹었다. 별일 없는 날이 오래 기억에 남는 때가 있다.';

// 시트 안 측정기 (페이지 안에서 돈다)
const MEASURE = () => {
  const sheet = document.querySelector('[data-testid="note-sheet"]');
  if (!sheet) return null;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const sr = sheet.getBoundingClientRect();
  const over = [];
  for (const el of sheet.querySelectorAll('*')) {
    if (el.closest('.sr-only')) continue;
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > sr.right + 1 || r.left < sr.left - 1) over.push(`${el.tagName.toLowerCase()}[${el.getAttribute('data-testid') || el.className}] ${Math.round(r.left)}..${Math.round(r.right)} (sheet ${Math.round(sr.left)}..${Math.round(sr.right)})`);
  }
  // 낱말 끊김: 공백으로 나뉜 토큰 하나가 두 줄 이상에 걸치는가 (사용자 글·읽기 전용 글 제외)
  const broken = [];
  const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const p = n.parentElement;
    if (!p || p.closest('[data-user-text], .sr-only, [aria-hidden="true"]')) continue;
    const st = getComputedStyle(p);
    if (st.display === 'none' || st.visibility === 'hidden') continue;
    const re = /\S+/g;
    let m;
    while ((m = re.exec(n.textContent))) {
      const r = document.createRange();
      r.setStart(n, m.index);
      r.setEnd(n, m.index + m[0].length);
      const rects = [...r.getClientRects()].filter((x) => x.width > 0.5);
      if (rects.length > 1) {
        const tops = rects.map((x) => x.top);
        if (Math.max(...tops) - Math.min(...tops) > 6) broken.push(m[0]);
      }
    }
  }
  const ta = document.querySelector('[data-testid="note-input"]');
  return {
    docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    sheetHOverflow: sheet.scrollWidth > sheet.clientWidth + 1,
    sheetRect: { top: Math.round(sr.top), bottom: Math.round(sr.bottom), left: Math.round(sr.left), right: Math.round(sr.right) },
    vw,
    vh,
    over: over.slice(0, 6),
    broken: [...new Set(broken)].slice(0, 8),
    inputFont: ta ? parseFloat(getComputedStyle(ta).fontSize) : null,
    sheetScrollable: Math.round(sheet.scrollHeight - sheet.clientHeight),
    compact: sheet.getAttribute('data-compact'),
  };
};

// Tab 순회: 시트 안 포커스 가능 요소를 차례로 — 가려진 포커스(CM10)와 시트 밖 포커스 점검
async function tabAudit(page, vw, vh) {
  const stops = [];
  const outside = [];
  await page.evaluate(() => {
    const t = document.querySelector('[data-testid="note-title"]');
    if (t) t.focus();
  });
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    await sleep(90);
    const s = await page.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body) return { body: true };
      const r = a.getBoundingClientRect();
      const cx = Math.min(Math.max(r.left + r.width / 2, 0), window.innerWidth - 1);
      const cy = Math.min(Math.max(r.top + r.height / 2, 0), window.innerHeight - 1);
      const top = document.elementFromPoint(cx, cy);
      return {
        tid: a.getAttribute('data-testid') || a.id || a.tagName,
        inSheet: !!a.closest('.sheet'),
        rect: { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) },
        covered: !(top && (a === top || a.contains(top) || top.contains(a))),
        inViewport: r.top >= -0.5 && r.bottom <= window.innerHeight + 0.5 && r.left >= -0.5 && r.right <= window.innerWidth + 0.5,
        h: Math.round(r.height),
      };
    });
    if (s.body) {
      stops.push({ tid: '(body)' });
      continue;
    }
    stops.push(s);
    if (!s.inSheet) outside.push(s.tid);
  }
  return { stops, outside };
}

const STATES = [
  { id: 'default', label: '기본(빈 입력란)', mkState: () => base, auto: false, prep: async () => {} },
  { id: 'typing', label: '입력 중(한글 문장 140자 안팎)', mkState: () => base, auto: false, prep: async (p) => { await p.getByTestId('note-input').focus(); await p.keyboard.insertText(LONG_KO); await sleep(200); } },
  { id: 'cite', label: '인용 있는 자동 카드(①) 기본', mkState: () => infant, auto: true, prep: async () => {} },
  { id: 'confirm', label: '확인 단계(글 + 2번)', mkState: () => base, auto: false, prep: async (p) => { await p.getByTestId('note-input').focus(); await p.keyboard.insertText(LONG_KO); await sleep(150); await p.getByTestId('note-skip').scrollIntoViewIfNeeded().catch(() => {}); await p.getByTestId('note-skip').click({ force: true }); await p.waitForSelector('[data-testid="note-confirm"]', { timeout: 3000 }); await sleep(500); } },
  { id: 'limit40', label: '40개 안내', mkState: () => full, auto: false, prep: async () => {} },
  { id: 'compact', label: 'compact(가상 키보드 높이 340, 인용 있는 카드)', mkState: () => infant, auto: true, vv: 340, prep: async (p) => { await p.evaluate(() => window.__setVV(Math.min(340, window.innerHeight), 0)); await p.getByTestId('note-input').evaluate((el) => el.focus()); await sleep(300); } },
];

for (const S of STATES) {
  for (const font of [100, 200]) {
    const id = `L-${S.id}-${font}`;
    if (ONLY && !id.includes(ONLY)) continue;
    await runCase(
      { id, cat: '레이아웃', title: `${S.label} · 글자 ${font}% — 공통 뷰포트 11종: 가로 넘침·시트 안 요소 삐져나옴·낱말 끊김(사용자 글 제외)·가려진 포커스·Tab이 시트 안에서만`, steps: '11개 뷰포트에서 시트를 열고 측정, Tab 12번 순회', expected: '문서·시트 가로 넘침 0, 시트 밖으로 나간 요소 0, 낱말 끊김 0, Tab 정지가 시트 안·화면 안·가려지지 않음(CM10 예외 규칙: 시트 높이를 넘는 포커스는 스크롤로 닿음)', },
      async () => {
        const problems = [];
        const table = [];
        const shots = [];
        for (const vp of STD_VIEWPORTS) {
          if (S.vv && vp.height < 340) continue;
          const { ctx, page } = await openSeeded(b, S.mkState(), { vp: { width: vp.width, height: vp.height }, init: S.vv ? FAKE_VV : null, wait: S.auto ? '[data-testid="note-sheet"]' : '[data-testid="life-screen"]' });
          if (!S.auto) await page.getByTestId('tool-note').tap();
          await sheetReady(page);
          await setRootFont(page, font);
          await sleep(250);
          await S.prep(page);
          await sleep(200);
          const m = await page.evaluate(MEASURE);
          const t = await tabAudit(page, vp.width, vp.height);
          // 가려진 포커스: 화면 밖·덮임. 시트 스크롤로 닿는 것은 Tab 포커스가 자동으로 스크롤해 보이게 하므로 여기서는 그대로 판정
          const hidden = t.stops.filter((s) => !s.body && s.inSheet && (s.covered || !s.inViewport));
          const rec = { vp: vp.name, font, state: S.id, ...m, tabOutside: t.outside, hiddenFocus: hidden.map((h) => `${h.tid}@${h.rect.top}-${h.rect.bottom}${h.covered ? ' 덮임' : ''}${h.inViewport ? '' : ' 화면밖'}`), stops: t.stops.map((s) => s.tid || '(body)') };
          table.push(rec);
          appendJsonl('layout.jsonl', rec);
          const p = [];
          if (m.docOverflow) p.push('문서 가로 넘침');
          if (m.sheetHOverflow) p.push('시트 가로 넘침');
          if (m.over.length) p.push(`시트 밖 요소 ${m.over.length}: ${m.over[0]}`);
          if (m.broken.length) p.push(`낱말 끊김: ${m.broken.join(',')}`);
          if (t.outside.length) p.push(`시트 밖 포커스: ${t.outside.join(',')}`);
          if (hidden.length) p.push(`가려진 포커스: ${rec.hiddenFocus.join(' ')}`);
          if (m.inputFont !== null && m.inputFont < 16) p.push(`입력란 글자 ${m.inputFont}px`);
          if (p.length) {
            problems.push(`${vp.name}: ${p.join('; ')}`);
            if (shots.length < 4) shots.push(await shot(page, id, vp.name));
          } else if (vp.name === '360x740-touch' || vp.name === '320x568') {
            shots.push(await shot(page, id, vp.name));
          }
          await ctx.close();
        }
        return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? `문제 ${problems.length}/${table.length} 뷰포트: ${problems.slice(0, 8).join(' | ')}` : `${table.length}개 뷰포트 모두 통과(Tab 정지 ${table.reduce((a, r) => a + r.stops.length, 0)}번)`, shots, table: undefined };
      },
    );
  }
}

await b.close();
