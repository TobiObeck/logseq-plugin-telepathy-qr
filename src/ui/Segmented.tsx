export interface Choice<T extends string> {
  value: T
  label: string
  disabled?: boolean
  title?: string
}

/**
 * A segmented control (button group). The workhorse of the options panel:
 * every export option is one of these.
 */
export function Segmented<T extends string>({
  value,
  choices,
  onChange,
  disabled = false,
}: {
  value: T
  choices: Choice<T>[]
  onChange: (value: T) => void
  disabled?: boolean
}) {
  return (
    <span className="tq-seg">
      {choices.map((choice) => (
        <button
          key={choice.value}
          type="button"
          className={choice.value === value ? 'active' : ''}
          disabled={disabled || choice.disabled === true}
          title={choice.title}
          onClick={() => onChange(choice.value)}
        >
          {choice.label}
        </button>
      ))}
    </span>
  )
}
