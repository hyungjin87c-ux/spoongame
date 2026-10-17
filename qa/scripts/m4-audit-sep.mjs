// QA-003 M4 줄바꿈 감사(QM2-5·QM2-10): 줄 끝·첫머리에 혼자 남은 구분 기호(·/—()), 갈라진 숫자+단위. 대시보드·엔딩·밀린·오류 화면.
// 사용: node qa/scripts/m4-audit-sep.mjs   결과: qa/results/m4/audit-sep.jsonl + 케이스 M4-L03
import fs from 'node:fs';
import path from 'node:path';
import { launch, OUT, CASES } from './m4-lib.mjs';
import { openState, VPS } from './m4-states.mjs';

const outFile = path.join(OUT, 'audit-sep.jsonl');
fs.writeFileSync(outFile, '');
const STATES = ['infant', 'age30', 'pending', 'exit-ask', 'tools-open', 'ending', 'superseded'];
const VPN = ['320x568', '360x740-touch', '667x375-landscape', '1280x800'];
const FONTS = [100, 150, 200];

const SEP_AUDIT = () => {
  const csOf = (e) => getComputedStyle(e);
  const isInline = (d) => d === 'inline' || d === 'contents';
  const hiddenEl = (e) => {
    for (let x = e; x && x !== document.documentElement; x = x.parentElement) {
      const cs = csOf(x);
      if (cs.display === 'none') return true;
      if (x === e && cs.visibility === 'hidden') return true;
      if (x.namespaceURI === 'http://www.w3.org/2000/svg') return true;
      if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(x.tagName)) return true;
      if (x !== document.body) {
        const r = x.getBoundingClientRect();
        const clipping = cs.overflow !== 'visible' || (cs.clip && cs.clip !== 'auto');
        if (clipping && (r.width <= 1.5 || r.height <= 1.5)) return true;
      }
    }
    return false;
  };
  const blockOf = (el) => {
    let b = el;
    while (b && b.parentElement && isInline(csOf(b).display)) b = b.parentElement;
    return b;
  };
  const clippedOut = (el, r) => {
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    for (let x = el; x && x !== document.documentElement; x = x.parentElement) {
      if (x === document.body) break;
      const cs = csOf(x);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const b = x.getBoundingClientRect();
      if (cx < b.left - 1 || cx > b.right + 1 || cy < b.top - 1 || cy > b.bottom + 1) return true;
    }
    return false;
  };
  const blocks = new Map();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    if (!n.textContent) continue;
    const pe = n.parentElement;
    if (!pe || hiddenEl(pe)) continue;
    const b = blockOf(pe);
    if (!blocks.has(b)) blocks.set(b, []);
    blocks.get(b).push({ node: n, pe });
  }
  const issues = [];
  let linesN = 0;
  let charsN = 0;
  let unitN = 0;
  const label = (b) => `${b.tagName.toLowerCase()}${b.getAttribute('data-testid') ? '[' + b.getAttribute('data-testid') + ']' : typeof b.className === 'string' && b.className ? '.' + b.className.split(' ')[0] : ''}`;
  for (const [blk, items] of blocks) {
    const chars = [];
    for (const it of items) {
      const s = it.node.textContent;
      for (let i = 0; i < s.length; i++) {
        const rg = document.createRange();
        rg.setStart(it.node, i);
        rg.setEnd(it.node, i + 1);
        const rects = rg.getClientRects();
        const r = rects[0];
        if (!r || (r.width < 0.2 && s[i] !== ' ') || clippedOut(it.pe, r)) {
          chars.push({ ch: s[i], skip: true });
          continue;
        }
        chars.push({ ch: s[i], cy: r.top + r.height / 2, h: r.height, x: r.left, skip: /\s/.test(s[i]) });
      }
    }
    const vis = chars.filter((c) => !c.skip);
    if (!vis.length) continue;
    charsN += vis.length;
    // 줄로 나누기(글자 순서대로, cy가 크게 달라지면 새 줄)
    const lines = [];
    let cur = [vis[0]];
    for (let i = 1; i < vis.length; i++) {
      if (Math.abs(vis[i].cy - cur[cur.length - 1].cy) > 0.5 * Math.max(vis[i].h, cur[cur.length - 1].h)) {
        lines.push(cur);
        cur = [];
      }
      cur.push(vis[i]);
    }
    lines.push(cur);
    linesN += lines.length;
    if (lines.length > 1) {
      for (let li = 0; li < lines.length; li++) {
        const L = lines[li];
        const last = L[L.length - 1].ch;
        const first = L[0].ch;
        const text = L.map((c) => c.ch).join('');
        if (/[·/—(]/.test(last)) issues.push({ kind: '줄끝 기호', ch: last, line: text.slice(-14), where: label(blk) });
        if (/[·/—),.]/.test(first) && !/^\.\d/.test(text)) issues.push({ kind: '줄머리 기호', ch: first, line: text.slice(0, 14), where: label(blk) });
      }
    }
    // 숫자+단위가 같은 줄에 있는가
    const flat = vis.map((c) => c.ch).join('');
    const re = /\d[\d,.]*\s?(%|명|건|세|년|월|일|시|kg|원|배)/g;
    let m;
    // vis에는 공백이 빠져 있으니 공백 없이 대조
    const re2 = /\d[\d,.]*(%|명|건|세|년|월|일|시|kg|원|배)/g;
    while ((m = re2.exec(flat))) {
      unitN++;
      const slice = vis.slice(m.index, m.index + m[0].length);
      const tops = new Set(slice.map((c) => Math.round(c.cy / 4)));
      if (tops.size > 1 && Math.max(...slice.map((c) => c.cy)) - Math.min(...slice.map((c) => c.cy)) > 0.5 * slice[0].h) issues.push({ kind: '숫자·단위 갈라짐', ch: m[0], line: m[0], where: label(blk) });
    }
  }
  return { linesN, charsN, unitN, issues };
};

const browser = await launch();
const jobs = [];
for (const st of STATES) for (const vpn of VPN) for (const font of FONTS) jobs.push({ st, vp: VPS.find((v) => v.name === vpn), font });
let idx = 0;
async function worker() {
  while (idx < jobs.length) {
    const j = jobs[idx++];
    const rec = { state: j.st, vp: j.vp.name, font: j.font };
    try {
      const { ctx, page } = await openState(browser, j.st, { vp: j.vp, font: j.font });
      rec.r = await page.evaluate(SEP_AUDIT);
      await ctx.close();
    } catch (e) {
      rec.err = String(e.message).slice(0, 200);
    }
    fs.appendFileSync(outFile, JSON.stringify(rec) + '\n');
  }
}
await Promise.all(Array.from({ length: 3 }, worker));
await browser.close();

const L = fs.readFileSync(outFile, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const ok = L.filter((r) => !r.err);
const bad = ok.filter((r) => r.r.issues.length);
const lines = ok.reduce((s, r) => s + r.r.linesN, 0);
const chars = ok.reduce((s, r) => s + r.r.charsN, 0);
const units = ok.reduce((s, r) => s + r.r.unitN, 0);
const rec = {
  id: 'M4-L03',
  cat: '접근성',
  title: `줄 끝·줄머리에 혼자 남는 구분 기호 0·갈라진 숫자+단위 0(QM2-5·QM2-10): 대시보드·엔딩·밀린 화면 — ${ok.length}조합(상태 7 × 폭 4 × 글자 100·150·200%)`,
  steps: '글자 하나씩 Range로 줄을 나눠 줄 마지막 글자가 ·/—( 인 줄, 줄 첫 글자가 ·/—),. 인 줄, 숫자와 단위가 다른 줄에 놓인 곳을 센다',
  expected: '모두 0',
  verdict: bad.length || L.some((r) => r.err) ? 'FAIL' : 'PASS',
  severity: '중간',
  actual: (bad.length ? bad.slice(0, 6).map((r) => `${r.state}/${r.vp}/${r.font}%: ${r.r.issues.slice(0, 2).map((i) => `${i.kind} 「${i.line}」 ${i.where}`).join('; ')}`).join(' / ') + ` (실패 ${bad.length}조합) | ` : '') + `줄 ${lines.toLocaleString()}개·글자 ${chars.toLocaleString()}자·숫자+단위 ${units.toLocaleString()}곳 감사${L.some((r) => r.err) ? `, 측정 오류 ${L.filter((r) => r.err).length}` : ''}`,
  shots: [],
  console: [],
  externalRequests: [],
  at: new Date().toISOString(),
};
fs.appendFileSync(CASES, JSON.stringify(rec) + '\n');
console.log(`[${rec.verdict}] ${rec.id} :: ${rec.actual.slice(0, 1500)}`);
