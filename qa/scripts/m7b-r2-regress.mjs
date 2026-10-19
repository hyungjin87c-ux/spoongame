// QA-003 M7b 회귀(prod, 360x740 터치): 첫 화면·룰렛·출생신고·대시보드 컨트롤·나가기 확인(접은 뒤)·화면별 새로고침 연타·뒤로가기, 영향 줄(M5) 구조, 엔딩(M7e 막대)·합쇼체.
// 사용: node qa/scripts/m7b-regress.mjs [케이스ID 일부]
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, cleanStorageOnce, openTitle, toRoulette, skipToBirth, birthToLife, waitGuard, sleep, shot, runCase, PROD, DEV, readBirth, readCard, readSave, choiceCount, TOUCH, OUT, con, cardReady, pickEra, READ_CARD } from './m7b-lib.mjs';

const ONLY = process.argv[2] || '';
const run = (c, fn) => (!ONLY || c.id.includes(ONLY) ? runCase({ cat: '회귀', ...c }, fn) : null);
const browser = await launch();
const mk = async (seed, viewport = { width: 360, height: 740 }) => {
  const ctx = await mkctx(browser, { viewport, ...TOUCH });
  await cleanStorageOnce(ctx);
  await fixSeed(ctx, seed);
  const page = await ctx.newPage();
  await page.addInitScript(`window.__readCard = ${READ_CARD.toString()};`);
  return { ctx, page };
};
const scr = (page) => page.evaluate(() => ['title-screen', 'roulette-screen', 'birth-screen', 'life-screen', 'ending-screen', 'superseded-screen', 'error-screen'].find((id) => document.querySelector(`[data-testid="${id}"]`)) || (document.body.innerText.trim() === '' ? 'BLANK' : 'unknown'));

// ---- R01 첫 화면
await run({ id: 'R01', title: '첫 화면: 로고·가상 인구·세상 3개·인생 길이 2개·태어나기·푸터 빌드 표기', steps: '새 저장소로 prod 첫 화면을 연다', expected: '구성이 M4~M7e와 같음, 외부 요청 0' }, async () => {
  const { ctx, page } = await mk(100);
  await openTitle(page, PROD);
  const t = await page.evaluate(() => ({ eras: document.querySelectorAll('input[data-testid^="era-"]').length, lens: [...document.querySelectorAll('input[data-testid^="life-"]')].map((e) => e.getAttribute('data-testid')), begin: !!document.querySelector('[data-testid="start-birth"]'), foot: (document.querySelector('[data-testid="page-foot"]')?.textContent || document.body.innerText.match(/v\d+\.\d+\.\d+[^\n]*/)?.[0] || '').replace(/\s+/g, ' ').slice(0, 60), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth }));
  const shots = [await shot(page, 'R01', 'title')];
  const bad = [];
  if (t.eras !== 3) bad.push(`세상 ${t.eras}개`);
  if (t.lens.length !== 2) bad.push(`인생 길이 ${t.lens.length}개`);
  if (!t.begin) bad.push('태어나기 없음');
  if (t.overflow) bad.push('가로 넘침');
  await ctx.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `세상 ${t.eras}·인생 길이 ${t.lens.join(',')}·푸터 「${t.foot}」`, shots };
});

// ---- R02 룰렛 → 출생신고 → 대시보드
await run({ id: 'R02', title: '룰렛 → 출생신고 → 인생 화면: 룰렛이 돌고 결과 확정, 출생신고 항목·또래 4명, 대시보드 진입', steps: '태어나기 → 룰렛 → 룰렛 넘기기 → 출생신고 → 인생 시작', expected: '각 화면이 열리고 항목이 모두 보임', }, async () => {
  const { ctx, page } = await mk(4321);
  await openTitle(page, PROD);
  await toRoulette(page, 'present');
  const shots = [await shot(page, 'R02', 'roulette')];
  await skipToBirth(page);
  const b = await readBirth(page);
  shots.push(await shot(page, 'R02', 'birth'));
  await birthToLife(page);
  await sleep(500);
  shots.push(await shot(page, 'R02', 'dashboard'));
  const bad = [];
  if (Object.keys(b.fields).length < 8) bad.push(`출생신고 항목 ${Object.keys(b.fields).length}`);
  if (b.peers.length !== 4) bad.push(`또래 ${b.peers.length}명`);
  if ((await scr(page)) !== 'life-screen') bad.push('인생 화면 아님');
  await ctx.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `출생신고 항목 ${Object.keys(b.fields).length}·또래 ${b.peers.length}명·이름 ${b.name}`, shots };
});

// ---- R03 대시보드 컨트롤 (카드가 없을 때)
await run({ id: 'R03', title: '대시보드 컨트롤: 일시정지·배속 4종·다음 결정으로·자동 모드·BGM·다크가 카드가 없을 때 정상 동작, 카드가 뜨면 시트가 컨트롤을 가린다(접으면 풀림)', steps: '인생 화면에서 일시정지 토글·배속·BGM·다크 토글 → 다음 결정으로 → 시트 → 컨트롤 시험 → 접기 → 컨트롤 시험', expected: '카드 없이는 모두 동작, 시트가 떠 있는 동안은 컨트롤이 inert, 접으면 다시 동작' }, async () => {
  const { ctx, page } = await mk(4322);
  await openTitle(page, PROD);
  await toRoulette(page, 'present');
  await skipToBirth(page);
  await birthToLife(page);
  await waitGuard(page, 'pause');
  const bad = [];
  const rows = [];
  const st = () => page.evaluate(() => ({ paused: document.querySelector('[data-testid="pause"]').getAttribute('data-paused'), speed: document.querySelector('[data-speed][aria-pressed="true"]')?.getAttribute('data-speed'), dark: document.querySelector('[data-testid="tool-dark"]').getAttribute('aria-pressed'), bgm: document.querySelector('[data-testid="tool-bgm"]').getAttribute('aria-pressed'), auto: document.querySelector('[data-testid="auto"]').getAttribute('aria-pressed') }));
  await page.getByTestId('pause').tap();
  await sleep(200);
  let s = await st();
  rows.push(`일시정지 → ${s.paused}`);
  if (s.paused !== 'true') bad.push('일시정지가 안 켜짐');
  await page.getByTestId('pause').tap();
  await page.locator('[data-speed="4"]').tap();
  await sleep(200);
  s = await st();
  rows.push(`배속 → ${s.speed}`);
  if (s.speed !== '4') bad.push(`배속 ${s.speed}`);
  await page.getByTestId('tool-dark').tap();
  await sleep(200);
  s = await st();
  rows.push(`다크 → ${s.dark}`);
  if (s.dark !== 'true') bad.push('다크 토글');
  const shots = [await shot(page, 'R03', 'dark-dashboard')];
  await page.getByTestId('tool-dark').tap();
  await page.getByTestId('tool-bgm').tap();
  await sleep(200);
  s = await st();
  rows.push(`BGM → ${s.bgm}`);
  await page.getByTestId('tool-bgm').tap();
  // 카드 앞에서
  await page.getByTestId('skip').tap();
  await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 20000 });
  await cardReady(page);
  const inertCount = await page.evaluate(() => ['[data-testid="dash-head"]', '.toolbar', 'main.dash'].filter((s) => document.querySelector(s)?.hasAttribute('inert')).length);
  rows.push(`시트 열림: inert ${inertCount}/3`);
  if (inertCount !== 3) bad.push(`시트 아래 inert ${inertCount}/3`);
  await page.getByTestId('decision-fold-btn').tap();
  await page.waitForSelector('[data-testid="decision-fold"]');
  await page.locator('[data-speed="2"]').tap();
  await sleep(200);
  s = await st();
  rows.push(`접은 뒤 배속 → ${s.speed}`);
  if (s.speed !== '2') bad.push('접은 뒤 컨트롤이 안 눌림');
  await ctx.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : rows.join(' | '), shots };
});

// ---- R04 나가기 확인 (접은 뒤)
await run({ id: 'R04', title: '나가기 확인: 접은 뒤 나가기 → 돌아가기 / 나가기 → 첫 화면 「이어서 살기」 → 같은 카드(열림)·같은 선택지', steps: '카드 → 접기 → 나가기 → 돌아가기(띠 유지) → 나가기 → 첫 화면으로 나가기 → 이어서 살기', expected: '돌아가기 뒤 띠 유지, 이어서 살기 뒤 같은 key의 열린 시트·선택지 같음, 선택 기록 불변' }, async () => {
  const { ctx, page } = await mk(4323);
  await openTitle(page, PROD);
  await toRoulette(page, 'present');
  await skipToBirth(page);
  await birthToLife(page);
  await waitGuard(page, 'skip');
  await page.getByTestId('skip').tap();
  await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 20000 });
  await cardReady(page);
  const c0 = await readCard(page);
  const base = choiceCount(await readSave(page));
  const bad = [];
  const rows = [];
  await page.getByTestId('decision-fold-btn').tap();
  await page.waitForSelector('[data-testid="decision-fold"]');
  await page.getByTestId('tool-exit').tap();
  await page.waitForSelector('[data-testid="exit-ask"]');
  const shots = [await shot(page, 'R04', 'exit-ask')];
  await page.getByTestId('exit-no').tap();
  await sleep(400);
  let c = await readCard(page);
  rows.push(`돌아가기 뒤: ${c.mode}, 확인 ${c.exitAsk}`);
  if (c.mode !== 'fold' || c.exitAsk) bad.push(`돌아가기 뒤 ${c.mode}/${c.exitAsk}`);
  await page.getByTestId('tool-exit').tap();
  await page.waitForSelector('[data-testid="exit-ask"]');
  await page.getByTestId('exit-yes').tap();
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 5000 });
  shots.push(await shot(page, 'R04', 'title-after-exit'));
  const resume = page.getByRole('button', { name: /이어서 살기/ });
  await resume.tap();
  await page.waitForSelector('[data-testid="life-screen"]');
  await sleep(600);
  c = await readCard(page);
  rows.push(`이어서 살기 뒤: ${c.mode}, key 같음 ${c.key === c0.key}, 선택지 같음 ${JSON.stringify(c.choices.map((x) => x.impact)) === JSON.stringify(c0.choices.map((x) => x.impact))}`);
  if (c.key !== c0.key) bad.push(`key ${c.key}`);
  if (c.mode !== 'sheet') bad.push(`복귀 모드 ${c.mode}`);
  if (JSON.stringify(c.choices.map((x) => x.impact)) !== JSON.stringify(c0.choices.map((x) => x.impact))) bad.push('영향 줄이 달라짐');
  if (choiceCount(await readSave(page)) !== base) bad.push('선택 기록이 바뀜');
  shots.push(await shot(page, 'R04', 'resumed'));
  await ctx.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : rows.join(' | '), shots };
});

// ---- R05 화면별 새로고침 연타 + 뒤로가기
await run({ id: 'R05', title: '새로고침 연타(화면마다 10번) + 뒤로·앞으로 — 첫 화면·룰렛·출생신고·대시보드(카드 없음)에서 같은 화면으로 복원', steps: '각 화면에서 reload 10번(300ms 간격), 마지막에 뒤로→앞으로', expected: '매번 같은 화면(룰렛은 확정된 모습), 오류·빈 화면 0, 저장 깨짐 0' }, async () => {
  const { ctx, page } = await mk(4324);
  const bad = [];
  const rows = [];
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 100)));
  const reloadMany = async (label, expect, n = 10) => {
    for (let i = 0; i < n; i++) {
      await page.reload({ waitUntil: 'load' });
      await sleep(250);
      const s = await scr(page);
      if (s !== expect) {
        bad.push(`${label} ${i + 1}번째: ${s}(기대 ${expect})`);
        break;
      }
    }
    rows.push(`${label}: ${n}번 → ${expect}`);
  };
  await openTitle(page, PROD);
  await reloadMany('첫 화면', 'title-screen');
  await toRoulette(page, 'present');
  await reloadMany('룰렛', 'roulette-screen');
  await skipToBirth(page).catch(async () => { await page.getByTestId('to-birth').tap().catch(() => {}); });
  await page.waitForSelector('[data-testid="birth-screen"]', { timeout: 6000 });
  await reloadMany('출생신고', 'birth-screen');
  await birthToLife(page);
  await sleep(300);
  await reloadMany('대시보드', 'life-screen');
  await page.goBack({ waitUntil: 'load' }).catch(() => {});
  await sleep(300);
  await page.goForward({ waitUntil: 'load' }).catch(() => {});
  await sleep(500);
  const s = await scr(page);
  rows.push(`뒤로→앞으로: ${s}`);
  if (s !== 'life-screen') bad.push(`뒤로→앞으로 뒤 ${s}`);
  if (errs.length) bad.push(`pageerror ${errs[0]}`);
  const shots = [await shot(page, 'R05', 'after-reloads')];
  await ctx.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : rows.join(' | '), shots };
});

// ---- R06 M5 영향 줄 구조 + 엔딩 (개발 서버 수확 + prod 엔딩)
await run({ id: 'R06', title: 'M5 영향 줄(수확 4,261장): 선택지마다 항목 형식 「이름 ▲▼(1~3개)」, 영향이 있으면 안내 줄(「선택지 아래 글씨는 …」)이 있다. 엔딩 합쇼체(180판)', steps: 'qa/results/m7b/samples-r2-*.jsonl 전수 정적 점검(2회차 수확)', expected: '영향 항목 형식 위반 0, 영향이 있는 카드에 안내 줄 100%, 엔딩 글 마침표 있는 문장이 모두 「니다.」로 끝남' }, async () => {
  const SAMPLES = path.resolve(OUT, '..'); // 2회차 수확 표본은 qa/results/m7b/samples-r2-*.jsonl (OUT = qa/results/m7b/r2)
  const files = fs.readdirSync(SAMPLES).filter((f) => /^samples-r2-(past|present|future)-[a-d]\.jsonl$/.test(f));
  const bad = [];
  let nCards = 0;
  let nChoices = 0;
  let withImpact = 0;
  let noHint = 0;
  let endN = 0;
  let nonHap = 0;
  const examples = [];
  const itemDist = {};
  const itemRe = /^(집안 살림|자산|부채|관계|행복|건강|지식)\s*(▲{1,3}|▼{1,3})$/;
  for (const f of files) {
    for (const line of fs.readFileSync(path.join(SAMPLES, f), 'utf8').trim().split('\n')) {
      const l = JSON.parse(line);
      for (const c of l.cards || []) {
        nCards++;
        let any = false;
        for (const ch of c.choices) {
          nChoices++;
          itemDist[ch.impact.length] = (itemDist[ch.impact.length] || 0) + 1;
          for (const it of ch.impact) {
            any = true;
            if (!itemRe.test(it.replace(/\s+/g, ' ').trim())) bad.push(`${c.key}/${ch.id}: 형식 「${it}」`);
          }
        }
        if (any) {
          withImpact++;
          if (!c.hint || !/선택지 아래 글씨는 이 선택만으로/.test(c.hint)) {
            noHint++;
            bad.push(`${c.key}: 영향 줄이 있는데 안내 줄 없음`);
          }
        }
      }
      if (l.endingText) {
        endN++;
        const sents = l.endingText.split('\n').map((s) => s.trim()).filter((s) => /[가-힣]/.test(s) && /[.!?]$/.test(s) && s.length > 8);
        for (const s of sents) if (!/니다\.$|다\.$/.test(s) && !/[가-힣]\)\.$/.test(s)) { nonHap++; if (examples.length < 3) examples.push(s.slice(0, 40)); }
        if (!l.endingText.includes('출발선')) bad.push(`${l.era} ${l.seed}: 엔딩에 출발선 없음`);
      }
    }
  }
  return { verdict: bad.length || nonHap ? 'FAIL' : 'PASS', actual: bad.length || nonHap ? `${bad.slice(0, 3).join(' / ')} 합쇼체 아닌 문장 ${nonHap} ${examples.join(' | ')}` : `카드 ${nCards}장·선택지 ${nChoices}개 영향 줄 형식 위반 0(항목 수 분포 ${JSON.stringify(itemDist)}), 영향이 있는 카드 ${withImpact}장 모두 안내 줄 있음, 엔딩 ${endN}판 모두 「출발선」 포함·마침표 문장 합쇼체 아닌 것 ${nonHap}`, shots: [] };
});
await browser.close();
