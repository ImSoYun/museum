import { useState } from 'react'
import { Download } from 'lucide-react'
import { institutions } from '../../data/institutions.js'
import { materials } from '../../data/materials.js'
import { useScenario } from '../../context/ScenarioContext.jsx'
import { useToast } from '../../components/useToast.js'
import Pagination from '../../components/Pagination.jsx'
import ResultFilterControls from './ResultFilterControls.jsx'
import { mediaTypeTagClass } from './mediaTypeTag.js'
import HolderFilterList from './HolderFilterList.jsx'
import MaterialModal from './MaterialModal.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import { downloadArtifactImage } from '../../lib/searchApi.js'
import { triggerBrowserDownload } from '../../lib/downloadFile.js'
import { useReadOnly } from '../../context/ReadOnlyContext.jsx'

// Map institution id → institution name for filtering (비라이브 전용)
// Derived from the institutions data file so it stays consistent automatically
const INST_NAME_MAP = Object.fromEntries(
  institutions.map(i => [i.id, i.id === 'all' ? null : i.name])
)

// Material lookup map — static, built once at module scope (materials never changes at runtime)
const byId = Object.fromEntries(materials.map(m => [m.id, m]))

// 유형 판별 헬퍼 (카드 type → 칩 key). 라이브·비라이브 공통 —
// 라이브 material.type은 searchApi.deriveType()이 동일 어휘(사진/영상/음성/도서)로 매핑해 둔다.
function matchType(m, key) {
  if (key === 'image') return m.type === '사진' || m.type === '포스터'
  if (key === 'video') return m.type === '영상'
  if (key === 'audio') return m.type === '음성'
  if (key === 'book')  return m.type === '도서'
  return true
}

// 카드 유형 태그 — 퍼블 result_card의 두 번째 tag에 대응(ty_image/ty_video/ty_book/ty_web).
// ty_* 클래스는 앱 유형→퍼블 태그 클래스 매핑으로 semantic hook만 얹고, 표시 텍스트는
// 앱의 원 유형(사진/영상/음성/도서/포스터/웹콘텐츠)을 그대로 쓴다 — 퍼블의 정규화 라벨
// (이미지 등)을 채택하면 우측 유형 필터 칩(이미지/영상/…)과 같은 문구가 두 곳에 생겨
// 테스트가 요소를 특정하지 못하고, 기존 카드 표시(원 유형)와도 어긋난다(0 회귀 우선).
// 퍼블의 등록/미등록 status 태그는 앱 데이터에 근거 필드가 없어 미렌더(무근거 신호 방지).
//
// 퍼블 팔레트는 4종(ty_image·ty_video·ty_book·ty_web)뿐이라 앱 유형 7종을 그 4종에 접어 넣는다.
// '문서'는 더미 85건 중 48건(최다)인데 매핑이 없어 기본 회색으로 떨어져 있었다 — 인쇄·문헌
// 계열을 대표하는 퍼블 카테고리는 ty_book 하나라 '도서'와 같은 칸에 넣는다(표시 텍스트는
// '문서'/'도서'로 여전히 구분된다). '지도'는 도상 자료라 ty_image 계열로 본다.
const TYPE_TAG = {
  '사진':    { cls: 'ty_image', tw: 'bg-prog-bg text-prog' },
  '포스터':  { cls: 'ty_image', tw: 'bg-prog-bg text-prog' },
  '지도':    { cls: 'ty_image', tw: 'bg-prog-bg text-prog' },
  '영상':    { cls: 'ty_video', tw: 'bg-bad-bg text-bad' },
  '도서':    { cls: 'ty_book',  tw: 'bg-[#F3F0FB] text-[#6B4FB8]' },
  '문서':    { cls: 'ty_book',  tw: 'bg-[#F3F0FB] text-[#6B4FB8]' },
  '음성':    { cls: 'ty_audio', tw: 'bg-[#F0F8F0] text-[#2D7A3A]' },
  '웹콘텐츠': { cls: 'ty_web',   tw: 'bg-warn-bg text-warn' },
}
function typeTag(type) {
  return TYPE_TAG[type] ?? { cls: '', tw: 'bg-canvas text-ink' }
}

// round10a Task4-B — 카드 썸네일 표시 폭은 130px 안팎(라이브 실측)이지만, 고해상도
// (레티나 등) 화면에서 흐려 보이지 않도록 표시폭의 2배를 서버에 요청한다. 서버
// (api.py get_image)가 width 인자를 받아 PIL로 그 폭까지만 줄여 준다 — 없으면
// 원본(긴 변 3000~6000px대)을 그대로 내려받아 결과 20장에 13MB가 나갔다(실측,
// task-4-brief.md 4-B). 다운로드 버튼(downloadArtifactImage)은 이 폭을 타지
// 않는 별도 엔드포인트(/artifacts/{id}/download)라 원본 그대로 받는다.
const THUMB_WIDTH_PX = 260

function withThumbWidth(url) {
  if (!url) return url
  return `${url}${url.includes('?') ? '&' : '?'}width=${THUMB_WIDTH_PX}`
}

// result_card — 퍼블 search_result.html L239-252(result_card > result_card_badges·
// result_card_tit·result_card_meta·result_card_thumb[result_card_thumb_img + result_card_dl]).
// 다운로드 버튼(result_card_dl)은 round06e T5부터 실배선이다(handleDownload 참고). 라이브에서는
// downloadArtifactImage로 실물 파일을 받아 triggerBrowserDownload로 저장하고, 비라이브(더미
// 데이터)는 받을 원본이 없어 준비중 토스트(정확 문구 "준비 중입니다")로 안내한다 — 갈림 기준은
// isLive다. 라이브라도 hasImage:false인 자료는 받을 파일 자체가 없어 downloadDisabled로 버튼을
// 비활성화해 애초에 클릭이 onDownload까지 가지 않는다(토스트가 아니라 버튼 비활성으로 안내).
function ResultCard({ material, live, onOpen, onDownload, downloadDisabled }) {
  const [imgError, setImgError] = useState(false)
  const showImage = Boolean(material.image) && !imgError
  const tag = typeTag(material.type)

  // 카드는 role=button 이라 Enter/Space로도 열려야 한다. 다만 카드 안에는 자체 활성 요소
  // (다운로드 버튼)가 있어, target 가드가 없으면 그 버튼에 포커스를 두고 Enter/Space를 누를 때
  // 버튼의 동작(실다운로드 또는 준비중 토스트, 위 주석 참고)과 카드의 동작(상세 모달)이 함께
  // 발동한다 — 마우스로는 드러나지 않고 키보드 사용자에게만 나타나는 이중 발동이다. keydown 이
  // 카드 자신에게서 났을 때만 연다.
  function onCardKeyDown(e) {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') onOpen(material)
  }

  return (
    <li
      className="result_card group transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_-14px_rgba(30,40,90,.35)]"
      role="button"
      aria-label={material.title}
      tabIndex={0}
      onClick={() => onOpen(material)}
      onKeyDown={onCardKeyDown}
    >
      <div className="result_card_badges">
        {/* round07h — 공개/미공개. 서버가 준 값을 표시만 한다.
            null 이면 아무것도 그리지 않는다 — 보강 조회가 실패했거나 자료가
            없는 경우이고, 「모름」을 「공개」로 단정하면 학예사가 오해한다.
            (round07m — 아래 종류 배지가 mediaType null 을 안 그리는 것과 같은
            판단 — R6F-18 「무근거 신호 방지」.)

            ⚠️ `{material.isPublic && …}` 로 쓰면 미공개(false)가 사라진다.
            세 상태를 === 로 갈라야 한다. */}
        {material.isPublic === true && (
          <span className="tag btn_open">공개</span>
        )}
        {material.isPublic === false && (
          <span className="tag btn_close">미공개</span>
        )}
        {/* round07m — 라이브 두 번째 배지는 **종류**다(사용자 결정 6). round07d 의 주제 배지를
            뺐다 — 주제는 필터로만 남는다. 값은 서버가 준 material.mediaType 을 표시만 하고,
            없으면(문화유산 — 원천에 매체 칸이 없다 · 백필 전) 그리지 않는다. 「모름」을 라벨로
            찍지 않는다(R6F-18 「무근거 신호 방지」, 위 공개여부 null 처리와 같은 판단).
            색은 mediaTypeTag.js — 이미지·영상·도서는 퍼블 .tag.ty_*, 음원·기타는 publish-ext.css.

            비라이브(더미)는 그대로다 — 더미 85건은 옛 유형 어휘(사진/영상/음성/도서)이고
            TYPE_TAG 가 색을 준다. */}
        {live
          ? material.mediaType && (
              <span className={`tag ${mediaTypeTagClass(material.mediaType)}`}>
                {material.mediaType}
              </span>
            )
          : (
              <span className={`tag ${tag.cls} ${tag.tw}`}>
                {material.type}
              </span>
            )}
      </div>
      <p className="result_card_tit leading-snug">
        {material.title}
      </p>
      {/* round07h 후속 — 라이브는 searchApi.mapResult 가 채운 eraText(다루는 시대,
          정렬과 같은 축)를 읽는다. 비라이브(더미, materials.js)는 eraText 를 모르고
          era 필드만 갖고 있으므로 ?? 로 그쪽을 그대로 쓴다 — 더미 어휘까지 바꿀
          이유는 없다(다루는 시대·만들어진 때 두 축 구분이 더미 데이터엔 없다). */}
      {/* round10a Task4-A — 「이미지 1장」 거짓말 제거. 실측: 새마을운동 포스터 결과
          20장이 전부 「이미지 1장」인데 실제 <img>는 11개뿐이었다 — mapResult가
          imageCount를 채우지 않아 폴백 1이 항상 이겼다. 서버가 이미 주는 hasImage
          신호(searchApi.mapResult:hasImage)를 먼저 본다: false면 있는 척하지 않고
          "이미지 없음"이라 말한다. 그 외(true·비라이브에서 undefined)는 기존 그대로
          건수를 보인다 — 더미(materials.js)는 hasImage가 없어 이 분기를 타지 않는다. */}
      <p className="result_card_meta">
        {material.eraText ?? material.era} · {material.hasImage === false
          ? '이미지 없음'
          : `이미지 ${material.imageCount ?? material.meta?.imageCount ?? 1}장`}
      </p>
      {/* 썸네일 박스·이미지 배치는 퍼블이 전담한다.
          - aspect-[4/3]·overflow-hidden 제거: 퍼블 .result_card_thumb 은 flex:1 1 auto +
            min-height:9rem 로 "카드 높이의 남는 만큼"을 먹는 방식이고, aspect 비율은 그 높이를
            폭 종속으로 바꿔 버린다(카드가 넓어지는 뷰포트에서 aspect 가 min-height 를 이겨
            퍼블과 어긋난다). overflow:hidden 은 이미 부모 .result_card 가 갖고 있다.
          - img 의 인라인 objectFit:cover·width/height:100% 제거: 퍼블 .result_card_thumb_img 는
            object-fit:contain + width/height:auto + max-*:100% 로 "패딩 여백 안에 전체가 보이는"
            배치인데, 인라인 스타일이 우선순위로 그 규칙을 전부 덮어 잘라내기(cover)로 뒤집었다.
          placeholder 배경(빗금)만 인라인으로 남긴다 — 퍼블의 단색 #ccc 자리에 "이미지 없음"을
          표시하는 앱 고유 신호이고, 데이터 상태에 따라 켜지므로 CSS 클래스로 옮길 수 없다. */}
      <div
        className="result_card_thumb"
        style={showImage ? undefined : { backgroundColor: '#CCCCCC' }}
      >
        {showImage && (
          <img
            src={withThumbWidth(material.image)}
            alt=""
            onError={() => setImgError(true)}
            className="result_card_thumb_img"
          />
        )}
        <button
          type="button"
          aria-label="다운로드"
          disabled={downloadDisabled}
          title={downloadDisabled ? '이미지가 없는 자료입니다' : undefined}
          onClick={(e) => { e.stopPropagation(); onDownload() }}
          className={`result_card_dl icon_btn text-white${downloadDisabled ? ' opacity-40 cursor-not-allowed' : ''}`}
        >
          <Download className="result_card_dl_icon" size={14} strokeWidth={2.5} />
        </button>
      </div>
    </li>
  )
}

export default function ResultsTab() {
  const {
    activeScenario, isLive, liveResults, liveTotal,
    page: livePage, pageSize, changePage, facets,
    holder, setHolder,
    // round07m — 정렬·공개여부·종류·주제는 ResultFilterControls 로 옮겨 갔다.
    // round10a A조 최종 리뷰 M-3 — 그 셋(sort·visibility·mediaType) + subjects를
    // 아래 hasNonDefaultFilter가 함께 읽는다. 컨트롤 자체는 여전히 ResultFilterControls
    // 소관이고, 여기서는 "필터가 걸려 있는가"만 판정한다.
    sort, visibility, mediaType, subjects,
  } = useScenario()
  const { showToast } = useToast()
  // round10a A조 최종 리뷰 M-3 — 프로젝트 상세(ProjectDetail)는 검색창 없이 이 화면을
  // 직접 마운트한다(SearchResults.jsx의 0건 조기 return을 거치지 않는다). 그 화면에서
  // "다른 검색어로 다시 시도해 보세요"는 칠 곳이 없는 거짓 안내다(아래 EmptyState 참조).
  const readOnly = useReadOnly()
  const [instId, setInstId] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  // 비라이브(더미) 전용 클라이언트 페이지 — 라이브 페이지 좌표는 컨텍스트(livePage)가 담당한다.
  const [page, setPage] = useState(1)

  // 풀 구성: 라이브면 백엔드 검색 결과(liveResults), 아니면 활성 시나리오의 materialIds(더미, 순서 보존).
  // 모든 수치(총건수·기관/유형 칩)는 이 pool 단일 모수에서 파생한다. (T6-2)
  const pool = isLive
    ? (liveResults || [])
    : activeScenario.materialIds.map(id => byId[id]).filter(Boolean)
  // 유형 칩 건수 = pool 파생 (typeFacets 정적값 대체) — 비라이브(더미) 전용.
  // round04: 라이브는 칩 줄 자체를 제거한다(카운트·필터 모두) — 서버 페이지네이션에서는
  // 현재 페이지 분량만 세는 카운트가 전체를 오도하기 때문.
  const TYPE_PILLS = isLive ? [] : [
    { key: 'all',   label: '전체',  count: null },
    { key: 'image', label: '이미지', count: pool.filter((m) => matchType(m, 'image')).length },
    { key: 'video', label: '영상',   count: pool.filter((m) => matchType(m, 'video')).length },
    { key: 'audio', label: '음성',   count: pool.filter((m) => matchType(m, 'audio')).length },
    { key: 'book',  label: '도서',   count: pool.filter((m) => matchType(m, 'book')).length  },
  ]

  // 기관 필터 목록 = pool 파생 (비라이브 전용). 라이브 검색 결과에는 institution이 없으므로
  // 라이브에선 기관 파셋 자체를 제거한다(아래 result_filter_list 미렌더). 전체 = pool 길이, 0건 기관은 숨긴다.
  const instOptions = isLive ? [] : [
    { id: 'all', name: '전체', count: pool.length },
    ...institutions
      .filter((i) => i.id !== 'all')
      .map((i) => ({ id: i.id, name: i.name, count: pool.filter((m) => m.institution === i.name).length }))
      .filter((i) => i.count > 0),
  ]

  // Filter pool by institution (비라이브 전용 — 라이브는 항상 pool 그대로)
  const instName = INST_NAME_MAP[instId]
  const filteredByInst = isLive || !instName
    ? pool
    : pool.filter((m) => m.institution === instName)

  // Filter by type pill (공통)
  const filteredMaterials = typeFilter === 'all'
    ? filteredByInst
    : filteredByInst.filter((m) => matchType(m, typeFilter))

  // Headline "총 N건": 라이브 = liveTotal(서버가 캐시에 확보한 전체 랭킹 수, 상한 200 — round04).
  // 비라이브 = 기관 필터 반영된 pool 건수(단일 모수, 유형 필터는 카드 그리드만 좁힘).
  const totalCount = isLive ? liveTotal : filteredByInst.length

  // round04: 라이브는 서버 페이지네이션 — 페이지 수는 서버 total과 서버가 정한 page_size에서
  // 파생하고, 렌더는 서버가 잘라 준 현재 페이지 분량(liveResults) 그대로다(클라 슬라이싱 금지).
  // 비라이브는 클라이언트 페이지네이션을 유지한다(페이지당 ITEMS_PER_PAGE=20건).
  const ITEMS_PER_PAGE = 20  // 퍼블 그리드 4열 × 5행 (라이브 page_size=20과 동일)
  const totalPages = isLive
    ? Math.max(1, Math.ceil(liveTotal / pageSize))
    : Math.max(1, Math.ceil(filteredMaterials.length / ITEMS_PER_PAGE))
  const pagedMaterials = isLive
    ? filteredMaterials
    : filteredMaterials.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  function handleInstSelect(id) {
    setInstId(id)
    setPage(1)
  }

  function handleTypeFilter(key) {
    setTypeFilter(key)
    setPage(1)
  }

  function resetFilters() {
    setInstId('all')
    setTypeFilter('all')
    setPage(1)
  }

  // round10a A조 최종 리뷰 M-3 — SearchResults.jsx LiveResultsPanel의 같은 이름 판정과
  // 같은 식이다(결정 8이 이미 그 화면에서 세운 기준 — sort/visibility/mediaType/holder/
  // subjects 중 하나라도 서버 기본값이 아니면 "검색어가 아니라 필터가 좁혔다"). 그 파일은
  // 이 라운드의 담당 범위 밖이라 옮겨 하나로 합치지 못하고 그대로 옮겨 적는다 — 두 곳에
  // 생긴 어휘라 다음에 필터가 하나 늘면 양쪽 다 고쳐야 한다(R6F-15와 같은 위험, 알고 남긴다).
  const hasNonDefaultFilter = sort !== 'relevance' || visibility !== 'all'
    || mediaType != null || holder != null || (subjects?.length ?? 0) > 0

  // round06e 최종리뷰 I-1 — downloadArtifactImage는 fetch reject(네트워크 단절·CORS 실패)를
  // 감싸지 않는다. try/catch 없이 두면 onClick이 버린 프로미스가 unhandled rejection이 되어
  // 사용자에게는 아무 반응도 없다(코딩표준 §6 침묵 실패). LnbHistory.jsx의 handleOpen이
  // 이미 같은 이유로 .catch를 두고 있다 — 다운로드에도 같은 대칭을 맞춘다.
  async function handleDownload(material) {
    if (!isLive) { showToast('준비 중입니다'); return }
    try {
      const res = await downloadArtifactImage(material.id)
      if (!res.ok) { showToast(res.notice || '다운로드에 실패했습니다'); return }
      triggerBrowserDownload(res.blob, res.filename)
    } catch {
      showToast('다운로드에 실패했습니다. 잠시 후 다시 시도하세요.')
    }
  }

  return (
    <>
      {/* result_meta_bar — 퍼블 L93-179. 좌: 총건수(data_total) / 우: 주제 필터.
          ~~라이브는 유형 파셋을 렌더하지 않는다(§round04)~~ → round06f 갈래 D 에서 뒤집었다:
          이제 라이브도 퍼블처럼 우측에 dropdown_box(주제 다중선택)를 렌더한다. round04 가
          파셋을 뺀 이유("현재 페이지 20건만 세면 전체를 오도")는 서버가 필터 전 200건 기준
          facets.subject 를 내려주면서 소멸했다(spec §9.2·§9.3, round07d 축 전환).
          「자료유형」은 용도·기능 축의 이름이라 라벨은 「주제」로 쓴다 — 그대로 두면
          「자료유형: 정치행정」이라는 틀린 문장이 남는다. 비라이브는 기존 유형 칩
          줄 그대로(더미 데이터 어휘가 다르다 — R6F-18 은 라이브 전용).
          아래 간격은 부모 .result_wrap 의 column gap(1.2rem=24px)이 전담한다 — 여기에 mb 를
          더하면 퍼블이 gap 하나로 잡은 축에 값이 덧붙어 간격이 넓어진다(mb-12 제거). */}
      <div className="result_meta_bar">
        <p className="data_total ty_lg">
          <span className="data_total_tit">검색결과</span> 총{' '}
          <b data-testid="total-count" className="data_total_count">
            {totalCount.toLocaleString()}
          </b>
          건
        </p>
        {/* round07m — 컨트롤 묶음(정렬기준 → 공개여부 → 종류 → 주제)은 ResultFilterControls 가
            그린다. 0건 화면(SearchResults)도 같은 컴포넌트를 써 순서가 구조적으로 같다.
            .result_meta_bar 는 space-between 이라 직계 자식을 늘리지 않고 이 래퍼 하나에 담는다. */}
        {isLive && (
          <div className="result_meta_filters">
            <ResultFilterControls />
          </div>
        )}
        {/* 유형 칩 줄 — 비라이브(더미) 전용. 라이브는 렌더하지 않는다(round04).
            flex-wrap·justify-end는 퍼블 result_meta_filters가 설정하지 않는 속성이라 유지한다. */}
        {!isLive && (
          <div data-testid="type-pills" className="result_meta_filters flex-wrap justify-end">
            {TYPE_PILLS.map((t) => (
              <button
                key={t.key}
                onClick={() => handleTypeFilter(t.key)}
                className={`px-10 py-4 rounded-full text-xs font-medium border transition-colors ${
                  typeFilter === t.key
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-[#5A6173] border-line hover:border-primary-400 hover:bg-primary-50'
                }`}
              >
                {t.label}
                {t.count != null && (
                  <span className="ml-1 opacity-70">{t.count.toLocaleString()}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* result_body — 좌 소장처 필터(라이브: HolderFilterList · 비라이브: 더미 기관 목록) + 우 카드 그룹 */}
      <div className="result_body">
        {/* round07m — 라이브 소장처 목록. 서버 facets.holder 가 비면(결과 0건·구 응답) 그리지
            않는다. 비라이브 분기(아래)는 더미 기관 데이터 전용으로 그대로 둔다. */}
        {isLive && (facets?.holder?.length ?? 0) > 0 && (
          <HolderFilterList options={facets.holder} selected={holder} onSelect={setHolder} />
        )}

        {/* result_filter_list — 퍼블 L184-233. 라이브는 위 HolderFilterList 가 그린다(round07m).
            R6c-ext D1-5b: 퍼블 CSS 반입 후 레이아웃/색 브리지를 걷어냈다. gap-0.5(메뉴)·
            transition-colors·hover:*(비활성 행)는 퍼블이 설정하지 않는 속성이라 유지한다.
            활성 카운트의 font-semibold(600)는 제거했다 — 퍼블 .result_filter_btn.is_active 가
            font-weight:700 을 주고 그 값이 자식 span 으로 상속되므로, 600을 덧대면 라벨(700)과
            숫자(600)의 굵기가 어긋난다. */}
        {!isLive && (
          <div className="result_filter_list">
            <p className="sr_only">기관별 필터</p>
            <ul className="result_filter_list_menu gap-0.5">
              {instOptions.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => handleInstSelect(i.id)}
                    className={`result_filter_btn transition-colors ${
                      instId === i.id
                        ? 'is_active'
                        : 'hover:bg-offwhite hover:text-primary-700'
                    }`}
                  >
                    {i.name}
                    <span className="result_filter_count">
                      {i.count}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* result_card_group — 퍼블 L237-353: 그리드 + (퍼블은 더보기 버튼, 앱은 페이지네이션) */}
        <div className="result_card_group">
          {pagedMaterials.length === 0 ? (
            <EmptyState
              title="검색 결과가 없습니다"
              // round10a A조 최종 리뷰 M-3 — SearchResults.jsx:41의 조기 return 덕에 보통
              // 자료검색 화면에서는 이 isLive 분기 자체에 닿지 않지만, 프로젝트 상세는
              // ResultsTab을 검색창 없이 직접 마운트한다(위 readOnly 선언부 참조). 복원한
              // 검색이 0건이면 "다른 검색어로"는 칠 곳이 없는 안내였다 — 결정 8이 이미
              // SearchResults.jsx에서 고친 것과 같은 종류의 문장이다.
              description={isLive
                ? (hasNonDefaultFilter
                    ? '선택한 조건에 해당하는 자료가 없습니다. 필터를 조정해 보세요.'
                    : readOnly
                      ? '저장된 검색 결과가 없습니다'
                      : '다른 검색어로 다시 시도해 보세요.')
                : '선택한 기관·유형 조건에 해당하는 자료가 없습니다. 필터를 조정해 보세요.'}
              // 라이브에는 "필터 초기화" 버튼을 두지 않는다 — resetFilters는 이 화면의
              // 지역 상태(instId·typeFilter, 비라이브 전용)만 되돌릴 뿐 실제 라이브 필터
              // (sort·visibility·mediaType·subjects·holder)는 그대로다. 누른 그대로인 채
              // "초기화됐다"는 버튼을 두면 이 라운드가 고치는 "눌러도 반응 없다" 병과 같은
              // 모양이 된다 — 필터 조정은 위에 항상 떠 있는 ResultFilterControls로 한다.
              action={isLive ? undefined : { label: '필터 초기화', onClick: resetFilters }}
            />
          ) : (
            <ul className="result_card_grid">
              {/* R6c-ext D1-5b: 그리드 열수는 퍼블 CSS(.result_card_grid: repeat(4, 1fr))가 정한다 —
                  기존 Tailwind grid-cols-5 브리지를 걷어내 퍼블 정본(4열)을 따른다. 페이지당
                  ITEMS_PER_PAGE=20은 4열×5행으로 여전히 정수 행에 맞아떨어진다(라이브 page_size=20 동일). */}
              {pagedMaterials.map((m) => (
                <ResultCard
                  key={m.id}
                  material={m}
                  live={isLive}
                  onOpen={setSelected}
                  downloadDisabled={!(m.hasImage ?? true)}
                  onDownload={() => handleDownload(m)}
                />
              ))}
            </ul>
          )}

          {/* Pagination — 라이브: 서버 total 기준으로 **항상** 렌더하고, 페이지 클릭은
              changePage(서버 캐시 슬라이스 재조회)에 위임한다. round04의 "모두 보기"(showAll)
              중간 단계는 round06f 갈래 A(spec §6.1)에서 폐기했다 — 검색 직후부터 1~10페이지가
              곧바로 보여야 한다는 것이 이 라운드의 요구다(spec §2-1).
              비라이브: 기존 클라이언트 페이지네이션 유지. */}
          {/* 간격은 부모 .result_card_group 의 gap(2rem)이 준다 — 여기에 margin 을 더하면
              퍼블 간격(40px)에 16px 이 덧붙어 56px 이 된다(브라우저 실측, D1-5b 후속).
              래퍼 <div> 도 두지 않는다 — showAll 이 사라진 뒤에도 Pagination 이 안 그려지는
              경우가 남아 있다(totalPages<=1 이면 컴포넌트가 스스로 null 을 반환한다 — 결과가
              한 페이지 분량 이하일 때가 그렇다, R6F-3). 빈 래퍼가 남으면 부모 gap(2rem)이 그
              빈 요소에도 적용돼 결과 하단에 죽은 여백이 생긴다. Pagination 을 직접 자식으로
              두면 안 그려질 때 요소 자체가 없다. */}
          {isLive
            ? <Pagination page={livePage} totalPages={totalPages} onChange={changePage} />
            : <Pagination page={page} totalPages={totalPages} onChange={setPage} />}
        </div>
      </div>

      {/* Material detail modal */}
      <MaterialModal material={selected} onClose={() => setSelected(null)} />
    </>
  )
}
