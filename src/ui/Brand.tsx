import type { Ref } from 'react';
import { LOGO_HEADER_SVG, LOGO_ROW_SVG, SPRITE_SVG } from './brandAssets';

/** 아이콘·수저 도형 스프라이트. 화면에 한 번 둔다(<use href="#i-prev"/>가 문서 안에서 찾는다). */
export function Sprite() {
  return <div className="sprite" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SPRITE_SVG }} />;
}

export function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <svg className={className === undefined ? 'icon' : `icon ${className}`} aria-hidden="true" focusable="false">
      <use href={`#${name}`} />
    </svg>
  );
}

/**
 * 수저 한 자루 (등급 1~5). 색은 부모의 `.grade--N`이 정한다. 도형은 디자이너의 스프라이트 안에 있다 —
 * 칩(<= 24px)은 `#sp-N`(무늬 없는 실루엣), 32px 이상(첫 화면 띠 32x52)은 `#sp-N-lg`(재질 표식이 있는 큰 변형). 큰 크기에 칩 변형을 쓰지 않는다.
 */
export function Spoon({ grade, large }: { grade: 1 | 2 | 3 | 4 | 5; large?: boolean }) {
  return (
    <svg className={large ? 'spoon spoon--lg' : 'spoon'} aria-hidden="true" focusable="false">
      <use href={large ? `#sp-${grade}-lg` : `#sp-${grade}`} />
    </svg>
  );
}

/**
 * 첫 화면의 게임명 로고 (SPEC-016 H2, 형진 님 2026-11-10 안 B — `docs/design/title-ci.md`): **가로 결합 로고**(`logo-a.svg` — 정식 심볼 왼쪽 + 워드마크). 이전(SPEC-005 D5-01)에는 워드마크만이었다.
 * 높이는 CSS(`.hero .logo--row`, 좁은 화면 88px → 글자 획 상자 42px로 DS1 ≥ 40px, 넓은 화면 108px → 51px)가 정한다. 320px에서는 칸 폭 288px에 맞춰 줄어 글자 획 상자 39px(마스터 허용).
 * 장식으로 숨기고 게임명은 바깥 제목(<h1>)의 읽히는 글자 「수저 게임」이 맡는다. 첫 화면의 자기 로고는 링크가 아니다(눌러도 아무 일 없음). `data-testid="title-logo-word"`는 e2e가 이 칸의 글자 도형을 재는 이름이라 그대로 둔다.
 */
export function TitleWordmark() {
  return <span className="logo-wrap logo--row" data-testid="title-logo-word" aria-hidden="true" dangerouslySetInnerHTML={{ __html: LOGO_ROW_SVG }} />;
}

/** 로고 링크의 접근 이름 (SPEC-016 H1): 「수저 게임」과 「첫 화면으로」 뜻이 한 이름으로 읽힌다. 문구는 designer(`docs/design/title-ci.md` 3-1 추천 — 쉼표는 낭독의 쉼이고 「—」는 낭독기마다 읽는 법이 다르다). */
export const LOGO_HOME_LABEL = '수저 게임, 첫 화면으로';

/**
 * 첫 화면 밖 모든 화면의 머리글(DS1: 게임명이 모든 화면 헤더에 보인다). 왼쪽에 헤더용 가로 로고(단순화 심볼 + 워드마크, 높이 40px), 오른쪽에 화면 이름.
 * `onHome`을 주면 로고가 「첫 화면으로」 가는 버튼이 된다(SPEC-016 H1). 주지 않으면 예전처럼 눌러도 아무 일 없는 그림이다.
 * 로고 SVG는 `role="img" aria-label="수저 게임 로고 …"`를 갖고 있어 스크린리더가 게임명을 읽는다(<h1>은 화면 제목이 맡는다).
 */
export function SiteHead({ name, onHome, homeRef }: { name: string; onHome?: () => void; /** 로고 버튼 요소(포커스를 돌려줄 때 — 엔딩의 확인 단계를 닫은 뒤) */ homeRef?: Ref<HTMLButtonElement> }) {
  return (
    <header className="site-head" data-testid="site-head">
      <HeaderLogo onHome={onHome} homeRef={homeRef} />
      <span className="site-head__name">{name}</span>
    </header>
  );
}

/**
 * 헤더용 가로 로고(단순화 심볼 + 워드마크, 높이 40px). `SiteHead`(룰렛·출생신고·엔딩·밀린 화면·오류 화면)와 대시보드 헤더(`DashHead`, 이름·나이 알약과 진행률이 함께 있는 sticky 헤더)가 같은 로고를 쓴다.
 * 로고 SVG는 `role="img" aria-label="수저 게임 로고 …"`를 갖고 있어 스크린리더가 게임명을 읽는다.
 *
 * `onHome`이 있으면(SPEC-016 H1) 그림을 `<button>`으로 감싼다: 접근 이름은 바깥 버튼의 `aria-label` 하나(「수저 게임, 첫 화면으로」)이고 안쪽 그림은 `aria-hidden`이라 이름이 겹쳐 읽히지 않는다.
 * 그림은 40px 그대로, 눌림 영역만 `--hit` 44px 이상으로 넓힌다(`.logo-link`, 헤더 높이는 변하지 않는다). `data-testid="header-logo"`는 그림 칸에 그대로 있다.
 * 누르면 호출하는 쪽이 정한 길로 간다 — 진행 중인 판에서는 확인 없이 「나가기」와 같은 `openTitle`이다(App.tsx).
 */
export function HeaderLogo({ onHome, homeRef }: { onHome?: () => void; homeRef?: Ref<HTMLButtonElement> }) {
  // 그림 칸은 한 곳에서만 만든다(원시 HTML 삽입은 상수 하나씩 — tests/innerHtml.test.ts). 버튼 안에서는 이름을 바깥 버튼이 맡으므로 그림은 숨긴다.
  const art = <span className="logo-wrap logo--header" data-testid="header-logo" aria-hidden={onHome === undefined ? undefined : true} dangerouslySetInnerHTML={{ __html: LOGO_HEADER_SVG }} />;
  if (onHome === undefined) return art;
  return (
    <button type="button" className="logo-link" aria-label={LOGO_HOME_LABEL} data-testid="logo-home" ref={homeRef} onClick={onHome}>
      {art}
    </button>
  );
}
