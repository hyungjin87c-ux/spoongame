/**
 * 워드마크 「수저 게임」 도형 (SPEC-003 DS1, designer). 글꼴 파일을 쓰지 않고 한글 획을 직접 그린 도형이다.
 * buildBrand.mjs가 이 도형으로 SVG 파일을 만든다. 심볼 도형은 brandSymbols.mjs.
 *
 * 2차(Fable) 수정: 이전 워드마크는 획이 가늘고(10/100) 글자 사이가 넓어 평범하게 읽혔다.
 *   - 획 굵기 13/100, 둥근 끝(round cap·join) — 작은 크기(헤더 24px)에서도 뭉개지지 않고 큰 크기에서 단단하게 보인다.
 *   - 글자 사이 10, 낱말 사이 34(100칸 기준)로 좁혀 한 덩어리로 읽힌다.
 *   - 획의 끝은 둥근 끝(반지름 6.5)을 감안해 안쪽으로 들여 그렸다. 글자의 보이는 상자는 x 5~95, y 6~96.
 */

/** 100×100 칸 기준 획. 둥근 끝 반지름(= 획 굵기/2)만큼 안쪽으로 들여 있다. */
export const GLYPHS = {
  // 수 = ㅅ + ㅜ
  수: [
    'M50 13C47 32 38 46 12 60', // ㅅ 왼쪽 긴 획 (살짝 휨)
    'M44 31C53 44 68 54 88 59', // ㅅ 오른쪽 짧은 획
    'M12 74H88', // ㅜ 가로
    'M50 74V90', // ㅜ 세로
  ],
  // 저 = ㅈ + ㅓ
  저: [
    'M11 24H51', // ㅈ 가로
    'M31 27C30 42 25 54 11 64', // ㅈ 왼쪽 획
    'M30 41C37 52 44 58 52 64', // ㅈ 오른쪽 획
    'M84 13V90', // ㅓ 세로
    'M62 54H82', // ㅓ 가로
  ],
  // 게 = ㄱ + ㅔ
  게: [
    'M11 26H40V72', // ㄱ
    'M50 52H63', // ㅔ 왼쪽 짧은 가로
    'M64 13V90', // ㅔ 첫 세로
    'M88 13V90', // ㅔ 둘째 세로
  ],
  // 임 = ㅇ + ㅣ + ㅁ
  임: [
    'M15 29a16 16 0 1 0 32 0a16 16 0 1 0 -32 0Z', // ㅇ
    'M84 13V50', // ㅣ
    'M14 62H84V92H14Z', // ㅁ
  ],
};

/**
 * 워드마크 전체. w = 마지막 글자 보이는 오른쪽 끝(≈ 407) + 여백. cells = 글자별 x 오프셋(100칸 기준).
 * 두 낱말 사이(저–게)는 글자 사이보다 넓다.
 */
export const WORDMARK = { w: 412, h: 100, cells: [0, 100, 220, 316], strokeWidth: 13, linecap: 'round', linejoin: 'round' };

/** 워드마크 path 목록 [{ d, dx }] (획 기반) */
export function wordmarkStrokes() {
  const chars = ['수', '저', '게', '임'];
  return chars.flatMap((ch, i) => GLYPHS[ch].map((d) => ({ d, dx: WORDMARK.cells[i] })));
}

/** 워드마크 <g> 조각: 높이 h(px)에 맞춰 (x, y)에 놓는다. style은 stroke 색 지정(예: 'stroke:currentColor') */
export function wordmarkGroup({ x = 0, y = 0, h = 100, style = 'stroke:currentColor' } = {}) {
  const k = h / 100;
  const chars = ['수', '저', '게', '임'];
  const groups = chars.map((ch, i) => `<g transform="translate(${WORDMARK.cells[i]} 0)">${GLYPHS[ch].map((d) => `<path d="${d}"/>`).join('')}</g>`).join('');
  const r = (v) => Math.round(v * 1000) / 1000;
  return `<g transform="translate(${r(x)} ${r(y)}) scale(${r(k)})" fill="none" style="${style}" stroke-width="${WORDMARK.strokeWidth}" stroke-linecap="${WORDMARK.linecap}" stroke-linejoin="${WORDMARK.linejoin}">${groups}</g>`;
}
