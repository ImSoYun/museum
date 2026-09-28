// 이 파일의 책임: 산출물 목록(피그마 디스크립션 5·5-1~5-5).
//
// 이 화면의 핵심 상태는 「신규」다 — 보라 테두리로 뜨고, 열어보면 기본색이 되며
// 상단 신규 건수에서 차감된다. 정본은 서버의 opened_at 이다(클라이언트 상태면
// 새로고침에 사라지고 기기마다 달라진다).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
// round07f Task 5 — OutputList가 useNavigate()로 상세 화면으로 이동한다.
// Router 없이 렌더하면 이 파일 전체가 눈다 — MemoryRouter로 감싼다.
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
// round07i 재리뷰 — 서버 kind 전수 가드(아래 describe)가 routes.py를 직접
// 읽어 도출하는 헬퍼. 두 화면 테스트(OutputList·OutputDetailPage)가 같은
// 목록을 쓰므로 한 곳에서만 정의한다.
import { getServerOutputKinds } from './serverOutputKinds.test.js'

// round07j — 퍼블이 건수의 숫자만 <b>로 감쌌다: `총 <b>1</b>건`.
// getByText 의 기본 매처는 **요소가 직접 가진 텍스트**로 맞추므로, 사이에 <b>가
// 끼면 「총 1건」은 어느 한 요소의 직접 텍스트가 아니게 되어 못 찾는다
// (실패 20건이 전부 이 한 가지였다).
//
// textContent 로 맞추되 **대상을 <span> 으로 좁힌다** — 안 좁히면 그 <span>을
// 품은 <div>·<body>·<html>까지 모두 조건을 만족해 getBy* 가 「여러 개 찾음」으로
// 죽는다. 숫자를 감싼 <b>는 그 자체로 「총 1건」을 담지 않으므로 걸리지 않는다.
const countText = (re) => (_content, el) =>
  el?.tagName === 'SPAN' && re.test(el.textContent)

const listOutputs = vi.fn()
const deleteOutputs = vi.fn()
const downloadOutputFile = vi.fn()
const triggerBrowserDownload = vi.fn()
// isLive 는 목이라 실제 env 를 보지 않는다 — 기본은 라이브(기존 경로 그대로)이고,
// 「데모 모드」 describe 만 false 로 갈아끼워 게이트를 검증한다.
const isLive = vi.fn(() => true)
vi.mock('../../lib/outputsApi.js', () => ({
  isLive: (...a) => isLive(...a),
  listOutputs: (...a) => listOutputs(...a),
  deleteOutputs: (...a) => deleteOutputs(...a),
  downloadOutputFile: (...a) => downloadOutputFile(...a),
}))
vi.mock('../../lib/downloadFile.js', () => ({
  triggerBrowserDownload: (...a) => triggerBrowserDownload(...a),
}))

const { default: OutputList, pageNumbers } = await import('./OutputList.jsx')
const { ToastProvider } = await import('../../components/Toast.jsx')

const OUT = (over = {}) => ({
  id: 'o1', kind: 'exhibit', title: '1987년 6월 민주항쟁',
  file_name: '1987년 6월 민주항쟁.xlsx', file_bytes: 335872,
  summary: '광주민주화운동 군인, 민중신문 제40호',
  opened_at: null, created_at: '2026-05-12T11:43:00Z', ...over,
})

// round07g 수정 R1 — **대화 없이는 목록이 조회 자체를 하지 않는다**(사용자 결정).
// 그래서 이 헬퍼는 기본 대화를 하나 물려 준다 — 그러지 않으면 이 파일의 거의 모든
// 테스트가 「카드가 없다」로 무너지고, 그것은 검증이 아니라 게이트를 보고 있는 것이다.
// 게이트를 겨냥하는 테스트만 `conversationId: null` 을 명시해 그 자리를 연다.
const SCOPE = 'conv-DEFAULT'
function renderList({ conversationId = SCOPE, ...props } = {}) {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <OutputList refreshKey={0} conversationId={conversationId} {...props} />
      </MemoryRouter>
    </ToastProvider>,
  )
}

// round07f 최종 리뷰 I-1·I-4 — **목적지를 실제로 마운트한다.**
//
// 위 renderList 는 MemoryRouter 만 씌워 useNavigate() 가 던지지 않게 할 뿐이라,
// 「어디로 갔는가」를 아무도 보지 않았다(I-4: openDetail 을 제자리 이동으로
// 파괴해도 1401건 전부 초록이었다). 여기서는 상세 라우트를 실제로 걸고 착지
// URL(경로 + 쿼리)을 문자열로 잠근다 — 그래야 `?c=` 유실(I-1)도 함께 걸린다.
function LandingProbe() {
  const { pathname, search } = useLocation()
  return <div data-testid="landing">{pathname + search}</div>
}

// round07g 수정 R1 (Minor-1) — 상세로 나르는 대화의 출처가 **prop 하나**가 됐다.
// 예전에는 이 컴포넌트가 `useSearchParams().get('c')`를 따로 읽었다 — 그래서 여기
// initialEntries 의 `?c=` 를 그대로 관측할 수 있었다. 이제는 부모(OutputTab)가
// `?c=` ?? 컨텍스트로 계산해 내려 주는 값이 정본이라, 테스트도 그 자리에 준다.
function renderRouted(entry, conversationId = null) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route
            path="/search/output"
            element={<OutputList refreshKey={0} conversationId={conversationId} />}
          />
          <Route path="/search/output/:outputId" element={<LandingProbe />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

// 응답 헬퍼 — total·new_count 는 **서버가 주는 값**이라 목도 반드시 실어야 한다
// (프론트가 rows 에서 세던 시절의 잔재를 남기지 않기 위해 기본값을 주지 않는다).
const RES = (outputs, over = {}) => ({
  ok: true,
  data: {
    outputs,
    has_more: false,
    total: outputs.length,
    new_count: outputs.filter((o) => o.opened_at == null).length,
    ...over,
  },
})

beforeEach(() => {
  vi.clearAllMocks()
  isLive.mockReturnValue(true)
  listOutputs.mockResolvedValue(RES([OUT()]))
})

/** 삭제 확인 팝업(ConfirmPopup)의 "네"를 누른다 — 삭제는 이제 2단계다. */
const confirmDelete = () => fireEvent.click(screen.getByRole('button', { name: '네' }))

describe('카드 (5-5)', () => {
  it('제목에 파일 형식과 크기가 붙는다', async () => {
    renderList()
    expect(await screen.findByText(/1987년 6월 민주항쟁 \[XLSX, 328KB\]/)).toBeInTheDocument()
  })

  it('본문은 summary 를 그대로 읽는다', async () => {
    renderList()
    expect(await screen.findByText(/광주민주화운동 군인, 민중신문 제40호/)).toBeInTheDocument()
  })

  it('종류 뱃지를 보여준다', async () => {
    renderList()
    // round10b B-3 — exhibit 라벨이 「전시자료」→「학예 기획 자료」로 개명됐다
    // (기획 요청, 다섯 곳 동시 반영 — OutputCard.jsx 정의부 주석 참조).
    expect(await screen.findByText('학예 기획 자료')).toBeInTheDocument()
  })
})

// round07i 리뷰 — OutputCard.jsx(이 카드가 쓰는 컴포넌트)와 OutputDetailPage.jsx가
// 각자 든 KIND_LABEL에 exhibition이 빠져 있어, 특별전시 산출물의 종류 뱃지가
// 폴백(KIND_LABEL[kind] || kind)으로 영문 "exhibition"을 그대로 찍었다(100%
// 재현 · round07i의 신규 기능을 쓴 직후 바로 보이는 화면). exhibition만
// 하드코딩해 잠그면 다음에 kind가 하나 더 생겼을 때 같은 사고가 반복돼도 이
// 테스트는 초록으로 남는다 — round07i 재리뷰: 그래서 하드코딩된 로컬 목록
// 대신 routes.py의 CreateOutputRequest.kind Literal을 직접 읽어 도출한다
// (serverOutputKinds.test.js). 서버가 kind를 하나 더 열면 다음 실행에서 곧바로
// it.each가 그 kind도 돈다 — 손으로 이 상수를 갱신할 필요가 없다.
describe('종류 뱃지 — 서버가 낼 수 있는 kind 전부에 한글 라벨이 있다 (round07i 리뷰)', () => {
  const SERVER_KINDS = getServerOutputKinds()

  it.each(SERVER_KINDS)('kind=%s 는 뱃지에 영문 리터럴이 아니라 한글로 뜬다', async (kind) => {
    listOutputs.mockResolvedValue(RES([OUT({ kind })]))
    renderList()
    const card = await screen.findByTestId('output-card-o1')
    const badge = card.querySelector('.output_card_kind')
    expect(badge).not.toBeNull()
    // KIND_LABEL에 항목이 빠지면 폴백이 kind 영문 리터럴을 그대로 찍는다 —
    // 그 사고를 "한글인가"로 잡는다(라벨 문구 자체를 하나하나 잠그지 않는다).
    // round10b — exhibit 라벨이 「학예 기획 자료」로 개명되며 공백이 섞였다 —
    // 정규식이 공백을 허용하지 않으면 이 통과해야 할 라벨까지 함께 떨어진다.
    expect(badge.textContent).toMatch(/^[가-힣\s]+$/)
    expect(badge.textContent).not.toBe(kind)
  })
})

describe('신규 표시', () => {
  it('opened_at 이 없으면 신규다', async () => {
    renderList()
    const card = await screen.findByTestId('output-card-o1')
    expect(card.className).toContain('is_new')
  })

  it('열어본 산출물은 신규가 아니다', async () => {
    listOutputs.mockResolvedValue(RES([OUT({ opened_at: '2026-05-12T12:00:00Z' })]))
    renderList()
    const card = await screen.findByTestId('output-card-o1')
    expect(card.className).not.toContain('is_new')
  })

  it('상단에 총 건수와 신규 건수를 보여준다 (5-2)', async () => {
    renderList()
    expect(await screen.findByText(countText(/총 1건/))).toBeInTheDocument()
    expect(screen.getByText(countText(/신규 1건/))).toBeInTheDocument()
  })

  it('신규가 없으면 0건으로 표기한다', async () => {
    listOutputs.mockResolvedValue(RES([OUT({ opened_at: '2026-05-12T12:00:00Z' })]))
    renderList()
    expect(await screen.findByText(countText(/신규 0건/))).toBeInTheDocument()
  })

  // 두 집계는 **서버 값**이다. 프론트가 rows(한 페이지 20건)에서 세면 21건째부터
  // 「총 20건」이라 거짓말을 하고, 신규는 필터를 좁힐 때마다 흔들린다.
  it('총 건수는 현재 페이지가 아니라 서버의 total 이다', async () => {
    listOutputs.mockResolvedValue(RES([OUT()], { total: 57, has_more: true }))
    renderList()
    expect(await screen.findByText(countText(/총 57건/))).toBeInTheDocument()
  })

  it('신규 건수는 서버의 new_count 다 — 필터·페이지와 무관하다', async () => {
    // 이 페이지에는 열람한 카드 1장뿐인데 서버는 「내 미열람 전체」로 3을 준다.
    listOutputs.mockResolvedValue(
      RES([OUT({ opened_at: '2026-05-12T12:00:00Z' })], { new_count: 3 }),
    )
    renderList()
    expect(await screen.findByText(countText(/신규 3건/))).toBeInTheDocument()
  })
})

describe('탭 (5) 과 검색 (5-1)', () => {
  // round10b B-3 — 탭 라벨이 「전시자료」→「학예 기획 자료」로 개명됐다. kind 값
  // 자체('exhibit')는 그대로다 — 서버 계약은 손대지 않는다.
  it('학예 기획 자료 탭은 kind 를 실어 보낸다', async () => {
    renderList()
    await screen.findByText(countText(/총 1건/))
    fireEvent.click(screen.getByRole('button', { name: '학예 기획 자료' }))
    await waitFor(() =>
      expect(listOutputs).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'exhibit' })))
  })

  it('제목 검색은 q 를 실어 보낸다', async () => {
    renderList()
    await screen.findByText(countText(/총 1건/))
    fireEvent.change(screen.getByPlaceholderText('산출물 제목 검색'), { target: { value: '민주' } })
    await waitFor(() =>
      expect(listOutputs).toHaveBeenLastCalledWith(expect.objectContaining({ q: '민주' })))
  })

  // round07i 감사 C — 특별전시(kind='exhibition') 탭이 통째로 없었다. 그 산출물은
  // 「전체」에서만 보였고, 만든 학예사가 가장 먼저 열어 볼 「학예 기획 자료」 탭에는
  // 걸리지 않았다(서버 kind 필터는 정확히 한 값만 받는다 — 'exhibit'≠'exhibition').
  it('특별전시 탭이 있고 kind=exhibition 을 실어 보낸다', async () => {
    renderList()
    await screen.findByText(countText(/총 1건/))
    fireEvent.click(screen.getByRole('button', { name: '특별전시' }))
    await waitFor(() =>
      expect(listOutputs).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'exhibition' })))
  })

  it('학예 기획 자료 탭은 특별전시를 대신 걸러 주지 않는다 — 탭 이름과 카드 뱃지가 어긋나면 안 된다', async () => {
    renderList()
    await screen.findByText(countText(/총 1건/))
    fireEvent.click(screen.getByRole('button', { name: '학예 기획 자료' }))
    await waitFor(() =>
      expect(listOutputs).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'exhibit' })))
  })
})

describe('선택과 삭제 (5-3·5-4)', () => {
  it('선택된 카드에 is_selected 가 붙는다', async () => {
    renderList()
    fireEvent.click(await screen.findByRole('checkbox', { name: /1987년 6월 민주항쟁 선택/ }))
    expect(screen.getByTestId('output-card-o1').className).toContain('is_selected')
  })

  it('삭제 버튼에 선택 개수가 나온다', async () => {
    renderList()
    fireEvent.click(await screen.findByRole('checkbox', { name: /1987년 6월 민주항쟁 선택/ }))
    expect(screen.getByRole('button', { name: /삭제/ }).textContent).toContain('1')
  })

  // 삭제는 행 + 파일 바이트를 되돌릴 수 없이 지우고, 한 번에 최대 20건이 날아간다.
  // 대화 기록 한 줄에도 확인을 받는 앱(LnbHistory)에서 여기만 무확인일 수 없다.
  it('삭제 버튼은 곧장 지우지 않고 확인을 먼저 받는다', async () => {
    renderList()
    fireEvent.click(await screen.findByRole('checkbox', { name: /1987년 6월 민주항쟁 선택/ }))
    fireEvent.click(screen.getByRole('button', { name: /삭제/ }))

    expect(deleteOutputs).not.toHaveBeenCalled()
    // 무엇이 날아가는지는 "몇 건인가"로만 말할 수 있다 — 인용문에 선택 건수가 든다.
    expect(screen.getByText(/선택한 산출물 1건/)).toBeInTheDocument()
  })

  it('확인을 취소하면 아무것도 지우지 않는다', async () => {
    renderList()
    fireEvent.click(await screen.findByRole('checkbox', { name: /1987년 6월 민주항쟁 선택/ }))
    fireEvent.click(screen.getByRole('button', { name: /삭제/ }))
    fireEvent.click(screen.getByRole('button', { name: '아니오' }))

    expect(deleteOutputs).not.toHaveBeenCalled()
  })

  it('확인하면 삭제하고 목록 갱신을 부모에 알린다', async () => {
    deleteOutputs.mockResolvedValue({ ok: true, data: { deleted: 1, requested: 1 } })
    const onChanged = vi.fn()
    renderList({ onChanged })
    fireEvent.click(await screen.findByRole('checkbox', { name: /1987년 6월 민주항쟁 선택/ }))
    fireEvent.click(screen.getByRole('button', { name: /삭제/ }))
    confirmDelete()

    await waitFor(() => expect(deleteOutputs).toHaveBeenCalledWith(['o1']))
    // 지역 카운터로 다시 읽지 않는다 — 그러면 탭 뱃지(SearchFlowLayout)가 삭제를
    // 영영 모른다. 신호를 컨텍스트로 올려 목록·뱃지가 같은 값을 구독한다.
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('refreshKey 가 바뀌면 목록을 다시 읽는다', async () => {
    const { rerender } = renderList()
    await screen.findByText(countText(/총 1건/))
    rerender(
      <ToastProvider>
        <MemoryRouter>
          {/* 대화는 그대로 물려야 한다 — 여기서 빼면 refreshKey 가 아니라
              수정 R1 의 게이트를 보게 된다(조회가 아예 안 나간다). */}
          <OutputList refreshKey={1} conversationId={SCOPE} />
        </MemoryRouter>
      </ToastProvider>,
    )
    await waitFor(() => expect(listOutputs).toHaveBeenCalledTimes(2))
  })

  // 서버는 {deleted, requested}를 화면이 **차이를 보여줄 수 있게** 낸다(routes.py).
  // 그 침묵을 프론트가 이어받으면 사용자는 지운 줄 알고 남아 있는 카드를 본다.
  it('요청보다 적게 지워지면 그 사실을 알린다', async () => {
    listOutputs.mockResolvedValue(RES([OUT(), OUT({ id: 'o2', title: '두번째' })]))
    deleteOutputs.mockResolvedValue({ ok: true, data: { deleted: 1, requested: 2 } })
    renderList()
    fireEvent.click(await screen.findByRole('checkbox', { name: '전체선택' }))
    fireEvent.click(screen.getByRole('button', { name: /삭제/ }))
    confirmDelete()

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('2건 중 1건만 삭제되었습니다'))
  })

  it('전부 지워지면 조용하다', async () => {
    deleteOutputs.mockResolvedValue({ ok: true, data: { deleted: 1, requested: 1 } })
    renderList()
    fireEvent.click(await screen.findByRole('checkbox', { name: /1987년 6월 민주항쟁 선택/ }))
    fireEvent.click(screen.getByRole('button', { name: /삭제/ }))
    confirmDelete()

    await waitFor(() => expect(deleteOutputs).toHaveBeenCalled())
    expect(screen.queryByRole('status')).toBeNull()
  })
})

// 데모 모드(VITE_API_BASE_URL 미설정) — 백엔드가 없다. 부르면 마운트마다·탭마다·
// 글자 한 자마다·페이지마다 실패 토스트가 뜬다. 데모 모드는 계속 동작해야 한다.
describe('데모 모드', () => {
  it('조회 자체를 하지 않는다', async () => {
    isLive.mockReturnValue(false)
    renderList()
    await screen.findByText(countText(/총 0건/))
    expect(listOutputs).not.toHaveBeenCalled()
  })

  it('실패 토스트 대신 데모 안내를 보여준다', async () => {
    isLive.mockReturnValue(false)
    renderList()
    expect(await screen.findByText(/데모 모드에서는 산출물 목록을/)).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('다운로드 (5-5)', () => {
  it('성공하면 브라우저 저장을 부른다', async () => {
    const blob = new Blob(['x'])
    downloadOutputFile.mockResolvedValue({ ok: true, blob, filename: 'a.xlsx' })
    renderList()
    fireEvent.click(await screen.findByRole('button', { name: /다운로드/ }))
    await waitFor(() => expect(triggerBrowserDownload).toHaveBeenCalledWith(blob, 'a.xlsx'))
  })

  it('실패는 사유를 토스트로 알린다', async () => {
    downloadOutputFile.mockResolvedValue({ ok: false, notice: '산출물 파일이 없습니다' })
    renderList()
    fireEvent.click(await screen.findByRole('button', { name: /다운로드/ }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('산출물 파일이 없습니다'))
  })
})

describe('빈 상태', () => {
  it('0건이면 안내를 보여준다', async () => {
    listOutputs.mockResolvedValue(RES([]))
    renderList()
    expect(await screen.findByText(countText(/총 0건/))).toBeInTheDocument()
  })
})

describe('페이지네이션', () => {
  it('has_more 면 다음 페이지로 갈 수 있다', async () => {
    listOutputs.mockResolvedValue(RES([OUT()], { has_more: true }))
    renderList()
    fireEvent.click(await screen.findByRole('button', { name: '다음 페이지' }))
    await waitFor(() =>
      expect(listOutputs).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 20 })))
  })

  it('전체선택은 현재 페이지만 고른다 (5-3)', async () => {
    listOutputs.mockResolvedValue(RES([OUT(), OUT({ id: 'o2', title: '두번째' })], { has_more: true }))
    renderList()
    fireEvent.click(await screen.findByRole('checkbox', { name: '전체선택' }))
    expect(screen.getByRole('button', { name: /삭제/ }).textContent).toContain('2')
  })

  it('페이지를 넘기면 선택이 초기화된다', async () => {
    listOutputs.mockResolvedValue(RES([OUT()], { has_more: true }))
    renderList()
    fireEvent.click(await screen.findByRole('checkbox', { name: /1987년 6월 민주항쟁 선택/ }))
    fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /삭제 1/ })).toBeNull())
  })
})

// pageNumbers 단위 테스트(리뷰 Minor) — 렌더 트리를 거치지 않고 경계값만 직접 잠근다.
// export된 순수 함수인데도 잠금이 하나도 없었다. 아래 값들은 함수 상단 주석이 약속하는
// 모양("[0,1,2,'…',9]") 그대로, 리뷰어가 손으로 검산한 경계값이다.
describe('pageNumbers (경계값)', () => {
  it('총 1페이지면 생략 없이 [0]', () => {
    expect(pageNumbers(0, 1)).toEqual([0])
  })

  it('총 2페이지면 생략 없이 [0,1]', () => {
    expect(pageNumbers(0, 2)).toEqual([0, 1])
  })

  it('총 7페이지(window*2+3) 이하면 현재 위치와 무관하게 전량을 보여준다', () => {
    expect(pageNumbers(0, 7)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(pageNumbers(6, 7)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('8페이지·현재 0페이지 — 뒤쪽만 생략된다', () => {
    expect(pageNumbers(0, 8)).toEqual([0, 1, 2, '…', 7])
  })

  it('8페이지·현재 7페이지(마지막) — 앞쪽만 생략된다', () => {
    expect(pageNumbers(7, 8)).toEqual([0, '…', 5, 6, 7])
  })

  it('10페이지·현재 3페이지 — 0과 1 사이는 이어져 있어 생략부호가 없다', () => {
    expect(pageNumbers(3, 10)).toEqual([0, 1, 2, 3, 4, 5, '…', 9])
  })

  it('10페이지·현재 4페이지 — 양쪽 모두 생략된다', () => {
    expect(pageNumbers(4, 10)).toEqual([0, '…', 2, 3, 4, 5, 6, '…', 9])
  })
})

// ── round07f 최종 리뷰 I-1 · I-4 ────────────────────────────────────────────────
// 상세 화면은 이 라운드의 1번 산출물인데, **그 문이 어디로 열리는지** 아무도
// 보지 않았다. 그리고 그 문은 `?c=`(대화 id)를 떨어뜨리고 있었다 — 상세에서 F5를
// 누르면 SearchFlowLayout 의 재개 이펙트가 `searchParams.get('c')` 로 null 을 읽어
// resumeConversation 이 돌지 않고, 검색어·노드 그래프·대화가 통째로 사라진다.
// round07e D 가 정확히 그 사고를 막으려고 만든 보호였다.
describe('상세 화면으로 가는 문 (I-1 · I-4)', () => {
  // round07j — 접근명이 「상세보기 ›」에서 「상세보기」로 바뀌었다. 퍼블이 텍스트
  // 꺾쇠 ›를 아이콘 <img>로 교체했고, 그 img 를 alt="" 로 두어 접근명에서 뺐기
  // 때문이다(장식이라 옳다 — OutputCard.jsx 의 근거 주석 참조). 버튼의 동작·경로는
  // 그대로이므로 바뀐 것은 이름뿐이다.
  it('「상세보기」는 그 산출물의 상세 경로로 간다', async () => {
    renderRouted('/search/output', 'CONV-1')
    fireEvent.click(await screen.findByRole('button', { name: '상세보기' }))
    expect(await screen.findByTestId('landing')).toHaveTextContent('/search/output/o1')
  })

  it('목록이 좁힌 그 대화를 상세까지 그대로 이어 나른다', async () => {
    renderRouted('/search/output?c=CONV-1', 'CONV-1')
    fireEvent.click(await screen.findByRole('button', { name: '상세보기' }))
    // 경로만이 아니라 쿼리까지 통째로 잠근다 — `?c=` 하나가 빠지면 상세에서의
    // F5 가 검색 세션을 통째로 날린다.
    expect(await screen.findByTestId('landing')).toHaveTextContent('/search/output/o1?c=CONV-1')
  })

  it('카드 더블클릭도 같은 곳으로 간다 — 두 진입점이 갈리지 않는다', async () => {
    renderRouted('/search/output?c=CONV-1', 'CONV-1')
    fireEvent.doubleClick(await screen.findByTestId('output-card-o1'))
    expect(await screen.findByTestId('landing')).toHaveTextContent('/search/output/o1?c=CONV-1')
  })

  // round07g 수정 R1 — Minor-1. 이 파일에는 같은 개념(「이 화면의 대화」)의 출처가
  // 둘 있었다: 목록 조회는 prop, 상세 이동은 스스로 읽은 `?c=`. 두 값이 갈리는 순간
  // 「목록이 보여 준 대화」와 「상세로 나른 대화」가 서로 다른 것을 말한다.
  // 여기서는 일부러 갈라 놓고 **한쪽만 나오는지** 본다 — prop 을 다시 `?c=` 직독으로
  // 되돌리면 landing 이 URL-ONLY 가 되어 red 다.
  it('주소의 ?c= 와 목록의 대화가 갈리면 목록 쪽을 나른다 — 출처는 하나다', async () => {
    renderRouted('/search/output?c=URL-ONLY', 'PROP-WINS')
    await waitFor(() =>
      expect(listOutputs).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: 'PROP-WINS' })))
    fireEvent.click(await screen.findByRole('button', { name: '상세보기' }))
    expect(await screen.findByTestId('landing')).toHaveTextContent('/search/output/o1?c=PROP-WINS')
    expect(screen.getByTestId('landing')).not.toHaveTextContent('URL-ONLY')
  })

  it('대화 id 의 특수문자는 인코딩해 싣는다', async () => {
    renderRouted('/search/output', 'a b/c')
    fireEvent.click(await screen.findByRole('button', { name: '상세보기' }))
    expect(await screen.findByTestId('landing')).toHaveTextContent('/search/output/o1?c=a%20b%2Fc')
  })

  // 예전에 이 자리에는 「`?c=` 가 없으면 빈 쿼리를 붙이지 않는다」가 있었다. 수정 R1
  // 이후 그 상태는 **화면에 도달할 수 없다** — 대화가 없으면 조회를 안 하므로 카드도,
  // 상세로 가는 문도 없다. 도달 불가능한 분기를 계속 단언하는 대신, 실제로 성립하는
  // 새 불변식을 잠근다(openDetail 의 `conversationId ?` 가드 자체는 방어로 남긴다).
  it('대화가 없으면 상세로 가는 문 자체가 열리지 않는다', async () => {
    renderRouted('/search/output')
    expect(await screen.findByText(/아직 볼 대화가 정해지지 않았습니다/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '상세보기' })).toBeNull()
  })
})

// ── round07f 최종 리뷰 M-3(어휘) ───────────────────────────────────────────────
// 같은 kind='caption' 을 필터 탭은 「설명문」, 카드 뱃지는 「캡션」이라 부른다.
// **어긋남 자체가 정본이다** — 디스크립션 항목 5 의 탭 목록은 「설명문」이고
// 프레임 두 곳(목록 카드 695:105902 · 상세 749:6491)은 「캡션」이며, 어느 쪽도
// 버리지 않는 것이 사용자 결정이다(round07f spec §2 결정 3 · 근거 §4.3 ·
// 대조표 `19_round07e-디스크립션-대조표.md` §1 #5·5-5).
// 한쪽으로 「통일」하는 순간 반대쪽이 정본에서 멀어지므로 두 문구를 함께 잠근다.
describe('어휘 — 필터 탭 「설명문」 · 뱃지 「캡션」 (M-3)', () => {
  it('필터 탭은 「설명문」이다', async () => {
    renderList()
    await screen.findByText(countText(/총 1건/))
    expect(screen.getByRole('button', { name: '설명문' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '캡션' })).toBeNull()
  })

  it('그 탭이 실어 보내는 kind 는 caption 이다', async () => {
    renderList()
    await screen.findByText(countText(/총 1건/))
    fireEvent.click(screen.getByRole('button', { name: '설명문' }))
    await waitFor(() =>
      expect(listOutputs).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'caption' })))
  })

  it('같은 kind 인데 카드 뱃지는 「캡션」이다 — 한 화면에 두 말이 남는 것이 정본이다', async () => {
    listOutputs.mockResolvedValue(RES([OUT({ kind: 'caption' })]))
    renderList()
    expect(await screen.findByText('캡션')).toBeInTheDocument()
    // 뱃지가 「설명문」으로 되돌아가면(필터 탭과 같은 말이 되면) 프레임에서 멀어진다.
    expect(screen.getByTestId('output-card-o1').textContent).not.toContain('설명문')
  })
})

// round07g — **산출물은 그 대화 안에서만 보인다.**
//
// 사용자 보고: 「산출물 생성 된것들은 그 세션에서만 산출된것들만 보여줘야해 —
// 지금 보면 다른 세션에서도 공유되거든?」 원인은 목록이 user_id 로만 걸러진 것이고,
// 이 목록이 대화 id 를 실어 보내는 것이 그 수정의 프론트 쪽 절반이다.
describe('대화 격리 (round07g)', () => {
  it('conversationId 를 목록 조회에 실어 보낸다', async () => {
    renderList({ conversationId: 'conv-A' })
    await waitFor(() =>
      expect(listOutputs).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: 'conv-A' })))
  })

  it('탭·검색을 좁혀도 대화는 그대로 실린다 — 축이 다르다', async () => {
    renderList({ conversationId: 'conv-A' })
    await screen.findByText(countText(/총 1건/))
    fireEvent.click(screen.getByRole('button', { name: '설명문' }))
    await waitFor(() =>
      expect(listOutputs).toHaveBeenLastCalledWith(
        expect.objectContaining({ kind: 'caption', conversationId: 'conv-A' })))
  })

  it('대화가 바뀌면 다시 읽는다 — 최초 범위에 굳으면 남의 대화가 계속 보인다', async () => {
    const { rerender } = renderList({ conversationId: 'conv-A' })
    await waitFor(() => expect(listOutputs).toHaveBeenCalledTimes(1))

    rerender(
      <ToastProvider>
        <MemoryRouter>
          <OutputList refreshKey={0} conversationId="conv-B" />
        </MemoryRouter>
      </ToastProvider>,
    )

    await waitFor(() =>
      expect(listOutputs).toHaveBeenLastCalledWith(
        expect.objectContaining({ conversationId: 'conv-B' })))
  })

})

// round07g 수정 R1 — **대화를 모르면 조회하지 않는다.**
//
// 리뷰 Important-1: 이 라운드의 배선을 다 깔고도 사용자가 신고한 증상이 그대로
// 재현되는 길이 남아 있었다. 라이브러리 딥링크는 대화를 실어 주지 못하고(운영
// 데이터에 프로젝트↔대화 연결이 아예 없다), 그러면 목록이 `conversation_id` 없이
// 조회해 **서버 기본값(내 전체)** 을 받는다 — 「다른 세션 것까지 보인다」 그대로다.
//
// 사용자 결정: 「대화가 없을 때 전체를 보여주는 것은 요구의 정반대다. 아무것도 안
// 보여주는 쪽이 맞다.」 서버 계약(안 주면 전체)은 다른 호출자를 위해 그대로 두고,
// 막는 자리를 **화면**으로 정했다. 아래 넷이 그 게이트를 잠근다 — 게이트를 지우면
// 첫째·둘째가 red 다(전자는 조회가 나가 버리고, 후자는 사유 문구가 사라진다).
describe('대화를 모를 때 (수정 R1 · Important-1)', () => {
  it('라이브여도 조회 자체를 하지 않는다 — 서버 기본값(전체)을 받지 않는다', async () => {
    renderList({ conversationId: null })
    // 이펙트가 돌 시간을 준 뒤에도 나가지 않았음을 본다(즉시 단언은 항진명제다).
    await screen.findByText(countText(/총 0건/))
    expect(listOutputs).not.toHaveBeenCalled()
  })

  it('왜 비었는지 말한다 — 「전체가 없다」가 아니라 「볼 대화가 없다」', async () => {
    renderList({ conversationId: null })
    expect(await screen.findByText(/산출물은 그 대화에서 만든 것만 보여줍니다/)).toBeInTheDocument()
    expect(screen.getByText(/나의 기록」에서 대화를 열면/)).toBeInTheDocument()
    // 조회를 안 했을 뿐 실패는 아니다 — 토스트를 띄우지 않는다(데모 모드와 같은 관행).
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('대화가 있는데 0건이면 「이 대화에서 만든 산출물이 없다」고 말한다', async () => {
    listOutputs.mockResolvedValue(RES([]))
    renderList()
    expect(await screen.findByText('이 대화에서 만든 산출물이 없습니다.')).toBeInTheDocument()
  })

  // 게이트가 「영영 안 보여준다」가 되면 안 된다. 대화는 `?c=` 재개·새 검색으로
  // **나중에 정해지는** 값이라, 정해지는 순간 목록이 채워져야 한다.
  it('대화가 정해지는 순간 조회가 나간다 — 막는 것이지 끄는 것이 아니다', async () => {
    const { rerender } = renderList({ conversationId: null })
    await screen.findByText(countText(/총 0건/))
    expect(listOutputs).not.toHaveBeenCalled()

    rerender(
      <ToastProvider>
        <MemoryRouter>
          <OutputList refreshKey={0} conversationId="conv-LATE" />
        </MemoryRouter>
      </ToastProvider>,
    )

    await waitFor(() =>
      expect(listOutputs).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: 'conv-LATE' })))
  })
})
