import { useRef, type RefObject } from 'react';
import { useIsoLayoutEffect } from '../hooks';

/**
 * 시대의 창 카드의 높이 = 집과 가족 그림 카드의 높이 (SPEC-016 H4 r2, 형진 님 2026-11-10 — PC ≥ 960px에서 두 카드의 위·아래 끝이 같은 선).
 *
 * 왜 CSS만으로 안 되는가: 두 카드는 서로 다른 열(가운데 · 오른쪽)에 있고, 집 카드는 결정 카드·부모 카드 아래에 올 수도 있어 같은 격자 줄에 놓을 수 없다. 집 카드의 높이는 아래 한 줄이 줄바꿈되는 정도(`FitList`)에
 * 따라 달라 CSS 식으로 미리 계산할 수도 없다. 그래서 집 카드의 **실제 높이**를 재서 시대의 창 카드의 CSS 변수 `--era-card-h`로 알린다(렌더 → layout 효과이므로 첫 그림 전에 정해져 깜박임이 없다).
 * 모양(그림을 남는 높이에 맞춰 줄이고 가운데에 세우기)은 전부 CSS(`styles/family.css`의 `.era-card[data-paired='true']`, PC 미디어 질의 안)다 — 휴대폰(< 960px)에서는 그 규칙이 닿지 않아 80px 띠 그대로다.
 *
 * 재는 값은 **「접히지 않은, 「함께 사는 사람」이 닫힌」 집 카드의 높이**다(펼친 때의 높이, 오른쪽 열이 흔들리지 않게):
 *  - 그림 접기(`data-fold="true"`)일 때는 접힘 속성을 잠깐 `false`로 돌려(같은 동기 구간 — 그려지지 않는다) 펼쳐진 높이를 재고 되돌린다. 시대의 창 카드는 접힌 칸에 맞춰 줄어들지 않는다.
 *  - 「함께 사는 사람」을 펼쳐 카드가 길어졌을 때는 마지막으로 잰 값을 그대로 둔다(식구 카드가 위아래로 밀리지 않게).
 * 집 카드의 크기가 바뀔 때마다(폭 변경 · 글꼴 · 글자 크기 · 줄바꿈 변화) `ResizeObserver`가 다시 잰다. 두 카드가 없으면(화면이 다르면) 아무 일도 하지 않고, 사라지면 변수·표시를 지운다.
 */
export function usePairedEraHeight(rootRef: RefObject<HTMLElement>): void {
  const held = useRef<number | null>(null);
  useIsoLayoutEffect(() => {
    const root = rootRef.current;
    if (root === null) return;
    const scene = root.querySelector<HTMLElement>('.scene-card');
    const era = root.querySelector<HTMLElement>('.era-card');
    if (scene === null || era === null) return;
    const sync = (): void => {
      const open = scene.querySelector('details[open]') !== null;
      if (!open) {
        const fold = scene.getAttribute('data-fold');
        if (fold === 'true') scene.setAttribute('data-fold', 'false');
        const h = scene.getBoundingClientRect().height;
        if (fold === 'true') scene.setAttribute('data-fold', 'true');
        if (h > 0) held.current = h; // 0 = 아직 그려지지 않았다(숨김·시험 환경) — 잘못된 높이를 알리지 않는다
      }
      if (held.current === null) return;
      era.style.setProperty('--era-card-h', `${held.current}px`);
      era.setAttribute('data-paired', 'true');
    };
    sync();
    if (typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(sync);
    watch.observe(scene);
    return () => {
      watch.disconnect();
      era.style.removeProperty('--era-card-h');
      era.removeAttribute('data-paired');
    };
  }, [rootRef]);
}
