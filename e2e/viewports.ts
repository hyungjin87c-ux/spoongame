/**
 * 모든 새 화면 e2e가 함께 쓰는 공통 뷰포트 목록 (SPEC-003 QM2-1 완료 기준 (a), CM10).
 * 한 곳에 정의하고 첫 화면뿐 아니라 룰렛·출생신고(M3)·대시보드(M4)·카드(M7b·M7c)의 e2e도 이 목록을 가져다 쓴다 —
 * 새 화면이 자기 화면에서 `focus-not-obscured` 검사(e2e/focusObscured.ts)를 통과해야 그 마일스톤이 끝난다.
 *
 * 목록은 모두 11종: 작은 폰(320×568·360×568), 일반 폰(360×740 터치·375×812), 가로 폰(667×375), 태블릿(768×1024),
 * 노트북·데스크톱(1024×768·1280×620·1280×800), 그리고 브라우저 확대 상당(640×400 = 1280 창의 200%, 320×256 = 1280 창의 400%).
 */
export interface StandardViewport {
  /** 테스트 이름에 쓰는 짧은 이름 */
  name: string;
  width: number;
  height: number;
  /** 터치 기기로 연다(hasTouch) */
  touch?: boolean;
  /** 브라우저 확대를 CSS 뷰포트 크기로 흉내 낸 것 */
  zoom?: boolean;
}

export const STANDARD_VIEWPORTS: readonly StandardViewport[] = [
  { name: '320x568', width: 320, height: 568 },
  { name: '360x568', width: 360, height: 568 },
  { name: '360x740-touch', width: 360, height: 740, touch: true },
  { name: '375x812', width: 375, height: 812 },
  { name: '667x375-landscape', width: 667, height: 375 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1280x620', width: 1280, height: 620 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '640x400-zoom200', width: 640, height: 400, zoom: true },
  { name: '320x256-zoom400', width: 320, height: 256, zoom: true },
];
