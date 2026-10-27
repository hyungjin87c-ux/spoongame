import { describe, expect, it } from 'vitest';
import { EVENT_POOL } from '../src/data/events';
import {
  PEER_RETURN_LABEL,
  PEER_STATUS_LABEL,
  PARENT_WEALTHS,
  autoResolveStep,
  condContextOf,
  conditionsCompatible,
  economyContextOf,
  incomeOf,
  maxVisibleChoices,
  peerLabelOf,
  peerStatusSeries,
  peersNow,
  previewChoice,
  resolveChoiceStep,
  stepYear,
  visibleChoices,
  type ChoiceDef,
  type EventDef,
  type GameState,
  type PeerStatus,
} from '../src/core';
import { SIM_PROFILES, chooserFor, startLife } from '../scripts/simulateLib';

/**
 * M7e-3 콘텐츠 판단의 반영 (SPEC-003 M7e-3, planner `docs/data/content-M7e.md` 1~5·9절, 마스터 결정 E-1~E-12):
 *  1-5절 고침 값 19행 · E-4 `youth-lonely-city`는 독립 주거에서만 · E-7 은퇴 뒤 다시 일하는 또래의 라벨 · E-9 형제 어휘·높임 · R-377 나머지 문구.
 * 지배 쌍 0(표기 기준)은 tests/impact.test.ts가, 해 끝 주거 전환(추가②)은 tests/inherit.test.ts가, 해설 종결 lint(E-11)는 tests/eventLint.test.ts가 지킨다.
 */

const eventOf = (id: string): EventDef => {
  const ev = EVENT_POOL.byId.get(id);
  if (ev === undefined) throw new Error(`이벤트 ${id}가 없다`);
  return ev;
};
const choiceOf = (eventId: string, choiceId: string): ChoiceDef => {
  const c = eventOf(eventId).choices?.find((x) => x.id === choiceId);
  if (c === undefined) throw new Error(`선택지 ${eventId}/${choiceId}가 없다`);
  return c;
};

describe('1-5절 고침 값 19행 (E-1~E-3): 지배 쌍 22개를 0으로 만드는 효과 값과 결과 문장', () => {
  /** 행 번호 · 이벤트/선택지 · 효과 일부(고친 값) · 결과 문장(없으면 그대로인 행) */
  type Row = { n: number; at: [string, string]; stats?: Record<string, number>; net?: number; result?: string };
  const ROWS: Row[] = [
    { n: 1, at: ['middle-business', 'start'], stats: { education: 2 }, result: '문을 연 날부터 하루도 마음 편한 날이 없었습니다. 몇 해가 지나서야 일을 꾸리며 배운 것이 적지 않았음을 알았습니다.' },
    { n: 2, at: ['youth-startup', 'start'], stats: { education: 2 }, result: '작은 사무실을 얻어 일을 시작했습니다. 잠을 줄이며 한 해를 보내는 사이 배운 것이 쌓였고 윤곽이 잡혀 갔습니다.' },
    { n: 3, at: ['middle-child-school', 'support'], net: -3000 },
    { n: 4, at: ['middle-child-school', 'fund'], stats: { relationships: 7 } },
    { n: 5, at: ['middle-debt-guarantee', 'sign'], stats: { relationships: 3 } },
    { n: 6, at: ['middle-health-check-later', 'treat'], stats: { health: 7 } },
    { n: 7, at: ['middle-job-again', 'rest'], stats: { health: 2 }, result: '서두르지 않고 한동안 쉬었습니다. 마음은 가라앉고 굳은 몸도 풀렸지만 통장은 조금씩 비어 갔습니다.' },
    { n: 8, at: ['middle-parents-farewell', 'stay'], stats: { health: -1 }, net: -400, result: '하던 일을 두고 달려가 지친 몸으로 마지막까지 곁을 지켰습니다. 손을 잡고 있던 온기가 오래 남았습니다.' },
    { n: 9, at: ['school-career-choice', 'look'], stats: { health: 1 }, result: '이것저것 기웃거리며 바깥을 돌아다녔습니다. 정하지 못한 채로도 하루는 가볍게 흘러갔습니다.' },
    { n: 10, at: ['school-tutoring', 'academy'], stats: { education: 7 }, result: '방과 후마다 따로 공부를 더 했습니다. 숙제가 늘었고, 성적도 꾸준히 올랐습니다.' },
    { n: 11, at: ['senior-estate', 'give'], stats: { relationships: 3 }, result: '가까운 이들에게 몫을 나누어 주었습니다. 서로의 정이 깊어졌고 가벼워진 마음 한편에 허전함이 스쳤습니다.' },
    { n: 12, at: ['senior-travel', 'go'], stats: { happiness: 7 } },
    { n: 13, at: ['youth-colleague', 'leave'], stats: { health: 1 }, result: '몇 달 뒤 새 직장으로 옮겼습니다. 낯선 곳이었지만 굳었던 어깨가 풀리는 기분이 들었습니다.' },
    { n: 14, at: ['youth-first-job', 'stable'], stats: { relationships: 1 }, result: '월급날이 일정한 곳에 자리를 잡았습니다. 낯익은 얼굴이 하나둘 늘었고 큰 기대는 없었지만 불안도 작았습니다.' },
    { n: 15, at: ['youth-first-job', 'family'], stats: { relationships: 1 }, result: '이미 자리가 마련돼 있던 곳이었습니다. 아는 얼굴이 많았고 배울 것도 적지 않았지만 출발선이 달랐습니다.' },
    { n: 16, at: ['youth-housing', 'loan'], stats: { happiness: 3 } },
    { n: 17, at: ['youth-marriage', 'wait'], stats: { health: 1 }, result: '서두르지 않기로 했습니다. 몸과 마음의 짐은 덜었지만 상대의 얼굴에 아쉬운 기색이 스쳤습니다.' },
    { n: 18, at: ['youth-rent-hike', 'share'], stats: { happiness: -3 }, result: '함께 살 사람을 구해 방값을 나눴습니다. 생활 습관이 달라 자주 부딪혔지만 서로 맞춰 갔습니다.' },
    // M7e-4(R-384, F-4): 부채 0인 자가 판에서 shrink가 stay에 지배당하지 않게 건강 +1, 문장은 그 이유(쓸고 닦을 곳이 줄어 몸이 편해짐)
    { n: 19, at: ['middle-home-loan', 'shrink'], stats: { happiness: -1, health: 1 }, result: '큰 집을 정리하고 작은 집으로 옮겼습니다. 쓸고 닦을 곳이 줄어 몸은 편해졌지만 정든 집을 떠나는 마음은 한동안 무거웠습니다.' },
  ];

  it('19행이 모두 있다 (행 번호 1~19)', () => {
    expect(ROWS.map((r) => r.n)).toEqual(Array.from({ length: 19 }, (_, i) => i + 1));
  });

  for (const row of ROWS) {
    it(`${row.n}. ${row.at.join('/')}: 효과 값${row.result !== undefined ? '·결과 문장' : ''}이 문서의 새 값과 같다`, () => {
      const c = choiceOf(...row.at);
      for (const [k, v] of Object.entries(row.stats ?? {})) expect(c.effects?.stats?.[k as 'health'], `${row.at.join('/')} ${k}`).toBe(v);
      if (row.net !== undefined) expect(c.effects?.assets?.net, `${row.at.join('/')} 순자산`).toBe(row.net);
      if (row.result !== undefined) expect(c.result).toBe(row.result);
    });
  }

  it('효과 값을 고친 선택지에서 다른 항목은 그대로다: 19행이 건드린 항목 밖의 돈 효과(소득 보정·부채)는 변하지 않았다', () => {
    // 소득 보정은 평생 누적이라 돈 변경 금지(1-3절): 이 행들의 income 효과는 원래 값이다
    expect(choiceOf('youth-colleague', 'leave').effects?.assets?.income).toBe(-200);
    expect(choiceOf('youth-first-job', 'stable').effects?.assets?.income).toBe(800);
    expect(choiceOf('youth-first-job', 'family').effects?.assets?.income).toBe(1600);
    expect(choiceOf('youth-housing', 'loan').effects?.assets).toEqual({ net: -800, debt: 9000 });
    expect(choiceOf('middle-home-loan', 'shrink').effects?.assets).toEqual({ net: 1500, debt: -6000 });
  });
});

describe('E-4: 「혼자 먹는 저녁」(youth-lonely-city)은 독립 주거(월세·전세·자가)에서만 일어난다', () => {
  it('이벤트 조건에 주거가 있고 가족 집·돌봄 시설은 없다', () => {
    const ev = eventOf('youth-lonely-city');
    expect(ev.conditions?.assets?.dwelling).toEqual(['rent', 'jeonse', 'own']);
    expect(ev.conditions?.notFlags).toEqual(['married', 'lives_with_parents']);
    expect(ev.effects?.setFlags).toEqual(['lives_alone']);
  });

  it('3개 시대 × 1000판(무작위 선택): 일어난 모든 판이 그 해 시작에 월세·전세·자가였고, 가족 집에 사는 해에는 한 번도 일어나지 않는다 (조건이 실제로 걸러 낸 해도 있다)', () => {
    const independent = new Set(['rent', 'jeonse', 'own']);
    let happened = 0;
    let filtered = 0;
    const bad: string[] = [];
    for (const era of SIM_PROFILES) {
      for (let k = 0; k < 1000; k++) {
        const seed = 5000 + k * 7919;
        let s: GameState = startLife(seed, era);
        const chooser = chooserFor('random', seed);
        for (let i = 0; s.phase === 'life'; i++) {
          if (i >= 5000) throw new Error('진행이 끝나지 않는다');
          const prev = s;
          const r =
            s.pending !== null
              ? (() => {
                  const picked = chooser === null ? null : chooser(s);
                  return picked === null ? autoResolveStep(s, s.pending.key) : resolveChoiceStep(s, s.pending.key, picked);
                })()
              : stepYear(s);
          s = r.state;
          const dwelling = prev.assets?.dwelling ?? null;
          if (prev.seen['youth-lonely-city'] === undefined && s.seen['youth-lonely-city'] !== undefined) {
            happened++;
            if (dwelling === null || !independent.has(dwelling)) bad.push(`${era} 시드 ${seed} ${prev.age}세 주거 ${String(dwelling)}`);
          }
          // 이 해에 후보였지만 가족 집이라 걸러진 경우 (나이 창 20~28 · 미혼 · 부모 집 플래그 없음 · 아직 안 일어남)
          const e = prev.age >= 20 && prev.age <= 28 && !prev.flags.includes('married') && !prev.flags.includes('lives_with_parents');
          if (e && dwelling === 'family' && prev.seen['youth-lonely-city'] === undefined) filtered++;
        }
      }
    }
    expect(bad, '독립 주거가 아닌데 일어난 판').toEqual([]);
    expect(happened, '일어난 판 수(공허 통과 방지)').toBeGreaterThan(100);
    expect(filtered, '가족 집이라 걸러진 해(조건이 실제로 일을 한다)').toBeGreaterThan(100);
  }, 240_000);
});

describe('E-9: 형제 어휘·높임', () => {
  const strings = (): Array<{ where: string; text: string }> => {
    const out: Array<{ where: string; text: string }> = [];
    for (const ev of EVENT_POOL.events) {
      out.push({ where: `${ev.id}.title`, text: ev.title }, { where: `${ev.id}.text`, text: ev.text });
      for (const c of ev.choices ?? []) out.push({ where: `${ev.id}/${c.id}.label`, text: c.label }, { where: `${ev.id}/${c.id}.result`, text: c.result });
    }
    return out;
  };

  it('「형제들」이 어떤 본문·라벨·결과에도 없다 (형제 없는 판에서 모순이 된다 — 「가족」으로 바꿨다)', () => {
    expect(strings().filter((x) => x.text.includes('형제들')).map((x) => x.where)).toEqual([]);
  });

  it('바뀐 세 곳: middle-parents-care 본문·share 라벨, middle-parents-farewell share 라벨·결과', () => {
    expect(eventOf('middle-parents-care').text).toBe('부모님의 몸이 눈에 띄게 약해지셨습니다. 누가, 어디서, 어떻게 돌볼지 가족이나 친척과 이야기를 나눌 때가 왔습니다.');
    expect(choiceOf('middle-parents-care', 'share').label).toBe('가족이나 친척과 나누어 맡는다');
    // C20(QA-003-M7e 2회차, planner 10-9절): 라벨은 「일가친척과 의논해 치른다」(13자, 한글·공백뿐)로 확정 — planner 10-5절의 「가족이나 친척과 함께 의논해 치른다」(17자)는 360×740에서 카드 아래끝을 진행 줄 위 3px 넘겼고,
    // M7e-4에서 줄인 「가족·친척과 의논해 치른다」의 가운뎃점은 버튼 접근성 이름에 들어가 C20에 걸렸다. 결과 문장은 10-5절 그대로(「가족이나 친척과 …」)
    expect(choiceOf('middle-parents-farewell', 'share').label).toBe('일가친척과 의논해 치른다');
    expect(choiceOf('middle-parents-farewell', 'share').label).not.toMatch(/[^가-힣 ]/);
    expect(choiceOf('middle-parents-farewell', 'share').result).toBe('가족이나 친척과 역할을 나누어 장례를 치렀습니다. 슬픔 한가운데서도 오랜만에 한자리에 모였습니다.');
  });

  it('school-family-priority는 위로 형제가 있는 판(출생 순서 둘째 이상)에서만 일어난다 — 본문은 「형제가 많은 집」', () => {
    const ev = eventOf('school-family-priority');
    expect(ev.conditions?.birthOrder).toEqual({ min: 2 });
    expect(ev.text).toContain('형제가 많은 집이라');
  });

  it('높임 일관: school-early-work의 「부모님이 말수를 줄이셨습니다」 (부모님이 주어이고 행위가 나에게 향함)', () => {
    expect(eventOf('school-early-work').text).toBe('집안 형편이 어려워지자 부모님이 말수를 줄이셨습니다. 일손이 하나라도 더 필요했습니다.');
    expect(strings().filter((x) => /부모님이 [^.]*(줄였|말했|물었|떠났)습니다/.test(x.text)).map((x) => x.where)).toEqual([]);
  });
});

describe('R-377 나머지 (O04): 강요된 상황의 본문에서 어른의 정성을 단정하지 않는다', () => {
  const all = (): string[] => {
    const out: string[] = [];
    for (const ev of EVENT_POOL.events) {
      out.push(ev.text);
      for (const c of ev.choices ?? []) out.push(c.result);
    }
    return out;
  };

  it('「정해야 했습니다」가 한 줄도 없다 · 「야 했습니다」 끝맺음이 5줄 이하다 (끝맺음 반복 해소)', () => {
    const texts = all();
    expect(texts.filter((t) => t.includes('정해야 했습니다'))).toEqual([]);
    const must = texts.filter((t) => /야 했습니다/.test(t));
    expect(must.length, `「야 했습니다」 ${must.length}줄`).toBeLessThanOrEqual(5);
  });

  it('영유아 이벤트에 「어른들이 의논/고민/이야기를 나누」가 없다 (영유아는 어른의 숙고를 말하지 않는다)', () => {
    expect(all().filter((t) => /어른들(이|은) (의논|고민|이야기를 나누)/.test(t))).toEqual([]);
  });

  it('대치된 두 문장: school-family-priority·senior-spouse-care 본문', () => {
    expect(eventOf('school-family-priority').text).toBe('형제가 많은 집이라 학비를 모두에게 댈 수 없었습니다. 누가 어디까지 공부할지가 집안의 문제로 떠올랐습니다.');
    expect(eventOf('senior-spouse-care').text).toContain('간병을 누가 어떻게 맡을지가 코앞의 일이 되었습니다.');
    expect(eventOf('senior-old-friend').text).toContain('친구가 사는 곳까지는 먼 길이었습니다.');
  });
});

describe('E-7: 은퇴 뒤 다시 일하는 또래의 표시 라벨 「다시 일하는 사람」 (상태 키는 working 그대로)', () => {
  it('라벨 글자와 기본 라벨', () => {
    expect(PEER_RETURN_LABEL).toBe('다시 일하는 사람');
    expect(PEER_STATUS_LABEL.working).toBe('일하는 사람');
    expect(PEER_STATUS_LABEL.retired).toBe('은퇴');
  });

  it('peerLabelOf: 마지막 해가 working이고 앞선 해에 retired가 있었을 때만 「다시 일하는 사람」', () => {
    const s = (...x: PeerStatus[]) => x;
    expect(peerLabelOf(s('working', 'working'))).toBe('일하는 사람');
    expect(peerLabelOf(s('working', 'retired', 'working'))).toBe(PEER_RETURN_LABEL);
    expect(peerLabelOf(s('working', 'retired', 'working', 'working'))).toBe(PEER_RETURN_LABEL);
    expect(peerLabelOf(s('working', 'retired'))).toBe('은퇴');
    expect(peerLabelOf(s('working', 'retired', 'working', 'retired'))).toBe('은퇴');
    expect(peerLabelOf(s('seeking', 'working'))).toBe('일하는 사람');
    expect(peerLabelOf(s('caring', 'working'))).toBe('일하는 사람');
    expect(peerLabelOf(s('retired'))).toBe('은퇴');
  });

  it('대량 표본(수저 5단계 × 500줄기): 이 라벨은 working인 해에만, 그 전에 retired가 있던 줄기에만 붙고 상태 키·다른 라벨은 변하지 않는다', () => {
    let returned = 0;
    for (const w of PARENT_WEALTHS) {
      for (let k = 0; k < 500; k++) {
        const series = peerStatusSeries(1000 + k * 7919, 0, w, 100);
        for (let age = 0; age < series.length; age++) {
          const part = series.slice(0, age + 1);
          const label = peerLabelOf(part);
          if (label === PEER_RETURN_LABEL) {
            returned++;
            expect(series[age], `${w}단계 ${k}번 ${age}세`).toBe('working');
            expect(part.slice(0, -1).includes('retired'), `${w}단계 ${k}번 ${age}세`).toBe(true);
            expect(age, '은퇴 표가 있는 나이 이후').toBeGreaterThanOrEqual(55);
          } else {
            expect(label, `${w}단계 ${k}번 ${age}세`).toBe(PEER_STATUS_LABEL[series[age]]);
          }
        }
      }
    }
    expect(returned, '이 라벨이 실제로 나온다(공허 통과 방지)').toBeGreaterThan(1000);
  });

  it('peersNow: 화면 라벨(label)은 peerLabelOf의 마지막 해와 같고 status는 상태 키 그대로다', () => {
    const base = startLife(7, 'alpha');
    for (const age of [30, 60, 70, 80, 90]) {
      const game = { age, peerSeed: base.peerSeed, character: base.character, birthReport: base.birthReport };
      const peers = peersNow(game);
      expect(peers).toHaveLength(4);
      for (const [i, p] of peers.entries()) {
        const series = peerStatusSeries(base.peerSeed!, i, p.wealth, age);
        expect(p.status).toBe(series[series.length - 1]);
        expect(p.label).toBe(peerLabelOf(series));
      }
    }
  });
});

// ---------- M7e-4 (QA-003-M7e FAIL T03a·T03b·L02, REV-003-M7e-1, planner content-M7e.md 10절) ----------

describe('M7e-4 T03b·F-2: 「혼자 맞는 명절」과 「혼자 사는 집」은 독립 주거(월세·전세·자가)에서만 일어난다', () => {
  it('이벤트 조건: 주거 목록이 있고 가족 집·돌봄 시설은 없다 (기존 notFlags는 그대로)', () => {
    const holiday = eventOf('middle-lonely-holiday');
    expect(holiday.conditions?.assets?.dwelling).toEqual(['rent', 'jeonse', 'own']);
    expect(holiday.conditions?.notFlags).toEqual(['married']);
    const alone = eventOf('senior-alone');
    expect(alone.conditions?.assets?.dwelling).toEqual(['rent', 'jeonse', 'own']);
    expect(alone.conditions?.notFlags).toEqual(['married', 'moved_home']);
    // 조치 없음으로 판정한 「혼자」 서사는 조건을 걸지 않았다 (planner 10-1절 전수)
    expect(eventOf('youth-single-years').conditions?.assets).toBeUndefined();
  });

  it('3개 시대 × 1000판(무작위 선택): 두 이벤트가 일어난 판은 그 해 시작에 모두 월세·전세·자가였고, 가족 집이라 걸러진 해도 있다 (조건이 실제로 일을 한다)', () => {
    const independent = new Set(['rent', 'jeonse', 'own']);
    const ids = ['middle-lonely-holiday', 'senior-alone'] as const;
    const happened: Record<string, number> = { 'middle-lonely-holiday': 0, 'senior-alone': 0 };
    const filtered: Record<string, number> = { 'middle-lonely-holiday': 0, 'senior-alone': 0 };
    const bad: string[] = [];
    for (const era of SIM_PROFILES) {
      for (let k = 0; k < 1000; k++) {
        const seed = 9000 + k * 7919;
        let s: GameState = startLife(seed, era);
        const chooser = chooserFor('random', seed);
        for (let i = 0; s.phase === 'life'; i++) {
          if (i >= 5000) throw new Error('진행이 끝나지 않는다');
          const prev = s;
          const r =
            s.pending !== null
              ? (() => {
                  const picked = chooser === null ? null : chooser(s);
                  return picked === null ? autoResolveStep(s, s.pending.key) : resolveChoiceStep(s, s.pending.key, picked);
                })()
              : stepYear(s);
          s = r.state;
          const dwelling = prev.assets?.dwelling ?? null;
          for (const id of ids) {
            if (prev.seen[id] === undefined && s.seen[id] !== undefined) {
              happened[id]++;
              if (dwelling === null || !independent.has(dwelling)) bad.push(`${id} ${era} 시드 ${seed} ${prev.age}세 주거 ${String(dwelling)}`);
            }
          }
          const unmarried = !prev.flags.includes('married');
          if (unmarried && dwelling === 'family' && prev.age >= 42 && prev.age <= 60 && prev.seen['middle-lonely-holiday'] === undefined) filtered['middle-lonely-holiday']++;
          if (unmarried && !prev.flags.includes('moved_home') && dwelling === 'family' && prev.age >= 70 && prev.age <= 90 && prev.seen['senior-alone'] === undefined) filtered['senior-alone']++;
        }
      }
    }
    expect(bad, '독립 주거가 아닌데 일어난 판').toEqual([]);
    expect(happened['middle-lonely-holiday'], '「혼자 맞는 명절」이 일어난 판(공허 통과 방지)').toBeGreaterThan(100);
    expect(happened['senior-alone'], '「혼자 사는 집」이 일어난 판').toBeGreaterThan(100);
    expect(filtered['middle-lonely-holiday'], '가족 집이라 걸러진 해').toBeGreaterThan(50);
  }, 240_000);
});

describe('M7e-4 T03a: 「살 곳을 구하는 일」 — 부모님 집에 머문다(가족 집 판) / 부모님 집으로 돌아간다(독립 판)', () => {
  const ev = eventOf('youth-housing');
  const stateAt = (dwelling: 'family' | 'rent' | 'jeonse' | 'own', flags: string[] = []): GameState => {
    const base = startLife(7, 'alpha');
    const s: GameState = { ...base, age: 25, flags: [...flags].sort(), assets: null, familyFund: 0, seen: {}, pending: null };
    return { ...s, assets: { net: 5000, income: incomeOf(economyContextOf(s), 0), debt: 0, incomeAdj: 0, dwelling } };
  };
  const idsOf = (s: GameState): string[] => visibleChoices(ev, condContextOf(s)).map((c) => c.id);

  it('정의 4개, 보이는 것은 상태마다 2~3개: 가족 집 = rent·parents·loan / 독립 = rent·return·loan / 독립 + lives_alone = rent·loan', () => {
    expect(ev.choices!.map((c) => c.id)).toEqual(['rent', 'parents', 'return', 'loan']);
    expect(idsOf(stateAt('family'))).toEqual(['rent', 'parents', 'loan']);
    for (const d of ['rent', 'jeonse', 'own'] as const) {
      expect(idsOf(stateAt(d)), d).toEqual(['rent', 'return', 'loan']);
      expect(idsOf(stateAt(d, ['lives_alone'])), `${d} + lives_alone (F-1: 숨김 유지)`).toEqual(['rent', 'loan']);
    }
  });

  it('parents는 가족 집 판에서만, return은 독립 판에서만 — 같이 보이는 상태가 없다 (conditionsCompatible이 assets.dwelling 목록을 본다)', () => {
    const parents = choiceOf('youth-housing', 'parents');
    const back = choiceOf('youth-housing', 'return');
    expect(parents.requires).toEqual({ assets: { dwelling: ['family'] } });
    expect(back.requires).toEqual({ assets: { dwelling: ['rent', 'jeonse', 'own'] }, notFlags: ['lives_alone'] });
    expect(maxVisibleChoices(ev)).toBe(3);
    expect(conditionsCompatible([parents.requires, back.requires])).toBe(false);
    expect(conditionsCompatible([parents.requires, choiceOf('youth-housing', 'rent').requires])).toBe(true);
    // 같은 종류의 오탐 방지: 주거 목록이 겹치면 같이 보일 수 있다
    expect(conditionsCompatible([{ assets: { dwelling: ['rent'] } }, { assets: { dwelling: ['rent', 'own'] } }])).toBe(true);
    expect(conditionsCompatible([{ assets: { dwelling: ['family'] } }, { assets: { dwelling: ['rent', 'own'] } }])).toBe(false);
  });

  it('return의 라벨·결과·효과, parents는 글자·효과 그대로 (가족 집 판에는 「머문다」가 맞다)', () => {
    const back = choiceOf('youth-housing', 'return');
    expect(back.label).toBe('부모님 집으로 돌아간다');
    expect(back.result).toBe('짐을 싸 부모님 집으로 돌아갔습니다. 한 식탁에 앉는 저녁이 다시 늘었고 살림도 가벼워졌습니다. 독립은 한 걸음 물러섰습니다.');
    expect(back.effects).toEqual({ stats: { relationships: 2, happiness: -2 }, assets: { net: 400 }, setFlags: ['lives_with_parents'] });
    const parents = choiceOf('youth-housing', 'parents');
    expect(parents.label).toBe('부모님 집에 머문다');
    expect(parents.result).toBe('집을 나서지 않기로 했습니다. 돈은 아꼈지만 독립은 조금씩 미뤄졌습니다.');
    expect(parents.effects).toEqual({ stats: { relationships: 1, happiness: -1 }, assets: { net: 400 }, setFlags: ['lives_with_parents'] });
  });

  it('return을 고르면 다음 해 주거가 가족 집이고 lives_with_parents가 켜진다 (지금 parents와 같음) — 영향 줄은 관계 ▲ · 행복 ▼', () => {
    for (const d of ['rent', 'jeonse', 'own'] as const) {
      const s = { ...stateAt(d), pending: { eventId: 'youth-housing', key: 'youth-housing@25', age: 25, choiceIds: idsOf(stateAt(d)) } };
      const out = resolveChoiceStep(s, 'youth-housing@25', 'return').state;
      expect(out.flags, d).toContain('lives_with_parents');
      expect(out.assets!.dwelling, `${d} → 부모 집`).toBe('family');
      const items = previewChoice(s, choiceOf('youth-housing', 'return')).items;
      expect(items.find((i) => i.key === 'relationships'), d).toMatchObject({ direction: 'up' });
      expect(items.find((i) => i.key === 'happiness'), d).toMatchObject({ direction: 'down' });
    }
    const fam = stateAt('family');
    const f = { ...fam, pending: { eventId: 'youth-housing', key: 'youth-housing@25', age: 25, choiceIds: idsOf(fam) } };
    expect(resolveChoiceStep(f, 'youth-housing@25', 'parents').state.assets!.dwelling).toBe('family');
  });
});

describe('M7e-4 L02: 선택지 라벨의 어절은 5음절 이하 (번호 원 옆 라벨 칸 약 164px, 글자 200%에서 음절당 약 32px)', () => {
  // 라벨은 한글과 공백뿐이다(eventLint의 「라벨·제목은 한글과 공백만」, C20) — 낱말 경계는 공백이다
  const hangul = (t: string): number => (t.match(/[가-힣]/g) ?? []).length;
  const labels = (): Array<{ id: string; label: string }> => EVENT_POOL.events.flatMap((ev) => (ev.choices ?? []).map((c) => ({ id: `${ev.id}/${c.id}`, label: c.label })));

  it('풀 전체 라벨에 6음절 이상 어절이 없다', () => {
    const bad = labels().filter((l) => l.label.split(/\s+/).some((w) => hangul(w) >= 6));
    expect(bad.map((l) => `${l.id} 「${l.label}」`)).toEqual([]);
    expect(labels().length, '센 라벨 수(공허 통과 방지)').toBeGreaterThan(250);
  });

  it('고친 두 라벨: 무리를 해서라도 뒷받침한다 · 무리를 해서라도 다녀온다', () => {
    expect(choiceOf('middle-child-school', 'fund').label).toBe('무리를 해서라도 뒷받침한다');
    expect(choiceOf('senior-travel', 'go').label).toBe('무리를 해서라도 다녀온다');
  });

  it('5음절 어절이 든 라벨 감시 목록 (통과 중이나 칸이 4px 남짓 — 글꼴이 바뀌면 먼저 끊긴다): 목록이 늘거나 줄면 알린다', () => {
    const watch = labels().filter((l) => Math.max(...l.label.split(/\s+/).map(hangul)) === 5).map((l) => l.id);
    // planner 10-3절의 감시 목록 19개 + M7e-4에서 새로 5음절 어절을 가진 `middle-child-school/fund`(뒷받침한다) + C20의 `middle-parents-farewell/share`(일가친척과, 5음절 — 10-9절이 5음절 규칙 안으로 확인)
    expect([...watch].sort()).toEqual([
      'infant-stories/tell',
      'infant-daycare-wait/grandparents',
      'infant-daycare-wait/center',
      'school-first-love/keep',
      'school-academy-night/one',
      'youth-first-job/family',
      'youth-marriage/wait',
      'youth-marriage/part',
      'youth-marriage-again/part',
      'youth-child/later',
      'youth-workplace-romance/keep',
      'youth-night-study/save',
      'middle-child-school/fund',
      'middle-parents-farewell/share',
      'middle-career-peak/accept',
      'middle-layoff/open',
      'senior-illness/treat',
      'senior-travel/photo',
      'senior-estranged-child/wait',
      'senior-long-life/rest',
      'senior-memoir/tell',
    ].sort());
  });
});

describe('M7e-4 문장 정리 (planner 10-4·10-5절): 문장 교체표의 결과가 풀의 문체 지표를 지킨다', () => {
  const hangul = (t: string): number => (t.match(/[가-힣]/g) ?? []).length;
  const resultsAndTexts = (): string[] => EVENT_POOL.events.flatMap((ev) => [ev.text, ...(ev.choices ?? []).map((c) => c.result)]);
  const results = (): string[] => EVENT_POOL.events.flatMap((ev) => (ev.choices ?? []).map((c) => c.result));

  it('R-379: apart는 「따로 꾸리는 살림」 — 상태를 단정하는 「혼자」·「홀로」가 없다 · R-380: 시작 결과는 「배운 것이 쌓였고」', () => {
    expect(choiceOf('middle-marriage-crisis', 'apart').result).toBe('오랜 고민 끝에 각자의 길을 가기로 했습니다. 재산을 나누느라 목돈이 나갔지만 따로 꾸리는 살림은 가벼워졌고, 오랜 긴장도 풀렸습니다.');
    expect(choiceOf('middle-marriage-crisis', 'apart').result).not.toMatch(/혼자|홀로/);
    expect(choiceOf('youth-startup', 'start').result).toContain('배운 것이 쌓였고 윤곽이 잡혀 갔습니다.');
    expect(choiceOf('youth-startup', 'start').result).not.toContain('배울 것');
  });

  it('R-384(F-4): shrink 건강 +1 — 부채 0 판에서도 stay와 서로 지배하지 않는다 (자산 같음 · 행복 ▼ 대 건강 ▲)', () => {
    expect(choiceOf('middle-home-loan', 'shrink').effects).toEqual({ stats: { happiness: -1, health: 1 }, assets: { net: 1500, debt: -6000 } });
    expect(choiceOf('middle-home-loan', 'stay').effects?.stats?.health).toBeUndefined();
    expect(choiceOf('middle-home-loan', 'shrink').result).toContain('쓸고 닦을 곳이 줄어 몸은 편해졌지만');
  });

  it('높임(O02): 부모님·조부모님·선생님이 주어인 서술에는 「-시-」가 있다 — 관계절·종속절 포함 (E 점검)', () => {
    const missing: string[] = [];
    for (const s of resultsAndTexts()) {
      for (const m of s.matchAll(/(부모님|조부모님|선생님)(?:이|은|께서) ([^.,]*)/g)) if (!/시|셨|세요/.test(m[2])) missing.push(m[0]);
    }
    expect(missing).toEqual([]);
    expect(eventOf('infant-daycare-wait').choices!.find((c) => c.id === 'grandparents')!.result).toContain('조부모님이 낮 동안 아이를 맡으셨습니다');
    expect(eventOf('infant-care').text).toContain('부모님이 일하러 나가시는 낮 동안');
    expect(eventOf('infant-neglect-night').text).toContain('부모님의 귀가가 늦은 밤이 잦았습니다');
    expect(eventOf('middle-parents-farewell').text).toContain('마지막 숨을 몰아쉬시는 날이 왔습니다');
  });

  it('어절 길이(O06): 풀 전체의 제목·본문·라벨·결과에 8음절 이상 어절이 없다', () => {
    const long: string[] = [];
    for (const ev of EVENT_POOL.events) {
      const parts = [ev.title, ev.text, ...(ev.choices ?? []).flatMap((c) => [c.label, c.result])];
      for (const p of parts) for (const w of p.split(/\s+/)) if (hangul(w) >= 8) long.push(`${ev.id} ${w}`);
    }
    expect(long).toEqual([]);
  });

  it('끝맺음(O03): 결과 중 「~지만」 비율 ≤ 35%(41% → 31%), 마지막 문장이 「~수 있었습니다」인 결과 ≤ 4', () => {
    const r = results();
    const jiman = r.filter((x) => x.includes('지만')).length;
    expect(jiman / r.length, `「~지만」 ${jiman}/${r.length}`).toBeLessThanOrEqual(0.35);
    const possible = r.filter((x) => /수 있었습니다\.?$/.test(x.trim()));
    expect(possible.length, possible.join(' / ')).toBeLessThanOrEqual(4);
    expect(r.length, '센 결과 수(공허 통과 방지)').toBeGreaterThan(250);
    // 유혹 한 줄 「…은 아꼈습니다」 둘이 앞과 이어지게 고쳐졌다
    expect(choiceOf('senior-classmates', 'skip').result).toBe('집에 머물렀습니다. 오가는 차비를 아낀 대신 모임 소식은 며칠 뒤에야 전해 들었습니다.');
    expect(choiceOf('middle-friend-reunion', 'later').result).toContain('쓸 일 없던 돈은 그대로 남았고 그 연락은 다시 오지 않았습니다.');
  });

  it('O04·관찰: 어색한 문장 고침과 「정할 때/차례」 결정 카드 끝맺음 — 마지막 문장 끝 구절이 같은 것은 2장 이하', () => {
    expect(choiceOf('youth-night-study', 'study').result).toContain('더 이상 먼 이야기가 아니었습니다');
    expect(eventOf('middle-late-child').text).toContain('늦게 맞은 아이의 부모는 또래 부모들보다 나이가 많았습니다.');
    expect(choiceOf('school-first-love', 'keep').result).toContain('조용히 가라앉혔습니다');
    expect(choiceOf('youth-marriage', 'part').result).toContain('함께 쓰던 돈과 시간은 가벼워졌습니다');
    expect(eventOf('youth-partner-leaves').text).toContain('오랜 시간 함께한 사람이 끝내 마음을 거두고 돌아섰습니다.');
    expect(choiceOf('school-scholarship', 'apply').result).toContain('학비 걱정이 한결 덜어졌습니다');
    expect(eventOf('school-tutoring').text).toContain('달라질 것이 있는지는 아직 정해지지 않았습니다.');
    expect(eventOf('youth-machine-partner').text).toContain('어디까지 맡길지는 아직 열려 있었습니다.');
    const ends = EVENT_POOL.events
      .filter((ev) => (ev.choices ?? []).length > 0)
      .map((ev) => ev.text.trim().split(/(?<=\.)\s+/).pop()!)
      .filter((last) => /정할 (때|차례)|정해야 했습니다/.test(last));
    expect(ends.length, ends.join(' / ')).toBeLessThanOrEqual(2);
  });

  it('O05·O06: 외동 판의 「가족이나 친척」, 8음절 어절 단축 문장', () => {
    expect(eventOf('middle-parents-care').choices!.find((c) => c.id === 'home')!.result).toBe('부모님을 곁에 모시고 직접 돌보았습니다. 몸은 고되었지만 가까이 있다는 사실이 서로에게 위안이었습니다.');
    expect(eventOf('infant-parental-leave').text).toBe('아이가 태어난 첫해, 누가 일을 쉬고 아이를 돌볼지가 집안의 문제였습니다. 일터와 살림살이가 함께 걸려 있었습니다.');
    expect(eventOf('infant-hovering').text).toBe('아이가 넘어질세라 어른들은 늘 한 걸음 앞에 있었습니다. 아이는 안전했고, 조금 몸을 사리는 편이었습니다.');
    expect(choiceOf('senior-gathering', 'grandchildren').result).toContain('아이들의 웃음소리로 집이 다시 북적였습니다.');
    expect(choiceOf('senior-diet', 'eat').result).toContain('병원에 가는 날은 가시방석 같았습니다.');
  });
});
