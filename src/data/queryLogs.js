// resultIds는 materials.js의 실재 id만 사용한다(질의 의미에 맞는 2~6개).
// scenarioKey는 질의 주제 분류 키. 무결과 로그(q24)는 resultIds: []로 EmptyState 폴백 경로를 확보한다.
// 불변식: 모든 로그에서 comment === comments.length.
export const queryLogs = [
  {
    id: 'q1',  rating: '도움됨',       comment: 1,
    comments: ['초기 코멘트 예시'],
    registeredAt: '2026-06-28 09:01', query: '민주화운동 관련 자료 찾아줘',
    scenarioKey: 'democracy',     resultIds: ['m1', 'm2', 'm3', 'm10', 'm15', 'm21'],
  },
  {
    id: 'q2',  rating: '도움되지 않음', comment: 0,
    comments: [],
    registeredAt: '2026-06-28 09:05', query: '근대 신문 호외 보여줘',
    scenarioKey: 'newspaper',     resultIds: ['m51', 'm63', 'm84'],
  },
  {
    id: 'q3',  rating: '도움됨',       comment: 2,
    comments: [
      '출처 표기가 명확합니다',
      '이미지 해상도 확인 필요',
    ],
    registeredAt: '2026-06-28 09:12', query: '경제개발 계획 자료',
    scenarioKey: 'economy',       resultIds: ['m6', 'm9', 'm12', 'm29', 'm61'],
  },
  {
    id: 'q4',  rating: '도움됨',       comment: 0,
    comments: [],
    registeredAt: '2026-06-28 09:20', query: '4·19 혁명 관련 사진 자료',
    scenarioKey: 'april19',       resultIds: ['m3', 'm23', 'm42'],
  },
  {
    id: 'q5',  rating: '도움됨',       comment: 1,
    comments: ['관련 인물 추가 자료도 있으면 좋겠습니다'],
    registeredAt: '2026-06-28 09:34', query: '독립운동 인물 자료 검색',
    scenarioKey: 'independence',  resultIds: ['m16', 'm48', 'm52', 'm55'],
  },
  {
    id: 'q6',  rating: '도움됨',       comment: 0,
    comments: [],
    registeredAt: '2026-06-28 09:48', query: '한국전쟁 구술 증언 자료',
    scenarioKey: 'koreanwar',     resultIds: ['m17', 'm28', 'm50', 'm59'],
  },
  {
    id: 'q7',  rating: '도움되지 않음', comment: 1,
    comments: ['지도 범례가 한국어로 번역되어 있지 않아 활용이 어렵습니다'],
    registeredAt: '2026-06-28 10:02', query: '일제강점기 지도 자료 있어?',
    scenarioKey: 'colonial',      resultIds: ['m45', 'm54'],
  },
  {
    id: 'q8',  rating: '도움됨',       comment: 0,
    comments: [],
    registeredAt: '2026-06-28 10:15', query: '5·18 광주민주화운동 기록물',
    scenarioKey: 'gwangju',       resultIds: ['m22', 'm27', 'm44', 'm62', 'm72', 'm79'],
  },
  {
    id: 'q9',  rating: '도움됨',       comment: 3,
    comments: [
      '문서 원문 스캔본 화질이 우수합니다',
      '발행 기관 정보 보완이 필요합니다',
      '관련 법령 링크도 추가해 주세요',
    ],
    registeredAt: '2026-06-28 10:27', query: '대한민국 정부 수립 관련 문서',
    scenarioKey: 'foundation',    resultIds: ['m7', 'm25', 'm36'],
  },
  {
    id: 'q10', rating: '도움됨',       comment: 0,
    comments: [],
    registeredAt: '2026-06-28 10:41', query: '박정희 시대 경제 성장 자료',
    scenarioKey: 'economy',       resultIds: ['m9', 'm12', 'm29', 'm61', 'm71'],
  },
  {
    id: 'q11', rating: '도움됨',       comment: 1,
    comments: ['사진 캡션에 촬영 날짜가 없어 추가 기입이 필요합니다'],
    registeredAt: '2026-06-28 10:55', query: '6·25 전쟁 사진 아카이브',
    scenarioKey: 'koreanwar',     resultIds: ['m17', 'm28', 'm50'],
  },
  {
    id: 'q12', rating: '도움되지 않음', comment: 0,
    comments: [],
    registeredAt: '2026-06-28 11:08', query: '근대 교육 제도 변천사',
    scenarioKey: 'education',     resultIds: ['m57', 'm64'],
  },
  {
    id: 'q13', rating: '도움됨',       comment: 2,
    comments: [
      '원문 문서 번역본이 포함되어 검토에 도움이 됩니다',
      '협정 당사국 서명란 이미지 해상도 보강 요망',
    ],
    registeredAt: '2026-06-28 11:22', query: '개항기 외교 문서 검색',
    scenarioKey: 'diplomacy',     resultIds: ['m32', 'm53'],
  },
  {
    id: 'q14', rating: '도움됨',       comment: 0,
    comments: [],
    registeredAt: '2026-06-28 11:35', query: '3·1 운동 독립선언서 원본',
    scenarioKey: 'independence',  resultIds: ['m46', 'm56'],
  },
  {
    id: 'q15', rating: '도움됨',       comment: 1,
    comments: ['미군정 포고령 원문도 함께 제공되면 좋겠습니다'],
    registeredAt: '2026-06-28 11:49', query: '해방 이후 미군정 시기 자료',
    scenarioKey: 'foundation',    resultIds: ['m7', 'm25'],
  },
  {
    id: 'q16', rating: '도움됨',       comment: 0,
    comments: [],
    registeredAt: '2026-06-28 12:03', query: '6월 민주항쟁 관련 포스터',
    scenarioKey: 'june1987',      resultIds: ['m1', 'm5', 'm11', 'm77'],
  },
  {
    id: 'q17', rating: '도움되지 않음', comment: 1,
    comments: ['검색 결과가 남성 독립운동가 위주여서 여성 인물 보완이 필요합니다'],
    registeredAt: '2026-06-28 12:17', query: '근현대 여성 독립운동가 정보',
    scenarioKey: 'independence',  resultIds: ['m16', 'm48', 'm60'],
  },
  {
    id: 'q18', rating: '도움됨',       comment: 0,
    comments: [],
    registeredAt: '2026-06-28 12:30', query: '남북정상회담 자료 목록',
    scenarioKey: 'unification',   resultIds: ['m34', 'm67', 'm73'],
  },
  {
    id: 'q19', rating: '도움됨',       comment: 2,
    comments: [
      '광복 당시 현장 사진이 포함되어 역사적 가치가 높습니다',
      '사진별 소장 기관 출처 명기 요망',
    ],
    registeredAt: '2026-06-28 12:44', query: '광복절 관련 역사 사진',
    scenarioKey: 'liberation',    resultIds: ['m7', 'm52', 'm55'],
  },
  {
    id: 'q20', rating: '도움됨',       comment: 0,
    comments: [],
    registeredAt: '2026-06-28 12:58', query: '제헌 국회 의사록 자료',
    scenarioKey: 'foundation',    resultIds: ['m25', 'm36'],
  },
  {
    id: 'q21', rating: '도움됨',       comment: 1,
    comments: ['건물 소재지와 현재 보존 현황 정보도 추가해 주세요'],
    registeredAt: '2026-06-28 13:12', query: '한국 근대 건축물 사진',
    scenarioKey: 'urban',         resultIds: ['m74', 'm75', 'm78'],
  },
  {
    id: 'q22', rating: '도움됨',       comment: 0,
    comments: [],
    registeredAt: '2026-06-28 13:25', query: '조선총독부 문서 관련 자료',
    scenarioKey: 'colonial',      resultIds: ['m45', 'm65'],
  },
  {
    id: 'q23', rating: '도움됨',       comment: 3,
    comments: [
      '영상 재생 시간과 제작 연도가 명시되어 활용이 편리합니다',
      '자막 파일 별도 제공 여부 확인 필요',
      '지역별 새마을운동 비교 자료도 추가되면 유익합니다',
    ],
    registeredAt: '2026-06-28 13:39', query: '새마을운동 기록 영상',
    scenarioKey: 'economy',       resultIds: ['m12', 'm71', 'm82'],
  },
  {
    id: 'q24', rating: '도움되지 않음', comment: 0,
    comments: [],
    registeredAt: '2026-06-28 13:52', query: '한국 현대사 연표 정리',
    scenarioKey: 'timeline',      resultIds: [],
  },
  {
    id: 'q25', rating: '도움됨',       comment: 1,
    comments: ['헌법 개정 연도별 비교표도 함께 제공되면 좋겠습니다'],
    registeredAt: '2026-06-28 14:06', query: '유신헌법 관련 역사 자료',
    scenarioKey: 'yusin',         resultIds: ['m4', 'm26', 'm33', 'm81'],
  },
  {
    id: 'q26', rating: '도움됨',       comment: 0,
    comments: [],
    registeredAt: '2026-06-28 14:20', query: '임시정부 자료 검색',
    scenarioKey: 'independence',  resultIds: ['m52', 'm55', 'm60'],
  },
  {
    id: 'q27', rating: '도움됨',       comment: 2,
    comments: [
      '의거 당시 신문 기사 스크랩이 함께 수록되어 맥락 이해에 도움이 됩니다',
      '관련 재판 기록 원문 추가 요망',
    ],
    registeredAt: '2026-06-28 14:34', query: '안중근 의사 관련 기록물',
    scenarioKey: 'independence',  resultIds: ['m48', 'm54'],
  },
  {
    id: 'q28', rating: '도움됨',       comment: 0,
    comments: [],
    registeredAt: '2026-06-28 14:47', query: '을사늑약 원문 문서',
    scenarioKey: 'colonial',      resultIds: ['m53', 'm56'],
  },
  {
    id: 'q29', rating: '도움됨',       comment: 1,
    comments: ['백범일지 초판본 이미지 품질이 우수합니다'],
    registeredAt: '2026-06-28 15:01', query: '김구 백범일지 관련 자료',
    scenarioKey: 'independence',  resultIds: ['m52', 'm55', 'm60'],
  },
  {
    id: 'q30', rating: '도움됨',       comment: 0,
    comments: [],
    registeredAt: '2026-06-28 15:15', query: '한·일 국교 정상화 협정 문서',
    scenarioKey: 'diplomacy',     resultIds: ['m32', 'm59'],
  },
]
