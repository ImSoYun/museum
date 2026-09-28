// 이 파일의 책임: AI 학예 도우미의 본체(퍼블 v2의 ai_chat.html L52-94에서 "결과기반 AI 대화"라 불림)
// — chat_body
// (chat_topic_bar · chat_thread · chat_input_dock)를 그리고, 라이브 SSE 대화 로직을 소유한다.
// 래퍼(result_wrap.ty_chat)와 chat_welcome 은 상위 pages/ChatView.jsx 가 소유한다.
//
// R6c-ext D1-6 재퍼블 — 데이터 흐름·상태·핸들러는 그대로 두고 마크업/클래스만 v2 로 옮겼다.
// 보존한 라이브 로직: useScenario()의 isLive·lastQuery·poolSize·chatMessages·chatStatus·
// chatNotice·sendChatMessage, 스트리밍 토큰 append 렌더, 단계 배지, chatNotice 배너,
// 인용 파싱([n]·[n, m] 묶음 분해·후보 밖 번호는 텍스트로 유지), 칩 클릭 → MaterialModal,
// 더미 시나리오의 1200ms 캔드 응답과 중복 전송 가드.
//
// round06c 최종 리뷰 must-fix I-2(정직성) — 답변 액션 두 개가 실동작 없이 성공 토스트를
// 띄우고 있었다. 복사는 이제 navigator.clipboard.writeText(msg.text)를 실제로 호출하고
// 성공/실패를 각각 정직하게 알린다(handleCopy). 다시 생성은 재전송 로직이 없어(실동작
// 자체가 없어) OutputTab.jsx(D1-7)와 같은 '준비 중입니다'로 통일했다 — 같은 라운드 안에서
// "실동작 없음"의 문구 계약이 화면마다 갈리지 않게 한다.
//
// 퍼블과 달라진 곳(근거):
//  · 인용칩을 문장 안에 인라인으로 끼우지 않고 퍼블 위치(chat_msg_bubble 안의 chat_msg_cite
//    2열 그리드)에 모은다. .chat_cite_item 은 display:flex 라 문장 흐름에 넣으면 줄이 깨진다.
//    본문의 [n] 표기는 텍스트로 남겨 어느 문장이 어느 출처인지 잃지 않는다.
//  · 답변 액션(다시 생성·복사)에 hover 스타일을 주지 않는다 — 퍼블 .icon_btn 이 정의하지 않는다.
//  · 입력창은 퍼블대로 form + input(단일행)이다. 그래서 Enter 는 폼 제출이고 Shift+Enter
//    줄바꿈(옛 textarea 자동확장)은 사라진다 — 정본이 input 이라 코드를 정본에 맞췄다.
//
// ── round07e — 설명문 생성의 두 번째 진입점(채팅 탭 인라인) ─────────────────────
// 산출물생성 탭 모달(CaptionModal, OutputTab.jsx)과 재료가 다르다 — 노드에서 고른
// 선택 자료가 아니라 **대화 이력의 출처자료 전부**다(상한 없음, spec §2 결정 9).
// collectChatCaptionDocs가 라이브는 각 AI 답변의 citations([{n,idnbr,name,image_url}] —
// resolve_citations가 만드는 그대로, era·category는 이 파이프라인에 애초에 실려
// 오지 않는다)를, 더미는 sources(자료 id 배열)를 materials에서 찾아 모은다. 중복
// 제거(idnbr)는 여기서 하지 않는다 — ChatCaptionPanel이 유일하게 제거하는 자리다
// (같은 자료가 여러 턴에 인용되는 것이 정상이므로, 모으는 쪽과 접는 쪽을 분리해 둔다).
//
// ── round07f — 그 인라인 폼을 「대화의 한 턴」으로 바꾼다(대조표 §4) ───────────
// round07e는 답변이 하나라도 있으면 **대화 밖**에 폼을 상시 노출했다. 디자인이
// 말하는 것은 그게 아니라 대화의 한 턴이다: 입력창 옆 「작업선택」 드롭다운으로
// 진입 → 사용자 말풍선 + 폼 턴(AI 자리) → 생성하기 → 완료 문구 + 파일 카드(AI 자리).
//
// **이 턴들은 서버 대화 이력에 저장하지 않는다(spec 결정 7).** 대화 이력은 다음
// 답변을 만들 때 LLM 컨텍스트로도 쓰이므로, 폼 UI가 섞이면 모델이 그것을 대화
// 내용으로 읽는다. 그래서 captionTurns는 지역 상태로만 존재하고 새로고침하면
// 사라진다 — 그것이 정상 동작이다.
//
// ── round07f 연장 — 폼과 모달을 피그마 규격으로 다시 만든다 ──────────────────
// 위 round07f는 폼의 내용을 산출물생성 페이지 모달에서 그대로 베껴 왔다(제목 입력·
// 타임라인 체크박스·파일형식 라디오). 피그마에는 셋 다 없다. 흐름은 3단이다:
//   ② 폼 턴          대화 **안** 인라인 — 참고자료 + 상세보기 + ✕ + 생성하기
//   ③ 결정 모달      화면 **중앙 팝업** — 타임라인 체크 + 취소/생성하기
//   ④ 완료 턴        대화 **안** 인라인 — 완료 문구 + 파일 카드
// ②·④는 모달이 아니고 ③만 모달이다. 폼의 「생성하기」는 생성하지 않고 ③을 연다.
import { Fragment, useState, useEffect, useRef } from 'react'
import { useScenario } from '../../context/ScenarioContext.jsx'
import { useReadOnly } from '../../context/ReadOnlyContext.jsx'
import { useSimulatedDelay } from '../../hooks/useSimulatedDelay.js'
import { useToast } from '../../components/useToast.js'
import Spinner from '../../components/Spinner.jsx'
import GlowBorder from '../../components/GlowBorder.jsx'
import { Download, FileText } from 'lucide-react'
import { materials } from '../../data/materials.js'
import MaterialModal from './MaterialModal.jsx'
import ChatCaptionPanel from './ChatCaptionPanel.jsx'
import ChatCaptionDecisionModal from './ChatCaptionDecisionModal.jsx'
// round10b B-4 — 특별전시(exhibition) 결정 모달은 채팅에서 없앴다(사용자 결정,
// triage #11). 학예 기획 자료(exhibit)는 새 모달을 만들지 않고 산출물생성 탭이
// 쓰는 같은 컬럼 선택 모달을 그대로 재사용한다("산출물 생성처럼 똑같이 할거야").
import ExhibitModal from './ExhibitModal.jsx'
import { CHAT_TASKS } from './chatTasks.js'
import { toAbsolute } from '../../lib/searchApi.js'
import { createOutput, downloadOutputFile, UNKNOWN_OUTCOME } from '../../lib/outputsApi.js'
// round10b B-4 — ExhibitModal의 defaultTitle에 쓴다(재사용하는 컬럼 선택 모달과
// 같은 규칙, outputTitles.js defaultOutputTitle('exhibit') 참조).
import { defaultOutputTitle } from '../../lib/outputTitles.js'
import icSparkle from '../../assets/icons/ic_sparkle.svg'
import { triggerBrowserDownload } from '../../lib/downloadFile.js'
import TaskSelect from '../../components/TaskSelect.jsx'
import icChatTopic from '../../assets/icons/ic_chat_topic.svg'
import icAiChatAvatar from '../../assets/icons/ic_ai_chat_avatar.svg'
import icChatReset from '../../assets/icons/ic_chat_reset.svg'
import icChatCopy from '../../assets/icons/ic_chat_copy.svg'
import icChatSend from '../../assets/icons/ic_chat_send.svg'

/** 답변 본문이 실제로 인용한 citations 를 등장 순서대로(중복 제거) 고른다.
 *  D1-6 이전 AnswerWithChips 가 렌더와 함께 하던 파싱을 그대로 떼어낸 것이다 —
 *   · citations 매핑이 있는 [n]만 칩이 된다. 매핑 없는 번호(후보 밖 — spec §9)는 칩을
 *     만들지 않고 본문 텍스트에 그대로 남는다.
 *   · 모델이 규칙을 어기고 [n, m] 묶음으로 인용해도 쉼표로 분해해 번호마다 개별 칩을 만든다
 *     (백엔드 B1 이 묶음을 개별 citations 로 이미 분해해 넘긴다).
 *   · citations 에는 있으나 본문이 인용하지 않은 번호는 칩을 만들지 않는다(기존 동작 유지). */
export function citedFromText(text, citations) {
  const byN = new Map((citations || []).map((c) => [c.n, c]))
  const picked = []
  const seen = new Set()
  for (const m of String(text).matchAll(/\[(\d{1,3}(?:\s*,\s*\d{1,3})*)\]/g)) {
    for (const raw of m[1].split(',')) {
      const n = Number(raw.trim())
      if (!byN.has(n) || seen.has(n)) continue
      seen.add(n)
      picked.push(byN.get(n))
    }
  }
  return picked
}

/** 답변 본문을 퍼블 단락 구조(chat_msg_bubble_txt, 둘째 단락부터 ty_indent)로 나눈다.
 *  빈 줄을 단락 경계로 본다 — 단일 개행은 whitespace-pre-wrap 이 그대로 살린다. */
function toParagraphs(text) {
  return String(text).split(/\n{2,}/)
}

/** ChatCaptionPanel에 넘길 docs — 대화 이력의 출처자료를 등장 순서대로 그대로 모은다.
 *  중복 제거(idnbr)는 여기서 하지 않는다 — 같은 자료가 여러 턴에 인용되는 것은
 *  정상이고, 그 중복을 접는 자리는 ChatCaptionPanel 하나로 못박는다(round07e).
 *
 *  라이브는 citations([{n, idnbr, name, image_url}] — resolve_citations가 만드는
 *  그대로, chat/citations.py:32)를 쓴다. era·year_info·category는 이 파이프라인이
 *  프론트까지 실어 나르지 않으므로(그 필드들은 chat/compose.py의 DOC_FIELDS로
 *  LLM 프롬프트에만 쓰인다 — ScenarioContext.jsx의 resumeConversation도 같은 이유로
 *  citations와 같은 얕은 모양으로 맞춘다) 여기서도 idnbr·name만 채운다 — 없는
 *  값을 지어내지 않는다.
 *  더미는 sources(자료 id 배열)를 materials에서 찾아 같은 모양으로 맞춘다. */
function collectChatCaptionDocs(shown, isLive) {
  const out = []
  for (const m of shown) {
    if (m.role !== 'ai' || !m.text) continue
    if (isLive) {
      if (Array.isArray(m.citations)) {
        for (const c of m.citations) {
          if (c?.idnbr) out.push({ idnbr: c.idnbr, name: c.name })
        }
      }
    } else if (Array.isArray(m.sources)) {
      for (const id of m.sources) {
        const mt = materials.find((x) => x.id === id)
        out.push({ idnbr: id, name: mt ? mt.title : id })
      }
    }
  }
  return out
}

/** 인용칩 — 퍼블 chat_cite_item(glow_border + chat_cite_num + chat_cite_txt).
 *  접근명(aria-label)은 D1-6 이전 계약을 그대로 쓴다: 라이브는 `[n] 자료명`, 더미는
 *  `출처 n: 자료명`. 칩의 표시는 v2 로 바뀌었지만 접근명을 바꾸면 스크린리더 사용자와
 *  기존 계약이 함께 깨진다(회귀 0). */
function CiteChip({ num, label, ariaLabel, onClick }) {
  return (
    <button type="button" className="chat_cite_item" aria-label={ariaLabel} onClick={onClick}>
      <GlowBorder />
      <span className="chat_cite_num">{num}</span>
      <span className="chat_cite_txt">{label}</span>
    </button>
  )
}

/** AI 아바타 — 퍼블 자산(ic_ai_chat_avatar.svg). 번들 자산이라 404 폴백이 필요 없다
 *  (D1-6 이전의 /assets/ci-symbol.png + onError 텍스트 폴백을 대체한다). */
function AiAvatar() {
  return <img src={icAiChatAvatar} alt="" className="chat_msg_avatar" />
}

/** 완료 턴의 파일 카드 — 피그마 `ExcelDownloadCard`(문서 아이콘 · 파일명 · 형식
 *  뱃지 · 우측 다운로드 아이콘). 목업은 초록 XLSX지만 설명문은 xlsx가 아니라
 *  **DOCX**로 그린다(브리프 ④).
 *
 *  파일명은 확장자를 떼고 보여 준다 — 형식은 옆 뱃지가 이미 말한다(피그마도
 *  `설명문 캡션 + 타임라인_260912` + `XLSX` 두 줄이다). 뱃지 값은 파일명에서
 *  추측하지 않고 **실제로 요청한 형식**(result.format)에서 온다. */
function CaptionFileCard({ result, onDownload }) {
  const baseName = String(result.file_name || '').replace(/\.[^.]+$/, '')
  return (
    <button
      type="button"
      className="flex w-full items-center gap-10 rounded-[10px] border border-[#E2E5EE] bg-white px-12 py-10 text-left"
      onClick={() => onDownload(result)}
    >
      <span className="flex h-32 w-32 shrink-0 items-center justify-center rounded-[8px] bg-[#EFF3FB] text-[#3B5BDB]">
        <FileText size={16} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="truncate text-[12.5px] font-bold text-[#1A1F2B]">{baseName}</span>
        <span className="text-[11px] font-bold text-[#8A90A2]">
          {String(result.format || '').toUpperCase()}
        </span>
      </span>
      <Download size={16} aria-hidden="true" className="shrink-0 text-[#5A6173]" />
    </button>
  )
}

/** 채팅 안의 설명문 생성 턴 — 사용자 발화 + 폼 턴(+ 완료 턴) AI 자리(round07f).
 *
 *  서버에 저장되지 않는 지역 상태 턴이다(ChatTab.captionTurns) — 대화 이력이
 *  LLM 컨텍스트이기도 하므로 폼 UI를 그 이력에 섞지 않는다(spec 결정 7).
 *
 *  round07f 연장 — **완료해도 폼은 사라지지 않는다.** 피그마가 폼 턴(Frame
 *  2087328269)과 완료 턴(Frame 2087328270)을 같은 AI 자리에 **함께** 그린다.
 *  다만 같은 폼으로 두 번 만들 수 있으면 안 되므로 완료 뒤 폼은 읽기 전용이다
 *  (생성하기 비활성 · ✕ 비활성).
 *
 *  새 파일로 뽑지 않는 이유: 이 컴포넌트는 ChatTab의 메시지 렌더 관행
 *  (chat_msg ty_user / ty_ai · AiAvatar)에 강하게 묶여 있고 재사용처가 이 파일
 *  하나뿐이다. 별도 파일로 두면 그 관행이 두 곳으로 갈린다. */
function ChatCaptionTurn({ turn, onRequestGenerate, onOpenDetail, onDownload }) {
  const done = turn.status === 'done'
  // round07k — 문구는 전부 종류(turn.kind)에서 온다. 옛 코드에는 「설명문 캡션
  // 만들어줘」와 「…설명문 캡션 생성」이 이 파일에 직접 적혀 있었다 — 특별전시를
  // 더하며 그대로 복사하면 문구가 두 벌이 된다.
  //
  // round07k 최종 리뷰 F4 — 예전에는 여기 `?? CHAT_TASKS.caption` 폴백이 있었다.
  // 「turn.kind가 없는(구버전 상태를 남긴) 경우에 대비」라는 근거가 거짓이었다 —
  // captionTurns는 서버에 저장하지 않아 새로고침에 사라지고(위 captionTurns 선언부
  // 주석), 턴을 만드는 유일한 통로 openTaskTurn이 매번 kind를 채운다. 그래서
  // turn.kind는 항상 있다. 반면 아래(736행 근처) decisionKind는 폴백이 없다 — 같은
  // 파일에서 같은 「turn.kind 없을 수 있다」는 전제가 있다/없다로 갈려 있었다.
  // 폴백 쪽을 지운다 — 실재하지 않는 케이스를 위해 존재하지 않는 값을 만들어 내는
  // 대신, 두 쪽 다 「turn.kind는 항상 있다」는 실제 불변조건을 그대로 드러낸다.
  const task = CHAT_TASKS[turn.kind]
  return (
    <>
      <li className="chat_msg ty_user">
        <p className="chat_msg_bubble">{task.userBubble}</p>
      </li>
      <li className="chat_msg ty_ai">
        <AiAvatar />
        {/* .chat_msg.ty_ai .chat_msg_content 가 이미 세로 flex(gap 0.8rem)라
            버블 둘을 그냥 나란히 두면 피그마대로 위아래로 쌓인다. */}
        <div className="chat_msg_content">
          <div className="chat_msg_bubble">
            <ChatCaptionPanel
              task={task}
              docs={turn.docs}
              busy={turn.status === 'busy'}
              readOnly={done}
              onRequestGenerate={onRequestGenerate}
              onOpenDetail={onOpenDetail}
            />
          </div>
          {done && (
            <div className="chat_msg_bubble">
              <p className="flex items-center gap-6 font-bold">
                <img src={icSparkle} alt="" className="w-16 h-16 shrink-0" />
                요청하신 산출물 생성이 완료되었습니다.
              </p>
              <p className="flex items-start gap-6 text-[12.5px] text-[#5A6173]">
                <FileText size={14} aria-hidden="true" className="mt-1 shrink-0" />
                {task.doneSummary(turn.result.count)}
              </p>
              {/* round07e 최종 리뷰 F2(c)가 잠근 조건 그대로 — 자리만 8초 토스트에서
                  이 회색 줄로 옮겼다. 턴은 스스로 사라지지 않으므로 표시 시간을 벌
                  필요가 없다.
                  round07k — 타임라인은 설명문에만 있는 개념이다(특별전시엔 애초에
                  없다). turn.kind === 'caption' 로 가드하지 않으면 emptyTimeline이
                  undefined인 한 항상 조용히 숨지만, 그 우연에 기대지 않는다. */}
              {turn.kind === 'caption' && turn.result.emptyTimeline && (
                <p className="text-[12px] text-[#8A90A2]">
                  다만 자료에 연도 근거가 부족해 타임라인 항목이 만들어지지 않았습니다.
                </p>
              )}
              <CaptionFileCard result={turn.result} onDownload={onDownload} />
            </div>
          )}
        </div>
      </li>
    </>
  )
}

// 스트리밍 중 자동 스크롤의 "바닥 근처" 판정 임계값(px) — 사용자 실사용 버그(2026-07-28):
// 답변이 토큰마다 자라는 동안 스크롤이 상단에 고정돼 생성 텍스트가 안 보인다는 신고가
// 있었다. 표준 채팅 UX는 하단에 붙어 있을 때만 자동으로 따라가고, 사용자가 위로 스크롤해
// 이전 답변을 읽는 중이면 방해하지 않는다 — 그래서 "정확히 바닥"이 아니라 "바닥 근처"로
// 여유를 둔다(사람 손으로 살짝 위에 있어도 스트리밍을 계속 따라가고 싶을 수 있다).
const NEAR_BOTTOM_PX = 80

// 채팅 진입점의 산출물 형식은 **종류를 불문하고 docx 고정**이다(사용자 결정
// 2026-09-03) — 피그마의 폼에도 결정 모달에도 형식을 고르는 자리가 없다. 리터럴
// 'docx'를 요청 조립부와 완료 카드 뱃지 두 곳에 각각 적으면 한쪽만 바뀌어
// 「PDF를 만들고 DOCX라 적는」 카드가 나온다 — 그래서 한 곳에서만 정의한다.
//
// round07k — 특별전시가 더해지며 이름을 CHAT_CAPTION_FORMAT → CHAT_OUTPUT_FORMAT로
// 바꿨다. 설명문 request의 `format` 필드(서버가 요구)와, 두 종류 공통의 완료 카드
// 뱃지(서버엔 안 실어도 화면엔 항상 필요) 양쪽에 쓴다 — 특별전시는 서버에 `format`을
// 아예 보내지 않는다(routes.py `_check_combination` — 실으면 422). 뱃지 값은 화면
// 표시 전용이라 서버로 나가지 않는 이 상수를 그대로 써도 안전하다.
//
// round10b — "종류를 불문하고 docx" 라는 말이 더는 참이 아니다. 학예 기획 자료
// (exhibit)는 서버가 애초에 **xlsx 고정**이다(routes.py CreateOutputRequest
// 도크스트링 "exhibit … format 없음(xlsx 고정)") — 채팅이 고른 것이 아니라 그
// kind 자체의 성질이다. 완료 카드 뱃지가 실제 파일 확장자와 다른 말을 하면 안
// 되므로(코딩표준 §6), 단일 상수를 kind별 맵으로 바꾼다.
const CHAT_OUTPUT_FORMAT_BY_KIND = { caption: 'docx', exhibit: 'xlsx' }

// ⚠️ round10 최종리뷰 I-4 — Task7이 잠깐 두었던 `onDownloadOutput` prop을 걷어냈다.
// 그 콜백은 완료 턴의 파일 카드(captionTurns)에서만 쓰였는데, captionTurns는 서버에
// 저장하지 않는 **지역 상태**다(결정 7 — 아래 선언부 주석). 즉 프로젝트 상세가 복원한
// 대화에는 파일 카드가 존재할 수 없어 그 배선은 **도달할 수 없는 죽은 코드**였다.
// 읽기 전용 상세의 산출물 다운로드는 대화 끝에 붙는 ProjectOutputList가 맡는다
// (ProjectDetail.jsx의 chat 탭 주석 참조).
export default function ChatTab({ topicTitle = null }) {
  const {
    activeScenario, isLive, lastQuery, poolSize, conversationId,
    chatMessages, chatStatus, chatNotice, sendChatMessage,
    bumpOutputsVersion,
  } = useScenario()
  const readOnly = useReadOnly()
  const { loading, run } = useSimulatedDelay()
  const { showToast } = useToast()
  const [messages, setMessages] = useState(activeScenario.chat)
  const [input, setInput] = useState('')
  const [openMaterial, setOpenMaterial] = useState(null)
  // round07f — 채팅 인라인 설명문 생성을 대화의 한 턴으로 바꾼다(대조표 §4).
  // 지금까지 답변 아래 상시 폼이었던 것을 걷어내고, 「작업선택」 드롭다운으로
  // 진입해 사용자 턴 + 폼 턴(AI 자리)을 만든다.
  //
  // captionTurns는 서버에 저장하지 않는다(spec 결정 7) — 지역 상태로만 존재하고
  // 리마운트(새로고침)하면 사라진다. docs는 턴을 만드는 **순간의 스냅샷**이다 —
  // 그 뒤로 대화가 계속 자라도 이미 연 폼의 재료가 바뀌면 사용자가 확인하던
  // 목록이 발밑에서 달라진다.
  const [captionTurns, setCaptionTurns] = useState([])
  const captionTurnSeq = useRef(0)
  // round07f 연장 — 폼의 「생성하기」와 실제 생성 사이의 결정 모달(피그마 ③).
  // { turnId, idnbrs } — idnbrs는 **폼이 ✕ 제외를 이미 반영해 올려 보낸 최종 목록**이다.
  // 모달의 「총 N건」도, 실제 요청도 이 하나에서 나온다(둘이 갈리면 20건이라 말하고
  // 17건을 만든다 — 사용자가 명시적으로 지적한 지점).
  const [captionDecision, setCaptionDecision] = useState(null)
  // round07g — 「작업선택」의 현재 값. 네이티브 <select> 는 value 를 늘 '' 로 되돌려
  // 닫힌 라벨이 항상 placeholder 였지만, 피그마는 고른 뒤 닫힌 라벨을
  // 「설명문 캡션 작성」으로 그린다. 그래서 값을 든다 — 같은 항목을 다시 골라
  // 폼 턴을 또 여는 것은 TaskSelect 가 「같은 값이어도 onChange 를 부른다」로 보장한다.
  const [taskValue, setTaskValue] = useState('')
  // "바닥 근처" 여부 — state가 아니라 ref인 이유: 이 값 자체는 화면에 그릴 게 없고
  // (리렌더가 필요 없다) 다음 메시지 effect가 최신값만 읽으면 되므로, state로 만들면
  // 스크롤할 때마다 불필요한 리렌더만 늘어난다. 기본값 true — 첫 진입은 바닥 취급.
  const nearBottomRef = useRef(true)

  const liveBadge = {
    bootstrap: '후보 준비 중 …',
    rewrite: '질문 정리 중 …',
    retrieve: '자료 찾는 중 …',
    generate: '답변 작성 중 …',
  }[chatStatus]

  const shown = isLive ? chatMessages : messages

  // chat_topic_bar 는 퍼블에서 "질의 요약"이다. 앱에는 요약기가 없으므로 원문 질의를 그대로 쓴다.
  // 더미 데모는 lastQuery 를 세팅하지 않으므로(ScenarioContext.setScenarioByQuery 비라이브 분기)
  // 그때는 활성 시나리오의 원본 질의문(activeScenario.query — scenarios.js 에 컬렉션명 label 과
  // 별도로 존재)을 쓴다. label(컬렉션명)을 쓰지 않는 이유: 퍼블 자리는 "질의" 표시용이다.
  // 둘 다 없으면(검색 전) 바를 아예 렌더하지 않는다 — 퍼블 예시 문구를 하드코딩하면 근거 없는
  // 신호가 된다.
  // 위쪽 result_query_bar(SearchFlowLayout)와 문자열이 겹치는 것은 의도된 절충이다 — 셸의
  // 검색바는 편집 가능한 재검색 입력(변경 가능한 draft)이고, 이 topic bar 는 이 대화가
  // 무엇에 대한 것인지 고정 표시(확정된 주제)라서 역할이 다르다.
  // round10 사용자 결정(2026-09-16 라이브 검증) — 읽기 전용(프로젝트 상세)에서는 이 자리도
  // **라이브러리에 저장한 제목**으로 채운다. 저장된 기록을 보는 화면인데 질의문이 떠 있으면
  // 「지금 이 질의로 대화하는 중」처럼 읽혀서, 칠 수 없는 채팅을 칠 수 있는 것처럼 보인다.
  // 제목은 상세 화면이 prop 으로 내려 준다 — 대화 화면은 프로젝트를 모른다(onDownloadOutput
  // 때와 같은 이유).
  const topicText = (readOnly && topicTitle)
    ? topicTitle
    : ((lastQuery || '').trim() || (isLive ? '' : (activeScenario?.query || '')))

  // Resync messages when active scenario changes
  useEffect(() => {
    setMessages(activeScenario.chat)
  }, [activeScenario.id])

  // round07f R1 Important-1 — **대화가 바뀌거나 비워지면 폼 턴을 버린다.**
  //
  // 실사용 결함(리뷰 실측): 상단 검색바로 새 검색을 하면 ScenarioContext.runLiveSearch가
  // 대화를 비우지만(setChatMessages([])), ChatTab은 같은 라우트라 **리마운트되지 않아**
  // captionTurns가 그대로 살아남았다. 그러면 텅 빈 새 대화에 이전 대화의 폼 턴이 그려지고
  // (드롭다운은 disabled인데 그 폼의 「생성하기」는 여전히 눌린다), **옛 대화의 자료를 새
  // 질의 이름으로** 서버에 보낸다 — 화면에 아무 경고가 없는 조용한 데이터 불일치다.
  //
  // 턴의 docs는 「연 순간의 대화 이력」 스냅샷이다. 그 대화가 사라지면 턴도 함께 사라지는
  // 것이 유일하게 정직한 선택이다(옛 「목록 끝에 남긴다」 방어는 이 경로에서 틀렸다).
  //
  // 대화의 신원 = conversationId + activeScenario.id.
  //  · conversationId는 새 검색(runLiveSearch: null → 서버 id)·대화 재개
  //    (resumeConversation: 복원 id)·더미 검색(newConversationId)에서 전부 갈리고,
  //    **대화가 계속되는 동안에는 바뀌지 않는다** — 그래서 「같은 대화의 다음 턴」과
  //    「다른 대화」를 정확히 가른다.
  //  · activeScenario.id는 더미 시나리오 전환(messages를 통째로 교체)을 잡는다.
  //
  // 아래 else 줄(atIndex > shown.length 정리)은 신원이 그대로인데 대화만 줄어드는 경로의
  // 방어다. 갈 자리가 없어진 턴은 그릴 곳이 없으므로 상태에서도 지운다 — 남겨 두면 대화가
  // 다시 자랐을 때 옛 턴이 새 대화 한복판에 되살아난다.
  const convKey = `${conversationId ?? ''}|${activeScenario?.id ?? ''}`
  const convKeyRef = useRef(convKey)
  useEffect(() => {
    if (convKeyRef.current !== convKey) {
      convKeyRef.current = convKey
      setCaptionTurns([])
      // round07g — 고른 작업도 그 대화의 것이다. 비워진 새 대화에서 disabled 된
      // 트리거가 「설명문 캡션 작성」을 계속 말하면 지난 대화의 잔상이다.
      setTaskValue('')
      return
    }
    setCaptionTurns((prev) => (
      prev.some((t) => t.atIndex > shown.length)
        ? prev.filter((t) => t.atIndex <= shown.length)
        : prev
    ))
  }, [convKey, shown.length])

  // round07f 연장 — 턴이 버려지면 그 턴을 가리키던 결정 모달도 함께 닫는다.
  // 모달이 든 idnbrs는 「연 순간의 대화」 스냅샷이라, 위 블록이 턴을 버린 뒤에도 모달이
  // 살아 있으면 「생성하기」 한 번으로 **옛 자료를 새 질의 이름으로** 보낸다 — 위 블록이
  // 막으려는 바로 그 사고를 모달이 우회한다. 위 effect 안에서 처리하지 않고 따로 두는
  // 이유는, setState 갱신 함수 안에서 다른 setState를 부르지 않기 위해서다.
  useEffect(() => {
    setCaptionDecision((d) => (d && !captionTurns.some((t) => t.id === d.turnId) ? null : d))
  }, [captionTurns])

  // "바닥 근처"인지를 최신으로 유지한다. 퍼블 구조는 chat_thread 자체가 아니라 문서
  // (페이지)가 스크롤된다(D1-6 이전에는 대화 목록이 자체 스크롤 컨테이너였지만, 퍼블에서는
  // 입력 도크가 sticky로 붙는 대신 chat_body에 overflow가 없다 — component.css 실측).
  // 그래서 컨테이너의 onScroll이 아니라 document.scrollingElement를 window의 scroll에서
  // 관찰한다. 마운트 시 한 번 즉시 계산해 두는 이유는, 그사이(리스너가 붙기 전) 첫 렌더에서
  // 이미 스크롤이 내려가 있는 경우(예: 탭 재진입)를 놓치지 않기 위해서다.
  useEffect(() => {
    function updateNearBottom() {
      const el = document.scrollingElement || document.documentElement
      nearBottomRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - NEAR_BOTTOM_PX
    }
    updateNearBottom()
    window.addEventListener('scroll', updateNearBottom)
    return () => window.removeEventListener('scroll', updateNearBottom)
  }, [])

  // 새 메시지·스트리밍 토큰이 도착하면 문서를 바닥까지 스크롤한다 — 단, 사용자가 위로
  // 스크롤해 이전 답변을 읽는 중이면(바닥 근처가 아니면) 강제로 끌어내리지 않는다
  // (표준 채팅 UX: 스트리밍 중 하단 고정 + 사용자가 읽는 중이면 방해 금지).
  // shown(=chatMessages, 라이브)은 ScenarioContext.appendAi가 토큰마다 배열과 마지막
  // 메시지 객체를 새로 만들어 참조가 바뀌므로, 이 deps는 토큰 append도 관찰한다.
  //
  // 근본 원인(dev 실사용 재현, 2026-07-28) — 이전에는 chat_thread 뒤에 sr_only 스팬
  // (threadEndRef)을 두고 scrollIntoView({block:'end'})로 그 스팬을 뷰포트에 끌어오는
  // 방식이었다. 그런데 .sr_only는 position:absolute(offset 미지정)이고, chat_body는
  // column flex 컨테이너다 — CSS Flexbox 스펙상 flex 컨테이너의 절대배치 자식의 static
  // position은 "그 자식 하나만 있는 flex 아이템"인 것처럼 계산돼 컨테이너 시작점(상단)이
  // 된다. block 컨테이너에서 통하는 "직전 형제 뒤" 규칙이 flex에는 적용되지 않는다.
  // 그 결과 스팬이 대화 맨 위에 떠 있었고, scrollIntoView가 매번 대화 상단으로 끌어올려
  // "생성 중 스크롤이 상단에 고정"으로 보였다 — jsdom은 scrollIntoView를 구현하지 않아
  // (스텁만 가능) 이 위치 오류를 유닛테스트가 관측할 수 없었다.
  // 대안으로 마지막 <li>에 ref를 걸어 scrollIntoView(block:'end')하는 방법도 검토했지만
  // 기각했다 — 문서 바닥에는 position:sticky인 chat_input_dock이 항상 그 자리를 차지하고
  // 있어서, 마지막 답변 줄을 뷰포트 "끝"에 맞추면 그 줄이 sticky 도크에 가려진다.
  // 그래서 sentinel/scrollIntoView를 모두 버리고, 문서 자체의 scrollTop을 scrollHeight로
  // 직접 밀어 넣는다 — 도크는 sticky라 항상 최하단에 남고, 그 위 마지막 줄이 자연히 보인다.
  useEffect(() => {
    if (!nearBottomRef.current) return
    const el = document.scrollingElement || document.documentElement
    el.scrollTop = el.scrollHeight
  //
  // round07f — deps에 captionTurns를 더한다. 턴은 대화 목록 안에 그려지지만
  // shown(=chatMessages)을 바꾸지 않으므로, 이것이 없으면 폼 턴을 연 직후 화면이
  // 바닥으로 내려가지 않아 방금 연 폼이 화면 밖에 접혀 있다.
  }, [shown, loading, liveBadge, captionTurns])

  function sendMessage() {
    if (isLive) {
      const trimmed = input.trim()
      if (!trimmed) return
      setInput('')
      sendChatMessage(trimmed)
      return
    }
    // Guard: ignore sends while a reply is still generating, so the pending
    // AI reply is never dropped by a second run() clearing its timer.
    if (loading) return
    const trimmed = input.trim()
    if (!trimmed) return
    const userMsg = { role: 'user', text: trimmed }
    // Build scenario-coherent canned AI reply
    const cannedAi = {
      role: 'ai',
      text: '관련 자료를 분석해 답변을 생성했습니다. 아래 출처를 확인해 주세요. 질문을 바꾸면 검색 결과와 산출물도 다시 생성됩니다.',
      sources: activeScenario.materialIds.slice(0, 2),
    }
    // Append user message immediately
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    // Simulate 1200ms delay, then append AI reply
    run(1200, () => {
      setMessages((prev) => [...prev, cannedAi])
    })
  }

  function handleSubmit(e) {
    e.preventDefault()
    sendMessage()
  }

  function handleSourceClick(materialId) {
    const mt = materials.find((m) => m.id === materialId)
    if (mt) setOpenMaterial(mt)
  }

  // round07f R1 Minor-3 — 패널(ChatCaptionPanel)은 {idnbr, name} 둘만 갖고 있어
  // {id, title, image:null}을 넘긴다. 더미 모드에서는 그게 그대로 MaterialModal에
  // 들어가 「이미지 없음」 + 메타가 전부 '—'로 뜬다(라이브는 MaterialModal이
  // fetchArtifactDetail로 채우므로 데모 모드 한정 결함이다). 같은 화면의
  // handleSourceClick이 이미 materials에서 전체 객체를 찾아 넘기므로, 여기서도
  // 같은 방식으로 맞춘다 — 한 화면에서 자료를 여는 길이 둘로 갈리지 않게 한다.
  // 못 찾으면(라이브 idnbr은 더미 목록에 없다) 받은 얕은 객체를 그대로 쓴다.
  function openCaptionDoc(doc) {
    setOpenMaterial(materials.find((m) => m.id === doc.id) || doc)
  }

  function handleChip(cit) {
    setOpenMaterial({ id: cit.idnbr, title: cit.name, image: toAbsolute(cit.image_url) })
  }

  // round07f — 「작업선택」에서 종류를 고르면 대화에 폼 턴이 하나 열린다.
  // docs는 **연는 순간의 스냅샷**이다(위 captionTurns 주석 참조).
  //
  // round07k — 종류(kind)를 함께 싣는다. 이 값 하나로 사용자 버블·패널 제목·
  // 완료 문장·결정 모달이 갈린다. 문구의 출처는 chatTasks.js 다.
  function openTaskTurn(kind) {
    const docs = collectChatCaptionDocs(shown, isLive)
    captionTurnSeq.current += 1
    setCaptionTurns((prev) => [
      ...prev,
      // atIndex — 이 턴이 대화의 **어느 자리**에 속하는지(연 시점의 메시지 수).
      // 목록 끝에 무조건 붙이면 이후 새 메시지가 턴보다 위에 그려진다.
      { id: captionTurnSeq.current, kind, atIndex: shown.length, docs, status: 'form', result: null },
    ])
  }

  // 산출물생성 탭의 submitCaption(OutputTab.jsx)과 **같은 서버 계약**(POST /outputs,
  // kind='caption')을 쓴다 — 흐름이 대화 턴으로 바뀌어도 계약은 그대로다. selection의
  // node만 노드명이 아니라 고정 문자열 '대화'다(이 자료들의 출처가 노드 클러스터가
  // 아니라 대화이기 때문이다). idnbrs는 ChatCaptionPanel이 이미 중복 제거·제외 반영을
  // 마친 최종 목록이다.
  //
  // 성공은 **토스트를 부르지 않는다** — 완료 문구가 턴 안(대화 버블)에 남기 때문이다.
  // 같은 신호를 두 자리에서 말하면 하나는 반드시 낡는다. 실패만 토스트를 쓴다(턴은
  // 폼으로 되돌려 다시 시도할 수 있게 한다).
  //
  // round07f 연장 — 폼의 「생성하기」는 **생성하지 않는다.** 결정 모달을 열 뿐이다
  // (피그마 ③). idnbrs는 폼이 ✕ 제외를 이미 반영해 올려 보낸 최종 목록이라, 모달이
  // 표시할 「총 N건」과 실제 요청이 같은 값을 쓴다.
  function requestCaptionGenerate(turnId, { idnbrs }) {
    setCaptionDecision({ turnId, idnbrs })
  }

  // 설명문 결정 모달의 「생성하기」 — 여기서 비로소 만든다.
  //
  // round07g — 제목은 이제 **모달이 올려 보낸다.** 피그마 프레임에 「제목 설정」
  // 입력칸이 있었는데 round07f 가 그것을 빠뜨리고 코드가 제목을 정하게 했다.
  // 기본값 규칙(defaultOutputTitle('caption',{timeline}))과 타임라인 연동은 그대로다 —
  // 다만 그 계산이 모달 안(useCaptionTitleRule)으로 옮겨 갔고, 학예사가 고쳐 넣은
  // 제목이 있으면 그 값이 온다. 여기서 다시 계산하면 입력칸이 무시된다.
  //
  // 형식만 여전히 코드가 정한다 — CHAT_OUTPUT_FORMAT_BY_KIND.caption('docx') 고정(입력칸이 없다).
  function confirmCaptionDecision({ timeline, title }) {
    const pending = captionDecision
    if (!pending) return
    setCaptionDecision(null)
    submitTaskTurn(pending.turnId, {
      kind: 'caption',
      title,
      format: CHAT_OUTPUT_FORMAT_BY_KIND.caption,
      timeline,
      idnbrs: pending.idnbrs,
    })
  }

  // round10b B-4 — 학예 기획 자료(exhibit) 결정 단계의 「생성하기」. 특별전시
  // (exhibition) 결정 모달을 채팅에서 없애고 그 자리에 들어왔다 — 다만 이쪽은
  // 새 모달이 아니라 산출물생성 탭의 ExhibitModal(같은 컬럼 선택 모달)이 그대로
  // 올려 보내는 {title, columns}를 받는다(ExhibitModal.jsx onSubmit 계약 참조 —
  // timeline도 함께 오지만 exhibit엔 그 개념이 없어 여기서 버린다).
  function confirmExhibitDecision({ title, columns }) {
    const pending = captionDecision
    if (!pending) return
    setCaptionDecision(null)
    submitTaskTurn(pending.turnId, {
      kind: 'exhibit',
      title,
      columns,
      idnbrs: pending.idnbrs,
    })
  }

  // round10b B-4 — ExhibitModal은 "노드" 단위 칩(nodeId·label·count)을 그리도록
  // 설계돼 있다(산출물생성 탭 원래 용도). 채팅에는 노드가 없다 — 대화가 모아 온
  // 자료 하나하나를 칩 하나로 삼는다(count는 항상 1). 그래서 onRemoveChip도
  // idnbr 하나를 captionDecision.idnbrs에서 빼는 것으로 다시 뜻매김한다 —
  // ChatCaptionPanel의 ✕(폼 단계 제외)와는 층이 다른, 결정 단계의 제외다.
  // ExhibitModal.jsx 자체는 손대지 않는다 — "새 UI를 만들지 마라"는 사용자 결정이
  // 그 파일을 있는 그대로 재사용하라는 뜻이라(다른 조 파일이라 막힌 것은 아니다),
  // 이 재해석은 전부 ChatTab 쪽에서만 이뤄진다.
  const decisionTurn = captionTurns.find((t) => t.id === captionDecision?.turnId)
  const decisionDocNames = new Map((decisionTurn?.docs || []).map((d) => [d.idnbr, d.name]))
  const decisionChips = (captionDecision?.idnbrs || []).map((idnbr) => ({
    nodeId: idnbr,
    label: decisionDocNames.get(idnbr) || idnbr,
    count: 1,
  }))
  const removeDecisionChip = (idnbr) =>
    setCaptionDecision((d) => (d ? { ...d, idnbrs: d.idnbrs.filter((id) => id !== idnbr) } : d))

  // round07k — submitCaptionTurn을 종류 불문으로 일반화했다. 실제 POST 조립은
  // 여기 한 곳에서만 한다 — 설명문·전시자료(exhibit)가 각자 조립하면 「query를
  // 빠뜨렸다」 같은 실수가 한쪽에서만 일어날 수 있다.
  //
  // **query를 반드시 싣는다** — 서버가 topic = req.query or req.title로 설명문
  // 주제를 정한다(routes.py:387 build_prompt 호출부). 이걸 빠뜨리면 설명문 주제가
  // 조용히 제목으로 대체된다. round10b B-4로 채팅의 둘째 종류가 특별전시(exhibition)에서
  // 학예 기획 자료(exhibit)로 바뀌었고, exhibit은 topic 개념이 없어(엑셀은 title만
  // 쓴다) 이 값을 안 쓴다 — 그래도 query는 kind 상관없이 저장 메타(Output.query)에
  // 남으므로 여기서 함께 싣는다. 설명문도 산출물생성 탭(OutputTab.jsx submitCaption)과
  // 같은 계약이라 함께 싣는다.
  //
  // format·timeline은 kind==='caption'일 때만 싣는다 — 서버 validator
  // (routes.py _check_combination)가 exhibition(caption도 exhibit도 아닌 나머지)에
  // format이 실리면 422로 거부한다("특별전시는 파일 형식을 고르지 않습니다"). columns는
  // kind==='exhibit'일 때만 싣는다 — 같은 validator가 exhibit엔 columns 없으면 거부하고,
  // exhibition엔 columns가 실리면 거부한다(직접 확인 — caption 분기는 format 유무만
  // 보고 columns는 아예 검사하지 않는다. 이 코드가 caption에 columns를 안 실어
  // 보내므로 문제는 없지만 "다른 kind엔 columns가 실리면 다 거부한다"는 아니다).
  // 완료 후 뱃지 표시에는 CHAT_OUTPUT_FORMAT_BY_KIND[kind]를
  // 쓴다(화면 전용 값이라 서버로 나가는 값과 갈려도 안전하다 — round10b: exhibit은
  // xlsx, caption은 docx로 갈렸다).
  //
  // 완료 후에도 자동 다운로드하지 않는다 — 파일 카드를 눌러야 받는다.
  // bumpOutputsVersion으로 산출물 목록·탭 뱃지가 갱신되게 한다.
  async function submitTaskTurn(turnId, { kind, title, format, timeline, columns, idnbrs }) {
    setCaptionTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, status: 'busy' } : t)))
    const payload = {
      kind,
      title,
      query: lastQuery || null,
      // round07g — 만든 대화를 함께 남긴다. 채팅에서 만든 산출물도 산출물 목록에
      // 같이 쌓이므로 여기서 빠뜨리면 그 산출물만 NULL 로 저장돼 **만든 직후부터
      // 어느 목록에도 뜨지 않는다**(목록이 대화로 걸러지기 때문이다).
      conversation_id: conversationId || null,
      selection: [{ node: '대화', idnbrs }],
    }
    if (kind === 'caption') {
      payload.format = format
      payload.timeline = timeline
    } else if (kind === 'exhibit') {
      // round10b B-4 — 산출물생성 탭의 submitExhibit(OutputTab.jsx)과 같은 계약이다.
      payload.columns = columns
    }
    // round07f R1 Minor-1 — createOutput은 실패를 { ok:false, notice }로 흡수하지만
    // **2xx 본문의 res.json() 한 경로만 예외로 새어 나온다**(outputsApi.js requestJson).
    // 그때 await가 던지면 아래 폼 복귀·토스트가 통째로 건너뛰어져 턴이 status:'busy'에
    // 영구히 갇힌다(버튼은 「만드는 중…」 disabled인 채, 사유도 없이). 구
    // submitChatCaption의 try/finally가 하던 보장을 여기서 되살린다 — 예외도 실패와
    // 같은 모양으로 접어 넣어, 실패 경로가 예외까지 덮게 한다.
    //
    // round07k — 30건 상한(_MAX_EXHIBITION_ARTIFACTS, routes.py)을 화면에서 세지
    // 않기로 했다(spec §4 결정 3) — 서버가 422로 거절하면 이 catch가 아니라 위
    // `!created.ok` 분기(fail()이 detail을 notice로 끌어올린 것)로 떨어지고, 아래
    // showToast(created.notice)가 그 문구를 그대로 보여준다. 여기서 화면이 건수를
    // 세어 미리 막으면 서버 숫자와 화면 숫자가 갈릴 수 있다.
    const created = await createOutput(payload)
      .catch(() => ({ ok: false, notice: '산출물 생성에 실패했습니다' }))
    if (!created.ok) {
      // round10a A조 최종 리뷰 I-2 — 응답을 못 받은 것(502·503·504·네트워크 끊김)은
      // 실패가 아니다. OutputTab.jsx의 notifyCreateFailure와 같은 판정을 같은 Set으로
      // 본다(lib/outputsApi.js UNKNOWN_OUTCOME 정의부 참조) — 같은 createOutput을 쓰는
      // 이 화면만 그동안 이 판정이 없어, 서버가 실제로 만들어 저장했을 502에도
      // "실패했습니다"로 단정하고 목록도 새로 고치지 않았다. 이 화면은 대화 이력의
      // 출처자료 전부를 상한 없이 보내(파일 상단 주석 참조) 노드 선택보다 느려질 수
      // 있는 경로라 이 판정이 더 자주 필요하다.
      if (UNKNOWN_OUTCOME.has(created.status)) {
        bumpOutputsVersion?.()
        showToast('산출물이 만들어졌을 수 있습니다 — 목록을 확인해 주세요')
      } else {
        showToast(created.notice)
      }
      setCaptionTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, status: 'form' } : t)))
      return
    }
    // round07e 최종 리뷰 F2(c) — OutputTab.jsx의 submitCaption과 같은 조건, 같은
    // 이유(자료 근거만 쓰는 설계가 강하게 작동할수록 timeline이 빈 채로 돌아올
    // 확률이 올라간다). 자리만 토스트에서 완료 버블 아래 회색 줄로 옮겼다.
    // round10b B-4로 채팅의 둘째 종류가 exhibition에서 exhibit으로 바뀌었다 — exhibit도
    // timeline 개념이 없으므로(kind==='caption' 가드) 여전히 항상 false다.
    const emptyTimeline = kind === 'caption' && timeline && created.data.timeline_count === 0
    setCaptionTurns((prev) => prev.map((t) => (t.id === turnId ? {
      ...t,
      status: 'done',
      result: {
        id: created.data.id,
        file_name: created.data.file_name,
        // 완료 문구가 말하는 건수는 **이번에 실제로 보낸 값**이다. 화면에서 다시
        // 세면 요청과 표시가 갈린다. 카드 뱃지의 형식은 서버로 보낸 값이 아니라
        // 화면 전용 CHAT_OUTPUT_FORMAT_BY_KIND[kind]다 — 서버 응답(_summarize)에는
        // format 필드 자체가 없다(caption도 exhibit도 마찬가지) — 뱃지는 화면이
        // 스스로 안다.
        count: idnbrs.length,
        format: CHAT_OUTPUT_FORMAT_BY_KIND[kind],
        emptyTimeline,
      },
    } : t)))
    bumpOutputsVersion?.()
  }

  // 완료 턴의 파일 카드 — OutputList·OutputDetailPage와 같은 관용구
  // (downloadOutputFile → triggerBrowserDownload, 실패는 서버 사유를 토스트로).
  //
  // round10 최종리뷰 I-4 — 이 턴은 **방금 이 화면에서 만든 산출물**에만 생긴다
  // (captionTurns는 서버에 저장되지 않는 지역 상태다). 그러니 여기 닿는 사람은 언제나
  // 그 산출물의 소유자이고, 소유자 전용 경로 하나면 충분하다. 읽기 전용 상세에서
  // 프로젝트 경유 경로로 갈아끼우던 배선은 도달하지 않아 걷어냈다(위 머리주석).
  async function downloadTurnResult(result) {
    const res = await downloadOutputFile(result.id, result.file_name)
    if (!res.ok) return showToast(res.notice)
    triggerBrowserDownload(res.blob, res.filename)
  }

  // round06c 최종 리뷰 must-fix I-2 — 복사는 실제로 클립보드에 쓴다. 이전에는 아무 동작
  // 없이 '답변을 클립보드에 복사했습니다'를 무조건 띄웠다(정직성 위반). jsdom·비보안
  // 컨텍스트(HTTP)에서는 navigator.clipboard 자체가 없을 수 있어 존재를 먼저 확인하고,
  // 실패(부재·reject) 시에는 정직한 실패 문구를 쓴다 — 성공 문구는 실제 성공 시에만.
  async function handleCopy(text) {
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
    if (!clipboard || typeof clipboard.writeText !== 'function') {
      showToast('복사에 실패했습니다')
      return
    }
    try {
      await clipboard.writeText(text)
      showToast('답변을 클립보드에 복사했습니다')
    } catch {
      showToast('복사에 실패했습니다')
    }
  }

  // AI 답변 하나 — 퍼블 chat_msg.ty_ai(avatar + content(bubble(txt… + cite) + actions)).
  // 라이브는 citations 파싱 결과를, 더미는 시나리오 sources 를 같은 칩 컴포넌트로 그린다.
  function renderAiMessage(msg, key) {
    const cites = isLive ? citedFromText(msg.text, msg.citations) : []
    const sources = !isLive && msg.sources ? msg.sources : []
    return (
      <li key={key} className="chat_msg ty_ai">
        <AiAvatar />
        <div className="chat_msg_content">
          <div className="chat_msg_bubble">
            {toParagraphs(msg.text).map((para, i) => (
              <p
                key={i}
                className={`chat_msg_bubble_txt whitespace-pre-wrap${i > 0 ? ' ty_indent' : ''}`}
              >
                {para}
              </p>
            ))}
            {(cites.length > 0 || sources.length > 0) && (
              <div className="chat_msg_cite">
                {cites.map((cit) => (
                  <CiteChip
                    key={`c-${cit.n}`}
                    num={cit.n}
                    label={cit.name}
                    ariaLabel={`[${cit.n}] ${cit.name}`}
                    onClick={() => handleChip(cit)}
                  />
                ))}
                {sources.map((id, n) => {
                  const mt = materials.find((x) => x.id === id)
                  const label = mt ? mt.title : id
                  return (
                    <CiteChip
                      key={`s-${id}`}
                      num={n + 1}
                      label={label}
                      ariaLabel={`출처 ${n + 1}: ${label}`}
                      onClick={() => handleSourceClick(id)}
                    />
                  )
                })}
              </div>
            )}
          </div>
          <div className="chat_msg_actions">
            {/* round06c 최종 리뷰 must-fix I-2 — 재전송 호출이 없는 실동작 없는 버튼이라
                OutputTab.jsx의 준비중 계약(D1-7)과 통일한다. 이전 '답변을 재생성했습니다'는
                아무 일도 안 하면서 성공을 선언하는 거짓 문구였다.
                round10 — 읽기 전용은 재생성 자체를 막는다(spec §5-4 "막는 것: 재생성").
                저장된 기록을 다시 만들 방법이 없으므로 버튼째 지운다(다른 곳처럼
                disabled로 회색 처리하지 않는 이유는, 이 버튼이 애초에 준비중 토스트만
                내는 실동작 없는 버튼이라 disabled로 남겨 둬도 얻을 것이 없기 때문이다). */}
            {!readOnly && (
              <button
                type="button"
                className="icon_btn"
                aria-label="다시 생성"
                onClick={() => showToast('준비 중입니다')}
              >
                <img src={icChatReset} alt="" className="chat_msg_actions_icon" />
              </button>
            )}
            <button
              type="button"
              className="icon_btn"
              aria-label="복사"
              onClick={() => handleCopy(msg.text)}
            >
              <img src={icChatCopy} alt="" className="chat_msg_actions_icon" />
            </button>
          </div>
        </div>
      </li>
    )
  }

  // 진행 표시 — 퍼블에는 없는 앱 고유 신호라 아바타만 퍼블 클래스를 쓰고 나머지는 Tailwind.
  function renderPendingRow(key, text) {
    return (
      <li key={key} className="chat_msg ty_ai">
        <AiAvatar />
        <div className="flex items-center gap-[10px] text-[13.5px] text-[#8A90A2]">
          <Spinner size={18} /><span>{text}</span>
        </div>
      </li>
    )
  }

  // round07k — captionDecision 자체는 idnbrs만 안다(어느 턴에서 왔는지는 turnId로만
  // 안다). 어느 결정 모달을 열지는 그 턴의 kind로 정한다 — 아래 두 모달 렌더가 함께 쓴다.
  // round10b 재리뷰 M-12 — decisionTurn(위 decisionChips 정의부)이 이미 같은
  // captionTurns.find(t => t.id === captionDecision?.turnId)를 구해 두었다. 그 결과를
  // 재사용한다 — 매 렌더 같은 목록을 같은 조건으로 두 번 훑지 않는다.
  const decisionKind = decisionTurn?.kind

  return (
    <div className="chat_body">
      {topicText && (
        <div className="chat_topic_bar">
          <img src={icChatTopic} alt="" className="chat_topic_bar_icon" />
          <p className="chat_topic_bar_txt">{topicText}</p>
        </div>
      )}

      {/* 라이브 초기 상태 안내 — 퍼블에 없는 앱 고유 신호(후보풀 규모를 알려 질문을 유도한다).
          round10 — 읽기 전용에서는 질문을 유도하지 않는다. 칠 수 없는 입력을 권하는 문구는
          거짓말이 된다(사용자 지적, 2026-09-16 라이브 검증). 저장된 대화가 없다는 사실만 적는다. */}
      {isLive && shown.length === 0 && (
        <div className="text-[13.5px] text-[#8A90A2] py-24 text-center">
          {readOnly
            ? '저장된 대화가 없습니다'
            : poolSize
              ? `'${lastQuery}' 검색 결과 ${poolSize}건을 대상으로 질문하세요`
              : `'${lastQuery}' 검색 결과를 대상으로 질문하세요`}
        </div>
      )}

      {/* 질의 재작성 실패 등 서버 고지 — 퍼블에 없는 앱 고유 신호. */}
      {isLive && chatNotice && (
        <div data-testid="chat-notice-banner"
             className="bg-amber-50 border border-amber-200 text-amber-800 text-[12.5px] rounded-[10px] px-16 py-8">
          {chatNotice}
        </div>
      )}

      <ul className="chat_thread">
        {/* round07f — 메시지와 설명문 턴을 **섞어** 그린다. 턴을 목록 끝에 무조건
            붙이면, 턴을 연 뒤 대화를 계속했을 때 새 메시지가 턴보다 위에 그려져
            순서가 무너진다(턴이 「대화의 한 턴」이 아니게 된다). */}
        {shown.map((msg, idx) => {
          let row
          if (msg.role === 'user') {
            row = (
              <li className="chat_msg ty_user">
                <p className="chat_msg_bubble">{msg.text}</p>
              </li>
            )
          } else if (msg.role === 'ai' && !msg.text) {
            // 빈 AI 메시지는 건너뛴다(T15 onError 가 빈 버블을 남기는 것 방어).
            row = null
          } else {
            row = renderAiMessage(msg, idx)
          }
          // 이 메시지 **뒤**에 속한 턴들(연 시점의 shown.length === idx + 1).
          const turnsHere = captionTurns.filter((t) => t.atIndex === idx + 1)
          return (
            <Fragment key={`row-${idx}`}>
              {row}
              {turnsHere.map((turn) => (
                <ChatCaptionTurn
                  key={`turn-${turn.id}`}
                  turn={turn}
                  onRequestGenerate={(payload) => requestCaptionGenerate(turn.id, payload)}
                  onOpenDetail={openCaptionDoc}
                  onDownload={downloadTurnResult}
                />
              ))}
            </Fragment>
          )
        })}

        {/* round07f R1 Important-1 — 옛 방어 블록(「atIndex가 현재 메시지 수보다 큰 턴은
            목록 끝에 남긴다」)을 없앴다. 그 선택이 새 검색 경로에서 틀렸다 — 비워진 대화에
            옛 턴을 되살려 그렸다(위 captionTurns 정리 effect 주석). 갈 자리가 없어진 턴은
            그리지 않고, effect가 상태에서도 지운다. */}

        {/* 라이브 단계 배지 — 대화 흐름 위치(마지막 메시지 아래)에서 돈다. */}
        {isLive && liveBadge && renderPendingRow('live-pending', liveBadge)}

        {/* 더미 시나리오의 캔드 응답 대기 표시. */}
        {loading && renderPendingRow('dummy-pending', '답변 생성 중 …')}
      </ul>

      {/* round10 — 읽기 전용이면 입력 도크(작업선택 드롭다운 + 입력창 + 전송) 전체를
          렌더하지 않는다(spec §5-4 "막는 것: 새 질문 입력·재생성" · §5-5 "채팅
          입력창·전송·재생성: 없앤다"). form(:821-861, 브리프가 가리킨 범위)만 지우고
          바깥 도크(sticky, 패딩 있음)를 남기면 화면 맨 아래에 빈 흰 띠만 남는다 —
          그래서 도크째 지운다. 작업선택(TaskSelect)도 이 안에 있어 함께 사라지므로,
          채팅에서 새 산출물(설명문·특별전시)을 만드는 진입점도 이 한 줄로 막힌다
          (읽기 전용의 "산출물 생성 금지"도 함께 지킨다 — Global Constraints). */}
      {!readOnly && (
        <div className="chat_input_dock">
          <form className="chat_input_bar" onSubmit={handleSubmit}>
            {/* round07g — 검색모드 토글(<SearchModeToggle />)을 **여기서만** 뺐다.
                피그마 채팅 화면(695-100384)에 그 위젯이 없다. 나머지 둘 —
                IntroSearchCard(첫 검색바)·SearchFlowLayout(재검색바) — 는 그대로 둔다
                (spec 결정 10). 셋 중 채팅 하나만 사라졌다는 것을 ChatTab.test.jsx 와
                SearchFlowLayout.test.jsx 가 함께 잠근다 — 나머지까지 지우면 red 다. */}

            {/* round07f — 작업선택. 실제 항목은 하나뿐이다(대조표 §1-A와 같은 규격 —
                회색 placeholder + 실제 항목). 답변이 하나도 없으면 만들 근거(출처자료)가
                없어 disabled다 — **이 조건은 바꾸지 않았다**.

                round07g — 네이티브 <select> 를 TaskSelect(커스텀 리스트박스)로 바꿨다.
                이유는 하나뿐이다: 목록을 **위로** 펼쳐야 하는데 브라우저는 <select> 의
                펼침 방향을 지정하게 해 주지 않는다. 입력 바는 화면 맨 아래라(.chat_input_dock)
                아래로 열면 목록이 잘린다. 접근성(↑↓·Enter·Esc·바깥클릭·포커스 복귀)은
                TaskSelect 가 되사서 지킨다.

                round07k — 항목이 둘로 늘며 openCaptionTurn → openTaskTurn(kind)로
                일반화됐다. */}
            <TaskSelect
              value={taskValue}
              disabled={!shown.some((m) => m.role === 'ai' && m.text)}
              onChange={(next) => {
                setTaskValue(next)
                // round07k — placeholder('')를 고른 것은 「되돌리기」이지 작업이 아니다.
                if (next && CHAT_TASKS[next]) openTaskTurn(next)
              }}
            />
            <label className="sr_only" htmlFor="chat_input">내용을 입력해주세요</label>
            <input
              type="text"
              className="chat_input_bar_input"
              id="chat_input"
              placeholder="내용을 입력해주세요"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button type="submit" className="chat_input_send" aria-label="전송">
              <img src={icChatSend} alt="" className="chat_input_send_icon" />
            </button>
          </form>
        </div>
      )}

      {/* 자료상세 모달 — 인용칩·출처칩 클릭의 착지점(position:fixed 라 위치 무관). */}
      <MaterialModal material={openMaterial} onClose={() => setOpenMaterial(null)} />

      {/* 설명문 생성 결정 모달(피그마 ③) — 폼 턴·완료 턴과 달리 **화면 중앙 팝업**이다.
          취소는 모달만 닫는다(폼 턴은 대화에 남아 다시 누를 수 있다).
          round07k — 결정 모달은 종류별로 갈린다. 설명문은 타임라인이 있다 —
          decisionKind로 가른다. */}
      <ChatCaptionDecisionModal
        open={Boolean(captionDecision) && decisionKind === 'caption'}
        count={captionDecision?.idnbrs.length ?? 0}
        onCancel={() => setCaptionDecision(null)}
        onConfirm={confirmCaptionDecision}
      />
      {/* round10b B-4 — 학예 기획 자료(exhibit)의 결정 단계는 새 모달이 아니라
          산출물생성 탭이 쓰는 같은 컬럼 선택 모달(ExhibitModal)을 그대로 연다
          (사용자 결정 — "산출물 생성처럼 똑같이 할거야"). key를 turnId로 거는
          이유 — ExhibitModal은 title·columns를 자기 state로만 갖고 open이
          바뀌어도 리셋하지 않는다(이 태스크는 그 파일을 고치지 않는다, "새 UI를
          만들지 마라"). 그래서 새 턴(다른 turnId)이 열릴 때 앞 턴에서 고치던
          제목·컬럼이 남지 않도록 turnId가 바뀌면 통째로 새로 마운트한다. chips는
          "노드"가 아니라 대화가 모아 온 자료 하나하나다(decisionChips 정의부 참조,
          count는 항상 1) — 전부 제거하면 total이 0이 되어 canSubmit이 꺼진다(
          다만 그 상태의 "선택한 자료가 없습니다 — 노드를 열어…" 안내는 산출물생성
          탭 문구 그대로다 — 새 UI를 만들지 않기로 한 선택의 대가로 남겨 둔다). */}
      <ExhibitModal
        key={captionDecision?.turnId ?? 'none'}
        open={Boolean(captionDecision) && decisionKind === 'exhibit'}
        chips={decisionChips}
        total={captionDecision?.idnbrs.length ?? 0}
        defaultTitle={defaultOutputTitle('exhibit')}
        onClose={() => setCaptionDecision(null)}
        onRemoveChip={removeDecisionChip}
        onSubmit={confirmExhibitDecision}
      />
    </div>
  )
}
