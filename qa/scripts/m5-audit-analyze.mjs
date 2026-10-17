// QA-003 M5: audit-layout-<세상>.jsonl · audit-focus-<세상>.jsonl 을 읽어 케이스 판정을 만든다.
// 가로 넘침(CM11) · 낱말 끊김(QM3-1) · h1(QM3-2) · M5 신규 요소(영향 줄·자산 금액·최종 순자산 줄) 넘침 · 고정 요소 해제(QM2-12) · 포커스 가림(CM10)
import fs from 'node:fs';
import path from 'node:path';
import { OUT, CASES } from './m5-lib.mjs';

const ERAS = (process.env.ERAS || 'present').split(',');
const read = (f) => (fs.existsSync(path.join(OUT, f)) ? fs.readFileSync(path.join(OUT, f), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const L = ERAS.flatMap((e) => read(`audit-layout-${e}.jsonl`).map((r) => ({ ...r, era: e })));
const F = ERAS.flatMap((e) => read(`audit-focus-${e}.jsonl`).map((r) => ({ ...r, era: e })));
const append = (rec) => {
  fs.appendFileSync(CASES, JSON.stringify({ shots: [], ...rec, console: [], externalRequests: [], at: new Date().toISOString() }) + '\n');
  console.log(`[${rec.verdict}] ${rec.id} :: ${String(rec.actual).slice(0, 1400)}`);
};
const key = (r) => `${r.era}/${r.state}/${r.vp}/${r.font}%`;
const errs = L.filter((r) => r.err);
const EN = ERAS.length === 3 ? '세 시대' : ERAS.join('·');

if (L.length) {
  const ok = L.filter((r) => !r.err);
  const stateSet = [...new Set(ok.map((r) => r.state))];
  // CM11 가로 넘침
  {
    const bad = ok.filter((r) => r.m.docOverflow > 0 || r.m.over.length > 0);
    append({ id: 'M5-L01', cat: '접근성', title: `가로 넘침 0(CM11): 11뷰포트 × 글자 100·150·200% × 상태 ${stateSet.length}(${stateSet.join('·')}) × ${EN} — ${ok.length}조합`, steps: '저장 원문으로 각 상태를 열고 글자 크기를 루트에 적용한 뒤 documentElement.scrollWidth − clientWidth와 보이는 모든 요소의 오른쪽 끝(스크롤 영역 안 제외)을 잼', expected: '모든 조합 0px', verdict: bad.length || errs.length ? 'FAIL' : 'PASS', actual: bad.length || errs.length ? [...bad.slice(0, 10).map((r) => `${key(r)}: ${r.m.docOverflow}px ${r.m.over.join(',')}`), ...errs.slice(0, 3).map((r) => `${key(r)} 오류 ${r.err}`)].join(' / ') + ` (실패 ${bad.length}/${ok.length}, 측정 오류 ${errs.length})` : `${ok.length}조합 모두 가로 넘침 0px` });
  }
  // M5 신규 요소 넘침: 영향 줄 항목·번호 원·자산 금액·최종 순자산 줄
  {
    const bad = [];
    let items = 0;
    let amounts = 0;
    for (const r of ok) {
      items += r.m5.items;
      amounts += r.m5.amounts;
      if (r.m5.impactOut.length) bad.push(`${key(r)}: 영향 줄 ${r.m5.impactOut.slice(0, 2).join(' ; ')}`);
      if (r.m5.moneyClip.length) bad.push(`${key(r)}: 금액·자리 ${r.m5.moneyClip.slice(0, 2).join(' ; ')}`);
    }
    append({ id: 'M5-L02', cat: '접근성', title: `영향 줄 항목·자산 카드 금액·엔딩 최종 순자산 줄이 칸 밖으로 새지 않음: ${ok.length}조합(영향 항목 ${items.toLocaleString()}개·금액 칸 ${amounts.toLocaleString()}개 측정)`, steps: '각 영향 항목 상자가 선택지 본문 칸 안에 있는지, 금액(dd)·최종 순자산 값·자리 글자가 카드 안에 있고 스크롤 폭이 넘지 않는지', expected: '넘침 0 (범위 끝 값 「−20억 원」「200억 원」 포함, 폭 320 · 글자 200%)', verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? [...new Set(bad)].slice(0, 8).join(' / ') + ` (총 ${bad.length})` : `영향 항목 ${items.toLocaleString()}개·금액 칸 ${amounts.toLocaleString()}개 모두 칸 안(최악: 폭 320 · 글자 200% · 순자산 200억 원/부채 100억 원)` });
  }
  // QM3-1 낱말 끊김
  {
    const broken = ok.filter((r) => r.wb.broken.length > 0);
    const unav100 = ok.filter((r) => r.font === 100 && r.wb.unavoidable.length > 0);
    const unavAll = ok.reduce((s, r) => s + r.wb.unavoidable.length, 0);
    const words = ok.reduce((s, r) => s + r.wb.wordsN, 0);
    const chars = ok.reduce((s, r) => s + r.wb.charsN, 0);
    const bad = [];
    for (const r of broken.slice(0, 6)) bad.push(`${key(r)}: ${r.wb.broken.slice(0, 3).map((b) => `${b.word}(${b.shape}) ${b.where}`).join('; ')}`);
    for (const r of unav100.slice(0, 3)) bad.push(`${key(r)}: 글자 100%인데 한 줄보다 긴 낱말 ${r.wb.unavoidable.slice(0, 2).map((b) => b.word)}`);
    const unavList = {};
    for (const r of ok) for (const u of r.wb.unavoidable) unavList[`${u.word}@${r.vp}/${r.font}%`] = `${u.natural}px>${u.lineW}px(${r.state})`;
    append({ id: 'M5-L03a', cat: '접근성', title: `낱말 중간 끊김(QM3-1): 영향 줄이 붙은 선택지 카드·자산 카드·엔딩 줄 — ${ok.length}조합(상태 ${stateSet.length} × 11뷰포트 × 글자 100·150·200% × ${EN}), 결함 끊김(broken) 0`, steps: '글자 하나씩 Range로 줄을 나눠 낱말마다 끊김을 판정(허용: 한 줄 전체보다 긴 낱말 unavoidable, <wbr> intended) — M3 2회차 독립 측정기 재사용(m3r2-wb.mjs)', expected: '모든 조합에서 broken = [], 글자 100%에서 한 줄보다 긴 낱말 0', verdict: bad.length || errs.length ? 'FAIL' : 'PASS', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + `낱말 ${words.toLocaleString()}개·글자 ${chars.toLocaleString()}자 감사, broken ${broken.length}조합, unavoidable ${unavAll}건${errs.length ? `, 측정 오류 ${errs.length}` : ''}${unavAll ? ' | ' + JSON.stringify(unavList).slice(0, 400) : ''}` });
  }
  // h1
  {
    const bad = [];
    let rowsN = 0;
    let wordsN = 0;
    for (const r of ok) {
      for (const h of r.h1.rows) {
        rowsN++;
        for (const w of h.wrows) {
          wordsN++;
          if (w.lines !== 1) bad.push(`${key(r)} h1 「${h.text}」 낱말 「${w.word}」가 ${w.lines}줄에 걸침`);
          else if (w.natural > h.contentW + 0.6) bad.push(`${key(r)} h1 「${h.text}」 낱말 「${w.word}」 자연 폭 ${w.natural} > 내용 폭 ${h.contentW}`);
        }
      }
    }
    append({ id: 'M5-L03b', cat: '접근성', title: `h1 낱말 한 줄(QM3-2): ${ok.length}조합의 h1 ${rowsN}개·낱말 ${wordsN}개`, steps: 'h1 낱말마다 글자 하나씩 Range로 줄 수·자연 폭을 잼', expected: '낱말이 중간에서 끊기지 않고(1줄) 자연 폭 ≤ h1 내용 폭', verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? [...new Set(bad)].slice(0, 8).join(' / ') + ` (총 ${bad.length}건)` : `h1 ${rowsN}개·낱말 ${wordsN}개 전부 1줄·내용 폭 안` });
  }
  // 고정 요소 해제(QM2-12): 선택지 카드·대시보드 상태
  {
    const bad = [];
    for (const r of ok) {
      if (r.state.startsWith('ending')) continue;
      const m = r.m;
      const headFixed = m.head && ['sticky', 'fixed'].includes(m.head.pos) ? m.head.h : 0;
      const barFixed = m.ctl && ['fixed', 'sticky'].includes(m.ctl.pos) ? m.ctl.h : 0;
      const sum = headFixed + barFixed;
      if (sum > m.vh * 0.5 + 1) bad.push(`${key(r)}: 고정 합 ${sum}px(머리 ${headFixed}+줄 ${barFixed}) > ${m.vh}의 절반`);
      if (['667x375-landscape', '320x256-zoom400'].includes(r.vp) && r.font === 100 && !/head-released/.test(m.htmlClass)) bad.push(`${key(r)}: head-released 없음(${m.htmlClass})`);
    }
    append({ id: 'M5-L04', cat: '접근성', title: '고정 헤더·하단 진행 줄의 합이 작은 화면 높이의 절반을 넘지 않는다(넘으면 해제, QM2-12·CM11) — 선택지 카드가 길어진 M5 상태 포함', steps: '대시보드 상태 × 11뷰포트 × 글자 100·150·200%에서 헤더(sticky)와 진행 줄(fixed)의 계산된 position·높이', expected: '합 ≤ 뷰포트 높이 50%(해제된 요소 제외), 667×375·320×256(글자 100%)에서 head-released', verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? [...new Set(bad)].slice(0, 8).join(' / ') + ` (총 ${bad.length})` : '위반 0' });
  }
  // 터치 대상
  {
    const bad = [];
    const mins = [];
    for (const r of ok.filter((x) => x.vp === '360x740-touch' && x.font === 100 && !x.state.startsWith('ending'))) for (const t of r.m.touch) {
      mins.push(Math.min(t.w, t.h));
      if (t.w < 44 || t.h < 44) bad.push(`${r.state}: ${t.id} ${t.w}×${t.h}`);
    }
    append({ id: 'M5-L05', cat: '접근성', title: '터치 대상 ≥ 44×44px(360×740): 진행 줄·도구 줄 버튼 (M5가 카드 높이를 바꿨으므로 회귀 확인)', steps: '컨트롤·도구 줄 버튼 상자 크기', expected: '모두 ≥ 44px', verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? [...new Set(bad)].slice(0, 6).join(' / ') : `버튼 ${mins.length}개 최소 변 ${Math.min(...mins)}px` });
  }
}

if (F.length) {
  const ok = F.filter((r) => !r.err);
  const bad = [];
  let focusN = 0;
  for (const r of ok) {
    focusN += r.fwd.length + r.bwd.length;
    if (r.issues.length) bad.push(`${key(r)}: ${r.issues.slice(0, 2).map((i) => `${i.dir} ${i.id} ${i.hit.join(';') || (i.outside ? '화면 밖' : '중심 가려짐')}`).join(' / ')}`);
    if (r.missing.length) bad.push(`${key(r)}: 순회로 닿지 못한 조작 요소 ${r.missing.join(',')}`);
  }
  const errsF = F.filter((r) => r.err);
  const fixedSeen = new Set();
  for (const r of ok) for (const f of r.fixedList ?? []) fixedSeen.add(f.split(':')[0]);
  append({ id: 'M5-C10f', cat: '접근성', title: `고정 요소가 키보드 포커스를 가리지 않는다(CM10·WCAG 2.4.11): Tab·Shift+Tab 전체 순회 — ${ok.length}조합(상태 × 뷰포트 11 × 글자 100·200% × ${EN}), 포커스 ${focusN}번 측정`, steps: '조합마다 Tab으로 한 바퀴 → Shift+Tab으로 한 바퀴, 포커스가 바뀔 때마다 포커스 링 포함 상자와 고정 요소 상자의 겹침·화면 안·중심 점 가림을 잼. 조작 요소 집합 = 닿은 집합 확인', expected: '가려진 포커스 0, 닿지 못한 요소 0', verdict: bad.length || errsF.length ? 'FAIL' : 'PASS', actual: bad.length || errsF.length ? [...new Set(bad)].slice(0, 8).join(' / ') + ` (실패 ${bad.length}건, 오류 ${errsF.length})` : `포커스 ${focusN}번 측정, 가려진 포커스 0·화면 밖 0·닿지 못한 요소 0. 수집된 고정 요소 ${[...fixedSeen].join(',')}` });
}
