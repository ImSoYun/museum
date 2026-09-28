/**
 * chronologyApi.test.js — round11a task-10 연표 조회 클라이언트 계약.
 *
 * 여기서 잠그는 것:
 *   · outputsApi 와 **같은 실패 모양**({ ok:false, notice }) — 예외를 던지지 않는다
 *   · 401 은 notifyUnauthorized() 로 전역 세션만료에 넘긴다
 *   · `locate` 의 `found:false` 는 **오류가 아니다** — 정상 응답으로 그대로 올라온다
 *   · `pageImageUrl` 은 fetch 하지 않고 `<img src>` 에 넣을 문자열만 만든다
 */
import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('../lib/authEvents.js', () => ({ notifyUnauthorized: vi.fn() }))

import { notifyUnauthorized } from './authEvents.js'
import {
  getPageEvents,
  getVolumePages,
  locateEra,
  pageImageUrl,
} from './chronologyApi.js'

const ok = (data) => ({ ok: true, status: 200, json: async () => data })
const err = (status, detail) => ({ ok: false, status, json: async () => ({ detail }) })

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

describe('getVolumePages', () => {
  test('본문 쪽 목록을 그대로 돌려준다', async () => {
    global.fetch.mockResolvedValue(ok({ pages: [3, 4, 6] }))

    const res = await getVolumePages(1)

    expect(global.fetch.mock.calls[0][0]).toContain('/chronology/volumes/1/pages')
    expect(res).toMatchObject({ ok: true, data: { pages: [3, 4, 6] } })
  })

  test('세션이 함께 가야 한다(credentials: include)', async () => {
    global.fetch.mockResolvedValue(ok({ pages: [] }))
    await getVolumePages(1)
    expect(global.fetch.mock.calls[0][1].credentials).toBe('include')
  })

  test('422 는 서버 사유를 notice 로 끌어올린다', async () => {
    global.fetch.mockResolvedValue(err(422, 'vol 은 1~3 이어야 합니다(받은 값 9)'))

    const res = await getVolumePages(9)

    expect(res.ok).toBe(false)
    expect(res.notice).toBe('vol 은 1~3 이어야 합니다(받은 값 9)')
  })
})

describe('getPageEvents', () => {
  test('그 쪽의 사건 목록을 받는다', async () => {
    const events = [{ id: 1, vol: 1, page: 12, seq: 0, year: 1952, month: 11, day: 27,
                      text: '이승만 대통령, 타이완 방문', bbox: [0.1, 0.2, 0.9, 0.24] }]
    global.fetch.mockResolvedValue(ok({ events }))

    const res = await getPageEvents(1, 12)

    expect(global.fetch.mock.calls[0][0]).toContain('/chronology/pages/1/12/events')
    expect(res.data.events).toEqual(events)
  })

  test('네트워크가 끊기면 status 0 으로 흡수한다 — 예외를 던지지 않는다', async () => {
    global.fetch.mockRejectedValue(new Error('offline'))

    const res = await getPageEvents(1, 12)

    expect(res).toEqual({ ok: false, status: 0, notice: '서버에 연결하지 못했습니다' })
  })

  test('401 은 전역 세션만료로 넘긴다', async () => {
    global.fetch.mockResolvedValue(err(401, '로그인이 필요합니다'))

    await getPageEvents(1, 12)

    expect(notifyUnauthorized).toHaveBeenCalled()
  })
})

describe('locateEra', () => {
  test('찾으면 vol·page 가 온다', async () => {
    global.fetch.mockResolvedValue(
      ok({ found: true, vol: 2, page: 41, year: 1969, month: 12, day: 27, matched: 'day' }),
    )

    const res = await locateEra('1969.12.27.')

    const url = global.fetch.mock.calls[0][0]
    expect(url).toContain('/chronology/locate?era=')
    expect(res.data).toMatchObject({ found: true, vol: 2, page: 41 })
  })

  test('era 는 인코딩해 싣는다 — 한글·마침표가 섞인 원본 표기다', async () => {
    global.fetch.mockResolvedValue(ok({ found: false, reason: 'out_of_range' }))

    await locateEra('일제강점기')

    expect(global.fetch.mock.calls[0][0]).toContain(`era=${encodeURIComponent('일제강점기')}`)
  })

  test('found:false 는 오류가 아니다 — ok:true 로 열거 코드를 그대로 올린다', async () => {
    global.fetch.mockResolvedValue(ok({ found: false, reason: 'out_of_range' }))

    const res = await locateEra('1936')

    // 여기서 ok:false 로 바꿔 버리면 화면이 「불러오지 못했습니다」를 띄우게 된다 —
    // 서버는 400 대신 이 모양을 정상 응답으로 주기로 했다(chronology/routes.locate).
    //
    // ⚠️ `reason` 은 **기계 코드**다(`out_of_range`·`unparsable` 둘뿐 —
    // domain/models.NotLocated · chronology/rules.py). 이 층은 그것을 번역하지
    // 않고 그대로 올리고, **사람 문구로 옮기는 일은 화면(OutputDetailPage)이 한다.**
    // 예전 픽스처는 여기에 한국어 문장을 넣어 두어 화면이 코드를 그대로 찍는
    // 결함을 덮고 있었다 — 그런 픽스처를 다시 만들지 마라.
    expect(res.ok).toBe(true)
    expect(res.data).toEqual({ found: false, reason: 'out_of_range' })
  })

  test('era 가 없으면 빈 값으로 보낸다 — 호출 자체를 삼키지 않는다', async () => {
    // 빈 값은 연도를 못 뽑는 경우라 서버가 `unparsable` 을 준다(rules.locate_page).
    global.fetch.mockResolvedValue(ok({ found: false, reason: 'unparsable' }))

    const res = await locateEra('')

    expect(global.fetch).toHaveBeenCalled()
    expect(res.data.found).toBe(false)
  })
})

describe('pageImageUrl', () => {
  test('`<img src>` 에 넣을 문자열만 만든다 — fetch 하지 않는다', () => {
    const url = pageImageUrl(3, 90)

    expect(url).toContain('/chronology/pages/3/90/image')
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
