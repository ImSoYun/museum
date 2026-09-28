// 이 파일의 책임: 자료관리 > 자료관리(전체 목록) 화면.
// 퍼블 manage_list.html의 data_panel_head + data_filter_bar(select 2) + 6열 표를 옮긴다.
// 라우트 경로 /manage/materials는 그대로 둔다 — 퍼블 파일명은 정적 산출물 이름일 뿐이다.
//
// D2a — "모든 mutation 준비중" 재퍼블. D8 대원칙의 "실동작 없는" 한정은 필터·검색·
// 페이지네이션에는 적용되지 않는다 — 이들은 mock materials 배열을 그대로 client-side로
// 거를 뿐인 실동작 조회이므로(applyFilter) 그대로 살려 둔다(주의: 실동작 보존).
// 반면 상세보기/수정하기는 계획서 Step 3·수용기준이 명시적으로 "상세/수정" 쌍을
// showToast('준비 중입니다') 대상으로 못박았고, 그 진입점이 열던 ManageDetailModal은
// 편집 모드에서 실제 updateItem을 호출하는 Tailwind 레거시 팝업(퍼블 node_detail_modal과
// 무관한 구조)이라 두 버튼 모두 토스트로 막고 모달 자체를 페이지에서 걷어냈다
// (ManageDetailModal.jsx 파일 자체는 A6(round06b)에서 완전히 삭제했다 — 어떤 라우트도
// 참조하지 않는 고아로 남아 있었으나 재검증 결과 다른 소비처가 끝내 없어 제거).
// 선택삭제도 동일하게 토스트로 막되 체크박스 선택 UI(selectedIds)는 표시상 유지한다.
import { useState } from 'react'
import ManageTabs from '../../components/manage/ManageTabs.jsx'
import EnvGate from '../../components/EnvGate.jsx'
import DataFilterBar from '../../components/DataFilterBar.jsx'
import DataTable from '../../components/DataTable.jsx'
import Pagination from '../../components/Pagination.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import { PAGE_SIZE } from './constants.js'
import { MANAGERS } from '../../data/learningHistory.js'
import { useManage } from '../../state/useManage.js'
import { useToast } from '../../components/useToast.js'

const FILTER_FIELDS = [
  // 옵션이 기간 범위가 아니라 정렬 방향이므로 첫 옵션 문구를 '정렬'로 교정한다(§14 결함 6).
  { id: 'mng_filter_period', name: 'period', placeholderLabel: '정렬',
    options: [{ value: 'latest', label: '최신순' }, { value: 'oldest', label: '과거순' }] },
  // 퍼블 하드코딩(김자료/이관리/박학예) 대신 mock의 담당자 풀에서 파생시킨다.
  { id: 'mng_filter_owner', name: 'owner', placeholderLabel: '담당자',
    options: MANAGERS.map((m) => ({ value: m, label: m })) },
]

// 퍼블 colgroup(manage_list.html:139~146).
const COL_WIDTHS = ['w-[5%]', 'w-[15%]', 'w-[45%]', 'w-[10%]', 'w-[10%]', 'w-[15%]']

const EMPTY_FILTER = { period: '', owner: '', keyword: '' }

// 순수 로직 — 현행 query가 name·manager 양쪽을 훑던 동작을 그대로 유지한다.
// 그래서 퍼블에 없는 '검색 항목' select를 지워도 기능 손실이 0이다.
function applyFilter(rows, f) {
  let out = rows
  if (f.owner) out = out.filter((r) => r.manager === f.owner)
  if (f.keyword) out = out.filter((r) => r.name.includes(f.keyword) || r.manager.includes(f.keyword))
  if (f.period === 'oldest') out = [...out].reverse()
  return out
}

export default function Materials() {
  // removeItem·updateItem은 여기서 더 이상 쓰지 않는다 — 삭제·수정 둘 다
  // showToast 준비중 스텁이라 mock 상태를 바꿀 경로가 아예 없다.
  const { materials } = useManage()
  const { showToast } = useToast()
  const [filter, setFilter] = useState(EMPTY_FILTER)
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState([])

  const filtered = applyFilter(materials, filter)
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
    // 퍼블은 알약이 아니라 평문 "890건"이다.
    { key: 'records', label: '레코드', render: (r) => `${r.records}건` },
    { key: 'manager', label: '담당자' },
    {
      key: 'action',
      label: '작업',
      render: () => (
        <div className="data_col_actions">
          <button
            type="button"
            className="btn btn_sm btn_outline"
            onClick={(e) => { e.stopPropagation(); showToast('준비 중입니다') }}
          >
            상세보기
          </button>
          <button
            type="button"
            className="btn btn_sm btn_outline_primary"
            onClick={(e) => { e.stopPropagation(); showToast('준비 중입니다') }}
          >
            수정하기
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      <ManageTabs />

      <EnvGate>
        <div className="data_panel">
          <div className="data_panel_body">
            <div className="data_panel_head">
              <div>
                <p className="data_panel_tit">자료관리</p>
                <p className="data_panel_desc">전체 자료를 검색/수정/삭제 관리합니다.</p>
              </div>
            </div>

            <DataFilterBar fields={FILTER_FIELDS} onSubmit={handleFilterSubmit} />

            <div className="data_table_group">
              <div className="data_toolbar">
                <p className="data_total">총 <b>{filtered.length}</b>건</p>
                {/* 이 화면에는 승급 대상이 없다(파이프라인 종점). 삭제 버튼만 래퍼에 담아
                    다른 네 화면과 툴바 구조를 같게 유지한다. */}
                <div className="data_toolbar_actions">
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

              {/* 퍼블은 0건 상태를 납품하지 않았다. 검색 결과가 비었을 때 빈 표만 남는 것은
                  실사용에서 후퇴이므로 EmptyState를 유지한다(spec §8.6 · §13 U-22). */}
              {filtered.length === 0 ? (
                <EmptyState
                  title="일치하는 자료가 없습니다"
                  description={`'${filter.keyword}' 검색 결과가 없습니다.`}
                />
              ) : (
                <DataTable
                  caption="전체 자료 목록"
                  colWidths={COL_WIDTHS}
                  columns={columns}
                  rows={pagedRows}
                  selectable
                  selectedIds={selectedIds}
                  onToggle={toggle}
                  onToggleAll={toggleAll}
                />
              )}
            </div>

            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        </div>
      </EnvGate>
    </>
  )
}
