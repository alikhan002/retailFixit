# RetailFixIt — UI Architecture Write-Up

---

## 1. Page & Component Breakdown

### Routes

```
/          → redirects to /jobs
/jobs      → Job Dashboard
/jobs/$jobId → Job Detail Page
/about     → About
```

Each route defines a `loader` (SSR data fetch), an `errorComponent` (isolated error boundary), and a `component`.

### Job Dashboard (`/jobs`)

```
<JobDashboard>
  ├── <RealtimeBanner>        # Non-blocking SSE notification, dismissible
  ├── <JobFilters>            # Status / priority / vendor dropdowns (Zustand)
  ├── <JobCardSkeleton × 6>  # Layout-matched placeholders during load
  ├── <JobCard × n>           # Paginated list → links to /jobs/$jobId
  │     ├── <JobStatusBadge>
  │     ├── <JobPriorityBadge>
  │     ├── Customer name, vendor, timestamp
  ├── <EmptyState>            # "No jobs match your filters"
  ├── <ErrorState>            # Route-level boundary with retry
  └── <Pagination>            # Page n of N, prev / next
```

### Job Detail Page (`/jobs/$jobId`)

```
<JobDetailPage>
  ├── <StaleBanner>           # "This job was updated" — non-blocking
  ├── <JobHeader>             # Title, badges, metadata grid
  ├── <JobTimeline>           # Append-only activity log, newest first
  └── <AssignmentPanel>       # Right sidebar — dispatchers/admins only
        ├── <AiRecommendationPanel>   # Own error boundary
        │     ├── [loading]   <AiPanelSkeleton> shimmer
        │     ├── [success]   Vendor + confidence bar + reasoning + Accept/Override
        │     ├── [error]     Graceful fallback, manual flow unblocked
        │     └── [overridden] Dimmed original + dispatcher choice
        └── <AssignmentWorkflow>
              ├── Vendor <select>
              ├── Override reason <textarea> (if overriding AI)
              └── Inline confirm step (two-step: select → confirm)
```

### Shared Primitives (`src/components/ui/`)

| Component | Purpose |
|---|---|
| `Badge` | Status / priority labels — 6 semantic variants |
| `Button` | primary / secondary / ghost / danger — built-in loading state |
| `Skeleton` | Layout-matched placeholders — card, detail, AI panel, timeline |

---

## 2. State Management Approach & Rationale

Three layers, never mixed:

### TanStack Query — Server State
All backend data lives here: job list, job detail, vendor list, AI recommendations. Handles caching, background refetch, deduplication, and stale-while-revalidate automatically.

The AI recommendation is a **separate query** (`['ai-recommendation', jobId]`) with its own error boundary — an AI failure never breaks the rest of the page, and retry logic is independent.

```ts
const { data: rec, isLoading, isError } = useQuery({
  queryKey: ['ai-recommendation', jobId],
  queryFn: () => getAiRecommendation({ data: { jobId } }),
  retry: 1,
  staleTime: 60_000,
})
```

### Zustand — UI State
Ephemeral client-only state: active filters, current page, modal open/closed, and the set of job IDs that received a real-time update (`staleJobIds`). Chosen over React Context because only subscribing components re-render on change — no full-tree re-renders on every filter keystroke.

### Optimistic Updates — TanStack Query Mutations
`assignJob` uses the full `onMutate / onError / onSettled` lifecycle:
- `onMutate` — cancel in-flight queries, snapshot previous state, apply update immediately
- `onError` — roll back to snapshot
- `onSettled` — always invalidate to reconcile with server truth

The UI reflects the assignment instantly. A failed mutation rolls back with a clear error message.

### Real-Time State — SSE → Query Invalidation
Incoming events call `queryClient.invalidateQueries` — never stored in Zustand. Single source of truth stays in the Query cache; no sync issues.

---

## 3. Real-Time Update Strategy

**Mechanism:** Server-Sent Events (SSE) via `EventSource`. Demo uses `setInterval` simulation; production uses a real SSE endpoint.

**Flow:**
```
SSE event → useRealtimeJobs hook → queryClient.invalidateQueries → background refetch → UI update
                                 → staleJobIds (Zustand) → non-blocking banner
```

**Non-destructive surfacing:**
1. Event arrives: `{ type: 'job.updated', jobId: 123 }`
2. Query is invalidated and refetches silently in the background
3. Job ID added to `staleJobIds` in Zustand
4. A dismissible banner appears: *"A job was updated. Your unsaved changes are preserved."*
5. The user's form state is **never reset** — the banner is informational only

**Unsaved form protection:** If the assignment workflow is open when an update arrives, the banner shows but the form is untouched. On submit, `onSettled` invalidation reconciles everything. If the server rejects due to a stale optimistic lock, the error message explains and offers retry.

**Reconnection:** On reconnect, `queryClient.invalidateQueries({ queryKey: ['jobs'] })` flushes any stale data accumulated during the disconnection window.

**Why SSE over WebSocket:** SSE is unidirectional (server → client), sufficient for this use case, works over standard HTTP/2 with no special proxy config, and has automatic reconnection built into the `EventSource` API. WebSocket adds bidirectional complexity that isn't needed here.

---

## 4. AI Feature Presentation Design

**Core principle:** AI assists, never blocks. The manual assignment workflow is always visible and functional regardless of AI state.

### Four States

| State | What the user sees |
|---|---|
| **Loading** | Shimmer skeleton matching the panel layout — no spinner, no layout shift |
| **Success** | Vendor name · animated confidence bar (green ≥85%, amber ≥65%, grey <65%) · reasoning text · "Accept" + "Override" buttons |
| **Error / Unavailable** | ⚠️ *"Recommendation service unavailable. Assign manually below."* — no buttons, manual flow unaffected |
| **Overridden** | Dimmed panel showing original AI suggestion alongside dispatcher's choice; logged to activity timeline |

### Trust Signals
- Confidence score is always visible — dispatchers calibrate weight accordingly
- Reasoning text explains *why* the vendor was chosen (past jobs, proximity, availability)
- The panel is visually subordinate to the manual workflow — nested, lighter background, smaller heading

### Override Logging
Every override writes a `vendor.overridden` event to `activity_log` with: AI suggestion, dispatcher's choice, confidence score, and optional free-text reason. Visible in the job timeline. Enables measurement of AI acceptance rate over time.

---

## 5. Role-Based UI Model

| Role | Dashboard | Assignment Panel | AI Panel | Activity Log |
|---|---|---|---|---|
| Dispatcher | Full | ✅ Assign / override | ✅ Visible + actionable | Read |
| Vendor Manager | Read-only | ❌ Hidden | ❌ Hidden | Read |
| Support Agent | Read-only | ❌ Hidden | ❌ Hidden | Full read |
| Admin | Full | ✅ Assign / override | ✅ Visible + actionable | Full read |

**Enforcement is two-layered:**

- **Server-side (authoritative):** Every loader and server function checks the session role before returning data or executing mutations. A vendor manager calling `assignJob` gets a 403 — the server never trusts client-supplied role claims.
- **Client-side (UX adaptation only):** `AssignmentWorkflow` and `AiRecommendationPanel` are conditionally rendered based on the role in the session. This is cosmetic — hiding a button does not protect the endpoint.

**Data scoping:** The server returns role-scoped responses. Support agents see internal notes; dispatchers do not. Vendor managers only receive jobs assigned to their vendors. No sensitive data is sent to clients who shouldn't have it.

---

## 6. Key UX Tradeoffs

### Optimistic vs. Confirmed Updates
**Chosen: optimistic.** Dispatchers assign dozens of jobs per hour — a 600ms wait before the UI updates feels sluggish at scale. The rollback path is straightforward (snapshot → restore on error). Tradeoff: a failed mutation briefly shows incorrect state, mitigated by immediate rollback and a clear error toast.

### Polling vs. WebSocket vs. SSE
**Chosen: SSE.** Polling wastes bandwidth and adds average 5s latency. WebSocket is bidirectional and powerful but requires sticky sessions and complex proxy config. SSE hits the sweet spot — persistent server-push, works over HTTP/2, automatic reconnection, no special infrastructure. Tradeoff: ~3% of browsers need a polling fallback; bidirectional communication is not possible (not needed here).

### Pagination vs. Infinite Scroll
**Chosen: pagination.** Dispatchers are power users who need to jump to a specific page, share URLs that land on the right page, and orient themselves ("page 3 of 12"). Infinite scroll loses positional context and complicates keyboard navigation. Tradeoff: one extra click per page turn — acceptable for this user profile.

### Skeleton Loading vs. Spinners
**Chosen: skeletons everywhere; spinners only inside buttons.** Skeletons match the layout of the content they replace, eliminating layout shift (CLS = 0) and giving spatial context before data arrives. Spinners provide no layout information and feel slower. Tradeoff: one skeleton component per layout variant — worth the maintenance cost for the perceived performance gain.

### Two-Step Assignment Confirmation
**Chosen: inline confirm step (select → confirm).** Assigning the wrong vendor to an urgent job is a high-cost mistake. The confirm step adds one click but prevents accidental assignments. Inline (not modal) so the user never loses context. Tradeoff: slight friction for experienced dispatchers, mitigated by Enter-to-confirm keyboard shortcut.

### AI Panel: Blocking vs. Non-Blocking
**Chosen: non-blocking.** AI service downtime must never prevent dispatchers from working. The manual workflow is always visible and functional. Tradeoff: dispatchers may ignore the AI suggestion — acceptable, and override rate is tracked to measure AI value over time.
