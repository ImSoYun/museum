// 이 파일의 책임: 시스템관리 > 노드관리 화면. 퍼블 admin_node.html의
// node_setting_bar(검색) + data_table_group(선택삭제·클러스터링 기준 추가 + 6열 표)을 옮긴다.
//
// D2b — "모든 액션 준비중" 재퍼블. 검색·클러스터링 기준 추가·선택삭제·활성 토글·수정은
// 전부 mock 상태를 바꾸지 않고 showToast('준비 중입니다')만 호출한다. useAdmin()의
// toggleActive·removeCriteria는 이 화면 어디서도 호출되지 않는다(criteria만 읽기 전용
// 소비). AddPromptModal.jsx·ConfirmDialog는 더 이상 이 화면에서 쓰지 않는다
// (AddPromptModal.jsx 파일은 삭제하지 않는다 — ManageDetailModal.jsx가 남긴 선례를
// 인용했었으나, ManageDetailModal.jsx 자체는 A6(round06b)에서 완전히 삭제했다. 그
// 선례가 사라졌으므로 AddPromptModal.jsx는 A6 범위 밖에서 발견된 별도 고아다 —
// A6 삭제 목록(task-15-brief.md)에는 없어 이 태스크에서는 건드리지 않고 round06b
// 완료노트에 후속 정리 대상으로 보고한다. ConfirmDialog.jsx는 다른 화면이 계속
// 쓰므로 당연히 유지).
//
// v2 admin_node.html의 표는 [체크박스·등록일·노드 제목·프롬프트·담당자·활성 상태]
// 6열뿐이고 별도 "편집" 열이 없다. 그런데도 이 화면은 "편집" 열을 유지한다 — 원장
// 주입 사항이 명시적으로 "수정 링크"를 준비중 대상으로 못박았고(값 없는 행 클릭보다
// 식별 가능한 버튼이 그 문구에 더 충실하다), 기존 앱에 이미 있던 행별 수정 진입점을
// 완전히 없애면 "행을 고칠 방법이 아예 없다"는 기능 후퇴로 읽히기 때문이다(§4 디자인
// 참조 — 미참조 사유). 나머지 5열 순서·라벨은 v2 그대로다.
//
// node_setting_bar 검색 input은 실동작 필터가 없다(D2a Materials.jsx의 "실동작 보존"과
// 다른 결정 — 원장 주입 사항이 "검색"을 명시적으로 준비중 대상에 포함했다). 타이핑은
// 시각적으로 되지만 Enter(제출 제스처)에서만 토스트가 뜬다 — 매 키 입력마다 토스트를
// 띄우면 스팸이 되므로 그렇게 하지 않는다.
import { useState } from 'react'
import SystemTabs from '../../components/admin/SystemTabs.jsx'
import EnvGate from '../../components/EnvGate.jsx'
import DataTable from '../../components/DataTable.jsx'
import ToggleSwitch from '../../components/ToggleSwitch.jsx'
import Pagination from '../../components/Pagination.jsx'
import { useAdmin } from '../../state/useAdmin.js'
import { useToast } from '../../components/useToast.js'

const ROWS_PER_PAGE = 10

export default function Nodes() {
  // toggleActive·removeCriteria는 더 이상 쓰지 않는다 — 두 동작 모두 준비중 스텁이다.
  const { criteria } = useAdmin()
  const { showToast } = useToast()
  const [selectedIds, setSelectedIds] = useState([])
  const [page, setPage] = useState(1)

  const totalPages = Math.ceil(criteria.length / ROWS_PER_PAGE) || 1
  const pagedRows = criteria.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE)

  const toggle = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const toggleAll = (checked) => setSelectedIds(checked ? pagedRows.map((r) => r.id) : [])

  const columns = [
    { key: 'createdAt', label: '등록일', className: 'w-36' },
    { key: 'title', label: '노드 제목', className: 'w-36' },
    { key: 'prompt', label: '프롬프트' },
    { key: 'manager', label: '담당자', className: 'w-24' },
    {
      key: 'edit',
      label: '편집',
      className: 'w-20 text-center',
      render: (r) => (
        <button
          type="button"
          data-testid={`edit-criterion-${r.id}`}
          className="btn btn_sm btn_outline"
          onClick={(e) => { e.stopPropagation(); showToast('준비 중입니다') }}
        >
          수정
        </button>
      ),
    },
    {
      key: 'active',
      label: '활성 상태',
      className: 'w-28 text-center',
      render: (r) => (
        <ToggleSwitch
          checked={r.active}
          onChange={() => showToast('준비 중입니다')}
          aria-label={`활성 토글 ${r.id}`}
          data-testid={`toggle-${r.id}`}
        />
      ),
    },
  ]

  return (
    <>
      <SystemTabs />

      {/* round06f 갈래 E(spec §10.3) — <SystemTabs/>는 게이트 바깥, 본문만 안쪽이다.
          Monitoring.jsx·Log.jsx와 같은 배치다(세 화면이 같은 구조라 같은 처리를 한다). */}
      <EnvGate>
        <div className="data_panel">
          <div className="data_panel_body">
            <form
              className="node_setting_bar"
              onSubmit={(e) => { e.preventDefault(); showToast('준비 중입니다') }}
            >
              <label className="node_setting_label" htmlFor="node_setting_input">노드 사용자 설정</label>
              <input
                type="text"
                id="node_setting_input"
                className="node_setting_bar_input"
                placeholder="사용자 설정"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); showToast('준비 중입니다') }
                }}
              />
            </form>

            <div className="data_table_group">
              <div className="data_toolbar">
                <p className="data_total">총 <b>{criteria.length}</b>건</p>
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
                  <button
                    type="button"
                    className="btn btn_primary data_add_btn"
                    data-testid="open-add-prompt"
                    onClick={() => showToast('준비 중입니다')}
                  >
                    클러스터링 기준 추가
                  </button>
                </div>
              </div>

              <DataTable
                caption="노드 사용자 설정 목록"
                columns={columns}
                rows={pagedRows}
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
