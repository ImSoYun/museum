// 시나리오 A: 민주화운동 방사형 지식 그래프
// color는 src/theme/tokens.js NODE_COLORS 팔레트 참조
export const nodes = [
  // 루트
  { id: 'n0',  label: '민주화운동',    count: 85, x: 420, y: 260, group: 'root',   color: '#1D4ED8' }, // 정치
  // 사건 테마
  { id: 'n1',  label: '4·19 혁명',     count: 18, x: 160, y: 90,  group: 'theme',  color: '#3D5AE0' }, // 민주화
  { id: 'n2',  label: '5·18 운동',     count: 22, x: 680, y: 90,  group: 'theme',  color: '#3D5AE0' },
  { id: 'n3',  label: '6월 항쟁',      count: 19, x: 160, y: 430, group: 'theme',  color: '#3D5AE0' },
  { id: 'n4',  label: '부마항쟁',      count: 9,  x: 680, y: 430, group: 'theme',  color: '#3D5AE0' },
  { id: 'n5',  label: '유신 체제',     count: 14, x: 420, y: 70,  group: 'theme',  color: '#E0662E' }, // 법률
  // 인물
  { id: 'n6',  label: '박종철',        count: 5,  x: 100, y: 260, group: 'person', color: '#D9A516' }, // 외교→인물 재활용
  { id: 'n7',  label: '이한열',        count: 4,  x: 740, y: 260, group: 'person', color: '#D9A516' },
  { id: 'n8',  label: '전태일',        count: 6,  x: 260, y: 510, group: 'person', color: '#D9A516' },
  // 관련 주제
  { id: 'n9',  label: '노동운동',      count: 11, x: 580, y: 510, group: 'social', color: '#0E9AA8' }, // 시민
  { id: 'n10', label: '언론 검열',     count: 8,  x: 260, y: 30,  group: 'media',  color: '#8B5CF6' }, // 통일 팔레트 재활용
  { id: 'n11', label: '독립운동',      count: 30, x: 420, y: 450, group: 'theme',  color: '#1E9E6A' }, // 독립
  { id: 'n12', label: '경제개발',      count: 24, x: 700, y: 330, group: 'theme',  color: '#16A34A' }, // 사법
]

export const nodeEdges = [
  // 루트 → 사건 테마
  { from: 'n0', to: 'n1' },
  { from: 'n0', to: 'n2' },
  { from: 'n0', to: 'n3' },
  { from: 'n0', to: 'n4' },
  { from: 'n0', to: 'n5' },
  // 루트 → 관련 주제
  { from: 'n0', to: 'n9'  },
  { from: 'n0', to: 'n10' },
  { from: 'n0', to: 'n11' },
  { from: 'n0', to: 'n12' },
  // 사건 ↔ 인물
  { from: 'n3', to: 'n6' },
  { from: 'n3', to: 'n7' },
  { from: 'n9', to: 'n8' },
  // 유신 체제 → 언론 검열
  { from: 'n5', to: 'n10' },
  // 부마항쟁 → 유신 체제
  { from: 'n4', to: 'n5' },
  // 독립운동 ← 루트 (상위 연결은 이미 위에서 처리)
]
