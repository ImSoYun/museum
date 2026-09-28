/**
 * Accounts.jsx — 시스템관리 > 계정·권한 탭 화면(round06c-ext Task E4, 계획 §Task E4).
 *
 * 관리자·통합관리자(root 포함)가 자기 **직속 하위 티어** 계정의 승인/거절(승인요청),
 * 차단/임시비밀번호 발급(활성화), 차단해제/삭제/임시비밀번호 발급(차단중)을 관리한다.
 * 대상이 직속 하위인지는 전부 백엔드(museum/admin/routes.py)가 판정한다 — 이 화면은
 * 판단을 하지 않고 adminApi(E1)가 돌려주는 결과를 그대로 보여준다. actionable()의
 * "인접 티어만" 필터·본인 제외는 어디까지나 프론트 이중 방어(round06c root 자기잠금
 * 수리와 같은 원리)이고, 실제 스코프 강제는 항상 백엔드다.
 *
 * 구 `/approvals`(AccountApprovals.jsx)를 대체한다(round06c-ext D1-2가 라우트를
 * `/system/accounts`로 이관, 이 태스크(E4)가 화면 자체를 교체) — 구 AccountApprovals.jsx는
 * A6(round06b)에서 완전히 삭제했다(어떤 라우트도 참조하지 않는 고아로 남아 있었으나,
 * 재검증 결과 다른 소비처가 끝내 없어 제거).
 *
 * 파괴적(거절=신청 삭제·삭제·차단) 액션과 임시비밀번호 발급은 즉시 실행하지 않고
 * ConfirmDialog로 한 번 더 확인한다(구 AccountApprovals.jsx·Nodes.jsx 관행 이식). 임시
 * 비밀번호는 resetPassword 응답에 **1회만** 실리고 화면(모달)에 노출한 뒤에는 어디에도
 * 저장하지 않는다(§0 R2.4).
 *
 * reject/delete는 백엔드에서 행 자체를 DELETE하는 삭제 시맨틱이라(adminApi.js 도크스트링)
 * 갱신된 user를 돌려주지 않는다 — 그래서 성공(200) 후에는 로컬 상태를 patch하지 않고
 * load()로 다시 조회해 행 제거를 반영한다. 승인/차단/차단해제/임시비번도 같은 재조회
 * 경로로 통일한다(코드 경로 단일화 — 계획 Step6).
 */
import { useCallback, useEffect, useState } from 'react'
import SystemTabs from '../../components/admin/SystemTabs.jsx'
import DataTable from '../../components/DataTable.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import Spinner from '../../components/Spinner.jsx'
import Button from '../../components/Button.jsx'
import Modal from '../../components/Modal.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import { useToast } from '../../components/useToast.js'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  listAccounts, approveUser, rejectUser, disableUser, unblockUser, deleteUser, resetPassword,
  subordinateRolesAll, directSubordinateRole,
} from '../../lib/adminApi.js'

const STATUS_OPTIONS = [
  { value: '', label: '전체' }, { value: 'pending', label: '승인요청' },
  { value: 'approved', label: '활성화' }, { value: 'disabled', label: '차단중' },
]
const STATUS_LABEL = { pending: '승인요청', approved: '활성화', disabled: '차단중' }
const fmtDt = (v) => (v ? String(v).replace('T', ' ').slice(0, 16) : '-')
// 시각: 승인요청=created_at / 차단중=blocked_at /
// 활성화=approved_at(+ unblocked_at 있으면 병기, spec §5.5 · plan 검토정정 [E4]).
//
// round06c 최종 리뷰 must-fix I-3 — 이전 구현(unblocked_at || approved_at 단일표시)은
// plan 검토정정이 명시적으로 금지한 형태였다("단일표시 금지"). 구현자가 plan 본문 Step3의
// 예시 코드(검토정정 이전 버전)를 그대로 따른 것이 원인이었다 — 검토정정이 본문보다
// 우선한다. 차단이력이 있는 계정(활성화←차단해제)은 언제 승인됐는지와 언제 차단해제됐는지
// 둘 다 감사 추적 관점에서 의미가 달라 병기해야 한다.
const whenLabel = (u) => {
  if (u.status === 'pending') return fmtDt(u.created_at)
  if (u.status === 'disabled') return fmtDt(u.blocked_at)
  const approved = fmtDt(u.approved_at)
  return u.unblocked_at ? `${approved} (차단해제 ${fmtDt(u.unblocked_at)})` : approved
}

// ConfirmDialog 타이틀·확인 버튼 라벨(타입별). reset은 "임시 비밀번호 발급" 결과 모달과
// 혼동되지 않도록 확인 단계 타이틀은 "비밀번호 초기화"로 둔다(구 AccountApprovals.jsx 관행 —
// 해당 파일 자체는 A6(round06b)에서 삭제했다).
const CONFIRM_META = {
  reject: { title: '가입 거절', confirmLabel: '거절하기' },
  disable: { title: '계정 차단', confirmLabel: '차단하기' },
  delete: { title: '계정 삭제', confirmLabel: '삭제하기' },
  reset: { title: '비밀번호 초기화', confirmLabel: '초기화' },
}

function confirmMessage(type, u) {
  switch (type) {
    case 'reject':
      return `${u.display_name}님의 가입 신청을 거절하시겠습니까? 거절된 신청은 되돌릴 수 없습니다.`
    case 'disable':
      return `${u.display_name}님 계정을 차단하시겠습니까? 세션이 즉시 종료됩니다.`
    case 'delete':
      return `${u.display_name}님 계정을 삭제하시겠습니까? 삭제된 계정은 복구할 수 없습니다.`
    case 'reset':
      return `${u.display_name}님의 비밀번호를 초기화하시겠습니까? 새 임시 비밀번호가 발급되며 기존 비밀번호는 더 이상 사용할 수 없습니다.`
    default:
      return ''
  }
}

export default function Accounts() {
  const { showToast } = useToast()
  const { user: me } = useAuth()
  const targetRole = directSubordinateRole(me?.role, me?.is_root)
  const roleOptions = subordinateRolesAll(me?.role, me?.is_root)
  // 인접 티어(직속 하위)만, 본인 제외 — 백엔드가 최종 권위이고 이건 프론트 이중 방어다.
  const actionable = (u) => u.id !== me?.id && u.role === targetRole

  const [status, setStatus] = useState('')
  const [role, setRole] = useState('')
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  // 처리 중인 행 id — 중복 클릭(이중 제출) 방지.
  const [busyId, setBusyId] = useState(null)
  // { type: 'reject'|'disable'|'delete'|'reset', user } | null
  const [confirmAction, setConfirmAction] = useState(null)
  // 비밀번호 재설정 직후 1회 표시할 임시 비번(닫으면 사라지고 다시 볼 방법이 없다).
  const [tempPasswordInfo, setTempPasswordInfo] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listAccounts({ status: status || undefined, role: role || undefined })
      setAccounts(res.users ?? [])
    } catch {
      showToast('요청 실패')
    } finally {
      setLoading(false)
    }
  }, [status, role, showToast])

  useEffect(() => {
    load()
  }, [load])

  function requestConfirm(type, u) {
    setConfirmAction({ type, user: u })
  }

  async function handleApprove(u) {
    setBusyId(u.id)
    try {
      const res = await approveUser(u.id)
      if (res.status === 200) {
        await load()
        showToast(`${u.display_name}님 계정을 승인했습니다`)
      } else {
        showToast(res.detail || '요청 실패')
      }
    } finally {
      setBusyId(null)
    }
  }

  async function handleUnblock(u) {
    setBusyId(u.id)
    try {
      const res = await unblockUser(u.id)
      if (res.status === 200) {
        await load()
        showToast(`${u.display_name}님 계정을 차단 해제했습니다`)
      } else {
        showToast(res.detail || '요청 실패')
      }
    } finally {
      setBusyId(null)
    }
  }

  async function handleConfirmAction() {
    const action = confirmAction
    setConfirmAction(null)
    if (!action) return
    const { type, user } = action
    setBusyId(user.id)
    try {
      if (type === 'reject') {
        const res = await rejectUser(user.id)
        if (res.status === 200) { await load(); showToast(`${user.display_name}님 신청을 거절했습니다`) }
        else showToast(res.detail || '요청 실패')
      } else if (type === 'delete') {
        const res = await deleteUser(user.id)
        if (res.status === 200) { await load(); showToast(`${user.display_name}님 계정을 삭제했습니다`) }
        else showToast(res.detail || '요청 실패')
      } else if (type === 'disable') {
        const res = await disableUser(user.id)
        if (res.status === 200) { await load(); showToast(`${user.display_name}님 계정을 차단했습니다`) }
        else showToast(res.detail || '요청 실패')
      } else if (type === 'reset') {
        const res = await resetPassword(user.id)
        if (res.status === 200) setTempPasswordInfo({ username: user.username, password: res.temporary_password })
        else showToast(res.detail || '요청 실패')
      }
    } finally {
      setBusyId(null)
    }
  }

  function renderActions(u) {
    if (u.id === me?.id) {
      return <span className="text-[12px] text-[#8A90A2]">본인 계정</span>
    }
    if (!actionable(u)) {
      return <span className="text-[12px] text-[#8A90A2]">—</span>
    }
    const busy = busyId === u.id
    if (u.status === 'pending') {
      return (
        <div className="data_col_actions">
          <Button variant="primary" size="sm" disabled={busy} onClick={() => handleApprove(u)}>승인</Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => requestConfirm('reject', u)}>거절</Button>
        </div>
      )
    }
    if (u.status === 'approved') {
      return (
        <div className="data_col_actions">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => requestConfirm('disable', u)}>차단</Button>
          <Button variant="dark" size="sm" disabled={busy} onClick={() => requestConfirm('reset', u)}>임시비번</Button>
        </div>
      )
    }
    // disabled
    return (
      <div className="data_col_actions">
        <Button variant="primary" size="sm" disabled={busy} onClick={() => handleUnblock(u)}>차단해제</Button>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => requestConfirm('delete', u)}>삭제</Button>
        <Button variant="dark" size="sm" disabled={busy} onClick={() => requestConfirm('reset', u)}>임시비번</Button>
      </div>
    )
  }

  const columns = [
    // round10b Task C — 사용자 결정(2026-09-17) "이메일관련은 다 빼": round06c 최종
    // 리뷰 must-fix I-3이 이름 셀 title 속성(네이티브 툴팁)에 얹었던 이메일 노출을
    // 걷어냈다(listAccounts 응답 자체에 더 이상 email 키가 없다 — admin/routes.py
    // :_summarize). 이제 이름은 그대로만 보여준다 — render는 DataTable 기본값
    // (row[c.key])과 같아져 의미가 없으므로 뺐다(재리뷰 M-10).
    { key: 'display_name', label: '이름' },
    { key: 'dept', label: '부서' },
    { key: 'username', label: '아이디' },
    { key: 'role', label: '역할' },
    { key: 'status', label: '상태', render: (u) => STATUS_LABEL[u.status] ?? u.status },
    { key: 'when', label: '시각', render: (u) => whenLabel(u) },
    { key: 'last_seen_at', label: '최근접속일', render: (u) => fmtDt(u.last_seen_at) },
    { key: 'action', label: '액션', render: renderActions },
  ]

  return (
    <>
      <SystemTabs />

      <div className="data_panel">
        <div className="data_panel_body">
          <div className="data_table_group">
            <div className="data_toolbar">
              <p className="data_total">총 <b>{accounts.length}</b>명</p>
              <div className="flex items-center gap-2">
                <div className="select_box">
                  <label className="sr_only" htmlFor="accounts_status_filter">상태</label>
                  <select
                    id="accounts_status_filter"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value || 'all'} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="select_box">
                  <label className="sr_only" htmlFor="accounts_role_filter">역할</label>
                  <select
                    id="accounts_role_filter"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="">전체</option>
                    {roleOptions.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {loading && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Spinner size={32} />
                <p className="text-sm text-[#8A90A2]">불러오는 중…</p>
              </div>
            )}

            {!loading && accounts.length === 0 && (
              <EmptyState title="조건에 맞는 계정이 없습니다" />
            )}

            {!loading && accounts.length > 0 && (
              <DataTable caption="계정·권한 목록" columns={columns} rows={accounts} />
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction ? CONFIRM_META[confirmAction.type].title : ''}
        message={confirmAction ? confirmMessage(confirmAction.type, confirmAction.user) : ''}
        confirmLabel={confirmAction ? CONFIRM_META[confirmAction.type].confirmLabel : ''}
        onConfirm={handleConfirmAction}
        onClose={() => setConfirmAction(null)}
      />

      <Modal
        open={Boolean(tempPasswordInfo)}
        title="임시 비밀번호 발급"
        onClose={() => setTempPasswordInfo(null)}
        size="sm"
        footer={
          <Button variant="primary" size="sm" onClick={() => setTempPasswordInfo(null)}>
            확인
          </Button>
        }
      >
        <p className="text-sm text-[#4A5266] leading-relaxed mb-3">
          {tempPasswordInfo?.username}님의 임시 비밀번호입니다. 이 창을 닫으면 다시 표시되지
          않으니 지금 안전하게 전달하세요.
        </p>
        <p className="font-mono text-base font-bold text-ink bg-offwhite rounded-lg px-3 py-2 select-all">
          {tempPasswordInfo?.password}
        </p>
      </Modal>
    </>
  )
}
