import { LOGO_HEADER_SVG, LOGO_WORDMARK_SVG, SPRITE_SVG } from './brandAssets';

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
 * 첫 화면의 게임명 로고 (SPEC-005 D5-01 A안, diff-005.md 7절 D5-31): 두 폭 모두 **워드마크만**(「수저 게임」 글자) — 머리 줄은 왼쪽 정렬이고 그 아래에 일러스트(좁은 화면 배너)가 온다.
 * 높이는 CSS(`.hero .logo--word`, 좁은 화면 52px → 글자 높이 41px로 DS1 ≥ 40px, 넓은 화면 64px → 51px)가 정한다.
 * 장식으로 숨기고 게임명은 바깥 제목(<h1>)의 읽히는 글자 「수저 게임」이 맡는다.
 */
export function TitleWordmark() {
  return <span className="logo-wrap logo--word" data-testid="title-logo-word" aria-hidden="true" dangerouslySetInnerHTML={{ __html: LOGO_WORDMARK_SVG }} />;
}

/**
 * 첫 화면 밖 모든 화면의 머리글(DS1: 게임명이 모든 화면 헤더에 보인다). 왼쪽에 헤더용 가로 로고(단순화 심볼 + 워드마크, 높이 40px), 오른쪽에 화면 이름.
 * 로고 SVG는 `role="img" aria-label="수저 게임 로고 …"`를 갖고 있어 스크린리더가 게임명을 읽는다(<h1>은 화면 제목이 맡는다).
 */
export function SiteHead({ name }: { name: string }) {
  return (
    <header className="site-head" data-testid="site-head">
      <HeaderLogo />
      <span className="site-head__name">{name}</span>
    </header>
  );
}

/**
 * 헤더용 가로 로고(단순화 심볼 + 워드마크, 높이 40px). `SiteHead`(룰렛·출생신고·엔딩·밀린 화면·오류 화면)와 대시보드 헤더(`DashHead`, 이름·나이 알약과 진행률이 함께 있는 sticky 헤더)가 같은 로고를 쓴다.
 * 로고 SVG는 `role="img" aria-label="수저 게임 로고 …"`를 갖고 있어 스크린리더가 게임명을 읽는다.
 */
export function HeaderLogo() {
  return <span className="logo-wrap logo--header" data-testid="header-logo" dangerouslySetInnerHTML={{ __html: LOGO_HEADER_SVG }} />;
}
