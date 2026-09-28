// 이 파일의 책임: 자료관리 > 유물자료 OCR 화면. 퍼블 manage_ocr.html의
// data_panel_body(드롭존 + 7열 표 + 페이지네이션)를 그대로 옮긴다.
//
// D2a — "모든 mutation 준비중" 재퍼블. 업로드·다음 단계로 보내기·선택삭제·다운로드는
// 전부 mock 상태를 바꾸거나(승급·삭제·업로드) 실제로 아무 파일도 없는(다운로드) 동작이라
// showToast('준비 중입니다')로 막는다. 표 표시·페이지네이션·드롭존의 드래그/포커스
// 시각 상태(FileDropzone 자체 state)는 조회/표시일 뿐이라 그대로 둔다.
import { useState } from 'react'
import ManageTabs from '../../components/manage/ManageTabs.jsx'
import EnvGate from '../../components/EnvGate.jsx'
import DataTable from '../../components/DataTable.jsx'
import FileDropzone from '../../components/FileDropzone.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import Pagination from '../../components/Pagination.jsx'
import { PAGE_SIZE } from './constants.js'
import { useManage } from '../../state/useManage.js'
import { useToast } from '../../components/useToast.js'
import icDownload from '../../assets/icons/ic_download.svg'

// 퍼블 colgroup(manage_ocr.html:119~127). 체크박스 열을 포함한 7열.
const COL_WIDTHS = ['w-[5%]', 'w-[30%]', 'w-[15%]', 'w-[10%]', 'w-[20%]', 'w-[10%]', 'w-[10%]']

export default function Ocr() {
  // promote·addUpload·removeItem은 더 이상 쓰지 않는다 — 세 동작 모두 준비중 스텁이다.
  const { ocr } = useManage()
  const { showToast } = useToast()
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState([])

  const totalPages = Math.ceil(ocr.length / PAGE_SIZE) || 1
  const pagedRows = ocr.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function toggle(id) {
    setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }
  function toggleAll(checked) {
    setSelectedIds(checked ? pagedRows.map((r) => r.id) : [])
  }

  const columns = [
    { key: 'name', label: '파일명', className: 'data_col_name' },
    { key: 'uploadedAt', label: '업로드 일시' },
    { key: 'ocrStatus', label: 'OCR 상태', render: (r) => <StatusBadge status={r.ocrStatus} /> },
    {
      key: 'extractPreview',
      label: '추출 텍스트 미리보기',
      className: 'data_col_name',
      render: (r) => r.extractPreview ?? '—',
    },
    // 4번 열과 같은 낱말이지만 퍼블은 여기만 텍스트형이다(실측 manage_ocr.html:156).
    { key: 'translateStatus', label: '번역', render: (r) => <StatusBadge status={r.translateStatus} variant="text" /> },
    {
      key: 'download',
      label: '다운로드',
      render: () => (
        <button
          type="button"
          className="data_table_dl_btn icon_btn"
          aria-label="다운로드"
          onClick={(e) => { e.stopPropagation(); showToast('준비 중입니다') }}
        >
          <img src={icDownload} alt="" />
        </button>
      ),
    },
  ]

  return (
    <>
      <ManageTabs />

      {/* A8(round06b 갈래) — <ManageTabs/>는 게이트 바깥, 본문만 안쪽이다.
          Log.jsx·Monitoring.jsx와 같은 배치. */}
      <EnvGate>
        <div className="data_panel">
          <div className="data_panel_body">
            <FileDropzone
              id="ocr_dropzone"
              accept=".pdf,.jpg,.jpeg"
              title="파일을 드래그하거나 클릭하여 업로드"
              desc="pdf, jpg 문서 및 이미지 파일 업로드"
              onFiles={() => showToast('준비 중입니다')}
            />

            <div className="data_table_group">
              <div className="data_toolbar">
                <p className="data_total">총 <b>{ocr.length}</b>건</p>
                {/* 퍼블 툴바는 2요소(space-between)다. 승급 버튼을 추가하되
                    래퍼로 묶어 직계 자식 수를 2개로 유지한다(spec §8.1). */}
                <div className="data_toolbar_actions">
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
                caption="유물자료 OCR 목록"
                colWidths={COL_WIDTHS}
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
