/**
 * 이 파일의 책임: AppShell의 **셸 레벨** env 게이트(round06f 갈래 E, spec §10.2).
 *
 * round06e에서는 이 한 곳이 6개 라우트를 전부 덮었다. round06f가 판정을 둘로 나눠
 * 탭줄이 있는 /search/*·/system/*만 페이지 레벨 <EnvGate>로 옮기고, 보존할 탭줄이
 * 없다고 판단한 /library·/manage는 셸에 남겨 뒀었다. A8(round06b)이 재검증한 결과
 * manage 5개 페이지가 전부 ManageTabs를 이미 렌더하고 있어(셸 게이트가 그 탭까지
 * 가리는 배치 불일치) /library·/manage도 페이지 레벨로 옮겼다 — 이제 셸 레벨
 * 게이트 대상은 PAGE_LEVEL_PREFIXES(=/search·/system·/library·/manage) 전부를
 * 제외하고 나면 없다(envGates.js).
 *
 * 그래서 이 스위트가 확인하는 것은 "셸이 무엇을 맡고 무엇에서 손을 떼는가"다.
 * 페이지 레벨 게이트의 실제 렌더는 여기서 볼 수 없다 — 이 스위트의 라우트는 실제
 * 페이지가 아니라 인라인 <div> 스텁이라 <EnvGate>가 개입할 자리가 없기 때문이다.
 * 그쪽은 Monitoring/Nodes/Log.test.jsx·SearchFlowLayout.test.jsx와, A8부터는
 * Library.test.jsx·manage/{Ocr,Meta,Embedding,History,Materials}.test.jsx의
 * "prod 환경" 케이스가 지킨다.
 *
 * 기존 AppShell.test.jsx와 별도 파일이다(테스트 파일 간 import 금지 관례) — renderAt
 * 헬퍼가 겹치지만 appEnv 오버라이드가 추가된 버전을 이 파일 안에 다시 둔다.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ToastProvider } from '../components/Toast.jsx'
import { ScenarioProvider } from '../context/ScenarioContext.jsx'
import { AuthProvider, AuthContext, useAuth } from '../context/AuthContext.jsx'
import AppShell from './AppShell.jsx'

beforeEach(() => {
  window.localStorage.clear()
})

// ResultsTab.test.jsx의 Overrides 관행과 동일 — 실제 AuthProvider 트리는 그대로 통과시키고
// appEnv 한 필드만 테스트가 원하는 값으로 덮어쓴다.
function EnvOverride({ appEnv, children }) {
  const ctx = useAuth()
  return <AuthContext.Provider value={{ ...ctx, appEnv }}>{children}</AuthContext.Provider>
}

function renderAt(path, appEnv) {
  return render(
    <ToastProvider>
      <AuthProvider>
        <EnvOverride appEnv={appEnv}>
          <ScenarioProvider>
            <MemoryRouter initialEntries={[path]}>
              <Routes>
                <Route element={<AppShell />}>
                  <Route path="/library" element={<div>라이브러리본문</div>} />
                  <Route path="/system/monitoring" element={<div>모니터링본문</div>} />
                  <Route path="/system/accounts" element={<div>계정권한본문</div>} />
                  <Route path="/search/output" element={<div>산출물본문</div>} />
                </Route>
              </Routes>
            </MemoryRouter>
          </ScenarioProvider>
        </EnvOverride>
      </AuthProvider>
    </ToastProvider>,
  )
}

test('local 환경: /library는 정상 본문이 뜨고 준비중 화면이 없다', () => {
  renderAt('/library', 'local')
  expect(screen.getByText('라이브러리본문')).toBeInTheDocument()
  expect(screen.queryByText('준비 중입니다')).toBeNull()
})

// A8(round06b) — /library는 이제 셸이 맡지 않는다(페이지 레벨 EnvGate 몫으로 이관).
// 이 스위트의 '/library' 라우트는 실제 Library.jsx가 아니라 인라인 <div> 스텁이라
// EnvGate가 개입할 자리가 없으므로, 셸이 더 이상 막지 않으면 스텁 본문이 그대로
// 보인다 — 실제 prod 차단은 Library.test.jsx의 "prod 환경" 케이스가 지킨다.
test('prod 환경: /library도 셸이 막지 않는다(A8 — 페이지 레벨 EnvGate 몫)', () => {
  renderAt('/library', 'prod')
  expect(screen.getByText('라이브러리본문')).toBeInTheDocument()
  expect(screen.queryByText('준비 중입니다')).toBeNull()
})

// round06f 갈래 E(spec §10.2) — /system/*은 셸이 더 이상 맡지 않는다. 셸이 <Outlet>을
// 통째로 갈아치우면 그 화면들이 그리는 SystemTabs까지 함께 사라지기 때문이다.
// 실제 준비중 렌더는 각 페이지 스위트가 지킨다(Monitoring/Nodes/Log.test.jsx).
test('prod 환경: /system/monitoring은 셸이 막지 않는다(페이지 레벨 EnvGate 몫 — §10.2)', () => {
  renderAt('/system/monitoring', 'prod')
  expect(screen.getByText('모니터링본문')).toBeInTheDocument()
  expect(screen.queryByText('준비 중입니다')).toBeNull()
})

// /search/output도 같다 — 셸이 막으면 SearchFlowLayout의 검색바·page_tabs가 사라진다.
test('prod 환경: /search/output도 셸이 막지 않는다(SearchFlowLayout의 EnvGate 몫)', () => {
  renderAt('/search/output', 'prod')
  expect(screen.getByText('산출물본문')).toBeInTheDocument()
  expect(screen.queryByText('준비 중입니다')).toBeNull()
})

test('prod 환경에서도 /system/accounts는 정상 본문이 뜬다(계정·권한은 env 숨김 대상이 아니다)', () => {
  renderAt('/system/accounts', 'prod')
  expect(screen.getByText('계정권한본문')).toBeInTheDocument()
  expect(screen.queryByText('준비 중입니다')).toBeNull()
})

test('prod 환경 준비중 화면에서도 셸 직계 자식은 3개다(skip link·LNB·main — wrap.children 계약 불변)', () => {
  renderAt('/library', 'prod')
  const wrap = document.querySelector('.library_wrap')
  expect(wrap.children).toHaveLength(3)
})
