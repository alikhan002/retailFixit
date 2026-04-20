interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted'
  size?: 'sm' | 'md'
}

const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-[var(--chip-bg)] text-[var(--sea-ink)] border-[var(--chip-line)]',
  success: 'bg-[rgba(47,106,74,0.12)] text-[var(--palm)] border-[rgba(47,106,74,0.2)]',
  warning: 'bg-[rgba(180,120,0,0.1)] text-[#8a6000] border-[rgba(180,120,0,0.2)] dark:text-[#f0c040] dark:bg-[rgba(180,120,0,0.15)]',
  danger: 'bg-[rgba(180,40,40,0.1)] text-[#a02020] border-[rgba(180,40,40,0.2)] dark:text-[#f08080] dark:bg-[rgba(180,40,40,0.15)]',
  info: 'bg-[rgba(79,184,178,0.12)] text-[var(--lagoon-deep)] border-[rgba(79,184,178,0.2)]',
  muted: 'bg-transparent text-[var(--sea-ink-soft)] border-[var(--line)]',
}

export function Badge({ children, variant = 'default', size = 'sm' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      } ${variantClasses[variant]}`}
    >
      {children}
    </span>
  )
}
