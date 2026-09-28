// 이 파일의 책임: 시스템관리 > 이용로그 화면. 퍼블 admin_log.html의
// data_filter_bar(기간·유형·부서 필터 + 사용자 활동 검색) + data_filter_export_btn
// (엑셀 다운로드) + data_table_group(6열 표)을 옮긴다.
//
// D1-2가 만든 잠정 placeholder를 제자리에서 v2로 재퍼블한다(원장 주입 사항 #1 —
// router.jsx의 /system/log → 이 파일 배선은 불변, 신규 pages/admin/Log.jsx는 만들지
// 않는다).
//
// dropdown_box(상태형 위젯)는 D1-7·D2a 선례대로 스킵하고 네이티브 select(select_box,
// v1 클래스 — DataFilterBar.jsx가 이미 그렇게 구현돼 있다)를 유지한다. 필터 제출·엑셀
// 다운로드는 조회 로직 자체가 없으므로(백엔드 이용로그 API가 이번 라운드 범위 밖)
// D2a Materials.jsx의 "실동작 보존"과 달리 전부 showToast('준비 중입니다')만
// 호출한다.
//
// admin_log.html의 "사용자" 셀(sub_txt로 계정명 병기)·"활동유형" 셀(tag.ty_act_*
// 색상 배지)·data_col_date·data_col_muted는 반입하지 않는다 — component.css의
// [S] tag 그룹 주석이 이미 "등록·역할·활동 변형은 미소비"라고 못박았고, 이번
// 라운드 어떤 과업 파일 목록에도 그 CSS를 반입하는 태스크가 없다(§4 디자인 참조 —
// 미참조 사유). 그래서 이 두 열은 plain text로 표시한다.
//
// 데이터는 최소 정적 배열이다(브리프 Step6 대안 — 별도 data/ 모듈을 새로 만들지
// 않는다). 값은 admin_log.html의 예시 행을 그대로 옮겼다(표시용 mock 유지).
import { useState } from 'react'
import SystemTabs from '../../components/admin/SystemTabs.jsx'
import EnvGate from '../../components/EnvGate.jsx'
import DataFilterBar from '../../components/DataFilterBar.jsx'
import DataTable from '../../components/DataTable.jsx'
import Pagination from '../../components/Pagination.jsx'
import { useToast } from '../../components/useToast.js'

const ROWS_PER_PAGE = 10

const USAGE_LOGS = [
  { id: 'u1', date: '2026-05-10 20:45', user: '김자료', account: 'admin1', dept: '학예연구실', type: '권한설정', detail: 'support1 역할을 일반 관리자로 변경', ip: '10.20.1.14' },
  { id: 'u2', date: '2026-05-10 20:45', user: '김명석', account: 'admin2', dept: '학예연구실', type: '검색', detail: '"민주화운동 국제 연대" 질의', ip: '10.20.1.14' },
  { id: 'u3', date: '2026-05-10 20:45', user: '신규진', account: 'admin3', dept: '자료관리팀', type: '자료관리', detail: '민주화운동_포스터_002.pdf OCR 등록', ip: '10.20.1.14' },
  { id: 'u4', date: '2026-05-10 20:45', user: '박지희', account: 'admin4', dept: '자료관리팀', type: '산출물', detail: '전시 해설문 생성(6월 민주항쟁)', ip: '10.20.1.14' },
  { id: 'u5', date: '2026-05-10 20:45', user: '박지희', account: 'admin4', dept: '학예연구실', type: '로그인', detail: '대시보드 조회 세션 시작', ip: '10.20.1.14' },
]

const FILTER_FIELDS = [
  {
    id: 'log_filter_period', name: 'period', placeholderLabel: '기간',
    options: [
      { value: 'today', label: '오늘' },
      { value: '7d', label: '최근 7일' },
      { value: '30d', label: '최근 30일' },
    ],
  },
  {
    id: 'log_filter_type', name: 'type', placeholderLabel: '유형',
    options: [
      { value: 'login', label: '로그인' },
      { value: 'search', label: '검색' },
      { value: 'output', label: '산출물' },
      { value: 'manage', label: '자료관리' },
      { value: 'auth', label: '권한변경' },
    ],
  },
  {
    id: 'log_filter_dept', name: 'dept', placeholderLabel: '부서',
    options: [
      { value: 'd1', label: '부서명 1' },
      { value: 'd2', label: '부서명 2' },
      { value: 'd3', label: '부서명 3' },
    ],
  },
]

export default function Log() {
  const { showToast } = useToast()
  const [page, setPage] = useState(1)

  const totalPages = Math.ceil(USAGE_LOGS.length / ROWS_PER_PAGE) || 1
  const pagedRows = USAGE_LOGS.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE)

  const columns = [
    { key: 'date', label: '일시' },
    { key: 'user', label: '사용자', render: (r) => `${r.user} (${r.account})` },
    { key: 'dept', label: '부서' },
    { key: 'type', label: '활동유형' },
    { key: 'detail', label: '상세', className: 'data_col_name' },
    { key: 'ip', label: 'IP' },
  ]

  return (
    <>
      <SystemTabs />

      {/* round06f 갈래 E(spec §10.3) — <SystemTabs/>는 게이트 바깥, 본문만 안쪽이다.
          Monitoring.jsx·Nodes.jsx와 같은 배치다. */}
      <EnvGate>
        <div className="data_panel">
          <div className="data_panel_body">
            <div className="flex items-center gap-2">
              <DataFilterBar
                fields={FILTER_FIELDS}
                searchPlaceholder="사용자 활동 검색"
                onSubmit={() => showToast('준비 중입니다')}
              />
              <button
                type="button"
                className="btn btn_md btn_outline_dark data_filter_export_btn"
                onClick={() => showToast('준비 중입니다')}
              >
                엑셀 다운로드
              </button>
            </div>

            <div className="data_table_group">
              <div className="data_toolbar">
                {/* 퍼블 원문(admin_log.html:115)은 "총 5명"이지만 표는 로그 건수를 세는
                    것이지 사람 수가 아니다 — 단위 오기다(Meta.jsx:81 "데이터 탬플릿" 교정과
                    같은 선례). 표시 문구만 "건"으로 교정한다. */}
                <p className="data_total">총 <b>{USAGE_LOGS.length}</b>건</p>
              </div>

              <DataTable caption="이용로그 목록" columns={columns} rows={pagedRows} />
            </div>

            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        </div>
      </EnvGate>
    </>
  )
}
