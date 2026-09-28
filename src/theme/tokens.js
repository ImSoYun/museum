// 이 파일의 책임: 런타임에 JS 로 계산해야 하는 색값만 남긴다.
// NODE_COLORS 는 지식그래프 SVG 노드를 JS 로 채색하는 값이라 CSS 토큰으로 옮길 수 없다.
// 그 밖의 디자인 토큰은 전부 src/styles/tokens.css 로 갔다(round06d R6d-02).
// FONT_STACK 은 소비처가 0이고 tailwind.config.js 의 fontFamily.sans 와 중복이라 삭제했다.
export const NODE_COLORS = {
  정치: '#1D4ED8', 행정: '#2563EB', 민주화: '#3D5AE0', 통일: '#8B5CF6',
  법률: '#E0662E', 독립: '#1E9E6A', 시민: '#0E9AA8', 군사: '#DB2777',
  사법: '#16A34A', 외교: '#D9A516',
}
