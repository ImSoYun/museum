/**
 * AuthContext.jsx — 세션 인증 상태(round06c F1, spec §9.1·§9.5, 컨트롤러 결정 C-D2/C-D3).
 *
 * 무엇을 한다
 *  - 부팅 시 세션을 로드한다: isLive()(VITE_API_BASE_URL 설정됨)면 GET /auth/me(credentials
 *    include)로 실제 세션을 확인한다 — 200이면 authed, 401이면 anon.
 *  - !isLive()(테스트·백엔드 없는 데모/프리뷰)면 fetch를 아예 하지 않고 기본 authed(데모 사용자)로
 *    둔다(C-D3). 데모 auto-auth가 보안 약화가 아닌 이유: 실제 보안 경계는 백엔드 require_user이고,
 *    라이브 환경(isLive()===true)에서는 반드시 서버 왕복으로 세션을 확인하기 때문이다.
 *  - login(loginId, loginPw): POST /auth/login. 성공(200)은 { user } 래핑을 벗겨 authed로 전환.
 *    실패(401 자격불일치·403 승인상태)는 호출부(Login 화면, F3)가 분기할 수 있도록 상태코드+detail을
 *    담은 Error를 throw한다.
 *  - logout(): POST /auth/logout 후(성공 실패 무관) anon으로 전환 — 쿠키는 서버가 만료시키거나
 *    이미 무효화됐을 수 있으므로 클라 상태는 항상 정리한다. 이번 방문에서 연 프로젝트
 *    기억도 함께 비운다(clearOpenedProjects — round10a 최종리뷰 I-3, state/openedProjects.js
 *    머리주석 "계정이 바뀌면 지운다" 참조. SPA 내 로그아웃→다른 계정 로그인은 페이지를
 *    다시 읽지 않아 그 모듈 메모리가 그대로 남는다).
 *  - searchApi/chatApi가 res.status===401을 만나면 authEvents.notifyUnauthorized()를 호출하고,
 *    이 Provider가 그 통지를 받아 anon으로 전환한다(모듈 레벨 핸들러 — 순환 의존 회피, §9.5).
 *    세션 만료도 로그아웃과 같은 계정 경계라 여기서도 clearOpenedProjects를 부른다(I-3).
 *
 * ⚠️ 이 태스크(F1)는 리다이렉트 게이트를 넣지 않는다 — status==='anon'이어도 화면은 그대로 렌더된다.
 *    게이트(RequireAuth)는 F2 몫이다.
 *
 * 테스트 시드 seam — 두 가지
 *  ① <AuthProvider seed={{ user, status }}>: 가장 흔한 경우. seed가 주어지면 부팅 fetch를
 *     완전히 건너뛰고 그 값을 초기 상태로 그대로 쓴다(entered as-is — user:null + status:'anon'
 *     조합도 가능). ScenarioProvider 관행과 달리 매 렌더 재적용하지 않는다(useState lazy init) —
 *     한 테스트 안에서 seed를 바꾸며 재마운트하는 것을 기대하는 시나리오이기 때문.
 *  ② <AuthContext.Provider value={...}>: login/logout까지 mock으로 완전히 갈아끼우고 싶을 때
 *     (ScenarioContext.jsx의 "Provider를 거치지 않고 직접 주입" 관행과 동일).
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { isLive } from '../lib/searchApi.js'
import { registerUnauthorizedHandler } from '../lib/authEvents.js'
import { clearOpenedProjects } from '../state/openedProjects.js'

const BASE = import.meta.env.VITE_API_BASE_URL

// !isLive() 데모/프리뷰 기본 사용자(C-D3). 백엔드가 없는 환경(정적 프리뷰·대부분의 단위 테스트)에서
// 앱이 곧바로 authed로 렌더되도록 한다. 통합관리자로 둔 이유는 데모 방문자가 관리자 화면까지
// 포함해 전 화면을 둘러볼 수 있어야 하기 때문(라이브 환경의 실제 권한은 서버 role이 결정하므로
// 이 기본값이 보안 경계에 관여하지 않는다).
// round10b Task C — 사용자 결정(2026-09-17) "이메일관련은 다 빼": email 키를
// 뺐다(세션 응답 계약 자체에 더 이상 그 필드가 없다 — auth/routes.py:_summarize).
export const DEMO_MOCK_USER = {
  id: 0,
  username: 'demo',
  display_name: '김연구',
  role: '통합관리자',
  status: 'approved',
  is_root: false,
  dept: null,
}

// Provider 밖(또는 아직 로그인 액션이 필요 없는 화면)에서 useAuth()가 죽지 않도록 하는 안전값.
// ScenarioContext.useScenario()는 의도적으로 throw하지만(누락을 조기 발견), AuthContext는
// 훨씬 넓은 화면에서 소비될 것이므로(§9.1 — 양 계층 공통 조상) 누락 시에도 렌더가 이어지게 한다.
const NOOP_ASYNC = async () => {}
const DEFAULT_VALUE = {
  user: DEMO_MOCK_USER,
  status: 'authed',
  login: async () => {
    throw Object.assign(new Error('AuthProvider 밖에서는 로그인할 수 없습니다'), { status: 0 })
  },
  logout: NOOP_ASYNC,
  appEnv: 'local',
  searchModesEnabled: true,
}

// round06e 최종 리뷰 F1 — 부팅 GET /auth/me 200 분기와 login() 성공 분기가
// 같은 규칙으로 환경 신호(app_env·search_modes_enabled)를 적용하도록 공유한다.
// 이전에는 부팅 200 분기에서만 setAppEnv를 호출해, "부팅 401(비로그인) →
// RequireAuth → 로그인 성공"이라는 운영의 지배적 경로에서 appEnv가 계속
// null로 남아 prod 게이트(isEnvHidden)가 통째로 무력화됐다(로그인 응답에는
// 신호가 없었기 때문 — 브리프 블로커). login 응답에도 같은 두 키를 싣고
// 여기서 함께 적용해 리로드 없이도 즉시 게이트가 유효해지게 한다.
//
// 반환하는 appEnvApplied===false는 "페이로드에 유효한 app_env가 없었다"는
// 뜻 — 호출부가 라이브+인증 상황에서 이를 침묵 실패로 보고(console.warn)할지
// 판단하는 데 쓴다(코딩표준 §6 침묵 실패 금지). 이 함수 자체는 부수효과로
// setState만 하고 warn은 하지 않는다 — 호출부마다 warn 조건(isLive 등)이
// 다를 수 있어 판단을 분리해 둔다.
function applyEnvSignals(payload, setAppEnv, setSearchModesEnabled) {
  const appEnvApplied = !!payload && typeof payload.app_env === 'string'
  if (appEnvApplied) setAppEnv(payload.app_env)
  if (payload && typeof payload.search_modes_enabled === 'boolean') {
    setSearchModesEnabled(payload.search_modes_enabled)
  }
  return { appEnvApplied }
}

export const AuthContext = createContext(null)

export function AuthProvider({ children, seed }) {
  const seeded = seed !== undefined

  const [user, setUser] = useState(() => {
    if (seeded) return seed.user ?? null
    return isLive() ? null : DEMO_MOCK_USER
  })
  const [status, setStatus] = useState(() => {
    if (seeded) return seed.status ?? (seed.user ? 'authed' : 'anon')
    return isLive() ? 'loading' : 'authed'
  })

  // round06e — 환경 신호와 기능 플래그. 서버가 /auth/me 로 내려준다.
  // 더미 모드(!isLive)에는 서버가 없다 → local·true 로 두어 전 화면이 보이게 한다
  // (데모/프리뷰 방문자가 막히면 안 된다).
  const [appEnv, setAppEnv] = useState(() => (isLive() ? null : 'local'))
  const [searchModesEnabled, setSearchModesEnabled] = useState(true)

  // 부팅 세션 로드 — seed가 있으면(테스트) 건너뛴다. isLive()가 아니면(C-D3) 건너뛴다.
  useEffect(() => {
    if (seeded) return
    if (!isLive()) return
    let alive = true
    fetch(`${BASE}/auth/me`, { credentials: 'include' })
      .then((res) => {
        if (res.status === 401) {
          if (alive) { setUser(null); setStatus('anon') }
          return null
        }
        return res.json()
      })
      .then((me) => {
        if (!alive || me == null) return
        // GET /auth/me는 bare user summary(래핑 없음) — login({user})과 다르다(brief 주의사항).
        setUser(me)
        setStatus('authed')
        const { appEnvApplied } = applyEnvSignals(me, setAppEnv, setSearchModesEnabled)
        if (!appEnvApplied) {
          // 이 분기는 isLive()일 때만 실행되므로(부팅 effect 상단 가드) 이미 "라이브
          // 모드 + 인증됨" 조건을 만족한다 — 서버가 app_env를 안 실었다는 뜻이다.
          console.warn('[AuthContext] /auth/me 응답에 app_env가 없어 prod 게이트가 무력화될 수 있습니다(백엔드 버전 확인 필요)')
        }
      })
      .catch(() => {
        if (alive) { setUser(null); setStatus('anon') }
      })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 부팅 1회만
  }, [])

  // 401 인터셉트 등록 — searchApi/chatApi 어느 fetch에서든 401이 나오면 anon으로 전환한다.
  useEffect(() => {
    return registerUnauthorizedHandler(() => {
      setUser(null)
      setStatus('anon')
      // round10a 최종리뷰 I-3 — 세션 만료도 로그아웃과 같은 계정 경계다(위 logout()과
      // 같은 이유). 여기서 비우지 않으면 세션이 끊긴 채로 남은 프로젝트 메타를 다음
      // 로그인 사용자가 그대로 물려받는다.
      clearOpenedProjects()
    })
  }, [])

  const login = useCallback(async (loginId, loginPw) => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login_id: loginId, login_pw: loginPw }),
    })
    if (res.status === 200) {
      // login 응답은 { user: {...} } 래핑 — me(bare)와 다르다(brief 주의사항, spec §0/브리프 §계약).
      // app_env·search_modes_enabled는 user와 형제 키로 실린다(부팅 me 응답과 같은 두 키,
      // round06e 최종 리뷰 F1 — 부팅 401 → 로그인 성공 경로에서도 게이트가 즉시 유효해야 한다).
      const data = await res.json()
      setUser(data.user)
      setStatus('authed')
      const { appEnvApplied } = applyEnvSignals(data, setAppEnv, setSearchModesEnabled)
      if (isLive() && !appEnvApplied) {
        console.warn('[AuthContext] /auth/login 응답에 app_env가 없어 prod 게이트가 무력화될 수 있습니다(백엔드 버전 확인 필요)')
      }
      return data.user
    }
    // 401(자격불일치)·403(승인대기/거부/차단) — 호출부가 상태코드로 분기하도록 detail과 함께 던진다.
    let detail
    try { detail = (await res.json()).detail } catch { /* 본문이 JSON이 아니면 무시 */ }
    throw Object.assign(new Error(detail || '로그인에 실패했습니다'), { status: res.status, detail })
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch(`${BASE}/auth/logout`, { method: 'POST', credentials: 'include' })
    } finally {
      // 요청 성패와 무관하게 클라 상태는 항상 anon으로 — 쿠키가 이미 무효했을 수도 있다.
      setUser(null)
      setStatus('anon')
      // round10a 최종리뷰 I-3 — 다음 사람에게 이번 방문에서 연 프로젝트가 그대로
      // 열리면 안 된다(openedProjects.js 머리주석 "계정이 바뀌면 지운다"). SPA 내
      // 로그아웃은 페이지를 다시 읽지 않아 모듈 메모리가 남으므로 여기서 직접 비운다.
      clearOpenedProjects()
    }
  }, [])

  const value = { user, status, login, logout, appEnv, searchModesEnabled }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  return ctx ?? DEFAULT_VALUE
}
