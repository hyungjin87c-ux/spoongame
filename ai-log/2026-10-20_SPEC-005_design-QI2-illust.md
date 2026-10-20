# 2026-10-20 SPEC-005 design-QI2-illust (첫 화면 시안 r2 — 형진 님 일러스트로 다시 짜기)

- 누가: designer (마스터 지시 2026-10-20 「픽토그램 A/B 대신 형진 님이 준 그림을 다듬어 첫 화면에」 + 중간 전달 「출처: 형진 님이 AI 활용해 만듦」). 편집 범위:
  - 새 파일: `src/assets/home/home-map-pc.webp`·`home-map-mobile.webp`(새 폴더 — **`src/`의 기존 파일은 손대지 않았다**, developer의 QI1 작업과 겹치지 않음), `docs/design/source/cut-home-illustration.py`(처리 스크립트 기록), `docs/design/screens/005/illust-*.png` 14장 + `compare-tagline.png`, 이 로그.
  - 고친 파일: `docs/design/mockups/title-005.html`(주소 질의 `hero=illust`·`tag=alt`, `<figure class="illust">` 두 자리, 부제 cur/alt 스팬)·`title-005.css`(「일러스트」 블록 + 카드 색 토큰 + 강제 색상), `docs/design/diff-005.md`(6-1절·7절 D5-24~D5-31), `design-system.md`(12-5·12-6), `credits.md`(일러스트 행), `copy.md`(9-9 부제 후보), `README.md`(32차 배너·먼저 볼 13). SPEC·TODO·`tests/`·`scripts/`·`e2e/`는 읽기만. 커밋·푸시 없음.
- 무엇을:
  1. **원본 확인**: `docs/design/source/home-illustration-source-2026-10-20.webp` 1536×1024 — 한반도 모양 안 삶 장면 수채화, 왼쪽 위 손글씨 제목·설명, 오른쪽 통계 패널 둘(「다양한 통계로 보는 한국」·이해도/공감도 막대 = 가짜 수치), 왼쪽 아래 노트북 앞 인물·컵·말풍선, 오른쪽 아래 도시 풍경·손글씨 팻말, 바다의 돛단배·여객선, 아래 점 내비·캡션. **지도 안에는 글자가 없었다**(바깥의 글만 잘라 냄).
  2. **다듬기**(로컬 Python PIL·numpy·scipy, 외부 생성 서비스·업로드 0 — 절차는 `design-system.md` 12-5): 손 다각형 + 제외 상자(배 둘·스카이라인) → 색 분류(하늘/흰색/색 있는 내용) + 「얇은 흰색」으로 지도의 흰 테두리 보존 → 구멍 채움·조각 정리 → 믿는 구역(북쪽 두 타일 꼭대기·제주 꼭대기 — 타일 안 하늘이 테두리까지 이어지는 곳) → 바깥 띠의 하늘 픽셀·구름 자락 제거 → 페더 σ 1.4 → 채도 0.92·살짝 따뜻하게 → 22% 크림색 바깥 광 → 알파 WebP. 세 번 돌려 고친 것: ① 질감 기준이 하늘 물결을 지도로 셌다(1차) ② 「색에서 먼 흰색」 규칙이 타일 안 구름을 뚫어 다크에서 검은 구멍(2차 — 띠 14px 안으로 한정) ③ 믿는 구역 다각형 변이 하늘 띠로 보여 6px 띠만 손봄(3차).
  3. **자산 예산**: 크기·품질 표를 재서 PC 545×640 q66 **57.5 KB**, 모바일 341×400 q74 **30.8 KB**, 합계 **88.3 KB ≤ 100 KB▲**(800px·q72였으면 136 KB). 한 뷰포트에서 두 `<picture>`가 같은 파일을 고르므로 내려받기 1회 — 초기 로드 1280 ≈ 286 + 58 = 344 KB ≤ 400 KB.
  4. **배치**(`?hero=illust`): 넓은 화면 오른쪽 열 맨 위 300px(≥ 1600px 400px) → 바로 아래 통계 카드, 좁은 화면 워드마크 아래 배너 200px. `width`·`height` 속성 + 높이 고정으로 레이아웃 이동 0, `alt=""`·`figure aria-hidden`(장식), 클릭 없음. 다크는 같은 파일 + `brightness(.86) saturate(.9)`.
  5. **카드·차트 색 맞춤**: `.carousel--005` 안에서만 새 토큰 4개(`--c-chart` 하늘 남색 #2f5f8f/#9fc4ea, `--c-card-tint` 위 88px 띠, `--c-card-border`, `--shadow-card`), 강제 색상은 시스템 색으로 복귀. 전망 놋쇠 점선·빗금·보조 계열·칩·텍스트 색은 그대로(실측 실선 / 전망 점선 유지).
  6. **부제 후보**: `?tag=alt` 「다른 세대, 다른 삶, 같은 대한민국」 + 「부제 후보」 표식, 비교 그림 `compare-tagline.png`. 기본은 지금 부제.
  7. **촬영·측정**: playwright-core(개발 의존성, `node_modules` 절대 경로 import, npx 없음), 서버 없음 `file://`, DPR 1, 브라우저는 스크립트가 띄우고 `finally`에서 닫음(남은 프로세스 0). 모든 상태에서 콘솔 오류 0·외부 요청 0·가로 넘침 0(sr-only 자손 제외 재점검). `npm test -- tests/designAssets.test.ts` **74/74 통과**(16:05).
- 결과:
  - **형진 님께 보여 드릴 대표 화면**: `docs/design/screens/005/illust-1280x800.png`(PC) · `illust-360x740.png`(모바일). 다크 `illust-1280x800-dark.png`·`illust-360x740-dark.png`, 1920 `illust-1920x1080.png`, 부제 비교 `compare-tagline.png`.
  - 1280×800: 그림 255×300(열 가운데), 카드 위 332(픽토그램 때 205), 표제어 아래 408 · 값 아래 478 · 그래프 위 484 < 띠 732(HS3 ④), 왼쪽 열 끝 655 < 732(QI2 그대로, 띠 가림 재발 없음), 이어서 살기 655 < 680, 8장 886(스크롤 154). 1920×1080: 그림 341×400, 값 아래 578 < 1012. 360×740: 배너 328×200(지도 171px), 로고 글자 41px 유지. 320: 넘침 0(200%도).
  - 대비(계산): 실측 선/면 6.55(라이트)·8.87(다크), 선/띠 6.01·8.26, 띠 위 공식 통계명 `--c-text-3` 5.30·5.54, 조작 상자 테두리/띠 3.68·3.99, 놋쇠/띠 4.56·7.90. 실측 선 대 전망 놋쇠는 1.32·1.05 — 밝기 아닌 색상+무늬+라벨+범례로 구분(FC2 그대로).
  - PNG 15장 2.45 MB(최대 342 KB), 그림 자산 2장 88.3 KB. 저작권: 원본은 형진 님이 AI 도구로 생성해 제공(2026-10-20), 다듬기는 designer — `credits.md`에 기록, 공개 배포 전 AI 도구 약관 확인은 형진 님(마스터 기록). 그림 속 인물은 일반형, 상호·로고 0, 글자 0, 다른 게임 그래픽 0.
- 다음:
  1. **마스터 → 형진 님**: 대표 화면 2장 확인(HS5 게이트) + 부제 후보 채택 여부(`compare-tagline.png`) + 360 배너 높이(200px 기본 / 160px 축소안).
  2. **developer(QI3, 확인 뒤)**: `diff-005.md` 7절 D5-24~D5-31 — `TitleScreen.tsx` figure 두 자리, vite 자산 import, `title.css`로 「일러스트」 블록 이관, `tokens.css` 토큰 4개(라이트·다크 두 블록·강제 색상) + `checkContrast` 쌍 5개, `designAssets.test.ts`에 자산 크기 계약(합계 ≤ 100 KB, 알파 WebP, width·height 속성) 추가 제안. 픽토그램 A/B(D5-01·D5-02)는 폐기.
  3. **designer 후속**: 형진 님이 배너 높이·부제를 정하면 샷 갱신, `shootMockups.mjs` SHOTS 등록과 `buildMockups.mjs` 합치기(지금은 저장소 밖 생성기 — `cut-home-illustration.py`만 `docs/design/source/`에 기록). 그림의 원본 해상도 교체(형진 님이 더 큰 원본을 주면 같은 스크립트로 재생성).
