// QA-003 M8 1회차 최종 케이스 표: 케이스별 마지막 기록(cases.jsonl + reg/ 회귀) + 연출 실측·표본에서 합성한 케이스(Q1·Q2·Q3·H·IV)를 모아 qa/results/m8/cases-final.json / cases-final.tsv 로 만든다.
// 사용: node qa/scripts/m8-final-cases.mjs
import fs from 'node:fs';
import path from 'node:path';
import { OUT, ROOT, MODEL } from './m8-lib.mjs';

const readJsonl = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const last = new Map();
const first = new Map(); // 첫 실행 기록(보정 근거)
const add = (r, src) => {
  if (!r.id) return;
  if (!first.has(r.id)) first.set(r.id, r);
  last.set(r.id, { ...r, src });
};
for (const r of readJsonl(path.join(OUT, 'cases.jsonl'))) if (!/^H-/.test(r.id)) add(r, 'm8'); // m8-harvest.mjs 자체 판정(H-…)은 아래 합성 케이스(Hx1·Hx5)로 대신한다
for (const f of ['cases.jsonl', 'cases-guard.jsonl', 'cases-attack.jsonl']) for (const r of readJsonl(path.join(OUT, 'reg', f))) add({ ...r, id: `REG-${r.id}` }, 'reg');

// 방법이 바뀌어 대체된 케이스(첫 방법은 시험 환경의 설정 쓰기와 섞여 원인을 가르지 못했다)
const DROP = new Set(['TB02-pending', 'TB02-paused']);

// ---- 사람이 정한 판정 보정·메모 (시험 스크립트·환경 문제로 첫 실행이 틀린 것)
const OVERRIDE = {
  'REG-A21f': { verdict: 'RECORD', why: 'M7c 2회차와 같은 결과(이월): 코드 포인트를 한 글자씩(keyboard.type) 넣으면 중간 상태의 끝에 매달린 ZWJ가 걷혀 가족 이모지가 3글자로 풀림. 이모지 키보드·붙여넣기는 실기기(M9). M8 변경과 무관, src 불변.' },
  'REG-B03': { verdict: 'FAIL', why: 'ERROR의 원인은 다중 탭 회귀(TB01과 같은 뿌리): 탭 B를 열기만 해도 탭 A가 곧바로 「밀린 화면」이 되어 A에서 「생각 남기기」를 열 수 없다(M7c 2회차에서는 PASS였다).' },
  'REG-B03b': { verdict: 'FAIL', why: 'ERROR의 원인은 B03과 같다(탭 B 열기만으로 A가 밀림 → 이어받은 뒤 흐름이 어긋남).' },
};
const NOTE = {
  PL05: '1회차 실행은 시험 스크립트 결함(열린 시간을 접기 직전 0.5초 구간만 재서 decide ≥ 3초 단언이 틀림) → 스크립트를 고쳐 다시 돌려 PASS. 앱 동작은 같았다(접은 20초 fold +20.2초, decide 0).',
  PL10: '1회차 실행은 시험 스크립트 결함 둘(새 탭이 심기 스크립트를 다시 돌려 저장을 덮음 · 처음 열 때도 이어하기 +1이라 resumes 기대가 1이 아니라 2) → 고쳐 다시 돌려 PASS. 탭 닫기 직전 flush(pagehide)가 동작해 잃은 시간 0.',
  'TP-negZero': '1회차 실행은 시험 스크립트 결함(−0 글자 치환이 안 걸려 hold 0이 아닌 값을 기대) → 고쳐 다시 돌려 PASS.',
  'TE-valid-clean': '1회차 실행은 시험 설정 결함(기록 시트·결정 카드가 8배속 완주를 막음 → 자동 모드·기록 카드 끔으로 바꿈) → PASS.',
  IV01: '마지막 실행(전체 판 수)의 기록.',
};

// ---- 연출 실측(Q1·Q2·Q3) 합성
const H = JSON.parse(fs.readFileSync(path.join(OUT, 'hold-analysis.json'), 'utf8'));
const synth = [];
const push = (c) => synth.push({ console: [], externalRequests: [], shots: [], ...c });

const kindName = { quiet: '조용한 해', 'narrative-L1': '서술 해(1줄)', 'narrative-L2': '서술 해(2줄)', 'narrative-L3': '서술 해(3줄)', 'resolved-L1': '결과 해(1줄)', 'resolved-L2': '결과 해(2줄)', 'resolved-L3': '결과 해(3줄)' };
for (const [k, v] of Object.entries(H.byKind)) {
  const [sp, kind] = k.split('|');
  const skip = sp.startsWith('skip-');
  const speed = Number(sp.replace('skip-', '').slice(1));
  const id = `Q1-${skip ? 'skip-' : ''}x${speed}-${kind}`;
  if (v.n < 1) continue;
  push({
    id,
    cat: 'Q1 연출 실측',
    title: `${skip ? '「다음 결정으로」 사이 ' : ''}${speed}배속 ${kindName[kind] || kind} 연출 대기 (배포 번들 실제 시계)`,
    steps: `prod 번들(시간 배율 없음)으로 한 판을 끝까지 ${skip ? '결과 대기가 끝날 때마다 「다음 결정으로」' : '자동 모드로'} 돌며 나이 숫자가 바뀐 간격을 MutationObserver로 잼`,
    expected: `모델 ${v.model}ms (하한 −2%, 상한 +3% + 0.25초: ${v.lo}~${v.hi}ms)`,
    actual: `n=${v.n} 평균 ${v.mean}ms (비 ${v.ratio}) 범위 ${v.min}~${v.max}ms, 허용 밖 ${v.outside}`,
    verdict: v.outside === 0 ? 'PASS' : 'FAIL',
  });
}
// 판 단위 (Q2)
const lives = Object.values(H.runs);
for (const r of lives) {
  if (r.mode === 'skip' || r.tag.startsWith('skipfast')) continue;
  const okHold = r.holdRatio !== null && Math.abs(r.holdRatio - 1) <= 0.02;
  const kindBad = Object.values(r.kinds).reduce((s, v) => s + v.outside, 0);
  push({
    id: `Q2-${r.tag}`,
    cat: 'Q2 완주 실측',
    title: `${r.speed}배속 ${r.mode === 'auto' ? '자동 모드' : '수동'} 한 판 완주 (${r.era}, 시드 ${r.seed}): 엔딩 hold = 그 판의 모델 연출 합`,
    steps: `prod 번들 실제 시계로 끝까지(${r.wallSec}초), 나이가 바뀐 모든 간격을 판의 연표로 분류해 모델 합과 견줌. 사망 나이 ${r.age}, 결정 카드 ${r.cards}장`,
    expected: 'hold 합 / 모델 연출 합 = 1 ± 2%, 개별 간격 허용 안',
    actual: `모델 합 ${(r.modelHoldSum / 1000).toFixed(1)}초, 저장 hold ${(r.play.hold / 1000).toFixed(1)}초 (비 ${r.holdRatio}), DOM 간격 합 비 ${r.domRatio}; 자동 선택 decide ${r.play.decide}ms${r.decideModel ? ` (카드 ${r.cards} × ${MODEL.short30.autoChoice / r.speed}ms = ${r.decideModel}ms, 비 ${r.decideRatio})` : ''}; 허용 밖 간격 ${kindBad}; 타이머 지연 평균 ${r.lat ? r.lat.meanLate : '?'}ms 최대 ${r.lat ? r.lat.max : '?'}ms; 콘솔 오류 ${r.errors}·외부 요청 ${r.ext}; 엔딩 표시 ${r.endText.value}`,
    verdict: okHold && kindBad === 0 && r.errors === 0 && r.ext === 0 ? 'PASS' : 'FAIL',
    shots: [`qa/screenshots/003/M8-hold-${r.tag}-ending.png`],
  });
}
// 자동 선택 3초 (Q1 보조)
const autoRuns = lives.filter((r) => r.mode === 'auto');
for (const sp of [1, 2, 4, 8]) {
  const rs = autoRuns.filter((r) => r.speed === sp);
  if (!rs.length) continue;
  const cards = rs.reduce((s, r) => s + r.cards, 0);
  const dec = rs.reduce((s, r) => s + r.play.decide, 0);
  const per = dec / cards;
  const model = 3000 / sp;
  push({
    id: `Q1-auto-card-x${sp}`,
    cat: 'Q1 연출 실측',
    title: `${sp}배속 자동 모드: 결정 카드가 뜬 뒤 자동 선택까지(3초 ÷ 배속)`,
    steps: `자동 모드 판 ${rs.length}개(카드 ${cards}장)의 play.decide ÷ 카드 수`,
    expected: `${model}ms (+3% + 0.25초 이내)`,
    actual: `카드당 ${per.toFixed(0)}ms (비 ${(per / model).toFixed(4)})`,
    verdict: per >= model * 0.98 && per <= model * 1.03 + 250 ? 'PASS' : 'FAIL',
  });
}


// ---- 실제로 끝까지 산 판의 엔딩 표시값 검산 (엔딩 값 = 저장 play에서 버킷별 초 버림 뒤 합, 분해 두 값, 깨끗하지 않은 판 문장)
{
  const dir = path.join(OUT, 'hold');
  const NOTCLEAN = '배속이나 자동 모드, 「다음 결정으로」를 쓴 판이라 1배속으로 직접 고른 판보다 짧게 잡힙니다.';
  const mmss = (t) => { const m = /(\d+):(\d{2})\s*$/.exec(t || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
  const bad = [];
  let n = 0;
  for (const file of fs.readdirSync(dir).filter((x) => x.endsWith('.json') && !x.startsWith('skipfast'))) {
    const r = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    if (!r.save || r.save.phase !== 'ending' || !r.save.play || !r.endText) continue;
    n++;
    const p = r.save.play;
    const hs = Math.floor(p.hold / 1000);
    const ds = Math.floor(p.decide / 1000);
    const clean = p.offSpeed === 0 && p.auto === 0 && p.skips === 0;
    const hasNot = !!r.endText.note && r.endText.note.includes(NOTCLEAN);
    if (mmss(r.endText.value) !== hs + ds) bad.push(`${file}: 표시값 ${r.endText.value} ≠ ${hs + ds}초`);
    if (mmss(r.endText.hold) !== hs || mmss(r.endText.decide) !== ds) bad.push(`${file}: 분해 ${r.endText.hold}/${r.endText.decide} ≠ ${hs}/${ds}초`);
    if (hasNot === clean) bad.push(`${file}: 깨끗하지 않은 판 문장 ${hasNot}, 깨끗한 판 ${clean}`);
  }
  push({
    id: 'ED-real-lives',
    cat: 'LM6 엔딩 표시',
    title: '실제 화면으로 끝까지 산 판의 엔딩 값 = 저장 play에서 버킷별 초를 버린 뒤 더한 값, 분해 두 값, 깨끗하지 않은 판 문장',
    steps: `hold-run 판 ${n}개의 엔딩 화면 글(표시값·연출·결정·보조 문장)을 저장의 play와 대조`,
    expected: '모든 판에서 같음',
    actual: bad.length === 0 ? `${n}판 모두 같음` : bad.slice(0, 6).join(' / '),
    verdict: bad.length === 0 && n > 0 ? 'PASS' : 'FAIL',
  });
}

// ---- 표본 수확(항목 5)
for (const [file, tag] of [['harvest-x5.json', 'x5'], ['harvest.json', 'x1']]) {
  const f = path.join(OUT, file);
  if (!fs.existsSync(f)) continue;
  const hv = JSON.parse(fs.readFileSync(f, 'utf8'));
  const SENIOR_MIN = { past: 3.97, present: 4.72, future: 5.03 };
  const perEra = {};
  for (const s of hv.summary) {
    const cardsOk = s.errors === 0 && s.cards.mean >= 23.5 && s.cards.mean <= 29 && s.cards.over30 === 0 && s.cards.ge29 <= 10 && s.senior.mean >= SENIOR_MIN[s.era] && s.infant.mean >= 2.8;
    push({
      id: `H${tag}-cards-${s.era}-${s.strategy}`,
      cat: '항목 5 표본',
      title: `수확 ${s.lives}판(${s.era}, ${s.strategy === 'random' ? '무작위 선택' : '자동 성향'}): 판당 결정 카드 수·노년·영유아`,
      steps: '개발 서버 core(오라클)로 0세부터 사망까지 돌려 연표의 선택 기록을 셈',
      expected: '평균 23.5~29, 30장 초과 0, 29장 이상 ≤ 10%, 노년(65세+) ≥ ' + SENIOR_MIN[s.era] + ', 영유아(0~7세) ≥ 2.8',
      actual: `평균 ${s.cards.mean}(se ${s.cards.se}) 분위 ${s.cards.p5}/${s.cards.p50}/${s.cards.p95} 최대 ${s.cards.max}, 30장 초과 ${s.cards.over30}, 29장 이상 ${s.cards.ge29}%, 70세+ 중 20장 미만 ${s.cards.lt20_ofDeath70}%, 노년 평균 ${s.senior.mean}(5분위 ${s.senior.p5}~${s.senior.p95}), 영유아 ${s.infant.mean}, 사망 나이 ${s.deathAge.mean}`,
      verdict: cardsOk ? 'PASS' : 'FAIL',
    });
    const t = s.time.manual1x_median.mean;
    (perEra[s.era] ||= []).push({ strategy: s.strategy, t, s });
    push({
      id: `H${tag}-time-${s.era}-${s.strategy}`,
      cat: '항목 5 표본',
      title: `수확 ${s.lives}판(${s.era}, ${s.strategy === 'random' ? '무작위 선택' : '자동 성향'}): 1배속 수동 모델 판 시간(읽기 중앙)`,
      steps: `해 수(조용 ${s.years.quiet}·서술 ${s.years.narrative}·결과 ${s.years.resolved}·둘째 줄 ${s.years.extraLines}) × 연출 × ${MODEL.short30.k} + 카드 × 읽기 ${s.readSec.median}초 (독립 계산)`,
      expected: '시대별 모델 평균 25.5~34.5분(시험 판정)',
      actual: `${t}분(5분위 ${s.time.manual1x_median.p5} · 95분위 ${s.time.manual1x_median.p95} · 최대 ${s.time.manual1x_median.max}), 읽기 낮음 ${s.time.manual1x_low}분·높음 ${s.time.manual1x_high}분, 1배속 자동 ${s.time.auto1x}분, 8배속 자동 ${s.time.auto8x.mean}분(${s.time.auto8x.p5}~${s.time.auto8x.p95}), 8배속+다음 결정으로(참고) ${s.time.skip8x_ref}분`,
      verdict: t >= 25.5 && t <= 34.5 ? 'PASS' : 'FAIL',
    });
  }
  const avgOf = (strategy) => {
    const v = ['past', 'present', 'future'].map((e) => perEra[e].find((x) => x.strategy === strategy).t);
    return v.reduce((a, b) => a + b, 0) / 3;
  };
  for (const st of ['random', 'auto']) {
    const a = avgOf(st);
    push({
      id: `H${tag}-time-avg-${st}`,
      cat: '항목 5 표본',
      title: `수확(${tag === 'x5' ? '5000' : '1000'}판 × 세 세상, ${st === 'random' ? '무작위 선택' : '자동 성향'}): 세 시대 평균 1배속 수동 모델 판 시간`,
      steps: '시대별 평균의 평균',
      expected: '27~33분',
      actual: `${a.toFixed(2)}분`,
      verdict: a >= 27 && a <= 33 ? 'PASS' : 'FAIL',
    });
  }
}


// ---- 이 환경에서 할 수 없는 것 (SKIP)
for (const [id, title, why] of [
  ['X01', 'WebKit·Safari(iOS) 엔딩·타이머·첫 화면', '브라우저를 새로 받지 않는다는 규칙(Playwright Chromium만) — 실기기·WebKit은 M9'],
  ['X02', '실제 OS의 탭 가림·앱 전환·화면 잠금·모바일 페이지 정지(R-422의 실기기 확인)', '탭 가림은 visibilityState 덮어쓰기 + visibilitychange 이벤트와 CDP 정지(TB04·PL11)로 갈음 — 실기기 M9'],
  ['X03', '「약 1시간」(long60) 판을 첫 화면에서 골라 실제로 1시간을 재는 것', 'LD-4: 1차는 「준비 중」으로 닫혀 있다 — 변조 저장으로 넣은 판의 연출(MD04)만 확인'],
  ['X04', '사람 실측(LM7): 형진 님이 모바일로 1배속 수동 한 판을 끝까지 하고 엔딩의 플레이 시간을 보고', '배포 뒤 형진 님 몫 — QA는 연출 시간만 재고 읽는 시간은 모델로 둔다(content-M8 6-4)'],
  ['X05', '모바일 실기기 터치 스크롤·핀치·가상 키보드로 엔딩 화면과 첫 화면 보기', '실기기 M9 — 이 환경은 에뮬레이션(360×740 터치)'],
]) push({ id, cat: 'SKIP', title, steps: '-', expected: '-', actual: why, verdict: 'SKIP' });

// ---- 합치기
const rows = [];
for (const r0 of [...last.values(), ...synth]) {
  if (DROP.has(r0.id)) continue;
  const IS_B = /\/(b|c)$/.test(String(OUT).replace(/\\/g, '/')); // 보충 실행(b·c)에서는 B03 보정을 쓰지 않는다 — 원본 실행의 ERROR 원인 메모일 뿐
  const ov = (IS_B && /^REG-B03/.test(r0.id)) ? undefined : OVERRIDE[r0.id];
  const r = ov ? { ...r0, verdict: ov.verdict, actual: `${ov.why} (실행 결과: ${String(r0.actual).replace(/s+/g, ' ').slice(0, 160)})` } : r0;
  const note = NOTE[r.id];
  if (r.id === 'TB02-13s') r.actual = String(r.actual).replace(/\s*\(결정 카드를 읽는 시간이.*$/, '');
  rows.push({
    id: r.id,
    cat: r.cat || '',
    title: r.title || '',
    steps: r.steps || '',
    expected: r.expected || '',
    actual: String(r.actual || '').replace(/\s+/g, ' ') + (note ? ` [메모: ${note}]` : ''),
    verdict: r.verdict,
    shots: r.shots || [],
    console: (r.console || []).length,
    ext: (r.externalRequests || []).length,
    firstVerdict: first.has(r.id) ? first.get(r.id).verdict : undefined,
  });
}
const missingShots = rows.flatMap((r) => (r.shots || []).filter((p) => !fs.existsSync(path.join(ROOT, p))).map((p) => `${r.id}:${p}`));
if (missingShots.length) console.log('없는 스크린샷', missingShots.length, missingShots.slice(0, 8).join(' '));
fs.writeFileSync(path.join(OUT, 'cases-final.json'), JSON.stringify(rows, null, 1));
const tsv = ['ID\t분류\t제목\t절차\t기대\t실제\t판정\t스크린샷', ...rows.map((r) => [r.id, r.cat, r.title, r.steps, r.expected, r.actual, r.verdict, (r.shots || []).join(' ; ')].map((x) => String(x).replace(/[\t\n]/g, ' ')).join('\t'))].join('\n');
fs.writeFileSync(path.join(OUT, 'cases-final.tsv'), tsv);
const cnt = {};
for (const r of rows) cnt[r.verdict] = (cnt[r.verdict] || 0) + 1;
console.log('cases', rows.length, JSON.stringify(cnt));
for (const r of rows.filter((x) => x.verdict !== 'PASS')) console.log(r.verdict, r.id, String(r.actual).slice(0, 220));
const repeated = rows.filter((x) => x.firstVerdict && x.firstVerdict !== x.verdict);
console.log('첫 실행과 판정이 달라진 케이스:', repeated.map((x) => `${x.id}(${x.firstVerdict}→${x.verdict})`).join(' '));
