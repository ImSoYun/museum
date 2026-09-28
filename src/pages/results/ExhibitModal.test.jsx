// 이 파일의 책임: 전시자료 생성 모달(화면 제목 「학예 기획 자료 목록」).
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExhibitModal, { EXHIBIT_COLUMNS, DEFAULT_COLUMNS } from './ExhibitModal.jsx'
import { ToastProvider } from '../../components/Toast.jsx'

const CHIPS = [
  { nodeId: 'n1', label: '민주화운동', count: 80 },
  { nodeId: 'n2', label: '정치', count: 12 },
]
// 칩 합계는 92지만 실제로 담기는 것은 85건이다 — 7건이 두 노드에 동시에 걸려 있다
// (ADR-002 F-02 중복 노출은 정상이고, 서버는 _flatten 으로 합쳐 엑셀을 만든다).
// 그래서 이 값은 부모(OutputTab.selectedTotal)가 세어 내려준다.
const DEDUPED_TOTAL = 85

function renderModal(props = {}) {
  return render(
    <ToastProvider>
      <ExhibitModal
        open chips={CHIPS} total={DEDUPED_TOTAL} defaultTitle="민주화운동 전시자료" busy={false}
        onClose={() => {}} onRemoveChip={() => {}} onSubmit={() => {}} {...props}
      />
    </ToastProvider>,
  )
}

describe('제목과 부제', () => {
  it('피그마 문구를 쓴다', () => {
    renderModal()
    expect(screen.getByText('학예 기획 자료 목록')).toBeInTheDocument()
    expect(screen.getByText(/아래 몇가지 사항을 결정해주세요/)).toBeInTheDocument()
  })

  // round07g — 부제가 「전시 자료 목록을 엑셀로 만들기 전에, …」로 paraphrase 돼
  // 있던 것을 피그마 원문으로 되돌렸었다. round10b B-3가 exhibit 라벨을
  // 「전시자료」→「학예 기획 자료」로 개명했는데 이 부제만 개명 전 피그마 원문
  // 그대로 남아 모달 제목(위 테스트)과 갈려 있었다(재리뷰 M-7) — 제목과 같은
  // 이름으로 맞춘다. 위 테스트는 부분 문자열(정규식)이라 이 어긋남을 못 잡는다 —
  // 원문 전체를 그대로 잠근다.
  it('부제는 개명된 이름(학예 기획 자료)을 쓴다', () => {
    renderModal()
    expect(
      screen.getByText('학예 기획 자료 목록 엑셀표 제작을 위해 아래 몇가지 사항을 결정해주세요.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/^전시자료 목록/)).toBeNull()
  })
})

describe('피그마 순서·라벨 — round07g', () => {
  // 문구만 보면 순서가 안 잠긴다(세 라벨이 다 있어도 뒤바뀔 수 있다) — DOM에 실제로
  // 나타나는 위치(innerHTML 상의 첨자)로 순서를 단언한다.
  it('선택 자료 → 제목 설정 → 포함할 세부항목 순서다', () => {
    renderModal()
    const html = document.body.innerHTML
    const iSelect = html.indexOf('선택 자료')
    const iTitle = html.indexOf('제목 설정')
    const iDetail = html.indexOf('포함할 세부항목')
    expect(iSelect).toBeGreaterThan(-1)
    expect(iTitle).toBeGreaterThan(-1)
    expect(iDetail).toBeGreaterThan(-1)
    expect(iSelect).toBeLessThan(iTitle)
    expect(iTitle).toBeLessThan(iDetail)
  })

  it('섹션 라벨에 번호가 없다 — 빨간 원은 디스크립션 주석이지 화면 글자가 아니다', () => {
    renderModal()
    expect(screen.getByText('선택 자료')).toBeInTheDocument()
    expect(screen.getByText('제목 설정')).toBeInTheDocument()
    expect(screen.getByText('포함할 세부항목')).toBeInTheDocument()
    expect(screen.queryByText('1. 선택 자료')).toBeNull()
    expect(screen.queryByText('2. 포함할 세부항목')).toBeNull()
    expect(screen.queryByText('제목')).toBeNull() // '제목 설정'만 있어야 한다(하위 문자열 라벨 없음)
  })

  // round10b 재리뷰 M-7 — 개명(전시자료→학예 기획 자료)이 placeholder에서 갈려 있었다.
  it('제목 입력 placeholder는 「학예 기획 자료 타이틀」이다', () => {
    renderModal()
    expect(screen.getByPlaceholderText('학예 기획 자료 타이틀')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('전시자료 타이틀')).toBeNull()
    expect(screen.queryByPlaceholderText(/민주화운동 전시자료/)).toBeNull()
  })

  // spec 결정 8 — 피그마의 「전시유형·소장처·사진·크기·수량」은 목업이다. round07b가
  // 원천 실측(0%·편중)으로 이미 뺀 항목을 재배치 작업 중 실수로 되살리면 안 된다.
  it('세부항목(컬럼) 목록은 그대로다 — 피그마 목업 항목명을 들이지 않는다', () => {
    expect(EXHIBIT_COLUMNS).toEqual([
      '유물명', '시기', '연도', '자료번호', '주제', '분류', '상세설명', '원문링크', '공개여부',
      '이명칭', '재질', '국적', '크기', '사진', 'OCR',
    ])
    expect(EXHIBIT_COLUMNS).not.toContain('전시유형')
    expect(EXHIBIT_COLUMNS).not.toContain('소장처')
    expect(EXHIBIT_COLUMNS).not.toContain('수량')
  })
})

describe('1 선택 자료 뱃지', () => {
  it('노드명과 건수를 뱃지로 보여준다', () => {
    renderModal()
    expect(screen.getByText('민주화운동')).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()
  })

  it('X 로 삭제할 수 있다', () => {
    const onRemoveChip = vi.fn()
    renderModal({ onRemoveChip })
    fireEvent.click(screen.getByRole('button', { name: '민주화운동 선택 해제' }))
    expect(onRemoveChip).toHaveBeenCalledWith('n1')
  })

  // 모달이 약속하는 건수와 실제로 만들어지는 행 수가 달라선 안 된다. 칩 합계(92)를
  // 그대로 더하면 두 노드에 걸친 7건을 두 번 세어, 화면은 92건을 약속하고 엑셀은
  // 85행이 나온다.
  it('담기는 건수는 칩 합계가 아니라 중복을 뺀 수다', () => {
    renderModal()
    expect(screen.getByText('85건')).toBeInTheDocument()
    expect(screen.queryByText('92건')).toBeNull()
  })
})

describe('타임라인 생성 — 이 모달에는 없다', () => {
  // round07e 사용자 결정. 설명문 모달의 같은 이름 체크박스는 이 라운드에서
  // **실제로 동작**하므로, 아무 일도 하지 않는 쌍둥이를 남겨 두면 사용자가
  // 「왜 여긴 되고 저긴 안 되지」를 겪는다. 엑셀은 표라 타임라인이 무엇을
  // 만든다는 정의도 없고 신규 피그마에도 항목이 없다.
  it('체크박스도, 준비중 토스트도 없다', () => {
    renderModal()
    expect(screen.queryByLabelText(/타임라인 생성/)).toBeNull()
    expect(screen.queryByText(/타임라인/)).toBeNull()
  })
})

describe('2 포함할 세부항목', () => {
  // 이 describe가 잠그는 계약의 요지 — **전체 목록과 기본 선택은 다른 것이다.**
  // 15개를 전부 고를 수 있게 두되(2026-09-01 사용자 결정: 「저 메타를 다 넣을거야,
  // 추후 데이터만 추가하면 되니까」), 원천 편중이 큰 여섯은 켜져 있지 않다.
  it('표시 가치가 있는 메타 15개를 전부 낸다', () => {
    expect(EXHIBIT_COLUMNS).toEqual([
      '유물명', '시기', '연도', '자료번호', '주제', '분류', '상세설명', '원문링크', '공개여부',
      '이명칭', '재질', '국적', '크기', '사진', 'OCR',
    ])
  })

  it('서버 카탈로그와 어긋나면 422가 되므로 순서·내용을 그대로 잠근다', () => {
    // 정본은 서버 outputs/columns.py 다. 여기 목록이 앞서 나가면 사용자는
    // 이유를 알 수 없는 422를 본다.
    expect(DEFAULT_COLUMNS.every((c) => EXHIBIT_COLUMNS.includes(c))).toBe(true)
  })

  it('기본으로 켜지는 것은 전 원천 82.9% 이상인 9개뿐이다', () => {
    expect(DEFAULT_COLUMNS).toEqual([
      '유물명', '시기', '연도', '자료번호', '주제', '분류', '상세설명', '원문링크', '공개여부',
    ])
  })

  it('원천 편중이 큰 칩은 꺼진 채로 뜬다', () => {
    // archive 185,073건에서 0%인 열을 켜 두면 그 자료를 고른 학예사는 빈 열만 받는다.
    renderModal()
    for (const c of ['이명칭', '재질', '국적', '크기', '사진', 'OCR']) {
      expect(screen.getByRole('button', { name: c })).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it('꺼진 칩은 어느 원천에서 비는지를 미리 말한다', () => {
    // 고르고 나서 빈 열을 보고 「데이터가 없다」고 읽는 것을 막는다.
    renderModal()
    expect(screen.getByRole('button', { name: '크기' })).toHaveAttribute(
      'title', expect.stringContaining('아카이브'),
    )
  })

  it('칩을 눌러 끄고 켠다', () => {
    const onSubmit = vi.fn()
    renderModal({ onSubmit })
    fireEvent.click(screen.getByRole('button', { name: '상세설명' }))
    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))
    expect(onSubmit.mock.calls[0][0].columns).not.toContain('상세설명')
  })

  it('꺼진 칩을 켜면 요청에 실린다', () => {
    const onSubmit = vi.fn()
    renderModal({ onSubmit })
    fireEvent.click(screen.getByRole('button', { name: '크기' }))
    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))
    expect(onSubmit.mock.calls[0][0].columns).toContain('크기')
  })

  it('껐다 켠 열이 맨 뒤로 밀리지 않는다 — 열 순서는 카탈로그 순서다', () => {
    // 서버는 받은 순서를 그대로 엑셀 열 순서로 쓴다. 배열 끝에 붙이면 같은 칩
    // 조합인데 조작 이력에 따라 엑셀이 달라진다.
    const onSubmit = vi.fn()
    renderModal({ onSubmit })
    fireEvent.click(screen.getByRole('button', { name: '시기' }))
    fireEvent.click(screen.getByRole('button', { name: '시기' }))
    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))
    expect(onSubmit.mock.calls[0][0].columns).toEqual(DEFAULT_COLUMNS)
  })

  it('전부 끄면 생성할 수 없다', () => {
    renderModal()
    // 켜져 있는 것만 누른다 — 꺼진 칩을 누르면 오히려 켜진다.
    for (const c of DEFAULT_COLUMNS) fireEvent.click(screen.getByRole('button', { name: c }))
    expect(screen.getByRole('button', { name: '생성하기' })).toBeDisabled()
  })
})

describe('생성하기', () => {
  it('제목과 컬럼을 올린다', () => {
    const onSubmit = vi.fn()
    renderModal({ onSubmit })
    fireEvent.click(screen.getByRole('button', { name: '생성하기' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: '민주화운동 전시자료' }),
    )
  })

  it('고른 자료가 없으면 누를 수 없다', () => {
    renderModal({ chips: [], total: 0 })
    expect(screen.getByRole('button', { name: '생성하기' })).toBeDisabled()
  })
})
