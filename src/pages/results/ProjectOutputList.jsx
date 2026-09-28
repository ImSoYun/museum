// 이 파일의 책임: 프로젝트 상세(ProjectDetail)의 산출물생성 탭 하단 — 저장 당시의
// 산출물 스냅샷을 읽기 전용 카드로 그린다(round10 Task7).
//
// OutputTab.jsx가 이미 그리는 OutputList.jsx를 그대로 쓰지 않는 이유 — 그 목록은
// **지금 로그인한 사람 자신의** 산출물을 대화 id로 걸러 서버에서 읽는다(OutputList.jsx
// 머리주석). 라이브러리는 "모두가 서로의 프로젝트를 본다"(spec §1 결정 1)이므로 남의
// 프로젝트를 열면 그 프로젝트와 아무 상관 없는 내 산출물이 남의 프로젝트 안에 뜬다.
// 그래서 OutputTab은 읽기 전용일 때 자기 OutputList를 그리지 않고(OutputTab.jsx의
// `{!readOnly && <OutputList .../>}`), 상세(ProjectDetail)가 그 자리에 이 컴포넌트를
// 대신 그린다 — 한 화면에 산출물 목록이 정확히 하나만 뜨는 것을 그렇게 보장한다.
//
// listProjectOutputs(projectId)는 "그 프로젝트에 묶인 산출물인가"만 보고 돌려준다
// (소유자 무관 — projects/routes.py). 저장 시점의 묶음이라(spec 결정 11) 그 뒤 같은
// 대화에서 더 만든 산출물은 여기 나타나지 않는다 — 다시 저장해야 반영된다.
//
// 선택·삭제가 없다(OutputCard의 readOnly prop이 체크박스를 지운다) — 서버도 프로젝트
// 경유 삭제를 두지 않는다(spec §5-5 "산출물 삭제: 없앤다 — 서버도 거부한다"). 다운로드는
// downloadProjectOutput(프로젝트 경유 다운로드 — 소유자가 아니어도 받을 수 있다)을 쓴다 —
// outputsApi.downloadOutputFile(소유자 전용)을 쓰면 남의 산출물을 403으로 못 받는다.
//
// ── round10b Task D — variant='chat'(대화 탭 전용 모양) ────────────────────────
// 사용자 지적("산출물 생성 페이지랑 ai학예 페이지가 공유되면 안돼")의 초안은 데이터
// 분리(source 컬럼 신설)로 읽혔지만, 사용자가 바로잡았다(2026-09-17): 「ai 학예
// 도우미에서 만든 산출물도 산출물 관리 페이지에 들어가야해 — 이건 너가 맞았어」.
// 즉 두 탭이 같은 산출물을 보는 지금 동작은 맞고, 문제는 **모양**이었다 — 대화 탭이
// 산출물생성 탭과 똑같은 큰 그리드 카드(+「이 프로젝트에 저장된 산출물」 제목)를
// 그려 두 화면이 구분되지 않았다. `heading` prop(제목만 붙이고 모양은 그대로)은 그
// 지적을 풀지 못해 걷어냈다 — 대신 `variant='chat'`이 피그마 완료 턴 모양
// (figma-695-100384.txt:175-195, ExcelDownloadCard가 정본)으로 통째로 바꾼다:
//   반짝이 + 「요청하신 산출물 생성이 완료되었습니다.」            (한 번만)
//     └ file-text 아이콘 + 설명(summary)                          (건마다)
//        └ 파일명(확장자 제외) · 확장자 뱃지 · 다운로드 아이콘     (건마다)
// 서버에 산출물↔턴 연결이 없어(ProjectDetail.jsx의 chat 탭 주석) 어느 턴에서 만든
// 산출물인지 복원할 수 없다 — 그래서 완료 문구는 한 번만 두고 그 아래 건수만큼
// 반복한다(대화 끝에 한 묶음).
//
// ChatTab.jsx의 CaptionFileCard와 모양은 같지만 그 컴포넌트를 가져다 쓰지 않는다 —
// 그건 지역 상태 턴(turn.result, 서버에 저장되지 않는다)을 그리는 전용 컴포넌트라
// 이 파일이 다루는 서버 output 행과 모양이 다르다. OutputCard.jsx도 고치지 않는다 —
// 그 카드는 산출물생성 탭(그리드)에서도 쓰이므로 고치면 두 화면이 같이 바뀐다.
// 그래서 아래 ChatDoneFileCard를 새로 둔다(이 파일 전용 — 재사용처가 여기 하나뿐이라
// 별도 파일로 뽑지 않는다, ChatTab.jsx의 CaptionFileCard와 같은 관행).
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, FileText } from 'lucide-react'
import OutputCard from './OutputCard.jsx'
import { listProjectOutputs, downloadProjectOutput } from '../../lib/projectsApi.js'
import { triggerBrowserDownload } from '../../lib/downloadFile.js'
import { useToast } from '../../components/useToast.js'
import icSparkle from '../../assets/icons/ic_sparkle.svg'

/** 대화 탭 완료 카드의 파일 부분 — 피그마 ExcelDownloadCard(695:100384, L187-195):
 *  문서 아이콘 · 파일명(확장자 제외) · 확장자 뱃지 · 다운로드 아이콘. 다운로드 버튼의
 *  접근명은 OutputCard.jsx 관행(`${title} 다운로드`)을 그대로 따른다 — 대화 탭·
 *  산출물생성 탭 두 화면이 같은 이름 규칙을 쓰면 시험도 하나로 묶인다. */
function ChatDoneFileCard({ output, onDownload }) {
  const baseName = String(output.file_name || '').replace(/\.[^.]+$/, '')
  const ext = (output.file_name || '').split('.').pop().toUpperCase()
  return (
    <button
      type="button"
      className="flex w-full items-center gap-10 rounded-[10px] border border-[#E2E5EE] bg-white px-12 py-10 text-left"
      onClick={() => onDownload(output)}
      aria-label={`${output.title} 다운로드`}
    >
      <span className="flex h-32 w-32 shrink-0 items-center justify-center rounded-[8px] bg-[#EFF3FB] text-[#3B5BDB]">
        <FileText size={16} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="truncate text-[12.5px] font-bold text-[#1A1F2B]">{baseName}</span>
        <span className="text-[11px] font-bold text-[#8A90A2]">{ext}</span>
      </span>
      <Download size={16} aria-hidden="true" className="shrink-0 text-[#5A6173]" />
    </button>
  )
}

// variant 기본값 'grid' — 산출물생성 탭(기존 큰 그리드 카드, 무변경). 'chat'이면
// 위 완료 턴 모양으로 그린다.
export default function ProjectOutputList({ projectId, variant = 'grid' }) {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loaded, setLoaded] = useState(false)
  // 조회 실패 사유 — 실패했는데도 rows가 그냥 []면 "산출물이 없다"는 안내가 "조회에
  // 실패했다"는 사실을 가린다(코딩표준 §6, 침묵 금지). OutputList.jsx가 빈 상태를
  // "왜 비었는지"로 나누는 것과 같은 이유다.
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    let alive = true
    setLoaded(false)
    setNotice(null)
    listProjectOutputs(projectId).then((res) => {
      if (!alive) return
      setLoaded(true)
      if (!res.ok) {
        setNotice(res.notice)
        showToast(res.notice)
        return
      }
      setRows(res.outputs)
    })
    return () => { alive = false }
    // showToast는 ToastProvider가 매 렌더 새 함수를 주지 않으므로 넣지 않아도
    // 안전하다(OutputList.jsx의 같은 이펙트와 같은 근거).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // OutputList.jsx의 handleDownload와 같은 관용구(다운로드 → triggerBrowserDownload,
  // 실패는 서버 사유를 토스트로) — 다만 소유자 무관 경로(downloadProjectOutput)를 쓴다.
  const handleDownload = async (output) => {
    const res = await downloadProjectOutput(projectId, output.id, output.file_name)
    if (!res.ok) return showToast(res.notice)
    triggerBrowserDownload(res.blob, res.filename)
  }

  // OutputList.jsx의 openDetail과 같은 자리(같은 상세 라우트를 재사용한다) — 다만
  // `?c=`(대화 id)는 싣지 않는다. 이 목록은 대화가 아니라 프로젝트 스냅샷에 속하므로
  // 실을 conversationId 자체가 없다.
  //
  // round10 Task7 사후조치(spec §5-5 위반 수정) — 대신 `?project=projectId`를 싣는다.
  // OutputDetailPage가 이 값을 보고 소유자 전용 API(getOutput·markOutputOpened·
  // downloadOutputFile) 대신 프로젝트 경유(소유 무관, 스냅샷 소속 판정) API로
  // 바꾼다 — 이게 없으면 남의 프로젝트를 열어 「상세보기」를 누른 사람이 그 자리에서
  // 403을 만난다(리뷰가 지적한 실제 버그).
  const openDetail = (output) =>
    navigate(`/search/output/${output.id}?project=${encodeURIComponent(projectId)}`)

  // round10b Task D — 제목(section_tit)을 걷어냈다. 로딩·조회실패·0건 세 구간은
  // variant 와 무관하게 똑같은 안내 한 줄이다(코딩표준 §6 — "없다"와 "못 불러왔다"를
  // 가르는 notice 구분은 그대로 둔다). 감싸지 않고 <p> 하나만 돌려준다 — 산출물생성
  // 탭(variant='grid')의 DOM·모양이 한 군데도 바뀌면 안 되기 때문이다.
  if (!loaded) return <p className="output_list_empty">불러오는 중…</p>
  if (notice) return <p className="output_list_empty">{notice}</p>
  if (rows.length === 0) {
    return <p className="output_list_empty">이 프로젝트에 저장된 산출물이 없습니다.</p>
  }

  if (variant === 'chat') {
    // 완료 문구는 산출물이 실제로 있을 때만(위 세 조기 반환을 지난 뒤) 한 번 그리고,
    // 설명(summary)+파일 카드는 건수만큼 반복한다 — 서버에 산출물↔턴 연결이 없어
    // 어느 턴에서 만든 산출물인지 복원할 수 없다(이 파일 머리 주석 round10b Task D).
    return (
      <div className="flex flex-col gap-16">
        <p className="flex items-center gap-6 font-bold">
          <img src={icSparkle} alt="" className="w-16 h-16 shrink-0" />
          요청하신 산출물 생성이 완료되었습니다.
        </p>
        {rows.map((row) => (
          <div key={row.id} className="flex flex-col gap-6">
            <p className="flex items-start gap-6 text-[12.5px] text-[#5A6173]">
              <FileText size={14} aria-hidden="true" className="mt-1 shrink-0" />
              {row.summary}
            </p>
            <ChatDoneFileCard output={row} onDownload={handleDownload} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <section className="output_list">
      <div className="output_list_grid">
        {rows.map((row) => (
          <OutputCard
            key={row.id}
            output={row}
            readOnly
            onDownload={handleDownload}
            onOpenDetail={openDetail}
          />
        ))}
      </div>
    </section>
  )
}
