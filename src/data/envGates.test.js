import fs from 'node:fs'
import path from 'node:path'
import { HIDDEN_BY_ENV, isEnvHidden, PAGE_LEVEL_PREFIXES, isShellLevelGated } from './envGates.js'

const SRC = path.resolve(__dirname, '..')          // web/src
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8')

test('local 환경은 아무것도 숨기지 않는다', () => {
  for (const p of ['/library', '/manage/ocr', '/system/monitoring', '/system/nodes', '/system/log', '/search/output']) {
    expect(isEnvHidden(p, 'local')).toBe(false)
  }
})

test('prod 환경은 spec §7.2가 지정한 6개 화면을 prefix로 숨긴다', () => {
  expect(isEnvHidden('/search/output', 'prod')).toBe(true)
  expect(isEnvHidden('/library', 'prod')).toBe(true)
  expect(isEnvHidden('/manage/ocr', 'prod')).toBe(true)   // '/manage' prefix — 하위 전부
  expect(isEnvHidden('/manage/meta', 'prod')).toBe(true)
  expect(isEnvHidden('/manage/materials', 'prod')).toBe(true)
  expect(isEnvHidden('/system/monitoring', 'prod')).toBe(true)
  expect(isEnvHidden('/system/nodes', 'prod')).toBe(true)  // 복수 — router.jsx:100의 실제 라우트
  expect(isEnvHidden('/system/log', 'prod')).toBe(true)
})

test('prod 환경에서도 계정·권한과 검색 결과/대화, 홈은 숨지 않는다', () => {
  expect(isEnvHidden('/system/accounts', 'prod')).toBe(false)
  expect(isEnvHidden('/search/results', 'prod')).toBe(false)
  expect(isEnvHidden('/search/chat', 'prod')).toBe(false)
  expect(isEnvHidden('/', 'prod')).toBe(false)
  expect(isEnvHidden('/account', 'prod')).toBe(false)
})

test('정의되지 않은 env(dev·undefined)는 아무것도 숨기지 않는다 — HIDDEN_BY_ENV에 prod 키만 있다', () => {
  expect(isEnvHidden('/library', 'dev')).toBe(false)
  expect(isEnvHidden('/library', undefined)).toBe(false)
  expect(HIDDEN_BY_ENV.dev).toBeUndefined()
})

// ── round06f 갈래 E(spec §10.2 · R6F-19): 판정 지점 분배 ──────────────────────
// HIDDEN_BY_ENV가 "무엇을 숨기는가"라면 아래는 "누가 판정하는가"다. 셸(AppShell)이
// <Outlet>을 통째로 바꾸면 그 경로가 속한 탭줄까지 사라지므로, 보존할 탭줄이 있는
// 경로는 페이지 레벨 <EnvGate>가 맡고 셸은 손을 뗀다.

test('isShellLevelGated: /library·/manage도 이제 페이지 레벨 EnvGate 몫이다(A8 통일)', () => {
  expect(isShellLevelGated('/library', 'prod')).toBe(false)
  expect(isShellLevelGated('/manage', 'prod')).toBe(false)
  expect(isShellLevelGated('/manage/ocr', 'prod')).toBe(false)
  expect(isShellLevelGated('/manage/materials', 'prod')).toBe(false)
})

test('isShellLevelGated: /search·/system·/library·/manage 아래는 셸이 맡지 않는다(페이지 레벨 EnvGate 몫)', () => {
  // 이 6개가 false여야 탭줄(있는 화면은)이 살아남는다 — true로 되돌아가면 회귀다.
  expect(isShellLevelGated('/search/output', 'prod')).toBe(false)
  expect(isShellLevelGated('/system/monitoring', 'prod')).toBe(false)
  expect(isShellLevelGated('/system/nodes', 'prod')).toBe(false)
  expect(isShellLevelGated('/system/log', 'prod')).toBe(false)
  expect(isShellLevelGated('/library', 'prod')).toBe(false)
  expect(isShellLevelGated('/manage', 'prod')).toBe(false)
})

test('isShellLevelGated: 애초에 숨김 대상이 아니면 false다', () => {
  expect(isShellLevelGated('/library', 'local')).toBe(false)
  expect(isShellLevelGated('/library', undefined)).toBe(false)
  expect(isShellLevelGated('/library', null)).toBe(false)
  expect(isShellLevelGated('/system/accounts', 'prod')).toBe(false)
  expect(isShellLevelGated('/search/results', 'prod')).toBe(false)
  expect(isShellLevelGated('/', 'prod')).toBe(false)
})

// 접두 비교에 `p + '/'` 경계를 쓰는 이유를 관찰 가능한 형태로 못 박는다.
// 현행 레지스트리 항목은 전부 '/search/'·'/system/' 경계를 이미 지켜서, 경계 규칙의
// 유무가 결과에 드러나지 않는다(그래서 이 테스트만 한시적으로 항목을 하나 등록한다 —
// finally에서 반드시 원복한다). 경계가 없으면 '/systemsettings/foo' 같은 경로가
// '/system' 접두에 걸려 페이지 레벨로 오분류되고, 그 페이지엔 <EnvGate>가 없으므로
// 셸도 페이지도 아무도 막지 않는다 = prod 노출(R-11).
test('PAGE_LEVEL_PREFIXES 비교는 경로 경계를 지킨다 — /systemXYZ 오탐이 셸 게이트를 비껴가지 않는다', () => {
  HIDDEN_BY_ENV.prod.push('/systemsettings')
  try {
    expect(isEnvHidden('/systemsettings/foo', 'prod')).toBe(true)
    expect(isShellLevelGated('/systemsettings/foo', 'prod')).toBe(true)
  } finally {
    HIDDEN_BY_ENV.prod.pop()
  }
})

test('PAGE_LEVEL_PREFIXES는 접두 자체(정확 일치)도 페이지 레벨로 본다', () => {
  HIDDEN_BY_ENV.prod.push('/system')
  try {
    expect(isShellLevelGated('/system', 'prod')).toBe(false)
  } finally {
    HIDDEN_BY_ENV.prod.pop()
  }
})

test('PAGE_LEVEL_PREFIXES는 /search·/system·/library·/manage 넷이다(A8) — 늘리려면 그 아래 페이지에 EnvGate가 먼저 있어야 한다', () => {
  expect(PAGE_LEVEL_PREFIXES).toEqual(['/search', '/system', '/library', '/manage'])
})

// ── round06f 갈래 E — R-11 정합 방어선 (spec §10.2 · §13 R-11) ────────────────
// 정본이 셋이다: ① HIDDEN_BY_ENV 항목 ② PAGE_LEVEL_PREFIXES ③ 실제로 <EnvGate>를
// 마운트한 페이지 파일. 셋이 어긋나면 아무도 막지 않는 경로가 생기고, 그것은 화면을
// 열어보기 전까지 아무 신호도 내지 않는다(조용한 prod 노출). 그래서 여기서 잠근다.
//
// ③은 렌더가 아니라 소스 텍스트로 확인한다 — 각 페이지를 렌더하려면 그 화면의 provider
// 전부를 세워야 하고(AdminProvider·ToastProvider·라우터), 그것은 이미 각 페이지 스위트가
// 하고 있다. 여기서 필요한 것은 "그 파일에 게이트가 달려 있는가"라는 배선 사실뿐이다.
const PAGE_GATE_SOURCES = {
  '/search/output': 'pages/SearchFlowLayout.jsx',
  '/system/monitoring': 'pages/admin/Monitoring.jsx',   // pages/system/ 아니다(router.jsx:11)
  '/system/nodes': 'pages/admin/Nodes.jsx',             // pages/system/ 아니다(router.jsx:12)
  '/system/log': 'pages/system/Log.jsx',
  // A8(round06b) — '/library'는 페이지 파일 1개, '/manage'는 라우트가 5개 페이지
  // 파일로 갈라져 있다(Ocr·Meta·Embedding·History·Materials) — 배열로 전부 명시한다.
  //
  // round10 최종리뷰 M-6 — '/library' 아래에 상세(ProjectDetail.jsx)가 새로 생겼는데
  // 이 레지스트리가 목록 하나만 알고 있었다. HIDDEN_BY_ENV.prod의 '/library'는
  // startsWith 매칭이라 '/library/:id'도 이미 숨김 대상이지만, 그 판정을 실제로
  // 적용하는 것은 PAGE_LEVEL_PREFIXES에 오른 **페이지 자신의 <EnvGate>**다(AppShell이
  // 아니다). 즉 ProjectDetail의 <EnvGate>를 누가 걷어내면 prod에 상세만 조용히
  // 노출되는데 테스트는 초록이었다 — 그 사각지대를 여기서 닫는다.
  '/library': ['pages/Library.jsx', 'pages/ProjectDetail.jsx'],
  '/manage': [
    'pages/manage/Ocr.jsx',
    'pages/manage/Meta.jsx',
    'pages/manage/Embedding.jsx',
    'pages/manage/History.jsx',
    'pages/manage/Materials.jsx',
  ],
}

test('R-11: HIDDEN_BY_ENV의 모든 항목을 셸 게이트 또는 페이지 게이트가 정확히 하나 맡는다', () => {
  for (const route of HIDDEN_BY_ENV.prod) {
    const byShell = isShellLevelGated(route, 'prod')
    const byPage = Object.prototype.hasOwnProperty.call(PAGE_GATE_SOURCES, route)
    expect(isEnvHidden(route, 'prod'), `${route}: 레지스트리에 있는데 isEnvHidden이 false다`).toBe(true)
    expect(
      byShell !== byPage,
      `${route}: shell=${byShell} page=${byPage} — 정확히 하나가 맡아야 한다. ` +
      '둘 다 false면 prod에 그대로 노출되고, 둘 다 true면 게이트가 이중이라 어느 쪽을 ' +
      '고쳐야 하는지 알 수 없다. PAGE_LEVEL_PREFIXES와 PAGE_GATE_SOURCES를 함께 갱신하라.',
    ).toBe(true)
  }
})

test('R-11: 페이지 게이트를 맡은 경로는 그 파일(들)이 실제로 <EnvGate>를 마운트한다', () => {
  for (const [route, rel] of Object.entries(PAGE_GATE_SOURCES)) {
    const files = Array.isArray(rel) ? rel : [rel]
    for (const file of files) {
      const src = read(file)
      expect(src, `${file}(${route})가 EnvGate를 import하지 않는다`).toContain('components/EnvGate.jsx')
      expect(src, `${file}(${route})가 <EnvGate>를 렌더하지 않는다`).toContain('<EnvGate>')
    }
  }
})

test('R-11: 셸은 isShellLevelGated로 판정한다 — isEnvHidden으로 되돌아가면 페이지 레벨 경로까지 삼킨다', () => {
  const shell = read('layouts/AppShell.jsx')
  expect(shell).toContain('isShellLevelGated(pathname, appEnv)')
  expect(shell, 'AppShell이 다시 isEnvHidden으로 판정하면 /system/*의 탭줄이 통째로 사라진다')
    .not.toContain('isEnvHidden(pathname, appEnv)')
})

test('PAGE_LEVEL_PREFIXES에 죽은 접두를 두지 않는다 — 접두마다 그 아래 숨김 항목이 최소 1개 있다', () => {
  for (const p of PAGE_LEVEL_PREFIXES) {
    const under = HIDDEN_BY_ENV.prod.filter((r) => r === p || r.startsWith(p + '/'))
    expect(under.length, `${p} 아래에 숨김 항목이 없다 — 셸 게이트만 무력화하는 죽은 접두다`)
      .toBeGreaterThan(0)
  }
})
