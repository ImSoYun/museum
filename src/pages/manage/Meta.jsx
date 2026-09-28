// 이 파일의 책임: 자료관리 > 메타 정보 등록 화면. 퍼블 manage_meta.html의
// template_bar(가로 배너) → 전폭 드롭존 → 6열 표 → 페이지네이션 세로 적층을 옮긴다.
//
// D2a — "모든 mutation 준비중" 재퍼블. 템플릿 다운로드(실 파일 미납품)·업로드·승급·
// 선택삭제·행 클릭(MetaEditModal 편집)을 전부 showToast('준비 중입니다')로 막는다.
// MetaEditModal은 퍼블 node_detail_modal과 무관한 Tailwind 레거시 편집 팝업이라
// 페이지에서 완전히 걷어낸다.
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
import icFileExcel from '../../assets/icons/ic_file_excel.svg'
import icFileJson from '../../assets/icons/ic_file_json.svg'
import icFileXml from '../../assets/icons/ic_file_xml.svg'
import icDownloadDark from '../../assets/icons/ic_download_dark.svg'
import icDownload from '../../assets/icons/ic_download.svg'

const TEMPLATES = [
  { fmt: 'XLS', label: '엑셀 템플릿', icon: icFileExcel },
  { fmt: 'JSON', label: 'JSON 템플릿', icon: icFileJson },
  { fmt: 'XML', label: 'XML 템플릿', icon: icFileXml },
]

// 퍼블 colgroup(manage_meta.html:145~152).
const COL_WIDTHS = ['w-[5%]', 'w-[45%]', 'w-[15%]', 'w-[10%]', 'w-[10%]', 'w-[15%]']

export default function Meta() {
  // promote·addUpload·removeItem·updateMeta는 더 이상 쓰지 않는다 — 넷 다 준비중 스텁이다.
  const { meta } = useManage()
  const { showToast } = useToast()
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState([])

  const totalPages = Math.ceil(meta.length / PAGE_SIZE) || 1
  const pagedRows = meta.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function toggle(id) {
    setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }
  function toggleAll(checked) {
    setSelectedIds(checked ? pagedRows.map((r) => r.id) : [])
  }

  const columns = [
    { key: 'name', label: '파일명', className: 'data_col_name' },
    { key: 'uploadedAt', label: '업로드 일시' },
    // 퍼블 헤더 라벨은 '레코드 수'가 아니라 '레코드'다.
    { key: 'records', label: '레코드', render: (r) => `${r.records}건` },
    // 퍼블은 매핑을 "1,234 / 1,234" 비율로 쓰지만 우리 mock은 어휘 필드다.
    // 수치를 지어낼 수 없으므로 표기 방식(텍스트형)만 맞추고 어휘는 유지한다(spec §8.3).
    { key: 'mapping', label: '매핑', render: (r) => <StatusBadge status={r.mapping} variant="text" /> },
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

      <EnvGate>
        <div className="data_panel">
          <div className="data_panel_body">
            <div className="template_bar">
              <div className="template_bar_txt">
                {/* 퍼블 원문의 "데이터 탬플릿"은 오탈자다(§14 결함 12).
                    D2a: 제목 클래스는 v2가 폐기한 template_bar_tit 대신 공용 section_tit —
                    component.css의 template_bar 그룹 주석 참조(값 동일, 회귀 없음). */}
                <p className="section_tit">데이터 템플릿</p>
                <p className="template_bar_desc">표준 형식에 맞는 템플릿을 사용하세요</p>
              </div>
              <div className="template_bar_list">
                {TEMPLATES.map(({ fmt, label, icon }) => (
                  // 퍼블의 href가 아이콘 SVG 자기 자신을 가리켜 실 템플릿이 미납품이다(§14 결함 11).
                  // href 없는 a는 접근성 트리에서 링크가 아니므로 실파일 수령 전까지 button으로 둔다.
                  // D2a: 실 파일이 없는 "실동작 없는" 다운로드라 문구를 canonical 토스트로 통일한다.
                  <button
                    key={fmt}
                    type="button"
                    className="template_bar_link"
                    onClick={() => showToast('준비 중입니다')}
                  >
                    <img src={icon} alt="" />
                    {label}
                    <img src={icDownloadDark} alt="" />
                  </button>
                ))}
              </div>
            </div>

            <FileDropzone
              id="meta_dropzone"
              // 퍼블 accept는 OCR에서 복사해 온 오류라 메타 파일로 교정한다(§14 결함 3).
              accept=".xlsx,.xls,.json,.xml"
              title="파일을 드래그하거나 클릭하여 업로드"
              desc="xlsx, xls, json, xml 메타 파일 업로드"
              onFiles={() => showToast('준비 중입니다')}
            />

            <div className="data_table_group">
              <div className="data_toolbar">
                <p className="data_total">총 <b>{meta.length}</b>건</p>
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
                caption="메타 정보 등록 목록"
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
