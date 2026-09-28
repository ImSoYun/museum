// 이 파일의 책임: 두 설명문 모달이 함께 쓰는 **제목 입력 조각**.
//
// [왜 조각으로 뽑았나]
// 「제목 설정」은 채팅 프레임에도 산출물생성 프레임에도 있다. 라벨과 placeholder 가
// 두 벌로 적히면 한쪽만 고쳐지는 날이 온다 — round07g 가 생긴 이유가 정확히 그것이다
// (부제 한 줄이 「결정하세요.」/「결정해주세요.」로 갈린 채 라이브에 나갔다).
//
// [그런데 왜 뼈대(CaptionModalShell)가 아니라 별도 조각인가]
// **놓는 자리가 두 프레임에서 다르기 때문이다.** 채팅은 부제 바로 아래 맨 위,
// 산출물생성은 선택 자료·구분선 다음이다. 뼈대가 제목을 그려 버리면 자리가 하나로
// 굳어 두 프레임 중 하나와 반드시 어긋난다. 그래서 뼈대는 가운데를 children 으로만
// 두고, 이 조각을 각 모달이 자기 순서에 맞는 자리에 끼운다.
//
// [상태를 갖지 않는 이유]
// 제목의 기본값 규칙이 두 모달에서 다르다(산출물생성=타임라인 꺼짐 기준값,
// 채팅=켜짐 기준값). 값과 변경은 부모가 쥐고, 이 조각은 그리기만 한다.
//
// [round07k 최종 리뷰가 placeholder를 prop으로 뺐던 이유 — round10b 재리뷰 M-8로 되돌림]
// 당시 ChatExhibitionDecisionModal이 이 조각을 쓰지 않고 손으로 입력칸을 그려
// maxLength(서버 상한 100자)·높이·모서리 반경·테두리색이 설명문과 갈려 있었다
// (리뷰 F1) — 그 파일이 이 조각을 가져다 쓰게 하려고 placeholder만 prop으로 뺐다.
// round10b B-4가 ChatExhibitionDecisionModal.jsx를 지웠고(특별전시 결정 모달을
// 채팅에서 없앴다), 남은 두 호출부(CaptionModal.jsx·ChatCaptionDecisionModal.jsx)는
// 어느 쪽도 placeholder를 넘기지 않는다 — prop이 죽었다. 되살릴 소비처가 없으므로
// 다시 하드코딩한다.
export default function CaptionTitleField({ value = '', onChange, id = 'caption-title' }) {
  const placeholder = '설명문 타이틀'
  return (
    <section className="flex flex-col gap-6">
      {/* 라벨에 번호를 붙이지 않는다 — 피그마의 빨간 원은 디스크립션 주석이지
          화면 글자가 아니다(round07e 가 그 주석을 라벨로 옮겨 적었다). */}
      <label htmlFor={id} className="text-[13px] font-bold text-ink">
        제목 설정
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        maxLength={100}
        placeholder={placeholder}
        className="w-full h-[38px] rounded-[5px] px-3 text-[13px] bg-white text-[#1A1F2B] border border-[#E2E5EE]" style={{ paddingLeft : "10px"}}
      />
    </section>
  )
}
