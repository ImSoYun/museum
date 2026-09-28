import { describe, it, expect, vi } from 'vitest'
import { defaultOutputTitle, todayStamp } from './outputTitles.js'

describe('defaultOutputTitle', () => {
  it('caption은 「설명문 캡션_YYMMDD」', () => {
    vi.setSystemTime(new Date('2026-09-02T10:00:00+09:00'))
    expect(defaultOutputTitle('caption')).toBe('설명문 캡션_260902')
    vi.useRealTimers()
  })

  // round10b B-3 — exhibit 라벨이 「전시자료」→「학예 기획 자료」로 개명되며
  // 기본 제목도 함께 바뀐다(5곳 동시 반영 — outputTitles.js 정의부 주석 참조).
  it('exhibit은 「학예 기획 자료 목록_YYMMDD」', () => {
    vi.setSystemTime(new Date('2026-01-05T10:00:00+09:00'))
    expect(defaultOutputTitle('exhibit')).toBe('학예 기획 자료 목록_260105')
    vi.useRealTimers()
  })

  // I10 — 정본(spec §3.7 · 대조표 §4-5)은 caption 이 **두 가지**다. 피그마 예시가
  // 「설명문 캡션 + 타임라인_260912」이므로 그 날짜 그대로 잠근다.
  it('caption + 타임라인은 「설명문 캡션 + 타임라인_YYMMDD」', () => {
    vi.setSystemTime(new Date('2026-09-12T10:00:00+09:00'))
    expect(defaultOutputTitle('caption', { timeline: true })).toBe('설명문 캡션 + 타임라인_260912')
    vi.useRealTimers()
  })

  it('exhibit은 timeline 인자를 무시한다 — 전시자료 엑셀에는 연표가 없다', () => {
    vi.setSystemTime(new Date('2026-01-05T10:00:00+09:00'))
    expect(defaultOutputTitle('exhibit', { timeline: true })).toBe('학예 기획 자료 목록_260105')
    vi.useRealTimers()
  })

  // round07i — exhibit과 같은 분기로 묶으면 docx 초안인데 파일 이름이 "…목록"이
  // 되어 엑셀처럼 보인다. 갈라 둔 것을 여기서 잠근다.
  it('exhibition은 「특별전시 자료_YYMMDD」이고 exhibit과 이름이 겹치지 않는다', () => {
    vi.setSystemTime(new Date('2026-01-05T10:00:00+09:00'))
    expect(defaultOutputTitle('exhibition')).toBe('특별전시 자료_260105')
    expect(defaultOutputTitle('exhibition')).not.toBe(defaultOutputTitle('exhibit'))
    vi.useRealTimers()
  })
})
