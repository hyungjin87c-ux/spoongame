# 가족 모델 설계 — SPEC-009 FM3 (`family-model.md`)

- 상태: **r1 초안 (2026-10-28, planner) — 마스터 승인 대기.** 승인 전에는 구현하지 않는다. 승인 뒤 같은 회차에 SPEC-004 TL16 소개정(K9)을 한다(13-3절 입력).
- 정본: `docs/spec/SPEC-009-가족과집.md` FA0~FA7 · FK · FS · FM3 행 · K1~K16. 자료: `docs/data/fd-a-family.md`(+`.json`) 묶음 A·A-2와 9·11절 마스터 결정. 그림 쪽 요구: `docs/design/family-scene.md`(2절 조각·3절 고르기·5절 시대의 창)·`family-art.md`. 코드 사실(읽기만 함): `src/core/family.ts` `birth.ts` `birthReport.ts` `inherit.ts` `storage.ts`(v9) `life.ts#stepYear·finishYear` `events.ts`.
- 이 문서가 하지 않는 것: `src/`·`tests/` 수정, 수집 실행, 문구(`copy.md`)·그림. 문구는 줄 종류·분류·id만 정하고 글은 FM7이 쓴다.
- **값 표기**(SPEC 머리와 같음): 근거 열의 `확인` 공식 표 값 · `확인(환산)` 공식 표에서 계산한 값(`calc`, 화면은 추정이라 쓰지 않음 — A-2 마스터 결정 1) · `추정` 연도·집단을 늘려 이은 값 · `설계값` 통계가 없어 게임이 정한 값 · `대기 B/C/D` 묶음 B(집)·C(이동·형편)·D(부가) 자료가 올 때까지 값 없음. 숫자 옆 ▲는 FM4 측정 뒤 마스터가 확정한다.
- **레코드 id 규약**: 근거로 인용하는 `fd-a#<series>`는 `docs/data/fd-a-family.json`의 `series` 이름이다(예: `fd-a#fd10_qx`). SPEC의 FD 번호(FD1…)와 다른 것을 가리키지 않는다. 저장소 기존 자료는 `dc4-economy.json`(DC4-4) 등 파일명으로 적는다.

## 0. 한눈에

### 0-1. 이 문서가 닫는 결정 (마스터 승인 대상)

| ID | 결정 | 한 줄 이유 |
|---|---|---|
| **K1** | 형제 수의 새 정의 하나 = **살아 있는 형제의 수**(태어났고 떠나지 않은 위·아래 형제 모두, 독립 여부 무관). `siblingCountOf`(상속 `÷ (형제 수+1)`)·카드·한 줄·그림·대체 글이 `FamilyView.siblingCount.living` 한 값을 읽는다. 별세한 형제는 세지 않는다(상속받을 사람이 아니고, 카드의 「형제 N명」과 같아야 하므로) | 7절 |
| **K2** | **구성이 정본.** 아래 동생은 출생 때 `family`에 정해진다. 기존 `infant-new-sibling`은 **첫째의 첫 동생에게만 반응 카드로 남기되 추첨이 아니라 구성이 정한 해에 강제로 일으킨다**(id·선택지·문장·효과 불변, 조건만 바뀜). 그 밖의 동생은 상태 변화 줄 하나. 어느 쪽이든 동생이 생기는 해 인생 기록 줄은 정확히 하나 | 7-2절. 대안 B는 7-2절 끝 |
| **K3** | 한 분 별세 플래그 = **`mother_gone`·`father_gone`**(둘 중 하나만 켜짐). `parents_gone`은 의미(두 분 모두)·세터(기존 사건)·소비자(`parentsAllGone`·`dwellingWhenParentsGone`·상속) 그대로 | 4-7절, 6절 |
| **K5** | **저장 `SCHEMA_VERSION`은 9 그대로.** `GameState.family?: FamilyData` 선택 필드 + 필드 단위 검증(`withValidFamily`) + 필드 없는 판은 `ensureFamily`가 옛 `familyOf` 결과를 스냅샷으로 삼고 새 값만 시드에서 채운다 | 2-4절 |
| **K10** | 반려동물 플래그 = **`pet_dog`·`pet_cat`·`pet_other`**(지금 함께 삶: 입양 사건이 켜고, 이별 때 `familyChangesFor`가 끈다) + **`pet_farewell`**(한 번이라도 떠나보냄, 안 꺼짐). SPEC-008이 이 이름을 따른다 | 5-1절, 6절 |
| D-1 | 난수: 출생 때 뽑는 값은 `forkRng`가 아니라 **`peerSeed`에서 파생한 태그별 독립 스트림**으로 뽑는다(FA0-2의 「추첨 순서 고정」을 「스트림 분리」로 대체). 옛 저장도 같은 값을 다시 만들 수 있고, 표가 늘어도 다른 값의 추첨이 밀리지 않는다 | 1-2절 |
| D-2 | 해시 불변 시험은 **세 층**으로 나눈다(출생 L0 · 기록 전용 L1 · 사건 변경 뒤 분포 L2). 사건 풀을 바꾸는 K2·K4와 Q2 예외 효과 때문에 「스탯·자산·플래그·엔딩 해시 일치」는 L0·L1에만 적용 | 12-1절 |
| D-3 | 가족 상태 변화는 **상태 + 인생 기록 한 줄**(`eventId` 접두어 `fam-`)이다. 줄·플래그·`family.log`를 한 함수 `familyChangesFor`가 만들고 진행 RNG를 쓰지 않는다 | 3·4절 |
| D-4 | `family` 지연 덩어리를 **둘로 나눈다**: `familyData`(표·이름 목록·소품 연도 표 — 「태어나기」 뒤 게임 데이터와 함께, 실패하면 출생과 같은 처리) · `familyArt`(조각·시대의 창 그림 — 실패하면 글만). K7 승인의 세부 조정 | 8-3절 |

### 0-2. 모듈 지도 (새 파일은 모두 `src/core/`의 순수 함수, React·`Date`·`Math.random` 없음)

| 파일 | 맡는 것 |
|---|---|
| `familyModel.ts` | 상수·타입(`FamilyData`·`FamilyView`·`PersonId`·로그 종류 코드) |
| `familyRng.ts` | `famStream(seed, tag)`·`famHash01(seed, tag, a, b)` |
| `familyBirth.ts` | `rollFamilyBirth` 외 하위 추첨(`rollGrandparents`·`rollSiblings`·`rollParentLife`·`rollEmployment`·`rollEducation`·`rollNames`·`rollHome`·`rollHometown`·`rollPets`) |
| `familyLife.ts` | 코호트 생존 곡선 `survivalCurve`·`deathAgeGiven`(FD10 합성) |
| `familyTick.ts` | `familyChangesFor`·`applyFamilyChanges`(해마다 바뀌는 형편, 줄·플래그·로그·효과) |
| `familyView.ts` | `familyViewOf`·`familyOf`(호환 계층, `core/family.ts`가 얇은 껍데기로 남음)·`householdOf`·`sceneFamilyOf` |
| `familyFlags.ts` | `FAMILY_SYSTEM_FLAGS`·`deriveFamilyFlags` |
| `familyStorage.ts` | `withValidFamily`·`ensureFamily`·`legacyFamilyFrom` |
| `data/familyTables.ts` + `data/family/*.json` | 표(지연 덩어리 `familyData`) |
| `core/era.ts`(FM5) | `eraOf` — 9절 |

기존 파일에서 바뀌는 곳(구현은 FM4): `birth.ts#generateBirth`(`family` 추가) · `birthReport.ts`(`orderSharesOf` 내보내기, 동작 불변) · `family.ts`(껍데기) · `inherit.ts#siblingCountOf` · `life.ts#stepYear`(가족 변화·강제 사건 슬롯) · `state.ts#enterLife`(처음 시스템 플래그) · `storage.ts`(`withValidFamily`) · `events.ts`(`trigger` 필드) · `eventLint.ts`(시스템 플래그 허용 목록·낱말 ↔ `requires` 점검) · `gentle.ts`(`fam-` 줄 분류, 4-9절).

### 0-3. FM4를 둘로 쪼갠다 (FM5 그림을 앞당기기 위해)

| 단계 | 들어가는 것 | 자료 |
|---|---|---|
| **FM4a 최소 코어** (8절의 `SceneFamilyState`를 채움) | 2절 스키마 전체 틀 · FA1 조부모 출생 · FA3 형제(K1·K2) · FA4 조부모 생존·동거 · FA7 중 부모 한 분 별세(K3)·부모 이혼·조부모 별세·형제 출생·독립 · 반려동물 **읽기**(K10 플래그) · K5 저장 · 시스템 플래그 · `sceneFamilyOf` | 묶음 A·A-2 (이미 있음) |
| **FM4b 모델 나머지** | FA2 학력·집안일 · 식구 이름(FD24 의존) · 성인기 식구 자리 · 형제 이른 별세(Q3, FM7 승인) | 묶음 A·A-2 + FD24 |
| **FM4c 자료 대기 칸** | FA5 집 종류·방 수(B) · FA6 고향(B·C) · FA7 이사·실직·부업·병환(C) · 반려동물 유무·가진 것(D) | 11절 표 |

K6(한 번에 낸다)에 따라 FM4a~c는 **같은 릴리스**로 나간다. 중간 빌드를 쓰는 저장은 없으므로 `family.v = 1`은 릴리스 때 확정되고 FM4a↔FM4c 사이 마이그레이션은 만들지 않는다.

## 1. 공통 약속 (FA0)

### 1-1. 시간축과 용어

- `Y` = 출생 연도, `age` = 주인공 나이, `calYear = Y + age`. 사람의 **나이**는 `calYear − 그 사람의 출생 연도`. 부모 출생 연도 = `Y − report.mother.age`(아버지도 같음). 조부모 출생 연도 = `부모 출생 연도 − 조부모의 부모 출생 때 나이`. 증조부모는 만들지 않는다.
- **별세 나이 `d`** = 그 사람 자신의 나이(「N세에 세상을 떠남」의 N). 주인공 나이로는 `goneAt = (그 사람 출생 연도 + d) − Y`(= 별세 해의 주인공 나이, 음수면 주인공이 태어나기 전). 규칙: **주인공 나이 `age`일 때의 화면 상태는 `age > goneAt`이면 떠남**이다. 별세 해(`age == goneAt`) 진행이 끝나야(`stepYear` → `age+1`) 떠난 것으로 보이고, 그 해 진행 중에 인생 기록 줄이 남는다(줄과 상태가 어긋나는 순간이 없다). 「내가 M세였던 해」의 M = `goneAt`.
- 별세 나이 상한은 100이다(`FAMILY_MAX_AGE`, 기존 100 초과 = 떠남). 표에서 `d`가 100 넘게 뽑히면 `d = 101`(= 계획 없음 — 기존 규칙인 「나이 100 초과면 떠남」이 맡는다).
- `PersonId`: `mother` `father` `pgf`(친할아버지) `pgm`(친할머니) `mgf`(외할아버지) `mgm`(외할머니) `o1`~`o4`(위 형제, 가까운 순) `y1`~`y7`(아래 동생, 태어난 순) `spouse` `c1`~`c4`(자녀). 전체 자녀 수 상한 8명(`FAMILY_MAX_CHILDREN`, 주인공 포함).
- 출산 연령: 이 모델이 **새로 만드는** 출산(조부모의 부모 출산, 아래 동생)은 어머니 나이 ≤ `MOTHER_BIRTH_MAX = 49`(`fd-a#fd1_births_by_mother_age`의 정규 계급 마지막이 45~49세, 50세 이상은 극소 — 추정 ▲)이고, 아래 동생은 기존 사건의 한계를 이어 **≤ `YOUNGER_MOTHER_MAX = 45`**(`infant-new-sibling`의 `motherAge ≤ 45`, R-268)로 더 좁힌다. 주인공 본인의 출생(기존 `PARENT_AGE_LIMITS` 16~56)은 바꾸지 않는다.

### 1-2. 난수 — 스트림 분리 (D-1)

- `famSeed = mixSeed(peerSeed, FAMILY_SALT)`, `FAMILY_SALT = 0x46414d49`('FAMI', 바꾸지 않는다). `peerSeed`는 출생 생성기가 이미 만들어 저장하는 값(`mixSeed(rng.getState(), PEER_SALT)`)이라 **진행 RNG(`rngState`)를 전진시키지 않는다**(FA0-2의 요건과 같은 효과) — `forkRng`와 달리 **저장된 판에서 같은 값을 다시 만들 수 있다**(K5의 「새 필드는 시드에서 채운다」).
- 하위 추첨마다 **독립 스트림** `famStream(famSeed, TAG)`(= `createRng(mixSeed(famSeed, TAG))`)을 쓴다. 한 추첨이 늘거나 줄어도 다른 추첨 값이 밀리지 않는다. 태그: `EMPLOY=1` `EDU=2` `HOMETOWN=3` `GRAND_AGE=4` `GRAND_LIFE=5` `GRAND_SIDE=6` `SIBLINGS=7` `NAMES=8` `HOME=9` `PETS=10` `POSSESS=11` `PARENT_LIFE=12` `ADULT=13`. 태그 값은 바꾸지 않는다(바꾸면 알려진 시드의 가족이 달라진다).
- 해마다의 판정은 `famHash01(famSeed, TAG, a, b) = mixSeed(mixSeed(mixSeed(famSeed, TAG), a), b) / 2^32`. 진행 RNG를 소비하지 않는다(RG7 방식).
- `rollFamilyBirth`가 **입력으로 받는 것**: `birthYear`·`gender`·주인공 이름(성)·`report`(지역·부모 나이·직업·주거·형제 순서)·`parentWealth`·`tilt`·`orderShares`·금지 이름 목록(주인공·또래, 6-4절). `rollBirthReport`와 같은 입력이라 두 함수는 서로의 난수를 쓰지 않는다.

### 1-3. 바꾸지 않는 것 (코드 사실 → 이 문서의 약속)

| 기존 | 약속 |
|---|---|
| `BirthReport`(월·지역·부모 나이·직업·주거·체중·형제 순서) 모양·검증·추첨 | 불변. 새 값은 `family`에만 둔다. 출생 한 줄 서술문(BR3) 불변 |
| `Housing`(자가·임차·무상)과 `conditions.housing` | 불변. 집 종류는 점유 형태에 **조건부**로 더한다(FA5) |
| 위 형제 구성: `olderSiblingsOf`·`SIBLING_GAP 2~5`·R-330·`olderSiblingDraw(seed, i)`의 해시 | **불변** — 새로 태어난 판의 위 형제는 옛 함수와 같은 값을 `family.o`에 옮겨 담는다(옛 저장 호환과 같은 코드 경로) |
| `parents_gone`·`cared_parents`·`lives_with_parents`·`moved_home`·`child_distant`·`child_left` | 의미 불변(FA7) |
| 상속 시점(두 분 모두 떠난 해 한 번)과 금액식 `INHERIT[재력] ÷ (형제 수+1)` | 시점·식 불변. 「형제 수」의 정의만 K1로 바뀜 |
| 인생 진행 RNG·최종 재산 분포표 | 불변. 가족 판정은 진행 RNG를 쓰지 않는다 |
| `HISTORY_LIMITS`(300줄)·`appendHistory`의 첫 줄 보존 | 불변. 가족 줄이 더해져도 출생 첫 줄이 밀려나지 않는지 시험 |

### 1-4. 모순 0 불변식 (시험 이름은 12절)

| ID | 불변식 |
|---|---|
| INV-1 | 이 모델이 만드는 출산의 어머니 나이는 16 이상 `MOTHER_BIRTH_MAX` 이하, 위 형제 누적 나이 차 ≤ 어머니 출생 때 나이 − 16(R-330), 조부모의 부모 출생 때 나이는 `PARENT_AGE_LIMITS` 16~56 안, 아래 동생 출생 해의 어머니 나이 ≤ `YOUNGER_MOTHER_MAX` |
| INV-2 | 떠난 사람(`age > goneAt`)은 함께 사는 사람·그림·한 줄에 없고, 카드에는 「N세에 세상을 떠남」이 있다. 한 번 떠난 사람이 돌아오지 않는다(단조) |
| INV-3 | 출생신고(부모 나이·직업·「N째」·사는 집)와 카드·그림이 같다. 단 어머니가 `homemaker`이면 직업 칸만 「집안일」로 바뀐다(`report.mother.job`은 저장 그대로) |
| INV-4 | 인생 기록·이벤트 문구의 가족 낱말이 그 시점에 실제로 있는 사람과 맞는다(`requires` ↔ 낱말, 13-2절) |
| INV-5 | 연표 줄의 가족 서술이 부모 직업·생존과 어긋나지 않는다(TL16 소개정 뒤) |
| INV-6 | 카드·한 줄·그림·대체 글·출생신고·엔딩이 **같은 `FamilyView`**를 읽는다(함수 출력 외의 계산 0) |
| INV-7 | 시스템 소유 플래그 집합 = `deriveFamilyFlags(view)`(6절) |
| INV-8 | 알린 변화는 한 번만 알린다: `(종류, 대상)`이 `family.log`에 두 번 없고, 인생 기록 `fam-` 줄 수 = 로그 중 줄을 쓴 항목 수 |
| INV-9 | `mother_gone`과 `father_gone`은 동시에 켜지지 않고, 켜진 해 < `parents_gone`이 켜진 해이거나 `parents_gone`이 그보다 먼저면 켜지지 않는다 |
| INV-10 | 형제 수: 카드의 형제 줄 수(떠난 형제 제외) = 한 줄의 형제 수 = 그림의 형제 수 = `siblingCountOf` |
| INV-11 | 그림의 사람 수 ≤ 8(주인공 포함), 반려동물 ≤ 2 |
| INV-12 | 같은 상태 → 같은 `FamilyView`·`SceneFamilyState`(새로고침 동일) |

## 2. 스키마

### 2-1. `GameState.family?: FamilyData` (출생 확정 때 한 번 + 알린 변화 로그)

정수·짧은 글자만 쓴다. 모든 칸은 **출생 때 한 번 뽑은 값이거나 알린 변화**다(FS1). 나이·생존·동거·사이·그림은 여기서 **다시 계산**한다(저장 안 함).

```ts
export interface FamilyData {
  v: 1;                                   // family 모양 버전 (저장 SCHEMA_VERSION과 별개)
  lg?: 1;                                 // 옛 저장(필드 없음)에서 만든 스냅샷: 이미 본 값을 보존, 지난 변화를 줄로 소급하지 않음
  p: [ParentData, ParentData];            // [어머니, 아버지]
  g: [GrandData, GrandData, GrandData, GrandData]; // [친할아버지, 친할머니, 외할아버지, 외할머니]
  o: SiblingData[];                       // 위 형제 (가까운 순, ≤ 4)
  y: SiblingData[];                       // 아래 동생 (태어난 순, ≤ 8 − (위 형제+1))
  c: 0 | 1 | 2;                           // 함께 사는 조부모 쪽: 0 없음 · 1 친가 · 2 외가 (FA4)
  h?: HomeData;                           // 집 (대기 B)
  t?: [number, number];                   // 고향 시도 키 번호 [어머니, 아버지] (대기 B·C)
  u?: number;                             // 가진 것 임계값 ×10000 정수 (대기 D)
  ad?: string[];                          // 성인기 식구 이름: 배우자, 자녀 (10절)
  l: number[][];                          // family.log — 알린 변화 (2-2절)
}
interface ParentData { n: string; e: 1|2|3|4|5; w: 0|1; r: number; d: number }
//   n 이름(성 포함) · e 최종 학력 5단계 · w 0 취업 / 1 집안일 · r 은퇴 나이(자기 나이, 집안일은 0) · d 별세 나이(자기 나이, 101 = 계획 없음)
interface GrandData { n: string; a: number; d: number }
//   n 이름 · a 부모가 태어날 때의 조부모 나이 · d 별세 나이(101 = 계획 없음)
interface SiblingData { n: string; g: 0 | 1; k: number; s: number }
//   n 이름 · g 0 남 / 1 여 · k 위 형제: 주인공과의 나이 차(살) / 아래 동생: 태어난 때 주인공 나이 · s 독립 나이(자기 나이, 20~30)
interface HomeData { k: number; r: number; s?: 1 }   // 주택 종류 번호 · 사용 방 수 · 셋방 딸림 (대기 B)
```

- 사람 이름은 **문자열로 저장**한다(이름 풀이 개정돼도 이어하기 판의 식구가 바뀌지 않게 — FS1). 반려동물 이름은 목록 번호(`PET_NAMES`는 **끝에만 추가**하는 표 — 순서를 바꾸면 시험이 앞 N개 해시로 막는다).
- 부모의 **출생 연도·직업 대분류**는 `report`에 있어 다시 쓰지 않는다. 어머니 `w = 1`이면 화면 직업은 「집안일」이다.
- 아래 동생의 존재는 출생 때 정해지지만 **출생신고에는 위 형제만 적는다**(6-4절, 형진 님 확인 요청).

### 2-2. `family.log` — 알린 변화 (정수 배열 `[종류, 주인공 나이, 대상, 부가]`)

| 종류 | 코드 | 대상 코드 | 부가 | 줄 | 분류(`gentle`) |
|---|---|---|---|---|---|
| 동생 출생 | 1 | `20+j`(y_j) | 1 = 반응 카드가 줄을 대신함 | 카드 없으면 `fam-sib-born` | – |
| 형제 독립 | 2 | `10+i`(o_i) / `20+j`(y_j) | 0 | `fam-sib-left` | – |
| 형제 별세(Q3 사건) | 3 | 〃 | 별세 나이 | 사건 자신의 줄(`eventId`는 사건 id) | `loss`(사건 표지) |
| 조부모 별세 | 4 | 3~6(pgf pgm mgf mgm) | 0 | `fam-gp-gone` | `loss` |
| 부모 한 분 별세 | 5 | 1 mother / 2 father | 0 | `fam-parent-gone` | `loss` |
| 부모 이혼·별거 | 6 | 1 어머니가 떠남 / 2 아버지가 떠남 | 0 | `fam-parents-apart` | `home` |
| 이사 | 7 | 0 | 시군구 번호(대기 C) | `fam-moved` | `home` |
| 부모 실직·휴업 / 복귀 | 8 / 9 | 1·2 | 0 | `fam-job-loss` / `fam-job-back` | `work` |
| 부모 병환 | 10 | 1·2 | 0 | `fam-illness` | `health` |
| 반려동물 입양 / 이별 | 12 / 13 | 30+n | 종 코드 / 이름 번호 | `fam-pet-in`(대표만) / `fam-pet-out` | – / `loss` |
| 첫 가전·물건 | 14 | 항목 번호 | 0 | `fam-possess`(판당 ≤ 5) | – |
| 배우자 맞음 / 자녀 태어남 | 15 / 16 | 0 / 1~4 | 성별 | (줄 없음 — 카드만, 10절) | – |

- 로그는 **추가만** 한다. `(종류, 대상)` 중복 금지(INV-8). 계획(스냅샷의 별세 나이 등)과 로그가 어긋나면 **로그가 이긴다**(알린 말이 정본).
- `종류 12`의 입양 나이와 종·이름은 로그가 처음이자 유일한 저장이다(입양 사건이 켠 `pet_*` 플래그를 `familyChangesFor`가 처음 본 해에 기록).

### 2-3. 크기와 검증

- 크기: `JSON.stringify(state.family).length ≤ 1000`자(저장 추가량 ≤ 1KB, 마스터 승인). 추정: 이름 13개 ≈ 90자 + 숫자·키 ≈ 280자 + 로그 항목당 ≈ 12자 × 평균 30개 ≈ 360자 ≈ **730자**. 최악(형제 7명·로그 40개)은 7000판 시험이 잰다(`tests/familyStorage.test.ts`). 넘으면 로그 항목의 나이·대상을 한 정수로 묶는 압축을 먼저 쓰고, 그래도 넘으면 마스터에게 올린다.
- 필드 단위 검증 `withValidFamily(state)`: `v === 1` · 구조 모양(위 타입) · 이름은 한글 2~5자(`CHARACTER_NAME_PATTERN` 방식, 숨은 문자 거부) · 수 범위(`a` 16~56, `d` 0~101, `k` 위 형제 1~20·아래 0~20, `s` 20~30, `e` 1~5) · 위 형제 수 = `olderSiblingsOf(birthOrder)` 이하 · 총 자녀 수 ≤ 8 · `l` 항목은 4칸 정수·종류 코드 허용 목록·나이 0~`state.age`·중복 없음 · 사람 수 한도. **하나라도 어긋나면 판을 버리지 않고 그 필드만 버린다**(`withValidPlay` 방식) → `ensureFamily`가 다시 만든다.
- 출생 전(`title`) 단계에 `family`가 있으면 그 필드만 버린다(출생 이후 단계에만 존재, `regionPicked` 방식).

### 2-4. 저장 방침 (K5) — 버전 9 유지, 선택 필드

- `SCHEMA_VERSION`은 **9 그대로**. 근거: SPEC-004 N24가 정한 「앞으로의 선택 필드는 필드 단위 검증, 버전을 올리지 않는다」(`storage.ts` v9 주석)이고, 올리면 v0.3.0으로 진행 중인 판이 모두 새 게임이 된다(C6 안내 대상). 올릴 이유가 없다.
- `parseGame` 끝에 `withValidFamily`를 붙이고(다른 `withValid*`와 같은 줄), 앱이 판을 열 때 `ensureFamily(state)`가 필드가 없거나 버려진 판에 `family`를 채운다. `ensureFamily`는 **순수 함수**이고 다음 저장 때 기록된다.
- **옛 저장(필드 없음) 처리 `legacyFamilyFrom(game)`** — 「이미 본 값을 바꾸지 않는다」(DF25):

| 칸 | 옛 저장에서 |
|---|---|
| 위 형제 `o` | 옛 `familyOf`의 위 형제 그대로(`olderSiblingDraw(peerSeed ?? seed, i)` 해시 + R-330 한도). 이름만 새로 채움 |
| 아래 동생 `y` | `seen['infant-new-sibling']`이 있으면 1명(`k` = 그 나이), 없으면 없음. **더 늘리지 않는다**(이미 본 구성) |
| 어머니·아버지 `w` | 둘 다 0(취업) — 옛 화면이 직업을 보였으므로 집안일로 바꾸지 않는다. `e`(학력)는 시드로 채움 |
| 조부모 `g`·`c`·`p.d` | 시드로 채움(옛 화면에 없던 값). **지난 해의 별세는 줄로 소급하지 않고 로그에도 안 쓴다**(`lg: 1` — 상태만 반영, 카드 「떠난 가족」에는 보임) |
| 부모 이혼·한 분 별세 | 지난 해에 해당하면 소급 없이 상태만. 앞으로의 해만 새 규칙 |
| 이름·집·고향·반려동물·가진 것 | 시드로 채움. 옛 `Housing`·직업은 그대로 |

- 이전 빌드가 새 저장을 열면 모르는 필드·플래그를 무시하고 다음 저장 때 지운다(`checkGameState`는 모르는 키를 거부하지 않고 `FLAG_PATTERN`을 통과하는 플래그만 본다) — 새 빌드로 돌아오면 `ensureFamily`가 다시 채운다. 이 방향은 시험이 **관찰**만 한다(실패 조건 아님).
- 이어하기 호환 시험(reviewer 확인): 이전 빌드(v0.3.0)가 만든 저장 원문 3종(0세·20세·65세)을 **고정 파일**로 두고(`tests/fixtures/save-v030-*.json`) 새 빌드가 열어 같은 판이 이어지는지(스탯·자산·플래그·기록 불변, `family` 채워짐).

## 3. 함수 시그니처

```ts
// familyModel.ts
export const FAMILY_SALT = 0x46414d49;
export const FAMILY_MAX_CHILDREN = 8;
export const MOTHER_BIRTH_MAX = 49;       // 모델이 새로 만드는 출산의 어머니 나이 상한 (추정 ▲, 1-1절)
export const YOUNGER_MOTHER_MAX = 45;     // 아래 동생 출산 (기존 infant-new-sibling motherAge ≤ 45)
export const EARLY_LOSS_MAX_AGE = 19;     // 「이른」 부모 별세 = 주인공 19세 이하 (4-7절)
export const LEAVE_AGE = { min: 20, max: 30 } as const; // 형제 독립 나이 (설계값, SPEC FA3 ▲)

// familyBirth.ts — 출생 때 한 번. 순수. 같은 입력 → 같은 출력.
export interface FamilyBirthInput {
  birthYear: number; gender: Gender; surname: string;      // 주인공 성
  report: BirthReport; parentWealth: ParentWealth;
  tilt: ReportTilt;
  orderShares: readonly [number, number, number];          // 이 판의 형제 순서 분포 (birthReport.ts#orderSharesOf)
  avoidNames: readonly string[];                           // 주인공·또래(VP3) 이름 — 가족 이름이 겹치면 안 됨
  generation: ProfileId;
}
export function rollFamilyBirth(famSeed: number, input: FamilyBirthInput): FamilyData;

// familyLife.ts
export type Sex = 'male' | 'female';
export function survivalCurve(sex: Sex, birthYear: number): readonly number[];       // S[0..101], S[0] = 1
export function deathAgeGiven(sex: Sex, birthYear: number, aliveAtAge: number, u: number): number; // 101 = 100세 초과

// familyTick.ts — 해마다. 진행 RNG를 쓰지 않는다.
export interface FamilyChanges {
  lines: HistoryEntry[];          // 이 해에 남길 인생 기록 줄 (id 접두어 fam-)
  effects?: Effects;              // 이른 부모 별세만 (4-7절). 그 밖은 없음 (FA0-8)
  setFlags: string[]; clearFlags: string[];
  log: number[][];                // family.log에 더할 항목
  forcedEvent?: string;           // 구성이 이 해에 일으키는 사건 id (K2)
}
export function familyChangesFor(game: GameState, age: number): FamilyChanges;        // age = 이 해의 주인공 나이 (진행 전 상태)
export function applyFamilyChanges(game: GameState, c: FamilyChanges): GameState;

// familyView.ts — 단일 정본 (FA0-1)
export function familyViewOf(game: FamilyGame): FamilyView;
export function familyOf(game: FamilyGame): FamilySummary;                            // 호환 계층 (기존 반환 모양)
export function householdOf(view: FamilyView): Person[];                              // 함께 사는 사람 (주인공 제외)
export function siblingCountOf(game: View): number;                                   // inherit.ts — view.siblingCount.living
export function sceneFamilyOf(game: FamilyGame): SceneFamilyState;                    // 8절

// familyFlags.ts
export const FAMILY_SYSTEM_FLAGS: readonly string[];
export function deriveFamilyFlags(view: FamilyView): ReadonlySet<string>;

// familyStorage.ts
export function withValidFamily(state: GameState): GameState;
export function ensureFamily(state: GameState): GameState;
export function legacyFamilyFrom(game: GameState): FamilyData;

// birthReport.ts (동작 불변, 내보내기만)
export function orderSharesOf(tilt: ReportTilt, regionName: string, birthYear: number): readonly [number, number, number];
```

`FamilyGame` = `Pick<GameState, 'age' | 'flags' | 'seen' | 'birthReport' | 'character' | 'peerSeed' | 'seed' | 'assets'> & { family?: FamilyData }`. `family`가 없으면 `familyViewOf`는 `legacyFamilyFrom`으로 즉석에서 만든다(저장 안 함 → 기존 시험이 `family` 없이 부르는 `familyOf` 호출도 깨지지 않는다).

### 3-1. `FamilyView` (카드·그림·한 줄·대체 글·출생신고·엔딩이 모두 읽는 하나)

```ts
export interface Person {
  id: PersonId; role: 'mother'|'father'|'grandparent'|'sibling'|'spouse'|'child';
  name: string; gender: Gender;
  birthYear: number; age: number;            // 지금 나이 (떠난 사람은 떠난 때 나이)
  state: 'with' | 'apart' | 'gone';          // with 함께 삶 · apart 따로 삶 · gone 떠남
  goneAtOwnAge?: number; goneAtMyAge?: number; // gone일 때 (goneAtMyAge < 0이면 내가 태어나기 전)
  beforeMyBirth?: true;
  jobLine?: 'employed' | 'homemaker' | 'retired' | 'student' | 'resting'; job?: Occupation;   // FC3
  education?: 1|2|3|4|5;                     // 부모만
  sibKind?: SiblingKind; older?: boolean;    // 형제만
  homeTown?: SidoKey;                        // 부모만 (대기)
}
export interface FamilyView {
  age: number; calYear: number;
  people: Person[];                          // 조부모·부모·형제·(성인) 배우자·자녀 전원
  siblingCount: { older: number; younger: number; living: number; total: number };
  household: PersonId[];                     // 함께 사는 사람 (주인공 제외) — householdOf가 사람으로 풀어 줌
  pets: { species: 'dog'|'cat'|'other'; name: string; since: number }[];
  parentsGone: boolean;                      // flags.parents_gone 또는 두 분 모두 gone
}
```

**함께 사는 사람의 정의**(FH5와 같은 집합, 카드·한 줄·그림·대체 글이 이 규칙 하나):
- `age < 20`: 주인공 + `state ≠ gone`이고 이혼으로 떠나지 않은 부모 + (`c`쪽) 살아 있는 동거 조부모 + `state ≠ gone`이고 자기 나이 < 독립 나이인 형제.
- `age ≥ 20`: 부모는 `assets.dwelling === 'family' && !moved_home`(또는 `lives_with_parents`)이고 살아 있을 때만, 형제는 그 부모가 함께 사는 경우에 한해 독립 전인 사람만, 조부모는 없음. 배우자는 `married`일 때, 자녀는 `has_child`이고 `child_left`가 아닌 사람(10절). `moved_home`(자식 곁)이면 부모 대신 자녀 쪽이 집이다(그림은 FM5).
- `gone`·`apart`는 어느 경우에도 포함하지 않는다.

## 4. 항목별 설계 (FA1~FA7)

### 4-1. FA1 조부모 출생 연도와 세대

**함수** `rollGrandparents(famSeed, input): GrandData[4]`의 출생 때 나이 부분.

- 어머니의 어머니(`mgm`)와 아버지의 어머니(`pgm`)의 「부모 출생 때 나이」는 **그 부모의 출생 연도 `by`의 모 연령 분포**에서 뽑는다. 조부(`mgf`·`pgf`)는 같은 쪽 조모 나이에 **아버지−어머니 나이 차 모형**(`getBirthStats().parentAges.fatherGivenMother`, 범위 `FATHER_GAP` −4~15)의 조건부 분포를 쓴다(모형의 어머니 나이 범위 밖은 가장자리 줄로 자른다). 두 조부모 나이가 `PARENT_AGE_LIMITS` 16~56 밖이면 가장자리로 자른다. 조부모 출생 연도 = `by − 나이`.

| 부모 출생 연도 `by` | 모 연령 분포(6칸: ≤19·20~24·25~29·30~34·35~39·40~49) | 근거 |
|---|---|---|
| 1981 ~ 2004 | 인구동향조사 5세 계급 구성비, 그 해 값 | **확인** `fd-a#fd1_mother_age_share_pct`(1981~2025) |
| 1956 ~ 1980 | 센서스 「모의 연령별 적생아」 역산, 5년 단위 가장 가까운 칸 | **확인(환산)** `fd-a#fd1_mother_age_at_birth_share_pct_calc`(±0.5세, 1981 이후는 인구동향조사 우선 — A-2 마스터 결정 1) |
| ≤ 1955 | 1956~60 칸을 가져와 **출산 연령이 이른 쪽으로**: 1936~55 −1세, 1916~35 −2세, ≤1915 −3세 | **추정**(방향은 A-2 마스터 결정 2, 크기는 **설계값** ▲). 1948 연감·1966 표본이 읽히면 교체 |

- 6칸 안은 균등으로 펼친다(≤19 → 16~19, 40~49 → 40~49의 앞쪽 85%·45~49 15% — 설계값, 1981 이후는 `fd1_births_by_mother_age`의 45~49 비중이 있으면 그 값). 지수적 부드러움은 두지 않는다.
- **세대 이름**(`generationNamesOf(year): string[]`): 부모에게만 붙인다. `GENERATIONS` 범위 안이면 이름 하나, 겹침 해(1960~1963)는 두 이름, 1940 앞은 `null`(화면은 「1910년대생」처럼 연대만 + 「추정」, FA0-4). 평가어(`GENERATION_EVAL_WORDS`) 0.
- 엔딩 바로가기(Q1)의 입력은 `generationNamesOf(motherBirthYear)`·`(fatherBirthYear)`이다. 겹침·1940 앞 분기는 이 함수의 반환 길이(2 / `null`)로 판단한다. 선택 상태 저장은 이 문서가 정하지 않는다(SPEC-004 GS 쪽 — 이번 판 한정이라 `GameState`가 아니라 앱 상태에 둔다는 것이 권장).
- 시험: 12절 T-GP1.

### 4-2. FA2 부모의 학력과 집안일

**함수** `rollEmployment`·`rollEducation`(EMPLOY·EDU 스트림). **기존 직업 추첨은 그대로** 두고 그 뒤에 얹는다(`jobWeights`·`rollBirthReport` 불변 → 기존 `tests/birthReport*.test.ts` 불변).

**(1) 취업 상태 `w`** — 어머니만 `homemaker`가 될 수 있다.

| 항목 | 규칙 | 근거 |
|---|---|---|
| 어머니 집안일 확률 | `1 − 경활참가율(여, 어머니 나이 계급, calYear = Y)`. 계급 = 15~19·20~29·30~39·40~49·50~59·60+ (10세 계급) | 2000~2025 **확인** `fd-a#fd4_lfpr`. 1963~1999: 성별 합계 `dc4-economy.json` `partic_1wk_female` × (2000년 그 계급 ÷ 2000년 여 계 비율) = **추정**. 1963 앞: 1963 값 유지 = **설계값** |
| 아버지 집안일 확률 | **0** | 비경제활동 사유(가사) 표를 못 읽어 참가율의 보수에는 병·구직 포기가 섞인다(`fd-a` 3절 FD4) → 자료 도착(대기 후속) 전까지 **설계값 0** |
| 알려진 편향 | 전체 여성 참가율을 신생아 어머니의 대용으로 쓰므로 **집안일 비율이 과소**(기혼·막내 자녀 연령별 표 없음) | 근거 칸에 한 줄로 밝힌다 |
| 집안일이면 | `ParentData.w = 1`, 화면 직업 「집안일」, 기존 `report.mother.job`은 쓰지 않음 | FA2 |
| 은퇴 나이 `r` | 취업자만. 농업(`agri`): 65~75 균등, 그 밖: 55~65 균등(`famHash01`) | **설계값 확정**(A 마스터 결정 6). 근거 칸에는 정년 60세 의무(2016·2017 시행)·국민연금 지급 연령 상향(1953~69년생 +1~+5세) 연혁을 적음 |
| 재취업(M자) | 두지 않음. 출생 때 상태를 은퇴까지 유지 | SPEC FA2 |

- 부모 나이가 `r` 이상이면 `jobLine = 'retired'`(카드 직업 줄만 바뀜, 인생 기록 줄 없음).

**(2) 최종 학력 `e` (1 초등 이하 · 2 중 · 3 고 · 4 전문대·대 · 5 대학원 이상)**

- 기준 표 `EDU[성][코호트 5년]`: 부모 출생 연도의 코호트(1926~30, 31~35, …, 1976~80)별 5칸 구성비. **2010 인구총조사의 30세 이상 성·연령 계급 최종 학력 근사를 코호트로 읽는다**(RC M3): `fd-a#fd2_education5_share_pct_2010`(남·여 24줄). 1925 앞은 85세 이상 한 줄을 전체에 적용, 1976~80 뒤(1981 이후 출생)는 1976~80 줄 유지.
- 근거 표시: 1926~1980 코호트 **확인(환산)**, 1925 앞(한 줄 뭉침)·1981 뒤(2015~ 센서스 미수집 — 학력이 더 올랐을 가능성) **추정**.
- **교차 점검(시험)**: 여성 2005 단면 `fd-a#fd2_education5_share_pct_female_2005_calc`을 같은 코호트에서 2010과 견준다(5%p 안). **A-2 마스터 결정 3의 남성 추정식**(여성 학교 급 + 1980·1990 불취학 격차)은 이 문서에서 **쓰지 않고 교차 점검으로만 남긴다** — 2010 표에 남성 학교 급이 30세 이상 전 계급으로 이미 있어 추정식이 필요 없다(마스터 승인 필요, 14절).
- **직업 조건부**(취업자만): 직업별 기울기 `T[job][level]`(설계값 — 직업×학력 표 FD3가 아직 없음)를 코호트 구성비에 곱한 **결합표를 IPF로 맞춘다**(행 합 = 그 코호트·성별의 전국 직업 구성비 `occupation` 통계, 열 합 = 위 구성비).

| 직업 | 초등 이하 | 중 | 고 | 전문대·대 | 대학원 |
|---|---:|---:|---:|---:|---:|
| manager 관리자 | 0.05 | 0.3 | 1.0 | 1.6 | 2.0 |
| professional 전문가 | **0** | **0** | 0.3 | 2.2 | 4.0 |
| clerk 사무 | 0.1 | 0.4 | 1.3 | 1.5 | 1.0 |
| service 서비스 | 0.8 | 1.1 | 1.1 | 0.8 | 0.4 |
| sales 판매 | 0.8 | 1.0 | 1.2 | 0.9 | 0.5 |
| agri 농림어업 | 1.8 | 1.4 | 0.7 | 0.2 | 0.05 |
| craft 기능 | 1.2 | 1.4 | 1.0 | 0.4 | 0.1 |
| machine 장치·기계 | 1.0 | 1.3 | 1.2 | 0.4 | 0.1 |
| labor 단순노무 | 1.6 | 1.3 | 0.9 | 0.2 | 0.05 |

  **설계값**(방향만 상식, 크기는 ▲). 0칸 = 불가능 조합(전문가 × 중졸 이하) → 시험 0건. 집안일 어머니는 직업이 없으므로 코호트 구성비 그대로(기울기 없음). FD3 도착 시 이 표를 교체한다.
- **수저 기울임은 두지 않는다**(SPEC FA2 — 소득 계층별 자료 전). 직업이 수저에 기울어 있어(`JOB_TILT_BY_WEALTH`) 학력도 간접으로 수저와 함께 움직이는 것은 의도된 결과다.
- 보이는 곳: 출생신고 부모 줄 「32세(1962년생) · 고등학교 졸업 · 집안일」, 카드 부모 줄.
- 시험: T-FA2(12절).

### 4-3. FA3 형제자매 구성

**함수** `rollSiblings(famSeed, input)`(SIBLINGS 스트림). 입력의 `birthOrder`는 NR2가 정한 값 그대로(건드리지 않음).

**(1) 위 형제** — 기존 규칙을 코드째 옮긴다: `olderSiblingsOf(birthOrder)`명(≤4), 나이 차·성별 `olderSiblingDraw(peerSeed ?? seed, i)`의 해시(옛 판과 같은 값 → 옛 저장 호환과 한 코드), 누적 나이 차는 R-330 한도 안. `family.o[i] = { k: 누적 나이 차, g: 성별, s: 독립 나이 }`.

**(2) 아래 동생** — 어머니의 **최종 자녀 수**를 이어짐 확률로 정한다.

- 내 순서 `n` = `birthOrder`(5는 「다섯째 이상」이므로 5로 센다). 이어짐 확률(전체 자녀가 `k`명 이상일 때 `k+1`명 이상일 확률) `a_k`:
  - `a_1 = s[1]/s[0]`, `a_2 = s[2]/s[1]` (`s = orderShares`, 이 판의 출산 순위 비중 — 지역·시대 보정이 들어간 **주인공 순서를 뽑는 데 쓴 바로 그 분포**). 비를 [0, 0.9]로 자른다.
  - `a_3 = (THIRD_PLUS_SPLIT[1]+[2]) / THIRD_PLUS_SPLIT[0] = 26/74`, `a_4 = a_5 = a_6 = a_7 = THIRD_PLUS_SPLIT[2]/THIRD_PLUS_SPLIT[1] = 7/19`.
  - **근거**: 정상 상태의 기간 단면에서 `k+1`째 출생 ÷ `k`째 출생 = 「k째를 낳은 어머니 중 더 낳는 비율」. **설계값(공표 출산 순위 비중에서 유도한 근사)** — 출산이 빠르게 줄던 1970~80년대에는 과소가 된다(기간 단면 근사의 한계, 근거 칸에 한 줄). 대조: `fd-a#fd6_mean_children_by_age_calc`(코호트 완결출산력)와 시험에서 견준다(T-FA3).
- 전체 자녀 수 상한 8: `n + (아래 동생 수) ≤ 8`.
- 동생 한 명씩 차례로 `j = 1, 2, …`: 지금까지 자녀가 `k = n + j − 1`명일 때 `a_k`를 굴려 이어지면 한 명을 더한다. 더하는 동생의 나이 차 `gap_j ∈ {2,3,4,5}` 균등(**설계값** — 터울 표 FD8 도착 전 기존 `SIBLING_GAP`), 태어난 때 주인공 나이 `k_j = k_{j−1} + gap_j`(`k_0 = 0`). **그 출산의 어머니 나이 `report.mother.age + k_j`가 `YOUNGER_MOTHER_MAX`(45)를 넘으면 거기서 멈춘다**(굴림은 `j`마다 미리 뽑아 두어 멈춰도 다른 값이 밀리지 않는다). 모 연령 상한에 걸려 줄어든 몫은 통계 대비 하향 편향이다(측정 보고, 보정이 필요하면 나이 계수를 FM4에서 마스터에게 올림).
- 성별: 균등(**설계값**, 출생 성비 FD7 도착 전). FD7이 오면 **새 판부터**만 반영한다(저장된 판은 스냅샷이므로 불변).
- 독립 나이 `s`: 형제마다 `20 + floor(famHash01(famSeed, SIBLINGS, 형제번호, 1) × 11)` (20~30, **설계값**; 혼인 연령 DC21은 근거 참고).
- 쌍둥이·의붓·이복은 만들지 않는다.

**(3) 형제 상태** — `Person.state`: `age(그 사람) < s` 이고 아래 규칙으로 집에 있으면 `with`, 독립 나이가 지났으면 `apart`(카드에 남고 그림에서 빠짐), 별세(Q3 사건·상한 100)면 `gone`. 독립은 인생 기록에 줄 하나(`fam-sib-left`, 4-9절)이고 **결혼은 따로 만들지 않는다**(조카가 생기지 않음 — 친척은 안 함). 주인공 나이 0 이전에 이미 독립한 위 형제(나이 차가 크고 독립 나이가 작음)는 줄 없이 처음부터 `apart`.

**(4) 직업 줄** — 형제: 학령기(6~18세)는 `student`, 그 뒤는 `jobWeights` 재사용(설계값), 성인 이후 은퇴 나이는 부모와 같은 규칙. 학령기 단계(교육 단계)는 기존 교육 단계 표현을 따른다(FC3, FM6).

**(5) 출생신고** — 「N째입니다」 유지 + 형제자매 칸은 **위 형제만**(예: 「위로 형·누나 2명」). 아래 동생은 태어나는 해의 인생 기록과 카드에서 처음 보인다(6-4절).

### 4-4. FA4 조부모 — 생존과 함께 삶

**(1) 별세 나이 `d`** — `rollGrandparents`(GRAND_LIFE 스트림): 조부모마다 `deathAgeGiven(sex, 조부모 출생 연도, 부모 출생 때 나이 `a`, u)`.

- `survivalCurve(sex, by)`: 나이 `x`(0~100)마다 달력 연도 `t = by + x`의 **5세 구간 사망확률 `Q`**(`fd-a#fd10_qx`, 22구간: 0세·1~4세·5~9세…95~99세·100세 이상)를 1세 위험률로 쪼갠다. 구간 너비 `w`(0세 1·1~4세 4·그 밖 5)에 대해 `h = 1 − (1 − Q)^(1/w)`, `S[x+1] = S[x]·(1 − h)`.
- `t`가 표 범위 밖일 때: **`t > 2024`는 2024 값 유지**(미래 개선 없음 — 출처 없는 미래 수치 금지, SPEC-004 S6). **`t < 1970`은 1970 값에 배율 `m(t) ≥ 1`을 곱한다**(A 마스터 결정 7 (나), 기대수명 척도 외삽): `e0(t) = e0(1970) − 기울기 × (1970 − t)`, 기울기는 1970~1985 기대수명(`dc` 기대수명 1970~2024)의 최소제곱, 하한 `e0 ≥ 30`; `m(t)`는 1970 `Q`에 곱했을 때 기간 기대수명이 `e0(t)`가 되도록 빌드가 이분법으로 풀어 `MORTALITY_SCALE_PRE1970[t]`(t = 1880~1969) 표로 둔다. `Q`는 최대 0.999로 자른다. **추정**(근거 칸에 식과 기울기 값을 적음).
- `deathAgeGiven(sex, by, x0, u)`: 목표 `T = S[x0] × (1 − u)`일 때 `S[x+1] ≤ T`인 첫 `x ≥ x0`. `x`가 100을 넘으면 101. `u = 스트림 하나당 한 번`(조부모 4명 + 부모 2명 = 6번).
- 성별: `mgm`·`pgm` 여 / `mgf`·`pgf` 남. 부모 별세 나이 `d`(`ParentData.d`, 4-7절)도 같은 함수다.
- 조부모가 **주인공이 태어나기 전에 떠난** 경우도 정상이다(`goneAtMyAge < 0`, `beforeMyBirth`). 카드는 「떠난 가족」에 「내가 태어나기 전에 세상을 떠남 · N세」로 둔다(문구는 FM6 `copy.md`). 줄은 없다(주인공 기록에 없는 일).

**(2) 함께 삶 `c`** — 주인공이 0~19세인 동안 3세대 가구로 사는가.

- 기준 비율 `pGp(R)`, `R = min(2025, Y + 6)`(아동 중기 단면). 「조부모와 사는 아동」 비율(%):

| R | 값 | 근거 |
|---|---:|---|
| 2000 | 15.00 | **확인(환산)** `fd-a#fa4_child_generation_share_pct_calc` (3세대 이상 14.49 + 조부모·손자녀만 0.51) |
| 2005 | 14.65 | 〃 (13.90 + 0.75) |
| 1970·75·80·85·90·95 | 42.9 · 37.4 · 31.5 · 27.6 · 23.1 · 18.5 | **추정** = FD9 3세대 이상 비율(`fd-a#fd9_generation_share_pct` 23.2·20.2·17.0·14.9·12.5·10.0) × 1.85 (A-2 결정 4 「× 1.7~2.0」의 가운데; 2000·2005 실측 1.73·1.99) |
| 2010·15·20·25 | 11.5 · 10.0 · 6.8 · 4.6 | 〃 (6.2·5.4·3.7·2.5 × 1.85) |
| ≤ 1969 | 42.9 | **설계값**(1970 값 유지 — 1960 앞 가구 표 없음) |
| 사이 연도 | 이웃한 두 값의 선형 보간 | 추정 |

- 추첨(GRAND_SIDE 스트림): ① 쪽 선택 — 친가 0.7 / 외가 0.3(**설계값**, 자료가 있으면 교체) ② 고른 쪽의 두 조부모 중 **주인공이 태어날 때 살아 있는** 사람이 없으면 다른 쪽으로 ③ 둘 다 없으면 `c = 0`. 동거 여부 자체는 확률 `p = pGp(R) / A(Y)`로 뽑는다(`A(Y)` = 출생 연도 `Y`에서 어느 한 쪽 조부모라도 출생 때 살아 있을 확률 — 빌드가 `survivalCurve`로 계산해 표로 둠, 최대 1). 이렇게 하면 **0~12세 단면에서 조부모와 사는 비율이 `pGp`와 맞는다**(시험 T-FA4b).
- 함께 사는 조부모 = 고른 쪽 조부모 중 주인공 출생 때 살아 있는 사람. **한 사람씩 별세하거나(주인공 나이 `goneAt`) 주인공이 20세가 되면 동거가 끝난다.** 합가가 중간에 끝나는 경우(이사)는 FA7 이사(대기 C)가 정한다. 함께 살지 않는 조부모는 카드에만 있고 그림에는 없다.
- **`grandparent_close`와의 정합**: 영유아 돌봄 사건의 해당 선택지에 `requires: { flags: ['has_grandparent'] }`를 단다(13-2절). 켜진 판에서 가까운 조부모가 있다는 보장은 `has_grandparent`로 충분하다(FC2의 사이 단계는 FM6).
- 시험: T-FA4a(별세 나이 평균 대 코호트 기대수명), T-FA4b(동거 비율).

### 4-5. FA5 집의 모습 — **자리와 시그니처만 (묶음 B 대기)**

**함수** `rollHome(famSeed, input): HomeData`(HOME 스트림). 입력: `report`(지역·주거 `Housing`)·`parentWealth`·`birthYear`·가구 구성(식구 수 — 위 3절의 부모·조부모·형제에서 계산한 `householdSizeAt(0)`)·`regionKind`. **`Housing`은 이미 정해진 값을 입력으로 받는다**(바꾸지 않음).

| 칸 | 모양 | 값 | 메울 규칙 |
|---|---|---|---|
| `HOME_KIND_P[센서스 해][시도 17][점유 3][소득계층 3]` → 6종 확률 | 단독 / 아파트 / 연립 / 다세대 / 비거주용 건물 내 / 주택 이외의 거처(+ 연립·다세대는 그림에서 `multi`로 합침, 큰 집 `estate`는 저장하지 않고 `sceneOf`가 수저 5 + 자가로 파생) | **대기 B** (FD11·FD12) | ① 연도: 센서스 해 중 **가장 가까운 해**(보간 없음, 같은 거리면 이른 해) = **추정**, 1960~70 앞 = **설계값**. ② 시도: 시도별 종류 비중을 기본으로 `housingProbs`와 같은 **비 보정**(점유 형태 배율 × 소득계층 배율, `INCOME_CLASS_BLEND` 재사용). ③ 표의 0칸 = 불가능 조합(시험 0건). ④ 한 연도·점유에서 합이 1이 되게 정규화 |
| `SHACK_YEARS = [from, to]` | 주택 이외의 거처(작은 집)를 쓸 수 있는 연도 | **대기 B** (FD14) | 범위 밖은 확률 0 |
| `RENT_ROOM_P[연도][점유=임차][단독]` | 셋방 딸림 확률(`HomeData.s`) | **대기 B** (FD12 주거실태) | 가장 가까운 해 |
| `ROOMS_P[연도][종류][식구 수]` | 사용 방 수 1~6+ | **대기 B** (FD13) | 가장 가까운 해. 식구 수는 `FamilyView`에서 계산해 입력 |
| `regionKind(시군구|시도, 연도)` | 대도시 / 중소도시 / 농촌 / 바닷가 4종 | **대기 B** (FD15) | 세대 판은 출생지가 시도까지(NR3)라 **시도 단위 분류표**를 기본으로 하고 분류가 모호한 시도는 설계값 표시 |

- **표가 오기 전의 동작**(`HOME_TABLE_READY = false`): `family.h`를 만들지 않는다. `sceneFamilyOf.homeKind = null` → 그림은 점유 형태에 맞는 **기본 모양**(SPEC FA5 성인 규칙과 같은 방식: 자가·무상 → 단독, 임차 → 다세대 — **임시 모양**이고 통계 주장이 아니다)을 쓰고, 한 줄은 집 낱말 없이 「집」으로 쓴다. 이 임시 상태는 릴리스 전에 사라진다(K6).
- 성인 이후: 집 종류를 새로 뽑지 않는다. `Dwelling`(family·rent·jeonse·own·care)에 따라 기본 모양(SPEC-006 전까지).
- 보이는 곳: 출생신고 「사는 집」 칸 「단독주택 · 자가 · 방 3칸」, 한 줄, 신원 카드 「지금 사는 곳」.

### 4-6. FA6 부모의 고향 — **시그니처와 규칙 (묶음 B·C 대기)**

**함수** `rollHometown(famSeed, { birthSido, parentBirthYear, who })`(HOMETOWN 스트림) → 시도 안정 키(17개 중 부모 출생 연도에 존재하는 곳).

- 분포 ∝ `시도 인구 비율(부모 출생 연도, DC7 계단식 표)` × `이동 확률(고향 시도 → 주인공 출생 시도)`. 이동 확률 표 `HOMETOWN_MOVE[이동 통계 해][고향][출생지]`는 **대기 C**(FD17), 도시화 한 축은 **대기 B**(FD16). 모두 **설계값**(개인 단위 통계 없음 — 항상 「설계값」 표시).
- 메울 규칙: 부모 출생 연도 `by` → 이동 통계는 `by + 25`(부모 20대 중반 이주 시기) 해에서 **가장 가까운 해**; 1970 앞은 1970 행렬 유지 + 설계값. 시도가 부모 출생 해에 없던 곳(세종 등 RG2 존재 연도 규칙)은 확률 0. 이북 0(DF18).
- **표가 오기 전의 동작**: `family.t`를 만들지 않고 카드의 고향 줄을 생략한다.
- 지역 규칙: 고향은 `regionalLevels`·연표 사건·점수와 연결하지 않는다(RG10 상태 해시 일치 시험). 고향 한 줄은 사실만(「고향: 전라남도 → 서울」), 시도 이름은 부모 출생 해의 행정구역 이름 + 지금 이름 병기(RG2).

### 4-7. FA7 해마다 바뀌는 가족 형편

**함수** `familyChangesFor(game, age)`가 한 해 시작 상태에서 **순수 계산**으로 그 해의 변화를 모아 `FamilyChanges`를 돌려준다. 적용 자리: `stepYear` 안, 마일스톤 슬롯 적용 직후·일반 사건 추첨 결과 처리 앞(펜딩 선택지로 끝나는 경로에서도 이미 적용된 `s`를 쓴다). 줄 순서: 마일스톤 줄(id 오름차순) → 가족 줄(종류 코드 오름차순) → 일반 사건 줄. 가족 줄은 `kind: 'event'`, `eventId: 'fam-…'`이라 `yearLineCount`(연출 대기·판 길이 모델)에 마일스톤·일반 사건과 같은 규칙으로 들어간다(FA0-7).

| 변화 | 판정 | 자료 | 상태 |
|---|---|---|---|
| **조부모 별세** | 스냅샷 `g[i].d`: 그 해 `age == goneAt` | 4-4절 | 지금(FM4a) |
| **부모 한 분 별세(Q2)** | 아래 (1) | 4-4절 `survivalCurve` | 지금 |
| **부모 이혼·별거** | 아래 (2) | `fd-a#fd21_parent_divorce_annual_rate_calc` | 지금(1993~ 확인(환산), 앞은 추정) |
| **형제 출생·독립** | 스냅샷 `y[j].k`, `o/y[].s` | 4-3절 | 지금 |
| **형제 이른 별세(Q3)** | 사건 — 아래 (3) | FD10 ▲ | 틀만, 확률·문장은 FM7 |
| 어머니 재취업·은퇴 | 카드 직업 줄만(`jobLine` 계산) | 4-2절 | 줄 없음 |
| **이사(부모 집)** | `famHash01(famSeed, MOVE, age, 0) < p_move(연령·점유)` | FD18 | **대기 C** — 자리: 종류 7, `HomeData` 갱신, 같은 시도 안, 합가 종료 연동 |
| **부모 실직·휴업** | `p = 실업률(calYear)·직업 위험·SHIELD` | DC4-4 `dc4-economy.json`(연도별 실업률 — 있음) + FD19 | **대기 C** — 자리: 종류 8·9, 플래그 `mother_works`·`father_works` |
| 부모 부업·창업·폐업 | FD19·DC26 | | **대기 C** — 종류 8(휴업과 같은 틀) 재사용 여부는 C 도착 때 |
| **부모 병환** | 연령별 유병·장기요양 | FD20 | **대기 C** — `cared_parents` 확장, 종류 10 |
| **반려동물 입양·이별** | 입양 = 플래그 관찰, 이별 = 수명 | 5-1절 | 입양은 지금(읽기), 부모 집 유무는 **대기 D** |
| **새 가전·물건** | 임계값 `u` 대 보급률 | FD23 | **대기 D** — 종류 14 |

**공통**: 변화는 가능한 한 **상태 + 줄 한 줄**(D-3). 결정이 필요한 것(`infant-new-sibling` 반응, 이사 갈래, 병간호)만 사건 카드. 첫 출시는 **스탯·자산·확률을 바꾸지 않는다**(FA0-8) — 아래 (1)의 이른 부모 별세 한 가지만 예외(마스터 판단 2026-10-27).

**(1) 부모 한 분의 별세 — 판정과 `mother_gone`/`father_gone`**

- 출생 때 부모 각자 `d`(자기 나이)를 `deathAgeGiven(female|male, 부모 출생 연도, 출생 때 부모 나이, u)`로 정한다(PARENT_LIFE 스트림). `goneAt = (부모 출생 연도 + d) − Y`.
- **먼저 떠나는 한 분만** 모델이 알린다: `first = argmin(달력 별세 연도)`, 같은 해면 아버지가 먼저(설계값 — 생명표에서 남성이 앞서는 경향). `goneAt_first`가 주인공 나이 `age`와 같은 해, 그리고 그 해에 **아직 `parents_gone`이 켜지지 않았을 때** 변화가 일어난다 → 줄 `fam-parent-gone`, 플래그 `mother_gone` 또는 `father_gone`(둘 중 하나, INV-9), 로그 종류 5.
- 「`parents_gone`보다 항상 앞선다」의 정확한 형태(**마스터 승인 필요**, 14절): 먼저 떠나는 분의 시점이 `parents_gone`(기존 `middle-parents-farewell` 선택지가 켬, 주인공 52~64세 · `parentAge ≥ 65`)과 **같거나 늦으면 한 분 별세는 일어나지 않고** 기존 사건이 두 분을 한꺼번에 맡는다(별세 줄 하나). 앞서면 먼저 한 분이 떠나고, 남은 한 분은 기존 사건·나이 상한이 맡는다.
- **두 번째 분의 별세는 모델이 정하지 않는다**(`parents_gone` 규칙 불변, 상속·주거 불변). 남은 한 분의 `d`는 스냅샷에 있어도 쓰지 않는다(첫 출시 한계, 위험으로 기록; 켜면 경제 분포가 크게 바뀌므로 별도 결정).
- 상태: `parentStateOf`의 새 판 `parentStateOf2(who, age, flags)` — `parents_gone` 또는 `{who}_gone` 또는 나이 > 100이면 `gone`, `cared_parents`면 `ill`, 85 이상이면 `aged`. 기존 `parentStateOf(age, flags)`는 호환 계층으로 남고 `parentsAllGone`·`dwellingWhenParentsGone`·상속은 **기존 판정 그대로** `parents_gone`+나이 상한(두 분 모두 gone)만 본다.
- **이른 별세 효과(FA0-8 예외, 마스터 판단 2026-10-27)** — `EARLY_LOSS_MAX_AGE`(19) 이하에 떠난 경우만. `applyFamilyChanges`가 `applyResolved(effects)`로 적용한다(영향 표기는 줄에 숫자를 쓰지 않음, 상속처럼 규칙 줄). **초안 ▲**(FM4 경제 재측정이 확인):
  - 스탯: 행복 −8 · 관계 −2 · 건강 −1 (어머니·아버지 같음, 설계값).
  - 집안 살림(`effects.family`, 만 원): 아버지 별세 −500 · 어머니 별세 −300(`w = 1` 집안일이면 −150), 여기에 재력 단계 배율 `[0.8, 1.0, 1.2, 1.6, 2.0][재력−1]`을 곱해 반올림(설계값; `FAMILY_DELTA_CAP` 3,000 안).
  - 20세 이상(`age > EARLY_LOSS_MAX_AGE`)은 **기록 전용**(자산 영향 0).
  - **합격 기준(FM4 재측정)**: ① 재력 단계별 20세 시작 자산·최종 순자산 중앙값의 변화 ≤ ▲ 3% ② 단계 순서 뒤바뀜 0 ③ 엔딩 판정 분포 변화 ≤ ▲ 2%p ④ 효과가 걸린 판 비율(= 19세 이하 부모 한 분 별세)을 보고. 넘으면 위 수치를 낮추거나 마스터에게 올린다.
- 문장 가림: `loss`. 중년 사건 3개와 `cared_parents`의 「남은 한 분」 변형은 FM7(낱말 ↔ `requires`: 변형은 `notFlags`/`flags: ['mother_gone'|'father_gone']`).

**(2) 부모 이혼·별거 (DF19, 어린 시절 상태 변화)**

- 주인공 나이 0~18, 아직 `mother_apart`·`father_apart`·`mother_gone`·`father_gone`이 없을 때, 그 해 `famHash01(famSeed, DIVORCE, age, 0) < h(calYear)`이면 일어난다. 사건별 승인(DF19)은 **문장**을 FM7에서 승인받는 것이고 판정은 상태 변화다.
- 연간 비율 `h(y)` (자녀 쪽 분모, %): `fd-a#fd21_parent_divorce_annual_rate_calc` — 1993 0.47 · 1998 1.01 · 2003 **1.54(최고)** · 2005 1.12 · 2010 0.92 · 2015 0.85 · 2020 0.85 · 2025 0.83(전 해 값은 JSON). **확인(환산)**: 「이혼 건수 × 미성년 자녀 수 하한 ÷ 출생아 수 합 근사 미성년 인구」(A-2 결정 5 승인; 분모 확인은 묶음 C의 `DT_1BPA001`). `y < 1993`: `h(y) = h(1993) × 조이혼율(y) ÷ 조이혼율(1993)`(조이혼율은 저장소 `divorce` 1970~2025) = **추정**. `y > 2025`: 2025 값 유지. 1970 앞: 1970 비율 유지 = 설계값.
- 검증 눈금: 출생 코호트 1993~2006은 0~18세 사이 15.6~18.0%(`fd-a#fd21_parent_divorce_cumulative_calc`, 하한 근사) — 시험 T-FA7a가 이 구간의 모의 비율이 이 범위 안인지(4σ) 본다. 그 앞 코호트는 낮고(조이혼율 비) 시험은 방향만 본다.
- 결과: 한 분이 따로 산다 — **떠나는 쪽은 아버지 0.8 / 어머니 0.2**(설계값, 아이가 어머니와 남는 경우가 더 많다는 가정; 양육권자 통계는 후속 대기 C). 플래그 `father_apart`(또는 `mother_apart`), `Person.state = 'apart'`(카드에 남고 그림·「함께 사는 사람」에서 빠짐), 줄 `fam-parents-apart`(분류 `home`, 원인·책임 서술 없음), 로그 종류 6. 스탯·자산 영향 0.
- 재혼·의붓·이복은 만들지 않는다. 이혼 뒤 한 분의 별세(Q2)는 같은 규칙으로 일어날 수 있다(`apart`인 부모도 `d`를 가진다).

**(3) 어린 형제의 이른 별세(Q3) — 사건 틀 (확률·문장은 FM7)**

- 1969년 이하 출생 판만. 사건 id(제안) `family-sibling-early-loss`, 서술 사건, `heavy: { kind: 'loss' }`, 승인 전 `approved: false`(빌드가 막음). 조건은 시스템 플래그 `sibling_loss_risk`(6절: 출생 연도 ≤ 1969 이고 살아 있는 12세 미만 형제 ≥ 1)를 쓴다.
- 대상은 구성(`o`·`y`)에 있는 형제 중 12세 미만 한 명(`famHash01`로 결정). 사건이 일어나면 `familyChangesFor`가 아니라 **사건 효과 처리 뒤** `applyFamilyChanges`의 보조 경로가 로그 종류 3을 쓰고(별세 나이 = 그때 형제 나이) 형제 `state = 'gone'`. 인생 기록 줄은 사건 자신의 줄이다.
- 확률: 위험을 `FD10` 영아·아동 사망확률(`fd-a#fd10_qx` 0세·1~4·5~9·10~14, 1970 앞은 `MORTALITY_SCALE_PRE1970` 외삽)에서 **형제 한 명당 연 위험**으로 계산하고, 사건 가중치는 FM7에서 시뮬레이션으로 **목표 비율에 맞춘다**(목표 = 해당 판에서 12세 미만 형제 한 명이 그 시기에 떠나는 누적 확률). 숫자는 자료 확인 뒤에만 쓴다(GE5).
- 효과: 기록 전용(스탯·자산 0) — FA0-8 예외는 부모 별세뿐.

### 4-8. 형제 수와 상속 (K1)

계산 규칙과 경제 영향은 7-1절.

### 4-9. 인생 기록 줄의 분류 (`gentle`) — 무거운 장면 가리기 연동

`fam-` 줄은 저장 대상이 아닌 **`eventId` 접두어 → 분류** 표로 `gentle`이 읽는다(`gentle.ts`의 상속 줄처럼 글자 상수, 이벤트 풀 조회 불필요): `fam-parent-gone`·`fam-gp-gone`·`fam-pet-out` → `loss` · `fam-parents-apart`·`fam-moved` → `home` · `fam-job-loss` → `work` · `fam-illness` → `health`. 분류 없는 줄(`fam-sib-born`·`fam-sib-left`·`fam-pet-in`·`fam-possess`)은 가리지 않는다. 가림 설정은 **글만** 가리고 상태·플래그·로그는 그대로다(방식 A). 시험: 가림을 켠 7000판에서 분류가 붙은 줄의 문장 0건 노출.

## 5. 반려동물과 가진 것 (FK) — 읽기 규약과 자리

### 5-1. 반려동물 (K10)

- **플래그**: `pet_dog` `pet_cat` `pet_other`(지금 함께 삶) · `pet_farewell`(한 번이라도 떠나보냄, 안 꺼짐). 입양을 만드는 사건(`school-puppy`의 `keep`, SPEC-008의 들이기)은 `setFlags`에 `pet_dog`(또는 종에 맞는 플래그)를 **더하기만** 한다. 이별 때 `familyChangesFor`가 켠 플래그를 끄고 `pet_farewell`을 켠다. 최대 2마리: 이미 두 종이 켜져 있으면 세 번째 입양은 SPEC-008 쪽 `requires`가 막는다(이 문서가 정하는 읽기 규약).
- **입양 관찰**: `familyChangesFor`가 `pet_*`가 **켜졌는데 로그에 그 마리가 없으면** 이번 해를 입양 해로 기록한다 — 로그 12 `[12, age, 30+n, 종 코드]`, 이름은 `PET_NAMES`에서 `famHash01(famSeed, PETS, 30+n, 0)`로(겹침 없음, 번호 저장). 줄은 대표 입양만(`fam-pet-in`, 판당 ≤ 5개 가진 것·반려 줄 한도와 별개로 반려 줄은 입양 1·이별 1).
- **이별**: 입양 나이 + 수명. 수명(**설계값**, 공식 통계 없음): 개 10~16 · 고양이 12~18 · 그 밖 2~8년 균등(`famHash01(…, 30+n, 1)`). 부모 집 반려동물(출생 때 유무·종: **대기 D** FD22)은 로그 12를 나이 0으로 출생 때 채운다. 떠돌이 입양이라 나이를 모르는 경우는 FM7 문장이 「함께한 N년」로 쓴다(정직한 표현).
- 마당 → 실내 전환은 그림 쪽 규칙(`sceneOf`, family-scene 3절)이다.
- `school-puppy` 수정(`keep` 선택에 `setFlags: ['pet_dog']`)은 **FM7 사건 마일스톤**의 작은 변경이다(K10). 그 전에는 `seen['school-puppy']`와 선택 기록으로 읽지 않는다(불명확) — 관찰은 플래그만 본다.
- 안전: 학대·유기 서술 없음(기존 `feed`·`pass` 선택 유지).

### 5-2. 가진 것 (FK2) — **자리 (대기 D)**

- `POSSESSIONS` 표(id·일반 명사 이름·보급 시작 연도·보급률 시계열·`basis`)는 FD23 도착 때. 판정은 설계 그대로: 집이 항목을 가졌는가는 `u`(`family.u`)와 보급률의 비교, 한 번 가지면 유지(단조). 수저 기울임은 평균 보존(WS4 ⓐ), 소득 자료 전 **설계값**. 성인은 부모 집 것을 이어받는다.
- 줄: 처음 들어온 해의 대표 항목만, 판당 ≤ 5(로그 14, `fam-possess`). 전망 구간(2026~)은 2025 세트 유지. 숫자·상호는 본문에 없음.
- **표가 오기 전의 동작**: `family.u`를 만들지 않고 카드의 「집에 있는 것」과 줄을 생략한다.

## 6. 시스템 플래그 어휘 (K3·K10, TL16 소개정 입력)

### 6-1. 목록

플래그 형식은 `FLAG_PATTERN`(`^[a-z][a-z0-9_]{0,38}$`)·`STATE_LIMITS.maxFlags 200`을 지킨다. **시스템 소유** = `familyChangesFor`/`enterLife`가 쓰고 이벤트 `effects`는 쓰지 않는다(lint가 막음 — `eventLint`에 `FAMILY_SYSTEM_FLAGS` 쓰기 금지·읽기 허용 목록).

| 플래그 | 뜻 | 소유 | 켜짐 | 꺼짐 |
|---|---|---|---|---|
| `has_grandparent` | 살아 있는 조부모가 한 명 이상 | 시스템 | 출생 때 | 마지막 조부모 별세 해 끝 |
| `lives_with_grandparent` | 함께 사는 조부모 | 시스템 | 출생 때 (`c ≠ 0`) | 동거 조부모가 없어질 때·20세 |
| `has_older_sibling` | 살아 있는 위 형제 | 시스템 | 출생 때 | 모두 떠났을 때 |
| `has_younger_sibling` | 살아 있는 아래 동생 | 시스템 | 동생 출생 해 | 모두 떠났을 때 |
| `has_sibling` | 살아 있는 형제 한 명 이상 | 시스템 | 〃 | 〃 |
| `younger_sibling` (기존) | 동생이 생긴 적 있음 | **사건(기존) + 시스템이 더하기만** | 반응 카드 또는 동생 출생 해 | 안 꺼짐 |
| `mother_gone` · `father_gone` (**K3**) | 그 분이 먼저(혼자) 세상을 떠남 | 시스템 | 4-7절 (1) | 안 꺼짐 |
| `mother_apart` · `father_apart` | 이혼·별거로 그 분이 따로 삶 | 시스템 | 4-7절 (2) | 안 꺼짐 |
| `mother_works` · `father_works` | 지금 일하는 중 | 시스템 | 출생 때 취업이면 | 은퇴·집안일·실직(C) |
| `sibling_loss_risk` | 1969년 이하 출생 판의 12세 미만 형제가 있음 (Q3 사건 조건) | 시스템 | 조건 충족 | 조건 불충족 |
| `pet_dog` `pet_cat` `pet_other` (**K10**) | 지금 함께 사는 반려동물 종 | **사건이 켜고 시스템이 끔** | 입양 사건·부모 집 유무 | 이별 해 |
| `pet_farewell` (**K10**) | 한 번이라도 떠나보냄 | 시스템 | 첫 이별 | 안 꺼짐 |

기존 플래그(`parents_gone` `cared_parents` `grandparent_close` `sibling_close` `lives_with_parents` `moved_home` `child_distant` `child_left` `has_child` `married` …)는 **의미·세터 불변**.

### 6-2. 파생 일관성 (INV-7)

`deriveFamilyFlags(view)`가 시스템 소유 플래그 집합을 `FamilyView`에서 계산한다. `enterLife`가 출생 직후 한 번 써서 처음 플래그를 놓고, 이후 `familyChangesFor`는 파생 집합과 현재 플래그의 **차이만** `setFlags`/`clearFlags`로 낸다(사건 소유 플래그는 건드리지 않음). 시험 `tests/familyFlags.test.ts`: 7000판 × 전 나이에서 `flags ∩ SYSTEM = derive(view)`.

### 6-3. 가족 낱말 → 조건 표 (FA0-3 ④, 13-2절 입력)

| 낱말 | `requires` |
|---|---|
| 조부모·할머니·할아버지·외할머니·외할아버지 | `flags: ['has_grandparent']` (동거를 말하면 `lives_with_grandparent`) |
| 동생 | `flags: ['has_younger_sibling']` |
| 형·누나·오빠·언니·손위 형제 | `flags: ['has_older_sibling']` |
| 형제(복수·성별 불문)·남매 | `flags: ['has_sibling']` |
| 아버지·아빠 | `notFlags: ['father_gone', 'parents_gone']` |
| 어머니·엄마 | `notFlags: ['mother_gone', 'parents_gone']` |
| 부모님(복수) | `notFlags: ['mother_gone', 'father_gone', 'parents_gone']` — 한 분이 떠난 판은 변형 문장을 쓴 사건에서만(FM7) |
| 일터 낱말(「아빠 회사」 류) | 위 아버지 규칙 + `flags: ['father_works']`(어머니도 같음) |
| 강아지·고양이·반려 | 해당 `pet_*` (단 떠돌이를 말하는 `school-puppy` 본문은 제외) |

### 6-4. 이름 겹침과 출생신고

- 가족 이름은 `avoidNames`(주인공·또래 이름)와 겹치지 않고, 한 판 안 가족끼리 겹치지 않는다. 성 규칙(DF5): 아버지·형제자매·`pgf` = 주인공 성, 어머니·`mgf` = 어머니 성(주인공 성과 다르게 `names.json` 성씨 분포에서 뽑음), `pgm`·`mgm`은 각각 별도 성. 이름 풀은 **그 사람의 출생 연도** 풀(`namePoolFor(연도, 성별)`, 1940~2020). **1940 앞 출생(주로 조부모)은 FD24 추정 목록 필요** — 도착 전 임시 규칙: 가장 오래된 `pastPool(1940)`을 쓰고 `basis`를 설계값으로 표시, FD24 도착 시 교체(알려진 시드의 조부모 이름이 바뀌지만 저장된 판은 스냅샷이므로 영향 없음). `isRejectedName`·금지 이름 필터를 그대로 쓴다.
- **출생신고에서 아래 동생을 미리 보이지 않는다**(제안): 아직 태어나지 않은 동생이 신생아의 신고서에 있는 것은 모순이고, 동생이 태어나는 해의 기록·카드에서 처음 알게 되는 편이 감정 몰입에도 맞는다. SPEC FA3 「보이는 곳」의 「아래로 동생 1명」과 DF21(출생 때 정하는 것은 한꺼번에 보임)에 어긋나는 제안이라 **형진 님 확인 대상**(14절 B-1). 승인 전 기본값 = 위 형제만.

## 7. K1·K2 상세

### 7-1. K1 형제 수의 새 정의와 상속·경제 영향

- `siblingCountOf(game) = familyViewOf(game).siblingCount.living` — 태어났고 `gone`이 아닌 위·아래 형제 전원(독립한 형제 포함). 구정의(`familyOf().siblings.length`)와 달라지는 곳: ① 새로 태어난 판의 아래 동생이 첫째의 1명이 아니라 구성 전체(0~7명, 둘째 이상도 가능) ② 별세한 형제(Q3)는 빠짐 ③ 100세 초과 형제도 빠짐(구정의는 셌음, 영향 거의 0).
- 상속식 `inheritanceAmount(tier, siblings) = round(INHERIT[tier−1] ÷ (siblings + 1))`는 불변. 호출 시점의 형제 수는 **부모가 처음 모두 떠나는 해 끝**의 값(`inheritanceDue`의 `after`)이다 — 그 시점까지 태어난 동생이 모두 반영된다.
- 영향(예상 방향): 형제 수 평균이 오르고(첫째 외의 아래 동생·다자녀) 상속액 평균이 내려간다. 재측정은 FM4a 코어 회차: ① 적용 전후 7세대 × 1000판 **형제 수 분포·상속액 평균(재력 단계별)** 표 ② 최종 순자산 중앙값(재력 단계별) 변화 ③ SPEC-004 GM10 재측정과 겹치면 함께 잰다. 합격 기준은 4-7절 (1)의 이른 별세 효과와 **합쳐** 보고하되 원인을 나눠 적는다(K1 영향 / 이른 별세 효과 / K2·K4 사건 변경).
- 호환: 옛 저장은 `legacyFamilyFrom`의 구성(위 형제 + 사건 동생 ≤ 1)이라 형제 수가 옛 `familyOf`와 같다 → 진행 중인 판의 상속액이 바뀌지 않는다.

### 7-2. K2 `infant-new-sibling` 확정 — **A안 (권장)**

**구성이 정본이고, 첫째의 첫 동생만 반응 카드로 남긴다.**

1. 구성: `family.y[0].k ∈ {2,3,4,5}`(태어난 때 주인공 나이). 이 해가 `age == k`이면 동생 출생 해다.
2. `birthOrder === 1`이고 `y[0]`이 있으면 그 해에 **`infant-new-sibling`을 강제로 일으킨다**: `familyChangesFor`가 `forcedEvent = 'infant-new-sibling'`을 돌려주고 `stepYear`가 일반 추첨 대신 이 사건을 `picked`로 쓴다(마일스톤 처리 뒤, 선택지 간격 `MIN_YEARS_BETWEEN_CHOICES`·`pacing.hard`는 **무시**하고 `lastChoiceAge`를 갱신). 부모 영역·흘러감 위임(`decisionFor`)·`pending` 저장은 기존 선택지 사건과 같은 경로다. 난수 정렬: 그 해에도 `rollChoice`·`rollNarrative`는 평소처럼 소비하고 `pickWeighted` 한 번을 대신해 `rng.next()`를 한 번 소비한다(이후 수열의 칸이 일정).
3. 사건 데이터 변경(`infant.json`, 내용·id·선택지·효과·인용 불변): `conditions`의 `birthOrder`·`motherAge`를 **지우고** 새 선택 필드 **`trigger: 'family'`**를 단다(이 값이면 일반 추첨·마일스톤 슬롯 후보에서 빠지고 `forcedEvent`로만 일어난다), `ageRange`를 `{ min: 2, max: 5 }`로 넓힌다(구성의 나이 차 2~5와 같음). `weight`·`modifiers`는 남지만 읽히지 않는다. 선택지 `grandma`·`notice`의 `requires`는 그대로(`grandparent_close`) — 단 `grandparent_close` 자체가 `has_grandparent` 조건 아래서만 켜진다(13-2절).
4. 줄 하나 규칙: `forcedEvent` 해에는 `familyChangesFor`가 `fam-sib-born` 줄을 **쓰지 않는다**(사건의 결과 줄이 대신, 로그 `[1, age, 20+j, 1]`). 그 밖의 동생(둘째 이후 동생, 첫째가 아닌 주인공의 모든 동생)은 `fam-sib-born` 줄 하나(`[1, age, 20+j, 0]`). 어느 쪽이든 그 해 동생 출생 줄은 정확히 하나, 형제 수 불일치 0.
5. 플래그: 반응 카드의 네 선택지가 이미 `younger_sibling`을 켠다. 상태 줄 쪽 동생은 `familyChangesFor`가 `younger_sibling`을 더한다(INV-7의 「더하기만」 예외).
6. 사건 `weight 60`·`modifiers`로 정해지던 **옛 발생 확률**은 없어진다. 대신 첫째의 첫 동생 존재 확률은 `a_1(orderShares)`(4-3절)로 정해진다. FM4a 측정으로 옛 발생 비율(첫째 1000판 중 사건이 일어난 비율)과 새 비율을 **나란히 보고**한다(합격선 없음, 변화량만).

**대안 B (정리 비용이 낮은 쪽, 권장하지 않음)**: 사건을 건드리지 않고 **첫째의 첫 동생만 옛 사건이 계속 만들게** 둔다. 구성(`family.y`)은 그 동생을 `seen['infant-new-sibling']`에서 읽고, 둘째 이후 동생·첫째가 아닌 판의 동생만 상태 줄로 새로 만든다. 장점: 사건 풀·RNG·해시 불변, `trigger` 필드 불필요. 단점: ① 「구성이 정본」이 아님(첫 동생 존재가 사건 추첨에 달려 출생 때 정해지지 않음 → 출생 때 동생 수 `y.length`를 못 정함) ② 첫째의 동생 존재 확률이 `a_1`이 아니라 옛 사건 확률이라 FD 대조 불가 ③ 모순 방지 시험이 사건 쪽으로 새 규칙을 얹어야 함. 마스터가 B를 고르면 4-3절 (2)는 「첫째의 첫 동생은 사건이 정함」으로 바뀌고 `y[0]`은 생성 시점이 아니라 사건이 켜질 때 로그에서 채워진다.

## 8. FM5 그림이 먼저 필요로 하는 최소 상태 (FM4a가 채움)

FM4(코어)와 FM5(그림)를 나눠 구현하려는 계약이다. FM5는 `sceneFamilyOf(game)` **하나만** 읽는다(`sceneOf`가 가족 상태를 따로 계산하지 않음 — FA0-1).

```ts
export interface SceneFamilyState {
  calYear: number;
  me: { age: number; gender: Gender };
  members: SceneMember[];          // 함께 사는 사람 (주인공 제외). 최대 7. 순서 = 그림 왼쪽부터 (family-scene 3절의 식구 줄 순서)
  overflow: number;                // 8명을 넘어 그림에 못 나온 사람 수 (한 줄에만 「그 밖에 N명」)
  housing: Housing;                // 출생 점유 형태 (그림에는 표시 안 함)
  dwelling: Dwelling | null;       // 20세 이상
  homeKind: 'detached' | 'detached-rent' | 'multi' | 'apt' | 'shack' | 'other' | null;  // null = 표 대기 → 점유 형태 기본 모양
  rooms: number | null;
  pets: { species: 'dog' | 'cat' | 'other'; place: 'yard' | 'indoor' }[];                 // ≤ 2. 대기 D 전에는 사건이 켠 pet_* 플래그만
  changed: SceneChange[];          // 이번 해(age−1 → age)에 바뀐 종류 — 교차 페이드 트리거와 시험용
}
export interface SceneMember { id: PersonId; role: 'parent'|'grandparent'|'sibling'|'spouse'|'child'; gender: Gender; age: number; }
export type SceneChange = 'sib-born'|'sib-left'|'sib-gone'|'gp-gone'|'parent-gone'|'parents-apart'|'moved'|'pet-in'|'pet-out'|'independent'|'married'|'child-born'|'era';
```

| FM5가 먼저 쓰는 것 (요구) | 채워지는 곳 | 상태 |
|---|---|---|
| **식구 구성** (`members`, 순서·최대 8·`overflow`) | 3-1절 함께 사는 사람 규칙 | FM4a |
| **조부모 동거** (`role: 'grandparent'`) | 4-4절 `c`·별세 | FM4a |
| **형제** (위·아래·독립·별세) | 4-3절·4-7절 | FM4a |
| **주택 종류** (`homeKind`) | 4-5절 — 표 도착 전 `null` → 기본 모양 | FM4c (그 전에는 임시) |
| **반려동물 유무** (`pets`) | 5-1절 `pet_*` 플래그 읽기 | FM4a(읽기) / 부모 집 유무 FM4c(D) |
| **부모 별세·이혼 반영** (`members`에서 빠짐, `changed`에 종류) | 4-7절 (1)(2) | FM4a |

- `members[].age`는 달력 연도에서 계산한 **그 사람의 지금 나이**이고 FM5가 `ageGroupOf(age)`(얼굴 시스템의 8단계 경계)로 조각을 고른다. 성별은 저장 값, 배우자·자녀(성인기)는 10절.
- 같은 상태 → 같은 값(INV-12). 시험: `tests/sceneFamily.test.ts` — 100세 전수 × 7세대 × 100판에서 `members.length ≤ 7`, 중복 id 없음, 별세한 사람 0, 독립 전·후 `changed` 사례 ≥ 14(family-scene 3절의 14가지 바뀌는 때와 1:1).

## 9. 시대의 창 데이터 연결

설계는 `docs/design/family-scene.md` 5절(FM2c·FM2d 결정)을 그대로 따른다. **시대 문장은 창이 아니라 인생 기록의 `data-tl="era"` 줄**이고, 창에는 그림만 둔다(형진 님 결정).

### 9-1. 데이터와 함수

```ts
export interface EraWindow {            // 데이터 (지연 덩어리 familyArt의 시대별 하위 덩어리)
  id: string;
  years: [number, number];              // 사건은 [연도, 연도], 생활 장면은 5년 단위 범위
  kind: 'event' | 'daily' | 'base';     // base = 아래 9-3절 기본 생활 장면
  topic: string;
  hCode?: string;                       // SPEC-004 부록 A 연표 사건 코드 (kind: 'event'일 때)
  regionKey?: string;                   // 지역 사건(부록 B)이면 시도 안정 키
  line: string;                         // 인생 기록 줄의 문장 = 칸의 접근 이름 = 툴팁
  heavy: boolean;                       // 재난·참상에 가까움 (가리기 대상)
  approved: boolean;                    // 형진 님 사건별 승인 (RG11 방식) — 빌드가 미승인을 배포 빌드에서 막음
  draw: string;                         // 조각 id (40×32 그림)
}
export interface EraPick { window: EraWindow | null; veiled: boolean; sourceYear: number }
export function eraOf(calYear: number, ctx: { regionKey: string; gentle: boolean; seed: number }): EraPick;
```

- `eraOf`는 **순수 함수**다(`Date`·`Math.random` 없음). 판 시드는 `famHash01(famSeed, ERA=14, calYear, 0)`로만 쓴다.
- **한 해에 그림 1장**: 칸이 하나이므로 후보가 둘이면 하나를 고른다.

### 9-2. 고르는 규칙 (우선순위)

1. **지역 사건**: `kind: 'event'`·`regionKey === 출생 시도`·`approved`인 후보(부록 B). 주인공의 체험이므로 전국 사건보다 먼저.
2. **전국 연표 사건**: `hCode`가 그 연도(`years`)인 승인 후보(부록 A). 같은 해 둘이면 `famHash01(…, ERA, calYear, 1)`로 하나(같은 판에서는 항상 같은 그림).
3. **생활 장면**: `kind: 'daily'`, `years` 범위 안인 승인 후보. 겹치면 해시로 하나.
4. **기본 생활 장면** `kind: 'base'`(9-3절).
- `gentle`이 켜져 있고 고른 `window.heavy`이면 `{ window, veiled: true }` — 그림 없이 칸의 틀(`--c-surface-2`)만, 인생 기록 줄은 `.veil` 부품이 문장을 가린다. **가려진 해에 생활 장면으로 바꿔 넣지 않는다**(family-scene 5-3).
- **2026년 이후**: 사건 그림 후보를 쓰지 않고(출처 없는 미래 사건 금지, SPEC-004 S6) 2025년 생활 장면 세트를 유지한다. 줄의 「전망」 표지 낱말은 `copy.md`(FM6/FM7)에서 정한다(14절 A-12).

### 9-3. 승인 안 된 해의 기본 생활 장면 (`kind: 'base'`)

- 후보가 모두 `approved: false`이거나 없는 해를 위해 **사건·시대 주장이 없는 기본 장면** 3장 이상(시대 밴드 e1·e2·e3별 1장 이상: 예 「창가 불빛」「골목 지붕선」「식탁 위 그릇」류 — 사람·글자·실존 사건 없음)을 **먼저 승인**받아 둔다. 줄 문장은 시대 주장 없는 담백한 한 줄(예: 「그해에도 동네의 하루는 이어졌습니다.」 — 문구는 FM7).
- **배포 빌드 단언**: 1940~2025의 모든 해에 승인된 후보(사건·생활·기본)가 ≥ 1 — 없으면 빌드 실패. 개발 빌드는 `approved: false`도 보이되 칸 모서리에 「미승인」 표시(배포 번들에서는 코드째 제거).
- 승인 안 된 사건이 있는 해는 **그 사건이 없는 것처럼** 위 규칙 3→4로 내려간다(사건 문장은 어떤 경로로도 노출되지 않음).

### 9-4. 연표 H-코드·지역 사건과의 연결과 중복 방지

- 시대 줄은 SPEC-004 연표 줄 4종(그해·배경·지역 소식·전망)의 **다섯째 줄**이다. `EraWindow.hCode`가 같은 해의 연표 「그해」 줄과 같은 사건을 가리킬 수 있다(1988 올림픽). 이때 **문장은 달라야 한다**: 연표 줄은 사건을, 시대 줄은 그림이 보여 주는 것을 말한다(`era.line !== 같은 해 연표 줄 문장`, 시험). 같은 hCode의 두 줄이 한 해에 둘 다 있는 것은 허용.
- 지역 사건은 `regionKey`가 출생 시도와 같을 때만 후보. 연표의 「지역 소식」 줄과 같은 사건이면 위와 같은 규칙.
- `era` 줄은 **저장하지 않는 파생 줄**이다: 인생 기록을 그릴 때 해마다 `eraOf(calYear, …)`로 만든다. 따라서 `HISTORY_LIMITS`·`yearLineCount`(연출 대기)·저장 크기에 닿지 않는다. 병합 지점(연표 줄 4종이 인생 기록 목록에 합쳐지는 곳)은 SPEC-004 연표 구현이 만드는 곳과 같아야 하므로 **의존**이다(14절 A-12): 그 코드가 없으면 FM5가 먼저 `era` 줄만 합치는 `mergedLog(game)` 함수를 만들고 SPEC-004 쪽이 그 함수에 4종을 합친다.
- 칸 전체가 링크 하나(`#log-y<calYear>`, 모든 해에 줄이 있으므로 항상). 접근 이름 = `line`.

### 9-5. 지연 덩어리와 크기

- 시대의 창 그림·문장은 `familyArt`의 시대별 하위 덩어리(마스터 결정: 산업화~86 / X~밀레니얼 / Z~알파 셋 안팎, FM5 측정 뒤 상한). 판은 자기 세대의 하위 덩어리만 받는다(주인공 평생이 한 하위 덩어리에 닿지 않을 수 있어 **필요한 하위 덩어리를 해마다 이어받는 방식**은 FM5 설계가 정한다).
- 시험: T-ERA(12절).

## 10. 성인기 식구 슬롯 (FM6 연결 — 스키마 자리만)

- 배우자·자녀는 새 사건 없이 **기존 플래그가 켜지는 해**에 `familyChangesFor`가 알아채 만든다: `married`/`has_partner`→ 배우자(성별은 이성 부부 기본안 K11, 이름은 주인공 출생 연도 ± 나이 차의 풀, 나이 차는 아버지−어머니 모형), `has_child` → 자녀 수 `N`(출산력 `FD6` 코호트 분포, 설계 상한 4)과 출생 나이(첫 자녀 = 켜진 나이, 이후 2~5살 간격, 주인공 나이 ≤ 45)를 한 번 정해 로그 15·16에 쓰고 이름은 `family.ad`에 문자열로 더한다. **줄은 쓰지 않는다**(이미 있는 결혼·출산 사건 줄이 알림). 자녀의 인생 사건은 만들지 않고(나이에 따른 상태만) **경제는 자녀 수를 읽지 않는다**(K1).
- `child_left`면 따로 산다. 이혼(`divorced`)이면 배우자는 `apart`. 세부 규칙과 문구는 FM6 시작 때 이 절을 확장한다(여기서는 `FamilyData.ad`·로그 15·16의 자리만 확정).

## 11. 묶음 B·C·D 대기 칸 목록 (값이 없는 칸)

| 칸 | 위치 | 자료 | 도착 전 동작 | 메울 규칙 |
|---|---|---|---|---|
| 주택 종류 확률표 | 4-5 | 묶음 B FD11·FD12 | `h` 없음, 기본 모양·「집」 | 가장 가까운 센서스 해 · 시도 비 보정 · 0칸 불가능 |
| 방 수 확률표 | 4-5 | B FD13 | `r` 없음 | 가장 가까운 해 · 식구 수 조건 |
| 주택 이외의 거처 연도 범위 | 4-5 | B FD14 | 확률 0 | 범위 밖 0 |
| 셋방 딸림 확률 | 4-5 | B FD12 | `s` 없음 | 가장 가까운 해 |
| 배경 분류표 `regionKind` | 4-5·FM5 | B FD15 | 시도 단위 설계값 임시 분류 | 모호한 시도 설계값 표시 |
| 도시화율(고향 한 축) | 4-6 | B FD16 | 고향 줄 생략 | 부모 출생 해 도시 인구 비율 |
| 시도 간 이동 행렬 | 4-6 | C FD17 | 고향 줄 생략 | `by + 25` 해의 가장 가까운 해 |
| 이사 확률(연령·점유) | 4-7 | C FD18 | 이사 없음 | 연령 구간 · 점유 형태 이동 |
| 직업별 실직 위험 | 4-7 | C FD19 (+ 실업률은 저장소 DC4-4에 있음) | 실직 없음 | 실업률 × 직업 위험 × `SHIELD` |
| 부업·창업·폐업 | 4-7 | C FD19·DC26 | 없음 | – |
| 병환·장기요양 | 4-7 | C FD20 | `cared_parents`(기존)만 | 연령대 유병 |
| 양육권자 비율 | 4-7 (2) | C 후속 | 아버지 0.8(설계값) | 자료로 교체 |
| 미성년 인구 분모 확인 | 4-7 (2) | C `DT_1BPA001` | 출생아 수 합 근사 | 확인되면 교체 |
| 반려동물 양육 비율·마당 개 | 5-1 | D FD22 | 부모 집 반려동물 없음(입양 사건만) | 시대·마당 유무·점유 조건부 |
| 가전·물건 보급률 | 5-2 | D FD23 | `u` 없음, 줄 없음 | 임계값 방식 |
| 출생 성비·터울 | 4-3 | D FD7·FD8 | 성별 균등 · 터울 2~5 설계값 | 새 판부터 반영 |
| 1940 앞 이름 풀 | 6-4 | D FD24 | 1940 풀 임시 | planner가 FD 회차에 근거와 함께 |
| 직업 × 학력 표 | 4-2 | (FD3, 미수집) | 직업 기울기 설계값 | IPF 재계산 |
| 출산 직전 가구 연령별 취업 · 가사 사유 | 4-2 | A 후속 | 아버지 집안일 0 · 어머니 과소 | – |

## 12. 시험 계획

### 12-1. 분포 불변 — 세 층 (D-2)

| 층 | 대상 | 방법 | 합격 |
|---|---|---|---|
| **L0 출생** | `generateBirth`의 `character`·`stats`·`report`·`peerSeed`·`rngState` | 7세대 × 1000판(고정 시드 열). **이 변경 전에 만든 골든 해시**(`tests/fixtures/birth-golden.json`)와 비교 | 100% 일치 |
| **L1 기록 전용** | 인생 한 판 전체의 스탯·자산·플래그(시스템 플래그 제외)·엔딩 판정 | 가족 줄·시스템 플래그·`family`를 **뺀 투영**을 같은 시드·같은 선택 전략으로 이 변경 전 해시와 비교. K1(상속 형제 수)은 시험 훅 `legacySiblingCount`로 구정의를 쓰게 해 분리하고, 이른 부모 별세 효과·K2 강제 사건·K4 `requires`는 **끈 상태**로 | 100% 일치, 진행 RNG 소비 수 일치 |
| **L2 사건 변경 뒤** | K1 상속 · 4-7 (1) 이른 별세 효과 · K2 · K4 | 해시가 아니라 **분포**: 재력 단계별 최종 순자산 중앙값·분위·엔딩 판정 분포, 상속액 평균, 형제 수 분포, 선택지 수·판 길이. 변경 원인별로 나눠 한 번씩 켜 측정 | 4-7 (1) 합격 기준(중앙값 ≤ ▲3%, 순서 뒤바뀜 0, 판정 ≤ ▲2%p). 원인별 표를 `docs/data/family-remeasure.md`에 |

FA0-2·완료 기준 2의 문장 「해시 일치」는 L0·L1에만 적용된다는 정리가 필요하다(14절 A-3).

### 12-2. 모순 0 (INV-1~12)

- `tests/familyConsistency.test.ts`: 7세대 × 1000판 × 나이 0~100 전수에서 INV-1~12 위반 0 (한 판을 끝까지 `playToEnd`로 돌리며 해마다 `familyViewOf`·`sceneFamilyOf`·`deriveFamilyFlags` 검사). 구체 단언 예: 별세한 부모가 `members`에 없음 · `mother_gone`인 판에서 `household`에 어머니 0 · `parents_gone`이 켜진 해 이전에 `mother_gone`과 `father_gone`이 함께 켜지지 않음 · `family.l`의 `(종류,대상)` 중복 0 · 인생 기록 `fam-` 줄 수 = 줄을 쓴 로그 수 · 동생이 생기는 해 `fam-sib-born` + `infant-new-sibling` 줄 합 정확히 1.
- 낱말 ↔ `requires` lint(`tests/familyLint.test.ts`): 6-3절 표가 이벤트 풀 전체에 적용되고(예외 목록은 이유와 함께), 연표 줄·변형의 가족 낱말도 같은 표(TL16 소개정 뒤).

### 12-3. 구형 저장 호환 (FS3)

`tests/familyStorage.test.ts`: ① 필드 없음 3종(0·20·65세) → 열림·`family.lg === 1`·위 형제가 옛 `familyOf`와 같음·`seen['infant-new-sibling']`면 동생 1명·`w = 0`·**지난 해 줄 소급 0** ② 필드 있음 → 그대로 ③ 이상한 값(숫자 아닌 `d`·위 형제 수 초과·이름에 제로폭 문자·`l`에 미래 나이·`family` 자체가 배열 등) → 그 필드만 버리고 `ensureFamily`가 같은 시드로 같은 값을 다시 만듦(**결정성**: 새 판의 저장 값 = 재생성 값) ④ 크기 ≤ 1000자(7000판 최댓값) ⑤ v0.3.0 고정 저장 파일 3종 이어하기. 관찰(실패 아님): 새 저장을 이전 빌드가 열었을 때 판이 열림.

### 12-4. 1000판 경험 비율 대 표

모든 비교는 **7세대 × 1000판의 실제 출생 연도·조건에 맞춰 기대값을 적분**한다(고정 `p`가 아니라 판마다의 `p_i` 평균 → 기대값 `μ = Σp_i`, 허용 `4·√Σp_i(1−p_i)`).

| ID | 검사 | 기대(표) | 허용 |
|---|---|---|---|
| T-GP1 | 조부모 출생 때 나이 분포 | 4-1절 모 연령 분포(부모 출생 연도별) | 4σ, 범위 `PARENT_AGE_LIMITS` 100% |
| T-GP2 | 세대 이름 | `GENERATIONS` 범위(겹침 해 2개, 1940 앞 연대) | 100% 일치, 평가어 0 |
| T-FA2a | 어머니 집안일 비율 | 4-2절 `1 − 참가율` | 4σ |
| T-FA2b | 학력 분포(성·코호트) | 4-2절 `EDU`(IPF 후 주변분포) | ▲ 2%p / 4σ 중 큰 쪽 |
| T-FA2c | 불가능 조합 | 전문가 × 중 이하 = 0 | 0건, 집안일인데 직업 대분류 이름 노출 0 |
| T-FA3a | 위 형제 | 옛 `familyOf`와 100% 일치(새 판), R-330 | 0 위반 |
| T-FA3b | 첫째/둘째의 동생 있음 비율 | `a_1`, `a_2`(모 연령 상한 절단 보정 전·후 모두 보고) | 4σ, 절단 편향은 보고 |
| T-FA3c | 총 자녀 수(어머니 가중 1/N 환산)의 평균 | `fd-a#fd6_mean_children_by_age_calc` 코호트 값 | ▲ 0.4명(코호트를 두 센서스로 이은 불확실 ±0.2 포함) |
| T-FA3d | 동생 출생 해 어머니 나이 | ≤ 45 | 0 위반 |
| T-FA4a | 조부모 별세 나이 평균 | 같은 출생 코호트의 `survivalCurve` 기대 | NR5 허용 폭 방식 ▲ ±1.5세, 100세 초과 비율 보고 |
| T-FA4b | 0~12세 단면 조부모 동거 비율 | `pGp(R)` | 4σ |
| T-FA7a | 0~18세 사이 부모 이혼 경험 비율 | 코호트 1993~2006: 15.6~18.0% | 4σ (그 앞 코호트는 조이혼율 비에 따른 방향만) |
| T-FA7b | 19세 이하에 부모 한 분이 떠난 비율 | `survivalCurve`로 독립 계산한 값 | 4σ |
| T-FA7c | `mother_gone`/`father_gone` 비율 | 남성 별세 선행(같은 해 아버지 먼저) | 방향·비율 4σ |
| T-FA5·FA6 | 집 종류·고향 | 11절 표 도착 뒤 | 도착 뒤 정의 |
| T-ERA | 시대의 창 | 1940~2025 전 해 승인 후보 ≥ 1(배포 빌드), 같은 입력 → 같은 그림, 가림에서 heavy 그림 0, `line`이 같은 해 연표 줄과 다름 | 0 위반 |

### 12-5. 모듈별 단위 시험 (파일)

`tests/familyBirth.test.ts`(스트림 독립: 한 하위 추첨을 끄거나 바꿔도 다른 값 불변 · 같은 `famSeed` → 같은 `FamilyData` · 옛 저장 재생성 일치) · `tests/familyLife.test.ts`(`survivalCurve` 단조·`S[0]=1`·2024 유지·1970 앞 배율 ≥ 1·`deathAgeGiven` 경계) · `tests/familyTick.test.ts`(변화 종류별 줄·플래그·로그 · 진행 RNG 불소비(상태 해시) · 같은 시드 → 같은 시점 · `HISTORY_LIMITS`에 닿는 판에서 출생 첫 줄 보존) · `tests/familyFlags.test.ts`(INV-7) · `tests/sceneFamily.test.ts`(8절) · `tests/familyLint.test.ts` · `tests/familyStorage.test.ts` · `tests/era.test.ts`(9절).

## 13. 구현 순서와 이벤트 변경 (K4·TL16)

### 13-1. 순서 (승인 뒤)

1. FM4a 코어(0-3절) — 같은 회차에 **SPEC-004 TL16 소개정**(13-3절)을 planner가 한다.
2. 이벤트 데이터 변경(13-2절)은 **SPEC-004 MG2 변환 뒤**라는 K4 조건이 **충족되어 있다**(MG2는 v0.3.0에 포함되어 배포됨). 사건 변경은 L1 시험을 통과한 **뒤** 켜고(L2 측정), 켜는 단위는 K2 → K4 → 이른 별세 효과 순으로 하나씩.
3. FM5(그림)는 FM4a의 `sceneFamilyOf`가 서면 병행한다.
4. FM6·FM7·FM8은 SPEC 마일스톤 표 그대로.

### 13-2. 이벤트 변경 목록 (확정된 것 + lint가 찾을 것)

가족 낱말이 든 이벤트는 현재 `infant.json`·`school.json`에만 있다(낱말 31곳). 알려진 변경:

| 사건 | 변경 |
|---|---|
| `infant-new-sibling` | 7-2절(`trigger: 'family'`, 조건 교체, `ageRange` 2~5) |
| `infant-care` · `infant-daycare-wait` | 조부모에게 맡기는 선택지(`grandparent_close`를 켬)에 `requires: { flags: ['has_grandparent'] }` |
| `infant-grandparent-song` | `conditions.flags`에 `has_grandparent` 추가 |
| `infant-sibling-toy` | `conditions: { flags: ['has_younger_sibling'] }` |
| `infant-follow-sibling` | `conditions: { flags: ['has_older_sibling'] }` |
| `school-family-priority` | `conditions: { flags: ['has_sibling'] }` |
| `school-puppy` | `keep` 선택에 `setFlags: ['pet_dog']` (K10, FM7) |
| 노년 사건의 `grandparent_close` 보너스 | 읽기만 — `has_grandparent`가 꺼져도 보너스가 남는 것은 사이 단계(FC2)의 몫이라 변경 없음 |
| 중년 `middle-parents-farewell` · `cared_parents` 쪽 | FM7 변형(「남은 한 분」), `parents_gone` 세터 불변 |
| 그 밖 | 6-3절 표를 `eventLint`가 전 풀에 적용해 위반을 목록으로 낸다(낱말 → 조건). 부모/아버지/어머니 낱말이 든 서술 사건이 많으면 위반 수를 마스터에게 먼저 보고 |

### 13-3. SPEC-004 TL16 소개정 입력 (승인 뒤 planner가 SPEC-004에 적용)

현재 TL16 허용 플래그 8개(`has_career` `own_business` `married` `has_child` `no_child` `own_home` `renting` `college`)에 **가족 상태 어휘를 더한다**: `has_grandparent` · `has_younger_sibling` · `has_older_sibling` · `has_sibling` · `mother_gone` · `father_gone` · `parents_gone` · `mother_works` · `father_works` · `pet_dog` · `pet_cat` · `pet_other`(12개 제안, 총 20). 낱말 ↔ 조건은 6-3절 표. 영유아·어린이·청소년 시점 변형의 「부모/아빠 회사/조부모」가 이 플래그로 `requires`를 가진다. SPEC-004 본문에서 「성인 시점 변형에서 부모님이 …는 쓰지 않는다」 규칙은 그대로 둔다. 빌드 단언 V-25의 낱말 목록에 가족 낱말을 더한다.

## 14. 마스터 승인 필요

### A. 마스터가 결정할 것

| # | 내용 | 권장 |
|---|---|---|
| A-1 | **K5** 저장 `SCHEMA_VERSION` 9 유지 + 선택 필드 `family` + `legacyFamilyFrom`의 규칙(2-4절 표) | 승인 |
| A-2 | **K2** 7-2절 A안(구성이 정본 + 첫째의 첫 동생 반응 카드를 구성 해에 **강제**, `EventDef.trigger: 'family'` 신설, `stepYear`에 강제 슬롯). 엔진 변경이 가장 큰 항목. B안(사건 유지)과 비교 | A안 |
| A-3 | **FA0-2·완료 기준 2의 「해시 일치」를 L0·L1 한정으로 정리**(12-1절). 사건 풀을 바꾸는 K2·K4와 이른 부모 별세 효과 때문에 전 구간 해시 일치는 불가능 | 승인 |
| A-4 | **D-1 난수**: `forkRng` 대신 `peerSeed` 파생 스트림. FA0-2의 「추첨 순서 고정」을 「스트림 분리」로 대체 | 승인 |
| A-5 | **K3·부모 별세**: 「`parents_gone`보다 항상 앞선다」 → 「앞서면 먼저 한 분이 떠나고, 같거나 늦으면 기존 사건이 두 분을 맡는다」. 두 번째 분의 별세는 모델이 정하지 않음 | 승인 |
| A-6 | **이른 부모 별세 효과 초안**(4-7절 (1): 행복 −8·관계 −2·건강 −1, 집안 살림 −500/−300(집안일 −150) × 재력 배율 0.8~2.0, 19세 이하만)과 FM4 합격 기준(중앙값 ≤ ▲3% 등) | 초안 승인, 수치는 FM4 측정 뒤 조정 |
| A-7 | **K1** 형제 수 = 살아 있는 형제(별세 제외·독립 포함). 상속 재측정 범위 | 승인 |
| A-8 | **K10** 플래그 이름(`pet_dog` `pet_cat` `pet_other` `pet_farewell`)과 사건이 켜고 시스템이 끄는 규칙. SPEC-008이 따른다 | 승인 |
| A-9 | **시스템 소유 플래그 어휘**(6절, 새 이름 16개)와 `eventLint` 쓰기 금지, TL16 소개정 입력(13-3절) | 승인 |
| A-10 | **D-4** `family` 덩어리를 `familyData`(표, 「태어나기」 뒤 게임 데이터와 함께)와 `familyArt`(그림)로 둘로 나눔. K7 승인의 세부 조정 | 승인 |
| A-11 | **학력**: A-2 마스터 결정 3의 남성 추정식을 쓰지 않고 2010 단면 코호트 읽기로 일원화(교차 점검으로만 남김) | 승인 |
| A-12 | **시대 줄**: 파생 줄(저장 안 함, 판 길이 모델·`yearLineCount`에 넣지 않음), SPEC-004 연표 줄 병합 지점 의존, 2026 이후 처리·「전망」 표지 낱말 | 승인 (판 길이 편입은 형진 님 원칙대로 넣지 않음) |
| A-13 | **형제 독립 줄**(형제마다 한 줄) 유지, 형제 결혼은 만들지 않음 | 승인 |
| A-14 | **아버지 집안일 0**(자료 대기), 어머니 집안일은 전체 여성 참가율의 보수(과소 편향 명시) | 승인 |
| A-15 | **조부모 태어나기 전 별세**를 「떠난 가족」에 「내가 태어나기 전」 표기로 둔다(줄 없음) | 승인 |
| A-16 | **FD24 의존**: 1940 앞 출생 이름 풀이 오기 전 임시 풀(1940년대 풀, 설계값 표시). FD24는 planner가 FD 회차에 만듦 | 승인 |
| A-17 | SPEC-009 본문에 남은 「TV」 낱말: FT3 제목 「재난·정치 사건도 TV에 넣는다」·FT6 「TV 모양」 등은 이번 정리 범위(FT1·FT2) 밖이라 그대로 둠 — 정리할지 | 다음 정리 회차에 일괄 |

### B. 형진 님께 물어야 할 것 (마스터가 묶어서 한 번에)

| # | 질문 | 기본값(답 없을 때) |
|---|---|---|
| B-1 | **출생신고에 아래 동생을 미리 보일지.** SPEC은 「위로 형·누나 2명, 아래로 동생 1명」(출생 때 정해진 것은 한꺼번에 보임, DF21)이지만 아직 태어나지 않은 동생이 신생아 신고서에 있는 셈입니다. 제안은 신고서에는 **위 형제만** 적고 동생은 태어나는 해의 기록에서 처음 보이게 하는 것입니다 | 위 형제만 |
| B-2 | (알림, 질문 아님) 자료 그대로 쓰면 1993~2006년생의 약 16~18%가 0~18세에 부모 이혼을 겪고, 1970년대생의 약 40%가 조부모와 사는 시기를 거칩니다. 판의 체감이 클 수 있어 미리 알립니다 | 자료 그대로 |

## 15. 위험·한계 (이 설계가 알고 있는 것)

- **두 번째 부모의 별세를 모델이 정하지 않음**: 남은 한 분은 기존 사건(52~64세 · 이벤트 추첨) 또는 100세 규칙이 맡으므로 사건이 일어나지 않은 판에서 남은 분이 매우 고령까지 사는 기존 한계가 더 눈에 띌 수 있다. 켜면 상속·주거가 바뀌므로 별도 결정.
- **자료 공백**: 1940~60년대생의 조부모·부모는 학력·출산·사망 모두 추정·설계값이 크다(`fd-a` 6절). 화면은 접이식 근거 칸에서 항목별로 밝힌다(FA0-4).
- **기간 단면 근사**(이어짐 확률)와 **모 연령 상한 절단**은 동생 수를 하향 편향시킨다(보고 후 필요 시 나이 계수, 마스터).
- **저장 한도**: 로그가 많은 판은 1000자에 닿을 수 있다(압축 계획 있음).
- **강제 사건**(K2)은 `stepYear`의 선택지 간격·페이싱 규칙의 예외다. 같은 해 다른 선택지와 겹치지 않게 그 해 일반 선택 추첨은 건너뛴다(7-2절 2).

## 16. 마스터 승인 (2026-10-28)

- **FM3 게이트 ② 통과**: 이 문서 r1을 승인한다. FM4a(그림 최소 코어, 8절 `SceneFamilyState`)부터 구현한다.
- A-1~A-16: **권장대로 승인**한다.
  - A-2는 **A안**이다: 구성을 정본으로 하고, 첫째의 첫 동생 반응 카드를 강제하며, `EventDef.trigger: 'family'`를 둔다. 엔진 변경이라 FM4b에서 하고 검수를 따로 받는다.
  - A-6 수치는 초안으로 승인한다. FM4 재측정 뒤 조정한다.
- A-17: SPEC-009 본문에 남은 「TV」 낱말(FT3 제목·FT6)과 위험 표의 「▲ 93」은 다음 SPEC 정리 회차에 한꺼번에 고친다.
- B-1(출생신고에 아래 동생을 보일지): 형진 님 질문은 시대의 창 첫 승인 묶음 질문과 함께 묻는다. 답이 오기 전에는 **기본값 「위 형제만」**으로 구현한다. 화면 표시만 다르므로 나중에 바꾸기 쉽다.
- B-2: 자료 그대로 쓴다는 알림이다. 형진 님 보고에 함께 적는다.
- 묶음 B(집) 값은 수집 중이다. FM4a는 11절의 「자료가 오기 전 동작」으로 구현하고, 값은 `fd-b-house` 도착 뒤 표만 바꾼다.
- **추가 결정 (2026-10-28, FM4a 보고 뒤)**
  - B-1은 형진 님이 확정했다: 출생신고에는 위 형제만 보인다.
  - K1(형제 수 새 정의)은 FM4a에서 켜지 않는다(`SIBLING_COUNT_RULE = 'legacy'`). FM4b에서 상속·경제를 재측정한 보고를 보고 켤지 정한다. 측정값: 상속 평균 산업화 −31%·베이비붐 −30% 등.
  - 1940년 이전 어머니의 총 자녀 수가 모형 3.2명으로 FD6(4.1~5.6)보다 낮다. FM4b에서 고차 출산 이어짐 확률을 그 코호트에 맞춰 보정한다. 합격 기준은 FD6 ±0.45다.
  - FA7 변화 줄(`familyChangesFor`·`family.log`·stepYear 연결)은 FM4b에서 한다. FM4a 보고 「문서와 다르게 한 점」 5~7(6세 기준 동거 확률, 출산 연령 7칸, 스트림 태그 15·16, 1970 앞 사망 배율)은 받아들인다. 검수가 확인한다.
  - 묶음 B 값(주택 종류)은 `fd-b-house.md` 10절 결정대로 FM4b에서 `familyData`에 넣는다.
