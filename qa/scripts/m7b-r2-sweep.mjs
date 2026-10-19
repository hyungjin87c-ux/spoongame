// QA-003 M7b 2회차: D-65(.cite 안쪽 여백)·D-66(인용 데이터 문안) 화면 확인 + 카드 90개 전수 훑기(1회차 L04 방식).
//  phase states : 카드(90개) × 세상 = 이벤트 데이터가 허용하는 모든 (카드, 세상)마다 그 카드가 대기 중인 저장을 만든다(조건부 카드는 선택 정책을 바꿔 찾음)
//  phase sweep  : L04 — 360×740 터치 글자 100% · 320×568 글자 200%의 시트: 넘침·낱말 끊김·구분 기호·스크롤로 안내까지 닿음  → r2/sweep.jsonl
//  phase lines  : 연결된 인용 89칸 × 폭 {320, 360} × 글자 {150, 200}% × {시트, 인라인} = 8틀의 인용 박스 줄 모양
//                 (줄 끝 구분 기호·줄 첫머리 마침표/구두점·낱말 끊김·한 줄보다 긴 낱말·고아 줄)                       → r2/lines.jsonl
// 사용: QA_OUT=qa/results/m7b/r2 QA_SHOT_PREFIX=M7b-r2 node qa/scripts/m7b-r2-sweep.mjs <states|sweep|lines|all> [workers=4]
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, OUT, ROOT, mkctx, DEV, findCardState, evalCore } from './m7b-lib.mjs';
import { openCard, VPS, CARD_MEASURE, SEP_AUDIT } from './m7b-audit.mjs';
import { WB_AUDIT } from './m3r2-wb.mjs';

const phase = process.argv[2] || 'all';
const workers = Number(process.argv[3] || 4);
const STATES = path.join(OUT, 'states', 'sweep');
fs.mkdirSync(STATES, { recursive: true });
const ERAS = ['past', 'present', 'future'];

// ---- (카드, 세상) 목록: 이벤트 데이터가 허용하는 모든 칸 ----
const evDir = path.join(ROOT, 'src', 'data', 'events');
const events = [];
for (const f of fs.readdirSync(evDir).filter((f) => f.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(path.join(evDir, f), 'utf8'));
  events.push(...(Array.isArray(j) ? j : j.events || []));
}
const decisions = events.filter((e) => Array.isArray(e.choices) && e.choices.length >= 2);
const pairs = [];
const connected = new Map(); // `${era}|${ev}` → 인용 id
for (const e of decisions) {
  for (const era of e.eras || ERAS) {
    pairs.push({ era, ev: e.id });
    if (e.citation) {
      const id = typeof e.citation === 'string' ? e.citation : e.citation[era];
      if (id) connected.set(`${era}|${e.id}`, id);
    }
  }
}
console.log(`카드 ${decisions.length}개 · 카드×세상 ${pairs.length}칸 · 인용 연결 ${connected.size}칸 (서로 다른 인용 ${new Set(connected.values()).size})`);
const nameOf = (t) => `sw-${t.era}-${t.ev}`;
const CITES = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'citations.json'), 'utf8')).citations;
const fromYearOf = (era, ev) => { const id = connected.get(`${era}|${ev}`); const c = id && CITES.find((x) => x.id === id); return c && c.validFromYear ? c.validFromYear : 0; };
const ONLY_EV = process.env.ONLY_EV || '';
const APPEND = !!process.env.QA_APPEND;

// ---- phase states ----
async function makeStates(browser) {
  const todo = pairs.filter((t) => (!ONLY_EV || t.ev === ONLY_EV) && !fs.existsSync(path.join(STATES, `${nameOf(t)}.json`)));
  console.log('만들 저장', todo.length);
  let idx = 0;
  const miss = [];
  async function w() {
    const ctx = await mkctx(browser);
    const p = await ctx.newPage();
    await p.goto(DEV, { waitUntil: 'load' });
    await p.waitForSelector('[data-testid="title-screen"]');
    while (idx < todo.length) {
      const t = todo[idx++];
      let st = await findCardState(p, t.ev, t.era, { to: 4000 });
      if (!st) {
        for (const pol of ['last', 'mid', 'alt', 'first']) {
          st = await evalCore(
            p,
            `for (let seed = 1; seed < 3500; seed++) {
              let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
              let n = 0;
              for (let guard = 0; guard < 90 && s.phase === 'life'; guard++) {
                s = core.advanceUntilDecision(s).state;
                if (s.phase !== 'life' || s.pending === null) break;
                if (s.pending.eventId === arg.ev && s.pending.choiceIds.length >= 2) return s;
                const ids = s.pending.choiceIds;
                const i = arg.pol === 'last' ? ids.length - 1 : arg.pol === 'mid' ? Math.floor(ids.length / 2) : arg.pol === 'alt' ? (n++ % ids.length) : 0;
                s = core.resolveChoice(s, s.pending.key, ids[i]);
              }
            }
            return null;`,
            { ev: t.ev, era: t.era, pol },
          );
          if (st) break;
        }
      }
      // 지난 세상 통계 인용은 게임 속 연도가 validFromYear 이상이어야 보인다 — 그 연도 이후를 사는 출생 연도로 다시 찾는다
      const need = fromYearOf(t.era, t.ev);
      for (let k = 0; st && need && st.character.birthYear + st.age < need && k < 4; k++) {
        st = await findCardState(p, t.ev, t.era, { to: 6000, minBirth: need - st.age + k });
      }
      if (!st) {
        miss.push(`${t.era}/${t.ev}`);
        continue;
      }
      fs.writeFileSync(path.join(STATES, `${nameOf(t)}.json`), JSON.stringify(st));
    }
    await ctx.close();
  }
  await Promise.all(Array.from({ length: Math.min(workers, 4) }, w));
  console.log('못 찾음', miss.length, miss.join(', '));
  fs.writeFileSync(path.join(OUT, 'sweep-missing-states.json'), JSON.stringify(miss));
}

// ---- 인용 박스 줄 모양(독립 측정) ----
export const LINES_AUDIT = () => {
  const cite = document.querySelector('[data-testid="cite"]');
  if (!cite) return null;
  const linesOf = (el) => {
    const chars = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const pe = n.parentElement;
      if (pe.closest('.sr-only') || pe.closest('[aria-hidden="true"]')) continue;
      const s = n.textContent;
      for (let i = 0; i < s.length; i++) {
        const rg = document.createRange();
        rg.setStart(n, i);
        rg.setEnd(n, i + 1);
        const rs = rg.getClientRects();
        if (!rs.length) continue;
        const r = rs[0];
        chars.push({ ch: s[i], cy: r.top + r.height / 2, h: r.height, l: r.left, r: r.right });
      }
    }
    const lines = [];
    for (const c of chars) {
      let L = lines[lines.length - 1];
      if (!L || Math.abs(c.cy - L.cy) > c.h * 0.5) {
        L = { cy: c.cy, chars: [] };
        lines.push(L);
      }
      L.chars.push(c);
    }
    return lines.map((L) => {
      const vis = L.chars.filter((c) => !/\s/.test(c.ch));
      return { t: L.chars.map((c) => c.ch).join('').trim(), l: Math.round(Math.min(...vis.map((c) => c.l), 1e9)), r: Math.round(Math.max(...vis.map((c) => c.r), -1e9)) };
    });
  };
  const BAD_END = /[·/—(\[~]$/;
  const BAD_START = /^[·/—.,)\]%:;」”’]/;
  const out = { id: cite.getAttribute('data-citation'), parts: {}, issues: [] };
  for (const [tid, label] of [['cite-text', '요약'], ['cite-src', '출처']]) {
    const el = cite.querySelector(`[data-testid="${tid}"]`);
    const cs = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    const innerW = Math.round(box.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    const lines = linesOf(el);
    out.parts[label] = { innerW, lines: lines.map((x) => x.t) };
    lines.forEach((L, i) => {
      const t = L.t;
      if (!t) return;
      if (BAD_END.test(t)) out.issues.push(`${label} ${i + 1}줄 끝 기호 「…${t.slice(-6)}」`);
      if (BAD_START.test(t)) out.issues.push(`${label} ${i + 1}줄 첫머리 기호 「${t.slice(0, 6)}…」`);
      const vis = t.replace(/\s/g, '');
      if (lines.length > 1 && i === lines.length - 1 && vis.length <= 2) out.issues.push(`${label} 마지막 줄 고아 「${t}」`);
      if (L.r > box.right + 1 || L.l < box.left - 1) out.issues.push(`${label} ${i + 1}줄 박스 밖 ${L.l}~${L.r} (박스 ${Math.round(box.left)}~${Math.round(box.right)})`);
    });
  }
  const cr = cite.getBoundingClientRect();
  out.box = { l: Math.round(cr.left), r: Math.round(cr.right), w: Math.round(cr.width) };
  out.vw = document.documentElement.clientWidth;
  if (cr.right > out.vw + 1 || cr.left < -1) out.issues.push(`인용 박스가 화면 밖 ${out.box.l}~${out.box.r}/${out.vw}`);
  const pad = getComputedStyle(cite);
  out.pad = `${pad.paddingTop} ${pad.paddingRight} ${pad.paddingBottom} ${pad.paddingLeft}`;
  return out;
};

const SCOPE = /(decision|cite|choice|fold|impact|sheet|overlay)/;
async function scan(page, mode) {
  // 시트는 0.6화면씩 훑으며 낱말 끊김·구분 기호를 잰다(인라인은 문서 스크롤이라 한 번)
  const wb = { broken: [], unavoidable: [] };
  const sep = [];
  const positions = mode === 'sheet'
    ? await page.evaluate(() => { const sh = document.querySelector('.sheet'); const step = Math.max(40, sh.clientHeight * 0.6); const n = Math.ceil(sh.scrollHeight / step) + 1; return Array.from({ length: n }, (_, i) => Math.min(sh.scrollHeight, Math.round(i * step))); })
    : [null];
  for (const pos of positions) {
    if (pos !== null) await page.evaluate((p) => { document.querySelector('.sheet').scrollTop = p; }, pos);
    await sleep(60);
    const r = await page.evaluate(WB_AUDIT, { intended: ['다이아몬드수저'] });
    for (const b of r.broken) if (SCOPE.test(b.where)) wb.broken.push(`${b.word}(${b.shape})`);
    for (const b of r.unavoidable) if (SCOPE.test(b.where)) wb.unavoidable.push(`${b.word}[${b.natural}>${b.lineW}]`);
    sep.push(...(await page.evaluate(SEP_AUDIT)).bad);
  }
  return { wb, sep };
}

async function runPool(jobs, fn, outFile, label) {
  if (!APPEND) fs.writeFileSync(outFile, '');
  let idx = 0;
  let done = 0;
  const w = async () => {
    while (idx < jobs.length) {
      const j = jobs[idx++];
      let rec;
      try {
        rec = await fn(j);
      } catch (e) {
        rec = { ...j.rec, err: String(e.message).slice(0, 200) };
      }
      fs.appendFileSync(outFile, JSON.stringify(rec) + '\n');
      done++;
      if (done % 25 === 0) console.log(`${label} ${done}/${jobs.length}`);
    }
  };
  await Promise.all(Array.from({ length: workers }, w));
  console.log(`${label} DONE ${done}`);
}

const browser = await launch();
if (phase === 'states' || phase === 'all') await makeStates(browser);

if (phase === 'sweep' || phase === 'all') {
  const jobs = [];
  for (const t of pairs) {
    if (ONLY_EV && t.ev !== ONLY_EV) continue;
    if (!fs.existsSync(path.join(STATES, `${nameOf(t)}.json`))) continue;
    for (const [vp, font, tag] of [[VPS[2], 100, '360x740@100'], [VPS[0], 200, '320x568@200']]) jobs.push({ t, vp, font, rec: { era: t.era, ev: t.ev, cfg: tag } });
  }
  await runPool(
    jobs,
    async (j) => {
      const { ctx, page } = await openCard(browser, `sweep/${nameOf(j.t)}`, 'sheet', { vp: j.vp, font: j.font, hidden: true });
      const m = await page.evaluate(CARD_MEASURE);
      const { wb, sep } = await scan(page, 'sheet');
      const nCh = await page.evaluate(() => document.querySelectorAll('.choice').length);
      const hasCite = await page.evaluate(() => !!document.querySelector('[data-testid="cite"]'));
      await ctx.close();
      return { ...j.rec, m, wb, sep, nCh, hasCite };
    },
    path.join(OUT, 'sweep.jsonl'),
    '훑기',
  );
}

if (phase === 'lines' || phase === 'all') {
  const jobs = [];
  for (const [k, cid] of connected) {
    const [era, ev] = k.split('|');
    if (ONLY_EV && ev !== ONLY_EV) continue;
    if (!fs.existsSync(path.join(STATES, `${nameOf({ era, ev })}.json`))) continue;
    for (const [w, h] of [[320, 568], [360, 740]]) for (const font of [150, 200]) for (const mode of ['sheet', 'inline']) {
      jobs.push({ era, ev, cid, w, h, font, mode, rec: { era, ev, cid, cfg: `${w}@${font}-${mode}` } });
    }
  }
  console.log('줄 모양 측정', jobs.length);
  await runPool(
    jobs,
    async (j) => {
      const vp = { name: `${j.w}x${j.h}`, width: j.w, height: j.h, touch: j.w === 360 };
      const { ctx, page } = await openCard(browser, `sweep/${nameOf(j)}`, j.mode, { vp, font: j.font, hidden: true });
      const lines = await page.evaluate(LINES_AUDIT);
      const { wb, sep } = await scan(page, j.mode);
      const doc = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      await ctx.close();
      return { ...j.rec, lines, wb, sep, docOverflow: doc };
    },
    path.join(OUT, 'lines.jsonl'),
    '줄 모양',
  );
}
await browser.close();
