// 이 파일의 책임: 자료관리 > 데이터 임베딩 관리 화면.
// 퍼블 manage_embedding.html의 data_panel_head + 상태 select 툴바 + 표를 옮기되,
// 승급 대상을 고를 수단이 필요해 체크박스 열 하나를 더한다(spec §8.4).
//
// D2a — "모든 mutation 준비중" 재퍼블. 재시도·다음 단계로 보내기는 mock 상태를 바꾸는
// mutation이라 showToast('준비 중입니다')로 막는다. 상태 필터(select_box)는 mock
// embedding 배열을 client-side로 거를 뿐인 실동작 조회라 그대로 둔다(주의: 실동작 보존).
import { useState } from 'react'
import ManageTabs from '../../components/manage/ManageTabs.jsx'
import EnvGate from '../../components/EnvGate.jsx'
import DataTable from '../../components/DataTable.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import Pagination from '../../components/Pagination.jsx'
import { PAGE_SIZE } from './constants.js'
import { useManage } from '../../state/useManage.js'
import { useToast } from '../../components/useToast.js'

// 퍼블 옵션 4개 중 '재시도'는 상태가 아니라 조작이고 같은 화면 작업 열의 버튼 이름과
// 겹치므로 제외한다(§14 결함 9 · 앞선 라운드에도 같은 제거 이력이 있다).
// 첫 옵션은 '전체'가 아니라 '선택'이고 value는 빈 문자열이다.
const STATUS_OPTIONS = [
  { value: 'done', label: '임베딩 완료', status: '완료' },
  { value: 'fail', label: '임베딩 실패', status: '실패' },
]

// 퍼블 5열(50/15/10/10/15)의 파일명 50%에서 5%를 떼어 체크박스에 준다.
const COL_WIDTHS = ['w-[5%]', 'w-[45%]', 'w-[15%]', 'w-[10%]', 'w-[10%]', 'w-[15%]']

// 순수 로직 — value === ''는 "필터 없음"이다.
function filterRows(rows, value) {
  if (!value) return rows
  const target = STATUS_OPTIONS.find((o) => o.value === value)
  return target ? rows.filter((r) => r.embedding === target.status) : rows
}

export default function Embedding() {
  // promote는 더 이상 쓰지 않는다 — 승급이 준비중 스텁이다.
  const { embedding } = useManage()
  const { showToast } = useToast()
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState([])

  const filtered = filterRows(embedding, filter)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1
  const currentRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleFilterChange(e) {
    setFilter(e.target.value)
    setPage(1)
    setSelectedIds([])
  }
  function toggle(id) {
    setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }
  function toggleAll(checked) {
    setSelectedIds(checked ? currentRows.map((r) => r.id) : [])
  }

  const columns = [
    { key: 'name', label: '파일명', className: 'data_col_name' },
    { key: 'uploadedAt', label: '업로드 일시' },
    { key: 'records', label: '레코드', render: (r) => `${r.records}건` },
    { key: 'embedding', label: '임베딩', render: (r) => <StatusBadge status={r.embedding} /> },
    {
      key: 'action',
      label: '작업',
      // 퍼블은 완료 행을 '—'가 아니라 빈 셀로 둔다.
      render: (r) =>
        r.embedding === '실패' ? (
          <button
            type="button"
            className="btn btn_sm btn_outline"
            onClick={(e) => { e.stopPropagation(); showToast('준비 중입니다') }}
          >
            재시도
          </button>
        ) : null,
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
                <p className="data_panel_tit">데이터 임베딩 관리</p>
                <p className="data_panel_desc">미등록 자료를 업로드하고 AI 학습 데이터로 등록합니다.</p>
              </div>
            </div>

            <div className="data_table_group">
              <div className="data_toolbar">
                <p className="data_total">총 <b>{filtered.length}</b>건</p>
                {/* 이 화면은 툴바 우측이 삭제 버튼이 아니라 상태 필터다.
                    같은 래퍼 안에 [상태 select][다음 단계로 보내기]를 나란히 둔다(spec §8.1-3). */}
                <div className="data_toolbar_actions">
                  <label className="sr_only" htmlFor="embed_filter_status">상태별 선택</label>
                  <div className="select_box">
                    <select id="embed_filter_status" value={filter} onChange={handleFilterChange}>
                      <option value="">선택</option>
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    className="btn btn_outline_primary data_promote_btn"
                    disabled={selectedIds.length === 0}
                    onClick={() => showToast('준비 중입니다')}
                  >
                    다음 단계로 보내기
                  </button>
                </div>
              </div>

              <DataTable
                caption="데이터 임베딩 관리 목록"
                colWidths={COL_WIDTHS}
                columns={columns}
                rows={currentRows}
                selectable
                selectedIds={selectedIds}
                onToggle={toggle}
                onToggleAll={toggleAll}
              />
            </div>

            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        </div>
      </EnvGate>
    </>
  )
}
