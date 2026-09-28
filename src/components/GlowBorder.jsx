// 이 파일의 책임: 퍼블 정본의 호버 글로우 테두리 장식 — svg.glow_border + rect 12개.
//
// 퍼블(publish-v2 page/ai_chat.html)은 인용칩(.chat_cite_item)마다 이 12줄을 인라인으로
// 반복해 적어 둔다. rect 12개는 마크업상 완전히 동일하고(pathLength="100"만 있다) 서로 다른
// 굵기·투명도·애니메이션 지연은 CSS 의 rect:nth-of-type(1..12) 12규칙이 준다 — 즉 마크업에서
// 반복되는 것은 값이 아니라 개수뿐이라 컴포넌트로 빼도 정본과 렌더 결과가 같다.
// 스타일 전부(위치·stroke·opacity·animation)는 이식한 .glow_border CSS 가 담당하므로
// 여기에는 Tailwind·인라인 style 을 두지 않는다.
//
// 소비처: results/ChatTab.jsx 의 인용칩. 부모가 position:relative + overflow:hidden 이어야
// 테두리가 칩 모양대로 잘려 보인다(.chat_cite_item 이 둘 다 갖는다).
const RECT_COUNT = 12

export default function GlowBorder() {
  return (
    <svg className="glow_border" aria-hidden="true" focusable="false">
      {Array.from({ length: RECT_COUNT }, (_, i) => (
        <rect key={i} pathLength="100" />
      ))}
    </svg>
  )
}
