/**
 * conversationsApi.test.js
 *
 * conversationsApi.js(나의 기록 — 대화 목록·재개·삭제 클라이언트)의 계약 검증.
 * mock 모드(VITE_API_BASE_URL 미설정)와 라이브 모드(설정 시 실제 fetch 호출) 둘 다 검증한다.
 * 라이브 모드는 BASE(=isLive)를 모듈 로드 시 한 번만 읽으므로 vi.stubEnv → vi.resetModules →
 * 동적 import 순서를 지킨다(adminApi.test.js·searchApi.test.js와 동일 관행).
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

describe('conversationsApi — 기본(VITE_API_BASE_URL 미설정, mock 모드)', () => {
  test('listConversations: 데모 대화 목록(search_query 보유)을 반환한다', async () => {
    const { listConversations } = await import('./conversationsApi.js')
    const { conversations } = await listConversations()
    expect(conversations.length).toBeGreaterThan(0)
    conversations.forEach((c) => expect(typeof c.search_query).toBe('string'))
  })

  test('getConversation: 데모 대화 1건을 messages 포함으로 반환한다', async () => {
    const { listConversations, getConversation } = await import('./conversationsApi.js')
    const { conversations } = await listConversations()
    const target = conversations[0]
    const conv = await getConversation(target.id)
    expect(conv.id).toBe(target.id)
    expect(Array.isArray(conv.messages)).toBe(true)
  })

  // F5: c-demo-1은 turn_count:3인데 messages가 항상 []이면 "3턴 대화"가 빈 스레드로 열려
  // 데모가 자기부정합한다. turn_count와 정합하는 데모 메시지를 채운다.
  test('getConversation(c-demo-1): turn_count(3)와 정합하는 messages(3턴=6개 항목)를 반환한다', async () => {
    const { getConversation } = await import('./conversationsApi.js')
    const conv = await getConversation('c-demo-1')
    expect(conv.turn_count).toBe(3)
    expect(conv.messages).toHaveLength(6)
    expect(conv.messages[0].role).toBe('user')
    expect(conv.messages[1].role).toBe('assistant')
    // 서버 계약 형태(conversations/routes.py._history_to_messages)를 그대로 따른다.
    conv.messages.filter((m) => m.role === 'assistant').forEach((m) => {
      expect(Array.isArray(m.grounded_docs)).toBe(true)
      expect(Array.isArray(m.rewritten_queries)).toBe(true)
    })
  })

  test('getConversation(c-demo-2): turn_count(0)는 messages:[] 그대로 유지된다', async () => {
    const { getConversation } = await import('./conversationsApi.js')
    const conv = await getConversation('c-demo-2')
    expect(conv.turn_count).toBe(0)
    expect(conv.messages).toEqual([])
  })

  test('getConversation: status:200이 동봉된다(deleteConversation과 대칭, F3)', async () => {
    const { getConversation } = await import('./conversationsApi.js')
    const conv = await getConversation('c-demo-1')
    expect(conv.status).toBe(200)
  })

  test('deleteConversation: 200을 반환한다', async () => {
    const { deleteConversation } = await import('./conversationsApi.js')
    const res = await deleteConversation('c-demo-1')
    expect(res.status).toBe(200)
  })

  test('listConversations: 더미 모드도 limit/offset으로 슬라이스하고 has_more를 계산한다', async () => {
    const { listConversations } = await import('./conversationsApi.js')
    const first = await listConversations({ limit: 1, offset: 0 })
    expect(first.conversations).toHaveLength(1)
    expect(first.has_more).toBe(true)   // DEMO_CONVERSATIONS는 2건

    const second = await listConversations({ limit: 1, offset: 1 })
    expect(second.conversations).toHaveLength(1)
    expect(second.has_more).toBe(false)
  })

  // R6F-25 — 나의 기록 이름 바꾸기. deleteConversation과 대칭으로 더미 모드는 status:200만
  // 반환한다(실제 지속 반영은 하지 않는다 — deleteConversation도 DEMO_CONVERSATIONS를
  // 실제로 지우지 않는 것과 같은 관행).
  test('renameConversation: 더미 모드는 status:200을 반환한다(deleteConversation과 대칭)', async () => {
    const { renameConversation } = await import('./conversationsApi.js')
    const res = await renameConversation('c-demo-1', '새 이름')
    expect(res.status).toBe(200)
  })
})

describe('conversationsApi — 라이브 모드(VITE_API_BASE_URL 설정)', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    global.fetch = originalFetch
    vi.resetModules()
  })

  test('listConversations: GET /conversations를 credentials:"include"로 호출한다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ conversations: [] }),
    })
    const { listConversations } = await import('./conversationsApi.js')
    await listConversations()
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/conversations?limit=10&offset=0',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  test('listConversations: limit/offset을 쿼리스트링으로 실어 보낸다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200, json: () => Promise.resolve({ conversations: [], has_more: false }),
    })
    const { listConversations } = await import('./conversationsApi.js')
    await listConversations({ limit: 10, offset: 10 })
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/conversations?limit=10&offset=10',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  test('listConversations: 401이면 notifyUnauthorized()가 호출된다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 401, json: () => Promise.resolve({}) })
    const { listConversations } = await import('./conversationsApi.js')
    const { registerUnauthorizedHandler } = await import('./authEvents.js')
    const onUnauthorized = vi.fn()
    const unregister = registerUnauthorizedHandler(onUnauthorized)
    await listConversations()
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    unregister()
  })

  test('listConversations: 200이면 notifyUnauthorized()가 호출되지 않는다(오탐 방지 회귀)', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 200, json: () => Promise.resolve({ conversations: [] }) })
    const { listConversations } = await import('./conversationsApi.js')
    const { registerUnauthorizedHandler } = await import('./authEvents.js')
    const onUnauthorized = vi.fn()
    const unregister = registerUnauthorizedHandler(onUnauthorized)
    await listConversations()
    expect(onUnauthorized).not.toHaveBeenCalled()
    unregister()
  })

  test('getConversation: GET /conversations/{id}를 credentials:"include"로 호출한다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ id: 'x', messages: [] }),
    })
    const { getConversation } = await import('./conversationsApi.js')
    await getConversation('x')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/conversations/x',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  // F3: getConversation이 이전엔 {detail}만 resolve해 404/403에서도 호출부가 실패를 분간
  // 못 했다(HTTP status를 삼킴). deleteConversation과 대칭으로 status를 동봉한다.
  test('getConversation: 404 응답이면 status:404가 반환값에 동봉된다(F3)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 404,
      json: () => Promise.resolve({ detail: '대화를 찾을 수 없습니다' }),
    })
    const { getConversation } = await import('./conversationsApi.js')
    const res = await getConversation('missing-id')
    expect(res.status).toBe(404)
    expect(res.detail).toBe('대화를 찾을 수 없습니다')
  })

  test('getConversation: 200 응답이면 status:200과 본문이 함께 반환된다(F3)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ id: 'x', search_query: 'q', messages: [] }),
    })
    const { getConversation } = await import('./conversationsApi.js')
    const res = await getConversation('x')
    expect(res.status).toBe(200)
    expect(res.search_query).toBe('q')
  })

  test('getConversation: 401이면 notifyUnauthorized()가 호출된다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 401, json: () => Promise.resolve({}) })
    const { getConversation } = await import('./conversationsApi.js')
    const { registerUnauthorizedHandler } = await import('./authEvents.js')
    const onUnauthorized = vi.fn()
    const unregister = registerUnauthorizedHandler(onUnauthorized)
    await getConversation('x')
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    unregister()
  })

  test('deleteConversation: DELETE /conversations/{id}를 credentials:"include"로 호출한다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 200, json: () => Promise.resolve({}) })
    const { deleteConversation } = await import('./conversationsApi.js')
    await deleteConversation('x')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/conversations/x',
      expect.objectContaining({ method: 'DELETE', credentials: 'include' }),
    )
  })

  test('deleteConversation: 401이면 notifyUnauthorized()가 호출된다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 401, json: () => Promise.resolve({}) })
    const { deleteConversation } = await import('./conversationsApi.js')
    const { registerUnauthorizedHandler } = await import('./authEvents.js')
    const onUnauthorized = vi.fn()
    const unregister = registerUnauthorizedHandler(onUnauthorized)
    await deleteConversation('x')
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    unregister()
  })

  test('deleteConversation: id는 encodeURIComponent로 인코딩되어 경로에 실린다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 200, json: () => Promise.resolve({}) })
    const { deleteConversation } = await import('./conversationsApi.js')
    await deleteConversation('a b')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/conversations/a%20b',
      expect.objectContaining({ method: 'DELETE', credentials: 'include' }),
    )
  })

  // R6F-25 — PATCH /conversations/{id} body:{title}. getConversation과 대칭으로
  // status를 본문에 동봉해 반환한다(호출측이 200 여부로 성공/실패를 분간).
  test('renameConversation: PATCH /conversations/{id}를 credentials:"include"로 호출한다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ id: 'x', title: '새 이름' }),
    })
    const { renameConversation } = await import('./conversationsApi.js')
    await renameConversation('x', '새 이름')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/conversations/x',
      expect.objectContaining({ method: 'PATCH', credentials: 'include' }),
    )
  })

  test('renameConversation: title을 JSON body로 실어 보낸다', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ id: 'x', title: '새 이름' }),
    })
    const { renameConversation } = await import('./conversationsApi.js')
    await renameConversation('x', '새 이름')
    const [, options] = global.fetch.mock.calls[0]
    expect(options.headers).toEqual(expect.objectContaining({ 'Content-Type': 'application/json' }))
    expect(JSON.parse(options.body)).toEqual({ title: '새 이름' })
  })

  test('renameConversation: id는 encodeURIComponent로 인코딩되어 경로에 실린다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 200, json: () => Promise.resolve({}) })
    const { renameConversation } = await import('./conversationsApi.js')
    await renameConversation('a b', '새 이름')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/conversations/a%20b',
      expect.objectContaining({ method: 'PATCH', credentials: 'include' }),
    )
  })

  test('renameConversation: 200 응답이면 status:200과 갱신된 title이 함께 반환된다(F3 관행 재사용)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ id: 'x', title: '새 이름' }),
    })
    const { renameConversation } = await import('./conversationsApi.js')
    const res = await renameConversation('x', '새 이름')
    expect(res.status).toBe(200)
    expect(res.title).toBe('새 이름')
  })

  test('renameConversation: 401이면 notifyUnauthorized()가 호출된다', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 401, json: () => Promise.resolve({}) })
    const { renameConversation } = await import('./conversationsApi.js')
    const { registerUnauthorizedHandler } = await import('./authEvents.js')
    const onUnauthorized = vi.fn()
    const unregister = registerUnauthorizedHandler(onUnauthorized)
    await renameConversation('x', '새 이름')
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    unregister()
  })
})
