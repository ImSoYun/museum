// 이 파일의 책임: 상태 어휘 → 퍼블 상태 표기 클래스 매핑.
// 퍼블은 같은 어휘를 두 표현으로 쓴다 — 알약형 `.status_tag.ty_*`(점 + 배경색)와
// 텍스트형 `.data_status_text.ty_*`(글자색만). 어느 쪽을 쓸지는 화면·열마다 다르므로
// 표기 방식을 variant로 받고 어휘→토큰 매핑은 한 곳에서만 관리한다.
//
// 왜 warn이 없나 — 퍼블 3토큰(done/review/fail)에 주의 계열이 없다. '처리 대기'·'미완료'·
// '미등록'은 실패도 완료도 아닌 진행 계열이라 ty_review에 흡수했다. 어휘 자체가 셀에
// 그대로 찍히므로 색이 같아도 판독이 되고, "퍼블에 없는 것을 만들지 않는다"는 방침에 맞는다.
const TONE_BY_STATUS = {
  '완료': 'ty_done',
  '반영 완료': 'ty_done',
  '도움됨': 'ty_done',

  '검수중': 'ty_review',
  '반영 중': 'ty_review',
  '처리중': 'ty_review',
  '학습중': 'ty_review',
  '처리 대기': 'ty_review',
  '미완료': 'ty_review',
  '미등록': 'ty_review',
  '등록': 'ty_review',

  '실패': 'ty_fail',
  '반영 실패': 'ty_fail',
  '도움되지 않음': 'ty_fail',
}

/**
 * StatusBadge — 상태 표기.
 * Props:
 *   status  {string} — 상태 어휘. 매핑에 없으면 토큰 없이 기본 클래스만 붙는다.
 *   variant {'tag'|'text'} — 'tag'(기본)=알약형, 'text'=텍스트형.
 */
export default function StatusBadge({ status, variant = 'tag' }) {
  const tone = TONE_BY_STATUS[status]
  // 퍼블의 텍스트형은 td 자체에 클래스를 건다. 우리는 셀 렌더러가 내용만 반환하므로
  // span으로 감싼다 — color 선언뿐이라 시각 결과는 동일하다.
  const base = variant === 'text' ? 'data_status_text' : 'status_tag'
  return <span className={[base, tone].filter(Boolean).join(' ')}>{status}</span>
}
