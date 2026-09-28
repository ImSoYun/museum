/**
 * projectsApi.test.js — round10 Task4 라이브러리 프로젝트 클라이언트 계약.
 *
 * Step1 다섯 개는 브리프가 준 시나리오를 그대로 옮긴다. 그 아래 묶음은 브리프가
 * 명시하지 않은 나머지 인터페이스(listProjectOutputs·downloadProjectOutput)와,
 * 이 라운드에서 결정해야 했던 401 처리 편차(openProject만 notifyUnauthorized를
 * 부르지 않는다 — projectsApi.js 머리주석 참조)를 검증한다.
 */
import { describe, test, expect, vi, afterEach } from 'vitest'

vi.mock('./authEvents.js', () => ({ notifyUnauthorized: vi.fn() }))
import { notifyUnauthorized } from './authEvents.js'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.restoreAllMocks() })

async function withFetch(impl) {
  vi.stubEnv('VITE_API_BASE_URL', 'http://api.test')
  const fetchMock = vi.fn(impl)
  global.fetch = fetchMock
  const mod = await import('./projectsApi.js')
  return { ...mod, fetchMock }
}

const okJson = (data) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) })

describe('projectsApi', () => {
  test('saveProject 는 카멜→스네이크로 바꿔 보낸다', async () => {
    const { saveProject, fetchMock } = await withFetch(() => okJson({ id: 'p1' }))
    const res = await saveProject({
      title: '민주화운동', description: '설명', password: '1234',
      conversationId: 'c1', searchQuery: '민주화운동', searchMode: 'meta', outputIds: ['o1'],
    })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toEqual({
      title: '민주화운동', description: '설명', password: '1234',
      conversation_id: 'c1', search_query: '민주화운동', search_mode: 'meta', output_ids: ['o1'],
    })
    expect(res).toEqual({ ok: true, id: 'p1' })
  })

  test('saveProject 는 암호가 없으면 키 자체를 싣지 않는다', async () => {
    const { saveProject, fetchMock } = await withFetch(() => okJson({ id: 'p1' }))
    await saveProject({ title: 'x', searchQuery: 'q', outputIds: [] })
    expect('password' in JSON.parse(fetchMock.mock.calls[0][1].body)).toBe(false)
  })

  test('listProjects 는 q·limit·offset 을 쿼리로 싣고 hasMore 를 카멜로 준다', async () => {
    const { listProjects, fetchMock } = await withFetch(() => okJson({ projects: [], has_more: true }))
    const res = await listProjects({ q: '민주화', limit: 12, offset: 12 })
    const url = fetchMock.mock.calls[0][0]
    expect(url).toContain('q=%EB%AF%BC%EC%A3%BC%ED%99%94')
    expect(url).toContain('limit=12')
    expect(url).toContain('offset=12')
    expect(res.hasMore).toBe(true)
  })

  test('openProject 는 401·403 을 상태로 구분해 돌려준다', async () => {
    const { openProject } = await withFetch(() =>
      Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ detail: 'password_required' }) }))
    const res = await openProject('p1')
    expect(res).toEqual({ ok: false, status: 401 })
  })

  test('openProject 성공은 project 와 outputIds 를 준다', async () => {
    const { openProject } = await withFetch(() =>
      okJson({ project: { id: 'p1', title: 'T' }, output_ids: ['o1'] }))
    const res = await openProject('p1', '1234')
    expect(res.ok).toBe(true)
    expect(res.project.id).toBe('p1')
    expect(res.outputIds).toEqual(['o1'])
  })
})

describe('projectsApi — round10 추가 계약', () => {
  // 핵심 결정 — 서버(routes.py:117-120)가 401을 "이 프로젝트는 암호가 필요하다"는
  // 도메인 신호로 쓴다. 다른 모든 lib/ 모듈처럼 401마다 notifyUnauthorized()를 부르면
  // 암호 잠긴 프로젝트를 열 때마다 전역 로그아웃이 튀어나와 암호 입력 화면(Task 6·7)에
  // 닿지도 못한다 — 그래서 openProject만 예외로 둔다.
  test('openProject 는 401이어도 notifyUnauthorized 를 부르지 않는다(암호 필요는 세션 만료가 아니다)', async () => {
    const { openProject } = await withFetch(() =>
      Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ detail: 'password_required' }) }))
    await openProject('p1')
    expect(notifyUnauthorized).not.toHaveBeenCalled()
  })

  test('openProject 는 403(암호 틀림)도 예외 없이 상태만 돌려준다', async () => {
    const { openProject } = await withFetch(() =>
      Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve({ detail: 'password_mismatch' }) }))
    const res = await openProject('p1', '9999')
    expect(res).toEqual({ ok: false, status: 403 })
    expect(notifyUnauthorized).not.toHaveBeenCalled()
  })

  // saveProject·listProjects 등 나머지 전부는 다른 lib/ 모듈과 같은 관행이다 —
  // 401 = 세션만료.
  test('saveProject 는 401이면 notifyUnauthorized 를 부른다(다른 lib 모듈과 같은 관행)', async () => {
    const { saveProject } = await withFetch(() =>
      Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ detail: '인증이 필요합니다' }) }))
    await saveProject({ title: 'x', searchQuery: 'q', outputIds: [] })
    expect(notifyUnauthorized).toHaveBeenCalled()
  })

  test('listProjectOutputs 는 그 프로젝트의 산출물 메타 목록을 준다', async () => {
    const { listProjectOutputs } = await withFetch(() => okJson({
      outputs: [{ id: 'o1', kind: 'exhibit', title: 'T', file_name: 'f.docx', file_bytes: 10, created_at: '2026-01-01' }],
    }))
    const res = await listProjectOutputs('p1')
    expect(res.ok).toBe(true)
    expect(res.outputs).toHaveLength(1)
    expect(res.outputs[0].id).toBe('o1')
  })

  test('listProjectOutputs 는 404를 흡수해 ok:false 로 돌려준다(예외를 던지지 않는다)', async () => {
    const { listProjectOutputs } = await withFetch(() =>
      Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ detail: 'not_found' }) }))
    const res = await listProjectOutputs('missing')
    expect(res).toEqual({ ok: false, status: 404, notice: 'not_found' })
  })

  test('downloadProjectOutput 은 한글 파일명(RFC 5987)을 살려 blob 과 함께 돌려준다', async () => {
    const blob = new Blob(['x'])
    const { downloadProjectOutput } = await withFetch(() => Promise.resolve({
      ok: true,
      status: 200,
      blob: () => Promise.resolve(blob),
      headers: {
        get: (k) => (k.toLowerCase() === 'content-disposition'
          ? "attachment; filename*=UTF-8''%EB%AF%BC%EC%A3%BC%ED%99%94.docx"
          : null),
      },
    }))
    const res = await downloadProjectOutput('p1', 'o1')
    expect(res.ok).toBe(true)
    expect(res.filename).toBe('민주화.docx')
    expect(res.blob).toBe(blob)
  })

  test('downloadProjectOutput 실패는 예외를 던지지 않고 notice 로 흡수한다', async () => {
    const { downloadProjectOutput } = await withFetch(() => Promise.resolve({
      ok: false, status: 500, json: () => Promise.resolve({}), headers: { get: () => null },
    }))
    const res = await downloadProjectOutput('p1', 'o1')
    expect(res).toEqual({ ok: false, status: 500, notice: '다운로드에 실패했습니다' })
  })

  test('네트워크 자체가 끊기면 예외 대신 ok:false를 돌려준다', async () => {
    const { listProjects } = await withFetch(() => Promise.reject(new TypeError('Failed to fetch')))
    const res = await listProjects()
    expect(res.ok).toBe(false)
    expect(res.status).toBe(0)
  })

  // ── round10 최종리뷰 C-1 — 공유 열람용 대화 조회 ────────────────────────────
  // 반환 모양이 conversationsApi.getConversation과 **같아야** 한다({ ...body, status }) —
  // ScenarioContext.resumeConversation이 두 경로를 같은 코드로 소비하기 때문이다.
  test('getProjectConversation 은 프로젝트 경유 경로를 부르고 body+status 를 준다', async () => {
    const body = { id: 'c1', search_query: '민주화운동', mode: 'meta', messages: [] }
    const { getProjectConversation, fetchMock } = await withFetch(() => okJson(body))
    const res = await getProjectConversation('p1', 'c1')
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/projects/p1/conversations/c1')
    expect(fetchMock.mock.calls[0][1]).toEqual({ credentials: 'include' })
    expect(res).toEqual({ ...body, status: 200 })
  })

  test('getProjectConversation 의 404 는 status 로 올라온다(호출부가 실패로 읽는다)', async () => {
    const { getProjectConversation } = await withFetch(() => Promise.resolve({
      ok: false, status: 404, json: () => Promise.resolve({ detail: 'not_found' }),
    }))
    const res = await getProjectConversation('p1', 'c1')
    expect(res.status).toBe(404)
    expect(res.search_query).toBeUndefined()
    // 404 는 세션 문제가 아니다 — 전역 로그아웃을 부르지 않는다.
    expect(notifyUnauthorized).not.toHaveBeenCalled()
  })

  test('getProjectConversation 의 401 은 세션 만료다 — 통지한다(openProject 와 다르다)', async () => {
    const { getProjectConversation } = await withFetch(() => Promise.resolve({
      ok: false, status: 401, json: () => Promise.resolve({}),
    }))
    await getProjectConversation('p1', 'c1')
    expect(notifyUnauthorized).toHaveBeenCalled()
  })

  test('getProjectConversation 은 네트워크 실패도 예외 대신 status:0 으로 돌려준다', async () => {
    const { getProjectConversation } = await withFetch(() => Promise.reject(new TypeError('x')))
    expect(await getProjectConversation('p1', 'c1')).toEqual({ status: 0 })
  })
})
