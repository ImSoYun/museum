import { createContext, useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { listProjects } from '../lib/projectsApi.js'

export const LibraryContext = createContext(null)

const PAGE_SIZE = 20

// 목록 화면의 정확한 경로. Task 6이 만드는 상세 경로(/library/:projectId)는 이 값으로
// *시작*하지만 같은 경로는 아니다 — startsWith로 넓게 잡으면 상세 화면에서도 목록을
// 다시 부르게 된다(리뷰 지적). 반드시 정확히 일치할 때만 조회한다.
const LIBRARY_LIST_PATH = '/library'

/**
 * LibraryProvider — 라이브러리 목록의 서버 연결(round10 Task5, 리뷰 fix 포함).
 *
 * round07g까지는 useReducer + mock 시드(data/searchHistory.js)로 카드를 흉내 냈다 —
 * 프로젝트 저장·조회 서버가 아직 없었기 때문이다. Task 1~4가 그 서버와 클라이언트
 * (lib/projectsApi.js)를 완성했으므로 이 Provider는 이제 listProjects 하나만 부른다.
 * addProject/renameProject/removeProject/setEncryption/updateShare 같은 로컬 변이
 * 액션은 전부 걷어낸다 — 프로젝트의 정본은 서버이고, 이 Provider가 로컬에서 목록을
 * 조작할 이유가 없다(저장 자체는 LnbHistory.jsx가 saveProject로 직접 하고, 이
 * Provider를 거치지 않는다 — 저장 후 라이브러리를 다시 열면 reload가 새로 조회한다).
 *
 * 검색어·페이지가 바뀌면 다시 부른다(브리프 Step3). 실패는 조용히 빈 목록으로
 * 삼키지 않고 error로 드러낸다(코딩표준 §6 — 침묵의 예외 무시 금지) — projects는
 * 비우되 error 문구로 사유를 남겨 화면이 안내할 수 있게 한다.
 *
 * 리뷰 fix — 조회를 라이브러리 목록 화면으로 한정한다. 이 Provider는
 * layouts/AppShell.jsx:78에서 **모든 라우트**를 감싼다(그 중첩 구조 자체는 이 라운드
 * 범위 밖이라 AppShell.jsx는 건드리지 않는다). useLibrary()의 프로덕션 소비처는
 * pages/Library.jsx 하나뿐인데(레포 전체 grep으로 확인), 예전 구현은 마운트만 되면
 * 무조건 listProjects를 불렀다 — 그 결과 '/'·'/search'·'/manage/*'·'/system/*' 등
 * 라이브러리와 무관한 모든 화면에서도 버려질 /projects 요청이 매번 나갔고, 그 응답이
 * 각 화면 테스트의 act() 범위 밖에서 정착해 불필요한 "not wrapped in act(...)" 경고까지
 * 냈다. useLocation()으로 현재 경로를 보고, 정확히 '/library'(목록 화면)일 때만
 * 조회하도록 좁힌다.
 *
 * isLibraryList가 useEffect 의존성에 들어 있으므로, 다른 화면 → '/library'로 다시
 * 들어오면 그 전환 자체가 "새 실행 조건"이라 자동으로 다시 조회된다(저장 직후 목록으로
 * 돌아오면 새 카드가 보여야 하므로, 최초 한 번만 받고 끝나는 형태가 되면 안 된다).
 *
 * loading 초기값은 true다. 목록 화면이 아닌 동안은 조회 자체를 안 하니 이 값이
 * 갱신되지 않지만, 이 값을 읽는 유일한 소비처(Library.jsx)는 라우트 자체가
 * '/library'일 때만 마운트된다(router.jsx) — 그 화면에 있는 한 게이트는 항상 true라
 * 조회가 실행되고 loading은 정상적으로 false로 정착한다. "아무도 안 보는 화면에서
 * 영영 true로 남는" 값이 문제되는 소비처는 없다.
 */
export function LibraryProvider({ children }) {
  const { pathname } = useLocation()
  const isLibraryList = pathname === LIBRARY_LIST_PATH

  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQueryState] = useState('')
  // 0-base — offset = page * PAGE_SIZE (lib/projectsApi.js의 listProjects 계약).
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)

  // 검색어를 바꾸면 페이지를 1페이지로 되돌린다 — 3페이지를 보다가 검색하면 그
  // 페이지엔 결과가 없을 수 있다(OutputList.jsx의 같은 관행과 동일한 이유). 한
  // 콜백 안에서 두 state를 함께 바꾸므로(React 18 자동 배칭) 아래 조회 effect는
  // 이 조합으로 정확히 한 번만 다시 돈다.
  const setQuery = useCallback((next) => {
    setQueryState(next)
    setPage(0)
  }, [])

  const reload = useCallback(() => setReloadTick((n) => n + 1), [])

  useEffect(() => {
    if (!isLibraryList) return
    let alive = true
    setLoading(true)
    setError(null)
    listProjects({ q: query, limit: PAGE_SIZE, offset: page * PAGE_SIZE }).then((res) => {
      if (!alive) return
      if (!res.ok) {
        setProjects([])
        setHasMore(false)
        setError(res.notice || '라이브러리 목록을 불러오지 못했습니다')
        return
      }
      setProjects(res.projects)
      setHasMore(res.hasMore)
    }).finally(() => {
      if (alive) setLoading(false)
    })
    return () => { alive = false }
  }, [isLibraryList, query, page, reloadTick])

  const value = { projects, loading, error, query, setQuery, page, setPage, hasMore, reload }
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}
