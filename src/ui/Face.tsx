import { memo, useMemo } from 'react';
import { FACE_VIEWBOX, ageGroupOf, faceNodes, looksTierOf, type FaceNode } from '../assets/faces/faceLayers';
import type { Gender } from '../core/types';

/**
 * 얼굴 그림 (SPEC-003 DS4·DS5·DB9): 연령대 8 × 성별 2 × 외모 5단계 = 80조합을 designer의 순수 함수(assets/faces/faceLayers.ts#faceNodes)로 만든 노드 목록에서
 * **React 노드로 직접** 옮겨 그린다(`dangerouslySetInnerHTML` 없음 — tests/innerHtml.test.ts가 막는다). 외모는 점수가 아니라 단계로만 쓰이고 화면에는 얼굴로만 드러난다(R-135).
 * 나이가 연령대 경계(3·7·13·20·40·60·75세)를 넘으면 얼굴이 바뀐다. 외모는 고정이라 한 판에서 그림이 바뀌는 것은 연령대 경계뿐이다 → useMemo([연령대, 성별, 단계]).
 * 색은 CSS 변수(--c-face-*)를 읽고, 강제 색상에서는 의미 있는 색이 아니라 그림이므로 `forced-color-adjust: none`(스타일은 svg에 직접). 얼굴만이 외모를 전하는 유일한 수단이 아니고 이름·외모 문구가 옆에 글자로 있으므로 장식(aria-hidden)이다.
 */

function Node({ n }: { n: FaceNode }) {
  switch (n.tag) {
    case 'g':
      return (
        <g data-layer={n.layer} opacity={n.opacity}>
          {n.children.map((c, i) => (
            <Node key={i} n={c} />
          ))}
        </g>
      );
    case 'path':
      return <path d={n.d} fill={n.fill} fillOpacity={n.fillOpacity} stroke={n.stroke} strokeOpacity={n.strokeOpacity} strokeWidth={n.strokeWidth} strokeLinecap={n.linecap} strokeLinejoin={n.linejoin} />;
    case 'ellipse':
      return <ellipse cx={n.cx} cy={n.cy} rx={n.rx} ry={n.ry} fill={n.fill} fillOpacity={n.fillOpacity} stroke={n.stroke} strokeOpacity={n.strokeOpacity} strokeWidth={n.strokeWidth} />;
    case 'rect':
      return <rect x={n.x} y={n.y} width={n.width} height={n.height} rx={n.rx} fill={n.fill} fillOpacity={n.fillOpacity} stroke={n.stroke} strokeOpacity={n.strokeOpacity} strokeWidth={n.strokeWidth} />;
  }
}

export interface FaceProps {
  age: number;
  gender: Gender;
  /** 외모 점수 0~100 (고정). 단계로만 쓰이고 화면에는 숫자가 나오지 않는다. */
  looks: number;
  /** 큰 타일(96px, 시안 `face--lg`): 프로필 카드(R-329)와 엔딩. 기본은 72px(--face-size, DS4 하한) */
  large?: boolean;
}

/** 얼굴 타일 한 장 (`.face` 상자 + svg) */
export const Face = memo(function Face({ age, gender, looks, large }: FaceProps) {
  const ageGroup = ageGroupOf(age);
  const tier = looksTierOf(looks);
  const nodes = useMemo(() => faceNodes({ ageGroup, gender, tier }), [ageGroup, gender, tier]);
  return (
    <div className={`face${large === true ? ' face--lg' : ''}`} data-testid="face" data-age-group={ageGroup}>
      <svg viewBox={FACE_VIEWBOX} aria-hidden="true" focusable="false" style={{ forcedColorAdjust: 'none' }}>
        {nodes.map((n, i) => (
          <Node key={i} n={n} />
        ))}
      </svg>
    </div>
  );
});
