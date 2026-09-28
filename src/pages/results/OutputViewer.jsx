// 이 파일의 책임: 산출물 원문 뷰어(round07f) — 디스크립션 749:6351 항목 4.
//
// **파일을 파싱하지 않는다.** doc(JSONB, GET /outputs/{id}/doc)을 그대로
// 그린다 — 브라우저에는 docx 를 그대로 그릴 완전한 렌더러가 없다. 그래서 이
// 뷰어가 그리는 모양은 렌더러(docx_renderer)가 파일에 그리는 것과 **같은
// 시각 규격**이어야 한다(§3.5) — 안 그러면 "미리보기"라는 말이 성립하지 않는다.
//
// 「페이지」는 뷰어 높이 단위로 근사한다 — 산출물은 HTML로 연속 렌더되므로
// 인쇄물 같은 페이지가 없다. round07b-ext의 .node_detail_viewer_* 마크업/CSS를
// 그대로 재사용한다 — NodeModal.jsx가 원본이다. 다만 퍼블의 그 뷰어는 **이미지**용
// 다크 크롬(#333)이라, 검은 글자로 그리는 문서를 그 위에 얹으면 읽히지 않는다.
// 그래서 산출물 전용 수식 클래스 `ty_output` 을 함께 붙인다(publish-ext.css) —
// 본문 한 겹만 흰 표면으로 바꾸고 툴바는 퍼블 그대로 둔다. 퍼블 원본
// (styles/publish/component.css)은 납품물이라 손대지 않는다.
import { useEffect, useRef, useState } from 'react'
import { useToast } from '../../components/useToast.js'
import { getOutputDoc, getOutputTimeline } from '../../lib/outputsApi.js'
// round10 재리뷰 — 공유 열람(프로젝트 경유) 원문 조회. `projectId` prop이 있을 때만
// 쓴다(아래 참조). 이 컴포넌트가 lib/ 모듈 둘을 함께 갖는 것은 화면 컴포넌트라
// lib/ 간 무의존 규약(모듈끼리 서로 import하지 않는다) 위반이 아니다 —
// OutputDetailPage가 같은 이유로 outputsApi·projectsApi를 함께 쓰는 것과 같다.
import { getProjectOutputDoc } from '../../lib/projectsApi.js'
import icPagePrev from '../../assets/icons/ic_page_prev.svg'
import icPageNext from '../../assets/icons/ic_page_next.svg'
import icFitWidth from '../../assets/icons/ic_fit_width.svg'
import icZoomPlus from '../../assets/icons/ic_zoom_plus.svg'
import icZoomMinus from '../../assets/icons/ic_zoom_minus.svg'
import icPrinter from '../../assets/icons/ic_printer.svg'
import icPdfPage from '../../assets/icons/ic_pdf_page.svg'
// round11a task-10 — 타임라인 항목의 점. 퍼블 반입 자산 그대로이고, 피그마
// 1043:6683 의 그 점과 같다(#1B6FFF 15% 후광 + #1B6FFF 가운데).
import icTimelineDot from '../../assets/icons/ic_timeline_dot.svg'

const ZOOM_MIN = 50
const ZOOM_MAX = 200
const ZOOM_STEP = 10

/** 인쇄 규칙(publish-ext.css @media print)이 사는 범위. 이 클래스가 body에 붙어
 *  있을 때에만 「뷰어 본문만 남기기」가 켜진다 — 전역으로 두면 뷰어가 없는 화면의
 *  Ctrl+P가 백지를 뽑는다. 이름은 CSS와 두 곳에 적히므로 여기서 export해 잠근다. */
export const PRINT_BODY_CLASS = 'is_printing_output'

// round10 재리뷰 — `projectId`(기본 null): 공유 열람 문맥. 이 값이 있으면 원문 조회를
// 프로젝트 경유(소유 무관, 스냅샷 소속 판정)로 바꾼다. 없으면 **기존 자료검색 경로가
// 한 줄도 바뀌지 않는다**(기본값이 null이라 기존 호출부는 그대로다).
//
// 왜 필요한가 — 이 뷰어는 OutputDetailPage의 자식이고, 그 페이지가 `?project=`로
// 소유자 전용 호출 셋을 이미 갈랐는데 여기 한 겹 더 깊은 네 번째(getOutputDoc)가
// 남아 있었다. 그래서 남의 프로젝트에서 「상세보기」를 누르면 제목·선택자료·다운로드는
// 나오는데 **본문만 403 사유 문구**가 됐다(spec §5-5 「산출물 카드 — 활성 그대로」 미달).
//
// 문맥을 컨텍스트나 useSearchParams로 스스로 읽지 않고 **prop으로 받는다** — 부모가
// 이미 `?project=`를 갖고 있고, 이 뷰어를 라우터 밖(모달 등)에서 쓸 여지를 닫지 않기
// 위해서다(OutputDetailPage가 getProjectOutput을 고른 것과 같은 판단).
// round11a task-10 — `onArtifactPick`(기본 null): 타임라인의 **유물명**을 눌렀을
// 때 부른다. 이것이 「우측 연표 뷰어를 그 유물의 subject_era 쪽으로 연다」의
// 입구다(spec §2.4①). 없으면 유물명을 클릭 대상으로 만들지 않는다 — 누를 수
// 있게 보이는데 아무 일도 안 일어나는 상태를 만들지 않는다.
// `activeIndex`: 지금 대상인 항목의 `index`. 다른 유물명을 누르면 대상이 바뀌므로
// (spec §2.4) 지금 무엇이 대상인지 화면에서 보여야 한다.
export default function OutputViewer({
  outputId, kind, projectId = null, onArtifactPick = null, activeIndex = null,
}) {
  const { showToast } = useToast()
  const [doc, setDoc] = useState(null)
  // round11a task-10 — 타임라인의 **3층 모양**(연대 › 연도 › 항목). 본문과 다른
  // 라우트에서 온다(GET /outputs/{id}/timeline) — doc 은 본문·제목만 맡는다.
  const [timeline, setTimeline] = useState(null)
  // round11a task-10 1차 수정 MEDIUM-6 — `/timeline` 조회 실패의 **사유**.
  // 실패해도 화면은 옛 2열 표로 떨어져 비지 않지만, 그 사실을 한 마디도 남기지
  // 않으면 「새 산출물이 말없이 옛 모양으로 보이는」 조용한 실패가 된다
  // (코딩표준 §6). 같은 파일의 getOutputDoc 실패는 전부 setNotice 로 사유를
  // 띄우고 우측 뷰어도 실패를 한 줄로 적는다 — 여기만 달랐다.
  const [timelineNotice, setTimelineNotice] = useState(null)
  const [notice, setNotice] = useState(null)
  const [zoom, setZoom] = useState(100)
  const [pageInfo, setPageInfo] = useState({ current: 1, total: 1 })
  const bodyRef = useRef(null)

  useEffect(() => {
    let alive = true
    // round07f 최종 리뷰 M-1 — 상세 화면(OutputDetailPage)과 같은 이유로,
    // outputId만 바뀌면 이 뷰어도 리마운트되지 않는다. 초기화하지 않으면 앞
    // 산출물의 사유 문구가 남아 새 산출물의 원문을 영영 가린다.
    setNotice(null)
    setDoc(null)
    // round10 재리뷰 — 프로젝트 문맥이면 소유자 전용 GET /outputs/{id}/doc 대신
    // 프로젝트 경유를 부른다. 응답 모양({ok,status,data})과 404 사유 문구가 같아
    // 아래 처리는 분기 없이 그대로 공유한다.
    const request = projectId
      ? getProjectOutputDoc(projectId, outputId)
      : getOutputDoc(outputId)
    request.then((res) => {
      if (!alive) return
      if (!res.ok) { setNotice(res.notice); return }
      setDoc(res.data)
    })
    return () => { alive = false }
  }, [outputId, projectId])

  // round11a task-10 — 타임라인 3층을 함께 읽는다(설명문일 때만).
  //
  // **공유 열람(`projectId`)에서는 부르지 않는다.** 이 라우트는 소유자 전용이고
  // 프로젝트 경유 짝이 서버에 없다(task-9 리뷰가 「projects 경로에 timeline
  // 없음」을 확인했다). 뻔히 403 이 될 호출을 매번 던지고 그 실패를 삼키는 것은
  // 「조용한 실패를 한 겹 더 쌓는」 일이다 — 아예 부르지 않는다.
  //
  // 그렇다고 그 화면이 옛 2열 표로 떨어지지는 **않는다**(재리뷰 MEDIUM-3):
  // 3층을 doc 에서 직접 만든다(`decadesFromDoc`) — 같은 화면의 다운로드 버튼이
  // 주는 DOCX 가 새 층이라, 미리보기만 옛 모양이면 둘이 다른 문서를 말한다.
  // 서버 API 를 새로 만들지 않는 이유는 그 함수의 주석에 적어 두었다.
  //
  // 조회가 실패하거나 decades 가 비면 **옛 표 렌더**로 떨어진다(브리프 ③ 옛
  // 산출물 방어). 화면이 비는 것보다 옛 모양이라도 보이는 편이 낫다 — 이
  // 화면에서 타임라인은 부수 정보가 아니라 산출물 그 자체다.
  useEffect(() => {
    // ⚠️ **공유 열람·설명문 아님은 실패가 아니다.** 애초에 부르지 않는 정상
    // 경로이므로 사유도 남기지 않는다 — 여기에 안내를 붙이면 아무 일도
    // 잘못되지 않은 화면에 경고가 뜬다.
    if (kind !== 'caption' || projectId) { setTimeline(null); setTimelineNotice(null); return }
    let alive = true
    setTimeline(null)
    setTimelineNotice(null)
    getOutputTimeline(outputId).then((res) => {
      if (!alive) return
      // 실패는 화면을 비우지 않는다(아래 옛 표 렌더로 떨어진다) — 다만 **왜**
      // 옛 모양인지를 타임라인 머리 아래 한 줄로 남긴다(토스트가 아니다:
      // 옛 산출물을 열 때마다 뜨면 소음이 되고, 지나가면 사라져 확인할 수 없다).
      if (!res.ok) { setTimelineNotice(res.notice); return }
      setTimeline(res.data)
    })
    return () => { alive = false }
  }, [outputId, kind, projectId])

  // 인쇄 범위 한정 — publish-ext.css의 @media print 규칙은 body.is_printing_output
  // **안에서만** 산다. 그 클래스를 붙이는 곳이 여기다: 뷰어가 화면에 있을 때 인쇄하면
  // 뷰어 본문만 종이에 나가고, 없으면 규칙이 아예 안 걸려 화면 그대로 인쇄된다.
  //
  // 인쇄 버튼 핸들러가 아니라 beforeprint에 거는 이유 — 사용자는 버튼 말고 Ctrl+P로도
  // 인쇄한다. beforeprint는 두 경로 모두에서 뜬다(window.print()도 발화시킨다).
  // 언마운트 때 클래스를 반드시 떼야 한다 — 남으면 뷰어가 사라진 뒤의 Ctrl+P가
  // 되살릴 요소 없는 백지를 뽑는다.
  useEffect(() => {
    const mark = () => document.body.classList.add(PRINT_BODY_CLASS)
    const unmark = () => document.body.classList.remove(PRINT_BODY_CLASS)
    window.addEventListener('beforeprint', mark)
    window.addEventListener('afterprint', unmark)
    return () => {
      window.removeEventListener('beforeprint', mark)
      window.removeEventListener('afterprint', unmark)
      unmark()
    }
  }, [])

  // 「페이지」 근사 — 뷰어 본문 높이 한 칸을 1페이지로 센다.
  //
  // round10a 최종 전브랜치 리뷰 파킹1 — current를 여기서 무조건 1로 되돌리면
  // 안 된다. 확대/축소로 이 이펙트가 다시 돌 때, 브라우저가 scrollTop을 그대로
  // 유지하면(레이아웃만 다시 흐르고 스크롤 위치는 안 건드리는 경우가 흔하다)
  // 아래 scroll 리스너의 `scroll` 이벤트가 아예 안 나서 표시가 「1 / N」으로
  // 굳는다 — 실제 위치(예: 끝까지 스크롤한 상태)와 다른 거짓 표시다(T3가 고친
  // ⑥과 같은 증상이 배율 경로에만 남아 있었다). 그래서 current도 total과 같은
  // 자리에서 **지금 scrollTop**으로부터 다시 구한다 — 아래 scroll 리스너와
  // 완전히 같은 식(round(ratio*total)+1)이다. floor로 바꾸면 안 된다 — 예를
  // 들어 scrollHeight 838·clientHeight 536(Task 3-B 실측값)인 문서를 끝까지
  // 내리면 ratio=1이고 round는 마지막 페이지(2/2)를 주지만, floor(scrollTop/
  // clientHeight)+1 = floor(302/536)+1 = 1로 떨어져 마지막(부분) 페이지에
  // 있는데도 「1 / 2」가 된다.
  useEffect(() => {
    const el = bodyRef.current
    if (!el || !doc) return
    // jsdom(그리고 뷰어가 아직 레이아웃되지 않은 첫 프레임)에서는 scrollHeight·
    // clientHeight가 **둘 다 0**이다 — 0/0 = NaN 이고 Math.max(1, NaN)도 NaN 이라
    // 화면에 「1 / NaN」이 찍힌다(M10 ③). 높이를 모르면 1페이지로 본다(아래
    // ratio도 h<=0이면 0으로 고정해 같은 0 나누기를 막는다).
    const h = el.clientHeight
    const total = h > 0 ? Math.max(1, Math.ceil(el.scrollHeight / h)) : 1
    const ratio = h > 0 ? el.scrollTop / Math.max(1, el.scrollHeight - h) : 0
    const current = Math.min(total, Math.max(1, Math.round(ratio * total) + 1))
    setPageInfo({ current, total })
  }, [doc, timeline, zoom])

  // round10a Task 3-B — 라이브 재현: 「뒷 페이지」를 눌러도 표시가 「1 / 2」 그대로였다.
  // 본문은 실제로 스크롤됐다(scrollTop 226→302, scrollHeight 838, clientHeight 536).
  // 원인은 예전 scrollByPage 가 `el.scrollBy({..., behavior:'smooth'})` 를 건 **직후**
  // scrollTop 을 읽었던 것 — smooth 스크롤은 다음 프레임 이후에야 움직이므로 그 순간의
  // scrollTop 은 늘 이전 위치다. 게다가 scroll 리스너가 아예 없어 휠로 굴려도 표시가
  // 안 바뀌었다. 그래서 위치 계산을 본문의 scroll 이벤트로 옮긴다 — 버튼(scrollBy)이든
  // 휠이든 스크롤이 실제로 움직이면 브라우저가 이 이벤트를 내므로 경로가 하나로 합쳐진다.
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    function onScroll() {
      // 위 total 계산과 같은 이유로 0 나누기를 막는다(jsdom·레이아웃 전 첫 프레임엔
      // scrollHeight·clientHeight가 둘 다 0이다).
      const ratio = el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight)
      setPageInfo((p) => ({ ...p, current: Math.min(p.total, Math.max(1, Math.round(ratio * p.total) + 1)) }))
    }
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [doc])

  const scrollByPage = (dir) => {
    const el = bodyRef.current
    if (!el) return
    // jsdom에는 Element.prototype.scrollBy가 없다 — 없는 메서드를 부르면 화면
    // 전체가 죽으므로 있을 때만 부른다(브라우저에서는 언제나 있다). 페이지 표시
    // 갱신은 위 scroll 리스너가 전담한다 — 여기서는 스크롤만 시킨다.
    el.scrollBy?.({ top: dir * el.clientHeight, behavior: 'smooth' })
  }

  const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))
  const zoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))
  // 가로 맞춤(spec §3.3) — scale = 뷰어 안쪽 폭 / 내용의 실제 폭.
  //
  // 이 식이 성립하려면 두 값이 정말 그 뜻이어야 한다. R1 리뷰가 실측으로 잡아낸
  // 세 가지 어긋남을 다음과 같이 없앴다:
  //   ① clientWidth는 padding을 **포함**한다 — 자식은 padding 안쪽에 있으므로 그대로
  //      쓰면 늘 자식보다 크다. → .ty_output이 본문 padding을 0으로 만든다.
  //   ② 부모가 display:flex면 자식은 shrink-to-fit이라 폭이 컨테이너와 무관해진다.
  //      → .ty_output이 본문을 display:block으로 되돌린다.
  //   ③ 전시자료 표를 감싼 div가 overflow-x-auto라 표의 진짜 폭이 안에서 잘려
  //      바깥에서 잴 수 없었다. → 그 클리핑을 걷어내 바깥 스크롤 컨테이너 하나로
  //      합쳤다(ExhibitTable 참조).
  // 그리고 배율 래퍼는 width:max-content다 — 그래야 scrollWidth가 「컨테이너 폭」이
  // 아니라 「내용의 폭」이다. 이 값은 래퍼 자신의 좌표계라 지금 걸린 배율에 흔들리지
  // 않는다(실측: 50·100·200%에서 모두 같은 1759px). 분모가 안정하므로 「화면 맞춤」을
  // 연달아 눌러도 값이 미끄러지지 않는다.
  //
  // 실측(브라우저 1500×950, 루트 20px, 뷰어 1088px):
  //   일반 설명문      1078 / 920  → 117%
  //   짧은 설명문      1078 / 920  → 117%  ← 문서 폭이 상수라 글 길이에 안 흔들린다
  //   넓은 전시자료 표 1078 / 1759 →  61%
  // 셋 다 적용 후 본문의 scrollWidth가 clientWidth와 같아졌다(=넘침 0). 리뷰가 잡은
  // 105% / 3320%→200% / 93%(표는 계속 잘림)는 이것으로 없어진다.
  //
  // jsdom은 레이아웃이 없어 clientWidth·scrollWidth가 둘 다 0이다 — 그때만 100%로
  // 떨어진다(레이아웃이 없을 때에 한한 폴백이지, 이 버튼의 정의가 아니다).
  const fitWidth = () => {
    const el = bodyRef.current
    const content = el?.firstElementChild
    if (!el || !content || !content.scrollWidth) return setZoom(100)
    // round는 소수부 .5 이상에서 올림해 렌더 폭이 컨테이너보다 커질 수 있다(실측:
    // 600~980px 폭을 10px 간격으로 훑어 44%에서 1~4px 넘침). 맞춤은 넘치지 않는
    // 쪽으로— floor로 내림한다.
    const next = Math.floor((el.clientWidth / content.scrollWidth) * 100)
    setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next || 100)))
  }

  // 그리는 모양도 복사 평문도 이 값 하나로 갈린다. doc이 스스로 밝힌 종류를 먼저
  // 믿고, 없으면(옛 doc) 목록이 준 kind prop으로 떨어진다.
  const docKind = doc?.kind ?? kind

  // 3층으로 그릴 수 있는가. null 이면 화면과 복사 평문이 **함께** 옛 2열 표로
  // 떨어진다 — 한쪽만 떨어지면 복사한 글이 화면과 다른 것을 말하게 된다.
  //
  // 셋 중 하나다.
  //   ① `/timeline` 이 3층을 줬다(소유자 경로) — 그것을 그대로 쓴다. 서버만이
  //      유물 조회를 할 수 있어 `name`·`matched_by` 가 가장 정확하다.
  //   ② 공유 열람 — 그 라우트를 부르지 않으므로 **doc 에서 직접 3층을 만든다**
  //      (재리뷰 MEDIUM-3 · `decadesFromDoc`). 예전에는 여기가 옛 2열 표였고,
  //      같은 화면의 다운로드 버튼이 주는 DOCX 는 새 층이었다.
  //   ③ 그 밖 — 소유자 경로에서 `/timeline` 조회가 **실패**했을 때다. 서버가
  //      무엇을 줄 셈이었는지 모르므로 doc 만으로 새 층인 척하지 않고 옛 2열
  //      표로 떨어진 뒤, 왜 옛 모양인지를 한 줄로 적는다(timelineNotice).
  const decades = !doc
    ? null
    : timeline?.decades?.length
      ? timeline.decades
      : projectId && docKind === 'caption'
        ? decadesFromDoc(doc)
        : null

  const copyText = async () => {
    if (!doc) return
    // 분기는 doc.kind로 한다 — kind prop(목록 요약본의 값)과 어긋나면 doc에 없는
    // 필드를 읽어 TypeError로 죽는다. doc.kind는 서버가 doc_builder에서 항상 넣는다.
    const text = docKind === 'exhibit'
      ? [doc.columns.join('\t'), ...doc.rows.map((r) => r.join('\t'))].join('\n')
      : docKind === 'exhibition'
      ? exhibitionPlainText(doc)
      : plainText(doc, decades)
    try {
      await navigator.clipboard.writeText(text)
      showToast('내부 텍스트를 클립보드에 복사했습니다')
    } catch {
      showToast('복사에 실패했습니다')
    }
  }

  if (notice) return <p className="text-[13px] text-[#5A6173] p-6 text-center">{notice}</p>
  if (!doc) return <p className="text-[13px] text-[#5A6173] p-6 text-center">불러오는 중…</p>

  return (
    <div className="node_detail_viewer ty_output">
      <div className="node_detail_viewer_bar">
        <div className="node_detail_viewer_name">
          <img src={icPdfPage} alt="" className="node_detail_viewer_name_icon" />
          {/* round10b 재리뷰 M-3 — NodeModal.jsx와 같은 이유(publish-ext.css
              .node_detail_viewer_name_text 주석 참조). 이 문구는 고정값이라 실제로
              잘릴 일은 없지만, 같은 클래스를 공유하는 두 소비처를 다르게 두지 않는다. */}
          <span className="node_detail_viewer_name_text">산출물 상세보기</span>
        </div>
        <div className="node_detail_viewer_tools">
          <div className="node_detail_viewer_tools_group">
            <button type="button" className="node_detail_viewer_tool icon_btn" aria-label="앞 페이지"
                    onClick={() => scrollByPage(-1)}>
              <img src={icPagePrev} alt="" className="node_detail_viewer_tool_icon" />
            </button>
            <button type="button" className="node_detail_viewer_tool icon_btn" aria-label="뒷 페이지"
                    onClick={() => scrollByPage(1)}>
              <img src={icPageNext} alt="" className="node_detail_viewer_tool_icon" />
            </button>
          </div>
          <div className="node_detail_viewer_tools_group ty_plain">
            <button type="button" className="node_detail_viewer_tool icon_btn ty_box" aria-label="화면 맞춤" onClick={fitWidth}>
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
          <div className="node_detail_viewer_tools_group ty_plain">
            <button type="button" className="node_detail_viewer_tool icon_btn" aria-label="인쇄" onClick={() => window.print()}>
              <img src={icPrinter} alt="" className="node_detail_viewer_tool_icon" />
            </button>
            <button type="button" className="node_detail_viewer_tool icon_btn" aria-label="내부 텍스트 복사" onClick={copyText}>
              <img src={icPdfPage} alt="" className="node_detail_viewer_tool_icon" />
            </button>
          </div>
          <span className="node_detail_viewer_page">{pageInfo.current} / {pageInfo.total}</span>
        </div>
      </div>
      <div
        ref={bodyRef}
        className="node_detail_viewer_main overflow-auto"
        style={{ maxHeight: '60vh' }}
      >
        {/* 배율은 transform: scale 이 아니라 zoom 이다(규칙은 publish-ext.css).
            scale 은 **레이아웃을 바꾸지 않는다** — 브라우저 실측(1500×950, 넓은 표):
            61%로 줄여도 스크롤 영역은 원래 폭 1759px 그대로여서, 「화면 맞춤」을 눌러
            표가 다 들어온 뒤에도 빈 가로 스크롤이 680px 남았다. zoom 은 레이아웃을
            다시 흘려 같은 조건에서 스크롤 폭이 1078px(=컨테이너 폭)로 정확히 떨어진다.
            확대 쪽도 zoom 이 옳다 — 200%에서 스크롤 폭이 늘어 잘리지 않고 스크롤된다.

            값을 인라인 style이 아니라 CSS 변수로 넘기는 이유: 인라인 숫자는 프레임워크의
            단위 규칙(px 자동 부착 여부)에 운명을 맡기게 되고, 그 결과를 jsdom에서 확인할
            길이 없다(jsdom은 모르는 CSS 속성을 style 속성에 남기지 않는다). 사용자 정의
            속성은 setProperty로 그대로 실려 테스트가 볼 수 있다. */}
        <div className="node_detail_viewer_doc" style={{ '--doc-zoom': zoom / 100 }}>
          {docKind === 'exhibit' ? <ExhibitTable doc={doc} />
            : docKind === 'exhibition' ? <ExhibitionDocument doc={doc} />
            : <CaptionDocument doc={doc} decades={decades} timelineNotice={timelineNotice}
                               onArtifactPick={onArtifactPick} activeIndex={activeIndex} />}
        </div>
      </div>
    </div>
  )
}

// round07i — 사용자 지적: 같은 연도 두 건이 화면(과 복사한 평문)에 따로
// 찍혔다. 서버가 doc에 함께 싣는 `groups`(doc_builder.caption_to_doc — 렌더러
// (DOCX 렌더러와 같은 `group_by_year`를 지난 결과)가 있으면 그것을 쓴다. 여기서 다시
// 묶지 않는 이유는 timeline_group.py의 [왜 렌더러 안이 아니라 여기인가]와
// 같다 — 스스로 묶으면 파일과 다른 알고리즘을 갖게 될 위험이 생긴다. `groups`가
// 없으면(round07i 이전에 저장된 옛 doc) `items`를 항목별 한 행으로 취급한다 —
// 그 옛 산출물은 소급해 고치지 않는다(브리프 「깨뜨리면 안 되는 것」).
//
// **화면(CaptionDocument)·복사용 평문(plainText)·공유 열람의 3층(decadesFromDoc)이
// 이 함수 하나를 공유한다.**
// 각자 따로 `doc.groups ?? items` 폴백을 다시 쓰면, 리뷰가 실제로 잡아낸 대로
// 한쪽만 고치고 한쪽을 잊는 결함(clipboard가 화면과 다른 글자를 준다)이 또
// 난다 — timeline_group.py가 렌더러 쪽에서 막는 것과 같은 종류의 결함을
// 여기서는 화면과 클립보드 사이에서 막는다.
function captionRows(doc) {
  return doc.groups
    ? doc.groups.map((g) => ({ year_label: g.year_label, items: g.items }))
    : (doc.items || []).map((it) => ({ year_label: it.year_label, items: [it] }))
}

/**
 * 붙인 사건 한 줄 — `"12.27 사건명"`(spec §2.2·§2.4).
 *
 * 서버의 `timeline_edit.attached_line`(파이썬)과 **같은 규칙**이다: 월이 없으면
 * 사건명만, 일이 없으면 `"12. 사건명"`. 날짜가 없는 사건에 「. 사건명」처럼 빈
 * 점이 앞서면 오식으로 보인다.
 *
 * 같은 규칙이 두 언어에 적히는 것은 피할 수 없다(서버는 DOCX 를, 여기는 화면을
 * 그린다). 그래서 **한 곳에 모아 두고** 이 이름으로만 부른다 — 화면과 복사용
 * 평문이 각자 서식을 다시 적으면 같은 산출물이 두 가지를 말하게 된다.
 */
function attachedLine(event) {
  if (event.month == null) return event.text
  if (event.day == null) return `${event.month}. ${event.text}`
  return `${event.month}.${event.day} ${event.text}`
}

/**
 * 출처 줄의 마디를 잇는 구분자. **서버의 `caption.SOURCE_SEPARATOR` 와 같은 값**이다.
 *
 * 같은 값이 두 언어에 적히는 것은 `attachedLine` 과 같은 이유로 피할 수 없다.
 * 그래서 **한 곳에만** 둔다 — 두 자리에 각자 적어 두었던 것이 서버에서 실제로
 * 갈렸고(조립 `" · "` · 분해 `"·"`), 이름에 가운뎃점이 든 유물(「숟가락·젓가락」)이
 * 파일에서만 「숟가락」으로 잘렸다(재리뷰 MEDIUM-1).
 */
const SOURCE_SEPARATOR = ' · '

/** 공백을 한 칸으로 접는다 — 서버 `timeline_edit._norm` 과 같은 규칙이다. */
const normalizeSpaces = (value) => (value || '').split(/\s+/).filter(Boolean).join(' ')

/**
 * 항목이 가리키는 **유물의 이름** — 출처 줄의 첫 마디다.
 * 서버 `timeline_edit.artifact_name` 의 JS 짝이고 같은 구분자·같은 공백 접기를 쓴다.
 *
 * 쓰는 곳은 **공유 열람 미리보기 하나**다(아래 `decadesFromDoc`). 소유자 경로는
 * 서버가 `/timeline` 에서 `name` 을 이미 확정해 주므로 여기서 다시 자르지 않는다 —
 * 서버는 유물을 찾았으면 **그 유물의 지금 명칭**을 쓸 수 있고(doc 에는 그 값이
 * 없다) 그쪽이 더 정확하다.
 */
function artifactName(item) {
  return normalizeSpaces((item.source || '').split(SOURCE_SEPARATOR)[0])
}

/** 연도 라벨에서 연도를 뽑는다. 서버 `timeline_edit._YEAR_IN_LABEL` 과 같은 규칙 —
 *  **4자리만 연도로 본다**(「제65기」의 65 를 연도로 읽으면 65년으로 간다). */
const YEAR_IN_LABEL = /1[89]\d{2}|20\d{2}/

/** `"1969년"` → `"1960"`. 연도를 못 뽑으면 빈 문자열이고, 그런 묶음은 연대 제목이
 *  아예 없다(서버 `timeline_edit.decade_of` 와 같은 결정). */
function decadeOf(yearLabel) {
  const found = YEAR_IN_LABEL.exec(yearLabel || '')
  return found ? String(Math.floor(Number(found[0]) / 10) * 10) : ''
}

/**
 * 공유 열람(`?project=`)의 타임라인 3층 — **doc 하나로** 만든다(재리뷰 MEDIUM-3).
 *
 * [왜 필요한가] 이 화면은 `/timeline` 을 부르지 않는다(소유자 전용 라우트이고
 * 프로젝트 경유 짝이 서버에 없다). 그래서 **새로 만든 설명문도** 미리보기만 옛
 * 2열 표(`● 표제` · `출처 …`)로 그려졌는데, 같은 화면의 다운로드 버튼으로 받는
 * DOCX 는 새 층이었다 — 미리보기와 파일이 다른 문서를 말했다.
 *
 * [왜 서버를 늘리지 않는가] 필요한 값이 `doc`(JSONB)에 이미 다 있다 —
 * `doc_builder.caption_to_doc` 의 `asdict` 가 `items[].attached`·`idnbr`·
 * `decade_titles`·`year_subtitles` 를 그대로 싣고, 연도 묶음은 `groups` 로 온다
 * (파일과 **같은** `group_by_year` 를 지난 결과다). 없는 것은 유물 `name` 하나뿐이고
 * 그것은 위 `artifactName` 이 만든다.
 *
 * [서버가 주는 것과 **다른** 것 둘 — 알고 두는 차이다]
 *   · `matched_by` 가 없다. 그래서 「추정」 안내(`GUESSED_MATCH_HINT`)도 못 누르는
 *     사유(`pickBlockedReason`)도 붙지 않는다 — 무엇으로 맞췄는지는 유물 조회를
 *     해야 알 수 있고 여기엔 그 조회가 없다. 어차피 이 화면은 `onArtifactPick` 이
 *     없어(OutputDetailPage 가 공유 열람이면 null 을 준다) **유물명이 클릭 대상이
 *     아니다** — 서버에 프로젝트 경유 연표 짝이 없으니 그 동작을 그대로 둔다.
 *   · `name` 이 출처 줄 첫 마디다. 서버는 유물을 찾았으면 그 유물의 **지금** 명칭을
 *     주므로, 만든 뒤 유물 명칭이 고쳐졌거나 이름이 정확히 같지 않게 맞춘
 *     (`contains`) 항목에서는 여기 값이 옛 이름일 수 있다.
 *
 * [옛 doc 도 여기로 온다] `attached`·제목 맵이 아예 없는 round07i 이전 doc 도 새
 * 층으로 그린다 — 소유자 경로의 `build_view` 가 그 doc 들을 가리지 않고 똑같이 새
 * 층으로 주기 때문이다. 두 경로에 서로 다른 기준을 두면 한쪽만 고치고 한쪽을 잊는
 * 그 결함이 또 난다. 없는 값은 빈 리스트·빈 문자열로 떨어져 화면이 비지 않는다.
 */
function decadesFromDoc(doc) {
  const decades = []
  // doc.items 안의 차례. `captionRows` 는 그 순서를 나눠 담을 뿐 바꾸지 않으므로
  // 세어 나가면 같은 값이 된다 — `groups` 의 항목은 JSON 을 거치며 `items` 와
  // **다른 객체**가 되어 신원(===)으로는 못 찾는다.
  let index = 0
  for (const row of captionRows(doc)) {
    const decade = decadeOf(row.year_label)
    const year = {
      year_label: row.year_label,
      subtitle: (doc.year_subtitles || {})[row.year_label] || '',
      items: row.items.map((item) => ({
        index: index++,
        idnbr: item.idnbr || '',
        name: artifactName(item),
        year_label: item.year_label,
        headline: item.headline,
        source: item.source,
        background: item.background,
        event: item.event,
        attached: item.attached || [],
      })),
    }
    const last = decades[decades.length - 1]
    if (last && last.decade === decade) last.years.push(year)
    else {
      decades.push({
        decade,
        title: decade ? (doc.decade_titles || {})[decade] || '' : '',
        years: [year],
      })
    }
  }
  return decades.length ? decades : null
}

/**
 * 유물명을 누를 수 없을 때의 사유(코딩표준 §6 — 조용히 못 누르게 두지 않는다).
 *
 * `matched_by` 는 서버가 「왜 비었는가」를 알려 주려고 함께 싣는 값이다
 * (timeline_edit.build_view 도크스트링). 그 구분을 버리고 한 문장으로 뭉치면
 * 사용자는 자료를 고쳐야 하는지(none) 이름이 겹친 것인지(ambiguous) 알 수 없다.
 */
function pickBlockedReason(item) {
  if (item.matched_by === 'ambiguous') return '같은 이름의 유물이 여럿이라 연표를 열 수 없습니다'
  if (item.matched_by === 'none') return '이 항목과 맞는 유물을 찾지 못해 연표를 열 수 없습니다'
  return '유물 정보가 없어 연표를 열 수 없습니다'
}

/** `matched_by:'contains'` 의 안내. 이름이 정확히 같지 않은데 후보가 하나뿐이라
 *  붙인 것이라, 틀릴 수 있다는 사실을 사용자가 알아야 한다(task-9 이월 사항). */
const GUESSED_MATCH_HINT =
  '유물 매칭이 추정입니다 — 이름이 정확히 같지 않지만 후보가 하나뿐이라 골랐습니다'

/**
 * 타임라인 3층 — 연대 제목 › 연도 + 소제목 › 항목(피그마 1043:6683).
 *
 * 옛 「연도 | 항목들」 2열 표와 **층이 다르다**. 연대 한 겹이 위에 생겼고,
 * 항목 한 건이 「사건명·유물명·배경·사건」 네 줄이 됐다(표제·출처 줄이 그
 * 자리를 내준다).
 *
 * 연대 제목은 **있을 때만** 그린다. 서버는 사용자가 쓴 제목을 그대로 주고
 * (`decade_titles`), 아직 아무것도 안 쓴 산출물은 빈 문자열이다 — 빈 제목 줄을
 * 그리면 문서에 빈 칸이 하나 남는다(docx_renderer 가 같은 판단을 한다).
 * 연도미상 묶음은 연대 자체가 빈 문자열이라 제목이 아예 없다.
 */
function TimelineDecades({ decades, onArtifactPick, activeIndex }) {
  return (
    <div className="timeline_decades flex flex-col gap-32">
      {decades.map((decade, i) => (
        <section key={`${decade.decade}:${i}`} className="timeline_decade flex flex-col gap-20">
          {decade.title && (
            <h3 className="timeline_decade_title text-[24px] font-bold text-[#000000]">
              {decade.title}
            </h3>
          )}
          {(decade.years || []).map((year, j) => (
            <div key={`${year.year_label}:${j}`} className="timeline_year flex flex-col gap-12">
              <div>
                <p className="text-[16px] font-semibold text-[#6F6F6F]">{year.year_label}</p>
                {year.subtitle && (
                  <p className="text-[16px] font-bold text-[#000000]">{year.subtitle}</p>
                )}
              </div>
              <ul className="timeline_items">
                {(year.items || []).map((item) => (
                  <TimelineEntry
                    key={item.index}
                    item={item}
                    onArtifactPick={onArtifactPick}
                    active={activeIndex != null && activeIndex === item.index}
                  />
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}

/** 항목 한 건 — 점 · 「사건명」 · 「유물명」 · 배경 · 사건.
 *
 *  세로선은 항목마다가 아니라 **내용 칸의 왼쪽 테두리**로 그린다. 항목 사이의
 *  간격을 칸 안쪽(pb)에 두어 선이 끊기지 않게 한다(시안의 선은 이어져 있다). */
function TimelineEntry({ item, onArtifactPick, active }) {
  // 누를 수 있는 것은 **유물을 실제로 찾은 항목**뿐이다. idnbr 가 비면 우측
  // 뷰어가 열 쪽을 정할 수 없다(subject_era 가 그 유물에 달려 있다).
  const pickable = Boolean(onArtifactPick) && Boolean(item.idnbr)
  const guessed = item.matched_by === 'contains'
  return (
    <li className="flex items-start">
      <img src={icTimelineDot} alt="" className="shrink-0 w-21 h-21 mr-16 mt-2" />
      <div className="flex-1 min-w-0 border-l border-[#E2E5EE] pl-24 pb-20 flex flex-col gap-8">
        <div className="flex items-baseline gap-12">
          <span className="shrink-0 text-[14px] font-medium text-[#999999]">사건명</span>
          {/* 붙인 사건이 없으면 라벨만 남는다(시안이 그렇다). 여러 개면 줄이
              늘어난다(spec §2.4). 월·일과 사건명은 **한 덩어리**여야 같은
              초록이 걸린다 — 쪼개면 두 색이 될 여지가 생긴다. */}
          <span className="flex flex-col gap-4 min-w-0">
            {(item.attached || []).map((event, i) => (
              <span
                key={event.event_id ?? i}
                className="timeline_attached text-[16px] font-bold text-[#00B975]"
              >
                {attachedLine(event)}
              </span>
            ))}
          </span>
        </div>
        <div className="flex items-baseline gap-12 flex-wrap">
          <span className="shrink-0 text-[14px] font-medium text-[#999999]">유물명</span>
          {pickable ? (
            <button
              type="button"
              className={`timeline_artifact text-left text-[14px] font-semibold text-[#1B6FFF]${
                active ? ' underline underline-offset-4' : ''}`}
              // 지금 대상 표시. 시안에 이 상태가 없어 **새 요소를 만들지 않고**
              // 이미 있는 유물명 줄에 표식만 얹는다(spec §2.4 「지금 대상」).
              aria-current={active ? 'true' : undefined}
              title={guessed ? GUESSED_MATCH_HINT : undefined}
              onClick={() => onArtifactPick(item)}
            >
              {item.name}
            </button>
          ) : (
            <>
              <span className="text-[14px] font-semibold text-[#1B6FFF]">{item.name}</span>
              {/* 누를 수 없는 이유를 그 자리에 남긴다 — 파랑 글자가 눌리지
                  않는 것만으로는 고장과 구별되지 않는다. onArtifactPick 자체가
                  없는 문맥(공유 열람)에서는 애초에 누를 것이 없으므로 적지 않는다. */}
              {onArtifactPick && (
                <span className="text-[13px] text-[#999999]">{pickBlockedReason(item)}</span>
              )}
            </>
          )}
        </div>
        {item.background && (
          <p className="text-[14px] font-medium text-[#666666]">{`배경: ${item.background}`}</p>
        )}
        {item.event && (
          <p className="text-[14px] font-medium text-[#666666]">{`사건: ${item.event}`}</p>
        )}
      </div>
    </li>
  )
}

function CaptionDocument({
  doc, decades = null, timelineNotice = null, onArtifactPick = null, activeIndex = null,
}) {
  const rows = captionRows(doc)

  return (
    // w-(고정) 이지 max-w-(가변) 가 아니다 — 문서는 페이지 폭이 정해진 물건이고,
    // 뷰어 폭에 따라 글줄이 다시 흐르면 「미리보기」가 파일과 다른 모양이 된다.
    // 고정이라 화면 맞춤의 분모도 상수가 된다(짧은 글이라고 3320%가 나오지 않는다).
    // p-24(24px) — R1 재리뷰 Minor F. .ty_output .node_detail_viewer_main의 padding을
    // 0으로 만든 만큼(0.8rem=16px) 본문 쪽에 되돌린다(publish-ext.css 주석 참조).
    // 예전 p-6(6px)만으로는 흰 문서가 다크 뷰어 크롬에 거의 붙어 보였다(스크린샷 실측).
    <div className="p-24 text-[13px] text-[#1A1F2B] flex flex-col gap-4 w-[46rem]">
      <div>
        <h1 className="text-[20px] font-bold">{doc.title}</h1>
        {doc.subtitle && <p className="text-[13px] text-[#5A6173]">{doc.subtitle}</p>}
      </div>
      {doc.body && <p className="leading-[1.7]">{doc.body}</p>}
      {/* round11a task-10 — 3층으로 그릴 수 있으면 그렇게 하고, 아니면 옛 2열
          표로 떨어진다. 떨어지는 경우는 이제 **하나**다: 소유자 경로에서
          `/timeline` 조회가 실패했을 때. 공유 열람은 doc 으로 3층을 만들어 온다
          (재리뷰 MEDIUM-3 · `decadesFromDoc`). 어느 쪽이든 **화면이 비면
          안 된다** — 타임라인은 이 산출물의 본체다(브리프 ③ 옛 산출물 방어).

          타임라인 머리는 **한 곳**에서만 그린다 — 3층이든 옛 표든 같은 머리이고,
          1차 수정 MEDIUM-6 의 사유 한 줄도 그 바로 아래 자리다. 사유가 있으면
          항목이 하나도 없어도 이 묶음을 그린다(그러지 않으면 조회 실패 + 옛
          doc 에 items 도 없는 경우에 「왜 비었는가」가 다시 사라진다). */}
      {(decades || rows.length > 0 || timelineNotice) && (
        <div>
          <h2 className="text-[15px] font-bold border-b border-[#E2E5EE] pb-2 mb-3">타임라인</h2>
          {/* 토스트가 아니라 줄 안내다 — 지나가지 않고 그 자리에 남는다. */}
          {timelineNotice && (
            <p className="timeline_notice text-[13px] text-[#5A6173] mb-3">
              {`${timelineNotice} — 예전 모양으로 보여 줍니다`}
            </p>
          )}
          {decades ? (
            <TimelineDecades
              decades={decades}
              onArtifactPick={onArtifactPick}
              activeIndex={activeIndex}
            />
          ) : rows.length > 0 && (
          <table className="w-full border-collapse">
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td className="align-top w-[4.5rem] py-2 text-[13px] font-semibold">{row.year_label}</td>
                  <td className="align-top py-2 pl-3 border-l-2 border-[#2B6CF0]">
                    {/* 같은 연도의 항목을 이어 붙인다 — groups 없는 옛 doc은
                        각 행이 항목 하나뿐이라 이 map이 한 번만 돈다. */}
                    {row.items.map((it, j) => (
                      <div key={j} className={j > 0 ? 'mt-2' : undefined}>
                        {/* ⚠️ 여기는 **옛 2열 표**다 — `/timeline` 조회가 실패했을
                            때만 그린다. **지금의 DOCX 는 이 모양이 아니다**(재리뷰
                            MEDIUM-4): 표제 줄과 출처 줄은 화면에서 사라지면서 파일에서도
                            빠졌고(`test_source_line_is_gone`·`test_headline_line_is_gone`),
                            ● 뒤에 오는 것은 이제 「사건명」 라벨이다. 그러니 아래 두 줄을
                            「파일과 같은 규격」으로 읽지 마라 — 옛 산출물이 저 모양이었다는
                            기록이고, 위 안내가 「예전 모양으로 보여 줍니다」라고 말한다.
                            지금 규격은 `TimelineEntry` 가 들고 있다.

                            ● 를 문자로 찍는 것(spec §3.5 M5 결정)과 세로선 파랑
                            `#2B6CF0` 은 그 옛 모양 그대로 둔다 — 새 층의 선은 회색
                            `#E2E5EE` 이고 DOCX 도 그 값으로 맞췄다(재리뷰 LOW-7). */}
                        <p className="font-bold">● {it.headline}</p>
                        {/* 「출처」 뒤는 두 칸이다 — 옛 DOCX 가 `f"출처  {source}"` 로
                            찍던 간격이고 복사용 평문의 옛 갈래(`plainText`)도 같다.
                            HTML 은 연속 공백을 접어 보이는 모습은 같지만, textContent 가
                            그 평문과 같아야 복사·검증이 어긋나지 않는다. */}
                        <p className="text-[#2B6CF0]">{`출처  ${it.source}`}</p>
                        {it.background && <p className="text-[#5A6173]">배경: {it.background}</p>}
                        {it.event && <p className="text-[#5A6173]">사건: {it.event}</p>}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      )}
    </div>
  )
}

// round07i 최종 리뷰 F2 — 개요 라벨("전시기간"·"장 소" 등)과 "전시를 열며"
// 제목은 예전엔 여기서 exhibition_docx.py의 OVERVIEW_LABELS·"전시를 열며"를
// **손으로 다시 타이핑**해 두고 있었다. "관 람 료"의 자간용 공백처럼 눈에 안
// 띄는 디테일이 한쪽만 바뀌면 파일과 화면이 말없이 갈린다("파일과 뷰어가 같은
// 것을 말해야 한다"는 이 라운드의 원칙 위반). 그래서 이제 이 문구를 다시
// 타이핑하지 않는다 — `outputs/doc_builder.exhibition_to_doc`이 렌더러가 쓰는
// 그 상수를 `doc.overview_labels`·`doc.intro_heading`으로 그대로 실어 보내고,
// 이 컴포넌트는 그것을 읽기만 한다(값은 여전히 비어 있는 라벨이다 — 전시기간·
// 장소·관람료·관람시간·관람문의는 운영 정보라 자료 메타에서 뽑을 수 없고,
// 지어내지 않고 라벨만 두어 학예사가 채우게 한다는 결정은 그대로다).

function ExhibitionDocument({ doc }) {
  // subtitle이 title **위**에 온다 — round07i 모델 주석 그대로다(MUCH 실측: 관제가
  // 전시명 위에 작게 놓인다). CaptionDocument는 반대 순서라 여기서 갈라 둔다.
  return (
    <div className="p-24 text-[13px] text-[#1A1F2B] flex flex-col gap-4 w-[46rem]">
      <div>
        {doc.subtitle && <p className="text-[13px] text-[#5A6173]">{doc.subtitle}</p>}
        <h1 className="text-[20px] font-bold">{doc.title}</h1>
      </div>

      <div className="text-[#5A6173]">
        {(doc.overview_labels || []).map((label) => (
          // 단일 문자열로 합친다 — {label}{" : "}처럼 JSX 자식을 둘로 쪼개면
          // 같은 문단인데도 텍스트 노드가 갈려 getByText 완전일치가 못 찾는다.
          <p key={label}>{`${label} : `}</p>
        ))}
      </div>

      {doc.intro && (
        <div>
          <h2 className="text-[15px] font-bold border-b border-[#E2E5EE] pb-2 mb-3">{doc.intro_heading}</h2>
          {doc.intro.split('\n').map((para, i) => {
            const text = para.trim()
            return text ? <p key={i} className="leading-[1.7]">{text}</p> : null
          })}
        </div>
      )}

      {(doc.sections || []).map((section, i) => (
        <div key={i}>
          <h2 className="text-[15px] font-bold border-b border-[#E2E5EE] pb-2 mb-3">{section.title}</h2>
          {section.description && <p className="leading-[1.7] mb-2">{section.description}</p>}
          {/* 자료 한 건은 **자료명과 연도 두 줄뿐**이다(round07i spec §2.3 실측 —
              MUCH 전시 페이지에 자료번호도 출처도 없다). idnbr은 이미지를 찾는
              열쇠일 뿐 문서에 찍히지 않는다 — 이 뷰어도 파일과 같은 내용만 그린다.

              [round07i 최종 리뷰 F4] 이 목록은 이미지 없는 세로 목록이고, 파일
              (exhibition_docx.ExhibitionDocxRenderer._add_item)은 자료마다 이미지를
              얹어 좌우로 번갈아 놓는 2열 지그재그다 — spec이 못박은, 파일에서만
              성립하는 레이아웃이다. 이 차이는 버그가 아니라 의도된 축소판이다:
              `exhibition_to_doc`(doc_builder.py)이 애초에 이미지 참조를 싣지
              않는다 — doc은 JSON이라 화면에 이미지가 있어야 한다면 여기서
              바이너리를 다시 실어야 하는데, 그건 이 라운드의 범위 밖이다(뷰어에
              이미지 지원을 넣지 않기로 한 결정). 그러니 여기에 이미지·지그재그를
              추가하려 하지 마라 — 고칠 것은 doc_builder 쪽 배선이지 이 컴포넌트가
              아니다. */}
          {section.items?.length > 0 && (
            <ul className="flex flex-col gap-2">
              {section.items.map((item, j) => (
                <li key={item.idnbr ?? j}>
                  <p className="font-bold">{item.name}</p>
                  <p className="text-[#5A6173]">{item.year}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {/* 맺음말 — 자료를 붙이지 않는다(파일 렌더러와 같은 규칙). closing이 없으면
          아무것도 그리지 않는다 — closing_title만 있고 본문이 빈 것은 "잘못
          만들어진 문서"이지 정상 상태가 아니다. */}
      {doc.closing && (
        <div>
          {doc.closing_title && (
            <h2 className="text-[15px] font-bold border-b border-[#E2E5EE] pb-2 mb-3">{doc.closing_title}</h2>
          )}
          <p className="leading-[1.7]">{doc.closing}</p>
        </div>
      )}
    </div>
  )
}

function ExhibitTable({ doc }) {
  return (
    // overflow-x-auto를 두지 않는다 — 스크롤은 바깥 .node_detail_viewer_main 하나가
    // 맡는다. 안에서 잘라 버리면 넓은 표의 진짜 폭이 밖에서 측정되지 않아 「화면 맞춤」이
    // 표를 계속 잘린 채로 둔다(R1 Important 2 ③). 스크롤 컨테이너 이중화도 사라진다.
    // p-16(16px) — R1 재리뷰 Minor F. 이유는 CaptionDocument와 같다(위 주석 참조) —
    // 표는 자체 셀 패딩(px-2 py-1)이 있으니 여기서는 부모가 뺀 16px만 되돌린다.
    <div className="p-16">
      <table className="border-collapse text-[12px]">
        <thead>
          <tr>
            <th className="border border-[#E2E5EE] bg-[#F5F5F7] px-2 py-1 w-8"></th>
            {doc.columns.map((_, i) => (
              <th key={i} className="border border-[#E2E5EE] bg-[#F5F5F7] px-2 py-1 font-normal text-[#8A90A2]">
                {String.fromCharCode(65 + i)}
              </th>
            ))}
          </tr>
          <tr>
            <th className="border border-[#E2E5EE] bg-[#F5F5F7] px-2 py-1">1</th>
            {doc.columns.map((c) => (
              <th key={c} role="columnheader" className="border border-[#E2E5EE] bg-[#F5F5F7] px-2 py-1 font-bold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {doc.rows.map((row, ri) => (
            <tr key={ri}>
              <td className="border border-[#E2E5EE] bg-[#F5F5F7] px-2 py-1 text-center text-[#8A90A2]">{ri + 2}</td>
              {row.map((cell, ci) => (
                <td key={ci} className="border border-[#E2E5EE] px-2 py-1 whitespace-nowrap">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * 복사용 평문. **화면에 그려진 것과 같은 글자**를 준다 — 복사한 것이 화면과
 * 다르면 「내부 텍스트」라는 말이 성립하지 않는다.
 *
 * 층이 둘이라 갈래도 둘이다(재리뷰 MEDIUM-4 — 예전 이 자리는 「문서 파일과 같은
 * 글자 … 출처 뒤는 두 칸」이라고만 적혀 있었고, 그것은 이제 거짓이다).
 *   · 3층(`decades`)이 있으면 `decadePlainLines` 로 간다 — **그쪽이 지금의 DOCX 와
 *     같은 층**이다(`adapters/docx_renderer.py` 머리 주석의 층 그림).
 *   · 없으면(= `/timeline` 조회 실패) 아래 옛 갈래로 떨어진다 — `● {표제}` 와
 *     `출처  {출처}`(두 칸). **지금의 DOCX 에는 그 두 줄이 없다.** 이 갈래가 같은
 *     글자를 말하는 상대는 파일이 아니라 화면의 옛 2열 표다.
 *
 * round07i 리뷰 Important 1 — 예전에는 여기서 `doc.items`를 그대로 훑어 항목마다
 * 연도를 찍었다. 그러면 같은 연도 두 건을 복사했을 때 화면·파일은 한 번만 찍는
 * 연도가 평문에서는 두 번 나온다 — 「복사한 것이 파일과 다르면 안 된다」는 위
 * 문단 자체를 어기는 것이다. `captionRows`(화면과 공유)로 바꿔 연도를 그룹당
 * 한 번만 찍는다.
 *
 * 빈 줄은 조건부로 넣는다. 예전에는 `['', …]`를 배열에 섞고 마지막에
 * `.filter(Boolean)`으로 훑었는데, 그 필터가 빈 문자열을 **전부** 지워
 * 문단 구분이 하나도 남지 않았다(죽은 코드였다).
 */
function plainText(doc, decades = null) {
  const lines = []
  if (doc.title) lines.push(doc.title)
  if (doc.subtitle) lines.push(doc.subtitle)
  if (doc.body) lines.push('', doc.body)
  // round11a task-10 — 화면이 3층으로 그리면 평문도 3층을 훑는다. 같은 `decades`
  // 하나를 둘이 나눠 쓴다(위 CaptionDocument 와 같은 값) — 여기서 따로
  // `timeline?.decades` 를 다시 풀면, 한쪽만 고치고 한쪽을 잊는 그 결함이
  // (round07i 리뷰 Important 1) 새 층에서 다시 난다.
  if (decades) return [...lines, ...decadePlainLines(decades)].join('\n')
  const rows = captionRows(doc)
  if (rows.length) {
    lines.push('', '타임라인')
    for (const row of rows) {
      row.items.forEach((it, j) => {
        // 그룹의 첫 항목만 연도를 달고 나온다 — 화면(CaptionDocument)의 표에서
        // 연도 칸이 그룹당 한 번뿐인 것과 같은 모양이다.
        lines.push(j === 0 ? `${row.year_label}  ● ${it.headline}` : `● ${it.headline}`)
        lines.push(`출처  ${it.source}`)
        if (it.background) lines.push(`배경: ${it.background}`)
        if (it.event) lines.push(`사건: ${it.event}`)
      })
    }
  }
  return lines.join('\n')
}

/**
 * 타임라인 3층의 평문(round11a task-10). **화면 줄 차례 그대로**다 —
 * 연대 제목 › 연도 › 소제목 › 항목(사건명 · 유물명 · 배경 · 사건).
 *
 * 붙인 사건이 여럿이면 첫 줄만 「사건명」 라벨을 달고 나머지는 이어지는 줄로
 * 떨어진다 — 화면에서 라벨 하나가 여러 줄을 거느리는 모양 그대로다. 라벨을
 * 줄마다 반복하면 화면에 없는 글자가 복사본에만 생긴다.
 *
 * 라벨과 값 사이는 **두 칸**이다 — 옛 평문의 `출처  {source}` 와 같은 규칙이고,
 * DOCX 렌더러가 쓰는 간격(`_LABEL_GAP`)이기도 하다.
 *
 * **지금의 DOCX 와 같은 층을 말하는 것은 이쪽이다**(위 `plainText` 의 옛 갈래가
 * 아니다). 소유자 경로든 공유 열람이든 3층이 있으면 여기로 온다.
 */
function decadePlainLines(decades) {
  const lines = ['', '타임라인']
  for (const decade of decades) {
    if (decade.title) lines.push(decade.title)
    for (const year of decade.years || []) {
      lines.push(year.year_label)
      if (year.subtitle) lines.push(year.subtitle)
      for (const item of year.items || []) {
        const attached = (item.attached || []).map(attachedLine)
        lines.push(`● 사건명  ${attached[0] ?? ''}`.trimEnd())
        for (const rest of attached.slice(1)) lines.push(rest)
        // `.trimEnd()` — 이름이 비면 라벨 뒤에 두 칸이 그대로 남는다(바로 위
        // 「사건명」 줄과 같은 규율이고, 파이썬 쪽은 꼬리 공백 금지를 시험으로
        // 잠갔다 — `test_event_label_stays_when_there_is_no_attached_event`).
        lines.push(`유물명  ${item.name ?? ''}`.trimEnd())
        if (item.background) lines.push(`배경: ${item.background}`)
        if (item.event) lines.push(`사건: ${item.event}`)
      }
    }
  }
  return lines
}

/**
 * 특별전시 복사용 평문. plainText와 같은 규율(파일과 같은 글자·빈 줄은 조건부)
 * 이되 모양이 다르다 — 부제가 제목 **위**에 오고, 개요 라벨(값은 빈칸)이 있고,
 * 섹션마다 소제목·설명·자료(자료명+연도 두 줄)가 이어지며, 맺음말은 자료 없이
 * 글만 있다(exhibition_docx.py의 순서 그대로).
 *
 * 개요 라벨과 "전시를 열며"는 `doc.overview_labels`·`doc.intro_heading`에서
 * 읽는다 — ExhibitionDocument(화면)와 같은 값을 같은 곳에서 가져온다
 * (round07i 최종 리뷰 F2). 여기서 다시 타이핑하면 화면·복사 평문·파일 세
 * 곳이 다시 갈릴 수 있다.
 */
function exhibitionPlainText(doc) {
  const lines = []
  if (doc.subtitle) lines.push(doc.subtitle)
  if (doc.title) lines.push(doc.title)
  for (const label of doc.overview_labels || []) lines.push(`${label} : `)
  if (doc.intro) lines.push('', doc.intro_heading, doc.intro)
  for (const section of doc.sections || []) {
    lines.push('', section.title)
    if (section.description) lines.push(section.description)
    for (const item of section.items || []) lines.push(item.name, item.year)
  }
  if (doc.closing) {
    lines.push('')
    if (doc.closing_title) lines.push(doc.closing_title)
    lines.push(doc.closing)
  }
  return lines.join('\n')
}
