import { Link } from 'react-router-dom'
import Button from '../components/Button.jsx'

/**
 * 이 파일의 책임: 존재하지 않는 경로(* 폴백 라우트)에 대한 404 안내.
 *
 * 퍼블 10화면에 404 대응물이 없다. 그래서 §5.6 규칙 2에 따라 퍼블 클래스가 아니라
 * Tailwind 로 쓴다 — 퍼블에 없는 것을 퍼블 명명 규칙으로 새로 만들지 않는다.
 *
 * 이 라운드에 바뀐 것은 마크업이 아니라 스케일과 토큰이다.
 *  - spacing 키의 의미가 1 = 0.25rem 에서 1 = 1px(@루트 20px)로 바뀌었으므로
 *    기존 키를 ×4 해 픽셀 등가를 유지한다(py-24→py-96, px-6→px-24, mt-4→mt-16,
 *    mt-1.5→mt-6, mt-6→mt-24). 그대로 두면 여백이 1/4로 줄어 화면이 무너진다.
 *  - fontSize 는 퍼블과 같은 숫자 키(=px)로 적는다. text-5xl(48px)→text-48,
 *    text-lg(18px)→text-18, text-sm(14px)→text-14 로 픽셀 값을 유지했다.
 *  - 색은 하드코딩도, 임의값 문법(text-[var(--gray70)])도 쓰지 않는다. R6d-02 가 만든
 *    브리지 키(text-pub-gray70)를 쓴다 — 같은 라운드 안에서 같은 토큰을 두 문법으로
 *    적으면 나중에 일괄 치환이 불가능해진다. 본문 글자색은 base 레이어의
 *    html,body{color:var(--black)} 를 그대로 물려받으므로 클래스를 붙이지 않는다.
 */
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-96 px-24">
      <p className="text-48 font-extrabold text-primary">404</p>
      <p className="mt-16 text-18 font-bold">페이지를 찾을 수 없습니다</p>
      <p className="mt-6 text-14 text-pub-gray70">요청하신 주소가 변경되었거나 존재하지 않습니다.</p>
      <Link to="/" className="mt-24">
        <Button variant="primary" size="md">홈으로</Button>
      </Link>
    </div>
  )
}
