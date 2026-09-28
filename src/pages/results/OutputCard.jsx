// 이 파일의 책임: 산출물 카드 1장(피그마 디스크립션 5-5).
//
// 신규(보라 테두리)와 선택(파란 테두리+배경)이 이 컴포넌트의 두 상태다.
// 신규 판정은 서버의 opened_at 하나로만 한다 — 클라이언트 상태로 두면
// 새로고침에 사라지고 기기마다 달라진다.
import { Download } from 'lucide-react'
// round07j — 퍼블이 `<img src="/src/assets/icons/ic_angle.svg">` 로 써 왔다.
// **그 표기는 개발 서버에서만 산다** — Vite dev 는 /src/ 를 그대로 서빙하지만
// 빌드는 src 아래 자산을 해시 이름으로 옮기고 /src/ 경로는 손대지 않으므로
// 배포하면 이 아이콘만 404 가 된다(같은 라운드의 component.css 에서도 같은 실수가
// 하나 있었다). 이 레포의 관례대로 import 해서 번들러가 경로를 만들게 한다
// — DataFilterBar.jsx·DropdownCheckBox.jsx 가 같은 방식이다.
import icAngle from '../../assets/icons/ic_angle.svg'

// 파일 크기 표기(피그마 「[XLSX, 328KB]」). KB 아래는 반올림해 0KB 를 만들지 않는다.
export function formatBytes(bytes) {
  if (!bytes) return '0KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

// 종류 뱃지 문구 — caption 은 「설명문」이 아니라 **「캡션」**이다(피그마 프레임
// 695:105902 · 상세 749:6491). 목록 필터 탭은 「설명문」 그대로 두는 것이 정본이며,
// 그 어긋남은 사용자 결정이다(round07f spec §2 결정 3 · §4.3 — OutputList.jsx의
// TABS 주석에 같은 근거를 적어 두었다). 둘을 임의로 통일하지 말 것.
//
// round07i 리뷰 반영 — 이 맵은 OutputDetailPage.jsx 에도 똑같이 있다(리터럴
// 하나 공유하자고 새 모듈을 두지 않는다). exhibition 이 처음에 빠져 있던 것이
// "같은 맵이 두 파일에 있다"는 사실 자체가 놓치기 쉬움의 원인이었다는 증거다 —
// **새 kind 를 추가하면 반드시 아래 다섯 곳을 함께 고칠 것:**
//   ① 이 파일의 KIND_LABEL(카드 뱃지)
//   ② OutputDetailPage.jsx 의 KIND_LABEL(상세 뱃지)
//   ③ OutputList.jsx 의 TABS(목록 필터 탭)
//   ④ pages/results/chatTasks.js 의 CHAT_TASKS·CHAT_TASK_ORDER(AI 학예 도우미
//      작업선택 — round07k 에서 새로 생긴 kind 키 레지스트리)
//   ⑤ lib/outputTitles.js 의 defaultOutputTitle 분기(제목 기본값 — round07k
//      최종 리뷰에서 발견: 이미 round07i 부터 있었는데 이 체크리스트에 없었다)
// round07i 감사 C — ③이 이 목록에 없어서 정확히 그 일이 또 일어났다: 이 맵에는
// exhibition 이 들어왔는데 탭에는 끝내 안 들어와, 특별전시 산출물이 「전시자료」
// 탭에서 사라져 있었다. round07k 는 ④를 새로 더했고 ⑤는 처음부터 있었지만 이
// 체크리스트가 「세 곳」에 멈춰 있어 둘 다 빠져 있었다 — 그래서 다섯으로 고친다.
//
// round10b B-3(시트 #7·#8) — exhibit 의 라벨을 「전시자료」→「학예 기획 자료」로
// 기획 요청에 따라 개명한다. 「전시자료」는 round07e 대조표(§1 #5)가 세운 과거
// 확정 스펙이었다 — 임의 변경이 아니라는 근거를 `19_round07e-디스크립션-대조표.md`에
// 남겼다. 다섯 곳(위 체크리스트)을 이번에도 동시에 고친다 — 한 곳이라도 빠지면
// 카드 뱃지·상세 뱃지·탭 라벨·채팅 작업 문구·기본 제목이 서로 다른 이름을 말한다.
const KIND_LABEL = { exhibit: '학예 기획 자료', caption: '캡션', exhibition: '특별전시' }

// round10 — readOnly(기본 false, 기존 화면은 아무 것도 바뀌지 않는다): 프로젝트
// 상세의 스냅샷 목록(ProjectOutputList)이 이 카드를 재사용하면서 켠다. 켜지면
// 체크박스(선택→삭제로 이어지는 유일한 입구)를 그리지 않는다 — spec §5-5
// "산출물 삭제(체크박스·삭제 버튼): 없앤다 — 서버도 거부한다". 다운로드·상세보기는
// 그대로 둔다(허용 목록 — 보기·상세보기·다운로드).
export default function OutputCard({ output, selected, onToggle, onDownload, onOpenDetail, readOnly = false }) {
  // round10 — 스냅샷 목록에는 「신규」라는 개념이 없다. 그 뱃지는 "내가 아직 안 본
  // 산출물"이라는 뜻인데, 남의 프로젝트에서 되살린 저장 시점의 묶음에는 그 뜻이
  // 성립하지 않는다.
  //
  // round10 재리뷰 — 예전 주석은 "서버가 opened_at을 아예 주지 않는다"고 적혀
  // 있었으나 그것은 최종리뷰 I-3 이후로 사실이 아니다(projects/routes.py의
  // _snapshot_summary가 _summarize를 재사용하며 opened_at을 함께 싣는다). 값이
  // 실제로 오므로 `output.opened_at == null`만으로는 막히지 않고, **이 readOnly
  // 가드가 유일한 방어**다 — 걷어내면 남의 프로젝트 스냅샷이 전부 신규(보라
  // 테두리)로 뜬다. 서버 쪽 docstring도 이 가드에 의존한다고 적어 두었다.
  const isNew = !readOnly && output.opened_at == null
  const ext = (output.file_name || '').split('.').pop().toUpperCase()
  return (
    <div
      data-testid={`output-card-${output.id}`}
      className={`output_card${isNew ? ' is_new' : ''}${selected ? ' is_selected' : ''}`}
      onDoubleClick={() => onOpenDetail(output)}
    >
      <div className="output_card_head">
        {!readOnly && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle(output.id)}
            aria-label={`${output.title} 선택`}
          />
        )}
        <span className={`output_card_kind ${output.kind}`}>
			{KIND_LABEL[output.kind] || output.kind}
		</span>
      </div>
      <b className="output_card_tit">
        {output.title} [{ext}, {formatBytes(output.file_bytes)}]
      </b>
      <p className="output_card_body">{output.summary}</p>
      <div className="output_card_foot">
        <span className="output_card_date">
          생성일 {new Date(output.created_at).toLocaleDateString('ko-KR')}
        </span>
      </div>
	  <div className="output_card_foot">
		<button type="button" onClick={() => onDownload(output)} aria-label={`${output.title} 다운로드`}>
          다운로드<Download size={16} />
        </button>
        <button type="button" onClick={() => onOpenDetail(output)}>
          {/* alt 는 빈 문자열이다 — 이 꺾쇠는 옆 글자 「상세보기」를 되풀이하는
              장식이라, alt="상세보기" 로 두면 접근명이 「상세보기 상세보기」가 되고
              스크린리더가 두 번 읽는다. 장식 이미지는 alt="" 로 이름에서 뺀다. */}
          상세보기 <img src={icAngle} alt="" />
        </button>
	  </div>
    </div>
  )
}
