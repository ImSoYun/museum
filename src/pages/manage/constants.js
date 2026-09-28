/**
 * 이 파일의 책임: 자료관리 5화면(ocr·meta·embedding·history·materials)이 공유하는 표시 상수.
 *
 * 왜 하나로 모으는가 — 현행 페이지 크기가 화면마다 제각각이었다
 * (Ocr 5 · Meta 10 · Embedding 8 · History 8 · Materials 8, 실측).
 * 퍼블 tbody 실측 행수는 ocr 10 · meta 10 · embedding 10 · history 12 · list 12 이고
 * 다섯 화면의 행 높이 규격이 height:2.5rem 으로 동일하므로(component.css:120)
 * 화면마다 행 수가 다를 근거가 없다. 최빈값 10을 채택한다(§8.0.5).
 *
 * 각 화면이 자기 모듈 상수를 지우고 이 값을 import 하는 것은 그 화면 태스크의 몫이며,
 * 행 수에 의존하는 테스트를 고치는 것도 함께 그 화면 태스크가 한다.
 */
export const PAGE_SIZE = 10
