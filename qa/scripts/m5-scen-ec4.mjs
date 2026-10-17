// QA-003 M5 케이스 3(부채·자금 조건 선택지 EC4)·영향 줄 색. m5-craft.mjs가 만든 저장을 실제 화면(개발 서버, 시간 배율)에 넣어 화면에서 읽는다.
// 사용: node qa/scripts/m5-scen-ec4.mjs
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, DEV, OUT, GAME_KEY, sleep, shot, runCase, READ_DASH_M5, parseMan, waitGuard, con } from './m5-lib.mjs';

const crafted = JSON.parse(fs.readFileSync(path.join(OUT, 'craft-saves.json'), 'utf8'));
const browser = await launch();

async function open(name, { vp = { width: 1280, height: 800 }, extraCtx = {} } = {}) {
  const raw = crafted[name].raw;
  const ctx = await mkctx(browser, { viewport: vp, ...extraCtx });
  await seedStorage(ctx, { [GAME_KEY]: raw });
  const page = await ctx.newPage();
  await page.addInitScript(`window.__readDash = ${READ_DASH_M5.toString()};`);
  await page.goto(`${DEV}?__timescale=60`, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 20000 });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 6000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  return { ctx, page };
}

// ---------------- EC4: 자금·재력 조건 선택지가 숨는가 ----------------
// 기대는 이벤트 JSON의 requires(앱 코드가 아니라 데이터 문서)에서 가져온 규칙이다.
const EC4 = [
  { id: 'D04', title: '시설 입소(middle-parents-care/facility): 순자산 ≥ 0일 때만 보임', cases: [['care-neg3000', false], ['care-zero', true], ['care-rich', true]], choice: 'facility', all: ['home', 'facility', 'share'] },
  { id: 'D05', title: '여행(senior-travel/go): 순자산 ≥ 5,000만 원일 때만 보임 (경계 4,999 대 5,000)', cases: [['travel-neg500', false], ['travel-4999', false], ['travel-5000', true], ['travel-30000', true]], choice: 'go', all: ['go', 'near', 'photo'] },
  { id: 'D06', title: '재수(school-exam/retry): 부모 재력 ≥ 2단계일 때만 보임', cases: [['exam-tier1', false], ['exam-tier2', true], ['exam-tier3', true], ['exam-tier5', true]], choice: 'retry', all: ['apply', 'retry', 'work'] },
  { id: 'D07', title: '계속 준비(youth-exam-prep/persist): 순자산 ≥ −5,000만 원일 때만 보임 (경계 −5,001 대 −5,000)', cases: [['prep-m5001', false], ['prep-m5000', true], ['prep-m4999', true], ['prep-p3000', true]], choice: 'persist', all: ['persist', 'work', 'quit'] },
  { id: 'D08', title: '기존 자금 조건 2개(middle-child-school/fund·middle-layoff/open): 순자산 ≥ 0일 때만 보임', cases: [['childschool-neg1', false, 'fund'], ['childschool-zero', true, 'fund'], ['childschool-rich', true, 'fund'], ['layoff-neg1', false, 'open'], ['layoff-zero', true, 'open'], ['layoff-rich', true, 'open']], choice: null, all: null },
];
EC4.push({ id: 'D09', title: '기존 재력 조건 선택지 4개(infant-care/home ≥ 4단계·infant-stories/book ≥ 3·school-tutoring/tutor ≥ 4·youth-first-job/family ≥ 4)도 재력에 따라 숨는다(EC4 합계 10개)', cases: [['old-infant-care-t3', false, 'home'], ['old-infant-care-t4', true, 'home'], ['old-infant-stories-t2', false, 'book'], ['old-infant-stories-t3', true, 'book'], ['old-school-tutoring-t3', false, 'tutor'], ['old-school-tutoring-t4', true, 'tutor'], ['old-youth-first-job-t3', false, 'family'], ['old-youth-first-job-t4', true, 'family']], choice: null, all: null });
for (const g of EC4) {
  await runCase({ id: `M5-${g.id}`, cat: '부채·자금', title: g.title, steps: '자금·재력을 맞춘 저장(다음 해에 그 이벤트가 나오도록 난수만 맞춤)을 실제 화면에 넣고 선택지 카드를 읽는다', expected: '조건을 못 채우면 그 선택지가 안 보이고 나머지 둘(조건 없음)은 늘 보인다. 보이는 선택지마다 영향 줄이 있다' }, async () => {
    const rows = [];
    const shots = [];
    let bad = [];
    for (const [name, want, cid] of g.cases) {
      const choice = cid ?? g.choice;
      const { ctx, page } = await open(name);
      const d = await page.evaluate(() => window.__readDash());
      const ids = d.choices.map((c) => c.id);
      const visible = ids.includes(choice);
      const net = d.assets ? parseMan(d.assets.net) : null;
      const note = `${name}: 순자산 ${d.assets ? d.assets.net : '(20세 전)'} / ${d.choiceTitle} / 보이는 [${ids.join(',')}]`;
      rows.push(note);
      if (visible !== want) bad.push(`${name}: 「${choice}」 보임=${visible} 기대=${want}`);
      // 조건 없는 선택지 2개는 늘 보여야 한다
      const need = (g.all ?? ids).filter((x) => x !== choice);
      if (g.all && !need.every((x) => ids.includes(x))) bad.push(`${name}: 조건 없는 선택지가 빠짐 [${ids}]`);
      if (ids.length < 2) bad.push(`${name}: 선택지가 2개 미만`);
      // 보이는 모든 선택지에 대해 영향 줄이 1개 이상(없으면 안내 한 줄이 없다는 점만 기록)
      if (d.choices.some((c) => c.impact.length === 0)) rows.push(`  영향 줄 없는 선택지: ${d.choices.filter((c) => c.impact.length === 0).map((c) => c.id)}`);
      shots.push(await shot(page, g.id, name));
      await ctx.close();
    }
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : rows.join(' || '), shots };
  });
}

// ---------------- 부채: 자동 대출·붉은 부채 ▲ ----------------
await runCase({ id: 'M5-D01', cat: '부채·자금', title: '순자산 음수 판: 자산 카드가 U+2212 음수로, 부채는 양수로, 「빚」으로 바꿔 쓰지 않음, ▼ 접두 없음', steps: '순자산 −4,000만 원·부채 4,000만 원 저장을 화면에 넣고 자산 카드를 읽는다', expected: '순자산 「−4,000만 원」, 부채 「4,000만 원」, 이름은 순자산·연 소득·부채, 카드 안에 「빚」·「▼」·`.neg` 없음' }, async () => {
  const { ctx, page } = await open('guarantee-neg');
  const info = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="assets-card"]');
    return { text: card.innerText.replace(/\s+/g, ' '), html: card.innerHTML, net: document.querySelector('[data-testid="assets-net"]').textContent, debt: document.querySelector('[data-testid="assets-debt"]').textContent, neg: card.querySelectorAll('.neg').length };
  });
  const s = await shot(page, 'D01', 'assets-negative', {});
  await page.locator('[data-testid="assets-card"]').scrollIntoViewIfNeeded();
  const s2 = await shot(page, 'D01', 'assets-negative-card');
  const bad = [];
  if (!/^−4,000만 원$/.test(info.net.trim())) bad.push(`순자산 표기 「${info.net}」`);
  if (!/^4,000만 원$/.test(info.debt.trim())) bad.push(`부채 표기 「${info.debt}」`);
  if (/빚/.test(info.text)) bad.push('카드에 「빚」');
  if (/▼|▲/.test(info.text)) bad.push('카드에 ▲▼');
  if (info.neg) bad.push('.neg 클래스');
  await ctx.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `순자산 ${info.net} · 부채 ${info.debt} · 카드 글자 「${info.text.slice(0, 120)}」`, shots: [s, s2] };
});

await runCase({ id: 'M5-D02', cat: '부채·자금', title: '부채 ▲는 붉은색(해로움), 부채 ▼·자산 ▲는 초록(이로움), 색은 렌더 색으로 확인', steps: '보증 이벤트(순자산 500, 부채 0)·결혼 이벤트에서 영향 줄의 기호 색과 톤 클래스를 읽는다', expected: '부채 ▲ = bad(붉은 계열), 부채 ▼ = good(초록 계열), 다른 항목 ▲ = good·▼ = bad. 색이 좋음과 나쁨 사이에서 서로 다름' }, async () => {
  const out = [];
  const shots = [];
  const tones = [];
  for (const name of ['guarantee-small', 'marriage-neg', 'marriage-rich', 'health-neg', 'guarantee-rich']) {
    const { ctx, page } = await open(name);
    const d = await page.evaluate(() => window.__readDash());
    for (const c of d.choices) for (const i of c.impact) tones.push({ name, choice: c.id, key: i.key, direction: i.direction, steps: i.steps, tone: i.tone, color: i.color });
    shots.push(await shot(page, 'D02', name));
    await ctx.close();
  }
  const bad = [];
  const rgb = (s) => (/rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(s) || []).slice(1).map(Number);
  const colors = new Map();
  for (const t of tones) {
    const expectTone = t.key === 'debt' ? (t.direction === 'up' ? 'bad' : 'good') : t.direction === 'up' ? 'good' : 'bad';
    if (t.tone !== expectTone) bad.push(`${t.name}/${t.choice} ${t.key} ${t.direction}: 톤 ${t.tone} 기대 ${expectTone}`);
    if (!colors.has(t.tone)) colors.set(t.tone, new Set());
    colors.get(t.tone).add(t.color);
  }
  const goodC = [...(colors.get('good') ?? [])];
  const badC = [...(colors.get('bad') ?? [])];
  if (!goodC.length || !badC.length) bad.push('좋음/나쁨 둘 다 표본에 없음');
  else {
    const g = rgb(goodC[0]);
    const b = rgb(badC[0]);
    if (!(b[0] > b[1] + 30)) bad.push(`나쁨 색이 붉지 않음 ${badC[0]}`);
    if (!(g[1] > g[0])) bad.push(`좋음 색이 초록 계열이 아님 ${goodC[0]}`);
  }
  const debtUp = tones.filter((t) => t.key === 'debt' && t.direction === 'up');
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 5).join(' / ') : `표본 ${tones.length}개(부채 ▲ ${debtUp.length}개 모두 bad) · 좋음 ${goodC.join('|')} · 나쁨 ${badC.join('|')}`, shots };
});

await runCase({ id: 'M5-D03', cat: '부채·자금', title: '자동 대출: 순자산을 넘는 비용을 고르면 부채가 생기고(영향 줄 부채 ▲), 고른 뒤 순자산 음수·부채 = −순자산', steps: '순자산 500만 원 저장에서 보증(sign, −6,000) 선택', expected: '선택 전 영향 줄에 자산 ▼와 부채 ▲, 선택 뒤 자산 카드 순자산 음수·부채 > 0, 저장의 부채 ≥ −순자산' }, async () => {
  const { ctx, page } = await open('guarantee-small');
  const pre = await page.evaluate(() => window.__readDash());
  const sign = pre.choices.find((c) => c.id === 'sign');
  const shotPre = await shot(page, 'D03', 'before-sign');
  await page.locator('[data-testid="choice-sign"]').click();
  await page.waitForFunction(() => !document.querySelector('[data-testid="choice-panel"]'), null, { timeout: 6000 });
  await sleep(300);
  const post = await page.evaluate(() => window.__readDash());
  const save = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), GAME_KEY)).data;
  await page.locator('[data-testid="assets-card"]').scrollIntoViewIfNeeded();
  const shotPost = await shot(page, 'D03', 'after-sign');
  const bad = [];
  const hasDebtUp = sign.impact.some((i) => i.key === 'debt' && i.direction === 'up');
  const hasAssetDown = sign.impact.some((i) => i.key === 'assets' && i.direction === 'down');
  if (!hasDebtUp) bad.push('영향 줄에 부채 ▲ 없음');
  if (!hasAssetDown) bad.push('영향 줄에 자산 ▼ 없음');
  const net = parseMan(post.assets.net);
  const debt = parseMan(post.assets.debt);
  if (!(net < 0)) bad.push(`선택 뒤 순자산이 음수가 아님 ${post.assets.net}`);
  if (!(debt > 0)) bad.push(`선택 뒤 부채 ${post.assets.debt}`);
  if (!(save.assets.debt >= -save.assets.net)) bad.push('저장 불변식 위반');
  await ctx.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `영향 줄 ${sign.impact.map((i) => i.shown).join(' · ')} → 선택 뒤 순자산 ${post.assets.net}, 부채 ${post.assets.debt} (저장 net ${save.assets.net}/debt ${save.assets.debt})`, shots: [shotPre, shotPost] };
});

await browser.close();
