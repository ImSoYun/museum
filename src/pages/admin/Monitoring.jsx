// 이 파일의 책임: 시스템관리 > 모니터링 화면. 퍼블 admin_dashboard.html의
// stat_card_list(KPI 4장) + data_table_group(실시간 질의 로그)을 옮긴다.
//
// D2b — "모든 액션 준비중" 재퍼블. KPI 클릭·검색 결과 조회·코멘트 열기·기간 선택
// (flatpickr 대체)은 전부 mock 상태를 바꾸지 않고 showToast('준비 중입니다')만
// 호출한다. QueryLogModal·LogCommentModal은 더 이상 이 화면에서 쓰지 않는다(D2b
// 시점엔 "보존만" 했으나, 06f~06b 사이 다른 소비처가 끝내 없었다). QueryLogModal은
// A6(round06b)에서 완전히 제거했다 — LogCommentModal도 같은 이유로 고아이나 A6
// 삭제 목록(task-15-brief.md)에는 없어 파일은 아직 남아 있다(재검증 중 발견,
// round06b 완료노트에 별도 후속 정리 대상으로 보고).
//
// 범위 밖(§4 디자인 참조 — 미참조 사유): 시간대별 사용량(usage_chart)·OCR·번역 학습
// 데이터 처리 현황(progress_stat) 두 패널은 브리프가 지정한 변경 대상(컨테이너·KPI·
// 질의로그 3그룹)에 없다. 대응 v2 CSS 그룹(usage_chart*·progress_stat*)도 이번
// 라운드가 반입하지 않았으므로 기존 Tailwind 구현(HourlyChart·ProgressBar, "학습 이력
// 보기" 실제 네비게이션 포함)을 그대로 둔다 — 이 두 패널만 재퍼블하지 않은 것은
// 누락이 아니라 스코프 결정이다.
//
// flatpickr(기간선택)는 이 라운드 미사용 자산이다(브리프 함정 노트 #6) — 위젯을
// 붙이지 않고 "기간 선택" 버튼(정적 표시)으로 대체해 클릭 시 준비중 토스트만 띄운다.
//
// F4(round06c 배치 리뷰): 계획 Step 4가 명시한 ManagePageHeader("관리자 대시보드") 제거를
// 이 라운드에서 이행하지 못해 남아 있었다 — 퍼블(admin_dashboard.html:24-25)은
// mng_page_tit "시스템관리"(SystemTabs가 렌더) 하나뿐이라 이중 제목이었다. import·렌더
// 모두 제거한다.
//
// F5(round06c 배치 리뷰) — 미참조 사유: 아래 질의 로그 표는 퍼블(admin_dashboard.html:
// 200-259)과 셀 표기가 다르다. 퍼블은 답변평가를 data_status_text(텍스트형)·코멘트를
// 평문 "-"·colgroup 폭 고정·data_toolbar에 총 건수("총 100건")를 두지만, 이 화면은
// 기존 컴포넌트(StatusBadge 알약형·코멘트 열기 버튼)를 그대로 재사용한다 — Log.jsx 등
// 다른 시스템관리 표와의 일관성을 위해서다(코드 변경이 아니라 재사용 유지 결정). 다만
// '번호' 열만은 예외로 퍼블대로 고쳤다 — 이전에는 r.id('q1' 문자열)를 그대로 찍어
// 숫자여야 할 열에 문자열이 나갔다(§14류 결함). numberById로 queryLogs 전체 길이 기준
// 내림차순 숫자를 미리 매핑해 둔다(인덱스 기반 — 페이지네이션과 무관하게 안정).
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SystemTabs from '../../components/admin/SystemTabs.jsx'
import EnvGate from '../../components/EnvGate.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import ProgressBar from '../../components/ProgressBar.jsx'
import DataTable from '../../components/DataTable.jsx'
import HourlyChart from '../../components/HourlyChart.jsx'
import Pagination from '../../components/Pagination.jsx'
import { useToast } from '../../components/useToast.js'
import { dashboard } from '../../data/dashboard.js'
import { queryLogs } from '../../data/queryLogs.js'
import icTrendUp from '../../assets/icons/ic_trend_up.svg'
import icTrendDown from '../../assets/icons/ic_trend_down.svg'

const ROWS_PER_PAGE = 10

// v2 stat_card 마크업은 label+value+compare(방향 delta)만 있고 아이콘 자리가 없다
// (admin_dashboard.html:39-81) — 기존 lucide 아이콘(Activity·Database·Cpu·Search)은
// 옮기지 않는다. compare 문구는 기존 dashboard.js 표시값(전일 대비 등락)을 그대로
// 유지해, 표시용 mock 데이터는 유지한다는 D8 대원칙을 지킨다.
const KPI_CARDS = [
  { testId: 'kpi-today', label: '오늘 질의 수', value: dashboard.todayQueries.toLocaleString(), compare: '전일 대비', delta: '12%', dir: 'up' },
  { testId: 'kpi-indexed', label: '인덱싱 완료', value: String(dashboard.indexed), compare: '전일 대비', delta: '3', dir: 'up' },
  { testId: 'kpi-embedding', label: '임베딩 완료', value: `${dashboard.embeddingRate}%`, compare: '전일 대비', delta: '2%', dir: 'up' },
  { testId: 'kpi-search', label: '오늘 검색 요청', value: String(dashboard.searchRequests), compare: '전일 대비', delta: '1', dir: 'down' },
]

export default function Monitoring() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)

  const totalPages = Math.ceil(queryLogs.length / ROWS_PER_PAGE) || 1
  const pagedRows = queryLogs.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE)

  // F5: id('q1' 등) 대신 퍼블처럼 숫자를 보여준다 — 목록 순서(등록 시간 오름차순)의
  // 반대로 내림차순 매겨 가장 먼저 등록된 행이 가장 큰 번호를 갖는다(총 건수부터
  // 카운트다운). 전체 queryLogs 기준이라 페이지를 넘겨도 번호가 흔들리지 않는다.
  const numberById = new Map(queryLogs.map((r, i) => [r.id, queryLogs.length - i]))

  const columns = [
    { key: 'id', label: '번호', className: 'w-16 text-center', render: (r) => numberById.get(r.id) },
    { key: 'rating', label: '답변 평가', className: 'w-32', render: (r) => <StatusBadge status={r.rating} /> },
    {
      key: 'comment',
      label: '코멘트',
      className: 'w-24 text-center',
      render: (r) => (
        <button
          type="button"
          data-testid={`open-comments-${r.id}`}
          className="btn btn_sm btn_outline"
          onClick={(e) => { e.stopPropagation(); showToast('준비 중입니다') }}
        >
          {(r.comments ?? []).length} 코멘트
        </button>
      ),
    },
    { key: 'registeredAt', label: '질의 등록 시간', className: 'w-40' },
    {
      key: 'action',
      label: '결과 조회',
      className: 'text-center w-28',
      render: (r) => (
        <button
          type="button"
          data-testid={`view-log-${r.id}`}
          className="btn btn_sm btn_outline_primary"
          onClick={(e) => { e.stopPropagation(); showToast('준비 중입니다') }}
        >
          검색 결과
        </button>
      ),
    },
  ]

  return (
    <>
      <SystemTabs />

      {/* round06f 갈래 E(spec §10.3) — <SystemTabs/>는 게이트 **바깥**이다. prod에서도
          탭줄은 그대로 보이고(통합관리자 기준 4탭 — spec §10.4) 본문만 준비중으로
          바뀐다. round06e는 AppShell이 이 화면을 통째로 갈아치워 탭줄까지 지웠는데,
          사용자 요구는 "탭은 두고 눌렀을 때 준비중"이었다(spec §2-5).
          local·dev에서는 EnvGate가 children을 그대로 통과시켜 아래는 무변경이다. */}
      <EnvGate>
        <div className="data_panel">
          <div className="data_panel_body">
            <ul className="stat_card_list">
              {KPI_CARDS.map((c) => (
                <li
                  key={c.testId}
                  className="stat_card"
                  role="button"
                  tabIndex={0}
                  data-testid={c.testId}
                  onClick={() => showToast('준비 중입니다')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showToast('준비 중입니다') }
                  }}
                >
                  <p className="stat_card_label">{c.label}</p>
                  <div className="stat_card_data">
                    <strong className="stat_card_value">{c.value}</strong>
                    <p className="stat_card_compare">
                      {c.compare}
                      <span className={`stat_card_delta ty_${c.dir}`}>
                        <img
                          src={c.dir === 'up' ? icTrendUp : icTrendDown}
                          alt={c.dir === 'up' ? '증가' : '감소'}
                          className="stat_card_delta_icon"
                        />
                        {c.delta}
                      </span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {/* 시간대별 사용량 / OCR·번역 학습 데이터 처리 현황 — 파일 상단 주석 참조(범위 밖). */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-line rounded-xl p-5 shadow-sm">
                <h3 className="text-[14px] font-bold text-ink mb-4">시간대별 사용량</h3>
                <HourlyChart data={dashboard.hourly} height={200} />
              </div>

              <div className="bg-white border border-line rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-[14px] font-bold text-ink">OCR·번역 학습 데이터 처리 현황</h3>
                  <button
                    type="button"
                    data-testid="processing-history-link"
                    onClick={() => navigate('/manage/history')}
                    className="text-xs text-primary-700 hover:underline font-medium"
                  >
                    학습 이력 보기
                  </button>
                </div>

                <div className="flex items-center gap-4 mb-4 text-xs text-[#5A6173]">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-sm bg-ok" />
                    완료
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-sm bg-prog" />
                    학습중
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 rounded-sm bg-bad" />
                    오류
                  </span>
                </div>

                <ProgressBar label="OCR 처리" percent={dashboard.processing.ocr} colorClass="bg-ok" />
                <ProgressBar label="번역 처리" percent={dashboard.processing.translate} colorClass="bg-prog" />
                <ProgressBar label="학습 반영" percent={dashboard.processing.learning} colorClass="bg-bad" />
              </div>
            </div>

            <div className="data_table_group">
              <div className="data_toolbar">
                <p className="section_tit">실시간 질의 로그</p>
                {/* flatpickr 대체 — 정적 표시 버튼, 클릭은 준비중(파일 상단 주석 참조). */}
                <button
                  type="button"
                  className="btn btn_sm btn_outline"
                  data-testid="log-period-select"
                  onClick={() => showToast('준비 중입니다')}
                >
                  기간 선택
                </button>
              </div>

              <DataTable caption="실시간 질의 로그 목록" columns={columns} rows={pagedRows} />
            </div>

            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        </div>
      </EnvGate>
    </>
  )
}
