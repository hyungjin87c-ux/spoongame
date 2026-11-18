import { memo, useMemo, useState } from 'react';
import { FACE_VIEWBOX, ageGroupOf, faceNodes, looksTierOf, type AgeGroupId, type FaceNode, type LooksTier } from '../assets/faces/faceLayers';
import type { Gender } from '../core/types';
import { generationsOfYear } from '../data/generations';

/**
 * 얼굴 그림 (SPEC-003 DS4·DS5·DB9): 연령대 8 × 성별 2 × 외모 5단계 = 80조합을 designer의 순수 함수(assets/faces/faceLayers.ts#faceNodes)로 만든 노드 목록에서
 * **React 노드로 직접** 옮겨 그린다(`dangerouslySetInnerHTML` 없음 — tests/innerHtml.test.ts가 막는다). 외모는 점수가 아니라 단계로만 쓰이고 화면에는 얼굴로만 드러난다(R-135).
 * 나이가 연령대 경계(3·7·13·20·40·60·75세)를 넘으면 얼굴이 바뀐다. 외모는 고정이라 한 판에서 그림이 바뀌는 것은 연령대 경계뿐이다 → useMemo([연령대, 성별, 단계]).
 * **밀레니얼 세대(출생 연도 1981~1996)만** 검수를 마친 그림 80장(IMG-001, `public/faces/millennial/`, 192×192 WebP — 연령대·성별·단계 이름은 위 SVG와 같은 `ageGroupOf`·`looksTierOf`)을 `<img>`로 그린다(PL13).
 * 그림은 번들이 아니라 `public/`이라 첫 로딩에 들지 않고, 프로필 카드·엔딩이 뜰 때 한 장만 지연 로딩한다. 파일을 못 받으면(`onError`) 그 주소에 한해 지금의 SVG로 대신 그린다. 그 밖의 세대는 SVG 그대로다.
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

/** 사진 그림이 있는 세대 (IMG-001: 밀레니얼). 출생 연도 → 세대는 data/generations.ts#generationsOfYear를 그대로 쓴다 */
export function hasFacePhotos(birthYear: number | undefined): boolean {
  return birthYear !== undefined && generationsOfYear(birthYear).includes('millennial');
}

/** 밀레니얼 얼굴 그림 주소 — `public/faces/millennial/millennial-<연령대>-<f|m>-t<단계>-p1.webp`, 경로는 base(GitHub Pages 하위 경로) 기준 */
export function millennialFaceSrc(ageGroup: AgeGroupId, gender: Gender, tier: LooksTier, base: string = import.meta.env.BASE_URL): string {
  return `${base}faces/millennial/millennial-${ageGroup}-${gender === 'female' ? 'f' : 'm'}-t${tier}-p1.webp`;
}

/** 그림 한 변(px) — 파일의 자연 크기. width·height를 박아 로딩 중에도 자리가 흔들리지 않는다(CSS가 상자에 맞춘다) */
export const FACE_PHOTO_SIZE = 192;

export interface FaceProps {
  age: number;
  gender: Gender;
  /** 외모 점수 0~100 (고정). 단계로만 쓰이고 화면에는 숫자가 나오지 않는다. */
  looks: number;
  /** 큰 타일(96px, 시안 `face--lg`): 프로필 카드(R-329)와 엔딩. 기본은 72px(--face-size, DS4 하한) */
  large?: boolean;
  /** 캐릭터의 출생 연도. 밀레니얼 세대일 때만 사진 그림을 쓴다(없으면 SVG) */
  birthYear?: number;
}

/** 얼굴 타일 한 장 (`.face` 상자 + svg) */
export const Face = memo(function Face({ age, gender, looks, large, birthYear }: FaceProps) {
  const ageGroup = ageGroupOf(age);
  const tier = looksTierOf(looks);
  const nodes = useMemo(() => faceNodes({ ageGroup, gender, tier }), [ageGroup, gender, tier]);
  const photoSrc = hasFacePhotos(birthYear) ? millennialFaceSrc(ageGroup, gender, tier) : null;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (photoSrc !== null && failedSrc !== photoSrc) {
    return (
      <div className={`face${large === true ? ' face--lg' : ''}`} data-testid="face" data-age-group={ageGroup}>
        <img src={photoSrc} alt="" width={FACE_PHOTO_SIZE} height={FACE_PHOTO_SIZE} loading="lazy" decoding="async" onError={() => setFailedSrc(photoSrc)} />
      </div>
    );
  }
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
