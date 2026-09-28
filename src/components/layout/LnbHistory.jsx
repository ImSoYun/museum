/**
 * 이 파일의 책임: 좌측 내비게이션 "나의 기록" 블록(round06c Task E5 — 실데이터 이관).
 *
 * 이전에는 Lnb.jsx가 mock `data/searchHistory.js` 상위 2건을 인라인으로 그렸고
 * (round06c-ext A2), 케밥의 저장/삭제는 옵션 콜백(onSaveHistory/onDeleteHistory, 기본
 * noop)이었다. 이 컴포넌트는 그 블록을 그대로 분리 이관하면서 실데이터로 교체한다: mount
 * 시 `listConversations()`로 목록을 채운다. 실패는 빈 목록으로 조용히 넘어간다(사용자에게
 * 별도 에러를 보이지 않는다 — 사이드바 보조 UI라 화면 전체를 막을 정도는 아니라는 판단,
 * Library.jsx 등 다른 목록 화면과 달리 별도 EmptyState 없음).
 *
 * ★ F7(round06c 배치 리뷰) — 컨트롤러 승인 편차: 이전에는 여기서 isLive를 직접 갈라
 * 더미 모드에 `data/searchHistory.js` 상위 2건(v1 slice(0,2) 관행)을 인라인 매핑해 썼다.
 * 그런데 그 더미 id(searchHistory의 's1' 등)는 conversationsApi.js의 데모 정본
 * (DEMO_CONVERSATIONS, id 'c-demo-1' 등)과 정렬되지 않아, 그 항목을 클릭해 재개하면
 * getConversation의 데모 분기가 id를 못 찾고 messages:[]인 빈 대화로 열렸다 — UX
 * 퇴행이었다(c-demo-1은 3턴 데모 메시지를 갖고 있는데도 도달할 수 없었다). isLive() 판정과
 * 데모/라이브 갈림은 이미 conversationsApi.js의 listConversations()가 하고 있으므로,
 * 여기서 다시 가르지 않고 **항상 listConversations()를 호출**하도록 단순화한다 — isLive
 * 분기·searchHistory import 자체를 없앤다. 데모에서는 그 함수가 DEMO_CONVERSATIONS를
 * 돌려주고, 그 id로 재개하면 실제로 3턴 메시지가 열린다.
 *
 * 케밥(더보기) 마크업은 A2가 Lnb에 만들어 둔 `.history_menu` 구조(조건부 렌더 토글)를
 * 그대로 이관한다 — 새 클래스를 만들지 않는다(css-contract.test.js에 이미 등재돼 있다).
 * 저장/삭제는 옵션 콜백이 아니라 실제 동작이다: 삭제는 ConfirmDialog로 한 번 더 확인한
 * 뒤 `deleteConversation`을 호출하고 목록을 재조회한다.
 *
 * ★ round10 — 「라이브러리 저장」이 showToast('준비 중입니다') 스텁에서 실동작으로
 * 바뀐다: 케밥 클릭 → SaveProjectModal을 그 항목으로 연다(기본 제목 = 표시 이름) →
 * 확정 시 listOutputs({conversationId, limit:100})로 그 대화의 산출물 id를 모아
 * saveProject를 부른다. 「나의 기록」 목록 자체는 저장해도 바뀌지 않는다(대화는 그대로
 * 남는다 — spec §5-1) — 그래서 성공해도 이 컴포넌트의 reload()를 부르지 않는다.
 * 자세한 흐름은 handleSaveProject 도크스트링 참조.
 *
 * ★ 항목 클릭(재개) 계약 — 계획서 브리프 원안은 `resumeConversation(id).finally(()=>
 * navigate(...))`(성공/실패 무관 항상 이동)였다. 그러나 방금 커밋된 최신 계약
 * (ScenarioContext.resumeConversation 도크스트링, 리뷰 F3)은 실패를 `{ok:false,status}`로
 * resolve해 표면화한다 — 삭제된 대화를 가리키는 낡은 id로 재개를 시도하면 계속 진행할 때
 * search_query=''로 fetchPage가 나가 서버에 빈 질의의 새 conversations 행이 생기는 부작용이
 * 있었다(F3). 그래서 여기서는 `.finally` 대신 `.then`으로 성공/실패를 분기한다: 성공
 * (`ok`가 false가 아님 — 더미 모드는 `{ok:true}`만 돌려준다)에만 `/search/results?c=id`로
 * 이동하고, 실패({ok:false})면 이동하지 않고 토스트로 안내한 뒤 목록을 재조회한다(낡은
 * 항목이 목록에서 사라지도록 — F3 계약의 소비).
 *
 * collapsed는 부모(Lnb)가 그대로 넘겨준다. collapsed일 때 블록 자체를 렌더하지 않는 것은
 * 현행 Lnb 관행(조건부 렌더 — jsdom이 CSS를 로드하지 않아 클래스 토글은 테스트로 관측할 수
 * 없기 때문)과 같다. 다만 mount 시 데이터 로딩(useEffect)은 collapsed 여부와 무관하게
 * 이뤄진다 — Lnb는 이 컴포넌트를 항상 마운트해 두고(collapsed는 prop일 뿐) 펼칠 때 바로
 * 보이도록 하기 위함이다.
 *
 * ★ round06f R6F-25 — 케밥 메뉴에 "이름 바꾸기" 추가. 표시명은 `title ?? search_query`
 * (백엔드 c9271c6이 title TEXT·NULL 허용 컬럼과 PATCH /conversations/{id}를 이미 갖춘
 * 상태 — spec R6F-25)로 계산한다. search_query 자체는 절대 바꾸지 않는다 — 재개 검색과
 * 브리핑 캐시 키가 search_query 기반이라, rename이 그것을 건드리면 "그때 그 검색"이
 * 깨진다. 그래서 표시명 축(title)만 별도로 둔다.
 *
 * 편집은 목록 항목의 라벨 자리(.lnb_history_link 버튼)를 인라인 <input>으로 맞바꾸는
 * 방식이다 — 별도 모달을 띄우지 않는다(케밥 메뉴는 열자마자 닫는다, 기존 저장/삭제와
 * 같은 관행). ref 콜백에서 focus()+select()를 한 번에 처리해 "autoFocus·전체선택"
 * 계약을 만족한다(마운트 시 1회만 호출됨 — React가 같은 DOM 노드를 재사용하는 한
 * 리렌더마다 다시 불리지 않는다).
 *
 * 저장 성공 판정은 getConversation의 F3 관행(status 필드 동봉)을 그대로 재사용한다 —
 * renameConversation이 더미/라이브 모두 status를 싣고, 여기서는 status===200만 성공으로
 * 본다. 실패 시에는 삭제 실패 없음 대신 이 파일의 다른 실패 토스트들과 같은 어투
 * ('~하지 못했습니다')로 안내하고, 편집 모드는 유지한다 — 사용자가 다시 시도하거나
 * Esc로 취소할 수 있게 남겨 둔다(제출한 입력값을 잃지 않는다).
 *
 * ★ 리뷰 Critical 수정 — ref는 반드시 useCallback으로 정체성을 고정한 함수여야 한다.
 * 처음엔 JSX에 인라인 화살표 함수를 그대로 ref로 넘겼는데, 인라인 함수는 렌더마다
 * 새 정체성이라 React가 "ref가 바뀌었다"고 보고 매 렌더 ref(null)→ref(el)을 다시
 * 호출한다. 이 input은 onChange마다(즉 키 입력마다) renameDraft state가 바뀌어
 * 리렌더되므로, 키를 하나 칠 때마다 el.select()가 재실행되어 방금 친 글자를 포함한
 * 전체가 다시 선택 상태로 돌아갔다 — 그 상태에서 바로 다음 키 입력이 선택 영역
 * 전체를 치환해버려 "연속 타이핑하면 마지막 한 글자만 남는" 결과가 났다(한글 IME는
 * 조합 중에도 input 이벤트가 여러 번 발생해 더 두드러진다). useCallback([])으로
 * 함수 정체성을 고정하면, 같은 DOM 노드가 유지되는 한(리렌더만으로는 언마운트되지
 * 않는 한) React가 ref를 다시 부르지 않으므로 focus+select가 정말 "편집 진입 시 1회"
 * 만 실행된다.
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useScenario } from '../../context/ScenarioContext.jsx'
import { useToast } from '../useToast.js'
import ConfirmPopup from '../ConfirmPopup.jsx'
import SaveProjectModal from '../SaveProjectModal.jsx'
import { listConversations, deleteConversation, renameConversation } from '../../lib/conversationsApi.js'
import { listOutputs } from '../../lib/outputsApi.js'
import { saveProject } from '../../lib/projectsApi.js'
import kebabSvg from '../../assets/icons/ic_kebab.svg'
import DeleteConfirm from '../DeleteConfirm.jsx'

// 표시명 = title ?? search_query(spec R6F-25). title이 없는(구 데이터·미개명) 항목은
// search_query가 그대로 표시명이 된다.
//
// 이름 바꾸기 입력·저장 모달 「프로젝트명」의 **초기값 전용**으로도 쓴다 — 그래서
// 자리표시 문구 없이 "값이 있으면 그 값, 없으면 빈 문자열"까지만 계산한다. 자리표시는
// displayName()이 이 함수 위에 덧씌운다(아래 참조).
const editableDisplayName = (item) => {
  const title = (item.title ?? '').trim()
  if (title) return title
  return (item.search_query ?? '').trim()
}

// round10c Task B2-2 — `??`만으로는 부족하다. `??`는 null·undefined만 폴백하는데,
// 라이브(2026-09-18) 전수 조회에서 title=null인데 search_query도 ""(빈 문자열)인
// 행이 5건 나왔다(서버 쪽 근본 원인은 B2-1 — 빈 질의가 새 행을 만들지 못하게 막았지만,
// 그 수정 전에 이미 쌓인 옛 행은 남는다). title도 search_query도 빈 문자열이면 `??`는
// 그대로 ""를 돌려주고, 화면엔 글자 없는 줄이 그려진다 — 눌러서 열 수도, 케밥으로
// 지울 수도 없는(표적이 없는) 줄이 이것이다. 그래서 editableDisplayName()이 빈 값이면
// 자리표시 문구를 대신 그린다.
//
// ⚠️ 이 자리표시는 화면 표시 전용이다 — 이름 바꾸기·저장 모달의 입력 초기값에는 절대
// 쓰지 않는다(editableDisplayName()을 대신 쓴다). 자리표시가 편집 입력에 들어가면
// 사용자가 손대지 않고 그대로 저장했을 때 진짜 제목이 문자 그대로 "제목 없음"으로
// 굳어 버린다.
const displayName = (item) => editableDisplayName(item) || '제목 없음'

const PAGE_SIZE = 10

export default function LnbHistory({ collapsed = false }) {
  const { resumeConversation, conversationId } = useScenario()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [items, setItems] = useState([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  // 한 번에 하나만 열린다(v2 lnb.js closeAllMenus()와 같은 규약, A2 관행 유지).
  const [openId, setOpenId] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  // round06f R6F-25 — 인라인 이름 바꾸기. renamingId가 그 항목의 라벨을 <input>으로
  // 맞바꾸는 신호이고, renameDraft는 그 입력의 통제값(controlled value)이다.
  const [renamingId, setRenamingId] = useState(null)
  const [renameDraft, setRenameDraft] = useState('')
  // round10 — 케밥 「라이브러리 저장」. saveTarget이 그 순간 저장하려는 대화 항목이고
  // (null이면 모달이 닫힘), saveBusy는 listOutputs→saveProject 왕복이 나가 있는 동안
  // true다(SaveProjectModal의 busy 계약과 짝 — 중복 제출·중도 취소를 막는다).
  const [saveTarget, setSaveTarget] = useState(null)
  const [saveBusy, setSaveBusy] = useState(false)
  // round06e 최종리뷰 I-3 — 응답 전 연타 가드. 가드 없이는 두 클로저가 같은 offset을 읽어
  // 같은 페이지를 두 번 append(중복 표시)하고 offset도 두 번 전진(11~20번째 페이지를 영영
  // 건너뜀)한다.
  const [loadingMore, setLoadingMore] = useState(false)

  const [deleteCompleteOpen, setDeleteCompleteOpen] = useState(false)

  // F7: isLive 분기 없이 항상 listConversations()를 호출한다 — 데모/라이브 갈림은
  // conversationsApi.js가 이미 맡는다(위 파일 상단 주석 참조).
  const reload = useCallback(async () => {
    try {
      const res = await listConversations({ limit: PAGE_SIZE, offset: 0 })
      setItems(res?.conversations ?? [])
      setHasMore(Boolean(res?.has_more))
      setOffset(PAGE_SIZE)
    } catch {
      // 실패는 조용히 빈 목록으로 — 사이드바 보조 UI라 별도 에러 배너를 두지 않는다.
      setItems([])
      setHasMore(false)
      setOffset(0)
    }
  }, [])

  // round06e 최종리뷰 I-2 — catch는 fetch reject만 잡는다. 500이나 잘못된 바디면
  // conversationsApi.listConversations은 res.json()을 그대로 resolve하므로(예:
  // {detail: '...'}) res?.conversations ?? []가 조용히 0건으로 흡수하고, has_more:false로
  // "더 보기" 버튼이 사라진 뒤 offset만 전진해 다음 클릭에서도 복구되지 않는다. 응답 shape을
  // 먼저 검증해 실패를 명시적으로 드러내고, 실패 시에는 items·hasMore·offset을 그대로
  // 두어(재시도 가능하도록) 조용히 흡수하지 않는다.
  const loadMore = async () => {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      const res = await listConversations({ limit: PAGE_SIZE, offset })
      if (!Array.isArray(res?.conversations)) {
        showToast('기록을 더 불러오지 못했습니다')
        return
      }
      setItems((prev) => [...prev, ...res.conversations])
      setHasMore(Boolean(res?.has_more))
      setOffset((o) => o + PAGE_SIZE)
    } catch {
      showToast('기록을 더 불러오지 못했습니다')
    } finally {
      setLoadingMore(false)
    }
  }

  // conversationId를 의존성에 넣는 이유(round06c G1 실측 결함): Lnb는 레이아웃에 상주해
  // 라우트가 바뀌어도 재마운트되지 않는다. mount 시 1회만 읽으면 새 검색이 서버에 새
  // conversations 행을 만들어도(ScenarioContext가 그때 conversationId를 서버 발급 id로
  // 갱신한다) 이 목록은 전체 새로고침 전까지 영영 그 대화를 보여주지 못한다 —
  // 로그인 직후 검색 → "나의 기록"이 계속 비어 있는 상태로 관측됐다.
  useEffect(() => {
    reload()
  }, [reload, conversationId])

  // 바깥 클릭·Escape로 메뉴 닫기 — 퍼블 lnb.js:230-233 계약의 미러(사용자 지시
  // 2026-07-28: 케밥을 다시 누르지 않아도 다른 곳을 누르면 닫혀야 한다). 퍼블과
  // 동일하게 케밥 버튼(.lnb_history_more)과 메뉴(.history_menu) 안쪽 클릭은 제외한다 —
  // 케밥은 자기 onClick이 토글을 맡고(여기서도 닫으면 같은 클릭이 닫고 다시 여는
  // 핑퐁이 된다), 메뉴 항목은 각자의 핸들러가 동작 후 닫는다. 열려 있을 때만
  // 리스너를 단다(openId 의존성 — 닫히면 정리함수가 떼어낸다).
  // ★ 훅이므로 아래 `if (collapsed) return null`보다 반드시 위(Hooks 규칙 —
  // focusAndSelectRenameInput의 선례와 같다).
  useEffect(() => {
    if (openId === null) return undefined
    const onDocClick = (e) => {
      if (e.target.closest('.lnb_history_more') || e.target.closest('.history_menu')) return
      setOpenId(null)
    }
    const onDocKeyDown = (e) => {
      if (e.key === 'Escape') setOpenId(null)
    }
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onDocKeyDown)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onDocKeyDown)
    }
  }, [openId])

  // 리뷰 Critical 수정 — 반드시 useCallback으로 정체성을 고정한다(파일 상단 도크스트링
  // "리뷰 Critical 수정" 참조: 인라인 화살표 함수를 ref로 넘기면 매 keystroke(리렌더)마다
  // React가 ref를 재호출해 select()가 다시 실행되어 타이핑이 파괴된다).
  // ★ 훅은 조건부 return(아래 `if (collapsed) return null`) 이전에 둔다 — Hooks 규칙 위반
  // (조건부에 따라 훅 호출 개수가 달라짐)을 피하기 위함이다. 처음 구현에서 이 줄을
  // return 아래(다른 핸들러 함수들 사이)에 두는 실수를 했고, collapsed 토글 테스트에서
  // "Rendered fewer hooks than expected"로 즉시 드러났다.
  const focusAndSelectRenameInput = useCallback((el) => {
    if (el) {
      el.focus()
      el.select()
    }
  }, [])

  if (collapsed) return null

  const handleOpen = (item) => {
    // F7: 네트워크 계층의 reject(예: fetch 자체가 실패)는 resumeConversation이 던지는
    // {ok:false}가 아니라 Promise rejection이다 — .then만으로는 unhandled rejection이
    // 콘솔에 남는다. .catch로 같은 안내(토스트)를 띄워 막는다.
    resumeConversation(item.id).then((r) => {
      if (r && r.ok === false) {
        showToast('대화를 불러오지 못했습니다')
        reload()
        return
      }
      navigate(`/search/results?c=${item.id}`)
    }).catch(() => showToast('대화를 불러오지 못했습니다'))
  }

  // 확정 후 완료 피드백은 토스트다 — 퍼블은 삭제완료 팝업(#history_delete_done)을
  // 한 번 더 띄우지만, 확인 클릭이 한 번 더 필요한 이중 팝업은 조작 비용이 크고 이
  // 파일의 다른 완료/안내 피드백이 전부 토스트 관행이라 그에 맞춘다(미참조 사유는
  // 완료노트 기록 — 퍼블 의도인 "완료를 알린다"는 유지하되 수단만 앱 관행으로).
const handleConfirmDelete = () => {
	if (!pendingDelete) return
	const id = pendingDelete.id
	setPendingDelete(null)
	deleteConversation(id)
		.then((res) => {
			if (res && res.status === 200) {
				setDeleteCompleteOpen(true)
				reload()
			} else {
				showToast('기록을 삭제하지 못했습니다')
			}
		})
		.catch(() => {
			showToast('기록을 삭제하지 못했습니다')
		})
}

  // round06f R6F-25 — 케밥 '이름 바꾸기' 클릭: 메뉴를 닫고 그 항목을 편집 모드로 연다.
  // 입력 초기값은 현재 표시명(title ?? search_query) — "이름을 바꾼다"는 표시명을
  // 고치는 것이지 빈 칸에서 새로 짓는 것이 아니다.
  //
  // round10c Task B2-2 — displayName()이 아니라 editableDisplayName()을 쓴다.
  // displayName()의 "제목 없음"은 화면 자리표시라 입력 초기값으로 흘리면 손대지 않고
  // 저장했을 때 그 자리표시가 진짜 제목으로 굳어 버린다(editableDisplayName 도크스트링 참조).
  const handleStartRename = (item) => {
    setRenameDraft(editableDisplayName(item))
    setRenamingId(item.id)
    setOpenId(null)
  }

  // Esc·blur 공용 취소 — 입력값을 버리고 편집 모드를 닫는다. 이미 닫힌 상태에서 다시
  // 불려도(예: 저장 성공 후 언마운트되며 뒤따르는 blur) 그대로 null→null이라 무해하다.
  const handleCancelRename = () => {
    setRenamingId(null)
    setRenameDraft('')
  }

  // Enter 저장. 빈 문자열·공백만 입력은 서버 왕복 없이 조용히 무시한다(클라 선검증 —
  // 계약 4). 이것은 "취소"가 아니다 — 편집 모드를 닫지 않고 그대로 두어 사용자가
  // 이어서 고쳐 쓸 수 있게 한다.
  const handleSaveRename = (id) => {
    const trimmed = renameDraft.trim()
    if (!trimmed) return
    renameConversation(id, trimmed).then((res) => {
      if (res && res.status === 200) {
        handleCancelRename()
        reload()
      } else {
        showToast('이름을 바꾸지 못했습니다')
      }
    }).catch(() => showToast('이름을 바꾸지 못했습니다'))
  }

  // round10 — 「라이브러리 저장」 실동작. 그 대화의 산출물만 실어야 하므로 먼저
  // listOutputs({conversationId, limit:100})로 모으고(브리프 Step6), 그 조회 자체가
  // 실패하면 산출물 id 없이(=텅 빈) 프로젝트가 만들어지는 상황을 막기 위해
  // saveProject를 아예 부르지 않는다. 성공해도 「나의 기록」 목록은 reload()하지
  // 않는다 — 저장은 그 대화를 스냅샷으로 복제하는 것일 뿐 대화 자체는 그대로
  // 남기 때문이다(spec §5-1).
  const handleSaveProject = async ({ title, description, password }) => {
    if (!saveTarget) return
    const target = saveTarget
    setSaveBusy(true)
    try {
      const outputsRes = await listOutputs({ conversationId: target.id, limit: 100 })
      if (!outputsRes.ok) {
        showToast('저장하지 못했습니다 — 잠시 후 다시 시도하세요')
        return
      }
      const outputIds = outputsRes.data.outputs.map((o) => o.id)
      const saveRes = await saveProject({
        title,
        description,
        password,
        conversationId: target.id,
        searchQuery: target.search_query,
        // 목록 응답에 mode가 있으면 그대로, 없으면(구 데이터) 서버 기본값과 같은 'meta'.
        searchMode: target.mode || 'meta',
        outputIds,
      })
      if (saveRes.ok) {
        showToast('라이브러리에 저장했습니다')
        setSaveTarget(null)
      } else {
        showToast('저장하지 못했습니다 — 잠시 후 다시 시도하세요')
      }
    } catch {
      showToast('저장하지 못했습니다 — 잠시 후 다시 시도하세요')
    } finally {
      setSaveBusy(false)
    }
  }

  const handleRenameKeyDown = (e, id) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveRename(id)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelRename()
    }
  }

  return (
    <div className="lnb_history">
      <p className="lnb_history_tit">나의 기록</p>
      <ul className="lnb_history_list">
        {items.map((item) => {
          const isMenuOpen = openId === item.id
          return (
            // is_active = 현재 열려 있는 대화(context conversationId 일치) 하이라이트 —
            // 퍼블 layout.css `.lnb_history_item.is_active{background:var(--primary10)}`
            // 계약의 소비다. 케밥 메뉴(§34)와 같은 클래스 토글 계약이라 미부착이면
            // jsdom 전건 green인 채 실화면에서만 조용히 죽는다.
            <li
              key={item.id}
              className={item.id === conversationId ? 'lnb_history_item is_active' : 'lnb_history_item'}
            >
              {renamingId === item.id ? (
                <input
                  type="text"
                  className="lnb_history_rename_input"
                  aria-label="대화 이름 바꾸기"
                  maxLength={100}
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onKeyDown={(e) => handleRenameKeyDown(e, item.id)}
                  onBlur={handleCancelRename}
                  // autoFocus·전체선택 계약: 정체성 고정된 콜백(useCallback)만 쓴다 —
                  // 인라인 화살표 함수를 쓰면 안 되는 이유는 위 리뷰 Critical 도크스트링 참조.
                  ref={focusAndSelectRenameInput}
                />
              ) : (
                <button
                  type="button"
                  className="lnb_history_link"
                  onClick={() => handleOpen(item)}
                >
                  <span className="lnb_history_txt">{displayName(item)}</span>
                </button>
              )}
              <button
                type="button"
                className="lnb_history_more icon_btn"
                aria-label="더보기"
                aria-haspopup="menu"
                aria-expanded={isMenuOpen ? 'true' : 'false'}
                onClick={() => setOpenId(isMenuOpen ? null : item.id)}
              >
                <img src={kebabSvg} alt="" className="ic_kebab" />
              </button>
              {isMenuOpen && (
                // is_active 필수 — 퍼블 layout.css는 .history_menu{display:none}을 기본으로
                // 두고 .is_active에서만 display:flex다(v2 lnb.js가 클래스로 토글하는 계약).
                // React는 조건부 렌더라 "렌더됨=열림"이므로 항상 달아 준다. 빠뜨리면 DOM에는
                // 있지만 영구 display:none — jsdom 테스트는 전부 통과하면서 실화면에서만
                // 안 보이는 결함이 된다(dev 실측, 2026-07-28).
                <div className="history_menu is_active" role="menu">
                  <button
                    type="button"
                    className="history_menu_item"
                    role="menuitem"
                    onClick={() => {
                      // round10 — 스텁(showToast('준비 중입니다'))을 실동작으로 교체.
                      // 저장 확정은 SaveProjectModal의 onSave(handleSaveProject)가 맡는다.
                      setSaveTarget(item)
                      setOpenId(null)
                    }}
                  >
                    라이브러리 저장
                  </button>
                  <button
                    type="button"
                    className="history_menu_item"
                    role="menuitem"
                    onClick={() => handleStartRename(item)}
                  >
                    이름 바꾸기
                  </button>
                  <button
                    type="button"
                    className="history_menu_item"
                    role="menuitem"
                    onClick={() => {
                      setPendingDelete(item)
                      setOpenId(null)
                    }}
                  >
                    삭제
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {hasMore && (
        <button
          type="button"
          className="lnb_history_more_btn"
          onClick={loadMore}
          disabled={loadingMore}
        >
          기록 더 보기
        </button>
      )}
      {/* 퍼블 #history_delete_alert 미러(ConfirmPopup) — 라운드4 범용 모달(ConfirmDialog)을
          사용자 신고(2026-07-28 "삭제할 때 UI가 매우 이상하다")로 교체했다. 문구도 퍼블
          정본을 따른다: 제목 '삭제 알림'(기본값) + 대상 인용 + '항목을 삭제하시겠습니까?'
          (기본값) + 아니오/네. */}
      <ConfirmPopup
        open={!!pendingDelete}
        quote={pendingDelete ? displayName(pendingDelete) : ''}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      {/* round10 — 프로젝트명 기본값은 표시 이름(title ?? search_query)이다. onCancel은
          busy 동안 무시한다 — Modal의 오버레이·X 버튼도 이 onCancel 하나로 묶여 있어
          (SaveProjectModal.test.jsx busy 시나리오 참조), 그렇지 않으면 배경 클릭만으로
          모달이 닫히고 그 사이 응답이 돌아와 언마운트된 모달에 setState하려는 경합이
          생긴다.
          round10c Task B2-2 — 여기도 이름 바꾸기와 같은 이유로 displayName()이 아니라
          editableDisplayName()을 쓴다. "제목 없음" 자리표시가 defaultTitle로 들어가면
          손대지 않고 저장했을 때 프로젝트명이 문자 그대로 "제목 없음"이 되어 버린다. */}
      <SaveProjectModal
        open={!!saveTarget}
        defaultTitle={saveTarget ? editableDisplayName(saveTarget) : ''}
        busy={saveBusy}
        onCancel={() => { if (!saveBusy) setSaveTarget(null) }}
        onSave={handleSaveProject}
      />
	  <DeleteConfirm
			open={deleteCompleteOpen}
			title="삭제 완료"
			desc="삭제하였습니다!"
			confirmLabel="확인"
			onConfirm={() => setDeleteCompleteOpen(false)}
			onCancel={() => setDeleteCompleteOpen(false)}
		/>
    </div>
  )
}
