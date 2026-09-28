import { request as pwRequest, test, type APIRequestContext } from '@playwright/test'

/**
 * 이 파일의 책임: e2e 계정 생성 공유 헬퍼(R6E-15) — `tests/conftest.py`·크롤러
 * `tests/guards.py`와 같은 자격의 "공유 픽스처 모듈"이다. 스펙 파일이 아니므로
 * "테스트 파일 간 import 금지" 관례의 대상이 아니다.
 *
 * 고정 4계정(root·e2e_manager·e2e_admin·e2e_user)은 auth.setup.ts가 1회만
 * 만들고, 일회용 계정(e2e_tmp_<RUN_ID>_<tag>_<n>)은 각 스펙이 필요할 때마다
 * 만든다 — fullyParallel 하에서 차단·삭제가 서로 다른 워커의 계정을 건드리지
 * 않게 하기 위함이다.
 *
 * **교차검증 F2** — Playwright에서 `page.request`는 `page`가 속한 브라우저
 * 컨텍스트와 **쿠키 저장소를 공유**한다. 그래서 `page.request`로 다른 계정에
 * 로그인하면 그 순간 `page`의 로그인 상태도 그 계정으로 바뀌고, 로그아웃하면
 * `page`도 로그아웃된다 — "잠깐 다른 신원으로 API를 찔러본다"는 의도로 짠
 * 코드가 실제로는 호출자의 세션을 파괴한다. 아래 `isolatedApiContext()`는
 * `page`/브라우저 컨텍스트와 전혀 무관한 **독립 쿠키 저장소**를 가진
 * `APIRequestContext`를 만든다 — 승인자 로그인처럼 "호출자 세션을 건드리면 안
 * 되는" 모든 API 작업은 반드시 이걸 통해야 한다.
 */

export const ROOT = {
  username: process.env.E2E_ROOT_USERNAME || 'e2e_root',
  password: process.env.E2E_ROOT_PASSWORD || 'e2e-root-pw-01',
}
export const MANAGER = { username: 'e2e_manager', password: 'e2e-manager-pw-01', role: '통합관리자' as const }
export const ADMIN = { username: 'e2e_admin', password: 'e2e-admin-pw-01', role: '관리자' as const }
export const USER = { username: 'e2e_user', password: 'e2e-user-pw-01', role: '사용자' as const }

export const STORAGE_STATE = {
  root: 'e2e/.auth/root.json',
  manager: 'e2e/.auth/e2e_manager.json',
  admin: 'e2e/.auth/e2e_admin.json',
  user: 'e2e/.auth/e2e_user.json',
}

// 워커·재실행 간 계정명 충돌을 피하는 러너 식별자.
export const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

let seq = 0
/** 일회용 계정명 생성기 — 태그로 용도를 남긴다(예: tmpUsername('block')). */
export function tmpUsername(tag: string): string {
  seq += 1
  return `e2e_tmp_${RUN_ID}_${tag}_${seq}`
}

export type Role = '사용자' | '관리자' | '통합관리자'

export interface CreatedUser {
  id: number
  username: string
}

/**
 * 이미 가입된 username으로 apiJoin을 다시 호출했을 때 뜨는 409(auth/routes.py
 * join — DuplicateUsernameError → 409)를 구분하는 전용 에러(2026-07-29 리뷰
 * 수정 — 고정 4계정 auth.setup.ts 재실행 멱등성). 호출부는
 * `err instanceof DuplicateJoinError`로 "이미 존재 = 정상"과 그 외 실패를
 * 나눠 처리한다. 그 외 상태코드는 기존과 동일하게 일반 Error로 던진다.
 */
export class DuplicateJoinError extends Error {}

/** POST /auth/join. 실패하면 응답 본문을 실어 던진다(디버깅용). 409는 DuplicateJoinError. */
export async function apiJoin(
  request: APIRequestContext,
  opts: { username: string; password: string; role: Role; displayName?: string },
): Promise<CreatedUser> {
  const res = await request.post('/api/auth/join', {
    data: {
      username: opts.username,
      password: opts.password,
      role: opts.role,
      display_name: opts.displayName ?? opts.username,
      // round10b Task C — 사용자 결정(2026-09-17) "이메일관련은 다 빼": /auth/join
      // 요청 바디에서 email을 뺐다(서버 계약 museum/auth/routes.py JoinRequest와 짝).
      dept: 'e2e',
    },
  })
  if (res.status() === 409) {
    throw new DuplicateJoinError(`join 중복(이미 가입됨): ${opts.username}`)
  }
  if (res.status() !== 200) {
    throw new Error(`join 실패(${res.status()}): ${await res.text()}`)
  }
  return (await res.json()).user as CreatedUser
}

export async function apiLogin(request: APIRequestContext, username: string, password: string) {
  return request.post('/api/auth/login', { data: { login_id: username, login_pw: password } })
}

export async function apiLogout(request: APIRequestContext) {
  return request.post('/api/auth/logout')
}

export interface AccountListEntry {
  id: number
  username: string
  status: 'pending' | 'approved' | 'rejected' | 'disabled'
}

/**
 * 로그인된(승인자) `request`로 `GET /api/admin/users?role=`을 뒤져 username과
 * 일치하는 계정을 찾는다(id·status 포함) — 없으면 null(2026-07-29 리뷰 수정,
 * 고정 4계정 멱등성). `role`은 admin/routes.py의 `subordinate_roles_all` 가시
 * 집합 안이어야 한다(예: 통합관리자→'관리자'·'통합관리자', 관리자→'사용자').
 * apiJoin의 반환값(가입 직후 id)에 의존하지 않고 상태를 직접 조회하므로,
 * "이미 가입돼 있고 이미 승인까지 끝난" 재실행 경로에서도 id·status를 얻을
 * 수 있다.
 */
export async function findAccountByUsername(
  request: APIRequestContext,
  role: Role,
  username: string,
): Promise<AccountListEntry | null> {
  const res = await request.get('/api/admin/users', { params: { role } })
  if (res.status() !== 200) {
    throw new Error(`계정 목록 조회 실패(${res.status()}): ${await res.text()}`)
  }
  const body = (await res.json()) as { users: AccountListEntry[] }
  return body.users.find((u) => u.username === username) ?? null
}

/**
 * `page`/브라우저 컨텍스트와 쿠키 저장소를 전혀 공유하지 않는 독립
 * `APIRequestContext`를 만든다(교차검증 F2). baseURL은 현재 실행 중인
 * project 설정(`test.info().project.use.baseURL`)에서 그대로 가져온다 —
 * scenario(8010대)·env-prod(8011대) 어느 project에서 호출해도 맞는 백엔드를
 * 향하게 하기 위함이다. **반드시 `dispose()`로 정리한다**(리소스 누수 방지).
 */
export async function isolatedApiContext(): Promise<APIRequestContext> {
  const baseURL = test.info().project.use.baseURL as string
  return pwRequest.newContext({ baseURL })
}

/**
 * 일회용 계정을 만들고 지정된 승인자 계정으로 즉시 승인까지 마친다.
 *
 * **교차검증 F2 수정** — 승인자 로그인·승인·로그아웃은 `isolatedApiContext()`가
 * 만든 독립 컨텍스트에서만 수행한다. 이전 버전은 인자로 받은 `request`(대개
 * `page.request`)를 그대로 재사용했는데, `page.request`는 `page`의 브라우저
 * 컨텍스트와 쿠키 저장소를 공유하므로 승인자로 로그인하는 순간 **호출자의
 * 세션이 승인자 세션으로 바뀌고**, 뒤이은 로그아웃으로 **호출자가 완전히
 * 미인증 상태가 되어 버렸다**(반환 후 `page.goto('/system/accounts')` 등이
 * 401/리다이렉트로 깨짐). 이번 버전은 승인자 작업을 별도 컨텍스트에서 끝내고
 * `dispose()`하므로, 호출자가 넘긴 `request`(가입에만 쓰인다 — 가입은 비로그인
 * 액션이라 안전하다)의 쿠키 상태는 함수 실행 전후로 전혀 달라지지 않는다.
 */
export async function createApprovedAccount(
  request: APIRequestContext,
  opts: {
    role: Role
    username: string
    password: string
    approverUsername: string
    approverPassword: string
  },
): Promise<CreatedUser> {
  const user = await apiJoin(request, { username: opts.username, password: opts.password, role: opts.role })

  const approverCtx = await isolatedApiContext()
  try {
    const login = await apiLogin(approverCtx, opts.approverUsername, opts.approverPassword)
    if (login.status() !== 200) {
      throw new Error(`승인자 로그인 실패(${login.status()}): ${opts.approverUsername}`)
    }
    const approve = await approverCtx.post(`/api/admin/users/${user.id}/approve`)
    await apiLogout(approverCtx)
    if (approve.status() !== 200) {
      throw new Error(`승인 실패(${approve.status()}): ${await approve.text()}`)
    }
  } finally {
    await approverCtx.dispose()
  }
  return user
}
