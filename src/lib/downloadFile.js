/**
 * downloadFile.js
 *
 * 브라우저에 파일 저장을 트리거하는 순수 DOM 부수효과 한 곳(round06e §9.1).
 * fetch/에러 판정(searchApi.js)과 분리해 두면 그 로직은 fetch mock만으로 테스트되고,
 * 이 파일의 DOM 조작(객체 URL·임시 <a>)은 별도로 가볍게 검증할 수 있다.
 */
export function triggerBrowserDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
