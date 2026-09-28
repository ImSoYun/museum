// 이 파일의 책임: 검색결과 단일선택 필터(공개여부·종류)의 선택지(round07m).
//
// 공개여부 값은 서버 museum/search/sorting.py Visibility 계약 문자열이다. 종류 선택지는
// **서버가 준 facets.media_type 의 value** 를 그대로 쓴다 — 어휘가 두 곳에 생기면 갈라진다
// (R6F-15, 주제 드롭다운이 facets.subject 를 쓰는 것과 같다). 프론트가 더하는 것은
// 「전체」(= 필터 없음) 하나뿐이고 건수는 그리지 않는다(피그마).

// 「전체」 선택지의 값. 종류의 「필터 없음」은 컨텍스트에서 null 이지만, LabeledSelect 는
// 문자열 value 로 선택 상태를 비교하므로 화면 안에서만 이 값을 쓴다.
export const ALL = 'all'

export const VISIBILITY_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'public', label: '공개' },
  { value: 'private', label: '미공개' },
]

export function mediaTypeOptions(facet) {
  return [
    { value: ALL, label: '전체' },
    ...(facet ?? []).map((f) => ({ value: f.value, label: f.value })),
  ]
}
