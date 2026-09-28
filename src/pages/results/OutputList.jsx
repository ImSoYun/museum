// 이 파일의 책임: 산출물 목록 카드 그리드(피그마 디스크립션 5·5-1~5-5) — 탭(종류)·
// 제목 검색·선택·삭제·다운로드·페이지네이션을 한 화면에 담는다.
//
// 이 화면의 핵심 상태는 「신규」다 — 보라 테두리로 뜨고, 열어보면 기본색이 되며
// 상단 신규 건수에서 차감된다. 정본은 서버의 opened_at 이다(클라이언트 상태면
// 새로고침에 사라지고 기기마다 달라진다) — 그래서 이 컴포넌트는 rows를 그대로
// 그릴 뿐 신규 여부를 다시 계산해 상태로 들고 있지 않는다(OutputCard가 매 렌더
// output.opened_at을 직접 읽는다).
//
// 상단 「총 N건 · 신규 N건」도 같은 이유로 **둘 다 서버 값**이다(리뷰 반영).
// rows에서 세면 한 페이지(20건) 안에서만 세게 되어, 21건째부터 「총 20건」이라
// 거짓말을 하고 has_more(다음 페이지 있음)와도 모순된다.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import OutputCard from './OutputCard.jsx'
import ConfirmPopup from '../../components/ConfirmPopup.jsx'
import { isLive, listOutputs, deleteOutputs, downloadOutputFile } from '../../lib/outputsApi.js'
import { triggerBrowserDownload } from '../../lib/downloadFile.js'
import { useToast } from '../../components/useToast.js'

// 목록 필터 탭. 라벨은 **산출물 종류(kind)** 이름이고 정본은 디스크립션 항목 5
// 「전체 / 설명문 / 전시자료」였다(대조표 `19_round07e-디스크립션-대조표.md` §1 #5) —
// **round10b에서 기획 요청으로 exhibit 의 라벨을 「전시자료」→「학예 기획 자료」로
// 개명했다**(시트 #7·#8, 다섯 곳을 동시에 — 아래 참조). 대조표에도 이 개명을
// 남겼다 — 「전시자료」가 과거 확정 스펙이었다는 사실 자체는 지우지 않는다.
//
// 아래 카드·상세의 종류 뱃지는 같은 kind='caption'을 「캡션」이라 부른다 — 한 화면에
// 두 말이 남는 이 어긋남은 **사용자가 알고 내린 결정**이다(round07f spec §2 결정 3
// 「카드 종류 뱃지는 「캡션」(피그마대로). 탭 필터는 「설명문」 그대로」 · 근거 §4.3:
// 프레임 두 곳(목록 카드 695:105902 · 상세 749:6491)이 일관되게 「캡션」인 반면
// 디스크립션 항목 5의 탭 목록은 「설명문」이다). **한쪽으로 통일하지 말 것** —
// 둘 다 피그마 실물이고, 통일하면 어느 한쪽이 정본에서 멀어진다. exhibit의 개명은
// 이 예외와 무관하다 — 캡션처럼 "탭과 뱃지가 일부러 다른 말을 하는" 사례가 아니라,
// 카드 뱃지·상세 뱃지·탭 라벨 **셋 다** 같은 새 이름으로 맞춘다.
//
// round07i 감사 C — **특별전시(kind='exhibition') 탭이 통째로 빠져 있었다.**
// 그 결과 특별전시 산출물은 「전체」에서만 보였고, 「학예 기획 자료」 탭에는 kind가
// 'exhibit'인 엑셀만 걸려 나오지 않았다 — 전시자료 드롭다운에서 특별전시를 만든
// 학예사가 그 탭을 열어 자기 산출물을 못 찾는 조용한 실패다(코딩표준 §6).
// 「학예 기획 자료」 탭이 exhibition까지 함께 걸러 주지 않는 이유: 서버의 kind 필터는
// 정확히 한 값만 받고(routes.py list_outputs `kind: str | None`), 카드·상세의
// 종류 뱃지도 둘을 「학예 기획 자료」·「특별전시」로 이미 구분해 부른다 — 목록에서만
// 둘을 한 탭에 뭉치면 탭 이름과 카드 뱃지가 어긋난다.
//
// ★ 새 kind 를 추가하거나(또는 이번처럼 라벨을 개명하거나) 고칠 곳은 **다섯**이다 —
//   이 TABS · OutputCard.jsx의 KIND_LABEL · OutputDetailPage.jsx의 KIND_LABEL ·
//   pages/results/chatTasks.js의 CHAT_TASKS/CHAT_TASK_ORDER · lib/outputTitles.js의
//   defaultOutputTitle 분기(체크리스트 원본은 OutputCard.jsx 참조). 예전엔 이 목록이
//   「셋」에 멈춰 있어서, exhibition이 뱃지에는 있고 탭에는 없는 상태가 그대로
//   릴리스됐다 — 그 실수를 반복하지 않으려고 round10b 개명도 다섯 곳을 함께 고쳤다.
const TABS = [
  { key: null, label: '전체' },
  { key: 'caption', label: '설명문' },
  { key: 'exhibit', label: '학예 기획 자료' },
  { key: 'exhibition', label: '특별전시' },
]
const PAGE_SIZE = 20

/** 현재 페이지(0-base) 주변 번호 + 처음/끝을 골라 `[0,1,2,'…',9]` 모양으로 낸다.
 * window=2 — 현재 페이지 좌우 2개씩 보여준다. 총 페이지가 window*2+3 이하면
 * 생략 없이 전부 보여준다(그 이하에서 '…'를 쓰면 오히려 어색하다). */
export function pageNumbers(current, totalPages, windowSize = 2) {
  if (totalPages <= windowSize * 2 + 3) {
    return Array.from({ length: totalPages }, (_, i) => i)
  }
  const out = new Set([0, totalPages - 1])
  for (let d = -windowSize; d <= windowSize; d++) {
    const n = current + d
    if (n >= 0 && n < totalPages) out.add(n)
  }
  const sorted = [...out].sort((a, b) => a - b)
  const result = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('…')
    result.push(sorted[i])
  }
  return result
}

// round07g — `conversationId`: 이 목록이 보여 줄 **대화**. 산출물이 대화를 넘어
// 섞여 보이던 것이 이 라운드가 고치는 결함이다("그 세션에서 산출된 것만 보여야
// 하는데 다른 세션에서도 공유된다" — 사용자 보고).
//
// round07g 수정 R1 — **대화를 모르면 목록을 아예 조회하지 않는다**(사용자 결정).
// 예전 계약은 「안 주면 전체」였는데, 그 「전체」가 곧 사용자가 신고한 증상이다 —
// 대화를 모르는 순간(라이브러리 딥링크가 대화를 못 실어 준 경우 등) 화면이 남의
// 대화 산출물을 그대로 보여 준다. 아무것도 안 보여주는 쪽이 요구에 맞다.
// **서버 계약(「안 주면 전체」)은 그대로다** — 대화 개념이 없는 다른 호출자를
// 위해 남긴다. 막는 자리는 여기, 화면이다.
export default function OutputList({ refreshKey, onChanged, conversationId }) {
  const { showToast } = useToast()
  const navigate = useNavigate()
  // round07f 최종 리뷰 I-1 — **상세로 갈 때 `?c=`(대화 id)를 함께 들고 간다.**
  //
  // round07e D가 `?c=`를 만든 이유가 「F5를 눌러도 검색 세션이 살아 있게」였다
  // (SearchFlowLayout.jsx의 재개 이펙트 주석). 그때 상세는 **모달**이라 URL이
  // `/search/output?c=…` 그대로여서 저절로 지켜졌는데, 이 라운드가 상세를 독립
  // 라우트로 승격하면서 그 보호가 끊겼다 — 상세에서 F5를 누르면 `c`가 없어
  // resumeConversation이 돌지 않고, 검색어·노드 그래프·대화가 통째로 사라진다.
  //
  // round07g 수정 R1 (Minor-1) — 그 값을 **prop 하나에서만** 읽는다. 예전에는
  // 여기서만 `useSearchParams().get('c')`를 따로 읽었는데, 목록이 좁힌 대화는
  // prop이었다 — 한 파일에 같은 개념의 출처가 둘이면 갈릴 수 있고, 갈리는 순간
  // 「상세로 나르는 대화」와 「목록이 보여 준 대화」가 서로 다른 것을 말한다.
  // prop(OutputTab의 conversationScope)은 `?c=`를 이미 우선으로 삼으므로 이 쪽이
  // 좁아지지 않는다. 없으면 붙이지 않는다(빈 `?c=`는 재개 이펙트가 읽는
  // `searchParams.get('c')`를 빈 문자열로 만들어 판정을 흐린다).
  const openDetail = (output) => {
    const to = `/search/output/${output.id}`
    navigate(conversationId ? `${to}?c=${encodeURIComponent(conversationId)}` : to)
  }
  const [kind, setKind] = useState(null)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [rows, setRows] = useState([])
  // 서버가 준 집계 두 값. total은 지금 필터의 전체 건수, newCount는 필터와 무관한
  // 「내 미열람 전체」다(routes.py의 total·new_count 주석 참조 — 계약이 다르다).
  const [total, setTotal] = useState(0)
  const [newCount, setNewCount] = useState(0)
  const [selectedIds, setSelectedIds] = useState([])
  // 삭제 확인 대기 상태(LnbHistory.jsx의 pendingDelete와 같은 관행). 삭제는 행 +
  // 파일 바이트를 되돌릴 수 없이 지우는데 최대 20건이 한 번에 날아간다 — 대화 기록
  // 한 줄을 지울 때도 확인을 받는 이 앱에서 여기만 무확인일 이유가 없다.
  const [confirming, setConfirming] = useState(false)

  // 필터가 바뀌면 첫 페이지로 돌아간다 — 3페이지에서 필터를 바꾸면 빈 화면이 된다.
  // 대화가 바뀌는 것도 같은 이유다(round07g): 3페이지를 보다 다른 대화로 옮기면
  // 그 대화에는 3페이지가 없어 빈 화면이 된다.
  useEffect(() => { setPage(0) }, [kind, q, conversationId])

  useEffect(() => {
    // 조회를 하지 **않는** 두 경우다. 둘 다 빈 목록 + 아래 빈 상태 안내로 끝낸다.
    //
    // ① 데모 모드(VITE_API_BASE_URL 미설정) — 백엔드가 없다. 그냥 부르면 마운트마다·
    //    탭 전환마다·글자 한 자마다·페이지마다 「서버에 연결하지 못했습니다」 토스트가
    //    뜬다. 데모 모드는 계속 동작해야 한다는 것이 이 화면의 전제다(OutputTab.jsx
    //    상단 주석).
    // ② round07g 수정 R1 — **라이브인데 대화를 모른다.** 이때 조회하면 서버 기본값이
    //    걸려 「내 전체 산출물」이 온다 — 그것이 정확히 사용자가 신고한 증상이다
    //    (「그 세션에서 산출된 것만 보여야 하는데 다른 세션에서도 공유된다」).
    //    요구의 정반대를 보여주느니 아무것도 보여주지 않는다.
    if (!isLive() || !conversationId) {
      setRows([])
      setTotal(0)
      setNewCount(0)
      setHasMore(false)
      setSelectedIds([])
      return undefined
    }
    let alive = true
    listOutputs({ kind, q, conversationId, limit: PAGE_SIZE, offset: page * PAGE_SIZE }).then((res) => {
      if (!alive) return
      if (!res.ok) return showToast(res.notice)
      setRows(res.data.outputs)
      setHasMore(res.data.has_more)
      // `?? 0` — 구 응답(테스트 더블 포함)에 집계가 없어도 「총 undefined건」으로
      // 새지 않게 한다.
      setTotal(res.data.total ?? 0)
      setNewCount(res.data.new_count ?? 0)
      setSelectedIds([]) // 필터·페이지가 바뀌면 선택을 버린다(보이지 않는 것을 지우지 않게)
    })
    return () => { alive = false }
    // showToast는 ToastProvider가 매 렌더 새 함수를 주지 않으므로 넣지 않아도 안전하고,
    // 넣으면 의존성 배열의 의도(조회 트리거 4가지)가 흐려진다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // conversationId도 조회 트리거다(round07g) — 대화 id는 `?c=` 복원·새 검색으로
    // **나중에 정해지는** 값이라, 여기 없으면 목록이 최초 범위에 굳어 다른 대화의
    // 산출물을 계속 보여 준다. 위 게이트 ②가 「없음 → 있음」 전이를 타는 자리이기도
    // 하다: 재개가 끝나 대화가 정해지는 순간 이 이펙트가 다시 돌아 목록이 채워진다.
  }, [kind, q, page, refreshKey, conversationId])

  const toggle = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  // 전체선택은 **현재 페이지(rows)만** 대상으로 한다(디스크립션 5-3) — 다음 페이지의
  // 보이지 않는 행까지 고르면, 이어지는 삭제가 사용자가 보지 못한 자료를 되돌릴 수
  // 없이 지우는 사고가 된다.
  const toggleAll = () =>
    setSelectedIds((prev) => (prev.length === rows.length ? [] : rows.map((r) => r.id)))

  const handleDelete = async () => {
    setConfirming(false)
    const requested = selectedIds.length
    const res = await deleteOutputs(selectedIds)
    if (!res.ok) return showToast(res.notice)
    // 서버가 {deleted, requested}를 내는 것은 **화면이 차이를 보여줄 수 있게** 하기
    // 위해서다(routes.py delete_outputs 도크스트링). 타인 소유·이미 지워진 id는 조용히
    // 빠지는데, 그 침묵을 여기서도 이어받으면 사용자는 지운 줄 알고 목록에 남은 카드를
    // 보게 된다. 요청 수와 다르면 그 사실을 그대로 말한다.
    const deleted = res.data?.deleted ?? requested
    if (deleted !== requested) {
      showToast(`${requested}건 중 ${deleted}건만 삭제되었습니다`)
    }
    setSelectedIds([])
    // 목록 재조회는 부모(컨텍스트 outputsVersion)에 맡긴다 — 여기서 지역 카운터로
    // 다시 읽으면 탭 뱃지(SearchFlowLayout)는 삭제를 영영 모른다.
    onChanged?.()
  }

  const handleDownload = async (output) => {
    const res = await downloadOutputFile(output.id, output.file_name)
    if (!res.ok) return showToast(res.notice)
    triggerBrowserDownload(res.blob, res.filename)
  }

  return (
    <section className="output_list">
      <div className="output_list_head">
        <div className="output_list_tabs">
          {TABS.map((t) => (
            <button
              key={t.label}
              type="button"
              className={`output_list_tab${kind === t.key ? ' is_active' : ''}`}
              onClick={() => setKind(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          className="output_list_search"
          placeholder="산출물 제목 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

	  <div className="flex items-center justify-between py-16 px-6">
		<div className="output_list_counts">
			<span>총 <b>{total}</b>건</span>
			<span>신규 <b>{newCount}</b>건</span>
		</div>

		<div className="output_list_toolbar">
			<label className="output_list_selectall">
			<input
				type="checkbox"
				aria-label="전체선택"
				checked={rows.length > 0 && selectedIds.length === rows.length}
				onChange={toggleAll}
			/>
			<span>전체선택</span>
			</label>
			<button
				type="button"
				disabled={selectedIds.length === 0}
				onClick={() => setConfirming(true)}
				>
				{selectedIds.length === 0 ? ('삭제') : (<><span>{selectedIds.length}</span>삭제</>)}
			</button>
		</div>
	  </div>

      {/* 빈 상태는 **왜 비었는지**를 말한다(round07g 수정 R1). 세 사유가 다르고,
          「없다」 한 마디로 뭉치면 사용자가 할 수 있는 다음 행동이 사라진다 —
          이 레포의 다른 빈 상태(EmptyState·OutputTab:412)와 같은 「사실 — 다음
          행동」 짜임이다. 특히 셋째 줄이 「전체가 없다」가 아니라 「이 대화에서
          만든 것이 없다」라고 말해야 한다: 이 목록은 이제 대화 하나만 본다.
          둘째 줄에 「검색해 주세요」를 쓰지 않는 것은 문체 취향이 아니다 — 위쪽
          노드 패널의 무결과 문구(OutputTab:412)가 그 말을 이미 하고 있어, 한 화면에
          같은 문장이 두 번 뜨면 사용자가 어느 쪽이 비었는지 알 수 없다. */}
      {rows.length === 0 ? (
        <p className="output_list_empty">
          {!isLive()
            ? '데모 모드에서는 산출물 목록을 보여주지 않습니다 — 서버에 연결하면 생성한 산출물이 여기에 쌓입니다.'
            : !conversationId
              ? '산출물은 그 대화에서 만든 것만 보여줍니다 — 아직 볼 대화가 정해지지 않았습니다. 왼쪽 「나의 기록」에서 대화를 열면 그 대화의 산출물이 여기에 뜹니다.'
              : '이 대화에서 만든 산출물이 없습니다.'}
        </p>
      ) : (
        <div className="output_list_grid">
          {rows.map((row) => (
            <OutputCard
              key={row.id}
              output={row}
              selected={selectedIds.includes(row.id)}
              onToggle={toggle}
              onDownload={handleDownload}
              onOpenDetail={openDetail}
            />
          ))}
        </div>
      )}

      <div className="output_list_pagination">
        <button type="button" aria-label="처음 페이지" disabled={page === 0}
                onClick={() => setPage(0)}>«</button>
        <button type="button" aria-label="이전 페이지" disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}>‹</button>
        {pageNumbers(page, Math.max(1, Math.ceil(total / PAGE_SIZE))).map((n, i) =>
          n === '…' ? (
            <span key={`gap-${i}`} className="output_list_pagination_gap">…</span>
          ) : (
            <button
              key={n}
              type="button"
              aria-label={`${n + 1} 페이지`}
              aria-current={n === page ? 'page' : undefined}
              className={`output_list_pagination_num${n === page ? ' is_active' : ''}`}
              onClick={() => setPage(n)}
            >
              {n + 1}
            </button>
          )
        )}
        <button type="button" aria-label="다음 페이지" disabled={!hasMore}
                onClick={() => setPage((p) => p + 1)}>›</button>
        <button type="button" aria-label="마지막 페이지" disabled={!hasMore}
                onClick={() => setPage(Math.max(0, Math.ceil(total / PAGE_SIZE) - 1))}>»</button>
      </div>

      {/* 퍼블 #history_delete_alert 미러(ConfirmPopup) — LnbHistory.jsx와 같은 컴포넌트·
          같은 기본 문구를 쓴다. 인용문에 **선택 건수**를 넣는 것이 이 화면의 몫이다:
          여기서 지우는 것은 이름 하나가 아니라 최대 20건이라, 무엇이 날아가는지는
          "몇 건인가"로만 말할 수 있다. */}
      <ConfirmPopup
        open={confirming}
        quote={`선택한 산출물 ${selectedIds.length}건`}
        desc="삭제한 산출물은 되돌릴 수 없습니다. 삭제하시겠습니까?"
        onConfirm={handleDelete}
        onCancel={() => setConfirming(false)}
      />
    </section>
  )
}
