import { render, fireEvent, screen } from '@testing-library/react'
import { vi } from 'vitest'
import FileDropzone from './FileDropzone.jsx'

function renderZone(props = {}) {
  return render(
    <FileDropzone
      id="ocr_dropzone"
      accept=".pdf,.jpg,.jpeg"
      title="파일을 드래그하거나 클릭하여 업로드"
      desc="pdf, jpg 문서 및 이미지 파일 업로드"
      onFiles={vi.fn()}
      {...props}
    />
  )
}

test('FileDropzone: label 자체가 드롭존이고 "파일선택"은 button이 아니라 aria-hidden span이다', () => {
  const { container } = renderZone()
  const zone = container.querySelector('label.upload_dropzone')
  expect(zone).not.toBeNull()
  expect(zone.id).toBe('ocr_dropzone')

  // label 안에 interactive content를 넣으면 파일 대화상자가 두 번 뜨거나 서로를 취소한다.
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  const btn = container.querySelector('.upload_dropzone_btn')
  expect(btn.tagName).toBe('SPAN')
  expect(btn.getAttribute('aria-hidden')).toBe('true')

  // 실제 초점·조작 표적은 시각적으로 숨긴 input
  const input = container.querySelector('#ocr_dropzone_input')
  expect(input.type).toBe('file')
  expect(input.accept).toBe('.pdf,.jpg,.jpeg')
  expect(input.multiple).toBe(true)
  expect(input.className).toBe('upload_dropzone_input')
  expect(container.querySelector('.upload_dropzone_filename').getAttribute('aria-live')).toBe('polite')
})

test('FileDropzone: D2a — 타이틀은 공용 section_tit, 업로드 아이콘은 upload_dropzone_btn_icon', () => {
  const { container } = renderZone()
  // 퍼블 v2가 upload_dropzone_tit 전용 클래스를 폐기하고 공용 section_tit로 옮겼다
  // (manage_ocr.html:44 · component.css upload_dropzone 그룹).
  expect(container.querySelector('.section_tit').textContent).toBe('파일을 드래그하거나 클릭하여 업로드')
  expect(container.querySelector('.upload_dropzone_tit')).toBeNull()
  expect(container.querySelector('.upload_dropzone_btn img').className).toBe('upload_dropzone_btn_icon')
})

test('FileDropzone: input change 시 onFiles(파일명 배열) 호출 + has_file 상태', () => {
  const onFiles = vi.fn()
  const { container } = renderZone({ onFiles })
  const input = container.querySelector('#ocr_dropzone_input')
  fireEvent.change(input, {
    target: { files: [new File(['x'], '스캔본.pdf', { type: 'application/pdf' })] },
  })
  expect(onFiles).toHaveBeenCalledWith(['스캔본.pdf'])
  expect(container.querySelector('label.upload_dropzone').className).toContain('has_file')
  expect(container.querySelector('.upload_dropzone_filename').textContent).toBe('스캔본.pdf')
})

test('FileDropzone: dragover에 is_dragover, drop에 onFiles 호출 후 해제', () => {
  const onFiles = vi.fn()
  const { container } = renderZone({ onFiles })
  const zone = container.querySelector('label.upload_dropzone')
  fireEvent.dragOver(zone)
  expect(zone.className).toContain('is_dragover')
  fireEvent.drop(zone, {
    dataTransfer: { files: [new File(['x'], '사진.jpg', { type: 'image/jpeg' })] },
  })
  expect(onFiles).toHaveBeenCalledWith(['사진.jpg'])
  expect(zone.className).not.toContain('is_dragover')
})
