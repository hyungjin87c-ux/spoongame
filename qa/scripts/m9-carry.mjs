// QA-003 M9 3-4절: 지난 회차 RECORD·SKIP 재확인(W9). 기대·처리는 content-M9 3-4 표를 따른다(「기록 유지」면 같은 현상이 보일 때 RECORD, 해소됐으면 PASS).
// 사용: node qa/scripts/m9-carry.mjs <part ...>   part: b07 o12 name invisible progress scrim o01 n04b dup readme
import { launch, openOracle, plainLife, pendingState, openSeeded, openSeededRaw, evalCore, mkctx, cleanStorageOnce, fixSeed, readCard, readSave, sleep, shot, runCase, waitGuard, whichScreen, setRootFont, toRoulette, skipToBirth, SET_MANUAL, GAME_KEY, SAVE_VERSION, TOUCH, PROD, ROOT } from './m7c-lib.mjs';
import { auditLayout } from './m9-audit.mjs';
import { READ, judge } from './m7e-ending-lib.mjs';
import { WB_AUDIT } from './m3r2-wb.mjs';
import fs from 'node:fs';
import path from 'node:path';

const parts = process.argv.slice(2);
const want = (p) => parts.length === 0 || parts.includes(p);
const browser = await launch();
const { page: oracle } = await openOracle(browser);
const adult = await plainLife(oracle, { era: 'present', seed: 4242, age: 30, paused: true });
const adultRun = await plainLife(oracle, { era: 'present', seed: 4242, age: 20, paused: false, seenAll: true });
const pend = await pendingState(oracle, { era: 'present', seed: 4242, minAge: 12, paused: true });

// ------------------------------------------------------------------ M2-B07
if (want('b07')) {
  await runCase({ id: 'CARRY-M2-B07', cat: '3-4 이월', title: '풀린 채 열려 있는 확인 단계에서 글자·창 높이를 더 키우면 안내문·취소 버튼이 밀리는가 (QA M2-B07, 극단 2조합 320×256 글자 100→125% · 667×375 글자 200→250%)', steps: '저장이 있는 첫 화면에서 「새 판」을 눌러 확인 단계를 열고 글자 크기를 올린 뒤 안내문·예·아니요(취소) 버튼의 위치를 뷰포트와 견줌' }, async () => {
    const lines = [];
    let anyOut = false;
    let shotPath = null;
    for (const [vp, f0, f1] of [[{ width: 320, height: 256 }, 100, 125], [{ width: 667, height: 375 }, 200, 250]]) {
      const { ctx, page } = await openSeeded(browser, { ...adult, paused: false }, { vp, touch: false, settings: SET_MANUAL });
      // 나가기 → 첫 화면(DOM 클릭: 작은 창에서도 닿게)
      const ready = (id) => page.waitForFunction((t) => { const b = document.querySelector(`[data-testid="${t}"]`); return b !== null && b.getAttribute('aria-disabled') !== 'true' && !b.disabled; }, id, { timeout: 8000 });
      await ready('tool-exit');
      await page.evaluate(() => document.querySelector('[data-testid="tool-exit"]').click());
      await page.waitForSelector('[data-testid="exit-ask"]', { timeout: 6000 });
      await ready('exit-yes');
      await page.evaluate(() => document.querySelector('[data-testid="exit-yes"]').click());
      await page.waitForSelector('[data-testid="title-screen"]', { timeout: 6000 });
      await sleep(600);
      await setRootFont(page, f0);
      await sleep(300);
      await ready('begin-new');
      await page.evaluate(() => document.querySelector('[data-testid="begin-new"]').click());
      await page.waitForSelector('[data-testid="confirm-new-ask"]', { timeout: 6000 });
      await sleep(600);
      const read = () =>
        page.evaluate(() => {
          const r = (id) => { const e = document.querySelector(`[data-testid="${id}"]`); if (!e) return null; const b = e.getBoundingClientRect(); return `${Math.round(b.top)}~${Math.round(b.bottom)}`; };
          const no = document.querySelector('[data-testid="confirm-new-no"]');
          const nb = no ? no.getBoundingClientRect() : null;
          const hit = nb ? document.elementFromPoint(nb.left + nb.width / 2, Math.min(nb.top + nb.height / 2, window.innerHeight - 1)) : null;
          return { ask: r('confirm-new-ask'), yes: r('confirm-new-yes'), no: r('confirm-new-no'), noOut: nb ? nb.bottom > window.innerHeight + 0.5 || nb.top < -0.5 : null, noHidden: nb ? !(hit && (no.contains(hit) || hit.contains(no))) : null, vh: window.innerHeight, released: document.documentElement.classList.contains('bar-released'), focus: document.activeElement ? document.activeElement.getAttribute('data-testid') : null };
        });
      const a = await read();
      await setRootFont(page, f1);
      await sleep(500);
      const b = await read();
      const out = b.noOut || b.noHidden;
      if (out) anyOut = true;
      lines.push(`${vp.width}×${vp.height} ${f0}%: 취소 ${a.no}/${a.vh}${a.released ? '(풀림)' : '(고정)'} → ${f1}%: 안내 ${b.ask} · 취소 ${b.no}/${b.vh} ${out ? '화면 밖·가려짐' : '화면 안'} 포커스 ${b.focus}`);
      if (out && !shotPath) shotPath = await shot(page, 'CARRY-M2-B07', `${vp.width}x${vp.height}-${f1}`);
      await ctx.close();
    }
    return { verdict: anyOut ? 'RECORD' : 'PASS', actual: `${lines.join(' / ')}${anyOut ? ' — 같은 현상 유지(극단 조합, 마스터 수용 여부 판단)' : ' — 해소(두 조합 모두 취소 버튼이 화면 안)'}`, shots: shotPath ? [shotPath] : [] };
  });
}

// ------------------------------------------------------------------ M3-O12·O13
if (want('o12')) {
  await runCase({ id: 'CARRY-M3-O12-O13', cat: '3-4 이월', title: '근접 사례(한 줄보다 겨우 2~6px 긴 낱말)·룰렛 결과 구간 표현 갈라짐 (QA M3-O12·O13) — 글자 200% 2조합(320×568·360×740), 변형 7종', steps: '긴 이름·지역 변형 7종의 룰렛 결과·출생신고를 글자 200%로 열어 낱말 감사(WB_AUDIT)의 끊김·피할 수 없는 긴 낱말을 세고 룰렛 결과 상태 문장의 줄 나눔에서 「(상위/하위 …」 구간 표현이 갈라지는지 봄' }, async () => {
    const VARIANTS = [{ era: 'present', seed: 4242 }, { era: 'present', seed: 229 }, { era: 'present', seed: 5 }, { era: 'present', seed: 61 }, { era: 'past', seed: 155 }, { era: 'past', seed: 183 }, { era: 'future', seed: 138 }];
    const unav = [];
    const broken = [];
    const split = [];
    let shotPath = null;
    for (const [w, h] of [[320, 568], [360, 740]]) {
      for (const v of VARIANTS) {
        const ctx = await mkctx(browser, { viewport: { width: w, height: h } });
        await cleanStorageOnce(ctx);
        await fixSeed(ctx, v.seed);
        const p = await ctx.newPage();
        await p.goto(PROD, { waitUntil: 'load' });
        await p.waitForSelector('[data-testid="title-screen"]');
        await toRoulette(p, v.era);
        await waitGuard(p, 'skip-roulette').catch(() => {});
        await p.getByTestId('skip-roulette').click();
        await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 6000 });
        await setRootFont(p, 200);
        await sleep(450);
        const st = await p.evaluate(() => {
          const el = document.querySelector('[data-testid="roulette-status"]');
          const text = el.textContent.replace(/\s+/g, ' ').trim();
          const lines = [];
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let n;
          const words = [];
          while ((n = walker.nextNode())) {
            const re = /\S+/g;
            let m;
            while ((m = re.exec(n.textContent))) {
              const r = document.createRange();
              r.setStart(n, m.index);
              r.setEnd(n, m.index + m[0].length);
              const rc = r.getClientRects()[0];
              if (rc) words.push({ w: m[0], t: Math.round(rc.top) });
            }
          }
          for (const x of words) { const l = lines.find((q) => Math.abs(q.t - x.t) < 4); if (l) l.ws.push(x.w); else lines.push({ t: x.t, ws: [x.w] }); }
          return { text, lines: lines.map((l) => l.ws.join(' ')) };
        });
        const paren = /\((상위|하위)/.test(st.text);
        const splitHere = st.lines.some((l, i) => /\((상위|하위)$/.test(l) || (i > 0 && /^(안쪽|밖|사이)\)/.test(l) && false)) || st.lines.some((l, i) => i < st.lines.length - 1 && /\((상위|하위)[^)]*$/.test(l));
        if (paren && splitHere) split.push(`${w}px ${v.era}/${v.seed}: ${st.lines.join(' ⏎ ')}`);
        const wb = await p.evaluate(WB_AUDIT, { intended: ['다이아몬드수저'] });
        for (const x of wb.broken) broken.push(`${w}px ${v.era}/${v.seed} 룰렛결과 ${x.word}`);
        for (const x of wb.unavoidable) unav.push(`${w}px ${x.word}[${x.natural}>${x.lineW}]`);
        if (split.length === 1 && !shotPath && splitHere) shotPath = await shot(p, 'CARRY-M3-O12-O13', `${w}-${v.era}-${v.seed}`);
        await waitGuard(p, 'to-birth');
        await p.getByTestId('to-birth').click();
        await p.waitForSelector('[data-testid="birth-screen"]', { timeout: 6000 });
        await sleep(450);
        const wb2 = await p.evaluate(WB_AUDIT, { intended: ['다이아몬드수저'] });
        for (const x of wb2.broken) broken.push(`${w}px ${v.era}/${v.seed} 출생신고 ${x.word}`);
        for (const x of wb2.unavoidable) unav.push(`${w}px ${x.word}[${x.natural}>${x.lineW}]`);
        await ctx.close();
      }
    }
    const uniqUnav = [...new Set(unav)];
    const problems = [];
    if (broken.length) problems.push(`낱말 중간 끊김 ${broken.length}: ${[...new Set(broken)].slice(0, 4).join(', ')}`);
    const rec = uniqUnav.length > 0 || split.length > 0;
    return { verdict: problems.length ? 'FAIL' : rec ? 'RECORD' : 'PASS', actual: `${problems.join(' / ')}${problems.length ? ' / ' : ''}피할 수 없는 긴 낱말(한 줄보다 긺) ${uniqUnav.length}종${uniqUnav.length ? ': ' + uniqUnav.slice(0, 4).join(', ') : ''}; 룰렛 결과 구간 표현 갈라짐 ${split.length}건${split.length ? ': ' + split[0] : ''}${rec ? ' — 이월 기록 유지(규칙 위반 아님, 읽기 어색)' : ''}`, shots: shotPath ? [shotPath] : [] };
  });
}

// ------------------------------------------------------------------ 변조 이름(넘침·보이지 않는 글자)
const deepName = (state, newName) => JSON.parse(JSON.stringify(state).split(state.character.name).join(newName));
async function nameTamper(id, title, names, wantReject = true) {
  await runCase({ id, cat: '3-4 이월', title, steps: '게임 저장의 이름을 변조해(저장 안 모든 곳) 360×740 터치·1280×800 마우스로 열기 → 인생 화면에 그 이름이 뜨지 않고(저장 거부 → 새 게임/첫 화면) 가로 넘침 0' }, async () => {
    const problems = [];
    const lines = [];
    let shotPath = null;
    for (const [vp, touch] of [[{ width: 360, height: 740 }, true], [{ width: 1280, height: 800 }, false]]) {
      for (const nm of names) {
        const raw = JSON.stringify({ version: SAVE_VERSION, data: deepName(adult, nm.value) });
        const { ctx, page } = await openSeededRaw(browser, raw, { vp, touch, settings: SET_MANUAL });
        await sleep(400);
        const scr = await whichScreen(page);
        const shown = await page.evaluate((v) => document.body.innerText.includes(v), nm.value.replace(/[​-‏‪-‮⁦-⁩﻿]/g, '') || '\u0000');
        const lay = await auditLayout(page);
        const bad = (wantReject && scr === 'life-screen') || lay.problems.length > 0;
        if (wantReject && scr === 'life-screen') problems.push(`${nm.label}(${vp.width}): 변조 이름의 판이 열림`);
        problems.push(...lay.problems.map((x) => `${nm.label}(${vp.width}): ${x}`));
        if (bad && !shotPath) shotPath = await shot(page, id, `${nm.label}-${vp.width}`);
        lines.push(`${nm.label}(${vp.width}) → ${scr}`);
        await ctx.close();
      }
    }
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.slice(0, 5).join(' / ') : `모두 거부(새 게임·첫 화면), 넘침 0 — ${[...new Set(lines)].slice(0, 6).join(', ')}`, shots: shotPath ? [shotPath] : [] };
  });
}
if (want('name')) await nameTamper('CARRY-name-overflow', '변조된 긴 이름(한글 20자·W 40자·한글 6자·영문 5자)은 이름 규칙(한글 3~5자)으로 저장이 거부되어 넘침 0 (QA M3-O15·M4-A10·M5-O05)', [{ label: '한글20', value: '가'.repeat(20) }, { label: 'W40', value: 'W'.repeat(40) }, { label: '한글6', value: '김서준이다요' }, { label: '영문5', value: 'Alice' }]);
if (want('invisible')) await nameTamper('CARRY-name-invisible', '보이지 않는 글자만의 이름(ZWSP·U+3164·옛 한글 채움·RLO·FFFD)은 이름 화이트리스트로 거부된다 (QA M7b-A12d)', [{ label: 'ZWSP', value: '​​​' }, { label: 'U3164', value: 'ㅤㅤㅤ' }, { label: 'U115F', value: 'ᅟᅟᅟ' }, { label: 'RLO', value: '‮김서준' }, { label: 'FFFD', value: '���' }, { label: '끼움', value: '김​서준' }]);

// ------------------------------------------------------------------ M4-O01 해 중간 진행률
if (want('progress')) {
  await runCase({ id: 'CARRY-M4-O01', cat: '3-4 이월', title: '해 중간 진행률이 새로고침 뒤 0%부터 다시 채워진다 (QA M4-O01) — 동작 불변, README 「알려진 제한」에 기재', steps: '진행 중인 판에서 해 진행률 40% 이상일 때 나이·진행률을 읽고 새로고침 → 열린 직후 진행률' }, async () => {
    const { ctx, page } = await openSeeded(browser, adultRun, { vp: { width: 1280, height: 800 }, touch: false, settings: { ...SET_MANUAL, speed: 4 } });
    await page.waitForFunction(() => { const e = document.querySelector('[data-testid="year-progress"]'); return e && Number(e.getAttribute('aria-valuenow')) >= 40 && Number(e.getAttribute('aria-valuenow')) <= 70; }, null, { timeout: 15000, polling: 100 });
    const before = await readCard(page);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await sleep(100);
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('[data-testid="life-screen"]', { timeout: 8000 });
    await sleep(250);
    const after = await readCard(page);
    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    const documented = /진행률 막대는 새로고침 뒤 0%부터/.test(readme);
    await ctx.close();
    const resets = Number(after.pct) < Number(before.pct) - 15 && after.age === before.age;
    return { verdict: resets ? 'RECORD' : 'PASS', actual: `새로고침 전 ${before.age}세 ${before.pct}% → 직후 ${after.age}세 ${after.pct}%${resets ? ' — 0%부터 다시 채움(동작 불변)' : ' — 진행률이 이어짐(동작이 바뀌었는지 확인 필요)'}; README 「알려진 제한」 기재 ${documented ? '있음' : '없음'}`, shots: [] };
  });
}

// ------------------------------------------------------------------ M7b-A20b 스크림 스크롤
if (want('scrim')) {
  await runCase({ id: 'CARRY-M7b-A20b', cat: '3-4 이월', title: '시트 바깥 바탕(스크림)에서 문서가 스크롤되지 않는다 (QA M7b-A20b → M7c 스크롤 잠금) — 쓸기(터치)·휠(마우스) 각 1케이스', steps: '결정 시트를 연 채 스크림 위에서 터치 쓸기(360×740)·휠(1280×800) → scrollY 불변' }, async () => {
    const problems = [];
    const lines = [];
    for (const [vp, touch] of [[{ width: 360, height: 740 }, true], [{ width: 1280, height: 800 }, false]]) {
      const { ctx, page } = await openSeeded(browser, pend, { vp, touch, settings: SET_MANUAL });
      await page.waitForSelector('[data-testid="choice-panel"]');
      await sleep(700);
      const y0 = await page.evaluate(() => window.scrollY);
      if (touch) {
        const cdp = await ctx.newCDPSession(page);
        for (let i = 0; i < 3; i++) {
          await cdp.send('Input.synthesizeScrollGesture', { x: 180, y: 60, yDistance: -300, speed: 800, gestureSourceType: 'touch' }).catch(() => {});
        }
      } else {
        await page.mouse.move(200, 120);
        await page.mouse.wheel(0, 600);
        await page.mouse.wheel(0, 600);
      }
      await sleep(400);
      const y1 = await page.evaluate(() => window.scrollY);
      lines.push(`${vp.width}: scrollY ${y0}→${y1}`);
      if (y1 !== y0) problems.push(`${vp.width}: 스크림 위 ${touch ? '쓸기' : '휠'}로 문서가 스크롤됨 ${y0}→${y1}`);
      await ctx.close();
    }
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : `스크롤 잠금 유지 — ${lines.join(', ')}`, shots: [] };
  });
}

// ------------------------------------------------------------------ M7e-O01 문장 = 방향 (155종)
if (want('o01')) {
  await runCase({ id: 'CARRY-M7e-O01', cat: '3-4 이월', title: '엔딩 출발선 막대: 문장(방향)과 글자에서 푼 기대 방향이 155/155 일치하는가 + 마름모가 띠 바깥 2점 이내인 모호한 경계 수 (QA M7e-O01, 모호함은 2차 designer)', steps: '세 세상 엔딩 155판(오라클이 만든 저장)을 prod 엔딩 화면에 열어 M7e 판정기(m7e-ending-lib.judge: 글자에서 구간·마지막 자리·방향을 독립으로 풀어 그림 위치와 대조)로 판정' }, async () => {
    const sample = [];
    for (const era of ['past', 'present', 'future']) {
      const n = era === 'future' ? 51 : 52;
      const got = await evalCore(
        oracle,
        `const out = [];
         for (let seed = 1; out.length < arg.n && seed < 4000; seed++) {
           const s0 = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed * 7 + 3), arg.era)));
           const r = core.playToEnd(s0, null);
           if (r.state.phase !== 'ending' || r.state.death.age < 20) continue;
           out.push({ seed: seed * 7 + 3, tier: r.state.character.parentWealth, state: r.state });
         }
         return out;`,
        { era, n },
      );
      for (const g of got) sample.push({ era, ...g });
    }
    const fails = [];
    const notes = [];
    let dirMismatch = 0;
    let ambiguous = 0;
    let shotPath = null;
    for (const it of sample) {
      const name = `ending-${it.era}-${it.seed}`;
      const { ctx, page } = await openSeeded(browser, it.state, { vp: { width: 1280, height: 800 }, touch: false, settings: SET_MANUAL, wait: '[data-testid="ending-screen"]' });
      await sleep(150);
      const d = await page.evaluate(READ);
      const meta = { [name]: { era: it.era, tier: it.tier } };
      const j = judge(name, meta, d);
      const mv = j.f.filter((x) => /방향 문장/.test(x));
      if (mv.length) dirMismatch++;
      const other = j.f.filter((x) => !/방향 문장/.test(x));
      if (other.length) fails.push(`${name}: ${other[0].slice(0, 90)}`);
      if (j.notes.some((x) => /경계 모호/.test(x))) ambiguous++;
      if ((mv.length || other.length) && !shotPath) shotPath = await shot(page, 'CARRY-M7e-O01', name);
      await ctx.close();
    }
    const n = sample.length;
    const verdict = dirMismatch > 0 || fails.length > 0 ? 'FAIL' : ambiguous > 0 ? 'RECORD' : 'PASS';
    return { verdict, actual: `${n}판: 방향 문장 ≠ 글자 기대 ${dirMismatch}건 → 일치 ${n - dirMismatch}/${n}; 그 밖의 막대·문장 판정 위반 ${fails.length}건${fails.length ? ' (' + fails.slice(0, 3).join(' | ') + ')' : ''}; 마름모가 띠 바깥 2점 이내인 모호한 경계 ${ambiguous}판${ambiguous ? ' — 이월(눈으로 모호, 2차 designer)' : ''}`, shots: shotPath ? [shotPath] : [] };
  });
}

// ------------------------------------------------------------------ M7e-N04b 다가올 세상 흙수저 0원 앞섬
if (want('n04b')) {
  await runCase({ id: 'CARRY-M7e-N04b', cat: '3-4 이월', title: '다가올 세상 흙수저(재력 1단계)가 정확히 0원으로 마치면 「출발선보다 앞선 자리입니다.」가 나온다 (QA M7e-N04b — 마스터 수용, wiki 02)', steps: '오라클로 다가올 세상 재력 1단계·최종 순자산 0원인 엔딩을 찾아 prod 엔딩 화면 문장을 읽음' }, async () => {
    const found = await evalCore(
      oracle,
      `const out = [];
       for (let seed = 1; out.length < 3 && seed < 6000; seed++) {
         const s0 = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'future')));
         if (s0.character.parentWealth !== 1) continue;
         const r = core.playToEnd(s0, null);
         const s = r.state;
         if (s.phase === 'ending' && s.death.age >= 20 && s.assets.net === 0) out.push({ seed, state: s });
       }
       return out;`,
    );
    if (!found.length) return { verdict: 'SKIP', actual: '6000 시드에서 다가올 세상 흙수저 0원 엔딩을 만들지 못함(기본 정책) — 재현 못 함', shots: [] };
    const rows = [];
    let shotPath = null;
    for (const f of found) {
      const { ctx, page } = await openSeeded(browser, f.state, { vp: { width: 1280, height: 800 }, touch: false, settings: SET_MANUAL, wait: '[data-testid="ending-screen"]' });
      const d = await page.evaluate(READ);
      rows.push(`시드 ${f.seed}: 「${d.movement}」 / 순자산 ${d.finalNetValue}`);
      if (!shotPath) shotPath = await shot(page, 'CARRY-M7e-N04b', `seed${f.seed}`);
      await ctx.close();
    }
    const ahead = rows.every((r) => /앞선 자리/.test(r));
    return { verdict: ahead ? 'RECORD' : 'PASS', actual: `${rows.join(' || ')}${ahead ? ' — 같은 현상(마스터 수용 유지, wiki 02)' : ' — 앞섬이 아님(동작 변경 확인 필요)'}`, shots: shotPath ? [shotPath] : [] };
  });
}

// ------------------------------------------------------------------ M8 관찰 1: 두 탭 밀린 화면 문구
if (want('dup')) {
  await runCase({ id: 'CARRY-M8-dup-tab', cat: '3-4 이월', title: '데스크톱에서 같은 판을 두 번째 탭으로 열었을 때 밀린 화면의 문구 (QA M8 관찰 1 — QA는 기록, 눈 판단은 실기기 PC6, 2차 디자인 후보)', steps: '1280×800에서 같은 저장을 두 탭으로 연 뒤 앞 탭이 쓰면 밀린 화면 문구·이어받기 버튼을 읽고 3초 훑음' }, async () => {
    const ctx = await mkctx(browser, { viewport: { width: 1280, height: 800 } });
    await cleanStorageOnce(ctx);
    await fixSeed(ctx, 123);
    const a = await ctx.newPage();
    await a.goto(PROD, { waitUntil: 'load' });
    await a.waitForSelector('[data-testid="title-screen"]');
    await toRoulette(a, 'present');
    await skipToBirth(a);
    await waitGuard(a, 'next-life');
    await a.getByTestId('next-life').click();
    await a.waitForSelector('[data-testid="life-screen"]');
    await sleep(2800);
    const b = await ctx.newPage();
    await b.goto(PROD, { waitUntil: 'load' });
    await b.waitForSelector('[data-testid="life-screen"], [data-testid="superseded-screen"], [data-testid="title-screen"]', { timeout: 8000 });
    await sleep(2500);
    await a.bringToFront();
    await sleep(2500);
    const scrA = await whichScreen(a);
    const scrB = await whichScreen(b);
    const txtA = scrA === 'superseded-screen' ? (await a.getByTestId('superseded-text').innerText()).replace(/\s+/g, ' ').trim() : null;
    const txtB = scrB === 'superseded-screen' ? (await b.getByTestId('superseded-text').innerText()).replace(/\s+/g, ' ').trim() : null;
    const shown = scrA === 'superseded-screen' ? a : scrB === 'superseded-screen' ? b : null;
    const s = shown ? await shot(shown, 'CARRY-M8-dup-tab') : null;
    const take = shown ? (await shown.locator('[data-testid="take-over"]').count()) > 0 : false;
    const fb = shown ? await shown.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 220)) : '';
    await ctx.close();
    return { verdict: shown ? 'RECORD' : 'PASS', actual: shown ? `탭 A ${scrA}${txtA ? ` 「${txtA}」` : ''} · 탭 B ${scrB}${txtB ? ` 「${txtB}」` : ''}; 이어받기 버튼 ${take ? '있음' : '없음'} — 화면 문구: ${fb}` : '두 탭 모두 밀린 화면이 아님(동작 변경 확인 필요)', shots: s ? [s] : [] };
  });
}

// ------------------------------------------------------------------ README 알려진 제한 5줄 ↔ 실제
if (want('readme')) {
  await runCase({ id: 'CARRY-README-limits', cat: '3-4 이월', title: 'README 「알려진 제한」 5줄이 실제 동작과 맞는다: 오프라인 새로고침 · 약 1시간 준비 중 · iOS는 WebKit 자동 시험만 · 진행률 새로고침 0% · 기록 글은 이 기기에만', steps: '각 줄을 다른 케이스의 결과와 대조(D-offline-reload·P3-title·P6·CARRY-M4-O01·기록 글 저장 위치)' }, async () => {
    const ctx = await mkctx(browser, { viewport: { width: 1280, height: 800 } });
    await cleanStorageOnce(ctx);
    const p = await ctx.newPage();
    const reqs = [];
    p.on('request', (r) => reqs.push(r.url()));
    await p.goto(PROD, { waitUntil: 'load' });
    await p.waitForSelector('[data-testid="title-screen"]');
    await toRoulette(p, 'present');
    await skipToBirth(p);
    await waitGuard(p, 'next-life');
    await p.getByTestId('next-life').click();
    await p.waitForSelector('[data-testid="life-screen"]');
    await waitGuard(p, 'tool-note');
    await p.getByTestId('tool-note').click();
    await p.waitForSelector('[data-testid="note-sheet"]');
    await sleep(500);
    await p.getByTestId('note-input').fill('README 대조용 기록 글 AZ9');
    await p.getByTestId('note-save').click();
    await sleep(600);
    const storage = await p.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage), cookies: document.cookie }));
    const textInLocal = await p.evaluate(() => Object.values(localStorage).some((v) => String(v).includes('README 대조용 기록 글 AZ9')));
    const sent = reqs.filter((u) => u.includes('AZ9') || decodeURIComponent(u).includes('README 대조용'));
    const fbHref = await p.getByTestId('tool-feedback').getAttribute('href');
    const problems = [];
    if (!textInLocal) problems.push('기록 글이 이 기기(localStorage)에 저장되지 않음');
    if (sent.length) problems.push('기록 글이 요청에 실림');
    if (decodeURIComponent(fbHref).includes('README 대조용')) problems.push('의견 보내기 주소에 기록 글');
    if (storage.cookies) problems.push(`쿠키 ${storage.cookies}`);
    await ctx.close();
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : `기록 글은 localStorage(${storage.local.join(', ')})에만 있고 요청·의견 보내기 주소·쿠키에 없음. 나머지 네 줄은 D-offline-reload(오프라인 새로고침 실패 관찰)·P3-title(약 1시간 비활성·준비 중)·CARRY-M4-O01(진행률 0%부터)·P6(WebKit 시험 결과)에서 확인`, shots: [] };
  });
}

await browser.close();
