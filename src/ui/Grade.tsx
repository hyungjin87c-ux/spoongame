import { GRADE_NAME, gradeDotsLabel } from '../data/birthReportText';
import type { ParentWealth } from '../core/types';
import { Glue } from './Glue';
import { Spoon } from './Brand';

/**
 * 수저 칩 (SPEC-003 DS3·RL4): **아이콘(칩 변형 sp-N, 무늬 없는 실루엣) + 이름 + 점 5개 중 N개**를 항상 함께 그린다 — 색만으로 단계를 전하지 않고,
 * 아이콘을 이름·점 없이 단독으로 쓰지 않는다(docs/design/design-system.md 6절, tests/designAssets.test.ts). 이름은 「다이아몬드수저」(요청 표기).
 * 쓰는 곳: 룰렛 릴(`reel`, 점 없이 이름만 — 릴 칸은 확률표와 같은 순서의 이름표), 출생신고 「집안 형편」(`lg`)·또래 목록. 첫 화면 띠(큰 변형 sp-N-lg)는 TitleScreen이 따로 그린다.
 * 구간 글자(「(하위 25% 안쪽)」)는 칩 뒤에 `GradeLine`이 붙인다 — 값은 `bandLabel(startBandOf(era, wealth))` 한 함수의 출력(R-170). 구간 글자는 `Glue`로 괄호째 한 묶음이다.
 */

export type GradeChipSize = 'lg' | 'reel' | undefined;

export function GradeChip({ grade, size }: { grade: ParentWealth; size?: GradeChipSize }) {
  const cls = `grade grade--${grade}${size === 'lg' ? ' grade--lg' : size === 'reel' ? ' grade--reel' : ''}`;
  const name = GRADE_NAME[grade];
  return (
    <span className={cls} data-grade={grade}>
      <Spoon grade={grade} />
      {/* 좁은 칸(릴 칸·글자 150%+의 좁은 폭)에서는 「다이아몬드 / 수저」로 줄을 나눈다. 한 줄에 들어가면 그대로 한 줄이고, 글자는 같아 읽는 이름은 「다이아몬드수저」다. */}
      <span>{grade === 5 ? <>다이아몬드<wbr />수저</> : name}</span>
      {size === 'reel' ? null : (
        <span className="grade__dots" role="img" aria-label={gradeDotsLabel(grade)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <i key={n} className={n <= grade ? 'on' : undefined} />
          ))}
        </span>
      )}
    </span>
  );
}

/** 칩 + 구간 글자: 줄이 길면 구간이 칩 시작점에 맞춰 내려간다(.grade-line 안, REV-003-D-3 관찰) */
export function GradeLine({ grade, range, size }: { grade: ParentWealth; range: string; size?: GradeChipSize }) {
  return (
    <span className="grade-line">
      <GradeChip grade={grade} size={size} />
      {/* 구간 글자 「(상위 3% 안쪽)」은 괄호째 한 묶음(Glue 규칙 ⑤): 좁은 폭·큰 글자에서 「(상위 / 3% 안쪽)」으로 갈라지지 않는다 — 앞 칩과 구간 사이에서만 줄이 바뀐다 (REV-003-M3-5, M4 착수 때 함께) */}
      <span className="grade-line__range" data-testid="grade-range">
        <Glue text={range} />
      </span>
    </span>
  );
}
