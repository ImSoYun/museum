import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { isLive, fetchArtifactDetail, downloadArtifactImage, toAbsolute } from '../../lib/searchApi.js'
import { triggerBrowserDownload } from '../../lib/downloadFile.js'
import { useToast } from '../../components/useToast.js'
import useBodyScrollLock from '../../components/useBodyScrollLock.js'
import useIsBottomOverlay from '../../components/useOverlayStack.js'
import LanguageDropdown from '../../components/LanguageDropdown.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import icClose from '../../assets/icons/ic_close.svg'
import icArrowDown20 from '../../assets/icons/ic_arrow_down_20.svg'
import icExternalLink from '../../assets/icons/ic_external_link.svg'
import icPagePrev from '../../assets/icons/ic_page_prev.svg'
import icPageNext from '../../assets/icons/ic_page_next.svg'
import icTextSelect from '../../assets/icons/ic_text_select.svg'
import icFitPage from '../../assets/icons/ic_fit_page.svg'
import icFitWidth from '../../assets/icons/ic_fit_width.svg'
import icZoomPlus from '../../assets/icons/ic_zoom_plus.svg'
import icZoomMinus from '../../assets/icons/ic_zoom_minus.svg'
import icSpread from '../../assets/icons/ic_spread.svg'
import icDownload from '../../assets/icons/ic_download.svg'
import icPrinter from '../../assets/icons/ic_printer.svg'
import icPdfPage from '../../assets/icons/ic_pdf_page.svg'
import icEdit from '../../assets/icons/ic_edit.svg'
import icCopyDark from '../../assets/icons/ic_copy_dark.svg'
import icSwap from '../../assets/icons/ic_swap.svg'

// 이 파일의 책임: NodeModal — 노드 그래프에서 자료를 눌렀을 때 여는 상세 모달.
// round07b-ext task-5·6 전면 재작성 — 퍼블 output_node.html:272-644의
// node_detail_modal 92규칙(component.css [S] node_detail 블록)을 그대로 옮기고,
// 우측 패널을 DUMMY_META·DUMMY_BODY·TRANSLATED_TEXT 상수에서 실데이터
// (fetchArtifactDetail)로 교체했다. 좌측 진짜 자료 옆에 「식별번호: 2024-00000」
// 같은 더미가 나란히 있던 상태가 오해를 불렀다(spec §0).
//
// task-7 — 가운데 뷰어(node_detail_viewer) 실동작 배선. 자료당 이미지가 정확히
// 1장이고 PDF 는 0건(MinIO 실측 58,837건 전부 jpg)이라 "페이지" 개념에 딸린
// 것(앞/뒷 페이지·인쇄)은 자리만 두고 `준비 중입니다` 토스트이고, 이미지 한 장에
// 실제로 적용되는 것(확대/축소·1:1·다운로드)만 동작한다. 텍스트선택·펼침·문서보기도
// 여전히 다음 범위지만 **onClick 없이 두지 않는다** — 눌러도 아무 일도 일어나지 않는
// 버튼은 "고장"으로 읽힌다. spec 결정2가 기능 없는 컨트롤에 요구하는 `준비 중입니다`
// 토스트를 붙여, 번역패널 아이콘들과 같은 규율로 묶는다.

// 자료 type → 유형 key 매핑 (없으면 '기타'). searchApi.deriveType의 역카테고리와 같은 어휘.
function typeKeyOf(m) {
  if (m.type === '사진' || m.type === '포스터') return 'image'
  if (m.type === '영상') return 'video'
  if (m.type === '음성') return 'audio'
  if (m.type === '도서') return 'book'
  return 'etc'
}

// 메타정보(디스크립션 5-3) — 있는 6개 + 우리 필드(시기·연도·분류·상세설명).
// 정렬순서·생산기관은 대응 컬럼이 없어 뺐다(spec §3.2) — 디스크립션이 「메타 확인 후
// 메타 양식에 맞게 기입」이라 명시했으므로 실제 스키마를 따른다.
const META_ROWS = [
  ['식별번호', (d) => d.idnbr],
  ['파일명', (d) => (d.image_path || '').split('/').pop()],
  ['명칭', (d) => d.name],
  ['이명칭', (d) => d.altrvnm],
  // 대분류만 뽑되 **중복을 제거**한다 — 한 자료가 「정치행정 > 정치」와
  // 「정치행정 > 행정」을 함께 가지면 대분류가 두 번 찍힌다(라이브 실측:
  // 「교육과학, 정치행정, 정치행정」). Set 은 삽입 순서를 지키므로 정렬은 그대로다.
  ['그룹', (d) => [...new Set((d.subject || []).map((s) => s.split(' > ')[0]))].join(', ')],
  ['파일경로', (d) => d.image_path],
  ['시기', (d) => d.era],
  ['연도', (d) => d.year_info],
  ['분류', (d) => d.category],
  // 2026-09-01 — 셋 다 상세 조회가 **이미 실어 오던** 값인데 그리지 않고 있었다
  // (reader.DETAIL_COLS 에 material·size_info·nation 이 들어 있다). 현장에서
  // 「크기」를 물어 온 것이 계기다. 공개·문화유산 자료에만 있어 아카이브 자료에서는
  // '—' 로 뜬다 — 그건 우리가 안 넣은 게 아니라 원천에 없는 것이다(spec §4.4).
  ['재질', (d) => d.material],
  ['크기', (d) => d.size_info],
  ['국적', (d) => d.nation],
  ['상세설명', (d) => d.datadc],
]

// 확대/축소는 20% 단위다(디스크립션 4-3). 하한 20% — 그 아래는 이미지가 뭔지
// 알아볼 수 없어 조작 실수로만 도달한다. 상한 400% — 원본 해상도(수천 px급 스캔본)
// 대비 과도한 배율에서 브라우저 렌더 성능이 무의미하게 나빠지는 지점을 끊었다.
const ZOOM_STEP = 20
const ZOOM_MIN = 20
const ZOOM_MAX = 400

export default function NodeModal({ node, items = [], onClose, onConfirm }) {
  // round10c Task A1 — 배경 스크롤 잠금.
  //
  // 라이브 실측(2026-09-18, /search/output): 노드를 열고 모달 **바깥** 좌표에서 휠을
  // 내리면 .dim.is_active·.node_detail_modal.is_active 는 열려 있는데
  // document.body.style.overflow === ''(잠금이 아예 없다)이라 배경 문서가 끝까지
  // 스크롤됐다.
  //
  // ⚠️ 열림 판정은 **`node` 로 한다 — 마운트로 하지 않는다.**
  //    round10c 전브랜치 리뷰 C1: 이 자리에 처음 들어간 코드는 `useBodyScrollLock(true)` 였고,
  //    근거로 「소비처가 `node` 가 있을 때만 조건부로 렌더하므로 마운트 = 열림」이라고 적혀
  //    있었다. **사실이 아니다.** 유일한 소비처 OutputTab.jsx:1083 은 이 컴포넌트를 최상위
  //    조각의 직계 자식으로 **무조건** 마운트하고, `selectedNode` 의 초기값은
  //    OutputTab.jsx:325 의 `useState(null)` 이다(바로 위 :1071 의 OutputList 는 `{!readOnly &&}`
  //    로 감싸 있지만 이 컴포넌트는 감싸여 있지 않다).
  //
  //    그래서 `true` 로 두면 이 라운드가 고치려던 것의 정반대가 난다 —
  //      · /search/output 과 /library/:id 산출물 탭에 **진입만 해도** body 가 잠겨,
  //        모달을 하나도 열지 않았는데 페이지가 스크롤되지 않는다(그 화면은 540px 스크롤 여지가 있다)
  //      · 오버레이 스택 index 0 을 이 토큰이 늘 차지해, 같은 화면의 ExhibitModal ·
  //        ExhibitionModal · CaptionModal · 완료 Modal 이 전부 「맨 아래가 아님」으로 판정돼
  //        **딤을 한 겹도 못 그린다**
  //    노드를 실제로 열었을 때는 index 0 이 자기 토큰이라 우연히 정상으로 보여, 눈으로는
  //    앞의 증상만 먼저 드러난다.
  //
  // 훅은 **조기반환(아래 `if (!node) return null`)보다 반드시 먼저** 불러야 한다
  // (Rules of Hooks — MaterialModal.jsx round07k ① 주석과 같은 이유). 그래서 훅을 위로
  // 올리되 **인자로** 열림을 넘긴다 — Modal.jsx 의 `open`, MaterialModal.jsx 의
  // `Boolean(material)` 과 같은 관행이다.
  const open = Boolean(node)
  useBodyScrollLock(open)
  // round10c Task A3 — 겹쳐 열려도 딤은 한 겹만. 열려 있는 동안만 스택에 올라간다.
  // useOverlayStack.js 머리주석 참조: 판정은 스택의 현재 상태에서 매번 파생되므로,
  // 닫는 순서가 엇갈려도 남은 위엣것이 딤을 되찾는다.
  const isBottom = useIsBottomOverlay(open)
  const { showToast } = useToast()
  const [checkedItems, setCheckedItems] = useState({})
  const [activeId, setActiveId] = useState(null)
  const [openType, setOpenType] = useState('all')
  const [detail, setDetail] = useState(null)
  const [langFrom, setLangFrom] = useState('English')
  const [langTo, setLangTo] = useState('한국어')
  const [zoom, setZoom] = useState(100)

  // 노드가 바뀌면 **선택을 비우고** 첫 자료를 열어 두며 좌측 트리는 "전체"를 편다.
  //
  // [왜 전체 체크로 시작하지 않는가]
  // 예전 구현은 열 때 전 항목을 체크했다(옛 NodeModal 의 동작을 그대로 물려받은
  // 것이고, 디스크립션이 시킨 적은 없다 — 목업의 「선택완료 80」은 목업 값이다).
  // 그러면 학예사가 **고르지 않은 자료가 기본으로 산출물에 담긴다.** 담을 것을
  // 고르는 화면에서 기본값이 "전부"인 것은 안전한 쪽이 아니다.
  //
  // [기준이 node?.id가 아니라 node 객체 자체인 이유 — round07i 감사 C]
  // 노드 id는 **정체성이 아니다.** node_graph.py는 id를 선택된 클래스 안에서만
  // n1부터 다시 매기므로(node_graph.py:188-205) 정치행정 n1과 경제산업 n1은 같은
  // id·다른 노드다. 기준을 id에 두면 그 둘 사이에서 이 이펙트가 아예 돌지 않아
  // **다른 노드의 자료에 앞 노드의 체크가 그대로 남는다** — 감사 C가 실측한
  // 오염(만든 적 없는 선택이 저장되던 경로)의 절반이 이것이었다. 부모(OutputTab)가
  // 그래프가 갈릴 때 모달을 닫도록 고쳐 그 경로 자체는 사라졌지만, 기준은 여기서도
  // 바로잡는다 — 노드를 바꾸는 새 경로가 다음에 또 생겨도 이 한 줄이 지켜 준다.
  // node는 부모의 useState 값이라 같은 노드를 보는 동안 참조가 바뀌지 않는다.
  useEffect(() => {
    setCheckedItems({})
    setActiveId(items[0]?.id ?? null)
    setOpenType('all')
  }, [node]) // eslint-disable-line react-hooks/exhaustive-deps

  // 선택된 자료의 상세를 읽는다(2-2). isLive()가 아니면(데모 시나리오 모드) 백엔드가
  // 없으므로 부르지 않는다 — MaterialModal.jsx와 같은 관행(§9.5 게이트는 라이브 전용).
  // 자료를 바꿀 때 배율도 100%로 되돌린다 — 이전 자료에서 확대해 둔 배율이 새
  // 이미지에 그대로 남아 있으면(예: 400%) 막 열자마자 잘려 보여 오해를 부른다.
  //
  // setDetail(null)을 **먼저** 하고 .catch로 마무리하는 것이 이 이펙트의 핵심이다
  // (MaterialModal.jsx의 같은 이펙트와 동형). 안 그러면 다음 자료를 부르는 동안
  // 방금 누른 행 아래에 **직전 자료의** 이름·공개뱃지·OCR·메타가 그대로 남고,
  // 요청이 거절되면(fetch reject) 그 상태가 영구가 된다 — 큐레이터가 A를 보면서
  // B의 메타를 읽는 것은 조용한 오독 사고다.
  useEffect(() => {
    setZoom(100)
    setDetail(null)
    if (!activeId || !isLive()) return undefined
    let alive = true
    fetchArtifactDetail(activeId)
      .then((res) => { if (alive) setDetail(res.ok ? res.detail : null) })
      .catch(() => { if (alive) setDetail(null) })
    return () => { alive = false }
  }, [activeId])

  if (!node) return null

  const prepared = () => showToast('준비 중입니다')
  const toggleItem = (id) => setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }))
  const checkedCount = Object.values(checkedItems).filter(Boolean).length

  // 확대/축소·1:1(디스크립션 4-3·4-2) — 자료당 이미지가 한 장뿐이라 배율은 뷰어
  // 인스턴스 전역 상태 하나로 충분하다(페이지별 배율을 따로 둘 이유가 없다).
  const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))
  const zoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))
  const fitOriginal = () => setZoom(100)
  // 세로 맞춤/가로 맞춤 — 원래 의미는 "뷰어 컨테이너 크기에 맞춰 계산한 배율"이지만,
  // 그러려면 컨테이너 실측(ResizeObserver)이 필요해 이번 범위 밖이다(브리프 지시).
  // 대신 component.css의 .node_detail_viewer_preview_img가 이미
  // max-width/max-height:100%; object-fit:contain 이라 100% 배율에서 이미지는
  // 항상 두 방향 모두 뷰어 안에 "맞춤" 상태다. 그래서 두 버튼 다 100%로 되돌리는
  // 것으로 처리한다 — 실측 없이 150% 같은 임의의 수를 "맞춤"이라 부르면 자료마다
  // 원본 비율이 달라 실제로는 안 맞는 경우가 더 많아 오히려 오해를 부른다.
  const fitToContainer = fitOriginal

  // 다운로드(4-4) — 실패를 삼키고 <a download>를 부르면 0바이트 저장이 조용히
  // 일어난다(코딩표준 §6). 그래서 ok:false면 서버 사유를 토스트로 보여주고
  // triggerBrowserDownload는 호출하지 않는다.
  const download = async () => {
    const res = await downloadArtifactImage(activeId)
    if (!res.ok) return showToast(res.notice)
    triggerBrowserDownload(res.blob, res.filename)
  }

  const confirm = () => {
    if (!onConfirm) {
      // onConfirm 미지정 호출부(다른 화면)를 깨지 않기 위한 기존 동작 유지.
      showToast('준비 중입니다')
      return onClose?.()
    }
    // 체크 순서가 아니라 **목록 순서**(=검색 랭킹 순)로 올린다 — 그 순서가 곧
    // 산출물 엑셀의 행 순서가 된다.
    onConfirm(items.map((it) => it.id).filter((id) => checkedItems[id]))
  }

  const TYPE_ENTRIES = [
    { key: 'all', label: '전체' },
    { key: 'image', label: '이미지' },
    { key: 'video', label: '영상' },
    { key: 'audio', label: '음원' },
    { key: 'book', label: '도서' },
    { key: 'etc', label: '기타' },
  ]

  const viewerImage = detail?.image_url ? toAbsolute(detail.image_url) : null
  const viewerFileName = (detail?.image_path || '').split('/').pop() || '원문'

  // round10c Task A1 — body 로 포털한다.
  //
  // 라이브 실측(2026-09-18): 이 컴포넌트는 (round10b 가 고친 공용 Modal.jsx 와 달리)
  // 페이지 트리에 남아 있었다. 원리는 Modal.jsx round10b 주석·MaterialModal.jsx 위
  // 주석과 같다 — `.dim`·`.node_detail_modal`(둘 다 CSS 로 position:fixed, 퍼블
  // component.css)은 자신이 마운트된 조상 아래에서 쌓임 맥락(stacking context)을
  // 만들고, 그 조상이 어떤 z-index 맥락에 있는지에 따라 결과가 화면마다 달라질 수
  // 있다. body 로 포털하면 맥락이 항상 루트가 되어 **어느 화면에서 열든** 같은 결과다.
  //
  // 조각(<>...</>) 전체를 통째로 포털한다 — `.dim`이 모달의 **형제**라는 퍼블 구조를
  // 그대로 유지해야 하는데(아래 주석), 절반만 옮기면 형제 관계가 깨진다.
  // round10c Task A3 — 맨 아래가 아니면 dim 배경만 투명으로 덮어쓴다. `.dim` 은 퍼블
  // 클래스라 CSS 파일은 고치지 않고 Tailwind bg-transparent 를 뒤에 붙여 배경색만
  // 덮는다(position:fixed·크기·z-index 는 `.dim` CSS 가 그대로 유지한다). 요소는
  // 지우지 않는다 — 배경 클릭으로 닫는 경로가 이 요소의 onClick 에 달려 있다.
  const dimClass = isBottom ? 'dim is_active' : 'dim is_active bg-transparent'
  return createPortal(
    <>
      <div className={dimClass} onClick={onClose} />
      {/* dim은 모달의 부모가 아니라 형제다(퍼블 구조, AlertPopup.jsx와 같은 관행) —
          그래서 모달 카드에 stopPropagation을 두지 않는다(전파되지 않는다). 포털로
          body 자식이 된 뒤에도 이 형제 관계(부모 아님)는 그대로다 — 조각째로 옮겼다. */}
      <div
        className="node_detail_modal is_active"
        role="dialog"
        aria-modal="true"
        aria-labelledby="node_detail_modal_tit"
      >
        <div className="panel_head ty_between">
          <h3 className="popup_tit" id="node_detail_modal_tit">{node.label}</h3>
          <button type="button" className="popup_close icon_btn" onClick={onClose} aria-label="닫기">
            <img src={icClose} alt="" className="popup_close_icon" />
          </button>
        </div>

        <div className="node_detail_modal_body">
          {/* ── 좌측 유형 아코디언 + 체크리스트 (디스크립션 2·2-1·2-2) ────────── */}
          <div className="node_detail_tree">
            {items.length === 0 ? (
              <EmptyState title="자료가 없습니다" description="이 노드에 연결된 자료가 아직 없습니다." />
            ) : (
              TYPE_ENTRIES.map((t) => {
                const itemsInType = t.key === 'all' ? items : items.filter((it) => typeKeyOf(it) === t.key)
                const allChecked = itemsInType.length > 0 && itemsInType.every((it) => checkedItems[it.id])
                const open = openType === t.key
                const rowId = `node_tree_${t.key}`
                return (
                  <div key={t.key}>
                    <div className={`node_detail_tree_row${open ? ' ty_active is_open' : ''}`}>
                      <span className="form_check ty_02">
                        <input
                          type="checkbox"
                          className="form_check_input"
                          id={rowId}
                          checked={allChecked}
                          onChange={() => {
                            const next = !allChecked
                            setCheckedItems((prev) => {
                              const copy = { ...prev }
                              itemsInType.forEach((it) => { copy[it.id] = next })
                              return copy
                            })
                          }}
                        />
                        <label className="form_check_label" htmlFor={rowId}>
                          <span className="sr_only">{t.label} 전체 선택</span>
                        </label>
                      </span>
                      <button
                        type="button"
                        className="node_detail_tree_row_toggle"
                        aria-expanded={open}
                        aria-controls={`${rowId}_sub`}
                        onClick={() => setOpenType((prev) => (prev === t.key ? null : t.key))}
                      >
                        <span className="node_detail_tree_row_label">
                          {t.label}
                          <span className="node_detail_tree_row_count">{itemsInType.length}</span>
                        </span>
                        <img className="node_detail_tree_row_arrow" src={icArrowDown20} alt="" />
                      </button>
                    </div>
                    <div className={`node_detail_tree_sub popup_scroll${open ? ' is_open' : ''}`} id={`${rowId}_sub`}>
                      {/* 접힌 유형의 자료는 마운트하지 않는다 — 늘 마운트해 두면 같은 자료명이
                          "전체"와 자기 유형 목록에 동시에 나타나 getByText 같은 정확 일치 조회가
                          중복으로 걸린다. 아코디언은 하나만 열리므로 자료는 항상 한 번만 그려진다. */}
                      {/* 범례 — 점이 무슨 뜻인지 모르면 점은 노이즈다. 미공개가
                          하나도 없으면 그리지 않는다(없는 범례도 노이즈다). */}
                      {open && itemsInType.some((it) => it.isPublic === false) && (
                        <p className="node_item_private_legend">
                          <span className="node_item_private_dot" aria-hidden="true" />
                          미공개
                        </p>
                      )}
                      {open && itemsInType.map((item) => {
                        const itemId = `node_item_${item.id}`
                        return (
                          <div key={item.id} className="node_detail_tree_sub_item">
                            {/* 체크박스와 자료명은 **다른 일**을 한다 — 체크는 산출물에
                                담을 것을 고르는 것이고, 이름 클릭은 그 자료를 우측에
                                띄워 살펴보는 것이다. 예전에는 이름이 label 안에 있어
                                브라우저가 label 클릭을 체크박스로 전달했고, 그래서
                                **자료를 볼 때마다 선택이 하나씩 풀렸다.** 이름을 label
                                밖으로 꺼내 둘을 갈랐다. */}
                            <span className="form_check ty_02">
                              <input
                                type="checkbox"
                                className="form_check_input"
                                id={itemId}
                                checked={!!checkedItems[item.id]}
                                onChange={() => toggleItem(item.id)}
                              />
                              <label className="form_check_label" htmlFor={itemId}>
                                <span className="sr_only">{item.title} 선택</span>
                              </label>
                            </span>
                            <button
                              type="button"
                              className="node_detail_tree_sub_item_label"
                              aria-current={activeId === item.id}
                              onClick={() => setActiveId(item.id)}
                            >
                              {item.title}
                            </button>
                            {/* 미공개만 점을 찍는다. null(모름)이면 아무 표시도 하지 않는다. */}
                            {item.isPublic === false && (
                              <span className="node_item_private_dot" title="미공개" aria-label="미공개" />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* ── 우측 메인: 메타헤드 + (뷰어 셸 | 번역·메타 패널) ────────────── */}
          <div className="node_detail_modal_main">
            <div className="node_detail_modal_meta_head">
              <div className="node_detail_modal_meta_tit">
                <b className="node_detail_modal_meta_tit_txt">{detail?.name ?? ''}</b>
                {/* 공개/미공개는 is_public이 true/false로 확정된 값일 때만 그린다(디스크립션 3) —
                    null/undefined(미상)까지 배지로 단정하면 큐레이터가 잘못된 판단을 하게 된다. */}
                {detail && detail.is_public != null && (
                  <span className="node_detail_modal_meta_tag">
                    {detail.is_public ? '공개' : '미공개'}
                  </span>
                )}
              </div>
              {detail?.page_url && (
                <a
                  href={detail.page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="node_detail_modal_source"
                >
                  원문 보기
                  <img src={icExternalLink} alt="" className="node_detail_modal_source_icon" />
                </a>
              )}
            </div>

            <div className="node_detail_modal_columns">
              {/* ── 중앙 뷰어 — 확대/축소·1:1·다운로드는 실동작, 나머지는 셸/토스트 ── */}
              <div className="node_detail_viewer">
                <div className="node_detail_viewer_bar">
                  <div className="node_detail_viewer_name">
                    <img src={icPdfPage} alt="" className="node_detail_viewer_name_icon" />
                    {/* round10b 재리뷰 M-3 — 말줄임표가 실제로 뜨려면 텍스트가 별도
                        요소여야 한다(publish-ext.css .node_detail_viewer_name_text 주석 참조). */}
                    <span className="node_detail_viewer_name_text">{viewerFileName}</span>
                  </div>
                  <div className="node_detail_viewer_tools">
                    <div className="node_detail_viewer_tools_group">
                      <button type="button" className="node_detail_viewer_tool icon_btn" aria-label="앞 페이지" onClick={prepared}>
                        <img src={icPagePrev} alt="" className="node_detail_viewer_tool_icon" />
                      </button>
                      <button type="button" className="node_detail_viewer_tool icon_btn" aria-label="뒷 페이지" onClick={prepared}>
                        <img src={icPageNext} alt="" className="node_detail_viewer_tool_icon" />
                      </button>
                    </div>
                    <div className="node_detail_viewer_tools_group ty_plain">
                      <button type="button" className="node_detail_viewer_tool icon_btn" aria-label="텍스트 선택" onClick={prepared}>
                        <img src={icTextSelect} alt="" className="node_detail_viewer_tool_icon" />
                      </button>
                      <button type="button" className="node_detail_viewer_tool icon_btn ty_box" aria-label="세로 맞춤" onClick={fitToContainer}>
                        <img src={icFitPage} alt="" className="node_detail_viewer_tool_icon" />
                      </button>
                      <button type="button" className="node_detail_viewer_11" aria-label="원본 크기" onClick={fitOriginal}>1:1</button>
                      <button type="button" className="node_detail_viewer_tool icon_btn ty_box" aria-label="가로 맞춤" onClick={fitToContainer}>
                        <img src={icFitWidth} alt="" className="node_detail_viewer_tool_icon" />
                      </button>
                    </div>
                    <div className="node_detail_viewer_tools_group ty_plain">
                      <button type="button" className="node_detail_viewer_tool icon_btn ty_fill" aria-label="확대" onClick={zoomIn}>
                        <img src={icZoomPlus} alt="" className="node_detail_viewer_tool_icon" />
                      </button>
                      {/* 배율 드롭다운 — 목록 없이 현재 배율만 표시(디스크립션에 배율 프리셋
                          목록 요구가 없다). 실제 선택 가능한 드롭다운으로 확장하는 것은 범위 밖. */}
                      <div className="node_detail_viewer_zoom dropdown_box">
                        <button type="button" className="dropdown_box_trigger" aria-haspopup="listbox" aria-expanded="false">
                          <span className="dropdown_box_value">{zoom}%</span>
                        </button>
                      </div>
                      <button type="button" className="node_detail_viewer_tool icon_btn ty_fill" aria-label="축소" onClick={zoomOut}>
                        <img src={icZoomMinus} alt="" className="node_detail_viewer_tool_icon" />
                      </button>
                    </div>
                    <div className="node_detail_viewer_tools_group ty_plain">
                      {/* <button type="button" className="node_detail_viewer_tool icon_btn" aria-label="펼침 보기" onClick={prepared}>
                        <img src={icSpread} alt="" className="node_detail_viewer_tool_icon" />
                      </button> */}
                      <button type="button" className="node_detail_viewer_tool icon_btn" aria-label="다운로드" onClick={download}>
                        <img src={icDownload} alt="" className="node_detail_viewer_tool_icon" />
                      </button>
                      <button type="button" className="node_detail_viewer_tool icon_btn" aria-label="인쇄" onClick={prepared}>
                        <img src={icPrinter} alt="" className="node_detail_viewer_tool_icon" />
                      </button>
                      {/* <button type="button" className="node_detail_viewer_tool icon_btn" aria-label="문서 보기" onClick={prepared}>
                        <img src={icPdfPage} alt="" className="node_detail_viewer_tool_icon" />
                      </button> */}
                    </div>
                    {/* 자료당 이미지 정확히 1장·PDF 0건이라(spec §4.2) 페이지는 늘 1/1이다. */}
                    <span className="node_detail_viewer_page">1 / 1</span>
                  </div>
                </div>
                <div className="node_detail_viewer_main">
                  <div className="node_detail_viewer_thumbs">
                    {viewerImage && (
                      <button type="button" className="node_detail_viewer_thumb is_active">
                        <span className="node_detail_viewer_thumb_img">
                          <img src={viewerImage} alt="" className="node_detail_viewer_thumb_img_icon" />
                        </span>
                        <span className="node_detail_viewer_thumb_num">1</span>
                      </button>
                    )}
                  </div>
                  {/* overflow:auto 를 인라인으로 준다 — 이식 CSS(component.css)는 건드리지
                      않는다는 제약 아래, 확대(zoom>100)로 이미지가 이 박스보다 커졌을 때
                      넘친 부분을 스크롤로 볼 수 있어야 확대가 실제로 의미가 있다. */}
                  <div className="node_detail_viewer_preview" style={{ overflow: 'auto' }}>
                    {viewerImage ? (
                      <img
                        src={viewerImage}
                        alt={`${detail?.name || ''} 원문 이미지`}
                        className="node_detail_viewer_preview_img"
                        style={{
                          width: `${zoom}%`,
                          // 이식 CSS .node_detail_viewer_preview_img가 max-width/max-height:100%를
                          // 갖고 있어(component.css, 손대지 않음) 인라인 width만으로는 100% 초과
                          // 확대가 항상 100%로 잘려 화면에 드러나지 않는다(박스모델 규칙 — 우선순위
                          // 문제가 아니다). 그래서 100%를 넘는 배율에서만 그 클램프를 인라인으로
                          // 해제한다 — 100% 이하에서는 굳이 덮어쓰지 않아 원래 클램프가 그대로 산다.
                          ...(zoom > 100 ? { maxWidth: 'none', maxHeight: 'none' } : {}),
                          // flexShrink:0 — 실브라우저 실측(격리 하네스)으로 드러난 2차 문제: 부모
                          // .node_detail_viewer_preview가 display:flex라 이 img는 플렉스 아이템이고,
                          // overflow:visible 상태에서 플렉스의 "자동 최소 크기"가 원본 이미지의
                          // 실제 픽셀 크기로 floor를 건다 — max-width:none만으로는 배율이 100%를
                          // 살짝만 넘어도 곧장 원본 픽셀 크기로 튀어버리고 그 뒤로는 배율을 더
                          // 올려도(200%·400%) 화면이 전혀 안 커지는 걸 실측했다. flexShrink:0으로
                          // "줄어들기" 자체를 꺼서 요청한 width:%가 그대로 반영되게 한다.
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <span className="node_detail_viewer_page">이미지 없음</span>
                    )}
                  </div>
                </div>
              </div>

              {/* ── 우측 번역/메타정보 패널 ──────────────────────────────────── */}
              <div className="node_detail_trans">
                <div className="node_detail_trans_head">
                  <div className="node_detail_trans_head_top">
                    <p className="node_detail_trans_tit">데이터 정보</p>
                    <span className="node_detail_trans_page">
                      <span className="node_detail_trans_page_label">현재</span>
                      <b className="node_detail_trans_page_value">1 Page</b>
                    </span>
                  </div>
                  {/* 번역 실동작은 범위 밖(spec §5) — 언어 드롭다운은 그리고 번역 버튼·
                      스왑 버튼은 준비중 토스트로 묶는다(브리프 5-1). */}
                  <div className="node_detail_trans_lang">
                    <LanguageDropdown value={langFrom} onChange={setLangFrom} noLabel={true} />
                    <button type="button" className="node_detail_trans_swap icon_btn" aria-label="언어 바꾸기" onClick={prepared}>
                      <img src={icSwap} alt="" className="node_detail_trans_swap_icon" />
                    </button>
                    <LanguageDropdown value={langTo} onChange={setLangTo} noLabel={true} />
                    <button type="button" className="btn btn_sm btn_white node_detail_trans_btn" onClick={prepared}>번역</button>
                  </div>
                </div>

                <div className="wrap ty_01">
                  <div className="node_detail_trans_body popup_scroll" tabIndex={0}>
                    <div className="node_detail_trans_sub_head">
                      <p className="node_detail_trans_sub_tit">번역정보</p>
                      <div className="node_detail_trans_actions">
                        <button type="button" className="node_detail_trans_action icon_btn" aria-label="수정" onClick={prepared}>
                          <img src={icEdit} alt="" className="node_detail_trans_action_icon" />
                        </button>
                        <button type="button" className="node_detail_trans_action icon_btn" aria-label="복사" onClick={prepared}>
                          <img src={icCopyDark} alt="" className="node_detail_trans_action_icon" />
                        </button>
                      </div>
                    </div>
                    {/* OCR 텍스트(디스크립션 5-2) — 번역 실동작이 없으니 원문(OCR 추출본) 그대로. */}
                    <p className="node_detail_trans_body_text">{detail?.ocr_text || ''}</p>
                  </div>
                </div>

                <div className="wrap ty_02">
                  <div className="node_detail_trans_meta popup_scroll" tabIndex={0}>
                    <div className="node_detail_trans_sub_head">
                      <p className="node_detail_trans_sub_tit">메타정보</p>
                      {/* round10c #26 — 기획 요청으로 「수정」(연필)을 **메타정보에서만** 걷는다.
                          바로 위 번역정보 블록(:507-514)의 같은 쌍은 그대로 둔다 — 기획이
                          메타정보만 지목했고, 둘은 성격이 다르다. 번역은 사람이 고쳐 쓸 여지가
                          있지만 메타정보는 원천 DB 값이라 이 화면에서 고칠 것이 아니다.
                          「복사」는 남긴다 — 값을 가져다 쓰는 것은 읽기 동작이다. */}
                      <div className="node_detail_trans_actions">
                        <button type="button" className="node_detail_trans_action icon_btn" aria-label="복사" onClick={prepared}>
                          <img src={icCopyDark} alt="" className="node_detail_trans_action_icon" />
                        </button>
                      </div>
                    </div>
                    <p className="node_detail_trans_meta_list">
                      {detail ? META_ROWS.map(([label, get]) => `- ${label}: ${get(detail) || '—'}`).join('\n') : ''}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button type="button" className="btn btn_lg btn_primary node_detail_modal_foot" onClick={confirm}>
          선택완료
          <span className="node_detail_modal_foot_tag">{checkedCount}</span>
        </button>
      </div>
    </>,
    document.body,
  )
}
