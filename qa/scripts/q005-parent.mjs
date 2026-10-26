// SPEC-005 QA 3 부모 결정·흘러감 공격: 경계 나이 12→13·18→19, 카드 표시 중 새로고침 연타·뒤로가기·탭 가림·일시정지, 다음 결정으로 연타, 자동 모드 토글, 구 저장.
// 상태는 개발 서버(5391)의 core로 만들고 프로덕션 빌드(4391)에 심어 연다. 사용: node qa/scripts/q005-parent.mjs --vp d1280|m360 [--engine webkit] [--part A|B|C|D|E]
import { launchChromium, launchWebkit, VP, Watch, PROD, DEV, run, ok, bad, note, shot, saveShot, sleep, overflowOf, focusHidden, readSave, seedPage, DEFAULT_SETTINGS, oracle, withoutPlay, QA_OBSERVER } from './q005-lib.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const VPN = arg('vp', 'd1280');
const ENGINE = arg('engine', 'chromium');
const PART = arg('part', 'ABCDE');
const tag = `${ENGINE === 'webkit' ? 'W-' : ''}${VPN}`;
const touch = !!VP[VPN].hasTouch;
const browser = await (ENGINE === 'webkit' ? launchWebkit() : launchChromium());
const devBrowser = await launchChromium();
const dev = await (await devBrowser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await dev.goto(DEV + '/');
await dev.getByTestId('title-screen').waitFor({ timeout: 90000 });

const SLOW = { ...DEFAULT_SETTINGS, speed: 1, autoMode: false, noteCards: false };
const X2 = { ...DEFAULT_SETTINGS, speed: 2, autoMode: false, noteCards: false };
const X8 = { ...DEFAULT_SETTINGS, speed: 8, autoMode: false, noteCards: false };

async function open(state, settings, opts = {}) {
  const ctx = await browser.newContext({ ...VP[VPN], locale: 'ko-KR', ...(opts.ctx ?? {}) });
  const watch = new Watch(tag).attach(ctx);
  const page = await ctx.newPage();
  await page.addInitScript(QA_OBSERVER);
  await seedPage(page, { game: state, settings });
  await page.goto(PROD + (opts.query ?? '/'));
  await page.getByTestId('life-screen').waitFor({ timeout: 60000 });
  return { ctx, page, watch };
}
const click = async (page, loc) => (touch ? loc.tap() : loc.click());
const qa = (page) => page.evaluate(() => window.__qa);
const snap = (page) =>
  page.evaluate(() => ({
    age: Number((document.querySelector('[data-testid="life-age"]')?.textContent ?? '').replace(/[^\d]/g, '')) || 0,
    card: document.querySelector('[data-testid="parent-card"]') ? document.querySelector('[data-testid="parent-card"]').getAttribute('data-key') : null,
    choice: document.querySelector('[data-testid="choice-panel"]')?.getAttribute('data-key') ?? null,
    screen: document.querySelector('[data-testid="ending-screen"]') ? 'ending' : 'life',
    paused: document.querySelector('[data-testid="pause"]')?.getAttribute('aria-pressed'),
  }));

// ---------------------------------------------------------------- 오라클: 부모·흘러감 해 찾기
const findYear = (opts) =>
  oracle(dev, `for (let seed = arg.from; seed < arg.from + 1500; seed++) {
      let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
      for (let g = 0; g < 200 && s.phase === 'life' && s.age < 19; g++) {
        if (s.pending !== null) { s = core.autoResolveStep(s, s.pending.key).state; continue; }
        const due = core.dueNote(s); if (due !== null) { s = core.consumeNote(s, due); }
        const r = core.stepYear(s);
        if (r.tick.kind === 'resolved' && r.tick.by === arg.by && s.age >= arg.minAge && (arg.eventId === null || r.tick.eventId === arg.eventId) && (arg.first === false || r.tick.firstParent === true || arg.first === null)) return { start: s, after: r.state, tick: r.tick };
        s = r.state;
      }
    }
    return null;`, { from: opts.from ?? 1, era: opts.era ?? 'present', by: opts.by ?? 'parent', minAge: opts.minAge ?? 0, eventId: opts.eventId ?? null, first: opts.first ?? null });

// ================================================================ A 경계 나이 12→13·18→19 (앱을 끝까지 돌려 deciderOf와 대조)
if (PART.includes('A')) {
  // 경계 나이에 카드가 있는 판 후보 찾기
  const cands = await oracle(dev, `const out = [];
      for (const era of ['present', 'past', 'future']) {
        const need = { 12: 3, 13: 3, 18: 3, 19: 3 }; const got = {};
        for (let seed = 1; seed < 900 && Object.values(need).some((v) => v > 0); seed++) {
          let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), era)));
          const snaps = {}; const hit = {};
          for (let g = 0; g < 400 && s.phase === 'life' && s.age < 22; g++) {
            if (s.pending !== null) { if ([12, 13, 18, 19].includes(s.pending.age) && hit[s.pending.age] === undefined) hit[s.pending.age] = s.pending.eventId; s = core.autoResolveStep(s, s.pending.key).state; continue; }
            if (s.pending === null && s.age >= 8) snaps[s.age] = s;
            const due = core.dueNote(s); if (due !== null) s = core.consumeNote(s, due);
            const r = core.stepYear(s);
            if (r.tick.kind === 'resolved' && r.tick.by !== undefined && [12, 13, 18, 19].includes(s.age) && hit[s.age] === undefined) hit[s.age] = r.tick.eventId;
            s = r.state;
          }
          for (const a of [12, 13, 18, 19]) if (hit[a] !== undefined && need[a] > 0 && snaps[a - 2]) { need[a]--; out.push({ era, seed, boundary: a, eventId: hit[a], start: snaps[a - 2] }); }
        }
      }
      return out;`);
  console.log('경계 후보', cands.length);
  const results = [];
  const queue = cands.slice();
  const worker = async () => {
    while (queue.length) {
      const c = queue.shift();
      const { ctx, page } = await open({ ...withoutPlay(c.start), paused: false }, X8);
      const picked = [];
      const t0 = Date.now();
      let guard = 0;
      while (Date.now() - t0 < 150000) {
        const sn = await snap(page);
        if (sn.screen === 'ending' || sn.age >= c.boundary + 3) break;
        if (sn.choice) {
          const btn = page.locator('[data-testid="choice-panel"] button.choice').first();
          await sleep(300);
          await click(page, btn).catch(() => {});
          picked.push(sn.choice);
        }
        if (await page.getByTestId('note-sheet').count()) await click(page, page.getByTestId('note-skip')).catch(() => {});
        await sleep(200);
        guard++;
      }
      const save = await readSave(page);
      const q = await qa(page);
      const hist = (save?.data?.history ?? []).filter((h) => h.kind === 'choice');
      const exp = await oracle(dev, `return arg.map((h) => ({ eventId: h.eventId, age: h.age, want: h.eventId ? core.deciderOf(h.eventId, h.age) : null }));`, hist.map((h) => ({ eventId: h.eventId, age: h.age })));
      const rows = hist.map((h, i) => ({ eventId: h.eventId, age: h.age, by: h.by ?? 'self', want: exp[i].want === 'parent' ? 'parent' : exp[i].want === 'child' ? 'child' : 'self' }));
      const cardsSeen = q.cards.map((x) => `${x.key}|${x.by}`);
      const picksSeen = q.picks.map((x) => x.key);
      results.push({ ...c, start: undefined, startAge: c.start.age, rows: rows.filter((r) => r.age >= 8 && r.age <= 21), cardsSeen, picksSeen, ages: q.audits.map((a) => a.age).slice(-1) });
      await ctx.close();
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  const all = results.flatMap((r) => r.rows.filter((x) => x.age >= r.startAge).map((x) => ({ ...x, era: r.era })));
  const byAge = {};
  for (const r of all) (byAge[r.age] ??= []).push(r);
  const wrong = all.filter((r) => r.by !== r.want);
  const bnd = [12, 13, 18, 19].map((a) => `${a}세 ${(byAge[a] ?? []).length}장(${[...new Set((byAge[a] ?? []).map((r) => r.by))].join('/')})`).join(' · ');
  // 부모·흘러감 카드가 화면에 뜬 것(구경한 것) 대 위임 줄 수
  const delegatedRows = all.length ? all.filter((r) => r.want !== 'self') : [];
  const seenCards = results.flatMap((r) => r.cardsSeen);
  const seenPicks = results.flatMap((r) => r.picksSeen);
  await run({ id: `${tag}-P01-boundary`, area: '부모 결정', title: `${tag} 경계 나이 12→13·18→19: 앱이 실제로 처리한 결정자 = deciderOf`, steps: `세 시대의 ${cands.length}개 판을 경계 2년 전부터 8배속으로 직접 돌리며(본인 카드는 첫 선택지) 저장된 기록 줄의 by를 deciderOf와 대조`, expected: '모든 기록 줄에서 by = deciderOf(이벤트, 나이): 12세 이하 부모/흘러감, 13~18 부모 영역은 부모·본인 영역은 본인, 19세 이상 본인' }, async () => {
    const t = `판 ${results.length}개, 대조한 결정 ${all.length}건(8~21세), 불일치 ${wrong.length}건 ${JSON.stringify(wrong.slice(0, 4))} · 경계 나이별 ${bnd} · 화면에 뜬 부모·흘러감 카드 ${seenCards.length}장·본인 결정 시트 ${seenPicks.length}장`;
    const covered = [12, 13, 18, 19].every((a) => (byAge[a] ?? []).length >= 1);
    return wrong.length === 0 && covered && all.length > 0 ? ok(t) : bad(t);
  });
  // 본인 영역 카드는 시트로 / 위임 카드는 카드로 뜬 것 대조
  await run({ id: `${tag}-P01b-surface`, area: '부모 결정', title: `${tag} 위임 해는 비모달 카드, 본인 결정은 시트로 보인다(화면 표면 대조)`, steps: 'P01 판들에서 관찰한 카드·시트 목록 대 기록 줄', expected: '기록 줄 by=parent/child인 해 중 카드가 보인 것은 data-by 일치, 본인 줄은 시트가 뜸' }, async () => {
    let mism = 0;
    let delegatedWithCard = 0;
    let selfWithSheet = 0;
    let delegatedTotal = 0;
    let selfTotal = 0;
    for (const r of results) {
      for (const row of r.rows) {
        if (row.age < r.startAge || row.age > 19) continue; // 화면에서 실제로 지나간 해만(시작 상태 이전 해는 오라클이 지나옴)
        const key = `${row.eventId}@${row.age}`;
        if (row.by === 'self') {
          selfTotal++;
          if (r.picksSeen.includes(key)) selfWithSheet++;
        } else {
          delegatedTotal++;
          const seen = r.cardsSeen.find((c) => c.startsWith(key + '|'));
          if (seen) {
            delegatedWithCard++;
            if (!seen.endsWith('|' + row.by)) mism++;
          }
        }
      }
    }
    const t = `위임 ${delegatedTotal}건 중 카드가 보인 것 ${delegatedWithCard}건(by 불일치 ${mism}), 본인 ${selfTotal}건 중 시트가 보인 것 ${selfWithSheet}건`;
    return mism === 0 && selfWithSheet === selfTotal ? ok(t) : bad(t);
  });
}

// ================================================================ B 카드 한 장 자세히 (2배속): 비모달·버튼 없음·포커스 이동 없음·일시정지·탭 가림·새로고침 연타·뒤로가기
if (PART.includes('B')) {
  const Y = await findYear({ by: 'parent', era: 'present', minAge: 3, first: false });
  const { ctx, page, watch } = await open({ ...withoutPlay(Y.start), paused: false }, X2);
  // 포커스를 일시정지 버튼에 둔다(포커스를 가져가는지 보려고)
  await page.getByTestId('pause').focus();
  const card = await (async () => {
    for (let i = 0; i < 400; i++) {
      if (await page.getByTestId('parent-card').count()) return true;
      await sleep(100);
    }
    return false;
  })();
  await run({ id: `${tag}-P02-card-nonmodal`, area: '부모 결정', title: `${tag} 부모 카드: 비모달·버튼 없음·포커스 이동 없음·기록 카드 위·칩/도장/영향 줄`, steps: `${Y.tick.eventId}(${Y.start.age}세) 해를 2배속으로 열고 포커스를 일시정지 버튼에 둔 채 카드가 뜰 때까지`, expected: '카드는 role=dialog 아님, 내부 버튼 0, 포커스는 일시정지 버튼 그대로, 인생 기록 바로 위, 칩 「부모님의 결정」, 도장 「부모님이 이렇게 정했습니다」, 영향 줄 있음' }, async () => {
    if (!card) return bad('카드가 뜨지 않음', { shot: await shot(page, `${tag}-P02`) });
    const d = await page.evaluate(() => {
      const pc = document.querySelector('[data-testid="parent-card"]');
      const log = document.querySelector('[data-testid="log"]');
      const a = document.activeElement;
      const pr = pc.getBoundingClientRect();
      const lr = log.getBoundingClientRect();
      return {
        dialog: !!pc.closest('[role="dialog"]') || pc.getAttribute('role') === 'dialog', buttons: pc.querySelectorAll('button').length, live: pc.getAttribute('aria-live') ?? pc.querySelector('[aria-live]')?.getAttribute('aria-live') ?? null,
        focus: a ? `${a.tagName}#${a.dataset.testid ?? ''}` : null, chip: pc.querySelector('[data-testid="parent-chip"]')?.innerText, stamp: pc.querySelector('[data-testid="parent-stamp"]')?.innerText, label: pc.querySelector('[data-testid="parent-label"]')?.innerText,
        impact: !!pc.querySelector('[data-testid="impact"]'), items: pc.querySelectorAll('[data-testid="impact"] .impact__item').length, cite: !!pc.querySelector('[data-testid="cite"]'), aboveLog: pr.bottom <= lr.top + 1, gapOk: lr.top - pr.bottom < 40, title: pc.querySelector('[data-testid="parent-title"]')?.innerText,
      };
    });
    const t = JSON.stringify(d);
    return !d.dialog && d.buttons === 0 && /pause/.test(d.focus ?? '') && d.chip === '부모님의 결정' && d.stamp === '부모님이 이렇게 정했습니다' && d.items >= 1 && d.aboveLog ? ok(t) : bad(t, { shot: await shot(page, `${tag}-P02`) });
  });

  // 일시정지 중 카드가 멈춘다
  await run({ id: `${tag}-P03-pause-holds`, area: '부모 결정', title: `${tag} 일시정지하면 카드가 그 자리에 머문다·재개하면 사라진다`, steps: '카드 표시 중 「일시정지」 → 연출 대기(2배속 약 9~15초)의 1.5배 기다림 → 재개', expected: '일시정지 동안 카드가 그대로, 재개 뒤 카드가 사라지고 나이 +1' }, async () => {
    const key0 = await page.getByTestId('parent-card').getAttribute('data-key').catch(() => null);
    if (!key0) return note('카드가 이미 사라짐(앞 시험 지연) — 재시험 필요');
    const age0 = (await snap(page)).age;
    await page.getByTestId('pause').click();
    await sleep(25000);
    const still = await page.getByTestId('parent-card').count();
    const age1 = (await snap(page)).age;
    await page.getByTestId('pause').click();
    let gone = false;
    for (let i = 0; i < 300; i++) {
      if (!(await page.getByTestId('parent-card').count())) { gone = true; break; }
      await sleep(100);
    }
    const age2 = (await snap(page)).age;
    const t = `카드 ${key0}, 일시정지 25초 뒤 카드 ${still}장·나이 ${age0}→${age1}, 재개 뒤 사라짐 ${gone}·나이 ${age2}`;
    return still === 1 && age1 === age0 && gone && age2 >= age0 ? ok(t) : bad(t, { shot: await shot(page, `${tag}-P03`) });
  });
  const w = watch.take();
  await run({ id: `${tag}-P03b-console`, area: '공통', title: `${tag} 부모 카드 시험 중 콘솔·외부 요청`, steps: '감시', expected: '0건' }, async () => (w.console.length === 0 && w.external.length === 0 ? ok('0건') : bad(JSON.stringify(w))));
  await ctx.close();
}

// ================================================================ C 새로고침 연타(카드 표시 중)·탭 가림·뒤로가기
if (PART.includes('C')) {
  const Y = await findYear({ by: 'parent', era: 'present', minAge: 3, first: false, from: 40 });
  const { ctx, page, watch } = await open({ ...withoutPlay(Y.start), paused: false }, X2);
  for (let i = 0; i < 400; i++) {
    if (await page.getByTestId('parent-card').count()) break;
    await sleep(100);
  }
  const seedBefore = (await readSave(page)).data.seed;
  const saveBefore = await readSave(page);
  await run({ id: `${tag}-P04-reload-spam`, area: '부모 결정', title: `${tag} 카드 표시 중 새로고침 연타 15회: 같은 인생·카드가 다시 뜨지 않음·기록 줄 1번만`, steps: '카드가 뜬 순간부터 0.3초 간격 새로고침 15번', expected: '시드·이름 동일, 연타 뒤 parent-card 0장(재연출 없음), 해당 해의 기록 줄(by=parent)이 정확히 1줄, pending 없음' }, async () => {
    const hadCard = await page.getByTestId('parent-card').count();
    for (let i = 0; i < 15; i++) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await sleep(i % 2 === 0 ? 120 : 350);
    }
    await page.getByTestId('life-screen').waitFor({ timeout: 30000 });
    await sleep(1500);
    const cardAfter = await page.getByTestId('parent-card').count();
    const sv = await readSave(page);
    const rows = sv.data.history.filter((h) => h.kind === 'choice' && h.eventId === Y.tick.eventId);
    const t = `연타 전 카드 ${hadCard}장 → 후 ${cardAfter}장, 시드 ${seedBefore}→${sv.data.seed}, 이름 ${saveBefore.data.character.name}→${sv.data.character.name}, ${Y.tick.eventId} 기록 줄 ${rows.length}줄(by=${rows.map((r) => r.by).join(',')}), pending ${sv.data.pending ? '있음' : '없음'}, 나이 ${sv.data.age}`;
    return cardAfter === 0 && sv.data.seed === seedBefore && rows.length === 1 && rows[0].by === 'parent' && !sv.data.pending ? ok(t) : bad(t, { shot: await shot(page, `${tag}-P04`) });
  });
  await ctx.close();

  // 탭 가림 중 카드 유지
  const Y2 = await findYear({ by: 'child', era: 'present', minAge: 3, from: 1 });
  const o2 = await open({ ...withoutPlay(Y2.start), paused: false }, X2);
  const p2 = o2.page;
  for (let i = 0; i < 400; i++) {
    if (await p2.getByTestId('parent-card').count()) break;
    await sleep(100);
  }
  await run({ id: `${tag}-P05-hidden-tab`, area: '부모 결정', title: `${tag} 흘러감 카드(아이의 일) 표시 중 탭 가림: 시계가 멈추고 돌아오면 이어진다`, steps: '카드가 뜬 뒤 visibilityState=hidden으로 25초 → visible', expected: '가린 동안 카드·나이 불변, 돌아오면 카드가 사라지고 진행. 카드 칩 「아이의 일」, 도장 「이렇게 흘러갔습니다」' }, async () => {
    const has = await p2.getByTestId('parent-card').count();
    if (!has) return bad('흘러감 카드가 뜨지 않음', { shot: await shot(p2, `${tag}-P05`) });
    const chip = await p2.getByTestId('parent-chip').innerText();
    const stamp = await p2.getByTestId('parent-stamp').innerText();
    const a0 = (await snap(p2)).age;
    await p2.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    await sleep(25000);
    const during = { card: await p2.getByTestId('parent-card').count(), age: (await snap(p2)).age };
    await p2.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
    let gone = false;
    for (let i = 0; i < 300; i++) {
      if (!(await p2.getByTestId('parent-card').count())) { gone = true; break; }
      await sleep(100);
    }
    const t = `칩 「${chip}」·도장 「${stamp}」, 가림 중 카드 ${during.card}장·나이 ${a0}→${during.age}, 복귀 뒤 사라짐 ${gone}`;
    return chip === '아이의 일' && stamp === '이렇게 흘러갔습니다' && during.card === 1 && during.age === a0 && gone ? ok(t) : bad(t, { shot: await shot(p2, `${tag}-P05`) });
  });
  // 뒤로가기
  await run({ id: `${tag}-P06-back`, area: '부모 결정', title: `${tag} 어린 시절 진행 중 뒤로가기·앞으로가기: 같은 인생으로 복원`, steps: '뒤로 → 앞으로', expected: '같은 시드, 나이 후퇴 없음' }, async () => {
    const s0 = (await readSave(p2)).data;
    await p2.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await sleep(500);
    await p2.goForward({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await p2.getByTestId('life-screen').waitFor({ timeout: 30000 }).catch(() => {});
    await sleep(800);
    const s1 = (await readSave(p2)).data;
    const t = `시드 ${s0.seed}→${s1.seed}, 나이 ${s0.age}→${s1.age}`;
    return s0.seed === s1.seed && s1.age >= s0.age ? ok(t) : bad(t);
  });
  await o2.ctx.close();
}

// ================================================================ D 「다음 결정으로」 연타·자동 모드 토글·8배속
if (PART.includes('D')) {
  const S0 = await oracle(dev, `let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(arg), 'present')));
      return s;`, 77).then(withoutPlay);
  const { ctx, page, watch } = await open({ ...S0 }, X8);
  await run({ id: `${tag}-P07-skip-spam`, area: '부모 결정', title: `${tag} 「다음 결정으로」 12연타: 카드 없이 다음 본인 결정 앞에서 멈추고 기록 줄만 남는다`, steps: '0세 새 판(8배속)에서 「다음 결정으로」를 0.1초 간격으로 12번', expected: '나이가 다음 본인 결정(≥13세) 앞에서 멈추거나 기록 카드 앞에서 멈춤, parent-card 0장(스킵 중), 기록 줄에 by=parent/child 줄이 남음, 콘솔 0' }, async () => {
    const btn = page.getByTestId('skip');
    for (let i = 0; i < 12; i++) {
      await btn.click({ delay: 5, force: true, noWaitAfter: true, timeout: 1500 }).catch(() => {});
      await sleep(100);
    }
    await sleep(2500);
    const sn = await snap(page);
    const sv = (await readSave(page)).data;
    const q = await qa(page);
    const delegated = sv.history.filter((h) => h.by);
    const t = `나이 ${sn.age}, 화면 ${sn.choice ? '결정 시트 ' + sn.choice : sn.screen}, 위임 기록 ${delegated.length}줄(${delegated.map((h) => h.by[0] + h.age).join(',')}), 스킵 중 카드가 뜬 횟수 ${q.cards.length}, 올바른 상태: 일시정지=${sn.paused}`;
    return (sn.choice || sn.age >= 13 || delegated.length >= 1) && !sn.screen.includes('ending') ? ok(t) : bad(t, { shot: await shot(page, `${tag}-P07`) });
  });
  // 본인 결정 시트에서 「다음 결정으로」는 비활성이어야 한다
  await run({ id: `${tag}-P08-auto-toggle`, area: '부모 결정', title: `${tag} 자동 모드 켜고 끄기를 어린 시절에 반복: 0~12세 같은 인생`, steps: '자동 모드 6번 토글하며 8배속 진행', expected: '토글 상태가 번갈아 바뀌고, 어린 시절 위임 카드 처리에 영향 없음(기록 줄 by 유지), 오류 0' }, async () => {
    // 앞 시험이 본인 결정 시트에서 멈췄다면 먼저 고른다(시트가 떠 있으면 바깥 조작이 막힌다)
    for (let k = 0; k < 6 && (await page.getByTestId('choice-panel').count()); k++) {
      await page.waitForFunction(() => { const b = document.querySelector('[data-testid="choice-panel"] button.choice'); return b && b.getAttribute('aria-disabled') !== 'true'; }, null, { timeout: 5000 }).catch(() => {});
      await click(page, page.locator('[data-testid="choice-panel"] button.choice').first()).catch(() => {});
      await sleep(500);
    }
    const a = page.getByTestId('auto');
    const states = [];
    for (let i = 0; i < 6; i++) {
      await click(page, a, { force: true }).catch(() => {});
      await sleep(250);
      states.push(await a.getAttribute('aria-pressed'));
    }
    await sleep(1500);
    const w = watch.take();
    const t = `토글 ${states.join('→')}, 콘솔 ${w.console.length}`;
    return states.join() === 'true,false,true,false,true,false' && w.console.length === 0 ? ok(t) : bad(t);
  });
  await ctx.close();
}

// ================================================================ E 구 저장(대기 중 부모 영역 카드) 열기 (PD10)
if (PART.includes('E')) {
  const old = await oracle(dev, `const mod = await import('/src/data/events/index.ts');
      for (let seed = 1; seed < 600; seed++) {
        let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
        while (s.phase === 'life' && s.age < 3) { if (s.pending !== null) s = core.autoResolveStep(s, s.pending.key).state; else s = core.stepYear(s).state; }
        if (s.phase !== 'life' || s.age !== 3 || s.pending !== null) continue;
        const ev = mod.EVENT_POOL.byId.get('infant-care');
        const vis = core.visibleChoices(ev, core.condContextOf(s));
        if (vis.length < 2) continue;
        return { ...s, seen: { ...s.seen, 'infant-care': 3 }, lastChoiceAge: 3, pending: { eventId: 'infant-care', key: 'infant-care@3', age: 3, choiceIds: vis.map((c) => c.id) } };
      }
      return null;`);
  if (!old) {
    await run({ id: `${tag}-P09-old-save`, area: '부모 결정', title: '구 저장(부모 영역 pending) 열기', steps: '-', expected: '-' }, async () => note('오라클이 구 저장을 만들지 못함'));
  } else {
    const { ctx, page, watch } = await open(withoutPlay(old), SLOW);
    await sleep(1500);
    await run({ id: `${tag}-P09-old-save`, area: '부모 결정', title: `${tag} 구 저장(v8, 3세 부모 영역 카드가 대기 중)을 열면 열자마자 부모 결정으로 처리`, steps: 'pending=infant-care@3인 v8 저장을 심고 열기', expected: '결정 시트 없음, pending 해제, 기록 줄 by=parent 1줄, 오류 0' }, async () => {
      const sv = (await readSave(page)).data;
      const sheet = await page.getByTestId('choice-panel').count();
      const rows = sv.history.filter((h) => h.eventId === 'infant-care');
      const w = watch.take();
      const t = `시트 ${sheet}장, pending ${sv.pending ? JSON.stringify(sv.pending) : '없음'}, infant-care 줄 ${rows.length}(by=${rows.map((r) => r.by).join()}), 콘솔 ${w.console.length}`;
      return sheet === 0 && !sv.pending && rows.length === 1 && rows[0].by === 'parent' && w.console.length === 0 ? ok(t) : bad(t, { shot: await shot(page, `${tag}-P09`) });
    });
    await ctx.close();
  }
}

// ================================================================ F R-451 재현(기록 카드 켬 + 다음 결정으로) · 일시정지 중 카드 · 8배속 뒤 기록 줄
if (PART.includes('F')) {
  const CAP = process.env.QA_CAPDIR || null;
  const fsm = await import('node:fs');
  const capShot = async (page, name, opts = {}) => { if (CAP) { fsm.mkdirSync(CAP, { recursive: true }); await page.screenshot({ path: `${CAP}/${name}.png`, ...opts }); } };
  for (const by of ['parent', 'child']) {
    const R = await oracle(dev, `for (let seed = 1; seed < 6000; seed++) {
        let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
        const start = s; let okDeleg = false;
        for (let g = 0; g < 100 && s.phase === 'life' && s.age < 7; g++) {
          if (s.pending !== null) break;
          if (s.age === 5) { if (okDeleg && core.dueNote(s) !== null) return { start, seed }; break; }
          const due = core.dueNote(s); if (due !== null) s = core.consumeNote(s, due);
          const r = core.stepYear(s);
          if (s.age === 4) okDeleg = r.tick.kind === 'resolved' && r.tick.by === arg.by;
          s = r.state;
        }
      }
      return null;`, { by });
    if (!R) { await run({ id: `${tag}-R451-${by}`, area: '부모 결정', title: `R-451 ${by}`, steps: '-', expected: '-' }, async () => note('오라클이 시드를 찾지 못함')); continue; }
    const { ctx, page, watch } = await open({ ...withoutPlay(R.start), paused: false }, { ...DEFAULT_SETTINGS, speed: 8, autoMode: false, noteCards: true });
    await capShot(page, `r451-a-${by}`);
    await run({ id: `${tag}-R451-${by}`, area: '부모 결정', title: `${tag} R-451 재현(${by}): 기록 카드를 켠 채 0세에서 「다음 결정으로」 → 5세 기록 시트가 뜨고 부모·흘러감 카드는 함께 뜨지 않는다`, steps: `시드 ${R.seed}(4세가 ${by === 'parent' ? '부모님이 정한' : '흘러간'} 해, 5세에 기록 카드) 0세에서 「다음 결정으로」`, expected: '5세 기록 시트(note-sheet)가 뜨고 그 순간·시트를 넘긴 뒤에도 4세 카드가 뜨지 않음, 4세 위임 기록 줄은 남음' }, async () => {
      await page.waitForFunction(() => { const b = document.querySelector('[data-testid="skip"]'); return b && b.getAttribute('aria-disabled') !== 'true'; });
      await click(page, page.getByTestId('skip'));
      let sheet = false;
      for (let i = 0; i < 200; i++) { if (await page.getByTestId('note-sheet').count()) { sheet = true; break; } await sleep(100); }
      await sleep(600);
      const atSheet = { sheet, cards: await page.getByTestId('parent-card').count(), age: (await snap(page)).age };
      await capShot(page, `r451-b-${by}`);
      await click(page, page.getByTestId('note-skip')).catch(() => {});
      await sleep(1500);
      const after = { cards: await page.getByTestId('parent-card').count(), age: (await snap(page)).age };
      const sv = (await readSave(page)).data;
      const row = sv.history.find((h) => h.age === 4 && h.by === by);
      const q = await qa(page);
      const w = watch.take();
      const t = `기록 시트 ${atSheet.sheet} (나이 ${atSheet.age}), 그 순간 카드 ${atSheet.cards}장, 시트 넘긴 뒤 카드 ${after.cards}장(나이 ${after.age}), 지금까지 뜬 카드 ${q.cards.length}장, 4세 위임 기록 ${row ? '있음' : '없음'}, 콘솔 ${w.console.length}`;
      return atSheet.sheet && atSheet.cards === 0 && after.cards === 0 && row && w.console.length === 0 ? ok(t) : bad(t, { shot: await shot(page, `${tag}-R451-${by}`) });
    });
    await ctx.close();
  }
  // 일시정지 중 부모 카드 · 8배속 뒤 기록 줄 (캡처용 + 기록)
  const Y = await findYear({ by: 'parent', era: 'present', minAge: 3, first: false, from: 90 });
  if (Y) {
    const a = await open({ ...withoutPlay(Y.start), paused: false }, X2);
    for (let i = 0; i < 500; i++) { if (await a.page.getByTestId('parent-card').count()) break; await sleep(60); }
    await a.page.getByTestId('pause').click();
    await sleep(500);
    await capShot(a.page, 'p45-paused');
    await a.ctx.close();
    const b2 = await open({ ...withoutPlay(Y.start), paused: false }, X8);
    await sleep(14000);
    await capShot(b2.page, 'p45-fast');
    const rows = await b2.page.getByTestId('log-row').count();
    const sv = (await readSave(b2.page)).data;
    await run({ id: `${tag}-P10-8x-card-rows`, area: '부모 결정', title: `${tag} 8배속: 카드가 짧게 스쳐 지나가고 내용은 인생 기록 줄에 by 도장과 함께 남는다`, steps: '부모 카드 해를 8배속으로 14초 진행', expected: '기록 줄에 부모님이 정한 줄(by=parent)이 남고 오류 0' }, async () => {
      const t = `나이 ${sv.age}, 줄 ${rows}, 위임 기록 ${sv.history.filter((h) => h.by).length}줄(${sv.history.filter((h) => h.by).map((h) => h.by[0] + h.age).join(',')})`;
      return sv.history.some((h) => h.by) ? ok(t) : bad(t);
    });
    await b2.ctx.close();
  }
}

await browser.close();
await devBrowser.close();
console.log('done', tag);
