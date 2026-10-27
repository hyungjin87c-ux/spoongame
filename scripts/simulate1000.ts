import { GENERATION_IDS as ERAS, type LifeLength } from '../src/core';
import { LIFE_LENGTH_MODES } from '../src/data/timingTable';
import { PIPELINE_STRATEGIES, runPipelineCell, type CellReport } from './pipelineLib';
import type { Dist } from './simulateLib';

/**
 * 1000판 전체 파이프라인 시뮬레이션 (SPEC-001 M6: "1000판 자동 시뮬레이션에서 에러 0건" · SPEC-003 LM4: 두 모드 모두 시대별 1000판에서 에러 0·모순 0·카드 수 구간).
 * 실행: npm run sim:1000 [-- 판수=1000 [매걸음저장간격=20]]   (불변식 위반·예외가 하나라도 있으면 종료 코드 1)
 *
 * 시대 3개 × 전략 2개(자동 모드 / 무작위 수동 흉내) × **인생 길이 모드 2개(약 30분 / 약 1시간 — 독립 축)** × 판수 = 기본 12000판을 세션 reducer로 타이틀부터 다시 태어나기까지 끝까지 돌리며 점검한다.
 * 약 1시간 모드는 1차에서 닫혀 있다(첫 화면 「준비 중」, LD-4)이고 시뮬레이션은 설정에 값을 직접 넣어 돌린다 — 에러 0·모순 0은 판정, 카드 수·시간은 보고만 한다(content-M8.md 4-2절).
 * 약 30분 모드는 판당 카드 평균이 모드 구간 안인지도 줄로 보인다(판정은 tests/simulation.test.ts — 여기서는 보고).
 * 점검 항목과 기준은 scripts/pipelineLib.ts 머리말. 같은 계산을 테스트(tests/pipeline.test.ts)도 6000판(모드는 시드 짝홀)으로 돌린다(기본 npm test에 포함).
 */
const lives = Number(process.argv[2] ?? 1000);
const every = Number(process.argv[3] ?? 20);
if (!Number.isInteger(lives) || lives < 1 || !Number.isInteger(every) || every < 0) {
  console.error('사용법: npm run sim:1000 [-- 판수(1 이상 정수) [매 걸음 저장→복원 간격(0 이상 정수, 0이면 없음)]]');
  process.exit(2);
}

const MODES: readonly LifeLength[] = ['short30', 'long60'];
const f = (n: number, d = 1) => n.toFixed(d);
/** 카드 평균이 모드의 판정 구간 안인가 / 모델 시간 평균이 모드의 판정 구간(시대별: modelLow − 1.5 ~ modelHigh + 1.5, tests/simulation.test.ts와 같다) 안인가 */
const cardsIn = (r: CellReport, m: (typeof LIFE_LENGTH_MODES)[LifeLength]): boolean => r.choices.mean >= m.cards.meanLow && r.choices.mean <= m.cards.meanHigh;
const timeIn = (r: CellReport, m: (typeof LIFE_LENGTH_MODES)[LifeLength]): boolean => r.minutes1x.mean >= m.timeMin.modelLow - 1.5 && r.minutes1x.mean <= m.timeMin.modelHigh + 1.5;
const dist = (label: string, d: Dist, digits = 1) => `    ${label.padEnd(24)} 평균 ${f(d.mean, digits).padStart(6)} | 최소 ${f(d.min, digits).padStart(6)} | 5% ${f(d.p05, digits).padStart(6)} | 중앙 ${f(d.p50, digits).padStart(6)} | 95% ${f(d.p95, digits).padStart(6)} | 최대 ${f(d.max, digits).padStart(6)}`;

console.log(`1000판 전체 파이프라인: 세대 ${ERAS.length}개 × 전략 ${PIPELINE_STRATEGIES.length}개(자동 모드 / 무작위 수동 흉내) × 인생 길이 ${MODES.length}개 × ${lives}판 = ${ERAS.length * PIPELINE_STRATEGIES.length * MODES.length * lives}판`);
console.log(`경로: 첫 화면 → 세상·인생 길이 고르기 → 태어나기 → 인생(세션 reducer: 한 해씩·다음 결정으로·선택·자동 선택·플레이 시간 기록 옮기기) → 사망 → 엔딩 회고(reviewEnding) → 다시 태어나기 → 새 판 출생·첫 결정`);
console.log(`저장 검증: 단계가 바뀌는 지점·선택지·엔딩·다시 태어난 직후는 모든 판에서, ${every > 0 ? `매 걸음은 ${every}판마다 한 판(그 판은 매 걸음 복원한 상태로 이어간다)` : '매 걸음은 하지 않음'}\n`);

const started = Date.now();
const reports: CellReport[] = [];
for (const mode of MODES) {
  const m = LIFE_LENGTH_MODES[mode];
  console.log(`== ${m.label} (${mode}) — 연출 계수 ${m.holdScale}, 페이싱 soft ${m.pacing.soft} / ×${m.pacing.softFactor} / hard ${m.pacing.hard}${m.selectable ? '' : ' (1차는 닫혀 있다 — 카드 수·시간은 보고만)'}`);
  for (const era of ERAS) {
    for (const strategy of PIPELINE_STRATEGIES) {
      const t0 = Date.now();
      const r = runPipelineCell(era, strategy, { lives, stepSerializeEvery: every, lifeLength: mode });
      reports.push(r);
      const j = r.journeys;
      console.log(`[${mode} / ${era} / ${strategy === 'auto' ? '자동 모드' : '수동 흉내'}] ${r.lives}판, 위반이 있는 판 ${r.failedLives}, 예외 ${r.exceptions}, 위반 메시지 ${r.problemCount}건 (${f((Date.now() - t0) / 1000)}초)`);
      console.log(dist('사망 나이', r.deathAge));
      console.log(dist('결정 카드 수', r.choices));
      console.log(dist('1배속 수동(분, 중앙)', r.minutes1x));
      console.log(dist('8배속+다음결정(분,중앙)', r.minutesFast));
      console.log(`    카드 평균 ${f(r.choices.mean, 2)}장 — 모드 구간 ${m.cards.meanLow}~${m.cards.meanHigh}장 ${cardsIn(r, m) ? '안' : '밖'}${m.selectable ? '' : ' (보고만)'} | 모델 시간 평균 ${f(r.minutes1x.mean)}분 — 모드 구간 ${m.timeMin.modelLow - 1.5}~${m.timeMin.modelHigh + 1.5}분(시대별) ${timeIn(r, m) ? '안' : '밖'}${m.selectable ? '' : ' (보고만)'}`);
      console.log(`    엔딩 회고: 20세 전 사망 ${j.early} / 앞섬 ${j.up} / 비슷함 ${j.same} / 뒤쪽 ${j.down}${j.none > 0 ? ` / 끝까지 못 감 ${j.none}` : ''} | 서로 다른 이름 ${r.distinctNames}개`);
      console.log(
        `    점검: 이름 ${r.checks.names}회, 걸음 불변식 ${r.checks.transitions}회, 저장→복원 ${r.checks.roundTrips}회(매 걸음 저장한 판 ${r.stepSerializedLives}), 연타 입력 ${r.checks.duplicateInputs}회, 엔딩 문장 ${r.checks.endingTexts}판, 다시 태어나기 ${r.checks.rebirths}회, 가족 규칙 ${r.checks.familyRules}회\n`,
      );
      for (const p of r.problems) console.log(`    위반: ${p}`);
    }
  }
}

const total = reports.reduce((a, r) => a + r.lives, 0);
const failed = reports.reduce((a, r) => a + r.failedLives, 0);
const exceptions = reports.reduce((a, r) => a + r.exceptions, 0);
const problemCount = reports.reduce((a, r) => a + r.problemCount, 0);
const sum = (f2: (r: CellReport) => number) => reports.reduce((a, r) => a + f2(r), 0);
console.log(`합계: ${total}판, 위반이 있는 판 ${failed}, 예외 ${exceptions}, 위반 메시지 ${problemCount}건 — 걸린 시간 ${f((Date.now() - started) / 1000)}초`);
console.log(
  `점검 횟수: 이름 ${sum((r) => r.checks.names)} / 걸음 불변식 ${sum((r) => r.checks.transitions)} / 저장→복원 ${sum((r) => r.checks.roundTrips)} / 연타 입력 ${sum((r) => r.checks.duplicateInputs)} / 엔딩 문장 ${sum((r) => r.checks.endingTexts)} / 다시 태어나기 ${sum((r) => r.checks.rebirths)} / 가족 규칙 ${sum((r) => r.checks.familyRules)}`,
);
// 30분 모드(판정 모드)의 구간 밖 칸 수 (REV-003-M8-1 R-415): 「밖」은 보고 값이라 종료 코드에는 반영하지 않는다(판정은 tests/simulation.test.ts). 요약 줄에 개수와 칸을 보여 로그의 「안」·「밖」이 묻히지 않게 한다.
{
  const m30 = LIFE_LENGTH_MODES.short30;
  const cells = reports.filter((r) => r.lifeLength === 'short30');
  const out = cells.filter((r) => !cardsIn(r, m30) || !timeIn(r, m30));
  const lo = (xs: number[]) => Math.min(...xs);
  const hi = (xs: number[]) => Math.max(...xs);
  console.log(
    `30분 모드 판정 구간 밖 칸: ${out.length} / ${cells.length}${out.length > 0 ? ` — ${out.map((r) => `${r.era}/${r.strategy === 'auto' ? '자동' : '수동'}(카드 ${f(r.choices.mean, 2)}장 ${cardsIn(r, m30) ? '안' : '밖'}, 시간 ${f(r.minutes1x.mean, 2)}분 ${timeIn(r, m30) ? '안' : '밖'})`).join(', ')}` : ''} | 칸 평균 범위: 카드 ${f(lo(cells.map((r) => r.choices.mean)), 2)}~${f(hi(cells.map((r) => r.choices.mean)), 2)}장(구간 ${m30.cards.meanLow}~${m30.cards.meanHigh}), 모델 시간 ${f(lo(cells.map((r) => r.minutes1x.mean)), 2)}~${f(hi(cells.map((r) => r.minutes1x.mean)), 2)}분(시대별 구간 ${m30.timeMin.modelLow - 1.5}~${m30.timeMin.modelHigh + 1.5})`,
  );
}
if (failed > 0 || exceptions > 0 || problemCount > 0) {
  console.error('실패: 위 위반 메시지를 확인한다');
  process.exit(1);
}
console.log('통과: 에러 0건');
