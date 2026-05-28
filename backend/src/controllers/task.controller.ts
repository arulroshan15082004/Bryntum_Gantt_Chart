import { Request, Response } from 'express';
import { Task } from '../models/Task';
import { Dependency } from '../models/Dependency';
import { Resource } from '../models/Resource';
import { Types } from 'mongoose';
import { serializeTask, calculateDuration, formatDateOnly } from '../utils/dateHelper';

export const getTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, page, limit, parentId } = req.query;

    if (!projectId) {
      res.status(400).json({ message: 'projectId query parameter is required' });
      return;
    }

    const filter: any = { projectId: new Types.ObjectId(projectId as string), isDeleted: { $ne: true } };
    
    // Support filtering by parentId if provided
    if (parentId !== undefined) {
      filter.parentId = parentId === 'null' || parentId === '' ? null : new Types.ObjectId(parentId as string);
    }

    // Check if pagination is requested
    if (page && limit) {
      const pageNum = parseInt(page as string, 10) || 1;
      const limitNum = parseInt(limit as string, 10) || 50;
      const skip = (pageNum - 1) * limitNum;

      // Execute total count and paginated query in parallel
      const [tasks, total] = await Promise.all([
        Task.find(filter)
          .sort({ startDate: 1, name: 1 })
          .skip(skip)
          .limit(limitNum)
          .populate('resourceIds', 'name role email'),
        Task.countDocuments(filter),
      ]);

      res.json({
        tasks: tasks.map(serializeTask),
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      });
      return;
    }

    // If no pagination, fetch all tasks for Gantt chart or full hierarchical view
    const tasks = await Task.find(filter)
      .sort({ startDate: 1, name: 1 })
      .populate('resourceIds', 'name role email');
    res.json(tasks.map(serializeTask));
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching tasks' });
  }
};

export const createTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      projectId,
      name,
      description,
      parentId,
      startDate,
      endDate,
      duration,
      progress,
      priority,
      status,
      isMilestone,
      resourceIds,
    } = req.body;

    if (!name || !startDate || !endDate) {
      res.status(400).json({ message: 'Task name, startDate, and endDate are required' });
      return;
    }

    const startStr = formatDateOnly(startDate);
    const endStr = formatDateOnly(endDate);

    if (!startStr || !endStr) {
      res.status(400).json({ message: 'Task startDate and endDate must be valid dates' });
      return;
    }

    if (new Date(endStr) < new Date(startStr)) {
      res.status(400).json({ message: 'End date cannot be before start date' });
      return;
    }

    const parsedProgress = Math.min(100, Math.max(0, Number(progress) || 0));

    // Validate parent task if supplied
    let verifiedParentId = null;
    if (parentId) {
      const parentTask = await Task.findOne({ _id: parentId, isDeleted: { $ne: true } });
      if (!parentTask) {
        res.status(400).json({ message: 'Parent task not found' });
        return;
      }
      verifiedParentId = parentTask._id;
    }

    const task = new Task({
      projectId,
      name,
      description,
      parentId: verifiedParentId,
      startDate: startStr,
      endDate: endStr,
      duration: isMilestone ? 0 : calculateDuration(startStr, endStr),
      progress: parsedProgress,
      priority: priority || 'medium',
      status: status || 'todo',
      isMilestone: !!isMilestone,
      resourceIds: resourceIds || [],
    });

    await task.save();
    
    // Fetch populated task to return complete data
    const populated = await Task.findById(task._id).populate('resourceIds', 'name role email');
    res.status(201).json(serializeTask(populated));
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Error creating task' });
  }
};

export const getTaskById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const task = await Task.findOne({ _id: id, isDeleted: { $ne: true } }).populate('resourceIds', 'name role email');
    if (!task) {
      res.status(404).json({ message: 'Task not found' });
      return;
    }
    res.json(serializeTask(task));
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching task' });
  }
};

export const updateTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      parentId,
      startDate,
      endDate,
      duration,
      progress,
      priority,
      status,
      isMilestone,
      resourceIds,
    } = req.body;

    const task = await Task.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!task) {
      res.status(404).json({ message: 'Task not found' });
      return;
    }

    let startStr = task.startDate;
    let endStr = task.endDate;

    if (startDate !== undefined) startStr = formatDateOnly(startDate);
    if (endDate !== undefined) endStr = formatDateOnly(endDate);

    if (!startStr || !endStr) {
      res.status(400).json({ message: 'Task startDate and endDate must be valid dates' });
      return;
    }

    if (new Date(endStr) < new Date(startStr)) {
      res.status(400).json({ message: 'End date cannot be before start date' });
      return;
    }

    task.startDate = startStr;
    task.endDate = endStr;
    
    const milestone = isMilestone !== undefined ? !!isMilestone : task.isMilestone;
    task.duration = milestone ? 0 : calculateDuration(startStr, endStr);

    if (name !== undefined) task.name = name;
    if (description !== undefined) task.description = description;
    
    // Prevent setting self or descendant as parent
    if (parentId !== undefined) {
      if (parentId) {
        if (parentId.toString() === id.toString()) {
          res.status(400).json({ message: 'A task cannot be its own parent' });
          return;
        }

        const isDescendant = async (possibleChildId: string, possibleParentId: string): Promise<boolean> => {
          const child = await Task.findOne({ _id: possibleChildId, isDeleted: { $ne: true } });
          if (!child || !child.parentId) return false;
          if (child.parentId.toString() === possibleParentId) return true;
          return await isDescendant(child.parentId.toString(), possibleParentId);
        };

        if (await isDescendant(parentId as string, id as string)) {
          res.status(400).json({ message: 'Cyclical parent-child hierarchy detected. A task cannot have its descendant as a parent.' });
          return;
        }
      }
      task.parentId = parentId ? new Types.ObjectId(parentId as string) : null;
    }

    if (progress !== undefined) {
      task.progress = Math.min(100, Math.max(0, Number(progress) || 0));
      if (task.progress === 100) {
        task.status = 'done';
      } else if (task.progress > 0 && task.status === 'todo') {
        task.status = 'in_progress';
      } else if (task.progress === 0 && task.status === 'in_progress') {
        task.status = 'todo';
      }
    }

    if (status !== undefined) {
      task.status = status;
      if (status === 'done') {
        task.progress = 100;
      } else if (status === 'todo') {
        task.progress = 0;
      }
    }

    if (priority !== undefined) task.priority = priority;
    if (isMilestone !== undefined) task.isMilestone = !!isMilestone;
    if (resourceIds !== undefined) task.resourceIds = resourceIds;

    await task.save();
    
    const populated = await Task.findById(task._id).populate('resourceIds', 'name role email');
    res.json(serializeTask(populated));
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Error updating task' });
  }
};

export const bulkUpdateTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tasks } = req.body;
    if (!Array.isArray(tasks)) {
      res.status(400).json({ message: 'tasks array is required' });
      return;
    }

    if (tasks.length === 0) {
      res.json({ message: 'Successfully updated 0 tasks' });
      return;
    }

    // Fetch existing tasks in one query
    const taskIds = tasks.map((t: any) => new Types.ObjectId((t.id || t._id) as string));
    const existingTasks = await Task.find({ _id: { $in: taskIds }, isDeleted: { $ne: true } });
    const existingMap = new Map(existingTasks.map(et => [et._id.toString(), et]));

    const bulkOps = [];
    for (const t of tasks) {
      const id = String(t.id || t._id);
      const existing = existingMap.get(id);
      if (!existing) continue;

      const updateData: any = {};
      
      let startStr = existing.startDate;
      let endStr = existing.endDate;
      let milestone = existing.isMilestone;

      if (t.startDate !== undefined) startStr = formatDateOnly(t.startDate);
      if (t.endDate !== undefined) endStr = formatDateOnly(t.endDate);
      if (t.isMilestone !== undefined) milestone = !!t.isMilestone;

      if (new Date(endStr) < new Date(startStr)) {
        res.status(400).json({ message: `Validation Error in task "${t.name || existing.name}": End date cannot be before start date` });
        return;
      }

      updateData.startDate = startStr;
      updateData.endDate = endStr;
      updateData.isMilestone = milestone;
      updateData.duration = milestone ? 0 : calculateDuration(startStr, endStr);

      if (t.name !== undefined) updateData.name = t.name;
      if (t.description !== undefined) updateData.description = t.description;
      if (t.parentId !== undefined) updateData.parentId = t.parentId ? new Types.ObjectId(t.parentId as string) : null;
      if (t.progress !== undefined) updateData.progress = Number(t.progress);
      if (t.status !== undefined) updateData.status = t.status;
      if (t.priority !== undefined) updateData.priority = t.priority;
      if (t.resourceIds !== undefined) {
        updateData.resourceIds = t.resourceIds.map((rid: string) => new Types.ObjectId(rid));
      }

      // Mutual rollups for progress & status
      if (t.progress !== undefined && t.status === undefined) {
        const prog = Number(t.progress);
        if (prog === 100) {
          updateData.status = 'done';
        } else if (prog > 0) {
          updateData.status = 'in_progress';
        } else if (prog === 0) {
          updateData.status = 'todo';
        }
      }
      if (t.status !== undefined && t.progress === undefined) {
        if (t.status === 'done') {
          updateData.progress = 100;
        } else if (t.status === 'todo') {
          updateData.progress = 0;
        }
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: new Types.ObjectId(id) },
          update: { $set: updateData },
        }
      });
    }

    if (bulkOps.length > 0) {
      await Task.bulkWrite(bulkOps);
    }

    res.json({ message: `Successfully updated ${tasks.length} tasks` });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error bulk updating tasks' });
  }
};

export const deleteTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const taskObjectId = new Types.ObjectId(id as string);

    const task = await Task.findOneAndUpdate(
      { _id: taskObjectId, isDeleted: { $ne: true } },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true }
    );
    if (!task) {
      res.status(404).json({ message: 'Task not found' });
      return;
    }

    // Clean up: set parentId of subtasks to null (or delete subtasks recursively)
    await Task.updateMany({ parentId: taskObjectId }, { $set: { parentId: null } });

    // Soft-delete dependencies associated with this task
    await Dependency.updateMany(
      { $or: [{ fromTaskId: taskObjectId }, { toTaskId: taskObjectId }] },
      { $set: { isDeleted: true, deletedAt: new Date() } }
    );

    res.json({ message: 'Task deleted successfully. Subtask parent links and dependencies soft-cleared.' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error deleting task' });
  }
};

// Bulk CSV Import Controller
export const importTasksFromCSV = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { tasks: csvTasks } = req.body;

    if (!Array.isArray(csvTasks) || csvTasks.length === 0) {
      res.status(400).json({ message: 'Invalid bulk data. Must be a non-empty array of tasks.' });
      return;
    }

    const projId = new Types.ObjectId(projectId as string);

    // To process dependencies and parents correctly, we will pre-index existing/inserted tasks
    // First, let's validate and prepare standard task schemas
    console.log(`Ingesting ${csvTasks.length} tasks for project: ${projectId}`);

    // Standard task parsing in batch
    const parsedTasks = csvTasks.map((t: any) => {
      const startStr = formatDateOnly(t.startDate);
      const endStr = formatDateOnly(t.endDate);

      if (!t.name) {
        throw new Error('CSV Ingestion: Task name is required on all rows');
      }
      if (!startStr || !endStr) {
        throw new Error(`CSV Ingestion: Task "${t.name}" requires valid startDate and endDate`);
      }
      if (new Date(endStr) < new Date(startStr)) {
        throw new Error(`CSV Ingestion: Task "${t.name}" has end date before start date`);
      }

      const milestone = String(t.isMilestone).toLowerCase() === 'true';
      const dur = milestone ? 0 : calculateDuration(startStr, endStr);
      
      return {
        projectId: projId,
        name: t.name,
        description: t.description || '',
        parentId: null, // to be updated in a second pass if structured
        startDate: startStr,
        endDate: endStr,
        duration: dur,
        progress: Math.min(100, Math.max(0, Number(t.progress) || 0)),
        priority: (t.priority || 'medium').toLowerCase(),
        status: (t.status || 'todo').toLowerCase(),
        isMilestone: milestone,
        resourceIds: [],
        tempCsvId: t.id || t.tempCsvId || null, // temporary match identifier for parent hierarchies
        tempCsvParentId: t.parentId || t.tempCsvParentId || null,
        tempCsvDependencyIds: t.tempCsvDependencyIds || t.dependencyIds || t.predecessorIds || t.dependencies || null,
      };
    });

    // Ingest the tasks in bulk
    const insertedTasks = await Task.insertMany(parsedTasks);
    
    // Construct maps to wire up parent task structure based on temporary CSV identifiers
    const csvIdToMongoIdMap = new Map<string, Types.ObjectId>();
    insertedTasks.forEach((t: any, index: number) => {
      const original = parsedTasks[index];
      if (original.tempCsvId) {
        csvIdToMongoIdMap.set(String(original.tempCsvId), t._id as Types.ObjectId);
      }
    });

    // Bulk write updates to wire parentIds
    const bulkOps = [];
    const dependencyOps = [];

    for (let i = 0; i < insertedTasks.length; i++) {
      const original = parsedTasks[i];
      const inserted = insertedTasks[i];
      
      if (original.tempCsvParentId && csvIdToMongoIdMap.has(String(original.tempCsvParentId))) {
        bulkOps.push({
          updateOne: {
            filter: { _id: inserted._id },
            update: { $set: { parentId: csvIdToMongoIdMap.get(String(original.tempCsvParentId)) } },
          },
        });
      }

      if (original.tempCsvDependencyIds) {
        // Parse comma or semicolon separated predecessor CSV IDs
        const predecessors = String(original.tempCsvDependencyIds)
          .split(/[;,]/)
          .map(p => p.trim())
          .filter(Boolean);

        for (const predStr of predecessors) {
          const parts = predStr.split(':');
          const pred = parts[0].trim();
          const type = (parts[1]?.trim().toUpperCase() || 'FS') as 'FS' | 'SS' | 'FF' | 'SF';
          const lag = Number(parts[2]?.trim()) || 0;

          if (csvIdToMongoIdMap.has(pred)) {
            dependencyOps.push({
              projectId: projId,
              fromTaskId: csvIdToMongoIdMap.get(pred),
              toTaskId: inserted._id,
              type: type,
              lag: lag
            });
          }
        }
      }
    }

    if (bulkOps.length > 0) {
      await Task.bulkWrite(bulkOps);
    }

    if (dependencyOps.length > 0) {
      await Dependency.insertMany(dependencyOps);
    }

    // Rescheduling pass to relax dates based on dependency links
    const allTasks = await Task.find({ projectId: projId });
    const allDeps = await Dependency.find({ projectId: projId });

    const taskMap = new Map(allTasks.map(t => [t._id.toString(), t]));

    const addDaysBackend = (dateStr: string, days: number): string => {
      const d = new Date(dateStr);
      d.setDate(d.getDate() + days);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    let changed = true;
    let iterations = 0;
    const maxIterations = allTasks.length * 2;

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      for (const dep of allDeps) {
        const pred = taskMap.get(dep.fromTaskId.toString());
        const succ = taskMap.get(dep.toTaskId.toString());

        if (pred && succ) {
          const type = dep.type;
          const lag = Number(dep.lag) || 0;
          const duration = succ.duration || 0;

          let expectedSuccStart = succ.startDate;
          let expectedSuccEnd = succ.endDate;

          if (type === 'FS') {
            const minStart = addDaysBackend(pred.endDate, lag);
            if (new Date(succ.startDate) < new Date(minStart)) {
              expectedSuccStart = minStart;
              expectedSuccEnd = addDaysBackend(minStart, duration);
            }
          } else if (type === 'SS') {
            const minStart = addDaysBackend(pred.startDate, lag);
            if (new Date(succ.startDate) < new Date(minStart)) {
              expectedSuccStart = minStart;
              expectedSuccEnd = addDaysBackend(minStart, duration);
            }
          } else if (type === 'FF') {
            const minEnd = addDaysBackend(pred.endDate, lag);
            if (new Date(succ.endDate) < new Date(minEnd)) {
              expectedSuccEnd = minEnd;
              expectedSuccStart = addDaysBackend(minEnd, -duration);
            }
          } else if (type === 'SF') {
            const minEnd = addDaysBackend(pred.startDate, lag);
            if (new Date(succ.endDate) < new Date(minEnd)) {
              expectedSuccEnd = minEnd;
              expectedSuccStart = addDaysBackend(minEnd, -duration);
            }
          }

          if (expectedSuccStart !== succ.startDate || expectedSuccEnd !== succ.endDate) {
            succ.startDate = expectedSuccStart;
            succ.endDate = expectedSuccEnd;
            changed = true;
          }
        }
      }
    }

    if (iterations > 1) {
      const saveOps = allTasks.map(t => ({
        updateOne: {
          filter: { _id: t._id },
          update: { $set: { startDate: t.startDate, endDate: t.endDate } }
        }
      }));
      await Task.bulkWrite(saveOps);
    }

    res.status(201).json({
      message: `Successfully imported ${csvTasks.length} tasks and resolved dependency links and hierarchy loops.`,
      count: csvTasks.length,
    });
  } catch (error: any) {
    console.error('Error in bulk import:', error);
    res.status(500).json({ message: error.message || 'Error processing CSV bulk upload' });
  }
};

export const getDeletedTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.query;
    if (!projectId) {
      res.status(400).json({ message: 'projectId query parameter is required' });
      return;
    }
    const tasks = await Task.find({ projectId: new Types.ObjectId(projectId as string), isDeleted: true })
      .sort({ deletedAt: -1 })
      .populate('resourceIds', 'name role email');
    res.json(tasks.map(serializeTask));
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching deleted tasks' });
  }
};

export const restoreTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const taskObjectId = new Types.ObjectId(id as string);

    const task = await Task.findOneAndUpdate(
      { _id: taskObjectId, isDeleted: true },
      { $set: { isDeleted: false }, $unset: { deletedAt: "" } },
      { new: true }
    );
    if (!task) {
      res.status(404).json({ message: 'Task not found' });
      return;
    }

    // Restore dependencies if both tasks are active
    const deps = await Dependency.find({
      $and: [
        { $or: [{ fromTaskId: taskObjectId }, { toTaskId: taskObjectId }] },
        { isDeleted: true }
      ]
    });

    for (const dep of deps) {
      const otherTaskId = dep.fromTaskId.toString() === id ? dep.toTaskId : dep.fromTaskId;
      const otherTask = await Task.findOne({ _id: otherTaskId, isDeleted: { $ne: true } });
      if (otherTask) {
        dep.isDeleted = false;
        dep.deletedAt = undefined;
        await dep.save();
      }
    }

    const populated = await Task.findById(task._id).populate('resourceIds', 'name role email');
    res.json(serializeTask(populated));
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error restoring task' });
  }
};

export const permanentlyDeleteTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const taskObjectId = new Types.ObjectId(id as string);

    const task = await Task.findOneAndDelete({ _id: taskObjectId });
    if (!task) {
      res.status(404).json({ message: 'Task not found' });
      return;
    }

    // Permanently remove dependencies connected to this task
    await Dependency.deleteMany({
      $or: [{ fromTaskId: taskObjectId }, { toTaskId: taskObjectId }],
    });

    res.json({ message: 'Task and associated dependencies permanently deleted.' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error permanently deleting task' });
  }
};
