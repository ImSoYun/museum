import { chatMessages } from './chat.js'
import { nodes as demoNodes, nodeEdges as demoEdges } from './nodes.js'
import { timeline as demoTimeline } from './timeline.js'

export const MAIN_SCENARIO_ID = 'democracy'

/**
 * nodeItems를 기준으로 nodes 배열의 count를 nodeItems[id].length에서 파생한다.
 * nodeItems에 키가 없는 노드는 count를 그대로 유지한다.
 * 불변식: node.count === nodeItems[node.id].length (키가 있는 노드 전체)
 */
function deriveNodeCounts(nodes, nodeItems) {
  return nodes.map((n) => {
    const items = nodeItems[n.id]
    if (items === undefined) return n
    return { ...n, count: items.length }
  })
}

export const scenarios = [
  {
    id: 'democracy', label: '민주화운동', main: true,
    query: '민주화운동에 관련된 자료 찾아줘.',
    keywords: ['민주화', '5·18', '5.18', '6월 항쟁', '6월항쟁', '4·19', '4.19', '시위', '항쟁', '유신', '박종철', '이한열'],
    // 반드시 chat.js sources 전체(m1~m3,m5,m10,m13,m15,m18,m22,m27,m35,m41,m44,m58,m62,m66) 포함
    materialIds: [
      // chat.js sources (필수 포함)
      'm1', 'm2', 'm3', 'm5', 'm10', 'm13', 'm15', 'm18',
      'm22', 'm27', 'm35', 'm41', 'm44', 'm58', 'm62', 'm66',
      // 추가 민주화운동 자료
      'm4', 'm11', 'm14', 'm19', 'm23', 'm24',
      'm26', 'm30', 'm33', 'm40', 'm42', 'm43',
      'm68', 'm70', 'm72', 'm77', 'm79', 'm80',
      'm83', 'm85',
    ],
    typeFacets: { 이미지: 48, 영상: 12, 음성: 6, 도서: 9 },
    chat: chatMessages,
    nodeEdges: demoEdges,
    nodeItems: {
      n1: ['m3', 'm23', 'm42'],           // 4·19 혁명
      n2: ['m22', 'm27', 'm41', 'm44', 'm62', 'm79'], // 5·18 운동
      n3: ['m1', 'm2', 'm15', 'm18', 'm66', 'm77', 'm80'], // 6월 항쟁
      n4: ['m13', 'm24'],                 // 부마항쟁
      n5: ['m4', 'm26', 'm33'],           // 유신 체제
      n6: ['m5'],                         // 박종철
      n7: ['m10'],                        // 이한열
      n8: ['m35'],                        // 전태일
      n9: ['m11', 'm19', 'm30'],          // 노동운동
      n10: ['m33'],                       // 언론 검열
      n11: [],                            // 독립운동 (별도 시나리오)
      n12: [],                            // 경제개발 (별도 시나리오)
    },
    get nodes() { return deriveNodeCounts(demoNodes, this.nodeItems) },
    output: {
      caption: {
        title: '민주화운동 기록 컬렉션',
        subtitle: '4·19에서 6월 항쟁까지',
        body: '본 컬렉션은 1960년 4·19 혁명부터 1987년 6월 항쟁에 이르는 한국 민주화운동의 주요 기록을 모은 것이다. 대한민국역사박물관·국가기록원·국사편찬위원회 등 6개 기관이 소장한 사진, 문서, 도서 자료 75건을 주제별로 분류하여 제공한다. 각 자료는 공공누리 제4유형 또는 저작권자 허락 아래 열람 가능하며, 원본 소장 기관 링크를 통해 추가 정보를 확인할 수 있다. 이 기록들이 민주주의의 역사를 되새기는 데 기여하기를 바란다.',
      },
      promo: {
        title: '시민이 만든 민주주의',
        subtitle: '특별전 홍보 문안',
        body: '광장에서 외친 목소리가 역사가 되었습니다. 4·19 혁명의 함성, 5·18 광주의 저항, 1987년 6월의 함성이 오늘날 우리 민주주의의 뿌리입니다. 이번 특별전에서 그 생생한 기록을 직접 만나보세요. 시민 한 사람 한 사람의 용기가 어떻게 역사를 바꾸었는지, 기록으로 확인하실 수 있습니다.',
      },
    },
    // timeline — 현재 읽는 소비처가 없다. round06c-ext D1-7이 "타임라인 생성"을 준비중
    // 토스트로 바꾸면서 OutputTab이 Timeline 컴포넌트를 렌더하지 않게 됐다(components/
    // Timeline.jsx 헤더 주석 참조). 준비중이 해제되면 다시 읽히므로 데이터는 남겨둔다.
    timeline: demoTimeline,
    libraryProjectId: 's1',
  },
  {
    id: 'economy', label: '경제개발',
    query: '경제개발 5개년 계획 관련 자료 보여줘.',
    keywords: ['경제개발', '경제 개발', '5개년', '수출', '산업화', '새마을', '중화학', '경공업', '관광', '정책'],
    materialIds: [
      'm6',   // 경제개발 5개년 계획서 (제1차)
      'm9',   // 한강의 기적 산업시설 사진 (포항제철)
      'm12',  // 새마을운동 홍보 포스터
      'm29',  // 경부고속도로 건설 공사 기록 사진
      'm38',  // 고속도로 개통식 기록 영상 스틸
      'm39',  // 서울 올림픽 유치 신청서
      'm61',  // 박정희 시대 경제 개발 구술 자료집
      'm71',  // 박정희 대통령 새마을운동 지시 메모
      'm74',  // 1980년대 서울 도심 야경 사진
      'm75',  // 청계천 복개 공사 기록 사진
      'm76',  // 1970년대 서울 시내버스 노선도
      'm78',  // 서울 강남 개발 계획 도면
      'm82',  // 경부고속도로 개통 기록 영화 스틸
    ],
    typeFacets: { 이미지: 22, 영상: 5, 음성: 2, 도서: 7 },
    chat: [
      { role: 'user', text: '경제개발 5개년 계획 관련 자료 보여줘.' },
      { role: 'ai', text: '경제개발 5개년 계획(1962~) 관련 핵심 자료를 정리했습니다. 계획서 원문과 수출·산업화 기록 사진이 포함됩니다.', sources: ['m6', 'm29', 'm61'] },
      { role: 'user', text: '수출 100억 달러 달성 관련 자료도 있어?' },
      { role: 'ai', text: '1977년 수출 100억 달러 달성 관련 기록과 기념 자료를 찾았습니다.', sources: ['m9', 'm38'] },
    ],
    nodeEdges: [
      { from: 'e0', to: 'e1' },
      { from: 'e0', to: 'e2' },
      { from: 'e0', to: 'e3' },
      { from: 'e0', to: 'e4' },
    ],
    nodeItems: {
      e1: ['m6', 'm61'],             // 5개년 계획
      e2: ['m9', 'm29', 'm38', 'm82'], // 수출 산업화
      e3: ['m12', 'm71'],            // 새마을운동
      e4: ['m76', 'm78'],            // 중화학공업 / 도시개발
    },
    get nodes() {
      const base = [
        { id: 'e0', label: '경제개발', x: 420, y: 260, group: 'root', color: '#16A34A' },
        { id: 'e1', label: '5개년 계획', x: 180, y: 110, group: 'theme', color: '#1E9E6A' },
        { id: 'e2', label: '수출 산업화', x: 660, y: 110, group: 'theme', color: '#1E9E6A' },
        { id: 'e3', label: '새마을운동', x: 180, y: 420, group: 'theme', color: '#0E9AA8' },
        { id: 'e4', label: '중화학공업', x: 660, y: 420, group: 'theme', color: '#0E9AA8' },
      ]
      return deriveNodeCounts(base, this.nodeItems)
    },
    output: {
      caption: {
        title: '한강의 기적, 그 설계도',
        subtitle: '경제개발 5개년 계획 기록',
        body: '1962년 제1차 경제개발 5개년 계획 수립에서 시작된 한국의 압축 성장 과정을 기록한 컬렉션이다. 경부고속도로 건설, 포항제철 준공, 새마을운동 확산 등 산업화의 주요 장면을 담은 사진과 문서 자료를 한데 모았다. 당시 정부 계획서 원본과 현장 사진은 한국 경제 발전의 설계도를 생생하게 보여준다. 각 기관의 공개 기록을 통해 경제 개발 시대의 실상을 입체적으로 살펴볼 수 있다.',
      },
      promo: {
        title: '성장의 시대',
        subtitle: '산업화 특별전 홍보 문안',
        body: '논밭이 공장으로, 흙길이 고속도로로 바뀌던 시대의 기록입니다. 대한민국 산업화의 역동적인 현장을 담은 사진과 문서를 통해 한강의 기적이 어떻게 만들어졌는지 확인해 보세요. 개발의 꿈과 땀이 어우러진 그 시절의 이야기가 이번 특별전에서 펼쳐집니다.',
      },
    },
    timeline: [
      { y: '1962', t: '제1차 경제개발 5개년 계획' },
      { y: '1970', t: '경부고속도로 개통' },
      { y: '1973', t: '중화학공업화 선언' },
      { y: '1977', t: '수출 100억 달러 달성' },
    ],
    libraryProjectId: 's4',
  },
  {
    id: 'independence', label: '독립운동',
    query: '독립운동 관련 인물·자료를 찾아줘.',
    keywords: ['독립', '독립운동', '항일', '임시정부', '3·1', '3.1', '의병', '광복', '스탈린', '기념'],
    materialIds: [
      'm16',  // 독립운동가 안창호 초상 사진
      'm45',  // 일제강점기 경복궁 훼손 기록 사진
      'm46',  // 3·1 운동 독립선언서 필사본
      'm47',  // 동학농민운동 격문 목판본
      'm48',  // 항일 의병장 민긍호 초상
      'm49',  // 신간회 창립 취지서
      'm51',  // 대한매일신보 창간호
      'm52',  // 김구 선생 서명 태극기
      'm53',  // 을사늑약 원문
      'm54',  // 봉오동·청산리 전투 작전도
      'm55',  // 광복군 훈련 사진
      'm56',  // 제암리 학살 현장 보고서
      'm60',  // 독립운동사 편찬 원고 (제3권)
      'm65',  // 1920년대 형사 사법 기록 (식민지)
    ],
    typeFacets: { 이미지: 18, 영상: 3, 음성: 2, 도서: 11 },
    chat: [
      { role: 'user', text: '독립운동 관련 인물·자료를 찾아줘.' },
      { role: 'ai', text: '항일 독립운동 관련 자료를 정리했습니다. 3·1운동, 임시정부, 의열 활동 기록이 포함됩니다.', sources: ['m46', 'm52', 'm55', 'm56'] },
      { role: 'user', text: '대한민국 임시정부 관련 문서만 볼 수 있어?' },
      { role: 'ai', text: '대한민국 임시정부 수립(1919) 관련 공문서와 기록을 필터링했습니다.', sources: ['m49', 'm60'] },
    ],
    nodeEdges: [
      { from: 'i0', to: 'i1' },
      { from: 'i0', to: 'i2' },
      { from: 'i0', to: 'i3' },
      { from: 'i0', to: 'i4' },
    ],
    nodeItems: {
      i1: ['m46', 'm56'],            // 3·1 운동
      i2: ['m49', 'm52', 'm60'],     // 임시정부
      i3: ['m48', 'm65'],            // 의열 활동
      i4: ['m55', 'm54'],            // 광복군
    },
    get nodes() {
      const base = [
        { id: 'i0', label: '독립운동', x: 420, y: 260, group: 'root', color: '#1E9E6A' },
        { id: 'i1', label: '3·1 운동', x: 180, y: 110, group: 'theme', color: '#16A34A' },
        { id: 'i2', label: '임시정부', x: 660, y: 110, group: 'theme', color: '#16A34A' },
        { id: 'i3', label: '의열 활동', x: 180, y: 420, group: 'theme', color: '#D9A516' },
        { id: 'i4', label: '광복군', x: 660, y: 420, group: 'theme', color: '#D9A516' },
      ]
      return deriveNodeCounts(base, this.nodeItems)
    },
    output: {
      caption: {
        title: '빼앗긴 들에도',
        subtitle: '항일 독립운동 기록',
        body: '본 컬렉션은 1894년 동학농민운동부터 1945년 광복에 이르기까지 항일 독립운동의 기록을 집성한 것이다. 3·1운동 독립선언서, 광복군 훈련 사진, 임시정부 관련 문서 등 국내외 소장 자료를 한데 모아 독립운동의 전모를 조명한다. 국립중앙박물관과 국사편찬위원회가 소장한 희귀 자료들을 통해 선열들의 투쟁과 희생을 생생하게 확인할 수 있다. 이 기록들이 오늘을 사는 우리에게 역사적 책임과 자긍심을 일깨우기를 바란다.',
      },
      promo: {
        title: '독립의 함성',
        subtitle: '광복절 특별전 홍보 문안',
        body: '빼앗긴 나라를 되찾기 위해 목숨을 바친 선열들의 기록입니다. 3·1운동의 함성, 임시정부의 고단한 나날, 광복군의 결의가 사진과 문서로 살아 숨 쉽니다. 광복절 특별전을 통해 독립의 의미를 다시 한번 가슴 깊이 새겨 보시기 바랍니다.',
      },
    },
    timeline: [
      { y: '1919', t: '3·1 운동 · 대한민국 임시정부 수립' },
      { y: '1920', t: '봉오동·청산리 전투' },
      { y: '1932', t: '이봉창·윤봉길 의거' },
      { y: '1940', t: '한국광복군 창설' },
    ],
    libraryProjectId: 's5',
  },
]

export function getScenario(id) {
  return scenarios.find((s) => s.id === id) || scenarios.find((s) => s.id === MAIN_SCENARIO_ID)
}

export function matchScenario(text) {
  const t = String(text || '').toLowerCase()
  const hit = scenarios.find((s) => s.keywords.some((k) => t.includes(k.toLowerCase())))
  return hit || getScenario(MAIN_SCENARIO_ID)
}

// 매칭 성공/폴백 여부를 함께 반환한다.
// matched=false 면 키워드에 걸리지 않아 메인 시나리오로 폴백된 상태(출처 표기·무매칭 안내용).
export function matchScenarioResult(text) {
  const t = String(text || '').toLowerCase()
  const hit = scenarios.find((s) => s.keywords.some((k) => t.includes(k.toLowerCase())))
  return { scenario: hit || getScenario(MAIN_SCENARIO_ID), matched: Boolean(hit) }
}
