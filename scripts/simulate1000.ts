import { ERAS } from '../src/core';
import { PIPELINE_STRATEGIES, runPipelineCell, type CellReport } from './pipelineLib';
import type { Dist } from './simulateLib';

/**
 * 1000판 전체 파이프라인 시뮬레이션 (SPEC-001 M6: "1000판 자동 시뮬레이션에서 에러 0건").
 * 실행: npm run sim:1000 [-- 판수=1000 [매걸음저장간격=20]]   (불변식 위반·예외가 하나라도 있으면 종료 코드 1)
 *
 * 세 시대 × 두 전략(자동 모드 / 무작위 수동 흉내) × 판수 = 기본 6000판을 세션 reducer로 타이틀부터 다시 태어나기까지 끝까지 돌리며 점검한다.
 * 점검 항목과 기준은 scripts/pipelineLib.ts 머리말. 같은 계산을 테스트(tests/pipeline.test.ts)도 6000판 전부 돌린다(기본 npm test에 포함).
 */
const lives = Number(process.argv[2] ?? 1000);
const every = Number(process.argv[3] ?? 20);
if (!Number.isInteger(lives) || lives < 1 || !Number.isInteger(every) || every < 0) {
  console.error('사용법: npm run sim:1000 [-- 판수(1 이상 정수) [매 걸음 저장→복원 간격(0 이상 정수, 0이면 없음)]]');
  process.exit(2);
}

const f = (n: number, d = 1) => n.toFixed(d);
const dist = (label: string, d: Dist, digits = 1) => `    ${label.padEnd(24)} 평균 ${f(d.mean, digits).padStart(6)} | 최소 ${f(d.min, digits).padStart(6)} | 5% ${f(d.p05, digits).padStart(6)} | 중앙 ${f(d.p50, digits).padStart(6)} | 95% ${f(d.p95, digits).padStart(6)} | 최대 ${f(d.max, digits).padStart(6)}`;

console.log(`1000판 전체 파이프라인: 시대 ${ERAS.length}개 × 전략 ${PIPELINE_STRATEGIES.length}개(자동 모드 / 무작위 수동 흉내) × ${lives}판 = ${ERAS.length * PIPELINE_STRATEGIES.length * lives}판`);
console.log(`경로: 첫 화면 → 세상·인생 길이 고르기 → 태어나기 → 인생(세션 reducer: 한 해씩·다음 결정으로·선택·자동 선택) → 사망 → 엔딩 회고(reviewEnding) → 다시 태어나기 → 새 판 출생·첫 결정`);
console.log(`저장 검증: 단계가 바뀌는 지점·선택지·엔딩·다시 태어난 직후는 모든 판에서, ${every > 0 ? `매 걸음은 ${every}판마다 한 판(그 판은 매 걸음 복원한 상태로 이어간다)` : '매 걸음은 하지 않음'}\n`);

const started = Date.now();
const reports: CellReport[] = [];
for (const era of ERAS) {
  for (const strategy of PIPELINE_STRATEGIES) {
    const t0 = Date.now();
    const r = runPipelineCell(era, strategy, { lives, stepSerializeEvery: every });
    reports.push(r);
    const j = r.journeys;
    console.log(`[${era} / ${strategy === 'auto' ? '자동 모드' : '수동 흉내'}] ${r.lives}판, 위반이 있는 판 ${r.failedLives}, 예외 ${r.exceptions}, 위반 메시지 ${r.problemCount}건 (${f((Date.now() - t0) / 1000)}초)`);
    console.log(dist('사망 나이', r.deathAge));
    console.log(dist('선택지 수', r.choices));
    console.log(dist('1배속 수동(분, 18초)', r.minutes1x));
    console.log(dist('8배속+다음결정(분,18초)', r.minutesFast));
    console.log(`    엔딩 회고: 20세 전 사망 ${j.early} / 앞섬 ${j.up} / 비슷함 ${j.same} / 뒤쪽 ${j.down}${j.none > 0 ? ` / 끝까지 못 감 ${j.none}` : ''} | 서로 다른 이름 ${r.distinctNames}개`);
    console.log(
      `    점검: 이름 ${r.checks.names}회, 걸음 불변식 ${r.checks.transitions}회, 저장→복원 ${r.checks.roundTrips}회(매 걸음 저장한 판 ${r.stepSerializedLives}), 연타 입력 ${r.checks.duplicateInputs}회, 엔딩 문장 ${r.checks.endingTexts}판, 다시 태어나기 ${r.checks.rebirths}회\n`,
    );
    for (const p of r.problems) console.log(`    위반: ${p}`);
  }
}

const total = reports.reduce((a, r) => a + r.lives, 0);
const failed = reports.reduce((a, r) => a + r.failedLives, 0);
const exceptions = reports.reduce((a, r) => a + r.exceptions, 0);
const problemCount = reports.reduce((a, r) => a + r.problemCount, 0);
const sum = (f2: (r: CellReport) => number) => reports.reduce((a, r) => a + f2(r), 0);
console.log(`합계: ${total}판, 위반이 있는 판 ${failed}, 예외 ${exceptions}, 위반 메시지 ${problemCount}건 — 걸린 시간 ${f((Date.now() - started) / 1000)}초`);
console.log(
  `점검 횟수: 이름 ${sum((r) => r.checks.names)} / 걸음 불변식 ${sum((r) => r.checks.transitions)} / 저장→복원 ${sum((r) => r.checks.roundTrips)} / 연타 입력 ${sum((r) => r.checks.duplicateInputs)} / 엔딩 문장 ${sum((r) => r.checks.endingTexts)} / 다시 태어나기 ${sum((r) => r.checks.rebirths)}`,
);
if (failed > 0 || exceptions > 0 || problemCount > 0) {
  console.error('실패: 위 위반 메시지를 확인한다');
  process.exit(1);
}
console.log('통과: 에러 0건');
