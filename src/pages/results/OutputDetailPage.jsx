// 이 파일의 책임: 산출물 상세 화면 본문(round07f) — 디스크립션 749:6351.
//   1 돌아가기 — /search/output 으로 이동(navigate(-1)이 아니다 — 딥링크로
//     바로 들어오면 뒤로 갈 곳이 없다). 지금 주소의 ?c=(대화 id)는 그대로
//     이어 나른다(최종 리뷰 I-1 — 아래 backTo 주석)
//   2 타이틀 — 종류 뱃지 · 제목 · [형식, 크기]
//   3 선택된 자료 — selection을 노드명+건수 뱃지로. 클릭 시 상세(간이 목록)
//   4 원문 뷰어 — OutputViewer.jsx(doc(JSONB)만 읽는다, 파일은 파싱하지 않는다)
//   5 다운로드
//
// 진입이 곧 열람이다 — 목록의 상세보기가 예전에 PATCH /outputs/{id}/open을
// 불렀던 것과 같은 자리를, 이제는 이 화면의 마운트가 대신한다.
//
// 열람 기록 성공 시 useScenario().bumpOutputsVersion()도 함께 올린다(리뷰 반영,
// Important). 삭제된 OutputDetailModal은 성공 시 onOpened 콜백으로 이 신호를
// 부모(OutputTab)까지 올렸었다 — 그래야 신규 건수에서도 즉시 빠진다(수동 새로고침을
// 기다리지 않는다). SearchFlowLayout의 탭 뱃지는 outputsVersion을 구독해 new_count를
// 다시 읽으므로(SearchFlowLayout.jsx), 이 화면이 그 신호를 올리지 않으면 상세 열람으로
// 신규를 해제해도(카드 테두리는 목록 재조회 시 사라지지만) 뱃지 숫자는 다음 삭제·생성
// 전까지 그대로 남는다 — 레이아웃 라우트라 탭 이동으로는 리마운트되지 않기 때문이다.
import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Download } from 'lucide-react'
import { useToast } from '../../components/useToast.js'
import { useScenario } from '../../context/ScenarioContext.jsx'
import { getOutput, markOutputOpened, downloadOutputFile } from '../../lib/outputsApi.js'
// round10 Task7 사후조치 — 프로젝트 경유(소유자 무관, 스냅샷 소속 판정) 상세·다운로드.
// `?project=`가 있을 때만 쓴다(아래 참조) — 이 화면이 lib/ 모듈 두 개를 같이 갖는
// 것은 페이지 레벨이라 lib/ 간 무의존 규약(모듈끼리는 서로 import하지 않는다) 위반이
// 아니다.
import { getProjectOutput, downloadProjectOutput } from '../../lib/projectsApi.js'
// round11a task-10 — 연표에서 쪽을 찾는다(spec §2.5). 이 화면이 lib/ 모듈 셋을
// 함께 갖는 것은 페이지 레벨이라 lib/ 간 무의존 규약 위반이 아니다(위 주석과
// 같은 근거). **공유 열람(`?project=`)에서는 쓰지 않는다** — 연표 라우트에
// 프로젝트 경유 짝이 없다(task-9 리뷰 확인).
import { locateEra } from '../../lib/chronologyApi.js'
import { fetchDisplayKeys } from '../../lib/artifactKeysApi.js'
import { triggerBrowserDownload } from '../../lib/downloadFile.js'
import { formatBytes } from './OutputCard.jsx'
import Modal from '../../components/Modal.jsx'
import MaterialModal from './MaterialModal.jsx'
import OutputViewer from './OutputViewer.jsx'
import ChronologyViewer from './ChronologyViewer.jsx'

// 종류 뱃지 문구 — caption 은 「설명문」이 아니라 **「캡션」**이다(피그마 프레임
// 695:105902 · 상세 749:6491). 목록 필터 탭은 「설명문」 그대로 두는 것이 정본이며,
// 그 어긋남은 사용자 결정이다(round07f spec §2 결정 3 · §4.3 — OutputList.jsx의
// TABS 주석에 같은 근거를 적어 두었다). 둘을 임의로 통일하지 말 것.
//
// round07i 리뷰 반영 — 이 맵은 OutputCard.jsx 에도 똑같이 있다(리터럴 하나
// 공유하자고 새 모듈을 두지 않는다). exhibition 이 처음에 빠져 있던 것이 "같은
// 맵이 두 파일에 있다"는 사실 자체가 놓치기 쉬움의 원인이었다는 증거다 —
// **새 kind 를 추가하면 반드시 아래 다섯 곳을 함께 고칠 것:**
//   ① 이 파일의 KIND_LABEL(상세 뱃지)
//   ② OutputCard.jsx 의 KIND_LABEL(카드 뱃지)
//   ③ OutputList.jsx 의 TABS(목록 필터 탭)
//   ④ pages/results/chatTasks.js 의 CHAT_TASKS·CHAT_TASK_ORDER(AI 학예 도우미
//      작업선택 — round07k 에서 새로 생긴 kind 키 레지스트리)
//   ⑤ lib/outputTitles.js 의 defaultOutputTitle 분기(제목 기본값 — round07k
//      최종 리뷰에서 발견: 이미 round07i 부터 있었는데 이 체크리스트에 없었다)
// round07i 감사 C — ③이 이 목록에 없어서 정확히 그 일이 또 일어났다: 두 맵에는
// exhibition 이 들어왔는데 탭에는 끝내 안 들어와, 특별전시 산출물이 「전시자료」
// 탭에서 사라져 있었다. round07k 는 ④를 새로 더했고 ⑤는 처음부터 있었지만 이
// 체크리스트가 「세 곳」에 멈춰 있어 둘 다 빠져 있었다 — 그래서 다섯으로 고친다.
//
// round10b B-3(시트 #7·#8) — exhibit 의 라벨을 「전시자료」→「학예 기획 자료」로
// 기획 요청에 따라 개명한다(다섯 곳을 동시에 — OutputCard.jsx 주석 참조). 근거는
// `19_round07e-디스크립션-대조표.md`에 남겼다.
const KIND_LABEL = { exhibit: '학예 기획 자료', caption: '캡션', exhibition: '특별전시' }

/**
 * `GET /chronology/locate` 의 `found:false` 사유를 **사람 문구로 옮기는 자리**
 * (round11a task-10 1차 수정 HIGH-1).
 *
 * 서버가 주는 `reason` 은 문장이 아니라 **열거 코드 둘뿐**이다 —
 * `out_of_range`(연표가 다루는 1948~2008 밖) · `unparsable`(자유서술·빈 값 등
 * 연도를 전혀 못 뽑음). 근거: `domain/models.NotLocated` 도크스트링 ·
 * `chronology/rules.locate_page`.
 *
 * **코드를 그대로 화면에 찍지 않는다.** 예전에는 `res.data.reason` 을 사람
 * 문구로 취급해, 「1936」·「일제강점기」·`subject_era` 가 빈 유물을 누르면
 * 화면에 `unparsable` 이라는 영어 코드가 떴다(spec §2.5 표 마지막 두 행 미충족).
 *
 * 번역을 서버가 아니라 **화면**이 갖는 이유: 사유 문구는 이 화면의 말투에
 * 속한다(같은 코드를 다른 화면이 다르게 풀어 쓸 수 있고, 서버는 DOCX·API
 * 소비자에게도 같은 값을 준다). 대신 서버가 코드를 늘렸을 때 **조용히 코드가
 * 새어 나가지 않도록** 맵에 없는 값은 기본 문구로 떨어뜨린다(코딩표준 §6).
 */
const LOCATE_REASON_TEXT = {
  out_of_range: '연표(1948~2008)가 다루지 않는 시대입니다',
  unparsable: '시대 표기에서 연도를 읽지 못했습니다',
}
const LOCATE_REASON_FALLBACK = '연표에서 쪽을 찾지 못했습니다'

export function locateReasonText(reason) {
  return LOCATE_REASON_TEXT[reason] || LOCATE_REASON_FALLBACK
}

export default function OutputDetailPage() {
  const { outputId } = useParams()
  // round07f 최종 리뷰 I-1 — **돌아가기도 `?c=`를 이어 나른다.**
  //
  // 목록(OutputList.openDetail)이 `c`를 실어 보내 준 것을, 돌아갈 때 여기서
  // 떨어뜨리면 절반만 고친 것이 된다 — 상세에서 「이전 화면 돌아가기」를 누른
  // 순간 검색 세션이 사라진다(검색바 빈칸 · 「표시할 검색 결과가 없습니다」 ·
  // 빈 대화). 딥링크·북마크로 `?c=`를 달고 들어온 경우에도 그대로 돌려준다.
  //
  // navigate(-1)이 아니라 절대 경로인 이유는 파일 상단 주석 그대로다 —
  // 딥링크로 바로 들어오면 뒤로 갈 곳이 없다.
  const [searchParams] = useSearchParams()
  const cid = searchParams.get('c')
  // round10 Task7 사후조치 — ProjectOutputList.openDetail이 `?project=`를 실어
  // 보낸다(대화 id가 아니라 프로젝트 스냅샷에 속한 목록이라 `?c=`를 쓰지 않는다,
  // ProjectOutputList.jsx 주석 참조). 이 값이 있으면 아래 세 API 호출 전부를
  // 프로젝트 경유(소유자 무관)로 바꾼다.
  const projectId = searchParams.get('project')
  // 돌아가기 — 프로젝트 문맥이 `?c=`보다 우선한다. 프로젝트 스냅샷 목록에는
  // 애초에 대화 개념이 없어(ProjectOutputList) 두 파라미터가 동시에 올 일이 없지만,
  // 있다면 지금 열람 중인 문맥(프로젝트)으로 돌아가는 것이 자연스럽다 — 프로젝트
  // 상세(/library/:id)가 산출물생성 탭 하단에서 이 화면으로 왔으므로 그 화면으로
  // 되돌아가는 것이 "이전 화면"의 실제 의미다.
  // round10(2026-09-16 라이브 검증, 사용자 지적) — 프로젝트로 돌아갈 때 `?tab=output`
  // 을 달아 **왔던 자리(산출물생성 탭)** 로 되돌린다. 상세의 탭은 라우트가 아니라 지역
  // 상태라(한 화면이다) 주소만으로는 복원되지 않아, 그냥 `/library/:id` 로 보내면 기본
  // 탭인 검색결과가 열려 산출물 목록에서 왔다는 맥락이 끊긴다.
  const backTo = projectId
    ? `/library/${encodeURIComponent(projectId)}?tab=output`
    : cid ? `/search/output?c=${encodeURIComponent(cid)}` : '/search/output'
  const { showToast } = useToast()
  const { bumpOutputsVersion } = useScenario()
  const [output, setOutput] = useState(null)
  const [notice, setNotice] = useState(null)
  // 선택자료 칩 → 그 노드의 idnbr 목록(간이 모달) → 자료 한 건(MaterialModal).
  //
  // spec §3.2는 「NodeModal 재사용」이라 적었으나 실물 시그니처가
  // NodeModal({ node, items, onClose, onConfirm })라 **자료 배열 전체(items)** 를
  // 받아야 그린다. 이 화면이 가진 것은 selection의 {node, idnbrs} — id
  // 문자열뿐이라 items를 채울 수 없다. 그래서 두 겹으로 열는다: 간이 목록은
  // 공용 Modal로 직접 그리고, 자료 한 건은 MaterialModal이 열어 준다 —
  // MaterialModal은 material.id만 있으면 스스로 fetchArtifactDetail을 부른다.
  const [openGroup, setOpenGroup] = useState(null)
  const [openMaterial, setOpenMaterial] = useState(null)
  // round07h — 노드 목록을 열 때 자료번호 대신 유물 이름을 보여주려고, 그 노드의
  // idnbrs 전체를 한 번에 조회해 둔다.
  // ★ 자료마다 부르지 않는다 — 30건이면 왕복 30번이 된다.
  const [names, setNames] = useState({})
  // round11a task-10 — 우측 「대한민국사 원문 뷰어」의 상태.
  //
  // `null` 이면 **뷰어가 없다** — 진입 시가 그렇다(디스크립션 ④ 「진입시 기본
  // 펼침 x」). 좌측에서 유물명을 누르면 아래 모양이 된다:
  //   { target: 항목, vol, page, notice }
  // `vol`·`page` 가 있으면 그 쪽을 열고, 없으면 `notice` 만 그린다(쪽을 못
  // 찾은 경우 — spec §2.5 표의 마지막 두 행 「뷰어는 안 움직이고 안내만」).
  // 한 번 열리면 **닫지 않는다** — 접는 버튼은 피그마에 없다.
  const [chronology, setChronology] = useState(null)
  // 쪽 찾기 경합 방지. 사용자가 답을 기다리는 동안 다른 유물명을 누르면 대상이
  // 그 유물로 바뀌는데(spec §2.4), 먼저 띄운 요청이 늦게 돌아와 화면을 덮으면
  // 「지금 대상」과 열린 쪽이 어긋난다. 마지막 요청의 표만 받는다.
  const locateSeq = useRef(0)

  useEffect(() => {
    if (!openGroup?.idnbrs?.length) return
    let alive = true
    fetchDisplayKeys(openGroup.idnbrs).then((res) => {
      if (alive) setNames(res.keys)
    })
    return () => { alive = false }
  }, [openGroup])

  useEffect(() => {
    let alive = true
    // round07f 최종 리뷰 M-1 — **id가 바뀌면 앞 산출물의 흔적부터 지운다.**
    //
    // 라우트 패턴이 같아 `:outputId`만 달라지면 이 컴포넌트는 리마운트되지 않는다
    // — 상태가 그대로 이어진다. 그래서 없는 id로 한 번 실패해 notice가 남으면,
    // 그다음 정상 id로 옮겨도 `if (notice) return <p>{notice}</p>`가 먼저 걸려
    // **옛 사유 문구가 새 산출물을 영구히 덮는다**(리뷰 실측 stuck=true, ok=false).
    // 낡은 화면이 아니라 「틀린 사유」가 남는 것이라 더 나쁘다.
    setNotice(null)
    setOutput(null)
    // round10 Task7 사후조치 — `?project=`가 있으면 소유자 전용 GET
    // /outputs/{id} 대신 프로젝트 경유(소유 무관, 스냅샷 소속 판정) 상세를
    // 부른다. 응답 모양은 서버 쪽 _summarize 재사용 덕에 같다(res.data 처리는
    // 아래에서 분기 없이 그대로 공유한다).
    const request = projectId ? getProjectOutput(projectId, outputId) : getOutput(outputId)
    request.then((res) => {
      if (!alive) return
      if (!res.ok) { setNotice(res.notice); return }
      setOutput(res.data)
      // round10 Task7 사후조치 — 프로젝트 경유일 때는 markOutputOpened(PATCH
      // /outputs/{id}/open)을 **부르지 않는다.** 그 라우트도 소유자 전용이라
      // 남의 프로젝트에서 부르면 403이고(그 실패를 토스트로 삼키는 것으로
      // "해결"하면 매번 조용한 실패가 남는다), 애초에 스냅샷 목록에는 「신규」
      // 개념 자체가 없다(OutputCard.isNew 의 `!readOnly` 가드) — 해제할 "신규"
      // 상태가 없으므로 이 호출은 프로젝트 문맥에서 의미가 없다.
      // (round10 재리뷰 — 예전 주석은 "스냅샷 메타에는 opened_at 필드가 없다"고
      //  적었으나 최종리뷰 I-3 이후 서버가 그 값을 싣는다. 근거는 필드 부재가
      //  아니라 개념 부재이고, 화면 쪽 방어는 그 readOnly 가드다.)
      if (projectId) return
      // 이미 열린 것은 서버가 멱등하게 무시한다 — 실패해도 화면은 그대로 둔다
      // (열람 기록 실패로 상세 열람 자체를 막을 이유가 없다). 성공했을 때만
      // bumpOutputsVersion — 실패했는데 올리면 "해제됐다"는 잘못된 뱃지 갱신이 된다.
      markOutputOpened(outputId).then((r) => {
        if (!r.ok) return showToast(r.notice)
        bumpOutputsVersion()
      })
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outputId, projectId])

  if (notice) return <p className="p-6 text-[13px] text-[#5A6173]">{notice}</p>
  if (!output) return <p className="p-6 text-[13px] text-[#5A6173]">불러오는 중…</p>

  const ext = (output.file_name || '').split('.').pop().toUpperCase()

  // 좌측에서 «유물명» 을 눌렀을 때(spec §2.4①) — 그 유물이 「지금 대상」이 되고,
  // 우측 뷰어가 펼쳐지며, 그 유물 `subject_era` 에 맞는 쪽으로 간다.
  //
  // **뷰어를 먼저 펼친다.** 조회가 끝난 뒤에 펼치면, 못 찾은 경우에 아무 일도
  // 일어나지 않은 것처럼 보인다 — 사용자가 「눌렀는데 반응이 없다」로 읽는다.
  const openChronology = (item) => {
    const seq = locateSeq.current + 1
    locateSeq.current = seq
    setChronology({ target: item, vol: null, page: null, notice: '연표에서 쪽을 찾는 중…' })
    // `subject_era` 가 비어도 그대로 보낸다 — 「빈 값이면 안내만」의 사유도
    // 서버가 들고 있다(spec §2.5 표 마지막 행). 여기서 미리 걸러 내면 화면이
    // 스스로 만든 문구와 서버 문구가 갈린다.
    locateEra(item.subject_era || '').then((res) => {
      if (locateSeq.current !== seq) return
      // 조회 자체가 실패한 경우(네트워크·401 …)도 뷰어는 떠 있고 사유가 보인다.
      if (!res.ok) {
        setChronology({ target: item, vol: null, page: null, notice: res.notice })
        return
      }
      if (!res.data?.found) {
        // `found:false` 는 오류가 아니다 — 다만 `reason` 은 **기계 코드**라
        // 그대로 찍으면 화면에 `unparsable` 이 뜬다(위 LOCATE_REASON_TEXT).
        setChronology({
          target: item, vol: null, page: null,
          notice: locateReasonText(res.data?.reason),
        })
        return
      }
      setChronology({ target: item, vol: res.data.vol, page: res.data.page, notice: null })
    })
  }

  const download = async () => {
    // round10 Task7 사후조치 — 프로젝트 경유면 소유자 무관 다운로드를 쓴다
    // (ProjectOutputList.handleDownload와 같은 이유 — outputsApi.downloadOutputFile은
    // 소유자 전용이라 남의 산출물을 403으로 못 받는다).
    const res = projectId
      ? await downloadProjectOutput(projectId, output.id, output.file_name)
      : await downloadOutputFile(output.id, output.file_name)
    if (!res.ok) return showToast(res.notice)
    triggerBrowserDownload(res.blob, res.filename)
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <Link to={backTo} className="text-[16px] text-[#5A6173] w-fit">
        ‹&nbsp;&nbsp;&nbsp;이전 화면 돌아가기
      </Link>

      <div className="flex items-center gap-2">
        <span className={`output_card_kind ${output.kind}`}>{KIND_LABEL[output.kind] || output.kind}</span>
        <b className="text-[24px] text-[#1A1F2B] pl-1.5">
          {output.title} [{ext}, {formatBytes(output.file_bytes)}]
        </b>
      </div>

      {output.selection?.length > 0 && (
        <ul className="flex flex-wrap gap-2 selection_wrap">
          {/* round07i 감사 C — key가 s.node였다. 서버에 올라가는 SelectionGroup은
              **클래스를 떼고 라벨만** 싣기 때문에(OutputTab.buildSelectionPayload)
              서로 다른 클래스의 같은 이름 노드가 한 산출물 안에 나란히 들어올 수
              있다 — 그때 두 <li>가 같은 key를 갖고, React는 한쪽을 재사용하며
              칩 클릭이 엉뚱한 그룹을 여는 상태가 된다. 이 목록은 서버가 준 순서
              그대로이고 정렬·삽입·삭제가 없으므로 인덱스를 함께 붙여 유일하게
              만든다(라벨만으로는 유일성을 보장할 수 없다).

              round07j — 퍼블이 이 <ul>에 `selection_wrap`을 더했다. 클래스는 그쪽을
              받고 key는 위 근거대로 유지한다 — 퍼블 시점(e4087cb)에는 감사 수정이
              없었으므로 `key={s.node}`는 옛 코드를 그대로 옮긴 것이지 판단이 아니다. */}
          {output.selection.map((s, i) => (
            <li key={`${i}:${s.node}`}>
              <button
                type="button"
                onClick={() => setOpenGroup(s)}
                className="flex items-center gap-1.5 h-[28px] px-3 rounded-[5px] bg-primary-100 text-primary-600 text-[12.5px] font-semibold pl-2.5 pr-2.5"
              >
                {s.node} {s.idnbrs.length}건
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* round10 재리뷰 — 뷰어에도 프로젝트 문맥을 내려 준다. 이 페이지가 위에서
          가른 소유자 전용 호출 셋과 같은 이유다: 뷰어의 원문 조회
          (GET /outputs/{id}/doc)도 소유자 전용이라, 넘기지 않으면 남의 프로젝트에서
          본문만 「권한 없음」이 된다. `?project=`가 없으면 null이라 기존 경로 무변경. */}
      {/* round11a task-10 — 2단(spec §2.1). 진입 시에는 우측이 없어 좌측이
          자리를 다 쓰고, 유물명을 누르면 둘로 갈린다. 두 칸의 폭은 시안대로
          **같다**(740:740) — 고정 px 대신 같은 flex 비중으로 둔다(상세 화면은
          가변 폭이고, 고정으로 박으면 좁은 화면에서 넘친다).
          공유 열람(`?project=`)에서는 우측을 아예 만들지 않는다 — 연표 라우트에
          프로젝트 경유 짝이 없다(브리프 「하지 말 것」). */}
      <div className="flex items-start gap-16">
        <div className="flex-1 min-w-0">
          <OutputViewer
            outputId={output.id}
            kind={output.kind}
            projectId={projectId}
            onArtifactPick={projectId ? null : openChronology}
            activeIndex={chronology?.target?.index ?? null}
          />
        </div>
        {chronology && !projectId && (
          <div className="flex-1 min-w-0">
            <ChronologyViewer
              vol={chronology.vol}
              page={chronology.page}
              notice={chronology.notice}
              onPageChange={(page) => setChronology((c) => (c ? { ...c, page } : c))}
            />
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button type="button" className="btn btn_sm btn_darkgray" onClick={download} style={{ height : '40px'}}>
          <Download size={16} />다운로드
        </button>
      </div>

      <Modal
        open={Boolean(openGroup)}
        title={openGroup ? `${openGroup.node} ${openGroup.idnbrs.length}건` : ''}
        onClose={() => setOpenGroup(null)}
        size="sm"
      >
        <ul className="flex flex-wrap gap-2">
          {(openGroup?.idnbrs || []).map((idnbr) => {
            // 이름을 못 얻었으면 자료번호를 그린다. 빈 칸이나 「이름 없음」을 그리지
            // 않는다 — 자료번호도 사용자가 쓸 수 있는 정보다.
            const label = names[idnbr]?.name || idnbr
            return (
              <li key={idnbr}>
                <button
                  type="button"
                  className="rounded-full border border-[#E2E5EE] px-3 py-1 text-[12.5px] hover:bg-[#F7F9FC]"
                  onClick={() => setOpenMaterial({ id: idnbr, title: label, image: null })}
                >
                  {label}
                </button>
              </li>
            )
          })}
        </ul>
      </Modal>

      <MaterialModal material={openMaterial} onClose={() => setOpenMaterial(null)} />
    </div>
  )
}
