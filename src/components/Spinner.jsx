export default function Spinner({ size = 20, className = '' }) {
  return (
    <span
      className={`inline-block rounded-full border-2 border-line border-t-primary-600 animate-spin ${className}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label="로딩 중"
    />
  )
}
