import { Request, Response } from 'express';
import { Project } from '../models/Project';
import { Task } from '../models/Task';
import { Dependency } from '../models/Dependency';
import { Types } from 'mongoose';

export const getProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 });
    res.json(projects);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching projects' });
  }
};

export const createProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, startDate, endDate, status } = req.body;
    
    if (name) {
      const existing = await Project.findOne({ name: { $regex: new RegExp('^' + name.trim() + '$', 'i') } });
      if (existing) {
        res.status(400).json({ message: 'Project with this name already exists' });
        return;
      }
    }

    const project = new Project({ name, description, startDate, endDate, status });
    await project.save();
    res.status(201).json(project);
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Error creating project' });
  }
};

export const getProjectById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const project = await Project.findById(id);
    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }
    res.json(project);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching project' });
  }
};

export const updateProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, startDate, endDate, status } = req.body;

    if (name) {
      const existing = await Project.findOne({
        name: { $regex: new RegExp('^' + name.trim() + '$', 'i') },
        _id: { $ne: id }
      });
      if (existing) {
        res.status(400).json({ message: 'Project with this name already exists' });
        return;
      }
    }

    const project = await Project.findByIdAndUpdate(
      id,
      { name, description, startDate, endDate, status },
      { new: true, runValidators: true }
    );
    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }
    res.json(project);
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Error updating project' });
  }
};

export const deleteProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const project = await Project.findByIdAndDelete(id);
    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }
    const projectObjectId = new Types.ObjectId(id as string);
    // Delete all associated tasks and dependencies
    await Task.deleteMany({ projectId: projectObjectId });
    await Dependency.deleteMany({ projectId: projectObjectId });
    res.json({ message: 'Project and all associated tasks and dependencies deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error deleting project' });
  }
};
