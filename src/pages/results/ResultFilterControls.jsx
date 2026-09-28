// 이 파일의 책임: 검색결과 필터 막대의 컨트롤 묶음 — 정렬기준 → 공개여부 → 종류 → 주제(round07m).
//
// [왜 떼었나]
// 같은 묶음이 두 자리에 그려진다: 결과가 있을 때(ResultsTab)와, 필터 때문에 0건이 됐을 때
// 되돌릴 길을 주는 자리(SearchResults — 최종 전체 리뷰 I-1). round07h 는 두 자리에 컨트롤을
// 따로 적었고, 순서가 한쪽만 바뀌는 사고를 테스트로 막아야 했다. 한 컴포넌트로 두면 순서가
// 구조적으로 같다.
//
// Fragment 로 반환한다 — 호출부의 .result_meta_filters 래퍼 직계 자식 순서가 곧 피그마 순서다.
//
// [라벨 — round07m 사용자 결정 8]
// 「등록유형」→「공개여부」, 「자료유형」→「주제」. round07h 가 「주제 → 자료유형」으로 되돌렸던
// 것을 이번 피그마 스크린샷(2026-09-15)이 다시 「주제」로 뒤집었다.
import DropdownCheckBox from '../../components/DropdownCheckBox.jsx'
import LabeledSelect from '../../components/LabeledSelect.jsx'
import { useScenario } from '../../context/ScenarioContext.jsx'
import SortSelect from './SortSelect.jsx'
import { ALL, VISIBILITY_OPTIONS, mediaTypeOptions } from './filterOptions.js'

export default function ResultFilterControls() {
  const {
    sort, setSort, visibility, setVisibility,
    mediaType, setMediaType, subjects, setSubjects, facets,
  } = useScenario()
  const subjectOptions = facets?.subject ?? []
  const mediaFacet = facets?.media_type ?? []

  return (
    <>
      <SortSelect value={sort} onChange={setSort} />
      <LabeledSelect label="공개여부" options={VISIBILITY_OPTIONS} value={visibility} onChange={setVisibility} />
      {/* 파셋이 없으면(구 응답·429 이전 mock) 그리지 않는다 — 「전체」 하나뿐인 드롭다운은
          고를 것이 없는 죽은 UI다(주제 드롭다운과 같은 규칙). */}
      {mediaFacet.length > 0 && (
        <LabeledSelect
          label="종류"
          options={mediaTypeOptions(mediaFacet)}
          value={mediaType ?? ALL}
          onChange={(v) => setMediaType(v === ALL ? null : v)}
        />
      )}
      {subjectOptions.length > 0 && (
        <DropdownCheckBox label="주제" options={subjectOptions} selected={subjects} onChange={setSubjects} />
      )}
    </>
  )
}
