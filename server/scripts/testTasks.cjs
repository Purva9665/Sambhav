/**
 * Exercises shared task assignment against a running API.
 *   node scripts/testTasks.cjs
 * Creates its own throwaway accounts and removes everything it made.
 */
require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const BASE = 'http://127.0.0.1:5000/api/v1';
const PW = 'TaskTest12345!';

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
        let json; try { json = JSON.parse(raw); } catch { json = { raw }; }
        resolve({ status: res.statusCode, json });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n        ${detail}`}`);
  ok ? pass++ : fail++;
};

const login = async (email) =>
  (await call('POST', '/auth/login', { body: { email, password: PW } })).json.token;

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const User = require('../src/models/User');
  const Task = require('../src/models/Task');
  const Project = require('../src/models/Project');

  const hash = await bcrypt.hash(PW, await bcrypt.genSalt(10));
  const mk = (name, email, role, dept) => User.create({
    fullName: name, email, passwordHash: hash, role,
    department: dept, status: 'ACTIVE', position: 'Member'
  });

  await User.deleteMany({ email: /@tasktest\.invalid$/ });

  const admin = await mk('T Admin', 'admin@tasktest.invalid', 'ADMIN', 'Core Team');
  const head = await mk('T Head', 'head@tasktest.invalid', 'TEAM_HEAD', 'Event Team');
  const e1 = await mk('Event One', 'e1@tasktest.invalid', 'TEAM_MEMBER', 'Event Team');
  const e2 = await mk('Event Two', 'e2@tasktest.invalid', 'TEAM_MEMBER', 'Event Team');
  const pr1 = await mk('PR One', 'pr1@tasktest.invalid', 'TEAM_MEMBER', 'PR Team');

  const adminT = await login('admin@tasktest.invalid');
  const headT = await login('head@tasktest.invalid');
  const e1T = await login('e1@tasktest.invalid');
  const prT = await login('pr1@tasktest.invalid');

  const project = await Project.create({
    projectName: 'Task Test Project', assignedTeam: 'Event Team',
    description: 'temp', deadline: new Date(Date.now() + 7 * 86400000), createdBy: admin._id
  });

  // ---------------------------------------------------- multiple assignees
  const multi = await call('POST', '/tasks', {
    token: adminT,
    body: {
      title: 'Run the registration desk',
      description: 'Shared duty',
      projectId: String(project._id),
      assigneeIds: [String(e1._id), String(e2._id)],
      dueDate: new Date(Date.now() + 3 * 86400000).toISOString()
    }
  });
  check('a task can be assigned to several people',
    multi.status === 201 && multi.json.task?.assignees?.length === 2,
    `${multi.status} ${JSON.stringify(multi.json.message || multi.json)}`);
  check('response says how many it went to',
    /2 people/.test(multi.json.message || ''), multi.json.message);

  const sharedId = multi.json.task?._id;

  // ------------------------------------------------------- whole team
  const team = await call('POST', '/tasks', {
    token: adminT,
    body: {
      title: 'Team briefing',
      description: 'Everyone attends',
      projectId: String(project._id),
      assignTeam: 'Event Team',
      dueDate: new Date(Date.now() + 4 * 86400000).toISOString()
    }
  });
  const names = (team.json.task?.assignees || []).map(a => a.name).sort();
  check('assignTeam expands to the whole active team',
    team.status === 201 && names.length === 3,
    `got ${names.length}: ${names.join(', ')}`);
  check('expanded members are real people, not a team name',
    names.includes('Event One') && names.includes('Event Two') && names.includes('T Head'),
    names.join(', '));
  check('teams field is derived from assignees',
    JSON.stringify(team.json.task?.teams) === JSON.stringify(['Event Team']),
    JSON.stringify(team.json.task?.teams));

  // ----------------------------------------------- a later joiner is excluded
  await mk('Event Three', 'e3@tasktest.invalid', 'TEAM_MEMBER', 'Event Team');
  const after = await Task.findById(team.json.task._id);
  check('someone joining later does NOT inherit an existing task',
    after.assignees.length === 3, `${after.assignees.length} assignees`);

  // ------------------------------------------------------- visibility
  const asE1 = await call('GET', '/tasks', { token: e1T });
  check('a member sees tasks they are on', asE1.json.count === 2, `count=${asE1.json.count}`);

  const asPr = await call('GET', '/tasks', { token: prT });
  check('a member NOT on the task sees nothing', asPr.json.count === 0, `count=${asPr.json.count}`);

  const asHead = await call('GET', '/tasks', { token: headT });
  check('a team head sees their team\'s tasks', asHead.json.count === 2, `count=${asHead.json.count}`);

  // ------------------------------------------------------- shared status
  const move = await call('PUT', `/tasks/${sharedId}/status`, {
    token: e1T, body: { status: 'IN_PROGRESS' }
  });
  check('any assignee can move a shared task', move.status === 200, `${move.status}`);

  const seenByOther = (await call('GET', '/tasks', { token: headT })).json.tasks
    .find(t => t._id === sharedId);
  check('the change is shared, not per-person',
    seenByOther?.status === 'IN_PROGRESS', seenByOther?.status);

  const outsider = await call('PUT', `/tasks/${sharedId}/status`, {
    token: prT, body: { status: 'COMPLETED' }
  });
  check('someone not on the task cannot move it', outsider.status === 403, `${outsider.status}`);

  // ------------------------------------------- team head cross-team guard
  const cross = await call('POST', '/tasks', {
    token: headT,
    body: {
      title: 'Cross team', description: 'should fail',
      projectId: String(project._id),
      assigneeIds: [String(e1._id), String(pr1._id)],
      dueDate: new Date(Date.now() + 86400000).toISOString()
    }
  });
  check('a team head cannot assign outside their team', cross.status === 403, `${cross.status}`);
  check('the refusal names who was out of team',
    /PR One/.test(cross.json.message || ''), cross.json.message);

  const own = await call('POST', '/tasks', {
    token: headT,
    body: {
      title: 'Within team', description: 'ok',
      projectId: String(project._id),
      assigneeIds: [String(e1._id), String(e2._id)],
      dueDate: new Date(Date.now() + 86400000).toISOString()
    }
  });
  check('a team head can assign within their team', own.status === 201, `${own.status}`);

  // --------------------------------------------------------- validation
  const none = await call('POST', '/tasks', {
    token: adminT,
    body: { title: 'x', description: 'y', projectId: String(project._id),
            assigneeIds: [], dueDate: new Date().toISOString() }
  });
  check('a task with nobody on it is rejected', none.status === 400, `${none.status}`);

  // ------------------------------------------------- progress counts once
  await call('PUT', `/tasks/${sharedId}/status`, { token: adminT, body: { status: 'COMPLETED' } });
  const proj = await Project.findById(project._id);
  check('a shared task counts once toward project progress',
    proj.progress === 33, `progress=${proj.progress}% (1 of 3 done)`);

  // ------------------------------------------------------------ cleanup
  await Task.deleteMany({ projectId: project._id });
  await Project.deleteOne({ _id: project._id });
  await User.deleteMany({ email: /@tasktest\.invalid$/ });
  await mongoose.connection.db.collection('auditlogs').deleteMany({ actorEmail: /@tasktest\.invalid$/ });
  console.log('\ncleaned up.');

  await mongoose.disconnect();
  console.log(`\n${pass} passed, ${fail} failed.`);
  process.exit(fail ? 1 : 0);
})().catch(async e => {
  console.error('crashed:', e.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
