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
 * Access levels, most privileged first.
 *
 * Only ADMIN carries elevated permissions. The office-bearer roles below
 * record who someone is in the organisation; they do not by themselves grant
 * access to the directory, the audit log or attendance marking. Make an office
 * bearer an administrator explicitly if they need those.
 */
const ROLES = [
  'ADMIN',
  'PRESIDENT',
  'VICE_PRESIDENT',
  'SECRETARY',
  'JOINT_SECRETARY',
  'TREASURER',
  'DEPARTMENT_HEAD',
  'TEAM_HEAD',
  'TEAM_MEMBER'
];

/**
 * Roles that see the member roster: the committee, plus the two head roles.
 * Everything stricter than this stays ADMIN-only.
 */
const ROSTER_ROLES = [
  'ADMIN',
  'PRESIDENT',
  'VICE_PRESIDENT',
  'SECRETARY',
  'JOINT_SECRETARY',
  'TREASURER',
  'DEPARTMENT_HEAD',
  'TEAM_HEAD'
];

/** Roles an announcement addressed to "HEADS" reaches. */
const HEAD_ROLES = ['DEPARTMENT_HEAD', 'TEAM_HEAD'];

/** Roles a person may request when registering — never ADMIN. */
const SELF_ASSIGNABLE_ROLES = ROLES.filter(r => r !== 'ADMIN');

const STATUSES = ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED'];

/** Work item vocabulary. Mirrored in client/src/constants.js. */
const TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED'];
const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const PROJECT_STATUSES = ['PLANNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED'];
const LEAVE_TYPES = ['SICK', 'CASUAL', 'EARNED', 'OTHER'];

module.exports = {
  TEAMS,
  ACADEMIC_DEPARTMENTS,
  ROLES,
  SELF_ASSIGNABLE_ROLES,
  ROSTER_ROLES,
  HEAD_ROLES,
  STATUSES,
  TASK_STATUSES,
  TASK_PRIORITIES,
  PROJECT_STATUSES,
  LEAVE_TYPES
};
