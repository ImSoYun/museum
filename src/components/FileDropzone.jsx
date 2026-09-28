// 이 파일의 책임: 퍼블 `label.upload_dropzone` 마크업을 그대로 옮긴 파일 업로드 드롭존.
//
// 구조상의 핵심 — label이 곧 드롭 표적이자 클릭 표적이다. 어디를 클릭하든 label의 기본
// 동작으로 내부 input[type=file]이 열리므로 "파일선택"은 button이 아니라 aria-hidden span이다.
// span을 button으로 바꾸면 (a) label의 콘텐츠 모델(phrasing content) 위반이고
// (b) 클릭이 button의 onClick과 label의 기본 동작을 둘 다 발동시켜 대화상자가 두 번 뜬다.
import { useState } from 'react'
import icUpload from '../assets/icons/ic_upload.svg'

/**
 * FileDropzone
 * Props:
 *   id       {string}  — 퍼블 드롭존 id. 숨김 input의 id는 `${id}_input`.
 *   accept   {string}  — input accept 속성
 *   multiple {boolean} — 기본 true(퍼블 원문)
 *   title    {string}  — 큰 안내 문구
 *   desc     {string}  — 작은 안내 문구
 *   onFiles  {(names: string[]) => void} — 선택·드롭된 파일명 배열
 */
export default function FileDropzone({ id, accept, multiple = true, title, desc, onFiles }) {
  const [dragover, setDragover] = useState(false)
  const [names, setNames] = useState([])

  // 순수 로직: FileList → 파일명 배열. 빈 선택(대화상자 취소)은 상태를 건드리지 않는다.
  function emit(fileList) {
    const picked = Array.from(fileList ?? []).map((f) => f.name)
    if (picked.length === 0) return
    setNames(picked)
    onFiles?.(picked)
  }

  function handleDragOver(e) {
    e.preventDefault()
    setDragover(true)
  }
  function handleDragLeave(e) {
    e.preventDefault()
    setDragover(false)
  }
  function handleDrop(e) {
    e.preventDefault()
    setDragover(false)
    emit(e.dataTransfer?.files)
  }

  const zoneClass = ['upload_dropzone', dragover ? 'is_dragover' : '', names.length ? 'has_file' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <label
      className={zoneClass}
      id={id}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        className="upload_dropzone_input"
        id={`${id}_input`}
        accept={accept}
        multiple={multiple}
        onChange={(e) => emit(e.target.files)}
      />
      <span className="upload_dropzone_inner">
        <span className="upload_dropzone_txt">
          {/* D2a: 퍼블 v2(manage_ocr.html:44)는 이 타이틀을 전용 클래스가 아니라
              alert_popup/data_panel/template_bar/upload_dropzone 공용 .section_tit로
              옮겼다(component.css의 upload_dropzone 그룹이 함께 갱신됨). 값은 종전
              upload_dropzone_tit와 동일(1.2rem/700/#333)이라 시각 회귀가 없다. */}
          <span className="section_tit">{title}</span>
          <span className="upload_dropzone_desc">{desc}</span>
          {/* has_file일 때 tit·desc가 CSS로 숨고 이 줄만 남는다 */}
          <span className="upload_dropzone_filename" aria-live="polite">{names.join(', ')}</span>
        </span>
        <span className="upload_dropzone_btn" aria-hidden="true">
          <img src={icUpload} alt="" className="upload_dropzone_btn_icon" />
          파일선택
        </span>
      </span>
    </label>
  )
}
