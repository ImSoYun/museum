// 이 파일의 책임: 산출물 제목 기본값(round07f) — 세 진입점(산출물생성 탭 모달
// 2종·채팅 인라인)이 공유한다. 여기서 한 곳에서만 정의하는 이유는 CAPTION_FORMATS
// 와 같다 — 각자 만들면 규칙이 갈린다(round07d가 겪은 어휘 이중화).
//
// 입력은 여전히 사용자가 고칠 수 있다(spec §2 결정 4 「입력 유지 + 기본값만
// 개선」) — 이 함수는 그 **초기값**만 정한다.
export function todayStamp(date = new Date()) {
  const yy = String(date.getFullYear() % 100).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}${mm}${dd}`
}

/** 정본(spec §3.7 · 대조표 §4-5)이 정한 **세 가지**를 낸다 — 피그마 예시가
 * `설명문 캡션 + 타임라인_260912`다. `timeline`은 caption 에만 의미가 있다
 * (전시자료 엑셀에도 특별전시에도 연표라는 개념이 아예 없다).
 *
 * round07i — kind='exhibition'을 더한다. exhibit(엑셀)과 같은 분기로 묶으면
 * 파일 이름이 "…목록_…"이 되어 실제로는 docx 초안인데 엑셀처럼 보인다 —
 * ExhibitionModal.jsx가 이 값을 그대로 "제목이 곧 파일 이름"이라 보여 주므로
 * 여기서 갈라 둔다.
 *
 * round10b B-3(시트 #7·#8) — exhibit 기본 제목을 「전시자료 목록」→「학예 기획
 * 자료 목록」으로 바꿨다. KIND_LABEL 개명(OutputCard.jsx·OutputDetailPage.jsx)과
 * 함께 고쳐야 하는 다섯 곳 중 하나다 — ExhibitModal.jsx의 모달 제목이 이미
 * 「학예 기획 자료 목록」이라 그 표현을 그대로 따른다(같은 말을 두 곳에서
 * 새로 짓지 않는다). */
export function defaultOutputTitle(kind, { timeline = false } = {}) {
  if (kind === 'exhibition') return `특별전시 자료_${todayStamp()}`
  if (kind !== 'caption') return `학예 기획 자료 목록_${todayStamp()}`
  return `${timeline ? '설명문 캡션 + 타임라인' : '설명문 캡션'}_${todayStamp()}`
}
