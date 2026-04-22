import { Link } from '@tanstack/react-router'
import ThemeToggle from './ThemeToggle'
import { RoleSwitcher } from './RoleSwitcher'
import { useJobsStore } from '#/stores/jobs-store'

export default function Header() {
  const openShortcuts = useJobsStore((s) => s.openShortcuts)

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--header-bg)] px-4 backdrop-blur-lg">
      <nav
        className="page-wrap flex flex-wrap items-center gap-x-3 gap-y-2 py-3 sm:py-4"
        aria-label="Main navigation"
      >
        <h1 className="m-0 flex-shrink-0 text-base font-semibold tracking-tight">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm text-[var(--sea-ink)] no-underline shadow-[0_8px_24px_rgba(30,90,72,0.08)] sm:px-4 sm:py-2"
            aria-label="RetailFixIt home"
          >
            <span
              className="h-2 w-2 rounded-full bg-[linear-gradient(90deg,#56c6be,#7ed3bf)]"
              aria-hidden="true"
            />
            RetailFixIt
          </Link>
        </h1>

        <div className="order-3 flex w-full flex-wrap items-center gap-x-4 gap-y-1 pb-1 text-sm font-semibold sm:order-2 sm:w-auto sm:flex-nowrap sm:pb-0">
          <Link
            to="/jobs"
            className="nav-link"
            activeProps={{ className: 'nav-link is-active' }}
          >
            Jobs
          </Link>
          <Link
            to="/about"
            className="nav-link"
            activeProps={{ className: 'nav-link is-active' }}
          >
            About
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:ml-0 sm:gap-2">
          <RoleSwitcher />
          <ThemeToggle />
          <button
            onClick={openShortcuts}
            className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-2.5 py-1.5 font-mono text-xs font-semibold text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)] transition-colors"
            aria-label="Show keyboard shortcuts"
            title="Keyboard shortcuts (?)"
          >
            ?
          </button>
        </div>
      </nav>
    </header>
  )
}
