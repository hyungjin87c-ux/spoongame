// QA-003 M4: audit-layout.jsonl·audit-focus.jsonl을 읽어 케이스 판정(CM11 넘침·QM3-1 낱말 끊김·QM3-2 제목·CM10 고정 요소·포커스)을 만든다.
import fs from 'node:fs';
import path from 'node:path';
import { OUT, CASES } from './m4-lib.mjs';

const read = (f) => (fs.existsSync(path.join(OUT, f)) ? fs.readFileSync(path.join(OUT, f), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const L = read('audit-layout.jsonl');
const F = read('audit-focus.jsonl');
const append = (rec) => {
  fs.appendFileSync(CASES, JSON.stringify({ ...rec, console: [], externalRequests: [], at: new Date().toISOString() }) + '\n');
  console.log(`[${rec.verdict}] ${rec.id} :: ${String(rec.actual).slice(0, 1200)}`);
};
const key = (r) => `${r.state}/${r.vp}/${r.font}%`;
const errs = L.filter((r) => r.err);

if (L.length) {
  const ok = L.filter((r) => !r.err);
  // CM11 가로 넘침
  {
    const bad = ok.filter((r) => r.m.docOverflow > 0 || r.m.over.length > 0);
    append({ id: 'M4-C11', cat: '접근성', title: `가로 넘침 0(CM11): 11뷰포트 × 글자 100·150·200% × 상태 10(대시보드 영아·10세·30세·78세·선택지 카드·나가기 확인·도구 열림·엔딩·밀린 화면·오류 화면) — ${ok.length}조합`, steps: '저장 원문으로 각 상태를 열고 글자 크기를 루트에 적용한 뒤 documentElement.scrollWidth − clientWidth와 보이는 모든 요소의 오른쪽 끝(스크롤 영역 안 제외)을 잼', expected: '모든 조합 0px, 뷰포트 밖으로 나간 요소 0', verdict: bad.length || errs.length ? 'FAIL' : 'PASS', severity: '높음', actual: bad.length || errs.length ? [...bad.slice(0, 10).map((r) => `${key(r)}: ${r.m.docOverflow}px ${r.m.over.join(',')}`), ...errs.slice(0, 3).map((r) => `${key(r)} 오류 ${r.err}`)].join(' / ') + ` (실패 ${bad.length}/${ok.length}, 측정 오류 ${errs.length})` : `${ok.length}조합 모두 가로 넘침 0px`, shots: [] });
  }
  // QM3-1 낱말 끊김
  {
    const broken = ok.filter((r) => r.wb.broken.length > 0);
    const unav100 = ok.filter((r) => r.font === 100 && r.wb.unavoidable.length > 0);
    const unavAll = ok.reduce((s, r) => s + r.wb.unavoidable.length, 0);
    const words = ok.reduce((s, r) => s + r.wb.wordsN, 0);
    const chars = ok.reduce((s, r) => s + r.wb.charsN, 0);
    const inten = ok.reduce((s, r) => s + r.wb.intended, 0);
    const cats = {};
    for (const r of ok) for (const [k, v] of Object.entries(r.wb.cats)) cats[k] = (cats[k] ?? 0) + v;
    const bad = [];
    for (const r of broken.slice(0, 6)) bad.push(`${key(r)}: ${r.wb.broken.slice(0, 3).map((b) => `${b.word}(${b.shape}) ${b.where}`).join('; ')}`);
    for (const r of unav100.slice(0, 3)) bad.push(`${key(r)}: 글자 100%인데 한 줄보다 긴 낱말 ${r.wb.unavoidable.slice(0, 2).map((b) => b.word)}`);
    const unavList = {};
    for (const r of ok) for (const u of r.wb.unavoidable) unavList[`${u.word}@${r.vp}/${r.font}%`] = `${u.natural}px>${u.lineW}px(${r.state})`;
    append({ id: 'M4-L02', cat: '접근성', title: `낱말 중간 끊김(QM3-1): 대시보드·엔딩·밀린·오류·확인 단계·도구 열림 — 11뷰포트 × 글자 100·150·200% × 상태 10 = ${ok.length}조합, 결함 끊김(broken) 0·글자 100% 한 줄보다 긴 낱말 0`, steps: '글자 하나씩 Range로 줄을 나눠 낱말마다 끊김을 판정(허용: 한 줄 전체보다 긴 낱말은 unavoidable, <wbr> 「다이아몬드수저」는 intended) — QA 독립 측정기(m3r2-wb.mjs 판정식 재사용)', expected: '모든 조합에서 broken = []', verdict: bad.length || errs.length ? 'FAIL' : 'PASS', severity: '중간', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + `낱말 ${words.toLocaleString()}개·글자 ${chars.toLocaleString()}자 감사, broken ${broken.length}조합, unavoidable(한 줄보다 긴 낱말) ${unavAll}건, intended(wbr) ${inten}건, 감사 범주 ${JSON.stringify(cats)}${errs.length ? `, 측정 오류 ${errs.length}` : ''}${unavAll ? ' | unavoidable 목록 ' + JSON.stringify(unavList).slice(0, 500) : ''}`, shots: [] });
  }
  // QM3-2 h1
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
    append({ id: 'M4-T01', cat: '접근성', title: `h1 낱말 한 줄(QM3-2): 대시보드 이름·엔딩 「{이름}의 인생」·밀린·오류 메시지 — ${ok.length}조합의 h1 ${rowsN}개·낱말 ${wordsN}개`, steps: 'h1 낱말마다 글자 하나씩 Range로 줄 수·자연 폭을 잼', expected: '낱말이 중간에서 끊기지 않고(1줄) 자연 폭 ≤ h1 내용 폭, 글자 200%·폭 320에서도', verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: bad.length ? [...new Set(bad)].slice(0, 8).join(' / ') + ` (총 ${bad.length}건)` : `h1 ${rowsN}개·낱말 ${wordsN}개 전부 1줄·내용 폭 안(폭 320 · 글자 200% 포함)`, shots: [] });
    // 제목 ≥ 본문 (참고)
    const titleSmaller = [];
    for (const r of ok) for (const h of r.h1.rows) if (h.fs + 0.1 < r.h1.maxBodyFs && /의 인생|바뀌었|문제가 생겼/.test(h.text)) titleSmaller.push(`${key(r)} 「${h.text.slice(0, 12)}」 ${h.fs}px < 본문 최대 ${r.h1.maxBodyFs}px`);
    append({ id: 'M4-T02', cat: '접근성', title: '제목 글자 크기 ≥ 같은 화면 본문 문단 최대 글자(QM3-2 규칙 3) — 엔딩·밀린·오류 h1 (대시보드 이름은 본문 크기가 기본이라 제외)', steps: 'H1_AUDIT의 제목·본문 계산 글자 크기 비교', expected: '제목 ≥ 본문', verdict: titleSmaller.length ? 'FAIL' : 'PASS', severity: '낮음', actual: titleSmaller.length ? [...new Set(titleSmaller)].slice(0, 6).join(' / ') + ` (총 ${titleSmaller.length})` : '엔딩·밀린·오류 h1 전 조합에서 제목 ≥ 본문', shots: [] });
  }
  // CM10 고정 요소 해제(QM2-12·head-released)
  {
    const bad = [];
    const rows = [];
    for (const r of ok) {
      if (!['infant', 'age30', 'pending', 'exit-ask', 'tools-open'].includes(r.state)) continue;
      const m = r.m;
      const headFixed = m.head && ['sticky', 'fixed'].includes(m.head.pos) ? m.head.h : 0;
      const barFixed = m.ctl && ['fixed', 'sticky'].includes(m.ctl.pos) ? m.ctl.h : 0;
      const sum = headFixed + barFixed;
      if (sum > m.vh * 0.5 + 1) bad.push(`${key(r)}: 고정 합 ${sum}px(머리 ${headFixed}+줄 ${barFixed}) > ${m.vh}의 절반`);
      if (['667x375-landscape', '320x256-zoom400'].includes(r.vp) && r.font === 100 && !/head-released/.test(m.htmlClass)) bad.push(`${key(r)}: head-released 없음(${m.htmlClass})`);
      if (r.state === 'infant' && r.font === 100) rows.push(`${r.vp}: 머리 ${m.head?.pos} ${m.head?.h} · 진행 줄 ${m.ctl?.pos} ${m.ctl?.h} · ${m.htmlClass.replace(/has-/g, '')}`);
    }
    append({ id: 'M4-C10r', cat: '접근성', title: '고정 헤더·하단 진행 줄: 고정 요소 합이 작은 화면 높이의 절반을 넘지 않는다(넘으면 해제 — 667×375·320×256에서 head-released)', steps: '대시보드 상태 5종 × 11뷰포트 × 글자 100·150·200%에서 헤더(sticky)와 진행 줄(fixed)의 계산된 position·높이로 합을 재고 html 클래스 확인', expected: '합 ≤ 뷰포트 높이 50%(해제된 요소는 제외), 667×375·320×256(글자 100%)에서 head-released', verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: bad.length ? [...new Set(bad)].slice(0, 8).join(' / ') + ` (총 ${bad.length})` : `조건 위반 0. 영아 글자 100%: ${rows.join(' | ')}`, shots: [] });
  }
  // DB3 터치 대상
  {
    const bad = [];
    const c = ok.filter((r) => r.vp === '360x740-touch' && r.font === 100 && ['infant', 'age30', 'exit-ask', 'tools-open'].includes(r.state));
    const mins = [];
    for (const r of c) for (const t of r.m.touch) {
      mins.push(Math.min(t.w, t.h));
      if (t.w < 44 || t.h < 44) bad.push(`${r.state}: ${t.id} ${t.w}×${t.h}`);
    }
    append({ id: 'M4-D3t', cat: '접근성', title: '터치 대상 ≥ 44×44px(DB3): 360×740 터치, 진행 줄·도구 줄·확인 단계 버튼', steps: '컨트롤·도구 줄·나가기 확인 단계 버튼의 상자 크기', expected: '모두 폭·높이 ≥ 44px', verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: bad.length ? [...new Set(bad)].slice(0, 8).join(' / ') : `버튼 ${mins.length}개 최소 변 ${Math.min(...mins)}px`, shots: [] });
  }
  // DS1 로고 크기
  {
    const bad = [];
    const logos = [];
    for (const r of ok) {
      if (!r.m.logoH) {
        bad.push(`${key(r)}: 헤더 로고 없음`);
        continue;
      }
      logos.push(r.m.logoH.h);
      if (r.m.logoH.h < 22) bad.push(`${key(r)}: 로고 높이 ${r.m.logoH.h}px < 22`);
    }
    append({ id: 'M4-D1l', cat: '접근성', title: `공통 헤더 로고(DS1): 대시보드·엔딩·밀린·오류 화면 모두 게임명 로고가 있고 높이 ≥ 22px(상자 기준) — ${ok.length}조합`, steps: '헤더 안 role=img 로고의 렌더 높이', expected: '모든 조합에서 있음·≥ 22px', verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: bad.length ? [...new Set(bad)].slice(0, 6).join(' / ') : `로고 높이 최소 ${Math.min(...logos)}px·최대 ${Math.max(...logos)}px(상자)`, shots: [] });
  }
}

if (F.length) {
  const ok = F.filter((r) => !r.err);
  const bad = [];
  let focusN = 0;
  let missingN = 0;
  for (const r of ok) {
    focusN += r.fwd.length + r.bwd.length;
    if (r.issues.length) bad.push(`${key(r)}: ${r.issues.slice(0, 2).map((i) => `${i.dir} ${i.id} ${i.hit.join(';') || (i.outside ? '화면 밖' : '중심 가려짐')}`).join(' / ')}`);
    if (r.missing.length) {
      missingN++;
      bad.push(`${key(r)}: 순회로 닿지 못한 조작 요소 ${r.missing.join(',')}`);
    }
  }
  const errsF = F.filter((r) => r.err);
  const fixedSeen = new Set();
  for (const r of ok) for (const f of r.fixedList ?? []) fixedSeen.add(f.split(':')[0]);
  append({ id: 'M4-C10f', cat: '접근성', title: `고정 요소가 키보드 포커스를 가리지 않는다(CM10·WCAG 2.4.11): Tab·Shift+Tab 전체 순회 — ${ok.length}조합(상태 6 × 뷰포트 11 × 글자 100·200%), 포커스 ${focusN}번 측정`, steps: '조합마다 Tab으로 한 바퀴 → Shift+Tab으로 한 바퀴, 포커스가 바뀔 때마다 포커스 링 포함 상자와 고정 요소 상자의 겹침·화면 안·중심 점 가림을 잼. 조작 요소 집합 = 닿은 집합 확인', expected: '가려진 포커스 0, 닿지 못한 요소 0', verdict: bad.length || errsF.length ? 'FAIL' : 'PASS', severity: '높음', actual: bad.length || errsF.length ? [...new Set(bad)].slice(0, 8).join(' / ') + ` (실패 ${bad.length}건, 오류 ${errsF.length})` : `포커스 ${focusN}번 측정, 가려진 포커스 0·화면 밖 0·닿지 못한 요소 0. 수집된 고정 요소 이름 ${[...fixedSeen].join(',')}`, shots: [] });
}
