/**
 * ManagePageHeader — gradient page-header band shared across 자료관리 pages.
 * Props:
 *   title    {string} — primary heading (22px/800)
 *   subtitle {string} — secondary descriptor line
 */
export default function ManagePageHeader({ title, subtitle }) {
  return (
    <div className="bg-gradient-to-r from-primary-50 to-primary-100 px-8 py-6 border-b border-line">
      <h1 className="text-[22px] font-bold text-ink leading-tight">{title}</h1>
      {subtitle && (
        <p className="text-sm text-[#5A6173] mt-1">{subtitle}</p>
      )}
    </div>
  )
}
