/**
 * artifactKeysApi.test.js — round07h Task 7 리뷰 수정(Important).
 *
 * 이 파일이 존재하지 않던 것 자체가 결함이었다 — OutputDetailPage.test.jsx가
 * artifactKeysApi.js를 통째로 vi.mock 하므로, fetchDisplayKeys의 실제 흡수
 * 로직(특히 401 분기)이 그동안 한 번도 실행되지 않았다.
 *
 * 여기서 잠그는 것:
 *   · 빈 목록이면 fetch를 아예 안 부른다
 *   · 정상 응답을 { ok:true, keys } 로 돌려준다
 *   · 401이면 notifyUnauthorized()가 호출된다 — 그리고 throw 하지 않고 빈 결과를 돌려준다
 *   · 500·네트워크 오류에서는 notifyUnauthorized()가 호출되지 않는다(좁은 판정 회귀 가드)
 *
 * outputsApi.test.js와 같은 관행 — authEvents.js를 vi.mock 해 notifyUnauthorized
 * 호출 여부만 스파이로 확인한다.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('../lib/authEvents.js', () => ({ notifyUnauthorized: vi.fn() }))

import { notifyUnauthorized } from './authEvents.js'
import { fetchDisplayKeys } from './artifactKeysApi.js'

const ok = (data) => ({
  ok: true,
  status: 200,
  json: async () => data,
})

const err = (status) => ({
  ok: false,
  status,
  json: async () => ({ detail: '오류' }),
})

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

describe('fetchDisplayKeys', () => {
  test('빈 목록이면 fetch를 부르지 않고 { ok:true, keys:{} }를 돌려준다', async () => {
    const res = await fetchDisplayKeys([])
    expect(global.fetch).not.toHaveBeenCalled()
    expect(res).toEqual({ ok: true, keys: {} })
  })

  test('정상 응답을 { ok:true, keys } 로 돌려준다', async () => {
    const keys = { A001: { name: '반닫이', subject_year: 1890, is_public: true } }
    global.fetch.mockResolvedValue(ok({ keys }))

    const res = await fetchDisplayKeys(['A001'])

    expect(res).toEqual({ ok: true, keys })
    const [url, init] = global.fetch.mock.calls[0]
    expect(url).toContain('/artifacts/keys')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect(JSON.parse(init.body)).toEqual({ idnbrs: ['A001'] })
  })

  test('401이면 notifyUnauthorized()가 호출되고, throw 하지 않고 빈 결과를 돌려준다', async () => {
    global.fetch.mockResolvedValue(err(401))

    const res = await fetchDisplayKeys(['A001'])

    expect(notifyUnauthorized).toHaveBeenCalled()
    expect(res).toEqual({ ok: false, keys: {} })
  })

  test('500이면 notifyUnauthorized()가 호출되지 않는다(!res.ok 아닌 좁은 판정 회귀 가드)', async () => {
    global.fetch.mockResolvedValue(err(500))

    const res = await fetchDisplayKeys(['A001'])

    expect(notifyUnauthorized).not.toHaveBeenCalled()
    expect(res).toEqual({ ok: false, keys: {} })
  })

  test('네트워크 오류에서도 notifyUnauthorized()가 호출되지 않고 예외를 던지지 않는다', async () => {
    global.fetch.mockRejectedValue(new TypeError('Failed to fetch'))

    const res = await fetchDisplayKeys(['A001'])

    expect(notifyUnauthorized).not.toHaveBeenCalled()
    expect(res).toEqual({ ok: false, keys: {} })
  })
})
