// QA-003 M5 접근성(스크린리더·키보드): 선택지 버튼 접근 가능한 이름 = 「선택지 이름 + 영향 문장」, 기호(▲▼·)가 읽히지 않음, 안내 한 줄의 읽기 문장, 자산 카드 aria-describedby,
// 키보드만으로 한 판의 모든 결정을 내리고 엔딩 → 다시 태어나기까지.
// 사용: node qa/scripts/m5-a11y.mjs
import fs from 'node:fs';
import { launch, mkctx, seedStorage, PROD, DEV, GAME_KEY, sleep, shot, runCase, READ_DASH_M5, con } from './m5-lib.mjs';
import { loadSave } from './m5-states.mjs';

const ONLY = process.env.ONLY || '';
const run = (c, fn) => (!ONLY || c.id.endsWith(ONLY) ? runCase(c, fn) : null);
const browser = await launch();
const KEY_NAME = { family: '집안 살림이', assets: '자산이', debt: '부채가', relationships: '관계가', happiness: '행복이', health: '건강이', education: '지식이' };
const SIZE = { 1: '조금 ', 2: '', 3: '크게 ' };
const VERB = { up: '늘어납니다', down: '줄어듦니다' };
const sentence = (it) => `${KEY_NAME[it.key]} ${SIZE[it.steps]}${it.direction === 'up' ? '늘어납니다' : '줄어듭니다'}.`;

async function open(era, tag, { base = PROD, vp = { width: 360, height: 740 } } = {}) {
  const ctx = await mkctx(browser, { viewport: vp });
  const page = await ctx.newPage();
  await page.addInitScript(`window.__readDash = ${READ_DASH_M5.toString()};`);
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(([k, v]) => {
    localStorage.clear();
    localStorage.setItem(k, v);
  }, [GAME_KEY, loadSave(era, tag)]);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('[data-testid="choice-panel"], [data-testid="life-screen"], [data-testid="ending-screen"]', { timeout: 15000 });
  await sleep(500);
  return { ctx, page };
}

// 접근성 트리의 이름·설명을 CDP로 읽는다
async function axOf(ctx, page, selector) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('Accessibility.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
  if (!nodeId) return null;
  const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
  const n = nodes[0];
  return { role: n.role?.value, name: n.name?.value ?? '', description: n.description?.value ?? '', ignored: n.ignored };
}

// 문단처럼 이름을 갖지 않는 요소는 접근성 트리의 자식 글자(StaticText, aria-hidden 제외)를 이어 「읽히는 글자」로 본다
async function axTextOf(ctx, page, selector) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('Accessibility.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
  const { node } = await cdp.send('DOM.describeNode', { nodeId });
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const start = nodes.find((n) => n.backendDOMNodeId === node.backendNodeId);
  const out = [];
  const walk = (n) => {
    if (!n) return;
    if (!n.ignored && n.role?.value === 'StaticText' && n.name?.value) out.push(n.name.value);
    for (const c of n.childIds ?? []) walk(byId.get(c));
  };
  walk(start);
  return out.join('');
}

// ---- C20: 선택지 버튼 이름 ----
await run({ id: 'M5-C20', cat: '접근성', title: '스크린리더 이름: 선택지 버튼의 접근 가능한 이름 = 「선택지 이름 + 영향 문장(합쇼체, 공백으로 이음)」, ▲▼·「·」·번호가 읽히지 않음', steps: '지금·지난·다가올 세상의 성인·20세 미만 선택지 카드에서 CDP 접근성 트리의 버튼 이름을 읽어 DOM의 영향 항목(항목·방향·칸 수)과 copy.md 4-2 문장 규칙으로 만든 기대값과 견준다', expected: '이름이 기대값과 글자 그대로 같고 ▲▼·가운뎃점·선택지 번호가 들어 있지 않음' }, async () => {
  const bad = [];
  let n = 0;
  const examples = [];
  for (const [era, tag] of [['present', 'adult-choice'], ['present', 'young-choice'], ['past', 'adult-choice'], ['future', 'adult-choice'], ['past', 'young-choice'], ['future', 'young-choice']]) {
    const { ctx, page } = await open(era, tag);
    const d = await page.evaluate(() => window.__readDash());
    for (const c of d.choices) {
      const ax = await axOf(ctx, page, `[data-testid="choice-${c.id}"]`);
      const want = [c.label, ...c.impact.map(sentence)].join(' ');
      n++;
      if (ax.role !== 'button') bad.push(`${era}/${tag}/${c.id}: 역할 ${ax.role}`);
      if (ax.name.replace(/\s+/g, ' ').trim() !== want) bad.push(`${era}/${tag}/${c.id}: 이름 「${ax.name}」 ≠ 기대 「${want}」`);
      if (/[▲▼·]/.test(ax.name)) bad.push(`${era}/${tag}/${c.id}: 이름에 기호`);
      if (/^\d\s/.test(ax.name)) bad.push(`${era}/${tag}/${c.id}: 이름이 번호로 시작`);
      if (examples.length < 3 && c.impact.length >= 3) examples.push(`「${ax.name}」`);
    }
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 5).join(' / ') + ` (총 ${bad.length}/${n})` : `선택지 버튼 ${n}개 이름이 모두 기대와 같음, 기호·번호 없음. 예 ${examples.join(' ')}`, shots: [] };
});

// ---- C21: 안내 한 줄·영향 줄 읽기 ----
await run({ id: 'M5-C21', cat: '접근성', title: '안내 한 줄: 첫 문장은 읽히고 둘째 문장은 기호 이름 없이 「위쪽 세모는 늘어남, 아래쪽 세모는 줄어듦…」으로 읽힌다. 영향 줄의 눈에 보이는 글자(자산 ▼▼)는 aria-hidden', steps: '안내 한 줄과 영향 줄의 aria-hidden·sr-only 구조, 접근성 트리의 안내 문단 이름을 읽는다', expected: '안내 문단의 접근성 이름에 「▲」「▼」가 없고 sr 대체 문장이 있음, `.impact__show`는 모두 aria-hidden' }, async () => {
  const bad = [];
  const { ctx, page } = await open('present', 'adult-choice');
  const info = await page.evaluate(() => {
    const hint = document.querySelector('[data-testid="choice-hint"]');
    const shows = [...document.querySelectorAll('.impact__show')];
    return {
      hintHtml: hint.innerHTML,
      hiddenSymbols: [...hint.querySelectorAll('[aria-hidden="true"]')].map((e) => e.textContent),
      srAlt: [...hint.querySelectorAll('.sr-only')].map((e) => e.textContent),
      showsHidden: shows.every((e) => e.getAttribute('aria-hidden') === 'true'),
      showsN: shows.length,
      srOnlyN: document.querySelectorAll('.impact__item .sr-only').length,
    };
  });
  const ax = { name: await axTextOf(ctx, page, '[data-testid="choice-hint"]') };
  if (!info.showsHidden) bad.push('영향 줄 눈에 보이는 글자가 aria-hidden이 아님');
  if (info.srOnlyN !== info.showsN) bad.push(`sr-only 문장 ${info.srOnlyN}개 ≠ 영향 항목 ${info.showsN}개`);
  if (/[▲▼]/.test(ax.name)) bad.push(`안내 문단 접근성 이름에 기호: ${ax.name}`);
  if (!ax.name.includes('위쪽 세모는 늘어남, 아래쪽 세모는 줄어듦이며 표시가 많을수록 변화가 큽니다.')) bad.push(`안내 문단에 대체 문장 없음: ${ax.name}`);
  if (!/^선택지 아래 글씨는 지금 .+에게 일어날 변화입니다\./.test(ax.name)) bad.push(`안내 첫 문장 이상: ${ax.name}`);
  // 「▲는 늘어남」 눈에 보이는 문장 자체가 접근성 이름에 읽히는가
  if (ax.name.includes('▲는 늘어남')) bad.push('눈에 보이는 기호 문장이 읽힘');
  await ctx.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `안내 문단 이름 「${ax.name}」 · 영향 항목 ${info.showsN}개 모두 aria-hidden + sr-only 문장 ${info.srOnlyN}개`, shots: [] };
});

// ---- C22: 자산 카드 aria-describedby ----
await run({ id: 'M5-C22', cat: '접근성', title: '자산 카드: 지난·다가올 세상은 금액 묶음(dl)이 aria-describedby로 「지금 가치로 환산」 태그를 가리키고(실제로 설명으로 읽힘), 지금 세상은 가리킴이 없으며, 가리키는 id가 끊어지지 않음', steps: '세 시대의 성인 대시보드에서 dl.aria-describedby·대상 요소·CDP 접근성 설명을 읽는다. 20세 미만 카드는 aria-label', expected: '지난·다가올: describedby=assets-basis → 존재하고 AX description = 「지금 가치로 환산」. 지금: describedby 없음. 카드 영역 이름 「자산 현황」' }, async () => {
  const bad = [];
  const rows = [];
  for (const era of ['present', 'past', 'future']) {
    const { ctx, page } = await open(era, 'adult-dash');
    const info = await page.evaluate(() => {
      const dl = document.querySelector('[data-testid="assets"]');
      const by = dl.getAttribute('aria-describedby');
      const target = by ? document.getElementById(by) : null;
      const card = document.querySelector('[data-testid="assets-card"]');
      const lab = card.getAttribute('aria-labelledby');
      return { by, targetText: target ? target.textContent.trim() : null, labelled: lab ? document.getElementById(lab)?.textContent.trim() : card.getAttribute('aria-label'), ids: [...document.querySelectorAll('[id]')].map((e) => e.id).filter((x, i, a) => a.indexOf(x) !== i) };
    });
    const ax = await axOf(ctx, page, '[data-testid="assets"]');
    rows.push(`${era}: describedby=${info.by ?? '없음'} 대상 「${info.targetText ?? ''}」 AX설명 「${ax.description}」 카드 이름 「${info.labelled}」`);
    if (era === 'present') {
      if (info.by) bad.push('지금 세상에 describedby가 있음');
      if (ax.description) bad.push(`지금 세상 AX 설명 「${ax.description}」`);
    } else {
      if (info.by !== 'assets-basis') bad.push(`${era}: describedby ${info.by}`);
      if (info.targetText !== '지금 가치로 환산') bad.push(`${era}: 대상 글자 ${info.targetText}`);
      if (ax.description !== '지금 가치로 환산') bad.push(`${era}: AX 설명 「${ax.description}」`);
    }
    if (info.labelled !== '자산 현황') bad.push(`${era}: 카드 이름 ${info.labelled}`);
    if (info.ids.length) bad.push(`${era}: 중복 id ${info.ids}`);
    await ctx.close();
  }
  // 20세 미만 카드
  {
    const { ctx, page } = await open('present', 'young-choice');
    const t = await page.evaluate(() => ({ label: document.querySelector('[data-testid="assets-card"]').getAttribute('aria-label'), note: document.querySelector('[data-testid="assets-note"]').textContent.trim(), dl: !!document.querySelector('[data-testid="assets"]') }));
    rows.push(`20세 미만: aria-label 「${t.label}」 안내 「${t.note}」 금액 묶음 ${t.dl ? '있음' : '없음'}`);
    if (t.label !== '자산 현황' || t.dl) bad.push('20세 미만 카드 이상');
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : rows.join(' | '), shots: [] };
});

// ---- C23: 엔딩 최종 순자산 줄의 읽기 구조 ----
await run({ id: 'M5-C23', cat: '접근성', title: '엔딩 「최종 순자산」 줄: dt/dd 구조, 금액·태그·자리 문장이 한 줄 안에서 읽힘, 「재산」 meter가 사라지고 meter는 4개', steps: '지금·지난·다가올 세상의 엔딩에서 final-net의 구조와 role=meter 개수, 접근성 트리의 이름을 읽는다', expected: 'dl 안에 dt 「최종 순자산」과 dd(금액·태그·「같은 세상 안에서 …」), role=meter 4개(건강·행복·지식·관계)' }, async () => {
  const bad = [];
  const rows = [];
  for (const era of ['present', 'past', 'future']) {
    const { ctx, page } = await open(era, 'ending');
    const t = await page.evaluate(() => {
      const dl = document.querySelector('[data-testid="final-net"]');
      return { dt: dl.querySelector('dt')?.textContent.trim(), dd: dl.querySelector('dd')?.innerText.replace(/\s+/g, ' ').trim(), tag: !!dl.querySelector('.tag'), meters: [...document.querySelectorAll('[role="meter"]')].map((m) => m.getAttribute('aria-label')) };
    });
    rows.push(`${era}: 「${t.dt}」 「${t.dd}」 meter [${t.meters}]`);
    if (t.dt !== '최종 순자산') bad.push(`${era}: dt ${t.dt}`);
    if (t.meters.length !== 4 || t.meters.includes('재산')) bad.push(`${era}: meter ${t.meters}`);
    if ((era === 'present') === t.tag) bad.push(`${era}: 태그 있음=${t.tag}`);
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : rows.join(' | '), shots: [] };
});

// ---- C01: 키보드만으로 한 판의 모든 결정 ----
await run({ id: 'M5-C01', cat: '접근성', title: '키보드만으로 결정을 끝까지: 선택지 카드마다 Tab으로 선택지에 닿아 Enter/Space로 고르고, 엔딩에서 다시 태어나기까지(마우스·DOM 클릭 0)', steps: '개발 서버(시간 배율 60)에서 새 판을 키보드(Tab·Shift+Tab·Enter·Space)만으로 진행: 선택지가 뜨면 포커스가 선택지 제목에 가고 Tab으로 선택지에 닿아 Enter(번갈아 Space)로 고른다', expected: '모든 선택지 카드를 키보드로 해결, 엔딩 도달, 다시 태어나기 버튼에 Tab으로 닿아 Enter → 첫 화면' }, async () => {
  const bad = [];
  let step = 'init';
  const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 }, hasTouch: false });
  try {
  const page = await ctx.newPage();
  await page.addInitScript(`window.__readDash = ${READ_DASH_M5.toString()};`);
  // 새 판은 시드만 고정(앱의 시드 뽑기)
  await page.addInitScript(() => {
    const orig = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = (b) => {
      if (b instanceof Uint32Array && b.length === 1) {
        b[0] = 4242;
        return b;
      }
      return orig(b);
    };
  });
  await page.goto(`${DEV}?__timescale=60`, { waitUntil: 'load' });
  const pressUntil = async (pred, max = 40) => {
    for (let i = 0; i < max; i++) {
      const hit = await page.evaluate(pred).catch(async (e) => {
        if (/Execution context was destroyed/.test(String(e))) {
          await page.waitForLoadState('load').catch(() => {});
          return false;
        }
        throw e;
      });
      if (hit) return i;
      await page.keyboard.press('Tab');
      await sleep(25);
    }
    return -1;
  };
  const pressTo = async (id, max = 40) => {
    for (let i = 0; i < max; i++) {
      if (await page.evaluate((x) => document.activeElement && document.activeElement.getAttribute('data-testid') === x, id)) return i;
      await page.keyboard.press('Tab');
      await sleep(25);
    }
    return -1;
  };
  // 첫 화면 → 태어나기
  step = '첫 화면';
  await page.waitForSelector('[data-testid="title-screen"]');
  await sleep(500);
  let tabs = await pressTo('start-birth');
  if (tabs < 0) bad.push('태어나기 버튼에 Tab으로 닿지 못함');
  await page.keyboard.press('Enter');
  await page.waitForSelector('[data-testid="roulette-screen"]', { timeout: 8000 });
  // 룰렛 → 건너뛰기/출생신고
  step = '룰렛';
  await sleep(600);
  const skip = await page.locator('[data-testid="skip-roulette"]').count();
  if (skip) {
    tabs = await pressTo('skip-roulette');
    await page.keyboard.press('Enter');
  }
  await page.waitForSelector('[data-testid="to-birth"]', { timeout: 15000 });
  await sleep(500);
  tabs = await pressTo('to-birth');
  if (tabs < 0) bad.push('출생신고로 가는 버튼에 Tab으로 닿지 못함');
  await page.keyboard.press('Enter');
  step = '출생신고';
  await page.waitForSelector('[data-testid="next-life"]', { timeout: 8000 });
  await sleep(500);
  tabs = await pressTo('next-life');
  if (tabs < 0) bad.push('살아가기 버튼에 Tab으로 닿지 못함');
  await page.keyboard.press('Enter');
  await page.waitForSelector('[data-testid="life-screen"]', { timeout: 8000 });
  // 배속 8: 키보드로
  step = '배속';
  await sleep(600);
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  tabs = await pressUntil(() => document.activeElement && document.activeElement.getAttribute('data-speed') === '8');
  if (tabs >= 0) await page.keyboard.press('Enter');
  step = '결정 루프';
  let decisions = 0;
  let focusOnTitle = 0;
  const t0 = Date.now();
  for (;;) {
    const d = await page.evaluate(() => window.__readDash());
    if (d.screen === 'ending-screen') break;
    if (Date.now() - t0 > 120000) {
      bad.push('시간 초과');
      break;
    }
    if (d.choices.length) {
      await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 5000 }).catch(() => {});
      const onTitle = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-testid') === 'choice-title');
      if (onTitle) focusOnTitle++;
      // 선택지에 닿을 때까지 Tab(제목에서 시작하면 첫 선택지가 바로 다음)
      const reached = await pressUntil(() => document.activeElement && document.activeElement.classList.contains('choice'), 14);
      if (reached < 0) {
        bad.push(`${d.age}세 「${d.choiceTitle}」: 선택지에 Tab으로 닿지 못함`);
        break;
      }
      await page.keyboard.press(decisions % 2 === 0 ? 'Enter' : 'Space');
      decisions++;
      await sleep(80);
      continue;
    }
    await sleep(30);
  }
  step = '엔딩';
  await sleep(400);
  const onEnding = await page.evaluate(() => !!document.querySelector('[data-testid="ending-screen"]'));
  if (!onEnding) bad.push('엔딩에 닿지 못함');
  let back = 'n/a';
  if (onEnding) {
    await page.waitForFunction(() => document.querySelector('[data-testid="rebirth"]')?.getAttribute('aria-disabled') !== 'true', null, { timeout: 4000 }).catch(() => {});
    tabs = await pressUntil(() => document.activeElement && document.activeElement.getAttribute('data-testid') === 'rebirth', 60);
    if (tabs < 0) bad.push('다시 태어나기에 Tab으로 닿지 못함');
    else {
      await page.keyboard.press('Enter');
      back = await page.waitForSelector('[data-testid="title-screen"]', { timeout: 6000 }).then(() => '첫 화면').catch(() => '첫 화면 아님');
      if (back !== '첫 화면') bad.push('다시 태어나기 뒤 첫 화면 아님');
    }
  }
  var s = await shot(page, 'C01', 'keyboard-done');
  await ctx.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `키보드만으로 선택 ${decisions}번(Enter·Space 번갈아) → 엔딩 → 다시 태어나기 → ${back}. 선택지가 뜰 때 포커스가 제목에 간 횟수 ${focusOnTitle}/${decisions}`, shots: [s] };
  } catch (e) {
    return { verdict: 'ERROR', actual: `단계 ${step}: ${String(e.message).slice(0, 200)}`, shots: [] };
  }
});

await browser.close();
