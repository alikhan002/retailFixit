# RetailFixIt – Full Stack Engineer Assessment

## 📌 Overview

RetailFixIt is a web-based operations platform designed to coordinate service jobs between customers and vendors.

This project focuses on building a **production-grade frontend application** with strong emphasis on:

- UI architecture and component design
- Real-time data handling
- AI-assisted user workflows
- Performance and UX quality
- Resilience (loading, error, fallback states)

---

## 👥 User Roles

The platform supports multiple roles with different capabilities:

### Dispatchers
- Assign jobs to vendors
- View AI recommendations
- Override AI decisions

### Vendor Managers
- Monitor vendor performance and availability

### Admins
- Manage users, roles, and platform configurations

### Support Agents
- Investigate job issues and view activity logs

---

## 🧱 Core Features

### 1. Job Dashboard
- Paginated or virtualized job list
- Filtering (status, vendor, date range)
- Real-time updates (job status changes)
- Status badges and priority indicators
- Skeleton loading states (no spinners)
- Meaningful empty states
- Error states with retry actions

---

### 2. Job Detail Page
- Job metadata and structured timeline
- Activity log / audit trail
- Vendor assignment workflow
- Confirmation flows
- Optimistic UI updates

---

### 3. AI Recommendation Panel
AI assists dispatchers but does NOT replace decision-making.

#### States:
- **Loading** → skeleton shimmer
- **Success** → recommended vendor + confidence score + reasoning
- **Low Confidence** → warning indicator
- **Failure** → graceful fallback (manual flow enabled)

#### Features:
- User can override AI recommendation
- Override is logged in activity timeline
- AI never blocks user workflow

---

### 4. Real-Time Updates
- Job updates reflected without page reload
- Works across dashboard and detail views
- Handles:
  - stale data reconciliation
  - reconnect logic
  - user mid-action protection

---

## ⚙️ Tech Stack

### Frontend
- React (Vite + TypeScript)
- TanStack Query (server state)
- Zustand (UI state)
- Tailwind CSS (styling)

### Data & APIs
- REST APIs (mock or lightweight backend)
- WebSocket / SSE (real-time updates)

---

## 🧠 Architecture Principles

### 1. State Separation
- **Server State** → handled via TanStack Query
- **UI State** → handled via Zustand
- **Real-Time State** → WebSocket event layer
- **AI State** → explicit states (loading, success, failure, overridden)

---

### 2. UX First
- No blocking UI due to AI or network delays
- Skeletons instead of spinners
- Stable layout (no layout shift)
- Clear feedback for every action

---

### 3. AI Trust Design
- Confidence scores always visible
- Explainability (reasoning shown)
- Easy override controls
- Graceful degradation on failure

---

### 4. Performance Strategy
- Virtualized lists for large datasets
- Cached queries and background refetching
- Optimistic updates for fast UX
- Minimized re-renders via proper state boundaries

---

### 5. Role-Based Access Control (RBAC)
- UI adapts based on user role
- Sensitive actions hidden or disabled
- Backend enforces access (no trust on frontend)

---

## 🔄 API Contract (Mocked or Real)

### Endpoints:

- `GET /jobs`
  - Supports pagination and filters

- `GET /jobs/:id`
  - Returns full job detail

- `POST /jobs/:id/assign`
  - Assign vendor to job

- `GET /jobs/:id/ai-recommendation`
  - Returns:
    - recommended vendor
    - confidence score
    - reasoning

---

## ⚠️ Error Handling Strategy

The UI must handle:

- API failures → show retry option
- AI failures → fallback to manual workflow
- Network issues → reconnect + stale state reconciliation
- Partial data → render safely without crashing

---

## 📡 Observability (Frontend)

- Error boundaries for UI crash isolation
- AI latency indicators (e.g., “Fetching recommendation…”)
- User interaction tracking:
  - job assignment funnel
  - AI override rate

---

## 🎯 Key UX Decisions

| Problem | Decision |
|--------|--------|
| Large job list | Virtualization |
| Real-time updates | WebSocket over polling |
| Slow APIs | Skeleton loading |
| AI uncertainty | Confidence + override |
| Fast UX | Optimistic updates |

---

## 🚀 Goals of This Project

This project aims to demonstrate:

- Strong frontend architecture thinking
- Clean and scalable component design
- Thoughtful handling of async and real-time data
- High-quality UI/UX under real-world constraints
- Responsible AI integration in user workflows

---

## 📦 Future Improvements (Optional)

- Storybook for component isolation
- Dark mode support
- Feature flags for AI rollout
- A/B testing for AI recommendations
- Mobile responsiveness (beyond tablet)
- Keyboard shortcuts for power users

---

## 🧪 Development Notes for Kiro

When generating code:

- Prefer modular, reusable components
- Avoid tightly coupled state
- Always include loading, error, and empty states
- Do not block UI on AI responses
- Ensure accessibility (ARIA, keyboard navigation)
- Avoid layout shifts during loading transitions

---

## 🧭 Summary

RetailFixIt is not just a CRUD app.

It is a **real-time, AI-assisted operational platform** where:
- speed matters
- clarity matters
- trust matters

Every UI decision should prioritize:
👉 user control  
👉 system transparency  
👉 performance  
