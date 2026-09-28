/**
 * 이 파일의 책임: 검색 품질 만족도 평가 위젯(round06f 갈래 C, spec §8.4).
 *
 * 마크업은 퍼블 publish-v2 page/search_result.html L357-428 이식본이다. 문자열 10종만
 * 퍼블 원문과 다르다 — 퍼블이 「됨」·「안 됨」을 세 표기(도움됨/도움 됨/안됨)로 섞어 써서
 * "툴팁을 따른다"만으로는 6점이 결정되지 않는다(L397만 도움됨이고 L391·L403은 도움 됨).
 * 그래서 「됨·안 됨 앞을 항상 띄운다」로 전면 통일했다(§1.4 #6 ②). 이 화면에서 퍼블 원문을
 * 그대로 베끼지 않는 유일한 문자열 결정이다.
 * 4점(보통)의 색이 2·3점과 같은 적색 계열(ty_02)인 것은 퍼블 결함이지만 **퍼블대로 이식**하고
 * 기록만 남긴다 — 디자인 개정 반영은 별도 라운드다(CLAUDE.md §2).
 *
 * 제출 동작은 퍼블에 없어 자체 설계다(§1.4 #4 — 퍼블 js/common.js 는 글자수 카운터뿐이다).
 * 제출 완료 화면의 문구(제목+설명 2줄)는 round10b에서 피그마 전용 프레임 `790:9311`
 * 원문으로 바꿨다 — search_result.html에는 이 상태 자체가 없어(퍼블에 없는 자체 설계)
 * 그 전까지는 임시로 지어 쓰던 문구였다(figma-3자대조.md #3). 구조(제목+설명 2줄)는
 * 이미 맞았고 문구만 정본으로 교체했다.
 * 중복 제출을 DB 로 막지 않으므로(§8.3, 유니크 제약 없음) 클라이언트의 감사 상태가 유일한
 * 방어선이다. 그 상태를 얼마나 오래 유지하느냐가 곧 방어력이라, 리마운트 key 는 부모가
 * searchGenId 로 건다(R6F-22) — request_id 를 key 로 쓰면 페이지를 넘기는 순간 폼이 리셋된다.
 *
 * 최종 리뷰 F2 — 제출 완료 여부("sent")는 이 컴포넌트의 로컬 state 가 아니라
 * ScenarioContext 의 feedbackSent 를 읽고 쓴다(AiBriefCard 의 brief 상태와 동형).
 * SearchResults.jsx 가 loading===true 일 때(예: changePage 도중) 결과 서브트리 전체를
 * 스피너로 바꿔치기해 이 컴포넌트가 언마운트됐다가 loading 이 false 로 돌아오며 다시
 * 마운트된다 — 로컬 state 였다면 그 순간 초기값(false)으로 리셋돼, 페이지 이동 1회만으로
 * 중복 제출 방어선이 사라졌다(리뷰에서 지적된 실제 결함). key={searchGenId}(위 문단)는
 * 여전히 유지한다 — score·comment·busy 같은 폼 입력값은 새 검색마다 초기화돼야 하므로.
 *
 * rating(good/bad)은 보내지 않는다 — 서버가 score 에서 파생한다(R6F-10). 신원도 보내지
 * 않는다(서버가 세션에서만 취득). 제출 실패는 화면을 깨뜨리지 않고 토스트로만 알린다.
 */
import { useState } from 'react'
import { useScenario } from '../../context/ScenarioContext.jsx'
import { useToast } from '../../components/useToast.js'
import { postFeedback } from '../../lib/searchApi.js'
import icInquiry from '../../assets/icons/ic_inquiry.svg'
import icFace1 from '../../assets/icons/ic_rating_face_1.svg'
import icFace2 from '../../assets/icons/ic_rating_face_2.svg'
import icFace3 from '../../assets/icons/ic_rating_face_3.svg'
import icFace4 from '../../assets/icons/ic_rating_face_4.svg'
import icFace5 from '../../assets/icons/ic_rating_face_5.svg'
import icFace6 from '../../assets/icons/ic_rating_face_6.svg'
import icFace7 from '../../assets/icons/ic_rating_face_7.svg'

// 색 계열(tone)은 퍼블 L316-404 그대로다 — 4점이 2·3점과 같은 ty_02 인 것도 포함한다.
const SCORES = [
  { value: 1, tone: 'ty_01', label: '전혀 도움 안 됨', face: icFace1 },
  { value: 2, tone: 'ty_02', label: '도움 안 됨',      face: icFace2 },
  { value: 3, tone: 'ty_02', label: '다소 도움 안 됨',  face: icFace3 },
  { value: 4, tone: 'ty_02', label: '보통',            face: icFace4 },
  { value: 5, tone: 'ty_03', label: '약간 도움 됨',     face: icFace5 },
  { value: 6, tone: 'ty_03', label: '도움 됨',         face: icFace6 },
  { value: 7, tone: 'ty_04', label: '매우 도움 됨',     face: icFace7 },
]

const COMMENT_MAX = 100

export default function RatingWidget() {
  const {
    lastQuery, subjects, conversationId, liveRequestId,
    feedbackSent: sent, setFeedbackSent,
  } = useScenario()
  const { showToast } = useToast()
  const [score, setScore] = useState(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit() {
    if (score == null || busy) return
    setBusy(true)
    try {
      const r = await postFeedback({
        score,
        // 빈 문자열이 아니라 null 을 보낸다 — DB 에 ''(길이 0)와 "의견 없음"이 섞이지 않게 한다.
        comment: comment || null,
        requestId: liveRequestId,
        conversationId,
        query: lastQuery,
        subjects,
      })
      if (r.ok) { setFeedbackSent(true); return }
      showToast(r.notice || '평가 제출에 실패했습니다')
    } catch {
      // postFeedback 은 fetch reject(네트워크 단절·CORS 실패)를 감싸지 않는다.
      // 여기서 잡지 않으면 버려진 프로미스가 unhandled rejection 이 되어 사용자에게는
      // 아무 반응도 없다(코딩표준 §6 침묵 실패). ResultsTab.handleDownload 와 같은 대칭이다.
      showToast('평가 제출에 실패했습니다. 잠시 후 다시 시도하세요.')
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="rating_widget">
        {/* round10b B-2(시트 #3) — 피그마 전용 프레임 790:9311은 두 줄이다(제목+설명).
            구조는 이미 맞았다 — 시트가 두 줄을 쉼표로 이어 한 칸에 옮겨 적었을 뿐이라
            "한 문장으로 합쳐야 하나" 오판이 나왔던 자리다(figma-3자대조.md #3).
            문구만 피그마 원문으로 바꾼다. */}
        <p className="rating_tit">
          <img src={icInquiry} alt="" className="rating_tit_icon" />
          검색 품질 만족도 평가 완료
        </p>
        <p className="rating_desc">해당 검색결과에 대한 만족도 평가가 완료되었습니다!</p>
      </div>
    )
  }

  return (
    <div className="rating_widget">
      <p className="rating_tit">
        <img src={icInquiry} alt="" className="rating_tit_icon" />
        검색 품질 만족도 평가
      </p>
      <p className="rating_desc">AI 서비스 전반이 아닌, 해당 검색 결과에 대해 솔직하게 평가해주시면 서비스 개선에 큰 도움이 됩니다.</p>

      <fieldset className="rating_score_list">
        <legend className="sr_only">검색 결과 만족도 점수 선택(1~7점)</legend>
        {SCORES.map((s) => (
          <label key={s.value} className={`rating_score_btn ${s.tone}`}>
            <span className="rating_score_btn_tooltip">{s.label}</span>
            {/* aria-label 로 접근명을 문구 하나로 고정한다 — label 안에는 툴팁 문구와 숫자가
                함께 있어 접근명이 "전혀 도움 안 됨1" 처럼 붙고, 같은 문구가 아래 캡션에도
                있어 텍스트 기반 조회가 모호해진다. 화면 표시는 그대로다. */}
            <input
              type="radio"
              className="rating_score_input"
              name="rating_score"
              value={s.value}
              aria-label={s.label}
              checked={score === s.value}
              onChange={() => setScore(s.value)}
            />
            <img src={s.face} alt="" className="rating_score_face" />
            <span className="rating_score_num">{s.value}</span>
          </label>
        ))}
      </fieldset>

      <div className="rating_score_caption">
        <span className="txt txt_01">전혀 도움 안 됨</span>
        <span className="txt txt_02">보통</span>
        <span className="txt txt_03">매우 도움 됨</span>
      </div>

      <div className="form_group">
        <label className="form_label" htmlFor="rating_comment">의견 남기기
          <span className="rating_optional">(선택)</span>
        </label>
        <textarea
          id="rating_comment"
          className="form_input rating_comment"
          maxLength={COMMENT_MAX}
          placeholder="내용을 입력하세요"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>

      <div className="rating_submit_row">
        <p className="rating_count">
          <span className="rating_comment_count">{comment.length}</span>
          /{COMMENT_MAX}
        </p>
        <button
          type="button"
          className="btn btn_md btn_primary"
          disabled={score == null || busy}
          onClick={handleSubmit}
        >
          평가제출하기
        </button>
      </div>
    </div>
  )
}
