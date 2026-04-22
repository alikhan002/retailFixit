import { useEffect, useState } from 'react'
import { MOCK_USERS, useSessionStore } from '#/stores/session-store'

const ROLE_LABELS: Record<string, string> = {
  dispatcher: 'Dispatcher',
  vendor_manager: 'Vendor Manager',
  admin: 'Admin',
  support_agent: 'Support Agent',
}

export function RoleSwitcher() {
  const { currentUser, setUser } = useSessionStore()
  // Avoid SSR/client hydration mismatch — localStorage is only available on the client
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="hidden sm:inline text-[var(--sea-ink-soft)]">Role:</span>
      <select
        value={mounted ? currentUser.id : MOCK_USERS[0].id}
        suppressHydrationWarning
        onChange={(e) => {
          const user = MOCK_USERS.find((u) => u.id === Number(e.target.value))
          if (user) setUser(user)
        }}
        className="rounded-md border border-[var(--line)] bg-[var(--chip-bg)] px-2 py-1 text-sm text-[var(--sea-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--lagoon)] cursor-pointer"
        aria-label="Switch role"
      >
        {MOCK_USERS.map((u) => (
          <option key={u.id} value={u.id}>
            {ROLE_LABELS[u.role]} — {u.name.split(' ')[0]}
          </option>
        ))}
      </select>
    </div>
  )
}
