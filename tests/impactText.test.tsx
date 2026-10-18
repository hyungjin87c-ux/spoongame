import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import copySrc from '../docs/design/copy.md?raw';
import impactTextSrc from '../src/data/impactText.ts?raw';
import impactUiSrc from '../src/ui/dash/Impact.tsx?raw';
import { IMPACT_KEYS, economyContextOf, incomeOf, previewChoice, type GameState, type ImpactItem, type ImpactKey } from '../src/core';
import { startLife } from '../scripts/simulateLib';
import { EVENT_POOL } from '../src/data/events';
import {
  IMPACT_HINT,
  IMPACT_LABEL,
  IMPACT_SR,
  choiceAccessibleName,
  impactSentence,
  impactSrText,
  impactSymbols,
  impactTone,
} from '../src/data/impactText';
import { ImpactHint, ImpactLine } from '../src/ui/dash/Impact';

/**
 * 선택지 영향 줄의 문구·표시 (SPEC-003 M5 EC5, docs/design/copy.md 4절): 항목 이름 7개 · 스크린리더 문장 42개 · 기호/톤 · 선택지 버튼 이름 · 안내 한 줄.
 * 선택지 화면에 실제로 붙는 모습(버튼 이름·묶음 아래 안내)은 tests/dashboard.test.tsx 「선택지 영향 줄」, 브라우저 측정은 e2e/m5-impact.spec.ts.
 */

const item = (key: ImpactKey, direction: 'up' | 'down', steps: 1 | 2 | 3): ImpactItem => ({ key, direction, steps, sr: `${key}.${direction}.${steps}` });

/** copy.md 4-2절 표의 문장 42개를 읽는다: 행 = 항목, 열 = ▲1 ▲2 ▲3 ▼1 ▼2 ▼3 */
function copyTableSentences(): Map<string, string> {
  const start = copySrc.indexOf('### 4-2. 스크린리더 문장');
  const end = copySrc.indexOf('### 4-3.', start);
  expect(start).toBeGreaterThan(-1);
  const rows = copySrc
    .slice(start, end)
    .split('\n')
    .filter((l) => l.startsWith('| ') && !l.startsWith('| 항목') && !l.startsWith('|---'));
  const keyOf: Record<string, ImpactKey> = { 자산: 'assets', '집안 살림': 'family', 부채: 'debt', 관계: 'relationships', 행복: 'happiness', 건강: 'health', 지식: 'education' };
  const columns = ['up.1', 'up.2', 'up.3', 'down.1', 'down.2', 'down.3'];
  const out = new Map<string, string>();
  for (const row of rows) {
    const cells = row.split('|').slice(1, -1).map((c) => c.trim());
    const key = keyOf[cells[0]];
    expect(key, cells[0]).toBeDefined();
    columns.forEach((col, i) => out.set(`${key}.${col}`, cells[i + 1]));
  }
  return out;
}

describe('항목 이름 7개와 스크린리더 문장 42개 (copy.md 4-1·4-2)', () => {
  it('항목 이름: 집안 살림·자산·부채·관계·행복·건강·지식 — 순서는 IMPACT_KEYS(= copy.md 4-1 표)와 같다', () => {
    expect(IMPACT_LABEL).toEqual({ family: '집안 살림', assets: '자산', debt: '부채', relationships: '관계', happiness: '행복', health: '건강', education: '지식' });
    expect([...IMPACT_KEYS]).toEqual(['family', 'assets', 'debt', 'relationships', 'happiness', 'health', 'education']);
    // 자산 카드의 이름 「순자산」과 달리 영향 줄에는 「자산」을 쓴다
    expect(Object.values(IMPACT_LABEL)).not.toContain('순자산');
  });

  it('문장 42개가 모두 있고(7항목 × 방향 2 × 칸 수 3) copy.md 4-2절 표와 한 글자도 다르지 않다', () => {
    const table = copyTableSentences();
    expect(table.size).toBe(42);
    expect(Object.keys(IMPACT_SR)).toHaveLength(42);
    for (const [key, sentence] of table) expect(IMPACT_SR[key], key).toBe(sentence);
  });

  it('문장 형식: 「{이름}{이/가} {크기말}{늘어납니다|줄어듭니다}.」 — 합쇼체, 마침표로 끝나고, 1칸 「조금」·2칸 없음·3칸 「크게」, 좋고 나쁨을 덧붙이지 않는다', () => {
    for (const [key, s] of Object.entries(IMPACT_SR)) {
      const [k, direction, steps] = key.split('.') as [ImpactKey, 'up' | 'down', string];
      expect(s.endsWith('.'), key).toBe(true);
      expect(s, key).toContain(direction === 'up' ? '늘어납니다' : '줄어듭니다');
      expect(s.startsWith(IMPACT_LABEL[k]), key).toBe(true);
      if (steps === '1') expect(s, key).toContain(' 조금 ');
      else if (steps === '3') expect(s, key).toContain(' 크게 ');
      else expect(s, key).not.toMatch(/조금|크게/);
      expect(s, key).not.toMatch(/좋|나쁘|위험|불리|유리/);
    }
    expect(IMPACT_SR['assets.down.3']).toBe('자산이 크게 줄어듭니다.');
    expect(IMPACT_SR['debt.up.2']).toBe('부채가 늘어납니다.');
    expect(IMPACT_SR['relationships.up.1']).toBe('관계가 조금 늘어납니다.');
    expect(IMPACT_SR['family.down.1']).toBe('집안 살림이 조금 줄어듭니다.');
  });

  it('조사: 받침이 있는 이름은 「이」, 없는 이름은 「가」 (자산이·집안 살림이·행복이·건강이·지식이 / 부채가·관계가)', () => {
    for (const k of IMPACT_KEYS) {
      const last = IMPACT_LABEL[k].charCodeAt(IMPACT_LABEL[k].length - 1);
      const hasFinal = (last - 0xac00) % 28 !== 0;
      expect(IMPACT_SR[`${k}.up.2`].startsWith(`${IMPACT_LABEL[k]}${hasFinal ? '이' : '가'} `), k).toBe(true);
    }
  });

  it('데이터가 만드는 모든 문장 키가 문장 표에 있다 — 키 공간(7 × 2 × 3)이 빠짐없이 대응하고, 모든 이벤트 × 선택지 × 대표 상태(20세 전·성인·노년)의 영향 표기가 만드는 sr 키도 문장이 있다', () => {
    for (const k of IMPACT_KEYS) for (const d of ['up', 'down'] as const) for (const n of [1, 2, 3] as const) expect(IMPACT_SR[item(k, d, n).sr], item(k, d, n).sr).toBeDefined();
    const base = startLife(7, 'present');
    const states = [10, 40, 70].map((age): GameState => {
      const s: GameState = { ...base, age, assets: null, familyFund: 0, flags: [] };
      if (age < 20) return s;
      return { ...s, assets: { net: 3000, income: incomeOf(economyContextOf(s), 0), debt: 0, incomeAdj: 0, dwelling: 'rent' } };
    });
    let emitted = 0;
    for (const ev of EVENT_POOL.events) {
      for (const choice of ev.choices ?? []) {
        for (const st of states) {
          for (const it of previewChoice(st, choice).items) {
            expect(IMPACT_SR[it.sr], `${ev.id}/${choice.id} ${it.sr}`).toBeDefined();
            expect(impactSentence(it).length).toBeGreaterThan(5);
            emitted++;
          }
        }
      }
    }
    expect(emitted).toBeGreaterThan(500);
  });

  it('없는 키는 조용히 넘기지 않고 throw한다', () => {
    expect(() => impactSentence({ key: 'assets', direction: 'up', steps: 1, sr: 'assets.up.9' })).toThrow();
  });
});

describe('기호와 톤 (copy.md 4-1·4-8)', () => {
  it('기호: ▲ 또는 ▼를 칸 수만큼 — 6가지', () => {
    expect(impactSymbols(item('assets', 'down', 3))).toBe('▼▼▼');
    expect(impactSymbols(item('debt', 'up', 2))).toBe('▲▲');
    expect(impactSymbols(item('family', 'down', 1))).toBe('▼');
    expect(impactSymbols(item('health', 'up', 3))).toBe('▲▲▲');
    for (const d of ['up', 'down'] as const) for (const n of [1, 2, 3] as const) expect(impactSymbols({ direction: d, steps: n })).toHaveLength(n);
  });

  it('impactTone: 7항목 × 2방향에서 부채만 톤이 뒤집힌다 (늘어남 = 이로움 good, 줄어듦 = 해로움 bad / 부채는 ▲ bad, ▼ good)', () => {
    for (const k of IMPACT_KEYS) {
      if (k === 'debt') {
        expect(impactTone({ key: k, direction: 'up' }), 'debt up').toBe('bad');
        expect(impactTone({ key: k, direction: 'down' }), 'debt down').toBe('good');
      } else {
        expect(impactTone({ key: k, direction: 'up' }), `${k} up`).toBe('good');
        expect(impactTone({ key: k, direction: 'down' }), `${k} down`).toBe('bad');
      }
    }
  });
});

describe('선택지 버튼 이름과 안내 한 줄 (copy.md 4-3·4-4)', () => {
  const items = [item('assets', 'down', 3), item('debt', 'up', 2), item('relationships', 'up', 1), item('happiness', 'down', 2)];

  it('영향 줄의 글자 = 항목 문장을 공백 한 칸으로 이은 것 (「·」는 읽히지 않는다)', () => {
    expect(impactSrText(items)).toBe('자산이 크게 줄어듭니다. 부채가 늘어납니다. 관계가 조금 늘어납니다. 행복이 줄어듭니다.');
    expect(impactSrText([])).toBe('');
  });

  it('선택지 버튼의 이름 = 「{선택지 이름} {영향 줄}」, 영향이 없으면 이름만 (copy.md 4-3절 예시 그대로)', () => {
    expect(choiceAccessibleName('믿고 보증을 선다', items)).toBe('믿고 보증을 선다 자산이 크게 줄어듭니다. 부채가 늘어납니다. 관계가 조금 늘어납니다. 행복이 줄어듭니다.');
    expect(choiceAccessibleName('가만히 있는다', [])).toBe('가만히 있는다');
  });

  it('안내 한 줄: 첫 문장은 「선택지 아래 글씨는 이 선택만으로 {이름}에게 생기는 변화입니다.」(M7e-3, copy.md 5-2 ②), 둘째 문장(기호 설명)은 눈에 보이는 글자와 스크린리더 대체 글자가 다르다', () => {
    expect(IMPACT_HINT.lead('이서연')).toBe('선택지 아래 글씨는 이 선택만으로 이서연에게 생기는 변화입니다.');
    expect(IMPACT_HINT.symbols).toBe('▲는 늘어남, ▼는 줄어듦이며 표시가 많을수록 변화가 큽니다.');
    expect(IMPACT_HINT.symbolsSr).toBe('위쪽 세모는 늘어남, 아래쪽 세모는 줄어듦이며 표시가 많을수록 변화가 큽니다.');
    // 색의 뜻을 설명하는 셋째 문장은 없다 (r2 마스터 결정 3)
    expect(Object.keys(IMPACT_HINT)).toEqual(['lead', 'symbols', 'symbolsSr']);
    const html = renderToStaticMarkup(<ImpactHint name="이서연" />);
    expect(html).toContain('class="choice-panel__hint"');
    expect(html).toMatch(/<span aria-hidden="true">▲는 늘어남, ▼는 줄어듦이며 표시가 많을수록 변화가 큽니다\.<\/span>/);
    expect(html).toMatch(/<span class="sr-only">위쪽 세모는 늘어남, 아래쪽 세모는 줄어듦이며 표시가 많을수록 변화가 큽니다\.<\/span>/);
  });
});

describe('ImpactLine 마크업 (copy.md 4-8절 DOM)', () => {
  const html = renderToStaticMarkup(<ImpactLine items={[item('assets', 'down', 3), item('debt', 'up', 2), item('relationships', 'up', 1)]} />);

  it('항목마다 .impact__item > .impact__show[aria-hidden] (이름 + 톤 클래스 기호) + .sr-only 문장, 데이터 속성 key·direction·steps', () => {
    expect(html).toContain('class="impact" data-testid="impact"');
    expect(html).toContain('<span class="impact__item" data-key="assets" data-direction="down" data-steps="3">');
    expect(html).toContain('<span class="impact__show" aria-hidden="true"><span class="impact__name">자산</span><span class="impact__step impact__step--bad">▼▼▼</span></span>');
    expect(html).toContain('<span class="sr-only">자산이 크게 줄어듭니다.</span>');
    // 부채 ▲ = 해로움(붉음), 관계 ▲ = 이로움(초록)
    expect(html).toContain('<span class="impact__step impact__step--bad">▲▲</span>');
    expect(html).toContain('<span class="impact__step impact__step--good">▲</span>');
  });

  it('DOM 글자에 「·」가 없다 — 항목 사이의 가운뎃점은 CSS ::before가 그린다 (QM2-10 규칙 4)', () => {
    expect(html).not.toContain('·');
    expect(html).not.toContain('&#183;');
    expect(impactTextSrc + impactUiSrc).not.toMatch(/join\(\s*['"`]\s*·/);
  });

  it('항목이 없으면 요소 자체를 그리지 않는다 (「변화 없음」 같은 글자를 두지 않는다)', () => {
    expect(renderToStaticMarkup(<ImpactLine items={[]} />)).toBe('');
  });

  it('항목은 받은 순서대로 그린다 (순서는 core/impact.ts#IMPACT_KEYS가 정한다)', () => {
    const order = [...html.matchAll(/data-key="([a-z]+)"/g)].map((m) => m[1]);
    expect(order).toEqual(['assets', 'debt', 'relationships']);
  });
});
