import { Request, Response } from 'express';
import { Dependency } from '../models/Dependency';
import { Task } from '../models/Task';
import { Types } from 'mongoose';

export const getDependencies = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.query;
    if (!projectId) {
      res.status(400).json({ message: 'projectId query parameter is required' });
      return;
    }

    const projObjectId = new Types.ObjectId(projectId as string);

    // Fetch only active tasks for the project
    const activeTasks = await Task.find({
      projectId: projObjectId,
      isDeleted: { $ne: true }
    }).select('_id');
    const activeTaskIds = activeTasks.map(t => t._id);

    // Only return active dependencies between active tasks
    const dependencies = await Dependency.find({
      projectId: projObjectId,
      isDeleted: { $ne: true },
      fromTaskId: { $in: activeTaskIds },
      toTaskId: { $in: activeTaskIds }
    }).sort({ createdAt: 1 });

    res.json(dependencies);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching dependencies' });
  }
};

export const createDependency = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, fromTaskId, toTaskId, type, lag } = req.body;

    if (fromTaskId === toTaskId) {
      res.status(400).json({ message: 'A task cannot depend on itself' });
      return;
    }

    // Verify both tasks exist and belong to the project
    const [fromTask, toTask] = await Promise.all([
      Task.findOne({ _id: fromTaskId, projectId }),
      Task.findOne({ _id: toTaskId, projectId }),
    ]);

    if (!fromTask || !toTask) {
      res.status(404).json({ message: 'One or both tasks do not exist in this project' });
      return;
    }

    // Check duplicate
    const existing = await Dependency.findOne({ fromTaskId, toTaskId });
    if (existing) {
      res.status(400).json({ message: 'Dependency already exists between these tasks' });
      return;
    }

    // Deep transitive circular dependency check (e.g. A -> B -> C -> A)
    const hasPath = async (startId: string, targetId: string): Promise<boolean> => {
      const deps = await Dependency.find({ fromTaskId: startId });
      for (const dep of deps) {
        const nextId = String(dep.toTaskId);
        if (nextId === targetId) return true;
        if (await hasPath(nextId, targetId)) return true;
      }
      return false;
    };

    if (await hasPath(toTaskId, fromTaskId)) {
      res.status(400).json({ message: 'Circular dependency detected' });
      return;
    }

    const dependency = new Dependency({ projectId, fromTaskId, toTaskId, type, lag });
    await dependency.save();
    res.status(201).json(dependency);
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Error creating dependency' });
  }
};

export const updateDependency = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { type, lag } = req.body;

    const dependency = await Dependency.findByIdAndUpdate(
      id,
      { type, lag },
      { new: true, runValidators: true }
    );

    if (!dependency) {
      res.status(404).json({ message: 'Dependency not found' });
      return;
    }
    res.json(dependency);
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Error updating dependency' });
  }
};

export const deleteDependency = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const dependency = await Dependency.findByIdAndDelete(id);
    if (!dependency) {
      res.status(404).json({ message: 'Dependency not found' });
      return;
    }
    res.json({ message: 'Dependency deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error deleting dependency' });
  }
};
