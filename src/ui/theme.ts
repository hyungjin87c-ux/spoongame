import { useEffect, useState } from 'react';
import type { ThemeChoice } from '../core/types';
import { useIsoLayoutEffect } from './hooks';

/**
 * 화면 테마 적용 (SPEC-003 DB6): 설정의 `theme`(system / light / dark)을 문서에 건다.
 *  - system(기본): `<html>`의 `data-theme`를 지운다 → src/styles/tokens.css가 시스템 설정(prefers-color-scheme)을 따른다.
 *  - light / dark(수동 선택, 설정에 저장): `<html data-theme="light|dark">` — 이 값이 시스템 설정보다 우선한다(tokens.css 3절).
 * 스크롤바·입력 부품·주소 표시줄도 같이 맞춘다: `<meta name="color-scheme">`(system = 「light dark」)와 `<meta name="theme-color">`(수동 선택이면 두 메타를 같은 색으로, system이면 원래 값·media 복원).
 * 옛 화면이 라이트 고정이던 시절의 (옛) ui/legacyTheme.tsx를 대체한다 — 이제 모든 화면이 새 디자인이라 수동 선택이 모든 화면에 걸린다.
 */

/** 토큰 `--c-bg`와 같은 주소 표시줄 색 (tests/theme.test.ts가 tokens.css와 대조한다) */
export const THEME_COLOR = { light: '#f9f7f2', dark: '#14171f' } as const;

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

/** 메타의 원래 값(처음 건드리기 전). 시스템 설정으로 되돌릴 때 쓴다. */
const originals = new WeakMap<object, { content: string | null; media: string | null }>();

export function applyTheme(theme: ThemeChoice, doc: ThemeDocument = document): void {
  const root = doc.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);

  for (const meta of Array.from(doc.querySelectorAll('meta[name="color-scheme"], meta[name="theme-color"]'))) {
    if (!originals.has(meta)) originals.set(meta, { content: meta.getAttribute('content'), media: meta.getAttribute('media') });
    const original = originals.get(meta)!;
    const isScheme = meta.getAttribute('name') === 'color-scheme';
    if (theme === 'system') {
      if (original.content === null) meta.removeAttribute('content');
      else meta.setAttribute('content', original.content);
      if (original.media === null) meta.removeAttribute('media');
      else meta.setAttribute('media', original.media);
    } else if (isScheme) {
      meta.setAttribute('content', theme);
    } else {
      meta.setAttribute('content', THEME_COLOR[theme]);
      meta.removeAttribute('media'); // 두 메타가 같은 색이 되어 어느 쪽 시스템 설정에서도 같다
    }
  }
}

/** 지금 다크 테마가 **적용돼 있는가** — 수동 선택이든 시스템 설정을 따르는 중이든. 「다크 모드」 버튼의 켜짐 표시가 이 값이다(copy.md 도구 줄). */
export function isDarkApplied(theme: ThemeChoice, systemDark: boolean): boolean {
  return theme === 'dark' || (theme === 'system' && systemDark);
}

/** 「다크 모드」 버튼을 누르면 정해지는 수동 선택: 지금 다크가 적용돼 있으면 라이트, 아니면 다크 (DB6) */
export function toggledTheme(theme: ThemeChoice, systemDark: boolean): 'light' | 'dark' {
  return isDarkApplied(theme, systemDark) ? 'light' : 'dark';
}

function readSystemDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** 시스템 설정이 다크인가(바뀌면 따라간다) */
export function useSystemDark(): boolean {
  const [dark, setDark] = useState(readSystemDark);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setDark(mq.matches);
    mq.addEventListener('change', update);
    update();
    return () => mq.removeEventListener('change', update);
  }, []);
  return dark;
}

/** 설정의 테마를 문서에 건다(첫 그림 전에 적용: layout effect). 앱 전체에서 한 곳(Game)에서만 부른다. */
export function useApplyTheme(theme: ThemeChoice): void {
  useIsoLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);
}
