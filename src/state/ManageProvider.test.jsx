import { render, screen, fireEvent } from '@testing-library/react'
import { ManageProvider } from './ManageProvider.jsx'
import { useManage } from './useManage.js'

function Probe() {
  const { ocr, meta, embedding, history, materials, promote, addUpload, removeItem, updateMeta, updateItem } = useManage()
  return (
    <div>
      <span data-testid="ocr">{ocr.length}</span>
      <span data-testid="meta">{meta.length}</span>
      <span data-testid="embedding">{embedding.length}</span>
      <span data-testid="history">{history.length}</span>
      <span data-testid="materials">{materials.length}</span>
      <span data-testid="ocr-first">{ocr[0]?.name}</span>
      <span data-testid="ocr-first-status">{ocr[0]?.ocrStatus}</span>
      <span data-testid="materials-first-name">{materials[0]?.name}</span>
      <span data-testid="materials-first-manager">{materials[0]?.manager}</span>
      <button onClick={() => promote('ocr', [ocr[0].id])}>승급</button>
      <button onClick={() => addUpload('새파일.pdf')}>업로드</button>
      <button onClick={() => removeItem('ocr', ocr[0].id)}>삭제</button>
      <button onClick={() => updateMeta(meta[0].id, { records: 999 })}>메타수정</button>
      <button onClick={() => updateItem('materials', materials[0].id, { manager: '수정담당자' })}>자료수정</button>
      <span data-testid="meta-first-records">{meta[0]?.records}</span>
    </div>
  )
}

test('초기값은 각 더미 길이와 일치 (ocr 23 / meta 18 / embedding 25 / history 25 / materials 30)', () => {
  render(<ManageProvider><Probe /></ManageProvider>)
  expect(screen.getByTestId('ocr').textContent).toBe('23')
  expect(screen.getByTestId('meta').textContent).toBe('18')
  expect(screen.getByTestId('embedding').textContent).toBe('25')
  expect(screen.getByTestId('history').textContent).toBe('25')
  expect(screen.getByTestId('materials').textContent).toBe('30')
})

test('addUpload는 ocr 맨 앞에 처리 대기 행을 추가한다', () => {
  render(<ManageProvider><Probe /></ManageProvider>)
  fireEvent.click(screen.getByText('업로드'))
  expect(screen.getByTestId('ocr').textContent).toBe('24')
  expect(screen.getByTestId('ocr-first').textContent).toBe('새파일.pdf')
  expect(screen.getByTestId('ocr-first-status').textContent).toBe('처리 대기')
})

test('promote는 ocr 항목을 다음 단계(meta)로 이동시킨다', () => {
  render(<ManageProvider><Probe /></ManageProvider>)
  fireEvent.click(screen.getByText('승급'))
  expect(screen.getByTestId('ocr').textContent).toBe('22')
  expect(screen.getByTestId('meta').textContent).toBe('19')
})

test('removeItem은 해당 단계에서 항목을 제거한다', () => {
  render(<ManageProvider><Probe /></ManageProvider>)
  fireEvent.click(screen.getByText('삭제'))
  expect(screen.getByTestId('ocr').textContent).toBe('22')
})

test('updateMeta는 meta 항목 필드를 갱신한다', () => {
  render(<ManageProvider><Probe /></ManageProvider>)
  fireEvent.click(screen.getByText('메타수정'))
  expect(screen.getByTestId('meta-first-records').textContent).toBe('999')
})

test('updateItem은 지정 stage 배열의 해당 항목 필드를 갱신한다', () => {
  render(<ManageProvider><Probe /></ManageProvider>)
  fireEvent.click(screen.getByText('자료수정'))
  expect(screen.getByTestId('materials-first-manager').textContent).toBe('수정담당자')
})

test('updateItem 후 materials 길이는 변하지 않는다', () => {
  render(<ManageProvider><Probe /></ManageProvider>)
  fireEvent.click(screen.getByText('자료수정'))
  expect(screen.getByTestId('materials').textContent).toBe('30')
})

test('useManage는 Provider 밖에서 에러', () => {
  function Bare() { useManage(); return null }
  expect(() => render(<Bare />)).toThrow()
})
