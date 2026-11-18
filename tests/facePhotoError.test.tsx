import { isValidElement, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

/**
 * 얼굴 그림 로드 실패 대체 (PL13): DOM 환경이 없어 react의 useState·useMemo를 한 칸짜리 가짜로 바꾸고 Face의 함수를 직접 부른다.
 * `<img onError>`를 가짜 이벤트로 부르면(= 파일을 못 받음) 그 주소는 다음 그림부터 svg로 바뀐다. 같은 컴포넌트가 다른 주소(다른 연령대)를 그리면 다시 사진을 시도한다.
 */
const store = vi.hoisted(() => ({ state: null as unknown }));
vi.mock('react', async (orig) => {
  const real = await orig<typeof import('react')>();
  return {
    ...real,
    useMemo: (f: () => unknown) => f(),
    useState: (init: unknown) => [store.state === null ? init : store.state, (v: unknown) => void (store.state = v)],
  };
});

const { Face } = await import('../src/ui/Face');

type FaceFn = (p: { age: number; gender: 'female' | 'male'; looks: number; birthYear?: number }) => ReactElement<{ children: ReactElement<Record<string, unknown>> }>;
const call = (age: number): ReturnType<FaceFn> => (Face as unknown as { type: FaceFn }).type({ age, gender: 'female', looks: 50, birthYear: 1990 });

describe('Face: onError면 SVG로 대신 그린다', () => {
  it('처음에는 img, onError 뒤에는 같은 상자 안의 svg, 다른 연령대 그림은 다시 img', () => {
    store.state = null;
    const img = call(30).props.children;
    expect(img.type).toBe('img');
    expect(img.props.alt).toBe('');
    expect(typeof img.props.onError).toBe('function');

    (img.props.onError as (e: unknown) => void)({ type: 'error' }); // 가짜 이벤트: 그림 파일을 받지 못함
    const after = call(30);
    expect(isValidElement(after)).toBe(true);
    expect(after.props.children.type).toBe('svg');
    expect(after.props.children.props['aria-hidden']).toBe('true');

    expect(call(50).props.children.type).toBe('img'); // 다른 연령대(다른 파일)는 다시 시도한다
    store.state = null;
  });
});
