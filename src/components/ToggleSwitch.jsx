/**
 * ToggleSwitch — iOS-style toggle
 * Props: checked (bool), onChange (fn)
 */
export default function ToggleSwitch({ checked, onChange, ...rest }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange?.(!checked)}
      {...rest}
      className={[
        'relative inline-flex items-center w-10 h-[23px] rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-1',
        checked ? 'bg-primary-600' : 'bg-[#CBD1DE]',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-[3px] w-[17px] h-[17px] bg-white rounded-full shadow transition-all duration-200',
          checked ? 'left-[20px]' : 'left-[3px]',
        ].join(' ')}
      />
    </button>
  )
}
