/**
 * outputsApi.test.js — round07b 산출물/노드그래프 클라이언트 계약.
 *
 * 여기서 잠그는 것:
 *   · 실패를 **예외로 던지지 않는다** — { ok:false, notice }로 흡수해 호출부가 토스트
 *   · 401은 notifyUnauthorized()로 전역 세션만료에 넘긴다
 *   · 한글 파일명(RFC 5987)이 깨지지 않는다 — 이게 이 화면의 실제 위험이다
 */
import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('../lib/authEvents.js', () => ({ notifyUnauthorized: vi.fn() }))

import { notifyUnauthorized } from './authEvents.js'
import {
  createOutput,
  deleteOutputs,
  downloadOutputFile,
  fetchOutputGraph,
  filenameFrom,
  getOutputTimeline,
  listOutputs,
} from './outputsApi.js'

const ok = (data, headers = {}) => ({
  ok: true,
  status: 200,
  json: async () => data,
  blob: async () => new Blob(['x']),
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
})

const err = (status, detail) => ({
  ok: false,
  status,
  json: async () => ({ detail }),
  headers: { get: () => null },
})

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

describe('fetchOutputGraph', () => {
  test('POST 본문에 query·mode·selected를 싣는다', async () => {
    global.fetch.mockResolvedValue(ok({ nodes: [], classes: [] }))

    await fetchOutputGraph('민주화운동', 'meta', '정치행정')

    const [url, init] = global.fetch.mock.calls[0]
    expect(url).toContain('/output/graph')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({
      query: '민주화운동', mode: 'meta', selected: '정치행정',
    })
  })

  test('selected 미지정은 null로 보낸다 — 서버가 첫 클래스를 고른다', async () => {
    global.fetch.mockResolvedValue(ok({}))
    await fetchOutputGraph('q', 'meta')
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).selected).toBeNull()
  })

  test('세션이 함께 가야 한다(credentials: include)', async () => {
    global.fetch.mockResolvedValue(ok({}))
    await fetchOutputGraph('q', 'meta')
    expect(global.fetch.mock.calls[0][1].credentials).toBe('include')
  })
})

describe('실패 흡수', () => {
  test('서버 사유를 notice로 끌어올린다', async () => {
    global.fetch.mockResolvedValue(err(422, '알 수 없는 전시자료 컬럼: 크기'))

    const r = await createOutput({ title: 't' })

    expect(r.ok).toBe(false)
    expect(r.notice).toContain('크기')
  })

  test('사유가 없으면 기본 문구를 준다', async () => {
    global.fetch.mockResolvedValue(err(500, undefined))
    expect((await listOutputs()).notice).toBe('산출물 목록을 불러오지 못했습니다')
  })

  test('401은 전역 세션만료로 넘긴다', async () => {
    global.fetch.mockResolvedValue(err(401, '인증이 필요합니다'))
    await listOutputs()
    expect(notifyUnauthorized).toHaveBeenCalled()
  })

  test('네트워크 실패도 예외가 아니라 ok:false다', async () => {
    global.fetch.mockRejectedValue(new TypeError('Failed to fetch'))

    const r = await fetchOutputGraph('q', 'meta')

    expect(r).toMatchObject({ ok: false, status: 0 })
  })
})

describe('listOutputs', () => {
  test('빈 필터는 쿼리스트링에 넣지 않는다', async () => {
    global.fetch.mockResolvedValue(ok({ outputs: [], has_more: false }))
    await listOutputs({ limit: 10, offset: 0 })
    const url = global.fetch.mock.calls[0][0]
    expect(url).not.toContain('kind=')
    expect(url).not.toContain('q=')
  })

  test('kind·q를 실어 보낸다', async () => {
    global.fetch.mockResolvedValue(ok({ outputs: [] }))
    await listOutputs({ kind: 'exhibit', q: '민주화' })
    const url = decodeURIComponent(global.fetch.mock.calls[0][0])
    expect(url).toContain('kind=exhibit')
    expect(url).toContain('q=민주화')
  })

  // round07g — 산출물은 그 대화 안에서만 보인다. 이 파라미터가 빠지면 서버가
  // 예전처럼 **전체**를 돌려주고, 다른 대화에서 만든 산출물이 그대로 섞여 보인다
  // (사용자 보고: 「그 세션에서 산출된 것만 보여야 하는데 다른 세션에서도 공유된다」).
  test('conversationId를 conversation_id 로 실어 보낸다', async () => {
    global.fetch.mockResolvedValue(ok({ outputs: [] }))
    await listOutputs({ conversationId: 'conv-A' })
    expect(decodeURIComponent(global.fetch.mock.calls[0][0])).toContain('conversation_id=conv-A')
  })

  test('대화를 모르면 파라미터 자체를 붙이지 않는다 — 서버 기본값(전체) 그대로', async () => {
    global.fetch.mockResolvedValue(ok({ outputs: [] }))
    await listOutputs({ limit: 10 })
    expect(global.fetch.mock.calls[0][0]).not.toContain('conversation_id')
  })

  // round07g 수정 R1 (Minor-2) — **프론트와 서버가 같은 선을 긋는다.**
  // 서버 판정은 `is not None`이라 `''`도 「그 대화」로 좁힌다. 여기가 truthy 판정
  // (`if (conversationId)`)이면 `''`일 때 프론트만 조용히 파라미터를 빼 「전체」로
  // 넓어진다 — 한 값이 두 계층에서 다른 뜻이 되는 자리다. null·undefined 만 「안 준
  // 것」이다. (「대화를 모를 때 아예 조회하지 않는」 판단은 화면의 몫이고, 이 전송
  // 계층은 받은 것을 그대로 나른다.)
  test("빈 문자열은 「안 준 것」이 아니다 — 서버의 is-not-None 과 같은 선을 긋는다", async () => {
    global.fetch.mockResolvedValue(ok({ outputs: [] }))
    await listOutputs({ conversationId: '' })
    expect(global.fetch.mock.calls[0][0]).toContain('conversation_id=')
  })

  test('null 은 「안 준 것」이다', async () => {
    global.fetch.mockResolvedValue(ok({ outputs: [] }))
    await listOutputs({ conversationId: null })
    expect(global.fetch.mock.calls[0][0]).not.toContain('conversation_id')
  })
})

describe('deleteOutputs', () => {
  test('DELETE 본문에 ids를 싣는다', async () => {
    global.fetch.mockResolvedValue(ok({ deleted: 2, requested: 2 }))
    await deleteOutputs(['a', 'b'])
    const [, init] = global.fetch.mock.calls[0]
    expect(init.method).toBe('DELETE')
    expect(JSON.parse(init.body)).toEqual({ ids: ['a', 'b'] })
  })
})

describe('filenameFrom — 한글 파일명', () => {
  test('RFC 5987 filename*을 디코딩한다', () => {
    const encoded = encodeURIComponent('민주화운동 전시자료.xlsx')
    expect(filenameFrom(`attachment; filename="output.xlsx"; filename*=UTF-8''${encoded}`))
      .toBe('민주화운동 전시자료.xlsx')
  })

  test('filename*이 없으면 ASCII filename으로 떨어진다', () => {
    expect(filenameFrom('attachment; filename="output.xlsx"')).toBe('output.xlsx')
  })

  test('헤더가 없으면 null', () => {
    expect(filenameFrom(null)).toBeNull()
  })

  test('깨진 인코딩은 ASCII 폴백으로 살린다', () => {
    expect(filenameFrom(`attachment; filename="safe.xlsx"; filename*=UTF-8''%E0%A4%A`))
      .toBe('safe.xlsx')
  })
})

describe('downloadOutputFile', () => {
  test('서버 파일명을 우선한다', async () => {
    const encoded = encodeURIComponent('광복 전시자료.xlsx')
    global.fetch.mockResolvedValue(
      ok(null, { 'content-disposition': `attachment; filename*=UTF-8''${encoded}` }),
    )

    const r = await downloadOutputFile('id1', '폴백.xlsx')

    expect(r.ok).toBe(true)
    expect(r.filename).toBe('광복 전시자료.xlsx')
  })

  test('헤더가 없으면 호출부가 준 이름을 쓴다', async () => {
    global.fetch.mockResolvedValue(ok(null, {}))
    expect((await downloadOutputFile('id1', '폴백.xlsx')).filename).toBe('폴백.xlsx')
  })

  test('404는 blob을 만들지 않고 사유를 준다', async () => {
    global.fetch.mockResolvedValue(err(404, '산출물 파일이 없습니다'))

    const r = await downloadOutputFile('id1')

    expect(r.ok).toBe(false)
    expect(r.notice).toBe('산출물 파일이 없습니다')
  })
})

// round11a task-10 — 좌측 타임라인을 3층(연대 › 연도 › 항목)으로 그리는 통로.
describe('getOutputTimeline', () => {
  test('GET /outputs/{id}/timeline 을 부르고 합친 모양을 그대로 올린다', async () => {
    const view = { version: 1, edited: false, decades: [{ decade: '1960', title: '', years: [] }] }
    global.fetch.mockResolvedValue(ok(view))

    const r = await getOutputTimeline('o 1')

    // id 는 인코딩해 싣는다 — 경로에 그대로 붙이면 공백·슬래시가 경로를 가른다.
    expect(global.fetch.mock.calls[0][0]).toContain(`/outputs/${encodeURIComponent('o 1')}/timeline`)
    expect(global.fetch.mock.calls[0][1].method).toBe('GET')
    expect(r).toMatchObject({ ok: true, data: view })
  })

  test('422(설명문이 아님·doc 없음)는 사유를 그대로 준다 — 화면이 옛 렌더로 떨어질 근거다', async () => {
    global.fetch.mockResolvedValue(err(422, '설명문 산출물만 수정할 수 있습니다'))

    const r = await getOutputTimeline('o1')

    expect(r.ok).toBe(false)
    expect(r.notice).toBe('설명문 산출물만 수정할 수 있습니다')
  })
})
