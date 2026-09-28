// 이 파일의 책임: 원문 뷰어(round07f) — doc(JSONB)에서 직접 그린다. 파일을
// 파싱하지 않는다(HWPX는 브라우저가 못 읽는다, spec §4.1).
import fs from 'node:fs'
import path from 'node:path'
import { expect, test, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ToastProvider } from '../../components/Toast.jsx'

// round11a task-10 — 뷰어가 설명문일 때 타임라인 3층(GET /outputs/{id}/timeline)도
// 함께 읽는다. **이 파일은 그 3층이 없을 때의 옛 2열 표 층을 잠근다** — 화면이
// 비면 안 되는 자리다. 새 3층은 OutputViewer.timeline.test.jsx 가 따로 잠근다.
//
// ⚠️ 그 폴백이 쓰이는 경로는 이제 **`/timeline` 조회 실패 하나**다(재리뷰
// MEDIUM-3 — 예전 이 주석은 「옛 산출물·공유 열람에서 실제로 쓰이는 경로」라고
// 적었고 공유 열람은 더 이상 그렇지 않다). 공유 열람은 doc 으로 3층을 만든다.
vi.mock('../../lib/outputsApi.js', () => ({ getOutputDoc: vi.fn(), getOutputTimeline: vi.fn() }))
// round10 재리뷰 — 뷰어가 공유 열람(프로젝트 경유) 원문 조회도 갖게 됐다.
vi.mock('../../lib/projectsApi.js', () => ({ getProjectOutputDoc: vi.fn() }))
const { getOutputDoc, getOutputTimeline } = await import('../../lib/outputsApi.js')
const { getProjectOutputDoc } = await import('../../lib/projectsApi.js')
const { default: OutputViewer, PRINT_BODY_CLASS } = await import('./OutputViewer.jsx')

// 목 호출 이력이 파일 안에서 누적되지 않게 한다(OutputDetailPage.test.jsx와 같은 규율 —
// vite.config.js·vitest.setup.js 어디에도 clearMocks가 없다).
beforeEach(() => {
  vi.clearAllMocks()
  // 3층을 못 받은 상태를 기본값으로 둔다 — 값이 없으면 undefined.then 으로
  // 이 파일 전체가 죽는다(OutputDetailPage.test.jsx 의 getOutputDoc 과 같은 이유).
  getOutputTimeline.mockResolvedValue({ ok: false, notice: '타임라인을 불러오지 못했습니다' })
})

function renderViewer(props) {
  return render(
    <ToastProvider>
      <OutputViewer outputId="o1" kind="caption" {...props} />
    </ToastProvider>,
  )
}

// ── round10 재리뷰 — 공유 열람에서는 프로젝트 경유로 원문을 읽는다 ───────────────
//
// 이 뷰어는 OutputDetailPage의 자식이고, 그 페이지가 `?project=`로 소유자 전용 호출
// 셋을 이미 갈랐는데 **여기 한 겹 더 깊은 네 번째**(getOutputDoc)가 남아 있었다.
// 그래서 남의 프로젝트에서 「상세보기」를 누르면 제목·선택자료·다운로드는 나오는데
// 본문만 403 사유 문구가 됐다(spec §5-5 「산출물 카드 — 활성 그대로」 미달).
const DOC = { kind: 'caption', title: '민주화운동', items: [] }

test('projectId 가 있으면 소유자 전용 getOutputDoc 대신 프로젝트 경유를 부른다', async () => {
  getProjectOutputDoc.mockResolvedValue({ ok: true, data: DOC })
  renderViewer({ projectId: 'p1' })
  expect(await screen.findByText('민주화운동')).toBeInTheDocument()
  expect(getProjectOutputDoc).toHaveBeenCalledWith('p1', 'o1')
  expect(getOutputDoc).not.toHaveBeenCalled()
})

// 대조군 — `?project=`가 없는 자료검색 경로는 한 줄도 바뀌지 않았다.
test('projectId 가 없으면 지금까지처럼 getOutputDoc 을 부른다', async () => {
  getOutputDoc.mockResolvedValue({ ok: true, data: DOC })
  renderViewer()
  expect(await screen.findByText('민주화운동')).toBeInTheDocument()
  expect(getOutputDoc).toHaveBeenCalledWith('o1')
  expect(getProjectOutputDoc).not.toHaveBeenCalled()
})

test('설명문 — 본문과 타임라인이 보인다', async () => {
  getOutputDoc.mockResolvedValue({
    ok: true,
    data: {
      kind: 'caption', title: '민주화운동', subtitle: '부제', body: '본문 문장.',
      items: [{ year_label: '1987년', headline: '6월 항쟁', source: '자료 · PS-1',
                background: '배경 문장.', event: '사건 문장.' }],
    },
  })
  renderViewer({ kind: 'caption' })
  await waitFor(() => expect(screen.getByText('본문 문장.')).toBeInTheDocument())
  // 표제는 「● 6월 항쟁」 한 문단이다(DOCX 렌더러와 같은 규격, spec §3.5) — ● 를
  // 별도 요소로 떼지 않으므로 부분 일치로 찾는다. getByText('6월 항쟁')처럼 완전
  // 일치로 쓰면 실패한다(브리프 원안의 오류 — 실측으로 확인).
  expect(screen.getByText(/6월 항쟁/)).toBeInTheDocument()
  expect(screen.getByText(/1987년/)).toBeInTheDocument()
})

// ⚠️ 여기서 잠그는 것은 **옛 2열 표**다 — `/timeline` 조회가 실패했을 때만 그리는
// 폴백이고, **지금의 DOCX 와는 다른 층**이다(재리뷰 MEDIUM-4 — 이 시험의 이름은
// 예전에 「문서 파일과 같은 규격이다」였고 그것은 이제 거짓이다). 백엔드가 표제
// 줄과 출처 줄을 파일에서 지웠고(`test_headline_line_is_gone`·
// `test_source_line_is_gone`), 세로선도 화면의 새 층과 같은 회색 `#E2E5EE` 로
// 바꿨다(LOW-7). 지금 규격을 잠그는 것은 OutputViewer.timeline.test.jsx 다.
//
// 그래도 이 네 가지를 계속 잠근다 — 옛 산출물과 조회 실패에서 실제로 그려지는
// 모양이고, 화면이 비면 안 되는 자리다. 연도 열 / 파란 세로선 / 표제 굵게 + ● /
// 출처 파란색(spec §3.5 당시의 규격).
test('/timeline 실패 폴백은 옛 2열 표다 — 연도열·파란 세로선·굵은 ●표제·파란 출처', async () => {
  getOutputDoc.mockResolvedValue({
    ok: true,
    data: {
      kind: 'caption', title: 't', subtitle: '', body: 'b',
      items: [{ year_label: '1987년', headline: '6월 항쟁', source: '자료 · PS-1',
                background: '', event: '' }],
    },
  })
  renderViewer({})
  const year = await screen.findByText('1987년')
  // ① 연도는 제 열(td)이다 — 내용과 같은 칸에 섞이지 않는다.
  expect(year.tagName).toBe('TD')
  // ② 세로선은 내용 열의 왼쪽 테두리다 — 자리는 docx 의 `_set_left_border` 와
  //    같지만 **색은 더 이상 같지 않다**(파일은 화면 새 층의 `#E2E5EE`, LOW-7).
  const bodyCell = year.nextElementSibling
  expect(bodyCell.className).toMatch(/border-l-2/)
  expect(bodyCell.className).toMatch(/#2B6CF0/)
  // ③ 표제는 ● 문자 + 굵게.
  const headline = screen.getByText(/6월 항쟁/)
  expect(headline.textContent).toBe('● 6월 항쟁')
  expect(headline.className).toMatch(/font-bold/)
  // ④ 출처는 파란색(#2B6CF0).
  expect(screen.getByText(/자료 · PS-1/).className).toMatch(/#2B6CF0/)
})

// round07i — 사용자 지적: 같은 연도 두 건이 화면에 두 줄로 따로 찍혔다.
// 서버는 이제 doc에 `groups`를 함께 싣는다(doc_builder.caption_to_doc) — 파일
// DOCX 렌더러와 **같은** group_by_year를 지난 결과라, 뷰어도 groups가 있으면
// 그것을 그려야 파일과 화면이 갈라지지 않는다(모듈 docstring의 [왜 렌더러
// 안이 아니라 여기인가]와 같은 이유).
test('설명문 — groups가 있으면 같은 연도는 한 번만 찍고 두 항목을 이어 붙인다', async () => {
  getOutputDoc.mockResolvedValue({
    ok: true,
    data: {
      kind: 'caption', title: 't', subtitle: '', body: 'b',
      items: [
        { year_label: '1990년', headline: '첫번째 자료', source: 's1', background: '', event: '' },
        { year_label: '1990년', headline: '두번째 자료', source: 's2', background: '', event: '' },
      ],
      groups: [{
        year_label: '1990년',
        items: [
          { year_label: '1990년', headline: '첫번째 자료', source: 's1', background: '', event: '' },
          { year_label: '1990년', headline: '두번째 자료', source: 's2', background: '', event: '' },
        ],
      }],
    },
  })
  renderViewer({})
  await waitFor(() => expect(screen.getByText(/첫번째 자료/)).toBeInTheDocument())
  expect(screen.getByText(/두번째 자료/)).toBeInTheDocument()
  // 연도 라벨은 한 번만 — td가 하나뿐이어야 한다(둘이면 옛 결함 그대로다).
  expect(screen.getAllByText('1990년')).toHaveLength(1)
})

// 옛 산출물은 doc에 `groups`가 없다(round07f 이후 저장분도 이 라운드 이전
// 생성분은 items만 있다) — 뷰어가 items 폴백을 잃으면 그 산출물들의 미리보기가
// 통째로 깨진다. groups 도입 전과 같은 모양(항목별 한 행)으로 계속 그려야 한다.
test('설명문 — groups가 없으면(옛 산출물) items를 그대로 그린다', async () => {
  getOutputDoc.mockResolvedValue({
    ok: true,
    data: {
      kind: 'caption', title: 't', subtitle: '', body: 'b',
      items: [
        { year_label: '1990년', headline: '첫번째 자료', source: 's1', background: '', event: '' },
        { year_label: '1990년', headline: '두번째 자료', source: 's2', background: '', event: '' },
      ],
      // groups 없음 — round07i 이전에 저장된 doc의 실제 모양.
    },
  })
  renderViewer({})
  await waitFor(() => expect(screen.getByText(/첫번째 자료/)).toBeInTheDocument())
  expect(screen.getByText(/두번째 자료/)).toBeInTheDocument()
  // 폴백 경로는 옛 결함을 그대로 재생한다 — items를 한 줄씩 그리므로 연도가
  // 두 번 찍힌다. 이 라운드가 고치는 것은 groups가 있는 **새** 산출물이지,
  // 이미 저장된 옛 doc을 소급해 고치는 것이 아니다(브리프 「깨뜨리면 안 되는
  // 것」 — 옛 items 폴백은 유지해야 한다).
  expect(screen.getAllByText('1990년')).toHaveLength(2)
})

test('전시자료 — 표가 보인다', async () => {
  getOutputDoc.mockResolvedValue({
    ok: true,
    data: { kind: 'exhibit', columns: ['유물명', '시기'], rows: [['사진', '1990년대']] },
  })
  renderViewer({ kind: 'exhibit' })
  await waitFor(() => expect(screen.getByText('사진')).toBeInTheDocument())
  expect(screen.getByRole('columnheader', { name: '유물명' })).toBeInTheDocument()
})

// round07i — kind='exhibition' 렌더 분기. doc 모양은 T6(doc_builder.exhibition_to_doc)
// 계약 그대로다: subtitle·title·intro·sections[{title,description,items}]·
// closing_title·closing. 자료는 자료명·연도 두 줄뿐이다(round07i spec §2.3 실측 —
// 자료번호도 출처도 MUCH 전시 페이지에 없다).
//
// round07i 최종 리뷰 F2 — overview_labels·intro_heading을 이제 서버가 doc에
// 실어 보낸다(exhibition_docx.py의 OVERVIEW_LABELS·INTRO_HEADING과 같은 값 —
// tests/test_doc_builder.py가 그 동일성을 값으로 잠근다). 이 목(mock)이 그
// 값을 손으로 채워 넣는 것은 이 파일이 컴포넌트만 격리해 보는 목적상
// 불가피하다 — 배선(그 필드가 실제로 payload에 실리는지)은
// OutputViewer.captionContract.test.jsx가 doc_builder.py 소스를 직접 읽어 따로 지킨다.
test('특별전시 — 부제·전시명·개요 라벨·섹션·맺음말이 보인다', async () => {
  getOutputDoc.mockResolvedValue({
    ok: true,
    data: {
      kind: 'exhibition', subtitle: '2026 특별기획전', title: '환경, 우리의 미래', intro: '전시 취지문.',
      overview_labels: ['전시기간', '장 소', '관 람 료', '관람시간', '관람문의'],
      intro_heading: '전시를 열며',
      sections: [
        { title: '1부. 오염의 기록', description: '오염의 역사를 담은 자료들.',
          items: [{ idnbr: 'A1', name: '스모그 사진', year: '1988' }] },
      ],
      closing_title: '나가며', closing: '맺음말 문장.',
    },
  })
  renderViewer({ kind: 'exhibition' })
  await waitFor(() => expect(screen.getByText('환경, 우리의 미래')).toBeInTheDocument())
  expect(screen.getByText('2026 특별기획전')).toBeInTheDocument()
  // 개요 라벨 5종 — 값은 비어 있다(운영 정보라 자료 메타로 채울 수 없다).
  // RTL의 기본 정규화가 꼬리 공백을 접으므로 기대값도 그에 맞춘다(실제 DOM
  // 텍스트는 "라벨 : " — 아래 평문 복사 테스트가 그 실제 문자열을 잠근다).
  expect(screen.getByText('전시기간 :')).toBeInTheDocument()
  expect(screen.getByText('관람문의 :')).toBeInTheDocument()
  expect(screen.getByText('전시 취지문.')).toBeInTheDocument()
  expect(screen.getByText('1부. 오염의 기록')).toBeInTheDocument()
  expect(screen.getByText('오염의 역사를 담은 자료들.')).toBeInTheDocument()
  expect(screen.getByText('스모그 사진')).toBeInTheDocument()
  expect(screen.getByText('1988')).toBeInTheDocument()
  expect(screen.getByText('나가며')).toBeInTheDocument()
  expect(screen.getByText('맺음말 문장.')).toBeInTheDocument()
  // 자료번호(idnbr)는 화면에 찍히지 않는다 — 이미지를 찾는 열쇠일 뿐이다.
  expect(screen.queryByText('A1')).toBeNull()
})

// 맺음말은 자료를 붙이지 않는다(파일 렌더러와 같은 규칙) — items가 없어도
// 죽지 않고, 그저 자료 목록이 없는 섹션 없는 글로만 그려져야 한다.
test('특별전시 맺음말에는 자료 목록이 없어도 죽지 않는다', async () => {
  getOutputDoc.mockResolvedValue({
    ok: true,
    data: {
      kind: 'exhibition', subtitle: '', title: '제목', intro: '',
      overview_labels: ['전시기간', '장 소', '관 람 료', '관람시간', '관람문의'],
      intro_heading: '전시를 열며',
      sections: [{ title: '1부', description: '', items: [{ idnbr: 'A1', name: '자료', year: '연도미상' }] }],
      closing_title: '', closing: '맺음말만 있다.',
    },
  })
  renderViewer({ kind: 'exhibition' })
  await waitFor(() => expect(screen.getByText('맺음말만 있다.')).toBeInTheDocument())
})

test('특별전시 내부 텍스트는 파일과 같은 순서의 평문이다', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
  getOutputDoc.mockResolvedValue({
    ok: true,
    data: {
      kind: 'exhibition', subtitle: '부제', title: '환경전', intro: '취지문.',
      overview_labels: ['전시기간', '장 소', '관 람 료', '관람시간', '관람문의'],
      intro_heading: '전시를 열며',
      sections: [{ title: '1부', description: '설명.',
        items: [{ idnbr: 'A1', name: '자료명', year: '1988' }] }],
      closing_title: '나가며', closing: '맺음말.',
    },
  })
  renderViewer({ kind: 'exhibition' })
  fireEvent.click(await screen.findByLabelText('내부 텍스트 복사'))
  await waitFor(() => expect(writeText).toHaveBeenCalled())
  expect(writeText.mock.calls[0][0]).toBe(
    ['부제', '환경전', '전시기간 : ', '장 소 : ', '관 람 료 : ', '관람시간 : ', '관람문의 : ',
     '', '전시를 열며', '취지문.', '', '1부', '설명.', '자료명', '1988', '', '나가며', '맺음말.'].join('\n'),
  )
  vi.unstubAllGlobals()
})

test('doc이 없으면(옛 산출물) 사유를 말한다', async () => {
  getOutputDoc.mockResolvedValue({ ok: false, notice: '이 산출물은 미리보기를 만들기 전에 생성되었습니다 — 다운로드로 확인해 주세요' })
  renderViewer({})
  await waitFor(() => expect(screen.getByText(/미리보기를 만들기 전에/)).toBeInTheDocument())
})

test('확대·축소·화면맞춤 버튼이 배율을 바꾼다', async () => {
  getOutputDoc.mockResolvedValue({ ok: true, data: { kind: 'caption', title: 't', subtitle: '', body: 'b', items: [] } })
  renderViewer({})
  await waitFor(() => screen.getByLabelText('확대'))
  fireEvent.click(screen.getByLabelText('확대'))
  expect(screen.getByText('110%')).toBeInTheDocument()
  fireEvent.click(screen.getByLabelText('축소'))
  fireEvent.click(screen.getByLabelText('축소'))
  expect(screen.getByText('90%')).toBeInTheDocument()
  // 「화면 맞춤」은 가로 맞춤이지만 jsdom에는 레이아웃이 없어 contentWidth가 0이다 —
  // 그때는 100%로 떨어진다(M10 ①의 가드가 실제로 도는지 여기서 잠근다).
  fireEvent.click(screen.getByLabelText('화면 맞춤'))
  expect(screen.getByText('100%')).toBeInTheDocument()
})

test('레이아웃이 없어도 페이지 표시가 1 / 1이다(NaN 금지)', async () => {
  // jsdom은 scrollHeight·clientHeight가 둘 다 0이라 가드가 없으면 「1 / NaN」이 찍힌다(M10 ③).
  //
  // 예전 판은 `waitFor(() => getByText('1 / 1'))`이었는데 **가드를 지워도 green이었다**
  // (R1 Important 3, 리뷰어 변이 3회 전부 통과). waitFor는 조건이 맞을 때까지 폴링하므로
  // effect가 반영되기 **전**의 초기 상태 1 / 1을 잡고 끝나 버린다. 그래서 여기서는
  // ① 툴바가 그려질 때까지(=doc 반영 + effect 실행까지) 기다린 다음
  // ② 배지의 textContent를 **그 시점에 한 번** 단언한다. 가드를 지우면 「1 / NaN」이 잡힌다.
  getOutputDoc.mockResolvedValue({ ok: true, data: { kind: 'caption', title: 't', subtitle: '', body: 'b', items: [] } })
  const { container } = renderViewer({})
  await screen.findByLabelText('확대')
  expect(container.querySelector('.node_detail_viewer_page').textContent).toBe('1 / 1')
})

// ── round10a Task 3-B ─────────────────────────────────────────────────────────
// 라이브 재현: 2페이지 문서에서 「뒷 페이지」를 눌러도 표시가 「1 / 2」 그대로였다.
// 실측: 본문의 scrollTop 은 226→302 로 실제로 움직였다(scrollHeight 838·clientHeight
// 536). 원인은 scrollByPage 가 `el.scrollBy({..., behavior:'smooth'})` 를 건 **직후**
// scrollTop 을 읽는 것 — smooth 스크롤은 다음 프레임 이후에야 움직이므로 그 순간엔
// 항상 이전 위치다. scroll 리스너가 아예 없어 휠로 굴려도 표시가 안 바뀌었다.
// jsdom 은 scrollTop 대입만으로 native scroll 이벤트를 스스로 내지 않으므로,
// 실측값을 Object.defineProperty 로 얹고 fireEvent.scroll 로 그 이벤트를 흉내낸다.
test('Task 3-B: 스크롤이 실제로 끝난 뒤(scroll 이벤트)에 페이지 표시가 움직인다', async () => {
  getOutputDoc.mockResolvedValue({ ok: true, data: { kind: 'caption', title: 't', subtitle: '', body: 'b', items: [] } })
  const { container } = renderViewer({})
  await screen.findByLabelText('확대')
  const el = container.querySelector('.node_detail_viewer_main')

  // jsdom 기본값(둘 다 0)을 브리프 실측값으로 덮는다.
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: 536 })
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: 838 })
  // total 을 세는 [doc, zoom] 이펙트가 방금 덮은 값으로 다시 돌게 zoom 을 한 번 바꾼다
  // (0/0 스냅샷으로 이미 정해진 total=1 을 폐기).
  fireEvent.click(screen.getByLabelText('확대'))
  expect(container.querySelector('.node_detail_viewer_page').textContent).toBe('1 / 2')

  // 실측대로 302까지 스크롤됐다고 보고 native scroll 이벤트를 쏜다 — 버튼(smooth
  // scrollBy)이든 휠이든 브라우저는 실제로 스크롤이 끝나면 이 이벤트를 낸다.
  Object.defineProperty(el, 'scrollTop', { configurable: true, value: 302 })
  fireEvent.scroll(el)

  expect(container.querySelector('.node_detail_viewer_page').textContent).toBe('2 / 2')
})

// ── round10a 최종 전브랜치 리뷰 파킹1 ────────────────────────────────────────
// round10a Task 3가 고친 것은 앞/뒤 페이지·휠 경로였고, 배율(확대/축소) 경로는
// brief 범위 밖이라 남아 있었다(progress.md 「파킹(범위 밖)」). 리뷰 판정: 경쟁은
// 없다 — [doc, zoom] 이펙트가 스크롤 이벤트와 경합하는 게 아니라, **브라우저가
// zoom 변경 시 scrollTop을 그대로 유지하면 scroll 이벤트가 아예 안 나서** 그
// 이펙트가 매번 current를 1로 되돌리는 것이 문제다. 즉 스크롤을 내린 채로 배율을
// 바꾸면(scroll 이벤트 없이) 실제 위치는 그대로인데 표시만 「1 / N」으로 굳는다.
test('파킹1: 스크롤을 내린 채 배율을 바꿔도(scroll 이벤트 없이) 페이지 표시가 1로 굳지 않는다', async () => {
  getOutputDoc.mockResolvedValue({ ok: true, data: { kind: 'caption', title: 't', subtitle: '', body: 'b', items: [] } })
  const { container } = renderViewer({})
  await screen.findByLabelText('확대')
  const el = container.querySelector('.node_detail_viewer_main')

  // Task 3-B와 같은 실측값 — jsdom 기본값(둘 다 0)을 덮는다.
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: 536 })
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: 838 })
  fireEvent.click(screen.getByLabelText('확대'))  // 110% — total을 2로 재계산시킨다
  expect(container.querySelector('.node_detail_viewer_page').textContent).toBe('1 / 2')

  // 실제로 끝까지 스크롤했다 — Task 3-B와 같은 방식으로 scroll 이벤트를 쏜다.
  Object.defineProperty(el, 'scrollTop', { configurable: true, value: 302 })
  fireEvent.scroll(el)
  expect(container.querySelector('.node_detail_viewer_page').textContent).toBe('2 / 2')

  // 배율을 한 번 더 바꾼다 — scrollTop(302)은 그대로다(브라우저가 배율 변경
  // 시 스크롤 위치를 유지하는 경우를 흉내낸다. jsdom도 scrollTop 대입만으로는
  // scroll 이벤트를 스스로 내지 않으므로 이 상황과 같다: scroll 리스너가 다시
  // 돌지 않는다). 표시가 「1 / 2」로 되돌아가면 파킹1이 재현된 것이다 — 실제
  // 위치(끝까지 스크롤)와 다른 값을 보여주는 거짓 표시다.
  fireEvent.click(screen.getByLabelText('확대'))  // 120%
  expect(container.querySelector('.node_detail_viewer_page').textContent).toBe('2 / 2')
})

// 퍼블의 .node_detail_viewer는 **이미지** 뷰어용 다크 크롬(#333)이다. 산출물 뷰어는
// 그 안에 검은 글자의 문서를 그리므로, 본문을 밝게 덮는 수식 클래스 없이는 아무것도
// 읽히지 않는다(R1 Critical). 마크업 쪽 절반을 여기서 잠근다 — CSS 쪽 절반은
// styles/css-contract.test.js가 잠근다.
test('뷰어 루트에 산출물 전용 수식 클래스 ty_output이 붙는다 — 다크 크롬 위 검은 글자 방지', async () => {
  getOutputDoc.mockResolvedValue({ ok: true, data: { kind: 'caption', title: 't', subtitle: '', body: 'b', items: [] } })
  const { container } = renderViewer({})
  await screen.findByLabelText('확대')
  const root = container.querySelector('.node_detail_viewer')
  expect(root.classList.contains('ty_output')).toBe(true)
})

// 배율을 transform:scale로 걸면 **레이아웃이 안 바뀐다** — 브라우저 실측에서 넓은 표를
// 61%로 줄여도 스크롤 영역이 원래 1759px 그대로여서 빈 가로 스크롤이 남았다. zoom은
// 레이아웃을 다시 흘려 스크롤 폭이 컨테이너 폭(1078px)으로 떨어진다. 되돌아가지 않게 잠근다.
test('배율은 --doc-zoom 변수로 나간다 — transform:scale이 아니다', async () => {
  getOutputDoc.mockResolvedValue({ ok: true, data: { kind: 'caption', title: 't', subtitle: '', body: 'b', items: [] } })
  const { container } = renderViewer({})
  await screen.findByLabelText('확대')
  const scaler = container.querySelector('.node_detail_viewer_doc')
  expect(scaler, '배율 래퍼가 없다').not.toBeNull()
  expect(scaler.style.getPropertyValue('--doc-zoom')).toBe('1')
  // transform으로 되돌아가면 위 실측 문제가 그대로 돌아온다.
  expect(scaler.getAttribute('style')).not.toContain('transform')
  fireEvent.click(screen.getByLabelText('확대'))
  expect(scaler.style.getPropertyValue('--doc-zoom')).toBe('1.1')
  // 단위가 붙으면 zoom이 무효가 된다(jsdom에서는 여기까지만 볼 수 있다 —
  // 실제 zoom 적용은 브라우저 실측으로 확인했다).
  expect(scaler.getAttribute('style')).not.toMatch(/--doc-zoom:[^;]*px/)
})

// 인쇄 규칙(publish-ext.css @media print)은 body.is_printing_output 안에서만 산다.
// 그 클래스를 붙였다 떼는 책임이 이 컴포넌트에 있다 — 전역으로 열어 두면 뷰어가 없는
// 화면(/library·/manage/*)의 Ctrl+P가 백지를 뽑는다(R1 Important 1).
test('인쇄 범위는 뷰어가 살아 있는 동안만 열린다 — 언마운트 뒤 Ctrl+P는 화면을 그대로 인쇄한다', async () => {
  getOutputDoc.mockResolvedValue({ ok: true, data: { kind: 'caption', title: 't', subtitle: '', body: 'b', items: [] } })
  const { unmount } = renderViewer({})
  await screen.findByLabelText('인쇄')

  expect(document.body.classList.contains(PRINT_BODY_CLASS)).toBe(false)
  // beforeprint는 인쇄 버튼(window.print())과 Ctrl+P 양쪽에서 뜬다.
  fireEvent(window, new Event('beforeprint'))
  expect(document.body.classList.contains(PRINT_BODY_CLASS)).toBe(true)
  fireEvent(window, new Event('afterprint'))
  expect(document.body.classList.contains(PRINT_BODY_CLASS)).toBe(false)

  // 인쇄 중 화면을 떠나도 클래스가 남지 않는다.
  fireEvent(window, new Event('beforeprint'))
  unmount()
  expect(document.body.classList.contains(PRINT_BODY_CLASS)).toBe(false)
  // 그리고 뷰어가 없는 화면에서 인쇄해도 범위가 다시 열리지 않는다.
  fireEvent(window, new Event('beforeprint'))
  expect(document.body.classList.contains(PRINT_BODY_CLASS)).toBe(false)
})

// 클래스 이름은 JS와 CSS 두 곳에 적힌다 — 한쪽만 바뀌면 인쇄가 조용히 죽는다.
test('인쇄 범위 클래스 이름이 publish-ext.css와 같다', () => {
  const css = fs.readFileSync(
    path.resolve(__dirname, '../../styles/publish-ext.css'), 'utf8',
  )
  expect(css).toContain(`body.${PRINT_BODY_CLASS} *`)
})

// 「내부 텍스트 복사」는 파일이 아니라 doc에서 만든 평문을 준다 — 뷰어가 파일을
// 파싱하지 않는다는 규율이 복사 경로에서도 지켜지는지 잠근다.
test('설명문 내부 텍스트를 평문으로 복사한다', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
  getOutputDoc.mockResolvedValue({
    ok: true,
    data: {
      kind: 'caption', title: '민주화운동', subtitle: '부제', body: '본문 문장.',
      items: [{ year_label: '1987년', headline: '6월 항쟁', source: '자료 · PS-1',
                background: '배경 문장.', event: '사건 문장.' }],
    },
  })
  renderViewer({})
  fireEvent.click(await screen.findByLabelText('내부 텍스트 복사'))
  await waitFor(() => expect(writeText).toHaveBeenCalled())
  const text = writeText.mock.calls[0][0]
  // 평문은 **화면에 그려진 것과 같은 글자**여야 한다. 여기는 `/timeline` 이
  // 실패한 갈래라 화면이 옛 2열 표이고, 평문도 그 표와 같은 `● {표제}` ·
  // `출처␣␣{출처}`(두 칸)다. ⚠️ **지금의 DOCX 에는 그 두 줄이 없다**(재리뷰
  // MEDIUM-4 — 예전 이 주석은 「문서 파일과 같은 글자」라고 적혀 있었다).
  // 파일과 같은 층을 말하는 평문은 `decadePlainLines` 쪽이고, 그것은
  // OutputViewer.timeline.test.jsx 가 잠근다.
  // 두 칸·● 자체는 옛 규율 그대로다 — 예전 평문은 ● 가 없고 한 칸이라 복사본이
  // 화면과 달랐다(R1 Minor 2).
  expect(text).toContain('1987년  ● 6월 항쟁')
  expect(text).toContain('출처  자료 · PS-1')
  // 문단 구분 빈 줄이 실제로 살아 있다 — 예전 판은 `.filter(Boolean)`이 빈 줄을
  // 모두 지워 구분자가 죽은 코드였다(R1 Minor 1).
  expect(text).toBe(
    ['민주화운동', '부제', '', '본문 문장.', '', '타임라인',
     '1987년  ● 6월 항쟁', '출처  자료 · PS-1', '배경: 배경 문장.', '사건: 사건 문장.'].join('\n'),
  )
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('클립보드에 복사'))
  vi.unstubAllGlobals()
})

// round07i 리뷰 Important 1 — plainText가 doc.groups 대신 doc.items를 그대로
// 훑으면 같은 연도 항목을 복사했을 때 화면(한 번)과 평문(두 번)이 갈린다.
// 화면 테스트(위 '설명문 — groups가 있으면…')와 짝을 이루는 복사 경로 테스트다.
test('설명문 내부 텍스트 복사 — groups가 있으면 같은 연도는 한 번만 찍는다(화면과 같은 계약)', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
  getOutputDoc.mockResolvedValue({
    ok: true,
    data: {
      kind: 'caption', title: 't', subtitle: '', body: 'b',
      items: [
        { year_label: '1990년', headline: '첫번째 자료', source: 's1', background: '', event: '' },
        { year_label: '1990년', headline: '두번째 자료', source: 's2', background: '', event: '' },
      ],
      groups: [{
        year_label: '1990년',
        items: [
          { year_label: '1990년', headline: '첫번째 자료', source: 's1', background: '', event: '' },
          { year_label: '1990년', headline: '두번째 자료', source: 's2', background: '', event: '' },
        ],
      }],
    },
  })
  renderViewer({})
  fireEvent.click(await screen.findByLabelText('내부 텍스트 복사'))
  await waitFor(() => expect(writeText).toHaveBeenCalled())
  const text = writeText.mock.calls[0][0]
  // 연도 라벨은 딱 한 번 — 두 번이면 옛 결함(리뷰 Finding 1)이 되살아난 것이다.
  expect((text.match(/1990년/g) || []).length).toBe(1)
  expect(text).toContain('1990년  ● 첫번째 자료')
  expect(text).toContain('● 두번째 자료')
  expect(text).not.toContain('1990년  ● 두번째 자료')
  vi.unstubAllGlobals()
})

// 옛 산출물(doc에 groups가 없다)을 복사해도 깨지지 않는지 잠근다 — 화면 폴백
// 테스트(위 '설명문 — groups가 없으면…')와 짝이다. 폴백은 항목마다 독립된
// 그룹으로 취급하므로 예전과 같은 모양(연도가 항목 수만큼 반복)을 그대로 낸다 —
// 옛 산출물을 소급해 고치지 않는다는 브리프 규칙을 복사 경로에서도 지킨다.
test('설명문 내부 텍스트 복사 — groups가 없으면(옛 산출물) items를 항목별로 그대로 복사한다', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
  getOutputDoc.mockResolvedValue({
    ok: true,
    data: {
      kind: 'caption', title: 't', subtitle: '', body: 'b',
      items: [
        { year_label: '1990년', headline: '첫번째 자료', source: 's1', background: '', event: '' },
        { year_label: '1990년', headline: '두번째 자료', source: 's2', background: '', event: '' },
      ],
      // groups 없음 — round07i 이전에 저장된 doc의 실제 모양.
    },
  })
  renderViewer({})
  fireEvent.click(await screen.findByLabelText('내부 텍스트 복사'))
  await waitFor(() => expect(writeText).toHaveBeenCalled())
  const text = writeText.mock.calls[0][0]
  expect(text).toBe(
    ['t', '', 'b', '', '타임라인',
     '1990년  ● 첫번째 자료', '출처  s1',
     '1990년  ● 두번째 자료', '출처  s2'].join('\n'),
  )
  vi.unstubAllGlobals()
})

// 목록 요약본의 kind와 doc의 kind가 어긋날 수 있다(옛 데이터·재생성 중간 상태).
// 복사 경로가 prop을 믿으면 doc에 없는 필드(columns/rows)를 읽어 TypeError로 죽는다.
test('복사·렌더는 prop이 아니라 doc.kind를 따른다 — 둘이 어긋나도 죽지 않는다', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
  getOutputDoc.mockResolvedValue({
    ok: true,
    data: { kind: 'caption', title: '제목', subtitle: '', body: '본문.', items: [] },
  })
  // prop은 exhibit이라고 말하지만 doc은 caption이다.
  renderViewer({ kind: 'exhibit' })
  expect(await screen.findByText('본문.')).toBeInTheDocument()
  fireEvent.click(screen.getByLabelText('내부 텍스트 복사'))
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('제목\n\n본문.'))
  vi.unstubAllGlobals()
})

test('전시자료 내부 텍스트는 탭으로 구분한 표다', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
  getOutputDoc.mockResolvedValue({
    ok: true,
    data: { kind: 'exhibit', columns: ['유물명', '시기'], rows: [['사진', '1990년대']] },
  })
  renderViewer({ kind: 'exhibit' })
  fireEvent.click(await screen.findByLabelText('내부 텍스트 복사'))
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('유물명\t시기\n사진\t1990년대'))
  vi.unstubAllGlobals()
})

// ── round07f 최종 리뷰 M-1 ─────────────────────────────────────────────────────
// 상세 화면(OutputDetailPage)은 라우트 패턴이 같아 outputId 만 바뀌면 리마운트되지
// 않는다 — 이 뷰어도 같은 트리에 남아 prop 만 갈아 끼운 채 산다. 이펙트가 진입할 때
// 앞 산출물의 사유 문구를 지우지 않으면 그 문구가 **새 산출물의 원문을 영영 가린다**.
test('outputId 만 바뀌면 옛 사유 문구가 새 원문을 덮지 않는다', async () => {
  getOutputDoc.mockImplementation((id) =>
    id === 'bad'
      ? Promise.resolve({ ok: false, notice: '이 산출물은 미리보기를 만들기 전에 생성되었습니다' })
      : Promise.resolve({
          ok: true,
          data: { kind: 'caption', title: '제목', subtitle: '', body: '새 본문.', items: [] },
        }))
  const { rerender } = renderViewer({ outputId: 'bad' })
  await waitFor(() =>
    expect(screen.getByText(/미리보기를 만들기 전에 생성되었습니다/)).toBeInTheDocument())

  rerender(
    <ToastProvider>
      <OutputViewer outputId="good" kind="caption" />
    </ToastProvider>,
  )

  await waitFor(() => expect(screen.getByText('새 본문.')).toBeInTheDocument())
  expect(screen.queryByText(/미리보기를 만들기 전에 생성되었습니다/)).toBeNull()
})
