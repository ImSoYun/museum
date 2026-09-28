/**
 * 이 파일의 책임: prod에서 감출 경로의 **본문만** 준비중으로 바꾸는 페이지 레벨 게이트
 * (round06f 갈래 E, spec §10.1).
 *
 * 왜 셸(AppShell)만으로 부족한가 — AppShell은 <main> 안의 <Outlet>을 통째로
 * <ComingSoon/>으로 갈아치운다. 그러면 그 경로가 속한 탭줄까지 함께 사라진다:
 * /search/output이면 검색바와 page_tabs가, /system/*이면 SystemTabs가 그렇다.
 * round06e는 그 부작용을 "탭을 목록에서 빼는" 방식으로 덮었지만, 사용자 요구는
 * 정반대였다 — "탭은 그대로 두고 누르면 준비중이 나오게 하라"(spec §2-5).
 * 탭을 남기려면 게이트가 탭줄 **안쪽**에 있어야 한다. 그 자리가 이 컴포넌트다.
 *
 * 판정 규칙 자체는 재구현하지 않고 레지스트리(data/envGates.js)의 isEnvHidden에
 * 위임한다 — "무엇을 숨기는가"의 정본은 계속 한 곳이다(R6F-19). 이 컴포넌트가
 * 소유하는 것은 "어디서 판정하는가"뿐이고, 그 분배의 정본은 같은 레지스트리 파일의
 * PAGE_LEVEL_PREFIXES다.
 *
 * AuthContext Provider 밖에서도 안전하다 — useAuth()의 폴백 DEFAULT_VALUE가
 * appEnv:'local'이라(AuthContext.jsx:61) 아무것도 숨기지 않는다. 부팅 중 appEnv가
 * 아직 null인 구간도 같은 이유로 통과한다(fail-open — 이 게이팅은 보안 경계가 아니고,
 * /system/*은 RequireAuth의 role 게이트가 별도로 막는다, spec §10.5).
 */
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { isEnvHidden } from '../data/envGates.js'
import ComingSoon from './ComingSoon.jsx'

export default function EnvGate({ children }) {
  const { pathname } = useLocation()
  const { appEnv } = useAuth()
  return isEnvHidden(pathname, appEnv) ? <ComingSoon /> : children
}
