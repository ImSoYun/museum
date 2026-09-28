import { describe, expect, it } from 'vitest'
import { ALL, VISIBILITY_OPTIONS, mediaTypeOptions } from './filterOptions.js'

describe('filterOptions', () => {
  it('공개여부 선택지는 서버 Visibility 계약 값이다', () => {
    expect(VISIBILITY_OPTIONS).toEqual([
      { value: 'all', label: '전체' },
      { value: 'public', label: '공개' },
      { value: 'private', label: '미공개' },
    ])
  })

  it('종류 선택지는 「전체」 + 서버 facets.media_type 의 value 를 그 순서 그대로', () => {
    const facet = [
      { value: '이미지', count: 3 }, { value: '영상', count: 0 }, { value: '음원', count: 0 },
      { value: '도서', count: 1 }, { value: '기타', count: 0 },
    ]
    expect(mediaTypeOptions(facet)).toEqual([
      { value: ALL, label: '전체' },
      { value: '이미지', label: '이미지' },
      { value: '영상', label: '영상' },
      { value: '음원', label: '음원' },
      { value: '도서', label: '도서' },
      { value: '기타', label: '기타' },
    ])
  })

  it('파셋이 없으면 「전체」 하나', () => {
    expect(mediaTypeOptions(undefined)).toEqual([{ value: ALL, label: '전체' }])
  })
})
