import { describe, expect, it } from 'vitest'
import { mediaTypeTagClass } from './mediaTypeTag.js'

describe('mediaTypeTagClass', () => {
  it.each([
    ['이미지', 'ty_image'], ['영상', 'ty_video'], ['도서', 'ty_book'],
    ['음원', 'ty_audio'], ['기타', 'ty_etc'],
  ])('%s → %s', (value, cls) => {
    expect(mediaTypeTagClass(value)).toBe(cls)
  })

  it('어휘 밖 값은 빈 문자열(중립 tag 만)', () => {
    expect(mediaTypeTagClass('웹콘텐츠')).toBe('')
  })
})
