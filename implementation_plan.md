# SAMBHAV Portal — Project Reference

Internal team portal for the SAMBHAV organisation: attendance, projects, tasks,
announcements and leave, behind role-based access control.

**Motto:** INITIATE • CONNECT • EVOLVE

> Deployment steps live in [DEPLOYMENT.md](DEPLOYMENT.md).
> Credentials belong in environment variables only — never in this file.

---

## Stack

| Layer | Technology |
|:--|:--|
| Frontend | React 18, Vite, Lucide icons |
| Backend | Node.js, Express |
| Database | MongoDB Atlas |
| Auth | JWT (8h sessions) |
| Email | SendGrid |
| Hosting | Render (Static Site + Web Service) |

---

## Teams

Core Team · PR Team · Technical Team · Event Team · Graphics Team · Media Team ·
Documentation Team · CSD · SRD · Membership Director

Taken from the team spreadsheet. Defined in `client/src/constants.js` and
`server/src/constants.js` — change both together.

## Academic departments

Computer Science · Information Technology · Mechanical · Polytechnic

**A separate axis from club teams.** Someone can be in PR Team *and* head the IT
department — in the spreadsheet, Eshika is "PR Team" with position "IT
department Head", and Aaditi is "PR Team" with "Mechanical department Head".
A single `department` field could not express both, so users have:

| Field | Meaning |
|:--|:--|
| `department` | Club team (PR Team, Event Team, …) |
| `academicDepartment` | Academic department this person heads, if any |

The **Department Heads** page lists every department with its head, and shows
`Vacant` where none is appointed. Only the four departments evidenced in the
spreadsheet are listed; add more in both `constants.js` files.

## Roles

| Role | Can do |
|:--|:--|
| **ADMIN** | Everything: manage roles and appoint other admins, mark attendance organisation-wide, create projects, post announcements, review leave, read audit logs |
| **DEPARTMENT_HEAD** | Heads one academic department; sees the member roster; own tasks only |
| **TEAM_HEAD** | Marks attendance for their own team, assigns tasks within it, sees the roster |
| **TEAM_MEMBER** | Own data only |

Enforced server-side in `middleware/rbac.js` and each controller, mirrored
client-side in `App.jsx` (`PAGE_ROLES`) and `Sidebar.jsx`.

**Registration can never grant ADMIN** — `SELF_ASSIGNABLE_ROLES` excludes it, and
a request for it is silently downgraded to TEAM_MEMBER.

### Appointing an administrator

Team Directory → **Add admin** → pick the person → confirm. Or change their Role
dropdown to Admin directly.

There is **no limit on how many admins exist** — appoint a former president, the
secretary, whoever needs it. Two guard rails:

- You cannot remove your own admin role or suspend yourself (that would lock you out mid-session).
- The **last** active admin cannot be demoted or suspended.

Every grant is written to the audit log as `ADMIN_GRANTED`, every removal as
`ADMIN_REVOKED`.

## Pages

| Page | Access | Notes |
|:--|:--|:--|
| Dashboard | All | Stats, weekly attendance chart, projects, activity, gauge |
| Attendance | All | Admins/heads mark sessions; everyone sees their history |
| Projects | All | Admins create; progress derived from task completion |
| Task Board | All | Heads assign within their team; members update own status |
| Members | Admin, Dept Head, Team Head | Roster with team filter |
| Department Heads | All | Each academic department and who heads it |
| Announcements | All | Admins compose; banner + optional email |
| Leave | All | Apply; admins approve/reject with notes |
| Team Directory | Admin | Contact details, inline role/department/position editing |
| Audit Logs | Admin | Auth, privilege changes, admin actions |
| My Account | All | Profile, and password change confirmed by an emailed code |

---

## Design system

Rebuilt on a token-based stylesheet (`client/src/index.css`). No inline style
sheets, no per-page colour literals.

- **Geometry:** rectangular throughout — `--radius: 0px` is a single knob.
- **Shell:** light grey canvas, white cards, sidebar with MENU/GENERAL groups
  and a left accent bar on the active item.
- **Brand colours (unchanged):** `#2EA8FF` cyan · `#F2B233` gold · `#FF6B2C` orange.
- **Logo:** `client/public/logo.png`, untouched. It is ~39% near-white artwork,
  so it is always placed on a dark plate (sidebar header, auth panel). The old
  `mixBlendMode: 'screen'` was removed — the PNG has a real alpha channel, and
  the blend mode destroyed the artwork on any non-black surface.
- **Favicon:** `client/public/icon.png`, untouched.
- **Feedback:** toast notifications replace `alert()` / `prompt()`.
- **Responsive:** sidebar collapses to an overlay below 1024px; grids collapse
  to one column below 720px.

---

## Passwords

Every user can change their own password from **My Account**. The change is
confirmed with a 6-digit code emailed to the user's own address, so knowing the
current password alone is not enough.

- `POST /auth/password/request-code` — signed in; emails a code
- `POST /auth/password/change` — current password + code + new password
- `POST /auth/password/forgot` — signed out; emails a reset code
- `POST /auth/password/reset` — email + code + new password

Codes expire after 10 minutes, allow 6 attempts, and are compared in constant
time. `forgot` returns an identical response whether or not the address exists,
so it cannot be used to discover accounts.

SMS OTP was considered and skipped — Indian SMS needs a paid provider plus DLT
registration with TRAI. Email verification covers the same requirement.

## Key files

| File | Purpose |
|:--|:--|
| `client/src/index.css` | The whole design system |
| `client/src/constants.js` | Departments, statuses, local-date helpers |
| `client/src/components/ui/` | Card, Stat, Badge, Modal, Empty, Toast, Avatar |
| `client/src/components/Sidebar.jsx` | Navigation with role filtering |
| `client/src/components/Topbar.jsx` | Search (Ctrl+F), notifications, user chip |
| `client/src/api/axiosClient.js` | API client; broadcasts session expiry |
| `server/src/server.js` | Env validation, CORS allowlist, admin bootstrap |
| `server/src/utils/emailService.js` | SendGrid with real failure reporting |
| `server/src/utils/dates.js` | Timezone-correct calendar dates |
| `server/.env.example` | Every variable, documented |

---

## Fixed in this pass

| Issue | Resolution |
|:--|:--|
| Role/position editing 404'd — the directory's main feature never worked | Client called `PUT /admin/users/:id/role`; no such route. Now calls `PUT /admin/users/:id` |
| OTP returned in the registration response (`devOtp`) | Removed. Anyone could self-activate by reading the network response |
| OTP email silently failed in production | `from:` is now a separate verified sender; failures are surfaced, not swallowed |
| Admin seeding re-promoted 4 hardcoded emails on every restart with a known password | Replaced by a one-time, env-driven bootstrap that runs only when no admin exists |
| `JWT_SECRET` fell back to a literal in the repo | Required at boot; server exits if missing or under 32 chars |
| `CORS: origin '*'` | Explicit `CORS_ORIGINS` allowlist |
| Attendance dates used UTC — sessions before 05:30 IST filed to the previous day | `PORTAL_TIMEZONE`-aware local dates |
| Month filter bucketed records by marked-at timestamp, not session date | Filters on the session's calendar date |
| 0% attendance displayed as 100% (`percentage \|\| 100`) | Returns `null` for "no data"; UI shows `—` |
| Org-wide numbers shown to admins as "your attendance" | API returns `scope`; UI labels accordingly |
| Team heads couldn't mark attendance despite the spec | Allowed, scoped to their own department |
| Expired token left the UI logged in while every request 401'd | Session expiry event tears down React state |
| Refresh always returned to Dashboard; back button did nothing | `history.pushState` + `sessionStorage`, no router dependency |
| Rate limiter saw only Render's proxy IP | `trust proxy` enabled |
| Blocked access logged as `DIRECTORY_ACCESSED` | New `ACCESS_DENIED` audit action |
| Unmatched API routes returned HTML | JSON 404 handler |
| `resetDb.js` could wipe the database and reset passwords | Removed |
| Admin password published in this file | Removed |
| Roles did not match the organisation | Added DEPARTMENT_HEAD; teams now match the spreadsheet |
| Department head could not be recorded alongside a team | New `academicDepartment` field |
| A new role fell through `getTasks` and saw every task in the org | Only ADMIN is widened; anything else narrows to own tasks |
| Announcements to "HEADS" missed department heads | Both head roles included |
| No way for a user to change their password | My Account, confirmed by emailed code |
| No password recovery | Forgot-password flow |
| 8 test accounts in the database | Removed after a full backup |

---

## Still worth doing

- `server/scripts/e2eTest.cjs` covers 36 API assertions end to end, but it is a
  script rather than a proper test suite. Jest + Supertest against an in-memory
  MongoDB would be better for CI.
- OTP codes are stored in plaintext in the `users` collection. They are
  short-lived and attempt-limited, but hashing them would be better.
- Emails are sent from a gmail.com address, so they fail DMARC alignment and
  land in spam. Fixing this properly needs a domain you own — see DEPLOYMENT.md.
- Free-tier Render spins down when idle; the first request takes 30–60s.
