/**
 * openedProjects.js — 이번 방문에서 이미 연 프로젝트를 기억한다(round10, 2026-09-16 사용자 결정).
 *
 * [왜 필요한가]
 * 프로젝트 상세(/library/:id)는 **다시 열릴 때마다** 서버에 openProject 를 부른다 — 목록에서
 * 카드를 눌러 들어올 때만 붙는 값(navigate state)이 링크로 되돌아올 때는 없기 때문이다.
 * 그래서 잠긴 프로젝트에서는 산출물 상세를 열었다가 「이전 화면 돌아가기」를 누르면 상세로
 * 오다가 401 을 만나 목록으로 튕겼다 — **들어간 뒤에는 화면을 벗어날 수 없었다.**
 * 그렇다고 되돌아올 때마다 암호를 다시 묻는 것도 사용자가 원하는 바가 아니다(같은 결정).
 *
 * [그래서 어디까지 기억하나 — 결정 2 와의 관계]
 * 결정 2 는 「암호는 기억하지 않는다. 열 때마다 묻는다 — 세션·쿠키·서버 어디에도 통과 상태를
 * 남기지 않는다」이다. 이 모듈은 그 선을 지킨다:
 *   - **암호를 저장하지 않는다.** 저장하는 것은 이미 서버가 내어 준 프로젝트 메타뿐이다.
 *   - **모듈 메모리에만 둔다.** sessionStorage·localStorage·쿠키를 쓰지 않으므로 새로고침·
 *     새 탭·앱 재진입에는 **남지 않는다** — 그때는 다시 묻는다.
 * 즉 「열 때마다」의 「한 번」이 **앱을 새로 여는 것**까지로 넓어질 뿐, 통과 상태가 어딘가에
 * 영속되지는 않는다.
 *
 * [계정이 바뀌면 지운다]
 * 앞 사람이 연 프로젝트가 다음 사람에게 그대로 열리면 안 된다. 로그아웃·세션 만료 경로가
 * 부르는 clearOpenedProjects() 로 통째로 비운다(AuthProvider 가 배선한다).
 */

const opened = new Map()

/** 서버가 열어 준 프로젝트를 이번 방문 동안 기억한다. */
export function rememberOpenedProject(projectId, project) {
  if (!projectId || !project) return
  opened.set(projectId, project)
}

/** 이번 방문에서 이미 연 프로젝트면 그 메타를 돌려준다(없으면 null). */
export function recallOpenedProject(projectId) {
  return opened.get(projectId) ?? null
}

/** 로그아웃·세션 만료 — 다음 사람에게 넘어가지 않도록 전부 비운다. */
export function clearOpenedProjects() {
  opened.clear()
}
