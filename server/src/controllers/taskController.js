const Task = require('../models/Task');
const User = require('../models/User');
const Project = require('../models/Project');
const { logAuditEvent } = require('../utils/auditHelper');
const { TASK_STATUSES, TASK_PRIORITIES, TEAMS } = require('../constants');

/** Recompute a project's progress from how many of its tasks are done. */
async function refreshProjectProgress(projectId) {
  if (!projectId) return;
  const total = await Task.countDocuments({ projectId });
  const done = await Task.countDocuments({ projectId, status: 'COMPLETED' });
  await Project.findByIdAndUpdate(projectId, {
    progress: total ? Math.round((done / total) * 100) : 0
  });
}

// ------------------------------------------------------------------- LIST

const getTasks = async (req, res) => {
  try {
    let query = {};

    // Only ADMIN sees everything. A team head sees their team's tasks plus any
    // they are personally on; everyone else sees only tasks assigned to them.
    // Anything not widened here stays narrow — a new role must never inherit
    // organisation-wide visibility by falling through.
    if (req.user.role === 'TEAM_HEAD') {
      query = {
        $or: [
          { teams: req.user.department },
          { 'assignees.userId': req.user._id }
        ]
      };
    } else if (req.user.role !== 'ADMIN') {
      query = { 'assignees.userId': req.user._id };
    }

    const tasks = await Task.find(query)
      .populate('projectId', 'projectName')
      .sort({ status: 1, dueDate: 1 });

    return res.status(200).json({ success: true, count: tasks.length, tasks });
  } catch (err) {
    console.error('[TASK LIST ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not load tasks.' });
  }
};

// ----------------------------------------------------------------- CREATE

/**
 * Create one shared task for one or more people.
 * Body: { title, description, projectId, assigneeIds: [], priority, dueDate }
 *
 * `assignTeam` is a convenience: it expands to that team's active members at
 * creation time. The task then holds real people, so someone joining the team
 * later does not silently inherit old work.
 */
const createTask = async (req, res) => {
  try {
    const { title, description, projectId, assigneeIds, assignTeam, priority, dueDate } = req.body;

    if (!title || !description || !projectId || !dueDate) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, project and due date are required.'
      });
    }

    if (priority && !TASK_PRIORITIES.includes(priority)) {
      return res.status(400).json({ success: false, message: 'Unknown priority.' });
    }

    // Resolve who the task is for
    let ids = Array.isArray(assigneeIds) ? [...new Set(assigneeIds.map(String))] : [];

    if (assignTeam) {
      if (!TEAMS.includes(assignTeam)) {
        return res.status(400).json({ success: false, message: 'Unknown team.' });
      }
      const members = await User.find({ department: assignTeam, status: 'ACTIVE' }).select('_id');
      ids = [...new Set([...ids, ...members.map(m => String(m._id))])];
    }

    if (ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Choose at least one person to assign this task to.'
      });
    }

    const people = await User.find({ _id: { $in: ids }, status: 'ACTIVE' })
      .select('fullName department');

    if (people.length !== ids.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more of the people selected could not be found or are not active.'
      });
    }

    // A team head may only assign within their own team — checked for every
    // person on the task, not just the first.
    if (req.user.role === 'TEAM_HEAD') {
      const outside = people.filter(p => p.department !== req.user.department);
      if (outside.length) {
        await logAuditEvent({
          action: 'TASK_ASSIGNED',
          req,
          actorUser: req.user,
          details: {
            blocked: true,
            reason: 'CROSS_TEAM_ASSIGNMENT',
            attempted: outside.map(p => p.fullName)
          }
        });
        return res.status(403).json({
          success: false,
          message: `As head of ${req.user.department}, you can only assign to your own team. ` +
                   `Not in your team: ${outside.map(p => p.fullName).join(', ')}.`
        });
      }
    }

    const project = await Project.findById(projectId).select('_id');
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const task = await Task.create({
      title,
      description,
      projectId,
      assignees: people.map(p => ({ userId: p._id, name: p.fullName, team: p.department })),
      assignedByUserId: req.user._id,
      assignedByName: req.user.fullName,
      priority: priority || 'MEDIUM',
      dueDate
    });

    await refreshProjectProgress(projectId);

    await logAuditEvent({
      action: 'TASK_ASSIGNED',
      req,
      actorUser: req.user,
      targetResource: `Task:${task._id}`,
      details: {
        title,
        assignees: people.map(p => p.fullName),
        assignedTeam: assignTeam || null,
        priority: task.priority
      }
    });

    return res.status(201).json({
      success: true,
      message: people.length === 1
        ? `Task assigned to ${people[0].fullName}.`
        : `Task assigned to ${people.length} people.`,
      task
    });
  } catch (err) {
    console.error('[TASK CREATE ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not create the task.' });
  }
};

// ----------------------------------------------------------------- STATUS

const updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!TASK_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Unknown status.' });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    // Anyone actually on the task may move it; a team head may move their
    // team's tasks; an admin may move any.
    const isAssignee = task.hasAssignee(req.user._id);
    const isTeamHead = req.user.role === 'TEAM_HEAD' && task.teams.includes(req.user.department);
    const isAdmin = req.user.role === 'ADMIN';

    if (!isAdmin && !isTeamHead && !isAssignee) {
      return res.status(403).json({
        success: false,
        message: 'You can only update a task you are assigned to.'
      });
    }

    const from = task.status;
    task.status = status;
    await task.save();

    await refreshProjectProgress(task.projectId);

    await logAuditEvent({
      action: 'TASK_STATUS_UPDATED',
      req,
      actorUser: req.user,
      targetResource: `Task:${task._id}`,
      details: { title: task.title, transition: `${from} -> ${status}` }
    });

    return res.status(200).json({ success: true, message: 'Task updated.', task });
  } catch (err) {
    console.error('[TASK STATUS ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not update the task.' });
  }
};

// ----------------------------------------------------------------- DELETE

const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    if (req.user.role === 'TEAM_HEAD' && !task.teams.includes(req.user.department)) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete tasks within your own team.'
      });
    }

    const projectId = task.projectId;
    await task.deleteOne();
    await refreshProjectProgress(projectId);

    return res.status(200).json({ success: true, message: 'Task deleted.' });
  } catch (err) {
    console.error('[TASK DELETE ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not delete the task.' });
  }
};

module.exports = { getTasks, createTask, updateTaskStatus, deleteTask };
