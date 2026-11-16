# CX-005 검증 결과 (Codex 작성)

- 대상 브랜치·커밋: `review/CX-005`, HEAD `3c4303e56d49510239c2e586930a89bf0f444329`. 설계 r2 대상 `2825c1116396002c4f1e7340f1941804a26a72d4`와 HEAD 사이에서 대상 설계·SPEC·`src/` 차이는 없음.
- 검토 범위(읽은 파일·돌린 시험): 유형 **C 제품 레드팀 + A 설계 감사**. 요청서 전체, `docs/data/spend-invest-model.md` 전체와 기계 판독 블록, `docs/spec/SPEC-020-돈쓰기투자.md`, `market-history.md`, `networth-distribution.md`, `economy-model.md` 관련 절, `persona-model.md` 1절, `dc4-economy.md` 연금 근거, 현재 경제·상태·저장·가족 사이·자동 진행 코드 및 관련 시험. 세부 범위·명령·재현 코드는 아래에 기록.
- 읽지 않은 경로 준수: **예**. 이번 검증에서 다른 `docs/review/` 기록, `qa/`, `ai-log/`, `docs/TODO.md`, `wiki/`를 열지 않았다. 예외는 이 요청 폴더와 `codex/TEMPLATE-findings.md`뿐이다. 요청서 2절의 측정 기록은 1절 금지 경로이므로 열지 않고 현재 코드로 새로 측정했다. 저장소 밖 자료·웹 출처는 사용하지 않았다.
- 검증 시작·끝 시각: **2026-11-14 09:43:31 +09:00 ~ 2026-11-14 10:07:40 +09:00** (Asia/Seoul).
- 판정: **`FINDINGS` — 높음 3건, 중간 9건.**

이번 결과는 구현 전 설계를 그대로 연결했을 때의 반례다. 아직 없는 `applySpend`·`withValidHold`·투자 정산 구현에 이미 장애가 발생했다고 주장하지 않는다. 현재 코어 함수를 직접 호출한 결과, 설계식을 옮긴 작은 프로토타입, 자연생애 시뮬레이션을 각각 구분했다. 원본 코드·시험·설정·문서를 고치지 않았고 커밋·푸시·배포하지 않았다.

| ID | 심각도 | 핵심 결과 |
|---|---|---|
| CX-005-001 | 높음 | 유동성 부족 결제가 차입으로 기록되지 않음. 저장 복원 여부에 따라 이자 9만 원 차이 |
| CX-005-002 | 높음 | 자기자금 검사 없이 현금·대출 0으로 3억 원 집을 구입할 수 있는 식 |
| CX-005-003 | 높음 | 일반 부채 자동 상환 뒤 전세 보증금과 총부채가 불일치하고 I3 복구 규칙도 실행 불가 |
| CX-005-004 | 중간 | 투자 예약금이 쓰기 결제 가능액에 다시 포함됨 |
| CX-005-005 | 중간 | 상한 B의 25% 통과 근거가 현재 소득 경로에서 31.61%로 뒤집힘 |
| CX-005-006 | 중간 | 뒷일 전략 게이트에 불가능한 매수 연도가 있고 주요 합법적 상승 기회가 빠짐 |
| CX-005-007 | 중간 | 자동 투자 수저 가중치가 정규화에서 전부 소거됨 |
| CX-005-008 | 중간 | 연 2·3회 항목을 같은 나이 1회로 차단하며 연간 횟수 저장 정보도 없음 |
| CX-005-009 | 중간 | 이름 있는 동행을 골라도 같은 역할의 다른 사람 사이까지 바뀜 |
| CX-005-010 | 중간 | 순자산 0의 영구 흡수·노년 보정 하한 진단이 현재 코드와 자연생애에서 반증됨 |
| CX-005-011 | 중간 | 값싼 건강 경로를 해마다 보장한다는 게이트를 항목 규칙이 충족할 수 없음 |
| CX-005-012 | 중간 | 65~69세 현실 비교 행이 두 가지라 동일 결과의 배포 판정이 달라짐 |

## 지적

### CX-005-001

- 심각도: **높음**
- 규칙: `NEW`
- 위치: `docs/data/spend-invest-model.md:141`(3-1 결제), `:96`(I2), `:106`(복원 정리), `:733`·`:734`(연말 순서); `src/core/economy.ts:185`·`:187`.
- 문제: 설계는 현금이 없으면 `net -= P` 뒤 `settleAssets`가 부족액을 빚으로 만든다고 한다. 현재 함수는 **순자산이 음수일 때만** 부채 하한을 올린다. 순자산이 투자나 집에 묶여 있으면 빚이 생기지 않는다. 투자 상태는 I2를 어긴 채 남고, 저장 복원 때와 연말에 I2를 정리하는 시점도 달라진다.
- 재현 조건과 근거(시험 코드·시드·상태·명령): 부록 `.cx005-money-probe.ts`의 `spend-investment`, `spend-home`, `spend-reload-interest`. 합성 입력 `net=10,000, debt=0, bal=10,000, liquid=0`, 필수 치료 `P=150`, 연 차입 여유 300. 결제는 허용되지만 실제 `settleAssets` 결과는 `net=9,850, debt=0`이다. 투자만 있으면 I2 정리로 잔액이 9,850으로 줄고, 집만 10,000인 경우는 총자산 `net+debt=9,850`보다 집 평가가 큰데도 I2·I3 모두 통과한다.

  복원 차이는 40세·지식 60·근로 유지·월세, 1997년 예금 수익률 `(1.1059/1.044)-1`, 흔들림 0으로 분리했다. 양쪽 현금흐름은 실제 `cashFlowOf`의 **−488**로 같다. 문서 순서대로 계속 진행하면 원금 10,000에 이자 **593**, 연말 순자산 **9,955**. 결제 직후 복원하여 I2를 먼저 맞추면 원금 9,850에 이자 **584**, 연말 **9,946**이다.
- 실제 영향: 빚을 허용한 결제가 투자 강제 처분 또는 집 평가와 맞지 않는 상태로 처리된다. 같은 선택을 해도 새로고침 여부만으로 예시에서는 **9만 원**이 달라진다. 차입 이자와 영향 줄의 부채 표시도 설계대로 나오지 않는다.
- 권장 대응: 결제 직후의 현금·투자 처분·차입을 하나의 거래로 정의하고 즉시 불변식을 만족시킨다. 투자·집을 가진 상태에서 필요한 차입은 순자산 부호에 의존하지 않게 명시한다. 저장 정규화와 계속 진행 경로가 같은 경제 상태를 반환하도록 한다.
- 미확인 사항: 실제 신규 파서·결제 구현은 없다. 9만 원은 문서가 정한 두 정리 시점을 구현한 반례이며 실제 브라우저 새로고침 장애를 재현한 것은 아니다.

### CX-005-002

- 심각도: **높음**
- 규칙: `NEW`
- 위치: `docs/data/spend-invest-model.md:520`·`:521`·`:522`·`:523`(집 구입), `:96`·`:97`(I2·I3).
- 문제: 구입 허용 조건에 **주택가격에서 대출·전세보증금을 뺀 금액을 보유 현금으로 충당할 수 있는지**가 없다. LTV·DTI는 대출 상한이고, 현금흐름 검사는 향후 비용 검사이므로 이 빠진 조건을 대신하지 못한다.
- 재현 조건과 근거(시험 코드·시드·상태·명령): `.cx005-money-probe.ts`의 `home-purchase`. 2025년·40세·지식 60·근로 유지·수저 3·비수도권·소득 조정 0, 구입 전 `net=0, debt=0, bal={}`. 소형 `P0=30,000`, `loan=0`이면 모든 비음수 LTV·DTI 상한을 통과한다. 취득비 450을 빼고 현재 `settleAssets`를 적용하면 `net=-450, debt=450, dwelling=own`; 실제 구입 후 연 현금흐름은 **+106 ≥ −300**이다. 새 `home.v=30,000`을 붙여도 I2·I3 모두 참이다.
- 실제 영향: 필요한 자기자금 **30,000만 원**을 마련하지 않고 자가 비용과 이후 집값 손익을 받는 상태를 허용한다. `net+debt=0`인데 명시적 집 평가만 30,000이 된다. 형편별 집 구입 제약과 자산 보존이 무너진다.
- 권장 대응: 예약금·취득비를 포함한 자기자금 조건과 구입 거래 전체를 명시한다. 대출·보증금으로 들어온 현금, 매입대금 지급, 집 편입을 함께 검증해야 한다. I2·I3의 부등식만으로 총자산 구성의 보존이 보장된다고 보지 않는다.
- 미확인 사항: 실제 구입 화면·이후 역사별 주택 이익은 미구현이다. 지적의 근거는 임의의 상승률이 아니라 **구입 직후의 미조달 자산**이다.

### CX-005-003

- 심각도: **높음**
- 규칙: `NEW`
- 위치: `docs/data/spend-invest-model.md:97`·`:106`·`:108`, `:528`·`:529`(전세), `:727`·`:734`(기존 상환 유지); `src/core/economy.ts:275`.
- 문제: 전세 보증금은 돌려줘야 하는 무이자 부채인데, 설계는 이자 계산에서만 제외하고 기존 총부채 자동 상환은 유지한다. 흑자 해에는 `assets.debt`가 줄어도 `home.deposit`은 그대로여서 I3를 깨뜨린다. “잔액을 줄여 I2·I3 복구”도 투자 잔액이 없는 상태에서는 해결 방법이 아니다.
- 재현 조건과 근거(시험 코드·시드·상태·명령): `.cx005-money-probe.ts`의 `deposit-amortization`, `rollback-parser`. 40세·지식 60·근로 유지·자가, `net=12,000, debt=18,000, incomeAdj=8,000`, `home={v:30,000, loan:0, deposit:18,000}`, `bal={}`. 주택·전세 평가변동을 분리한 상환 단계에서, 현재 현금흐름의 보증금 이자를 문서대로 제외하면 흑자 **8,117**, 기존 12% 상환은 **974**. 총부채가 **17,026**으로 줄지만 보증금은 **18,000**이라 I3 위반이다. 줄일 투자 잔액 키는 0개다.

  현재 파서로 `hold`를 직렬화·복원한 뒤 구버전 경제를 한 해 굴리는 경로도 실행했다. 알 수 없는 `hold`는 보존되지만 총부채는 **17,080**, 보증금은 **18,000**으로 어긋난다.
- 실제 영향: 정상적인 흑자 한 해 뒤 새 저장이 자기 불변식을 위반한다. 임의로 보증금을 줄이면 세입자 반환 의무와 집 지분이 바뀌고, 집 필드를 버리면 주택 손익이 소실된다. 롤백 위험도 문서가 든 “투자 잔액 정산 정지”보다 넓다.
- 권장 대응: 일반 대출·주택 대출·보증금의 상환 대상을 분리하고, 집 대출 상환 시 `home.loan`을 함께 갱신한다. 보증금은 실제 반환·갱신 거래에서만 바뀌도록 한다. 각 부채 유형의 복원 및 구버전 왕복 정책을 정한다.
- 미확인 사항: 신규 파서의 실제 실패 형태는 미확인. 현재 파서의 필드 보존과 현재 상환 함수가 만드는 불일치는 실행 확인했다.

### CX-005-004

- 심각도: **중간**
- 규칙: `NEW`
- 위치: `docs/data/spend-invest-model.md:141`(결제 가능액), `:428`(투자 예약).
- 문제: 투자 요청은 `liquid`를 예약하여 중복 사용하지 못한다고 하지만 결제식에는 양의 입금 예약을 빼는 항이 없다.
- 재현 조건과 근거(시험 코드·시드·상태·명령): `.cx005-money-probe.ts`의 `reservation-formula`. `net=100, bal={}, req={dep:100}`, 집·차·빚 없음. 예약 뒤 자유 현금은 0이어야 하나 결제식은 `liquid=100`을 반환하여 빚을 허용하지 않는 정장 `P=40`을 허용한다.
- 실제 영향: 사용자가 이미 예금으로 옮기겠다고 예약한 돈을 다시 쓸 수 있다. 연말 한도 적용으로 투자 요청 일부가 취소되더라도, 예약이 보장한다던 중복 사용 방지는 성립하지 않는다.
- 권장 대응: 장부상 현금과 예약 후 사용 가능 현금을 구분하고 쓰기·집·차·투자 요청 모두 같은 예약 계산을 사용한다. 출금 예정액을 실제 처리 전에 재사용할 수 있는지도 함께 정한다.
- 미확인 사항: 실제 시트의 비활성·취소 안내는 미구현이다. 이 예시로 순자산 복제까지 주장하지 않는다.

### CX-005-005

- 심각도: **중간**
- 규칙: `NEW`
- 위치: `docs/data/spend-invest-model.md:439`·`:441`(소득 비례 상한), `:461`·`:469`(25% 통과), `:1137`(B 추천); `src/core/economy.ts:101`·`:158`.
- 문제: 고정 소득 3,500으로 얻은 B안 결과를 가장 잘 아는 경로의 상한처럼 사용한다. 실제 상한은 매해 현재 소득을 읽고, 소득 급등 사건 없이도 현재 코어의 일반 근로 소득이 이 값을 넘는다.
- 재현 조건과 근거(시험 코드·시드·상태·명령): `.cx005-strategy-probe.ts`의 **`CAP_SALE_PROCEEDS_STAY_CASH`**. 1981년생·수저 1·지식 80·근로 유지·`incomeAdj=0`·월세·부채 0·2019년 초 순자산 10,000인 합성 경로. 사건은 넣지 않는다. 2019·2022년 말 매수 요청, 2021·2024년 말 전량 매도. 매도는 문서의 “목표량”에 따라 잔액 0으로 처리하며 대금은 현금에 남긴다. 예금에는 상한 초과 의무 이전만 들어간다. 실제 `cashFlowOf`·`settleAssets`와 MH 곱셈식·연간 정산·상한 재조정을 연결했고 상한은 내림했다.

  연 소득은 2019~2024년 **5,726 / 5,764 / 5,868 / 5,928 / 5,973 / 6,107**, 상한은 **286 / 288 / 293 / 296 / 298 / 305**다. 기준 종료 순자산 **17,233**, 투자 경로 **19,095**, 차이 **1,862 / 5,891 = 31.61%**. 가상자산 흔들림을 매해 가장 불리한 −15%p로 고정해도 **1,687 / 5,891 = 28.64%**다. 모든 해의 I2·가상자산 상한·부채 0 단언을 통과했다.
- 실제 영향: “최고 경로에서도 약 20%이므로 B 통과”라는 승인 근거로 25% 게이트를 보장할 수 없다. 형편이 낮은 판에서도 문서가 정한 격차 대비 허용 폭을 넘는 경로가 있다.
- 권장 대응: 고정 소득 손계산과 게이트 통과를 분리하고 현재 소득·나이·지식·모은 돈 범위를 넣어 A/B/C를 재측정한다. 40세·사망 시점 짝 시드 `F_k` 검증도 별도로 유지한다.
- 미확인 사항: 자연 출생부터의 전체 인생 분포나 `F_k > 3%p`를 입증하지 않았다. “전량 매도”를 잔액 목표가 아닌 고정 출금액으로 구현하면 그 요청 의미에 맞춰 다시 측정해야 한다. 고정 소득 3,500 자체를 곱셈식으로 재계산한 **1,127만 원·19.13%**와 문서 1,148의 작은 차이는 별도 지적으로 세지 않았다.

### CX-005-006

- 심각도: **중간**
- 규칙: `NEW`
- 위치: `docs/data/spend-invest-model.md:99`(I5), `:356`·`:371`(상품 첫해), `:758`(뒷일 전략), `:954`·`:1119`(기계 정본); `docs/data/market-history.md:975`.
- 문제: 고정 사건 목록의 `us_tech` 2019년 말 매수는 상품이 열리는 2020년보다 이르다. 반대로 근거 문서가 뒷일 전략의 주요 표적으로 든 2025년 국내 상승은 모든 사건 목록에서 빠졌다. 이 목록을 게이트로 사용하면 불가능한 거래를 허용하거나 중요한 합법적 거래를 검사하지 못한다.
- 재현 조건과 근거(시험 코드·시드·상태·명령): `.cx005-strategy-probe.ts`가 `PRODUCT`와 `EPISODE`를 직접 읽는다. `INVALID_EPISODES`는 **`us_tech, requestYear=2019, exitYear=2021` 한 건**. 합법적 첫 요청은 2020년 말, 첫 수익은 2021년이다.

  `kr_l`은 1988년에 열리므로 2024년 말 요청은 합법적이고 T1에는 보유 상한이 없다. MH `:885`의 2025년 명목 83.2%, `:223` 배당 1.3%, 물가 2.1%를 식에 넣으면 `(1+.832+.013)/(1+.021)-1 = 80.70519%`. 원금 10,000의 이익은 **8,071**, T1 흔들림 최저 −3%p에서도 **7,771**이다. 같은 해 예금 이익은 **59**. 2025년을 포함하는 `EPISODE`는 **0개**다.
- 실제 영향: 큰 역사적 상승을 기억하는 플레이어의 이익을 지배 방지 시험이 놓칠 수 있다. 완전한 오라클을 사용하지 않아도 생기는 누락이다.
- 권장 대응: 사건 목록의 매수 가능 연도·lag·매도 의미를 자동 검증하고, 근거 문서가 지정한 주요 상승·폭락 사건을 목록에 포함하거나 탐색 규칙으로 생성한다.
- 미확인 사항: 이 단일 연도 비교만으로 **전체 인생의 최고 평범 전략 대비 1.5배 게이트 위반**을 주장하지 않는다. 상품 시작 연도와 사건 목록의 불일치·누락은 확인했다.

### CX-005-007

- 심각도: **중간**
- 규칙: `NEW`
- 위치: `docs/data/spend-invest-model.md:705`·`:707`, `:1099`·`:1106`; `docs/spec/SPEC-020-돈쓰기투자.md:158`.
- 문제: `normalize(RISK[t] × TIERRISK[k])`에서 `TIERRISK[k]`는 벡터 전체에 곱하는 양의 스칼라다. 정규화의 분자·분모에서 소거되므로 낮은 수저를 보수적으로 만든다는 설명과 달리 수저별 위험 비중이 전부 같다.
- 재현 조건과 근거(시험 코드·시드·상태·명령): `.cx005-strategy-probe.ts`의 `NORMALIZE_RISK`. 기계 정본의 **6기질 × 5수저**를 계산했다. `driven`은 모든 수저에서 `[0.2,0.4,0.4]`, `quiet`는 `[0.7,0.3,0]`; 다른 네 기질도 수저별 차이 0이다.
- 실제 영향: 같은 기질과 투자 가능액이면 수저 1도 수저 5와 같은 고위험 비중을 받는다. 값 0.6·1.2를 조정하는 것만으로는 위험 감당력 차이를 만들 수 없다.
- 권장 대응: 위험 등급별 가중 벡터나 고위험 몫 자체를 조절하는 식으로 의도를 명시하고 같은 기질·같은 금액의 수저 짝에서 방향을 검증한다.
- 미확인 사항: 통합 자동 모드의 전체 자산 격차·60% 지배 빈도는 아직 측정할 구현이 없다. 지적은 위험 배분식의 무효한 수저 항에 한정한다.

### CX-005-008

- 심각도: **중간**
- 규칙: `NEW`
- 위치: `docs/data/spend-invest-model.md:69`·`:70`·`:71`(저장), `:109`(동일 나이 차단), `:145`(연간 상한), `:1002`(노래방).
- 문제: 같은 나이·항목의 사용을 무조건 거절하면 `yearly2`·`yearly3` 항목도 한 번만 사용할 수 있다. 3-1에는 `cooldown=0` 예외가 있지만, 저장 구조에 항목별 당해 사용 횟수가 없다. `used`는 마지막 나이, `times`는 평생 누적, `year`는 총비용·차입·스탯뿐이라 다음 해 초기화까지 고려한 연 횟수를 복원할 수 없다.
- 재현 조건과 근거(시험 코드·시드·상태·명령): `.cx005-root.ts`의 `ANNUAL_COUNTER`. 빈 기록의 30세가 연 3회 `fun_karaoke`를 정상적으로 세 번 확정을 시도하면 2-3 규칙은 **`[허용, 거절, 거절]`**을 낸다. 기계 블록에서 이 문제가 걸리는 연 2·3회 항목은 **8개**다: `love_date`, `trip_domestic`, `trip_camping`, `fun_karaoke`, `fun_concert`, `era_baseball`, `era_dabang`, `gift_congrats`.
- 실제 영향: 안내한 연간 이용 한도보다 일찍 막히거나, 반대로 동일 나이 차단을 제거하면 연간 한도·복원 검증을 잃는다. 평생 누적 횟수를 재활용하면 다음 해 허용량이 이전 해 사용량에 좌우된다.
- 권장 대응: 중복 확정 방지와 정상적인 반복 이용을 구분한다. 항목별 당해 횟수 및 합산 한도를 공유하는 항목의 저장·초기화 규칙을 명시한다.
- 미확인 사항: 실제 UI 연타·저장 중 종료를 실행한 것은 아니다. 상충하는 두 설계 규칙과 부족한 상태 정보를 프로토타입으로 확인했다.

### CX-005-009

- 심각도: **중간**
- 규칙: `NEW`
- 위치: `docs/data/spend-invest-model.md:87`(역할 플래그·코드 변경 0), `:149`(3회 임계), `:274`(이름 있는 동행); `src/core/familyCloseness.ts:45`·`:46`; `docs/spec/SPEC-020-돈쓰기투자.md:58`(함께 간 사람과의 사이).
- 문제: 동행을 사람별로 고르지만 효과를 `kin_trip_<role>` 하나로 저장한다. 기존 `closenessOf`는 플래그의 적용 대상을 사람 id가 아니라 역할로만 거른다. 표에 행만 더하면 함께하지 않은 같은 역할의 사람까지 사이가 좋아진다.
- 재현 조건과 근거(시험 코드·시드·상태·명령): `.cx005-root.ts`의 `TARGETED_RELATION`. 현재 `startLife(1,'millennial')`의 가족 구성을 유지하고 나이를 35로 둔 **합성 입력**이다. 실제 `familyViewOf`에서 `o1,o2,y1,y2` 네 형제가 모두 생존·별거 상태인 것을 확인했다. 프로세스 안에서 제안한 표 행 `{flag:'kin_trip_sibling', who:['sibling'], delta:1}`을 넣고 종료 전 제거했다. **o1과 3회 조건을 채운 상태로 두고** 역할 플래그를 켠 상태를 비교하면 선택한 o1은 **4→5**, 선택하지 않은 o2도 **3→4**다.
- 실제 영향: 특정 형제와 시간을 보냈는데 다른 형제와의 사이도 함께 변한다. 이름을 골라 관계를 만든다는 선택의 결과가 일치하지 않는다.
- 권장 대응: 사람 id에 연결한 사용 이력·효과를 사이 계산에 전달하는 경로를 설계하거나, 역할 전체 효과를 원한다면 동행 선택과 결과 약속을 그 의도에 맞게 바꾼다. “표 추가만, 계산 코드 변경 0” 제약으로 개인별 효과를 구현할 수는 없다.
- 미확인 사항: 완성된 여행 거래 3회를 실행한 것이 아니라 임계 조건 충족 후의 기존 사이 함수를 검증했다. 친구는 가족 보기에 포함되지 않는 현재 구조이므로 친구가 실제 동행 목록에 있는지 확인하지 않은 가상 f1·f2 반례는 최종 근거에서 제외했다.

### CX-005-010

- 심각도: **중간**
- 규칙: `NEW`
- 위치: `docs/data/spend-invest-model.md:589`·`:590`·`:592`·`:598`(원인 진단), `:615`(L1), `:630`·`:632`(하한·Stage 2), `:1167`(권고); `src/core/economy.ts:173`·`:177`·`:275`; `tests/economy.test.ts:421`.
- 문제: 현재 안전망은 **적자를 메우며 흑자는 그대로 남긴다**. 0·음수가 영구 흡수 상태이고 노년 보정으로 60세의 ≤0 비율 아래로 갈 수 없다는 진단은 성립하지 않는다. 이 진단을 근거로 Stage 2 중년 보정을 필수화하고 Stage 1 하한을 25~30%로 정한 결론도 뒷받침되지 않는다.
- 재현 조건과 근거(시험 코드·시드·상태·명령): 부록의 노년 스크립트와 기존 시험. 직접 함수 반례는 65세·지식 60·근로 유지·월세, `net=0,debt=0,incomeAdj=0`이다. 현재 `cashFlowOf`는 **소득 2,638−생활 1,056−의료 400−주거 417 = +765**, 보조 0을 반환한다. `yearlyAssets` 결과는 **net=765**다.

  자연생애는 산업화·밀레니얼·알파 × 무작위·자동 × 기준/L1/L1+L2/L1+L2+L3 × 300시드 = **7,200판**. `i=1..300`, `seed=(i*2654435761)>>>0`. 현재 시뮬레이터와 의존 파일만 임시 복제하고 경제식에 문서의 **F=1,200, K=15,000, 연금=1,030/910/828/692**를 적용했다. 쓰기·투자·중년 보정은 넣지 않았다. 원본과 복제 기준의 최종 상태 전체 JSON은 18판에서 같았고, 변경군의 65세 이전 경제 추적은 모두 기준과 같았다. 결과는 사망한 해 정산·상속까지 끝난 `final.assets.net`이다.

  | 밀레니얼, 각 300판 | 기준 | L1 | L1+L2 | L1+L2+L3 |
  |---|---:|---:|---:|---:|
  | 자동 종료 ≤0 | 142 (47.333%) | 73 (24.333%) | 72 (24.000%) | 52 (17.333%) |
  | 무작위 종료 ≤0 | 119 (39.667%) | 58 (19.333%) | 54 (18.000%) | 45 (15.000%) |

  루트가 **밀레니얼 자동 300시드 × 기준/L1/L123 = 900판**을 독립 재실행하여 142/73/52를 다시 단언했다. 60세 값은 60세 사건·선택 적용 뒤 그해 경제 정산 직전의 `before`다. 같은 60세 도달자 **295명**으로 분모를 고정해도 60세 ≤0는 **69/295=23.390%**, L123 종료 ≤0는 **51/295=17.288%**다. 60세 ≤0였던 **32명**이 양수로 마친다. L1만으로도 기준 음수 종료 95판 중 **48판의 금액이 변하고 22판이 양수 종료**했다. 밀레니얼 자동 기준 자연 300판 중 63판에는 65세 이후 `before<=0 && before+flow.total>0`인 해가 있다.
- 실제 영향: 노년 보정의 효과를 과소 추정하고 중년 경제 전체 재조정·관련 배포 지연을 수학적 필수처럼 결정하게 된다. 실제로는 노년 보정만으로도 문서가 말한 하한보다 낮아질 수 있다.
- 권장 대응: 적자일 때의 정체와 영구 흡수를 구분한다. 동일 생애 집단의 회복·악화·사망을 추적한 레버별 결과로 Stage 1 기대치와 Stage 2 필요성을 다시 판단한다.
- 미확인 사항: **≤10% 배포 조건을 충족했다는 뜻은 아니다.** L123 자동은 여전히 17.333%이고 끝 수저 칸은 48.000/8.667/13.000/26.667/3.667%여서 칸별 8%p 조건도 통과하지 못했다. 300판 표본은 전체 6,000판 가드가 아니다. L123의 재력 1·2 종료 중앙값이 1,200으로 붙는 위험은 문서가 이미 예상한 것으로 새 지적에 세지 않았다. 산업화 자동에서는 사망 나이가 3판 바뀌었으므로 “65세 이전 동일”을 “전체 판 길이 동일”로 확대하지 않는다.

### CX-005-011

- 심각도: **중간**
- 규칙: `NEW`
- 위치: `docs/data/spend-invest-model.md:145`(쿨다운·평생 상한), `:201`·`:227`(건강 경로), `:771`(매년 값싼 길), `:996`·`:1007`·`:1008`·`:1009`·`:1010`·`:1011`; `docs/spec/SPEC-020-돈쓰기투자.md:139`.
- 문제: 수저 1에도 관계·건강·학업의 값싼 길 `P≤30`을 **해마다** 하나씩 보장한다는 게이트와 건강 항목의 보임·가격·재사용 규칙이 양립하지 않는다. 항목 개수 문제가 아니라 실제 사용 이력을 포함한 접근성 문제다.
- 재현 조건과 근거(시험 코드·시드·상태·명령): `.cx005-root.ts`의 `CHEAP_HEALTH_2006_AGE25`. 1981년생 밀레니얼의 2006년·25세, 수저 1, `hobby_sport`를 이전에 한 번 사용한 상태. 이 취미는 평생 1회다. 해당 연도·나이에 남는 건강 항목은 치과 **250**과 치료 **150**뿐이며, 치료의 건강 조건까지 완화해 세어도 `P≤30`인 경로는 **0개**다. 건강검진은 30세부터, 헬스장은 2012년부터다. 이후에도 검진은 2년 쿨다운이고 헬스장 가격은 69라 매년 경로를 보장하지 않는다. 건강을 올리는 경로는 문서 `:227`의 다섯 항목으로 한정되어 있다.
- 실제 영향: 값싼 운동 취미를 이미 골랐던 낮은 수저 플레이어가 다음 해에는 건강을 위한 저렴한 선택을 전혀 얻지 못한다. 사용 이력 없는 정적 목록만 검사하면 이 누락이 통과할 수 있다.
- 권장 대응: 값싼 길 검증에 사용 횟수·쿨다운·연속 연도 상태를 넣고, 재사용 가능한 저비용 건강 경로 또는 이에 맞는 보장 범위를 정한다. 명세의 접근성 약속을 단순 항목 수 검사로 대신하지 않는다.
- 미확인 사항: 실제 추천·결제 화면은 미구현이다. 치료의 차입 허용은 비용 150을 30 이하로 만들지 않으므로 값싼 길 반례를 해소하지 않는다.

### CX-005-012

- 심각도: **중간**
- 규칙: `NEW`
- 위치: `docs/data/spend-invest-model.md:636`(연령 대응), `:643`(중앙값 게이트); `docs/data/networth-distribution.md:226`·`:227`·`:230`.
- 문제: 본문은 60~64세에 25,000, 65세 이상에 22,100을 쓰지만 바로 아래 배포 게이트는 60~69세에 25,000, 70세 이상에 22,100을 쓴다. 65~69세의 비교 분모가 다르다.
- 재현 조건과 근거(시험 코드·시드·상태·명령): `.cx005-root.ts`의 `AGE_GATE`. 사망 나이 67세인 합성 집단, 종료 중앙값 30,000. `:643`을 따르면 **30,000/25,000=1.2**로 배포 범위 0.7~1.3에 들어간다. `:636`과 NW 4-2를 따르면 **30,000/22,100=1.357466**으로 상한을 넘는다.
- 실제 영향: 생애 결과가 같아도 어떤 문장으로 시험을 구현하는지에 따라 노년 경제 보정과 수저 변화 장면의 배포 판정이 반대로 나온다.
- 권장 대응: 연령→현실 분포 대응을 하나로 정하고 64·65·69·70세 경계를 동일한 표에서 읽는다. P25·중앙값·끝 수저 계산도 이 대응을 공유한다.
- 미확인 사항: 실제 자연 표본이 이 경계에서 배포 판정을 뒤집는지는 측정하지 않았다. 두 명시된 식이 같은 합성 결과에 반대 판정을 내리는 것은 재현했다.

## 검토 범위·실행 결과·한계

### 질문별 결론

| 요청서 질문 | 확인 결과 |
|---|---|
| 1 돈 보존 | 001~004. 현재 경제 함수를 이용해 결제·집·보증금·예약의 반례 확인. 실제 신규 구현의 모든 순서·반올림 조합 전수 시험은 미확인 |
| 2 뒷일 전략·상한 | 005~006. 고정 소득 손계산 및 현재 소득 경로 재계산. 전체 인생의 `F_k`, 최고 평범 전략 대비 비·p95는 미확인 |
| 3 결정성 | 제안 키 5,122개에서 `stableKey` 충돌 0, 현재 파서 왕복 뒤 해시 값 변화 0, 순수 해시 호출 전후 주 RNG 불변. 재탄생 시 기존 `hold` 탈락·새 seed 확인. 신규 자동 호출과 스위치 결합의 호출 수는 미확인 |
| 4 실질 수익·지배 | 곱셈식은 확인. MH 단순 차와의 작은 산술 차 자체는 결함으로 세지 않음. 시나리오 7상품의 목표 기하 수익률을 수치적으로 재현. 가격/총수익 혼용만으로 확정 지배를 입증하지 못함 |
| 5 저장·롤백 | 현재 파서의 알 수 없는 필드 보존 확인. 001·003에서 복원 정리·부채 정합성 문제. `withValidSpend`·`withValidHold`·스위치 4조합은 미구현이므로 통합 동작 미확인 |
| 6 기존 경제·통계 | 010의 노년 후보 7,200판 및 핵심 900판 재실행. 원본과 임시 기준 동치 검사. 쓰기×사건×부모 투자×초점 결합·20세 스탯·6,000판 전체 가드는 미확인 |
| 7 자동 모드 | 007 위험 비중 소거, 011 값싼 경로 누락. 가상자산 0은 명시된 정책이므로 자체 결함으로 세지 않음. `SPR` 전체 전략 쏠림·60% 실측은 미확인 |
| 8 금지 조건·소재 | 읽은 항목·조건·효과에서 외모·성별을 직접 가격·효과로 쓰는 규칙은 발견하지 못함. 가족·연애의 관계 존재 조건만으로 성별 차별이라고 단정하지 않음. 신규 구현의 간접 흐름·정적 금지 검사 통과는 미확인 |
| 9 노년 보정 | 010·012. 흡수 상태 논증 반증, 현재 후보의 배포 조건 미충족을 함께 기록. 현실 음수 약 3%를 모든 연령의 정확한 ≤0 확률로 취급하지 않음(NW의 추산 가정·0 질량 한계) |

### 실행한 시험과 측정

```powershell
npm exec -- vitest run tests/economy.test.ts -t '노년 안전망' --maxWorkers=1 --minWorkers=1
# 7 passed, 53 skipped, exit 0

& './node_modules/.bin/vite-node.cmd' '.cx005-money-probe.ts'
& './node_modules/.bin/vite-node.cmd' '.cx005-strategy-probe.ts'
& './node_modules/.bin/vite-node.cmd' '.cx005-root.ts'
& './node_modules/.bin/vite-node.cmd' '.cx005-elderly-setup.ts'
& './node_modules/.bin/vite-node.cmd' '.cx005-elderly-run.ts' 300 0,1,2,3
& './node_modules/.bin/vite-node.cmd' '.cx005-elderly-report.ts'
& './node_modules/.bin/vite-node.cmd' '.cx005-elderly-witness.ts'
& './node_modules/.bin/vite-node.cmd' '.cx005-root-elderly.ts'
```

모두 기존 `node_modules` 사용. 설치·`npx`·서버·브라우저·외부 통신 없음. 전체 빌드·전체 시험·`check:economy`·`stat20Guard`는 이번에 실행하지 않았으므로 통과했다고 보고하지 않는다. 초기 노년 복제에서 `import.meta.glob`의 이벤트 JSON이 빠진 실행은 원본 동치 검사로 검출해 폐기했고, 이벤트 JSON을 포함한 의존 138파일로 고친 뒤의 실행만 결과에 사용했다.

세대별 항목 Jaccard도 기계 정본 41행에서 다시 계산했다. 산업화/밀레니얼 **0.689245**, 산업화/베이비붐 **0.900507**, 베이비붐/86 **0.919175**, 86/X **0.901409**, X/밀레니얼 **0.928387**, 밀레니얼/Z **0.995098**, Z/알파 **1**로 문서 손계산과 맞는다. 인접 세대 예외와 공식·보조·설계 연도의 미확정 표지는 명시된 설계 결정으로 취급했다. 저장소 밖 출처를 확인하지 않았다.

완전 오라클은 문서대로 **보고용**으로 구분했다. 2005~2025 풀의 예금·국내 대/소형·해외 대표/기술/배당·EM 7상품, λ=0.8, T2≤50%로 해마다 최고의 경로를 고르면 풀의 기하 수익 약 **19.10%**, 최고 단일 상품 목표는 **4%**였다. 미래 시나리오 해를 알아야 하는 진단이며 구현된 플레이 전략의 성과가 아니다. 싱글 플레이에서 이 극단을 허용하는 정책 자체는 지적으로 올리지 않았지만, 이를 일반적인 뒷일 전략까지 막았다는 근거로 사용할 수는 없다(006).

### 읽은 코드·근거 범위

- 정본: 요청서·출력 템플릿, 위의 SPEC 및 설계·시세·순자산 문서. 경제 모델의 3·4-1·6·10·11·16절과 관련 가드 절, 페르소나 1-2~1-4, DC4 연금 13-3 등 연결 근거.
- 현재 코드: `src/core/economy.ts`, `storage.ts`, `types.ts`, `state.ts`, `life.ts`, `persona.ts`, `personaLife.ts`, `familyRng.ts`, `familyCloseness.ts`, `familyView.ts`, `gameData.ts`, `birth.ts`, `rng.ts`, `ending.ts`, `generationMixture.ts`; `src/data/economyTable.ts`, `personaSwitch.ts`, `familyTables.ts` 및 실제 설치·시뮬레이션에서 로드하는 이벤트·자료.
- 실행 기반: `scripts/simulateLib.ts`, `scripts/economyCheckLib.ts`, `tests/economy.test.ts`, 저장 관련 시험, `package.json`. 임시 복제는 `src/`·`scripts/`·`tests/`의 필요한 상대 import만 따라갔으며 금지 경로는 복제하지 않았다.
- 정리: 임시 스크립트 8개와 `.cx005-elderly/` 전체 삭제 완료. `git diff --name-only` 결과 없음, `git status --short`는 이 `findings.md` 1개만 표시. 최종 보존물은 이 파일 하나이며 임시 실행 코드는 재현 가능하도록 아래에 텍스트로만 남긴다.

## 재현 코드

아래 코드는 이번 검증에서 실제 실행한 임시 파일의 내용이다. 재현할 때 저장소 루트에 표기한 파일명으로 잠시 저장하고 위 명령으로 실행한다. 노년 시뮬레이션은 setup을 먼저 실행한다. `.cx005-elderly/`는 원본을 고치지 않는 별도 복사본과 측정 출력 위치다. 끝나면 이 임시 파일들·폴더만 지운다. 돈·시세·규칙 프로브의 합성 상태를 자연생애 표본과 혼동하지 않는다.

<details>
<summary>.cx005-money-probe.ts</summary>

```typescript
import './src/data/installAll';
import { settleAssets, cashFlowOf, yearlyAssets, incomeOf, type EconomyContext } from './src/core/economy';
import { createInitialState, beginBirth, enterBirth, enterLife, rebirth } from './src/core/state';
import { parseGame, serializeGame } from './src/core/storage';
import { stepYear } from './src/core/life';
import { famHash01, famSeedOf } from './src/core/familyRng';
import { stableKey } from './src/core/persona';
import type { Assets, GameState } from './src/core/types';
import { ECONOMY } from './src/data/economyTable';

type Hold = { v: 1; bal: Record<string, number>; req?: Record<string, number>; home?: {kind:'small';v:number;y:number;loan:number;deposit?:number} };
type WithHold = GameState & { hold?: Hold };
const sum = (v: Record<string, number>) => Object.values(v).reduce((a,b)=>a+b,0);
const eq = (h: Hold) => h.home ? h.home.v-h.home.loan-(h.home.deposit??0) : 0;
const liquid = (a: Assets,h: Hold) => Math.max(0,a.net-sum(h.bal)-eq(h));
const i2 = (a: Assets,h: Hold) => sum(h.bal)<=Math.max(0,a.net-eq(h));
const i3 = (a: Assets,h: Hold) => !h.home || h.home.loan+(h.home.deposit??0)<=a.debt;
const base: Assets={net:10000,income:5000,debt:0,incomeAdj:0,dwelling:'rent'};
const ctx: EconomyContext={age:40,education:60,flags:new Set(['has_career']),tier:3,year:2025,birthYear:1985,regionClass:'other'};
const out=(name:string,data:unknown)=>console.log(name+' '+JSON.stringify(data));

for(const kind of ['investment','home'] as const){
  const hold:Hold=kind==='investment'?{v:1,bal:{kr_l:10000}}:{v:1,bal:{},home:{kind:'small',v:10000,y:2024,loan:0}};
  const a={...base,dwelling:kind==='home'?'own' as const:'rent' as const};
  const before=liquid(a,hold);
  const price=150;
  const permitted=price<=before+300;
  const paid=settleAssets({...a,net:a.net-price});
  const beforeI2=sum(hold.bal);
  if(!i2(paid,hold))for(const p in hold.bal)hold.bal[p]=Math.floor(hold.bal[p]*Math.max(0,paid.net-eq(hold))/beforeI2);
  out('spend-'+kind,{permitted,price,liquidBefore:before,netAfter:paid.net,debtAfter:paid.debt,expectedDebtAfter:150,balAfter:sum(hold.bal),homeValue:hold.home?.v??0,grossAssets:paid.net+paid.debt,I2:i2(paid,hold),I3:i3(paid,hold)});
}

{
  const cost=150, rate=(1+0.1059)/(1+0.044)-1;
  const spent=settleAssets({...base,net:base.net-cost});
  const initialBal=10000;
  const restoredBal=Math.min(initialBal,Math.max(0,spent.net));
  const flow=cashFlowOf({...ctx,year:1997,birthYear:1957},spent).total;
  const uninterruptedGain=Math.round(initialBal*rate);
  const restoredGain=Math.round(restoredBal*rate);
  out('spend-reload-interest',{netAfterSpend:spent.net,identicalCashFlow:flow,returnBasis:'1997 dep nominal 10.59%, CPI 4.4% (design line 424), wiggle=0',yearRate:rate,uninterrupted:{balBeforeReturn:initialBal,gain:uninterruptedGain,finalNet:spent.net+flow+uninterruptedGain},restored:{balBeforeReturn:restoredBal,gain:restoredGain,finalNet:spent.net+flow+restoredGain},reloadPenalty:uninterruptedGain-restoredGain,expectedReloadPenalty:0});
}

{
  const initial:Assets={...base,net:0,incomeAdj:0};
  initial.income=incomeOf(ctx,initial.incomeAdj);
  const P0=30000,loan=0;
  const bought=settleAssets({...initial,net:initial.net-Math.round(P0*0.015),debt:loan,dwelling:'own'});
  const hold:Hold={v:1,bal:{},home:{kind:'small',v:P0,y:2025,loan}};
  const total=cashFlowOf(ctx,bought).total;
  out('home-purchase',{initialNet:initial.net,price:P0,loan,downPaymentNeeded:P0-loan,available:liquid(initial,{v:1,bal:{}}),loanPassesAnyNonnegativeLtvDti:true,cashFlow:total,passesCashFlow:total>=-300,netAfter:bought.net,debtAfter:bought.debt,grossAssets:bought.net+bought.debt,homeValue:hold.home!.v,I2:i2(bought,hold),I3:i3(bought,hold),unfundedAsset:hold.home!.v-(bought.net+bought.debt),nextYearGainAtOnePercent:Math.round(P0*0.01)});
}

{
  const hold:Hold={v:1,bal:{},home:{kind:'small',v:30000,y:2024,loan:0,deposit:18000}};
  const initial:Assets={...base,net:12000,debt:18000,incomeAdj:8000,dwelling:'own'};
  const actual=yearlyAssets(initial,ctx);
  const originalFlow=cashFlowOf(ctx,initial);
  const modifiedFlow={...originalFlow,interest:0,total:originalFlow.total+originalFlow.interest};
  const amended=settleAssets({...initial,net:initial.net+modifiedFlow.total,debt:initial.debt-Math.min(initial.debt,Math.round(ECONOMY.repayShare*modifiedFlow.total)),income:modifiedFlow.income});
  out('deposit-amortization',{deposit:hold.home!.deposit,actualCurrentDebt:actual.debt,actualI3:i3(actual,hold),proposedInterest:modifiedFlow.interest,proposedFlow:modifiedFlow.total,proposedDebt:amended.debt,unmatchedDeposit:hold.home!.deposit!-amended.debt,I2:i2(amended,hold),I3:i3(amended,hold),balanceKeysAvailableForRepair:Object.keys(hold.bal)});
}

{
  const a={...base,net:100};
  const hold:Hold={v:1,bal:{},req:{dep:100}};
  const reserved=sum(hold.req!);
  const price=40;
  out('reservation-formula',{net:a.net,reserved,liquidByPaymentFormula:liquid(a,hold),availableAfterReservation:liquid(a,hold)-reserved,nonDebtSpendPrice:price,permittedByPaymentFormula:price<=liquid(a,hold),expectedPermitted:false});
}

{
  const born=enterLife(enterBirth(beginBirth(createInitialState(2026),'millennial')));
  const adult:WithHold={...born,age:40,familyFund:0,flags:['has_career'],pending:null,assets:{...base,net:12000,debt:18000,incomeAdj:8000,dwelling:'own'},hold:{v:1,bal:{},req:{dep:100},home:{kind:'small',v:30000,y:2024,loan:0,deposit:18000}}};
  const loaded=parseGame(serializeGame(adult)) as WithHold|null;
  if(!loaded?.assets)throw new Error('fixture failed existing parser');
  const seedBefore=famSeedOf(adult.peerSeed??adult.seed);
  const seedLoaded=famSeedOf(loaded.peerSeed??loaded.seed);
  const older:WithHold={...loaded,age:loaded.age+1,assets:yearlyAssets(loaded.assets,ctx)};
  const reloaded=parseGame(serializeGame(older)) as WithHold|null;
  if(!reloaded?.assets||!reloaded.hold)throw new Error('roundtrip failed');
  const restart=rebirth({...adult,phase:'ending',death:{age:40,cause:'probe'}},42) as WithHold;
  out('rollback-parser',{holdPreserved:JSON.stringify(loaded.hold)===JSON.stringify(adult.hold),afterOneYearPreserved:JSON.stringify(reloaded.hold)===JSON.stringify(adult.hold),I3AfterOldYear:i3(reloaded.assets,reloaded.hold),oldDebtAfter:reloaded.assets.debt,depositAfter:reloaded.hold.home!.deposit,roundtripHashEqual:famHash01(seedBefore,123,2026,0)===famHash01(seedLoaded,123,2026,0),rebirthHasHold:restart.hold!==undefined,rebirthNewSeed:restart.seed});
}

{
  const keys:Array<[string,string]>=[];
  const products=['dep','rjs','kr_l','kr_s','ind_elec','ind_heavy','ind_fin','ind_bio','ind_cons','ind_build','us_idx','us_tech','us_div','em','crypto'];
  for(let y=1940;y<=2100;y++){
    for(const p of products)for(const u of ['u1','u2'])keys.push(['spend',p+'/y'+y+'/'+u]);
    keys.push(['spend-scn','y'+y]);
  }
  for(let a=0;a<=130;a++)keys.push(['spend-auto','a'+a]);
  const tags=keys.map(([a,b])=>stableKey(a,b));
  const born=enterLife(enterBirth(beginBirth(createInitialState(125),'millennial')));
  const loaded=parseGame(serializeGame(born))!;
  const rngBefore=born.rngState;
  const h1=tags.map(tag=>famHash01(famSeedOf(born.peerSeed??born.seed),tag,0,0));
  const h2=tags.map(tag=>famHash01(famSeedOf(loaded.peerSeed??loaded.seed),tag,0,0));
  out('hash-keys',{keyCount:tags.length,stableKeyCollisions:tags.length-new Set(tags).size,roundtripChangedValues:h1.filter((v,i)=>v!==h2[i]).length,mainRngUnchanged:born.rngState===rngBefore,scope:'Existing pure hash functions; proposed h adapter represented as famHash01(seed,stableKey(namespace,key),0,0). Spend integration does not exist.'});
}
```

</details>

<details>
<summary>.cx005-strategy-probe.ts</summary>

```typescript
import fs from 'node:fs';
import { cashFlowOf, incomeOf, settleAssets, type EconomyContext } from './src/core/economy';

const md = fs.readFileSync('docs/data/market-history.md', 'utf8');
const design = fs.readFileSync('docs/data/spend-invest-model.md', 'utf8');
const section = md.split('### 4-2.')[1].split('### 4-3.')[0];
const rows = new Map(section.split('\n').filter(x => /^\| \d{4} \|/.test(x)).map(x => {
  const cells = x.split('|').slice(1, -1).map(x => x.trim());
  return [Number(cells[0]), cells.map(x => x === '' ? NaN : Number(x))];
}));
const divRows = md.split('### 2-3.')[1].split('### 2-4.')[0].split('\n').filter(x => /^\| \d{4} \|/.test(x)).map(x => x.split('|').slice(1, -1).map(x => Number(x.trim().replaceAll(',', ''))));
const div = new Map(divRows.map(x => [x[3], x[6]]));
const real = (year: number, col: number, add = 0) => {
  const row = rows.get(year)!;
  return (1 + (row[col] + add) / 100) / (1 + row[1] / 100) - 1;
};
const round = (x: number) => Math.sign(x) * Math.floor(Math.abs(x) + 0.5);
const years = [2020, 2021, 2023, 2024];
const nominal = years.map(y => ({ year: y, nominal: rows.get(y)![12], cpi: rows.get(y)![1], real: real(y, 12), gain: round(175 * real(y, 12)) }));
const sum = nominal.reduce((a, x) => a + x.real, 0);
const gain = nominal.reduce((a, x) => a + x.gain, 0);
console.log('CAP_HANDCALC', JSON.stringify({ rows: nominal, sum, unroundedGain: 175 * sum, roundedGain: gain, gap: 5891, gapShare: gain / 5891, with2019: gain + round(175 * real(2019, 12)) }));

const risk = design.split('\n').filter(x => x.startsWith('RISK |')).map(x => x.split('|').map(x => x.trim()));
const tier = design.split('\n').find(x => x.startsWith('TIERRISK |'))!.split('|')[2].trim().split(/\s+/).map(Number);
const normalizedRisk = risk.map(x => ({ temper: x[1], byTier: tier.map(t => {
  const weights = x[2].split(/\s+/).map(Number).map(n => n * t);
  return weights.map(n => Number((n / weights.reduce((a, b) => a + b, 0)).toFixed(10)));
}) }));
console.log('NORMALIZE_RISK', JSON.stringify(normalizedRisk));

const products = design.split('\n').filter(x => x.startsWith('PRODUCT |')).map(x => x.split('|').map(x => x.trim()));
const firstYear = new Map(products.map(x => [x[1], Number(x[3].split(' ')[0])]));
const episodes = design.split('\n').filter(x => x.startsWith('EPISODE |')).map(x => x.split('|').map(x => x.trim())).map(x => ({ product: x[1], requestYear: Number(x[2].split(' ')[0]), exitYear: Number(x[2].split(' ')[1]) }));
console.log('INVALID_EPISODES', JSON.stringify(episodes.filter(x => x.requestYear < firstYear.get(x.product)!)));
const kr2025 = real(2025, 5, div.get(2025));
console.log('OMITTED_KR2025', JSON.stringify({ firstYear: firstYear.get('kr_l'), requestYear: 2024, historyReturn: kr2025, principal: 10000, gain: round(10000 * kr2025), worstWiggleGain: round(10000 * (kr2025 - .03)), depositGain: round(10000 * real(2025, 2)), historicalEpisodesContaining2025: episodes.filter(x => x.requestYear < 2025 && x.exitYear >= 2025) }));
console.log('US_TECH_FIRST_YEAR', JSON.stringify({ firstRequest: firstYear.get('us_tech'), firstReturn: firstYear.get('us_tech')! + 1, inaccessible2020Return: real(2020, 9), accessible2021Return: real(2021, 9) }));

for (const education of [60, 80]) {
  const incomes = [2019, 2020, 2022, 2023].map(year => {
    const ctx: EconomyContext = { age: year - 1981, education, flags: new Set(['has_career']), tier: 1, year, birthYear: 1981, regionClass: 'other' };
    return incomeOf(ctx, 0);
  });
  const total = years.reduce((acc, year, i) => acc + round(.05 * incomes[i] * real(year, 12)), 0);
  console.log('ACTUAL_INCOME_CAP', JSON.stringify({ birth: 1981, education, capRequestYears: [2019, 2020, 2022, 2023], incomes, gain: total, gapShare: total / 5891 }));
}

const pool = Array.from({length: 21}, (_, i) => 2005 + i);
const geom = (rates: number[]) => Math.expm1(rates.reduce((a, r) => a + Math.log1p(r), 0) / rates.length);
const mean = (rates: number[]) => rates.reduce((a, r) => a + r, 0) / rates.length;
const cFor = (history: number[], target: number, lambda: number) => {
  let lo = -.8, hi = 2;
  const m = mean(history);
  const rates = (c: number) => history.map(r => Math.max(-.9, c + lambda * (r - m)));
  for(let i = 0; i < 100; i++) {
    const c = (lo + hi) / 2;
    if (geom(rates(c)) < target) lo = c; else hi = c;
  }
  return { c: (lo + hi) / 2, rates: rates((lo + hi) / 2) };
};
const series = [
  { id:'dep', col:2, target:.005, t2:false }, { id:'kr_l', col:5, target:.03, t2:false },
  { id:'kr_s', col:6, target:.03, t2:true }, { id:'us_idx', col:8, target:.04, t2:false },
  { id:'us_tech', col:9, target:.04, t2:true }, { id:'us_div', col:10, target:.035, t2:false },
  { id:'em', col:11, target:.025, t2:true },
].map(p => ({...p, ...cFor(pool.map(y => real(y, p.col, p.id.startsWith('kr_') ? div.get(y) : 0)), p.target, .8)}));
const oracle = pool.map((year, i) => {
  const safe = series.filter(p => !p.t2).sort((a,b) => b.rates[i] - a.rates[i])[0];
  const risky = series.filter(p => p.t2).sort((a,b) => b.rates[i] - a.rates[i])[0];
  const r = safe.rates[i] >= risky.rates[i] ? safe.rates[i] : (safe.rates[i] + risky.rates[i]) / 2;
  return {year, r, safe:safe.id, risky:risky.rates[i] > safe.rates[i] ? risky.id : null};
});
console.log('SCENARIO_ORACLE_DIAGNOSTIC', JSON.stringify({ productC: series.map(p => ({id:p.id,c:p.c,geom:geom(p.rates)})), oracleG:geom(oracle.map(x => x.r)), bestSingleProductG:.04, oracle20yearFactor:(1+geom(oracle.map(x => x.r))) ** 20, bestSingleProduct20yearFactor:1.04**20, minYearReturn:Math.min(...oracle.map(x => x.r)), rows:oracle }));

const runCap = (education: number, wiggle: number, enable: boolean, saleToDep = true) => {
  let assets = {net:10000, income:0, incomeAdj:0, debt:0, dwelling:'rent' as const};
  let btc = 0, dep = 0, totalBtcGain = 0;
  const trace: object[] = [];
  for (let year = 2019; year <= 2024; year++) {
    const ctx: EconomyContext = {age:year-1981, education, flags:new Set(['has_career']), tier:1, year, birthYear:1981, regionClass:'other'};
    const flow = cashFlowOf(ctx, assets);
    assets = {...assets, net: assets.net + flow.total, income:flow.income};
    const bg = round(btc * (real(year, 12) + wiggle)), dg = round(dep * real(year, 2));
    btc += bg; dep += dg; assets.net += bg + dg; totalBtcGain += bg;
    const cap = Math.floor(Math.min(.05 * assets.income, .1 * assets.net));
    if (enable && (year === 2019 || year === 2022)) btc = cap;
    if (enable && (year === 2021 || year === 2024)) {if (saleToDep) dep += btc; btc = 0;}
    if (btc > cap) {dep += btc - cap; btc = cap;}
    assets = settleAssets(assets) as typeof assets;
    if (assets.net < dep + btc || btc > cap || assets.debt !== 0) throw new Error('invariant failed');
    trace.push({year, income:flow.income, flow:flow.total, bg, dg, cap, btc, dep, net:assets.net});
  }
  return {end:assets.net, totalBtcGain, trace};
};
for (const education of [60,80]) for (const wiggle of [0,-.15]) {
  const invested = runCap(education, wiggle, true), baseline = runCap(education, wiggle, false);
  console.log('CAP_WITH_CURRENT_CASHFLOW', JSON.stringify({education, wiggle, baseline:baseline.end, delta:invested.end-baseline.end, gapShare:(invested.end-baseline.end)/5891, ...invested}));
}
for (const wiggle of [0,-.15]) {
  const invested = runCap(80, wiggle, true, false), baseline = runCap(80, wiggle, false, false);
  console.log('CAP_SALE_PROCEEDS_STAY_CASH', JSON.stringify({education:80, wiggle, baseline:baseline.end, delta:invested.end-baseline.end, gapShare:(invested.end-baseline.end)/5891, ...invested}));
}
```

</details>

<details>
<summary>.cx005-root.ts</summary>

```typescript
import fs from 'node:fs';
import assert from 'node:assert/strict';
import './src/data/installAll';
import { FAMILY_DESIGN } from './src/data/familyTables';
import { closenessOf } from './src/core/familyCloseness';
import { familyViewOf } from './src/core/familyView';
import { startLife } from './scripts/simulateLib';
const doc=fs.readFileSync('docs/data/spend-invest-model.md','utf8');
const rows=doc.split(/\r?\n/).filter(s=>s.startsWith('ITEM |')).map(line=>line.split('|').map(x=>x.trim()));
const items=rows.map(r=>({id:r[1],cat:r[2],from:Number(r[3].split(' ')[0]),to:r[3].split(' ')[1]==='-'?Infinity:Number(r[3].split(' ')[1]),age:Number(r[4]),price:r[5],cool:r[6],need:r[8]}));
const generations={industrial:[1940,1954],boomer:[1955,1963],g86:[1960,1969],genx:[1970,1980],millennial:[1981,1996],genz:[1997,2012],alpha:[2013,2020]};
const ages=[20,25,30,35,40,50];
const visible=(a:number,lo:number,hi:number)=>new Set(items.filter(i=>a>=i.age&&hi+a>=i.from&&lo+a<=i.to).map(i=>i.id));
const j=(a:Set<string>,b:Set<string>)=>[...a].filter(x=>b.has(x)).length/new Set([...a,...b]).size;
const pairs=[['industrial','millennial'],['industrial','boomer'],['boomer','g86'],['g86','genx'],['genx','millennial'],['millennial','genz'],['genz','alpha']];
const grid=pairs.map(([a,b])=>{const [al,ah]=generations[a], [bl,bh]=generations[b];const byAge=ages.map(age=>({age,a:visible(age,al,ah).size,b:visible(age,bl,bh).size,J:j(visible(age,al,ah),visible(age,bl,bh))}));return{pair:a+'/'+b,byAge,mean:byAge.reduce((n,r)=>n+r.J,0)/6};});
console.log('JACCARD',JSON.stringify(grid));
// A faithful counter example to §2-3: all eight yearlyN rows still reject a second confirmed purchase.
const yearly=items.filter(x=>x.cool.startsWith('yearly'));const age=30;let used:any={};let times:any={};const attempts=[];
for(let i=0;i<3;i++){const accepted=used.fun_karaoke!==age;attempts.push(accepted);if(accepted){used.fun_karaoke=age;times.fun_karaoke=(times.fun_karaoke??0)+1;}}
assert.deepEqual(attempts,[true,false,false]);console.log('ANNUAL_COUNTER',JSON.stringify({rows:yearly.map(x=>[x.id,x.cool]),attempts,fields:{used,times},declaredAnnualLimit:3}));
// Implement exactly the proposed table-only relation flag. No source file changes.
const rules=FAMILY_DESIGN.closeness.value.flags as any[];
rules.push({flag:'kin_trip_sibling',who:['sibling'],delta:1});
let witness:any;
for(let seed=1;seed<=100;seed++){
 const initial=startLife(seed,'millennial');const s={...initial,age:35};
 const siblings=familyViewOf(s).people.filter(p=>p.role==='sibling'&&p.state!=='gone');
 if(siblings.length<2)continue;
 const [p,q]=siblings; const a=closenessOf(p,s),b=closenessOf(q,s);
 const next={...s,flags:[...s.flags,'kin_trip_sibling']};
 const aa=closenessOf(p,next),bb=closenessOf(q,next);
 if(a<5&&b<5){witness={seed,fixture:'출생 구성은 현재 코어, 나이를 35로 둔 합성 입력',eligible:siblings.map(p=>({id:p.id,state:p.state,role:p.role})),before:{[p.id]:a,[q.id]:b},after:{[p.id]:aa,[q.id]:bb},selectedPerson:p.id,unselectedPerson:q.id,unselectedDelta:bb-b,flag:'kin_trip_sibling',condition:'선택한 사람과 3회 조건을 채워 플래그가 켜진 상태'};break;}
}
rules.pop();assert(witness&&witness.unselectedDelta===1);console.log('TARGETED_RELATION',JSON.stringify(witness));
// Affordable repeatable health paths before 1995 under the declared <=30 threshold.
const health=items.filter(i=>i.cat==='health'&&i.age<=35&&i.from<=1980&&i.to>=1980);console.log('CHEAP_HEALTH_1980_AGE35',JSON.stringify(health.map(x=>({id:x.id,price:x.price,cool:x.cool}))));
const health2006=items.filter(i=>i.cat==='health'&&i.age<=25&&i.from<=2006&&i.to>=2006);assert(health2006.every(x=>Number(x.price)>30));console.log('CHEAP_HEALTH_2006_AGE25',JSON.stringify({usedHobbySport:true,rows:health2006.map(x=>({id:x.id,price:x.price,cool:x.cool})),cheapPaths:0}));
// Representative actual-source choice truth for future repro instructions.
console.log('SOURCE_GUARDS',JSON.stringify({itemRows:items.length,rootMutation:'table push/pop only in this process',createdFiles:['.cx005-root.ts']}));
console.log('AGE_GATE',JSON.stringify({deathAge:67,cohortMedian:30000,table643Reference:25000,ratioBy643:30000/25000,gate643Pass:30000/25000<=1.3,referenceBy636AndNW:22100,ratioByNW:30000/22100,gateNWPass:30000/22100<=1.3}));
```

</details>

<details>
<summary>.cx005-elderly-setup.ts</summary>

```typescript
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const out = path.join(root, '.cx005-elderly');
const seen = new Set<string>();
function copy(rel: string) {
  rel = path.normalize(rel);
  if (seen.has(rel)) return;
  if (!/^(src|scripts|tests)[\\/]/.test(rel)) throw Error(`unexpected ${rel}`);
  seen.add(rel);
  const abs = path.join(root, rel);
  const text = fs.readFileSync(abs, 'utf8');
  const dest = path.join(out, rel);
  fs.mkdirSync(path.dirname(dest), {recursive:true});
  fs.writeFileSync(dest, text);
  if (!/\.[cm]?tsx?$/.test(rel)) return;
  for (const match of text.matchAll(/(?:from\s*|import\s*\(?\s*)['"]([^'"]+)['"]/g)) {
    const spec = match[1];
    if (!spec.startsWith('.')) continue;
    const stem = path.resolve(path.dirname(abs), spec);
    const found = [stem, stem+'.ts', stem+'.tsx', stem+'.json', path.join(stem,'index.ts')].find(f=>fs.existsSync(f)&&fs.statSync(f).isFile());
    if (!found) throw Error(`missing ${rel} -> ${spec}`);
    copy(path.relative(root, found));
  }
}
copy('scripts/simulateLib.ts');
copy('scripts/economyCheckLib.ts');
for (const name of fs.readdirSync(path.join(root,'src/data/events'))) if(name.endsWith('.json')) copy('src/data/events/'+name);
const ep = path.join(out, 'src/core/economy.ts');
let e=fs.readFileSync(ep,'utf8');
function replace(a:string,b:string) { if(!e.includes(a))throw Error('patch target missing '+a); e=e.replace(a,b); }
replace('const R1_FACTORS:', 'export let cxMode = 0;\nexport const cxFlows: any[] = [];\nexport function cxSetMode(mode: number) { cxMode = mode; cxFlows.length = 0; }\nconst cxFloor = () => cxMode >= 1 ? 1200 : 0;\n\nconst R1_FACTORS:');
replace('ECONOMY.pension.amount : 0;', '(cxMode >= 3 ? (ctx.age < 70 ? 1030 : ctx.age < 75 ? 910 : ctx.age < 80 ? 828 : 692) : ECONOMY.pension.amount) : 0;');
replace('net <= 0;', 'net <= cxFloor();');
replace('Math.max(0, assets.net) + ECONOMY.living.maxBorrow;', 'Math.max(0, assets.net) - (cxMode >= 2 && ctx.age >= 65 && assets.dwelling === \'own\' ? Math.min(Math.max(0, assets.net), 15000) : 0) + ECONOMY.living.maxBorrow;');
replace('assets.net + raw < 0 ? -(assets.net + raw) : 0;', 'assets.net + raw < cxFloor() ? cxFloor() - (assets.net + raw) : 0;');
replace('let debt = assets.debt;', 'cxFlows.push({age:ctx.age,before:assets.net,debt:assets.debt,dwelling,flags:[...ctx.flags],education:ctx.education,incomeAdj:assets.incomeAdj,...flow});\n  let debt = assets.debt;');
fs.writeFileSync(ep,e);
console.log(JSON.stringify({copied:seen.size, economyEdits:6, out:path.relative(root,out)}));
```

</details>

<details>
<summary>.cx005-elderly-run.ts</summary>

```typescript
import fs from 'node:fs';
import { simulateLife as original } from './scripts/simulateLib';
import { simulateLife } from './.cx005-elderly/scripts/simulateLib';
import { cxSetMode, cxFlows, cashFlowOf, yearlyAssets } from './.cx005-elderly/src/core/economy';
import { median } from './.cx005-elderly/scripts/economyCheckLib';
import type { ProfileId } from './src/core/types';
const n=Number(process.argv[2]??300);
const modes=(process.argv[3]??'0,1,2,3').split(',').map(Number);
const profiles=(process.argv[4]??'industrial,millennial,alpha').split(',') as ProfileId[];
const strategies=(process.argv[5]??'random,auto').split(',') as Array<'random'|'auto'>;
const seedOf=(i:number)=>(i*2654435761)>>>0;
const pct=(x:number,d:number)=>+(100*x/d).toFixed(3);
const output:any[]=[];
for(const profile of profiles) for(const strategy of strategies) {
  const pairs:any[][]=[];
  for(const mode of modes) {
    const rows:any[]=[]; const flows:any[]=[];
    for(let i=1;i<=n;i++) {
      cxSetMode(mode);
      const seed=seedOf(i);
      const life=simulateLife(seed,profile,strategy);
      if(mode===0&&i<=3) { const o=original(seed,profile,strategy).final; if(JSON.stringify(life.final)!==JSON.stringify(o)) { console.log('different keys',Object.keys(o).filter(k=>JSON.stringify((o as any)[k])!==JSON.stringify((life.final as any)[k])).map(k=>({k,original:(o as any)[k],copy:(life.final as any)[k]}))); throw Error('copy differs'); } }
      const f=cxFlows.map(f=>({...f}));
      const final=life.final;
      const row={seed,tier:final.character!.parentWealth,death:life.deathAge,net:final.assets?.net??null,debt:final.assets?.debt??null,stats:final.stats,at60:f.find(f=>f.age===60)?.before,at65:f.find(f=>f.age===65)?.before,days:life.seconds1x,pre65:f.filter(f=>f.age<65),f};
      rows.push(row); flows.push(...f);
    }
    pairs.push(rows);
    const adult=rows.filter(r=>r.net!==null);
    const eligible60=adult.filter(r=>r.at60!==undefined);
    const rec=adult.filter(r=>r.at60<=0&&r.net>0);
    const rec65=adult.filter(r=>r.at65<=0&&r.net>0);
    const recovery=flows.filter(f=>f.age>=65&&f.before<=0&&f.before+f.total>0);
    const result={profile,strategy,mode,n,adult:adult.length,deadLe0:adult.filter(r=>r.net<=0).length,deadNeg:adult.filter(r=>r.net<0).length,deadZero:adult.filter(r=>r.net===0).length,deadF:adult.filter(r=>r.net===1200).length,deadLe0Pct:pct(adult.filter(r=>r.net<=0).length,adult.length),deadZeroPct:pct(adult.filter(r=>r.net===0).length,adult.length),median:median(adult.map(r=>r.net)),tierCounts:[1,2,3,4,5].map(t=>adult.filter(r=>r.tier===t).length),tierMedians:[1,2,3,4,5].map(t=>median(adult.filter(r=>r.tier===t).map(r=>r.net))),eligible60:eligible60.length,le0At60:eligible60.filter(r=>r.at60<=0).length,le0At60Pct:pct(eligible60.filter(r=>r.at60<=0).length,eligible60.length),recoveredFrom60:rec.length,recoveredFrom65:rec65.length,recoveryCashflows:recovery.length,recoveryExample:recovery[0],recoveryLifeExample:rec65[0]?{seed:rec65[0].seed,death:rec65[0].death,tier:rec65[0].tier,at65:rec65[0].at65,net:rec65[0].net}:undefined,ages:[30,40,50,55,60,65,70,75,80,85,90].map(age=>{const a=flows.filter(f=>f.age===age);return {age,n:a.length,le0:a.filter(f=>f.before<=0).length,le0Pct:pct(a.filter(f=>f.before<=0).length,a.length),avgCash:+(a.reduce((s,x)=>s+x.total,0)/a.length).toFixed(1)};})};
    if(mode!==0&&pairs[0])Object.assign(result,{pre65Changed:rows.filter((r,i)=>JSON.stringify(r.pre65)!==JSON.stringify(pairs[0][i].pre65)).length,deathAgeChanged:rows.filter((r,i)=>r.death!==pairs[0][i].death).length,playTimeChanged:rows.filter((r,i)=>r.days!==pairs[0][i].days).length,deadNegativeChanged:rows.filter((r,i)=>pairs[0][i].net<0&&r.net!==pairs[0][i].net).length});
    output.push(result);console.log(JSON.stringify(result));
    fs.writeFileSync(`.cx005-elderly/${profile}-${strategy}-${mode}.json`,JSON.stringify(rows));
  }
}
fs.writeFileSync('.cx005-elderly/summary.json',JSON.stringify(output,null,2));
const table=[];
for(const dwelling of ['rent','own'] as const)for(const married of [false,true])for(const mode of modes){
  cxSetMode(mode);
  let a={net:25000,income:0,incomeAdj:0,debt:0,dwelling};let zero:number|null=null;let at89=0;
  const path=[];
  for(let age=65;age<=100;age++){
    const ctx={age,education:60,flags:new Set(['has_career',...(married?['married']:[])]),tier:3 as const,year:2000+age,birthYear:2000,regionClass:'other' as const};
    a=yearlyAssets(a,ctx);path.push({age,net:a.net}); if(a.net<=(mode>=1?1200:0)&&zero===null)zero=age;if(age===89)at89=a.net;
  }
  table.push({dwelling,married,mode,floorAge:zero,at89,path});
}
fs.writeFileSync('.cx005-elderly/controlled.json',JSON.stringify(table,null,2));console.log('controlled',JSON.stringify(table.map(({path,...r})=>r)));
```

</details>

<details>
<summary>.cx005-elderly-report.ts</summary>

```typescript
import fs from 'node:fs';
import './src/data/installAll';
import { wealthMixtureOf } from './src/core/generationMixture';
const med=(v:number[])=>{v.sort((a,b)=>a-b);const m=v.length>>1;return v.length%2?v[m]:(v[m-1]+v[m])/2};
const q=(v:number[],p:number)=>{v.sort((a,b)=>a-b);return v[Math.round((v.length-1)*p)]};
const fmt=(x:number)=>+x.toFixed(3);
const ps=['industrial','millennial','alpha'];
const cumulative=Object.fromEntries(ps.map(p=>{let s=0;return [p,wealthMixtureOf(p as any).map(x=>s+=x)];}));
const knots=[[-10000,.2],[0,3],[1210,10],[5108,20],[10000,29.4],[10296,30],[16472,40],[20000,44.8],[23860,50],[30000,56.9],[33050,60],[40000,65.8],[46180,70],[50000,72],[60000,76.6],[69380,80],[70000,80.1],[80000,83.4],[90000,85.8],[100000,88.1],[110020,90]];
function normal(z:number){const t=1/(1+.2316419*Math.abs(z));const d=.3989422804014327*Math.exp(-z*z/2);const p=1-d*t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));return z>=0?p:1-p;}
function standing(x:number,age:number){const [M,mean]=age<30?[5000,10796]:age<40?[15585,25060]:age<50?[28384,48389]:age<60?[31685,55161]:age<65?[25000,53591]:[22100,49279];if(x>M)return 100*normal(Math.log(x/M)/Math.sqrt(2*Math.log(mean/M)));const v=x*23860/M;if(v< -10000)return .1;for(let i=1;i<knots.length;i++)if(v<=knots[i][0]){const [x0,p0]=knots[i-1];const [x1,p1]=knots[i];return p0+(p1-p0)*(v-x0)/(x1-x0);}throw Error('CDF');}
for(const profile of ps)for(const strategy of ['random','auto']){
 let base:any[]=null;
 for(const mode of [0,1,2,3]){
  const path=`.cx005-elderly/${profile}-${strategy}-${mode}.json`;if(!fs.existsSync(path))continue;
  const rows=JSON.parse(fs.readFileSync(path,'utf8'));if(mode===0)base=rows;
  const a=rows.filter((r:any)=>r.net!==null);const a60=a.filter((r:any)=>r.at60!==undefined);const a65=a.filter((r:any)=>r.at65!==undefined);const negBase=base.filter((r:any)=>r.net<0);
  const cuts=cumulative[profile];const bands=[0,0,0,0,0];a.forEach((r:any)=>{const p=standing(r.net,r.death);bands[Math.max(0,cuts.findIndex(c=>p<=c))]++;});
  const coh60pos=a60.filter((r:any)=>r.at60<=0&&r.net>0);
  console.log(JSON.stringify({profile,strategy,mode,adult:a.length,le0:a.filter((r:any)=>r.net<=0).length,neg:a.filter((r:any)=>r.net<0).length,zero:a.filter((r:any)=>r.net===0).length,F:a.filter((r:any)=>r.net===1200).length,le0Pct:fmt(100*a.filter((r:any)=>r.net<=0).length/a.length),at60:[a60.filter((r:any)=>r.at60<=0).length,a60.length],at60le0Dead:coh60pos.length,at65:[a65.filter((r:any)=>r.at65<=0).length,a65.length],at65le0Dead:a65.filter((r:any)=>r.at65<=0&&r.net>0).length,negativeBaselineChanged:negBase.filter((r:any)=>rows.find((s:any)=>s.seed===r.seed).net!==r.net).length,negativeBaselinePositive:negBase.filter((r:any)=>rows.find((s:any)=>s.seed===r.seed).net>0).length,tierMedian:[1,2,3,4,5].map(t=>med(a.filter((r:any)=>r.tier===t).map((r:any)=>r.net))),p25:q(a.map((r:any)=>r.net),.25),median:med(a.map((r:any)=>r.net)),bands:bands.map(c=>fmt(100*c/a.length)),age60CohortDeadLe0Pct:fmt(100*a60.filter((r:any)=>r.net<=0).length/a60.length),deathChanged:rows.filter((r:any,i:number)=>r.death!==base[i].death).length}));
 }
}
```

</details>

<details>
<summary>.cx005-elderly-witness.ts</summary>

```typescript
import fs from 'node:fs';
import { cashFlowOf as realFlow, yearlyAssets as realYear } from './src/core/economy';
import { cashFlowOf, yearlyAssets, cxSetMode } from './.cx005-elderly/src/core/economy';
const baseCtx={age:65,education:60,flags:new Set(['has_career']),tier:2 as const,year:2053,birthYear:1988,regionClass:'other' as const};
const zero={net:0,income:0,incomeAdj:0,debt:0,dwelling:'rent' as const};
console.log('ACTUAL_ZERO_NOT_ABSORBING',JSON.stringify({ctx:{...baseCtx,flags:[...baseCtx.flags]},before:zero,flow:realFlow(baseCtx,zero),after:realYear(zero,baseCtx)}));
for(const mode of [0,1]) {
  cxSetMode(mode);let assets={...zero,net:-500,debt:500};const trace=[];
  for(let age=65;age<=69;age++){const ctx={...baseCtx,age,year:baseCtx.birthYear+age};const flow=cashFlowOf(ctx,assets);const next=yearlyAssets(assets,ctx);trace.push({age,before:assets.net,...flow,after:next.net});assets=next;}
  console.log('NEGATIVE_START',JSON.stringify({mode,trace}));
}
for(const profile of ['industrial','millennial','alpha']) for(const strategy of ['random','auto']) {
  const p=`.cx005-elderly/${profile}-${strategy}-0.json`;
  if(!fs.existsSync(p))continue;
  const base=JSON.parse(fs.readFileSync(p,'utf8'));
  const rows=base.filter((r:any)=>r.f.some((f:any)=>f.age>=65&&f.before<=0&&f.before+f.total>0));
  const r=rows[0];
  if(r){const f=r.f.find((f:any)=>f.age>=65&&f.before<=0&&f.before+f.total>0);console.log('NATURAL_RECOVERY',JSON.stringify({profile,strategy,count:rows.length,seed:r.seed,tier:r.tier,death:r.death,final:r.net,flow:f}));}
}
```

</details>

<details>
<summary>.cx005-root-elderly.ts</summary>

```typescript
import assert from 'node:assert/strict';
import { simulateLife as original } from './scripts/simulateLib';
import { simulateLife } from './.cx005-elderly/scripts/simulateLib';
import { cxSetMode, cxFlows } from './.cx005-elderly/src/core/economy';
const byMode:any[][]=[];
for(const mode of [0,1,3]){
 const rows=[];
 for(let i=1;i<=300;i++){
  const seed=(i*2654435761)>>>0;cxSetMode(mode);
  const life=simulateLife(seed,'millennial','auto');
  if(mode===0&&i<=3)assert.deepEqual(life.final,original(seed,'millennial','auto').final);
  rows.push({seed,death:life.deathAge,net:life.final.assets?.net,at60:cxFlows.find(f=>f.age===60)?.before,at65:cxFlows.find(f=>f.age===65)?.before,pre:JSON.stringify(cxFlows.filter(f=>f.age<65))});
 }
 byMode.push(rows);
 const adult=rows.filter(x=>x.net!==undefined),at60=rows.filter(x=>x.at60!==undefined);
 console.log('ROOT_ELDERLY',JSON.stringify({mode,n:adult.length,endLe0:adult.filter(x=>x.net<=0).length,at60n:at60.length,at60Le0:at60.filter(x=>x.at60<=0).length,endLe0Same60Cohort:at60.filter(x=>x.net<=0).length,recoveredFrom60:at60.filter(x=>x.at60<=0&&x.net>0).length,pre65Changed:mode===0?0:rows.filter((x,i)=>x.pre!==byMode[0][i].pre).length,baselineNegativeChanged:mode===0?0:rows.filter((x,i)=>byMode[0][i].net<0&&x.net!==byMode[0][i].net).length,baselineNegativeToPositive:mode===0?0:rows.filter((x,i)=>byMode[0][i].net<0&&x.net>0).length}));
}
assert.equal(byMode[0].filter(x=>x.net<=0).length,142);assert.equal(byMode[1].filter(x=>x.net<=0).length,73);assert.equal(byMode[2].filter(x=>x.net<=0).length,52);
```

</details>


