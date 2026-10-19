// QA-003 M8 2회차 최종 케이스 표(1회차 m8-final-cases.mjs를 2회차용으로 고침: 오버라이드 제거, 판정 임계 23.3·노년 3.95/4.72/5.00, 스크린샷 접두 M8-r2)
// (원래 머리말) QA-003 M8 1회차 최종 케이스 표: 케이스별 마지막 기록(cases.jsonl + reg/ 회귀) + 연출 실측·표본에서 합성한 케이스(Q1·Q2·Q3·H·IV)를 모아 qa/results/m8/cases-final.json / cases-final.tsv 로 만든다.
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
const DROP = new Set([]);

// ---- 사람이 정한 판정 보정·메모 (시험 스크립트·환경 문제로 첫 실행이 틀린 것)
const OVERRIDE = {
  'REG-A21f': { verdict: 'RECORD', why: 'M7c 2회차와 같은 결과(이월, 허용 RECORD): 코드 포인트를 한 글자씩(keyboard.type) 넣으면 중간 상태의 끝에 매달린 ZWJ가 걷혀 가족 이모지가 3글자로 풀림. 이모지 키보드·붙여넣기는 실기기(M9). M8 변경과 무관, src 불변.' },
};
const NOTE = {
  IV01: '마지막 실행(전체 판 수)의 기록.',
  'Hx1-cards-past-random': '[시험 쪽 정정] 첫 실행은 1000판 한 표본의 카드·노년·영유아 칸에도 3 SE 여유를 요구하는 내 기준이 과해 FAIL(카드 23.598±0.100 = 하한 23.3까지 2.98 SE, 노년 4.138±0.070 = 2.7 SE). 13-3 (라) ②는 값 기준(평균이 임계 안)이고 3 SE는 시간 칸에 걸리는 것이라 규칙을 고쳐 다시 돌림 — 카드·노년·영유아의 3 SE는 5000판에서만 요구한다(5000판 지난 세상 카드 10.8 SE·노년 7.3 SE). 첫 실행 로그 logs/harvest-x1-first.log.',
  'TB04b20-hold': '[시험 쪽 정정] 첫 실행은 판정 오류: 13-3 TB04-b는 hold+decide 증가 ≤ 1초만 요구하는데 TB04-a의 idle 5.5초 상한을 b에도 걸어 FAIL(새는 시간은 0초). 기준을 고쳐 다시 돌림. 참고: 이 환경(헤드리스 Chromium)에서 CDP frozen은 페이지를 멈추지 못한다(100ms 틱 최대 간격 0.3~0.47초, idle +20.3초) — 진짜 정지는 TB04-a(메인 스레드 정지)·d(디버거)가 잰다.',
  'TB04b20-decide': '[시험 쪽 정정] TB04b20-hold와 같음(idle 상한을 b에 잘못 건 판정 오류).',
  PL10: '[시험 쪽 정정] 첫 실행은 판정 오류: 2회차 규칙에서 이어하기 횟수는 hold·decide가 처음 쌓일 때 한 번 오르므로 곧바로 읽으면 +1이 아직 아닐 수 있다 → 「비감소·증가 ≤ 1」로 고쳐 다시 돌림(잃은 몫 약 7초 ≤ 11.5초는 첫 실행도 같음).',
  PL14: '[시험 쪽 정정] 첫 실행은 기준 읽기를 사람의 시간 0.8초에 해 저장에 안 쓰여(1.5초 미만 = 마스터 정정 ③) 옛 값을 읽었다 → 기준 읽기 전에 1.7초 이상 흘리게 고쳐 PASS.',
  PL12: '[시험 쪽 정정] 배포 번들 읽기는 마지막 쓰기 뒤 1.5초 미만의 hold와 idle만 쌓인 몫을 저장에서 볼 수 없어 버킷 합이 벽시계보다 최대 약 2.6초 모자랄 수 있다 → 허용 폭을 −2.6~+0.4초로 두고, 정확한 값은 개발 서버 + __playTime 판(PL12-dev: 합 20.46 = 벽시계 20.46)이 잰다.',
  PL15: '[시험 쪽 정정] PL12와 같음(기준 읽기 1.7초 이상 + 읽기 한계 허용 폭). PL15-dev가 정확한 합(18.41 = 18.40)을 보인다.',
  'TB01-did': '정정 ④: 세는 쓰기는 「일시정지를 푼 뒤 2.5초가 지나고 pagehide를 보낸 쓰기」(일시정지를 푸는 것 자체의 쓰기는 따로 셈).',
  'REG-B05d': '[시험 쪽 정정] 1회차 스크립트(m7c-attack6.mjs)가 미리보기 주소(4899)를 직접 적어 두어 이번 회차(4896)에서 연결 거부 ERROR → 사본(m8-r2-attack6.mjs)에서 QA_PROD로 바꿔 PASS(앱 동작 문제 아님).',
  'REG-S-refcount': '같은 회귀 스위트가 실수로 4중 동시에 돌 때(스크립트 파일을 돌리는 도중 고쳐 쓴 탓에 체인이 여러 번 실행됨) 1회 FAIL(문서가 다시 스크롤됨 [0]) — 단독으로 다시 돌린 최종 기록은 PASS, 스위트 11/11 PASS를 단독으로 3번 더 확인.',
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
    shots: [`qa/screenshots/003/M8-r2-hold-${r.tag}-ending.png`],
  });
}
// 수동 1배속 판: decide ÷ 카드가 DOM에 열려 있던 시간 = 1 ± 0.02 (13-3 (다) Q2 수동 1배속)
for (const r of lives.filter((x) => x.mode === 'manual')) {
  const open = r.cardDecide.n * r.cardDecide.mean;
  const ratio = r.play.decide / open;
  push({
    id: `Q2-${r.tag}-decide`,
    cat: 'Q2 완주 실측',
    title: `1배속 수동 한 판(${r.era}, 시드 ${r.seed}): 엔딩 decide ÷ 결정 카드가 열려 있던 시간 = 1 ± 0.02`,
    steps: '카드가 뜬 뒤 1.5초 읽고 첫 선택지를 고르는 수동 완주, MutationObserver로 카드가 DOM에 뜨고 사라진 간격의 합과 저장 play.decide를 견줌',
    expected: 'decide ÷ 카드 열림 합 = 1 ± 0.02',
    actual: `카드 ${r.cardDecide.n}장, 열림 합 ${(open / 1000).toFixed(1)}초(카드당 평균 ${r.cardDecide.mean}ms), play.decide ${(r.play.decide / 1000).toFixed(1)}초 → 비 ${ratio.toFixed(4)}`,
    verdict: Math.abs(ratio - 1) <= 0.02 ? 'PASS' : 'FAIL',
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

// ---- 이 환경에서 할 수 없는 것 (SKIP)
for (const [id, title, why] of [
  ['X01', 'WebKit·Safari(iOS) 엔딩·타이머·첫 화면', '브라우저를 새로 받지 않는다는 규칙(Playwright Chromium만) — 실기기·WebKit은 M9'],
  ['X02', '실제 OS의 탭 가림·앱 전환·화면 잠금·모바일 페이지 정지(R-422의 실기기 확인)', '탭 가림은 visibilityState 덮어쓰기 + visibilitychange 이벤트, 메인 스레드 정지, CDP frozen(TB04-a~c)으로 갈음 — 실기기 앱 전환 10회는 M9'],
  ['X03', '「약 1시간」(long60) 판을 첫 화면에서 골라 실제로 1시간을 재는 것', 'LD-4: 1차는 「준비 중」으로 닫혀 있다 — 변조 저장으로 넣은 판의 연출(MD04)만 확인'],
  ['X04', '사람 실측(LM7): 형진 님이 모바일로 1배속 수동 한 판을 끝까지 하고 엔딩의 플레이 시간을 보고', '배포 뒤 형진 님 몫 — QA는 연출 시간만 재고 읽는 시간은 모델로 둔다(content-M8 6-4)'],
  ['X05', '모바일 실기기 터치 스크롤·핀치·가상 키보드로 엔딩 화면과 첫 화면 보기', '실기기 M9 — 이 환경은 에뮬레이션(360×740 터치)'],
]) push({ id, cat: 'SKIP', title, steps: '-', expected: '-', actual: why, verdict: 'SKIP' });

// ---- 합치기
const rows = [];
for (const r0 of [...last.values(), ...synth]) {
  if (DROP.has(r0.id)) continue;
  const IS_B = true;
  const ov = (IS_B && /^REG-B03/.test(r0.id)) ? undefined : OVERRIDE[r0.id];
  const r = ov ? { ...r0, verdict: ov.verdict, actual: `${ov.why} (실행 결과: ${String(r0.actual).replace(/s+/g, ' ').slice(0, 160)})` } : r0;
  const note = NOTE[r.id];
  rows.push({
    id: String(r.id).replace(/^Hxx/, 'Hx'),
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
