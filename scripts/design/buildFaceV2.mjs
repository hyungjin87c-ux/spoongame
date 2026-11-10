/**
 * 프로필 얼굴 확장 시안 HTML 생성 (SPEC-018 후보, designer 2026-11-10).
 *   node scripts/design/buildFaceV2.mjs   → docs/design/mockups/face-v2.html  (촬영은 shootFaceV2.mjs)
 * 정적 HTML·가짜 이름. `src/`는 tokens.css를 읽기만 한다. 외부 요청 0.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ERA_LABEL, faceV2Svg } from './faceV2Lib.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = ROOT + 'docs/design/mockups/face-v2.html';

/** 외모 단계 ↔ 첫인상 수식구 (src/data/looksText.ts#LEADS 그대로 옮겨 적음) */
const LEAD = {
  female: { 5: '이목구비가 뚜렷하고 예쁜', 4: '이목구비가 반듯한', 3: '편안한 인상의', 2: '순한 인상의', 1: '수수한 인상의' },
  male: { 5: '이목구비가 뚜렷하고 잘생긴', 4: '이목구비가 반듯한', 3: '편안한 인상의', 2: '순한 인상의', 1: '수수한 인상의' },
};
const SHORT = { 5: '뚜렷한', 4: '반듯한', 3: '편안한', 2: '순한', 1: '수수한' };
const G = { female: '여', male: '남' };

/** 타일: 그림(장식, aria-hidden) + 캡션(HTML). 접근 이름은 캡션이 맡는다 */
const tile = (input, caption, size = '') => `<figure class="t${size ? ' t--' + size : ''}"><span class="f">${faceV2Svg(input)}</span>${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
const tierRow = (ageGroup, gender, variant, size = '') =>
  `<div class="row" role="group" aria-label="${variant} 안, ${G[gender]}">${[1, 2, 3, 4, 5].map((tier) => tile({ ageGroup, gender, tier, variant }, `<span class="full">${LEAD[gender][tier]}</span><span class="abbr">${SHORT[tier]}</span>`, size)).join('')}</div>`;

const VARIANT_DOC = [
  ['A', '선의 대비', '눈·코·입 선의 굵기와 진하기, 눈썹의 농도와 길이, 눈 하이라이트의 밝기만 벌린다. 부품의 종류·크기·자리는 다섯 단계가 같다. 글의 「눈썹이 짙고 또렷」·「눈썹이 옅고 가늘」과 같은 방향이다.'],
  ['B', '그림자 두 획', '선은 지금 그대로 두고, 4·5단계에만 콧날 옆 한 획과 광대 아래 한 획을 살색 그늘로 얹는다. 1~3단계는 그늘 없는 평면이다. 수수함은 「덜 그린 얼굴」이 아니라 「빛이 고른 얼굴」로 읽힌다.'],
  ['C', '비례', '눈의 세로 크기와 눈썹 길이를 1단계 0.88배에서 5단계 1.12배까지 바꾼다. 선은 지금 그대로. 차이가 가장 바로 보이지만 「눈이 작다」가 단계의 표시가 되어 조롱으로 기울 수 있고, 눈 크기 불변 시험과 어긋난다.'],
  ['AB', 'A + B (추천)', '선의 대비 위에 그림자 두 획. 5단계는 선이 진하고 얼굴에 굴곡이 있고, 1단계는 선이 옅고 평면이다. 두 신호가 함께 움직여 한 방향으로 읽힌다.'],
];

function section2(ageGroup = 'young') {
  return VARIANT_DOC.map(
    ([v, name, desc]) => `<section class="v" aria-labelledby="v-${v}"><h3 id="v-${v}">${v} 안 · ${name}</h3><p>${desc}</p>${tierRow(ageGroup, 'female', v)}${tierRow(ageGroup, 'male', v)}</section>`,
  ).join('');
}

function eraTable(variant = 'AB') {
  const cols = [
    { era: null, ageGroup: 'young', head: '지금 표(청년)' },
    { era: '2000s', ageGroup: 'teen', head: '2000년대 청소년기' },
    { era: '2010s', ageGroup: 'young', head: '2010년대 청년기' },
    { era: '1970s', ageGroup: 'young', head: '1970년대 청년기' },
  ];
  const rows = [
    ['female', 5],
    ['female', 1],
    ['male', 5],
    ['male', 1],
  ];
  const head = `<div class="era-head" aria-hidden="true"><span></span>${cols.map((c) => `<span>${c.head}</span>`).join('')}</div>`;
  const body = rows
    .map(
      ([gender, tier]) =>
        `<div class="era-row" role="group" aria-label="${G[gender]} ${SHORT[tier]} 인상"><span class="era-label">${G[gender]} · ${SHORT[tier]}</span>${cols
          .map((c) => tile({ ageGroup: c.ageGroup, gender, tier, variant, era: c.era }, `${c.head} ${G[gender]} ${LEAD[gender][tier]}`))
          .join('')}</div>`,
    )
    .join('');
  const glasses = `<div class="era-row" role="group" aria-label="안경을 쓴 3단계"><span class="era-label">안경 · 3단계</span>${cols
    .map((c) => (c.era ? tile({ ageGroup: c.ageGroup, gender: c.ageGroup === 'teen' ? 'male' : 'female', tier: 3, variant, era: c.era, glasses: true }, `${c.head} 안경`) : '<span class="t t--empty" aria-hidden="true"></span>'))
    .join('')}</div>`;
  return `<div class="era">${head}${body}${glasses}</div>`;
}

function profileCard({ name, age, year, ageGroup, gender, tier, era, glasses = false, variant = 'AB' }) {
  const lead = LEAD[gender][tier];
  const noun = age < 7 ? '아이입니다.' : '얼굴입니다.';
  return `<article class="card"><span class="f f--card">${faceV2Svg({ ageGroup, gender, tier, variant, era, glasses })}</span><div class="card__body"><p class="card__name">${name}</p><p class="card__meta">${year}년 · ${age}세</p><p class="card__looks">${lead} ${noun}</p></div></article>`;
}

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>얼굴 확장 시안</title>
<meta name="description" content="수저 게임 프로필 얼굴 확장 시안: 외모 단계의 뚜렷함과 수수함 표현 안 셋, 시대별 유행 층(머리·화장·옷깃·안경).">
<!-- 시안(정적 HTML, 가짜 이름). 디자인 토큰은 구현의 tokens.css를 그대로 읽는다. 주소 끝에 ?theme=dark 를 붙이면 다크 테마. 생성: node scripts/design/buildFaceV2.mjs -->
<link rel="stylesheet" href="../../../src/styles/tokens.css">
<script>(function(){var q=new URLSearchParams(location.search);var t=q.get('theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);})();</script>
<style>
  html { background: var(--c-bg); color: var(--c-text); font: 16px/1.6 var(--font-sans); -webkit-text-size-adjust: 100%; }
  body { margin: 0; padding: 0 var(--gutter) 64px; max-width: 1080px; margin-inline: auto; }
  h1, h2, h3 { line-height: var(--lh-tight); letter-spacing: var(--ls-heading); margin: 0; }
  h1 { font-size: var(--fs-2xl); padding-top: 32px; }
  h2 { font-size: var(--fs-xl); margin-top: 56px; }
  h3 { font-size: var(--fs-lg); margin-top: 28px; }
  p { margin: 8px 0 0; max-width: 64ch; }
  .lede { font-size: var(--fs-lg); margin-top: 12px; }
  .note { color: var(--c-text-2); font-size: var(--fs-sm); }
  .mock-tag { display: inline-block; margin-top: 16px; padding: 2px 10px; border-radius: var(--r-pill); background: var(--c-surface-2); color: var(--c-text-2); font-size: var(--fs-sm); }
  .row { display: flex; flex-wrap: wrap; gap: 12px 10px; margin-top: 16px; }
  .t { margin: 0; width: 96px; display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .t--sm { width: 72px; }
  .f { display: block; width: 96px; height: 96px; border-radius: var(--r-md); overflow: hidden; border: 1px solid var(--c-border-strong); background: var(--c-face-bg); }
  .t--sm .f { width: 72px; height: 72px; }
  .f svg { display: block; width: 100%; height: 100%; }
  figcaption { font-size: var(--fs-xs); line-height: 1.35; color: var(--c-text-2); text-align: center; word-break: keep-all; }
  .abbr { display: none; }
  .v { margin-top: 8px; }
  .diag { margin-top: 16px; padding: 16px 20px; background: var(--c-surface-2); border-radius: var(--r-lg); max-width: 72ch; }
  .diag p { max-width: none; }
  .diag p + p { margin-top: 10px; }
  .era { margin-top: 16px; display: grid; gap: 10px; }
  .era-head, .era-row { display: grid; grid-template-columns: 88px repeat(4, 96px); gap: 10px; align-items: start; }
  .era-head span { font-size: var(--fs-sm); line-height: 1.35; color: var(--c-text-2); word-break: keep-all; align-self: end; }
  .era-label { font-size: var(--fs-sm); color: var(--c-text-2); padding-top: 38px; }
  .era-row .t figcaption { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .era-row .t { position: relative; }
  .t--empty { width: 96px; height: 96px; }
  .cards { margin-top: 16px; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 360px)); gap: 16px; }
  .card { display: flex; gap: 16px; padding: 16px; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r-lg); }
  .card__body p { margin: 0; max-width: none; }
  .card__name { font-size: var(--fs-xl); font-weight: var(--fw-bold); line-height: var(--lh-tight); }
  .card__meta { color: var(--c-text-2); font-size: var(--fs-sm); margin-top: 4px; }
  .card__looks { margin-top: 8px; line-height: var(--lh-snug); }
  .legend { margin-top: 12px; display: grid; gap: 4px 16px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); font-size: var(--fs-sm); color: var(--c-text-2); max-width: none; }
  .legend p { margin: 0; max-width: none; }
  @media (max-width: 639px) {
    .row { gap: 10px 6px; }
    .t, .t--sm { width: 60px; }
    .f, .t--sm .f { width: 60px; height: 60px; border-radius: var(--r-sm); }
    .full { display: none; }
    .abbr { display: inline; }
    .era-head, .era-row { grid-template-columns: 52px repeat(4, 60px); gap: 8px 6px; }
    .era-label { padding-top: 20px; font-size: var(--fs-xs); }
    .era-head span { font-size: var(--fs-xs); }
    .t--empty { width: 60px; height: 60px; }
    .cards { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
<header>
  <h1>프로필 얼굴 확장 시안</h1>
  <p class="lede">외모 단계가 그림에서 더 읽히게 하는 표현 안 셋과, 같은 얼굴에 시대의 머리·화장·옷깃·안경을 얹는 층. 피부색과 체형은 어느 안에서도 바뀌지 않습니다.</p>
  <p class="mock-tag">시안 · 가짜 이름</p>
</header>

<section aria-labelledby="s1">
  <h2 id="s1">지금 구현: 청년 얼굴의 외모 다섯 단계</h2>
  <p>왼쪽이 1단계, 오른쪽이 5단계. 그림 아래 글은 프로필 카드의 첫인상 수식구(looksText)입니다.</p>
  ${tierRow('young', 'female', 'cur')}
  ${tierRow('young', 'male', 'cur')}
  <div class="diag">
    <p><strong>진단.</strong> 다섯 단계가 바꾸는 것은 머리 부피(0.8~1.2배)와 선 굵기·진하기뿐이라, 96px에서 1단계와 3단계, 3단계와 5단계는 나란히 놓아야 겨우 갈립니다. 「이목구비가 뚜렷하고 예쁜」과 「수수한 인상의」가 글로는 분명한데 그림은 같은 얼굴에 가깝습니다.</p>
    <p>머리숱이 가장 큰 차이여서, 지금은 외모가 「머리 부피」로 읽힙니다. 이목구비 자체의 신호(눈썹 농도, 얼굴의 굴곡)가 없는 것이 원인입니다.</p>
  </div>
</section>

<section aria-labelledby="s2">
  <h2 id="s2">뚜렷함과 수수함: 표현 안 셋</h2>
  <p>모든 안에서 표정은 같은 담담한 미소이고, 피부색·얼굴형·주름은 단계와 무관합니다. 1단계는 「수수함」이지 「못생김」이 아닙니다. 눈·코·입이 작아지거나 비뚤어지는 안은 없습니다.</p>
  ${section2('young')}
  <h3>72px에서 (DS4 하한) · 지금과 추천안</h3>
  <p class="note">위 줄이 지금 구현, 아래 줄이 AB 안. 작은 크기에서도 양 끝이 갈리는지 봅니다.</p>
  ${tierRow('young', 'female', 'cur', 'sm')}
  ${tierRow('young', 'female', 'AB', 'sm')}
</section>

<section aria-labelledby="s3">
  <h2 id="s3">시대의 유행 층</h2>
  <p>같은 사람(AB 안)의 머리·화장·옷깃을 달력 연도의 10년대로 고릅니다. 유행은 세대 이름이 아니라 「그때 몇 살이었나」로 정해지므로, 표 하나가 모든 세대에 맞습니다. 안경은 시대마다 모양이 다르고 쓸지는 판의 시드가 정합니다(외모·수저와 무관).</p>
  ${eraTable('AB')}
  <div class="legend">
    <p><strong>2000년대 청소년기</strong> · 남: 눈썹을 덮는 샤기컷, 교복 셔츠 깃과 넥타이, 작은 금속테. 여: 일자 앞머리와 어깨 생머리, 교복 둥근 깃과 리본.</p>
    <p><strong>2010년대 청년기</strong> · 남: 옆을 바싹 친 댄디컷, 좁은 셔츠 깃, 큰 뿔테. 여: 시스루 뱅과 끝을 만 긴 웨이브, 일자 눈썹, 틴트 입술, 라운드 넥.</p>
    <p><strong>1970년대 청년기</strong> · 남: 귀를 덮는 장발과 긴 구레나룻, 넓은 양복 깃과 넥타이, 검은 뿔테. 여: 가운데 가르마 긴 생머리, 가는 아치 눈썹과 아이라인, 둥근 블라우스 깃.</p>
  </div>
</section>

<section aria-labelledby="s4">
  <h2 id="s4">프로필 카드 자리에서</h2>
  <p>인생 화면 프로필 카드(96px)의 모양으로 둘. 그림과 첫 문장이 같은 사람을 말하는지 봅니다.</p>
  <div class="cards">
    ${profileCard({ name: '김서연', age: 24, year: 2012, ageGroup: 'young', gender: 'female', tier: 5, era: '2010s' })}
    ${profileCard({ name: '박준호', age: 16, year: 2001, ageGroup: 'teen', gender: 'male', tier: 1, era: '2000s' })}
    ${profileCard({ name: '이정숙', age: 23, year: 1974, ageGroup: 'young', gender: 'female', tier: 3, era: '1970s', glasses: true })}
    ${profileCard({ name: '최영식', age: 27, year: 1971, ageGroup: 'young', gender: 'male', tier: 5, era: '1970s' })}
  </div>
</section>

<section aria-labelledby="s5">
  <h2 id="s5">구조와 크기</h2>
  <p>얼굴 한 장은 독립 함수 다섯의 합입니다. 얼굴형(연령대·성별), 이목구비 대비(외모 단계), 머리(10년대·나이대·성별), 옷깃(10년대·나이대·성별), 소품(10년대·시드). 표는 10년대 7개 × 나이대 4 × 성별 2 = 56칸이고 각 칸은 숫자 열 개 안팎이라, 조합 수가 늘어도 코드는 표 한 줄씩만 늡니다. 자세한 셈은 docs/design/face-v2.md에 있습니다.</p>
</section>
</body>
</html>
`;
writeFileSync(OUT, html.replace(/\r\n/g, '\n'), 'utf-8');
console.log('wrote', OUT, html.length, 'chars');
