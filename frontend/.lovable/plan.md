

## Plan: Job Detail View + Universal Drill-Down Links

This plan adds a dedicated job detail page and converts static metrics/summaries across all dashboards into clickable drill-down links that navigate to the relevant page with appropriate filters.

### 1. Job Detail Page (`/jobs/:jobId`)

Create `src/pages/JobDetail.tsx` — a full-page view accessed when clicking any job reference anywhere in the app.

Contents:
- **Header**: Job ID, status badge, priority, customer name (linked to `/customers?id=CUST-XXX`), site address
- **Customer & Site Panel**: Contact info, equipment list for that site, service agreement status
- **Call/Visit Timeline**: Vertical timeline showing all calls chronologically with type icon (tech/sales), assignee, date, duration, status, discovery notes. Each call is an expandable card.
- **Equipment History**: List of equipment at the job's site with install date and service records
- **Job Summary Sidebar**: Estimated days, actual time, cost estimates, related estimate/invoice links

### 2. Route & Navigation Updates

- Add route `/jobs/:jobId` in `App.tsx` pointing to `JobDetail`
- Extract the shared `Job` and `Call` types into `src/types/jobs.ts`, and the `allJobs` data into `src/data/jobs.ts` so both `Jobs.tsx` and `JobDetail.tsx` can reference them

### 3. MetricCard Drill-Down Support

Update `MetricCard` component to accept an optional `href` prop (string). When provided, the card wraps in a `<Link>` and shows a subtle arrow indicator on hover.

### 4. Dashboard Drill-Down Links

| Element | Links To |
|---|---|
| "Active Jobs" card | `/jobs?status=active` |
| "Revenue (MTD)" card | `/analytics` |
| "Technicians Active" card | `/technicians` |
| "Avg Completion" card | `/analytics` |
| Recent Jobs table rows | `/jobs/:jobId` |
| Technician Activity rows | `/technicians` |

### 5. Dispatch Drill-Down Links

- Each dispatch card's job ID (`JOB-XXXX`) becomes a link to `/jobs/:jobId`
- Tech name links to `/technicians`
- Customer name links to `/customers?id=XXX`

### 6. Sales Dashboard Drill-Down Links

- "Pipeline Value" card → `/sales` (scrolls to pipeline)
- "Deals This Month" card → `/estimates`
- Active Deals table rows → `/jobs/:jobId` or `/estimates` as appropriate
- Sales rep rows → filtered view

### 7. Other Pages Drill-Down Links

- **Customers**: "Total Jobs" count per customer links to `/jobs?customer=CUST-XXX`; site active job badges link to filtered jobs
- **Analytics**: Technician Performance table rows link to `/technicians`; KPI cards link to relevant pages
- **Maintenance**: Customer names link to `/customers`; schedule rows link to associated job if exists
- **Leads**: Lead rows with PCBs link to PCB section; converted leads link to `/jobs`

### 8. Jobs Page Filter Support

Update `Jobs.tsx` to read URL search params (`?status=active`, `?customer=CUST-XXX`) and pre-apply filters on mount. This enables drill-down from any dashboard to land on a filtered jobs view.

### Technical Details

- Shared data/types extracted to `src/data/jobs.ts` and `src/types/jobs.ts`
- `MetricCard` gets optional `href?: string` prop, renders as `<Link>` when present
- `JobDetail.tsx` uses `useParams()` to get `jobId`, looks up from shared data
- Navigation uses `react-router-dom`'s `Link` component and `useSearchParams` for filter state
- All links use the app's existing styling — hover states with subtle arrow/underline indicators

