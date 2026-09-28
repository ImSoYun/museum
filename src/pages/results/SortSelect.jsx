// round07h 후속 — 정렬기준. 실제 화면을 피그마와 대조한 사용자 지적으로 드롭다운
// 결정을 되돌린다. 피그마는 [적합도순][최신순][과거순] 버튼 셋이 한 줄에 펼쳐져
// 있고(테두리·⌄ 화살표 없음), 왼쪽 「정렬기준」은 회색 라벨, 선택된 항목만 글씨
// 굵기·색으로 도드라진다 — 드롭다운이 아니다.
//
// 퍼블(publish-v2)에는 이 컨트롤 자체가 없다(search_result.html에 "정렬기준"·
// "적합도순" 문자열이 없다 — 실측 확인). 그래서 dropdown_box 재사용이 아니라
// 자체 설계다. 같은 줄의 LabeledSelect(공개여부·종류, round07m)는 피그마에서도
// 여전히 ⌄ 화살표가 있는 드롭다운이라 그대로 둔다 — 이 컴포넌트만 모양이 다르다.
//
// 셋 중 하나만 고르는 상호배타 컨트롤이라 role="radiogroup" + 각 버튼
// role="radio" + aria-checked를 쓴다(aria-pressed는 토글용이라 부적절).
//
// ★ round07h 2차 정정(피그마 Figma API 실측) — 앞선 "선택 표시는 글씨 굵기·색만으로
//   한다"는 서술은 색값을 몰라 눈대중으로 잡은 추정이었고 실측과 반대였다.
//   Figma API로 뽑은 노드값:
//     sorting(260×26) > "정렬기준" #1E2124 / 굵기700 / 17px
//                     > radio_button__sorting(189×26)
//                         적합도순 67×26 bg #EEF2F7 rounded 4  ← 선택된 것
//                         최신순   53×26 bg 투명(#FFFFFF, opacity 0) rounded 4
//                         과거순   53×26 bg 투명                     rounded 4
//   세 항목의 글씨는 #1E2124 / 굵기400 / 17px로 셋이 완전히 같다 — 즉 선택 표시는
//   글씨가 아니라 "배경 알약(pill)"이다. 지금 이 파일이 굵기·색으로 구분하던 것은
//   실측과 정반대 방향이었다.
//
// 알약 가로 패딩(px-6)은 고정폭이 아니라 글자수에 따라 늘어나는 좌우 패딩으로
// 역산했다 — Pretendard 400/17px 실측 텍스트 폭(런타임 getBoundingClientRect,
// 폰트 로드 후): "적합도순"(4자) 55.57px, "최신순"/"과거순"(3자) 41.69px.
// 피그마 알약 폭은 각각 67px·53px이므로 좌우 합 패딩은 11.4px·11.3px로 두
// 경우가 거의 같다(문자 수와 무관하게 패딩이 일정하다는 뜻) → 편측 5.7px ≈
// Tailwind 정수 스케일(1단위=1px)에서 가장 가까운 6px, px-6(좌우 12px)이면
// 67.6px·53.7px로 피그마 값과 1px 미만 오차다.
//
// #EEF2F7은 tailwind.config.js colors에도 src/styles/tokens.css :root에도 아직
// 없는 값이다(둘 다 확인함). 이 컴포넌트 1곳만 쓰는 색이라 토큰으로 승격하지
// 않고 임의값(bg-[#EEF2F7])으로 남긴다 — 두 번째 소비처가 생기면 그때 토큰화한다.
//
// 값은 여전히 백엔드 계약 문자열이다(museum/search/sorting.py SortOrder) — 모양이
// 바뀌어도 onChange는 라벨이 아니라 값을 올려보낸다. 라벨이 새면 API가 422를 낸다.
const OPTIONS = [
  { value: 'relevance', label: '적합도순' },
  { value: 'recent', label: '최신순' },
  { value: 'past', label: '과거순' },
]

export default function SortSelect({ value, onChange }) {
  return (
    <div className="flex items-center gap-16" role="radiogroup" aria-label="정렬기준">
      <span className="text-17 font-bold text-ink">정렬기준</span>
      {OPTIONS.map((o) => {
        const checked = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(o.value)}
            // 글씨(text-17 font-normal text-ink)는 선택 여부와 무관하게 셋이 같다 —
            // 선택 표시는 배경 알약(bg-[#EEF2F7])의 유무뿐이다.
            className={`flex h-26 items-center justify-center rounded-4 px-6 text-17 font-normal text-ink${checked ? ' bg-[#EEF2F7]' : ''}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
