// 이 파일의 책임: 「대한민국사 원문 뷰어」(round11a task-10) — 피그마
// `W2mzOqDBRKgVrVW5iiEd8i` 의 `988:7897`(우측 패널 확대) · `988:6277`(2단 전체).
//
// 산출물 상세의 **오른쪽 칸**이다. 국사편찬위원회 『대한민국사 연표』의 스캔
// 쪽을 그대로 보여 주고, 그 위에 OCR 이 잡아 둔 사건 영역(`bbox`)을 얹는다.
//
// [왜 OutputViewer 를 재사용하지 않는가]
// 툴바 마크업(`node_detail_viewer_*`)과 배율 방식은 좌측 뷰어와 **같은 것을
// 쓴다** — 퍼블(component.css)이 이미 들고 있는 클래스다. 다른 것은 셋뿐이고
// 그래서 파일을 가른다:
//   · 그리는 것이 문서(JSON)가 아니라 **이미지**다 — 배율·맞춤의 뜻이 다르다
//   · 툴바 배경이 검정(#000)이 아니라 **#AEAEAE** 다(피그마 실측)
//   · 좌측에만 있는 `✏ 수정`·프린터·텍스트 복사가 **없다**
// 배경색은 우측 전용 수식 클래스 `ty_chronology` 로 덧쓴다 — 퍼블 원본
// (styles/publish/component.css)은 납품물이라 손대지 않고 publish-ext.css 에
// 더한다. 좌측의 `ty_output` 이 정확히 같은 선례다(OutputViewer.jsx 머리 주석).
//
// [이번 태스크에서 만들지 않는 것]
// 사건을 **붙이는** 동작은 task-11 몫이다. 여기서는 `onEventPick` 콜백 자리만
// 뚫어 두고, 그 prop 이 없으면(=보기 모드) 사건 영역을 클릭 대상으로 만들지
// 않는다 — 커서도 호버도 포커스도 주지 않는다. 검색도, 쪽 번호 직접 입력도
// 없다(spec §2.6 · 시안에 없다).
import { useEffect, useRef, useState } from 'react'
import { getPageEvents, getVolumePages, pageImageUrl } from '../../lib/chronologyApi.js'
import icPagePrev from '../../assets/icons/ic_page_prev.svg'
import icPageNext from '../../assets/icons/ic_page_next.svg'
import icFitPage from '../../assets/icons/ic_fit_page.svg'
import icFitWidth from '../../assets/icons/ic_fit_width.svg'
import icZoomPlus from '../../assets/icons/ic_zoom_plus.svg'
import icZoomMinus from '../../assets/icons/ic_zoom_minus.svg'
import icDocument from '../../assets/icons/ic_document_white.svg'

/**
 * 배율 한계. **좌측 뷰어(OutputViewer)의 50~200% 와 값이 다르다** — 그리는
 * 물건이 달라서다(round11a task-10 1차 수정 HIGH-2).
 *
 * 좌측이 그리는 것은 폭이 920px 로 고정된 문서라 1078px 패널에서 「화면 맞춤」이
 * 61~117% 안에 떨어진다. 여기가 그리는 것은 **스캔 원본 JPEG** 이고 그 크기가
 * 2194×3042 · 2262×3144 다(spec §3 「쪽마다 JPEG 한 장」). 740px 패널에
 * 넣으려면 가로 맞춤이 **33%**, 세로 맞춤이 **21%** 여야 한다(브라우저 실측,
 * 패널 안폭 725 × 안높이 660). 바닥이 50% 면 두 맞춤 버튼이 다 바닥에 걸려
 * 「눌러도 넘치는」 상태가 된다 — 버튼 이름이 하는 일을 못 하게 된다.
 * 그래서 이 뷰어만 바닥을 10% 로 내린다(2262×3144 에 여유를 둔 값이다).
 */
const ZOOM_MIN = 10
const ZOOM_MAX = 200
const ZOOM_STEP = 10

/** 스캔 이미지를 받지 못했을 때의 사유. 204(mock 프로파일·미업로드 쪽)와
 *  디코드 실패가 같은 자리로 들어온다 — 둘 다 「이 쪽은 볼 수 없다」이고,
 *  사용자가 할 수 있는 일도 같다(다른 쪽으로 넘긴다). 조용히 빈 칸을 두지
 *  않는다(코딩표준 §6). */
const IMAGE_MISSING = '이 쪽의 스캔 이미지가 없습니다'

/** 정규화 좌표(0.0~1.0) → CSS 퍼센트.
 *
 *  `toFixed` 를 거치는 이유는 부동소수 찌꺼기 때문이다 — `(0.6 - 0.1) * 100`
 *  은 JS 에서 `49.99999999999999` 라, 그대로 쓰면 style 속성에 그 긴 숫자가
 *  박혀 시험도 사람도 읽기 어렵다. 소수 4자리면 740px 패널에서 0.03px
 *  미만이라 눈에 보이는 차이가 없다. */
const pct = (value) => `${+(value * 100).toFixed(4)}%`

/**
 * props
 *   · `vol`·`page`      지금 보고 있는 권·쪽. 둘 중 하나라도 없으면 안내만 그린다.
 *   · `onPageChange`    쪽을 넘길 때 **부모에게** 새 쪽 번호를 준다(제어 컴포넌트).
 *   · `onEventPick`     사건 영역을 눌렀을 때. **없으면 보기 모드**다(task-11 자리).
 *   · `notice`          쪽을 못 찾은 경우의 안내(spec §2.5 「뷰어는 안 움직이고
 *                       안내만」). 있으면 이미지 대신 이것만 그린다.
 */
export default function ChronologyViewer({
  vol, page, onPageChange, onEventPick, notice = null,
}) {
  // 본문 쪽 목록(사진·표지 쪽이 빠진 것, spec §1.6). 쪽 넘기기가 이 안에서만
  // 오간다 — 「지금 쪽 + 1」로 세면 표지·사진 쪽에 떨어진다.
  const [pages, setPages] = useState([])
  const [pagesNotice, setPagesNotice] = useState(null)
  const [events, setEvents] = useState([])
  const [eventsNotice, setEventsNotice] = useState(null)
  const [imageMissing, setImageMissing] = useState(false)
  const [zoom, setZoom] = useState(100)
  // 'width'(가로 맞춤, 기본) · 'height'(세로 맞춤) · 'actual'(1:1) ·
  // **null(사용자가 손으로 정한 배율)**.
  // **이 값은 눌린 버튼 표시(aria-pressed)와 「이미지가 도착하면 다시 잴 모드」
  // 일 뿐, 크기를 직접 정하지 않는다** — 크기는 아래 zoom 하나가 정한다.
  const [fit, setFit] = useState('width')
  // 맞춤을 **재려면** 패널 안쪽 크기와 원본 픽셀 크기가 필요하다(좌측 fitWidth 와
  // 같은 식). 둘 다 레이아웃이 있어야 읽히는 값이라 ref 로 잡는다.
  const mainRef = useRef(null)
  const imgRef = useRef(null)

  // 안내만 그리는 상태에서는 아무것도 조회하지 않는다 — 부를 vol 이 없다.
  const idle = Boolean(notice) || !vol || !page

  useEffect(() => {
    if (idle) return
    let alive = true
    // 권이 바뀌면 **앞 권의 쪽 목록부터 지운다**(아래 사건 이펙트가 setEvents([])
    // 로 하는 것과 같은 이유). 안 지우면 2권 목록이 오기 전의 전환 창에서
    // 「다음 쪽」이 **1권 쪽 번호로 2권을 조회**하고 `N / M` 도 1권 기준으로 틀린다.
    setPages([])
    setPagesNotice(null)
    getVolumePages(vol).then((res) => {
      if (!alive) return
      // 목록을 못 받으면 쪽 넘기기만 잠긴다 — 지금 쪽 이미지는 vol·page 만으로
      // 그릴 수 있으므로 화면을 통째로 사유로 덮지 않는다. 다만 **조용히**
      // 비활성으로 두지는 않는다(왜 못 넘기는지 적는다).
      if (!res.ok) { setPages([]); setPagesNotice(res.notice); return }
      setPages(res.data?.pages || [])
    })
    return () => { alive = false }
  }, [vol, idle])

  useEffect(() => {
    if (idle) return
    let alive = true
    // 쪽이 바뀌면 앞 쪽의 흔적부터 지운다 — 남으면 새 쪽 이미지 위에 **엉뚱한
    // 쪽의 사건 상자**가 얹힌다(좌표가 정규화라 그럴듯하게 들어맞아 더 나쁘다).
    setEvents([])
    setEventsNotice(null)
    setImageMissing(false)
    getPageEvents(vol, page).then((res) => {
      if (!alive) return
      if (!res.ok) { setEventsNotice(res.notice); return }
      setEvents(res.data?.events || [])
    })
    return () => { alive = false }
  }, [vol, page, idle])

  // 목록 안 차례. 못 찾으면 -1 이고, 그때는 양쪽 버튼이 다 잠긴다.
  const index = pages.indexOf(page)
  const canPrev = index > 0
  const canNext = index >= 0 && index < pages.length - 1
  const step = (delta) => {
    const next = pages[index + delta]
    if (next != null) onPageChange?.(next)
  }

  /**
   * 맞춤 = **배율을 재는 일**이다(round11a task-10 1차 수정 HIGH-2).
   *
   * [왜 CSS 폭이 아니라 배율인가]
   * 예전에는 맞춤마다 래퍼·이미지의 폭 규칙을 바꿨다(`ty_fit_width` 는 둘 다
   * `width:100%`). 그런데 래퍼에는 `zoom` 이 걸려 있고, **퍼센트 폭은 줌이 안
   * 걸린 부모를 기준으로 풀린 뒤 다시 줌이 걸린다** — 두 배가 정확히 상쇄돼
   * 렌더 폭이 늘 패널 폭 그대로였다. 브라우저 실측(패널 안폭 725 · 원본
   * 2194×3042): 배율 50%·100%·200% 에서 이미지 렌더 폭이 **전부 725.00px** 로
   * 같았다 — 툴바의 숫자만 바뀌고 이미지는 안 움직였다. 세로 맞춤의
   * `height:100%` 는 조상에 확정 높이가 없어(본문은 인라인 maxHeight 뿐)
   * `auto` 로 풀려 **1:1 과 같은 2194×3042** 를 냈다.
   *
   * 이 레포가 같은 함정을 이미 적어 두었다 — `publish-ext.css` 의
   * 「블록 기본값(=컨테이너 폭)이면 비율이 늘 1이 되어 버튼이 아무 일도 하지
   * 않는다」. 그래서 좌측 `.ty_output .node_detail_viewer_doc` 은
   * `width: max-content` 다. 이제 여기도 같은 결이다: 래퍼는 **언제나**
   * `max-content`(= 이미지 상자와 같은 크기 — 오버레이 전제다), 이미지는
   * **언제나** 원본 크기, 크기를 바꾸는 것은 `zoom` 하나뿐.
   *
   * 분자는 좌측과 같은 이유로 안정하다 — `.chronology_main` 은 padding 0 ·
   * display:block · `scrollbar-gutter: stable` 이라 `clientWidth` 가 상수다.
   * 분모(`naturalWidth`)는 줌과 무관한 원본 픽셀이라 연달아 눌러도 미끄러지지
   * 않는다.
   *
   * `floor` 인 이유도 좌측과 같다 — `round` 는 .5 이상에서 올림해 렌더 폭이
   * 컨테이너보다 커질 수 있다. 맞춤은 넘치지 않는 쪽으로 내린다.
   *
   * jsdom(과 이미지가 아직 안 온 첫 프레임)에서는 네 값이 전부 0 이다 —
   * 그때만 100% 로 떨어진다. 레이아웃이 없을 때의 폴백이지 이 버튼의 정의가 아니다.
   */
  const fitZoom = (mode) => {
    if (mode === 'actual') return 100
    const el = mainRef.current
    const img = imgRef.current
    const box = mode === 'width' ? el?.clientWidth : el?.clientHeight
    const natural = mode === 'width' ? img?.naturalWidth : img?.naturalHeight
    if (!box || !natural) return 100
    const next = Math.floor((box / natural) * 100)
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next || 100))
  }

  const setFitMode = (mode) => { setFit(mode); setZoom(fitZoom(mode)) }
  // 원본 픽셀 크기는 **로드된 뒤에야** 읽힌다(그 전까지 naturalWidth 는 0). 그래서
  // 이미지가 도착한 순간 지금 맞춤 모드로 다시 잰다 — 안 그러면 첫 화면이
  // 「가로 맞춤」인데 배율은 100% 인 채로 굳는다. 1:1 은 다시 잴 것이 없고,
  // **사용자가 손으로 정한 배율(fit === null)도 다시 재지 않는다** — 재리뷰
  // LOW-10: 쪽을 넘길 때마다 `onImageLoad` 가 그 배율을 조용히 덮었다.
  const onImageLoad = () => { if (fit && fit !== 'actual') setZoom(fitZoom(fit)) }
  // 손으로 배율을 바꾸면 **맞춤이 풀린다**(재리뷰 LOW-10). 안 풀면 두 가지가
  // 어긋난다 — ① 「가로 맞춤」 버튼이 눌린 표시(aria-pressed)를 단 채 남아 지금
  // 배율이 그 맞춤인 척한다 ② 쪽을 넘기면 위 `onImageLoad` 가 사용자의 배율을
  // 말없이 맞춤 값으로 되돌린다. 「지금 무엇이 켜져 있는가」를 화면이 정직하게
  // 말해야 한다(코딩표준 §6).
  const stepZoom = (next) => { setFit(null); setZoom(next) }
  const zoomIn = () => stepZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))
  const zoomOut = () => stepZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))

  // 본문 자리에 무엇을 그릴지. 안내가 이미지를 **대신**하는 경우는 둘뿐이다 —
  // 쪽을 못 찾았을 때(notice)와 스캔 이미지가 없을 때. 나머지 사유(쪽 목록·
  // 사건 조회 실패)는 이미지를 가리지 않고 위에 한 줄로 붙는다.
  const bodyNotice = notice
    || (!vol || !page ? '연표에서 볼 쪽이 정해지지 않았습니다' : null)
    || (imageMissing ? IMAGE_MISSING : null)

  return (
    <div className="node_detail_viewer ty_chronology">
      <div className="node_detail_viewer_bar">
        <div className="node_detail_viewer_name">
          <img src={icDocument} alt="" className="node_detail_viewer_name_icon" />
          <span className="node_detail_viewer_name_text">대한민국사 원문 뷰어</span>
        </div>
        <div className="node_detail_viewer_tools">
          <div className="node_detail_viewer_tools_group">
            {/* 아이콘 이름과 방향이 어긋나 보이지만 오타가 아니다 — 퍼블의
                `ic_page_prev` 가 **아래** 화살표고 `ic_page_next` 가 **위**
                화살표다(svg 실물 확인). 시안의 「↓ ↑」 차례를 그대로 두려면
                이 짝이 맞다. 읽는 차례대로 아래가 다음 쪽이다. */}
            <button type="button" className="node_detail_viewer_tool icon_btn" aria-label="다음 쪽"
                    disabled={!canNext} onClick={() => step(1)}>
              <img src={icPagePrev} alt="" className="node_detail_viewer_tool_icon" />
            </button>
            <button type="button" className="node_detail_viewer_tool icon_btn" aria-label="이전 쪽"
                    disabled={!canPrev} onClick={() => step(-1)}>
              <img src={icPageNext} alt="" className="node_detail_viewer_tool_icon" />
            </button>
          </div>
          <div className="node_detail_viewer_tools_group ty_plain">
            <button type="button" className="node_detail_viewer_tool icon_btn ty_box" aria-label="세로 맞춤"
                    aria-pressed={fit === 'height'} onClick={() => setFitMode('height')}>
              <img src={icFitPage} alt="" className="node_detail_viewer_tool_icon" />
            </button>
            {/* 1:1 은 아이콘이 아니라 글자다 — 퍼블이 그 자리에 전용 클래스
                (.node_detail_viewer_11)를 이미 두었다. */}
            <button type="button" className="node_detail_viewer_11" aria-label="실제 크기"
                    aria-pressed={fit === 'actual'} onClick={() => setFitMode('actual')}>
              1:1
            </button>
            <button type="button" className="node_detail_viewer_tool icon_btn ty_box" aria-label="가로 맞춤"
                    aria-pressed={fit === 'width'} onClick={() => setFitMode('width')}>
              <img src={icFitWidth} alt="" className="node_detail_viewer_tool_icon" />
            </button>
          </div>
          <div className="node_detail_viewer_tools_group ty_plain">
            <button type="button" className="node_detail_viewer_tool icon_btn ty_fill" aria-label="확대" onClick={zoomIn}>
              <img src={icZoomPlus} alt="" className="node_detail_viewer_tool_icon" />
            </button>
            <span className="node_detail_viewer_zoom_value">{zoom}%</span>
            <button type="button" className="node_detail_viewer_tool icon_btn ty_fill" aria-label="축소" onClick={zoomOut}>
              <img src={icZoomMinus} alt="" className="node_detail_viewer_tool_icon" />
            </button>
          </div>
          {/* 「목록 안 몇 번째 / 전체 몇 쪽」이다 — 쪽 번호가 아니다. 사진·표지
              쪽이 빠진 목록이라 41쪽이 둘째일 수 있다. */}
          <span className="node_detail_viewer_page">
            {index >= 0 ? `${index + 1} / ${pages.length}` : '- / -'}
          </span>
        </div>
      </div>

      {/* 높이는 좌측 뷰어와 **같은 값**이다(OutputViewer.jsx 의 60vh). 시안은 두
          패널을 740×660 으로 그렸고, 60vh 는 그 시안이 전제한 창 높이에서 660px
          이다. 한쪽만 고치면 2단이 어긋나므로 두 값을 같이 둔다. */}
      <div
        ref={mainRef}
        className="node_detail_viewer_main chronology_main overflow-auto"
        style={{ maxHeight: '60vh' }}
      >
        {pagesNotice && <p className="chronology_notice">{pagesNotice}</p>}
        {eventsNotice && <p className="chronology_notice">{eventsNotice}</p>}
        {bodyNotice ? (
          <p className="chronology_notice">{bodyNotice}</p>
        ) : (
          // 배율 래퍼. 이미지와 사건 상자가 **같은 상자 안에** 있어야 확대·축소가
          // 둘에 똑같이 걸린다 — 형제로 두면 확대했을 때 상자만 제자리에 남는다.
          // 값을 인라인 숫자가 아니라 CSS 변수로 넘기는 이유는 좌측 뷰어의
          // `--doc-zoom` 과 같다(단위 자동 부착 규칙에 운명을 맡기지 않는다).
          <div className="chronology_page" style={{ '--chrono-zoom': zoom / 100 }}>
            <img
              ref={imgRef}
              className="chronology_page_img"
              src={pageImageUrl(vol, page)}
              // 스캔 쪽 자체가 내용이고 대체 텍스트로 옮길 수 있는 글이 아니다
              // (사건 글자는 아래 오버레이가 이름으로 들고 있다).
              alt=""
              onLoad={onImageLoad}
              onError={() => setImageMissing(true)}
            />
            {events.map((ev) => {
              const [x0, y0, x1, y1] = ev.bbox || [0, 0, 0, 0]
              // 0.0~1.0 정규화 좌표를 **그대로** % 로 쓴다(domain/models.py:437).
              // 원본 이미지의 픽셀 크기를 알 필요가 없고, 배율이 바뀌어도
              // 퍼센트는 그대로라 상자가 저절로 따라 움직인다.
              const box = {
                left: pct(x0), top: pct(y0),
                width: pct(x1 - x0), height: pct(y1 - y0),
              }
              // 보기 모드에서는 **클릭 대상으로 만들지 않는다**(브리프 ②).
              // 누를 수 없는 것에 커서·포커스를 주면 「눌러도 아무 일이 없다」는
              // 더 나쁜 상태가 된다 — 붙이기는 task-11 이 연결한다.
              return onEventPick ? (
                <button
                  key={ev.id}
                  type="button"
                  data-event-id={ev.id}
                  className="chronology_event is_pickable"
                  style={box}
                  aria-label={ev.text}
                  onClick={() => onEventPick(ev)}
                />
              ) : (
                <div
                  key={ev.id}
                  data-event-id={ev.id}
                  className="chronology_event"
                  style={box}
                  aria-hidden="true"
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
