import Button from './Button.jsx'

export default function EmptyState({ title, description, action, icon }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {icon && <div className="mb-4 text-[#C4C9D6]">{icon}</div>}
      <p className="text-base font-bold text-ink-900">{title}</p>
      {description && <p className="mt-1.5 text-sm text-[#8A90A2] max-w-md">{description}</p>}
      {action && (
        <Button variant="primary" size="md" className="mt-5" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
