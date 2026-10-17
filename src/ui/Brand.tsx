import { LOGO_HEADER_SVG, LOGO_ROW_SVG, LOGO_STACKED_SVG, SPRITE_SVG } from './brandAssets';

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
 * 게임명 로고(A안). 첫 화면은 모바일(< 960px)에서 세로 로고, 데스크톱에서 가로 로고를 쓴다(CSS가 하나만 보이게 한다 — 시안과 같다).
 * 둘 다 장식으로 숨기고 게임명은 바깥 제목(<h1>)의 읽히는 글자 「수저 게임」이 맡는다.
 */
export function TitleLogos() {
  return (
    <>
      <span className="logo-wrap logo--stacked" data-testid="title-logo-stacked" aria-hidden="true" dangerouslySetInnerHTML={{ __html: LOGO_STACKED_SVG }} />
      <span className="logo-wrap logo--row" data-testid="title-logo-row" aria-hidden="true" dangerouslySetInnerHTML={{ __html: LOGO_ROW_SVG }} />
    </>
  );
}

/**
 * 첫 화면 밖 모든 화면의 머리글(DS1: 게임명이 모든 화면 헤더에 보인다). 왼쪽에 헤더용 가로 로고(단순화 심볼 + 워드마크, 높이 40px), 오른쪽에 화면 이름.
 * 로고 SVG는 `role="img" aria-label="수저 게임 로고 …"`를 갖고 있어 스크린리더가 게임명을 읽는다(<h1>은 화면 제목이 맡는다).
 */
export function SiteHead({ name }: { name: string }) {
  return (
    <header className="site-head" data-testid="site-head">
      <span className="logo-wrap logo--header" data-testid="header-logo" dangerouslySetInnerHTML={{ __html: LOGO_HEADER_SVG }} />
      <span className="site-head__name">{name}</span>
    </header>
  );
}
