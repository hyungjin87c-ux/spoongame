// QA-003 M7b 2회차: 1회차 RECORD 처리 확인 — C02 ①(infant-screen 무인용)·⑨(c-017 표기)·K11(lang=en·머리 낭독)·A20(시트 뒤 문서 스크롤)·A12b(제어 문자 저장)
// 사용: QA_OUT=qa/results/m7b/r2 QA_SHOT_PREFIX=M7b-r2 node qa/scripts/m7b-r2-record.mjs [케이스ID 일부]
// 앱 코드는 건드리지 않는다. 카드 저장은 개발 서버 core로 만들고(오라클) prod 빌드에서만 연다.
// 준비: QA_OUT=… node qa/scripts/m7b-states.mjs (sibling-*·tutoring-*·noise-present 등 카드 저장) + QA_OUT=… node qa/scripts/m7b-r2-probe-death.mjs (A12c용 엔딩 저장). 끝나면 r2/states는 지워도 된다(다시 만든다).
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, OUT, mkctx, PROD, DEV, GAME_KEY, SETTINGS_KEY, shot, runCase, readCard, cardReady, findCardState, settingsEnvelope, SET_MANUAL, SET_AUTO, TOUCH } from './m7b-lib.mjs';
import { openCard, VPS } from './m7b-audit.mjs';
import { setRootFont } from './m7b-lib.mjs';

const ONLY = process.argv[2] || '';
const run = (c, fn) => (!ONLY || c.id.includes(ONLY) ? runCase({ cat: '2회차', ...c }, fn) : null);
const STATES = path.join(OUT, 'states');
fs.mkdirSync(STATES, { recursive: true });
const load = (n) => JSON.parse(fs.readFileSync(path.join(STATES, `${n}.json`), 'utf8'));

const b = await launch();
const ctx0 = await mkctx(b);
const oracle = await ctx0.newPage();
await oracle.goto(DEV, { waitUntil: 'load' });
await oracle.waitForSelector('[data-testid="title-screen"]');
const ensure = async (name, ev, era, opts = {}) => {
  const f = path.join(STATES, `${name}.json`);
  if (fs.existsSync(f)) return true;
  const s = await findCardState(oracle, ev, era, { to: 9000, ...opts });
  if (!s) return false;
  fs.writeFileSync(f, JSON.stringify(s));
  return true;
};

/** 저장을 심어 prod를 열고 settle된 화면 이름을 돌려준다(openCard와 달리 카드가 없어도 기다린다) */
async function openRaw(raw, { vp = { width: 360, height: 740, touch: true }, settings = SET_MANUAL, hidden = true } = {}) {
  const ctx = await mkctx(b, { viewport: { width: vp.width, height: vp.height }, ...(vp.touch ? TOUCH : {}) });
  await ctx.addInitScript(
    ([k, v, sk, sv, hid]) => {
      try {
        if (!sessionStorage.getItem('__qa_seeded')) {
          localStorage.clear();
          localStorage.setItem(k, v);
          localStorage.setItem(sk, sv);
          sessionStorage.setItem('__qa_seeded', '1');
        }
      } catch {}
      if (hid) {
        window.__vis = 'hidden';
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis });
      }
    },
    [GAME_KEY, raw, SETTINGS_KEY, settingsEnvelope(settings), hidden],
  );
  const page = await ctx.newPage();
  await page.goto(PROD, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="title-screen"], [data-testid="life-screen"], [data-testid="error-screen"], [data-testid="ending-screen"]', { timeout: 15000 });
  await sleep(500);
  return { ctx, page };
}

// ------------------------------------------------------------------ C02 ① infant-screen 무인용
await run(
  { id: 'C02a', title: 'infant-screen(영상 노출 카드)이 세 세상에서 인용 박스 없이 뜬다 — WHO 지침(c-035) 0', steps: '개발 서버 core로 infant-screen이 대기 중인 저장을 세상별로 만들고 prod 360×740 터치 시트로 열어 인용 박스·본문 글자·선택지를 읽는다. 수확 표본의 같은 카드도 대조(분석 단계)', expected: '카드는 뜨고(제목·선택지 3), [data-testid="cite"] 0, 화면에 「WHO」·「세계보건기구」·「권고」·「권하지」 0' },
  async () => {
    const rows = [];
    const bad = [];
    const shots = [];
    for (const era of ['past', 'present', 'future']) {
      const name = `r2-infant-screen-${era}`;
      const ok = await ensure(name, 'infant-screen', era, { from: 1, to: 9000 });
      if (!ok) {
        rows.push(`${era}: 이 세상에서는 카드가 뜨지 않음(9000시드 탐색)`);
        continue;
      }
      const st = load(name);
      const { ctx, page } = await openCard(b, name, 'sheet', { vp: VPS[2], hidden: true });
      await cardReady(page);
      const c = await readCard(page);
      const body = await page.evaluate(() => document.body.innerText);
      const hit = (body.match(/WHO|세계보건기구|권고|권하지|지침/g) || []).join(',');
      const citeN = await page.evaluate(() => document.querySelectorAll('[data-testid="cite"], .cite').length);
      rows.push(`${era}: key ${c.key} 「${c.title}」 ${c.when} 선택지 ${c.choices.length} 인용박스 ${citeN} 금지어 ${hit || 0}`);
      if (c.cite || citeN) bad.push(`${era}: 인용 박스가 뜸(${c.cite && c.cite.id})`);
      if (hit) bad.push(`${era}: 금지어 ${hit}`);
      if (c.choices.length < 2) bad.push(`${era}: 선택지 ${c.choices.length}`);
      if (!/^infant-screen@/.test(c.key || '')) bad.push(`${era}: key ${c.key}`);
      shots.push(await shot(page, 'C02a', `infant-screen-${era}-birth${st.character.birthYear}`));
      await ctx.close();
    }
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: (bad.length ? bad.join(' / ') + ' || ' : '') + rows.join(' | '), shots };
  },
);

// ------------------------------------------------------------------ C02 ⑨ c-017 표기
await run(
  { id: 'C02b', title: 'c-017(최저임금) 표기가 「215만 6,880원」꼴 — 「2,156,880원」 0', steps: 'school-parttime 카드를 지금·다가올 세상에서 열어 인용 요약·출처 줄을 읽는다(시트 360×740 / 인라인 320 글자 200%도 한 번)', expected: '요약에 「월 환산액(209시간 기준)은 215만 6,880원입니다.」(다가올은 「지금 기준으로는」 머리말), 「2,156,880」 0, 100자 이하, 합쇼체' },
  async () => {
    const rows = [];
    const bad = [];
    const shots = [];
    for (const era of ['present', 'future']) {
      const name = `r2-parttime-${era}`;
      if (!(await ensure(name, 'school-parttime', era))) {
        bad.push(`${era}: 카드를 못 찾음`);
        continue;
      }
      for (const [vp, font, mode] of [[VPS[2], 100, 'sheet'], [VPS[0], 200, 'inline']]) {
        const { ctx, page } = await openCard(b, name, mode, { vp, font, hidden: true });
        await cardReady(page).catch(() => {});
        const c = await readCard(page);
        const t = c.cite ? c.cite.text : null;
        rows.push(`${era}/${mode}@${font}: ${t} || ${c.cite && c.cite.src}`);
        if (!t) bad.push(`${era}/${mode}: 인용 없음`);
        else {
          if (!/215만 6,880원입니다\.$/.test(t)) bad.push(`${era}/${mode}: 표기 「${t.slice(-24)}」`);
          if (/2,156,880|2156880/.test(t + c.cite.src)) bad.push(`${era}/${mode}: 7자리 쉼표 표기 남음`);
          if (t.length > 100) bad.push(`${era}/${mode}: ${t.length}자`);
          if (era === 'future' && !t.startsWith('지금 기준으로는')) bad.push('future: 머리말 없음');
          if (era === 'present' && /^지금 기준으로는/.test(t)) bad.push('present: 머리말 붙음');
        }
        shots.push(await shot(page, 'C02b', `c-017-${era}-${mode}-${vp.width}x${vp.height}-${font}`));
        await ctx.close();
      }
    }
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: (bad.length ? bad.join(' / ') + ' || ' : '') + rows.join(' | '), shots };
  },
);

// ------------------------------------------------------------------ K11 lang=en · 머리 낭독
const AX = async (ctx, page) => {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('Accessibility.enable');
  await cdp.send('Runtime.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[role="dialog"]' });
  const { node } = await cdp.send('DOM.describeNode', { nodeId });
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const start = nodes.find((n) => n.backendDOMNodeId === node.backendNodeId);
  const seq = [];
  const walk = async (n) => {
    if (!n) return;
    if (!n.ignored) {
      const role = n.role?.value;
      const nm = n.name?.value || '';
      if (role === 'StaticText' || role === 'heading' || role === 'button' || role === 'dialog') {
        let lang = null;
        let tid = null;
        let cls = null;
        if (role === 'StaticText' && n.backendDOMNodeId) {
          try {
            const { object } = await cdp.send('DOM.resolveNode', { backendNodeId: n.backendDOMNodeId });
            const r = await cdp.send('Runtime.callFunctionOn', {
              objectId: object.objectId,
              functionDeclaration: `function(){ const e = this.nodeType === 1 ? this : this.parentElement; const l = e.closest('[lang]'); const t = e.closest('[data-testid]'); return { lang: l ? l.getAttribute('lang') : null, tid: t ? t.getAttribute('data-testid') : null, cls: e.className || null }; }`,
              returnByValue: true,
            });
            lang = r.result.value.lang;
            tid = r.result.value.tid;
            cls = r.result.value.cls;
          } catch {}
        }
        seq.push({ role, name: nm, lang, tid, cls });
      }
    }
    for (const c of n.childIds ?? []) await walk(byId.get(c));
  };
  await walk(start);
  return seq;
};

await run(
  { id: 'K11', title: 'CDP 접근성 트리: 영문 원제·저자에 lang=en, 한국어 글에는 없음, 머리 낭독 「1959년 3세」(「·」 없음)', steps: '연구 인용(c-033, infant-new-sibling)이 뜨는 세 세상 시트의 접근성 트리를 문서 순서로 훑어 각 글 조각의 효과 lang·머리 낭독을 읽는다. 폭 320 글자 200%(머리가 두 줄로 갈라지는 틀)도 한 번', expected: '영문 원제(And baby makes four…)·저자(Teti)의 lang=en, 한국어 조각(외(1996), 요약, 선택지)에 lang=en 0, 머리 낭독에 「·」 0이고 「{연도}년 {나이}세」로 읽힘' },
  async () => {
    const rows = [];
    const bad = [];
    const shots = [];
    const dump = {};
    for (const [name, fontCfg] of [['sibling-past', [VPS[2], 100]], ['sibling-present', [VPS[2], 100]], ['sibling-future', [VPS[2], 100]], ['sibling-past', [VPS[0], 200]], ['sibling-past', [VPS[0], 300]], ['sibling-past', [VPS[0], 400]], ['sibling-past', [{ name: '240x600', width: 240, height: 600 }, 300]], ['sibling-future', [{ name: '240x600', width: 240, height: 600 }, 200]]]) {
      const { ctx, page } = await openCard(b, name, 'sheet', { vp: fontCfg[0], font: fontCfg[1], hidden: true });
      await cardReady(page);
      const seq = await AX(ctx, page);
      const tag = `${name}@${fontCfg[0].width}x${fontCfg[1]}`;
      dump[tag] = seq;
      // 머리: 제목(heading) 앞까지의 글
      const iH = seq.findIndex((x) => x.role === 'heading');
      const head = seq.slice(0, iH).filter((x) => x.role === 'StaticText').map((x) => x.name);
      const reading = head.join(' ');
      const hasDot = head.some((t) => /·/.test(t));
      const m = /(\d{4})년\s+(\d+)세/.exec(reading);
      const domHead = await page.evaluate(() => { const w = document.querySelector('[data-testid="decision-when"]'); return { text: w.textContent.replace(/\s+/g, ' '), split: !!w.querySelector('.fit-pair.is-split'), dotAriaHidden: [...w.querySelectorAll('[aria-hidden="true"]')].map((e) => e.textContent) }; });
      // 인용 출처 줄 조각의 lang
      const src = seq.filter((x) => x.role === 'StaticText' && (x.tid === 'cite-src' || x.tid === 'cite-text'));
      const latinNoEn = src.filter((x) => /[A-Za-z]{3,}/.test(x.name) && x.lang !== 'en');
      const koEn = src.filter((x) => x.lang === 'en' && /[가-힣]/.test(x.name));
      const enPieces = src.filter((x) => x.lang === 'en').map((x) => x.name);
      const koPieces = src.filter((x) => x.lang !== 'en').map((x) => `${x.name}[${x.lang || '-'}]`);
      rows.push(`${tag}: 머리 낭독 「${reading}」 ${m ? '읽힘' : '??'} 「·」 ${hasDot ? '있음' : '없음'}(DOM ${domHead.split ? '갈라진 틀' : '한 줄 틀'}, aria-hidden 기호 ${JSON.stringify(domHead.dotAriaHidden)}) | lang=en ${JSON.stringify(enPieces)} | 한국어 ${koPieces.length}조각`);
      if (hasDot) bad.push(`${tag}: 머리 낭독에 「·」`);
      if (!m) bad.push(`${tag}: 머리 낭독이 「N년 N세」로 안 읽힘 「${reading}」`);
      if (!enPieces.some((t) => /Teti/.test(t))) bad.push(`${tag}: 저자 Teti에 lang=en 없음`);
      if (!enPieces.some((t) => /And baby makes four/.test(t))) bad.push(`${tag}: 영문 원제에 lang=en 없음`);
      if (latinNoEn.length) bad.push(`${tag}: 영문인데 lang=en 아님 ${latinNoEn.map((x) => x.name).join(' / ')}`);
      if (koEn.length) bad.push(`${tag}: 한국어에 lang=en ${koEn.map((x) => x.name).join(' / ')}`);
      shots.push(await shot(page, 'K11', `${tag}`));
      await ctx.close();
    }
    fs.writeFileSync(path.join(OUT, 'k11-ax.json'), JSON.stringify(dump, null, 1));
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: (bad.length ? bad.join(' / ') + ' || ' : '') + rows.join(' | '), shots };
  },
);

await run(
  { id: 'K11b', title: 'K11 전수: 연결된 연구 인용 카드 전부의 출처 줄 라틴 글자 조각이 lang=en인가, 한국어 조각에 lang=en이 새지 않았는가', steps: '개발 서버 core로 연구 인용 카드(c-033 외)가 뜨는 저장을 모아 prod 시트에서 DOM·접근성 트리의 lang을 읽는다(약어 1~6자 영문 대문자는 별도 기록)', expected: '3글자 이상 영문 낱말은 모두 lang=en, 한국어에 lang=en 0' },
  async () => {
    // 연구(kind research) 인용이 연결된 이벤트: 정적 데이터에서 찾는다
    const cites = JSON.parse(fs.readFileSync(path.join(OUT, '..', '..', '..', '..', 'src', 'data', 'citations.json'), 'utf8')).citations;
    const research = cites.filter((c) => c.kind === 'research' && (c.usedBy || []).length);
    const rows = [];
    const bad = [];
    for (const c of research) {
      for (const ev of c.usedBy) {
        for (const era of c.eras) {
          const name = `r2-k11b-${c.id}-${ev}-${era}`;
          if (!(await ensure(name, ev, era))) {
            rows.push(`${c.id}/${ev}/${era}: 저장 못 찾음`);
            continue;
          }
          const { ctx, page } = await openCard(b, name, 'sheet', { vp: VPS[2], hidden: true });
          await cardReady(page);
          const info = await page.evaluate(() => {
            const cite = document.querySelector('[data-testid="cite"]');
            if (!cite) return null;
            const out = [];
            const w = document.createTreeWalker(cite, NodeFilter.SHOW_TEXT);
            let n;
            while ((n = w.nextNode())) {
              const t = n.textContent;
              if (!t.trim()) continue;
              const l = n.parentElement.closest('[lang]');
              out.push({ t, lang: l ? l.getAttribute('lang') : null });
            }
            return { id: cite.getAttribute('data-citation'), pieces: out };
          });
          if (!info) {
            rows.push(`${c.id}/${ev}/${era}: 인용이 안 뜸(연도 범위)`);
            await ctx.close();
            continue;
          }
          const latinNoEn = info.pieces.filter((p) => /[A-Za-z]{3,}/.test(p.t.replace(/\([A-Z]{2,6}\)/g, '')) && p.lang !== 'en');
          const koEn = info.pieces.filter((p) => p.lang === 'en' && /[가-힣]/.test(p.t));
          const enPieces = info.pieces.filter((p) => p.lang === 'en').map((p) => p.t.trim());
          rows.push(`${info.id}/${ev}/${era}: lang=en ${JSON.stringify(enPieces)}${latinNoEn.length ? ' 영문인데 lang 없음 ' + latinNoEn.map((p) => p.t).join('/') : ''}${koEn.length ? ' 한국어에 lang=en ' + koEn.map((p) => p.t).join('/') : ''}`);
          if (latinNoEn.length) bad.push(`${info.id}/${era}: 영문 lang 누락 ${latinNoEn.map((p) => p.t.trim()).join(' / ')}`);
          if (koEn.length) bad.push(`${info.id}/${era}: 한국어 lang=en ${koEn.map((p) => p.t.trim()).join(' / ')}`);
          await ctx.close();
        }
      }
    }
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: (bad.length ? bad.join(' / ') + ' || ' : '') + rows.join(' | ').slice(0, 2500), shots: [] };
  },
);

// ------------------------------------------------------------------ A20 시트 뒤 문서 스크롤
const touchSwipe = async (cdp, x, y0, dy, steps = 10) => {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
  for (let k = 1; k <= steps; k++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + (dy * k) / steps }] });
    await sleep(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(250);
};
const SCROLL_STATE = () => {
  const s = document.querySelector('.sheet');
  const o = document.querySelector('.overlay');
  return { docY: Math.round(scrollY), docH: document.documentElement.scrollHeight, vh: innerHeight, sheetTop: s ? Math.round(s.scrollTop) : null, sheetMax: s ? s.scrollHeight - s.clientHeight : null, obSheet: s ? getComputedStyle(s).overscrollBehaviorY : null, obOverlay: o ? getComputedStyle(o).overscrollBehaviorY : null, obBody: getComputedStyle(document.body).overscrollBehaviorY, obHtml: getComputedStyle(document.documentElement).overscrollBehaviorY };
};
await run(
  { id: 'A20', title: '시트 끝 이후 터치 드래그·휠에도 시트 뒤 문서 scrollY 불변 (overscroll-behavior: contain)', steps: '(a) 360×740 터치, 긴 카드 시트에서 터치 드래그 8번(시트 끝 이후 포함) + 끝에서 8번 더 + 휠 6번 (b) 맨 위에서 아래로 당기기 6번 (c) 데스크톱 1280×800 휠 (d) 접은 뒤 같은 드래그가 문서를 움직이는가(스크롤 잠금이 새지 않았는지) (e) 짧은 카드(시트가 안 넘침)에서 드래그', expected: '(a)(b)(c)(e) scrollY 0 유지, (d) 접힌 뒤에는 대시보드가 평소처럼 스크롤됨' },
  async () => {
    const bad = [];
    const rows = [];
    const shots = [];
    // (a)
    {
      const { ctx, page } = await openCard(b, 'sibling-past', 'sheet', { vp: VPS[2], hidden: true });
      await cardReady(page);
      const cdp = await ctx.newCDPSession(page);
      const s0 = await page.evaluate(SCROLL_STATE);
      for (let i = 0; i < 8; i++) await touchSwipe(cdp, 180, 620, -240);
      const s1 = await page.evaluate(SCROLL_STATE);
      for (let i = 0; i < 8; i++) await touchSwipe(cdp, 180, 620, -240);
      for (let i = 0; i < 6; i++) {
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 180, y: 400, deltaX: 0, deltaY: 300 });
        await sleep(120);
      }
      const s2 = await page.evaluate(SCROLL_STATE);
      shots.push(await shot(page, 'A20', 'sheet-after-swipes-and-wheel'));
      // (b) 위로 되돌린 뒤 당기기
      await page.evaluate(() => { document.querySelector('.sheet').scrollTop = 0; });
      for (let i = 0; i < 6; i++) await touchSwipe(cdp, 180, 300, 240);
      const s3 = await page.evaluate(SCROLL_STATE);
      rows.push(`(a) 드래그 8번 뒤 docY ${s1.docY}(시트 ${s1.sheetTop}/${s1.sheetMax}) → 끝에서 드래그 8+휠 6 뒤 docY ${s2.docY}(시트 ${s2.sheetTop}/${s2.sheetMax}) / (b) 맨 위에서 당기기 6번 docY ${s3.docY}(시트 ${s3.sheetTop}) / overscroll-behavior-y 시트 ${s0.obSheet}·바탕 ${s0.obOverlay}·body ${s0.obBody}·html ${s0.obHtml}, 문서 높이 ${s0.docH} > 화면 ${s0.vh}`);
      if (s0.docH <= s0.vh) bad.push('(a) 문서가 스크롤될 만큼 길지 않아 시험이 공허함');
      if (s1.docY !== 0 || s2.docY !== 0 || s3.docY !== 0) bad.push(`(a)(b) 시트 뒤 문서가 움직임 ${s1.docY}/${s2.docY}/${s3.docY}`);
      if (s1.sheetTop < s1.sheetMax - 1) bad.push(`(a) 시트가 끝까지 내려가지 않아 시험이 공허함 ${s1.sheetTop}/${s1.sheetMax}`);
      if (s0.obSheet !== 'contain' || s0.obOverlay !== 'contain') bad.push(`overscroll-behavior ${s0.obSheet}/${s0.obOverlay}`);
      // (d) 접은 뒤
      await page.keyboard.press('Escape');
      await page.waitForSelector('[data-testid="decision-fold"]');
      await sleep(500);
      for (let i = 0; i < 3; i++) await touchSwipe(cdp, 180, 620, -240);
      const sd = await page.evaluate(SCROLL_STATE);
      rows.push(`(d) 접은 뒤 같은 드래그 3번 → docY ${sd.docY}`);
      if (sd.docY <= 0) bad.push('(d) 접은 뒤에도 대시보드가 스크롤되지 않음(잠금이 샘)');
      shots.push(await shot(page, 'A20', 'fold-then-page-scroll'));
      await ctx.close();
    }
    // (c) 데스크톱 휠
    {
      const { ctx, page } = await openCard(b, 'sibling-past', 'sheet', { vp: VPS[8], hidden: true });
      await cardReady(page);
      const cdp = await ctx.newCDPSession(page);
      for (let i = 0; i < 14; i++) {
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 640, y: 400, deltaX: 0, deltaY: 400 });
        await sleep(100);
      }
      const sc = await page.evaluate(SCROLL_STATE);
      rows.push(`(c) 1280×800 휠 14번 docY ${sc.docY}(시트 ${sc.sheetTop}/${sc.sheetMax}, 문서 높이 ${sc.docH}/${sc.vh})`);
      if (sc.docY !== 0) bad.push(`(c) 데스크톱 휠에 문서가 움직임 ${sc.docY}`);
      shots.push(await shot(page, 'A20', 'desktop-1280-after-wheel'));
      await ctx.close();
    }
    // (e) 짧은 카드(시트가 안 넘침)
    {
      const { ctx, page } = await openCard(b, 'noise-present', 'sheet', { vp: { width: 1280, height: 1000 }, hidden: true });
      await cardReady(page);
      const cdp = await ctx.newCDPSession(page);
      const pre = await page.evaluate(SCROLL_STATE);
      for (let i = 0; i < 6; i++) {
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 640, y: 500, deltaX: 0, deltaY: 400 });
        await sleep(100);
      }
      const sc = await page.evaluate(SCROLL_STATE);
      rows.push(`(e) 1280×1000 짧은 카드(시트 ${pre.sheetTop}/${pre.sheetMax}) 휠 6번 docY ${sc.docY}(문서 ${sc.docH}/${sc.vh})`);
      if (sc.docY !== 0) bad.push(`(e) 짧은 시트에서 문서가 움직임 ${sc.docY}`);
      await ctx.close();
    }
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: (bad.length ? bad.join(' / ') + ' || ' : '') + rows.join(' | '), shots };
  },
);

// ------------------------------------------------------------------ A12b 제어 문자 저장
const U = (c) => 'U+' + c.toString(16).toUpperCase().padStart(4, '0');
const LISTED = [0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069, 0xfeff];
const EXTRA = [0x2060, 0x061c, 0x00ad, 0x2028, 0x2029, 0x206a, 0x206d, 0x206f, 0x180e, 0x034f, 0x115f, 0x1160, 0x3164, 0xffa0, 0x0301, 0x200a, 0x00a0, 0x3000];
await run(
  { id: 'A12b', title: '이름·연표에 U+202E·U+200B 등 방향·제로폭 제어 문자가 든 저장 → 첫 화면 정리, 정상 이름·이모지 이름·결합 문자는 그대로 통과', steps: '카드가 대기 중인 저장(tutoring-present)의 character.name·history[].text·title·choice에 목록 15문자(U+200B~200F·202A~202E·2066~2069·FEFF)를 앞·가운데·끝에 넣어 prod 360×740 터치로 연다(60+조합). 대조: 원래 이름·이모지 이름·결합 문자(U+0301)·한글 자모 이름·<script> 이름·21자 이름. 참고 기록: 목록 밖 보이지 않는 글자(U+2060·061C·00AD·2028·3164 등)', expected: '목록 15문자가 든 저장은 모두 첫 화면(title-screen)으로 정리되고 오류 화면·pageerror·경고창 0, 대조 저장은 인생 화면(카드 대기)' },
  async () => {
    const base = load('tutoring-present');
    const mk = (mut) => {
      const s = JSON.parse(JSON.stringify(base));
      mut(s);
      return JSON.stringify({ version: 8, data: s });
    };
    const results = [];
    const bad = [];
    const shots = [];
    const screenOf = async (raw, label) => {
      const { ctx, page } = await openRaw(raw);
      const screen = await page.evaluate(() => ['title-screen', 'roulette-screen', 'birth-screen', 'life-screen', 'ending-screen', 'superseded-screen', 'error-screen'].find((id) => document.querySelector(`[data-testid="${id}"]`)) || 'unknown');
      const saved = await page.evaluate((k) => localStorage.getItem(k) !== null, GAME_KEY);
      const nm = await page.evaluate(() => document.querySelector('[data-testid="life-name"]')?.textContent ?? null);
      const card = await page.evaluate(() => !!document.querySelector('[data-testid="choice-panel"]'));
      const xss = await page.evaluate(() => typeof window.__xss !== 'undefined');
      await ctx.close();
      return { screen, saved, nm, card, xss, label };
    };
    // 목록 15문자
    let nListed = 0;
    for (const c of LISTED) {
      const ch = String.fromCodePoint(c);
      const variants = [
        ['name-front', (s) => (s.character.name = ch + '이시윤')],
        ['name-mid', (s) => (s.character.name = '이' + ch + '시윤')],
        ['name-end', (s) => (s.character.name = '이시윤' + ch)],
        ['history-text', (s) => (s.history[1].text = s.history[1].text.slice(0, 6) + ch + s.history[1].text.slice(6))],
        ['history-title', (s) => (s.history[1].title = ch + s.history[1].title)],
        ['history-choice', (s) => (s.history[2].choice = '한 사람이 ' + ch + '쉬고 돌본다')],
      ];
      for (const [vn, mut] of variants) {
        const r = await screenOf(mk(mut), `${U(c)} ${vn}`);
        nListed++;
        results.push(r);
        if (r.screen !== 'title-screen') bad.push(`${U(c)} ${vn}: 화면 ${r.screen}`);
        if (r.xss) bad.push(`${U(c)} ${vn}: 스크립트 실행`);
      }
    }
    // 이름 전용 한 장 스크린샷(U+202E): 첫 화면 정리
    {
      const { ctx, page } = await openRaw(mk((s) => (s.character.name = '김‮민​준')));
      shots.push(await shot(page, 'A12b', 'rtl-name-cleaned-to-title'));
      await ctx.close();
    }
    // 대조
    const controls = [
      ['정상 이름', (s) => {}],
      ['이모지 이름 😀', (s) => (s.character.name = '이😀윤')],
      ['이모지 단독 🌟', (s) => (s.character.name = '🌟')],
      ['결합 문자 U+0301', (s) => (s.character.name = '이시윤́́')],
      ['한글 자모 이름', (s) => (s.character.name = 'ㅇㅣㅅㅣㅇㅠㄴ')],
      ['<script> 이름', (s) => (s.character.name = '<script>__xss=1;')],
      ['<svg onload> 이름(20자)', (s) => (s.character.name = '<svg onload=__xss=1>')],
      ["SQL꼴 이름", (s) => (s.character.name = "'\"; --")],
      ['20자 이름', (s) => (s.character.name = '가'.repeat(20))],
      ['21자 이름(길이 규칙)', (s) => (s.character.name = '가'.repeat(21))],
      ['연표 이모지·꺾쇠', (s) => (s.history[1].text = '이모지 😀 <b>굵게</b> 입니다.')],
    ];
    const ctl = [];
    for (const [label, mut] of controls) {
      const r = await screenOf(mk(mut), label);
      ctl.push(`${label}→${r.screen}${r.card ? '+카드' : ''}${r.nm ? '「' + r.nm.slice(0, 12) + '」' : ''}`);
      const expectLife = !/21자/.test(label);
      if (expectLife && !(r.screen === 'life-screen' && r.card)) bad.push(`대조 ${label}: 인생 화면이 아님(${r.screen})`);
      if (!expectLife && r.screen !== 'title-screen') bad.push(`대조 ${label}: 길이 규칙이 안 걸림(${r.screen})`);
      if (r.xss) bad.push(`대조 ${label}: 스크립트 실행`);
      if (label === '이모지 이름 😀' || label === '결합 문자 U+0301' || label === 'ㅇㅣ') {
      }
    }
    {
      const { ctx, page } = await openRaw(mk((s) => (s.character.name = '이😀윤')));
      await cardReady(page).catch(() => {});
      shots.push(await shot(page, 'A12b', 'emoji-name-life'));
      await ctx.close();
    }
    // 참고: 목록 밖 글자
    const extra = [];
    for (const c of EXTRA) {
      const ch = String.fromCodePoint(c);
      const r = await screenOf(mk((s) => (s.character.name = '이' + ch + '시윤')), `extra ${U(c)}`);
      extra.push(`${U(c)}→${r.screen === 'life-screen' ? '통과' : r.screen}`);
    }
    // ZWJ 이모지열(👨‍👩‍👧)은 U+200D를 포함 → 목록 문자라 거부되는 것이 규칙대로
    const zwj = await screenOf(mk((s) => (s.character.name = '👨‍👩‍👧')), 'ZWJ 이모지열');
    const verdict = bad.length ? 'FAIL' : 'PASS';
    const extraPass = extra.filter((x) => /통과/.test(x));
    return {
      verdict,
      actual: `${bad.length ? bad.join(' / ') + ' || ' : ''}목록 15문자 × 6위치 = ${nListed}조합 모두 ${results.filter((r) => r.screen === 'title-screen').length}건 첫 화면 정리(저장 남음 ${results.filter((r) => r.saved).length}건은 새 판 저장) | 대조: ${ctl.join(', ')} | ZWJ 이모지열(U+200D 포함) → ${zwj.screen} | 참고(목록 밖 글자가 든 이름은 인생 화면 통과) ${extraPass.length}/${extra.length}: ${extra.join(' ')}`,
      shots,
    };
  },
);

// ------------------------------------------------------------------ A12c 사망 원인(death.cause)의 제어 문자
await run(
  { id: 'A12c', title: '엔딩 저장의 사망 원인(death.cause)에 방향·제로폭 제어 문자 → 첫 화면 정리, 정상 사망 원인은 엔딩 화면', steps: '끝까지 산 저장(phase=ending, death.cause 「병세 악화」)의 death.cause에 목록 15문자를 앞·가운데·끝에 넣어 prod로 연다(45조합). 대조: 원래 값·이모지·결합 문자', expected: '15문자가 든 저장은 모두 첫 화면, 대조 저장은 엔딩 화면, 오류·경고창 0' },
  async () => {
    const base = load('ended-present');
    const mk = (mut) => {
      const s = JSON.parse(JSON.stringify(base));
      mut(s);
      return JSON.stringify({ version: 8, data: s });
    };
    const screenOf = async (raw) => {
      const { ctx, page } = await openRaw(raw);
      const screen = await page.evaluate(() => ['title-screen', 'roulette-screen', 'birth-screen', 'life-screen', 'ending-screen', 'superseded-screen', 'error-screen'].find((id) => document.querySelector(`[data-testid="${id}"]`)) || 'unknown');
      await ctx.close();
      return screen;
    };
    const bad = [];
    let n = 0;
    for (const c of LISTED) {
      const ch = String.fromCodePoint(c);
      for (const [pos, v] of [['front', ch + '병세 악화'], ['mid', '병세' + ch + ' 악화'], ['end', '병세 악화' + ch]]) {
        const sc = await screenOf(mk((s) => (s.death.cause = v)));
        n++;
        if (sc !== 'title-screen') bad.push(`${U(c)} ${pos}: ${sc}`);
      }
    }
    const ctl = [];
    for (const [label, v] of [['원래 값', '병세 악화'], ['이모지', '병세 😀 악화'], ['결합 문자', '병세́ 악화']]) {
      const sc = await screenOf(mk((s) => (s.death.cause = v)));
      ctl.push(`${label}→${sc}`);
      if (sc !== 'ending-screen') bad.push(`대조 ${label}: ${sc}`);
    }
    const { ctx, page } = await openRaw(mk((s) => (s.death.cause = '병세‮ 악화')));
    const sh = await shot(page, 'A12c', 'rtl-cause-cleaned-to-title');
    await ctx.close();
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: (bad.length ? bad.join(' / ') + ' || ' : '') + `${n}조합 중 첫 화면 정리 ${n - bad.filter((x) => !/^대조/.test(x)).length}건 | 대조: ${ctl.join(', ')}`, shots: [sh] };
  },
);

await ctx0.close();
await b.close();
