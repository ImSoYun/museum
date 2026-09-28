// 이 파일의 책임: 자료관리 > 학습 반영 이력 화면.
// 퍼블 manage_history.html의 data_panel_head + data_filter_bar + 7열 표를 옮긴다.
//
// D2a — "모든 mutation 준비중" 재퍼블. 등재(승급)·선택삭제·행 클릭(HistoryViewModal
// 조회)은 전부 showToast('준비 중입니다')로 막는다. HistoryViewModal은 퍼블
// node_detail_modal과 무관한 Tailwind 레거시 팝업이라 페이지에서 걷어낸다. 필터·
// 페이지네이션은 mock history 배열을 client-side로 거를 뿐인 실동작 조회라 보존한다.
import { useState } from 'react'
import ManageTabs from '../../components/manage/ManageTabs.jsx'
import EnvGate from '../../components/EnvGate.jsx'
import DataFilterBar from '../../components/DataFilterBar.jsx'
import DataTable from '../../components/DataTable.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import Pagination from '../../components/Pagination.jsx'
import { PAGE_SIZE } from './constants.js'
import { MANAGERS, learningHistory } from '../../data/learningHistory.js'
import { useManage } from '../../state/useManage.js'
import { useToast } from '../../components/useToast.js'

// 퍼블 옵션(김자료/이관리 · v2.3.1 …)은 퍼블 자신의 더미 표에 맞춘 하드코딩이라
// 우리 mock과 어긋난다. 표가 mock에서 오는 이상 필터 옵션도 같은 출처여야 한다.
// 파생 대상은 라이브 state가 아니라 모듈 상수다 — 승급으로 행이 빠져도 옵션은 그대로 남는다.
const toOptions = (values) => values.map((v) => ({ value: v, label: v }))
const STATUS_VALUES = [...new Set(learningHistory.map((r) => r.status))]
const VERSION_VALUES = [...new Set(learningHistory.map((r) => r.version))].sort().reverse()

const FILTER_FIELDS = [
  // 옵션이 기간 범위가 아니라 정렬 방향이므로 첫 옵션 문구를 '정렬'로 교정한다(§14 결함 6).
  { id: 'history_filter_period', name: 'period', placeholderLabel: '정렬',
    options: [{ value: 'latest', label: '최신순' }, { value: 'oldest', label: '과거순' }] },
  { id: 'history_filter_status', name: 'status', placeholderLabel: '상태', options: toOptions(STATUS_VALUES) },
  { id: 'history_filter_owner', name: 'owner', placeholderLabel: '담당자', options: toOptions(MANAGERS) },
  { id: 'history_filter_version', name: 'version', placeholderLabel: '버전', options: toOptions(VERSION_VALUES) },
]

// 퍼블 colgroup(manage_history.html:160~168).
const COL_WIDTHS = ['w-[5%]', 'w-[15%]', 'w-[30%]', 'w-[10%]', 'w-[15%]', 'w-[15%]', 'w-[10%]']

const EMPTY_FILTER = { period: '', status: '', owner: '', version: '', keyword: '' }

// 순수 로직 — 필터 적용. 빈 문자열은 "조건 없음"이다.
function applyFilter(rows, f) {
  let out = rows
  if (f.status) out = out.filter((r) => r.status === f.status)
  if (f.owner) out = out.filter((r) => r.manager === f.owner)
  if (f.version) out = out.filter((r) => r.version === f.version)
  if (f.keyword) out = out.filter((r) => r.name.includes(f.keyword) || r.manager.includes(f.keyword))
  // mock이 최신순으로 정렬돼 있으므로 '과거순'은 뒤집기만 하면 된다.
  if (f.period === 'oldest') out = [...out].reverse()
  return out
}

export default function History() {
  // promote·removeItem은 더 이상 쓰지 않는다 — 등재·삭제 둘 다 준비중 스텁이다.
  const { history } = useManage()
  const { showToast } = useToast()
  const [filter, setFilter] = useState(EMPTY_FILTER)
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState([])

  const filtered = applyFilter(history, filter)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1
  const pagedRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleFilterSubmit(values) {
    setFilter(values)
    setPage(1)
    setSelectedIds([])
  }
  function toggle(id) {
    setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }
  function toggleAll(checked) {
    setSelectedIds(checked ? pagedRows.map((r) => r.id) : [])
  }

  const columns = [
    { key: 'processedAt', label: '처리 일시' },
    { key: 'name', label: '자료명', className: 'data_col_name' },
    { key: 'records', label: '레코드', render: (r) => `${r.records}건` },
    // 퍼블 헤더 라벨은 '상태'가 아니라 '처리상태'이고 표기는 텍스트형이다.
    { key: 'status', label: '처리상태', render: (r) => <StatusBadge status={r.status} variant="text" /> },
    { key: 'manager', label: '담당자' },
    // 퍼블에 font-mono가 없으므로 평문으로 둔다. 미반영 행은 '-'.
    { key: 'version', label: '버전', render: (r) => r.version || '-' },
  ]

  return (
    <>
      <ManageTabs />

      <EnvGate>
        <div className="data_panel">
          <div className="data_panel_body">
            <div className="data_panel_head">
              <div>
                <p className="data_panel_tit">학습 데이터 반영 이력</p>
                <p className="data_panel_desc">AI 모델에 반영된 자료 처리 이력</p>
              </div>
            </div>

            <DataFilterBar fields={FILTER_FIELDS} onSubmit={handleFilterSubmit} />

            <div className="data_table_group">
              <div className="data_toolbar">
                <p className="data_total">총 <b>{filtered.length}</b>건</p>
                <div className="data_toolbar_actions">
                  {/* 현행 "자료관리로 등재"를 5화면 공통 문구로 통일한다. D2a: 등재는 mutation이라
                      준비중 스텁 — "반영 완료 항목만" 자격 검사는 promote 자체가 없어져 무의미해져
                      지웠다(선택과 무관하게 항상 같은 토스트). */}
                  <button
                    type="button"
                    className="btn btn_outline_primary data_promote_btn"
                    disabled={selectedIds.length === 0}
                    onClick={() => showToast('준비 중입니다')}
                  >
                    다음 단계로 보내기
                  </button>
                  <button
                    type="button"
                    className="btn btn_primary data_delete_btn"
                    disabled={selectedIds.length === 0}
                    onClick={() => showToast('준비 중입니다')}
                  >
                    <span className="data_delete_count">{selectedIds.length}</span>
                    <span className="data_delete_label">선택삭제</span>
                  </button>
                </div>
              </div>

              <DataTable
                caption="학습 데이터 반영 이력 목록"
                colWidths={COL_WIDTHS}
                columns={columns}
                rows={pagedRows}
                selectable
                selectedIds={selectedIds}
                onToggle={toggle}
                onToggleAll={toggleAll}
                onRowClick={() => showToast('준비 중입니다')}
              />
            </div>

            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        </div>
      </EnvGate>
    </>
  )
}
