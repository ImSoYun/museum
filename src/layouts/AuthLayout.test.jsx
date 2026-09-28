/**
 * 이 파일의 책임: 인증 3화면이 셸(LNB) **밖** 계층에 있음을 지킨다.
 * 퍼블 login/join/find.html의 최상위는 .auth_wrap 하나뿐이고 .lnb 마크업이 없다(spec §7.0.1).
 * 라우터 배열을 직접 렌더해 계층 분리 자체를 검증한다 — 컴포넌트 단독 렌더로는 계층을 볼 수 없다.
 */
import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '../router.jsx'
import { ToastProvider } from '../components/Toast.jsx'
import { ScenarioProvider } from '../context/ScenarioContext.jsx'

function renderAt(path) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <ToastProvider>
      <ScenarioProvider><RouterProvider router={router} /></ScenarioProvider>
    </ToastProvider>,
  )
}

test('인증 3경로(/login·/join·/find)는 LNB 없이 .auth_wrap 으로 렌더된다', () => {
  for (const path of ['/login', '/join', '/find']) {
    const view = renderAt(path)
    expect(screen.queryByRole('navigation', { name: '주요메뉴' })).toBeNull()
    expect(document.querySelector('.auth_wrap')).not.toBeNull()
    expect(document.querySelector('main.auth_inner')).not.toBeNull()
    view.unmount()
  }
})

test('셸 라우트(/)는 LNB를 가지며 .auth_wrap 이 아니다', () => {
  renderAt('/')
  expect(screen.getByRole('navigation', { name: '주요메뉴' })).toBeInTheDocument()
  expect(document.querySelector('.auth_wrap')).toBeNull()
})

test('AuthLayout 공통 껍데기(로고·푸터 문구)가 세 화면에 공통으로 나온다', async () => {
  const CASES = [
    ['/login', '로그인'],
    ['/join', '회원가입'],
    ['/find', '아이디·비밀번호 찾기'],
  ]
  // 로고(h1.auth_logo)·푸터 문구는 AuthLayout 자신이 렌더한다(정적 import) — 항상 즉시
  // 존재한다. 화면 고유 제목(title)은 Outlet 안의 Login/Join/FindAccount가 그리는데,
  // round06b B4로 그 셋이 React.lazy 스플리팅됐다 — 청크 로드를 기다려야 나온다.
  for (const [path, title] of CASES) {
    const view = renderAt(path)
    expect(screen.getByRole('img', { name: /SA:I/ })).toBeInTheDocument()
    expect(screen.getByText('대한민국역사박물관 근현대사 지능형 학예 지식 플랫폼입니다.')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
    view.unmount()
  }
})
