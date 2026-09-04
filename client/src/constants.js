/**
 * Organisation structure — mirrors server/src/constants.js.
 * Change both files together.
 */

/** Club teams, from the team spreadsheet. */
export const DEPARTMENTS = [
  'Core Team',
  'PR Team',
  'Technical Team',
  'Event Team',
  'Graphics Team',
  'Media Team',
  'Documentation Team',
  'CSD',
  'SRD',
  'Membership Director'
];

/**
 * Academic departments — a separate axis from club teams, because someone can
 * be in PR Team AND head the IT department at the same time.
 * Only departments evidenced in the spreadsheet are listed; add more here and
 * in server/src/constants.js.
 */
export const ACADEMIC_DEPARTMENTS = [
  'Computer Science',
  'Information Technology',
  'Mechanical',
  'Polytechnic'
];

export const ROLES = ['ADMIN', 'DEPARTMENT_HEAD', 'TEAM_HEAD', 'TEAM_MEMBER'];

/** Roles someone may pick for themselves when registering — never ADMIN. */
export const SELF_ASSIGNABLE_ROLES = ['DEPARTMENT_HEAD', 'TEAM_HEAD', 'TEAM_MEMBER'];

export const ROLE_LABEL = {
  ADMIN: 'Admin',
  DEPARTMENT_HEAD: 'Department Head',
  TEAM_HEAD: 'Team Head',
  TEAM_MEMBER: 'Member'
};

export const ROLE_TONE = {
  ADMIN: 'orange',
  DEPARTMENT_HEAD: 'gold',
  TEAM_HEAD: 'cyan',
  TEAM_MEMBER: 'mute'
};

export const TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED'];
export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const PROJECT_STATUSES = ['PLANNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED'];
export const LEAVE_TYPES = ['CASUAL', 'SICK', 'EARNED', 'OTHER'];

/**
 * Local calendar date as YYYY-MM-DD.
 * `toISOString()` converts to UTC first, which in IST (+05:30) files anything
 * before 05:30 under the previous day. Every date in this app is a local
 * calendar date, so it must be built from local parts.
 */
export const localDate = (d = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Local YYYY-MM, for month filters. */
export const localMonth = (d = new Date()) => localDate(d).slice(0, 7);

/** YYYY-MM-DD offset by N days from today, in local time. */
export const dateFromNow = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDate(d);
};

/** Case-insensitive "does any of these fields contain the query" helper. */
export const matches = (query, ...fields) => {
  const q = query?.trim().toLowerCase();
  if (!q) return true;
  return fields.some(f => String(f ?? '').toLowerCase().includes(q));
};
