// QA-003 M7c 보충: 입력란 속성(autocomplete·spellcheck·dir…), 입력란 세로 크기 조절(resize: vertical)로 시트가 깨지지 않는가, 화면 회전(세로→가로→세로) 중 시트·글 유지, 「나의 기록」 줄의 낭독.
// 사용: node qa/scripts/m7c-attack7.mjs [ID 일부]
import { launch, openOracle, plainLife, openSeeded, openManual, sheetReady, readNote, readLog, readSave, noteRowsOf, readCard, shot, sleep, runCase, writeJson } from './m7c-lib.mjs';

const ONLY = process.argv[2] || '';
const run = (c, fn) => (!ONLY || c.id.includes(ONLY) ? runCase({ cat: '입력 공격', ...c }, fn) : null);
const mk = () => {
  const checks = [];
  return { checks, chk: (name, ok, detail) => checks.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail).slice(0, 300) }) };
};
const done = (checks, shots = [], extra = {}) => {
  const bad = checks.filter((x) => !x.ok);
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? `실패 ${bad.length}: ${bad.map((x) => `${x.name} [${x.detail}]`).join(' | ')}` : `검사 ${checks.length}건 통과${extra.note ? ' — ' + extra.note : ''}`, checks, shots };
};
const b = await launch();
const { page: oracle } = await openOracle(b);
const base = await plainLife(oracle, { era: 'present', seed: 4242, age: 9 });

await run({ id: 'X-attr', title: '입력란 속성(D6): autocomplete=off·spellcheck=false·dir=auto·name 없음·form 밖·글자 ≥16px·maxlength 4000(140 아님), 세 버튼 type=button', steps: '시트를 열어 입력란·버튼 속성을 읽음', expected: '모두 기대대로' }, async () => {
  const { checks, chk } = mk();
  const { ctx, page } = await openSeeded(b, base);
  await openManual(page);
  const a = await page.getByTestId('note-input').evaluate((el) => ({
    ac: el.getAttribute('autocomplete'),
    sc: el.getAttribute('spellcheck'),
    dir: el.getAttribute('dir'),
    name: el.getAttribute('name'),
    form: !!el.closest('form'),
    fs: parseFloat(getComputedStyle(el).fontSize),
    max: el.getAttribute('maxlength'),
    rows: el.getAttribute('rows'),
    resize: getComputedStyle(el).resize,
  }));
  chk('autocomplete=off·spellcheck=false·dir=auto', a.ac === 'off' && a.sc === 'false' && a.dir === 'auto', JSON.stringify(a));
  chk('name 없음·form 밖', a.name === null && a.form === false, '');
  chk('글자 ≥16px', a.fs >= 16, a.fs);
  chk('maxlength 4000(안전망, 140 아님)·rows 3', a.max === '4000' && a.rows === '3', `${a.max}/${a.rows}`);
  const btn = await page.evaluate(() => [...document.querySelectorAll('[data-testid="note-save"],[data-testid="note-skip"],[data-testid="note-cards-toggle"]')].map((x) => x.getAttribute('type')));
  chk('버튼 type=button(제출 아님)', btn.every((t) => t === 'button'), btn.join(','));
  await ctx.close();
  return done(checks, [], { note: `resize=${a.resize}` });
});

await run({ id: 'X-resize', title: '입력란 세로 크기 조절(resize: vertical)을 끝까지 늘려도(3000px) 시트 안에서 두 버튼에 닿고 문서 가로 넘침·시트 밖 삐져나옴 0', steps: '데스크톱 1280×800과 폭 360에서 입력란 높이를 inline style로 3000px로(마우스 끌기와 같은 결과)', expected: '시트는 화면 안, 시트 안 스크롤로 버튼 도달, 가로 넘침 0' }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  for (const [w, h, touch] of [[1280, 800, false], [360, 740, true]]) {
    const { ctx, page } = await openSeeded(b, base, { vp: { width: w, height: h }, touch });
    if (touch) await page.getByTestId('tool-note').tap();
    else await page.getByTestId('tool-note').click();
    await sheetReady(page);
    await page.getByTestId('note-input').evaluate((el) => {
      el.style.height = '3000px';
    });
    await sleep(300);
    const m = await page.evaluate(() => {
      const s = document.querySelector('[data-testid="note-sheet"]');
      const r = s.getBoundingClientRect();
      const btn = document.querySelector('[data-testid="note-save"]');
      btn.scrollIntoView({ block: 'nearest' });
      const br = btn.getBoundingClientRect();
      return { sheetTop: Math.round(r.top), sheetBottom: Math.round(r.bottom), vh: innerHeight, scrollable: s.scrollHeight - s.clientHeight, btnVisible: br.top >= 0 && br.bottom <= innerHeight + 1, docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
    });
    chk(`${w}×${h}: 시트가 화면 안`, m.sheetTop >= 0 && m.sheetBottom <= m.vh + 1, JSON.stringify(m));
    chk(`${w}×${h}: 시트 안 스크롤로 1번에 닿음·가로 넘침 0`, m.btnVisible && !m.docOverflow, JSON.stringify(m));
    shots.push(await shot(page, 'X-resize', `${w}`));
    await ctx.close();
  }
  return done(checks, shots);
});

await run({ id: 'X-rotate', title: '화면 회전(세로 360×740 → 가로 740×360 → 세로) 중 시트가 열린 채 글·포커스·시트 위치 유지', steps: '글을 쓴 채 뷰포트를 바꿈', expected: '시트 유지·글 그대로·넘침 0·두 버튼 시트 안 스크롤로 닿음' }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const { ctx, page } = await openSeeded(b, base);
  await openManual(page);
  await page.getByTestId('note-input').focus();
  await page.keyboard.insertText('회전 시험 글\n둘째 줄');
  await page.setViewportSize({ width: 740, height: 360 });
  await sleep(500);
  let n = await readNote(page);
  chk('가로: 시트·글 유지', n.present && n.inputValue === '회전 시험 글\n둘째 줄', JSON.stringify(n.inputValue));
  const lay = await page.evaluate(() => {
    const s = document.querySelector('[data-testid="note-sheet"]').getBoundingClientRect();
    const btn = document.querySelector('[data-testid="note-save"]');
    btn.scrollIntoView({ block: 'nearest' });
    const r = btn.getBoundingClientRect();
    return { top: Math.round(s.top), bottom: Math.round(s.bottom), vh: innerHeight, btn: r.top >= 0 && r.bottom <= innerHeight + 1, docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
  });
  chk('가로: 시트 화면 안·1번 도달·넘침 0', lay.top >= 0 && lay.bottom <= lay.vh + 1 && lay.btn && !lay.docOverflow, JSON.stringify(lay));
  shots.push(await shot(page, 'X-rotate', 'landscape'));
  await page.setViewportSize({ width: 360, height: 740 });
  await sleep(500);
  n = await readNote(page);
  chk('세로 복귀: 시트·글 유지', n.present && n.inputValue === '회전 시험 글\n둘째 줄' && !n.docOverflow, JSON.stringify({ present: n.present, overflow: n.docOverflow }));
  await page.getByTestId('note-save').tap();
  await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 4000 });
  chk('저장', noteRowsOf(await readSave(page)).length === 1, '');
  await ctx.close();
  return done(checks, shots);
});

await run({ id: 'X-ax-row', title: '「나의 기록」 줄의 낭독(접근성 트리): 「나의 기록 {주제} 글」 — 가운뎃점·연필 아이콘이 읽히지 않고 글은 그대로', steps: 'CDP getFullAXTree로 인생 기록의 나의 기록 줄 노드를 읽음', expected: '「나의 기록」 「주제」가 이어 읽히고 「·」 없음' }, async () => {
  const { checks, chk } = mk();
  const { ctx, page } = await openSeeded(b, base);
  await openManual(page);
  await page.getByTestId('note-input').focus();
  await page.keyboard.insertText('낭독 시험 글');
  await page.getByTestId('note-save').tap();
  await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 4000 });
  await sleep(500);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Accessibility.enable');
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  let row = null;
  for (const n of nodes) {
    if (n.role && n.role.value === 'listitem' && !n.ignored) {
      const texts = [];
      const walk = (x) => {
        if (!x) return;
        if (!x.ignored && x.role && x.role.value === 'StaticText' && x.name) texts.push(x.name.value);
        for (const c of x.childIds || []) walk(byId.get(c));
      };
      walk(n);
      if (texts.join('').includes('낭독 시험 글')) row = texts;
    }
  }
  writeJson('ax-row.json', row);
  chk('나의 기록 줄을 접근성 트리에서 찾음', !!row, '');
  if (row) {
    const joined = row.join('|');
    chk('「나의 기록」과 주제가 읽힘', /나의 기록/.test(joined) && /지금의 생각/.test(joined), joined);
    chk('가운뎃점 「·」가 낭독에 없음', !row.some((t) => /^\s*·\s*$/.test(t)), joined);
    chk('글이 그대로 읽힘', row.some((t) => t.includes('낭독 시험 글')), '');
  }
  await ctx.close();
  return done(checks, [], { note: row ? row.join(' / ') : '' });
});

await b.close();
