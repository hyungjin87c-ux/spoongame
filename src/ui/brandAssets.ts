/**
 * 디자이너가 넘긴 브랜드·아이콘 자산을 가져오는 한 곳 (SPEC-003 M1 → M2). 파일 경로를 바꾸지 않고 그대로 참조한다 —
 * 디자이너가 같은 경로에서 파일을 다듬어도 화면 코드는 그대로이고, 경로가 바뀌면 이 파일만 고친다.
 *
 * 형진 님이 고른 심볼은 A안 「담긴 땅」(src/assets/brand/a/…). 로고는 인라인 SVG로 넣는다: 파일 안의 `fill: var(--c-logo)`가 페이지의 CSS 변수를 읽어야
 * 다크·강제 색상에서 색이 따라가기 때문이다(<img>로 불러오면 변수를 읽지 못한다). 자산은 우리 저장소의 파일이라 문자열째 넣어도 안전하다.
 */
import iconsRaw from '../assets/icons/ui-icons.svg?raw';
import spoonGradesRaw from '../assets/icons/spoon-grades.svg?raw';
import wordmarkRaw from '../assets/brand/wordmark.svg?raw';
import logoHeaderRaw from '../assets/brand/a/logo-header.svg?raw';

/** 첫 화면의 게임명 로고(SPEC-005 D5-01 A안): 워드마크(「수저 게임」 글자)만 — 두 폭 모두 같은 것이고 왼쪽 정렬 머리 줄의 제목이다. 세로 로고·가로 로고(심볼 + 워드마크)는 쓰지 않는다 */
export const LOGO_WORDMARK_SVG: string = wordmarkRaw;
/** 첫 화면 밖 모든 화면의 헤더 로고(단순화 심볼 + 워드마크, 높이 40px, DS1 워드마크 글자 높이 ≥ 22px) */
export const LOGO_HEADER_SVG: string = logoHeaderRaw;
/** 아이콘(`i-*`)과 수저 5단계(칩 `sp-1`~`sp-5`, 큰 변형 `sp-1-lg`~`sp-5-lg`)의 <symbol>이 들어 있는 스프라이트 두 개 */
export const SPRITE_SVG: string = iconsRaw + spoonGradesRaw;

/** 화면이 쓰는 스프라이트 id (자산에 모두 있는지 tests/titleScreen.test.tsx가 점검한다 — 도형 내용은 점검하지 않는다) */
export const ICON_IDS = ['i-prev', 'i-forward', 'i-pause', 'i-play', 'i-check'] as const;
/** 칩 변형(<= 24px, 무늬 없는 실루엣) — 첫 화면에는 쓰지 않는다(M3 이후 화면이 쓴다) */
export const SPOON_IDS = ['sp-1', 'sp-2', 'sp-3', 'sp-4', 'sp-5'] as const;
/** 큰 변형(>= 32px) — 첫 화면 수저 다섯 자루 띠(32x52)가 쓴다 */
export const SPOON_LG_IDS = ['sp-1-lg', 'sp-2-lg', 'sp-3-lg', 'sp-4-lg', 'sp-5-lg'] as const;
