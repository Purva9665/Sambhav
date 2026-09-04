const Task = require('../models/Task');
const User = require('../models/User');
const Project = require('../models/Project');
const { logAuditEvent } = require('../utils/auditHelper');

// Get tasks
const getTasks = async (req, res) => {
  try {
    let query = {};

    // Only ADMIN sees everything. Anything not explicitly widened here is
    // narrowed to the caller's own tasks — a new role must never inherit
    // organisation-wide visibility by falling through.
    if (req.user.role === 'TEAM_HEAD') {
      query.team = req.user.department;
    } else if (req.user.role !== 'ADMIN') {
      query.assignedToUserId = req.user._id;
    }

    const tasks = await Task.find(query)
      .populate('projectId', 'projectName')
      .sort({ dueDate: 1 });

    return res.status(200).json({ success: true, count: tasks.length, tasks });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch tasks.' });
  }
};

// Assign New Task (ADMIN or TEAM_HEAD)
const createTask = async (req, res) => {
  try {
    const { title, description, projectId, assignedToUserId, priority, dueDate } = req.body;

    if (!title || !description || !projectId || !assignedToUserId || !dueDate) {
      return res.status(400).json({ success: false, message: 'All task fields are required.' });
    }

    const assignee = await User.findById(assignedToUserId);
    if (!assignee) {
      return res.status(404).json({ success: false, message: 'Target assignee user not found.' });
    }

    // Role boundary check: TEAM_HEAD can ONLY assign within their own department!
    if (req.user.role === 'TEAM_HEAD' && assignee.department !== req.user.department) {
      await logAuditEvent({
        action: 'TASK_ASSIGNED',
        req,
        actorUser: req.user,
        details: { blocked: true, reason: 'CROSS_TEAM_ASSIGNMENT_ATTEMPT', assigneeDepartment: assignee.department }
      });
      return res.status(403).json({
        success: false,
        message: `Forbidden: As Team Head of '${req.user.department}', you can only assign tasks to members in your department.`
      });
    }

    const task = await Task.create({
      title,
      description,
      projectId,
      assignedToUserId: assignee._id,
      assignedToName: assignee.fullName,
      assignedByUserId: req.user._id,
      assignedByName: req.user.fullName,
      team: assignee.department,
      priority: priority || 'MEDIUM',
      dueDate
    });

    // Update project progress
    const totalTasks = await Task.countDocuments({ projectId });
    const completedTasks = await Task.countDocuments({ projectId, status: 'COMPLETED' });
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    await Project.findByIdAndUpdate(projectId, { progress });

    await logAuditEvent({
      action: 'TASK_ASSIGNED',
      req,
      actorUser: req.user,
      targetResource: `Task:${task._id}`,
      details: { title, assignee: assignee.email, team: assignee.department, priority }
    });

    return res.status(201).json({ success: true, message: 'Task assigned successfully.', task });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to assign task.' });
  }
};

// Update Task Status
const updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['PENDING', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    // Permissions: Admin can update any; Head can update team tasks; Member can update own task
    if (req.user.role === 'TEAM_MEMBER' && task.assignedToUserId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only update your own assigned task status.' });
    }
    if (req.user.role === 'TEAM_HEAD' && task.team !== req.user.department) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only update tasks within your team.' });
    }

    const oldStatus = task.status;
    task.status = status;
    await task.save();

    // Recalculate project progress
    const totalTasks = await Task.countDocuments({ projectId: task.projectId });
    const completedTasks = await Task.countDocuments({ projectId: task.projectId, status: 'COMPLETED' });
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    await Project.findByIdAndUpdate(task.projectId, { progress });

    await logAuditEvent({
      action: 'TASK_STATUS_UPDATED',
      req,
      actorUser: req.user,
      targetResource: `Task:${task._id}`,
      details: { transition: `${oldStatus} -> ${status}` }
    });

    return res.status(200).json({ success: true, message: 'Task status updated.', task });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update task status.' });
  }
};

module.exports = { getTasks, createTask, updateTaskStatus };
