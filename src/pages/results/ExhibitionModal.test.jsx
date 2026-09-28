// 이 파일의 책임: 특별전시 생성 모달(피그마 「교육 자료 생성」 구조 — 제목만 바꿔 쓴다).
//
// round07i 계획서 원안(task-7-brief.md Step 1)은 이 모달이 스스로 fetch를 부르고
// selection·onCreated를 직접 받는 것으로 그렸다. 그러나 실제 구현은 형제 모달
// (ExhibitModal·CaptionModal)과 같은 골격을 따른다 — chips/total/onSubmit을 받아
// 제출을 부모(OutputTab)에 위임한다. 그래야 세 산출물이 같은 완료 모달·같은 에러
// 토스트 경로를 타고, 학예사가 "왜 여기만 다르게 동작하지"를 겪지 않는다
// (ExhibitionModal.jsx 파일 머리말 참조). 그래서 아래는 계획서가 준 5개 테스트
// 이름·의도는 그대로 두되, 기존 ExhibitModal.test.jsx의 하우스 스타일(chips 픽스처·
// fireEvent·onSubmit 스파이)로 다시 쓴 것이다 — "kind=exhibition으로 보낸다"의
// 실질(컬럼도 형식도 싣지 않는다)은 onSubmit 호출 인자로 잠근다.
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExhibitionModal from './ExhibitionModal.jsx'
import { ToastProvider } from '../../components/Toast.jsx'

const CHIPS = [{ nodeId: 'n1', label: '환경', count: 3 }]

function renderModal(props = {}) {
  return render(
    <ToastProvider>
      <ExhibitionModal
        open chips={CHIPS} total={3} defaultTitle="환경전" busy={false}
        onClose={() => {}} onRemoveChip={() => {}} onSubmit={() => {}} {...props}
      />
    </ToastProvider>,
  )
}

it('제목이 「특별전시 자료 생성」이다', () => {
  renderModal()
  expect(screen.getByText('특별전시 자료 생성')).toBeInTheDocument()
})

it('컬럼 체크박스도 타임라인 체크도 없다', () => {
  // 피그마 구조상 이 모달에는 옵션이 없다. 있으면 다른 모달을 베낀 것이다.
  renderModal()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
})

it('선택 자료를 뱃지로 보여준다', () => {
  renderModal()
  expect(screen.getByText('환경')).toBeInTheDocument()
  expect(screen.getByText('3')).toBeInTheDocument()
})

it('제목이 비면 생성하기를 누를 수 없다', () => {
  renderModal({ defaultTitle: '' })
  expect(screen.getByRole('button', { name: '생성하기' })).toBeDisabled()
})

// 계획서 원안은 여기서 global.fetch를 스파이해 body.kind/columns/format을 직접
// 봤다. 이 모달은 fetch를 부르지 않으므로(형제 모달과 같은 이유 — 파일 머리말
// 참조), 같은 사실을 onSubmit 인자로 잠근다: kind는 부모(submitExhibition)가
// 붙이므로 이 모달의 몫은 "title만 싣고 columns·format은 절대 섞지 않는다"이다.
it('제출은 title만 싣는다 — columns 도 format 도 없다(kind는 부모가 붙인다)', () => {
  const onSubmit = vi.fn()
  renderModal({ onSubmit })
  fireEvent.click(screen.getByRole('button', { name: '생성하기' }))
  expect(onSubmit).toHaveBeenCalledWith({ title: '환경전' })
  expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('columns')
  expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('format')
})

// round07i 감사 C — 특별전시만 자료 30건 상한이 있는데(서버
// outputs/routes.py `_MAX_EXHIBITION_ARTIFACTS`) 화면에는 그 상한이 아예 없어,
// 40건을 고른 학예사는 「생성하기」를 눌러 422를 받고서야 알 수 있었다.
// ExhibitModal이 자기 조건을 미리 막아 둔 선례(그 파일 canSubmit 주석 「왕복 한
// 번을 아낀다」)를 따른다.
describe('자료 30건 상한(round07i 감사 C)', () => {
  it('30건까지는 그대로 누를 수 있다 — 경계에서 막지 않는다', () => {
    renderModal({ total: 30 })
    expect(screen.getByRole('button', { name: '생성하기' })).toBeEnabled()
    expect(screen.queryByText(/건까지 담을 수 있습니다/)).toBeNull()
  })

  it('31건부터는 누를 수 없고, 몇 건을 덜어야 하는지 말한다', () => {
    renderModal({ total: 34 })
    expect(screen.getByRole('button', { name: '생성하기' })).toBeDisabled()
    const notice = screen.getByText(/건까지 담을 수 있습니다/)
    expect(notice).toHaveTextContent('30건까지')
    expect(notice).toHaveTextContent('4건')
  })

  it('상한을 넘겨도 제출 자체가 나가지 않는다', () => {
    const onSubmit = vi.fn()
    renderModal({ total: 31, onSubmit })
    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
