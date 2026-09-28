// 이 파일의 책임: 검색 품질 만족도 위젯(퍼블 search_result.html L357-428 이식 + 제출
// 동작 자체 설계, spec §8.4).
//
// postFeedback 만 모듈 mock 한다 — 이 컴포넌트가 searchApi 에서 쓰는 것이 그것뿐이다.
//
// 최종 리뷰 F2 — "sent"(제출 완료) 는 이제 로컬 state 가 아니라 ScenarioContext 의
// feedbackSent 다. 원시 객체를 그대로 Provider value 로 꽂으면 setFeedbackSent 호출이
// 아무 리렌더도 일으키지 않아(진짜 useState 가 아니므로) "제출 성공 → 감사 메시지로
// 바뀐다" 류의 테스트가 거짓으로 통과/실패한다. 그래서 실제 Provider 처럼 useState 로
// feedbackSent 를 들고 있는 얇은 Harness 를 두고, 그 위에 다른 필드만 override 한다 —
// ScenarioProvider 전체를 마운트하지 않는 이유는 여전히 유효하다(searchApi 외 다른
// 모듈까지 mock 해야 해서 이 스위트가 검증할 대상이 흐려진다).
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { vi } from 'vitest'
import { ScenarioContext } from '../../context/ScenarioContext.jsx'
import { ToastProvider } from '../../components/Toast.jsx'
import RatingWidget from './RatingWidget.jsx'

vi.mock('../../lib/searchApi.js', () => ({ postFeedback: vi.fn() }))
import { postFeedback } from '../../lib/searchApi.js'

beforeEach(() => { postFeedback.mockReset() })

function Harness({ overrides }) {
  const [feedbackSent, setFeedbackSent] = useState(overrides.feedbackSent ?? false)
  const value = {
    lastQuery: '민주화운동',
    subjects: [],
    conversationId: 'c-1',
    liveRequestId: 'req-7',
    searchGenId: 0,
    ...overrides,
    feedbackSent,
    setFeedbackSent,
  }
  return (
    <ToastProvider>
      <ScenarioContext.Provider value={value}>
        <RatingWidget />
      </ScenarioContext.Provider>
    </ToastProvider>
  )
}

function renderWidget(overrides = {}) {
  return render(<Harness overrides={overrides} />)
}

const submitBtn = () => screen.getByRole('button', { name: '평가제출하기' })

// ── 퍼블 마크업 계약 ────────────────────────────────────────────────────────
test('1~7점 라디오 7개와 확정 툴팁 문구 7종을 그린다(§8.4 — 퍼블 표기 혼재를 통일한 값)', () => {
  renderWidget()
  expect(screen.getAllByRole('radio')).toHaveLength(7)
  const tooltips = ['전혀 도움 안 됨', '도움 안 됨', '다소 도움 안 됨', '보통', '약간 도움 됨', '도움 됨', '매우 도움 됨']
  tooltips.forEach((t) => expect(screen.getByLabelText(t)).toBeInTheDocument())
})

test('캡션 3종도 통일 규칙(「됨」·「안 됨」 앞을 띄운다)을 따른다', () => {
  const { container } = renderWidget()
  const caption = container.querySelector('.rating_score_caption')
  expect(caption.querySelector('.txt_01').textContent).toBe('전혀 도움 안 됨')
  expect(caption.querySelector('.txt_02').textContent).toBe('보통')
  expect(caption.querySelector('.txt_03').textContent).toBe('매우 도움 됨')
})

test('점수 색상 계열(ty_01~ty_04)은 퍼블대로 이식한다 — 4점이 2·3점과 같은 ty_02다(§1.4 #6 ① 결함 기록)', () => {
  const { container } = renderWidget()
  const tones = [...container.querySelectorAll('.rating_score_btn')].map((el) => {
    return ['ty_01', 'ty_02', 'ty_03', 'ty_04'].find((t) => el.classList.contains(t))
  })
  expect(tones).toEqual(['ty_01', 'ty_02', 'ty_02', 'ty_02', 'ty_03', 'ty_03', 'ty_04'])
})

// ── 동작(자체 설계) ─────────────────────────────────────────────────────────
test('점수를 고르기 전에는 제출 버튼이 비활성이다', () => {
  renderWidget()
  expect(submitBtn()).toBeDisabled()
  fireEvent.click(screen.getByLabelText('도움 됨'))
  expect(submitBtn()).toBeEnabled()
})

test('코멘트 글자수 카운터가 갱신되고 100자로 제한된다', () => {
  const { container } = renderWidget()
  const textarea = screen.getByPlaceholderText('내용을 입력하세요')
  expect(container.querySelector('.rating_comment_count').textContent).toBe('0')
  expect(textarea).toHaveAttribute('maxlength', '100')
  fireEvent.change(textarea, { target: { value: '유용했습니다' } })
  expect(container.querySelector('.rating_comment_count').textContent).toBe('6')
})

test('제출: 점수·코멘트와 평가 맥락(request_id·conversation_id·query·subjects)을 함께 보낸다(round07d — postFeedback 인자는 subjects)', async () => {
  postFeedback.mockResolvedValue({ ok: true, status: 'ok', notice: null })
  renderWidget({ subjects: ['사회생활'] })
  fireEvent.click(screen.getByLabelText('매우 도움 됨'))
  fireEvent.change(screen.getByPlaceholderText('내용을 입력하세요'), { target: { value: '좋아요' } })
  fireEvent.click(submitBtn())
  await waitFor(() => expect(postFeedback).toHaveBeenCalledWith({
    score: 7,
    comment: '좋아요',
    requestId: 'req-7',
    conversationId: 'c-1',
    query: '민주화운동',
    subjects: ['사회생활'],
  }))
})

test('제출 성공: 폼이 사라지고 감사 메시지로 바뀐다(중복 제출 방어선 — §8.3)', async () => {
  postFeedback.mockResolvedValue({ ok: true, status: 'ok', notice: null })
  renderWidget()
  fireEvent.click(screen.getByLabelText('보통'))
  fireEvent.click(submitBtn())
  await waitFor(() => expect(screen.getByText('검색 품질 만족도 평가 완료')).toBeInTheDocument())
  expect(screen.queryByRole('button', { name: '평가제출하기' })).toBeNull()
  expect(screen.queryAllByRole('radio')).toHaveLength(0)
})

// ── 최종 리뷰 F2 — sent 는 로컬 state 가 아니라 ScenarioContext.feedbackSent 다 ──────
test('feedbackSent:true 로 마운트되면 처음부터 감사 메시지를 그린다(재마운트 시나리오 — 로컬 state 였다면 항상 폼부터 그렸을 것이다)', () => {
  renderWidget({ feedbackSent: true })
  expect(screen.getByText('검색 품질 만족도 평가 완료')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '평가제출하기' })).toBeNull()
})

test('제출 성공은 컨텍스트의 setFeedbackSent(true)를 호출한다 — 로컬 setState 가 아니다', async () => {
  postFeedback.mockResolvedValue({ ok: true, status: 'ok', notice: null })
  const setFeedbackSent = vi.fn()
  render(
    <ToastProvider>
      <ScenarioContext.Provider value={{
        lastQuery: '민주화운동', subjects: [], conversationId: 'c-1', liveRequestId: 'req-7',
        searchGenId: 0, feedbackSent: false, setFeedbackSent,
      }}>
        <RatingWidget />
      </ScenarioContext.Provider>
    </ToastProvider>,
  )
  fireEvent.click(screen.getByLabelText('보통'))
  fireEvent.click(submitBtn())
  await waitFor(() => expect(setFeedbackSent).toHaveBeenCalledWith(true))
})

test('제출 실패(ok:false): 토스트로 알리고 폼을 그대로 남겨 재시도할 수 있다', async () => {
  postFeedback.mockResolvedValue({ ok: false, status: 'error', notice: '평가 저장에 실패했습니다' })
  renderWidget()
  fireEvent.click(screen.getByLabelText('도움 안 됨'))
  fireEvent.click(submitBtn())
  await waitFor(() => expect(screen.getByText('평가 저장에 실패했습니다')).toBeInTheDocument())
  expect(submitBtn()).toBeInTheDocument()
  expect(screen.getByLabelText('도움 안 됨')).toBeChecked()
})

test('제출 실패(reject): 네트워크 단절도 침묵하지 않고 토스트로 알린다(코딩표준 §6)', async () => {
  postFeedback.mockRejectedValue(new Error('network down'))
  renderWidget()
  fireEvent.click(screen.getByLabelText('보통'))
  fireEvent.click(submitBtn())
  await waitFor(() => expect(screen.getByText('평가 제출에 실패했습니다. 잠시 후 다시 시도하세요.')).toBeInTheDocument())
  expect(submitBtn()).toBeInTheDocument()
})

test('제출 중에는 버튼이 비활성이라 두 번 눌러도 두 번 가지 않는다', async () => {
  let resolveSubmit
  postFeedback.mockReturnValue(new Promise((resolve) => { resolveSubmit = resolve }))
  renderWidget()
  fireEvent.click(screen.getByLabelText('보통'))
  fireEvent.click(submitBtn())
  expect(submitBtn()).toBeDisabled()
  fireEvent.click(submitBtn())
  expect(postFeedback).toHaveBeenCalledTimes(1)
  resolveSubmit({ ok: true, status: 'ok', notice: null })
  await waitFor(() => expect(screen.getByText('검색 품질 만족도 평가 완료')).toBeInTheDocument())
})

test('코멘트를 비워 두면 comment:null로 보낸다(빈 문자열이 아니다)', async () => {
  postFeedback.mockResolvedValue({ ok: true, status: 'ok', notice: null })
  renderWidget()
  fireEvent.click(screen.getByLabelText('보통'))
  fireEvent.click(submitBtn())
  await waitFor(() => expect(postFeedback).toHaveBeenCalledWith(expect.objectContaining({ comment: null })))
})
