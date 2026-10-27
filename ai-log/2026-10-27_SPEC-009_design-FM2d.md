# 2026-10-27 SPEC-009 design-FM2d — 형진 님 결정 반영: 시대의 창은 그림만 · 그해 문장은 인생 기록의 「시대의 창」 줄(새 색 토큰)

- 누가: designer (마스터 전달 2026-10-27 — 형진 님 답: ① 배치 2:1(PC)·쌓기(휴대폰) 승인, 연도 표 「1988년」만 ② 시대의 창에는 **그림만**(머리 글자·문장 제거, 휴대폰 띠 높이 다시) — 이름은 접근 이름 + 툴팁 ③ 그해 문장은 **인생 기록에서 다른 색의 줄**(연표 줄 문법 + 색 토큰 하나, 색만으로 구분하지 않음, 대비 4.5, 누르면 이동·잠깐 강조, 움직임 줄이기면 강조만). 정본 SPEC-009 머리 「FM2c 배치 결정」(커밋 74f5fc4). 지킨 것: `src/` 읽기만 · 커밋 없음 · 외부 자원·웹 접근 0 · 그림 안 글자·인물·정당 상징 0 · 줄 끝 LF · 사용자 폴더 경로 0 · 띄운 프로세스는 Playwright 크로뮴·inspect의 Chrome뿐, 스크립트가 스스로 닫음).
- 무엇: ① 생성기 `scripts/design/buildFamilyMockups.mjs` — 시대의 창 그림 좌표계 **40×32(5:4)**(PC 칸 175×140·휴대폰 100×80에 잘림 0, `mid()` 도우미로 40×20 내용을 가운데에), `eraBox` 그림만 + `sr-only` 접근 이름 + `title`, 인생 기록 **시대 줄** `eraRow`(`data-tl="era"`, `id="log-y1988"`, `tabindex=-1`) + 창 아이콘 `ERA_ICON`(`#i-era`), `family.css`에 토큰 `--c-era`·`--c-era-soft`(라이트·다크·강제) + 줄 규칙(5px 겹선·표지·`:target` 강조 `era-flash` 2.4s·움직임 줄이기·강제) + 휴대폰 띠 80px, 대시보드 `?target=1` ② 촬영 `shootFamily.mjs` 기본 모드 `fm2d`(캡처 3 + 검사 22 — Enter → `#log-y1988` :target·초점·스크롤 영역 안·2.6초 뒤 강조 해제·대비·움직임 줄이기 `anim none`), `fm2b`·`fm2c`는 기록 ③ 문서 `family-scene.md` 머리·5절(5-1 띠 높이 후보, 5-3 그림만·툴팁 제안, **5-4 시대 줄 새로**, 5-5 예산)·6절 합계·9절, `design-system.md` **18-3**(토큰 2·아이콘), `family-art.md` 상태 줄, `README.md` 49차 ④ 캡처 `screens/009/fm2d-*.png` 3장 ⑤ 이 로그.
- 편집 범위: 새 — `fm2d-dash-1280.png`·`fm2d-dash-360.png`·`fm2d-log-era-row.png`, 이 로그. 수정 — 생성기·촬영 스크립트, `mockups/family/{dashboard-family.html, scenes.html, pieces.html, family.css, budget.json, scenes.json, pieces/s1/era-*.svg 3}`, `family-scene.md`·`family-art.md`·`design-system.md`·`README.md`. 불변 — `src/`·`tests/`·`e2e/`·`docs/spec/`·`docs/TODO.md`·`fm2b-*.png`·`fm2c-*.png`.

## 1. 스킬 절차(designer.md 1~10)
전: FM2c 시안(`fm2c-after` = 이번 전) → 후: `.taste-skill/009/fm2d-after`, 폭 1440·1280·768·390·360. 순서: 글자(새 크기 0 — 표지 12px·문장 16px은 연표 줄 그대로) → 색(**새 토큰 2 제안** — 규칙 9에 따라 시안과 이유만 남기고 마스터에게 묻는다, 값은 `family.css`에만) → 구획(그림 띠·인생 기록 구조 불변) → 구성 요소(시대 줄 + 겹선·아이콘) → 움직임(`:target` 강조 1회, 움직임 줄이기면 없음). 외부 사진·주소 0.

## 2. 결정·실측 (정본 `family-scene.md` 5절)
- **시대의 창 = 그림만**: PC 175×140 = 그림 175×140(5:4 좌표계로 바꿔 잘림 0). **휴대폰 띠 80px**(5:4 그림 100×80 왼쪽, 나머지 `--c-surface-2`) — 후보 ⓐ 전폭 5:4 326×261(54%@740) ⓑ 전폭 4:1 잘라 보이기(안전 영역 밖) ⓓ 64px(아이콘 크기) 탈락. 띠 합계 130 + 8 + 80 = **218px(29.5%@740)**.
- **이름 알리기**: 접근 이름 `sr-only` 「시대의 창 · {문장} 그해 기록으로」, **툴팁은 브라우저 기본 `title="시대의 창 · {문장}"` 제안**(떠 있는 층·초점 정지점·스크립트 없음; 키보드·터치는 접근 이름과 인생 기록 줄이 같은 정보를 준다). 직접 만든 말풍선은 권하지 않음(모바일 눌러야 보임·닫기 규칙·겹침 순서).
- **시대 줄** `data-tl="era"`: 연표 줄 문법 그대로 + ① 새 토큰 **`--c-era`** 오디색 라이트 `#6d2f4e`(면 9.53·파인 면 8.08·ΔE2000 최소 19 vs `--c-stat-health`, `--c-down` 20) · 다크 `#f5a8d6`(8.79·7.62·`--c-down` 18·`--c-stat-relation` 14 — 상태색 기준 12) · 강제 CanvasText ② 모양 **5px 겹선**(기존 실선·점선·긴 점선에 없는 넷째) ③ 표지 「시대의 창」 + 창 아이콘 `i-era`. **`--c-era-soft`**(`#f4e3ec`/`#3a2434`) = `:target` 강조 면, 1.2초 머물다 1.2초 사라짐(2.4s `both`, 실측 2.6초 뒤 면 없음), 움직임 줄이기면 애니메이션 없이 면만(실측 `anim none`), 강제 색상은 2px Highlight 테두리. 줄 `tabindex=-1` → Enter 뒤 초점 이동(3px `--c-focus`).
- **대비 실측**: 표지 라이트 9.53(강조 면 위 7.87) · 다크 8.79(7.73) · 강제 21, 문장 15.81(13.04) · 13.17(11.58). 연도 표 15.81/13.17/21 불변.
- **만들다 고친 것**: ① 글 없는 칸은 2:1 배치에서 5:4라 40×20 그림이 37% 잘림 → 좌표계 40×32 ② 링크 이동 뒤 줄에 브라우저 기본 초점 테두리 → 3px `--c-focus` 안쪽 ③ 평소 상태 줄 확대 캡처가 스크롤 영역 밖이라 빈 클립 → 줄을 가운데로 스크롤 뒤 촬영 ④ 360 전체 캡처가 결정 카드에 가려 그림 카드가 안 보임 → 그림 카드로 스크롤(누른 뒤 캡처는 줄 보이게).

## 3. 후 + 남은 경고·예외
| 대상 | 전(fm2c-after) | 후(fm2d-after) |
|---|---|---|
| inspect `--app` 1440·1280·768·390·360 | 1 FAIL · 3 WARN | **같음(1 FAIL · 3 WARN, 새 경고 0)**, 글자 크기 집합 불변 |
| lint `--app` family + 생성기 + 촬영 | 0 FAIL · 1 WARN `em-dash` | 0 FAIL · 1 WARN `em-dash`(한국어 주석 줄표) |
| shootFamily(캡처 3 + 검사 22) | — | **문제 0**: 넘침 0(1280·360·320 글자 200%·1280 글자 200%·1920·1280×600·다크·강제·접힘·가리기) · 집 그림 ≤ 25vh · 순서 · 접기(둘 다) · 시대의 창 = 그림만 + 링크 1 · Enter → `#log-y1988` target·초점·보임 · 2.6초 뒤 강조 해제 · 표지·문장 대비 ≥ 7.7 · 움직임 줄이기 `anim none` · 외부 요청 0 · 캡처 ≤ 179KB |
| repoHygiene | — | 22/22 통과 |

예외: `button-fx`@768(기존 ds.css) · `palette-cream`·`heavy-borders`(확정 토큰·3:1 경계) · `ragged-row`(DB1 3열, 기존) · `em-dash`(한국어 주석). 새 토큰 2는 규칙 9에 따라 **마스터 확인 전 제안**(`tokens.css` 불변).

## 4. 예산
- 조각 45(불변) · 시대의 창 장당 **335B**(5:4 틀 — 314·272·418): 사건 1장/해 + 생활 17장 → 13.8KB(+한 줄 16.9KB) · 2장/해 → 25.2KB(+30.9KB). `family` 합계 2장/해 기준 ≤ **75.0KB**(꼭 참) → 시대별 하위 덩어리 또는 해마다 1장을 권함(마스터 판단).

## 5. 산출물
- 시안 `mockups/family/dashboard-family.html`(`?scene=a&era=stadium|ballot|kite|none&hide=1&target=1&split=…&theme=dark&motion=reduce`) · `scenes.html#era-samples` · `pieces/s1/era-*.svg` 3(40×32) · `budget.json#era` · `family.css`.
- 캡처 3장 `screens/009/`: `fm2d-dash-1280.png`(105KB) · `fm2d-dash-360.png`(179KB) · `fm2d-log-era-row.png`(130KB).
- 문서: `family-scene.md` 5·6·9절 · `design-system.md` 18-3 · `family-art.md` · `README.md` 49차.

## 6. 다음
1. 마스터·형진 님: 토큰 2 승인 · 툴팁(title) · 띠 80px · 표지 낱말 「시대의 창」/「시대」 · (이월) 표본 셋은 FM7 승인 때 · 초점 정지점 1 · 식구 셈법·예산 87 · 「작은 집」 · 요양 시설.
2. developer(FM5): `tokens.css` `--c-era`·`--c-era-soft` + `--c-scene-*` 24, `ui-icons.svg` `i-era`, `dash.css` 시대 줄·`:target` 강조, 그림 카드 2열 격자 + 컨테이너 쌓기(띠 80), `ERA`·`eraOf`·빈 해 단언·`#log-y<year>`, 엔딩 연표 같은 줄.
3. reviewer: 정체성·낙인·닮음 판독(그림만 든 칸 + 시대 줄), 다른 게임의 「우측 상단 TV 모니터」와는 구조만.
