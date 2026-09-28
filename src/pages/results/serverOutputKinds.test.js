// 이 파일의 책임: 프론트 테스트가 서버의 kind 전체 목록을 손으로 베끼지 않도록,
// `workspace/app/src/museum/outputs/routes.py`의 `CreateOutputRequest.kind`
// Literal[...] 선언을 직접 읽어 도출해 준다. 앱 런타임 코드는 이 파일을 쓰지
// 않는다 — 오직 테스트 전용 헬퍼다(permissions.test.js가 schema.sql을 읽어
// ROLES를 대조하는 것과 같은 결의 선례를 따른다).
//
// round07i 재리뷰 — OutputList.test.jsx·OutputDetailPage.test.jsx가 각자
//   const SERVER_KINDS = ['caption', 'exhibit', 'exhibition']
// 를 하드코딩해 두고 있었다. 이 상수는 routes.py의 실제 Literal과 아무 배선도
// 없어서, 서버가 kind를 하나 더 열어도(예: 'poster') 이 상수는 그대로 남고
// it.each가 새 kind를 절대 돌지 않는다 — 이번에 고친 버그(exhibition 라벨
// 누락)를 그대로 재현하는 실패 모양이다. 그래서 routes.py를 직접 읽는다.
//
// [왜 파일명이 serverOutputKinds.js 가 아니라 .test.js 인가(최종 리뷰 F5)]
// 처음엔 `.js`였다 — 그런데 그 이름으로는 `pages/results` 안의 진짜 컴포넌트와
// 구분이 안 되고, `node:fs`를 import하면서도 `coverage.include: ['src/**']`
// (vite.config.js) 안에 그대로 잡혀 커버리지 대상이 됐다. 이 저장소의 다른
// source-reading 헬퍼(permissions.test.js·css-contract.test.js 등)는 전부
// `*.test.js`다 — vitest 기본 coverage.exclude(`**/*.test.*`)가 그 이름만으로
// 이 파일들을 커버리지에서 빼 준다. 여기만 이름이 달라 그 보호를 못 받고
// 있었다. `.test.js`로 옮기면 같은 보호를 받고, 컴포넌트 트리 안에서 봐도
// "이건 테스트다"가 이름만으로 드러나 실수로 import될 여지가 준다.
//
// [왜 이 파일엔 test()가 하나도 없는가 — 다른 *.test.js와 달리]
// 처음엔 이 파일 자신의 파싱 로직을 검증하는 test()를 여기 뒀다(vitest는 test
// include 패턴에 걸리는 파일에 테스트가 0개면 "No test suite found"로 그 파일을
// 실패시키므로 — @vitest/runner). 그런데 이 파일은 `OutputList.test.jsx`·
// `OutputDetailPage.test.jsx` 양쪽이 `import`하는 **공유 모듈**이다 — vitest는
// 테스트 파일마다 모듈을 새로 평가하므로(파일 단위 격리), 이 파일의 top-level
// test() 호출은 이 파일이 직접 실행될 때뿐 아니라 그 **두 파일이 이 모듈을
// import할 때마다 각각 다시 실행돼 그 파일의 테스트 목록에 끼어든다**(실측:
// `npm test`에서 "OutputDetailPage.test.jsx > parseServerOutputKinds: …" 라는,
// 그 파일에 없는 이름의 테스트가 나타났다 — 3중 실행: 이 파일 자신 + import한
// 두 파일). 값은 같아 거짓 실패는 아니지만 다른 화면의 스위트에 이 파일의
// 이름이 새는 것은 잘못된 신호다. 그래서 test()는 두지 않고, 대신
// `vite.config.js`의 `test.exclude`에 이 경로를 추가해 vitest가 이 파일을
// **독립 진입점으로는 아예 돌리지 않게** 한다 — "No test suite found"가 날 일
// 자체가 없어진다. 파싱 로직이 실제로 맞는지는 `getServerOutputKinds()`가 이미
// 스스로 검증한다(아래 [추출이 빈약하면] 참조) — 잘못 추출되면 그 두 화면
// 테스트가 곧바로 에러로 죽는다(조용히 통과하지 않는다).
import fs from 'node:fs'
import path from 'node:path'

// __dirname = <ROOT>/workspace/app/web/src/pages/results
// 네 단계 위(workspace/app)에서 src/museum/outputs/routes.py로 내려간다.
const ROUTES_PY = path.join(
  __dirname, '..', '..', '..', '..', 'src', 'museum', 'outputs', 'routes.py',
)

// 이 라운드(round07i) 이전부터 있던 kind. routes.py 형식이 바뀌어 정규식이
// 엉뚱한 텍스트를 붙잡았더라도, 이 둘이 빠져 있으면 바로 드러난다.
const KNOWN_BASELINE_KINDS = ['caption', 'exhibit']

/**
 * routes.py 원문에서 `CreateOutputRequest.kind`의 `Literal[...]` 목록을 뽑는다.
 * 순수 함수 — 파일 IO는 호출부(getServerOutputKinds)가 한다.
 * `kind:` 접두를 요구해, 같은 파일의 `format: Literal[...]`이나 docstring 속
 * 예시 문구(`Literal["exhibit"]`, "kind:" 없이 인용된 문구)를 붙잡지 않는다.
 * @param {string} source routes.py 전문
 * @returns {string[]} 예: ['caption', 'exhibit', 'exhibition']
 */
export function parseServerOutputKinds(source) {
  const m = source.match(/kind:\s*Literal\[([^\]]*)\]/)
  if (!m) return []
  return m[1]
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
}

let cached = null

/**
 * 서버가 `POST /outputs`로 받을 수 있는 kind 전부(캐시됨 — 같은 프로세스
 * 안에서 파일을 여러 번 읽지 않는다. 파일 자체는 테스트 실행마다 새로 읽으므로
 * routes.py가 바뀌면 다음 `npx vitest run`에 곧바로 반영된다).
 *
 * **추출이 빈약하면(=정규식이 더 이상 매치하지 않거나 알려진 kind가 빠지면)
 * 조용히 빈 배열/부분 배열을 돌려주지 않고 즉시 던진다.** `it.each([])`는
 * 0건을 그대로 통과시켜 "가드가 아무것도 안 도는데 스위트는 초록"이라는,
 * 이 헬퍼가 막으려는 바로 그 실패 모양을 재현하기 때문이다.
 */
export function getServerOutputKinds() {
  if (cached) return cached
  const source = fs.readFileSync(ROUTES_PY, 'utf8')
  const kinds = parseServerOutputKinds(source)
  const missing = KNOWN_BASELINE_KINDS.filter((k) => !kinds.includes(k))
  const eachLooksValid = kinds.every((k) => /^[a-z][a-z0-9_]*$/.test(k))
  if (kinds.length === 0 || missing.length > 0 || !eachLooksValid) {
    throw new Error(
      'routes.py에서 CreateOutputRequest.kind의 Literal 목록을 신뢰할 수 있게 ' +
        `추출하지 못했다(추출값: ${JSON.stringify(kinds)}, 빠진 기존 kind: ` +
        `${JSON.stringify(missing)}). CreateOutputRequest.kind 선언 형식이 ` +
        '바뀌었을 수 있다 — serverOutputKinds.test.js의 parseServerOutputKinds ' +
        '정규식을 routes.py 실제 문구에 맞춰 갱신하라. (빈 배열을 그대로 ' +
        '쓰면 it.each가 0건을 통과시켜 이 가드 자체가 무력화된다.)',
    )
  }
  cached = kinds
  return kinds
}
