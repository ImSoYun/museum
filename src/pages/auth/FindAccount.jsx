// 이 파일의 책임: 아이디·비밀번호 찾기 화면(퍼블 page/find.html의 .card 이하)을 렌더한다.
// 껍데기(.auth_wrap / .auth_inner / 로고 / 푸터)는 AuthLayout이 그린다.
// 탭은 공용 Tabs의 segmented 변형을 쓰고(WAI-ARIA Tabs 패턴 · 자동 활성화 · 방향키 순환),
// 패널의 노출/감춤만 이 화면이 active state로 제어한다 — 여기까지는 퍼블 find.html과 같다.
//
// round06c-ext D2d(spec §9.3·§1.4③·R2.4·R2.8 — 메일 없음): 메일 발송 인프라가 스택에
// 없고 셀프 복구(비밀번호 재설정 링크 자동발송 등)도 명시적 비목표로 확정됐다(§0 R2.8).
// round06d는 find.html 그대로 이메일 입력 폼을 이식했고, round06c 리뷰 fix3은 그 폼
// 위의 안내 문구만 "관리자에게 문의"로 고쳤을 뿐 입력·제출 자체는 남겨 뒀다(이전 리비전
// 참고). 이번 라운드에서 그 절충을 걷어내고 폼·입력을 전면 제거한다 — 이름·이메일·아이디를
// 입력받아 "확인 후 관리자 경유"로 보내는 흐름 자체가 관리자에게 직접 문의하라는 안내
// 하나로 대체되므로 더 이상 필요 없다. 탭 골격(tab_seg)은 퍼블 그대로 유지하되 각
// tab_seg_panel의 <form>과 모든 <input>을 지운다 — 네트워크 호출도 상태도 0이다.
// 이 화면은 퍼블 find.html에 없는 편차다(디자인 참조 블록 미참조 사유 #3, spec 근거 상동).
import { Link } from 'react-router-dom'
import { useState } from 'react'
import Tabs from '../../components/Tabs.jsx'
import icArrowLeft from '../../assets/icons/ic_arrow_left.svg'

// 탭 key ↔ 퍼블 id 대응을 한 곳에 모은다. 패널의 id·aria-labelledby가 여기서 파생된다.
const TABS = [
  { key: 'findid', label: '아이디 찾기', id: 'tab_findid', panelId: 'panel_findid' },
  { key: 'findpw', label: '비밀번호 찾기', id: 'tab_findpw', panelId: 'panel_findpw' },
]

// 두 패널이 완전히 같은 안내를 보여준다 — 이름/이메일/아이디를 나눠 받던 옛 흐름과 달리
// "아이디 찾기"와 "비밀번호 찾기"를 관리자 창구 하나로 합쳤으므로 패널별 문구를 분리할
// 이유가 없다(round06d처럼 두 문구를 따로 쓰면 관리자 문의라는 같은 결론을 두 번 적을 뿐이다).
const CONTACT_NOTICE = '아이디·비밀번호는 상위 관리자에게 문의해 발급/확인받을 수 있습니다.'

export default function FindAccount() {
  // 초기값은 'findid' — 퍼블이 aria-selected="true"를 아이디 찾기에 준다.
  const [active, setActive] = useState('findid')

  return (
    <div className="card">
      <div className="auth_head">
        <Link to="/login" className="ic_back" aria-label="뒤로가기">
          <img src={icArrowLeft} alt="" className="ic_back_img" />
        </Link>
        <h2 className="auth_head_tit">아이디·비밀번호 찾기</h2>
      </div>

      <Tabs
        variant="segmented"
        ariaLabel="아이디·비밀번호 찾기"
        tabs={TABS}
        active={active}
        onChange={setActive}
      />

      {/* 패널 감춤은 hidden 속성으로 한다 — 조건부 렌더로 바꾸면 패널이 DOM에서 사라져
          aria-controls가 존재하지 않는 id를 가리키고 .tab_seg_panel[hidden] 규칙도 무의미해진다.
          .tab_seg_panel과 .form_section을 함께 갖는 것도 퍼블 그대로다(세로 리듬 gap:1.2rem).
          form_section 클래스는 남기되 내부에는 더 이상 form/input이 없다 — 이 클래스가 주는
          레이아웃(세로 gap)만 재사용한다. */}
      <div
        className="tab_seg_panel form_section"
        id="panel_findid"
        role="tabpanel"
        aria-labelledby="tab_findid"
        hidden={active !== 'findid'}
      >
        <p className="notice_box">{CONTACT_NOTICE}</p>
        <Link to="/login" className="btn btn_lg btn_primary">로그인 화면으로</Link>
      </div>

      <div
        className="tab_seg_panel form_section"
        id="panel_findpw"
        role="tabpanel"
        aria-labelledby="tab_findpw"
        hidden={active !== 'findpw'}
      >
        <p className="notice_box">{CONTACT_NOTICE}</p>
        <Link to="/login" className="btn btn_lg btn_primary">로그인 화면으로</Link>
      </div>
    </div>
  )
}
