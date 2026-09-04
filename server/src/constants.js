/**
 * Organisation structure — the server's source of truth.
 * Mirrored in client/src/constants.js; keep the two in step.
 */

/**
 * Club teams. Taken from the team spreadsheet.
 * To add a team, add it here AND in client/src/constants.js.
 */
const TEAMS = [
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
 * Academic departments — a separate axis from club teams.
 *
 * Someone can belong to a team AND head an academic department: in the
 * spreadsheet, Eshika is "PR Team" with position "IT department Head", and
 * Aaditi is "PR Team" with "Mechanical department Head". Storing this as a
 * second field is what lets both be true at once.
 *
 * Only the departments evidenced in the spreadsheet are listed. Add more here
 * and in client/src/constants.js as the club grows.
 */
const ACADEMIC_DEPARTMENTS = [
  'Computer Science',
  'Information Technology',
  'Mechanical',
  'Polytechnic'
];

/**
 * Access levels, least to most privileged.
 *  ADMIN           full control, including granting admin to others
 *  DEPARTMENT_HEAD heads an academic department; sees their department's members
 *  TEAM_HEAD       heads a club team; marks attendance and assigns tasks for it
 *  TEAM_MEMBER     own data only
 */
const ROLES = ['ADMIN', 'DEPARTMENT_HEAD', 'TEAM_HEAD', 'TEAM_MEMBER'];

/** Roles a person may request when registering — never ADMIN. */
const SELF_ASSIGNABLE_ROLES = ['DEPARTMENT_HEAD', 'TEAM_HEAD', 'TEAM_MEMBER'];

const STATUSES = ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED'];

module.exports = {
  TEAMS,
  ACADEMIC_DEPARTMENTS,
  ROLES,
  SELF_ASSIGNABLE_ROLES,
  STATUSES
};
