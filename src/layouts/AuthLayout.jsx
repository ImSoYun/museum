/**
 * 이 파일의 책임: 인증 3화면(login·join·find)의 공통 껍데기.
 * 퍼블 login.html:16-57 · join.html:16-79 · find.html:16-86 이 문자 그대로 공유하는 부분만 담는다.
 *
 * 셸(AppShell)과 형제 계층인 이유: 인증 화면은 LNB가 없고
 * Library/Manage/Admin 세 컨텍스트를 하나도 쓰지 않는다. 셸 안에 넣고 조건부로 LNB를 숨기면
 * 쓰지도 않는 상태 컨테이너 3개가 매번 마운트된다 — 계층을 나누는 편이 의존이 정직하다(spec §7.0.1).
 *
 * .card 와 .auth_head 는 여기 두지 않는다. login은 .card_tit(단순 제목)만 갖고
 * join·find는 .auth_head(뒤로가기 + 제목)를 가져 카드 머리가 서로 다르기 때문이다(spec §7.0.2).
 */
import { Outlet } from 'react-router-dom'
import logoSvg from '../assets/layout/logo.svg'

export default function AuthLayout() {
  return (
    <div className="auth_wrap">
      <main className="auth_inner">
        <h1 className="auth_logo">
          <img src={logoSvg} alt="SA:I - 학예 업무를 위한 근현대사 지능형 학예 지식 플랫폼" className="auth_logo_img" />
        </h1>
        <Outlet />
        <footer className="auth_footer_txt">
          대한민국역사박물관 근현대사 지능형 학예 지식 플랫폼입니다.
        </footer>
      </main>
    </div>
  )
}
