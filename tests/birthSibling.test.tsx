import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GENERATION_IDS, beginBirth, createInitialState, enterBirth, type ProfileId } from '../src/core';
import { BIRTH_SIBLING_DISPLAY, BIRTH_SIBLING_TEXT, birthSiblingLine } from '../src/data/birthSiblingText';
import { BirthScreen } from '../src/screens/BirthScreen';

/**
 * 출생신고의 「형제자매」 칸 (SPEC-009 FM4a, 설계 문서 6-4절 B-1): family가 있는 판에만 칸이 있고, 기본값은 「위 형제만」이라 아직 태어나지 않은 동생은 신고서에 없다.
 * 글은 `data/birthSiblingText.ts#birthSiblingLine` 한 함수의 출력이다(화면은 계산하지 않는다).
 */

function render(gen: ProfileId, seed: number, withFamily: boolean) {
  const born = enterBirth(beginBirth(createInitialState(seed), gen));
  const html = renderToStaticMarkup(
    <BirthScreen generation={gen} character={born.character!} report={born.birthReport!} peerSeed={born.peerSeed!} seed={born.seed} family={withFamily ? born.family : undefined} onNext={() => {}} />,
  );
  const m = /data-testid="birth-field-siblings"><dt>([^<]*)<\/dt><dd data-testid="birth-siblings">([^]*?)<\/dd>/.exec(html);
  return { born, html, label: m?.[1] ?? null, text: m === null ? null : m[2].replace(/<[^>]+>/g, '').trim(), fields: html.match(/data-testid="birth-field-/g)?.length ?? 0 };
}

describe('출생신고 형제자매 칸', () => {
  it('family가 있으면 12칸이고 「형제자매」 칸의 글은 birthSiblingLine과 같다 (7세대 × 20판)', () => {
    let withOlder = 0;
    for (const gen of GENERATION_IDS) {
      for (let seed = 1; seed <= 20; seed++) {
        const r = render(gen, seed * 53, true);
        expect(r.fields, `${gen} ${seed}`).toBe(12);
        expect(r.label).toBe(BIRTH_SIBLING_TEXT.label);
        expect(r.text).toBe(birthSiblingLine(r.born.family!, r.born.character!.gender));
        if (r.born.family!.o.length > 0) withOlder++;
      }
    }
    expect(withOlder, '위 형제가 있는 판이 실제로 있다(공허 통과 방지)').toBeGreaterThan(30);
  });

  it('family가 없는 옛 상태에는 칸이 없다(11칸 그대로)', () => {
    const r = render('genx', 17, false);
    expect(r.fields).toBe(11);
    expect(r.label).toBeNull();
  });

  it('기본값은 위 형제만이다: 아래 동생이 있는 판에서도 「아래로」·「동생」이 신고서에 없다 — 호칭은 위 형제뿐', () => {
    expect(BIRTH_SIBLING_DISPLAY.showYounger).toBe(false);
    let withYounger = 0;
    for (const gen of GENERATION_IDS) {
      for (let seed = 1; seed <= 30; seed++) {
        const r = render(gen, seed * 71, true);
        if (r.born.family!.y.length === 0) continue;
        withYounger++;
        expect(r.text).not.toMatch(/아래로|동생/);
        expect(r.text).toMatch(/^위로 (없음|(형|누나|오빠|언니) \d명(, (형|누나|오빠|언니) \d명)*)$/);
      }
    }
    expect(withYounger, '아래 동생이 있는 판이 실제로 있다').toBeGreaterThan(40);
  });

  it('위 형제 명수는 「N째입니다」와 맞는다: 첫째는 「위로 없음」, 둘째 이상은 위 형제 명수의 합이 (순서 − 1)이다(다섯째 이상은 4)', () => {
    for (const gen of GENERATION_IDS) {
      for (let seed = 1; seed <= 25; seed++) {
        const r = render(gen, seed * 29, true);
        const order = r.born.birthReport!.birthOrder;
        const n = [...(r.text ?? '').matchAll(/(\d+)명/g)].reduce((a, m) => a + Number(m[1]), 0);
        expect(n, `${gen} ${seed}: ${r.text}`).toBe(Math.min(order - 1, 4));
        if (order === 1) expect(r.text).toBe(BIRTH_SIBLING_TEXT.noOlder);
      }
    }
  });
});
