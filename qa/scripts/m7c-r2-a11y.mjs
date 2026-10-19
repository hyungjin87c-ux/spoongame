// QA-003 M7c 접근성: 키보드만(Tab 순서·시트 안에 갇힘·Esc·Enter 줄바꿈), 낭독 순서(AX 트리: 질문 → 인용 → 입력란 → 안내 → 두 버튼), 대비(라이트·다크·강제 색상), 긴 사용자 글이 든 엔딩 연표.
// 사용: node qa/scripts/m7c-a11y.mjs [K01|K02|C01|E01]
import { launch, openOracle, plainLife, dueStateFor, openSeeded, withNotes, sheetReady, readNote, readCard, readLog, readSave, noteRowsOf, shot, sleep, runCase, evalCore, setRootFont, appendJsonl, writeJson, STD_VIEWPORTS, SET_MANUAL, parseRgb } from './m7c-r2-lib.mjs';

const ONLY = process.argv[2] || '';
const run = (c, fn) => (!ONLY || c.id.includes(ONLY) ? runCase({ cat: '접근성', ...c }, fn) : null);
const mk = () => {
  const checks = [];
  return { checks, chk: (name, ok, detail) => checks.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail).slice(0, 300) }) };
};
const done = (checks, shots = [], extra = {}) => {
  const bad = checks.filter((x) => !x.ok);
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? `실패 ${bad.length}: ${bad.map((x) => `${x.name} [${x.detail}]`).join(' | ')}` : `검사 ${checks.length}건 통과${extra.note ? ' — ' + extra.note : ''}`, checks, shots, ...(extra.rec || {}) };
};

const b = await launch();
const { page: oracle } = await openOracle(b);
const base = await plainLife(oracle, { era: 'present', seed: 4242, age: 9 });
const infant = await dueStateFor(oracle, 'note-infant-memory', { era: 'present', paused: true });

const active = (page) => page.evaluate(() => {
  const a = document.activeElement;
  if (!a || a === document.body) return { tid: '(body)', inSheet: false };
  return { tid: a.getAttribute('data-testid') || a.id || a.tagName.toLowerCase(), inSheet: !!a.closest('.sheet'), tag: a.tagName.toLowerCase() };
});

// ------------------------------------------------------------------ K01 키보드만
await run({ id: 'K01', title: '키보드만으로 한 판의 기록: 도구 줄 Enter → 시트(포커스 질문 제목) → Tab 순서 → 글 쓰기 → 1번 Enter → 닫힘(포커스 「생각 남기기」) / Esc·확인·돌아가기·Enter 줄바꿈', steps: '데스크톱 1280×800에서 마우스 없이', expected: 'Tab 순서 입력란→1번→2번→끄기 칸, Tab·Shift+Tab이 시트 밖으로 나가지 않음, Esc = 2번, 확인 단계 Esc = 돌아가기, Enter는 줄바꿈(3줄까지)' }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const { ctx, page } = await openSeeded(b, base, { vp: { width: 1280, height: 800 }, touch: false });
  await page.waitForFunction(() => { const e = document.querySelector('[data-testid="tool-note"]'); return e && e.getAttribute('aria-disabled') !== 'true'; }, null, { timeout: 4000 });
  await page.getByTestId('tool-note').focus();
  await page.keyboard.press('Enter');
  await sheetReady(page);
  let a = await active(page);
  chk('열림: 포커스는 질문 제목', a.tid === 'note-title', a.tid);
  const seq = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    await sleep(80);
    seq.push(await active(page));
  }
  chk('Tab 순서: 입력란 → 1번 → 2번 → 끄기 칸', seq[0].tid === 'note-input' && seq[1].tid === 'note-save' && seq[2].tid === 'note-skip' && seq[3].tid === 'note-cards-toggle', seq.slice(0, 4).map((s) => s.tid).join(' → '));
  chk('Tab 8번 모두 시트 안(밖으로 안 나감)', seq.every((s) => s.inSheet || s.tid === '(body)'), seq.map((s) => `${s.tid}${s.inSheet ? '' : '(밖)'}`).join(', '));
  const outsideReal = seq.filter((s) => !s.inSheet && s.tid !== '(body)');
  chk('시트 밖 요소로 포커스가 간 적 없음', outsideReal.length === 0, JSON.stringify(outsideReal));
  const back = [];
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Shift+Tab');
    await sleep(80);
    back.push(await active(page));
  }
  chk('Shift+Tab 6번도 시트 밖으로 안 나감', back.every((s) => s.inSheet || s.tid === '(body)') && back.filter((s) => !s.inSheet && s.tid !== '(body)').length === 0, back.map((s) => s.tid).join(', '));
  // 글 쓰기: Enter는 줄바꿈 3줄까지
  await page.getByTestId('note-input').focus();
  await page.keyboard.type('첫째 줄');
  await page.keyboard.press('Enter');
  await page.keyboard.type('둘째 줄');
  await page.keyboard.press('Enter');
  await page.keyboard.type('셋째 줄');
  await page.keyboard.press('Enter'); // 4번째 줄을 만드는 Enter — 무시
  await page.keyboard.type('!');
  await sleep(200);
  const n1 = await readNote(page);
  chk('Enter는 줄바꿈이고 제출하지 않음·4번째 줄 Enter 무시', n1.present && n1.inputValue === '첫째 줄\n둘째 줄\n셋째 줄!', JSON.stringify(n1.inputValue));
  chk('「줄은 세 줄까지」 알림', n1.msg === '줄은 세 줄까지 적을 수 있습니다.' || n1.msg === '', `"${n1.msg}"`);
  // Esc → 확인 단계(글이 있음)
  await page.keyboard.press('Escape');
  await sleep(350);
  const n2 = await readNote(page);
  a = await active(page);
  chk('Esc(글 있음) → 확인 단계, 포커스 「돌아가서 이어 쓰기」', n2.confirm !== null && a.tid === 'note-confirm-back', `${!!n2.confirm} ${a.tid}`);
  await page.keyboard.press('Escape');
  await sleep(300);
  const n3 = await readNote(page);
  a = await active(page);
  chk('확인 단계 Esc = 돌아가기: 글 그대로·포커스 입력란', n3.confirm === null && n3.inputValue === '첫째 줄\n둘째 줄\n셋째 줄!' && a.tid === 'note-input', `${n3.confirm} ${a.tid}`);
  // Tab → 1번 → Enter 저장
  await page.keyboard.press('Tab');
  a = await active(page);
  chk('입력란에서 Tab → 1번', a.tid === 'note-save', a.tid);
  await sleep(600); // 돌아간 뒤 다시 만들어진 버튼의 입력 가드 400ms(CM5)가 풀릴 때까지
  await page.keyboard.press('Enter');
  await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 4000 });
  await sleep(300);
  a = await active(page);
  chk('저장 뒤 포커스는 「생각 남기기」 버튼(수동)', a.tid === 'tool-note', a.tid);
  const rows = noteRowsOf(await readSave(page));
  chk('저장된 글(줄바꿈 포함)', rows.length === 1 && rows[0].text === '첫째 줄\n둘째 줄\n셋째 줄!', JSON.stringify(rows.map((r) => r.text)));
  // 빈 상태 Esc = 2번: 닫힘, 포커스 복귀
  await page.waitForFunction(() => { const t = document.querySelector('[data-testid="tool-note"]'); return t && t.getAttribute('aria-disabled') !== 'true'; }, null, { timeout: 4000 }); // 2회차(F-1): 닫은 직후 400ms는 「생각 남기기」 가드 — 풀릴 때까지 기다린 뒤 다시 연다
  await page.keyboard.press('Enter');
  await sheetReady(page);
  await page.keyboard.press('Escape');
  await sleep(300);
  a = await active(page);
  chk('빈 시트 Esc → 바로 닫힘·포커스 「생각 남기기」', !(await readNote(page)).present && a.tid === 'tool-note', a.tid);
  // Space로 버튼
  await page.waitForFunction(() => { const t = document.querySelector('[data-testid="tool-note"]'); return t && t.getAttribute('aria-disabled') !== 'true'; }, null, { timeout: 4000 }); // 2회차(F-1)
  await page.keyboard.press('Space');
  await sheetReady(page);
  await page.keyboard.press('Tab');
  await page.keyboard.type('스페이스 시험');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 4000 });
  chk('Space로 1번 → 저장', noteRowsOf(await readSave(page)).length === 2, '');
  shots.push(await shot(page, 'K01', 'after'));
  await ctx.close();
  return done(checks, shots);
});

// 자동 카드: 열릴 때 포커스·닫힐 때 포커스
await run({ id: 'K01b', title: '자동 카드: 열릴 때 포커스 = 질문 제목, 닫힌 뒤 = 인생 화면 제목(이름), Tab이 시트 안에서 순환', steps: '5세 ① 카드를 키보드로 열고 닫음', expected: '열림 note-title, 닫힘 life-name' }, async () => {
  const { checks, chk } = mk();
  const { ctx, page } = await openSeeded(b, infant, { vp: { width: 1280, height: 800 }, touch: false, wait: '[data-testid="note-sheet"]' });
  await sheetReady(page);
  let a = await active(page);
  chk('열림: 포커스 질문 제목', a.tid === 'note-title', a.tid);
  const ids = [];
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    await sleep(60);
    ids.push((await active(page)).tid);
  }
  chk('Tab이 시트 안에서만(인용 박스에 링크 없음)', ids.every((x) => ['note-input', 'note-save', 'note-skip', 'note-cards-toggle', '(body)'].includes(x)), ids.join(', '));
  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 3000 });
  await sleep(300);
  a = await active(page);
  chk('닫힘(빈 Esc = 2번): 포커스 인생 화면 제목', a.tid === 'life-name', a.tid);
  await ctx.close();
  return done(checks);
});

// ------------------------------------------------------------------ K02 낭독 순서 (AX 트리)
const AX = async (ctx, page) => {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Accessibility.enable');
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const dlg = nodes.find((n) => n.role && n.role.value === 'dialog' && !n.ignored);
  if (!dlg) return null;
  const out = [];
  const walk = (n, d) => {
    if (!n) return;
    if (!n.ignored && n.role && !['generic', 'none', 'InlineTextBox', 'LineBreak'].includes(n.role.value)) {
      out.push({ d, role: n.role.value, name: (n.name && n.name.value) || '', desc: (n.description && n.description.value) || '' });
    }
    for (const c of n.childIds || []) walk(byId.get(c), d + 1);
  };
  walk(dlg, 0);
  return { dialogName: (dlg.name && dlg.name.value) || '', items: out };
};
for (const [id, label, st, auto, typed] of [
  ['K02a', '수동 시트(인용 없음)', base, false, true],
  ['K02b', '자동 ① 시트(인용 있음)', infant, true, false],
]) {
  await run({ id, title: `낭독 순서(접근성 트리) — ${label}: 질문 → (인용) → 입력란 → 안내(개인정보·글자 수) → 1번 → 2번 → 끄기 칸, 대화상자 이름 = 「생각 남기기 {질문}」`, steps: 'CDP Accessibility.getFullAXTree로 대화상자 하위 노드를 문서 순서대로 읽는다', expected: '순서가 위와 같음, 입력란은 textbox 「남길 글」 + 설명(안내·n자 입력), 버튼 이름 = 「적어두고 살기」·「마음속에 담고 살기」 + 설명' }, async () => {
    const { checks, chk } = mk();
    const { ctx, page } = await openSeeded(b, st, { vp: { width: 360, height: 740 }, wait: auto ? '[data-testid="note-sheet"]' : '[data-testid="life-screen"]' });
    if (!auto) await page.getByTestId('tool-note').tap();
    await sheetReady(page);
    await sleep(300);
    const ax = await AX(ctx, page);
    writeJson(`ax-${id}.json`, ax);
    chk('대화상자가 접근성 트리에 있음', !!ax, '');
    if (ax) {
      const flat = ax.items.map((i) => `${i.role}「${i.name.slice(0, 40)}」`);
      chk('대화상자 이름 = 「생각 남기기 …질문」', ax.dialogName.startsWith('생각 남기기 ') && ax.dialogName.endsWith('있습니까?') || ax.dialogName.endsWith('느껴집니까?'), ax.dialogName);
      const idx = (re) => ax.items.findIndex((i) => re.test(`${i.role} ${i.name}`));
      const iQ = idx(/^heading /);
      const iCite = idx(/(연구|통계)/);
      const iInput = idx(/^textbox 남길 글/);
      const iHint = ax.items.findIndex((i) => /개인정보는 적지/.test(i.name) || /개인정보는 적지/.test(i.desc));
      const iKeep = idx(/^button 적어두고 살기/);
      const iSkip = idx(/^button 마음속에 담고 살기/);
      chk('질문(heading)이 가장 먼저', iQ >= 0 && iQ < iInput, `heading ${iQ}, textbox ${iInput}`);
      if (auto) chk('인용이 질문 뒤·입력란 앞', iCite > iQ && iCite < iInput, `cite ${iCite}`);
      else chk('인용 없음(수동)', iCite < 0, `cite ${iCite}`);
      chk('입력란 → 1번 → 2번 순서', iInput >= 0 && iKeep > iInput && iSkip > iKeep, `${iInput}/${iKeep}/${iSkip}`);
      const tb = ax.items.find((i) => i.role === 'textbox');
      chk('입력란 설명에 개인정보 안내·글자 수', tb && /개인정보는 적지 마십시오/.test(tb.desc) && /0자 입력, 140자까지/.test(tb.desc), tb ? tb.desc : 'none');
      const kb = ax.items.find((i) => i.role === 'button' && i.name === '적어두고 살기');
      const sb = ax.items.find((i) => i.role === 'button' && i.name === '마음속에 담고 살기');
      chk('버튼 이름과 설명', kb && sb && /한 줄로 더해집니다/.test(kb.desc) && /저장하지 않고 넘어갑니다/.test(sb.desc), `${kb && kb.desc} / ${sb && sb.desc}`);
      chk('숫자 원(1·2)이 이름에 읽히지 않음', kb && !/^1/.test(kb.name) && sb && !/^2/.test(sb.name), `${kb && kb.name} / ${sb && sb.name}`);
      chk('머리 「연도년 · 나이세」의 가운뎃점이 읽히지 않음(개인정보 안내 문장 속 「실명·연락처」는 제외)', !ax.items.some((i) => /년s*·|·s*d+세/.test(i.name)), ax.items.filter((i) => /년s*·|·s*d+세/.test(i.name)).map((i) => i.name).join('|'));
      const head = ax.items.filter((i) => /^d{4}년|^d+세$/.test(i.name)).map((i) => i.name);
      chk('머리 낭독(참고)', true, head.join(' / '));
      // 입력란 안에 글을 쓰면 글자 수 설명이 바뀜
      await page.getByTestId('note-input').focus();
      await page.keyboard.insertText('가나다');
      await sleep(250);
      const ax2 = await AX(ctx, page);
      const tb2 = ax2.items.find((i) => i.role === 'textbox');
      chk('글을 쓰면 설명이 「3자 입력, 140자까지」', tb2 && /3자 입력, 140자까지/.test(tb2.desc), tb2 ? tb2.desc : 'none');
      // 빈 입력 오류: aria-invalid + 오류 문장 연결 + 상태 알림
      await page.getByTestId('note-input').fill('');
      await page.getByTestId('note-save').click({ force: true }).catch(() => {});
      await sleep(300);
      const inv = await page.evaluate(() => ({ invalid: document.querySelector('[data-testid="note-input"]').getAttribute('aria-invalid'), live: document.querySelector('[data-testid="note-msg"]').getAttribute('aria-live'), role: document.querySelector('[data-testid="note-msg"]').getAttribute('role'), msg: document.querySelector('[data-testid="note-msg"]').textContent }));
      chk('빈 입력 오류: aria-invalid·role=status·aria-live=polite', inv.invalid === 'true' && inv.role === 'status' && inv.live === 'polite' && inv.msg.length > 0, JSON.stringify(inv));
      chk('순서 한눈에', true, flat.join(' / '));
    }
    await ctx.close();
    return done(checks, [], { note: ax ? ax.items.map((i) => `${i.role}「${i.name.slice(0, 18)}」`).join(' / ').slice(0, 400) : '' });
  });
}

// ------------------------------------------------------------------ C01 대비 (라이트·다크·강제 색상)
const CONTRAST = () => {
  const lum = (c) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const rgb = (s) => {
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(s);
    return m ? { c: [Number(m[1]), Number(m[2]), Number(m[3])], a: m[4] === undefined ? 1 : Number(m[4]) } : null;
  };
  const effBg = (el) => {
    let layers = [];
    let n = el;
    while (n && n.nodeType === 1) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') layers.push({ img: cs.backgroundImage.slice(0, 40) });
      const c = rgb(cs.backgroundColor);
      if (c && c.a > 0) {
        layers.push({ c: c.c, a: c.a });
        if (c.a >= 1) break;
      }
      n = n.parentElement;
    }
    // 아래(뒤)에서 위로 합성
    let base = [255, 255, 255];
    for (const l of layers.reverse()) if (l.c) base = base.map((v, i) => Math.round(l.c[i] * l.a + v * (1 - l.a)));
    return { bg: base, hasImg: layers.some((l) => l.img) };
  };
  const out = [];
  const pairs = [
    ['질문(h2)', '[data-testid="note-title"]'],
    ['인용 본문', '[data-testid="cite-text"]'],
    ['인용 출처', '[data-testid="cite-src"]'],
    ['입력란 글자(입력 후)', '[data-testid="note-input"]'],
    ['개인정보 안내', '[data-testid="note-hint"]'],
    ['글자 수 n/140', '[data-testid="note-count"]'],
    ['알림·오류 문장', '[data-testid="note-msg"]'],
    ['1번 이름', '#nc-keep'],
    ['1번 설명', '#nc-keep-sub'],
    ['2번 이름', '#nc-skip'],
    ['2번 설명', '#nc-skip-sub'],
    ['끄기/켜기 칸', '[data-testid="note-cards-toggle"]'],
    ['시트 종류 「생각 남기기」', '#nc-kind'],
    ['확인 제목', '#nc-confirm-t'],
    ['확인 설명', '.note-confirm__sub'],
    ['확인 버튼(돌아가기)', '[data-testid="note-confirm-back"]'],
    ['확인 버튼(버림)', '[data-testid="note-confirm-discard"]'],
    ['40개 안내', '[data-testid="note-limit-sub"]'],
    ['나의 기록 라벨', '[data-testid="note-label"]'],
    ['나의 기록 글', '[data-testid="note-text"]'],
  ];
  for (const [name, sel] of pairs) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const cs = getComputedStyle(el);
    const fg = rgb(cs.color);
    const bgInfo = effBg(el);
    // 텍스트 자체 배경이 입력란처럼 자기 배경일 수 있어 자신 포함
    const own = rgb(cs.backgroundColor);
    const bg = own && own.a >= 1 ? own.c : bgInfo.bg;
    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    out.push({ name, kind: 'text', fg: fg && fg.c, bg, ratio: fg ? Math.round(ratio(fg.c, bg) * 100) / 100 : null, need: large ? 3 : 4.5, size: Math.round(size * 10) / 10, hasImg: bgInfo.hasImg });
  }
  // 비텍스트: 입력란 테두리, 두 버튼 테두리, 나의 기록 줄의 막대(왼쪽 테두리)
  const input = document.querySelector('[data-testid="note-input"]');
  if (input) {
    const cs = getComputedStyle(input);
    const bc = rgb(cs.borderTopColor);
    const sheetBg = effBg(input.parentElement).bg;
    out.push({ name: '입력란 테두리', kind: 'ui', border: cs.borderTopWidth + ' ' + cs.borderTopStyle, fg: bc && bc.c, bg: sheetBg, ratio: bc ? Math.round(ratio(bc.c, sheetBg) * 100) / 100 : null, need: 3 });
  }
  for (const [name, sel] of [['1번 버튼 테두리', '[data-testid="note-save"]'], ['2번 버튼 테두리', '[data-testid="note-skip"]'], ['끄기 칸 테두리', '[data-testid="note-cards-toggle"]']]) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const cs = getComputedStyle(el);
    const bc = rgb(cs.borderTopColor);
    const bg = effBg(el.parentElement).bg;
    out.push({ name, kind: 'ui', border: cs.borderTopWidth + ' ' + cs.borderTopStyle, fg: bc && bc.c, bg, ratio: bc ? Math.round(ratio(bc.c, bg) * 100) / 100 : null, need: 3 });
  }
  const row = [...document.querySelectorAll('[data-testid="log-row"]')].filter((r) => r.querySelector('[data-testid="note-label"]')).pop();
  if (row) {
    const cs = getComputedStyle(row);
    const bl = rgb(cs.borderLeftColor);
    const rowBg = rgb(cs.backgroundColor);
    const page = effBg(row.parentElement).bg;
    out.push({ name: '나의 기록 줄: 왼쪽 막대(테두리)', kind: 'ui', border: cs.borderLeftWidth + ' ' + cs.borderLeftStyle, fg: bl && bl.c, bg: page, ratio: bl ? Math.round(ratio(bl.c, page) * 100) / 100 : null, need: 3, rowBg: rowBg && rowBg.c, outline: cs.outlineWidth + ' ' + cs.outlineStyle, boxShadow: cs.boxShadow.slice(0, 50) });
  }
  return out;
};
const STATES_C = [
  { id: 'typed', label: '입력 후(인용 있는 자동 ①)', state: infant, auto: true, prep: async (p) => { await p.getByTestId('note-input').focus(); await p.keyboard.insertText('다섯 살의 감나무'); await sleep(200); } },
  { id: 'error', label: '빈 입력 오류(수동)', state: base, auto: false, prep: async (p) => { await p.getByTestId('note-save').click({ force: true }); await sleep(300); } },
  { id: 'confirm', label: '확인 단계(수동)', state: base, auto: false, prep: async (p) => { await p.getByTestId('note-input').focus(); await p.keyboard.insertText('버릴 글'); await p.getByTestId('note-skip').click({ force: true }); await p.waitForSelector('[data-testid="note-confirm"]'); await sleep(500); } },
  { id: 'limit', label: '40개 안내(수동)', state: null, auto: false, prep: async () => {} },
];
const full = await withNotes(oracle, base, 40);
const THEMES = [
  { id: 'light', media: { colorScheme: 'light', forcedColors: 'none' } },
  { id: 'dark', media: { colorScheme: 'dark', forcedColors: 'none' } },
  { id: 'forced', media: { colorScheme: 'light', forcedColors: 'active' } },
];
for (const S of STATES_C) {
  for (const T of THEMES) {
    await run({ id: `C01-${S.id}-${T.id}`, title: `대비 — ${S.label} · ${T.id === 'forced' ? '강제 색상(forced-colors: active)' : T.id === 'dark' ? '다크' : '라이트'}: 글자 ≥ 4.5:1(큰 글자 3:1), 입력란·버튼 테두리 ≥ 3:1${T.id === 'forced' ? ', 입력란 테두리·나의 기록 줄이 색 없이 구분됨' : ''}`, steps: '계산된 색으로 대비를 계산(합성 배경 포함)', expected: '모두 기준 이상' }, async () => {
      const { checks, chk } = mk();
      const shots = [];
      const { ctx, page } = await openSeeded(b, S.id === 'limit' ? full : S.state, { vp: { width: 360, height: 740 }, wait: S.auto ? '[data-testid="note-sheet"]' : '[data-testid="life-screen"]' });
      await page.emulateMedia(T.media);
      if (!S.auto) await page.getByTestId('tool-note').tap();
      await sheetReady(page);
      await sleep(300);
      await S.prep(page);
      await sleep(250);
      const rows = await page.evaluate(CONTRAST);
      appendJsonl('contrast.jsonl', { state: S.id, theme: T.id, rows });
      for (const r of rows) {
        if (T.id === 'forced') {
          if (r.kind === 'text') chk(`${r.name}`, r.ratio === null || r.ratio >= r.need, `${r.ratio}:1 (≥${r.need}) fg ${r.fg} bg ${r.bg}`);
          else chk(`${r.name}: 테두리가 보임(색 말고 두께·모양)`, r.ratio >= 3 && !/^0px/.test(r.border || '1px'), `${r.border} ${r.ratio}:1`);
        } else {
          if (r.kind === 'text') chk(`${r.name}`, r.ratio >= r.need, `${r.ratio}:1 (≥${r.need}) 글자 ${r.size}px`);
          else chk(`${r.name}`, r.ratio >= r.need, `${r.ratio}:1 (≥${r.need}) ${r.border}`);
        }
      }
      shots.push(await shot(page, `C01-${S.id}-${T.id}`, 'sheet'));
      // 나의 기록 줄 (시트 닫은 뒤): 저장 글이 있는 인생 기록 줄의 색·구분
      if (S.id === 'typed') {
        await page.getByTestId('note-save').tap();
        await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 4000 });
        await sleep(400);
        const r2 = await page.evaluate(CONTRAST);
        appendJsonl('contrast.jsonl', { state: 'row', theme: T.id, rows: r2 });
        for (const r of r2.filter((x) => /나의 기록/.test(x.name))) {
          if (T.id === 'forced') chk(`${r.name} (강제 색상)`, r.kind === 'text' ? r.ratio === null || r.ratio >= r.need : !/^0px/.test(r.border || '1px') || /[1-9]/.test(r.outline || ''), `${r.border || ''} outline ${r.outline || ''} ${r.ratio}:1`);
          else chk(`${r.name}`, r.ratio >= r.need, `${r.ratio}:1 (≥${r.need})`);
        }
        await page.evaluate(() => { const rows = [...document.querySelectorAll('[data-testid="log-row"]')].filter((r) => r.querySelector('[data-testid="note-label"]')); rows[rows.length - 1].scrollIntoView({ block: 'center' }); });
        await sleep(200);
        shots.push(await shot(page, `C01-${S.id}-${T.id}`, 'row'));
      }
      await ctx.close();
      return done(checks, shots);
    });
  }
}

// ------------------------------------------------------------------ E01 긴 사용자 글이 든 엔딩 연표
const LONGS = [
  '가'.repeat(140),
  'https://example.com/' + 'a'.repeat(120),
  'مرحبا '.repeat(23).trim(),
  'שלום עולם '.repeat(13).trim(),
  '👨‍👩‍👧'.repeat(50),
  'Z' + '̛̰̍͑'.repeat(40) + 'algo',
  '한 줄\n두 줄\n세 줄',
  '<script>alert(1)</script> "quote" \'single\' & &amp;',
];
const ended = await evalCore(
  oracle,
  `let s = arg.state;
   // 기록 8건을 나이를 올려 가며 쓴다(수동 기록)
   const texts = arg.texts;
   let i = 0;
   for (let g = 0; g < 2000 && s.phase === 'life'; g++) {
     if (s.pending !== null) { s = core.autoResolveStep(s, s.pending.key).state; continue; }
     const due = core.dueNote(s);
     if (due !== null) s = core.consumeNote(s, due);
     if (i < texts.length && s.age >= 10 + i * 6) { const w = core.writeNote(s, { cardId: null, text: texts[i] }); if (w !== s) { s = w; i++; } }
     s = core.stepYear(s).state;
   }
   return s;`,
  { state: { ...base, paused: false }, texts: LONGS },
);
await run({ id: 'E01', title: '긴 사용자 글(공백 없는 한글 140자·긴 URL·아랍·히브리·가족 이모지 50개·Zalgo·3줄·특수 문자)이 든 엔딩 연표와 인생 기록: 폭 320·360·1280 × 글자 100·200%에서 가로 넘침 0', steps: '기록 8건이 든 엔딩 저장을 열어 연표 줄 오른쪽 끝·문서 가로 넘침을 잰다', expected: '문서·연표 줄 가로 넘침 0, 방향 글이 라벨·나이를 끌고 가지 않음' }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  chk('엔딩 상태를 만듦(기록 8건)', noteRowsOf({ data: ended }).length >= 6, `${noteRowsOf({ data: ended }).length}건, 단계 ${ended.phase}`);
  for (const [w, h] of [[320, 568], [360, 740], [1280, 800]]) {
    for (const font of [100, 200]) {
      const { ctx, page } = await openSeeded(b, ended, { vp: { width: w, height: h }, touch: w < 600, wait: '[data-testid="ending-screen"]' });
      await setRootFont(page, font);
      await sleep(400);
      const m = await page.evaluate(() => {
        const tl = document.querySelector('[data-testid="ending-timeline"]') || document.body;
        const tr = tl.getBoundingClientRect();
        const rows = [...document.querySelectorAll('[data-testid="timeline-entry"]')].filter((r) => r.querySelector('[data-testid="note-label"]'));
        const bad = rows.map((r) => { const q = r.getBoundingClientRect(); const tx = r.querySelector('[data-testid="note-text"]').getBoundingClientRect(); const lab = r.querySelector('[data-testid="note-label"]').getBoundingClientRect(); const age = r.querySelector('.log__age').getBoundingClientRect(); return { right: Math.round(q.right), textRight: Math.round(tx.right), labX: Math.round(lab.x), ageX: Math.round(age.x), textW: Math.round(tx.width) }; });
        return { docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth, tlRight: Math.round(tr.right), rows: bad, n: rows.length };
      });
      const over = m.rows.filter((r) => r.right > m.tlRight + 1 || r.textRight > m.tlRight + 1);
      chk(`${w}×${h} 글자 ${font}%: 가로 넘침 0 · 연표 줄 안`, !m.docOverflow && over.length === 0 && m.n >= 6, JSON.stringify({ docOverflow: m.docOverflow, scrollW: m.scrollW, clientW: m.clientW, over: over.length, n: m.n }));
      const xs = new Set(m.rows.map((r) => r.labX));
      const ages = new Set(m.rows.map((r) => r.ageX));
      chk(`${w}×${h} 글자 ${font}%: 라벨·나이 x 위치가 모든 줄에서 같음(방향 글 영향 0)`, xs.size === 1 && ages.size === 1, `라벨 x ${[...xs].join(',')} 나이 x ${[...ages].join(',')}`);
      if ((w === 320 && font === 200) || (w === 360 && font === 100)) {
        await page.evaluate(() => { const r = [...document.querySelectorAll('[data-testid="timeline-entry"]')].filter((x) => x.querySelector('[data-testid="note-label"]')); r[0].scrollIntoView({ block: 'start' }); });
        await sleep(250);
        shots.push(await shot(page, 'E01', `${w}-${font}`));
      }
      await ctx.close();
    }
  }
  return done(checks, shots);
});

await b.close();
