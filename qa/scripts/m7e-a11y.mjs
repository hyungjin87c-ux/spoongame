// QA-003 M7e 접근성(스크린리더 이름·키보드): 결정 카드 선택지 버튼 이름·안내 줄, 엔딩 새 화면(출발선 막대의 스크린리더 이름·제목 구조), 키보드.
// 사용: node qa/scripts/m7e-a11y.mjs [C20|C21|C22|K01]
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, PROD, DEV, GAME_KEY, SETTINGS_KEY, OUT, sleep, shot, runCase, READ_DASH_M7E, con, fixSeed, cleanStorageOnce } from './m7e-lib.mjs';
import { RP, SHOT_PREFIX } from './m7e-lib.mjs';

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
  await page.addInitScript(`window.__readDash = ${READ_DASH_M7E.toString()};`);
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
const ENDINGS = ['ending-present-t3-up', 'ending-present-t3-same', 'ending-past-t3-down', 'ending-present-t1-zero', 'ending-future-t1-zero', 'ending-past-t2', 'ending-present-t2-e-up3', 'ending-before20-present-t3-a17', 'ending-future-t5-e-dn3', 'ending-past-t4-top'];

await run({ id: 'M7e-C20', cat: '접근성', title: `스크린리더 이름: 결정 카드 ${CARDS.length}종 선택지 버튼 이름 = 「선택지 이름 + 영향 문장(합쇼체)」, ▲▼·가운뎃점·번호가 읽히지 않음`, steps: '성인 결정 카드 저장을 prod에서 열고 CDP 접근성 트리의 버튼 이름을 DOM의 영향 항목으로 만든 기대 문장과 견줌', expected: '이름이 기대와 글자 그대로 같고 기호·번호 없음' }, async () => {
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

await run({ id: 'M7e-C21', cat: '접근성', title: '결정 카드 안내 줄(새 문구): 「선택지 아래 글씨는 이 선택만으로 {이름}에게 생기는 변화입니다.」가 화면 글자·접근성 글자 모두에서 같고, 둘째 문장(기호 설명)·스크린리더 대체 문장이 그대로이며 ▲▼가 읽히지 않는다', steps: '성인·학창 카드 6종의 안내 줄 DOM과 접근성 트리 글자를 읽는다', expected: '첫 문장이 새 문구, 이름은 캐릭터 이름, 대체 문장 「위쪽 세모는 늘어남, 아래쪽 세모는 줄어듦이며 …」 있음' }, async () => {
  const bad = [];
  const rows = [];
  for (const st of ['card-school-tutoring-present', 'card-youth-housing-present', 'card-middle-parents-care-present', 'card-senior-estate-present', 'card-youth-startup-future', 'card-school-family-priority-past']) {
    const { ctx, page } = await open(st);
    const info = await page.evaluate((k) => ({ hint: document.querySelector('[data-testid="choice-hint"]').textContent.replace(/\s+/g, ' ').trim(), name: JSON.parse(localStorage.getItem(k)).data.character.name, titleTag: document.querySelector('[data-testid="choice-title"]').tagName }), GAME_KEY);
    const hint = await axTextOf(ctx, page, '[data-testid="choice-hint"]');
    const first = `선택지 아래 글씨는 이 선택만으로 ${info.name}에게 생기는 변화입니다.`;
    rows.push(`${st.replace('card-', '')}: 「${first.slice(0, 22)}…」`);
    if (!info.hint.startsWith(first)) bad.push(`${st}: 안내 첫 문장 「${info.hint.slice(0, 50)}」`);
    if (/지금 .*일어날/.test(info.hint)) bad.push(`${st}: 옛 문구가 남음`);
    if (/[▲▼]/.test(hint.text)) bad.push(`${st}: 안내 문단 읽히는 글자에 기호`);
    if (!hint.text.includes('위쪽 세모는 늘어남, 아래쪽 세모는 줄어듦이며 표시가 많을수록 변화가 큽니다.')) bad.push(`${st}: 안내 대체 문장 없음`);
    if (!/^H[1-6]$/.test(info.titleTag)) bad.push(`${st}: 카드 제목이 heading이 아님`);
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `6종 모두 새 안내 첫 문장·대체 문장 있음. ${rows.slice(0, 2).join(' | ')}`, shots: [] };
});

await run({ id: 'M7e-C22', cat: '접근성', title: '엔딩 출발선 막대 스크린리더 이름: role=img의 이름이 「출발선 {구간}, 마지막 {자리}. {방향 문장}」이고 화면 글자(범례·문장)에서 푼 기대와 같으며, 축 글자(하위·상위)는 읽히지 않고, 제목 계층(h1 → h2 → h3)이 순서대로', steps: `엔딩 ${ENDINGS.length}종을 prod에서 열어 CDP 접근성 트리로 막대 노드의 역할·이름과 하위 글자, 제목 목록을 읽는다`, expected: '이름 = 화면 글자 조합(글자 그대로), 축 글자 0, 제목 h1 1개·h2 3개(출발선에서 마지막까지·최종 스탯·생애 연표), h3은 단계 제목' }, async () => {
  const bad = [];
  const rows = [];
  const shots = [];
  for (const st of ENDINGS) {
    const { ctx, page } = await open(st, { waitCard: false });
    const d = await page.evaluate(() => {
      const t = (s) => document.querySelector(s)?.textContent.replace(/\s+/g, ' ').trim() ?? null;
      const rows = [...document.querySelectorAll('[data-testid="ending-legend"] > div')].map((r) => ({ dt: r.querySelector('dt')?.textContent.trim(), dd: r.querySelector('dd')?.textContent.replace(/\s+/g, ' ').trim() }));
      return { range: t('[data-testid="grade-range"]'), rows, movement: t('[data-testid="ending-movement"]'), heads: [...document.querySelectorAll('h1, h2, h3')].map((h) => `${h.tagName}:${h.textContent.replace(/\s+/g, ' ').trim()}`), mains: document.querySelectorAll('main').length };
    });
    const ax = await axOf(ctx, page, '[data-testid="ending-bar"]');
    const axT = await axTextOf(ctx, page, '[data-testid="ending-bar"]');
    const bandText = (d.range ?? '').replace(/^\(|\)$/g, '');
    const endText = d.rows.find((r) => r.dt === '마지막')?.dd ?? null;
    const want = endText ? `출발선 ${bandText}, 마지막 ${endText}.` : `출발선 ${bandText}.`; // r2: 방향 문장 없음
    rows.push(`${st.replace('ending-', '')}: ${ax.role}「${ax.name.slice(0, 40)}」`);
    if (ax.role !== 'image' && ax.role !== 'img') bad.push(`${st}: 막대 역할 ${ax.role}`);
    if (ax.name !== want) bad.push(`${st}: 막대 이름 「${ax.name}」 ≠ 화면 글자 조합 「${want}」`);
    if (axT.text.replace(/\s/g, '') === '하위상위' || /하위\s*상위/.test(axT.text)) bad.push(`${st}: 축 글자가 읽힘 「${axT.text}」`);
    const h1 = d.heads.filter((h) => h.startsWith('H1')).length;
    const h2 = d.heads.filter((h) => h.startsWith('H2')).map((h) => h.slice(3));
    if (h1 !== 1) bad.push(`${st}: h1 ${h1}개`);
    if (JSON.stringify(h2) !== JSON.stringify(['출발선에서 마지막까지', '최종 스탯', '생애 연표'])) bad.push(`${st}: h2 ${JSON.stringify(h2)}`);
    if (d.mains !== 1) bad.push(`${st}: main ${d.mains}개`);
    if (st === 'ending-present-t3-up') shots.push(await shot(page, 'C22', 'ending-present-t3-up'));
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 4).join(' / ') : `엔딩 ${ENDINGS.length}종 모두 막대 role=img·이름 = 화면 글자 조합, h1 1·h2 3 순서 정상. 예 ${rows.slice(0, 2).join(' | ')}`, shots };
});

await run({ id: 'M7e-K01', cat: '접근성', title: '키보드: 엔딩에서 Tab으로 「다시 태어나기」에 닿아 Enter, 결정 카드에서 Tab+Enter/Space로 고르기', steps: '엔딩 저장에서 Tab → 「다시 태어나기」 → Enter(새 판), 카드 저장에서 Tab으로 선택지 → Enter·Space', expected: '모두 닿고 동작, 선택 기록 1개' }, async () => {
  const bad = [];
  const notes = [];
  {
    const { ctx, page } = await open('ending-present-t3-up', { waitCard: false });
    let hit = false;
    for (let k = 0; k < 12; k++) {
      await page.keyboard.press('Tab');
      await sleep(40);
      if (await page.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'rebirth')) {
        hit = true;
        notes.push(`엔딩 Tab ${k + 1}번에 「다시 태어나기」`);
        break;
      }
    }
    if (!hit) bad.push('엔딩에서 「다시 태어나기」에 Tab으로 못 닿음');
    else {
      await sleep(900);
      await page.keyboard.press('Enter');
      await sleep(700);
      const scr = await page.evaluate(() => ['title-screen', 'roulette-screen', 'birth-screen', 'life-screen', 'ending-screen'].find((id) => document.querySelector(`[data-testid="${id}"]`)));
      if (scr === 'ending-screen' || !scr) bad.push(`Enter 뒤 화면 ${scr}`);
      notes.push(`Enter 뒤 ${scr}`);
    }
    await ctx.close();
  }
  for (const [i, st] of ['card-middle-parents-care-present', 'card-senior-estate-present'].entries()) {
    const { ctx, page } = await open(st);
    let reached = -1;
    for (let k = 0; k < 20; k++) {
      await page.keyboard.press('Tab');
      await sleep(40);
      if (await page.evaluate(() => !!document.activeElement && document.activeElement.classList.contains('choice'))) {
        reached = k;
        break;
      }
    }
    if (reached < 0) {
      bad.push(`${st}: 선택지에 Tab으로 닿지 못함`);
      await ctx.close();
      continue;
    }
    await page.keyboard.press(i % 2 === 0 ? 'Enter' : 'Space');
    await sleep(900);
    const g = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), GAME_KEY)).data;
    const n = g.history.filter((h) => h.kind === 'choice' && h.eventId === st.replace('card-', '').replace(/-(present|past|future)$/, '')).length;
    if (n !== 1) bad.push(`${st}: 선택 기록 ${n}개`);
    notes.push(`${st.replace('card-', '')}: Tab ${reached + 1}번 → ${i % 2 === 0 ? 'Enter' : 'Space'} → 선택 ${n}개`);
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : notes.join(' | '), shots: [] };
});

await browser.close();
