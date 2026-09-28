// Shared manager pool (4–6 people) used across learningHistory & managedMaterials
export const MANAGERS = ['김연구', '이학예', '박학예', '최큐레이터', '정아키비스트', '한사서']

// status ∈ 반영 완료 / 반영 중 / 반영 실패 / 검수중
// version v1.0–v1.x
export const learningHistory = [
  { id: 'l1',  processedAt: '2026-06-22 12:00', name: '메타정보_표준.xlsx',        records: 320, status: '반영 완료', manager: '김연구',      version: 'v1.5' },
  { id: 'l2',  processedAt: '2026-06-21 10:10', name: '유물메타.json',             records: 145, status: '반영 중',   manager: '이학예',      version: 'v1.4' },
  { id: 'l3',  processedAt: '2026-06-20 15:00', name: '신문호외_1960.pdf',         records: 88,  status: '반영 실패', manager: '김연구',      version: 'v1.3' },
  { id: 'l4',  processedAt: '2026-06-19 09:30', name: '민주화운동_사진목록.xlsx',  records: 210, status: '반영 완료', manager: '박학예',      version: 'v1.5' },
  { id: 'l5',  processedAt: '2026-06-18 14:20', name: '경제개발5개년계획서.json',  records: 88,  status: '검수중',    manager: '이학예',      version: 'v1.4' },
  { id: 'l6',  processedAt: '2026-06-17 11:00', name: '근대사_기록물.json',        records: 402, status: '반영 완료', manager: '김연구',      version: 'v1.3' },
  { id: 'l7',  processedAt: '2026-06-16 16:00', name: '독립운동_영상목록.csv',     records: 33,  status: '반영 실패', manager: '최큐레이터',  version: 'v1.2' },
  { id: 'l8',  processedAt: '2026-06-15 10:45', name: '한국전쟁_구술자료.pdf',     records: 179, status: '반영 완료', manager: '박학예',      version: 'v1.4' },
  { id: 'l9',  processedAt: '2026-06-14 13:10', name: '4·19혁명_포스터.xlsx',      records: 34,  status: '반영 중',   manager: '이학예',      version: 'v1.3' },
  { id: 'l10', processedAt: '2026-06-13 08:50', name: '문화재_메타데이터.json',    records: 268, status: '반영 완료', manager: '김연구',      version: 'v1.2' },
  { id: 'l11', processedAt: '2026-06-12 14:30', name: '현대사_증언록.csv',         records: 130, status: '반영 완료', manager: '정아키비스트', version: 'v1.3' },
  { id: 'l12', processedAt: '2026-06-11 11:00', name: '6월민주항쟁_사진.pdf',      records: 120, status: '반영 완료', manager: '한사서',      version: 'v1.2' },
  { id: 'l13', processedAt: '2026-06-10 15:30', name: '독립선언서_원본.pdf',       records: 12,  status: '반영 완료', manager: '박학예',      version: 'v1.5' },
  { id: 'l14', processedAt: '2026-06-09 10:00', name: '남북정상회담_자료.xlsx',    records: 56,  status: '검수중',    manager: '최큐레이터',  version: 'v1.1' },
  { id: 'l15', processedAt: '2026-06-08 14:20', name: '광주민주화운동_기록.pdf',   records: 95,  status: '반영 완료', manager: '김연구',      version: 'v1.4' },
  { id: 'l16', processedAt: '2026-06-07 09:30', name: '산업화시대_사진집.pdf',     records: 52,  status: '반영 완료', manager: '이학예',      version: 'v1.3' },
  { id: 'l17', processedAt: '2026-06-06 15:00', name: '제헌국회_회의록.pdf',       records: 63,  status: '반영 중',   manager: '정아키비스트', version: 'v1.2' },
  { id: 'l18', processedAt: '2026-06-05 11:30', name: '유물대장_001.pdf',          records: 438, status: '반영 완료', manager: '한사서',      version: 'v1.5' },
  { id: 'l19', processedAt: '2026-06-04 14:00', name: '기록문서_국회개원.pdf',     records: 24,  status: '반영 완료', manager: '박학예',      version: 'v1.4' },
  { id: 'l20', processedAt: '2026-06-03 09:00', name: '조선시대_지도모음.pdf',     records: 47,  status: '반영 실패', manager: '최큐레이터',  version: 'v1.1' },
  { id: 'l21', processedAt: '2026-06-02 15:00', name: '전시도록_1945.pdf',         records: 80,  status: '반영 완료', manager: '김연구',      version: 'v1.3' },
  { id: 'l22', processedAt: '2026-06-01 10:30', name: '사진자료_묶음.jpg',         records: 64,  status: '검수중',    manager: '이학예',      version: 'v1.2' },
  { id: 'l23', processedAt: '2026-05-31 14:00', name: '원본사진_서울수복.jpg',     records: 45,  status: '반영 완료', manager: '정아키비스트', version: 'v1.1' },
  { id: 'l24', processedAt: '2026-05-30 11:00', name: '고문서_을사조약.jpg',       records: 8,   status: '반영 완료', manager: '한사서',      version: 'v1.0' },
  { id: 'l25', processedAt: '2026-05-29 09:30', name: '사진첩_광복절.jpg',         records: 37,  status: '반영 완료', manager: '박학예',      version: 'v1.0' },
]
