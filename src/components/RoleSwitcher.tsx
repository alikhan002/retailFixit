import { MOCK_USERS, useSessionStore } from '#/stores/session-store'

const ROLE_LABELS: Record<string, string> = {
  dispatcher: 'Dispatcher',
  vendor_manager: 'Vendor Manager',
  admin: 'Admin',
  support_agent: 'Support Agent',
}

export function RoleSwitcher() {
  const { currentUser, setUser } = useSessionStore()

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-[var(--text-muted)] hidden sm:inline">Role:</span>
      <select
        value={currentUser.id}
        onChange={(e) => {
          const user = MOCK_USERS.find((u) => u.id === Number(e.target.value))
          if (user) setUser(user)
        }}
        className="rounded-md border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-1 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--lagoon)] cursor-pointer"
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
