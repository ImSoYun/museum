import { describe, it, expect, vi } from 'vitest'
import { triggerBrowserDownload } from './downloadFile.js'

describe('triggerBrowserDownload', () => {
  it('objectURL을 만들고 임시 <a download>를 클릭한 뒤 정리한다', () => {
    const created = 'blob:mock-url'
    const createObjectURL = vi.fn(() => created)
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })

    const clickSpy = vi.fn()
    const realCreateElement = document.createElement.bind(document)
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = realCreateElement(tag)
      if (tag === 'a') el.click = clickSpy
      return el
    })

    const blob = new Blob(['x'])
    triggerBrowserDownload(blob, 'artifact-1.jpg')

    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith(created)

    createElementSpy.mockRestore()
    vi.unstubAllGlobals()
  })
})
