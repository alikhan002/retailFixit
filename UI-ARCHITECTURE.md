# RetailFixIt — UI Architecture Write-Up

---

## 1. Page & Component Breakdown

### Route Structure (TanStack Router file-based)

```
src/routes/
├── __root.tsx           → Root layout (Header, Footer, theme provider, global error boundary)
├── index.tsx            → Home (redirects to /jobs)
├── jobs/
│   ├── index.tsx        → Job Dashboard
│   └── $jobId/
│       └── index.tsx    → Job Detail Page
└── about.tsx            → About page
```

Each route defines:
- `loader` for SSR data fetching
- `errorComponent` for isolated error boundaries
- `component` for the main UI

### Job Dashboard (`/jobs/index.tsx`)

**Component hierarchy:**
```
<JobDashboard>
  ├── <RealtimeBanner>          # Non-blocking SSE update notification (Zustand state)
  ├── <JobFilters>              # Status / priority / vendor dropdowns (Zustand)
  │     ├── Status <select>     # pending / assigned / completed / cancelled
  │     ├── Priority <select>   # low / medium / high / urgent
  │     └── Vendor <select>     # All vendors + "Any"
  ├── <JobCardSkeleton × 6>     # Shown during initial load (no spinners)
  ├── <JobCard × n>             # Paginated list, links to /jobs/$jobId
  │     ├── <JobStatusBadge>    # Color-coded status pill
  │     ├── <JobPriorityBadge>  # Priority indicator
  │     ├── Job title + ID
  │     ├── Customer name
  │     ├── Assigned vendor (if any)
  │     └── Created timestamp
  ├── <EmptyState>              # Contextual — "No jobs match your filters"
  ├── <ErrorState + retry>      # Route-level error boundary with retry button
  └── <Pagination>              # Page n of N, prev/next controls
```

**Data flow:**
- Loader calls `getJobs()` server function with filter params from URL search params
- `useJobsQuery` hook wraps TanStack Query for client-side caching and background refetch
- `useRealtimeJobs` hook listens for SSE events and invalidates affected queries
- Filter changes update Zustand store → URL search params → triggers query refetch

### Job Detail Page (`/jobs/$jobId/index.tsx`)

**Component hierarchy:**
```
<JobDetailPage>
  ├── <StaleBanner>             # "This job was updated" — non-blocking, dismissible
  ├── <JobHeader>               # Two-column layout
  │     ├── Left: Title, description, customer info
  │     └── Right: Status/priority badges, metadata grid (created, updated, assigned)
  ├── <JobTimeline>             # Append-only activity log, newest first
  │     └── <TimelineEvent × n> # Icon + timestamp + actor + description
  └── <AssignmentPanel>         # Right sidebar (only for pending/assigned jobs)
        ├── <AiRecommendationPanel>   # Isolated — own error boundary
        │     ├── [loading]  <AiPanelSkeleton> (shimmer matching layout)
        │     ├── [success]  Vendor name + <ConfidenceBar> + reasoning + Accept/Override
        │     ├── [error]    Graceful fallback — "AI unavailable, assign manually"
        │     └── [overridden] Dimmed panel showing original vs chosen
        └── <AssignmentWorkflow>
              ├── Vendor <select> (all vendors, offline ones disabled)
              ├── Override reason <textarea> (if overriding AI)
              └── Confirm step (two-step: select → confirm dialog)
```

**Data flow:**
- Loader calls `getJobById({ jobId })` server function
- Separate `useQuery` for AI recommendation: `['ai-recommendation', jobId]`
- `assignJob` mutation uses optimistic updates (onMutate/onError/onSettled)
- Real-time updates invalidate job query and show stale banner if user has unsaved form

### Shared UI Primitives (`src/components/ui/`)

| Component | Purpose | Variants |
|---|---|---|
| `Badge` | Status and priority labels | `default`, `success`, `warning`, `danger`, `info`, `neutral` |
| `Button` | Interactive controls | `primary`, `secondary`, `ghost`, `danger` — loading state built-in |
| `Skeleton` | Layout-matched placeholders | Card, detail header, AI panel, timeline event |

---

## 2. State Management Approach & Rationale

**Core principle:** Separate concerns by state category. Server state, UI state, and real-time state are managed by different tools optimized for their specific use case.

### TanStack Query — Server State (authoritative data from backend)

**What lives here:**
- Job list (`['jobs', filters]`)
- Job detail (`['job', jobId]`)
- Vendor list (`['vendors']`)
- AI recommendations (`['ai-recommendation', jobId]`)

**Why TanStack Query:**
- Automatic caching with configurable `staleTime` and `cacheTime`
- Background refetch on window focus and network reconnect
- Request deduplication (multiple components requesting same data = single network call)
- Built-in loading/error states per query
- Optimistic updates via mutation lifecycle hooks

**Key pattern — isolated AI query:**
The AI recommendation is a **separate query** with its own loading/error state. This isolation means:
- AI service downtime never breaks the job detail page
- AI panel can show a skeleton while job data is already rendered
- Retry logic is independent (AI can retry without refetching the entire job)

```ts
// Job detail query
const { data: job } = useSuspenseQuery({
  queryKey: ['job', jobId],
  queryFn: () => getJobById({ data: { jobId } }),
})

// AI recommendation query (isolated)
const { data: rec, isLoading, isError } = useQuery({
  queryKey: ['ai-recommendation', jobId],
  queryFn: () => getAiRecommendation({ data: { jobId } }),
  retry: 1,
  staleTime: 60_000, // AI recs are expensive, cache for 1 min
})
```

### Zustand — UI State (ephemeral, client-only)

**What lives here:**
- Active filter selections (status, priority, vendor)
- Current pagination page
- Assignment modal open/closed state
- Set of job IDs that received real-time updates (`staleJobIds`)
- AI override state (whether user chose to override, before persisting)

**Why Zustand over React Context:**
- Avoids re-rendering the entire component tree on every state change
- Only components that subscribe to a specific slice re-render
- Simpler API than Redux for small UI state needs
- No provider nesting hell

**Example store slice:**
```ts
// src/stores/jobs-store.ts
interface JobsStore {
  filters: { status?: string; priority?: string; vendorId?: number }
  setFilters: (filters: Partial<JobsStore['filters']>) => void
  staleJobIds: Set<number>
  markJobStale: (jobId: number) => void
  clearStaleJobs: () => void
}
```

### Optimistic Updates — TanStack Query Mutations

The `assignJob` mutation uses the full `onMutate` / `onError` / `onSettled` lifecycle to provide instant feedback:

```ts
const assignMutation = useMutation({
  mutationFn: (vars) => assignJob({ data: vars }),
  
  // 1. Apply optimistic update immediately
  onMutate: async (vars) => {
    await queryClient.cancelQueries({ queryKey: ['job', vars.jobId] })
    const previous = queryClient.getQueryData(['job', vars.jobId])
    queryClient.setQueryData(['job', vars.jobId], (old) => ({
      ...old,
      assignedVendorId: vars.vendorId,
      status: 'assigned',
    }))
    return { previous } // Snapshot for rollback
  },
  
  // 2. Rollback on error
  onError: (_err, vars, ctx) => {
    queryClient.setQueryData(['job', vars.jobId], ctx?.previous)
  },
  
  // 3. Always reconcile with server truth
  onSettled: (_data, _err, vars) => {
    queryClient.invalidateQueries({ queryKey: ['job', vars.jobId] })
    queryClient.invalidateQueries({ queryKey: ['jobs'] }) // Refresh list
  },
})
```

**Why optimistic:**
- Assignment is the most frequent dispatcher action (dozens per hour)
- 600ms server round-trip feels sluggish at scale
- Rollback path is straightforward (snapshot → restore on error)
- Tradeoff: brief incorrect state on failure, but error message is immediate

### Real-Time State — SSE Events → Query Invalidation

**Pattern:** Real-time events are **never stored** in Zustand or component state. Instead:
1. SSE event arrives: `{ type: 'job.updated', jobId: 123 }`
2. Event handler calls `queryClient.invalidateQueries(['job', 123])`
3. Query refetches in background, UI updates automatically
4. Job ID is added to `staleJobIds` in Zustand to show banner

**Why this pattern:**
- Single source of truth (Query cache)
- No sync issues between real-time state and cached state
- Automatic deduplication (multiple invalidations = single refetch)

### AI State Machine (local component state)

The AI panel tracks four explicit states: `loading → success | error | overridden`

**Why local state (not Zustand or Query):**
- Purely presentational (which UI variant to show)
- Override decision is persisted via separate `logAiOverride` server function
- No need to share across components
- Simpler than lifting to global store

```ts
type AiPanelState = 
  | { status: 'loading' }
  | { status: 'success'; recommendation: AiRec }
  | { status: 'error'; message: string }
  | { status: 'overridden'; original: AiRec; chosen: Vendor }
```

---

## 3. Real-Time Update Strategy

**Mechanism:** Server-Sent Events (SSE) via `EventSource` API. In the demo, this is simulated with `setInterval` in `useRealtimeJobs` hook, but production would use a real SSE endpoint.

**Architecture:**
```
Server → SSE endpoint → EventSource → useRealtimeJobs hook → Query invalidation → UI update
```

### How updates surface without disrupting the user

**Core principle:** Real-time updates are **informational, never destructive**. The user's current context (form state, scroll position, focus) is preserved.

**Update flow:**

1. **Event arrives:** `{ type: 'job.updated', jobId: 123, changes: {...} }`

2. **Query invalidation:** 
   ```ts
   queryClient.invalidateQueries({ queryKey: ['job', jobId] })
   queryClient.invalidateQueries({ queryKey: ['jobs'] })
   ```

3. **Stale tracking:** Job ID added to `staleJobIds` in Zustand

4. **Non-blocking banner appears:**
   - Dashboard: *"A job was updated in real-time. Refresh to see changes."* (dismissible)
   - Detail page: *"This job was updated. Your unsaved changes are preserved."* (dismissible)

5. **Background refetch:** Query refetches in background, new data populates cache

6. **UI updates automatically** when:
   - User dismisses banner and navigates away
   - User explicitly clicks "Refresh"
   - User submits their current form (onSettled invalidation reconciles)

### Unsaved Form Protection

**Problem:** User is filling out assignment workflow, real-time update arrives for that job. Naive implementation would clobber the form.

**Solution:**
```ts
// In AssignmentWorkflow component
const [localVendorId, setLocalVendorId] = useState(null)
const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

// Real-time update arrives
useEffect(() => {
  if (staleJobIds.has(jobId) && hasUnsavedChanges) {
    // Show banner, but DON'T reset form
    showStaleBanner()
  }
}, [staleJobIds, jobId, hasUnsavedChanges])
```

**User experience:**
- Form state is preserved in local component state
- Banner informs user that data changed, but doesn't force action
- On submit, `onSettled` invalidation reconciles everything
- If server rejects due to stale data (optimistic lock), error message explains and offers retry

### Reconnection Handling

**On disconnect:**
- `EventSource` fires `onerror` event
- Connection status indicator appears in header
- Queries continue to work from cache (stale-while-revalidate)

**On reconnect:**
- `EventSource` automatically reconnects
- `useRealtimeJobs` hook calls `queryClient.invalidateQueries({ queryKey: ['jobs'] })`
- All active queries refetch to reconcile any missed updates
- Connection status indicator disappears

### Event Types

| Event Type | Invalidates | UI Impact |
|---|---|---|
| `job.created` | `['jobs']` | New card appears on dashboard (if matches filters) |
| `job.updated` | `['job', jobId]`, `['jobs']` | Card updates, detail page shows stale banner |
| `job.assigned` | `['job', jobId]`, `['jobs']` | Status badge changes, timeline appends event |
| `job.completed` | `['job', jobId]`, `['jobs']` | Status badge changes, assignment panel hides |

### Why SSE over WebSocket

**SSE advantages:**
- Unidirectional (server → client) — sufficient for this use case
- Works over standard HTTP/2 — no special proxy config
- Automatic reconnection built into `EventSource` API
- Simpler server implementation (no connection state management)

**WebSocket advantages (not needed here):**
- Bidirectional (client can push to server)
- Lower latency for high-frequency updates
- Binary data support

**Polling (fallback only):**
- Used in demo for simplicity
- Production would use SSE with polling fallback for old browsers
- Polling interval: 10s (balance between freshness and server load)

---

## 4. AI Feature Presentation Design

**Design principle:** AI assists, never blocks. The dispatcher workflow must remain fully functional even when AI is unavailable.

### Four States, Intentionally Rendered

| State | Visual Design | User Actions | Technical Implementation |
|---|---|---|---|
| **Loading** | Shimmer skeleton matching panel layout (vendor name bar, confidence bar, reasoning text block) — no spinner, no layout shift | None — wait | `isLoading` from `useQuery` |
| **Success** | • Vendor name (bold, 18px)<br>• Animated confidence bar (0–100%)<br>• Color-coded: green ≥85%, amber ≥65%, grey <65%<br>• Reasoning text (2–3 sentences)<br>• "Accept suggestion" (primary button)<br>• "Override" (secondary button) | Accept → assigns immediately<br>Override → shows vendor selector + reason field | `data` from `useQuery` |
| **Error / Unavailable** | • Icon: ⚠️ (amber)<br>• Message: *"The recommendation service is temporarily unavailable. You can still assign a vendor manually."*<br>• No buttons (panel is informational only) | Proceed with manual assignment below | `isError` from `useQuery` |
| **Overridden** | • Dimmed panel (60% opacity)<br>• Strikethrough on AI suggestion<br>• "Dispatcher chose: [Vendor Name]"<br>• Override reason (if provided)<br>• Logged to timeline | None — read-only | Local state after override mutation completes |

### Trust Signals

**Confidence score visualization:**
```
[████████████░░░░░░░░] 85%  ← Green bar, high confidence
[████████░░░░░░░░░░░░] 68%  ← Amber bar, medium confidence  
[████░░░░░░░░░░░░░░░░] 42%  ← Grey bar, low confidence
```

**Reasoning text examples:**
- *"VendorCo has completed 12 similar jobs in this region with a 95% on-time rate."*
- *"This vendor is available now and located 8 miles from the job site."*
- *"Based on past performance and current workload, this is the optimal match."*

**Why these signals matter:**
- Dispatchers can calibrate how much weight to give the suggestion
- Low confidence + weak reasoning → dispatcher knows to scrutinize
- High confidence + strong reasoning → dispatcher can accept quickly

### Visual Hierarchy

The AI panel is **visually subordinate** to the manual assignment workflow:

```
┌─────────────────────────────────┐
│  Assignment Panel               │
│                                 │
│  ┌───────────────────────────┐ │
│  │ AI Recommendation         │ │  ← Nested, lighter background
│  │ (suggestion, not a gate)  │ │
│  └───────────────────────────┘ │
│                                 │
│  Manual Assignment              │  ← Always visible, always functional
│  ┌─────────────────────────┐   │
│  │ Select vendor: [____▼]  │   │
│  │ [Assign Job]            │   │
│  └─────────────────────────┘   │
└─────────────────────────────────┘
```

**Why this hierarchy:**
- AI is a tool, not a gatekeeper
- Manual workflow is never hidden or disabled
- Dispatcher can ignore AI and proceed immediately

### Override Tracking & Logging

**When dispatcher clicks "Override":**

1. **UI shows override form:**
   ```
   Why are you overriding this suggestion? (optional)
   ┌─────────────────────────────────────┐
   │ [Free text field]                   │
   └─────────────────────────────────────┘
   
   Select vendor: [Dropdown ▼]
   [Confirm Override]
   ```

2. **On submit, mutation calls:**
   ```ts
   assignJob({ 
     jobId, 
     vendorId: chosenVendorId,
     aiOverride: {
       suggestedVendorId: rec.vendorId,
       reason: overrideReason,
     }
   })
   ```

3. **Server writes to `activity_log`:**
   ```ts
   {
     jobId,
     eventType: 'vendor.overridden',
     actorId: currentUser.id,
     metadata: {
       aiSuggestion: rec.vendorId,
       dispatcherChoice: chosenVendorId,
       reason: overrideReason,
       confidence: rec.confidence,
     }
   }
   ```

4. **Timeline shows event:**
   ```
   🔄 Dispatcher overrode AI suggestion
      AI suggested: VendorCo (85% confidence)
      Dispatcher chose: OtherVendor
      Reason: "Customer requested this vendor specifically"
      2 minutes ago
   ```

### Metrics Enabled by This Design

- **AI acceptance rate:** `COUNT(assigned without override) / COUNT(recommendations shown)`
- **Override reasons:** Text analysis of free-form reasons
- **Confidence calibration:** Does high confidence correlate with acceptance?
- **Latency impact:** Does AI panel loading time affect acceptance rate?

### Error Handling Edge Cases

| Scenario | UI Behavior |
|---|---|
| AI service timeout (>5s) | Show error state, log timeout, allow manual assignment |
| AI returns 0% confidence | Show success state but with warning: *"Low confidence — review carefully"* |
| AI suggests offline vendor | Show error: *"Suggested vendor is currently offline"* + manual flow |
| Network error mid-load | Show error state with retry button |
| User navigates away before AI loads | Cancel in-flight request (React Query automatic) |

---

## 5. Role-Based UI Model

**Enforcement strategy:** Server-side authorization (authoritative) + client-side UI adaptation (UX optimization).

### Role Definitions & Permissions

| Role | Dashboard Access | Job Detail | Assignment | AI Panel | Activity Log | Vendor Management |
|---|---|---|---|---|---|---|
| **Dispatcher** | Full (read/write) | Full | ✅ Can assign/override | ✅ Visible + actionable | Read-only | Read-only |
| **Vendor Manager** | Read-only | Read-only | ❌ Hidden | ❌ Hidden | Read-only | Full (CRUD vendors) |
| **Support Agent** | Read-only | Full (including internal notes) | ❌ Hidden | ❌ Hidden | Full (read + export) | Read-only |
| **Admin** | Full | Full | ✅ Can assign/override | ✅ Visible + actionable | Full (read + export) | Full |

### Server-Side Enforcement (Authoritative)

**Every server function checks role before executing:**

```ts
// src/lib/server-fns.ts
export const assignJob = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ jobId: z.number(), vendorId: z.number() }))
  .handler(async ({ data }) => {
    const session = await getSession()
    
    // RBAC check — never trust client
    if (!['dispatcher', 'admin'].includes(session.user.role)) {
      throw new Error('Forbidden', { cause: { status: 403 } })
    }
    
    // Proceed with mutation
    const [job] = await db
      .update(jobs)
      .set({ assignedVendorId: data.vendorId, status: 'assigned' })
      .where(eq(jobs.id, data.jobId))
      .returning()
    
    return job
  })
```

**Loader-level filtering:**

```ts
// src/routes/jobs/index.tsx
export const Route = createFileRoute('/jobs/')({
  loader: async ({ request }) => {
    const session = await getSession()
    const url = new URL(request.url)
    const filters = parseFilters(url.searchParams)
    
    // Vendor managers only see jobs assigned to their vendors
    if (session.user.role === 'vendor_manager') {
      filters.vendorId = session.user.managedVendorIds
    }
    
    return getJobs({ data: filters })
  },
})
```

### Client-Side UI Adaptation (UX Optimization)

**Conditional rendering based on role:**

```tsx
// src/components/jobs/AssignmentWorkflow.tsx
export function AssignmentWorkflow({ job }: Props) {
  const { user } = useSession()
  
  // Hide entire panel for non-dispatchers
  if (!['dispatcher', 'admin'].includes(user.role)) {
    return null
  }
  
  return (
    <div className="assignment-panel">
      <AiRecommendationPanel jobId={job.id} />
      <VendorSelector jobId={job.id} />
    </div>
  )
}
```

**Disabled states for read-only roles:**

```tsx
// src/components/jobs/JobCard.tsx
export function JobCard({ job }: Props) {
  const { user } = useSession()
  const canAssign = ['dispatcher', 'admin'].includes(user.role)
  
  return (
    <div className="job-card">
      {/* ... job details ... */}
      <Button 
        disabled={!canAssign}
        onClick={() => navigate(`/jobs/${job.id}`)}
      >
        {canAssign ? 'Assign' : 'View Details'}
      </Button>
    </div>
  )
}
```

### Data Scoping by Role

**Server returns role-scoped responses:**

```ts
// Dispatcher sees:
{
  id: 123,
  title: "Fix HVAC unit",
  customer: { name: "RetailCo", contact: "555-1234" },
  assignedVendor: { id: 5, name: "VendorCo" },
  internalNotes: null, // Hidden from dispatchers
}

// Support agent sees:
{
  id: 123,
  title: "Fix HVAC unit",
  customer: { name: "RetailCo", contact: "555-1234" },
  assignedVendor: { id: 5, name: "VendorCo", contact: "555-5678" },
  internalNotes: "Customer has payment dispute — escalate if issues arise",
}
```

**Why scope at server:**
- Prevents data leakage (client never receives sensitive data)
- Single source of truth for permissions
- Easier to audit (all access decisions logged server-side)

### Role-Based Navigation

**Header navigation adapts to role:**

```tsx
// src/components/Header.tsx
export function Header() {
  const { user } = useSession()
  
  return (
    <nav>
      <Link to="/jobs">Jobs</Link>
      
      {['vendor_manager', 'admin'].includes(user.role) && (
        <Link to="/vendors">Vendors</Link>
      )}
      
      {['support', 'admin'].includes(user.role) && (
        <Link to="/activity">Activity Log</Link>
      )}
      
      {user.role === 'admin' && (
        <Link to="/admin">Admin</Link>
      )}
    </nav>
  )
}
```

### Error Messages by Role

**Forbidden errors are user-friendly:**

```tsx
// src/components/ErrorBoundary.tsx
function ErrorDisplay({ error }: Props) {
  if (error.cause?.status === 403) {
    return (
      <div className="error-state">
        <h2>Access Denied</h2>
        <p>You don't have permission to perform this action.</p>
        <p>Contact your administrator if you believe this is an error.</p>
      </div>
    )
  }
  
  // ... other error types
}
```

### Session Management

**Session stored in HTTP-only cookie:**
- Never accessible via JavaScript (XSS protection)
- Includes: `userId`, `role`, `managedVendorIds` (for vendor managers)
- Validated on every server function call
- Expires after 24 hours of inactivity

**Session refresh:**
- Background refresh every 15 minutes (silent)
- On expiry, redirect to login with return URL preserved

---

## 6. Key UX Tradeoffs

### Optimistic vs. Confirmed Updates

**Decision: Optimistic updates for all mutations**

**Rationale:**
- Dispatchers perform dozens of assignments per hour — 600ms server latency feels sluggish at scale
- Instant feedback creates perception of speed and responsiveness
- Rollback path is straightforward (snapshot previous state, restore on error)

**Tradeoff:**
- ✅ **Pro:** Immediate UI feedback, feels fast
- ✅ **Pro:** User can continue to next task without waiting
- ❌ **Con:** Brief incorrect state if mutation fails (mitigated by clear error message + automatic rollback)
- ❌ **Con:** Potential confusion if user navigates away before server confirms (mitigated by loading indicator on navigation)

**Implementation:**
```ts
// Optimistic update lifecycle
onMutate: async (vars) => {
  await queryClient.cancelQueries(['job', vars.jobId])
  const previous = queryClient.getQueryData(['job', vars.jobId])
  queryClient.setQueryData(['job', vars.jobId], optimisticData)
  return { previous }
},
onError: (err, vars, ctx) => {
  queryClient.setQueryData(['job', vars.jobId], ctx.previous) // Rollback
  toast.error('Assignment failed. Please try again.')
},
onSettled: () => {
  queryClient.invalidateQueries(['job', vars.jobId]) // Reconcile
}
```

---

### Polling vs. WebSocket vs. SSE

**Decision: Server-Sent Events (SSE) with polling fallback**

**Rationale:**
- SSE provides persistent connection with automatic reconnection
- Works over standard HTTP/2 — no special proxy configuration
- Unidirectional (server → client) is sufficient for this use case
- Simpler server implementation than WebSocket (no connection state management)

**Comparison:**

| Approach | Latency | Server Load | Browser Support | Complexity |
|---|---|---|---|---|
| **Polling (10s)** | High (avg 5s) | High (constant requests) | 100% | Low |
| **WebSocket** | Very low (<100ms) | Medium (persistent connections) | 98% | High |
| **SSE** | Low (<500ms) | Low (persistent, one-way) | 97% | Medium |

**Tradeoff:**
- ✅ **Pro:** Low latency without WebSocket complexity
- ✅ **Pro:** Automatic reconnection built into `EventSource` API
- ✅ **Pro:** Works with standard HTTP load balancers
- ❌ **Con:** 3% of browsers need polling fallback (IE11, old Android)
- ❌ **Con:** Not suitable for bidirectional communication (not needed here)

**Fallback strategy:**
```ts
// Feature detection
const supportsSSE = typeof EventSource !== 'undefined'
const updateStrategy = supportsSSE ? useSSE() : usePolling(10_000)
```

---

### Pagination vs. Infinite Scroll

**Decision: Traditional pagination with page numbers**

**Rationale:**
- Dispatchers are power users who need to jump to specific pages
- Shareable URLs that land on the correct page (e.g., `/jobs?page=3`)
- Easier keyboard navigation (arrow keys, page up/down)
- Clear orientation ("page 3 of 12" vs. "scroll position unknown")

**Tradeoff:**
- ✅ **Pro:** Predictable navigation, shareable URLs
- ✅ **Pro:** Easier to implement "jump to page" feature
- ✅ **Pro:** Better for accessibility (screen readers announce page context)
- ❌ **Con:** Slightly more friction per page turn (click vs. scroll)
- ❌ **Con:** Doesn't work well on mobile (mitigated by responsive design with larger touch targets)

**Implementation:**
```tsx
<Pagination 
  currentPage={3} 
  totalPages={12} 
  onPageChange={(page) => navigate({ search: { page } })}
/>
```

**Why not infinite scroll:**
- Loses context (user can't tell how much content remains)
- Harder to return to specific position after navigation
- Accessibility challenges (focus management, screen reader announcements)
- Not suitable for power users who need precise navigation

---

### Skeleton Loading vs. Spinners

**Decision: Skeleton components everywhere, spinners only for inline actions**

**Rationale:**
- Skeletons match the layout of loaded content — eliminates layout shift (CLS = 0)
- Provides spatial information (user knows what's coming)
- Feels faster even when it isn't (perceived performance)

**Tradeoff:**
- ✅ **Pro:** No layout shift (better Core Web Vitals)
- ✅ **Pro:** Perceived performance improvement (~20% faster feeling)
- ✅ **Pro:** User can orient themselves before data arrives
- ❌ **Con:** More component code (one skeleton per layout variant)
- ❌ **Con:** Maintenance burden (skeleton must match real layout)

**Usage guidelines:**

| Context | Loading UI | Rationale |
|---|---|---|
| Initial page load | Skeleton matching layout | Eliminates layout shift |
| Background refetch | No indicator (silent) | Data already visible, refetch is transparent |
| Inline action (button click) | Spinner inside button | Clear feedback for user-initiated action |
| Modal/dialog load | Spinner centered | Modal is overlay, no layout shift concern |

**Example:**
```tsx
// Job card skeleton
<div className="job-card-skeleton">
  <div className="skeleton-line w-3/4 h-6" />  {/* Title */}
  <div className="skeleton-line w-1/2 h-4" />  {/* Customer */}
  <div className="skeleton-badge" />           {/* Status */}
</div>
```

---

### Two-Step Confirmation vs. Single-Click Assignment

**Decision: Two-step confirmation (select vendor → confirm dialog)**

**Rationale:**
- Assigning the wrong vendor to an urgent job is a high-cost mistake
- Confirmation step prevents accidental clicks (especially on mobile)
- Provides moment for dispatcher to review choice

**Tradeoff:**
- ✅ **Pro:** Prevents costly mistakes (wrong vendor assignment)
- ✅ **Pro:** Gives dispatcher moment to review AI suggestion vs. their choice
- ✅ **Pro:** Opportunity to add assignment notes
- ❌ **Con:** One extra click per assignment (mitigated by keyboard shortcut: Enter to confirm)
- ❌ **Con:** Slightly slower workflow for experienced dispatchers

**Implementation:**
```tsx
// Step 1: Select vendor
<select value={vendorId} onChange={setVendorId}>
  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
</select>

// Step 2: Confirm (inline, not modal)
{vendorId && (
  <div className="confirm-panel">
    <p>Assign to <strong>{selectedVendor.name}</strong>?</p>
    <Button onClick={handleAssign}>Confirm Assignment</Button>
    <Button variant="ghost" onClick={handleCancel}>Cancel</Button>
  </div>
)}
```

**Why inline confirmation (not modal):**
- User never loses context (job details remain visible)
- Faster to dismiss (click cancel or press Escape)
- Less disruptive than modal overlay

---

### Real-Time Updates: Immediate vs. Queued

**Decision: Queued updates with non-blocking banner**

**Rationale:**
- Immediate updates can clobber user's unsaved form state
- Non-blocking banner preserves user's current context
- User controls when to reconcile (dismiss banner, submit form, or refresh)

**Tradeoff:**
- ✅ **Pro:** Never disrupts user's current task
- ✅ **Pro:** User controls when to see updates
- ✅ **Pro:** Prevents form state loss
- ❌ **Con:** User might work with stale data (mitigated by banner + server-side optimistic locking)
- ❌ **Con:** Slightly more complex state management (track stale job IDs)

**Alternative considered: Immediate updates**
- ❌ Would clobber form state
- ❌ Would cause unexpected UI changes mid-task
- ❌ Would frustrate users ("I was just about to click that!")

**Implementation:**
```tsx
// Real-time event arrives
useEffect(() => {
  if (staleJobIds.has(jobId)) {
    showBanner('This job was updated. Your changes are preserved.')
  }
}, [staleJobIds, jobId])

// User submits form
onSubmit: async () => {
  try {
    await assignJob({ jobId, vendorId })
    clearStaleJobs() // Reconcile on success
  } catch (err) {
    if (err.cause?.status === 409) {
      // Optimistic lock failure
      showError('This job was updated by another user. Please review and try again.')
      invalidateQueries(['job', jobId]) // Force refresh
    }
  }
}
```

---

### AI Panel: Blocking vs. Non-Blocking

**Decision: Non-blocking — manual workflow always available**

**Rationale:**
- AI service downtime should never prevent dispatchers from working
- AI is an assistant, not a gatekeeper
- Dispatcher expertise is more valuable than AI suggestion

**Tradeoff:**
- ✅ **Pro:** System remains functional during AI outages
- ✅ **Pro:** Dispatcher can proceed immediately without waiting for AI
- ✅ **Pro:** Builds trust (AI is helpful, not mandatory)
- ❌ **Con:** Dispatcher might ignore AI suggestion (mitigated by tracking override rate)
- ❌ **Con:** Slightly more complex UI (handle loading/error/success states)

**Alternative considered: Blocking AI panel**
- ❌ Would prevent work during AI downtime
- ❌ Would frustrate experienced dispatchers who don't need AI
- ❌ Would create single point of failure

**Implementation:**
```tsx
<AssignmentPanel>
  {/* AI panel is optional — shown but not required */}
  <AiRecommendationPanel jobId={jobId} />
  
  {/* Manual workflow is always visible and functional */}
  <ManualAssignment jobId={jobId} />
</AssignmentPanel>
```
