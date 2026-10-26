// SPEC-005 QA 5 무거운 장면 가리기: 켜고 끄기·판 도중 변경(켜기→끄기→켜기)·펼침 키보드·가린 결정 카드·자동으로 고르기·부모·흘러감 카드·상속 줄·엔딩·자살률 슬라이드·live region·HV8.
// 상태는 개발 서버(5391)의 core로 만들고 프로덕션 빌드(4391)에 심어 연다. 사용: node qa/scripts/q005-gentle.mjs --vp d1280|m360 [--engine webkit] [--part A..H]
import { launchChromium, launchWebkit, VP, Watch, PROD, DEV, run, ok, bad, note, shot, saveShot, sleep, overflowOf, focusHidden, readSave, readSettings, seedPage, DEFAULT_SETTINGS, oracle, withoutPlay, QA_OBSERVER } from './q005-lib.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const VPN = arg('vp', 'd1280');
const ENGINE = arg('engine', 'chromium');
const PART = arg('part', 'ABCDEFGH');
const tag = `${ENGINE === 'webkit' ? 'W-' : ''}${VPN}`;
const touch = !!VP[VPN].hasTouch;
const browser = await (ENGINE === 'webkit' ? launchWebkit() : launchChromium());
const devBrowser = await launchChromium();
const dev = await (await devBrowser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await dev.goto(DEV + '/');
await dev.getByTestId('title-screen').waitFor({ timeout: 90000 });

const OFF = { ...DEFAULT_SETTINGS, speed: 1, autoMode: false, noteCards: false, gentle: false };
const ON = { ...OFF, gentle: true };
const click = async (page, loc, o = {}) => (touch ? loc.tap(o) : loc.click(o));

async function open(state, settings, opts = {}) {
  const ctx = await browser.newContext({ ...VP[VPN], locale: 'ko-KR', ...(opts.ctx ?? {}) });
  const watch = new Watch(tag).attach(ctx);
  const page = await ctx.newPage();
  await page.addInitScript(QA_OBSERVER);
  await seedPage(page, { game: state, settings });
  await page.goto(PROD + '/');
  await page.getByTestId(opts.wait ?? 'life-screen').waitFor({ timeout: 60000 });
  await sleep(opts.settle ?? 600);
  return { ctx, page, watch };
}

// ---- 오라클 상태 ----
const heavyLife = () =>
  oracle(dev, `for (let seed = 1; seed <= 2000; seed++) {
      let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
      let farewell = false;
      while (s.phase === 'life' && s.age < 66) {
        if (s.pending !== null) { if (s.pending.eventId === 'middle-parents-farewell') farewell = true; s = core.resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state; }
        else s = core.stepYear(s).state;
      }
      const heavy = s.history.filter((h) => core.heavyKindOfEntry(h) !== null);
      if (s.phase === 'life' && farewell && s.pending === null && heavy.length >= 4 && s.history.some((h) => h.text === '부모님이 남기신 재산을 물려받았습니다.')) return { ...s, paused: true };
    }
    return null;`).then((s) => withoutPlay(s));
const heavyCount = (hist) => oracle(dev, `return arg.filter((h) => core.heavyKindOfEntry(h) !== null).length;`, hist);
const heavyPending = (eventId, era = 'present') =>
  oracle(dev, `const mod = await import('/src/data/events/index.ts');
    const ev = mod.EVENT_POOL.byId.get(arg.eventId);
    const ages = core.possibleAgesOf(ev);
    const target = ages[Math.floor(ages.length / 2)];
    for (let seed = 1; seed <= 800; seed++) {
      let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
      while (s.phase === 'life' && s.age < target) { if (s.pending !== null) s = core.resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state; else s = core.stepYear(s).state; }
      if (s.phase !== 'life' || s.age !== target) continue;
      const visible = core.visibleChoices(ev, core.condContextOf(s));
      if (visible.length < 2) continue;
      return { ...s, seen: { ...s.seen, [arg.eventId]: target }, lastChoiceAge: target, pending: { eventId: arg.eventId, key: arg.eventId + '@' + target, age: target, choiceIds: visible.map((c) => c.id) } };
    }
    return null;`, { eventId, era }).then((s) => (s ? withoutPlay(s) : null));
const delegatedYear = (eventId, by) =>
  oracle(dev, `for (let seed = 1; seed < 3000; seed++) {
      let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
      for (let g = 0; g < 200 && s.phase === 'life' && s.age < 19; g++) {
        if (s.pending !== null) { s = core.autoResolveStep(s, s.pending.key).state; continue; }
        const due = core.dueNote(s); if (due !== null) s = core.consumeNote(s, due);
        const r = core.stepYear(s);
        if (r.tick.kind === 'resolved' && r.tick.by === arg.by && r.tick.eventId === arg.eventId) return { start: s, tick: r.tick };
        s = r.state;
      }
    }
    return null;`, { eventId, by }).then((y) => (y ? { ...y, start: withoutPlay(y.start) } : null));
const heavyEnding = () =>
  oracle(dev, `for (let seed = 1; seed <= 400; seed++) {
      const start = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
      const end = core.playToEnd(start, (s) => s.pending.choiceIds[0]).state;
      const heavy = end.history.filter((h) => core.heavyKindOfEntry(h) !== null);
      if (heavy.length >= 4 && heavy.some((h) => h.by !== undefined)) return end;
    }
    return null;`).then((s) => withoutPlay(s));
/** 앞으로 자동으로 흘러가는 15년 안에 무거운 줄이 생기는 상태 (live region 시험) */
const beforeHeavy = () =>
  oracle(dev, `for (let seed = 1; seed <= 600; seed++) {
      let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
      while (s.phase === 'life' && s.age < 40) { if (s.pending !== null) s = core.autoResolveStep(s, s.pending.key).state; else { const due = core.dueNote(s); if (due !== null) s = core.consumeNote(s, due); s = core.stepYear(s).state; } }
      if (s.phase !== 'life' || s.pending !== null) continue;
      const base = s.history.length;
      let t = s;
      for (let g = 0; g < 400 && t.phase === 'life' && t.age < 64; g++) { if (t.pending !== null) t = core.autoResolveStep(t, t.pending.key).state; else { const due = core.dueNote(t); if (due !== null) t = core.consumeNote(t, due); t = core.stepYear(t).state; } }
      const n = t.history.slice(base).filter((h) => core.heavyKindOfEntry(h) !== null).length;
      if (n >= 2) return s;
    }
    return null;`).then((s) => withoutPlay(s));

const rows = (page) =>
  page.evaluate(() => [...document.querySelectorAll('[data-testid="log-row"]')].map((li) => {
    const veiled = li.getAttribute('data-veiled') === 'true';
    const btn = li.querySelector('[data-testid="veil-btn"]');
    const body = li.querySelector('[data-testid="veil-body"]');
    return { veiled, vis: li.innerText.replace(/\s+/g, ' ').trim(), expanded: btn?.getAttribute('aria-expanded') ?? null, bodyHidden: body ? body.hidden : null, bodyText: body ? body.textContent.replace(/\s+/g, ' ').trim() : null, label: btn?.getAttribute('aria-label') ?? null };
  }));

// ================================================================ A 판 도중 켜기→끄기→켜기 (나가기 → 스위치 → 이어서 살기)
let H = null;
if (PART.includes('A')) {
  H = await heavyLife();
  const expectedHeavy = await heavyCount(H.history);
  const { ctx, page, watch } = await open(H, OFF);
  const exitAndToggle = async (to) => {
    await click(page, page.getByTestId('tool-exit'));
    await page.getByTestId('exit-ask').waitFor();
    await sleep(500);
    await click(page, page.getByTestId('exit-yes'));
    await page.getByTestId('title-screen').waitFor();
    await sleep(700);
    const sw = page.getByTestId('gentle-switch');
    const cur = (await sw.getAttribute('aria-checked')) === 'true';
    if (cur !== to) await click(page, sw);
    await sleep(400);
    const saved = await readSettings(page);
    await sleep(300);
    await click(page, page.getByTestId('resume'));
    await page.getByTestId('life-screen').waitFor();
    await sleep(700);
    return saved?.data?.gentle;
  };
  const steps = [];
  const initial = await rows(page);
  steps.push({ s: '처음(끔)', veiled: initial.filter((r) => r.veiled).length });
  const sv0 = (await readSave(page)).data;
  steps.push({ s: '처음 gentleUsed', v: sv0.gentleUsed ?? null });
  // 켜기
  await exitAndToggle(true);
  let r1 = await rows(page);
  const veiled1 = r1.filter((r) => r.veiled);
  // 하나 펼친다
  if (veiled1.length) await click(page, page.getByTestId('veil-btn').first());
  await sleep(300);
  const opened1 = (await rows(page)).filter((r) => r.expanded === 'true').length;
  const paused1 = await page.getByTestId('pause').getAttribute('data-paused');
  const used1 = (await readSave(page)).data.gentleUsed ?? null;
  steps.push({ s: '켜기', veiled: veiled1.length, opened: opened1, paused: paused1, gentleUsed: used1 });
  // 끄기
  await exitAndToggle(false);
  const r2 = await rows(page);
  const used2 = (await readSave(page)).data.gentleUsed ?? null;
  steps.push({ s: '끄기', veiled: r2.filter((r) => r.veiled).length, gentleUsed: used2, textShowsOriginal: r2.some((r) => /부모님이 남기신 재산을 물려받았습니다/.test(r.vis)) });
  // 다시 켜기 → 이전에 펼친 줄도 다시 가려진다
  await exitAndToggle(true);
  const r3 = await rows(page);
  steps.push({ s: '다시 켜기', veiled: r3.filter((r) => r.veiled).length, opened: r3.filter((r) => r.expanded === 'true').length });
  // 한 번 더 끄기→켜기
  await exitAndToggle(false);
  const r4 = await rows(page);
  await exitAndToggle(true);
  const r5 = await rows(page);
  steps.push({ s: '끄기→켜기 한 번 더', off: r4.filter((r) => r.veiled).length, on: r5.filter((r) => r.veiled).length });
  const w = watch.take();
  await run({ id: `${tag}-G01-midgame-toggle`, area: '무거운 장면', title: `${tag} 판 도중 가림 바꾸기: 나가기 → 스위치 → 이어서 살기를 켜기→끄기→켜기 반복하면 지난 줄까지 바로 바뀌고 펼침은 초기화`, steps: `66세 일시정지 판(무거운 줄 ${expectedHeavy}개)을 가림 끔으로 열기 → [나가기→스위치 켬→이어서 살기] → [끔] → [켬] → [끔] → [켬]`, expected: `켠 상태의 가린 줄 = ${expectedHeavy}개(지난 줄 포함), 끈 상태 0개(원문), 켜기→끄기→켜기 뒤 이전에 펼친 줄이 다시 가려짐(펼침 0), gentleUsed는 켠 뒤 참(끈 뒤에도 유지), 오류 0` }, async () => {
    const t = JSON.stringify(steps) + ` · 콘솔 ${w.console.length}`;
    const pass = steps[0].veiled === 0 && steps[2].veiled === expectedHeavy && steps[2].opened === 1 && steps[3].veiled === 0 && !!steps[3].textShowsOriginal && steps[4].veiled === expectedHeavy && steps[4].opened === 0 && steps[5].off === 0 && steps[5].on === expectedHeavy && steps[2].gentleUsed === true && steps[3].gentleUsed === true && w.console.length === 0;
    return pass ? ok(t) : bad(t, { shot: await shot(page, `${tag}-G01`) });
  });
  await run({ id: `${tag}-G01b-resume-paused`, area: '무거운 장면', title: `${tag} 「이어서 살기」로 돌아온 판은 일시정지 상태 (기록)`, steps: '위 흐름에서 이어서 산 직후 일시정지 버튼 상태', expected: '이어서 산 판이 일시정지로 돌아오는 것을 기록(REV-005-B1-1 6절)' }, async () => note(`이어서 살기 직후 일시정지 버튼 data-paused=${steps[2].paused}(저장 판은 paused=true로 심었음)`));
  await ctx.close();
}

// ================================================================ B 가린 줄: 원문 숨김·분류 문구·키보드 펼침·HV8
if (PART.includes('B')) {
  H = H ?? (await heavyLife());
  const exp = await heavyCount(H.history);
  const on = await open(H, ON);
  const off = await open(H, OFF);
  const page = on.page;
  const rOn = await rows(page);
  const veiled = rOn.filter((r) => r.veiled);
  await run({ id: `${tag}-G02-veiled-rows`, area: '무거운 장면', title: `${tag} 가린 줄: 보이는 글은 「무거운 일이 있었습니다 · 분류」+펼쳐 보기뿐, 원문은 hidden, 버튼 이름 「펼쳐 보기 {나이}세 {분류}」`, steps: `가림 켬으로 66세 판 열기 → 줄 ${rOn.length}개 중 가린 줄 검사`, expected: `가린 줄 ${exp}개, 보이는 글에 원문 낱말 없음, aria-expanded=false, 분류 이름은 여섯 이름 중 하나` }, async () => {
    const KINDS = ['집안 사정', '또래 사이', '건강', '돌봄과 이별', '멀어진 사이', '일과 생계'];
    const leaks = veiled.filter((r) => r.bodyText && r.bodyText.length > 6 && r.vis.includes(r.bodyText.slice(0, 10)));
    const noKind = veiled.filter((r) => !KINDS.some((k) => r.vis.includes(k)) || !/무거운 일이 있었습니다/.test(r.vis));
    const badLabel = veiled.filter((r) => !/^펼쳐 보기 \d+세 /.test(r.label ?? '') || r.expanded !== 'false' || r.bodyHidden !== true);
    const t = `줄 ${rOn.length}, 가림 ${veiled.length}/${exp}, 원문 새는 줄 ${leaks.length}, 분류 없는 줄 ${noKind.length}, 버튼 이름·펼침 상태 이상 ${badLabel.length}, 예: 「${veiled[0]?.vis}」 이름 「${veiled[0]?.label}」`;
    return veiled.length === exp && leaks.length === 0 && noKind.length === 0 && badLabel.length === 0 ? ok(t) : bad(t, { shot: await shot(page, `${tag}-G02`) });
  });
  await run({ id: `${tag}-G03-keyboard-open`, area: '무거운 장면', title: `${tag} 가린 줄을 키보드로 펼치고 접는다(Enter·Space), 펼치면 원문 보임·aria-expanded`, steps: '첫 번째 펼쳐 보기 버튼에 포커스 → Enter → 내용 확인 → Space → 다시 가려짐', expected: '펼침 true + 원문 보임 → 접힘 false + 원문 hidden, 포커스 유지' }, async () => {
    const btn = page.getByTestId('veil-btn').first();
    await btn.scrollIntoViewIfNeeded();
    await btn.focus();
    await page.keyboard.press('Enter');
    await sleep(300);
    const a = await rows(page);
    const first = a.find((r) => r.veiled);
    const opened = first.expanded === 'true' && first.bodyHidden === false && first.vis.includes(first.bodyText.slice(0, 10));
    const focusKept = await page.evaluate(() => document.activeElement?.dataset?.testid);
    await page.keyboard.press('Space');
    await sleep(300);
    const b = await rows(page);
    const closed = b.find((r) => r.veiled).expanded === 'false' && b.find((r) => r.veiled).bodyHidden === true;
    const t = `Enter: 펼침 ${first.expanded}, 원문 보임 ${opened}, 이름 「${first.label}」, 포커스 ${focusKept} → Space: 접힘 ${closed}`;
    return opened && closed && focusKept === 'veil-btn' ? ok(t) : bad(t, { shot: await shot(page, `${tag}-G03`) });
  });
  await run({ id: `${tag}-G04-hv8`, area: '무거운 장면', title: `${tag} 가려지지 않는 것(HV8): 상속 줄 분류·식구 카드 상태·미터·사망 관련·상담전화`, steps: '켠 화면과 끈 화면의 식구 카드·상태 미터 마크업 비교, 상속 줄 확인', expected: '식구 카드·상태 미터 마크업이 켠·끈 화면에서 같음, 상속 줄은 「돌봄과 이별」로 가려짐' }, async () => {
    const pick = (p) => p.evaluate(() => ({ fam: document.querySelector('[data-testid="family-card"]')?.innerText.replace(/\s+/g, ' '), stats: document.querySelector('[data-testid="stats"]')?.innerText.replace(/\s+/g, ' '), assets: document.querySelector('[data-testid="assets-card"]')?.innerText.replace(/\s+/g, ' ').slice(0, 200) }));
    const a = await pick(on.page);
    const b = await pick(off.page);
    const inh = rOn.find((r) => /돌봄과 이별/.test(r.vis) && /부모님이 남기신 재산/.test(r.bodyText ?? ''));
    const t = `식구 카드 동일 ${a.fam === b.fam}(「${(a.fam ?? '').slice(0, 60)}」), 미터 동일 ${a.stats === b.stats}, 자산 카드 동일 ${a.assets === b.assets}, 상속 줄 가림 ${inh ? '「' + inh.vis.slice(0, 40) + '」' : '없음'}`;
    return a.fam === b.fam && a.stats === b.stats && a.assets === b.assets && inh ? ok(t) : bad(t, { shot: await shot(page, `${tag}-G04`) });
  });
  await run({ id: `${tag}-G04c-a11y-tree`, area: '무거운 장면', title: `${tag} 접근성 트리: 가린 줄의 원문이 트리에 없고 「무거운 일이 있었습니다 …」와 「펼쳐 보기 …」 이름만 있다`, steps: 'log-list ariaSnapshot에서 가린 줄 원문 조각 검색', expected: '원문 조각 0, 이름 「펼쳐 보기 N세 분류」 존재' }, async () => {
    const snap = await page.getByTestId('log-list').ariaSnapshot();
    const leaks = veiled.filter((r) => r.bodyText && snap.includes(r.bodyText.slice(0, 12)));
    const names = (snap.match(/펼쳐 보기 \d+세 [^"\n]+/g) ?? []).length;
    const t = `트리 길이 ${snap.length}자, 원문 새는 줄 ${leaks.length}, 「펼쳐 보기 N세 분류」 이름 ${names}개 / 가린 줄 ${veiled.length}`;
    return leaks.length === 0 && names === veiled.length ? ok(t) : bad(t);
  });
  // 새로고침 뒤: 가림 설정 유지·펼침은 초기화
  await click(page, page.getByTestId('veil-btn').first());
  await sleep(300);
  const openedBefore = (await rows(page)).filter((r) => r.expanded === 'true').length;
  await page.reload();
  await page.getByTestId('life-screen').waitFor();
  await sleep(900);
  const afterReload = await rows(page);
  const st = await readSettings(page);
  await run({ id: `${tag}-G14-reload-state`, area: '무거운 장면', title: `${tag} 가림 켠 판을 새로고침: 가림은 유지(설정 gentle=true)·펼침은 모두 다시 가려진다`, steps: '줄 하나를 펼친 뒤 새로고침', expected: `펼침 1 → 0, 가린 줄 ${exp}개 그대로, 설정 gentle=true` }, async () => {
    const t = `펼친 줄 ${openedBefore} → 새로고침 뒤 펼침 ${afterReload.filter((r) => r.expanded === 'true').length}, 가린 줄 ${afterReload.filter((r) => r.veiled).length}, 설정 gentle=${st?.data?.gentle}`;
    return openedBefore === 1 && afterReload.filter((r) => r.expanded === 'true').length === 0 && afterReload.filter((r) => r.veiled).length === exp && st?.data?.gentle === true ? ok(t) : bad(t, { shot: await shot(page, `${tag}-G14`) });
  });
  const w = on.watch.take();
  await run({ id: `${tag}-G04b-console`, area: '공통', title: `${tag} 가림 켠 인생 화면 콘솔·외부 요청`, steps: '감시', expected: '0건' }, async () => (w.console.length === 0 && w.external.length === 0 ? ok('0건') : bad(JSON.stringify(w))));
  await on.ctx.close();
  await off.ctx.close();
}

// ================================================================ C 가린 결정 카드(시트) + 「이번에는 자동으로 고르기」 연타·펼치기
if (PART.includes('C')) {
  const P = await heavyPending('middle-layoff');
  if (!P) await run({ id: `${tag}-G05-sheet`, area: '무거운 장면', title: '가린 결정 카드', steps: '-', expected: '-' }, async () => note('오라클이 상태를 만들지 못함'));
  else {
    const { ctx, page, watch } = await open(P, ON);
    const panel = page.getByTestId('choice-panel');
    await panel.waitFor({ timeout: 20000 });
    const titleOrig = '정리 대상이 된 아침';
    await run({ id: `${tag}-G05-sheet`, area: '무거운 장면', title: `${tag} 가린 결정 카드(시트): 「무거운 주제 · 분류」+안내+버튼 둘, 상황·선택지·영향 줄·인용은 DOM에도 없다`, steps: `${P.pending.eventId}(${P.age}세)를 가림 켬으로 열기`, expected: '제목 「무거운 주제 · 일과 생계」, 버튼 「펼쳐서 읽기」「이번에는 자동으로 고르기」, 원문 제목·선택지 라벨·인용이 DOM 어디에도 없음, 대화상자 이름이 분류만 말함' }, async () => {
      const d = await page.evaluate((orig) => {
        const p = document.querySelector('[data-testid="choice-panel"]');
        const html = document.body.innerHTML;
        return { title: p.querySelector('[data-testid="choice-title"]')?.innerText.replace(/\s+/g, ' '), note: p.querySelector('[data-testid="veil-note"]')?.innerText, btns: [...p.querySelectorAll('button')].map((b) => b.innerText.replace(/\s+/g, ' ').trim()), choiceBtns: p.querySelectorAll('button.choice').length, impact: p.querySelectorAll('[data-testid="impact"]').length, cite: p.querySelectorAll('[data-testid="cite"]').length, leak: html.includes(orig), name: document.getElementById('dc-title')?.innerText.replace(/\s+/g, ' '), mode: p.dataset.mode, veiled: p.dataset.veiled };
      }, titleOrig);
      const t = JSON.stringify(d);
      return /^무거운 주제.*일과 생계$/.test(d.title) && d.btns.some((b) => b === '펼쳐서 읽기') && d.btns.some((b) => b === '이번에는 자동으로 고르기') && d.choiceBtns === 0 && d.impact === 0 && d.cite === 0 && !d.leak ? ok(t) : bad(t, { shot: await shot(page, `${tag}-G05`) });
    });
    await run({ id: `${tag}-G06-open-read`, area: '무거운 장면', title: `${tag} 「펼쳐서 읽기」: 제목·상황·선택지·영향 줄·인용이 보이고 직접 고를 수 있다`, steps: '펼쳐서 읽기 → 첫 선택지 고르기 → 기록 줄', expected: '원문 제목 보임, 선택지 ≥2, 고르면 결정 시트가 닫히고 기록 줄 하나가 가려진 채 생김(분류 문구), 그 줄을 펼치면 고른 길·결과가 보임' }, async () => {
      await page.waitForFunction(() => { const b = document.querySelector('[data-testid="veil-open"]'); return b && b.getAttribute('aria-disabled') !== 'true'; });
      await click(page, page.getByTestId('veil-open'));
      await sleep(500);
      const title = await page.getByTestId('choice-title').innerText();
      const n = await page.locator('[data-testid="choice-panel"] button.choice').count();
      const imp = await page.locator('[data-testid="choice-panel"] [data-testid="impact"]').count();
      await page.waitForFunction(() => { const b = document.querySelector('[data-testid="choice-panel"] button.choice'); return b && b.getAttribute('aria-disabled') !== 'true'; });
      await click(page, page.locator('[data-testid="choice-panel"] button.choice').first());
      await sleep(900);
      const rs = await rows(page);
      const mine = rs.find((r) => r.veiled && r.bodyText && /선택/.test(r.bodyText) || r.veiled && r.bodyText && r.bodyText.length > 20);
      await click(page, page.getByTestId('veil-btn').first());
      await sleep(300);
      const rs2 = await rows(page);
      const opened = rs2.find((r) => r.expanded === 'true');
      const t = `펼친 제목 「${title}」, 선택지 ${n}개, 영향 줄 ${imp}개, 고른 뒤 첫 줄 「${rs[0].vis.slice(0, 40)}」 → 펼침: 「${opened ? opened.vis.slice(0, 80) : ''}」`;
      return title === titleOrig && n >= 2 && imp >= 2 && rs[0].veiled && opened && /선택/.test(opened.vis) ? ok(t) : bad(t, { shot: await shot(page, `${tag}-G06`) });
    });
    await ctx.close();
  }
  // 자동 모드 인라인 카드(가림): 비모달, 제목 분류 문구, 버튼 둘, 자동 선택 안내
  if (P) {
    const { ctx, page } = await open({ ...P, paused: true }, { ...ON, autoMode: true });
    const panel = page.getByTestId('choice-panel');
    await panel.waitFor({ timeout: 20000 });
    await run({ id: `${tag}-G05b-inline`, area: '무거운 장면', title: `${tag} 가린 결정 카드(자동 모드 인라인): 비모달·분류 제목·버튼 둘·원문은 DOM에 없음, 자동 선택 안내 유지`, steps: '자동 모드 켬 + 가림 켬으로 middle-layoff 대기 판 열기', expected: 'data-mode=inline, 제목 「무거운 주제 · 일과 생계」, 펼쳐서 읽기·자동으로 고르기 보임, 원문 제목 DOM 0, dialog 아님' }, async () => {
      const d = await page.evaluate(() => { const p = document.querySelector('[data-testid="choice-panel"]'); return { mode: p.dataset.mode, dialog: p.getAttribute('role') === 'dialog' || !!p.closest('[role=dialog]'), title: p.querySelector('[data-testid="choice-title"]')?.innerText.replace(/\s+/g, ' '), btns: [...p.querySelectorAll('button')].map((b) => b.innerText.replace(/\s+/g, ' ').trim()), leak: document.body.innerHTML.includes('정리 대상이 된 아침'), auto: p.querySelector('[data-testid="auto-note"]')?.innerText.slice(0, 40) }; });
      const t = JSON.stringify(d);
      return d.mode === 'inline' && !d.dialog && /일과 생계/.test(d.title) && d.btns.includes('펼쳐서 읽기') && d.btns.includes('이번에는 자동으로 고르기') && !d.leak ? ok(t) : bad(t, { shot: await shot(page, `${tag}-G05b`) });
    });
    await ctx.close();
  }
  // 자동으로 고르기 연타
  const P2 = await heavyPending('senior-fall');
  if (P2) {
    const { ctx, page } = await open(P2, ON);
    await page.getByTestId('choice-panel').waitFor();
    await run({ id: `${tag}-G07-auto-spam`, area: '무거운 장면', title: `${tag} 「이번에는 자동으로 고르기」 6연타: 한 번만 해결되고 기록 줄은 가린 채 남으며 펼치면 고른 길·결과가 보인다`, steps: `${P2.pending.eventId}(${P2.age}세) 가린 카드에서 자동으로 고르기를 0.05초 간격으로 6번`, expected: '해당 이벤트 기록 줄 정확히 1줄, 시트 닫힘, 가린 줄 → 펼치면 「선택: …」와 결과, 오류 0' }, async () => {
      await page.waitForFunction(() => { const b = document.querySelector('[data-testid="veil-auto"]'); return b && b.getAttribute('aria-disabled') !== 'true'; });
      const box = await page.getByTestId('veil-auto').boundingBox();
      for (let i = 0; i < 6; i++) {
        if (touch) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2).catch(() => {});
        else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2).catch(() => {});
        await sleep(50);
      }
      await sleep(1200);
      const sv = (await readSave(page)).data;
      const mine = sv.history.filter((h) => h.eventId === P2.pending.eventId && h.age === P2.pending.age); // (오라클이 만든 상태에 같은 이벤트의 앞선 줄이 있을 수 있어 나이까지 맞춘다)
      const sheetGone = (await page.getByTestId('choice-panel').count()) === 0;
      const rs = await rows(page);
      const target = rs.find((r) => r.veiled && /\d+세/.test(r.vis) && r.bodyText && r.bodyText.includes(mine[0]?.text?.slice(0, 8) ?? '@@'));
      let opened = null;
      if (target) {
        const idx = rs.indexOf(target);
        await click(page, page.getByTestId('veil-btn').nth(rs.slice(0, idx + 1).filter((r) => r.veiled).length - 1));
        await sleep(300);
        opened = (await rows(page))[idx];
      }
      const t = `기록 줄 ${mine.length}줄(고른 길 「${mine[0]?.choice ?? '-'}」), 시트 닫힘 ${sheetGone}, 가린 줄 ${target ? '있음' : '없음'}, 펼친 뒤 「${opened ? opened.vis.slice(0, 90) : ''}」, pending ${sv.pending ? '있음' : '없음'}`;
      return mine.length === 1 && sheetGone && target && opened && /선택/.test(opened.vis) && !sv.pending ? ok(t) : bad(t, { shot: await shot(page, `${tag}-G07`) });
    });
    await ctx.close();
  }
}
// ================================================================ D 가린 부모·흘러감 카드
if (PART.includes('D')) {
  for (const [eventId, by, label] of [['infant-fever', 'parent', '한밤의 열'], ['school-bully', 'child', '교실의 한 아이']]) {
    const Y = await delegatedYear(eventId, by);
    if (!Y) { await run({ id: `${tag}-G08-${by}`, area: '무거운 장면', title: `${eventId} 가린 ${by} 카드`, steps: '-', expected: '-' }, async () => note('오라클이 해를 찾지 못함')); continue; }
    const { ctx, page } = await open({ ...Y.start, paused: false }, { ...ON, speed: 2 });
    for (let i = 0; i < 600; i++) {
      if (await page.getByTestId('parent-card').count()) break;
      await sleep(100);
    }
    await run({ id: `${tag}-G08-${by}`, area: '무거운 장면', title: `${tag} 가린 ${by === 'parent' ? '부모님이 정한' : '흘러간'} 카드(${eventId}): 칩·도장·연도 보임, 제목·상황·고른 길·영향 줄·인용은 DOM에 없음, 「펼쳐서 읽기」 하나`, steps: `${eventId} 해를 가림 켬 2배속으로 열기`, expected: `칩 ${by === 'parent' ? '「부모님의 결정」' : '「아이의 일」'}, 도장 ${by === 'parent' ? '「부모님이 이렇게 정했습니다」' : '「이렇게 흘러갔습니다」'}, 제목 「무거운 주제 · 분류」, 버튼은 펼쳐서 읽기 하나(자동 고르기 없음)` }, async () => {
      const d = await page.evaluate((orig) => {
        const c = document.querySelector('[data-testid="parent-card"]');
        if (!c) return null;
        return { chip: c.querySelector('[data-testid="parent-chip"]')?.innerText, stamp: c.querySelector('[data-testid="parent-stamp"]')?.innerText, title: c.querySelector('[data-testid="parent-title"]')?.innerText.replace(/\s+/g, ' '), label: c.querySelector('[data-testid="parent-label"]') !== null, text: c.querySelector('[data-testid="parent-text"]') !== null, impact: c.querySelectorAll('[data-testid="impact"]').length, cite: c.querySelectorAll('[data-testid="cite"]').length, btns: [...c.querySelectorAll('button')].map((b) => b.innerText.trim()), leak: document.body.innerHTML.includes(orig), veiled: c.dataset.veiled, when: c.querySelector('[data-testid="parent-when"]')?.innerText.replace(/\s+/g, ' ') };
      }, label);
      if (!d) return bad('카드가 뜨지 않음', { shot: await shot(page, `${tag}-G08-${by}`) });
      const t = JSON.stringify(d);
      const chipOk = by === 'parent' ? d.chip === '부모님의 결정' && d.stamp === '부모님이 이렇게 정했습니다' : d.chip === '아이의 일' && d.stamp === '이렇게 흘러갔습니다';
      return chipOk && /^무거운 주제/.test(d.title) && !d.label && !d.text && d.impact === 0 && d.cite === 0 && d.btns.length === 1 && d.btns[0] === '펼쳐서 읽기' && !d.leak && d.veiled === 'true' ? ok(t) : bad(t, { shot: await shot(page, `${tag}-G08-${by}`) });
    });
    // 펼치기
    await run({ id: `${tag}-G08b-${by}-expand`, area: '무거운 장면', title: `${tag} 가린 ${by} 카드 「펼쳐서 읽기」 후 원문 보임·포커스가 제목으로`, steps: '펼쳐서 읽기 누름', expected: '제목이 이벤트 제목으로, 고른 길 라벨·영향 줄 보임' }, async () => {
      const b = page.getByTestId('veil-open');
      if (!(await b.count())) return note('카드가 이미 사라짐(2배속 연출 종료) — 시점 문제로 재시험');
      await click(page, b);
      await sleep(400);
      const d = await page.evaluate(() => ({ title: document.querySelector('[data-testid="parent-title"]')?.innerText, label: document.querySelector('[data-testid="parent-label"]')?.innerText, impact: document.querySelectorAll('[data-testid="parent-card"] [data-testid="impact"]').length, focus: document.activeElement?.dataset?.testid }));
      const t = JSON.stringify(d);
      return d.title === label && d.label && d.focus === 'parent-title' ? ok(t) : bad(t, { shot: await shot(page, `${tag}-G08b-${by}`) });
    });
    await ctx.close();
  }
}

// ================================================================ E 엔딩: 가린 연표 줄·사망 줄 보임·gentleUsed 한 줄·펼침
if (PART.includes('E')) {
  const E = await heavyEnding();
  const exp = await heavyCount(E.history);
  const { ctx, page } = await open({ ...E, gentleUsed: true }, ON, { wait: 'ending-screen' });
  await run({ id: `${tag}-G09-ending`, area: '무거운 장면', title: `${tag} 엔딩(가림 켬·가린 판): 맨 위 한 줄 「이 판은 무거운 장면을 가린 채 살았습니다.」, 연표의 무거운 줄만 가려지고 사망 줄은 보인다, 펼침 가능`, steps: '무거운 줄이 여럿 든 끝난 판(gentleUsed)을 가림 켬으로 열기', expected: `ending-gentle 한 줄, 가린 연표 줄 ${exp}개, 사망 문장에 원인 낱말까지 보임, 분류 문구, 펼치면 원문` }, async () => {
    const d = await page.evaluate(() => {
      const ent = [...document.querySelectorAll('[data-testid="timeline-entry"]')];
      const v = ent.filter((e) => e.getAttribute('data-veiled') === 'true');
      return { gentle: document.querySelector('[data-testid="ending-gentle"]')?.innerText.trim(), veiled: v.length, death: document.querySelector('[data-testid="ending-death"]')?.innerText.trim(), deathVisible: ent.filter((e) => e.getAttribute('data-kind') === 'death').map((e) => e.innerText.replace(/\s+/g, ' ').slice(0, 60)), sample: v[0]?.innerText.replace(/\s+/g, ' ').slice(0, 80), choices: document.querySelector('[data-testid="ending-choices"]')?.innerText.trim(), delegated: document.querySelector('[data-testid="ending-delegated"]')?.innerText.trim(), stampsVisible: v.filter((e) => e.querySelector('[data-testid="veil-by"]') && !e.querySelector('[data-testid="veil-by"]').hidden).length };
    });
    await click(page, page.getByTestId('veil-btn').first());
    await sleep(300);
    const open1 = await page.evaluate(() => document.querySelector('[data-testid="timeline-entry"][data-veiled="true"] [data-testid="veil-btn"]')?.getAttribute('aria-expanded'));
    const t = JSON.stringify(d) + ` · 첫 줄 펼침 ${open1}`;
    return d.gentle === '이 판은 무거운 장면을 가린 채 살았습니다.' && d.veiled === exp && /원인은/.test(d.death) && d.veiled > 0 ? ok(t) : bad(t, { shot: await shot(page, `${tag}-G09`) });
  });
  await ctx.close();
}

// ================================================================ F 자살률 슬라이드(첫 화면) — 가림·펼침·읽기 이름·상담전화·자동 넘김 정지
if (PART.includes('F')) {
  const ctx = await browser.newContext({ ...VP[VPN], locale: 'ko-KR' });
  const page = await ctx.newPage();
  const watch = new Watch(tag).attach(ctx);
  await seedPage(page, { game: null, settings: ON });
  await page.goto(PROD + '/');
  await page.getByTestId('title-screen').waitFor({ timeout: 60000 });
  await sleep(800);
  await page.getByTestId('carousel-pause').click();
  // 6번 슬라이드로
  for (let i = 0; i < 20; i++) {
    const id = await page.evaluate(() => document.querySelector('.slide.is-active')?.dataset.slideId);
    if (id === 'suicide-rate') break;
    await page.getByTestId('carousel-next').click();
  }
  await sleep(300);
  const dump = () => page.evaluate(() => {
    const a = document.querySelector('.slide.is-active');
    const vis = (e) => !e.closest('[hidden]');
    return { h3: a.querySelector('.slide__insight').innerText.replace(/\s+/g, ' '), label: a.getAttribute('aria-label'), btn: a.querySelector('[data-testid="slide-veil-btn"]')?.getAttribute('aria-expanded'), btnText: a.querySelector('[data-testid="slide-veil-btn"]')?.innerText.replace(/\s+/g, ' '), topHidden: a.querySelector('[data-testid="slide-veiled-top"]')?.hidden, bottomHidden: a.querySelector('[data-testid="slide-veiled-bottom"]')?.hidden, help: a.querySelector('[data-testid="slide-help"]') ? { text: a.querySelector('[data-testid="slide-help"]').innerText.replace(/\s+/g, ' '), visible: vis(a.querySelector('[data-testid="slide-help"]')), rect: Math.round(a.querySelector('[data-testid="slide-help"]').getBoundingClientRect().height) } : null, visibleText: a.innerText.replace(/\s+/g, ' ').slice(0, 300), chartAria: a.querySelector('svg[aria-label]')?.getAttribute('aria-label') ?? null, autoplay: document.querySelector('[data-testid="carousel"]').dataset.autoplay, dots: document.querySelector('[data-testid="carousel-dot-5"]')?.getAttribute('aria-label') ?? null };
  });
  const veiled = await dump();
  await run({ id: `${tag}-G10-slide-veiled`, area: '무거운 장면', title: `${tag} 자살률 슬라이드(가림 켬): 표제어 「무거운 주제 · 마음 건강 통계」·읽기 이름도 분류 문구·상담전화 안내는 늘 보임·그래프와 값은 숨김`, steps: '가림 켬으로 첫 화면 → 자살률 슬라이드로', expected: 'h3 「무거운 주제 · 마음 건강 통계」, article aria-label 「n/N 무거운 주제, 마음 건강 통계」, 펼쳐 보기 aria-expanded=false, 값·그래프·출처 hidden, 상담전화 이름·번호(109)·시간 보임' }, async () => {
    const t = JSON.stringify(veiled);
    const helpOk = veiled.help && veiled.help.visible && /109/.test(veiled.help.text) && /자살예방 상담전화/.test(veiled.help.text);
    return /무거운 주제 · 마음 건강 통계/.test(veiled.h3) && /무거운 주제, 마음 건강 통계/.test(veiled.label) && veiled.btn === 'false' && veiled.topHidden === true && veiled.bottomHidden === true && helpOk && !/자살률|10만 명당/.test(veiled.visibleText.replace('자살예방 상담전화', '')) ? ok(t) : bad(t, { shot: await shot(page, `${tag}-G10`) });
  });
  // 펼침
  await run({ id: `${tag}-G11-slide-expand`, area: '무거운 장면', title: `${tag} 자살률 슬라이드 펼침: 값·그래프 보임·자동 넘김 멈춤, 다른 슬라이드로 가면 다시 가림`, steps: '펼쳐 보기 누름 → autoplay → 자동 재생 켜기 → 다음 → 이전', expected: '펼침 true·내용 보임, 펼친 동안 data-autoplay=off(재생을 켜도), 떠났다 돌아오면 다시 가려짐' }, async () => {
    await click(page, page.getByTestId('slide-veil-btn'));
    await sleep(300);
    const opened = await dump();
    // 일시정지 해제 → 펼친 동안 자동 넘김이 멈춰 있어야 한다
    await page.getByTestId('carousel-pause').click();
    await page.mouse.move(5, 5);
    await sleep(600);
    const auto = await page.getByTestId('carousel').getAttribute('data-autoplay');
    const idx0 = await page.getByTestId('carousel-count').innerText();
    await sleep(11000);
    const idx1 = await page.getByTestId('carousel-count').innerText();
    await page.getByTestId('carousel-next').click();
    await page.getByTestId('carousel-prev').click();
    await sleep(300);
    const back = await dump();
    const t = `펼침 후 h3 「${opened.h3}」 expanded=${opened.btn} 값 보임=${/자살률|10만/.test(opened.visibleText)} chartAria=${opened.chartAria ? '있음' : '없음'}, autoplay=${auto}, 11초 뒤 ${idx0.trim()}→${idx1.trim()}, 다시 돌아오면 expanded=${back.btn} h3 「${back.h3}」`;
    return opened.btn === 'true' && /자살률/.test(opened.visibleText) && auto === 'off' && idx0 === idx1 && back.btn === 'false' && /무거운 주제/.test(back.h3) ? ok(t) : bad(t, { shot: await shot(page, `${tag}-G11`) });
  });
  const w = watch.take();
  await run({ id: `${tag}-G11b-console`, area: '공통', title: `${tag} 가림 켠 첫 화면 콘솔·외부 요청`, steps: '감시', expected: '0건' }, async () => (w.console.length === 0 && w.external.length === 0 ? ok('0건') : bad(JSON.stringify(w))));
  await ctx.close();
}

// ================================================================ G live region: 가린 줄이 쌓일 때 원문을 읽지 않는다
if (PART.includes('G')) {
  const B = await beforeHeavy();
  if (!B) await run({ id: `${tag}-G12-live`, area: '무거운 장면', title: 'live region', steps: '-', expected: '-' }, async () => note('오라클이 상태를 만들지 못함'));
  else {
    const { ctx, page } = await open({ ...B, paused: false }, { ...ON, speed: 8, autoMode: true });
    await page.evaluate(() => {
      window.__live = [];
      const ol = document.querySelector('[data-testid="log-list"] ol');
      new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) window.__live.push({ vis: n.innerText.replace(/\s+/g, ' ').trim(), veiled: n.getAttribute('data-veiled'), hiddenBody: n.querySelector('[data-testid="veil-body"]')?.textContent.replace(/\s+/g, ' ').trim() ?? null, live: ol.getAttribute('aria-live') }); }).observe(ol, { childList: true });
    });
    await run({ id: `${tag}-G12-live`, area: '무거운 장면', title: `${tag} live region: 가린 줄이 쌓일 때 「무거운 일이 있었습니다」만 읽히고 원문은 읽히지 않는다`, steps: '가림 켠 판을 8배속·자동으로 40→64세까지 돌리며 ol에 추가되는 줄의 보이는 글을 모두 수집', expected: '추가된 가린 줄의 보이는 글에 원문 없음(원문은 hidden 안), 가린 줄 ≥ 2' }, async () => {
      for (let i = 0; i < 600; i++) {
        const v = await page.evaluate(() => window.__live.filter((x) => x.veiled === 'true').length);
        if (v >= 2) break;
        await sleep(500);
      }
      await sleep(1500);
      const items = await page.evaluate(() => window.__live);
      const v = items.filter((x) => x.veiled === 'true');
      const leaks = v.filter((x) => x.hiddenBody && x.vis.includes(x.hiddenBody.slice(0, 10)));
      const t = `추가된 줄 ${items.length}개 중 가린 줄 ${v.length}개, 원문 새는 줄 ${leaks.length}, 예: ${v.slice(0, 2).map((x) => `「${x.vis.slice(0, 40)}」(aria-live=${x.live})`).join(' / ')}`;
      return v.length >= 2 && leaks.length === 0 ? ok(t) : bad(t);
    });
    await ctx.close();
  }
}

// ================================================================ H 켠 판 = 끈 판 (같은 시드·같은 선택이면 상태 전체가 같다) — 8배속 자동 완주 두 판 비교
if (PART.includes('H')) {
  const S0 = await oracle(dev, `return core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(arg), 'present')));`, 4242).then(withoutPlay);
  const runOne = async (gentle) => {
    const { ctx, page } = await open({ ...S0 }, { ...ON, gentle, speed: 8, autoMode: true });
    const t0 = Date.now();
    while (Date.now() - t0 < 600000) {
      if (await page.getByTestId('ending-screen').count()) break;
      await sleep(1000);
    }
    await sleep(1500);
    const sv = (await readSave(page)).data;
    await ctx.close();
    return sv;
  };
  const [a, b] = await Promise.all([runOne(true), runOne(false)]);
  await run({ id: `${tag}-G13-same-life`, area: '무거운 장면', title: `${tag} 같은 시드·같은 자동 성향이면 켠 판과 끈 판의 상태 전체가 같다(gentleUsed·play 제외)`, steps: '같은 0세 상태를 가림 켬/끔으로 8배속·자동 모드로 끝까지 돌려 저장 비교', expected: 'history·stats·age·death·flags·seen·rngState가 같고 다른 것은 gentleUsed·play뿐' }, async () => {
    const strip = (s) => { const { gentleUsed, play, ...rest } = s; return rest; };
    const A = JSON.stringify(strip(a));
    const Bn = JSON.stringify(strip(b));
    const t = `켠 판 ${a.age}세·history ${a.history.length}, 끈 판 ${b.age}세·history ${b.history.length}, gentleUsed ${a.gentleUsed ?? null}/${b.gentleUsed ?? null}, 나머지 동일 ${A === Bn}`;
    return A === Bn && a.phase === 'ending' && b.phase === 'ending' && a.gentleUsed === true && !b.gentleUsed ? ok(t) : bad(t);
  });
}

await browser.close();
await devBrowser.close();
console.log('done', tag);
