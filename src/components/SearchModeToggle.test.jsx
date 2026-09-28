/**
 * 이 파일의 책임: SearchModeToggle(검색 대상 메타/본문 토글)의 계약을 본다(round06e Task7).
 *
 * renderWithProviders 는 이 테스트 파일 전용 얇은 헬퍼다 — AuthContext(searchModesEnabled)와
 * ScenarioContext(searchMode/setSearchMode)를 감싼다. 다른 테스트 파일(Lnb.test.jsx 등)이
 * AuthContext.Provider/ScenarioContext.Provider에 value 객체를 직접 주입하는 방식을 따르되,
 * setSearchMode가 실제로 상태를 바꿔 재렌더에 반영돼야 하므로(체크 시 즉시 반영 확인) 내부에
 * useState를 든 Harness 컴포넌트로 감싼다.
 */
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { AuthContext } from '../context/AuthContext.jsx'
import { ScenarioContext } from '../context/ScenarioContext.jsx'
import SearchModeToggle from './SearchModeToggle.jsx'

function renderWithProviders(ui, { searchModesEnabled = true, onModeChange } = {}) {
  function Harness() {
    const [searchMode, setSearchModeState] = useState('meta')
    const setSearchMode = (next) => {
      setSearchModeState(next)
      onModeChange?.(next)
    }
    return (
      <AuthContext.Provider value={{ searchModesEnabled }}>
        <ScenarioContext.Provider value={{ searchMode, setSearchMode }}>
          {ui}
        </ScenarioContext.Provider>
      </AuthContext.Provider>
    )
  }
  return render(<Harness />)
}

it('기본은 메타만 체크되고 본문은 꺼져 있다', () => {
  renderWithProviders(<SearchModeToggle />)
  fireEvent.click(screen.getByRole('button', { name: '검색 대상 선택' }))
  expect(screen.getByRole('checkbox', { name: '메타기반' })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: '본문 내 기반' })).not.toBeChecked()
})

it('마지막 하나는 끌 수 없다 — 검색 대상 0개 상태를 만들지 않는다', () => {
  renderWithProviders(<SearchModeToggle />)
  fireEvent.click(screen.getByRole('button', { name: '검색 대상 선택' }))
  expect(screen.getByRole('checkbox', { name: '메타기반' })).toBeDisabled()
})

it('본문을 켜면 둘 다 활성이 되고 mode 가 both 가 된다', () => {
  const seen = {}
  renderWithProviders(<SearchModeToggle />, { onModeChange: (m) => (seen.mode = m) })
  fireEvent.click(screen.getByRole('button', { name: '검색 대상 선택' }))
  fireEvent.click(screen.getByRole('checkbox', { name: '본문 내 기반' }))
  expect(seen.mode).toBe('both')
})

it('search_modes_enabled 가 false 면 아무것도 렌더하지 않는다', () => {
  const { container } = renderWithProviders(<SearchModeToggle />, { searchModesEnabled: false })
  expect(container).toBeEmptyDOMElement()
})

// R6E-리뷰 지적1: "메타만 켜졌을 때 메타가 disabled" 만 보면 disabled={meta} 로 바꿔도
// (onlyOne 무시) 통과해버린다 — both 상태에서는 반드시 "둘 다 enabled" 여야 하고, 거기서
// 하나를 끄는 전이까지 봐야 disabled={meta}(대칭 결함: 껐다 되돌릴 수 없음)를 잡는다.
it('본문을 켜서 both가 되면 두 체크박스 모두 다시 켤 수 있고, 그중 메타를 끄면 본문만 disabled로 남는다', () => {
  renderWithProviders(<SearchModeToggle />)
  fireEvent.click(screen.getByRole('button', { name: '검색 대상 선택' }))
  fireEvent.click(screen.getByRole('checkbox', { name: '본문 내 기반' }))

  // both: 메타를 되돌려 끌 수 있어야 한다(=disabled 이면 안 된다) — disabled={meta} 변이가
  // 여기서 걸린다(meta===true 이면 onlyOne 여부와 무관하게 무조건 disabled가 되어버리므로).
  expect(screen.getByRole('checkbox', { name: '메타기반' })).not.toBeDisabled()
  expect(screen.getByRole('checkbox', { name: '본문 내 기반' })).not.toBeDisabled()

  fireEvent.click(screen.getByRole('checkbox', { name: '메타기반' }))

  expect(screen.getByRole('checkbox', { name: '메타기반' })).not.toBeChecked()
  expect(screen.getByRole('checkbox', { name: '본문 내 기반' })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: '본문 내 기반' })).toBeDisabled()
})

// R6E-리뷰 지적2: spec §6.3 "ESC·바깥클릭 닫기, 포커스 복귀" — DropdownMenu.jsx와 동일 패턴.
it('팝오버가 열린 상태에서 바깥을 클릭하면 닫힌다', () => {
  renderWithProviders(<SearchModeToggle />)
  fireEvent.click(screen.getByRole('button', { name: '검색 대상 선택' }))
  expect(screen.getByRole('group', { name: '검색 대상' })).toBeInTheDocument()

  fireEvent.mouseDown(document.body)

  expect(screen.queryByRole('group', { name: '검색 대상' })).not.toBeInTheDocument()
})

it('팝오버가 열린 상태에서 Escape 를 누르면 닫힌다', () => {
  renderWithProviders(<SearchModeToggle />)
  fireEvent.click(screen.getByRole('button', { name: '검색 대상 선택' }))
  fireEvent.keyDown(screen.getByRole('group', { name: '검색 대상' }), { key: 'Escape' })

  expect(screen.queryByRole('group', { name: '검색 대상' })).not.toBeInTheDocument()
})

it('Escape 로 닫으면 포커스가 "+" 트리거 버튼으로 돌아간다', () => {
  renderWithProviders(<SearchModeToggle />)
  const trigger = screen.getByRole('button', { name: '검색 대상 선택' })
  fireEvent.click(trigger)
  fireEvent.keyDown(screen.getByRole('group', { name: '검색 대상' }), { key: 'Escape' })

  expect(trigger).toHaveFocus()
})

// 최종 리뷰 F2: /search/chat 은 SearchFlowLayout(재검색바)과 그 Outlet 아래 ChatTab
// (채팅 입력바)이 각각 SearchModeToggle 을 렌더해, 한 화면에 토글 2개가 공존한다.
// 팝오버 id가 고정 문자열("search_mode_popover")이면 두 버튼의 aria-controls가
// 같은 id를 가리키고 동시에 열면 DOM에 중복 id가 생긴다 — useId 값으로 고유화한다.
it('한 화면에 토글이 2개 있어도 팝오버 id가 겹치지 않는다', () => {
  renderWithProviders(
    <>
      <SearchModeToggle />
      <SearchModeToggle />
    </>
  )
  const triggers = screen.getAllByRole('button', { name: '검색 대상 선택' })
  expect(triggers).toHaveLength(2)
  fireEvent.click(triggers[0])
  fireEvent.click(triggers[1])

  const groups = screen.getAllByRole('group', { name: '검색 대상' })
  expect(groups).toHaveLength(2)
  expect(groups[0].id).not.toBe(groups[1].id)
  expect(triggers[0]).toHaveAttribute('aria-controls', groups[0].id)
  expect(triggers[1]).toHaveAttribute('aria-controls', groups[1].id)
})
