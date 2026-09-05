const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const { logAuditEvent } = require('../utils/auditHelper');
const { PROJECT_STATUSES, TEAMS } = require('../constants');

/**
 * Resolve a member selection into real people.
 *
 * `assignTeam` expands to that team's active members at the moment of the
 * call, exactly as task assignment does, so the project holds people rather
 * than a team name and a later joiner does not silently inherit old work.
 */
async function resolveMembers({ memberIds, assignTeam }) {
  let ids = Array.isArray(memberIds) ? [...new Set(memberIds.map(String))] : [];

  if (assignTeam) {
    if (!TEAMS.includes(assignTeam)) {
      return { error: 'Unknown team.' };
    }
    const teamMembers = await User.find({ department: assignTeam, status: 'ACTIVE' }).select('_id');
    ids = [...new Set([...ids, ...teamMembers.map(m => String(m._id))])];
  }

  if (ids.length === 0) {
    return { error: 'Choose at least one person for this project.' };
  }

  const people = await User.find({ _id: { $in: ids }, status: 'ACTIVE' })
    .select('fullName department');

  if (people.length !== ids.length) {
    return { error: 'One or more of the people selected could not be found or are not active.' };
  }

  return {
    members: people.map(p => ({ userId: p._id, name: p.fullName, team: p.department }))
  };
}

// -------------------------------------------------------------------- LIST

const getProjects = async (req, res) => {
  try {
    const { status, search } = req.query;
    const query = {};

    if (status && PROJECT_STATUSES.includes(status)) query.status = status;
    if (search) query.projectName = { $regex: String(search).slice(0, 80), $options: 'i' };

    // Only ADMIN sees everything. Everyone else sees projects they are on, or
    // that their team is on. Anything not widened here stays narrow, so a new
    // role cannot inherit organisation-wide visibility by falling through.
    if (req.user.role !== 'ADMIN') {
      query.$or = [
        { 'members.userId': req.user._id },
        { teams: req.user.department }
      ];
    }

    const projects = await Project.find(query).sort({ deadline: 1 });
    return res.status(200).json({ success: true, count: projects.length, projects });
  } catch (err) {
    console.error('[PROJECT LIST ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not load projects.' });
  }
};

// ------------------------------------------------------------------ CREATE

const createProject = async (req, res) => {
  try {
    const { projectName, description, deadline, memberIds, assignTeam } = req.body;

    if (!projectName || !description || !deadline) {
      return res.status(400).json({
        success: false,
        message: 'Project name, description and deadline are required.'
      });
    }

    const resolved = await resolveMembers({ memberIds, assignTeam });
    if (resolved.error) {
      return res.status(400).json({ success: false, message: resolved.error });
    }

    const project = await Project.create({
      projectName,
      description,
      deadline,
      members: resolved.members,
      createdBy: req.user._id,
      createdByName: req.user.fullName
    });

    await logAuditEvent({
      action: 'PROJECT_CREATED',
      req,
      actorUser: req.user,
      targetResource: `Project:${project._id}`,
      details: {
        projectName,
        members: resolved.members.map(m => m.name),
        assignedTeam: assignTeam || null,
        deadline
      }
    });

    return res.status(201).json({
      success: true,
      message: resolved.members.length === 1
        ? `Project created for ${resolved.members[0].name}.`
        : `Project created with ${resolved.members.length} members.`,
      project
    });
  } catch (err) {
    console.error('[PROJECT CREATE ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not create the project.' });
  }
};

// ------------------------------------------------------------------ UPDATE

const updateProject = async (req, res) => {
  try {
    const { projectName, status, progress, deadline, description, memberIds, assignTeam } = req.body;

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    if (status && !PROJECT_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Unknown status.' });
    }

    if (projectName) project.projectName = projectName;
    if (description) project.description = description;
    if (deadline) project.deadline = deadline;
    if (status) project.status = status;
    if (progress !== undefined) project.progress = Math.max(0, Math.min(100, Number(progress) || 0));

    // Only touch the member list when the caller actually sent one.
    if (memberIds !== undefined || assignTeam) {
      const resolved = await resolveMembers({ memberIds, assignTeam });
      if (resolved.error) {
        return res.status(400).json({ success: false, message: resolved.error });
      }
      project.members = resolved.members;
    }

    // Completing a project means its work is done, whatever the task count says.
    if (status === 'COMPLETED') project.progress = 100;

    await project.save();

    await logAuditEvent({
      action: 'PROJECT_UPDATED',
      req,
      actorUser: req.user,
      targetResource: `Project:${project._id}`,
      details: {
        projectName: project.projectName,
        status: project.status,
        progress: project.progress,
        members: project.members.length
      }
    });

    return res.status(200).json({ success: true, message: 'Project updated.', project });
  } catch (err) {
    console.error('[PROJECT UPDATE ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not update the project.' });
  }
};

// ------------------------------------------------------------------ DELETE

const deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const tasks = await Task.countDocuments({ projectId: project._id });
    if (tasks > 0) {
      return res.status(409).json({
        success: false,
        message: `This project still has ${tasks} task${tasks === 1 ? '' : 's'}. Remove them first.`
      });
    }

    const name = project.projectName;
    await project.deleteOne();

    await logAuditEvent({
      action: 'PROJECT_UPDATED',
      req,
      actorUser: req.user,
      targetResource: `Project:${req.params.id}`,
      details: { projectName: name, action: 'DELETED' }
    });

    return res.status(200).json({ success: true, message: `“${name}” deleted.` });
  } catch (err) {
    console.error('[PROJECT DELETE ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not delete the project.' });
  }
};

module.exports = { getProjects, createProject, updateProject, deleteProject };
