// 이 파일의 책임: 두 설명문 모달이 함께 쓰는 **제목 입력 조각**(CaptionTitleField).
//
// 「제목 설정」은 채팅 프레임에도 산출물생성 프레임에도 있다. 다만 **놓는 자리가
// 다르다**(채팅=맨 위 / 산출물생성=구분선 아래). 자리는 각자여도 **라벨과
// placeholder 는 갈리면 안 되므로** 조각으로 뽑아 여기서 한 번만 잠근다.
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CaptionTitleField from './CaptionTitleField.jsx'

describe('설명문 제목 입력 조각', () => {
  it('라벨은 「제목 설정」이고 placeholder 는 「설명문 타이틀」이다', () => {
    render(<CaptionTitleField value="" onChange={() => {}} />)
    const input = screen.getByLabelText('제목 설정')
    expect(input).toHaveAttribute('placeholder', '설명문 타이틀')
  })

  // 「1. 선택 자료」식 번호는 피그마의 **디스크립션 주석**(빨간 원)이지 화면 글자가
  // 아니다 — round07e가 그 주석을 라벨로 옮겨 적어 화면에 번호가 남아 있었다.
  it('라벨에 번호를 붙이지 않는다', () => {
    render(<CaptionTitleField value="" onChange={() => {}} />)
    expect(screen.queryByText(/^\d+\.\s/)).toBeNull()
    expect(screen.getByText('제목 설정').textContent).toBe('제목 설정')
  })

  it('value 를 그대로 그리고, 입력은 onChange 로 위임한다 — 조각은 상태를 갖지 않는다', () => {
    const onChange = vi.fn()
    render(<CaptionTitleField value="처음 제목" onChange={onChange} />)
    const input = screen.getByLabelText('제목 설정')
    expect(input).toHaveValue('처음 제목')

    fireEvent.change(input, { target: { value: '고친 제목' } })
    expect(onChange).toHaveBeenCalledWith('고친 제목')
    // 위임했을 뿐 스스로 바꾸지 않는다(부모가 다시 내려주기 전까지 값은 그대로다).
    expect(input).toHaveValue('처음 제목')
  })

  // 두 모달이 한 화면에 함께 뜰 일은 없지만, id 를 하드코딩하면 라벨 연결이
  // 조용히 어긋날 수 있는 자리다(htmlFor 와 id 가 갈리면 getByLabelText 가 죽는다).
  it('id 를 넘기면 라벨과 입력이 그 id 로 이어진다', () => {
    render(<CaptionTitleField value="" onChange={() => {}} id="chat-caption-title" />)
    const input = screen.getByLabelText('제목 설정')
    expect(input).toHaveAttribute('id', 'chat-caption-title')
  })
})
