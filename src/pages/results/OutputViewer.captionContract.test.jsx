// 이 파일의 책임: round07i 변이 테스트 3회차가 드러낸 빈틈을 메운다.
//
// [빈틈이 뭐였는가]
// OutputViewer.test.jsx의 groups 테스트들은 `getOutputDoc`을 모킹해 **손으로 쓴**
// doc을 돌려준다. 그래서 `outputs/doc_builder.caption_to_doc`이 실제로
// `payload["groups"] = …`를 잊어도(=이 라운드가 고치는 버그가 되살아나도) 그
// 모킹 테스트는 전부 green이다 — 모킹이 서버 코드와 완전히 분리돼 있어서다.
// 실측(round07i 변이 3): `caption_to_doc`에서 그 한 줄을 지운 뒤 `npm test`를
// 돌려도 실패하는 프론트 테스트가 **0개**였다.
//
// [이 파일의 이전 판과 왜 바꿨는가 — round07i 리뷰 Important 2]
// 이전 판은 `execFileSync`로 `uv run python -c "..."`를 스폰해 실제
// `caption_to_doc`을 호출하고 그 출력을 모킹 없이 OutputViewer에 먹였다. 리뷰가
// 잡은 문제 셋:
//   ① `execFileSync`에 타임아웃이 없다 — 걸리면 이 테스트가 스위트를 통째로 물고
//      늘어진다.
//   ② `uv`가 PATH에 없는 환경(Python/uv 없는 Node 전용 레인)에서는 `ctx.skip()`
//      으로 조용히 건너뛴다 — 0 신호로 통과하는 것과 같다(코딩표준 §6 위반).
//   ③ 그 서브프로세스가 실제로 검증하는 것(같은 연도 묶기·빈 입력)은 이미
//      `tests/test_doc_builder.py`·`tests/test_timeline_group.py`(백엔드)가 값으로
//      잠그고 있다 — 여기서 다시 함수를 실행해 같은 semantics를 재확인할 필요가
//      없다.
// 프론트가 정말 잃지 않아야 할 것은 단 하나 — **`doc_builder.py`가
// `payload["groups"]`를 계속 계산해 싣는다는 배선(wiring) 사실**뿐이다. 그래서
// `src/data/envGates.test.js`(§R-11 「소스를 텍스트로 읽어 배선을 확인한다」)와
// 같은 패턴으로 바꿨다 — 서브프로세스 없음·uv 의존 없음·환경 조건부 skip 없음.
// 이 방식은 값(같은 연도가 실제로 몇 개로 묶이는지)을 검증하지 않는다 — 그건
// 위 백엔드 테스트들의 몫이다. 여기서는 그 계산을 뷰어에 전달하는 한 줄이
// 사라지지 않았는지만 본다.
//
// [round07i 최종 리뷰 F2 — exhibition_to_doc의 overview_labels·intro_heading도
//  같은 빈틈을 가진다]
// `exhibition_docx.py`의 `OVERVIEW_LABELS`·`INTRO_HEADING`을 뷰어가 다시
// 타이핑하지 않고 `doc_builder.exhibition_to_doc`이 실어 보내는 값을 읽게 고쳤다
// (OutputViewer.jsx `ExhibitionDocument`·`exhibitionPlainText`). 이 값이 실제로
// payload에 실려 있다는 사실은 `tests/test_doc_builder.py`가 값으로 잠그지만,
// 그건 `uv run pytest`에서만 돈다 — `npm test`만 도는 프론트 CI 레인은 누군가
// `exhibition_to_doc`에서 그 대입 두 줄을 지워도 `OutputViewer.test.jsx`의
// exhibition 목(mock)이 자기 doc에 이미 라벨을 손으로 박아 둔 채라 여전히
// green이다(위 groups와 같은 실패 모양). 그래서 그 배선 두 줄도 여기서 같이 지킨다.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// web/src/pages/results → web/src → web → app (workspace/app, pyproject.toml이 있는 자리).
const APP_DIR = path.resolve(__dirname, '../../../../')
const DOC_BUILDER_PATH = path.join(APP_DIR, 'src/museum/outputs/doc_builder.py')
const read = (p) => fs.readFileSync(p, 'utf8')

// 정확히 이 대입문을 찾는다 — `caption_to_doc`이 `payload["groups"]`를 계산해
// 싣는 그 한 줄이다(doc_builder.py 참조). 부분 문자열이 아니라 대입 전체를
// 찾는 이유: `"groups"`라는 낱말만 찾으면 주석에 그 낱말이 남아 있는 것만으로도
// (예: 이 줄을 지우면서 주석만 남기는 실수) 조용히 통과할 수 있다.
const GROUPS_ASSIGNMENT = 'payload["groups"] = ['

test(
  'doc_builder.caption_to_doc이 groups를 계속 싣는다(round07i 계약) — ' +
  '지우면 화면·복사 평문이 파일과 다시 갈라진다',
  () => {
    const src = read(DOC_BUILDER_PATH)
    // 빈 찾기가 조용히 통과하지 않도록, 먼저 그 줄을 실제로 찾았는지부터 확인한다.
    const found = src.includes(GROUPS_ASSIGNMENT)
    expect(
      found,
      `${DOC_BUILDER_PATH}에서 '${GROUPS_ASSIGNMENT}'를 찾지 못했다 — ` +
      'caption_to_doc이 groups를 안 실으면 뷰어(OutputViewer.jsx)가 옛 산출물 ' +
      '폴백(items를 항목별 한 행으로)으로 떨어져 같은 연도가 화면과 복사한 ' +
      '평문 양쪽에서 다시 두 번 찍힌다(round07i 결함 재발). 같은 값(그룹이 ' +
      '실제로 몇 개로 묶이는지)은 tests/test_doc_builder.py·' +
      'test_timeline_group.py(백엔드)가 이미 잠근다 — 이 테스트는 그 계산을 ' +
      '뷰어까지 실어 나르는 배선 한 줄만 지킨다.',
    ).toBe(true)
  },
)

// 정확히 이 두 대입문을 찾는다 — `exhibition_to_doc`이 렌더러 상수를 payload에
// 싣는 줄이다(doc_builder.py 참조). GROUPS_ASSIGNMENT와 같은 이유로 낱말이 아닌
// 대입 전체를 찾는다.
const OVERVIEW_LABELS_ASSIGNMENT = '"overview_labels": list(OVERVIEW_LABELS),'
const INTRO_HEADING_ASSIGNMENT = '"intro_heading": INTRO_HEADING,'

test(
  'doc_builder.exhibition_to_doc이 overview_labels·intro_heading을 계속 싣는다' +
  '(round07i 최종 리뷰 F2) — 지우면 화면·복사 평문·파일이 다시 갈라진다',
  () => {
    const src = read(DOC_BUILDER_PATH)
    const missing = [OVERVIEW_LABELS_ASSIGNMENT, INTRO_HEADING_ASSIGNMENT].filter(
      (line) => !src.includes(line),
    )
    expect(
      missing,
      `${DOC_BUILDER_PATH}에서 다음 대입을 찾지 못했다: ${JSON.stringify(missing)} — ` +
      'exhibition_to_doc이 이 값들을 안 실으면 뷰어(OutputViewer.jsx)의 ' +
      'ExhibitionDocument·exhibitionPlainText가 undefined를 그려 개요 라벨·' +
      '"전시를 열며" 제목이 화면·복사 평문에서 사라진다. 같은 값이 렌더러 ' +
      '상수(adapters/exhibition_docx.OVERVIEW_LABELS·INTRO_HEADING)와 같은지는 ' +
      'tests/test_doc_builder.py가 이미 값으로 잠근다 — 이 테스트는 그 값을 ' +
      '뷰어까지 실어 나르는 배선 두 줄만 지킨다.',
    ).toEqual([])
  },
)
