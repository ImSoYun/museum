// 이 파일의 책임: 역할 어휘가 정본(workspace/app/schema.sql 의 users.role CHECK)과
// 글자 그대로 일치하는지, 그리고 개명 과정에서 권한 집합이 흔들리지 않았는지를 지킨다.
// 하드코딩 대조가 아니라 schema.sql 을 읽어 대조하는 이유: 스키마가 바뀌면 이 테스트가
// 먼저 깨져야 앱 코드가 조용히 어긋나는 것을 막을 수 있다(D5).
import fs from 'node:fs'
import path from 'node:path'
import { ROLES, PERMISSION_MATRIX, canAccess, blockReasonOf, areaOf, firstSystemEntry } from './permissions.js'

// __dirname = <ROOT>/workspace/app/web/src/data → 세 단계 위가 workspace/app 이다.
const SCHEMA_PATH = path.join(__dirname, '..', '..', '..', 'schema.sql')

/**
 * schema.sql 원문에서 users.role 의 CHECK 목록을 뽑는다.
 * 순수 함수 — 파일 IO 는 호출부가 한다(MOK-STD-002 순수로직/IO 분리).
 * @param {string} sql schema.sql 전문
 * @returns {string[]} 예: ['사용자', '관리자', '통합관리자']
 */
export function parseRoleCheck(sql) {
  const m = sql.match(/CHECK\s*\(\s*role\s+IN\s*\(([^)]*)\)\s*\)/)
  if (!m) return []
  return m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''))
}

test('역할 집합이 정본 어휘로 정의되어 있다', () => {
  expect(ROLES).toEqual(['사용자', '관리자', '통합관리자'])
})

test('ROLES 가 schema.sql 의 role CHECK 와 글자 그대로 일치한다', () => {
  const roles = parseRoleCheck(fs.readFileSync(SCHEMA_PATH, 'utf8'))
  expect(roles).toHaveLength(3)
  expect([...roles].sort()).toEqual([...ROLES].sort())
})

test('역할별 허용 area 집합(system-accounts/system-ops 재편)', () => {
  expect(PERMISSION_MATRIX['사용자']).toEqual(['search', 'library', 'manage', 'account'])
  expect(PERMISSION_MATRIX['관리자']).toEqual(['search', 'library', 'manage', 'account', 'system-accounts'])
  expect(PERMISSION_MATRIX['통합관리자']).toEqual(['search', 'library', 'manage', 'account', 'system-accounts', 'system-ops'])
})

test('areaOf: 계정·권한은 system-accounts, 그 외 시스템관리는 system-ops', () => {
  expect(areaOf('/system/accounts')).toBe('system-accounts')
  expect(areaOf('/system/monitoring')).toBe('system-ops')
  expect(areaOf('/system/nodes')).toBe('system-ops')
  expect(areaOf('/system/log')).toBe('system-ops')
  expect(areaOf('/manage/ocr')).toBe('manage')
  expect(areaOf('/account')).toBe('account')
  expect(areaOf('/')).toBe('search')
  expect(areaOf('/search/results')).toBe('search')
})

test('canAccess: 사용자는 시스템관리 전면 차단, 관리자는 계정·권한만, 통합관리자는 전부', () => {
  expect(canAccess('사용자', '/system/accounts')).toBe(false)
  expect(canAccess('사용자', '/system/monitoring')).toBe(false)
  expect(canAccess('사용자', '/manage/ocr')).toBe(true)   // 자료관리 준비중=전 역할 허용(§3.3)
  expect(canAccess('관리자', '/system/accounts')).toBe(true)
  expect(canAccess('관리자', '/system/monitoring')).toBe(false)
  expect(canAccess('통합관리자', '/system/monitoring')).toBe(true)
  expect(canAccess('통합관리자', '/system/accounts')).toBe(true)
})

// ── R6d-26: 차단 사유 판정 ──────────────────────────────────────────────
// 왜 여기(permissions.js)에 두는가: 차단 여부는 '권한 정책'이지 'LNB의 표현'이 아니다.
// 퍼블은 이 정책을 마크업 클래스(.lnb_system_link)에 새겼고, 그래서 admin_dashboard.html은
// 이미 시스템관리 화면에 들어와 있으면서도 자기 자신을 차단한다(spec §6.6.2).
// 정책을 순수 함수로 빼면 round06c가 실제 세션 role만 꽂아도 판정이 따라 바뀐다.
describe('blockReasonOf — 라우트 메타 + 권한에서 차단 사유를 파생한다', () => {
  test('사유가 없으면 null (정상 이동)', () => {
    // requires 없는 항목은 role과 무관하게 통과한다 — round06d는 라우트 가드를 도입하지 않는다.
    expect(blockReasonOf({ to: '/' }, '사용자')).toBeNull()
    expect(blockReasonOf({ to: '/search' }, '사용자')).toBeNull()
    expect(blockReasonOf({ to: '/library' }, '사용자')).toBeNull()
    expect(blockReasonOf({ to: '/manage/ocr' }, '사용자')).toBeNull()
    // 권한을 가진 역할이면 requires 항목도 통과
    expect(blockReasonOf({ to: '/system/monitoring', requires: 'system-ops' }, '통합관리자')).toBeNull()
  })

  test('권한 미달은 system_access, 미구현 라우트는 wip, wip이 권한보다 앞선다', () => {
    expect(blockReasonOf({ to: '/system/monitoring', requires: 'system-ops' }, '사용자')).toBe('system_access')
    expect(blockReasonOf({ to: '/system/monitoring', requires: 'system-ops' }, '관리자')).toBe('system_access')
    expect(blockReasonOf({ to: '/somewhere', status: 'wip' }, '통합관리자')).toBe('wip')
    // 라우트 자체가 없으면 권한이 있어도 갈 곳이 없다 → wip이 먼저다
    expect(blockReasonOf({ to: '/system/x', status: 'wip', requires: 'system-ops' }, '사용자')).toBe('wip')
  })

  // round06c F2: Lnb의 자료관리 NAV 항목에 requires:'manage' 를 추가해 표시 게이트가
  // 라우트 게이트(canAccess)와 같은 영역을 덮게 했다(spec §9.2 검토 #12). requires 문자열
  // 자체는 truthy 판정용일 뿐 실제 허용 여부는 canAccess(role, to)가 area로 판정한다.
  // round06c-ext D1-1: 자료관리 화면은 전부 "준비중"이라 열람 자체는 막을 이유가 없다
  // (브리프 §3 확정 — manage area 를 세 역할 전부에 허용). 그래서 세 역할 모두 통과한다
  // — 개명 전에는 '사용자'만 막혔던 규칙이 여기서 의도적으로 넓어졌다.
  test('자료관리(requires:manage)는 세 역할 모두 통과한다(manage=전 역할 허용)', () => {
    expect(blockReasonOf({ to: '/manage/ocr', requires: 'manage' }, '사용자')).toBeNull()
    expect(blockReasonOf({ to: '/manage/ocr', requires: 'manage' }, '관리자')).toBeNull()
    expect(blockReasonOf({ to: '/manage/ocr', requires: 'manage' }, '통합관리자')).toBeNull()
  })
})

// ── round06c 최종 리뷰 I-1: firstSystemEntry — 시스템관리 LNB 목적지의 role별 판정 ──────
// 계획 §3.3(검토정정 포함)이 요구하는 계약: 관리자·통합관리자는 시스템관리에 실제로
// 들어갈 수 있어야 한다(사용자만 차단). 목적지는 role마다 다르다 — 통합관리자는
// system-ops(모니터링)까지, 관리자는 system-accounts(계정·권한)까지만.
//
// 참고 — 위 'canAccess: 사용자는 시스템관리 전면 차단…' 테스트가 이미 확정한 사실:
// canAccess('관리자', '/system/monitoring') === false 다. 그래서 위쪽 blockReasonOf
// 테스트가 item.to='/system/monitoring'을 관리자에게 'system_access'로 판정하는 것은
// (그 경로 자체에 대한 판정으로서는) 여전히 참이다 — 달라진 것은 Lnb가 더 이상 관리자를
// 그 경로로 보내지 않는다는 점이다(관리자는 firstSystemEntry가 돌려주는 /system/accounts로
// 간다). 아래 테스트가 그 새 계약을 명시적으로 고정한다.
describe('firstSystemEntry — role이 실제로 들어갈 수 있는 첫 /system/* 경로', () => {
  test('통합관리자는 /system/monitoring(system-ops)로 간다', () => {
    expect(firstSystemEntry('통합관리자')).toBe('/system/monitoring')
  })

  test('관리자는 system-ops가 없어 /system/accounts(system-accounts)로 간다', () => {
    expect(firstSystemEntry('관리자')).toBe('/system/accounts')
  })

  test('사용자는 어느 시스템관리 경로도 없어 null(=차단 유지)', () => {
    expect(firstSystemEntry('사용자')).toBeNull()
  })

  // role별 목적지를 blockReasonOf에 실제로 흘렸을 때도 차단되지 않아야 한다 — Lnb가
  // 이 값을 NAV 항목의 to로 쓰기 때문에(component 배선은 Lnb.test.jsx가 검증).
  test('firstSystemEntry가 돌려준 경로는 그 role에게 차단되지 않는다(관리자·통합관리자)', () => {
    expect(blockReasonOf({ to: firstSystemEntry('관리자'), requires: 'system-ops' }, '관리자')).toBeNull()
    expect(blockReasonOf({ to: firstSystemEntry('통합관리자'), requires: 'system-ops' }, '통합관리자')).toBeNull()
  })
})
