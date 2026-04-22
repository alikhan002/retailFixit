# RetailFixIt — UI Walkthrough & Design Decisions

---

## 1. UI Architecture Overview

RetailFixIt is built on TanStack Start (React 19 + SSR) with file-based routing via TanStack Router. The architecture separates concerns into three distinct layers that never bleed into each other:

**Component organization:**
```
src/
├── routes/          # Page-level components + loaders + error boundaries
├── components/
│   ├── ui/          # Primitives: Badge, Button, Skeleton
│   └── jobs/        # Feature components: JobCard, JobFilters, AiRecommendationPanel,
│                    #   AssignmentWorkflow, JobTimeline, JobStatusBadge
├── hooks/           # useJobsQuery, useRealtimeJobs
├── stores/          # Zustand: filters, pagination, staleJobIds
└── lib/             # server-fns, query-client, mock-data
```

**State layers:**

| Layer | Tool | What lives here |
|---|---|---|
| Server state | TanStack Query | Job list, job detail, vendors, AI recommendations |
| UI state | Zustand | Active filters, page number, modal open/closed, stale job IDs |
| Real-time state | SSE → Query invalidation | Job status changes, new job events |
| Optimistic state | Query `onMutate` | Assignment before server confirms |

The key architectural decision is that real-time events never write to Zustand — they call `queryClient.invalidateQueries`, keeping the Query cache as the single source of truth for all server data.

---

## 2. Dashboard to Job Detail Flow

### Step 1 — Dashboard loads (`/jobs`)

**What happens:**
1. TanStack Router fires the route `loader`, which calls `getJobs()` server function on the server
2. SSR renders the page with initial data — no client-side loading flash
3. TanStack Query hydrates the cache from the loader result
4. `useRealtimeJobs` hook starts the SSE connection in the background

**Loading behavior:**
- If the loader is slow (cold DB, network), the route suspense boundary shows 6 `<JobCardSkeleton>` components — layout-matched placeholders that match the exact dimensions of real job cards
- No spinners. The skeleton gives spatial context so the page doesn't feel empty

**State at this point:**
```
Query cache:  { ['jobs', {}]: [job1, job2, ...] }
Zustand:      { filters: {}, page: 1, staleJobIds: new Set() }
SSE:          connected, listening
```

### Step 2 — Filtering jobs

User selects "Status: Pending" from the filter dropdown.

1. `JobFilters` component calls `setFilters({ status: 'pending' })` on the Zustand store
2. Filter change updates URL search params: `/jobs?status=pending`
3. TanStack Router detects search param change, re-runs the loader
4. `useJobsQuery` refetches with new filter params
5. While refetching, previous results remain visible (no blank flash) — TanStack Query's `keepPreviousData` behavior
6. New filtered results replace the list

**State transition:**
```
Zustand: filters: {} → filters: { status: 'pending' }
URL:     /jobs → /jobs?status=pending
Query:   ['jobs', {}] → ['jobs', { status: 'pending' }] (new cache entry)
```

### Step 3 — Navigating to Job Detail (`/jobs/42`)

User clicks a job card.

1. TanStack Router navigates to `/jobs/42`
2. Route loader calls `getJobById({ jobId: 42 })` — SSR renders full job detail
3. Simultaneously, a **separate** `useQuery` fires for `['ai-recommendation', 42]`
4. Job detail renders immediately (from loader); AI panel shows shimmer skeleton while its own query loads

**Critical behavior:** Job detail and AI recommendation are decoupled. The page is fully usable before the AI panel resolves. If AI takes 3 seconds, the dispatcher can already be reading the job details and selecting a vendor manually.

**State at this point:**
```
Query cache:  { ['job', 42]: { ...jobData }, ['ai-recommendation', 42]: loading }
Zustand:      { staleJobIds: new Set() }
```

---

## 3. AI Feature — All Four States

### State 1: Loading

**Trigger:** `useQuery` for `['ai-recommendation', 42]` is in-flight.

**UI:** The `<AiRecommendationPanel>` renders `<AiPanelSkeleton>` — three shimmer bars matching the layout of vendor name, confidence bar, and reasoning text. No spinner. No layout shift when data arrives because the skeleton occupies the same space.

```
┌─────────────────────────────┐
│ AI Recommendation           │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░  │  ← vendor name skeleton
│ ░░░░░░░░░░░░░░░░░░          │  ← confidence bar skeleton
│ ░░░░░░░░░░░░░░░░░░░░░░░░░  │  ← reasoning text skeleton
│ ░░░░░░░░░░░░░░░░░░░░░░░░░  │
└─────────────────────────────┘
```

### State 2: Success

**Trigger:** Query resolves with `{ vendorId: 7, vendorName: "VendorCo", confidence: 87, reasoning: "..." }`.

**UI:**
```
┌─────────────────────────────┐
│ AI Recommendation           │
│ VendorCo                    │
│ [████████████░░░░] 87%      │  ← green bar (≥85%)
│ "VendorCo has completed 14  │
│  similar jobs in this area  │
│  with a 96% on-time rate."  │
│                             │
│ [Accept Suggestion] [Override] │
└─────────────────────────────┘
```

Confidence color coding: green ≥85%, amber ≥65%, grey <65%. Dispatchers can calibrate trust at a glance.

### State 3: Error / Fallback

**Trigger:** AI service returns 500, times out, or `isError` is true after 1 retry.

**UI:**
```
┌─────────────────────────────┐
│ ⚠️  AI Recommendation       │
│                             │
│ Recommendation service is   │
│ temporarily unavailable.    │
│ You can still assign a      │
│ vendor manually below.      │
└─────────────────────────────┘
```

The `<AssignmentWorkflow>` below is fully functional — the dispatcher is never blocked. The AI panel has its own error boundary so this failure is isolated; the rest of the page is unaffected.

### State 4: Overridden

**Trigger:** Dispatcher clicks "Override", selects a different vendor, and submits.

**What happens:**
1. Override form appears: vendor dropdown + optional reason text field
2. Dispatcher selects "OtherVendor", types "Customer requested this vendor"
3. `assignJob` mutation fires with `aiOverride: { suggestedVendorId: 7, reason: "..." }`
4. Server writes `vendor.overridden` event to `activity_log`
5. AI panel transitions to overridden state

**UI:**
```
┌─────────────────────────────┐
│ AI Recommendation (dimmed)  │
│ ~~VendorCo~~ [87%]          │  ← strikethrough, 60% opacity
│ Dispatcher chose: OtherVendor│
│ Reason: "Customer requested │
│  this vendor specifically"  │
└─────────────────────────────┘
```

Timeline appends:
```
🔄  Dispatcher overrode AI suggestion
    AI suggested VendorCo (87% confidence)
    Chose: OtherVendor
    "Customer requested this vendor specifically"
    2 minutes ago
```

---

## 4. Real-Time Update in Action

### Scenario: Another dispatcher assigns a job while you're viewing the dashboard

**Step 1 — SSE event arrives:**
```json
{ "type": "job.updated", "jobId": 42, "changes": { "status": "assigned", "assignedVendorId": 9 } }
```

**Step 2 — `useRealtimeJobs` handler fires:**
```ts
queryClient.invalidateQueries({ queryKey: ['job', 42] })
queryClient.invalidateQueries({ queryKey: ['jobs'] })
markJobStale(42) // Zustand
```

**Step 3 — UI response:**
- Query for `['jobs']` refetches in the background
- Job card for #42 updates its status badge from "Pending" → "Assigned" once refetch completes
- A non-blocking banner appears at the top: *"A job was updated in real-time."* with a dismiss button
- The user's scroll position, focus, and any open dropdowns are completely undisturbed

**Step 4 — User is on the detail page with the assignment form open:**

If the user has already selected a vendor in the `<AssignmentWorkflow>` form when the update arrives:
- The banner shows: *"This job was updated. Your unsaved changes are preserved."*
- The form is **not reset** — local component state holds the vendor selection
- User submits → `onSettled` invalidation reconciles with server truth
- If server rejects (optimistic lock conflict), error message explains and offers retry

**Reconnection scenario:**
- SSE disconnects (network blip)
- Connection status indicator appears in the header
- On reconnect, `queryClient.invalidateQueries({ queryKey: ['jobs'] })` flushes all stale data
- Any updates missed during the disconnection window are reconciled

---

## 5. Failure Scenario — API Timeout on Job Assignment

### Setup
Dispatcher selects a vendor and clicks "Confirm Assignment". The `POST /jobs/42/assign` request times out after 10 seconds.

### What the user sees

**T+0ms:** Dispatcher clicks "Confirm Assignment"
- Button enters loading state (spinner inside button, button disabled)
- Optimistic update fires immediately: job status badge changes to "Assigned", vendor name appears in header
- `onMutate` snapshots the previous state

**T+10,000ms:** Request times out
- `onError` fires: previous state is restored from snapshot
- Status badge reverts to "Pending", vendor name disappears
- Error toast appears: *"Assignment failed — request timed out. Please try again."*
- Button returns to normal state
- Form remains populated (vendor still selected) so dispatcher can retry without re-selecting

**T+10,100ms:** `onSettled` fires regardless
- `queryClient.invalidateQueries` runs to reconcile with server truth
- If the server actually processed the request before timing out, the refetch will show the correct assigned state

### AI Panel Timeout (separate scenario)

If the AI recommendation request exceeds 5 seconds:
- Panel transitions from skeleton → error state
- *"Recommendation service is taking longer than expected."*
- Manual assignment workflow remains fully functional
- AI panel shows a "Retry" button — clicking it re-fires the query

### Network Offline

If the user goes offline mid-session:
- TanStack Query's `networkMode: 'online'` pauses all in-flight queries
- Cached data remains visible (stale-while-revalidate)
- Mutations queue and retry on reconnect
- Connection indicator in header signals offline state

---

## 6. Design Decisions

### Decision 1: SSE over WebSocket — Would Defend

**Choice:** Server-Sent Events for real-time updates instead of WebSocket.

**Why I'd defend it:** The data flow is strictly unidirectional — the server pushes job updates to clients, clients never push real-time data back. SSE is purpose-built for this. It works over standard HTTP/2 with no special proxy configuration, has automatic reconnection built into the `EventSource` API, and is significantly simpler to implement and operate than WebSocket (no connection state management, no sticky session requirements). For a platform with ~1,000 vendors and dozens of concurrent dispatchers, SSE scales cleanly.

**The tradeoff I accepted:** ~3% of browsers (IE11, old Android WebView) need a polling fallback. That's a known, manageable cost.

---

### Decision 2: Optimistic Updates for Assignment — Would Defend

**Choice:** Apply the assignment to the UI immediately before the server confirms, with rollback on error.

**Why I'd defend it:** Dispatchers perform this action dozens of times per hour. A 600ms server round-trip before the UI responds creates a sluggish, unresponsive feel at scale. The optimistic pattern with TanStack Query's `onMutate / onError / onSettled` lifecycle gives instant feedback while guaranteeing eventual consistency — the `onSettled` invalidation always reconciles with server truth regardless of success or failure. The rollback path is clean and the error message is immediate and clear.

**The tradeoff I accepted:** A failed mutation briefly shows incorrect state. This is visible for ~200ms before rollback completes. For an assignment action, this is acceptable — the cost of a wrong optimistic state is low compared to the benefit of instant feedback on every successful action.

---

### Decision 3: Isolated AI Query with Its Own Error Boundary — Would Defend

**Choice:** The AI recommendation is a separate `useQuery` with its own React error boundary, not bundled with the job detail query.

**Why I'd defend it:** AI services have different reliability characteristics than core data APIs. Bundling them means an AI outage takes down the entire job detail page. Isolation means: the page renders fully from the job detail query, the AI panel loads independently, and an AI failure shows a graceful fallback without affecting anything else. This is the right default for any non-critical enrichment feature.

---

### Decision I'd Revisit: Pagination over Virtualized Infinite Scroll

**Choice:** Traditional page-based pagination for the job dashboard.

**Why I chose it:** Dispatchers are power users who need shareable URLs, predictable navigation ("page 3 of 12"), and keyboard-friendly page jumping. Infinite scroll loses positional context.

**Why I'd revisit it:** In practice, dispatchers often work through a queue of pending jobs sequentially — they don't jump to page 7. A virtualized list (using `@tanstack/virtual`) would give the best of both worlds: all jobs accessible without pagination friction, but only the visible rows rendered in the DOM (no performance cliff at 500+ jobs). The URL could encode a `jobId` anchor instead of a page number to preserve shareability. With more time, I'd prototype this and test it with actual dispatchers to see which mental model fits their workflow better.

---

## 7. What I'd Improve Next

**Virtualized job list** — Replace pagination with `@tanstack/virtual` for a seamless queue-style workflow. Benchmark at 500+ jobs to validate the performance case.

**Optimistic lock conflict UX** — Currently, a 409 conflict on assignment shows a generic error. A better experience would diff the server's current state against the user's intended action and present a clear "someone else assigned this job to X — do you want to reassign?" decision prompt.

**AI confidence calibration feedback** — Track whether high-confidence recommendations are accepted more often than low-confidence ones. If not, the confidence signal isn't calibrated correctly and needs retraining. Surface this in an admin analytics view.

**Offline-first mutations** — Currently, mutations fail if the user is offline. With TanStack Query's `networkMode: 'offlineFirst'` and a service worker, assignments could queue locally and sync on reconnect — valuable for dispatchers in areas with spotty connectivity.

**Accessibility audit** — The skeleton loading pattern, real-time banners, and optimistic state changes all need screen reader testing. Live regions (`aria-live`) for the real-time banner and focus management after the confirm step are the two areas most likely to need work.
