/**
 * Project membership, visibility and the whole-team shortcut.
 *   node scripts/testProjects.cjs
 * Creates throwaway accounts and removes everything it made.
 */
require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const PW = 'ProjTest12345!';

function call(method, path, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1', port: 5000, path: `/api/v1${path}`, method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, res => {
      let raw = '';
      res.on('data', d => (raw += d));
      res.on('end', () => {
        let json; try { json = JSON.parse(raw); } catch { json = {}; }
        resolve({ status: res.statusCode, json });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

let pass = 0, fail = 0;
const check = (l, ok, d = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${l}${ok ? '' : `\n        ${d}`}`);
  ok ? pass++ : fail++;
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  const User = require('../src/models/User');
  const Project = require('../src/models/Project');
  const Task = require('../src/models/Task');

  await User.deleteMany({ email: /@projtest\.invalid$/ });
  const hash = await bcrypt.hash(PW, await bcrypt.genSalt(10));
  const mk = (n, e, r, d) => User.create({
    fullName: n, email: e, passwordHash: hash, role: r,
    department: d, status: 'ACTIVE', position: 'Member'
  });

  const admin = await mk('Proj Admin', 'admin@projtest.invalid', 'ADMIN', 'Core Team');
  const ev1 = await mk('Ev One', 'e1@projtest.invalid', 'TEAM_MEMBER', 'Event Team');
  const ev2 = await mk('Ev Two', 'e2@projtest.invalid', 'TEAM_MEMBER', 'Event Team');
  const pr1 = await mk('Pr One', 'p1@projtest.invalid', 'TEAM_MEMBER', 'PR Team');

  const login = async (e) => (await call('POST', '/auth/login', { body: { email: e, password: PW } })).json.token;
  const adminT = await login('admin@projtest.invalid');
  const ev1T = await login('e1@projtest.invalid');
  const pr1T = await login('p1@projtest.invalid');
  check('accounts sign in', Boolean(adminT && ev1T && pr1T));

  const deadline = new Date(Date.now() + 14 * 86400000).toISOString();

  // -------------------------------------------------- several members
  const multi = await call('POST', '/projects', {
    token: adminT,
    body: {
      projectName: 'Annual Fest', description: 'Shared project',
      deadline, memberIds: [String(ev1._id), String(pr1._id)]
    }
  });
  check('a project can hold several members',
    multi.status === 201 && multi.json.project?.members?.length === 2,
    `${multi.status} ${JSON.stringify(multi.json.message)}`);
  check('teams are derived from the members',
    JSON.stringify([...(multi.json.project?.teams || [])].sort()) ===
    JSON.stringify(['Event Team', 'PR Team']),
    JSON.stringify(multi.json.project?.teams));

  const projectId = multi.json.project._id;

  // -------------------------------------------------- whole team
  // This runs against the live database, which has real Event Team members in
  // it. Count against what is actually there rather than assuming the suite
  // has the team to itself.
  const eventTeamSize = await User.countDocuments({ department: 'Event Team', status: 'ACTIVE' });

  const team = await call('POST', '/projects', {
    token: adminT,
    body: { projectName: 'Event Drive', description: 'Team project', deadline, assignTeam: 'Event Team' }
  });
  const names = (team.json.project?.members || []).map(m => m.name);
  check('assignTeam expands to every active member of that team',
    team.status === 201 && names.length === eventTeamSize,
    `expected ${eventTeamSize}, got ${names.length}`);
  check('the suite\'s own members are among them',
    names.includes('Ev One') && names.includes('Ev Two'), names.join(', '));
  check('everyone expanded really is on that team',
    (team.json.project?.members || []).every(m => m.team === 'Event Team'));

  await mk('Ev Three', 'e3@projtest.invalid', 'TEAM_MEMBER', 'Event Team');
  const after = await Project.findById(team.json.project._id);
  check('someone joining the team later is NOT added to an existing project',
    after.members.length === eventTeamSize && !after.members.some(m => m.name === 'Ev Three'),
    `${after.members.length} members, expected ${eventTeamSize}`);

  // -------------------------------------------------- validation
  const none = await call('POST', '/projects', {
    token: adminT, body: { projectName: 'Empty', description: 'x', deadline, memberIds: [] }
  });
  check('a project with nobody on it is rejected', none.status === 400, `${none.status}`);

  const badTeam = await call('POST', '/projects', {
    token: adminT, body: { projectName: 'Bad', description: 'x', deadline, assignTeam: 'Nope Team' }
  });
  check('an unknown team is rejected', badTeam.status === 400, `${badTeam.status}`);

  const asMember = await call('POST', '/projects', {
    token: ev1T, body: { projectName: 'Sneaky', description: 'x', deadline, memberIds: [String(ev1._id)] }
  });
  check('a member cannot create a project', asMember.status === 403, `${asMember.status}`);

  // -------------------------------------------------- visibility
  const ev1Sees = await call('GET', '/projects', { token: ev1T });
  check('a member sees projects they are on or their team is on',
    ev1Sees.json.projects.every(p =>
      p.members.some(m => String(m.userId) === String(ev1._id)) ||
      p.teams.includes('Event Team')),
    JSON.stringify(ev1Sees.json.projects.map(p => p.projectName)));

  const pr1Sees = await call('GET', '/projects', { token: pr1T });
  check('a member does NOT see an unrelated team\'s project',
    !pr1Sees.json.projects.some(p => p.projectName === 'Event Drive'),
    JSON.stringify(pr1Sees.json.projects.map(p => p.projectName)));

  const adminSees = await call('GET', '/projects', { token: adminT });
  check('an admin sees every project', adminSees.json.count >= 2, `${adminSees.json.count}`);

  // -------------------------------------------------- editing members
  const changed = await call('PUT', `/projects/${projectId}`, {
    token: adminT, body: { memberIds: [String(ev1._id), String(ev2._id)] }
  });
  check('members can be changed later', changed.status === 200, `${changed.status}`);
  const reloaded = await Project.findById(projectId);
  check('teams are recomputed when members change',
    JSON.stringify(reloaded.teams) === JSON.stringify(['Event Team']),
    JSON.stringify(reloaded.teams));

  const untouched = await call('PUT', `/projects/${projectId}`, {
    token: adminT, body: { status: 'IN_PROGRESS' }
  });
  const stillTwo = await Project.findById(projectId);
  check('updating other fields leaves members alone',
    untouched.status === 200 && stillTwo.members.length === 2,
    `${stillTwo.members.length} members`);

  // -------------------------------------------------- delete guard
  await Task.create({
    title: 'Blocker', description: 'x', projectId,
    assignees: [{ userId: ev1._id, name: 'Ev One', team: 'Event Team' }],
    assignedByUserId: admin._id, assignedByName: 'Proj Admin',
    dueDate: new Date(Date.now() + 86400000)
  });
  const blocked = await call('DELETE', `/projects/${projectId}`, { token: adminT });
  check('a project with tasks cannot be deleted', blocked.status === 409, `${blocked.status}`);

  await Task.deleteMany({ projectId });
  const deleted = await call('DELETE', `/projects/${projectId}`, { token: adminT });
  check('a project with no tasks can be deleted', deleted.status === 200, `${deleted.status}`);

  // -------------------------------------------------- cleanup
  await Project.deleteMany({ projectName: { $in: ['Annual Fest', 'Event Drive'] } });
  await Task.deleteMany({ 'assignees.userId': { $in: [ev1._id, ev2._id, pr1._id] } });
  await User.deleteMany({ email: /@projtest\.invalid$/ });
  await mongoose.connection.db.collection('auditlogs').deleteMany({ actorEmail: /@projtest\.invalid$/ });
  console.log('\ncleaned up.');

  await mongoose.disconnect();
  console.log(`\n${pass} passed, ${fail} failed.`);
  process.exit(fail ? 1 : 0);
})().catch(async e => {
  console.error('crashed:', e.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
