# 2026-10-28 SPEC-009 design — 시대의 창 r4b 세 곳 보강 + 집 그림 안 그린 조각 33

- 누가: designer (마스터 의뢰 2026-10-28 — A 형진 님 결정 「세 곳 더 현실적으로 후 승인」, B FM5 구현에서 드러난 `stand` 대체 33조각. 브랜치 `spec-009`, 커밋은 마스터. `src/`·`tests/`·`scripts/genFamilyArt.ts`·`docs/review/` 손대지 않음 — `src/data/familyArt/pieces.json`은 크기 추정을 위해 **읽기만**. 인터넷 조사 0 · 외부 URL 0 · 사진 모사 0 · npx 0 · 띄운 프로세스는 Playwright 크로뮴(각 shoot 스크립트가 띄우고 스스로 닫음)과 `inspect.mjs`의 Chrome(스크립트가 닫음)뿐, 서버 없음(`file://`).)
- 무엇: A ① `eraR4Scenes60.mjs` 1961 · ② `eraR4Scenes50.mjs` 1958 · ③ `eraR4ScenesBand.mjs` 1970년대 셋방·1980년대 반지하를 고치고(나머지 23장 바이트 그대로) 전 사본 `eraR4bBefore.mjs`, 전·후 시트 `buildEraWindowR4b.mjs` → `mockups/family/era-window-r4b.html` + `era-window-r4b-budget.json`, 촬영 `shootEraWindowR4b.mjs` → `screens/009/era-r4b-fix.jpg`(1280 + 360 한 장, 1,025KB) · `era-window.md` 8절 「r4b 보강」 줄 + 표 4행. B `familyPiecesFm5.mjs`(조각 33) → `buildFamilyMockups.mjs`가 `pieces/s1/`에 함께 씀(`pieces.html` 78조각·`budget.json` 갱신), 도우미를 `familyPieceLib.mjs`로 옮김(출력 바이트 동일 — 옮긴 뒤 다시 빌드해 기존 svg 변경 0 확인), 시트 `buildFm5Pieces.mjs` → `fm5-pieces.html`(장면 18 + 밴드별 조각) + `fm5-budget.json`, 촬영 `shootFm5Pieces.mjs` → `screens/009/fm5-pieces.jpg`(1,123KB) · `family-scene.md` **2-8절**(developer 인계 표) · `README.md` 54차 · `credits.md` 행 · 이 로그.
- 결과: 아래. 다음 단계: 형진 님 — r4b 네 장 확인(승인 표기는 마스터) · 1958 한 줄 변경 확인. developer — `sceneTables.ts` `drawn: true` 33 + `HOUSE_DRAWN` 18 상자·슬롯 → `npm run gen:art` → `sceneAssets` 시험. reviewer — 새 집 18의 낙인 0·글자 0, 반지하·셋방 자국의 수위.

## 1. A — 세 곳(네 장) 요약

| 장면 | 요청 | 한 것 | gzip 전→후(상한) |
|---|---|---|---|
| 1961 새벽 거리의 탱크 | 멀리서 바라보는 출근길 시민(얼굴 식별 없음) | 오른쪽 앞 보도(연석 띠)에 시민 셋 — 가방 멘 남자(모자)·보따리 인 여자(머릿수건)·도시락 든 사람, 모두 뒷모습으로 탱크 쪽을 본다. 자전거 한 대. 멀리 왼쪽 상가 앞에 먼 인물 둘. 앞줄 군인 열을 안쪽으로 당겨 군과 시민 사이를 띄움(접촉 0) | 1,190 → 1,507 (3,500) |
| 1958 보릿고개 | 빈 밥상과 나물 캐는 아이들까지, 희화화·몸 과장 없이 | 왼쪽 초가 툇마루 모퉁이 — 할머니와 아이가 앉은 작은 밥상, 안이 보이는 빈 그릇 둘 + 나물죽 한 그릇, 숟가락, 댓돌의 고무신. 앞 들에 호미로 나물 캐는 아이 둘(바구니)과 바가지 든 아이, 바구니 들고 돌아오는 어머니. 멀리 여인·지게꾼 유지. 몸 비례는 다른 장면과 같음. **한 줄 바꿈**: 「보릿고개에는 나물로 끼니를 이었습니다.」(21자, 이전 「봄이면 보리가 익기를 기다렸습니다.」) | 981 → 1,404 (2,500) |
| 1970년대 셋방(아래) | 그 집의 현실, 정돈된 결 유지 | 창 밑 물 흐른 습기 자국 + 바닥 가까운 옅은 얼룩 셋, 벽지 폭 이음새와 덧바른 자리, 이불 세 채 + 베개 + 보따리, 문지방 옆 연탄 두 장, 가지런한 신발. 자국 불투명도 0.25~0.35 | 1,059 → 1,282 (2,500) |
| 1980년대 반지하(아래) | 습기 자국·곰팡이·쌓인 이불·창 밖 발 | 창턱 아래 물 흐른 자국 셋, 오른쪽 위 구석의 곰팡이 얼룩(점 아홉, 0.24) + 벽 아래 번진 자국, 이불 네 채 + 베개 + 보따리, 창 밖 아이 다리 한 쌍 더(셋) + 하수구, 창턱의 화분, 문가 신발 두 켤레. 바닥·이불·상은 깨끗 | 1,051 → 1,423 (2,500) |

- 10년 덩어리(다시 잼, `era-window-r4-budget.json`): 1950년대 12,837B · 1960년대 13,927B · 1970년대 13,347B · 1980년대 17,505B — 모두 24KB 안. 122장 추정 143KB(230KB 안).
- 유지선: 얼굴 0(시민도 뒷모습·먼 인물), 글자·상징 0, 무기 겨눔 0, 몸 과장 0, 조롱·낙인·불결 강조 0.

## 2. B — 조각 33과 developer 인계

- 그린 것: 배경 7 · 집 18 · 소품 5 · 반려동물 3 = **33**(안 그린 조각 전부). 상세와 **상자·슬롯 표**는 `docs/design/family-scene.md` 2-8절.
- **`drawn: true`로 바꿀 id(33)**: `bg-metro-b1` `bg-town-b2` `bg-rural-b2` `bg-rural-b3` `bg-coast-b1` `bg-coast-b2` `bg-coast-b3` · `house-detached-h2` `house-detached-h3` `house-detached-rent-h1` `house-detached-rent-h3` `house-multi-h1` `house-multi-h2` `house-apt-h1` `house-apt-h2` `house-shack-h1` `house-shack-h2` `house-shack-h3` `house-other-h1` `house-other-h2` `house-other-h3` `house-estate-h1` `house-estate-h2` `house-estate-h3` `house-care-h3` · `prop-car` `prop-plastic-greenhouse` `prop-scooter` `prop-ev-charger` `prop-hanging-fish` · `pet-cat-yard` `pet-other-indoor` `pet-other-yard`.
- `sceneTables.ts`에서 할 일: `BG_DRAWN` +7(`BG_STAND` 7 삭제) · `HOUSE_STAND` 18 삭제 + `HOUSE_DRAWN` 18(상자·슬롯은 2-8절 표) · `PROPS` 다섯의 `false` 제거 · `PETS` 셋 `drawn: true, stand: null` · `npm run gen:art` → pieces.json 58조각 · `tests/sceneAssets.test.ts`. 코드가 만드는 집은 더 없다(18채 모두 정적).
- 패턴: 기와·난간·창 줄·복도식 단위·컨테이너 골·중소도시 창 여섯 종을 조각 안 `<defs><pattern>`으로(허용 태그·속성만). id는 조각 안에서만 유일 — 한 장면에 집·배경은 하나씩이라 겹치지 않고, 교차 페이드는 `svgNodes` 접두어가 가른다.
- **크기**: 새 조각 개별 gzip 합 16,905B(평균 512 · 최대 861). `pieces.json` 3,990B(25) → **12,120B(58)**, `familyArt` 덩어리 추정 7,180 + 8,130 = **≈ 15.3KB**(상한 16KB 안, 합 110KB 안 — 보수적 추정). 첫 빌드 17.3KB → 기와·난간·창 줄 패턴화 + 부속 그림자·문손잡이·화분 원 제거로 −2KB.
- 시안 장면 18(`fm5-pieces.html`): 새 집 18채가 한 번씩, 새 배경·소품·반려 모두 한 번 이상. 빌드가 연도 위반·안전 영역·식구 줄과 집 겹침을 단언하고, shoot가 조각마다 그린 내용이 상자 안인지(`getBBox`) 검사 — 첫 빌드 7개 상자 밖 → 0.

## 3. design-taste 전·후(designer.md 3·5·9·10)

- 읽은 것: `SKILL.md` · `references/app-screens.md` 2.7·13·14절(시트는 app 규칙) · `tells.md`. `draw.mjs`·`assets.mjs` 안 씀(토큰·카드 구조 그대로, 사진 0).

| 대상 | 전 | 후 | 남은 경고(규칙 9 — 일부러 둠) |
|---|---|---|---|
| `era-window-r4b.html` inspect `--app` 1440·1280·768·390·360 | 0 FAIL · 2 WARN(`palette-cream` · `hero-void` 29%) | **0 FAIL · 1 WARN** | `palette-cream` — 확정 바탕 토큰 `#f9f7f2` |
| `fm5-pieces.html` inspect `--app` | 0 FAIL · 4 WARN(`palette-cream` · `heavy-borders` 51 · `below-fold` · `panel-void` 4) | **0 FAIL · 3 WARN** | `palette-cream`(토큰) · `below-fold`(조각 카탈로그 시트 — 51칸이 첫 화면에 다 들어갈 수 없다) · `panel-void` 3(「빈 띠」로 잡힌 것은 2.5:1 배경 조각의 평평한 하늘과 4:1 소품 상자의 하늘 — 그림 내용) |
| lint `--app` 시트 2 + 생성기 7 | r4b 1 WARN `em-dash`(한국어 줄표 22) · fm5 0 | 같음 | `em-dash` — 한국어 캡션 줄표, 읽기에 걸리지 않음 |
| shoot(캡처 + 검사) | r4b: 문제 0 / fm5: 상자 밖 7 · 장면 폭 | **문제 0** 둘 다(넘침 0 · 전 4·후 4·확대 4·띠 4 / 장면 18·조각 33·상자 밖 0 · 외부 요청 0 · 글자 ≥ 14px · 강제 색상·다크·글자 200% 넘침 0) | – |

- 고친 순서(글꼴 → 색 → 여백 → 구성): r4b — 전·후 그림이 캡션 길이 차로 윗선이 어긋나 **그림 먼저·설명 아래**로, 글을 넷째 칸으로 옮겨 첫 화면 오른쪽 빈 띠를 없앰. fm5 — 칸 1px 경계선(대비 1.49:1)을 빼고 면 한 단으로, 조각 svg를 상자 비율대로(배경 2.5:1을 120px 고정 높이에 넣어 생기던 빈 띠 제거). 그림 자체는 미리보기 세 크기로 — 1958 밥상·그릇 키움(175px에서 「빈 그릇」이 읽히게), 반지하 곰팡이 얼룩 0.16 → 0.24(너무 옅어 보이지 않던 것), 단독 h3 2층 작은 창을 유리문 + 난간으로(해치로 읽힘).
- `--allow` 안 씀. 외부 사진·주소 0. 전·후 사본 `screens/009/era-r4b-taste-before/after-1440.jpg` · `fm5-taste-before/after-1440.jpg`(`.taste-skill/`은 저장소에 올리지 않는다).

## 4. 산출물
- 새: `scripts/design/{eraR4bBefore, buildEraWindowR4b, shootEraWindowR4b, familyPieceLib, familyPiecesFm5, buildFm5Pieces, shootFm5Pieces}.mjs` · `docs/design/mockups/family/{era-window-r4b.html, era-window-r4b-budget.json, fm5-pieces.html, fm5-budget.json}` · `pieces/s1/*.svg` 33 · `docs/design/screens/009/{era-r4b-fix, fm5-pieces, era-r4b-taste-before-1440, era-r4b-taste-after-1440, fm5-taste-before-1440, fm5-taste-after-1440}.jpg` · 이 로그.
- 고침: `scripts/design/{eraR4Scenes50, eraR4Scenes60, eraR4ScenesBand, buildFamilyMockups}.mjs` · `mockups/family/{era-window-r4.html, era-window-r4-budget.json, pieces.html, budget.json}` · `pieces/era-r4/` 4 · `docs/design/{era-window, family-scene, README, credits}.md`.
- 불변: `src/` · `tests/` · `e2e/` · `docs/spec/` · `docs/TODO.md` · `docs/review/` · `pieces/s1/` 기존 45 · `pieces/era-r4/` 나머지 23.

## 5. 형진 님·마스터께
1. r4b 네 장이 결정대로 읽히는지 — 특히 1958의 **한 줄 변경**(「보릿고개에는 나물로 끼니를 이었습니다.」)과 반지하 곰팡이 얼룩의 수위(구석 하나, 옅게).
2. 집 18채는 파라미터 변형 없이 한 모양씩이다(수저는 `scale`·마당·담으로만). 2층 유무·층 수 변형이 필요하면 다음 묶음.
3. `familyArt` 덩어리 추정 15.3KB는 상한 16KB에 가깝다 — developer 실측이 15KB를 넘으면 큰 집 3채의 밀린 그림자를 빼 1KB 더 줄일 수 있다(시안 준비됨).
