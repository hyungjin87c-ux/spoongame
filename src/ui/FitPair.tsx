import { useRef, useState } from 'react';
import { Glue } from './Glue';
import { useIsoLayoutEffect } from './hooks';

/**
 * 「A · B」 짧은 쌍 — **한 줄에 들어가면 「A · B」 한 줄, 안 들어가면 기호 없이 A와 B를 따로 줄로** (SPEC-003 QM2-10 규칙 3, QM2-5).
 * 가운뎃점이 줄 끝·첫머리에 혼자 남지 않는다. 기존 `Pair`(ui/Pair.tsx)는 슬라이드 칸 폭의 정해진 문턱(em)으로 가르지만, 이 컴포넌트는 룰렛 결과 한 줄·출생신고 칸·또래 목록처럼
 * **내용 길이가 판마다 다른** 쌍에 쓴다: 보이지 않는 탐침이 「A · B」의 한 줄 폭을 재서(글자 크기가 바뀌면 탐침도 같이 커진다) 칸 폭과 견준다.
 * 탐침 글자는 CSS `::before { content: attr(data-text) }`로 그려서 DOM 글자에는 들어가지 않는다 — 화면 글자·복사되는 글자·읽는 이름에 같은 문구가 두 번 나오지 않는다.
 * 서버 렌더(테스트)와 첫 그림은 한 줄 모양이다. 나뉘어도 A와 B 사이에 공백을 남겨 이름 계산이 이어 읽을 때 붙지 않는다.
 */
export function FitPair({ a, b, className = '' }: { a: string; b: string; className?: string }) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const [split, setSplit] = useState(false);

  useIsoLayoutEffect(() => {
    const box = boxRef.current;
    const probe = probeRef.current;
    if (box === null || probe === null) return;
    const measure = () => setSplit(probe.getBoundingClientRect().width > box.getBoundingClientRect().width + 0.5);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(probe);
    return () => observer.disconnect();
  }, [a, b]);

  return (
    <span className={`fit-pair${split ? ' is-split' : ''}${className === '' ? '' : ` ${className}`}`} ref={boxRef} data-split={split ? 'true' : 'false'}>
      <span className="fit-pair__probe" ref={probeRef} data-text={`${a} · ${b}`} aria-hidden="true" />
      {/* 두 항목은 줄바꿈 묶음(Glue)으로 그려 항목 안의 짧은 구간 「(상위 3% 안쪽)」이 반으로 갈라지지 않게 한다(QA-003-M3 M3-O13) — 글자는 그대로고 감싸는 표시만 더한다 */}
      {split ? (
        <>
          <span className="fit-pair__item">
            <Glue text={a} />
          </span>{' '}
          <span className="fit-pair__item">
            <Glue text={b} />
          </span>
        </>
      ) : (
        <>
          <Glue text={a} /> · <Glue text={b} />
        </>
      )}
    </span>
  );
}
