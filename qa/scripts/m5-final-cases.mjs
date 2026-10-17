// QA-003 M5 마무리: 콘솔·외부 요청 집계(X01), SKIP(X03), 기록(O 계열, 숫자는 수집한 자료에서 다시 센다)을 케이스 기록에 더하고,
// cases.jsonl을 케이스 ID별 마지막 기록만 남기도록 정리한다(스크립트 오류·절대경로가 든 문장 제거).
import fs from 'node:fs';
import path from 'node:path';
import { OUT, CASES } from './m5-lib.mjs';

const readJsonl = (f) => (fs.existsSync(path.join(OUT, f)) ? fs.readFileSync(path.join(OUT, f), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const raw = readJsonl('cases.jsonl');
const OWN = new Set(['M5-X01', 'M5-X03', 'M5-O01', 'M5-O02', 'M5-O04', 'M5-O05', 'M5-O06', 'M5-O07', 'M5-O08', 'M5-O09', 'M5-O10']);
const last = new Map();
for (const r of raw) if (r.verdict !== 'ERROR' && !OWN.has(r.id)) last.set(r.id, r);
const recs = [...last.values()];
const add = (rec) => recs.push({ console: [], externalRequests: [], shots: [], at: new Date().toISOString(), ...rec });
const sanitize = (s) => String(s).replace(/[A-Za-z]:[\\/][^\s"')]*/g, '<경로>');

// ---- X01 ----
let ext = 0;
const con = {};
for (const r of recs) {
  ext += (r.externalRequests || []).length;
  for (const c of r.console || []) {
    const k = `${c.type}: ${String(c.text).replace(/https?:\/\/[^ ]+/g, '<주소>').slice(0, 60)}`;
    con[k] = (con[k] ?? []).concat(r.id);
  }
}
const journeys = fs.readdirSync(OUT).filter((f) => /^journey-(?!s0).*\.json$/.test(f)).map((f) => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')));
const jcon = journeys.reduce((s, j) => s + (j.console?.length ?? 0), 0);
const jext = journeys.reduce((s, j) => s + (j.externalRequests?.length ?? 0), 0);
const harvestRuns = ['past', 'present', 'future'].flatMap((e) => readJsonl(`samples-fix-${e}.jsonl`));
const harvestErr = harvestRuns.filter((r) => (r.errors || []).length || r.failed).map((r) => `${r.era}-${r.seed}`);
const conList = Object.entries(con).map(([k, v]) => `${k} (${[...new Set(v)].join(',')})`);
add({ id: 'M5-X01', cat: '환경', title: '콘솔 오류·경고와 외부 요청: 전 케이스 집계', steps: `모든 케이스(runCase)의 콘솔 error·warning·pageerror·requestfailed·대화상자와 localhost 밖으로 나간 요청, 정상 플레이 ${journeys.length}판, 수확 ${harvestRuns.length}판의 페이지 오류`, expected: '외부 요청 0, 콘솔 오류·pageerror 0(오프라인 새로고침 실패는 기록)', verdict: ext === 0 && jext === 0 && jcon === 0 && harvestErr.length === 0 ? 'PASS' : 'FAIL', actual: `외부 요청 ${ext + jext}건, 정상 플레이 ${journeys.length}판 콘솔 ${jcon}건, 수확 ${harvestRuns.length}판 중 페이지 오류·실패 ${harvestErr.length}판. 케이스 콘솔 기록: ${conList.length ? conList.join(' · ') : '없음'}` });
add({ id: 'M5-X03', cat: '환경', title: 'WebKit(iOS Safari)·실기기·실제 스크린리더·Windows 고대비 실제 팔레트에서의 확인', steps: '새 브라우저 바이너리를 내려받지 않는 조건(형진 님 허락 전)', expected: '—', verdict: 'SKIP', actual: 'Playwright Chromium(헤드리스)만 사용. WebKit·Firefox·실기기·실제 스크린리더·강제 색상 실제 팔레트는 확인하지 못함' });
const rec = (id, title, actual, steps = '관찰', expected = '(설계 판단)') => add({ id, cat: '기록', title, steps, expected, verdict: 'RECORD', actual: sanitize(actual) });

// ---- O01: 표기 방향 대 같은 해 끝 순자산 ----
{
  const L = readJsonl('samples-match.jsonl').filter((r) => !r.err);
  let down = 0, downUp = 0, up = 0, upDown = 0, n = 0;
  let ex = '';
  for (const r of L) {
    const S = JSON.parse(r.pre.raw).data;
    const P = JSON.parse(r.post.raw).data;
    if (!S.assets || !P.assets) continue;
    const a = r.pre.dash.choices.find((x) => x.id === r.choiceId)?.impact.find((i) => i.key === 'assets');
    if (!a) continue;
    n++;
    const dn = P.assets.net - S.assets.net;
    if (a.direction === 'down') {
      down++;
      if (dn > 0) {
        downUp++;
        if (!ex) ex = `${r.era} ${r.age}세 ${r.eventId}/${r.choiceId} 「자산 ${'▼'.repeat(a.steps)}」 → 해 끝 순자산 +${dn.toLocaleString()}만 원`;
      }
    } else {
      up++;
      if (dn < 0) upDown++;
    }
  }
  rec('M5-O01', '자산 ▼로 표기된 선택이 같은 해 끝에는 순자산이 오히려 늘어 있는 경우가 흔하다(표기는 해마다 규칙을 뺀 「선택의 효과」)', `재생 ${L.length}번 중 자산 항목이 있는 성인 선택 ${n}건: 「자산 ▼」 ${down}건 중 ${downUp}건(${Math.round((100 * downUp) / down)}%)은 선택 직후 한 해가 끝났을 때 순자산이 선택 전보다 늘어 있고, 「자산 ▲」 ${up}건 중 ${upDown}건(${Math.round((100 * upDown) / up)}%)은 줄어 있음(예: ${ex}). 안내 한 줄에는 「해마다 소득·생활비는 따로 반영된다」는 말이 없다 — 플레이어가 표기와 자산 카드 변화를 곧바로 맞춰 보면 어긋나 보일 수 있다`, '재생 기록에서 표기 방향과 같은 해 S→P 순자산 변화 부호를 센다', '표기 = 선택의 효과(해마다 규칙 제외), EC5·economy-model.md 7절');
}
rec('M5-O02', '20세 미만 선택지의 「집안 살림」이 무엇인지 화면 어디에도 설명이 없다', '20세 미만 선택지 카드에는 「집안 살림 ▼▼」가 나오지만 집안 살림의 값·뜻은 화면에 없고(자산 카드는 「자산은 스무 살부터 셉니다. 지금은 집안 형편을 따릅니다.」뿐), 안내 한 줄도 ▲▼ 설명만 있다. copy.md 4-1이 이름을 정했지만 뜻을 풀어 주는 문장은 없다(20세에 자산·부채로 합쳐진다는 연결도 없음)', '20세 미만 카드·자산 카드·도움말 문구 확인');
// ---- O04: 최종 순자산 0원 ----
{
  const ends = harvestRuns.filter((r) => r.ending).map((r) => JSON.parse(r.ending).data);
  const zero = ends.filter((d) => d.assets && d.assets.net === 0).length;
  const neg = ends.filter((d) => d.assets && d.assets.net < 0).length;
  const pos = ends.filter((d) => d.assets && d.assets.net > 0).length;
  const n07 = recs.find((r) => r.id === 'M5-N07')?.actual ?? '';
  const g = (re) => (re.exec(n07) || [])[1] ?? '?';
  rec('M5-O04', '최종 순자산 0원으로 끝나는 판이 많고, 같은 0원이 세상에 따라 다른 자리로 읽힌다', `수확 ${ends.length}판의 엔딩(선택은 섞음): 순자산 0원 ${zero}판(${Math.round((100 * zero) / ends.length)}%)·음수 ${neg}판(${Math.round((100 * neg) / ends.length)}%)·양수 ${pos}판(${Math.round((100 * pos) / ends.length)}%) — 노년 안전망이 순자산을 0에 묶는 결과(economy-model.md 9절의 음수·0 비율과 같은 계열). 엔딩 줄의 자리 글자는 같은 0원이 지금 세상 「${g(/present\/ending-zero: 0원 · 같은 세상 안에서 ([^|]+?) \|/)}」·지난 세상 「${g(/past\/ending-zero: 0원 \+ 지금 가치로 환산 · 같은 세상 안에서 ([^|]+?) \|/)}」·다가올 세상 「${g(/future\/ending-zero: 0원 \+ 지금 가치로 환산 · 같은 세상 안에서 ([^|]+?) \|/)}」로 나온다(분포표 기준). 「0원 = 딱 중간쯤」이 처음 보는 사람에게는 어색할 수 있다(designer·planner 판단)`, '수확한 엔딩 저장의 최종 순자산·엔딩 줄 글자(N07)');
}
rec('M5-O05', '변조된 긴 이름이 320폭·글자 200%에서 헤더 이름(h1)을 넘치게 한다(M4-A10과 같은 현상, M5 요소는 영향 없음)', '한글 20자 330px·W 20자 336px·태그 이름 12px 가로 넘침 — 넘치는 요소는 헤더 h1[life-name] 하나뿐이고 선택지 카드·영향 줄·안내 한 줄·번호 원은 모두 칸 안(m5-name-probe). 정상 플레이 이름은 4자 이하라 변조 저장에서만 발생', '이름 변조 11종 × 360·320폭 × 글자 100·200%');
// ---- O06: 예외 ② ----
{
  const tall = [];
  for (const e of ['present', 'past', 'future']) for (const r of readJsonl(`audit-focus-${e}.jsonl`)) if (r.tallNotes) tall.push(`${e}/${r.state}/${r.vp}/${r.font}%`);
  rec('M5-O06', '글자 200% 작은 화면에서 선택지 카드 하나가 가용 높이보다 커져(영향 줄이 붙은 뒤) CM10 예외 ②에 걸리는 조합이 있다', `포커스 링 상자가 가용 높이(화면 − 하단 띠)보다 큰 조합 ${tall.length}개: ${tall.join(', ')} — 위쪽 변은 화면 안이고 아래쪽 일부가 하단 띠 아래로 감(360×568·글자 200%에서 링 약 11px, 320×568은 약 50px). 예외 ② 정의(링까지 합쳐 가용 높이보다 큼)에 들어 가림 0으로 판정했다(M5-C10f). 카드가 길어진 M5의 부작용이라 형진 님 실기기 확인 후보`, '포커스 감사의 예외 ② 메모');
}
// ---- O07: EC6 여유 ----
{
  const out = readJsonl('samples-ec6-out.jsonl').filter((r) => !r.err);
  const byPair = new Map();
  for (const r of out) {
    const k = `${r.rng}-${r.era}-${r.tier}-${r.parenting}`;
    if (!byPair.has(k)) byPair.set(k, {});
    byPair.get(k)[r.arm] = r.picked === 'meet' ? 1 : 0;
  }
  const ds = [...byPair.values()].filter((x) => x.A !== undefined && x.B !== undefined).map((x) => x.A - x.B);
  const mean = ds.reduce((s, x) => s + x, 0) / ds.length;
  const se = Math.sqrt(ds.reduce((s, x) => s + (x - mean) ** 2, 0) / (ds.length - 1) / ds.length);
  const pct = (arm, par) => {
    const a = out.filter((r) => r.arm === arm && (!par || r.parenting === par));
    return a.length ? Math.round((1000 * a.filter((r) => r.picked === 'meet').length) / a.length) / 10 : null;
  };
  const by = ['strict', 'free', 'helicopter', 'neglect'].map((p) => `${{ strict: '엄격', free: '자유', helicopter: '헬리콥터', neglect: '방임' }[p]} ${pct('A', p)}→${pct('B', p)}`).join(' · ');
  rec('M5-O07', 'EC6 자동 모드 연애 시작 비율 차이의 여유', `같은 바탕·같은 난수 쌍 ${ds.length}쌍(비부채 순자산 +8,000 / 부채 −3,000)에서 차이 ${(mean * 100).toFixed(1)}%p(쌍별 표준오차 ${(se * 100).toFixed(1)}%p, 95% 구간 ${((mean - 1.96 * se) * 100).toFixed(1)}~${((mean + 1.96 * se) * 100).toFixed(1)}%p). 기준(≥ 10%p)과의 여유는 ${(mean * 100 - 10).toFixed(1)}%p. 교육방식별 비부채→부채 meet 비율: ${by}. 부채가 더 깊은 판(예: −6,000)이면 차이가 커진다`, 'm5-ec6.mjs (자동 모드 8배속, 시간 배율 60)');
}
// ---- O08: lives_alone ----
{
  let games = 0;
  let fam = 0;
  const tiers = new Set();
  for (const r of harvestRuns) {
    if (!r.fixtures) continue;
    let seen = false;
    for (const fx of r.fixtures) {
      const d = JSON.parse(fx.raw).data;
      if (!d.assets || seen || !d.flags.includes('lives_alone')) continue;
      seen = true;
      games++;
      if (d.assets.dwelling === 'family') {
        fam++;
        tiers.add(d.character.parentWealth);
      }
    }
  }
  rec('M5-O08', '「혼자 먹는 저녁」(youth-lonely-city, `lives_alone`)을 보는 20대 재력 3~5단계가 모델상으로는 부모 집(family)에 산다', `\`lives_alone\`을 켠 판 ${games}개 중 ${fam}판이 그 시점에도 주거 \`family\`(재력 ${[...tiers].sort().join('·')}단계: 독립 때 부모 집이 기본이고 \`lives_alone\`은 주거를 바꾸지 않으며 미혼 30세에 월세로 나옴). 사건 문구(「낯선 동네에서 혼자 저녁을 먹는 날이 늘었다」)와 모델(생활비 ×0.25·주거비 0)이 어긋난다 — 주거는 화면에 안 나와 직접 모순으로 보이진 않지만 CM9(문구와 상태 모순 0)의 정신에 걸린다`, '수확한 저장에서 lives_alone 플래그와 assets.dwelling을 대조');
}
rec('M5-O09', '오프라인 새로고침은 실패한다(CM3상 기대 항목이 아님, 기록만)', 'prod에서 열린 뒤 오프라인으로 바꾸면 선택·진행·저장은 정상, 끊긴 채 새로고침은 net::ERR_INTERNET_DISCONNECTED(서비스 워커 없음)', 'M5-A09');
// ---- O10: 시설 비용 상쇄 (m5-o10.mjs의 화면 관찰) ----
rec('M5-O10', '재력·순자산이 높은 판에서 시설 입소(middle-parents-care/facility)의 영향 줄에 자산이 없다(비용이 보너스와 상쇄되어 0)', '기본 net −3,600에 보너스 2개(재력 4단계 이상 +1,800 · 순자산 10억 이상 +1,800)가 겹치면 합 0이다. 화면: 재력 1·순자산 1.2억 「자산 ▼▼▼ · 행복 ▼」 / 재력 3·1.2억 「자산 ▼▼▼ · 행복 ▼」 / 재력 5·1.2억 「자산 ▼▼ · 행복 ▼」 / 재력 3·10억 「자산 ▼▼ · 행복 ▼」 / 재력 5·10억 「행복 ▼」(자산 줄 없음). 결과 문장은 「비용을 감당해 나갔다」라 어긋나지는 않는다 — 부유한 사람에게는 비용이 안 든다는 설계로 읽힌다', '크래프트 저장(재력·순자산만 바꿈)으로 화면 관찰');
fs.writeFileSync(CASES, recs.map((r) => JSON.stringify(r)).join('\n') + '\n');
console.log('케이스', recs.length, '개 저장 · 외부 요청', ext, ' 콘솔 목록', conList);
