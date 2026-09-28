import { useState } from 'react'
import { vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ToastProvider } from '../../components/Toast.jsx'
import MaterialModal from './MaterialModal.jsx'

// round07h — 라이브 분기 검증용. 기존 더미 테스트는 isLive:false 로 그대로 돈다.
// 각 테스트가 mockReturnValue/mockResolvedValue 로 값을 갈아끼운다.
vi.mock('../../lib/searchApi.js', () => ({
  isLive: vi.fn(() => false),
  fetchArtifactDetail: vi.fn().mockResolvedValue({ ok: false }),
}))
import { isLive, fetchArtifactDetail } from '../../lib/searchApi.js'

function renderModal(props) {
  return render(
    <ToastProvider>
      <MaterialModal {...props} />
    </ToastProvider>
  )
}

const DUMMY_MATERIAL = {
  id: 'm1',
  title: '민주화운동 기록사진 #1',
  meta: {
    location: '서울 / 유물번호 H-1000',
    theme: '근현대사',
    period: '1960~1980',
    detail: '해당 자료에 대한 상세 설명 더미 텍스트입니다.',
  },
  source: '출처: 국가기록원 · 저작권 안내 문구(더미).',
}

test('MaterialModal renders title', () => {
  renderModal({ material: DUMMY_MATERIAL, onClose: () => {} })
  expect(screen.getByText('민주화운동 기록사진 #1')).toBeInTheDocument()
})

// round07h — 더미도 라이브와 같은 3행(피그마)을 쓴다. 옛 라벨 '소장지/유물번호'는
// 폐기했다(위 '2단 레이아웃 (round07h)' describe 블록 주석 참조).
test('MaterialModal renders 소장처/유물번호 meta row', () => {
  renderModal({ material: DUMMY_MATERIAL, onClose: () => {} })
  expect(screen.getByText('소장처/유물번호')).toBeInTheDocument()
})

test('MaterialModal renders 공공누리 KOGL block', () => {
  renderModal({ material: DUMMY_MATERIAL, onClose: () => {} })
  expect(screen.getByText('공공누리')).toBeInTheDocument()
  expect(screen.getByText('OPEN')).toBeInTheDocument()
})

test('MaterialModal renders 이전 and 다음 footer buttons', () => {
  renderModal({ material: DUMMY_MATERIAL, onClose: () => {} })
  // Multiple 이전/다음 elements exist (footer nav + carousel arrows) — confirm at least one of each
  expect(screen.getAllByRole('button', { name: /이전/ }).length).toBeGreaterThan(0)
  expect(screen.getAllByRole('button', { name: /다음/ }).length).toBeGreaterThan(0)
})

test('MaterialModal: 이미지가 없으면 "이미지 없음" 플레이스홀더를 표시한다', () => {
  renderModal({ material: DUMMY_MATERIAL, onClose: () => {} })
  // 재작성 후 이미지 캐러셀은 없다 — 단일 이미지(있으면) 또는 플레이스홀더.
  expect(screen.getByText('이미지 없음')).toBeInTheDocument()
})

// ── 무이미지 플레이스홀더가 실제로 "보이는지" 잠근다(R6c-ext 리뷰 A2) ──
// .detail_popup_gallery 는 display:flex + align-items/justify-content:center 다. 그래서
// 폭을 스스로 정하지 않는 블록 자식은 flex item 이 되어 컨텐츠 폭(=0, 안내 문구는 absolute 라
// 폭에 기여하지 않는다)으로 붕괴하고 안내가 사라진다. 더미 85건이 전부 image:'' 라 항상
// 재현되는 경로다. jsdom 은 레이아웃을 계산하지 않으므로 "문구 존재 + w-full 부여"로 잠근다.
// round10c Task A1 — 오버레이가 body 로 포털되면서(아래 L1 참조) container(렌더한 자리)
// 안에는 더 이상 모달 마크업이 없다. 그래서 container.querySelector 대신
// document.querySelector 로 찾는다 — 이 테스트가 보려는 건 "폭 0 으로 붕괴하는가"이지
// "어디에 렌더됐는가"가 아니므로 단언 내용은 그대로다.
test('A2: 무이미지 자료의 플레이스홀더는 갤러리 안에서 폭 0 으로 붕괴하지 않는다(w-full)', () => {
  renderModal({ material: DUMMY_MATERIAL, onClose: () => {} })
  const gallery = document.querySelector('.detail_popup_gallery')
  expect(gallery).not.toBeNull()

  const label = screen.getByText('이미지 없음')
  expect(gallery.contains(label)).toBe(true)

  // 플레이스홀더 루트 = 갤러리의 직계 자식(flex item). 이 요소가 w-full 을 가져야 한다.
  //
  // round07j — 예전엔 firstElementChild 였다. 퍼블이 갤러리 안에 이전/다음 버튼을
  // 넣으면서 자식이 [이전 버튼, 플레이스홀더, 다음 버튼] 셋이 되어 첫째가 버튼이 됐다
  // (회귀가 아니다 — w-full 은 코드에 그대로 있다). **문구를 품은 직계 자식**을
  // 찾는 방식으로 바꾼다. 위치가 아니라 「안내를 담은 flex item 이 폭을 갖는가」가
  // 이 테스트가 지키려던 것이고, 그건 형제가 늘어나도 변하지 않는다.
  const placeholder = [...gallery.children].find((c) => c.contains(label))
  expect(placeholder, '안내 문구를 품은 갤러리 직계 자식이 없다').toBeDefined()
  expect(placeholder.className).toContain('w-full')
})

test('A2: 이미지 로드 실패 시에도 안내 문구가 갤러리 안에 폭을 가지고 남는다', () => {
  const withImg = { ...DUMMY_MATERIAL, image: 'https://example.org/broken.jpg' }
  renderModal({ material: withImg, onClose: () => {} })
  fireEvent.error(screen.getByRole('img', { name: '민주화운동 기록사진 #1' }))

  const gallery = document.querySelector('.detail_popup_gallery')
  const label = screen.getByText('이미지를 불러오지 못했습니다')
  expect(label).toBeInTheDocument()
  // round07j — 위 A2 테스트와 같은 이유로 위치가 아니라 포함관계로 찾는다.
  const placeholder = [...gallery.children].find((c) => c.contains(label))
  expect(placeholder, '안내 문구를 품은 갤러리 직계 자식이 없다').toBeDefined()
  expect(placeholder.className).toContain('w-full')
})

test('MaterialModal: 이미지가 있으면 <img>(alt=제목)로 렌더한다', () => {
  const withImg = { ...DUMMY_MATERIAL, image: 'https://example.org/a.jpg' }
  renderModal({ material: withImg, onClose: () => {} })
  const img = screen.getByRole('img', { name: '민주화운동 기록사진 #1' })
  expect(img).toHaveAttribute('src', 'https://example.org/a.jpg')
})

test('MaterialModal renders 제4유형 KOGL text', () => {
  renderModal({ material: DUMMY_MATERIAL, onClose: () => {} })
  expect(screen.getAllByText(/「공공누리」 제4유형/).length).toBeGreaterThan(0)
})

test('MaterialModal renders body text from material.meta.detail', () => {
  renderModal({ material: DUMMY_MATERIAL, onClose: () => {} })
  expect(screen.getByText('해당 자료에 대한 상세 설명 더미 텍스트입니다.')).toBeInTheDocument()
})

test('MaterialModal: 저작권자 허락이 아닌 source는 원문 대신 KOGL 블록을 표시한다', () => {
  renderModal({ material: DUMMY_MATERIAL, onClose: () => {} })
  // DUMMY source('출처: 국가기록원…')는 '저작권자 허락'이 아니므로 원문 대신 공공누리 블록으로 대체된다.
  expect(screen.queryByText(/출처: 국가기록원/)).toBeNull()
  expect(screen.getByText('공공누리')).toBeInTheDocument()
})

test('MaterialModal returns null when material is null', () => {
  renderModal({ material: null, onClose: () => {} })
  // material이 없으면 모달 본문(제목 등)이 렌더되지 않는다.
  // (ToastProvider가 항상 토스트 컨테이너 div를 렌더하므로 container.firstChild로는 판별 불가.)
  expect(screen.queryByText('민주화운동 기록사진 #1')).toBeNull()
})

// R6c-ext 리뷰 A3 — 푸터 이전/다음은 no-op 이므로 "이전/다음 자료가 없습니다"라는 사실
// 진술을 해서는 안 된다(경계가 아니어도 늘 그렇게 말했다). 이 라운드의 미구현 액션 계약
// 문구는 정확히 '준비 중입니다'다. 옛 문구가 되살아나면 red 가 되도록 부재까지 단언한다.
test('푸터 이전 버튼 클릭 시 "준비 중입니다" Toast가 노출된다', () => {
  renderModal({ material: DUMMY_MATERIAL, onClose: () => {} })
  // 푸터의 "이전" 버튼(캐러셀 화살표 "이전 이미지"와 구분: 정확히 name="이전")
  const prev = screen.getByRole('button', { name: '이전' })
  fireEvent.click(prev)
  expect(screen.getByRole('status')).toHaveTextContent('준비 중입니다')
  expect(screen.queryByText(/이전 자료가 없습니다/)).toBeNull()
})

test('푸터 다음 버튼 클릭 시 "준비 중입니다" Toast가 노출된다', () => {
  renderModal({ material: DUMMY_MATERIAL, onClose: () => {} })
  const next = screen.getByRole('button', { name: '다음' })
  fireEvent.click(next)
  expect(screen.getByRole('status')).toHaveTextContent('준비 중입니다')
  expect(screen.queryByText(/다음 자료가 없습니다/)).toBeNull()
})

test('소장기관: pageUrl이 없으면 비링크 라벨(토스트 없음)', () => {
  renderModal({ material: DUMMY_MATERIAL, onClose: () => {} })
  // 재작성 후 소장기관은 pageUrl이 있을 때만 링크. 없으면 비링크 span 라벨(클릭해도 토스트 없음).
  const label = screen.getByText('소장기관')
  expect(label.closest('a')).toBeNull()
})

test('소장기관: pageUrl이 있으면 institution 새 탭 링크로 렌더한다', () => {
  const withPage = { ...DUMMY_MATERIAL, institution: '국가기록원', pageUrl: 'https://archive.example.org/x' }
  renderModal({ material: withPage, onClose: () => {} })
  const link = screen.getByRole('link', { name: /국가기록원/ })
  expect(link).toHaveAttribute('href', 'https://archive.example.org/x')
  expect(link).toHaveAttribute('target', '_blank')
})

// T6-9: KOGL 제4유형 블록 조건부 렌더
const M1_KOGL = {
  id: 'm1',
  title: '6월 민주항쟁 거리시위 현장 사진',
  institution: '대한민국역사박물관',
  source: '출처: 대한민국역사박물관 · 공공누리 제4유형(출처표시·상업적 이용금지·변경금지)',
  meta: { location: '서울 / 유물번호 H-1001', theme: '민주화운동', period: '1987', detail: '더미' },
}

const M83_COPYRIGHT = {
  id: 'm83',
  title: '민주화운동과 시민사회 형성 논문집',
  institution: '근현대사연구학회',
  source: '출처: 근현대사연구학회 · 저작권자 허락',
  meta: { location: '서울 / 학회 자료 R-8001', theme: '민주화운동', period: '1960~2000', detail: '더미' },
}

test('T6-9: 공공누리 source인 m1은 KOGL 제4유형 블록을 표시한다', () => {
  renderModal({ material: M1_KOGL, onClose: () => {} })
  expect(screen.getByText('공공누리')).toBeInTheDocument()
  expect(screen.getByText('OPEN')).toBeInTheDocument()
  expect(screen.getAllByText(/「공공누리」 제4유형/).length).toBeGreaterThan(0)
})

test('T6-9: 저작권자 허락 source인 m83은 KOGL 제4유형 블록을 숨기고 source를 표시한다', () => {
  renderModal({ material: M83_COPYRIGHT, onClose: () => {} })
  expect(screen.queryByText('공공누리')).toBeNull()
  expect(screen.queryByText('OPEN')).toBeNull()
  expect(screen.queryByText(/「공공누리」 제4유형/)).toBeNull()
  expect(screen.getByText(/저작권자 허락/)).toBeInTheDocument()
})

// ── 중앙정렬 회귀 가드(round06c-ext D1-5b 후속 fix) ──
// 퍼블 .detail_popup 은 `position:fixed; left:50%; top:50%; transform: translate(-50%,-50%)`
// 로 **transform 으로** 중앙정렬한다. 그래서 종점이 `transform: none` 인 애니메이션
// (animate-modalIn, fill-mode both)을 이 요소에 붙이면 애니메이션이 끝난 뒤 중앙정렬이
// 지워져 모달이 자기 크기의 절반만큼 우하단으로 밀려 잘린다 — 브라우저 실측으로 발견했고
// jsdom 은 computed transform 을 계산하지 않아 렌더 단언으로는 잡히지 않는다.
// 그래서 (1) 마크업이 modalIn 을 쓰지 않는지 (2) 전용 popupIn 키프레임의 종점이 중앙정렬
// translate 를 유지하는지 를 **텍스트로** 잠근다.
test('detail_popup 은 transform 을 리셋하는 animate-modalIn 을 쓰지 않는다', () => {
  renderModal({ material: DUMMY_MATERIAL, onClose: () => {} })
  const popup = document.querySelector('.detail_popup')
  expect(popup).not.toBeNull()
  expect(popup.className).not.toContain('animate-modalIn')
  expect(popup.className).toContain('animate-popupIn')
})

test('popupIn 키프레임은 시작·종점 모두 중앙정렬 translate 를 유지한다', async () => {
  const { default: config } = await import('../../../tailwind.config.js')
  const kf = config.theme.extend.keyframes.popupIn
  expect(kf['0%'].transform).toContain('translate(-50%, -50%)')
  expect(kf['100%'].transform).toContain('translate(-50%, -50%)')
  // 회귀 방지: 종점이 none 으로 되돌아가면 중앙정렬이 깨진다
  expect(kf['100%'].transform).not.toBe('none')
  expect(config.theme.extend.animation.popupIn).toContain('popupIn')
})

// ── 퍼블 정본 동형 가드(R6c-ext 리뷰 A1·A4·A5) ──
// round06d 에서 Tailwind spacing 스케일이 px 기반으로 재정의됐다(px-6 = 6px, 1.2rem = px-24).
// 그래서 퍼블 1.2rem 패딩을 px-6/py-4 로 옮긴 곳은 값이 ¼로 줄어 본문과 눈에 보이게 어긋난다.
// 헤더는 퍼블 규칙(.panel_head.ty_modal)을 이식해 CSS 가 패딩을 담당하게 했으므로,
// JSX 에 Tailwind 패딩 유틸이 되살아나면 red 가 되도록 잠근다.
// round10c Task A1 — 포털 후 container 가 비므로(위 A2 주석과 같은 이유) document 로 찾는다.
test('A1: 모달 헤더는 퍼블 .panel_head.ty_modal 이고 Tailwind 패딩 유틸을 쓰지 않는다', () => {
  renderModal({ material: DUMMY_MATERIAL, onClose: () => {} })
  const head = document.querySelector('.panel_head.ty_modal')
  expect(head).not.toBeNull()
  // ¼ 축소를 만드는 유틸이 다시 들어오면 잡는다(px-6/py-4/py-3 계열).
  expect(head.className).not.toMatch(/\b[pmg][xytblr]?-\d\b/)
  // 제목은 popup_tit CSS(1.2rem/500/#000)가 그린다 — 같은 속성을 지정하는 Tailwind 금지.
  const tit = document.querySelector('.popup_tit')
  expect(tit).not.toBeNull()
  expect(tit.className).not.toMatch(/text-base|font-bold|text-ink/)
})

test('A4: detail_popup_license 는 detail_popup_content 의 형제(=.detail_popup 직계 자식)다', () => {
  renderModal({ material: DUMMY_MATERIAL, onClose: () => {} })
  const popup = document.querySelector('.detail_popup')
  const content = document.querySelector('.detail_popup_content')
  const license = document.querySelector('.detail_popup_license')
  expect(license).not.toBeNull()
  // content 안에 있으면 padding 이 이중으로 걸리고 라이선스가 본문과 함께 스크롤된다.
  expect(content.contains(license)).toBe(false)
  expect(license.parentElement).toBe(popup)
})

// 퍼블 .detail_popup_gallery 는 display:flex + align-items/justify-content:center 로 원본
// 이미지를 갤러리 한가운데 둔다(styles/publish/component.css:421-422). round06e 가 "이미지 클릭
// 확대"를 붙이며 갤러리와 <img> **사이에** 트리거 <button>을 끼워 넣자, flex 중앙정렬의 대상이
// <img>가 아니라 버튼이 되었다. 버튼은 w-full 이라 갤러리를 꽉 채우고(그래서 중앙정렬해도
// 제자리), 그 안의 <img>는 블록 요소로 좌측에 붙는다 → 이미지가 왼쪽으로 쏠린다.
// 해법은 버튼을 **레이아웃 중립**으로 만드는 것이다 — 버튼 스스로 중앙정렬 컨테이너가 되면
// 퍼블이 의도한 위치가 그대로 복원된다.
// w-full 은 반드시 유지한다: .detail_popup_gallery_img 의 max-width:80% 는 부모(=버튼) 폭을
// 기준으로 풀리므로, 버튼을 콘텐츠 폭으로 줄이면 퍼센트 기준이 바뀌어 이미지 크기가 달라진다.
// jsdom 은 Tailwind 계산값을 모르므로 "퍼블 중앙정렬을 깨뜨리지 않는 구조인가"를 구조 계약으로
// 잠근다(=A2 테스트가 w-full 을 클래스로 잠근 것과 같은 관례).
test('확대 버튼이 퍼블 갤러리의 중앙정렬을 깨지 않는다 — w-full 을 유지한 채 버튼 스스로 중앙정렬 컨테이너다', () => {
  const withImg = { ...DUMMY_MATERIAL, image: 'https://example.org/a.jpg' }
  renderModal({ material: withImg, onClose: () => {} })

  const gallery = document.querySelector('.detail_popup_gallery')
  const trigger = screen.getByRole('button', { name: '민주화운동 기록사진 #1 크게 보기' })
  // 트리거가 갤러리의 직계 자식(flex item)이다 — 퍼블 중앙정렬은 <img>가 아니라 이 요소에 걸린다.
  expect(trigger.parentElement).toBe(gallery)

  const classes = trigger.className.split(/\s+/)
  // 퍼센트 기준(=갤러리 폭)을 유지하려면 w-full 이 남아야 한다.
  expect(classes).toContain('w-full')
  // 그 폭 안에서 버튼이 직접 자식을 가운데 둔다.
  expect(classes).toContain('flex')
  expect(classes).toContain('items-center')
  expect(classes).toContain('justify-center')

  // 이미지의 크기·그림자·라운드는 퍼블 클래스가 담당한다 — 버튼으로 감싸도 이 훅이 <img>에 남아야 한다.
  const img = screen.getByRole('img', { name: '민주화운동 기록사진 #1' })
  expect(trigger.contains(img)).toBe(true)
  expect(img.className.split(/\s+/)).toContain('detail_popup_gallery_img')
})

test('이미지 클릭 시 라이트박스가 열리고 role="dialog" aria-label="이미지 크게 보기"다', () => {
  const withImg = { ...DUMMY_MATERIAL, image: 'https://example.org/a.jpg' }
  renderModal({ material: withImg, onClose: () => {} })

  fireEvent.click(screen.getByRole('img', { name: '민주화운동 기록사진 #1' }))

  expect(screen.getByRole('dialog', { name: '이미지 크게 보기' })).toBeInTheDocument()
})

test('라이트박스는 z-index 110이다 — .detail_popup(102)보다 위, jsdom은 실제 스택을 계산하지 않으므로 클래스로 값 자체를 고정한다', () => {
  const withImg = { ...DUMMY_MATERIAL, image: 'https://example.org/a.jpg' }
  renderModal({ material: withImg, onClose: () => {} })

  fireEvent.click(screen.getByRole('img', { name: '민주화운동 기록사진 #1' }))

  const lightbox = screen.getByRole('dialog', { name: '이미지 크게 보기' })
  expect(lightbox.className).toContain('z-[110]')
})

test('라이트박스는 배경 클릭·✕ 버튼·ESC로 닫힌다 — 상세 모달의 onClose는 호출되지 않는다', () => {
  // 라이트박스는 상세 모달 바깥 오버레이(onClick=onClose)의 자식이다. 배경/✕ 클릭이
  // stopPropagation 없이 위로 버블링하면 상세 모달까지 닫혀버린다(리뷰 Critical) —
  // 그래서 onClose를 스파이로 바꿔 "라이트박스만 닫히고 상세 모달은 안 닫힌다"를 잠근다.
  const withImg = { ...DUMMY_MATERIAL, image: 'https://example.org/a.jpg' }
  const onClose = vi.fn()
  renderModal({ material: withImg, onClose })

  fireEvent.click(screen.getByRole('img', { name: '민주화운동 기록사진 #1' }))
  fireEvent.click(screen.getByRole('dialog', { name: '이미지 크게 보기' }))
  expect(screen.queryByRole('dialog', { name: '이미지 크게 보기' })).toBeNull()

  fireEvent.click(screen.getByRole('img', { name: '민주화운동 기록사진 #1' }))
  fireEvent.click(screen.getByRole('button', { name: '이미지 확대 닫기' }))
  expect(screen.queryByRole('dialog', { name: '이미지 크게 보기' })).toBeNull()

  fireEvent.click(screen.getByRole('img', { name: '민주화운동 기록사진 #1' }))
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('dialog', { name: '이미지 크게 보기' })).toBeNull()

  expect(onClose).not.toHaveBeenCalled()
})

// round10a 최종리뷰 I-5 — Modal.jsx의 useEscapeToClose는 effect deps가 [active, onEscape]라
// onEscape identity가 바뀌면 cleanup이 토큰을 빼고 새 토큰을 스택 맨 위에 다시 push한다.
// MaterialModal은 라이트박스용을 먼저(:111), 상세용을 나중에(:118) 선언하므로, 라이트박스가
// 열린 채 부모가 한 번 리렌더하면(ChatTab.jsx onClose={() => setOpenMaterial(null)}처럼
// 매 렌더 새 함수를 만드는 흔한 패턴) 스택이 뒤집혀 Escape가 상세 모달을 닫아버린다
// (라이트박스와 함께 통째로 사라진다).
//
// ⚠️ 위 테스트('라이트박스는 배경 클릭·✕ 버튼·ESC로 닫힌다')가 지금 green인 이유가
// "onClose가 고정 identity vi.fn()이고 그 사이 리렌더가 없어서"이면 안 된다 — 그래서
// 이 시험은 부모가 실제로 리렌더해 onClose의 identity를 바꾸는 상황을 직접 만든다.
test('I-5: 라이트박스가 열린 채 부모가 리렌더해 onClose identity가 바뀌어도, Escape는 라이트박스만 닫는다', () => {
  const withImg = { ...DUMMY_MATERIAL, image: 'https://example.org/a.jpg' }
  const onCloseCalls = []

  function Host() {
    const [, setTick] = useState(0)
    return (
      <ToastProvider>
        <button onClick={() => setTick((t) => t + 1)}>부모 리렌더</button>
        {/* onClose를 매 렌더 새 클로저로 내려보낸다 — 고정 identity면 이 결함이 드러나지 않는다. */}
        <MaterialModal material={withImg} onClose={() => onCloseCalls.push('detail')} />
      </ToastProvider>
    )
  }

  render(<Host />)

  fireEvent.click(screen.getByRole('img', { name: withImg.title }))
  expect(screen.getByRole('dialog', { name: '이미지 크게 보기' })).toBeInTheDocument()

  // 부모가 리렌더해 onClose의 identity가 바뀐다(라이트박스는 열린 채로).
  fireEvent.click(screen.getByRole('button', { name: '부모 리렌더' }))

  fireEvent.keyDown(document, { key: 'Escape' })

  // 라이트박스만 닫힌다 — 상세 모달(onClose)은 불리지 않고 제목도 그대로 남는다.
  expect(screen.queryByRole('dialog', { name: '이미지 크게 보기' })).toBeNull()
  expect(onCloseCalls).toEqual([])
  expect(screen.getByText(withImg.title)).toBeInTheDocument()
})

test('라이트박스가 열리면 닫기 버튼에 포커스가 가고, 닫히면 트리거로 포커스가 복귀한다', () => {
  const withImg = { ...DUMMY_MATERIAL, image: 'https://example.org/a.jpg' }
  renderModal({ material: withImg, onClose: () => {} })

  const trigger = screen.getByRole('button', { name: '민주화운동 기록사진 #1 크게 보기' })
  fireEvent.click(trigger)
  expect(screen.getByRole('button', { name: '이미지 확대 닫기' })).toHaveFocus()

  fireEvent.click(screen.getByRole('button', { name: '이미지 확대 닫기' }))
  expect(trigger).toHaveFocus()
})

// round06e 리뷰 Important — ESC 경로가 closeLightbox()를 우회해 setLightboxOpen(false)를
// 직접 불렀다. 클릭 경로(위 테스트)는 이미 잠겼으니, ESC로 닫아도 같은 포커스 복귀가
// 일어나는지 별도로 잠근다(AlertPopup의 close()가 3경로를 통합하는 것과 같은 계약).
test('라이트박스를 ESC로 닫아도 트리거로 포커스가 복귀한다', () => {
  const withImg = { ...DUMMY_MATERIAL, image: 'https://example.org/a.jpg' }
  renderModal({ material: withImg, onClose: () => {} })

  const trigger = screen.getByRole('button', { name: '민주화운동 기록사진 #1 크게 보기' })
  fireEvent.click(trigger)
  expect(screen.getByRole('button', { name: '이미지 확대 닫기' })).toHaveFocus()

  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('dialog', { name: '이미지 크게 보기' })).toBeNull()
  expect(trigger).toHaveFocus()
})

// round06e 리뷰 Minor — 라이트박스가 aria-modal="true"를 선언했으니 AlertPopup과 같은
// 계약(Tab이 뒤에 가려진 .detail_popup으로 새지 않아야 한다)을 이행해야 한다. 포커스 가능
// 요소가 닫기 버튼 하나뿐이라 AlertPopup처럼 e.preventDefault() 한 줄로 충분하다.
test('라이트박스는 aria-modal 계약대로 Tab이 밖으로 새지 않는다', () => {
  const withImg = { ...DUMMY_MATERIAL, image: 'https://example.org/a.jpg' }
  renderModal({ material: withImg, onClose: () => {} })

  fireEvent.click(screen.getByRole('img', { name: '민주화운동 기록사진 #1' }))
  const closeBtn = screen.getByRole('button', { name: '이미지 확대 닫기' })
  expect(closeBtn).toHaveFocus()

  // Tab은 preventDefault 되므로 dispatch가 false를 반환한다(AlertPopup 테스트와 동일 관례).
  expect(fireEvent.keyDown(closeBtn, { key: 'Tab' })).toBe(false)
})

describe('2단 레이아웃 (round07h)', () => {
  afterEach(() => isLive.mockReturnValue(false))

  function renderLiveModal(detail) {
    isLive.mockReturnValue(true)
    fetchArtifactDetail.mockResolvedValue({ ok: true, detail })
    return renderModal({ material: { id: detail.idnbr, title: detail.idnbr }, onClose: () => {} })
  }

  const liveDetail = {
    idnbr: '2022005259',
    name: '님을 위한 행진곡',
    subject: ['문화예술 > 음악'],
    category: '문화예술-음악-대중가요',
    subject_era: '1980',
    datadc: '민주화운동을 상징하는 노래의 악보.',
    ocr_text: '',
    image: null,
    page_url: null,
  }

  it('제목이 유물 이름이다 — 자료번호가 아니다', async () => {
    renderLiveModal(liveDetail)
    expect(await screen.findByRole('heading')).toHaveTextContent('님을 위한 행진곡')
    expect(screen.getByRole('heading')).not.toHaveTextContent('2022005259')
  })

  it('행이 셋이다 — 수집처/자료번호 · 주제/장르 · 시대', async () => {
    renderLiveModal(liveDetail)
    const terms = await screen.findAllByRole('term')
    expect(terms.map((t) => t.textContent)).toEqual([
      // round07j — 퍼블이 라벨을 「수집처 / 자료번호」→「소장처/유물번호」,
      // 「주제 / 장르」→「주제/장르」로 바꿨다(공백 없는 슬래시). 문구는 퍼블이
      // 정본이므로(CLAUDE.md §2 「코드와 어긋나면 퍼블이 옳고 코드를 고친다」)
      // 코드가 아니라 이 단언을 옮긴다. 이 배열이 세 행의 정본이다.
      '소장처/유물번호', '주제/장르', '시대',
    ])
  })

  it('★ 폐기한 행이 다시 나타나면 안 된다', async () => {
    // 라이브 6행으로 되돌리면 이 테스트가 빨개진다. 그 셋은 아카이브
    // 185,073건에서 통째로 비고 피그마에도 없다.
    renderLiveModal(liveDetail)
    await screen.findAllByRole('term')
    expect(screen.queryByText('재질')).toBeNull()
    expect(screen.queryByText('크기')).toBeNull()
    expect(screen.queryByText('국적/시대')).toBeNull()
  })

  it('수집처가 없으면 자료번호만 보여준다', async () => {
    // holder 백필 전까지 늘 이 경로다.
    //
    // round07h Task 6 리뷰 fix(Minor M2) — 기존엔 findByText(/2022005259/)로
    // "페이지 어딘가에 부분 매치"만 봤다. 그런데 renderLiveModal은
    // material={id: detail.idnbr, title: detail.idnbr}로 렌더하므로, live 데이터가
    // 도착하기 전 첫 렌더의 <h3>(popup_tit)에 이미 idnbr 텍스트가 떠 있다 — 그래서
    // '.filter(Boolean)'을 빼 dd 값이 "undefined / 2022005259"(실제로는
    // join()이 undefined를 빈 문자열로 접어 " / 2022005259")가 돼도 여전히
    // 어딘가는(제목) idnbr을 정확히 담고 있어 이 단언이 초록으로 남았다.
    //
    // 그래서 (1) 이름이 뜰 때까지 기다려 live 렌더가 실제로 반영됐음을 확인하고
    // (2) 수집처/자료번호 행의 dd 를 **정확히 짚어** 그 textContent 가 자료번호와
    // 완전히 같은지(공백·구분자 없이) 본다 — 제목이나 다른 행과 우연히 겹칠 수 없다.
    renderLiveModal(liveDetail)
    await screen.findByText(liveDetail.name)
    const idRow = document.querySelector('.detail_popup_info_row')
    expect(idRow.querySelector('.detail_popup_info_term').textContent).toBe('소장처/유물번호')
    expect(idRow.querySelector('.detail_popup_info_desc').textContent).toBe(liveDetail.idnbr)
  })

  it('★ OCR 이 없어도 섹션을 숨기지 않는다', async () => {
    // 전체의 80%(archive 185,073건)가 OCR 0% 다. 숨기면 우단이 datadc
    // 하나만 남아 2단이 무너진다.
    renderLiveModal({ ...liveDetail, ocr_text: '' })
    expect(await screen.findByText(/OCR 텍스트가 없습니다/)).toBeInTheDocument()

    // round07k ③ — OCR 없는 조건에서도 원문/독음 토글이 보이고 상태가 정상이어야 한다.
    // 전체의 80%가 OCR 0%이므로 이 토글이 대부분의 자료에서 OCR 섹션과 함께 보인다는
    // 뜻이다. 토글이 숨겨지거나 에러가 나면 사용자는 OCR 섹션을 제대로 볼 수 없다.
    const wonmun = screen.getByRole('button', { name: '원문' })
    const dokeum = screen.getByRole('button', { name: '독음' })
    expect(wonmun).toHaveAttribute('aria-pressed', 'true')
    expect(dokeum).toHaveAttribute('aria-pressed', 'false')
  })

  it('OCR 이 있으면 본문을 보여준다', async () => {
    renderLiveModal({ ...liveDetail, ocr_text: '님을 위한 행진곡' })
    expect(await screen.findByText('님을 위한 행진곡', { selector: '.detail_popup_ocr_body' }))
      .toBeInTheDocument()
  })

  it('이미지가 없으면 플레이스홀더를 보여준다', async () => {
    renderLiveModal({ ...liveDetail, image: null })
    expect(await screen.findByText('이미지 없음')).toBeInTheDocument()
  })
})

// round07k ③ — 피그마의 OCR 머리줄에는 [원문|독음] 토글이 있는데 화면에 없었다.
// 독음 변환 기능은 이 라운드 범위 밖이라 **자리와 준비중 토스트까지**만 만든다.
test('OCR 머리줄에 원문·독음 토글이 있고 원문이 활성이다', () => {
  renderModal({ material: DUMMY_MATERIAL, onClose: () => {} })
  const wonmun = screen.getByRole('button', { name: '원문' })
  const dokeum = screen.getByRole('button', { name: '독음' })
  expect(wonmun).toHaveAttribute('aria-pressed', 'true')
  expect(dokeum).toHaveAttribute('aria-pressed', 'false')
})

// ★ 이 테스트가 이 기능의 요지다. 눌러서 상태가 바뀌면 사용자는 「독음을 켰는데
//   원문이 그대로 나온다」로 읽는다 — 준비 중임을 알리는 것이 목적이지 상태를
//   바꾸는 것이 목적이 아니다.
test('독음을 눌러도 원문이 활성인 채로 남고 준비중 토스트만 뜬다', async () => {
  renderModal({ material: DUMMY_MATERIAL, onClose: () => {} })
  fireEvent.click(screen.getByRole('button', { name: '독음' }))

  expect(await screen.findByText('준비 중입니다')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '원문' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: '독음' })).toHaveAttribute('aria-pressed', 'false')
})

// round10a Task 3-A — 라이브 재현: 「English」를 고르면 드롭다운 라벨만 English 로
// 바뀌고 본문은 한국어 그대로였다(토스트도 안내도 없다). 원인은 `lang` 상태를
// 읽는 곳이 아무 데도 없다는 것 — 라벨만 바뀐 채 실제 번역은 일어나지 않는다.
// 바로 위 「독음」과 같은 관행으로 맞춘다: 선택을 되돌리고 준비중 토스트만 띄운다.
test('언어 드롭다운에서 한국어 외를 선택해도 라벨은 한국어로 남고 준비중 토스트만 뜬다', async () => {
  renderModal({ material: DUMMY_MATERIAL, onClose: () => {} })
  const trigger = screen.getByRole('button', { name: /언어/ })
  fireEvent.click(trigger)
  fireEvent.click(within(screen.getByRole('listbox', { name: '언어' })).getByText('English'))

  expect(await screen.findByText('준비 중입니다')).toBeInTheDocument()
  expect(trigger).toHaveTextContent('한국어')
  expect(trigger).not.toHaveTextContent('English')
})

// ── round10c Task A1 — 오버레이를 body 로 포털한다 ────────────────────────────
//
// 라이브 실측(2026-09-18, https://sai.landsoft.co.kr): OutputDetailPage.jsx 의 목록
// 모달(공용 Modal, round10b 에서 이미 포털됨)과 이 컴포넌트는 둘 다 z-50 이지만, 이
// 컴포넌트는 페이지 트리에 남아 있다. 둘의 쌓임 맥락(stacking context) 조상이 다르면
// z-index 숫자 비교가 무의미하다(Modal.jsx round10b 주석과 같은 원인) — 그래서
// 나중에 연 유물정보가 먼저 연 목록 모달 **아래로** 깔린다. 관용구는
// components/Modal.test.jsx 의 'L1 — 오버레이는 body 로 포털된다'를 그대로 따른다.
describe('L1 — MaterialModal 오버레이는 body 로 포털된다', () => {
  it('오버레이가 렌더 위치가 아니라 document.body 의 자식이다', () => {
    const { container } = render(
      <div id="host" style={{ position: 'relative', zIndex: 1 }}>
        <ToastProvider>
          <MaterialModal material={DUMMY_MATERIAL} onClose={() => {}} />
        </ToastProvider>
      </div>,
    )
    // 렌더한 자리(container)에는 오버레이가 없다
    expect(container.querySelector('.fixed.inset-0.z-50')).toBeNull()
    // body 아래에서는 찾아진다
    const overlay = document.body.querySelector('.fixed.inset-0.z-50')
    expect(overlay).not.toBeNull()
    expect(overlay.parentElement).toBe(document.body)
  })

  it('닫으면(material=null) body 에서 사라진다', () => {
    const { rerender } = renderModal({ material: DUMMY_MATERIAL, onClose: () => {} })
    expect(document.body.querySelector('.fixed.inset-0.z-50')).not.toBeNull()
    rerender(
      <ToastProvider>
        <MaterialModal material={null} onClose={() => {}} />
      </ToastProvider>,
    )
    expect(document.body.querySelector('.fixed.inset-0.z-50')).toBeNull()
  })
})
