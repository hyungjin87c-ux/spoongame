import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SCROLL_LOCK_CLASS, SCROLL_LOCK_VAR, createScrollLock, documentScrollLock, useScrollLock, type ScrollLockRoot } from '../src/ui/useScrollLock';

/** vitest는 CSS의 ?raw 가져오기를 빈 문자열로 돌려주므로 파일 시스템으로 읽는다(tests/titleCapDash.test.tsx와 같은 방법) */
async function readText(relative: string): Promise<string> {
  const spec = 'node:fs';
  const fs = (await import(/* @vite-ignore */ spec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
  return fs.readFileSync(new URL(relative, import.meta.url), 'utf-8');
}
const dashCssSource = await readText('../src/styles/dash.css');
const decisionCardSource = await readText('../src/ui/dash/DecisionCard.tsx');
const noteSheetSource = await readText('../src/ui/dash/NoteSheet.tsx');
const scrollLockSource = await readText('../src/ui/useScrollLock.ts');

/**
 * 문서 스크롤 잠금 (SPEC-003 M7c T1, D-70): 열린 시트 수를 세는 훅. 실제 스크롤이 막히는지(휠·터치·키·스크롤바 밀림)는 e2e/m7c-scroll-lock.spec.ts가 (a)~(h)로 본다.
 * 여기서는 개수 규칙 — 첫 시트에서 걸고 마지막 시트에서 풀며, 이어서 열려도 풀리지 않는다 — 과 소스 연결을 본다.
 */

interface FakeRoot extends ScrollLockRoot {
  classes: Set<string>;
  vars: Map<string, string>;
  ops: string[];
}
function fakeRoot(clientWidth: number): FakeRoot {
  const classes = new Set<string>();
  const vars = new Map<string, string>();
  const ops: string[] = [];
  return {
    clientWidth,
    classes,
    vars,
    ops,
    classList: {
      add: (n: string) => {
        ops.push(`add:${n}`);
        classes.add(n);
      },
      remove: (n: string) => {
        ops.push(`remove:${n}`);
        classes.delete(n);
      },
    },
    style: {
      setProperty: (n: string, v: string) => {
        ops.push(`set:${n}=${v}`);
        vars.set(n, v);
      },
      removeProperty: (n: string) => {
        ops.push(`unset:${n}`);
        vars.delete(n);
      },
    },
  };
}

describe('createScrollLock: 열린 시트 수를 센다', () => {
  it('첫 시트가 열릴 때 html.sheet-open을 걸고, 마지막 시트가 닫힐 때 푼다', () => {
    const root = fakeRoot(1265);
    const lock = createScrollLock(() => root, () => 1280);
    expect(lock.count).toBe(0);
    const release = lock.acquire();
    expect(lock.count).toBe(1);
    expect(root.classes.has(SCROLL_LOCK_CLASS)).toBe(true);
    release();
    expect(lock.count).toBe(0);
    expect(root.classes.has(SCROLL_LOCK_CLASS)).toBe(false);
    expect(root.vars.size).toBe(0);
  });

  it('결정 시트 → 기록 시트로 이어서 열려도(한 커밋 안에서 닫고 열기, 또는 겹침) 개수가 0이 되기 전에는 풀리지 않고 다시 걸지도 않는다 — 스크롤 위치가 튀지 않는다', () => {
    const root = fakeRoot(1265);
    const lock = createScrollLock(() => root, () => 1280);
    const decision = lock.acquire();
    const noteOpens = lock.acquire(); // 기록 시트가 열린다(결정 시트가 아직 닫히기 전)
    decision(); // 결정 시트가 닫힌다
    expect(lock.count).toBe(1);
    expect(root.classes.has(SCROLL_LOCK_CLASS), '기록 시트가 떠 있는 동안 잠금 유지').toBe(true);
    expect(root.ops.filter((o) => o === `add:${SCROLL_LOCK_CLASS}`), '클래스를 한 번만 걸었다').toHaveLength(1);
    expect(root.ops.filter((o) => o === `remove:${SCROLL_LOCK_CLASS}`), '그 사이 풀지 않았다').toHaveLength(0);
    noteOpens();
    expect(root.classes.has(SCROLL_LOCK_CLASS)).toBe(false);
  });

  it('돌려받은 해제 함수를 두 번 불러도 한 번만 센다 (개수가 음수가 되지 않는다)', () => {
    const root = fakeRoot(1265);
    const lock = createScrollLock(() => root, () => 1280);
    const a = lock.acquire();
    const b = lock.acquire();
    a();
    a();
    expect(lock.count).toBe(1);
    expect(root.classes.has(SCROLL_LOCK_CLASS)).toBe(true);
    b();
    expect(lock.count).toBe(0);
    expect(root.classes.has(SCROLL_LOCK_CLASS)).toBe(false);
  });

  it('스크롤바 폭을 잠그기 전에 재어 --scrollbar-w로 건다: innerWidth − clientWidth (고전 스크롤바 15px, 겹쳐 그리는 스크롤바 0), 풀면 변수도 지운다', () => {
    const classic = fakeRoot(1265);
    createScrollLock(() => classic, () => 1280).acquire();
    expect(classic.vars.get(SCROLL_LOCK_VAR)).toBe('15px');
    expect(classic.ops[0], '폭을 먼저 걸고 그다음 클래스').toBe(`set:${SCROLL_LOCK_VAR}=15px`);
    expect(classic.ops[1]).toBe(`add:${SCROLL_LOCK_CLASS}`);

    const overlay = fakeRoot(360);
    createScrollLock(() => overlay, () => 360).acquire();
    expect(overlay.vars.get(SCROLL_LOCK_VAR)).toBe('0px');

    const odd = fakeRoot(1300); // clientWidth가 더 크게 보고되는 이상한 환경에서도 음수 여백을 걸지 않는다
    createScrollLock(() => odd, () => 1280).acquire();
    expect(odd.vars.get(SCROLL_LOCK_VAR)).toBe('0px');

    const root = fakeRoot(1265);
    const release = createScrollLock(() => root, () => 1280).acquire();
    release();
    expect(root.vars.has(SCROLL_LOCK_VAR)).toBe(false);
  });

  it('문서가 없는 환경(서버 렌더)에서는 아무것도 하지 않고 던지지 않는다', () => {
    const lock = createScrollLock(() => null, () => 0);
    const release = lock.acquire();
    expect(lock.count).toBe(1);
    release();
    expect(lock.count).toBe(0);
  });

  it('이 앱의 잠금(documentScrollLock)은 서버 렌더 중에도 개수가 0이고, useScrollLock은 렌더에서 아무것도 걸지 않는다 (효과는 브라우저에서만)', () => {
    function Probe() {
      useScrollLock();
      return <i />;
    }
    expect(renderToStaticMarkup(<Probe />)).toBe('<i></i>');
    expect(documentScrollLock.count).toBe(0);
  });
});

describe('잠금이 두 시트에 모두 연결돼 있고 CSS 한 줄이 아니다 (T1, D-70)', () => {
  it('결정 시트(DecisionSheet)와 기록 시트(NoteSheet)가 같은 훅을 쓴다', () => {
    expect(decisionCardSource).toMatch(/useScrollLock\(\)/);
    expect(noteSheetSource).toMatch(/useScrollLock\(\)/);
  });

  it('관찰 5: 잠그는 효과는 레이아웃 효과다 — 시트가 처음 그려지는 프레임에 이미 잠겨 있다 (일반 효과면 타이머로 저절로 뜬 카드에서 한 프레임 늦게 잠긴다). 서버 렌더에서는 일반 효과와 같다', () => {
    const code = scrollLockSource.replace(/\/\*[^]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).toMatch(/useIsoLayoutEffect\(\(\) => \{\s*if \(!active\) return;\s*return documentScrollLock\.acquire\(\);/);
    expect(code, 'useScrollLock 안에 passive useEffect가 없다').not.toMatch(/\buseEffect\(/);
    expect(code).toContain("import { useIsoLayoutEffect } from './hooks';");
  });

  it('CSS: html.sheet-open { overflow: hidden; padding-right: var(--scrollbar-w) } 이고 scrollbar-gutter는 쓰지 않는다 (헤드리스 크로뮴의 15px 비움이 폭 320 · 글자 200%를 넘쳤다)', () => {
    expect(dashCssSource).toContain('html.sheet-open { overflow: hidden; padding-right: var(--scrollbar-w, 0px); }');
    const code = dashCssSource.replace(/\/\*[^]*?\*\//g, '');
    expect(code).not.toContain('scrollbar-gutter');
  });

  it('스크림의 손가락 끌기는 오버레이만 막고(touch-action: pinch-zoom — 핀치 확대는 남긴다, R-405) 시트 안은 세로 스크롤·핀치 확대를 쓴다', () => {
    const code = dashCssSource.replace(/\/\*[^]*?\*\//g, '');
    expect(code).toContain('.overlay { touch-action: pinch-zoom; }');
    expect(code, 'none이면 크로뮴이 시트 안 유효값을 pan-y로 줄여 핀치 확대가 막힌다 (R-405)').not.toContain('touch-action: none');
    expect(code).toContain('.sheet { touch-action: pan-y pinch-zoom; }');
  });
});
