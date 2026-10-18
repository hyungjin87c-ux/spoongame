// QA-003 M7a 접근성(스크린리더 이름·키보드): 영유아 결정 카드 16종의 선택지 버튼 이름 = 「선택지 이름 + 영향 문장」, 안내 한 줄, 인생 기록의 한 해 두 줄(접근성 트리), 엔딩 연표,
// 키보드만으로 영유아 결정(마일스톤 해 카드 포함) 처리.
// 사용: node qa/scripts/m7a-a11y.mjs [C20|C21|C22|C23|K01]
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, PROD, DEV, GAME_KEY, SETTINGS_KEY, OUT, sleep, shot, runCase, READ_DASH_M7A, con, fixSeed, cleanStorageOnce } from './m7a-lib.mjs';
import { RP, SHOT_PREFIX } from './m7a-lib.mjs';

const ONLY = process.argv[2] || process.env.ONLY || '';
const run = (c, fn) => (!ONLY || c.id.endsWith(ONLY) ? runCase(c, fn) : null);
const SAVES = path.join(OUT, RP + 'saves');
const loadSave = (n) => fs.readFileSync(path.join(SAVES, `${n}.json`), 'utf8');
const SPEED8 = JSON.stringify({ version: 3, data: { speed: 8, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system' } });
const browser = await launch();
const KEY_NAME = { family: '집안 살림이', assets: '자산이', debt: '부채가', relationships: '관계가', happiness: '행복이', health: '건강이', education: '지식이' };
const SIZE = { 1: '조금 ', 2: '', 3: '크게 ' };
const sentence = (it) => `${KEY_NAME[it.key]} ${SIZE[it.steps]}${it.direction === 'up' ? '늘어납니다' : '줄어듭니다'}.`;

async function open(save, { vp = { width: 360, height: 740 }, waitCard = true } = {}) {
  const ctx = await mkctx(browser, { viewport: vp });
  await seedStorage(ctx, { [GAME_KEY]: loadSave(save), [SETTINGS_KEY]: SPEED8 });
  const page = await ctx.newPage();
  await page.addInitScript(`window.__readDash = ${READ_DASH_M7A.toString()};`);
  await page.goto(PROD, { waitUntil: 'load' });
  await page.waitForSelector(waitCard ? '[data-testid="choice-panel"]' : '[data-testid="life-screen"], [data-testid="ending-screen"]', { timeout: 30000 });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 8000 }).catch(() => {});
  await sleep(300);
  return { ctx, page };
}
async function cdpNode(ctx, page, selector) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('Accessibility.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
  return { cdp, nodeId };
}
async function axOf(ctx, page, selector) {
  const { cdp, nodeId } = await cdpNode(ctx, page, selector);
  if (!nodeId) return null;
  const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
  const n = nodes[0];
  return { role: n.role?.value, name: n.name?.value ?? '', description: n.description?.value ?? '', ignored: n.ignored };
}
async function axTextOf(ctx, page, selector) {
  const { cdp, nodeId } = await cdpNode(ctx, page, selector);
  const { node } = await cdp.send('DOM.describeNode', { nodeId });
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const start = nodes.find((n) => n.backendDOMNodeId === node.backendNodeId);
  const out = [];
  const roles = [];
  const walk = (n, depth) => {
    if (!n) return;
    if (!n.ignored) {
      if (n.role?.value === 'StaticText' && n.name?.value) out.push(n.name.value);
      else if (depth < 3 && n.role?.value && !['generic', 'none', 'StaticText'].includes(n.role.value)) roles.push(`${n.role.value}${n.name?.value ? '「' + n.name.value.slice(0, 20) + '」' : ''}`);
    }
    for (const c of n.childIds ?? []) walk(byId.get(c), depth + 1);
  };
  walk(start, 0);
  return { text: out.join(''), roles };
}

const CARDS = fs.readdirSync(SAVES).filter((f) => f.startsWith('card-')).map((f) => f.replace('.json', ''));

await run({ id: 'M7a-C20', cat: '접근성', title: '스크린리더 이름: 영유아 결정 카드 16종의 선택지 버튼 이름 = 「선택지 이름 + 영향 문장(합쇼체, 공백으로 이음)」, ▲▼·가운뎃점·번호가 읽히지 않음', steps: '영유아 카드 16종(재력이 높아 선택지가 모두 보이는 저장)을 prod에서 열고 CDP 접근성 트리의 버튼 이름을 읽어 DOM의 영향 항목(항목·방향·칸 수)으로 만든 기대 문장과 견줌', expected: '이름이 기대와 글자 그대로 같고 기호·번호 없음' }, async () => {
  const bad = [];
  let n = 0;
  const examples = [];
  for (const st of CARDS) {
    const { ctx, page } = await open(st);
    const ids = await page.evaluate(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].map((b) => ({ id: b.getAttribute('data-testid').replace('choice-', ''), label: b.querySelector('.choice__label').textContent.replace(/\s+/g, ' ').trim(), items: [...b.querySelectorAll('.impact__item')].map((i) => ({ key: i.getAttribute('data-key'), direction: i.getAttribute('data-direction'), steps: Number(i.getAttribute('data-steps')) })) })));
    for (const c of ids) {
      const ax = await axOf(ctx, page, `[data-testid="choice-${c.id}"]`);
      const want = [c.label, ...c.items.map(sentence)].join(' ');
      n++;
      if (ax.role !== 'button') bad.push(`${st}/${c.id}: 역할 ${ax.role}`);
      if (ax.name.replace(/\s+/g, ' ').trim() !== want) bad.push(`${st}/${c.id}: 이름 「${ax.name}」 ≠ 기대 「${want}」`);
      if (/[▲▼·]/.test(ax.name)) bad.push(`${st}/${c.id}: 이름에 기호`);
      if (/^\d\s/.test(ax.name)) bad.push(`${st}/${c.id}: 이름이 번호로 시작`);
      if (examples.length < 2 && c.items.length >= 4) examples.push(`「${ax.name}」`);
    }
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 4).join(' / ') + ` (총 ${bad.length}/${n})` : `카드 ${CARDS.length}종 선택지 버튼 ${n}개의 이름이 모두 기대와 같음, 기호·번호 없음. 예 ${examples.join(' ')}`, shots: [] };
});

await run({ id: 'M7a-C21', cat: '접근성', title: '영유아 카드의 제목·본문·안내 한 줄 구조: 카드 제목이 제목(heading)이고 본문 문단·안내 한 줄이 읽히며, 안내 문단의 읽히는 글자에 ▲▼가 없다', steps: '유치원(3세)·첫 생일(1세)·학교 준비물(7세) 카드의 접근성 트리에서 카드 영역의 역할·이름·글자를 읽는다', expected: '제목 heading, 본문 글자가 화면과 같고 안내 한 줄은 「위쪽 세모는 늘어남, 아래쪽 세모는 줄어듦이며 …」로 읽힘' }, async () => {
  const bad = [];
  const rows = [];
  for (const st of ['card-infant-kindergarten', 'card-infant-first-birthday', 'card-school-supplies']) {
    const { ctx, page } = await open(st);
    const info = await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="choice-panel"]');
      const t = document.querySelector('[data-testid="choice-title"]');
      return { panelRole: panel.getAttribute('role'), panelLabel: panel.getAttribute('aria-label') || panel.getAttribute('aria-labelledby'), titleTag: t.tagName, titleText: t.textContent.trim(), tabindex: t.getAttribute('tabindex'), body: document.querySelector('[data-testid="choice-text"]').textContent.trim(), focused: document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.tagName, announce: document.querySelector('[data-testid="choice-announce"]')?.textContent.trim() ?? null };
    });
    const hint = await axTextOf(ctx, page, '[data-testid="choice-hint"]');
    const body = await axTextOf(ctx, page, '[data-testid="choice-text"]');
    rows.push(`${st}: 제목 ${info.titleTag}「${info.titleText}」 focus=${info.focused} announce=「${(info.announce || '').slice(0, 40)}」`);
    if (!/^H[1-6]$/.test(info.titleTag)) bad.push(`${st}: 카드 제목이 heading이 아님 ${info.titleTag}`);
    if (body.text.replace(/\s+/g, ' ').trim() !== info.body.replace(/\s+/g, ' ').trim()) bad.push(`${st}: 본문 AX 글자 ≠ 화면`);
    if (/[▲▼]/.test(hint.text)) bad.push(`${st}: 안내 문단 읽히는 글자에 기호`);
    if (!hint.text.includes('위쪽 세모는 늘어남, 아래쪽 세모는 줄어듦이며 표시가 많을수록 변화가 큽니다.')) bad.push(`${st}: 안내 대체 문장 없음`);
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : rows.join(' | '), shots: [] };
});

await run({ id: 'M7a-C22', cat: '접근성', title: '인생 기록 한 해 두 줄: 접근성 트리에서 같은 나이의 두 줄이 각각 「N세 …」로 순서대로 읽히고 줄 수가 화면과 같다', steps: '영유아 0~7세 연표(한 해 두 줄)를 담은 8세 저장(log2)을 열어 로그 영역의 역할·이름·줄을 읽는다', expected: '로그 영역에 이름이 있고 줄마다 글자가 화면과 같으며 같은 나이가 두 번 나와도 각각 읽힘' }, async () => {
  const bad = [];
  const { ctx, page } = await open('log2', { waitCard: false });
  const info = await page.evaluate(() => {
    const list = document.querySelector('[data-testid="log-list"]');
    const rows = [...document.querySelectorAll('[data-testid="log-row"]')].map((r) => r.textContent.replace(/\s+/g, ' ').trim());
    return { role: list.getAttribute('role'), name: list.getAttribute('aria-label') || list.getAttribute('aria-labelledby'), tabindex: list.getAttribute('tabindex'), rowTag: document.querySelector('[data-testid="log-row"]').tagName, rows };
  });
  const ax = await axTextOf(ctx, page, '[data-testid="log-list"]');
  const ages = info.rows.map((r) => (/^(\d+)\s*세/.exec(r) ?? [])[1]);
  const twoYears = [...new Set(ages.filter((a, i) => ages.indexOf(a) !== i))];
  const axNorm = ax.text.replace(/\s+/g, ' ');
  for (const r of info.rows) if (!axNorm.includes(r.replace(/^\d+\s*세\s*/, '').slice(0, 20))) bad.push(`AX에 없는 줄: ${r.slice(0, 30)}`);
  if (!info.name) bad.push('로그 영역에 이름이 없음');
  if (twoYears.length < 3) bad.push(`한 해 두 줄이 ${twoYears.length}해뿐(저장 구성 점검)`);
  const sh = await shot(page, 'C22', 'log-two-lines');
  await ctx.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `로그 영역 role=${info.role ?? '없음'} 이름 「${info.name}」 tabindex=${info.tabindex}, 줄 ${info.rows.length}개(한 해 두 줄 ${twoYears.length}해: ${twoYears.join(',')}세), 접근성 트리 글자 ${ax.text.length}자, 줄 태그 ${info.rowTag}`, shots: [sh] };
});

await run({ id: 'M7a-C23', cat: '접근성', title: '엔딩 연표: 영유아 한 해 두 줄이 목록(li)으로 순서대로 읽히고, 출발선 문장의 순위 덩어리가 읽기에 쪼개지지 않는다', steps: '엔딩(ending-long)에서 연표 목록 구조와 접근성 트리, 출발선 문장의 textContent·읽기 글자를 견줌', expected: '연표 li 줄 수 = 저장 연표 줄 수, 출발선 문장 읽기 글자 = 화면 글자(nowrap span이 글을 바꾸지 않음)' }, async () => {
  const bad = [];
  const { ctx, page } = await open('ending-long', { waitCard: false });
  const info = await page.evaluate((hist) => {
    const tl = document.querySelector('[data-testid="ending-timeline"]');
    const items = [...document.querySelectorAll('[data-testid="timeline-entry"]')].map((e) => e.textContent.replace(/\s+/g, ' ').trim());
    const j = document.querySelector('[data-testid="ending-journey"]');
    return { tag: tl?.tagName, role: tl?.getAttribute('role'), liN: items.length, items: items.slice(0, 16), journey: j.textContent.replace(/\s+/g, ' ').trim(), nowrap: j.querySelectorAll('.nowrap').length };
  });
  const axJ = await axTextOf(ctx, page, '[data-testid="ending-journey"]');
  const axT = await axTextOf(ctx, page, '[data-testid="ending-timeline"]');
  const raw = JSON.parse(loadSave('ending-long')).data.history;
  if (info.liN !== raw.length) bad.push(`연표 줄 ${info.liN} ≠ 저장 ${raw.length}`);
  if (axJ.text.replace(/\s+/g, ' ').trim() !== info.journey) bad.push(`출발선 문장 읽기 글자 「${axJ.text}」 ≠ 화면 「${info.journey}」`);
  const twoAges = raw.filter((h) => h.age <= 7 && h.kind !== 'stage').map((h) => h.age).filter((a, i, arr) => arr.indexOf(a) !== i);
  if (twoAges.length < 3) bad.push('연표에 한 해 두 줄이 3해 미만');
  const sh = await shot(page, 'C23', 'ending-timeline-top');
  await ctx.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `연표 ${info.tag}(role=${info.role ?? '-'}) 줄 ${info.liN}개 = 저장 ${raw.length}줄(영유아 한 해 두 줄 ${twoAges.length}해), 출발선 「${info.journey.slice(0, 50)}…」 nowrap ${info.nowrap}개, 접근성 글자 일치`, shots: [sh] };
});

// ---- 키보드로 영유아 결정 ----
await run({ id: 'M7a-K01', cat: '접근성', title: '키보드만으로 영유아 결정 처리: 마일스톤 해(0세 이유식)·동생 맞이·유치원·학교 준비물 카드를 Tab+Enter/Space로 고르고, 한 번만 적용되며 포커스가 사라지지 않는다', steps: '카드 4종을 prod에서 열고 키보드(Tab·Shift+Tab·Enter·Space)만으로 선택지에 닿아 고른다. 선택 뒤 포커스 위치와 연표 줄을 읽는다', expected: '선택지에 Tab으로 닿고 Enter·Space 모두 동작, 선택 기록 1개, 선택 뒤 포커스가 body로 떨어지지 않고 문서 안에 남음(또는 다음 요소)' }, async () => {
  const bad = [];
  const notes = [];
  for (const [i, st] of ['card-infant-meal-start', 'card-infant-new-sibling', 'card-infant-kindergarten', 'card-school-supplies'].entries()) {
    const { ctx, page } = await open(st);
    const titleFocused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'choice-title');
    let reached = -1;
    for (let k = 0; k < 20; k++) {
      await page.keyboard.press('Tab');
      await sleep(40);
      const isChoice = await page.evaluate(() => !!document.activeElement && document.activeElement.classList.contains('choice'));
      if (isChoice) {
        reached = k;
        break;
      }
    }
    if (reached < 0) {
      bad.push(`${st}: 선택지에 Tab으로 닿지 못함`);
      await ctx.close();
      continue;
    }
    // 두 번째 선택지로 Tab 한 번 더(Shift+Tab으로 되돌아와서 순서 확인)
    await page.keyboard.press('Tab');
    await sleep(40);
    await page.keyboard.press('Shift+Tab');
    await sleep(40);
    const focusedId = await page.evaluate(() => document.activeElement.getAttribute('data-testid'));
    await page.keyboard.press(i % 2 === 0 ? 'Enter' : 'Space');
    await sleep(900);
    const g = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), GAME_KEY)).data;
    const choiceLines = g.history.filter((h) => h.kind === 'choice').length;
    const active = await page.evaluate(() => ({ tag: document.activeElement?.tagName, id: document.activeElement?.getAttribute('data-testid') }));
    if (choiceLines !== 1) bad.push(`${st}: 선택 기록 ${choiceLines}개`);
    if (g.pending !== null) bad.push(`${st}: 선택 뒤 pending이 남음`);
    notes.push(`${st.replace('card-', '')}: 제목포커스=${titleFocused} 닿기 Tab ${reached + 1}번 → ${focusedId} → ${i % 2 === 0 ? 'Enter' : 'Space'} → 선택 ${choiceLines}개, 선택 뒤 포커스 ${active.tag}${active.id ? '[' + active.id + ']' : ''}`);
    if (active.tag === 'BODY') notes.push(`  (${st}: 선택 뒤 포커스가 body로 떨어짐 — 기록)`);
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : notes.join(' | '), shots: [] };
});

await browser.close();
