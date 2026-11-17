# CX-006 검증 결과 (Codex 작성)

- 대상 브랜치·커밋: `review/CX-006`, HEAD `5b8dc26a32523ec066fcf4dedc6adf3a73899d97`. 비교 기준 `c09afd6915562a5830c80d82fcc4e161f287ae0c` → 구현 대상 `f285373e2f706ee56964a8f7b7e2468a27a4ac88`. 대상과 HEAD 사이의 감사 대상 코드·시험·설계 차이는 없음.
- 검토 범위(읽은 파일·돌린 시험): 요청서 전체에 따른 **유형 A 구현 감사**, 질문 1~8. G2 동반 해결·난수·저장·틱·화면·판 길이/경제/스탯 임계·측정 도구. 실제 v0.6.0 소스를 추출한 독립 비교, 현재 함수·reducer·SSR 탐침, 관련 Vitest, 기존 브라우저 시험, 실제 통계 재측정을 수행했다. 세부 범위와 한계는 아래에 기록.
- 읽지 않은 경로 준수: **아니오 — 결정 파일 구간 제한에 부분 위반이 있었다.** UI 분담에서 허용 구간 옆 후속 246의 3줄·256의 1줄, 측정 분담에서 후속 242·246·256의 각 3줄 및 제목 검색의 인접 2줄(합계 11줄, 분담 간 중복 가능)이 부수 출력됐다. 해당 내용을 감사 근거에서 제외했다. 다른 `docs/review/` 기록, `qa/`, `docs/TODO.md`, `wiki/`, 허용된 두 파일 밖의 `ai-log/` 파일은 열지 않았다. 특히 G2-dev·G2-econ과 작성자 측 다른 검증 결과는 읽지 않았다.
- 검증 시작·끝 시각: **2026-11-18 01:08:35 +09:00 ~ 2026-11-18 01:30:53 +09:00** (Asia/Seoul).
- 판정: **`FINDINGS` — 중간 1건.**

엔진·저장·G2 효과 전달·틱 집계에서 재현된 결함은 없었다. 확정 지적은 **느린 독자 시간 가드가 설명과 다르게 완화되어 현재 표본의 40분 초과를 통과시키는 문제**다. 이 결과는 전체 T3 통과 선언이 아니다.

## 지적

### CX-006-001

- 심각도: **중간**
- 규칙: `NEW`
- 위치: `tests/judgeMargins.test.ts:57`(새 `floor: 0, lineOnly: true`), `:72`(`margin + 1.5`), `:51`(“줄별 0 SE, 상한을 넘지 않음”); `scripts/marginsLib.ts:176`(느린 독자 상한 40분).
- 문제: 알파 느린 독자 줄의 예외 하한을 `floor: 1.5`에서 `0`으로 내렸지만, 줄별 판정은 여전히 실제 여유에 **+1.5 SE**를 더한 뒤 비교한다. 따라서 주석에서 약속한 실제 여유 `≥0` 대신 **`≥−1.5 SE`**까지 통과한다. 36→36.5분으로 승인된 세 시대 평균 상한 조정과 별개인 **40분 느린 독자 가드**가 추가로 느슨해졌다.
- 재현 조건과 근거(시험 코드·시드·상태·명령):

  1. 아래 재현 코드가 현행과 `c09afd6`의 **실제 `KNOWN_UNDER3`·함수·줄별 단언식**을 추출하여 실행한다. `margin=-1.5`와 `-1.0` 모두 기준 버전은 거부하지만 현행은 통과한다. 단순히 같은 식을 새로 작성해 비교한 것이 아니다.
  2. `marginReport(1000)`의 4개 표본 줄 × 3세대 = **12,000판**을 실행했다. 시드·선택 정책은 현재 `MARGIN_LINES`를 그대로 썼다. 루트도 별도로 재실행하여 아래 값과 판정 차이를 확인했다.

  | 알파 느린 독자 모델 | 평균 ± SE(분) | 40분까지 여유 |
  |---|---:|---:|
  | 시험 · 수동 흉내 | 39.93 ± 0.12 | +0.572059 SE |
  | **시험 · 자동 성향** | **40.15 ± 0.12** | **−1.220990917 SE** |
  | sim:1000 · 수동 흉내 | 39.65 ± 0.13 | +2.665944 SE |
  | sim:1000 · 자동 성향 | 39.57 ± 0.14 | 약 +3.0 SE |
  | 합친 4줄 | 39.82 ± 0.06 | +2.722976 SE |

  실제 초과 줄은 보정 후 `−1.220990917 + 1.5 = 0.279009083 ≥ 0`이 되어 현행 단언의 실패 목록에서 사라진다. 같은 실측 결과를 기준 버전의 단언에 넣으면 이 줄이 실패 목록에 남는다. 현재 단언의 전체 실패 목록은 `[]`였다.

  ```powershell
  & './node_modules/.bin/vite-node.cmd' '.cx006-metrics-margins.ts'
  & './node_modules/.bin/vite-node.cmd' '.cx006-metrics-margins.ts' --measure
  ```

- 실제 영향: **현재 표본에서도 모델 평균 약 40.15분인 줄을 “40분 상한을 넘지 않음” 예외로 통과시킨다.** 판 길이 증가를 보고하도록 둔 가드가 초과를 놓치며, 합친 평균 39.82분만 보고하면 이 차이가 가려진다. 이는 플레이어의 실제 벽시계 시간을 잰 결과가 아니라 기존 느린 독자 모델의 재측정 결과다.
- 권장 대응: 줄별 실제 하한을 0 SE로 보장하도록 예외값과 +1.5 보정을 맞춘다. 현재 초과 줄의 **40.15±0.12분**을 별도로 보고하고 처리 방침을 결정한다. 내용을 줄이거나 상한을 추가 변경하는 판단은 이 감사에서 하지 않는다. 음수 여유와 0의 경계가 각각 거부·허용되는 시험으로 예외의 실제 뜻을 고정하는 것이 좋다.
- 미확인 사항: 실제 사용자 독서 시간·전체 v0.6.1 판 길이는 미확인이다. 현재 구현에서 모델 초과와 검사 통과가 함께 발생하는 사실은 재현했다. 다른 모든 `KNOWN_UNDER3` 항목이 잘못됐다는 뜻은 아니다.

## 검토 범위와 확인된 불변

### 1. 엔진·난수·저장·효과 전달 (질문 1~5)

`git archive c09afd6 -- src`로 실제 기준 버전 소스만 임시 폴더에 추출하여 현행과 함께 로드했다. 현행의 표지 끔 결과나 작성자가 얼린 해시만을 기준 버전으로 간주하지 않았다.

| 검증 | 표본·결과 |
|---|---|
| `GATE_TOGETHER=false` 대 실제 v0.6.0 | 7세대 × 자동/첫 선택/무작위 × 20시드 = **420판**. 최종 상태·counts·마지막 틱·매 걸음 RNG 기록의 JSON 바이트 동일 |
| 동반 해가 아닌 켬 상태 | 위 표본 중 **318판**, 실제 v0.6.0과 최종 상태·counts·마지막 틱·걸음별 RNG 기록 동일 |
| persona 필드 없는 상태 | **140판**, 현행 켬과 실제 v0.6.0 동일 |
| `PERSONA_ENABLED=false` | 임시 Vite transform으로 양쪽에 동일 적용. 새 판 70개·persona가 남은 상태 70개, 총 **140판** 전체 실행 결과 동일. 원본 스위치 파일은 수정하지 않음 |
| 15세 난수 | **420개 상태**에서 동반 해만 해결 한 칸 추가. 사망 원인 난수는 별도로 구분 |
| G2 닫기 법칙 | **420개 상태 + 사망 경계 3개** 통과. G2 해결 자체는 해를 닫지 않음 |
| 새 동반 대기 저장 | **78개** 현행 파서 직렬화·복원·이어하기 동일. 별도 표본 **1개(seed=982975298)**는 실제 v0.6.0 파서에서도 새 저장이 동일하게 열림 |
| 실제 v0.6.0의 15세 대기 | **78개**, G2 소급 삽입 없이 기존 선택만 해결하고 기준 버전과 동일 |
| 경계 | `left_school`, 인공 가족 강제 15세 3개, 중복 choose, 복원 `tick=null`, 콘텐츠에서 X가 사라져 대기가 풀리는 실제 파서 경로 확인. G2 기록 중복 없음 |

420판 비교의 시드는 `i*104729+982451653`, `i=1..20`; 무작위 선택용 별도 RNG는 `seed ^ 0x9e3779b9`다. 루트가 이 비교와 저장·효과 경계 탐침을 재실행했다. 표본에 없는 모든 시드에 대한 전수 증명은 아니다.

사망 경계는 산업화 `seed=982556382`의 15세 직전 상태에서 건강을 0으로, 진행 RNG를 각각 **6/24/214**로 두었다. 부모 `school-scholarship` / 본인 `school-bully` / 흘러감 `school-family-priority` 세 갈래 모두 `G2→X→사망`, 카드 2장·닫힌 해 1개·lead 1개·난수 7칸이었다. **상태를 바꾼 경계 탐침이며 자연 발생 사망 표본이 아니다.**

G2 적용 후의 부모·흘러감·본인 X 대기에서 스탯·플래그·집안 살림·기질 상태·RNG 전달 시점을 확인했다. 위임 X의 영향 줄도 그 대기 상태를 사용했다. 부모·흘러감과 본인 선택 사이의 기존 기질 성장 계수 차이는 새 결함으로 세지 않았다.

`src/core/session.ts`, `storage.ts`, `types.ts`, `src/data/events/`, `personaSwitch.ts`, `personaTable.ts`, `tests/fixtures/`는 기준 대비 변경이 없었다. `SCHEMA_VERSION` 9 및 저장 키 구조가 유지된다.

### 2. 화면과 시간 흐름 (질문 6)

관련 순수 함수·실제 reducer·SSR 시험에서 수동 시트 요약형, 접힘·자동·위임 전체형의 한 곳 표시, 해결 뒤 제거, 새로고침·adopt 뒤 G2 기록 1개/lead 0개, pause·자동 전환·중복 선택을 확인했다. 가림은 자연 발생 표본 **알파 seed 24 `school-bully`**, **산업화 seed 9 `school-family-priority`**의 본인/흘러감 동반 해로 검증했고 원문 노출을 발견하지 못했다.

브라우저 검증: **44 통과·18 건너뜀, 설치된 Chrome, exit 0**. 기존 `gate-together.spec.ts`와 `parent-card.spec.ts`, `parent-card-text.spec.ts`만 실행했다. 360×740·1280×800 프로젝트 및 기존 320px/글자 확대 사례를 사용했다. 18개 건너뜀은 같은 글자 확대 시험을 mobile-360 프로젝트에서만 실행하도록 둔 기존 조건이다. 신규 유형 B 시나리오나 스크린샷은 만들지 않았다.

초기 시도는 샌드박스의 localhost 접속 `EACCES`, 이어 기본 Playwright Chromium 실행 파일 부재로 시험 본문에 도달하지 못했다. 패키지·브라우저를 설치하지 않고 **이미 설치된 Chrome**을 쓰는 임시 설정으로 기존 시험을 실행했다. 이 환경 실패를 제품 결함으로 세지 않았다. WebKit·실제 스크린리더 낭독은 실행하지 않았다.

### 3. 임계·측정 도구 (질문 7~8)

- 세 시대 합친 모델 평균 **36.09±0.03분**, 상한 36.5분을 재현했다. 시대별 상한 37.5분은 유지됐다. 이 승인된 상한 조정 자체는 지적하지 않았다.
- `gateTogetherReport --only=stat20`: **3,000판 × 3세대 × 켬/끔**으로 이전·현재 `PD_AT_20`을 소수 넷째 자리까지 재현했다. 현재 20세 생존수는 산업화/ X /알파 **2,995/2,995/2,997**이다. 소스에 기록된 PL5 이전 기준값과 현재 실측을 대조했다. 알파 누적 지식 +1.1081·관계 +2.5100 등 모든 칸이 +2/+3 한도 안이다. PL5 이전 트리 자체를 다시 실행한 것은 아니다.
- 경제 무작위 **산업화 6,000판·알파 6,000판**: 40대 순자산 수저 5/1 비는 각각 **2.882767, 3.663925**, 사망 시 음수 비율 **24.4407%, 23.8485%**. 변경된 경제 예외 한계와 일치했다. 경제식 재설계의 타당성은 감사하지 않았다.
- T5 ⑦ 선별 **2개 시험 통과**, 자동 경제 성향 선별 **5개 시험 통과**. 자동 경제 시험은 실제 `PLAYS=24000`으로 기대 확률과 실제 선택의 10%p 이상 차이 및 양육 방향을 확인했다.
- `age15Branch`: 300시드 × 4세대 × 켬/끔 = **2,400판**을 실제 연표와 대조했다. G2 결정자·동반 카드 매칭 오류 0, 동반 해를 서술 대신으로 분류한 사례 0. 비동반 빈 해/서술 해의 분류 전체를 독립 재검증한 것은 아니다.
- `timeReportLib`: 100시드 × 4세대 = **400판**, 집계 `problems` 0. 틱별 대기·읽기 직접 합과 시간 추정 차이 0. 12,000판 margins의 집계 `problems`도 0이지만, 이는 **001의 시간 상한 판정이 올바르다는 뜻이 아니다.**
- `gateTogetherReport.ts:171`의 `age<=20` 종료 경계는 “20세 도달”과 “20세 해를 마친 생존”이 다를 수 있어 별도 확인했다. 지정 3,000시드 × 4세대에서는 20세 사망이 없어 분모 차이 0이었다. 현재 출력 오류로 확정하지 않았으며, 다른 시드에서의 영향은 **미확인**이다.

## 실행 기록과 한계

### 완료한 시험

| 묶음 | 실제 결과 |
|---|---:|
| `npm run typecheck` | 통과 |
| `tests/gateTogether.test.ts` | 45 통과 |
| `leadCard`, `guard`, `gentleScreens`, `timeModel` | 122 통과 |
| `dashSession`, `decisionCollapse`, `focus`, `parentCard`, `playClock` | 135 통과 |
| 불변 골든 5파일: `rngSnapshot`, `familyHash`, `economyIdentity`, `eligibilityGoldenBoundary`, `personaCondition` | 57 통과 |
| 임시 `tests/cx006-ui-temp.test.tsx` | 3 통과; 루트 재실행도 통과 |
| `parentDecisionSim -t 'T5 ⑦'` | 2 통과, 40 제외 |
| `autoEconomy -t '자동 모드 성향이 자산'` | 5 통과, 5 제외 |
| 기존 브라우저 3파일 | **44 통과·18 건너뜀, 설치된 Chrome, exit 0** |

위 Vitest는 중복 재실행을 빼고 **기존 366개·임시 3개**다. 시험 이름만 지정하고 실제로 실행되지 않은 파일은 합계에 넣지 않았다. 전체 `npm test`, e2e 전체, WebKit, `e2e:prod`, 전체 `check:economy`는 이번에 실행하지 않았다. 특히 프로덕션 초기 로드 400,000B 조건은 **미확인**이다. `check:todo` 등 금지 문서를 읽는 검사는 실행하지 않았다.

주요 명령(임시 파일은 정리 후 삭제):

```powershell
npm run typecheck
npm exec -- vitest run tests/gateTogether.test.ts
npm exec -- vitest run tests/leadCard.test.tsx tests/guard.test.tsx tests/gentleScreens.test.tsx tests/timeModel.test.ts
npm exec -- vitest run tests/dashSession.test.ts tests/decisionCollapse.test.tsx tests/focus.test.ts tests/parentCard.test.tsx tests/playClock.test.ts
npm exec -- vitest run tests/rngSnapshot.test.ts tests/familyHash.test.ts tests/economyIdentity.test.ts tests/eligibilityGoldenBoundary.test.ts tests/personaCondition.test.ts tests/cx006-ui-temp.test.tsx --maxWorkers=1 --minWorkers=1
npm exec -- vitest run tests/parentDecisionSim.test.ts -t 'T5 ⑦' --maxWorkers=1 --minWorkers=1
npm exec -- vitest run tests/autoEconomy.test.ts -t '자동 모드 성향이 자산' --maxWorkers=1 --minWorkers=1 --testTimeout=600000
& './node_modules/.bin/vite-node.cmd' '.cx006-engine-audit.ts'
& './node_modules/.bin/vite-node.cmd' '.cx006-engine-boundary.ts'
& './node_modules/.bin/vite-node.cmd' '.cx006-engine-switch.ts'
& './node_modules/.bin/vite-node.cmd' --config .cx006-engine-disabled.config.ts .cx006-engine-switch.ts
& './node_modules/.bin/vite-node.cmd' scripts/gateTogetherReport.ts --only=stat20
& './node_modules/.bin/vite-node.cmd' scripts/gateTogetherReport.ts 100 --only=cards
& './node_modules/.bin/vite-node.cmd' '.cx006-metrics-economy.ts'
& './node_modules/.bin/vite-node.cmd' '.cx006-metrics-observe.ts' branches
& './node_modules/.bin/vite-node.cmd' '.cx006-metrics-observe.ts' timing
& './node_modules/.bin/vite-node.cmd' '.cx006-metrics-observe.ts' exposure
& './node_modules/.bin/vite-node.cmd' '.cx006-metrics-margins.ts' --measure
npm exec -- playwright test -c .cx006-root-playwright.config.ts e2e/gate-together.spec.ts e2e/parent-card.spec.ts e2e/parent-card-text.spec.ts --workers=1 --max-failures=1
```

브라우저 임시 설정은 원본 설정을 가져오고 `use.channel='chrome'`, `outputDir='.cx006-root-playwright-chrome'`만 추가했다. 원본 설정·시험 본문은 수정하지 않았다.

### 자료와 독립성의 한계

- 읽은 정본: 이번 요청서·출력 템플릿, 허용 G2-plan, 지정 결정 구간, SPEC-018 PL5-G2와 SPEC-005 LR5/PD8 예외, G2 시안, 관련 copy/design-system 및 경제 가드 문서. 핵심 근거는 현재 소스와 독립 실행 결과다.
- 코드·시험: 요청서 3절의 변경 파일과 연결된 상태·저장·세션·부모 결정·가림·입력 가드·포커스·시뮬레이션 경로. 실제 기준 버전 추출은 `src/`에 한정했다.
- 요청서 1절은 G2-plan 파일을 허용하지만, 그 문서의 8-3절에는 10절을 블라인드로 두자는 이전 제안이 있다. **계획 10절도 출력되어 읽었으므로 10절 미열람에 따른 블라인드 검증이라고 주장하지 않는다.** 요청서의 허용 파일 지정을 우선했고, 작성자의 구현·측정 결론 파일은 열지 않았다. 결정 파일의 별도 구간 제한 위반은 머리말에 명시했다.
- 계획 7-2의 “얼린 표본을 엔진보다 앞선 커밋에 둠”은 이력에서 확인되지 않았다. 대상 변경의 최초 `gateTogether.test.ts`와 엔진 변경이 `1026d447`에 함께 들어 있다. 이를 제품 동작 결함으로 세지 않고, **실제 `c09afd6` 실행 대조**로 현재 끔 상태의 동일성을 별도 확인했다. 과거에 T3 전체를 실행했다는 작성자 기록은 독립 확인 범위가 아니다.
- 저장소 밖 자료·웹 출처·설치·`npx` 사용 없음. 커밋·푸시·배포 없음. 원본 코드·시험·설정·다른 문서 변경 없음. 임시 스크립트·시험·기준 소스 사본·브라우저 결과·임시 설정을 모두 삭제했다. 사용한 5199 서버는 종료됐으며 종료 후 접속 거부(ECONNREFUSED)를 확인했다. 최종 산출물은 이 `findings.md` 한 파일이다.

## CX-006-001 재현 코드

아래 내용을 저장소 루트의 임시 `.cx006-metrics-margins.ts`로 저장해 실행하면 된다. 인자 없이는 빠른 단언 경계 비교, `--measure`는 현재 12,000판 재측정과 실제 실패 목록 비교다. 실행 뒤 임시 파일을 지운다. 원본 시험·설정은 바꾸지 않는다.

```typescript
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { marginReport } from './scripts/marginsLib';

function detector(source:string){
 const from=source.indexOf('const KNOWN_UNDER3:');
 const to=source.indexOf("\ndescribe(",from);
 const declarations=source.slice(from,to);
 const emitted=ts.transpileModule(declarations,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 const assertion=source.split('\n').find(line=>line.includes('expect(report.lineUnder3.filter'))!;
 const expression=assertion.slice(assertion.indexOf('expect(')+7,assertion.lastIndexOf(').toEqual([])'));
 return Function('rows',`${emitted};const report={lineUnder3:rows};return ${expression};`) as (rows:any[])=>string[];
}
const source=readFileSync('tests/judgeMargins.test.ts','utf8');
const baseline=execFileSync('git',['show','c09afd6:tests/judgeMargins.test.ts'],{encoding:'utf8'});
const current=detector(source),old=detector(baseline);
const metric='읽기 「높음」(느린 독자) 평균 시간(분)';
for(const margin of [-1.6,-1.5,-1,0,0.5,1.5]){
 const row={metric,era:'alpha',margin};
 console.log(JSON.stringify({margin,baselineAccepts:old([row]).length===0,currentAccepts:current([row]).length===0}));
}
if(process.argv.includes('--measure')){
 const r=marginReport(1000);
 console.log(JSON.stringify({problems:r.problems,under3:r.under3,lineUnder3:r.lineUnder3,currentFailures:current(r.lineUnder3),baselineFailures:old(r.lineUnder3)}));
 console.log(r.text.split('\n').filter(line=>line.includes('세 시대 평균')||line.includes('39.82')||line.includes('40.00')).join('\n'));
}
```
