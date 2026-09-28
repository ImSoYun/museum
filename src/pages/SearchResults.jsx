// 이 파일의 책임: 검색결과 화면의 **본문**(result_wrap) — 로딩 스피너 + 라이브 상태 분기 +
// 결과 그리드(ResultsTab)를 그린다.
//
// round06c-ext D1-5: 상단 검색바(result_query_bar)·하위 탭(page_tabs)은 이제 공용 셸
// SearchFlowLayout(D1-3)이 그린다. 그래서 여기서 SearchBar·Tabs·`프로젝트로 저장`·
// SaveProjectModal 을 걷어냈다(저장=라이브러리 준비중이라 헤더 자체 폐기). 탭 전환도
// 형제 라우트(/search/{results,chat,output})로 옮겨갔으므로 여기서 chat/output을 렌더하지
// 않는다 — 이 파일은 오직 /search/results 본문이다.
//
// round06f 갈래 B·C — D10 미렌더 계약(ai_brief_card·rating_widget 미이식)이 모두 해제됐다.
// 퍼블 .result_wrap 직계 자식 순서(브리핑 → 메타바 → 결과 → 만족도)를 이 파일이 소유하므로
// 두 컴포넌트 모두 여기서 마운트한다(spec §7.5.2). ResultsTab 안에 넣지 않는
// 이유는 그것이 비라이브(더미) 경로에서도 렌더돼 순서를 보존하지 못하기 때문이다.
import ResultsTab from './results/ResultsTab.jsx'
import AiBriefCard from './results/AiBriefCard.jsx'
import RatingWidget from './results/RatingWidget.jsx'
import ResultFilterControls from './results/ResultFilterControls.jsx'
import Spinner from '../components/Spinner.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { useScenario } from '../context/ScenarioContext.jsx'

// 라이브 검색결과 — status/liveResults 조합에 따라 결과/안내를 분기한다(round4).
// 우선순위: error(오류 안내) → 결과 0건(무결과 안내, status 무관) → degraded면 결과+notice 배너 → ok면 결과만.
function LiveResultsPanel({ liveStatus, liveResults, liveNotice }) {
  // round06f 갈래 C(R6F-22) — 만족도 폼의 리마운트 키. request_id 는 HTTP 요청 1건당 새
  // uuid 라 페이지를 넘기는 순간 폼이 리셋되고 제출 후 감사 상태가 사라진다(§8.3의 유일한
  // 중복 방어선이 무너진다). 그래서 "검색이 바뀌었는가"만 세는 searchGenId 를 쓴다.
  // 이 훅은 아래 조기 return 들보다 반드시 위에 있어야 한다(훅 호출 순서 고정).
  // 최종 전체 브랜치 리뷰 I-1 — sort·visibility 도 여기서 함께 읽는다. 결과 0건
  // 분기(아래)가 필터를 되돌릴 셀렉트를 그릴지 판단하는 데 쓴다.
  const { searchGenId, sort, visibility, subjects, mediaType, holder, setHolder } = useScenario()

  if (liveStatus === 'error') {
    return (
      <EmptyState
        title="검색 중 오류가 발생했습니다"
        description={liveNotice || '잠시 후 다시 시도해 주세요.'}
      />
    )
  }
  if (!liveResults || liveResults.length === 0) {
    // 최종 전체 브랜치 리뷰 I-1 — 정렬·공개필터가 기본값이 아닌 채 결과가 0건이 되면,
    // 종전에는 이 EmptyState가 화면 전체를 갈아치워 그 필터를 되돌릴 셀렉트(ResultFilterControls,
    // 원래 ResultsTab 안에서만 렌더된다)까지 함께 사라졌다. 남는 길은 새 검색뿐인데
    // ScenarioContext.runLiveSearch가 새 검색마다 정렬·필터를 서버 기본값(relevance/all)으로
    // 리셋해 버려 막다른 길이었다. 필터가 걸려 있을 때만 셀렉트를 여기 함께 그려 되돌릴
    // 길을 남긴다.
    // ⚠️ 필터가 기본값인 "검색어 자체가 일치하는 자료가 없는" 경우는 되돌릴 것이 없다 —
    // 이때는 셀렉트 없이 기존 그대로의 빈 화면을 유지한다(회귀 방지).
    // round07m — 종류·소장처·주제로도 0건이 된다. 그 셋이 걸려 있어도 되돌릴 길을 남긴다.
    const hasNonDefaultFilter = sort !== 'relevance' || visibility !== 'all'
      || mediaType != null || holder != null || (subjects?.length ?? 0) > 0
    return (
      <>
        {hasNonDefaultFilter && (
          <div className="result_meta_bar">
            {/* round07m — ResultsTab 과 같은 컨트롤 묶음(ResultFilterControls)을 쓴다. 두 자리의
                순서를 따로 적던 round07h 방식을 컴포넌트 하나로 합쳤다. 0건 화면에는 왼쪽
                소장처 목록이 없으므로, 소장처가 걸려 있으면 해제 버튼 하나를 둔다(spec §3.3). */}
            <div className="result_meta_filters">
              <ResultFilterControls />
              {holder != null && (
                <button type="button" className="btn btn_md btn_outline" onClick={() => setHolder(null)}>
                  소장처 필터 해제
                </button>
              )}
            </div>
          </div>
        )}
        {/* 최종 전체 브랜치 리뷰 I-2 — 백엔드가 보강 조회 실패로 채운 notice
            ("일시적으로 정렬·필터를 적용하지 못했습니다…")를 이 분기가 그동안 완전히
            버렸다(EmptyState는 description 인자로만 안내를 받는데 호출부가 liveNotice를
            넘기지 않았다). status==='degraded' 조건의 배너(아래 정상 결과 분기)는 애초에
            이 조기 return 뒤에만 있어 결과 0건에는 닿지 않는다 — 그래서 description
            자체에 liveNotice를 태운다.

            round10a Task 3-C — 라이브 재현: 「새마을운동 포스터」200건 → 종류에서
            이미지 선택 → 0건인데 안내는 "다른 검색어로 다시 시도해 보세요"였다.
            검색어가 잘못된 게 아니라 필터가 좁힌 것이라 엉뚱한 곳을 가리켰다.
            바로 위 hasNonDefaultFilter 로 이미 되돌릴 셀렉트를 그리면서도 문구는
            그 판정을 보지 않았던 것 — 이제 같은 판정을 문구에도 쓴다. liveNotice가
            있으면 그것이 여전히 최우선이다(필터 안내로 덮지 않는다). */}
        <EmptyState
          title="검색 결과가 없습니다"
          description={liveNotice || (hasNonDefaultFilter
            ? '선택한 조건에 해당하는 자료가 없습니다. 필터를 조정해 보세요.'
            : '다른 검색어로 다시 시도해 보세요.')}
        />
      </>
    )
  }
  return (
    <>
      {liveStatus === 'degraded' && liveNotice && (
        <div
          data-testid="live-notice-banner"
          className="mb-3 px-3 py-2 rounded-lg bg-warn-bg text-warn text-[12.5px] font-medium"
        >
          {liveNotice}
        </div>
      )}
      {/* round06f 갈래 B — 퍼블 순서상 브리핑이 메타바(ResultsTab)보다 위다.
          카드 자체가 briefStatus 로 렌더 여부를 정하므로(loading·ok 에서만 그린다)
          여기에는 조건을 두지 않는다 — 판정을 두 곳에 두면 갈라진다. */}
      <AiBriefCard />
      <ResultsTab />
      {/* round06f 갈래 C — 퍼블 .result_wrap 직계 자식 순서의 마지막이 만족도 위젯이다.
          key 에 searchGenId 를 걸어 새 검색·기록 재개에서만 폼이 초기화되게 한다(R6F-22). */}
      <RatingWidget key={searchGenId} />
    </>
  )
}

export default function SearchResults() {
  const {
    activeScenario, matched, isLive, loading, loadingKind,
    liveStatus, liveResults, liveNotice,
  } = useScenario()

  return (
    // result_wrap: 셸(SearchFlowLayout)의 page_tabs 아래에 붙는 흰 패널. R6c-ext D1-5b에서
    // 퍼블 CSS(.result_wrap: flex-column·gap 1.2rem·padding 1.2rem·아랫모서리 라운드·흰 배경·
    // 그림자)를 반입했으므로 이를 중복하던 Tailwind 브리지(bg-white·rounded-b-xl·shadow-sm·p-16)를
    // 걷어낸다.
    <div className="result_wrap ">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Spinner size={32} />
          {/* round06f R6F-26(spec §5) — 로딩 원인별 문구 분기. 최초 검색만 "검색 중…"이고
              그 외(기록 재개·페이지 이동·필터 변경)는 "불러오는 중…"이다(ScenarioContext의
              loadingKind — 진입부마다 그 값을 명시로 정한다). */}
          <p className="text-sm text-[#8A90A2]">{loadingKind === 'search' ? '검색 중…' : '불러오는 중…'}</p>
        </div>
      ) : (
        <>
          {/* 결과 헤더: 활성 시나리오 명칭(폴백 출처 표기) — 더미(데모) 전용 줄이다.
              round06f 갈래 A(spec §6.1): 라이브 "모두 보기" 버튼을 폐기했다. 검색 직후부터
              1~10페이지가 곧바로 보여야 한다는 것이 이 라운드의 요구이고(spec §2-1), 서버는
              이미 20건 × 최대 10페이지로 응답하므로(SEARCH_MAX 200 ÷ SEARCH_PAGE_SIZE 20)
              중간 단계가 필요 없다. 페이지네이션 렌더는 ResultsTab이 전담한다.
              버튼이 빠지면서 라이브에서 이 래퍼의 자식이 0개가 됐다 — 조건 없이 두면
              mb-3(=16px)만 남은 빈 div가 결과 상단에 죽은 여백을 만든다. 그래서 래퍼째
              !isLive 로 감싼다(라이브 검색은 추천 질의가 하단에 있어 기본 시나리오 라벨을
              노출하지 않으므로, 라이브에는 이 줄에 그릴 것이 애초에 없다).
              총 건수("총 N건")는 ResultsTab의 total-count가 담당한다. */}
          {!isLive && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[12px] text-[#8A90A2]">컬렉션</span>
              <span
                data-testid="scenario-name"
                className="text-[12.5px] font-bold text-primary-700 bg-primary-100 rounded-md px-4 py-4"
              >
                {activeScenario.label}
              </span>
            </div>
          )}

          {/* 무매칭(폴백) 안내 — 비라이브 전용. 라이브는 LiveResultsPanel이 상태별 안내를 전담한다. */}
          {!isLive && !matched && (
            <EmptyState
              title="정확히 일치하는 자료를 찾지 못했습니다"
              description={`입력하신 검색어와 일치하는 컬렉션이 없어 대표 컬렉션 ‘${activeScenario.label}’을(를) 보여드립니다.`}
            />
          )}

          {isLive
            ? <LiveResultsPanel liveStatus={liveStatus} liveResults={liveResults} liveNotice={liveNotice} />
            : <ResultsTab />}
        </>
      )}
    </div>
  )
}
