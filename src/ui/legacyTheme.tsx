import { useIsoLayoutEffect } from './hooks';

/**
 * 옛 화면(출생·인생·엔딩·밀린 화면·오류 화면)은 아직 고정 색의 라이트 디자인이다(M3·M4에서 새 디자인으로 바뀐다). 그런데 첫 화면은 시스템 설정을 따라 다크가 될 수 있어서
 * `<meta name="color-scheme">`·`<meta name="theme-color">`와 토큰의 `color-scheme: dark`가 옛 화면에도 걸려, 다크 OS에서 스크롤바·입력 부품·주소 표시줄만 어둡고 본문은 밝은
 * 깨진 모습이 됐다(REV-003-M2-1 R-208). 옛 화면이 떠 있는 동안에는 색 구성표를 라이트로 고정하고, 첫 화면으로 돌아오면 시스템 설정을 따르게 되돌린다.
 *
 * 방법: `<html data-theme="light">`(src/styles/tokens.css가 정한 수동 선택 — 시스템 설정보다 우선하고 `color-scheme: light`가 된다) + 두 메타의 내용을 라이트로 바꾸고,
 * 돌아올 때 원래 값(속성·내용·media)으로 복원한다. 사용자가 고르는 테마(M4의 「다크 모드」)가 생기면 그 값이 `data-theme`를 쓰게 되므로 복원이 원래 값을 되돌려 준다.
 */

/** 옛 화면의 바탕색 — 라이트 토큰 `--c-bg`(styles/tokens.css, `<html data-theme="light">` 아래에서 body가 받는 바탕)와 같다. 주소 표시줄 색을 맞춘다(R-223: 값은 tests/legacyTheme.test.ts가 토큰 파일과 대조). */
export const LEGACY_THEME_COLOR = '#f6f3ec';

interface Attrs {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

/** 문서에서 쓰는 부분만 — 테스트가 가짜 문서를 넣을 수 있게 좁게 잡았다 */
export interface ThemeDocument {
  documentElement: Attrs;
  querySelectorAll(selector: string): ArrayLike<Attrs>;
}

/** 색 구성표를 라이트로 고정한다. 돌려주는 함수를 부르면 원래대로 되돌린다(여러 번 불려도 안전). */
export function enterLegacyLight(doc: ThemeDocument): () => void {
  const root = doc.documentElement;
  const previousTheme = root.getAttribute('data-theme');
  root.setAttribute('data-theme', 'light');

  const metas = Array.from(doc.querySelectorAll('meta[name="color-scheme"], meta[name="theme-color"]'));
  const previous = metas.map((meta) => ({ meta, content: meta.getAttribute('content'), media: meta.getAttribute('media') }));
  for (const meta of metas) {
    if (meta.getAttribute('name') === 'color-scheme') {
      meta.setAttribute('content', 'light');
    } else {
      meta.setAttribute('content', LEGACY_THEME_COLOR);
      meta.removeAttribute('media'); // 라이트·다크 두 메타가 모두 같은 색이 되어 어느 쪽 OS 설정에서도 같다
    }
  }

  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    if (previousTheme === null) root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', previousTheme);
    for (const { meta, content, media } of previous) {
      if (content === null) meta.removeAttribute('content');
      else meta.setAttribute('content', content);
      if (media === null) meta.removeAttribute('media');
      else meta.setAttribute('media', media);
    }
  };
}

/** 옛 화면에 이 컴포넌트를 함께 그리면 그 화면이 떠 있는 동안 라이트로 고정된다(첫 그림 전에 적용: layout effect). */
export function LegacyLight(): null {
  useIsoLayoutEffect(() => enterLegacyLight(document), []);
  return null;
}
