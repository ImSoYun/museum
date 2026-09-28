// 설계 §6 기관 목록 — count는 기관별 소장·등록 자료 수 (샘플 materials 건수와 별도)
// all.count = sum of the 8 institutions
export const institutions = [
  { id: 'all',         name: '전체',            count: 324 },
  { id: 'history',     name: '대한민국역사박물관', count: 98  },
  { id: 'archives',    name: '국가기록원',        count: 67  },
  { id: 'museum',      name: '국립중앙박물관',    count: 52  },
  { id: 'ihn',         name: '국사편찬위원회',    count: 45  },
  { id: 'presidential',name: '대통령기록관',      count: 28  },
  { id: 'seoul',       name: '서울역사박물관',    count: 19  },
  { id: 'ktv',         name: 'KTV',              count: 12  },
  { id: 'research',    name: '근현대사연구학회',  count: 3   },
]
