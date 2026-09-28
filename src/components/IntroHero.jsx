// 이 파일의 책임: 퍼블 main.html의 .intro_hero(오브 + 워드마크 + 부제)를 렌더한다.
// / (Home)와 /search (SearchNav)가 문자 단위로 같은 히어로를 쓰므로 단일 출처로 둔다.
// 한쪽만 고치면 조용히 어긋나는 사고를 파일 단위로 반복하지 않기 위한 분리다.
import introOrb from '../assets/layout/intro_orb_combined.png'
import logoWordmark from '../assets/layout/logo_wordmark.svg'

export default function IntroHero() {
  return (
    <div className="intro_hero">
      {/* 장식 이미지 — 의미는 옆 워드마크가 전달하므로 alt=""(퍼블 main.html:69와 동일) */}
      <img src={introOrb} className="intro_orb" alt="" />
      <div className="intro_logo_lockup">
        <img src={logoWordmark} alt="SA:I" className="intro_wordmark" />
        <p className="intro_subtitle">학예 업무를 위한 근현대사 지능형 학예 지식 플랫폼</p>
      </div>
    </div>
  )
}
