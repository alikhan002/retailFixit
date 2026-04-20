import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  loading?: boolean
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-[var(--lagoon-deep)] text-white border-transparent hover:bg-[var(--lagoon)] disabled:opacity-50',
  secondary:
    'bg-[var(--chip-bg)] text-[var(--sea-ink)] border-[var(--chip-line)] hover:bg-[var(--link-bg-hover)] disabled:opacity-50',
  ghost:
    'bg-transparent text-[var(--sea-ink-soft)] border-transparent hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)] disabled:opacity-50',
  danger:
    'bg-[rgba(180,40,40,0.1)] text-[#a02020] border-[rgba(180,40,40,0.2)] hover:bg-[rgba(180,40,40,0.18)] disabled:opacity-50 dark:text-[#f08080]',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled ?? loading}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lagoon)] ${
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
      } ${variantClasses[variant]} ${className}`}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  )
}
