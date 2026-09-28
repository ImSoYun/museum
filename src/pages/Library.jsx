import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import EnvGate from '../components/EnvGate.jsx'
import EmptyState from '../components/EmptyState.jsx'
import PasswordModal from '../components/PasswordModal.jsx'
import Pagination from '../components/Pagination.jsx'
import { useLibrary } from '../state/useLibrary.js'
import { openProject } from '../lib/projectsApi.js'
import { useToast } from '../components/useToast.js'
import icSparkle from '../assets/icons/ic_sparkle.svg'
import icSearchBtn from '../assets/icons/ic_search_btn.svg'
import icCalendar from '../assets/icons/ic_calendar.svg'
import icCertified from '../assets/icons/ic_certified.svg'
import icDocument from '../assets/icons/ic_document.svg'
import avatar1 from '../assets/etc/avatar_01.png'

/**
 * 이 파일의 책임: 라이브러리 목록 화면(round10 Task5 — 실데이터). 서버가 내려준 프로젝트
 * 메타(projects/routes.py `_serialize(with_restore=False)` — id·title·description·author·
 * has_password·output_count·created_at)를 그대로 그린다. 카드 클릭은 이제 실제로 프로젝트를
 * 열고(openProject), 상세 화면(/library/:projectId, Task 6)으로 그 응답을 들고 이동한다 —
 * 상세 화면 자체는 이 태스크의 몫이 아니다(경로 이동만 한다).
 *
 * ⚠️ round10 최종리뷰 M-7 — 목록 응답에는 search_query·search_mode·conversation_id 가 **없다.**
 * 이 화면이 그 셋을 쓰지 않는데도 실려 나가던 것을 서버에서 걷었다(암호가 걸린 프로젝트의 저장
 * 질의가 암호 없이 목록 본문으로 나가던 결함). 상세가 쓰는 그 셋은 `POST /projects/{id}/open`
 * 응답에서 온다 — 아래 handleOpen 이 그 응답을 그대로 navigate state 로 넘긴다.
 *
 * round06c-ext D2c(이전 라운드)의 유물과 처분:
 *  - 시나리오 복원(restoreScenario)·산출물 딥링크(/search/output 이동) — 완전히 걷어냈다.
 *    useScenario/scenarios.js를 더 이상 참조하지 않는다. 카드에는 이제 목적지가 하나뿐이다.
 *  - 공유 카운트(AvatarStack) — 서버 프로젝트 응답에 shared 필드가 없다. 없는 값을
 *    꾸며 보여주지 않는다(§"거짓 UI 금지").
 *  - 댓글 카운트 — spec Global Constraints: 댓글은 만들지 않는다. 아이콘·버튼 둘 다
 *    그리지 않는다(Library.test.jsx가 부재를 잠근다).
 *  - 뷰 토글(카드/목록)·목록형 표 — **round10c에서 걷어냈다(사용자 결정 2026-09-18:
 *    「나는 카드형만 필요한건데」).**
 *
 *    퍼블 library.html:557-578은 7열 표(작성자/프로젝트명/생성일/공유/코멘트/산출물/
 *    비밀번호)와 뷰 토글을 갖는다. 그런데 그 표의 존재 이유인 **공유(아바타 스택)·코멘트**
 *    두 열이 우리 화면엔 없었다 — 공유는 서버 응답에 shared 필드가 없어서, 댓글은
 *    spec Global Constraints가 만들지 않기로 해서다. 남은 5열은 **한 열도 빠짐없이
 *    카드형에 이미 있는 것**이라(작성자는 공유가 없어 전부 같은 값이다) 목록형은 같은
 *    정보를 세로로 늘어놓기만 했다.
 *
 *    ⚠️ 이것은 "미개발 UI를 지우지 않는다"는 이 프로젝트의 관행(독음·언어 드롭다운처럼
 *    모델만 안 붙은 자리는 그대로 둔다)의 **예외가 아니라 다른 층의 결정**이다 — 모델이
 *    안 붙은 게 아니라 **화면이 필요 없다**는 제품 판단이고, 사용자가 직접 내렸다.
 *    공유 기능이 붙어 이 표가 다시 뜻을 갖게 되면 퍼블 마크업이 그대로 남아 있으므로
 *    (workspace/design/publish-v2/page/library.html) 되살리는 비용은 작다.
 *
 * 암호 처리(브리프 결정 3) — 카드 클릭 시 has_password로 갈린다. 암호가 없으면
 * openProject(id)를 바로 불러 성공 응답을 상세로 들고 간다. 암호가 있으면 먼저
 * PasswordModal을 띄우고, 제출한 암호로 openProject(id, pw)를 부른다 — 200이면 이동,
 * 403이면 모달을 닫지 않고 "암호가 맞지 않습니다"만 채운다. 어느 경로든 상세로 넘어갈
 * 때는 방금 받은 응답(project·outputIds)을 navigate state로 함께 실어, 상세 화면이
 * 같은 요청을 두 번 하지 않게 한다(암호를 또 묻지 않는다).
 *
 * spec Global Constraints — 암호 통과 상태를 세션·쿠키·localStorage 어디에도 남기지
 * 않는다. pwTarget·pwError·busy는 전부 이 컴포넌트의 인메모리 state일 뿐이라 새로고침·
 * 재방문이면 다시 묻는다(추가 조치가 필요 없다 — 애초에 아무 데도 저장하지 않는다).
 */

// created_at은 서버가 ISO 문자열로 준다(projects/routes.py:59-71) — OutputCard.jsx의
// 같은 관행(new Date(...).toLocaleString('ko-KR'))을 그대로 따른다. 원문 ISO를 그대로
// 보여주면 사람이 읽기 어렵다.
const formatCreatedAt = (iso) => new Date(iso).toLocaleString('ko-KR')

export default function Library() {
  const nav = useNavigate()
  const { showToast } = useToast()
  const { projects, loading, error, query, setQuery, page, setPage, hasMore, reload } = useLibrary()
  const [searchInput, setSearchInput] = useState(query)
  // 암호 입력 중인 프로젝트. null이면 모달이 닫혀 있다.
  const [pwTarget, setPwTarget] = useState(null)
  const [pwError, setPwError] = useState(null)
  // openProject 왕복이 나가 있는 동안 true — PasswordModal의 중복 제출을 막는다.
  const [busy, setBusy] = useState(false)

  const openDetail = (id, res) => {
    nav(`/library/${encodeURIComponent(id)}`, {
      state: { project: res.project, outputIds: res.outputIds },
    })
  }

  // round10 사용자 결정(2026-09-16) — **자기가 만든 프로젝트는 암호를 묻지 않는다.**
  // 그래서 `has_password` 만 보고 모달을 먼저 띄우지 않고, 일단 열어 본 뒤 서버가
  // 401(암호 필요)을 줄 때만 묻는다. 「누가 주인인가」를 화면이 따로 알 필요가 없다 —
  // 판정은 서버 한 곳(owner_id_of)에 있고, 응답에 내부 사용자 id 를 싣지 않아도 된다.
  // 자물쇠 배지는 그대로 `has_password` 를 따른다(남에게 잠겨 있다는 사실은 사실이다).
  const handleOpen = async (item) => {
    setBusy(true)
    const res = await openProject(item.id)
    setBusy(false)
    if (res.ok) {
      openDetail(item.id, res)
      return
    }
    if (res.status === 401) {
      setPwError(null)
      setPwTarget(item)
      return
    }
    // 실패를 조용히 삼키지 않는다(코딩표준 §6) — 목록 화면은 그대로 두고 무엇이
    // 잘못됐는지만 알린다.
    showToast('프로젝트를 열지 못했습니다')
  }

  const handlePasswordSubmit = async (pw) => {
    if (!pwTarget) return
    setBusy(true)
    const res = await openProject(pwTarget.id, pw)
    setBusy(false)
    if (res.ok) {
      const id = pwTarget.id
      setPwTarget(null)
      openDetail(id, res)
      return
    }
    setPwError(res.status === 403 ? '암호가 맞지 않습니다' : '프로젝트를 열지 못했습니다')
  }

  const handleCancelPassword = () => {
    if (busy) return
    setPwTarget(null)
    setPwError(null)
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setQuery(searchInput)
  }

  // Pagination(components/Pagination.jsx)은 1-base page·totalPages 계약이다. 서버는
  // 전체 건수가 아니라 hasMore(다음 페이지 존재 여부)만 주므로, "적어도 한 페이지 더
  // 있다"만큼만 totalPages를 늘려 다음 버튼을 살린다(정확한 총 페이지 수를 아는 척하지
  // 않는다).
  const totalPages = hasMore ? page + 2 : page + 1


  return (
    <EnvGate>
      <h2 className="sr_only">라이브러리</h2>

      <form className="result_query_bar ty_02" onSubmit={handleSearchSubmit}>
        <img src={icSparkle} alt="" className="result_query_bar_icon" />
        <label className="sr_only" htmlFor="library_query_input">라이브러리 검색</label>
        <input
          type="search"
          className="result_query_bar_input"
          id="library_query_input"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="검색어를 입력해주세요"
        />
        <button type="submit" className="result_query_btn" aria-label="검색">
          <img src={icSearchBtn} alt="" className="result_query_btn_icon" />
        </button>
      </form>

      <div className="library_panel">
        <div className="panel_head ty_gap">
          <h3 className="section_tit">라이브러리</h3>
        </div>

        {error ? (
          <EmptyState title={error} action={{ label: '다시 시도', onClick: reload }} />
        ) : !loading && projects.length === 0 ? (
          <EmptyState title="저장된 프로젝트가 없습니다" />
        ) : (
          <div className="library_card_list">
            {projects.map((item) => (
              <LibraryCard key={item.id} item={item} onOpen={() => handleOpen(item)} />
            ))}
          </div>
        )}

        {!error && <Pagination page={page + 1} totalPages={totalPages} onChange={(p) => setPage(p - 1)} />}
      </div>

      <PasswordModal
        open={!!pwTarget}
        error={pwError}
        busy={busy}
        onCancel={handleCancelPassword}
        onSubmit={handlePasswordSubmit}
      />
    </EnvGate>
  )
}

/* ── Sub-component: LibraryCard ── */
function LibraryCard({ item, onOpen }) {
  return (
    <div className="library_card">
      <div className="library_card_head">
        <img src={avatar1} alt="" className="library_card_avatar" />
        <span className="library_card_writer">{item.author}</span>
      </div>
      <div className="library_card_body">
        <strong className="library_card_tit">
          <button type="button" className="library_card_tit_link" onClick={onOpen}>
            {item.title}
          </button>
        </strong>
        <p className="library_card_desc">{item.description}</p>
        <p className="library_card_date">
          <img src={icCalendar} alt="" className="library_card_date_icon" />
		   {new Date(item.created_at).toLocaleDateString('ko-KR')}
        </p>
        {item.has_password && (
          <button
            type="button"
            className="library_card_lock library_pw_btn"
            aria-label={`${item.title} 비밀번호`}
            onClick={onOpen}
          >
            <img src={icCertified} alt="" className="library_card_lock_icon" />
            비밀번호
          </button>
        )}
      </div>
      <div className="library_card_foot">
        <div className="library_card_counts">
          <span className="library_card_counts_item">
            <img src={icDocument} alt="" className="library_card_counts_icon" />
            {item.output_count}건
          </span>
        </div>
      </div>
    </div>
  )
}
