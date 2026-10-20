// QA-003 M9 최종 케이스 표: 케이스별 마지막 기록(cases.jsonl + reg/ 회귀) + 연출 실측·표본에서 합성한 케이스(Q1·Q2·Q3·H·IV·P1)를 모아 qa/results/m9/cases-final.json / cases-final.tsv 로 만든다.
// m8-r2-final-cases.mjs를 M9용으로 고친 것: 판정 임계(23.3·노년 3.95/4.72/5.00)와 합성 로직은 같고, ① P1 합성 케이스 추가 ② X 항목(SKIP) 갱신 ③ 스크린샷은 FAIL·RECORD 케이스만 저장소로 옮기고 PASS는 「-」(형진 님 결정 2026-10-20).
// 사용: node qa/scripts/m9-final-cases.mjs    (환경은 m9-env.sh — QA_SHOT_DIR이 임시 폴더)
import fs from 'node:fs';
import path from 'node:path';
import { OUT, ROOT, MODEL } from './m8-lib.mjs';

const SHOT_TMP = process.env.QA_SHOT_DIR ? path.resolve(process.env.QA_SHOT_DIR) : null;
const readJsonl = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const last = new Map();
const first = new Map(); // 첫 실행 기록(보정 근거)
const add = (r, src) => {
  if (!r.id) return;
  if (!first.has(r.id)) first.set(r.id, r);
  last.set(r.id, { ...r, src });
};
for (const r of readJsonl(path.join(OUT, 'cases.jsonl'))) if (!/^H-/.test(r.id)) add(r, 'm9'); // m8-harvest.mjs 자체 판정(H-…)은 아래 합성 케이스(Hx1·Hx5)로 대신한다
for (const f of ['cases.jsonl', 'cases-guard.jsonl', 'cases-attack.jsonl']) for (const r of readJsonl(path.join(OUT, 'reg', f))) add({ ...r, id: `REG-${r.id}` }, 'reg');

// ---- 이월 항목(허용 RECORD): 결과가 FAIL로 나와도 이월 사유가 같을 때만 RECORD로 적는다. PASS면 PASS 그대로.
const CARRY = {
  'REG-A21f': 'M7c 2회차·M8 2회차와 같은 결과(이월, 허용 RECORD): 코드 포인트를 한 글자씩(keyboard.type) 넣으면 중간 상태의 끝에 매달린 ZWJ가 걷혀 가족 이모지가 3글자로 풀림. 이모지 키보드·붙여넣기는 실기기. src 불변.',
};
// WebKit에서만 나는 결함의 판정(마스터 결정 12-4 4): 진행 불가·데이터 손실·읽을 수 없음 = FAIL, 모양 차이 = RECORD. 아래는 눈으로 확인한 뒤 모양 차이로 본 것.
const WK_RECORD = {
  'P6-wk-audit-title': 'WebKit에서만 감사에 걸린 값(Chromium은 같은 조합에서 0): 1280×800 · 글자 200%에서 Tab으로 오른쪽 통계 카드의 스크롤 영역(carousel-viewport)에 닿으면 측정기가 포커스 링 상자(26~755px)와 하단 띠(732~)가 약 23px 겹친다고 계산한다. 눈으로 확인하니 카드는 설계대로(title.css: 따라다니는 카드가 띠 위에 머물고 넘치는 부분은 카드 안쪽 스크롤 — max-height 705px · overflow-y auto) 띠 위에서 잘리며 두 엔진 모두 카드 아래쪽 내용(출처 줄)은 안쪽 스크롤로 닿는다. 엔진 차이는 요소 상자 높이(WebKit 729px, Chromium은 더 커서 「가용 높이보다 큰 요소」 예외로 통과)라 측정 한계에 가깝다 → 모양·측정 차이로 RECORD, 2차에서 확인.',
};
const NOTE = {};

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
    shots: [`qa/screenshots/003/M9-hold-${r.tag}-ending.png`],
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
const NOTCLEAN = '배속이나 자동 모드, 「다음 결정으로」를 쓴 판이라 1배속으로 직접 고른 판보다 짧게 잡힙니다.';
const mmss = (t) => { const m = /(\d+):(\d{2})\s*$/.exec(t || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
function endingChecks(dir) {
  const bad = [];
  let n = 0;
  if (!fs.existsSync(dir)) return { bad, n };
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
  return { bad, n };
}
{
  const { bad, n } = endingChecks(path.join(OUT, 'hold'));
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

// ---- P1: 세 시대 × 「약 30분」 1배속 자동 모드 완주(데스크톱 우선, 360 터치 둘째) — 실제 시계, 컨텍스트 4개 병렬
{
  const P1 = JSON.parse(fs.readFileSync(path.join(OUT, 'p1-analysis.json'), 'utf8'));
  const { bad: edBad } = endingChecks(path.join(OUT, 'p1'));
  const order = ['p1-present-1280x800', 'p1-past-1920x1080', 'p1-future-1280x800', 'p1-past-360x740-touch'];
  for (const tag of order) {
    const r = P1.runs[tag];
    if (!r) {
      push({ id: `P1-${tag.replace(/^p1-/, '')}`, cat: 'P1 1배속 완주', title: tag, steps: '-', expected: '-', actual: '결과 파일 없음', verdict: 'FAIL' });
      continue;
    }
    const raw = JSON.parse(fs.readFileSync(path.join(OUT, 'p1', `${tag}.json`), 'utf8'));
    const okHold = r.holdRatio !== null && Math.abs(r.holdRatio - 1) <= 0.02;
    const kindBad = Object.values(r.kinds).reduce((s, v) => s + v.outside, 0);
    const edThis = edBad.filter((x) => x.startsWith(tag));
    const noOverflow = raw.overflow && raw.overflow.overflow === false;
    const total = Math.floor(r.play.hold / 1000) + Math.floor(r.play.decide / 1000);
    push({
      id: `P1-${tag.replace(/^p1-/, '')}`,
      cat: 'P1 1배속 완주',
      title: `${r.era === 'past' ? '지난' : r.era === 'present' ? '지금' : '다가올'} 세상 · ${raw.vp} · 「약 30분」 1배속 자동 모드 실시간 완주 (시드 ${r.seed})`,
      steps: `prod 번들 실제 시계로 끝까지(${r.wallSec}초, 한 브라우저의 컨텍스트 4개 병렬), 나이 간격을 MutationObserver로 재 판의 연표로 분류해 모델 합과 견줌, 엔딩의 플레이 시간 블록 대조, 콘솔·외부 요청 수집`,
      expected: 'hold 합 ÷ 모델 연출 합 = 1 ± 2%, 개별 간격 허용 안, 엔딩 표시값 = 저장 play의 버킷별 초 버림 합·분해 줄·보조 문장, 콘솔 오류·외부 요청 0, 엔딩 가로 넘침 0',
      actual: `사망 ${r.age}세·결정 ${r.cards}장 — 모델 합 ${(r.modelHoldSum / 1000).toFixed(1)}초, 저장 hold ${(r.play.hold / 1000).toFixed(1)}초 (비 ${r.holdRatio}), DOM 합 비 ${r.domRatio}, 자동 선택 decide ${(r.play.decide / 1000).toFixed(1)}초 (비 ${r.decideRatio}); 허용 밖 간격 ${kindBad}; 타이머 지연 평균 ${r.lat ? r.lat.meanLate : '?'}ms 최대 ${r.lat ? r.lat.max : '?'}ms; 엔딩 표시 「${r.endText.value}」(= 연출 ${r.endText.hold} + 결정 ${r.endText.decide}, 합 ${Math.floor(total / 60)}분 ${total % 60}초); 엔딩 표시 대조 ${edThis.length ? edThis.join(' / ') : '일치'}; 콘솔 오류 ${r.errors}·외부 요청 ${r.ext}; 엔딩 가로 넘침 ${noOverflow ? '0' : '있음'}`,
      verdict: okHold && kindBad === 0 && r.errors === 0 && r.ext === 0 && edThis.length === 0 && noOverflow ? 'PASS' : 'FAIL',
      shots: [`qa/screenshots/003/M9-hold-${tag}-ending.png`],
    });
  }
}

// ---- 이 환경에서 할 수 없는 것 (SKIP)
const SKIPS = JSON.parse(fs.existsSync(path.join(OUT, 'skips.json')) ? fs.readFileSync(path.join(OUT, 'skips.json'), 'utf8') : '[]');
for (const [id, title, why] of [
  ['X02', '실제 OS의 탭 가림·앱 전환·화면 잠금·모바일 페이지 정지(R-422의 실기기 확인)', '탭 가림은 visibilityState 덮어쓰기 + visibilitychange 이벤트, 메인 스레드 정지, CDP frozen(TB04-a~c)으로 갈음 — 실기기 앱 전환 10회는 형진 님 실기기 목록(AN2)'],
  ['X03', '「약 1시간」(long60) 판을 첫 화면에서 골라 실제로 1시간을 재는 것', 'LD-4: 1차는 「준비 중」으로 닫혀 있다 — P3(선택 불가·설정 읽기)·MD04(변조 저장 연출)만 확인'],
  ['X04', '사람 실측(LM7): 형진 님이 모바일로 1배속 수동 한 판을 끝까지 하고 엔딩의 플레이 시간을 보고', '배포 뒤 형진 님 몫 — QA는 연출 시간만 재고 읽는 시간은 모델로 둔다(content-M8 6-4)'],
  ['X05', '모바일 실기기 터치 스크롤·핀치·가상 키보드·두 번 탭 확대·IME(M7c-PZ-doubletap·A21f·X01·X02)', '실기기 목록(AN4·S4) — 이 환경은 에뮬레이션(360×740 터치)'],
  ...SKIPS,
]) push({ id, cat: 'SKIP', title, steps: '-', expected: '-', actual: why, verdict: 'SKIP' });

// ---- 합치기
const rows = [];
for (const r0 of [...last.values(), ...synth]) {
  const carry = CARRY[r0.id];
  const wk = WK_RECORD[r0.id];
  const r = carry && r0.verdict !== 'PASS' ? { ...r0, verdict: 'RECORD', actual: `${carry} (실행 결과: ${String(r0.actual).replace(/\s+/g, ' ').slice(0, 160)})` } : wk && r0.verdict === 'FAIL' ? { ...r0, verdict: 'RECORD', actual: `${wk} (측정: ${String(r0.actual).replace(/\s+/g, ' ').slice(0, 260)})` } : r0;
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

// ---- 스크린샷: FAIL·RECORD(·ERROR) 케이스의 대표 1장만 저장소로. PASS·SKIP은 「-」
const SHOT_REPO = path.join(ROOT, 'qa', 'screenshots', '003');
let kept = 0;
let keptBytes = 0;
const missing = [];
for (const r of rows) {
  const want = r.verdict !== 'PASS' && r.verdict !== 'SKIP';
  const orig = r.shots || [];
  r.shots = [];
  if (!want) continue;
  const safeId = String(r.id).replace(/[^A-Za-z0-9가-힣_.-]/g, '_');
  const cand = [...orig.map((p) => path.basename(p)), `M9-${safeId}.png`].filter((b) => SHOT_TMP && fs.existsSync(path.join(SHOT_TMP, b)));
  if (cand.length === 0) {
    missing.push(`${r.id}(${orig.length}개 중 임시 폴더에 파일 없음)`);
    continue;
  }
  const safe = String(r.id).replace(/[^A-Za-z0-9가-힣_.-]/g, '_');
  const dest = `qa/screenshots/003/M9-${safe}.png`;
  fs.mkdirSync(SHOT_REPO, { recursive: true });
  fs.copyFileSync(path.join(SHOT_TMP, cand[0]), path.join(ROOT, dest));
  keptBytes += fs.statSync(path.join(ROOT, dest)).size;
  kept++;
  r.shots = [dest];
}
fs.writeFileSync(path.join(OUT, 'cases-final.json'), JSON.stringify(rows, null, 1));
const tsv = ['ID\t분류\t제목\t절차\t기대\t실제\t판정\t스크린샷', ...rows.map((r) => [r.id, r.cat, r.title, r.steps, r.expected, r.actual, r.verdict, (r.shots || []).length ? r.shots.join(' ; ') : '-'].map((x) => String(x).replace(/[\t\n]/g, ' ')).join('\t'))].join('\n');
fs.writeFileSync(path.join(OUT, 'cases-final.tsv'), tsv);
const cnt = {};
for (const r of rows) cnt[r.verdict] = (cnt[r.verdict] || 0) + 1;
console.log('cases', rows.length, JSON.stringify(cnt));
console.log(`스크린샷 저장소에 남긴 장수 ${kept} (${(keptBytes / 1048576).toFixed(2)}MB)${missing.length ? ' · 샷 없는 비-PASS ' + missing.join(', ') : ''}`);
for (const r of rows.filter((x) => x.verdict !== 'PASS')) console.log(r.verdict, r.id, String(r.actual).slice(0, 220));
const repeated = rows.filter((x) => x.firstVerdict && x.firstVerdict !== x.verdict);
console.log('첫 실행과 판정이 달라진 케이스:', repeated.map((x) => `${x.id}(${x.firstVerdict}→${x.verdict})`).join(' '));
