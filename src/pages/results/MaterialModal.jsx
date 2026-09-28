import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react'
import LanguageDropdown from '../../components/LanguageDropdown.jsx'
import { useToast } from '../../components/useToast.js'
import useBodyScrollLock from '../../components/useBodyScrollLock.js'
import { useEscapeToClose } from '../../components/Modal.jsx'
import useIsBottomOverlay from '../../components/useOverlayStack.js'
import { isLive, fetchArtifactDetail } from '../../lib/searchApi.js'

// round06c-ext D1-5: 퍼블 search_result.html 자료상세모달(L435-501)의 detail_popup 마크업으로
// 재퍼블한다. 데이터 바인딩(라이브 fetchArtifactDetail·더미 폴백·행/설명/OCR/KOGL 분기)은
// 전부 보존하고 셸/클래스만 v2(detail_popup·detail_popup_content·detail_popup_meta·
// detail_popup_gallery·detail_popup_body·detail_popup_info·detail_popup_desc·detail_popup_license·
// popup_tit·popup_close)로 맞췄다. 공용 Modal 대신 자체 detail_popup를 그린다.
//
// 퍼블과 다르게 간 곳(reconcile):
//  - 갤러리 이전/다음 화살표(detail_popup_gallery_prev/next): 앱은 자료당 이미지 1장이라
//    캐러셀이 없다(기존 결정 유지) → 화살표 미렌더.
//  - 하단 이전/다음: 퍼블 detail_popup엔 없는 앱 고유 "자료 간 이동"(현재 준비중 토스트)이라
//    라이선스 블록 아래 footer로 유지한다.
//
// R6c-ext 리뷰 A1·A4·A5 후속:
//  - 헤더를 퍼블 .panel_head.ty_modal 로 되돌렸다. 당시엔 공용 Modal.jsx의 px-6 py-4가
//    본문(퍼블 1.2rem=24px)과 ¼로 어긋나 있어 이 파일이 그 공용 셸을 통째로 우회한
//    근거였다 — round10b에서 공용 Modal이 복구됐다(Modal.jsx px-24 py-16, 스페이싱
//    계약 시험으로 잠김). 그래도 이 우회는 그대로 둔다 — 되돌릴 이유가 아니라
//    퍼블 `.detail_popup` 마크업(중앙정렬 transform·전용 애니메이션 등 아래 주석 참조)을
//    쓰기 위해 **의도적으로 유지**한다. panel_head 는 앱의 다른
//    토큰(data_panel_head·dropdown_box_panel_head·alert_popup_head)과 겹치지 않아 안전하다.
//  - popup_tit·popup_close CSS 를 반입했으므로 같은 속성을 지정하던 Tailwind(text-base
//    font-bold text-ink-900 / bg·rounded·padding)를 걷어낸다. 퍼블 닫기버튼은 배경 없는
//    1.5rem 아이콘이다. lucide svg 는 currentColor 를 쓰므로 색 유틸만 남긴다.
//  - .detail_popup_license 를 detail_popup_content 밖(=.detail_popup 직계 자식)으로 옮겼다.
//    퍼블에서 라이선스는 content 의 형제인 고정 푸터다 — content 안에 두면 content 의
//    padding 과 license 의 padding 이 이중으로 걸리고 라이선스가 본문과 함께 스크롤된다.
//
// R6c-ext D1-5b: detail_popup 그룹 CSS를 app에 반입했다(component.css R6c-ext D1-5b 블록).
// 그래서 배치/색을 담당하던 Tailwind 브리지를 걷어내고 퍼블 CSS가 그리게 한다. 퍼블
// .detail_popup은 display:none + .is_active로 열리므로 모달 카드에 is_active를 상시 부여한다
// (조건부 렌더로 열고 닫으므로 렌더되는 순간이 곧 열린 상태다). 바깥 오버레이는 앱 고유
// 래퍼로 유지한다 — 퍼블 .detail_popup이 position:fixed로 자기 자신을 화면 중앙에 두므로
// 오버레이의 flex 중앙정렬은 무해하게 남고, 오버레이는 dim 배경·바깥클릭 닫기만 담당한다.
// popup_tit·popup_close·popup_scroll도 리뷰 A5로 함께 반입했다(위 A5 항목 참조) — 더는
// Tailwind가 표시를 맡지 않는다.

// 이미지 없음/로드 실패 시 보여줄 플레이스홀더(원본 아카이브 느낌의 사선 패턴).
//
// R6c-ext 리뷰 A2 — w-full 이 필수다. 부모 .detail_popup_gallery 는 display:flex +
// align-items/justify-content:center 라, 폭을 스스로 정하지 않는 블록 자식은 flex item 이
// 되어 컨텐츠 폭(=0, 안내 문구는 absolute 라 폭에 기여하지 않는다)으로 붕괴한다. 그러면
// '이미지 없음'·'이미지를 불러오지 못했습니다' 안내가 화면에서 사라진다 — 더미 85건이 전부
// image:'' 라 항상 재현되는 경로다.
// 퍼블의 무이미지 처리(.detail_popup.ty_no_image)는 채택하지 않았다: 그 변형은 갤러리뿐 아니라
// detail_popup_info·detail_popup_license 까지 숨기고 path/date 를 대신 보여주는 "연표 항목"
// 전용 표현이다. 앱의 무이미지는 자료 유형이 다른 게 아니라 이미지 데이터가 없는 것이므로,
// 그 변형을 쓰면 더미 전건에서 메타 표·라이선스가 통째로 사라진다(앱엔 path/date 데이터도 없다).
function ImagePlaceholder({ label }) {
  return (
    <div
      className="relative w-full rounded-[10px] overflow-hidden"
      style={{ height: '300px', background: 'repeating-linear-gradient(135deg,#9CA3AF 0 16px,#A8AFB9 16px 32px)' }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          style={{ fontFamily: "'Courier New', monospace" }}
          className="text-xs text-white bg-black/25 px-2.5 py-1 rounded-md"
        >
          {label}
        </span>
      </div>
    </div>
  )
}

export default function MaterialModal({ material, onClose }) {
  // round07j — 퍼블이 여기에 `const { searchGenId, sort, visibility, setSort,
  // setVisibility } = useScenario()` 를 넣어 왔으나 **다섯 개 모두 어디에도 쓰이지
  // 않았다**(구조분해 그 줄이 유일한 등장). 다른 화면에서 옮겨 붙이다 남은 줄이다.
  //
  // 지우는 이유가 「죽은 코드라서」만은 아니다 — 이 한 줄이 MaterialModal 에
  // **ScenarioProvider 라는 하드 의존을 새로 걸었다.** 이 모달은 검색결과·대화·
  // 산출물상세 세 곳에서 열리는 말단 표시 컴포넌트라 컨텍스트 없이도 서야 한다.
  // 실제로 이 줄 하나가 테스트 35건을 `useScenario must be used within
  // ScenarioProvider` 로 죽였다.
  // round07k ① — 이 모달은 공용 Modal.jsx 를 쓰지 않고 퍼블 .detail_popup 을 직접
  // 그린다. 그래서 잠금도 따로 걸어야 한다. 아래 `if (!material) return null`(131행)
  // 보다 먼저 불러야 훅 호출 수가 일정하다.
  useBodyScrollLock(Boolean(material))
  const { showToast } = useToast()
  // 라이브 상세(GET /artifacts) — 있으면 실데이터로 표출, 없으면 더미(material.meta)로 폴백.
  const [detail, setDetail] = useState(null)
  const [imgError, setImgError] = useState(false)

  // round06e §8.2 — 이미지 확대 라이트박스(퍼블 detail_popup에 없는 자체 설계, §1.4 #3).
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const galleryTriggerRef = useRef(null)
  const lightboxCloseRef = useRef(null)

  // round06e 리뷰 Important — ESC도 배경 클릭·✕ 버튼과 같은 closeLightbox()를 태워야
  // 포커스가 트리거로 복귀한다(AlertPopup의 close()가 확인 버튼·Esc·dim 3경로를 통합하는
  // 것과 같은 계약). 그래서 closeLightbox를 이 effect보다 먼저 선언해 참조한다.
  const closeLightbox = () => {
    setLightboxOpen(false)
    galleryTriggerRef.current?.focus()
  }

  useEffect(() => {
    if (!lightboxOpen) return
    lightboxCloseRef.current?.focus()
  }, [lightboxOpen])

  // round10 — Escape 처리를 Modal 의 공용 스택에 얹는다. 예전에는 여기서 document 에
  // 직접 리스너를 달았는데, Modal 이 Escape 로 닫히게 되면서 그대로 두면 Escape 한 번에
  // 라이트박스와 그 뒤의 자료 상세가 **함께** 닫힌다. 같은 스택에 올리면 나중에 열린
  // 라이트박스가 맨 위라 Escape 를 먼저 먹고, 자료 상세는 그대로 남는다.
  useEscapeToClose(lightboxOpen, closeLightbox)

  // round10 사용자 결정(2026-09-16) — 이 모달도 Escape 로 닫는다. 공용 Modal.jsx 를 쓰지
  // 않고 퍼블 .detail_popup 을 직접 그리는 컴포넌트라(위 round07k ① 주석) 닫기 경로를
  // 여기서 따로 얹어야 한다. 배경 클릭·✕ 와 같은 onClose 를 태운다.
  // 라이트박스가 열려 있으면 그쪽이 스택 맨 위라 Escape 를 먼저 먹는다 — 이 모달은
  // 라이트박스가 닫힌 뒤 두 번째 Escape 에 닫힌다.
  useEscapeToClose(Boolean(material), onClose)

  // round10c Task A3 — 겹쳐 열려도 딤은 한 겹만. useOverlayStack.js 머리주석 참조:
  // 판정은 스택의 현재 상태에서 매번 파생되므로, 닫는 순서가 엇갈려도(예: 이 모달을
  // 감싼 공용 Modal(목록)이 이 모달보다 먼저 닫혀도) 남은 위엣것이 딤을 되찾는다.
  const isBottom = useIsBottomOverlay(Boolean(material))

  // round06e 리뷰 Minor — 라이트박스는 aria-modal="true"(하단 참조)를 선언했으므로
  // AlertPopup(alert_popup_head 주석 참조)과 같은 계약을 이행해야 한다: Tab이 뒤에 가려진
  // .detail_popup 요소로 새 나가면 안 된다. 포커스 가능 요소가 닫기 버튼 하나뿐이라
  // 순환 로직 없이 preventDefault 한 줄로 족하다(요소가 늘면 AlertPopup처럼 교체).
  const onLightboxKeyDown = (e) => {
    if (e.key === 'Tab') e.preventDefault()
  }

  const id = material?.id
  useEffect(() => {
    setDetail(null)
    setImgError(false)
    if (isLive() && id) {
      let alive = true
      // round07b-ext task-6 — fetchArtifactDetail이 이제 { ok, detail }을 돌려준다
      // (searchApi.js 주석 참조). ok가 아니면(무접속·미존재) detail을 null로 유지해
      // 아래 live 판정이 더미 폴백 경로를 타게 한다.
      fetchArtifactDetail(id)
        .then((res) => { if (alive) setDetail(res.ok ? res.detail : null) })
        .catch(() => { if (alive) setDetail(null) })
      return () => { alive = false }
    }
  }, [id])

  if (!material) return null

  const live = Boolean(detail)

  // round07h — 라이브·더미 **같은 3행**을 그린다(피그마).
  //
  // 폐기한 것: 국적/시대 · 재질 · 크기. 셋 다 문화유산에만 있는 값이라
  // 아카이브 185,073건에서 통째로 빈칸이었고 피그마에도 없다.
  //
  // 「소장처」가 아니라 **「수집처」**다 — 원천 컬럼이 obtain_stt(입수처)이고,
  // 거제시청 2,551건은 원본이 미국 NARA 에 있어 「소장」이 사실과 다르다.
  //
  // 자료번호는 relics_no(기관 번호, 원천 9.1%)가 아니라 우리 idnbr 을 쓴다.
  //
  // round07h Task 6 리뷰 fix(Minor M1) — 더미 경로에서 idText 로 material.id(앱
  // 내부 키, 예 'm1')를 붙였었다. 더미 material.meta.location 은 이미 자료번호를
  // 품고 있어("서울 종로 / 유물번호 H-1001") 그 뒤에 내부 키가 다시 이어붙는
  // 사고였다(예: "... H-1001 / m1"). 더미 화면에 앱 내부 id 가 뜰 이유가 없으므로
  // 더미 경로는 location 만 쓴다(null → 아래 filter(Boolean)이 idText 를 뺀다).
  const holder = live ? detail.holder : material.meta?.location
  const idText = live ? (detail.idnbr || id) : null
  const subjectText = live
    ? [(detail.subject || []).join(', '), detail.category].filter(Boolean).join(' · ')
    : material.meta?.theme
  const eraText = live ? detail.subject_era : material.meta?.period

  const rows = [
    ['소장처/유물번호', [holder, idText].filter(Boolean).join(' / ')],
    ['주제/장르', subjectText],
    ['시대', eraText],
  ]

  const description = live ? (detail.datadc || '') : (material.meta?.detail ?? '')
  const ocrText = live ? (detail.ocr_text || '') : ''
  const imageSrc = live ? detail.image : material.image
  const pageUrl = live ? detail.page_url : material.pageUrl

  // round10c Task A1 — body 로 포털한다.
  //
  // 라이브 실측(2026-09-18): OutputDetailPage.jsx:231 의 목록 모달(공용 Modal, round10b
  // 에서 포털됨)과 이 컴포넌트는 둘 다 z-50 인데, 이 컴포넌트만 페이지 트리에 남아 있었다.
  // 원리는 Modal.jsx round10b 주석과 같다 — 오버레이(:187, fixed + z-50)는 그 자체로
  // 새 쌓임 맥락(stacking context)을 만들고, 이 컴포넌트가 페이지의 **어느 조상 아래**
  // 마운트되는지에 따라 그 맥락이 비교되는 층이 화면마다 달라진다. 목록 모달처럼 이미
  // body 직계인 형제와 만나면 "body 직계가 DOM 뒤쪽" 규칙에 걸려 나중에 연 이 모달이
  // 아래로 깔린다. body 로 포털하면 맥락이 항상 루트가 되어 **어느 화면에서 열든** 같은
  // 결과가 된다 — z-index 를 더 올리는 것은 대증요법이다(다음 화면에서 또 난다).
  // round10c Task A3 — 맨 아래가 아니면 딤 배경을 투명으로 덮어쓴다. 요소는 그대로
  // 둔다(Modal.jsx 와 같은 관행) — 배경 클릭으로 닫는 경로가 이 요소의 onClick 에
  // 달려 있다.
  const dimClass = isBottom ? 'bg-[rgba(20,26,46,.5)]' : 'bg-transparent'
  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${dimClass} animate-overlayIn`}
      onClick={onClose}
    >
      {/* animate-popupIn(≠ animate-modalIn): 퍼블 .detail_popup은 transform으로 중앙정렬하므로
          종점이 `transform: none`인 modalIn을 쓰면 중앙정렬이 지워져 모달이 우하단으로 잘린다
          (tailwind.config.js keyframes 주석 참조 — D1-5b 후속 fix, 브라우저 실측으로 발견). */}
      <div
        className="detail_popup is_active shadow-[0_30px_80px_-20px_rgba(8,15,38,.5)] animate-popupIn"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail_popup_tit"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더(퍼블 panel_head ty_modal): 제목 popup_tit + 닫기 popup_close.
            정렬은 퍼블이 담당한다 — .panel_head 가 flex, .popup_tit 이 flex:1 1 0 이라
            justify-between 없이도 닫기 버튼이 오른쪽 끝으로 밀린다. */}
        <div className="panel_head ty_modal">
          <h3 id="detail_popup_tit" className="popup_tit">
            {live ? (detail.name || material.title) : material.title}
          </h3>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="popup_close icon_btn text-[#3A4250] hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        {/* round07h — ty_two_col: 퍼블 1단 detail_popup_content 의 변형(피그마 2단).
            좌단(갤러리+메타 표) / 우단(설명+OCR)은 아래 detail_popup_body 안에서 갈린다.
            언어·소장기관 메타(detail_popup_meta)는 2단 위에 걸치는 헤더 성격이라 그대로 둔다. */}
        <div className="detail_popup_content ty_two_col popup_scroll">
          {/* detail_popup_meta: 소장처 링크 */}
          <div className="detail_popup_meta">
            
            {pageUrl ? (
              <a
                href={pageUrl}
                target="_blank"
                rel="noreferrer"
                className="detail_popup_source"
              >
                {material.institution ?? '소장기관'}
                <ExternalLink size={12} />
              </a>
            ) : (
              <span className="detail_popup_source">
                {material.institution ?? '소장기관'}
              </span>
            )}
          </div>

          <div className="detail_popup_body">
            {/* 좌단 — 갤러리 + 메타 3행(dl) */}
            <div className="detail_popup_col_left">
              {/* detail_popup_gallery: 원본 이미지(있으면) — 실패/무이미지면 플레이스홀더 */}
              <div className="detail_popup_gallery">
				<button
					type="button"
					onClick={() => showToast('준비 중입니다')}
					className="flex items-center gallery_btn"
				>
					<ChevronLeft size={16} />
					이전
				</button>
				
                {imageSrc && !imgError ? (
                  // 확대 트리거 버튼은 **레이아웃 중립**이어야 한다.
                  // 퍼블 .detail_popup_gallery 는 flex + align-items/justify-content:center 로 이미지를
                  // 가운데 둔다(styles/publish/component.css:421). round06e 가 이 버튼을 갤러리와 <img>
                  // 사이에 끼우면서 중앙정렬의 대상이 <img>가 아니라 버튼이 되었고, 버튼은 w-full 이라
                  // 갤러리를 꽉 채우므로(중앙정렬해도 제자리) 그 안의 <img>는 블록 요소로 좌측에 붙었다
                  // → 원본 이미지가 왼쪽으로 쏠림. 버튼이 스스로 flex 중앙정렬 컨테이너가 되면 퍼블이
                  // 의도한 위치가 그대로 복원된다.
                  // w-full 은 유지한다 — .detail_popup_gallery_img 의 max-width:80% 는 부모(=버튼) 폭을
                  // 기준으로 풀리므로, 버튼을 콘텐츠 폭으로 줄이면 퍼센트 기준이 바뀌어 크기가 달라진다.
                  <button
                    type="button"
                    ref={galleryTriggerRef}
                    aria-label={`${material.title} 크게 보기`}
                    onClick={() => setLightboxOpen(true)}
                    className="flex w-full items-center justify-center cursor-zoom-in border-0 bg-transparent p-0"
                  >
                    <img
                      src={imageSrc}
                      alt={material.title}
                      onError={() => setImgError(true)}
                      className="detail_popup_gallery_img bg-[#F3F4F6]"
                      style={{ maxHeight: '340px' }}
                    />
                  </button>
                ) : (
                  <ImagePlaceholder label={imageSrc ? '이미지를 불러오지 못했습니다' : '이미지 없음'} />
                )}

				<button
					type="button"
					onClick={() => showToast('준비 중입니다')}
					className="flex items-center gallery_btn"
				>
					다음
					<ChevronRight size={16} />
				</button>
              </div>

              {/* 상세 표(key/value) — 퍼블 detail_popup_info(dl) */}
              {/* 퍼블 detail_popup_info는 grid(term 1fr | desc 5fr)이고 각 row는 display:contents다.
                  그래서 row의 flex/gap과 term의 고정폭(w-[108px])·desc의 flex-1을 걷어내 퍼블 그리드가
                  두 열을 잡게 한다. leading-relaxed·break-words는 퍼블이 안 주는 속성이라 유지. */}
              <dl className="detail_popup_info max-h-[120px] overflow-y-auto">
                {rows.map(([label, val]) => (
                  <div key={label} className="detail_popup_info_row">
                    <dt className="detail_popup_info_term">{label}</dt>
                    <dd className="detail_popup_info_desc leading-relaxed break-words">{val || '—'}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* 우단 — 상세 설명(datadc) + OCR */}
            <div className="detail_popup_col_right">
              {/* 상세 설명(datadc) — 퍼블 detail_popup_desc */}
			  <div className="flex items-end gap-1.5 title_top">
					<strong className="text-[16px] mt-1.5">유물정보</strong>
				</div>
              {description && (
                <div className="detail_popup_desc border border-line-hair max-h-[180px] overflow-y-auto whitespace-pre-wrap">
                  {description}
                </div>
              )}

              {/* round07h — OCR 이 없어도 **섹션을 숨기지 않는다**.
                  전체의 80%(archive 185,073건)가 OCR 0% 다. 숨기면 우단이 datadc 하나만
                  남아 2단 레이아웃이 무너진다. 「없다」는 것도 학예사에게 정보다. */}
              <div className="detail_popup_ocr">
				<div className="detail_popup_ocr_title  mb-1.5">
					<div className="flex items-end gap-1.5 title_top">
						<strong className="text-[16px]">OCR</strong>
						<span className="text-[11px] text-[#6B7280] leading-relaxed">이미지에서 추출한 텍스트</span>
					</div>
					{/* round07k ③ — 피그마의 [원문|독음]. **자리만** 만든다.
					    독음 변환은 이 라운드 범위 밖이다(사용자 확정 2026-09-09 —
					    「기능 개발은 안 했지만 준비중이라고라도 떠야 해」).

					    ★ 독음을 눌러도 상태가 바뀌지 않는다. 바뀌면 사용자가
					      「독음을 켰는데 원문이 그대로 나온다」로 읽는다 — 준비
					      중임을 알리는 것이 목적이지 상태를 바꾸는 것이 아니다.
					      그래서 aria-pressed 는 원문에 고정이고, 독음은 토스트만
					      부른다. 기능이 생기면 그때 상태를 준다. */}
					<div className="flex items-center gap-1">
						<div className="toggle_btn_wrap">
							<div className="flex items-center gap-1" role="group" aria-label="OCR 표기">
								<button
									type="button"
									aria-pressed="true"
									className="px-2.5 py-1 rounded-[3px] bg-primary-100 text-primary-600 text-[12px] font-semibold"
								>
									원문
								</button>
								<button
									type="button"
									aria-pressed="false"
									onClick={() => showToast('준비 중입니다')}
									className="px-2.5 py-1 rounded-[5px] text-[#5A6173] text-[12px]"
								>
									독음
								</button>
							</div>
						</div>
						{/* round10a Task 3-A — 라이브 재현: English 를 골라도 드롭다운 라벨만
							바뀌고 본문은 한국어 그대로였다(토스트도 안내도 없다). 원인은
							`lang` 상태를 읽는 곳이 아무 데도 없던 것 — 번역 자체가 없는데
							라벨만 바뀌면 사용자가 "번역이 실패했다"로 읽는다. 바로 위
							독음과 같은 관행으로 맞춘다: 상태를 바꾸지 않고(value 고정
							'한국어') 준비 중임을 토스트로만 알린다. */}
						<LanguageDropdown value="한국어" onChange={() => showToast('준비 중입니다')} />
					</div>
				</div>
                {ocrText ? (
                  <div className="detail_popup_ocr_body bg-[#FBFBFD] border border-line-hair rounded-[10px] px-16 py-[13px] text-[14px] leading-[1.7] text-[#3A4250] whitespace-pre-wrap max-h-[180px] overflow-y-auto">
                    {ocrText}
                  </div>
                ) : (
                  <p className="text-[13px] text-[#8A90A2] px-16 py-[13px] border border-line-hair rounded-[10px] bg-[#FBFBFD]" style={{ height : "calc(100% - 40px)"}}>
                    이 자료에는 OCR 텍스트가 없습니다.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 공공누리 KOGL block — 퍼블 detail_popup_license.
            퍼블에선 detail_popup_content 의 형제(고정 푸터)이자 마지막 요소다(A4). */}
        {material.source?.includes('저작권자 허락') ? (
          <div className="detail_popup_license text-[11px] text-[#6B7280] leading-relaxed">{material.source}</div>
        ) : (
          <div className="detail_popup_license">
            <div className="flex-none flex items-center gap-1.5">
              <span className="text-[11px] font-extrabold text-kogl border-[1.5px] border-kogl rounded px-1.5 py-0.5 leading-none">OPEN</span>
              <span className="text-[10px] text-[#8A90A2]">공공누리</span>
            </div>
            <div className="text-[14px] text-[#6B7280] leading-relaxed">
              <strong className="text-[#3A4250]">「공공누리」 제4유형(출처표시·상업적 이용금지·변경금지)</strong>
              <br />
              본 저작물은 「공공누리」 제4유형(출처표시·상업적 이용금지·변경금지) 조건에 따라 이용할 수 있습니다.
            </div>
          </div>
        )}

      </div>

      {lightboxOpen && imageSrc && (
        // round06e 리뷰 후속, round10c Task A1 갱신 — z-[110]은 페이지 전역 기준으로는
        // 무의미한 숫자다. 이 라이트박스는 바깥 오버레이(위 :198, fixed + z-50)의 자식이고,
        // 그 오버레이가 이미 자체 쌓임 맥락(stacking context)을 만들기 때문에 자손인
        // 라이트박스는 페이지 관점에서 항상 "z-50 한 덩어리"로 취급된다. 즉 110은 이 쌓임
        // 맥락 **안**에서 형제(.detail_popup, 102)를 이기는 데만 유효하다 — 이번 요구사항
        // (.detail_popup(102)만 이기면 됨)은 이 값으로 충족되므로 숫자 자체는 바꾸지
        // 않는다(기존 테스트가 110을 잠근다).
        //
        // [round10c 이후로 달라진 사실] 이 오버레이가 이제 body 로 포털되면서, AppShell 이
        // 마운트하는 .dim(101)·.alert_popup(102)(둘 다 round10c 에서 나란히 body 로
        // 포털됨)과 **정확히 같은 층**(document.body 직계)에서 경합한다. 포털 전에는
        // 이 오버레이가 페이지의 어느 조상 아래 마운트되는지에 따라 비교되는 층이 화면마다
        // 달라질 수 있었다(Modal.jsx round10b 의 `.lnb` 트랩과 같은 종류의 위험). 포털 후
        // 에는 비교가 항상 같은 층에서 정직하게 일어나므로, z-50(이 오버레이 전체, 라이트박스
        // 포함) < z-60(Toast) < z-101(.dim) < z-102(.alert_popup) 순서가 어느 화면에서
        // 열든 그대로 유지된다 — .dim·.alert_popup·Toast 는 여전히(그리고 이제는 항상) 이
        // 라이트박스 위에 그려진다. 결론(그 셋이 위에 그려짐)은 바뀌지 않는다 — 바뀐 것은
        // 그 결론이 화면에 무관하게 항상 성립한다는 보장이다.
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80"
          role="dialog"
          aria-modal="true"
          aria-label="이미지 크게 보기"
          onClick={(e) => { e.stopPropagation(); closeLightbox() }}
          onKeyDown={onLightboxKeyDown}
        >
          <button
            type="button"
            ref={lightboxCloseRef}
            aria-label="이미지 확대 닫기"
            onClick={(e) => { e.stopPropagation(); closeLightbox() }}
            className="absolute top-16 right-16 text-white"
          >
            <X size={28} />
          </button>
          <img
            src={imageSrc}
            alt={material.title}
            onClick={(e) => e.stopPropagation()}
            style={{ objectFit: 'contain', maxWidth: '90vw', maxHeight: '90vh' }}
          />
        </div>
      )}
    </div>,
    document.body,
  )
}
