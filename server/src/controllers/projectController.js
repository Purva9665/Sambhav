const Project = require('../models/Project');
const Task = require('../models/Task');
const { logAuditEvent } = require('../utils/auditHelper');

// Get all projects
const getProjects = async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = {};

    if (status) query.status = status;
    if (search) {
      query.projectName = { $regex: search, $options: 'i' };
    }

    // Non-admins see projects relevant to their department/team
    if (req.user.role !== 'ADMIN') {
      query.assignedTeam = req.user.department;
    }

    const projects = await Project.find(query).sort({ deadline: 1 });
    return res.status(200).json({ success: true, count: projects.length, projects });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch projects.' });
  }
};

// Create new project (ADMIN ONLY)
const createProject = async (req, res) => {
  try {
    const { projectName, assignedTeam, description, deadline } = req.body;

    if (!projectName || !assignedTeam || !description || !deadline) {
      return res.status(400).json({ success: false, message: 'All project fields are required.' });
    }

    const project = await Project.create({
      projectName,
      assignedTeam,
      description,
      deadline,
      createdBy: req.user._id
    });

    await logAuditEvent({
      action: 'PROJECT_CREATED',
      req,
      actorUser: req.user,
      targetResource: `Project:${project._id}`,
      details: { projectName, assignedTeam, deadline }
    });

    return res.status(201).json({ success: true, message: 'Project created successfully.', project });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to create project.' });
  }
};

// Update project status or details (ADMIN ONLY)
const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { projectName, status, progress, deadline, description } = req.body;

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    if (projectName) project.projectName = projectName;
    if (status) project.status = status;
    if (progress !== undefined) project.progress = progress;
    if (deadline) project.deadline = deadline;
    if (description) project.description = description;

    if (status === 'COMPLETED') {
      project.completedAt = new Date();
      project.progress = 100;
    }

    await project.save();

    await logAuditEvent({
      action: 'PROJECT_UPDATED',
      req,
      actorUser: req.user,
      targetResource: `Project:${project._id}`,
      details: { status: project.status, progress: project.progress }
    });

    return res.status(200).json({ success: true, message: 'Project updated successfully.', project });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update project.' });
  }
};

module.exports = { getProjects, createProject, updateProject };
