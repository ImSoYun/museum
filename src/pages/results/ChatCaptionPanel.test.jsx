// 이 파일의 책임: 채팅 탭의 설명문 폼 턴(피그마 695:100384 `Frame 2087328269`).
//
// ── round07f 연장 — 이 파일을 다시 썼다 ────────────────────────────────────
// round07f Task 8은 이 폼을 산출물생성 페이지 모달에서 그대로 베껴 제목 입력·
// 타임라인 체크박스·파일형식 라디오를 그렸고, 이 파일이 그 셋을 단언하고 있었다.
// 피그마에는 셋 다 없다 — 그 단언들(형식·타임라인 1건 · idPrefix 1건 · 제목 4건)은
// 지웠고, 대신 「없다」를 잠그는 단언을 새로 뒀다. 타임라인은 결정 모달로 옮겨졌다
// (ChatCaptionDecisionModal.test.jsx), 제목·형식은 코드가 정한다(ChatTab.live).
//
// 산출물생성 탭 모달과 **재료가 다르다** — 노드에서 고른 자료가 아니라 대화
// 이력의 출처자료 전부다(상한 없음, 사용자 결정 2026-09-02).
//
// [✕ 제외를 저장하지 않는 이유]
// 제외는 **이번 생성에만** 반영된다. 대화 기록을 건드리면 이미 나간 답변이
// 인용한 [2] 번이 깨진다 — 되돌릴 수 없는 손상이다.
//
// round07e 최종 리뷰 F3 — 픽스처가 운영에 오지 않는 era·category를 채워
// 갭을 가리고 있었다. 라이브 파이프라인(ChatTab.jsx collectChatCaptionDocs)은
// {idnbr, name} 둘만 준다 — 그래서 픽스처도 그 모양으로 현실화한다.
import { describe, it, test, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import ChatCaptionPanel from './ChatCaptionPanel.jsx'
import { CHAT_TASKS } from './chatTasks.js'

const DOCS = [
  { idnbr: 'a', name: '4·19 사진' },
  { idnbr: 'b', name: '선언문' },
  { idnbr: 'c', name: '포스터' },
]

const renderPanel = (over = {}) =>
  render(
    <ChatCaptionPanel task={CHAT_TASKS.caption} docs={DOCS} onRequestGenerate={() => {}} {...over} />,
  )

const expand = () => fireEvent.click(screen.getByRole('button', { name: /상세보기/ }))

describe('채팅 설명문 폼 턴 — 피그마 문구', () => {
  it('헤딩과 섹션 레이블과 건수 문구가 피그마 원문 그대로다', () => {
    renderPanel()
    expect(screen.getByText('설명문 캡션 생성')).toBeInTheDocument()
    expect(screen.getByText('참고자료')).toBeInTheDocument()
    expect(
      screen.getByText('대화에서 나온 총 3건 자료를 바탕으로 생성하겠습니다.'),
    ).toBeInTheDocument()
    // round07f Task 8의 문구는 사라졌다 — 피그마에 없다.
    expect(screen.queryByText('이 대화의 근거 자료로 설명문 만들기')).toBeNull()
    expect(screen.queryByText(/참고자료 총/)).toBeNull()
  })

  // 이 셋이 「폼을 다시 만든」 이유 전부다. 지우기만 하고 잠그지 않으면 다음 라운드에
  // 누군가 편의로 되살려도 아무도 모른다.
  it('제목 입력·타임라인 체크박스·파일형식 라디오가 폼에 없다', () => {
    renderPanel()
    expect(screen.queryByLabelText('제목')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(screen.queryByText(/타임라인/)).toBeNull()
    expect(screen.queryByText(/파일 형식/)).toBeNull()
  })
})

describe('채팅 설명문 폼 턴 — 참고자료 목록', () => {
  it('상세보기를 접었다 편다', () => {
    renderPanel()
    const toggle = screen.getByRole('button', { name: /상세보기/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('4·19 사진')).toBeInTheDocument()
  })

  // 피그마 `number-badge` — 1부터 차례로.
  it('목록 각 줄에 1부터의 번호 뱃지가 붙는다', () => {
    renderPanel()
    expand()
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
    items.forEach((li, i) => {
      expect(within(li).getByText(String(i + 1))).toBeInTheDocument()
    })
    // 첫 줄의 뱃지 1과 자료명이 같은 줄에 있다(뱃지가 엉뚱한 줄에 붙지 않았다).
    expect(within(items[0]).getByText('4·19 사진')).toBeInTheDocument()
  })

  // 피그마 목록에는 제외된 줄이 아예 없다 — 취소선으로 남기면 번호가 비고,
  // 「총 N건」과 목록 길이가 어긋난다.
  it('✕로 제외하면 목록에서 빠지고 번호가 다시 매겨진다', () => {
    renderPanel()
    expand()
    fireEvent.click(screen.getByRole('button', { name: '4·19 사진 a 제외' }))

    expect(screen.queryByText('4·19 사진')).toBeNull()
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    // 남은 첫 줄이 1번을 이어받는다(빈 번호 없음).
    expect(within(items[0]).getByText('1')).toBeInTheDocument()
    expect(within(items[0]).getByText('선언문')).toBeInTheDocument()
    expect(within(items[1]).getByText('2')).toBeInTheDocument()
  })

  it('✕로 제외하면 건수 문구가 실시간으로 준다', () => {
    renderPanel()
    expand()
    fireEvent.click(screen.getByRole('button', { name: '4·19 사진 a 제외' }))
    expect(
      screen.getByText('대화에서 나온 총 2건 자료를 바탕으로 생성하겠습니다.'),
    ).toBeInTheDocument()
  })

  it('같은 자료가 여러 턴에 인용돼도 한 번만 센다', () => {
    renderPanel({ docs: [...DOCS, { idnbr: 'a', name: '4·19 사진' }] })
    expect(screen.getByText(/총 3건/)).toBeInTheDocument()
  })

  // round07e 최종 리뷰 F3 — 이 아카이브의 자료명은 「사진」·「포스터」·「선언문」처럼
  // 일반적이다(spec §4.2 실측). era·category 없이 name만으로는 동명 자료 두 건을
  // 구분할 수 없다 — idnbr을 보조 텍스트로 그려야 하고, aria-label도 idnbr을
  // 포함해야 스크린리더 사용자도 어느 것을 빼는지 알 수 있다.
  it('자료명이 같고 idnbr이 다른 두 건도 구분된다', () => {
    renderPanel({
      docs: [
        { idnbr: 'PS-1', name: '포스터' },
        { idnbr: 'PS-2', name: '포스터' },
      ],
    })
    expand()

    expect(screen.getByRole('button', { name: '포스터 PS-1 제외' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '포스터 PS-2 제외' })).toBeInTheDocument()
  })

  // round07f — 자료명을 누르면 자료상세를 연다(대조표 §4). MaterialModal을 여는
  // 이유는 ChatCaptionPanel.jsx의 같은 자리 주석 참조(한 화면에서 자료를 여는 길을
  // 둘로 가르지 않는다).
  it('자료명 클릭 시 상세 모달을 요청한다', () => {
    const onOpenDetail = vi.fn()
    renderPanel({ onOpenDetail })
    expand()
    fireEvent.click(screen.getByRole('button', { name: DOCS[0].name }))
    expect(onOpenDetail).toHaveBeenCalledWith({
      id: DOCS[0].idnbr, title: DOCS[0].name, image: null,
    })
  })
})

describe('채팅 설명문 폼 턴 — 생성 요청', () => {
  // 이 버튼은 **만들지 않는다** — 결정 모달을 여는 요청만 올린다(피그마 ③).
  it('생성하기는 남은 자료의 idnbrs를 그대로 올려 보낸다', () => {
    const onRequestGenerate = vi.fn()
    renderPanel({ onRequestGenerate })
    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))
    expect(onRequestGenerate).toHaveBeenCalledWith({ idnbrs: ['a', 'b', 'c'] })
  })

  it('제외한 자료는 요청에 실리지 않는다', () => {
    const onRequestGenerate = vi.fn()
    renderPanel({ onRequestGenerate })
    expand()
    fireEvent.click(screen.getByRole('button', { name: '4·19 사진 a 제외' }))
    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))
    expect(onRequestGenerate.mock.calls[0][0].idnbrs).toEqual(['b', 'c'])
  })

  it('전부 제외하면 생성할 수 없다', () => {
    renderPanel()
    expand()
    for (const label of ['4·19 사진 a 제외', '선언문 b 제외', '포스터 c 제외']) {
      fireEvent.click(screen.getByRole('button', { name: label }))
    }
    expect(screen.getByRole('button', { name: '생성하기' })).toBeDisabled()
  })

  it('생성 중에는 「만드는 중…」으로 잠긴다', () => {
    renderPanel({ busy: true })
    expect(screen.getByRole('button', { name: '만드는 중…' })).toBeDisabled()
  })

  // 완료 후에도 폼은 대화에 남는다(피그마가 폼 턴과 완료 턴을 함께 그린다).
  // 다만 같은 폼으로 두 번 만들 수 있으면 안 된다.
  it('readOnly면 생성하기도 ✕도 잠긴다', () => {
    const onRequestGenerate = vi.fn()
    renderPanel({ readOnly: true, onRequestGenerate })
    expect(screen.getByRole('button', { name: '생성하기' })).toBeDisabled()

    expand()
    const excludeBtn = screen.getByRole('button', { name: '4·19 사진 a 제외' })
    expect(excludeBtn).toBeDisabled()
    // 눌러도 목록이 줄지 않는다(disabled가 표시만이 아니다).
    fireEvent.click(excludeBtn)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(onRequestGenerate).not.toHaveBeenCalled()
  })
})

// round07g 최종 리뷰 Minor-4 — **왜 못 만드는지 말한다.**
// 예전에는 인용이 하나도 없는 대화에서도 「총 0건 자료를 바탕으로 생성하겠습니다」
// + 비활성 「생성하기」로 끝나, 사용자가 사유를 알 길이 없었다(「작업선택」 트리거는
// 답변만 있으면 활성이라 열어 보고서야 안다). 이 레포의 빈 상태 관행(「사실 —
// 다음 행동」)을 따르고, 사유 둘을 가른다 — 다음 행동이 서로 다르기 때문이다.
describe('채팅 설명문 폼 턴 — 만들 수 없는 이유', () => {
  it('인용 자료가 하나도 없으면 사유와 다음 행동을 말한다', () => {
    renderPanel({ docs: [] })

    expect(screen.getByText(/이 대화에는 아직 인용된 자료가 없습니다/)).toBeInTheDocument()
    // 「0건을 바탕으로 생성하겠습니다」는 되지도 않을 일을 된다고 말하는 문장이다.
    expect(screen.queryByText(/생성하겠습니다/)).toBeNull()
    expect(screen.getByRole('button', { name: '생성하기' })).toBeDisabled()
  })

  it('전부 제외한 경우는 다른 사유다 — 되돌릴 길을 말한다', () => {
    renderPanel()
    expand()
    for (const label of ['4·19 사진 a 제외', '선언문 b 제외', '포스터 c 제외']) {
      fireEvent.click(screen.getByRole('button', { name: label }))
    }

    expect(screen.getByText(/참고자료를 모두 제외했습니다/)).toBeInTheDocument()
    // 인용이 없는 대화와 **같은 말을 하지 않는다** — 여기서는 자료가 있었다.
    expect(screen.queryByText(/이 대화에는 아직 인용된 자료가 없습니다/)).toBeNull()
    expect(screen.getByRole('button', { name: '생성하기' })).toBeDisabled()
  })

  it('한 건이라도 남으면 피그마 원문 그대로다', () => {
    renderPanel({ docs: [DOCS[0]] })
    expect(
      screen.getByText('대화에서 나온 총 1건 자료를 바탕으로 생성하겠습니다.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/이 대화에는 아직 인용된 자료가 없습니다/)).toBeNull()
    expect(screen.queryByText(/모두 제외했습니다/)).toBeNull()
  })
})

// round07k ④ — 이 패널은 이제 종류를 받는다. 설명문 전용이던 문구가 전부
// task 에서 온다. 같은 컴포넌트가 두 종류를 그리는지 나란히 잠근다.
test('설명문 종류면 제목이 설명문이다', () => {
  render(<ChatCaptionPanel task={CHAT_TASKS.caption} docs={[{ idnbr: 'A1', name: '가' }]} onRequestGenerate={() => {}} />)
  expect(screen.getByText('설명문 캡션 생성')).toBeInTheDocument()
})

// round10b B-4 — 채팅 작업선택의 둘째 종류가 특별전시(exhibition)에서 학예 기획
// 자료(exhibit)로 바뀌었다(chatTasks.js 정의부 주석 참조). 이 패널 자체는 종류를
// task prop 으로만 받으므로 문구 출처(chatTasks.js)만 바뀌면 그대로 통과한다.
test('학예 기획 자료 종류면 제목이 학예 기획 자료다', () => {
  render(<ChatCaptionPanel task={CHAT_TASKS.exhibit} docs={[{ idnbr: 'A1', name: '가' }]} onRequestGenerate={() => {}} />)
  expect(screen.getByText('학예 기획 자료 생성')).toBeInTheDocument()
  expect(screen.queryByText('설명문 캡션 생성')).toBeNull()
})

test('학예 기획 자료의 빈 상태 문구는 설명문 이야기를 하지 않는다', () => {
  render(<ChatCaptionPanel task={CHAT_TASKS.exhibit} docs={[]} onRequestGenerate={() => {}} />)
  expect(screen.getByText(/학예 기획 자료는 답변이 근거로 든 자료로만 만듭니다/)).toBeInTheDocument()
  expect(screen.queryByText(/설명문은 답변이/)).toBeNull()
})

// 자료 수 선제 차단을 만들지 않기로 했다(spec §4 결정 2). 0건일 때만 꺼진다.
test('자료가 1건이어도 생성하기가 눌린다 — 최소 건수를 화면에서 세지 않는다', () => {
  render(<ChatCaptionPanel task={CHAT_TASKS.exhibit} docs={[{ idnbr: 'A1', name: '가' }]} onRequestGenerate={() => {}} />)
  expect(screen.getByRole('button', { name: '생성하기' })).toBeEnabled()
})

test('자료가 0건이면 생성하기가 꺼진다 — 보낼 것이 없다', () => {
  render(<ChatCaptionPanel task={CHAT_TASKS.exhibit} docs={[]} onRequestGenerate={() => {}} />)
  expect(screen.getByRole('button', { name: '생성하기' })).toBeDisabled()
})
