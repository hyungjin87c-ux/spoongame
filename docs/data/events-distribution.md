# 사연 이벤트 분포표 (SPEC-001 M4)

> 이 문서는 `src/data/events/*.json`에서 자동으로 만든다. 직접 고치지 않는다: `npx vite-node scripts/eventDistribution.ts` 로 다시 만들고,
> `tests/eventDistribution.test.ts`가 파일과 이벤트 데이터가 같은지(개수 표·이벤트 목록·플래그 표) 확인한다. 모티브 한 줄은 `scripts/eventMotifs.ts`에 적는다.
> 모든 이벤트는 커뮤니티에서 흔한 사연의 **종류**를 모티브로만 삼아 새로 쓴 글이다(실제 글 원문·실존 인물·실제 상호·실제 사건명 없음).

## 1. 총계

- 이벤트 **140개** = 선택지 이벤트 90개 + 서술 이벤트 50개 (SPEC 최소 60개). 파일 5개(생애 단계별), 모든 이벤트는 한 판에 한 번만 나온다(once).
- 시대 전용: 지난 세상 10개 · 지금 세상 6개 · 다가올 세상 7개 / 시대 중립 공용 107개 / 두 시대 공용 10개

## 2. 시대 × 생애 단계 × 유형 (그 칸에서 일어날 수 있는 이벤트 수)

조건부 이벤트(플래그·재력·교육방식·성별·스탯 조건)도 센다. 한 이벤트가 여러 단계에 걸치면 단계마다 센다. 칸의 값은 `서술 / 선택지`.

| 생애 단계 | 지난 세상 | 지금 세상 | 다가올 세상 |
|---|---|---|---|
| 영유아 (0~6세) | 16 / 9 | 14 / 15 | 17 / 12 |
| 학창 (7~19세) | 7 / 15 | 6 / 15 | 6 / 15 |
| 청년 (20~39세) | 9 / 19 | 8 / 20 | 7 / 20 |
| 중년 (40~64세) | 7 / 22 | 8 / 23 | 7 / 24 |
| 노년 (65세~) | 5 / 17 | 5 / 17 | 5 / 18 |
| **합계(칸 합)** | 44 / 82 | 41 / 90 | 42 / 89 |

## 3. 이벤트 목록

유형: 서술 = 선택지 없이 효과만 / 선택지 = 2~3개 중 선택. 플래그: 켬 = 이 이벤트의 선택·효과가 켜는 것 / 읽음 = 조건·선택지 노출·보너스·확률 배수에서 읽는 것.

### 영유아 (0~6세) — 35개

| id | 제목 | 나이 | 시대 | 유형 | 모티브 | 플래그 |
|---|---|---|---|---|---|---|
| `infant-first-word` | 첫 말 | 1~1 | 공용 | 서술 | 아이의 첫 말에 온 가족이 웃던 일 | - |
| `infant-care` | 맡겨지는 낮 | 1~5 | 공용 | 선택지 3 | 맞벌이 부모가 아이를 어디에 맡길지 정하는 일 | 켬 `childcare_set` `grandparent_close` / 읽음 `childcare_set` |
| `infant-fever` | 한밤의 열 | 1~5 | 공용 | 선택지 3 | 한밤에 아이가 열이 올라 병원에 갈지 망설이던 일 | - |
| `infant-stories` | 자기 전의 이야기 | 2~6 | 공용 | 선택지 3 | 자기 전 이야기를 졸라 대던 아이를 대하는 방식의 차이 | - |
| `infant-screen` | 화면 앞의 아이 | 2~6 | 지금·다가올 전용 | 선택지 3 | 아이에게 화면을 보여 줄지 말지 고민하는 부모 | - |
| `infant-new-sibling` | 동생이 생겼다 | 2~4 | 공용 | 선택지 4 | 동생이 생기면서 느낀 서운함 | 켬 `sibling_close` `younger_sibling` / 읽음 `grandparent_close` |
| `infant-village` | 온 골목의 아이 | 1~6 | 지난 전용 | 서술 | 골목 전체가 아이를 함께 키우던 어린 시절 | - |
| `infant-grandparent-song` | 무릎 위의 노래 | 1~6 | 공용 | 서술 | 조부모 무릎에서 듣던 노래의 기억 | 읽음 `grandparent_close` |
| `infant-neglect-night` | 불 꺼진 집 | 1~6 | 공용 | 서술 | 부모가 늦게까지 돌아오지 않던 밤의 외로움 | - |
| `infant-hovering` | 한 걸음 앞의 어른 | 1~6 | 공용 | 서술 | 아이를 늘 앞서서 지켜 주던 과보호 육아 | - |
| `infant-free-play` | 마음껏 뛰놀던 날들 | 2~6 | 공용 | 서술 | 흙투성이로 마음껏 놀게 두던 자유로운 육아 | - |
| `infant-vaccine` | 첫 예방접종 | 0~0 | 공용 | 서술 | 첫 예방접종 날 크게 울던 아이를 안아 달래던 일 | - |
| `infant-hundred-days` | 백일 | 0~0 | 공용 | 서술 | 백일을 맞아 떡을 나누던 집 | - |
| `infant-night-wake` | 밤마다 깨는 아이 | 0~1 | 공용 | 서술 | 밤마다 깨는 아이를 번갈아 달래던 부모 | - |
| `infant-meal-start` | 처음 먹는 밥 | 0~1 | 공용 | 선택지 3 | 이유식을 직접 만들지 사 먹일지 정하던 부모 | - |
| `infant-checkup` | 영유아 건강검진 | 0~3 | 지금·다가올 전용 | 서술 | 정해진 때마다 아이를 데리고 받던 영유아 건강검진 | - |
| `infant-parental-leave` | 일을 쉬는 한 해 | 0~0 | 지금 전용 | 선택지 3 | 아이가 태어난 첫해 누가 일을 쉴지 정하던 부부 | 켬 `childcare_set` |
| `infant-care-alert` | 곁을 지키는 기계 | 0~2 | 다가올 전용 | 서술 | 돌봄 기계가 밤새 곁을 살피던 집 | - |
| `infant-first-steps` | 첫 걸음마 | 1~1 | 공용 | 서술 | 처음 혼자 걷던 날 숨을 죽이고 지켜보던 가족 | - |
| `infant-first-birthday` | 첫 생일 | 1~1 | 공용 | 선택지 3 | 첫 생일을 어떻게 치를지 의견이 갈리던 가족 | - |
| `infant-daycare-wait` | 어린이집 대기 | 1~2 | 지금 전용 | 선택지 3 | 어린이집 대기 순번이 줄지 않아 맡길 곳을 찾던 부모 | 켬 `childcare_set` `grandparent_close` / 읽음 `childcare_set` |
| `infant-follow-sibling` | 형제를 따라 하는 아이 | 1~5 | 공용 | 서술 | 형제의 말투와 놀이를 따라 하던 막내 | - |
| `infant-coal-winter` | 겨울밤의 아랫목 | 1~5 | 지난 전용 | 서술 | 연탄불이 꺼질까 번갈아 일어나던 겨울밤 | - |
| `infant-tantrum` | 드러누운 아이 | 2~3 | 공용 | 서술 | 길 한복판에 드러누워 떼를 쓰던 아이 | - |
| `infant-market-day` | 장날의 손 | 2~6 | 지난 전용 | 서술 | 장날마다 어른 손을 잡고 나가던 아이 | - |
| `infant-talking-toy` | 말을 받아 주는 인형 | 3~5 | 다가올 전용 | 서술 | 말을 받아 주는 인형과 오래 이야기하던 아이 | - |
| `infant-heat-day` | 나갈 수 없는 한낮 | 2~6 | 다가올 전용 | 서술 | 더위 때문에 놀이터에 나가지 못한 여름 | - |
| `infant-noise` | 이웃의 항의 | 2~6 | 지금 전용 | 선택지 3 | 아이 뛰는 소리로 이웃의 항의를 받던 집 | - |
| `infant-questions` | 묻기 시작한 아이 | 3~5 | 공용 | 서술 | 눈에 띄는 것마다 이름과 까닭을 묻던 아이 | - |
| `infant-kindergarten` | 유치원 고르기 | 3~4 | 지금·다가올 전용 | 선택지 3 | 아이가 다닐 유치원을 두고 고민하던 부모 | - |
| `infant-sibling-toy` | 동생의 장난감 | 3~6 | 공용 | 선택지 3 | 동생이 만지는 장난감을 놓지 않던 첫째 | 읽음 `younger_sibling` |
| `infant-hospital-stay` | 병실에서 보낸 며칠 | 3~6 | 공용 | 선택지 3 | 아이가 입원해 곁을 지킬 사람을 정하던 가족 | - |
| `infant-moving` | 이삿짐을 싸던 날 | 3~6 | 공용 | 선택지 3 | 계약이 끝나 정든 동네를 떠나던 가족 | - |
| `infant-early-lessons` | 취학 전의 시간표 | 5~6 | 지금·다가올 전용 | 선택지 3 | 입학 전에 무엇을 시킬지 고민하던 부모 | - |
| `infant-first-book` | 처음 읽은 책 | 6~7 | 공용 | 서술 | 글자를 짚어 가며 처음 책 한 권을 읽은 날 | - |

### 학창 (7~19세) — 26개

| id | 제목 | 나이 | 시대 | 유형 | 모티브 | 플래그 |
|---|---|---|---|---|---|---|
| `school-lunch` | 각자의 점심 | 8~16 | 지난 전용 | 서술 | 도시락 반찬에 집안 형편이 드러나던 교실 | 읽음 `left_school` |
| `school-friend` | 전학 온 아이 | 8~13 | 공용 | 선택지 3 | 전학생에게 먼저 말을 걸지 고민한 일 | 켬 `close_friend` / 읽음 `left_school` |
| `school-tutoring` | 성적표를 받은 저녁 | 10~16 | 공용 | 선택지 3 | 성적표를 받고 공부 방법을 가족과 정하던 저녁 | 읽음 `left_school` |
| `school-first-love` | 자꾸 눈에 들어오는 사람 | 15~19 | 공용 | 선택지 2 | 같은 반 아이를 좋아하게 된 첫 감정 | 켬 `first_love` / 읽음 `left_school` |
| `school-exam` | 입시를 앞둔 해 | 16~19 | 공용 | 선택지 3 | 입시 앞에서 지원·재수·취업 사이의 갈림길 | 켬 `college` `early_work` / 읽음 `left_school` `mentor_teacher` `scholar` `skilled_trade` |
| `school-early-work` | 어려워진 집안 형편 | 13~16 | 지난 전용 | 선택지 2 | 집안이 기울어 학교와 일 사이에서 고민하던 일 | 읽음 `left_school` |
| `school-bully` | 교실의 한 아이 | 9~15 | 공용 | 선택지 3 | 교실의 따돌림을 곁에서 보게 된 일 | 켬 `stood_up` / 읽음 `left_school` |
| `school-club` | 방과 후의 모임 | 11~17 | 공용 | 선택지 3 | 방과 후 어디에 어울릴지 정하던 일 | 켬 `close_friend` / 읽음 `left_school` |
| `school-teacher-notice` | 눈여겨보신 선생님 | 12~18 | 공용 | 선택지 3 | 선생님이 눈여겨보고 따로 도와주겠다고 한 일 | 켬 `mentor_teacher` / 읽음 `left_school` |
| `school-scholarship` | 받을 수 있는 도움 | 15~19 | 공용 | 선택지 2 | 학비 지원 제도를 알고도 신청이 번거로웠던 일 | 켬 `scholar` / 읽음 `left_school` |
| `school-friend-quarrel` | 틀어진 사이 | 11~17 | 공용 | 선택지 3 | 가장 친한 친구와 사소한 일로 틀어진 일 | 켬 `close_friend` / 읽음 `left_school` |
| `school-academy-night` | 늦은 밤의 학원가 | 11~18 | 지금·다가올 전용 | 선택지 3 | 친구들이 저녁을 학원에서 보내기 시작하던 밤 | - |
| `school-family-priority` | 먼저 가야 할 사람 | 12~17 | 지난 전용 | 선택지 3 | 형제 많은 집에서 학비 순서가 정해지던 일 | 켬 `early_work` `fought_for_school` `left_school` / 읽음 `left_school` |
| `school-career-choice` | 갈림길 앞에서 | 14~17 | 공용 | 선택지 3 | 공부를 계속할지 기술을 배울지 정하던 갈림길 | 켬 `skilled_trade` / 읽음 `left_school` |
| `school-parttime` | 처음 번 돈 | 16~19 | 공용 | 선택지 3 | 용돈이 모자라 처음 일을 해 보던 일 | 읽음 `left_school` |
| `school-puppy` | 집 앞의 강아지 | 8~14 | 공용 | 선택지 3 | 집 앞의 떠돌이 강아지를 데려올지 망설인 일 | - |
| `school-mirror` | 또래의 눈길 | 12~16 | 공용 | 서술 | 또래 사이에서 겉모습 이야기가 오가던 시기 | - |
| `school-money-gap` | 말하지 않는 격차 | 12~18 | 공용 | 서술 | 친구들이 가진 물건이 우리 집에는 없던 일 | - |
| `school-chat-room` | 밤마다 울리던 화면 | 12~17 | 지금·다가올 전용 | 서술 | 단체 대화방의 말 한마디로 달라진 교실 | 읽음 `stood_up` |
| `school-long-walk` | 먼 등굣길 | 8~13 | 지난 전용 | 서술 | 한 시간을 걸어 다니던 등굣길 | 읽음 `left_school` |
| `school-academy-talk` | 학원 이야기로 시작하는 대화 | 10~16 | 지금 전용 | 서술 | 쉬는 시간의 대화가 어느 학원에 다니는지로 시작되던 교실 | - |
| `school-virtual-class` | 화면 속의 교실 | 8~15 | 다가올 전용 | 서술 | 수업 절반이 화면 속에서 이루어지던 학교 | - |
| `school-first-day` | 책가방을 멘 아침 | 7~7 | 공용 | 서술 | 책가방을 메고 교문 앞에서 뒤돌아보던 아이 | - |
| `school-supplies` | 입학 준비물 | 7~7 | 공용 | 선택지 3 | 입학을 앞두고 가방과 학용품을 마련하던 집 | - |
| `school-after-hours` | 학교가 끝난 뒤 | 7~7 | 지금·다가올 전용 | 선택지 3 | 일터에서 돌아올 어른이 없는 방과 후 | - |
| `school-first-walk` | 처음 걷는 등굣길 | 7~7 | 지난 전용 | 서술 | 이웃 아이들과 처음 학교까지 걸어가던 길 | - |

### 청년 (20~39세) — 31개

| id | 제목 | 나이 | 시대 | 유형 | 모티브 | 플래그 |
|---|---|---|---|---|---|---|
| `youth-military` | 정해진 날짜 | 20~24 | 지난·지금 전용 | 서술 | 입대 날짜에 짐을 싸서 집을 나서던 일 | - |
| `youth-work-pressure` | 끝나지 않는 일 | 22~39 | 공용 | 서술 | 퇴근 뒤에도 일이 이어지던 직장 생활 | 읽음 `has_career` |
| `youth-first-job` | 일자리를 고를 때 | 22~32 | 공용 | 선택지 3 | 일자리를 고르는 기준을 정하던 일 | 켬 `family_business` `has_career` / 읽음 `college` `early_work` `has_career` `own_business` `skilled_trade` |
| `youth-meeting` | 소개받은 자리 | 24~36 | 공용 | 선택지 2 | 아는 사람이 소개해 준 자리에 나갈지 고민한 일 | 켬 `has_partner` `met_intro` / 읽음 `first_love` `has_partner` `married` |
| `youth-marriage` | 함께 사는 일 | 27~45 | 공용 | 선택지 3 | 결혼 이야기가 나올 때 대답을 정하던 일 | 켬 `broke_up` `marriage_waited` `married` / 끔 `has_partner` / 읽음 `has_partner` `married` |
| `youth-marriage-again` | 다시 꺼낸 이야기 | 30~48 | 공용 | 선택지 3 | 미룬 결혼 이야기를 다시 꺼내게 된 일 | 켬 `broke_up` `marriage_waited_twice` `married` / 끔 `has_partner` `marriage_waited` / 읽음 `has_partner` `marriage_waited` `married` |
| `youth-partner-leaves` | 떠나간 사람 | 31~50 | 공용 | 서술 | 기다림에 지친 상대가 떠나간 일 | 켬 `broke_up` / 끔 `has_partner` `marriage_waited_twice` / 읽음 `has_partner` `marriage_waited_twice` `married` |
| `youth-reunion` | 다시 온 연락 | 25~50 | 공용 | 선택지 3 | 헤어진 사람에게서 오랜만에 연락이 온 일 | 켬 `has_partner` `reunited` / 끔 `broke_up` / 읽음 `broke_up` `has_partner` `married` |
| `youth-second-chance` | 다시 이어진 사이 | 26~56 | 공용 | 선택지 3 | 헤어졌다 다시 만난 사람과 함께 살지 정하던 일 | 켬 `married` / 끔 `has_partner` `reunited` / 읽음 `has_partner` `married` `reunited` |
| `youth-meeting-again` | 뒤늦은 소개 | 30~46 | 공용 | 선택지 2 | 다시 찾아온 소개 자리에 나갈지 정하던 일 | 켬 `has_partner` / 읽음 `has_partner` `married` `met_intro` |
| `youth-matchmaker` | 어른들이 마련한 자리 | 23~34 | 지난 전용 | 선택지 2 | 어른들이 맞선 자리를 마련해 주던 일 | 켬 `has_partner` `met_intro` / 읽음 `has_partner` `married` |
| `youth-approached` | 먼저 건네 온 말 | 22~36 | 공용 | 선택지 2 | 낯선 사람이 먼저 연락처를 물어 온 일 | 켬 `has_partner` / 읽음 `has_partner` `married` |
| `youth-child` | 아이를 맞을 것인가 | 27~39 | 공용 | 선택지 3 | 결혼 몇 해 뒤 아이를 가질지 이야기하던 일 | 켬 `child_postponed` `has_child` `no_child` / 읽음 `married` |
| `youth-child-again` | 늦어진 이야기 | 33~44 | 공용 | 선택지 2 | 미뤄 둔 아이 문제를 다시 이야기하게 된 일 | 켬 `child_late` `has_child` `no_child` / 끔 `child_postponed` / 읽음 `child_postponed` `has_child` `married` `no_child` |
| `youth-workplace-romance` | 같은 팀의 사람 | 24~38 | 공용 | 선택지 2 | 같은 팀 사람과 가까워지던 일 | 켬 `has_partner` / 읽음 `has_career` `has_partner` `married` `own_business` |
| `youth-housing` | 살 곳을 구하는 일 | 22~36 | 공용 | 선택지 4 | 가진 돈과 원하는 집 사이에서 살 곳을 정하던 일 | 켬 `lives_with_parents` `own_home` `renting` / 읽음 `lives_alone` `married` `own_home` |
| `youth-exam-prep` | 길어지는 준비 | 21~30 | 공용 | 선택지 3 | 안정된 자리를 위해 시험 준비를 이어 가던 일 | 켬 `exam_prep` `gave_up_exam` `has_career` / 읽음 `has_career` |
| `youth-exam-passed` | 합격 소식 | 23~38 | 공용 | 서술 | 오랜 시험 준비 끝에 합격 소식을 받은 일 | 켬 `has_career` `passed_exam` / 끔 `exam_prep` / 읽음 `exam_prep` |
| `youth-exam-failed` | 돌아서는 길 | 23~38 | 공용 | 서술 | 시험에 떨어지고 책을 정리하던 일 | 켬 `failed_exam` / 끔 `exam_prep` / 읽음 `exam_prep` |
| `youth-friend-wedding` | 오랜 친구의 결혼식 | 25~36 | 공용 | 선택지 3 | 먼 곳에서 열리는 친구 결혼식에 갈지 정하던 일 | 끔 `close_friend` / 읽음 `close_friend` |
| `youth-colleague` | 일터에서의 일 | 24~38 | 공용 | 선택지 3 | 직장의 부당한 지시 앞에서 태도를 정하던 일 | 켬 `job_changed` / 읽음 `has_career` `own_business` |
| `youth-startup` | 직접 해 보자는 제안 | 26~39 | 공용 | 선택지 3 | 작은 사업을 직접 해 보자는 제안을 받은 일 | 켬 `own_business` / 읽음 `has_career` `own_business` |
| `youth-night-study` | 일과 배움 사이 | 20~28 | 공용 | 선택지 3 | 낮에는 일하고 밤에 배우는 길을 고민한 일 | 켬 `late_learner` `saving_for_school` |
| `youth-return-school` | 다시 돌아갈 자리 | 23~36 | 공용 | 선택지 2 | 돈을 모아 미뤄 둔 공부로 돌아갈지 정하던 일 | 켬 `late_learner` / 끔 `saving_for_school` / 읽음 `saving_for_school` |
| `youth-rent-hike` | 오르는 월세 | 24~38 | 지금 전용 | 선택지 3 | 계약을 갱신할 때 월세가 크게 오른 일 | 읽음 `married` `own_home` `renting` |
| `youth-gig-work` | 쪼개진 일자리 | 21~32 | 지금·다가올 전용 | 선택지 3 | 짧은 일감을 이어 붙여 살던 불안정한 일자리 | 켬 `has_career` / 읽음 `has_career` `own_business` |
| `youth-machine-partner` | 일을 나누는 새 동료 | 24~38 | 다가올 전용 | 선택지 3 | 일터에 들어온 기계와 일을 나누게 된 일 | 읽음 `has_career` |
| `youth-lonely-city` | 혼자 먹는 저녁 | 20~28 | 공용 | 서술 | 낯선 동네에서 혼자 저녁을 먹던 외로움 | 켬 `lives_alone` / 읽음 `close_friend` `lives_with_parents` `married` |
| `youth-single-years` | 혼자의 시간 | 30~39 | 공용 | 서술 | 혼자 사는 시간이 익숙해진 서른 즈음 | 읽음 `has_partner` `married` |
| `youth-job-rejections` | 연락이 없는 날들 | 21~30 | 공용 | 서술 | 지원서를 내고도 연락이 없던 취업 준비 | 읽음 `has_career` `own_business` |
| `youth-factory-night` | 멈추지 않는 기계 | 20~28 | 지난 전용 | 서술 | 멈추지 않는 공장에서 밤샘 근무를 하던 일 | 읽음 `own_business` `passed_exam` |

### 중년 (40~64세) — 25개

| id | 제목 | 나이 | 시대 | 유형 | 모티브 | 플래그 |
|---|---|---|---|---|---|---|
| `middle-business` | 함께 가게를 열자는 제안 | 40~52 | 공용 | 선택지 3 | 지인이 함께 가게를 열자고 제안한 일 | 켬 `own_business` / 읽음 `family_business` `has_career` `married` `own_business` |
| `middle-parents-care` | 부모님의 병환 | 45~62 | 공용 | 선택지 3 | 부모의 병환을 형제들과 나누어 돌보던 일 | 켬 `cared_parents` / 읽음 `parents_gone` |
| `middle-health-check` | 검진 결과표 | 40~55 | 공용 | 선택지 2 | 건강검진에서 처음 수치가 나빠진 일 | 켬 `checked_up` `health_ignored` `healthy_habit` |
| `middle-health-check-later` | 다시 받은 결과 | 53~64 | 공용 | 선택지 3 | 몇 해 뒤 다시 받은 검진 결과가 나빠진 일 | 켬 `healthy_habit` / 읽음 `checked_up` `health_ignored` `healthy_habit` |
| `middle-health-crisis` | 쓰러진 날 | 48~64 | 공용 | 선택지 2 | 검진 결과를 미루다 갑자기 쓰러진 일 | 켬 `healthy_habit` / 끔 `health_ignored` / 읽음 `health_ignored` |
| `middle-new-skills` | 바뀌는 일의 방식 | 40~55 | 다가올 전용 | 선택지 2 | 일의 대부분을 기계가 맡게 되어 새로 배우는 일 | 읽음 `has_career` |
| `middle-remote-work` | 집이 일터가 된 날들 | 42~58 | 지금·다가올 전용 | 선택지 3 | 집이 일터가 되면서 생긴 새로운 피로 | 읽음 `has_career` |
| `middle-child-school` | 아이의 앞날 | 52~62 | 공용 | 선택지 3 | 아이의 앞날과 내 바람이 엇갈리던 일 | 켬 `child_distant` / 읽음 `child_late` `child_left` `has_child` |
| `middle-child-leaves` | 비어 가는 방 | 58~64 | 공용 | 서술 | 아이가 독립해 집을 떠난 뒤의 빈방 | 켬 `child_left` / 읽음 `child_late` `child_left` `has_child` |
| `middle-child-grows` | 자라난 아이 | 42~54 | 공용 | 서술 | 어느새 훌쩍 자란 아이를 보던 순간 | 읽음 `child_late` `child_left` `has_child` |
| `middle-late-child` | 늦게 맞은 아이와 | 48~58 | 공용 | 서술 | 늦게 맞은 아이와 체력이 달려도 새롭던 시절 | 읽음 `child_late` `child_left` `has_child` |
| `middle-home-loan` | 넓혀 갈 집 | 40~55 | 공용 | 선택지 3 | 대출을 내고 더 넓은 집으로 옮길지 정하던 일 | 켬 `own_home` / 읽음 `own_home` |
| `middle-career-peak` | 맡겨진 자리 | 40~52 | 공용 | 선택지 3 | 오랜 근무 끝에 조직을 이끄는 자리를 제안받은 일 | 켬 `job_changed` `promoted` / 읽음 `has_career` `own_business` |
| `middle-layoff` | 정리 대상이 된 아침 | 45~58 | 공용 | 선택지 3 | 회사가 사람을 줄이며 내 이름이 나온 일 | 켬 `laid_off` `own_business` / 끔 `has_career` / 읽음 `family_business` `has_career` `own_business` `passed_exam` |
| `middle-job-again` | 다시 구하는 일자리 | 46~62 | 공용 | 선택지 3 | 일을 그만둔 뒤 나이에 맞는 자리를 다시 찾던 일 | 켬 `has_career` / 끔 `laid_off` / 읽음 `has_career` `laid_off` `own_business` |
| `middle-friend-reunion` | 오랜 친구의 연락 | 42~58 | 공용 | 선택지 3 | 소식이 끊겼던 오랜 친구의 연락 | 켬 `friend_back` / 끔 `close_friend` / 읽음 `close_friend` |
| `middle-marriage-crisis` | 서먹해진 식탁 | 42~58 | 공용 | 선택지 3 | 대화가 줄어 서먹해진 부부의 식탁 | 켬 `child_distant` `divorced` / 끔 `has_partner` `married` / 읽음 `has_child` `married` |
| `middle-hobby` | 늦게 시작한 일 | 42~60 | 공용 | 선택지 3 | 하루가 한숨 돌릴 만해진 뒤 늦게 취미를 시작할지 고민한 일 | 켬 `hobby` |
| `middle-parents-farewell` | 마지막 인사 | 52~64 | 공용 | 선택지 3 | 부모의 임종 소식을 받고 달려가던 일 | 켬 `parents_gone` / 읽음 `cared_parents` `sibling_close` |
| `middle-debt-guarantee` | 보증을 서 달라는 부탁 | 42~55 | 공용 | 선택지 3 | 가까운 지인이 보증을 서 달라고 한 일 | - |
| `middle-retirement-prep` | 내려놓을 때를 생각하며 | 55~64 | 공용 | 선택지 3 | 나이 들어 가며 앞으로의 시간을 어떻게 준비할지 고민한 일 | - |
| `middle-both-working` | 둘이 함께 벌던 시절 | 40~54 | 지금 전용 | 서술 | 맞벌이로 아이를 키워 낸 바쁜 시절 | 읽음 `child_late` `has_career` `has_child` `married` |
| `middle-back-pain` | 시큰거리는 허리 | 42~60 | 공용 | 서술 | 허리를 숙일 때 처음 시큰거린 일 | 읽음 `healthy_habit` |
| `middle-lonely-holiday` | 혼자 맞는 명절 | 42~60 | 공용 | 서술 | 모두 떠난 명절 거리에서 혼자 보낸 일 | 읽음 `friend_back` `married` |
| `middle-own-shop-year` | 내 일터의 한 해 | 42~62 | 공용 | 서술 | 문을 열고 닫는 일이 몸에 밴 한 해 | 읽음 `own_business` |

### 노년 (65세~) — 23개

| id | 제목 | 나이 | 시대 | 유형 | 모티브 | 플래그 |
|---|---|---|---|---|---|---|
| `senior-retire` | 일에서 물러나다 | 65~70 | 공용 | 서술 | 일을 내려놓던 날 돌아오는 길이 길게 느껴지던 일 | 읽음 `own_business` |
| `senior-gathering` | 넉넉해진 시간 | 66~82 | 공용 | 선택지 3 | 넉넉해진 시간을 무엇으로 채울지 정하던 일 | 읽음 `cared_parents` `child_distant` `child_late` `grandparent_close` `has_child` `hobby` `in_care` |
| `senior-illness` | 오래가는 통증 | 68~90 | 공용 | 선택지 2 | 오래가는 통증으로 검사를 받게 된 일 | - |
| `senior-illness-later` | 점점 깊어지는 병 | 78~100 | 공용 | 선택지 3 | 병이 깊어져 남은 시간의 방식을 가족과 정하던 일 | 읽음 `moved_home` |
| `senior-grandchildren` | 손주를 맡아 달라는 부탁 | 68~82 | 공용 | 선택지 3 | 자식이 손주를 맡아 달라고 부탁해 온 일 | 읽음 `child_distant` `has_child` `in_care` |
| `senior-estate` | 남길 것과 쓸 것 | 68~85 | 공용 | 선택지 3 | 가진 것을 남길지 내가 쓸지 정하던 일 | 읽음 `has_child` |
| `senior-move-home` | 어디서 살 것인가 | 70~90 | 공용 | 선택지 3 | 살던 집이 버거워져 남은 시간을 보낼 곳을 고민하던 일 | 켬 `in_care` `moved_home` / 읽음 `child_distant` `has_child` |
| `senior-travel` | 미뤄 둔 여행 | 66~78 | 공용 | 선택지 3 | 젊을 때부터 미뤄 둔 여행을 떠날지 고민한 일 | - |
| `senior-estranged-child` | 소원해진 자식 | 66~85 | 공용 | 선택지 3 | 연락이 끊긴 자식에게 먼저 전화할지 망설인 일 | 끔 `child_distant` / 읽음 `child_distant` `has_child` |
| `senior-spouse-care` | 곁을 지키는 일 | 70~90 | 공용 | 선택지 3 | 함께 늙어 온 배우자의 간병을 나누던 일 | 읽음 `married` |
| `senior-alone` | 혼자 사는 집 | 70~90 | 공용 | 선택지 3 | 혼자 사는 집의 하루 종일 이어지는 고요 | 읽음 `married` `moved_home` |
| `senior-new-device` | 낯선 기계 | 66~82 | 공용 | 선택지 3 | 세상 일이 작은 기계로 옮겨 가 배우게 된 일 | - |
| `senior-long-life` | 예상보다 긴 시간 | 72~95 | 다가올 전용 | 선택지 3 | 기대보다 길어진 노년의 시간을 어떻게 쓸지 정하던 일 | - |
| `senior-last-wishes` | 마지막 정리 | 80~100 | 공용 | 선택지 3 | 이제 정리할 때라며 남길 말을 생각하던 일 | - |
| `senior-old-friend` | 오래된 친구의 소식 | 66~85 | 공용 | 선택지 3 | 오랜 친구의 건강이 나빠졌다는 소식 | 읽음 `close_friend` |
| `senior-fall` | 미끄러진 겨울날 | 72~92 | 공용 | 선택지 3 | 얼어붙은 길에서 넘어진 겨울날 | - |
| `senior-classmates` | 오랜만의 동창 모임 | 66~82 | 공용 | 선택지 3 | 오랜만에 열린 동창 모임에 나갈지 정하던 일 | - |
| `senior-diet` | 식탁 위의 약 | 66~88 | 공용 | 선택지 3 | 약과 식단을 지키라는 당부와 입맛 사이 | - |
| `senior-memoir` | 남기고 싶은 이야기 | 68~90 | 공용 | 선택지 3 | 살아온 이야기를 어떻게 남길지 고민한 일 | - |
| `senior-stairs` | 높아진 계단 | 68~90 | 공용 | 서술 | 예전엔 한달음에 오르던 계단이 높아진 일 | 읽음 `healthy_habit` |
| `senior-photo` | 오래된 사진 | 66~92 | 공용 | 서술 | 서랍에서 나온 오래된 사진 속 얼굴들 | 읽음 `close_friend` |
| `senior-grandchild-visit` | 찾아온 아이들 | 68~88 | 공용 | 서술 | 자식이 손주를 데리고 다녀간 뒤의 고요 | 읽음 `child_distant` `has_child` |
| `senior-quiet-pride` | 지나온 일 | 70~95 | 공용 | 서술 | 지나온 시간을 돌아보며 고개를 끄덕이던 날 | - |

## 4. 플래그 연결 (선택 → 이후 이벤트)

플래그를 켜는 이벤트와, 그 플래그를 조건·선택지 노출·보너스·확률 배수로 읽는 이벤트. 읽는 곳이 없는 플래그는 엔딩(M5)에서 쓸 수 있다.

| 플래그 | 켜는 이벤트 | 읽는 이벤트 |
|---|---|---|
| `broke_up` | `youth-marriage` `youth-marriage-again` `youth-partner-leaves` | `youth-reunion` |
| `cared_parents` | `middle-parents-care` | `middle-parents-farewell` `senior-gathering` |
| `checked_up` | `middle-health-check` | `middle-health-check-later` |
| `child_distant` | `middle-child-school` `middle-marriage-crisis` | `senior-estranged-child` `senior-gathering` `senior-grandchild-visit` `senior-grandchildren` `senior-move-home` |
| `child_late` | `youth-child-again` | `middle-both-working` `middle-child-grows` `middle-child-leaves` `middle-child-school` `middle-late-child` `senior-gathering` |
| `child_left` | `middle-child-leaves` | `middle-child-grows` `middle-child-leaves` `middle-child-school` `middle-late-child` |
| `child_postponed` | `youth-child` | `youth-child-again` |
| `childcare_set` | `infant-care` `infant-daycare-wait` `infant-parental-leave` | `infant-care` `infant-daycare-wait` |
| `close_friend` | `school-club` `school-friend` `school-friend-quarrel` | `middle-friend-reunion` `senior-old-friend` `senior-photo` `youth-friend-wedding` `youth-lonely-city` |
| `college` | `school-exam` | `youth-first-job` |
| `divorced` | `middle-marriage-crisis` | - |
| `early_work` | `school-exam` `school-family-priority` | `youth-first-job` |
| `exam_prep` | `youth-exam-prep` | `youth-exam-failed` `youth-exam-passed` |
| `failed_exam` | `youth-exam-failed` | - |
| `family_business` | `youth-first-job` | `middle-business` `middle-layoff` |
| `first_love` | `school-first-love` | `youth-meeting` |
| `fought_for_school` | `school-family-priority` | - |
| `friend_back` | `middle-friend-reunion` | `middle-lonely-holiday` |
| `gave_up_exam` | `youth-exam-prep` | - |
| `grandparent_close` | `infant-care` `infant-daycare-wait` | `infant-grandparent-song` `infant-new-sibling` `senior-gathering` |
| `has_career` | `middle-job-again` `youth-exam-passed` `youth-exam-prep` `youth-first-job` `youth-gig-work` | `middle-both-working` `middle-business` `middle-career-peak` `middle-job-again` `middle-layoff` `middle-new-skills` `middle-remote-work` `youth-colleague` `youth-exam-prep` `youth-first-job` `youth-gig-work` `youth-job-rejections` `youth-machine-partner` `youth-startup` `youth-work-pressure` `youth-workplace-romance` |
| `has_child` | `youth-child` `youth-child-again` | `middle-both-working` `middle-child-grows` `middle-child-leaves` `middle-child-school` `middle-late-child` `middle-marriage-crisis` `senior-estate` `senior-estranged-child` `senior-gathering` `senior-grandchild-visit` `senior-grandchildren` `senior-move-home` `youth-child-again` |
| `has_partner` | `youth-approached` `youth-matchmaker` `youth-meeting` `youth-meeting-again` `youth-reunion` `youth-workplace-romance` | `youth-approached` `youth-marriage` `youth-marriage-again` `youth-matchmaker` `youth-meeting` `youth-meeting-again` `youth-partner-leaves` `youth-reunion` `youth-second-chance` `youth-single-years` `youth-workplace-romance` |
| `health_ignored` | `middle-health-check` | `middle-health-check-later` `middle-health-crisis` |
| `healthy_habit` | `middle-health-check` `middle-health-check-later` `middle-health-crisis` | `middle-back-pain` `middle-health-check-later` `senior-stairs` |
| `hobby` | `middle-hobby` | `senior-gathering` |
| `in_care` | `senior-move-home` | `senior-gathering` `senior-grandchildren` |
| `job_changed` | `middle-career-peak` `youth-colleague` | - |
| `laid_off` | `middle-layoff` | `middle-job-again` |
| `late_learner` | `youth-night-study` `youth-return-school` | - |
| `left_school` | `school-family-priority` | `school-bully` `school-career-choice` `school-club` `school-early-work` `school-exam` `school-family-priority` `school-first-love` `school-friend` `school-friend-quarrel` `school-long-walk` `school-lunch` `school-parttime` `school-scholarship` `school-teacher-notice` `school-tutoring` |
| `lives_alone` | `youth-lonely-city` | `youth-housing` |
| `lives_with_parents` | `youth-housing` | `youth-lonely-city` |
| `marriage_waited` | `youth-marriage` | `youth-marriage-again` |
| `marriage_waited_twice` | `youth-marriage-again` | `youth-partner-leaves` |
| `married` | `youth-marriage` `youth-marriage-again` `youth-second-chance` | `middle-both-working` `middle-business` `middle-lonely-holiday` `middle-marriage-crisis` `senior-alone` `senior-spouse-care` `youth-approached` `youth-child` `youth-child-again` `youth-housing` `youth-lonely-city` `youth-marriage` `youth-marriage-again` `youth-matchmaker` `youth-meeting` `youth-meeting-again` `youth-partner-leaves` `youth-rent-hike` `youth-reunion` `youth-second-chance` `youth-single-years` `youth-workplace-romance` |
| `mentor_teacher` | `school-teacher-notice` | `school-exam` |
| `met_intro` | `youth-matchmaker` `youth-meeting` | `youth-meeting-again` |
| `moved_home` | `senior-move-home` | `senior-alone` `senior-illness-later` |
| `no_child` | `youth-child` `youth-child-again` | `youth-child-again` |
| `own_business` | `middle-business` `middle-layoff` `youth-startup` | `middle-business` `middle-career-peak` `middle-job-again` `middle-layoff` `middle-own-shop-year` `senior-retire` `youth-colleague` `youth-factory-night` `youth-first-job` `youth-gig-work` `youth-job-rejections` `youth-startup` `youth-workplace-romance` |
| `own_home` | `middle-home-loan` `youth-housing` | `middle-home-loan` `youth-housing` `youth-rent-hike` |
| `parents_gone` | `middle-parents-farewell` | `middle-parents-care` |
| `passed_exam` | `youth-exam-passed` | `middle-layoff` `youth-factory-night` |
| `promoted` | `middle-career-peak` | - |
| `renting` | `youth-housing` | `youth-rent-hike` |
| `reunited` | `youth-reunion` | `youth-second-chance` |
| `saving_for_school` | `youth-night-study` | `youth-return-school` |
| `scholar` | `school-scholarship` | `school-exam` |
| `sibling_close` | `infant-new-sibling` | `middle-parents-farewell` |
| `skilled_trade` | `school-career-choice` | `school-exam` `youth-first-job` |
| `stood_up` | `school-bully` | `school-chat-room` |
| `younger_sibling` | `infant-new-sibling` | `infant-sibling-toy` |

