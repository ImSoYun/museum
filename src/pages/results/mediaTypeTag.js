// 이 파일의 책임: 종류 → 카드 뱃지 색 클래스(round07m).
//
// 이미지·영상·도서는 퍼블 component.css:441-443 의 .tag.ty_* 를 그대로 쓴다. 음원·기타는
// 퍼블에 색이 없어(4색 — 이미지·영상·도서·웹콘텐츠) publish-ext.css 에 자체 정의했다
// (spec 디자인 참조 (c)). 웹콘텐츠(ty_web)는 원천 어휘에 없어 쓰지 않는다.
const TAG_CLASS = {
  이미지: 'ty_image',
  영상: 'ty_video',
  도서: 'ty_book',
  음원: 'ty_audio',
  기타: 'ty_etc',
}

export function mediaTypeTagClass(value) {
  return TAG_CLASS[value] ?? ''
}
