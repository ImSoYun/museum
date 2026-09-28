// 이 파일의 책임: 산출물생성 화면의 본체 — 퍼블 output_node.html L55-265의 node_view(노드
// 클러스터링) · node_select_panel(선택 자료) 2패널 + 산출물 목록(OutputList)을 그린다.
// 래퍼(result_wrap)와 output_banner(chat_welcome)는 상위 pages/OutputView.jsx가 소유한다.
//
// R6c-ext D1-7 재퍼블 — 마크업/클래스를 v2로 옮기며 액션 전량을 준비중으로 치환했다
// (task-D1-7-brief §범위 3). 제거한 시뮬레이션 잔재: useSimulatedDelay(run(1500,…) 생성
// 지연) · SaveProjectModal(저장 모달) · export Modal(내보내기 완료 모달) · showResult/
// showTimeline 상태.
//
// 준비중으로 바뀐 액션(모두 정확히 showToast('준비 중입니다')):
//   생성시작(설명문 카드, round07e가 되돌렸다 — 아래 §round07e 참조) · 선택 자료 태그
//   클릭("그래프에서 위치 확인") · 태그 제거.
// (당시 NodeModal의 "선택 완료" mutation도 준비중으로 바뀌었었다 — round07b가 onConfirm
// 배선으로 되돌렸다. 아래 §55행 부근 참조.)
// 제거됨: 프로젝트로 저장 — 피그마에 없는 요소라 round07b-ext에서 제거했다.
//
// ── round07b-ext task-11 — node_result_panel(생성 결과 패널)을 걷어내고 산출물 목록으로 ──
// D1-7이 "퍼블이 정적 데모라 항상 보인다"며 유지했던 3번째 패널(생성 결과 — 설명문/
// 홍보자료 탭 + 시나리오 output 표시)은 애초에 피그마 디스크립션에 없는 요소였다(§범위
// 문서: 산출물 생성은 목록에서 확인·다운로드하지, 화면에 상주하는 미리보기 패널이 아니다).
// 산출물이 실제로 생성·저장되기 시작한 이상(round07b) 그 자리를 진짜 데이터 — 서버의
// 산출물 목록(OutputList.jsx, 카드 그리드 + 탭 + 검색 + 선택/삭제 + 페이지네이션) —
// 로 대신한다. 함께 제거: activeOutTab/captionSub 중 activeOutTab(결과 탭 전용 상태) ·
// out 파생값 · 재생성하기/타임라인 생성/전체 내보내기/복사 4버튼과 그 아이콘 import.
// 목록 갱신은 outputsVersion 카운터로 한다 — 생성 완료 모달의 "확인"을 누르는 순간(즉
// 사용자가 결과를 확인한 시점) 하나 올려 OutputList의 useEffect가 다시 읽게 한다.
//
// dropdown_box 미채택(§범위 6) — D1-5b가 검색결과 필터에서 "상태 있는 콤보박스는 마크업
// 범위 밖"이라며 스킵한 선례를 따른다. 설명문/홍보자료 세부유형은 기존 네이티브 select를
// 그대로 쓴다(표시용 — 생성이 준비중이 된 이상 결과 콘텐츠에 실제 연동하지 않는다. 그래서
// 이전의 "설명문 · 전시 해설" 활성유형 배지도 함께 제거했다 — 연동 없는 배지는 오해를 부른다).
//
// ── round07i 방어 결함 수정 — 클래스를 넘나드는 선택이 실제로 유지된다 ──────────
// 사용자 보고: 정치행정에서 통일(안보)·식민통치를 고른 뒤 경제산업을 누르니 선택
// 자료 패널이 통째로 "노드를 클릭해 자료를 고르면 여기에 표시됩니다"로 되돌아갔다.
// 여러 주제를 엮는 것이 특별전시(위 exhibitionOpen 주석 참조)의 핵심 흐름인데, 그
// 흐름 자체가 막혀 있었다.
//
// 원인 — selection이 노드 id(n1, n2…)로 키가 잡혀 있었다. node_graph.py는 그 id를
// **선택된 클래스 안에서만** n1부터 다시 매긴다(정치행정 n1=정치, 경제산업
// n1=산업 — node_graph.py:188-205). 예전 코드는 "클래스가 바뀌면 id 의미가
// 통째로 달라진다"는 사실은 옳게 읽었지만, 그 처방으로 **선택 전체를 지웠다** —
// 진짜 문제(id 재사용으로 인한 충돌)와 그 해결책(선택을 지운다)이 "새 검색이면
// 지운다"는 판정 하나(아래 graphKey)에 함께 뒤섞여 있었기 때문이다.
//
// 고침 — selection의 키를 노드 id 대신 **(클래스, 노드 라벨)** 쌍으로 바꾼다
// (아래 selectionKey). 라벨은 클래스 안에서 유일하고(node_graph.py가 (big,small)
// 쌍으로 묶으므로 같은 big 안에 같은 small이 둘일 수 없다) 클래스를 오가도 그
// 자체로는 변하지 않는 노드의 진짜 정체성이다 — 그래서 두 클래스의 n1이 같은
// 키를 두고 부딪히지 않는다. 그 결과 "새 검색이면 지운다" 판정에서 클래스는
// 빠지고 질의(lastQuery)만 남는다(아래 graphKey 주석 참조) — 클래스 전환은 더
// 이상 그 판정에 끼지 않는다.
//
// 노드 상세 모달(NodeModal)은 이 문단 작성 당시(D1-7) 범위 밖이었으나, round07b-ext
// task-5·6이 그 결정을 뒤집었다 — node_detail_modal* 92규칙을 반입하고(task-5)
// NodeModal.jsx를 전면 재작성해(task-6) 실데이터(메타·OCR·공개뱃지·외부링크)로 채웠다.
// 자세한 내용은 NodeModal.jsx 자체 주석과 spec §3.2 참조.
//
// ── round07i 리뷰 Finding 1 — 다른 클래스의 칩도 더블클릭으로 열린다 ──────────────
// 위 방어 결함 수정이 만든 새 구멍: selection이 (클래스, 라벨) 키로 클래스를 넘나들며
// 남게 되면서, 지금 활성 클래스가 아닌 칩이 처음으로 "존재할 수 있게" 됐다(수정
// 전에는 클래스를 바꾸는 순간 선택 전체가 지워졌으니 그런 칩 자체가 있을 수
// 없었다). 그 칩을 더블클릭하면 CaptionModal → onOpenChip → 여기 openChipDetail로
// 오는데, 예전 판단(같은 클래스일 때만 열고 아니면 조용히 아무 것도 하지 않는다)은
// 피그마가 칩마다 예외 없이 요구하는 「더블 클릭 시 상세모달 오픈, 수정 가능」을
// 어기면서도 사용자에게 아무 신호를 주지 않는 조용한 실패였다(코딩표준 §6).
//
// 고침 — 실제로 그 칩의 클래스로 전환한 뒤 상세를 연다. 새 fetch 경로를 만들지
// 않고 chooseClass가 이미 쓰는 fetchGraph(lastQuery, searchMode, name) 그대로
// 재사용한다(아래 chooseClass 참조). fetchGraph는 비동기이므로 전환을 "요청"하는
// 시점엔 그 클래스의 nodes가 아직 없다 — 그래서 무엇을 기다리는지(pendingChipKey,
// 대기 중인 칩의 selectionKey)만 남겨 두고, 그 클래스의 그래프가 실제로
// 도착하면(아래 useEffect가 graph·graphStatus·activeClassName 변화에 반응해서
// 판정한다) 그때 라벨로 찾아 연다. 데모 모드도 같은 배선을 그대로 탄다 —
// activeScenario.nodes는 클러스터와 무관하게 고정이라(data/nodes.js) 전환 자체는
// 그저 setActiveCluster를 부르는 동기 호출이지만, 라이브·데모가 배선을 공유해야
// 갈라지지 않는다.
//
// 실패도 조용히 삼키지 않는다: 그 fetch가 실패하면(graphStatus==='error') 토스트로
// 사유를 알리고, 성공했는데도 그 라벨이 더 이상 없으면(재분류·자료 변경 등으로
// 낡아진 칩) "찾을 수 없다"고 말한다 — 어느 쪽도 빈 모달을 열지 않는다. 반면 그
// 사이 사용자가 좌측 목록에서 직접 다른 클래스를 눌러 버리면(=새 의도가 옛
// 더블클릭의 의도를 대신한다) chooseClass가 즉시 pendingChipKey를 지운다 — 그러지
// 않으면 한참 뒤 우연히 그 클래스로 돌아왔을 때 요청하지 않은 상세가 불쑥 열린다.
//
// ── round07i 재리뷰(round07b 절) — 대기 중 다른 노드를 열어도 취소된다 ───────────
// 위 chooseClass·useEffect 두 곳만 pendingChipKey를 지웠다 — **노드 모달이 무엇을
// 보여줄지 바꾸는 다른 모든 경로**(그래프 직접 클릭 onNodeClick/onSelect, 같은
// 클래스 칩 더블클릭이 타는 openChipDetail의 즉시-오픈 분기)는 그대로 두었다.
// 재현: 크로스클래스 칩 A를 더블클릭(대기 시작) → fetch가 도착하기 전에 사용자가
// 지금 화면의 다른 노드 C를 열어 체크박스를 고르기 시작 → A의 fetch가 뒤늦게
// 도착 → useEffect가 그 사실을 모른 채 모달을 A로 덮어써 C에서 고르던 것을
// 아무 신호 없이 지운다(코딩표준 §6). 세 번째 경로(NodeModal onClose·
// confirmNodeSelection의 모달 닫기)는 재리뷰가 저심각으로 분류했다 — 닫힌 모달
// 위에 나중 도착한 A가 뜨는 "깜짝 등장"일 뿐 데이터 손실은 아니다.
//
// 고침 — "노드 상세 모달이 지금 무엇을 보여주는가"를 바꾸는 유일한 통로로
// showNode(node)를 두고, 그 함수 자체가 항상 pendingChipKey를 함께 지운다.
// setPendingChipKey(null)를 호출부마다 흩어 적는 대신 이 함수 하나만 지키면
// 되게 만든 이유 — 흩어 적으면 다음에 노드를 여는 새 경로가 또 생겼을 때
// 그 자리에 지우는 코드를 빠뜨리기 쉽다(바로 이번에 발견된 구멍이 그 예다).
// openNodeByLabel(라벨로 찾아 여는 공용 경로 — 같은 클래스 칩 직접 오픈과
// 크로스클래스 대기 해소 useEffect가 함께 쓴다)도 내부에서 성공 시 showNode를
// 부르고, "찾을 수 없음" 실패 시에도 최소한 pendingChipKey는 지운다(열려 있는
// 무관한 모달을 실패한 시도로 잘못 닫지 않기 위해 setSelectedNode는 건드리지
// 않는다) — 그래야 openChipDetail의 같은 클래스 분기(438-440행, 재리뷰가
// "untouched"라 지목한 그 줄)를 따로 고치지 않아도 이 fix가 자동으로 적용된다.
// NodeModal의 onClose·confirmNodeSelection도 showNode(null)로 옮겨, 저심각
// 엣지(모달을 닫아도 대기가 안 지워지던 것)까지 별도 장치 없이 함께 해결된다.
//
// ── round07i 감사 C — 열린 모달 **밑으로** 그래프가 도착한다 ────────────────────
// 위 두 수정은 "누가 모달을 여는가"만 다뤘다. 남은 반대편: 모달이 **이미 열려
// 있는 채로** 클래스 전환이 착지하는 경우다.
//
// 재현(감사 실측): 정치행정/민주화운동·경제산업/산업 두 칩이 있고 활성 클래스가
// 경제산업 → 설명문 생성 모달을 연다 → 크로스클래스 칩 「민주화운동」을
// 더블클릭(정치행정 fetch 출발) → 도착 전에 같은 클래스 칩 「산업」을 더블클릭
// (경제산업 n1이 열리고 대기는 취소된다 — 거기까지는 위 재리뷰 수정대로다) →
// 3건을 전부 체크 → 정치행정 그래프가 도착.
//
// 원인 — selectedNode는 **옛 그래프의 노드 객체**인데, 그 안의 자료 목록
// (nodeMaterials)은 selectedNode.id로 **지금** 그래프의 nodeItems를 되짚어 만든다.
// node_graph.py가 노드 id를 클래스마다 n1부터 다시 매기므로 두 클래스의 n1은
// 같은 id·다른 노드다 — 제목은 「산업」인 채 목록만 정치행정 n1의 자료로 통째로
// 갈린다. NodeModal의 체크 초기화도 node?.id에 걸려 있어(양쪽 다 'n1') 체크가
// 그대로 남는다. 그 상태의 「선택완료」는 selectionKey(**지금** 활성 클래스, 옛
// 라벨) = ('정치행정','산업') — 존재하지 않는 (클래스, 라벨) 쌍을 새 칩으로 만들고,
// 그 칩에는 「옛 체크 ∩ 새 목록」이 담긴다. 감사 실측 payload:
//   [{node:'민주화운동',idnbrs:['a','b']},
//    {node:'산업',idnbrs:['a','e','f']},
//    {node:'산업',idnbrs:['a']}]   ← 열어 본 적 없는 노드에 실린 자료 'a'
// 이름이 같은 칩이 둘이라 진짜와 유령을 구분할 수 없고, 유령은 존재하지 않는
// 노드를 가리켜 다시 열 수도 없다(더블클릭 → 「그래프에서 찾을 수 없습니다」).
// 두 n1의 자료가 겹치지 않으면 같은 결함이 교집합 0건 = 조용한 무동작으로
// 나타난다(뱃지는 3인데 아무것도 고르지 않고 닫힌다).
//
// 고침 — **그래프가 갈리면 그 위에 떠 있던 노드 상세는 닫고 사실을 말한다**
// (아래 nodeSource 판정). 대안 둘을 검토하고 버린 이유:
//   · 라벨로 다시 찾아 연다(체크 유지) — 라벨은 **클래스 안에서만** 유일하다
//     (node_graph.py가 (big,small)로 묶는다). 클래스를 넘으면 같은 라벨이 같은
//     노드를 가리키지 않고, 대개 아예 없다. "유지되는 것처럼 보이는데 실은 다른
//     노드의 선택"이 지금 결함보다 나쁘다.
//   · 열 때의 자료 목록·클래스를 통째로 얼려 둔다 — 체크까지 지킬 수 있지만,
//     새 검색으로 그래프가 갈린 경우 이미 버려진 질의의 선택을 되살려 쓰는 길이
//     열린다(위 graphKey가 selection을 비운 직후다). 지금 결함과 같은 종류의
//     "화면에 없는 것을 서버로 보내는" 구멍을 다시 파는 셈이다.
// 체크를 잃는 것은 분명한 손해지만 **정직한** 손해다 — 만든 적 없는 선택이
// 저장되는 쪽이 학예사에게 훨씬 비싸다(브리프의 불변조건).
//
// 함께 — NodeModal의 체크 초기화 기준을 node?.id에서 **node 객체 자체**로 옮겼다
// (NodeModal.jsx 그 이펙트 주석 참조). 이 수정으로 모달이 살아 있는 채 다른
// 노드로 갈리는 경로는 사라지지만, id는 "다른 노드도 같은 값을 가질 수 있는 값"
// 이라 애초에 정체성이 아니다 — 다음에 노드를 바꾸는 경로가 또 생겨도 안전하게.
//
// ── D1-7 리뷰 반영(정직성) ───────────────────────────────────────────────────
// (B1은 task-11에서 삭제됐다 — 생성 결과 패널 자체가 사라졌으니 그 안내도 함께 사라진다.
//  아래 B2만 유효.)
// B2 · 선택 자료 패널도 같은 방식으로 정직하게 만든다 — 퍼블 DOM(node_select_* 구조·클래스·
//   "선택 자료" 제목)은 그대로 두고, 칩 아래에 앱 고유 안내 1줄을 넣어 "선택 기능은 준비
//   중이며 칩은 선택 결과가 아니라 주요 주제 + 그 주제의 보유 건수"임을 밝힌다. 프로토타입은
//   제목을 '주요 주제'로 바꿔 이를 표현했으나, 여기서는 퍼블 카피(§정본 우선)를 건드리지 않고
//   안내를 덧붙이는 쪽을 택했다 — B1과 같은 기법이라 두 패널의 처리가 일관된다.
// 두 안내 모두 퍼블에 없는 요소이므로 Tailwind로 쓴다(ChatTab.jsx의 "질의 재작성 실패 고지"
// 배너와 같은 선례·같은 톤). Tailwind spacing은 px 스케일이다 — px-16=16px · py-8=8px.
// B5 · node_select_type_desc 두 줄은 순수 퍼블 카피이므로 퍼블 문구로 교정했다
//   (output_node.html L161 "캡션·패널·도록 초안 자동 생성" · L189 "채널별 홍보 초안 자동 생성").
//   ~~반면 select 옵션 목록(캡션/전시 해설/교육 자료 · SNS 카드뉴스/리플릿/보도자료)은 앱
//   소유 데이터라 유지한다~~ → **round07f가 뒤집었다(대조표 §1-A, 피그마 695:107618
//   실측)** — 「전시 해설」·「교육 자료」는 앱 고유 어휘가 아니라 애초에 피그마에 없던
//   round07b-ext의 목업 값이었다. 지금은 걷어내고 피그마가 그리는 대로 「조건 및 대상
//   선택」 placeholder + 실제 항목 1개(캡션)만 남긴다 — 아래 select 자체 주석·
//   OutputTab.test.jsx("설명문 select에 목업 옵션이 없다")가 그 상태를 잠근다.
//
// ── round07b — 자료선택이 실제 검색 결과에 연결된다 ─────────────────────────
// D1-7이 "준비중"으로 묶어 둔 것 중 **자료선택 축만** 해제한다. 좌측은 묶음기준이
// 아니라 **주제 대분류**를, 그래프는 그 클래스의 **중분류**를 그린다. 값은 전부
// 서버(POST /output/graph)가 준다 — 검색 200건을 서버가 갈라 주므로 프론트는
// 파싱하지 않는다(R6F-15: 어휘가 두 곳에 생기면 갈라진다).
//
// 라이브가 아니거나 아직 검색 전이면 **기존 시나리오 데이터로 떨어진다** — 데모
// 모드(VITE_API_BASE_URL 미설정)가 그대로 동작해야 하고, 그 경로의 기존 테스트도
// 계속 유효하다.
//
// 선택은 이제 진짜다: NodeModal의 "선택 완료"가 onConfirm으로 부모에 올라오고
// (D1-7이 준비중 토스트로 막아 둔 자리), 칩은 **선택 건수**를 보여준다. 한 자료가
// 노드 여러 개에 걸릴 수 있으므로 생성 시 Set으로 합친다(ADR-002 F-02).
//
// 「전시자료」가 홍보자료 자리를 대신한다 — round07b의 산출물이 그것이다.
// 「설명문」은 프롬프트가 미결이라 round07e까지 준비중을 유지했다(아래 §round07e 참조).
//
// 아직 준비중인 것: node_graph_node.is_selected 시각(선택된 노드 강조 CSS는 미반입 상태 유지).
// (재생성·타임라인·전체 내보내기·복사는 "준비중"이 아니라 task-11에서 아예 제거됐다 —
// 그 버튼들이 속했던 생성 결과 패널 자체가 사라졌다.)
// (프로젝트로 저장은 제거됨 — 피그마에 없는 요소라 round07b-ext에서 제거.)
//
// ── round07b-ext task-8 — 생성 모달을 피그마 구성으로 · 완료 모달로 끝낸다 ──────
// ExhibitModal이 count 정수 하나 대신 chips([{ nodeId, label, count }])를 받는다 —
// 선택 자료 패널의 칩과 **같은 selection 상태**를 그대로 물려주고, 모달 안에서
// 병행 상태를 만들지 않는다(제거도 여기 removeChip으로 위임). 그리고 submitExhibit는
// 더 이상 downloadOutputFile·triggerBrowserDownload를 부르지 않는다 — 생성 직후
// 자동으로 Downloads 폴더에 떨어뜨리던 것을 걷어내고, 완료 모달("산출물 생성이
// 완료되었습니다" · "확인")로 끝낸다. 실제 다운로드는 산출물 목록(task-11의 OutputList
// 카드 · 다운로드 아이콘)에서 사용자가 원할 때 받는다.
//
// ── round07e — 설명문 생성의 준비중을 해제한다 ────────────────────────────────
// 서버가 kind='caption'을 받아 docx·HWPX·PDF로 설명문을 만들게 되면서(task-4),
// 「설명문」 카드의 "생성시작"이 마침내 실제 모달(CaptionModal)을 연다. 골격은
// ExhibitModal과 같다 — 부모 selection·total을 그대로 물려받고(submitCaption도
// submitExhibit과 같은 흐름), 완료 모달로 끝나며 자동 다운로드하지 않는다. 다른
// 것은 고르는 대상뿐이다: 컬럼 칩 대신 타임라인 체크박스다(round07g — 파일 형식
// 라디오는 화면에서 걷어냈다. 아래 CAPTION_FORMAT 주석 참조). captionSub(설명문 유형 select)는
// 서버 계약에 없는 필드라 여전히 요청에 싣지 않는다 — 표시용으로만 남긴다.
// 설명문 생성은 LLM을 부르므로 전시자료보다 느리다(수십 초) — busy 상태(CaptionModal의
// "만드는 중…")가 실제로 의미를 갖는 첫 산출물이다.
import { useCallback, useEffect, useMemo, useState } from 'react'
import useConversationScope from '../../hooks/useConversationScope.js'
import NodeGraph from '../../components/NodeGraph.jsx'
import NodeModal from './NodeModal.jsx'
import ExhibitModal from './ExhibitModal.jsx'
import ExhibitionModal from './ExhibitionModal.jsx'
import CaptionModal from './CaptionModal.jsx'
import OutputList from './OutputList.jsx'
import Modal from '../../components/Modal.jsx'
import { useScenario } from '../../context/ScenarioContext.jsx'
import { useReadOnly } from '../../context/ReadOnlyContext.jsx'
import { useAdmin } from '../../state/useAdmin.js'
import { useToast } from '../../components/useToast.js'
import { materials } from '../../data/materials.js'
import { deriveType, toAbsolute } from '../../lib/searchApi.js'
import { createOutput, UNKNOWN_OUTCOME } from '../../lib/outputsApi.js'
import { defaultOutputTitle } from '../../lib/outputTitles.js'
import icClose from '../../assets/icons/ic_close.svg'

// 설명문은 어디서 만들든 DOCX 다(사용자 결정 2026-09-03) — 화면에서 고르지 않는다.
// 서버의 CreateOutputRequest.format 은 그대로이고, 화면이 보내는 값만 이 하나로
// 고정했다. (round11a — 서버 렌더러도 **DOCX 하나만** 남았다: 사용자 확정
//  「docx만 사용할거야 나머지는 지원 안할거야」로 hwpx_renderer·pdf_renderer 를 지웠다.)
// 채팅 쪽 같은 결정은 ChatTab.jsx 의 CHAT_CAPTION_FORMAT 이다.
const CAPTION_FORMAT = 'docx'

// Build a lookup map for materials by id (데모 모드 전용 — 라이브는 graph.items를 쓴다)
const byId = Object.fromEntries(materials.map((m) => [m.id, m]))

// 전시자료 드롭다운의 값 — **화면 문구가 아니라 서버 계약의 kind다**(감사 C,
// 아래 exhibitSub 선언부 주석에 근거를 적어 두었다). 두 상수를 export 하는 이유는
// 테스트가 문구 리터럴 대신 이 값을 쓰게 하기 위해서다 — 문구는 언제든 다듬을 수
// 있어야 하고, 그때 분기가 따라 죽으면 안 된다.
export const EXHIBIT_SUB_EXHIBITION = 'exhibition'
export const EXHIBIT_SUB_XLSX = 'exhibit'

// round10a T2-C 리뷰 Minor — 응답을 못 받은 것(502·503·504·네트워크 끊김)은 실패가
// 아니다. round10a A조 최종 리뷰 I-2 — 이 판정이 이 파일 안의 모듈 상수라 ChatTab.jsx가
// import할 수 없어, 같은 createOutput을 쓰는 채팅 인라인 생성이 같은 502에도 "실패했습니다"로
// 단정했다. lib/outputsApi.js(status의 의미를 아는 곳)로 옮기고 여기서는 그것을 그대로
// 쓴다 — notifyCreateFailure는 showToast·bumpOutputsVersion 클로저가 필요해 여전히
// 컴포넌트 안에 남는다(아래 정의부 참조).

// round07i 방어 결함 수정 — selection 상태의 키. 노드 id(n1, n2…)는 클래스마다
// 다시 매겨지므로(node_graph.py:188-205) 그대로 쓰면 다른 클래스의 선택과
// 충돌한다. 클래스명+노드 라벨을 문자열로 그냥 이어 붙이면 "A:B"+"C" 와
// "A"+"B:C" 가 같은 문자열을 만들 여지가 남으므로, 각 조각의 경계를 JSON 배열
// 인코딩(JSON.stringify)에 맡긴다 — 구분자를 직접 고안하지 않아도 길이·이스케이프를
// 표준이 대신 처리한다.
function selectionKey(className, label) {
  return JSON.stringify([className, label])
}

// 서버 graph.items 한 건 → NodeModal이 쓰는 material shape. NodeModal은 m.type으로
// 유형 탭을 세므로 category에서 파생해 준다(searchApi.mapResult와 같은 규칙).
function toMaterial(idnbr, meta) {
  return {
    id: idnbr,
    title: meta?.name || idnbr,
    image: toAbsolute(meta?.image_url),
    type: deriveType(meta?.category),
    category: meta?.category ?? null,
    era: meta?.year_info || meta?.era || null,
    // round07b-ext — 좌측 목록의 「미공개」 표시(디스크립션 좌측 트리). 서버가
    // PG 에서 읽어 graph.items 에 실어 준다. **모르면 null 이고 그때는 아무
    // 표시도 하지 않는다** — 추측해 점을 찍으면 공개 자료를 비공개로 오인한다.
    isPublic: meta?.is_public ?? null,
  }
}

export default function OutputTab() {
  const {
    activeScenario, isLive, graph, graphStatus, graphNotice, fetchGraph,
    lastQuery, searchMode, outputsVersion, bumpOutputsVersion, conversationId,
  } = useScenario()
  const { criteria } = useAdmin()
  const { showToast } = useToast()
  // round10 — 프로젝트 상세(ProjectDetail)가 <ReadOnlyProvider value={true}>로 감싸면
  // true다(기본값 false — 자료검색 화면은 아무 것도 바뀌지 않는다). 노드 그래프는
  // 숨기지 않는다(spec 결정 7) — 비활성으로 보이되 그려진다. 아래 showNode·생성시작
  // 두 버튼·선택 자료 칩에서 이 값으로 분기한다.
  const readOnly = useReadOnly()
  // round07g — **이 화면이 속한 대화.** 산출물 목록·생성이 전부 이 값으로 좁혀진다
  // (사용자 보고: 「그 세션에서 산출된 것만 보여야 하는데 다른 세션에서도 공유된다」).
  //
  // 주소의 `?c=` 를 먼저 본다: 셸(SearchFlowLayout)의 탭 링크·「나의 기록」 재개가
  // 전부 그 값을 실어 주고, F5 를 눌러도 살아남는 유일한 자리다. 컨텍스트
  // conversationId 는 그 다음이다 — 새 검색 직후처럼 주소에 아직 없을 때를 받는다.
  // 둘 다 없으면(대화 이전) 넘기지 않는다 = 서버 기본값(전체) 그대로다. 그리고
  // 「라이브러리에서 두고 온 대화」는 컨텍스트에 남아 있어도 세지 않는다 — 최종
  // 리뷰 Important-1(누른 프로젝트와 다른 산출물이 뜨던 경로). 판정은 셸과 공유한다.
  const { scope: conversationScope } = useConversationScope(conversationId)

  // 준비중 실행 버튼 공용 핸들러 — 브리프가 요구하는 정확한 문구를 한 곳에서만 적는다.
  const prepared = () => showToast('준비 중입니다')

  // 라이브 그래프가 실제로 있을 때만 라이브다.
  const live = Boolean(isLive && graph)
  // round07e D — **세 번째 상태를 가른다.** 이전에는 `!live` 하나로 「데모 모드」와
  // 「라이브인데 그래프가 아직/영영 없음」을 함께 처리해, 후자에서 하드코딩
  // 데모(nodes.js)가 진짜처럼 그려졌다 — 「독립운동 0건」 같은 노드는 라이브
  // 그래프가 낼 수 없는 값인데도 화면에는 아무 표시가 없었다(코딩표준 §6).
  //
  //   demo           : 서버가 없는 더미 모드 — 시나리오를 그리는 것이 정상이다
  //   liveButNoGraph : 라이브인데 그래프가 없다 — **아무것도 그리지 않고 사유를 말한다**
  const demo = !isLive
  const liveButNoGraph = Boolean(isLive && !graph)

  // 묶음기준 = 활성 클러스터링 기준 + 마지막 '사용자 설정'(T5-4 자리표시, 앱 고유 확장)
  const clusterOptions = [...criteria.filter((c) => c.active).map((c) => c.title), '사용자 설정']

  const [selectedNode, setSelectedNode] = useState(null)
  const [activeCluster, setActiveCluster] = useState(clusterOptions[0] ?? '사용자 설정')

  // 노드별 선택 자료 — { [selectionKey(className,label)]: { className, label, idnbrs } }.
  // D1-7이 표시용 칩으로 흉내내던 자리를 실제 상태로 바꾼다. **키가 노드 id가
  // 아니라 (클래스, 라벨) 쌍인 이유는 위 selectionKey 선언부·round07i 방어 결함
  // 수정 주석 참조** — 노드 id는 클래스마다 다시 매겨져 그대로 키로 쓰면 다른
  // 클래스의 선택과 충돌한다. label·className을 값으로 함께 저장해 두는 이유도
  // 같다: 칩을 그리거나 요청을 만들 때 nodes(지금 활성 클래스의 노드만 담고
  // 있다)로 되짚지 않기 위해서다 — 되짚으면 다른 클래스에서 고른 선택은 라벨을
  // 잃고 원시 키를 그대로 서버에 보내게 된다.
  const [selection, setSelection] = useState({})
  // round07i 리뷰 Finding 1 — 다른 클래스의 칩을 더블클릭했을 때 "그 클래스로
  // 전환하는 중" 대기 상태. selection의 키(selectionKey)를 그대로 담아 둔다 — 값을
  // (className, label)로 따로 복제하지 않는 이유는 selection 자체가 이미 그 값을
  // 갖고 있기 때문이다(되짚을 곳을 두 곳으로 늘리지 않는다). 대기 중 그 칩이
  // 지워지면(removeChip) selection[key]가 사라지므로 "더 열 것이 없다"도 이 값
  // 하나로 자연히 판정된다(아래 useEffect 참조). null이면 대기 중인 요청이 없다.
  const [pendingChipKey, setPendingChipKey] = useState(null)
  const [exhibitOpen, setExhibitOpen] = useState(false)
  // round07i — 특별전시 생성 모달. exhibitOpen과 같은 이유로 같은 방식이다 — 같은
  // "전시자료" 생성시작 버튼 하나가 exhibitSub 드롭다운 값에 따라 이 모달과
  // ExhibitModal 중 하나를 연다(아래 exhibitSub 참조). 동시에 열려 있을 일이 없다.
  const [exhibitionOpen, setExhibitionOpen] = useState(false)
  // round07e — 설명문 생성 모달. exhibitOpen과 같은 이유로 같은 방식이다: 모달은
  // 부모 selection을 그대로 받고, busy·doneOpen도 전시자료와 공유한다(두 모달이
  // 동시에 열려 있을 일이 없다 — 패널의 두 "생성시작" 중 하나만 누를 수 있다).
  const [captionOpen, setCaptionOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  // 완료 모달 — round07b-ext task-8. 생성 직후 자동 다운로드하던 것을 걷어내고,
  // "생성이 끝났다"는 사실만 알린 뒤 받는 것은 산출물 목록(task-11)에서 하게 한다.
  const [doneOpen, setDoneOpen] = useState(false)
  // round07e 최종 리뷰 F2(c) — 완료 모달에 덧붙일 사실 한 줄. 타임라인을 켰는데
  // 서버가 0건을 돌려주면(자료에 연도 근거가 부족해 LLM이 항목을 비운 경우, spec의
  // 「근거가 부족하면 비우거나 생략한다」 규칙이 만드는 정상 경로다) 201로 성공은
  // 하지만 체크가 반영됐는지 사용자가 알 길이 없다 — 그 신호를 여기 담는다.
  // submitExhibit은 이 상태를 채우지 않는다(exhibit에는 timeline 개념이 없다) —
  // 그래서 완료 모달을 여는 직전과 닫을 때 비워, 이전 caption 제출의 문구가
  // 새 완료 모달에 새어 남지 않게 한다.
  const [doneNotice, setDoneNotice] = useState('')
  // 목록 갱신 신호 — task-11. 생성 완료 모달을 닫은 뒤 이 값을 올려
  // OutputList(useEffect 의존성 refreshKey)가 새로 생긴 산출물까지 다시 읽게 한다.
  //
  // 리뷰 반영 — 이 상태는 이제 **ScenarioContext가 소유한다**. 같은 신호를 탭 뱃지
  // (SearchFlowLayout)도 읽어야 하는데 그쪽은 이 컴포넌트보다 **위**의 레이아웃
  // 라우트라 지역 useState로는 닿지 않는다(선언부 주석에 근거를 적어 두었다).
  // round07f Task 5 — 상세보기는 더 이상 모달이 아니라 독립 화면이다
  // (/search/output/:outputId). 열람 기록(markOutputOpened)도 그 화면의 마운트가
  // 대신하므로 여기에서 대상 상태(detailOutput)를 들고 있을 이유가 없다.
  // 이동은 OutputList가 자체 useNavigate로 한다 — 부모가 넘길 prop도 없다.

  // 새 검색이면 선택을 버린다 — 노드 집합 자체가 통째로 갈리므로 남은 선택은
  // 전부 무의미해진다. **클래스 전환(graph.selected)은 더 이상 이 판정에 끼지
  // 않는다** — round07i 방어 결함 수정: selection이 이제 (클래스, 라벨) 키라 다른
  // 클래스의 선택과 충돌하지 않으므로 지울 이유가 없고, 오히려 지우면 여러
  // 주제를 넘나들며 자료를 모으는 특별전시 흐름 자체가 막힌다(파일 상단 주석
  // 참조). useEffect 대신 렌더 중 비교로 처리한다 — 이 컨텍스트의 관행이고
  // (ScenarioContext에는 useEffect가 없다) 이펙트 한 박자 늦게 지워지는 사이
  // 잘못된 칩이 그려지는 창도 없앤다.
  const graphKey = live ? lastQuery : null
  const [seenKey, setSeenKey] = useState(graphKey)
  if (graphKey !== seenKey) {
    setSeenKey(graphKey)
    setSelection({})
  }

  // ── round07i 감사 C — 열린 노드 상세 밑으로 새 그래프가 도착하면 그 상세를 닫는다 ──
  // 근거·대안 비교는 파일 상단 §감사 C 주석에 적어 두었다. 요지: 모달이 그리는
  // 자료 목록(아래 nodeMaterials)은 selectedNode.id로 **지금** 그래프의 nodeItems를
  // 되짚어 만드는데, 노드 id는 클래스마다 n1부터 다시 매겨진다. 그래서 클래스
  // 전환이 모달이 열린 채로 착지하면 제목은 옛 노드인 채 목록만 새 클래스의 같은
  // id 노드로 갈린다.
  //
  // 판정 기준을 **그래프 객체의 정체성**으로 두는 이유 — 클래스 전환·재검색·실패
  // 후 재시도, 그래프가 통째로 갈리는 모든 경로가 이 하나로 잡힌다(activeClassName만
  // 보면 같은 클래스를 다시 불러온 경우를 놓친다). 데모 모드는 activeScenario가
  // 그 자리다 — 묶음기준을 바꿔도 nodes가 그대로라 닫히지 않는 것이 맞고, 실제로
  // getScenario는 모듈 상수 배열에서 같은 객체를 돌려준다(렌더마다 새로 만들지
  // 않으므로 아래 렌더 중 비교가 무한 루프가 되지 않는다).
  //
  // 위 graphKey 판정과 같은 자리·같은 기법(렌더 중 비교)이다 — 이펙트로 한 박자
  // 늦게 닫으면 그 한 프레임 동안 **틀린 자료 목록이 실제로 화면에 그려진다.**
  const nodeSource = live ? graph : activeScenario
  const [seenNodeSource, setSeenNodeSource] = useState(nodeSource)
  // 닫았다는 사실만 세어 둔다 — 토스트는 렌더 중에 낼 수 없어 아래 useEffect가 낸다.
  const [staleCloseCount, setStaleCloseCount] = useState(0)
  if (nodeSource !== seenNodeSource) {
    setSeenNodeSource(nodeSource)
    if (selectedNode) {
      // **showNode(null)이 아니라 setSelectedNode(null)이다.** showNode는
      // pendingChipKey까지 함께 지우는데(그 함수 주석 참조), 크로스클래스 칩
      // 더블클릭이 걸어 둔 그 대기는 지금 막 도착한 이 그래프가 해소해야 할
      // **살아 있는 의도**다 — 여기서 지우면 사용자가 요청한 상세가 영영 안 열린다.
      setSelectedNode(null)
      setStaleCloseCount((n) => n + 1)
    }
  }

  // 좌측 목록 — 라이브는 주제 대분류, 데모는 기존 묶음기준.
  // 라이브인데 그래프가 없으면 **빈 목록**이다. 묶음기준을 대신 보여주면
  // 그것이 실제 클래스인 줄 안다.
  const classOptions = live
    ? graph.classes.map((c) => c.value)
    : demo ? clusterOptions : []
  const activeClassName = live ? graph.selected : activeCluster
  const classCount = live
    ? Object.fromEntries(graph.classes.map((c) => [c.value, c.count]))
    : {}

  const chooseClass = (name) => {
    // round07i 리뷰 Finding 1 — 사용자가 여기서 **직접** 다른 클래스를 고르면, 칩
    // 더블클릭이 걸어 둔 대기(pendingChipKey, 아래 openChipDetail 참조)는 더 이상
    // 그 사용자의 의도가 아니다. 목표 클래스가 다르면 즉시 지운다 — 안 지우면
    // 한참 뒤 사용자가 우연히 그 클래스로 다시 왔을 때 요청하지 않은 상세가 불쑥
    // 열린다. 목표와 같은 클래스를 고른 경우(우연히 일치하거나, 바로 아래
    // openChipDetail이 이 함수를 부른 다음 스스로 pendingChipKey를 세팅하는
    // 경우)는 그대로 둔다.
    setPendingChipKey((k) => (k && selection[k]?.className !== name ? null : k))
    if (!live) return setActiveCluster(name)
    if (name === graph.selected) return
    // 재검색이 아니다 — 서버가 /search와 같은 랭킹 캐시를 읽는다.
    fetchGraph(lastQuery, searchMode, name)
  }

  const nodes = live ? graph.nodes : demo ? activeScenario.nodes : []
  const edges = live ? graph.edges : demo ? activeScenario.nodeEdges : []
  const nodeItems = live ? graph.nodeItems : demo ? activeScenario.nodeItems : {}
  // captionSub는 아래 「설명문 유형」 select의 **controlled value 전용** 상태다
  // (promoSub는 round07b-ext에서 홍보자료 자리가 전시자료로 바뀌며 함께 사라졌다).
  //
  // round07e — 설명문 생성이 준비중에서 풀렸지만 서버 CreateOutputRequest에는 이
  // select에 대응하는 필드가 없다(캡션은 계약 밖이다) — 그래서 여전히 요청
  // 파라미터로 실어 보내지 않는다. select 자체는 지우지 않고 표시용으로 남긴다:
  // controlled select를 value 없이 두면 React가 경고를 내고, 이 select 높이
  // (2.25rem)를 잠근 기존 테스트(B4)도 함께 깨진다.
  //
  // round07f — round07e 최종 리뷰 F1이 「전시 해설」·「교육 자료」를 죽은 컨트롤로
  // 오인해 준비중으로 잠갔었다. 대조표 §1-A(피그마 695:107618 실측)로 확인됐다 —
  // 그 둘은 애초에 피그마에 없는 round07b-ext의 목업 값이었다. 걷어내고 피그마가
  // 그리는 대로 「조건 및 대상 선택」 placeholder + 실제 항목 1개(캡션)로 되돌린다.
  // placeholder는 선택되지 않는 값이라 초기값은 여전히 실제 항목이어야 select가
  // 비어 보이지 않는다(round07e가 이미 이렇게 해 뒀다).
  const [captionSub, setCaptionSub] = useState('캡션')
  // round07f — 전시자료 쪽에도 같은 규격의 셀렉트가 있어야 하는데 통째로 없었다
  // (대조표 §1-A). 선택지가 하나뿐이라도 「조건 및 대상」이 앞으로 늘어날 자리이므로
  // 셀렉트 자체는 유지한다.
  // round07i — 그 "앞으로 늘어날 자리"가 실제로 늘었다. 기본값은 그대로 엑셀
  // 항목이다(기존 사용자 흐름·기존 테스트를 깨지 않는다) — 특별전시는 새로 고른
  // 사람만 그 경로를 탄다.
  //
  // round07i 감사 C — **값은 화면 문구가 아니라 kind다.** 이전에는 <option>에
  // value가 없어 select의 값이 곧 옵션의 **표시 문구**('특별 전시 자료 생성')였고,
  // 아래 생성시작 버튼의 분기가 그 문구 리터럴과의 문자열 비교였다(같은 리터럴이
  // 이 파일과 테스트 두 곳에 흩어져 있었다). 문구를 한 글자라도 다듬는 순간 분기가
  // 조용히 반대로 넘어가 — 특별전시를 골랐는데 ExhibitModal이 열리고 .xlsx가
  // 생성된다. 오류도 경고도 없이 **다른 산출물**이 나오는 셈이다(코딩표준 §6).
  // 그래서 값을 서버 계약의 kind('exhibition' | 'exhibit')로 못 박는다 — 이제
  // 표시 문구는 자유롭게 고칠 수 있고, 분기는 구조가 지킨다.
  const [exhibitSub, setExhibitSub] = useState(EXHIBIT_SUB_XLSX)

  // 열린 노드의 자료 목록. 라이브는 서버가 실어 준 graph.items로 만든다 —
  // 노드에는 랭킹 200건 중 아무 자료나 들어갈 수 있는데 화면이 들고 있는 검색
  // 결과는 현재 페이지 20건뿐이라, 그것만으로는 이름을 그릴 수 없다.
  const nodeMaterials = useMemo(() => {
    if (!selectedNode) return []
    const ids = nodeItems?.[selectedNode.id] || []
    if (!live) return ids.map((id) => byId[id]).filter(Boolean)
    return ids.map((id) => toMaterial(id, graph.items?.[id]))
  }, [selectedNode, nodeItems, live, graph])

  // 칩 — 이제 **실제 선택 결과**다(round07b). label·count는 선택 시점에 저장해 둔
  // 값을 그대로 쓴다 — round07i 방어 결함 수정: nodes.find로 되짚지 않는 이유는
  // 위 selection 선언부 주석 참조(nodes는 지금 활성 클래스의 노드만 담는다).
  // 선택이 없으면 칩도 없다.
  const selectedChips = Object.entries(selection)
    .filter(([, { idnbrs }]) => idnbrs.length > 0)
    .map(([key, { label, idnbrs }]) => ({ nodeId: key, label, count: idnbrs.length }))

  // 생성에 담길 자료 — 한 자료가 노드 여러 개에 걸릴 수 있으므로 Set으로 합친다
  // (ADR-002 F-02 중복 노출). 서버도 같은 정규화를 하지만, 화면이 "N건이 담깁니다"를
  // 정직하게 말하려면 여기서도 세야 한다. round07i — 클래스가 여럿 섞여도 idnbr
  // 값 자체(실제 자료 id)는 전역 유일하므로 합치는 방식은 그대로다.
  const selectedTotal = new Set(Object.values(selection).flatMap(({ idnbrs }) => idnbrs)).size

  // round07i — 세 제출 함수(exhibit·exhibition·caption)가 selection을 서버
  // SelectionGroup([{ node, idnbrs }])로 바꾸는 변환을 여기 한 곳에만 둔다. node에는
  // 선택 시점에 저장해 둔 라벨을 그대로 보낸다 — 서버는 이 값을 상세 화면의 칩
  // 복원에만 쓰고(routes.py SelectionGroup 문서 주석 참조) idnbrs만 실제로 병합
  // 대상으로 삼으므로, 서로 다른 클래스에서 온 라벨이 섞여도 서버 계약과 어긋나지
  // 않는다(확인: routes.py `_flatten`은 idnbr 값만 보고 그룹의 출처를 보지 않는다).
  const buildSelectionPayload = () =>
    Object.values(selection)
      .filter(({ idnbrs }) => idnbrs.length > 0)
      .map(({ label, idnbrs }) => ({ node: label, idnbrs }))

  // round07i 재리뷰(round07b 절) — "노드 상세 모달이 지금 무엇을 보여주는가"를
  // 바꾸는 유일한 통로. node에 무엇을 주든(실제 노드든 null이든) pendingChipKey를
  // 함께 지운다 — 그래프 직접 클릭이든, 모달을 닫는 것이든, 전부 "사용자(또는
  // 이미 처리된 요청)의 새 의도가 옛 대기를 대신한다"는 규칙 하나로 통일된다.
  // setPendingChipKey(null)을 호출부마다 따로 적지 않는 이유는 위 파일 상단
  // 주석 참조 — 다음에 노드를 여는 새 경로가 생겨도 이 함수만 거치면 자동으로
  // 안전하다. setSelectedNode·setPendingChipKey 둘 다 useState가 주는 안정된
  // setter라(리렌더돼도 참조가 바뀌지 않는다) 의존성 없이 useCallback으로
  // 감싸도 항상 최신 상태를 반영한다.
  const showNode = useCallback((node) => {
    setPendingChipKey(null)
    setSelectedNode(node)
  }, [])

  const confirmNodeSelection = (ids) => {
    if (!selectedNode) return
    const key = selectionKey(activeClassName, selectedNode.label)
    setSelection((prev) => ({
      ...prev,
      [key]: { className: activeClassName, label: selectedNode.label, idnbrs: ids },
    }))
    showNode(null)
  }

  // round07i 리뷰 Finding 1 — 지금 활성 클래스(nodes)에서 라벨로 찾아 열거나, 없으면
  // 사실대로 알린다. 즉시 여는 같은 클래스 칩(openChipDetail)과, 클래스 전환이
  // 끝난 뒤 여는 다른 클래스 칩(아래 useEffect) 둘 다 이 한 곳을 쓴다 — "찾았으면
  // 열고 없으면 침묵"이 두 곳에 따로 있으면 한쪽만 고치고 잊기 쉽다(코딩표준 §6).
  // nodes·showToast에만 기대므로(둘 다 그래프·토스트가 실제로 바뀔 때만 참조가
  // 바뀐다) useCallback으로 감싸 아래 useEffect의 의존성이 매 렌더 요동치지 않게 한다.
  const openNodeByLabel = useCallback(
    (label) => {
      const node = nodes.find((n) => n.label === label)
      if (!node) {
        // 클래스는 도착했지만(또는 같은 클래스인데) 그 라벨이 더 이상 없다 —
        // 재분류·자료 변경 등으로 낡아진 칩이다. 빈 모달을 여는 대신 말한다.
        //
        // round07i 재리뷰(round07b 절) — 찾지 못했어도 "열려는 시도" 자체는
        // 있었으므로 대기 중이던 값만 지운다. showNode(null)을 쓰지 않는 이유는
        // 지금 열려 있을 수 있는 **무관한** 모달(예: 사용자가 직접 연 다른 노드)을
        // 이 실패한 시도가 잘못 닫아 버리면 안 되기 때문이다 — setSelectedNode는
        // 건드리지 않는다.
        setPendingChipKey(null)
        showToast('선택한 자료를 그래프에서 찾을 수 없습니다 — 그래프가 바뀐 것 같습니다')
        return
      }
      showNode(node)
    },
    [nodes, showToast, showNode],
  )

  // round07g 디스크립션 1 지원 — CaptionModal의 뱃지 더블클릭이 이 화면이 이미 쓰는
  // 노드 상세(selectedNode)를 연다. round07i 이전에는 칩의 nodeId가 곧 nodes 배열의
  // 위치 id라 nodes.find(n => n.id === nodeId)로 바로 찾을 수 있었다.
  //
  // round07i 리뷰 Finding 1 — 지금은 칩이 다른 클래스에서 왔을 수 있는데, 노드
  // 상세를 그릴 재료(nodes·nodeItems)는 **지금 활성 클래스의 것뿐**이다. 예전에는
  // 그럴 때 조용히 아무 일도 하지 않았다(다른 클래스의 노드를 잘못 여는 것보다는
  // 안전했지만, 피그마가 칩마다 예외 없이 요구하는 「더블 클릭 시 상세모달 오픈」을
  // 사용자에게 아무 신호 없이 어기는 조용한 실패이기도 했다 — 코딩표준 §6).
  //
  // 고침 — 같은 클래스면 지금 바로 열고(openNodeByLabel), 다른 클래스면 그 클래스로
  // 실제 전환을 "요청"한다(chooseClass — 새 fetch 경로를 만들지 않고 좌측 목록이
  // 이미 쓰는 경로를 그대로 재사용한다). fetchGraph는 비동기라 이 시점엔 아직 그
  // 클래스의 nodes가 없으므로, 무엇을 기다리는지(pendingChipKey)만 남겨 두고 그
  // 클래스의 그래프가 실제로 도착하면(아래 useEffect) 그때 연다.
  //
  // round07i 재리뷰(round07b 절) — 같은 클래스 분기가 부르는 openNodeByLabel이
  // 이제 스스로 pendingChipKey를 지운다(위 openNodeByLabel 정의부 참조). 그래서
  // 여기 이 함수는 손대지 않아도, "같은 클래스 칩을 더블클릭하면 옛 크로스클래스
  // 대기가 취소된다"는 요구가 자동으로 성립한다 — 재리뷰가 "untouched"라 지목한
  // 바로 이 지점이 고쳐진 이유다.
  const openChipDetail = (key) => {
    const entry = selection[key]
    if (!entry) return // 칩이 이미 지워졌다 — 열 것이 없다.
    if (entry.className === activeClassName) {
      openNodeByLabel(entry.label)
      return
    }
    chooseClass(entry.className)
    setPendingChipKey(key)
  }

  // round07i 리뷰 Finding 1 — pendingChipKey가 가리키는 클래스의 그래프가 도착할
  // 때까지 기다렸다가 연다. graph·graphStatus·activeClassName은 전부 이 화면이
  // 이미 렌더마다 다시 계산하는 값이라(useScenario의 fetchGraph가 그 값들을
  // 갱신한다), 여기서 두 번째 fetch 경로를 만들 필요가 없다 — 값이 도착하는 것을
  // "기다리는" 효과만 있으면 된다.
  useEffect(() => {
    if (!pendingChipKey) return
    const entry = selection[pendingChipKey]
    if (!entry) {
      // 기다리는 사이 그 칩이 지워졌다(removeChip) — 더 열 것이 없다. 실패가
      // 아니라 사용자가 스스로 취소한 것이므로 알리지 않는다.
      setPendingChipKey(null)
      return
    }
    if (live && graphStatus === 'loading') return // 아직 도착 전 — 계속 기다린다.
    if (live && graphStatus === 'error') {
      // chooseClass가 걸어 둔 fetchGraph가 실패했다 — 상세를 열지 못했다는 사실을
      // 조용히 삼키지 않는다(브리프 요구사항 · 코딩표준 §6). 좌측 목록 아래에 이미
      // 뜨는 사유(graphNotice)를 토스트로도 반복해, 모달을 기다리던 사용자가
      // 놓치지 않게 한다.
      setPendingChipKey(null)
      showToast(graphNotice || '노드 그래프를 불러오지 못했습니다')
      return
    }
    if (activeClassName !== entry.className) return // 아직 그 클래스로 전환되지 않았다 — 계속 기다린다.
    // round07i 재리뷰(round07b 절) — 여기서 다시 setPendingChipKey(null)을 부르지
    // 않는다. openNodeByLabel이 성공(showNode)·실패(낡은 라벨) 양쪽 다 스스로
    // pendingChipKey를 지운다 — 지우는 자리를 두 곳에 나눠 두면 다음에 이 값을
    // 지워야 할 새 경로가 생겼을 때 어느 쪽을 고쳐야 하는지 헷갈린다.
    openNodeByLabel(entry.label)
  }, [pendingChipKey, selection, live, graphStatus, graphNotice, activeClassName, openNodeByLabel])

  // round07i 감사 C — 위 렌더 중 판정이 상세를 닫았으면 **사실대로 말한다.**
  // 조용히 닫으면 학예사는 체크하던 것이 왜 사라졌는지 알 수 없다(코딩표준 §6).
  // 렌더 중에는 토스트를 낼 수 없으므로(그 자체가 다른 컴포넌트의 상태를 바꾸는
  // 부수효과다) 닫은 횟수를 세어 두고 여기서 낸다. 초기값 0은 건너뛴다.
  useEffect(() => {
    if (!staleCloseCount) return
    showToast('그래프가 바뀌어 열려 있던 노드 상세를 닫았습니다 — 고르던 자료는 저장되지 않았습니다')
  }, [staleCloseCount, showToast])

  // 생성완료 모달 닫기 — 확인 버튼·X·Esc가 전부 이 하나를 부른다(닫는 방법에 따라
  // 목록이 갱신되기도 안 되기도 하면 안 된다).
  const closeDone = () => {
    setDoneOpen(false)
    setDoneNotice('')
    bumpOutputsVersion()
  }

  // round07i — 인자 이름을 nodeId가 아니라 key로 바꿨다(노드 id가 아니라 위
  // selectionKey가 만든 (클래스, 라벨) 키를 받는다). 동작은 그대로다 — 어떤
  // 값이 오든 그 항목만 지운다.
  const removeChip = (key) =>
    setSelection((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })

  // round10a T2-C — 응답을 못 받은 것(위 UNKNOWN_OUTCOME 참조)은 실패가 아니다.
  // 라이브에서 서버는 실제로 만들어 저장했는데 502 만 돌아왔다 — 「실패했습니다」는
  // 사실이 아닐 수 있다. 단정하지 않고 목록을 보게 한다(그리고 목록을 새로 고친다).
  //
  // 세 제출 함수(exhibit·exhibition·caption)가 똑같이 겪는 판정이라 한 곳에 둔다 —
  // 세 곳에 나눠 적으면 다음에 이 판단이 바뀔 때 하나를 빠뜨리기 쉽다(코딩표준 §6).
  // showToast·bumpOutputsVersion 클로저가 필요해 UNKNOWN_OUTCOME(순수 상수)과 달리
  // 컴포넌트 안에 남는다.
  //
  // round10a A조 최종 리뷰 M-7 — 이전에는 호출부가 `!created.ok` 분기에서 곧바로
  // return해, 응답 불명일 때도 모달이 열린 채 남았다(그 아래 setExhibitOpen(false)
  // 등에 닿지 못한다). finally가 busy만 풀어 「생성하기」가 다시 눌리고, 이미 만들어졌을
  // 자료를 중복 생성할 위험이 남는다. **어느 모달을 닫을지는 호출부만 안다**(exhibit·
  // exhibition·caption이 각자 다른 setter를 쓴다) — 그래서 이 함수는 "응답을 못
  // 받았을 뿐(=목록에 있을 수 있다)"인지를 boolean으로 돌려주고, 호출부가 그 값을 보고
  // 자기 모달을 닫는다. 진짜 실패(4xx 등)는 false를 돌려받아 모달이 그대로 열려
  // 있으므로 사용자가 값을 고쳐 다시 시도할 수 있다 — 아무것도 만들어진 게 없으니
  // 재시도가 중복을 만들지 않는다.
  const notifyCreateFailure = (created) => {
    if (UNKNOWN_OUTCOME.has(created.status)) {
      bumpOutputsVersion()
      showToast('산출물이 만들어졌을 수 있습니다 — 목록을 확인해 주세요')
      return true
    }
    showToast(created.notice)
    return false
  }

  // 생성 → 저장. round07b-ext task-8 이전에는 여기서 곧바로 downloadOutputFile ·
  // triggerBrowserDownload를 불러 자동으로 내려받았다 — 사용자가 요청하지 않은
  // 다운로드를 Downloads 폴더에 떨어뜨리는 셈이었다. 디스크립션은 완료 모달로
  // 끝나고, 받는 것은 산출물 목록(task-11의 카드 · 다운로드 아이콘)에서다.
  const submitExhibit = async ({ title, columns }) => {
    setBusy(true)
    try {
      const created = await createOutput({
        kind: 'exhibit',
        title,
        query: lastQuery || null,
        // round07g — 만든 대화를 함께 남긴다. 이게 빠지면 서버에 NULL 로 저장돼
        // **만든 직후부터 어느 목록에도 뜨지 않는다**(대화로 걸러지므로).
        conversation_id: conversationScope,
        selection: buildSelectionPayload(),
        columns,
      })
      if (!created.ok) {
        // M-7 — 응답 불명(true)이면 이미 목록이 새로 고쳐졌다(notifyCreateFailure) —
        // 모달을 닫아 그 목록 앞에 세운다. 진짜 실패(false)면 열어 둔다(재시도용).
        if (notifyCreateFailure(created)) setExhibitOpen(false)
        return
      }
      // 다운로드하지 않는다 — 완료 모달로 끝내고, 받는 것은 산출물 목록에서다
      // (피그마 「생성완료 모달」 · 디스크립션 5-5 다운로드 아이콘).
      setExhibitOpen(false)
      setDoneNotice('') // exhibit에는 timeline 개념이 없다 — caption이 남긴 문구를 지운다.
      setDoneOpen(true)
    } finally {
      setBusy(false)
    }
  }

  // round07i — 특별전시 생성. submitExhibit과 같은 흐름이되 columns를 아예 싣지
  // 않는다 — T6의 validator가 특별전시에 columns나 format이 실리면 422로 거부한다
  // (서버는 kind별 계약을 섞는 요청을 조용히 봐주지 않는다). ExhibitionModal이
  // 이미 title 하나만 올려 보내므로(모달 자체 주석 참조) 여기서 다른 필드를
  // 끼워 넣지 않는다.
  const submitExhibition = async ({ title }) => {
    setBusy(true)
    try {
      const created = await createOutput({
        kind: 'exhibition',
        title,
        query: lastQuery || null,
        conversation_id: conversationScope,
        selection: buildSelectionPayload(),
      })
      if (!created.ok) {
        // M-7 — submitExhibit과 같은 이유(위 notifyCreateFailure 정의부 주석 참조).
        if (notifyCreateFailure(created)) setExhibitionOpen(false)
        return
      }
      setExhibitionOpen(false)
      setDoneNotice('') // exhibition에도 timeline 개념이 없다.
      setDoneOpen(true)
    } finally {
      setBusy(false)
    }
  }

  // round07e — 설명문 생성. submitExhibit과 같은 흐름(완료 모달로 끝나고 자동
  // 다운로드하지 않는다)이되 columns 대신 format·timeline을 싣는다. columns는
  // caption에서는 아예 보내지 않는다 — 서버가 기본값 []로 받고, 빈 배열을 실어
  // 보내면 exhibit 전용 필드를 caption 요청에 섞는 셈이라 계약을 흐린다.
  //
  // 설명문 생성은 LLM을 불러 전시자료보다 느리다(수십 초) — busy가 "만드는 중…"
  // 문구로 그 사실을 실제로 알려야 하는 이유다(CaptionModal이 그린다).
  const submitCaption = async ({ title, timeline }) => {
    setBusy(true)
    try {
      const created = await createOutput({
        kind: 'caption',
        title,
        query: lastQuery || null,
        conversation_id: conversationScope,
        selection: buildSelectionPayload(),
        format: CAPTION_FORMAT,
        timeline,
      })
      if (!created.ok) {
        // M-7 — submitExhibit과 같은 이유(위 notifyCreateFailure 정의부 주석 참조).
        if (notifyCreateFailure(created)) setCaptionOpen(false)
        return
      }
      setCaptionOpen(false)
      // round07e 최종 리뷰 F2(c) — 자료 근거만 쓰는 것이 강하게 작동할수록 LLM이
      // timeline 항목을 전부 비울 확률이 올라간다(caption.py build_prompt의 「근거가
      // 부족하면 그 항목을 비우거나 생략한다」 규칙). 그래도 201이므로 여기서 걸러
      // 사용자에게 사실만 알린다 — "LLM이 실패했다"처럼 우리가 모르는 원인은
      // 단정하지 않는다.
      setDoneNotice(
        timeline && created.data.timeline_count === 0
          ? '다만 자료에 연도 근거가 부족해 타임라인 항목이 만들어지지 않았습니다.'
          : ''
      )
      setDoneOpen(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {/* [S] node_view : 노드 클러스터링 */}
      {/* round10 — 읽기 전용이면 그래프는 그대로 그리되(spec 결정 7 "숨기지 않는다")
          회색으로 가라앉힌다. 클릭 무반응은 아래 NodeGraph의 onNodeClick/onSelect를
          readOnly일 때 undefined로 넘긴다.
          round10a A조 최종 리뷰 I-1 — 그것만으론 부족했다. onNodeClick/onSelect가
          undefined라 클릭해도 아무 일이 안 나지만, 노드 버튼 자체는 disabled도 흐림도
          없어 **원색 + 손가락 커서 + hover 그림자로 활성처럼 보였다**(이 라운드가 고치려던
          병 그 자체가 우리가 고친 자리에서 되살아났다 — final-findings.md I-1). NodeGraph가
          이제 disabled prop을 받으므로 함께 넘겨 버튼 자체도 비활성으로 보이게 한다. */}
      {/* round10a T2 — 컨테이너는 흐리지 않는다. 그 안의 대분류 탭(:771)·선택 칩(:846·:860)이
          각자 비활성 표시를 갖고 있어, 컨테이너까지 흐리면 두 겹이 곱해져 유효 0.16 이 된다.
          결정 7 「노드 그래프는 숨기지 않는다」의 뜻은 「보이되 못 누른다」이다 — 그래프와
          건수는 또렷하게 읽히고 조작 요소만 잠겨 보여야 한다(사용자 지시 2026-09-16). */}
      <div className="node_view">
        <div className="node_criteria">
          <div className="node_criteria_head">
            <p className="node_criteria_tit">자료선택</p>
            {/* round10a A조 최종 리뷰 I-1 — "노드를 클릭해 자료를 고르세요"는 명령문이다.
                읽기 전용에서는 그 클릭 자체가 막혀 있으니 못 할 행동을 지시하는 거짓 안내가
                된다(ChatTab.jsx의 readOnly 안내 분기·ProjectDetail.jsx 상단 배너와 같은
                이유·같은 어투 — "저장된 기록이라 ~할 수 없습니다"). */}
            <p className="node_criteria_desc">
              {readOnly ? '저장된 기록이라 자료를 고를 수 없습니다' : '노드를 클릭해 자료를 고르세요'}
            </p>
          </div>
          <div className="node_criteria_list" role="tablist" aria-label={live ? '주제 대분류' : '클러스터링 기준'}>
            {/* round10 최종리뷰 M-5 — 자료선택 대분류 탭이 readOnly를 보지 않아
                **회색인데 눌렸다**(바깥 node_view의 opacity-40은 보이기만 회색으로
                만들 뿐이다). 누르면 chooseClass가 fetchGraph(lastQuery, …)를 실제로
                쏴 저장된 기록을 보는 화면에서 새 조회가 나갔다. 같은 파일의 다른
                컨트롤과 같은 관행(disabled + opacity-40 cursor-not-allowed)으로
                막는다 — 새 색·새 CSS를 만들지 않는다. disabled라 키보드로도 닿지
                않는다(spec §5-5 마지막 줄). */}
            {classOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                role="tab"
                aria-selected={activeClassName === opt}
                disabled={readOnly}
                className={`node_criteria_btn${activeClassName === opt ? ' is_active' : ''}${readOnly ? ' cursor-not-allowed' : ''}`}
                onClick={() => chooseClass(opt)}
              >
                {opt}
                {live && classCount[opt] != null && (
                  <span className="ml-1 text-[11px] text-[#8A90A2]">{classCount[opt]}</span>
                )}
              </button>
            ))}
          </div>
          {graphStatus === 'error' && (
            <p className="text-[12px] text-red-600 px-1 mt-2">
              {graphNotice || '노드 그래프를 불러오지 못했습니다'}
            </p>
          )}
          {/* round07e D — 라이브인데 그래프가 없을 때. 데모를 그리는 대신
              **무엇이 없는지**를 말한다. error 는 위에서 이미 사유를 말했다. */}
          {liveButNoGraph && graphStatus !== 'error' && (
            <p className="text-[12px] text-[#5A6173] px-1 mt-2">
              {graphStatus === 'loading'
                ? '검색 결과를 불러오는 중입니다…'
                : '표시할 검색 결과가 없습니다 — 위 검색창에서 검색해 주세요.'}
            </p>
          )}
        </div>

        {/* 노드가 없으면 그래프를 그리지 않는다 — 빈 링을 그리면 「결과가 0건」
            처럼 보여, 좌측의 「검색해 주세요」 안내와 어긋난다. */}
        {nodes.length > 0 && (
          <NodeGraph
            nodes={nodes}
            edges={edges}
            // round07i 재리뷰(round07b 절) — setSelectedNode를 직접 부르지 않는다.
            // 그래프를 직접 클릭하는 것도 "노드 모달에 무엇을 보여줄지" 정하는
            // 사용자 행동이라, showNode를 거쳐 대기 중이던 크로스클래스 칩 오픈을
            // 함께 취소한다(위 파일 상단 주석 참조).
            // round10 — 읽기 전용이면 undefined를 넘겨 클릭을 무반응으로 만든다
            // (NodeGraph의 handleClick?.(node)이 undefined에서 그냥 아무 일도
            // 하지 않는다 — 노드·칩 클릭 핸들러를 막는다, spec §5-5).
            onNodeClick={readOnly ? undefined : showNode}
            onSelect={readOnly ? undefined : showNode}
            // round10a A조 최종 리뷰 I-1 — 위 두 핸들러만으로는 "눌러도 반응이 없다"만
            // 막힐 뿐 "눌릴 것처럼 보인다"는 그대로 남는다. NodeGraph에 disabled를 함께
            // 넘겨 버튼 자체를 비활성으로 보이게 한다(NodeGraph.jsx 파일 상단 주석 참조).
            disabled={readOnly}
          />
        )}
      </div>
      {/* [E] node_view */}

      {/* 사용자 설정 placeholder — 퍼블에 없는 앱 고유 안내(기존 기능 보존, ChatTab.jsx의
          "라이브 초기 상태 안내"와 같은 선례로 Tailwind를 그대로 쓴다). */}
      {demo && activeCluster === '사용자 설정' && (
        <section className="bg-white border border-dashed border-[#C5DCF8] rounded-[14px] p-6 text-center">
          <div className="text-[14px] font-bold text-[#1E2124] mb-1">사용자 설정 묶음기준</div>
          <p className="text-[12.5px] leading-[1.7] text-[#8A90A2]">
            사용자 설정 묶음기준은 준비 중입니다. 관리자 화면(노드관리)에서 정의한 기준이
            이 영역에 연결될 예정입니다.
          </p>
        </section>
      )}

      {/* [S] node_select_panel : 선택 자료 */}
      <div className="node_select_panel">
        <div className="node_select_head">
          <p className="node_select_tit">선택 자료</p>
          <ul className="node_select_tags">
            {/* round10 — 읽기 전용이면 칩도 노드처럼 눌러도 무반응이다(spec §5-5
                "자료선택 노드·칩: 보이되 disabled — 회색, 커서 not-allowed, 클릭·
                더블클릭 무반응"). li는 disabled 속성을 가질 수 없어 aria-disabled +
                tabIndex=-1(키보드로도 닿지 않게 — 같은 절 "pointer-events:none 만으로는
                탭 이동이 남는다")로 같은 뜻을 낸다. 실제로는 이 목록 자체가 항상 비는다
                (읽기 전용에서는 노드 클릭이 막혀 selection이 채워질 길이 없다) — 그래도
                핸들러를 명시로 막아 두는 이유는 그 불변조건이 이 컴포넌트 하나의
                우연이 아니라 이 자리에서 스스로 지켜지게 하기 위해서다. */}
            {selectedChips.map((c) => (
              <li
                key={c.nodeId}
                className={`node_select_tag${readOnly ? ' cursor-not-allowed' : ''}`}
                tabIndex={readOnly ? -1 : 0}
                role="button"
                aria-disabled={readOnly || undefined}
                aria-label={`${c.label}, 그래프에서 위치 확인`}
                onClick={readOnly ? undefined : prepared}
                onKeyDown={readOnly ? undefined : (e) => {
                  if (e.key === 'Enter' || e.key === ' ') prepared()
                }}
              >
                <span className="node_select_tag_label">{c.label}</span>
                <span className="node_select_tag_count">{c.count}</span>
                <button
                  type="button"
                  className={`node_select_tag_remove${readOnly ? ' cursor-not-allowed' : ''}`}
                  disabled={readOnly}
                  aria-label={`${c.label} 선택 해제`}
                  onClick={(e) => {
                    e.stopPropagation()
                    removeChip(c.nodeId)
                  }}
                >
                  <img src={icClose} alt="" className="node_select_tag_remove_icon" />
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="node_select_body">
          {/* 선택 준비중 안내 — 퍼블에 없는 앱 고유 1줄(B2). 제목("선택 자료")·칩·✕는 퍼블
              그대로 두고, 지금 보이는 것이 선택 결과가 아님을 문면으로 밝힌다. node_select_body
              안에 두면 좌우 패딩(0.4rem)·행 간격(0.8rem)을 퍼블 값 그대로 물려받는다. */}
          <p className="text-[12.5px] leading-[1.6] text-[#8A90A2]">
            {selectedTotal > 0
              ? `자료 ${selectedTotal}건을 골랐습니다 — 칩의 숫자는 그 노드에서 고른 건수입니다.`
              : '노드를 클릭해 자료를 고르면 여기에 표시됩니다.'}
          </p>
          <p className="node_select_guide">선택한 자료를 기반으로 생성할 초안의 유형을 선택해주세요.</p>
          <div className="node_select_types">
            <div className="node_select_type">
              <div className="node_select_type_head">
                <p className="node_select_type_tit">설명문</p>
                <p className="node_select_type_desc">캡션·패널·도록 초안 자동 생성</p>
              </div>
              <div className="node_select_type_row">
                {/* 높이 2.25rem = 같은 grid 행 버튼(.node_select_type_row .btn)과 동일(B4).
                    명시 height라 grid stretch가 보정하지 못하므로 rem 값을 직접 맞춘다. */}
                {/* round10a A조 최종 리뷰 M-8 — 읽기 전용에서 옆 「생성시작」은 회색으로
                    잠기는데 이 select는 readOnly를 안 봐서 계속 열리고 바뀌었다(node_view
                    밖이라 T2가 만든 구멍은 아니지만, 읽기 전용 표현의 남은 구멍이다). */}
                <select
                  aria-label="설명문 유형"
                  value={captionSub}
                  onChange={(e) => setCaptionSub(e.target.value)}
                  disabled={readOnly}
                  className={`w-full h-[2.25rem] rounded-lg px-3 text-[13px] bg-white text-[#1A1F2B] border border-[#E2E5EE] pl-2.5${readOnly ? ' is_locked' : ''}`}
                >
                  {/* round07f — round07e 최종 리뷰 F1이 「전시 해설」·「교육 자료」를
                      죽은 컨트롤로 오인해 준비중으로 잠갔었다. 대조표 §1-A(피그마
                      695:107618 실측)로 확인됐다 — 그 둘은 애초에 피그마에 없는
                      round07b-ext의 목업 값이었다. 걷어내고 피그마가 그리는 대로
                      「조건 및 대상 선택」 placeholder + 실제 항목 1개로 되돌린다. */}
                  <option disabled value="">조건 및 대상 선택</option>
                  <option>캡션</option>
                </select>
                {/* 두 가지 잠김을 **다르게** 그린다 — 뜻이 다르기 때문이다.
                      · selectedTotal === 0 : 「지금은 못 누른다, 자료를 고르면 눌린다」
                        → T1 의 `.btn:disabled` 대로 회색. 고칠 방법을 알려 주는 잠김이다.
                      · readOnly          : 「저장된 기록이라 애초에 여기서 만들 수 없다」
                        → `is_locked` 로 **겉모습을 활성과 똑같이** 둔다.
                    사용자 지시(2026-09-17): 「회색으로 하지 말고 그대로 하는데 버튼만
                    안눌러지는 식으로」. 읽기 전용은 화면 전체가 이미 배너와 안내문으로
                    「저장된 기록」임을 말하고 있어, 버튼까지 회색으로 덮으면 화면이
                    통째로 죽은 것처럼 보인다. */}
                <button
                  type="button"
                  className={`btn btn_md btn_primary${readOnly ? ' is_locked' : ''}`}
                  disabled={readOnly || selectedTotal === 0}
                  onClick={() => setCaptionOpen(true)}
                >
                  생성시작
                </button>
              </div>
            </div>
            <div className="node_select_type_divider" aria-hidden="true" />
            {/* round07b — 홍보자료 자리를 전시자료가 대신한다. round07e 최종 리뷰 F1 —
                이 주석은 한동안 "설명문은 프롬프트 미결로 준비중 유지"라 적혀 있었으나,
                round07e가 서버 kind='caption' 경로를 실제로 열어 더는 사실이 아니다.
                지금은 둘 다 동작한다 — 다만 위 select의 세부유형 중 「캡션」한 종류만
                서버 계약에 있다(위 select 주석 참조). */}
            <div className="node_select_type">
              <div className="node_select_type_head">
                <p className="node_select_type_tit">전시자료</p>
                {/* 「내려받기」가 아니다 — task-8이 생성 직후 자동 다운로드를 걷어냈고,
                    이 버튼은 산출물을 **만들기만** 한다(받는 것은 아래 목록의 다운로드
                    아이콘). 문구가 하지 않는 일을 약속하면 사용자가 Downloads 폴더를
                    뒤지게 된다. */}
                <p className="node_select_type_desc">전시 기획안·구성안 초안 자동 생성</p>
              </div>
              <div className="node_select_type_row">
                {/* round07f — 대조표 §1-A: 전시자료 쪽 셀렉트가 통째로 없었다. 설명문
                    셀렉트와 같은 규격(「조건 및 대상 선택」 placeholder + 실제 항목 1개)으로
                    신설한다. 기존 「선택 N건」 텍스트는 지운다 — select가 그 자리를
                    대신하고, 그 건수는 위쪽 안내 문장(:459 "자료 N건을 골랐습니다" —
                    중복을 합친 총계)에 이미 나온다. (리뷰 반영 — 이 자리가 가리켜야 할
                    곳은 「선택 자료」 칩이 아니다. 칩은 **노드별** 건수라 합이 다르게
                    보일 수 있다 — 예: 자료 하나가 두 노드에 겹치면 칩 합은 실제보다
                    크게 나온다(ADR-002 F-02). 중복을 합친 진짜 총계는 안내 문장 쪽이다.) */}
                {/* round10a A조 최종 리뷰 M-8 — 설명문 select와 같은 이유(위 주석 참조). */}
                <select
                  aria-label="전시자료 유형"
                  value={exhibitSub}
                  onChange={(e) => setExhibitSub(e.target.value)}
                  disabled={readOnly}
                  className={`w-full h-[2.25rem] rounded-lg px-3 text-[13px] bg-white text-[#1A1F2B] border border-[#E2E5EE] pl-2.5${readOnly ? ' is_locked' : ''}`}
                >
                  <option disabled value="">조건 및 대상 선택</option>
                  {/* round07i — 피그마 「전시자료 드롭다운」의 3항목 중 둘째다.
                      이 항목을 고르면 엑셀이 아니라 특별전시 초안 docx 가 나온다.
                      round07i 감사 C — value 를 명시한다. 없으면 select 의 값이 곧
                      이 표시 문구가 되고, 아래 생성시작의 분기가 문구 리터럴 비교로
                      떨어진다(위 exhibitSub 선언부 주석 참조). */}
                  <option value={EXHIBIT_SUB_EXHIBITION}>특별 전시 자료 생성</option>
                  <option value={EXHIBIT_SUB_XLSX}>학예 기획 목록 엑셀 만들기</option>
                </select>
                {/* round10a A조 최종 리뷰 M-1 — 위 설명문 버튼과 같은 이유로 btn_primary 하나로 고정한다. */}
                <button
                  type="button"
                  className={`btn btn_md btn_primary${readOnly ? ' is_locked' : ''}`}
                  disabled={readOnly || selectedTotal === 0}
                  // round07i — 같은 "생성시작" 버튼이 고른 드롭다운 값에 따라
                  // 서로 다른 모달을 연다. 새 버튼을 늘리지 않는 이유는 위
                  // OutputTab.test.jsx·live.test.jsx가 "생성시작"을 인덱스로
                  // 세는 기존 계약([0]=설명문·[1]=전시자료)을 그대로 지키기 위해서다.
                  onClick={() =>
                    exhibitSub === EXHIBIT_SUB_EXHIBITION
                      ? setExhibitionOpen(true)
                      : setExhibitOpen(true)
                  }
                >
                  생성시작
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* [E] node_select_panel */}

      {/* round07b-ext task-11 — node_result_panel(생성 결과 패널, 피그마에 없던 예시 초안
          데모)을 걷어내고 그 자리에 진짜 산출물 목록을 놓는다. refreshKey가 바뀌면
          OutputList가 다시 읽는다 — 완료 모달의 "확인"이 그 신호를 올린다.
          round10 — 읽기 전용이면 이 목록을 그리지 않는다. OutputList는 **지금
          로그인한 사람 자신의** 산출물을 대화 id로 걸러 서버에서 읽는다 — 남의
          프로젝트를 열어 보는 화면에 그대로 두면 그 프로젝트와 무관한 내 산출물이
          남의 프로젝트 안에 뜬다. 대신 ProjectDetail이 이 자리 대신 저장 당시의
          스냅샷 목록(ProjectOutputList)을 그린다 — 상세 화면에 목록이 정확히
          하나만 뜨도록, 막는 자리를 이 조건 하나로 못박는다(OutputTab.test.jsx가
          잠근다). */}
      {!readOnly && (
        <OutputList
          refreshKey={outputsVersion}
          onChanged={bumpOutputsVersion}
          conversationId={conversationScope}
        />
      )}

      {/* round07b — 선택이 실제로 부모로 올라온다(D1-7이 준비중 토스트로 막아 둔 자리). */}
      {/* round07i 재리뷰(round07b 절) — 닫기도 showNode(null)을 거친다. 저심각으로
          남겨 뒀던 엣지(모달을 닫아도 대기 중이던 크로스클래스 오픈이 안 지워지던
          것)가 새 장치 없이 이 한 줄로 함께 해결된다. */}
      <NodeModal
        node={selectedNode}
        items={nodeMaterials}
        onClose={() => showNode(null)}
        onConfirm={confirmNodeSelection}
      />

      <ExhibitModal
        open={exhibitOpen}
        chips={selectedChips}
        // 모달이 "N건이 담깁니다"라고 말할 때의 N은 **중복을 합친 수**여야 한다
        // (위 selectedTotal 주석 참조 — 서버도 _flatten으로 같은 정규화를 한다).
        // 모달이 chips[].count를 그냥 더하면, 한 자료가 두 노드에 걸렸을 때 화면은
        // 12건을 약속하고 엑셀은 11행이 나온다. 세는 곳을 여기 하나로 둔다.
        total={selectedTotal}
        defaultTitle={defaultOutputTitle('exhibit')}
        busy={busy}
        onClose={() => setExhibitOpen(false)}
        onRemoveChip={removeChip}
        onSubmit={submitExhibit}
      />

      {/* round07i — 특별전시 생성 모달. ExhibitModal과 같은 이유로 selection·total을
          그대로 물려준다 — 세는 곳을 하나로 둔다(위 selectedTotal 주석 참조). */}
      <ExhibitionModal
        open={exhibitionOpen}
        chips={selectedChips}
        total={selectedTotal}
        defaultTitle={defaultOutputTitle('exhibition')}
        busy={busy}
        onClose={() => setExhibitionOpen(false)}
        onRemoveChip={removeChip}
        onSubmit={submitExhibition}
      />

      {/* round07e — 설명문 생성 모달. ExhibitModal과 같은 이유로 selection·total을
          그대로 물려준다(위 ExhibitModal 주석 참조 — 세는 곳을 하나로 둔다). */}
      <CaptionModal
        open={captionOpen}
        chips={selectedChips}
        total={selectedTotal}
        defaultTitle={defaultOutputTitle('caption')}
        busy={busy}
        onClose={() => setCaptionOpen(false)}
        onRemoveChip={removeChip}
        // round07g 디스크립션 1 「더블 클릭 시 상세모달 오픈, 수정 가능」 —
        // **이 화면이 이미 쓰는 길** 그대로다. 노드 상세는 selectedNode 하나로 열리고
        // (NodeGraph 의 onNodeClick·onSelect 도 같은 setter 를 부른다), 「선택 완료」가
        // confirmNodeSelection 으로 selection 을 갱신해 모달의 뱃지가 곧바로 따라온다.
        // 새 길을 내면 한 화면에서 자료를 여는 방법이 둘로 갈린다(round07f R1 Minor-3).
        // 겹침도 문제없다 — node_detail_modal 은 z-index 102, Modal.jsx 는 z-50 이라
        // 상세 모달이 설명문 모달 **위**에 뜬다.
        onOpenChip={openChipDetail}
        onSubmit={submitCaption}
      />

      {/* 생성완료 모달 — round07b-ext task-8. 자동 다운로드를 대신한다.
          닫기는 **어느 경로든** 목록 갱신 신호를 올린다(task-11) — 방금 생성된
          산출물이 아래 목록에 즉시 나타나야, 사용자가 "완료됐다"는 말과 실제 목록
          사이에서 새로고침을 해야 하나 헷갈리지 않는다.
          리뷰 반영 — 이전에는 "확인"에서만 올려서, X·Esc로 닫으면 방금 완료됐다고
          알려 준 그 산출물이 목록에 없었다. 닫는 방법에 따라 결과가 달라지면 안 된다. */}
      <Modal open={doneOpen} onClose={closeDone} title="산출물 생성이 완료되었습니다">
        <div className="flex flex-col gap-5">
          <p className="text-[13px] text-[#5A6173]">요청하신 산출물 생성이 완료되었습니다.</p>
          {/* round07e 최종 리뷰 F2(c) — 타임라인을 켰는데 0건이면 덧붙는 한 줄.
              타이틀이 이미 "완료되었습니다"를 말하므로 여기는 뒷문장만 싣는다. */}
          {doneNotice && <p className="text-[12.5px] text-amber-700">{doneNotice}</p>}
          <div className="flex justify-end">
            <button type="button" className="btn btn_md btn_primary" onClick={closeDone}>
              확인
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
