import { Project } from '../models/Project';
import { Task } from '../models/Task';
import { Dependency } from '../models/Dependency';
import { Resource } from '../models/Resource';
import { Types } from 'mongoose';
import { formatDateOnly, calculateDuration } from '../utils/dateHelper';

export const resolvers = {
  Query: {
    getProjects: async () => {
      return await Project.find().sort({ createdAt: -1 });
    },
    getTasks: async (_: any, { projectId, page, limit }: { projectId: string; page?: number; limit?: number }) => {
      const filter = { projectId: new Types.ObjectId(projectId), isDeleted: { $ne: true } };

      if (page && limit) {
        const skip = (page - 1) * limit;
        const [tasks, total] = await Promise.all([
          Task.find(filter).sort({ startDate: 1 }).skip(skip).limit(limit),
          Task.countDocuments(filter),
        ]);

        return {
          tasks,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        };
      }

      const tasks = await Task.find(filter).sort({ startDate: 1 });
      return {
        tasks,
        total: tasks.length,
        page: 1,
        limit: tasks.length,
        totalPages: 1,
      };
    },
    getDeletedTasks: async (_: any, { projectId }: { projectId: string }) => {
      return await Task.find({ projectId: new Types.ObjectId(projectId), isDeleted: true }).sort({ deletedAt: -1 });
    },
    getDependencies: async (_: any, { projectId }: { projectId: string }) => {
      const projObjectId = new Types.ObjectId(projectId);
      
      // Fetch only active tasks for the project
      const activeTasks = await Task.find({
        projectId: projObjectId,
        isDeleted: { $ne: true }
      }).select('_id');
      const activeTaskIds = activeTasks.map(t => t._id);

      // Only return active dependencies between active tasks
      return await Dependency.find({
        projectId: projObjectId,
        isDeleted: { $ne: true },
        fromTaskId: { $in: activeTaskIds },
        toTaskId: { $in: activeTaskIds }
      }).sort({ createdAt: 1 });
    },
    getResources: async () => {
      return await Resource.find().sort({ name: 1 });
    },
  },

  Mutation: {
    createProject: async (_: any, args: any) => {
      const { name } = args;
      if (name) {
        const existing = await Project.findOne({ name: { $regex: new RegExp('^' + name.trim() + '$', 'i') } });
        if (existing) {
          throw new Error('Project with this name already exists');
        }
      }
      const project = new Project(args);
      return await project.save();
    },
    updateProject: async (_: any, { id, ...args }: any) => {
      const { name } = args;
      if (name) {
        const existing = await Project.findOne({
          name: { $regex: new RegExp('^' + name.trim() + '$', 'i') },
          _id: { $ne: id }
        });
        if (existing) {
          throw new Error('Project with this name already exists');
        }
      }
      const updated = await Project.findByIdAndUpdate(id, args, { new: true, runValidators: true });
      if (!updated) throw new Error('Project not found');
      return updated;
    },
    deleteProject: async (_: any, { id }: { id: string }) => {
      const project = await Project.findByIdAndDelete(id);
      if (!project) throw new Error('Project not found');

      // Cascade delete tasks and dependencies
      await Task.deleteMany({ projectId: new Types.ObjectId(id) });
      await Dependency.deleteMany({ projectId: new Types.ObjectId(id) });

      return 'Project and all associated tasks and dependencies deleted successfully.';
    },

    createTask: async (_: any, args: any) => {
      const { startDate, endDate, parentId, progress, isMilestone } = args;

      const startStr = formatDateOnly(startDate);
      const endStr = formatDateOnly(endDate);

      if (!startStr || !endStr) {
        throw new Error('startDate and endDate are required');
      }

      if (new Date(endStr) < new Date(startStr)) {
        throw new Error('End date cannot be before start date');
      }

      let verifiedParentId = null;
      if (parentId) {
        const parent = await Task.findOne({ _id: parentId, isDeleted: { $ne: true } });
        if (!parent) throw new Error('Parent task not found');
        verifiedParentId = parent._id;
      }

      const task = new Task({
        ...args,
        parentId: verifiedParentId,
        startDate: startStr,
        endDate: endStr,
        duration: isMilestone ? 0 : calculateDuration(startStr, endStr),
        progress: progress !== undefined ? Math.min(100, Math.max(0, progress)) : 0,
      });

      return await task.save();
    },

    updateTask: async (_: any, { id, ...args }: any) => {
      const task = await Task.findOne({ _id: id, isDeleted: { $ne: true } });
      if (!task) throw new Error('Task not found');

      let startStr = task.startDate;
      let endStr = task.endDate;

      if (args.startDate !== undefined) startStr = formatDateOnly(args.startDate);
      if (args.endDate !== undefined) endStr = formatDateOnly(args.endDate);

      if (!startStr || !endStr) {
        throw new Error('startDate and endDate must be valid dates');
      }

      if (new Date(endStr) < new Date(startStr)) {
        throw new Error('End date cannot be before start date');
      }

      task.startDate = startStr;
      task.endDate = endStr;
      
      const milestone = args.isMilestone !== undefined ? !!args.isMilestone : task.isMilestone;
      task.duration = milestone ? 0 : calculateDuration(startStr, endStr);

      if (args.name !== undefined) task.name = args.name;
      if (args.description !== undefined) task.description = args.description;
      
      if (args.parentId !== undefined) {
        if (args.parentId) {
          if (args.parentId === id) {
            throw new Error('A task cannot be its own parent');
          }

          const isDescendant = async (possibleChildId: string, possibleParentId: string): Promise<boolean> => {
            const child = await Task.findOne({ _id: possibleChildId, isDeleted: { $ne: true } });
            if (!child || !child.parentId) return false;
            if (child.parentId.toString() === possibleParentId) return true;
            return await isDescendant(child.parentId.toString(), possibleParentId);
          };

          if (await isDescendant(args.parentId, id)) {
            throw new Error('Cyclical parent-child hierarchy detected. A task cannot have its descendant as a parent.');
          }
        }
        task.parentId = args.parentId ? new Types.ObjectId(args.parentId) : null;
      }

      // Smart progress/status rollups for GraphQL updates as well!
      if (args.progress !== undefined) {
        task.progress = Math.min(100, Math.max(0, args.progress));
        if (task.progress === 100) {
          task.status = 'done';
        } else if (task.progress > 0 && task.status === 'todo') {
          task.status = 'in_progress';
        } else if (task.progress === 0 && task.status === 'in_progress') {
          task.status = 'todo';
        }
      }

      if (args.status !== undefined) {
        task.status = args.status;
        if (args.status === 'done') {
          task.progress = 100;
        } else if (args.status === 'todo') {
          task.progress = 0;
        }
      }

      if (args.priority !== undefined) task.priority = args.priority;
      if (args.isMilestone !== undefined) task.isMilestone = args.isMilestone;
      if (args.resourceIds !== undefined) task.resourceIds = args.resourceIds;

      return await task.save();
    },

    deleteTask: async (_: any, { id }: { id: string }) => {
      const taskObjectId = new Types.ObjectId(id);
      const task = await Task.findOneAndUpdate(
        { _id: taskObjectId, isDeleted: { $ne: true } },
        { $set: { isDeleted: true, deletedAt: new Date() } },
        { new: true }
      );
      if (!task) throw new Error('Task not found');

      // Clear parent relationships
      await Task.updateMany({ parentId: taskObjectId }, { $set: { parentId: null } });

      // Soft delete dependencies
      await Dependency.updateMany(
        {
          $or: [
            { fromTaskId: taskObjectId },
            { toTaskId: taskObjectId },
          ],
        },
        { $set: { isDeleted: true, deletedAt: new Date() } }
      );

      return 'Task soft-deleted successfully.';
    },

    restoreTask: async (_: any, { id }: { id: string }) => {
      const taskObjectId = new Types.ObjectId(id);
      const task = await Task.findOneAndUpdate(
        { _id: taskObjectId, isDeleted: true },
        { $set: { isDeleted: false }, $unset: { deletedAt: "" } },
        { new: true }
      );
      if (!task) throw new Error('Task not found');

      // Restore dependencies connected to this task where the other end is also active
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

      return task;
    },

    permanentlyDeleteTask: async (_: any, { id }: { id: string }) => {
      const taskObjectId = new Types.ObjectId(id);
      const task = await Task.findOneAndDelete({ _id: taskObjectId });
      if (!task) throw new Error('Task not found');

      // Permanently remove dependencies connected to this task
      await Dependency.deleteMany({
        $or: [
          { fromTaskId: taskObjectId },
          { toTaskId: taskObjectId },
        ],
      });

      return 'Task permanently deleted.';
    },

    createDependency: async (_: any, args: any) => {
      const { projectId, fromTaskId, toTaskId, type, lag } = args;

      if (fromTaskId === toTaskId) {
        throw new Error('A task cannot depend on itself');
      }

      const fromTask = await Task.findOne({ _id: fromTaskId, isDeleted: { $ne: true } });
      const toTask = await Task.findOne({ _id: toTaskId, isDeleted: { $ne: true } });
      if (!fromTask || !toTask) {
        throw new Error('Task not found or has been deleted');
      }

      const existing = await Dependency.findOne({ fromTaskId, toTaskId });
      if (existing) {
        throw new Error('Dependency already exists between these tasks');
      }

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
        throw new Error('Circular dependency detected');
      }

      const dependency = new Dependency({
        projectId: new Types.ObjectId(projectId),
        fromTaskId: new Types.ObjectId(fromTaskId),
        toTaskId: new Types.ObjectId(toTaskId),
        type,
        lag: lag || 0
      });

      return await dependency.save();
    },

    updateDependency: async (_: any, { id, type, lag }: any) => {
      const updateData: any = {};
      if (type !== undefined) updateData.type = type;
      if (lag !== undefined) updateData.lag = lag;

      const dependency = await Dependency.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!dependency) throw new Error('Dependency not found');
      return dependency;
    },

    deleteDependency: async (_: any, { id }: { id: string }) => {
      const dependency = await Dependency.findByIdAndDelete(id);
      if (!dependency) throw new Error('Dependency not found');
      return 'Dependency cleared successfully.';
    },

    createResource: async (_: any, { name, role, email, availability }: any) => {
      const existing = await Resource.findOne({ email: email?.toLowerCase() });
      if (existing) {
        throw new Error('Resource with this email already exists');
      }
      const resource = new Resource({
        name,
        role,
        email: email?.toLowerCase(),
        availability,
      });
      return await resource.save();
    },

    updateResource: async (_: any, { id, name, role, email, availability }: any) => {
      if (email) {
        const existing = await Resource.findOne({
          email: email.toLowerCase(),
          _id: { $ne: id },
        });
        if (existing) {
          throw new Error('Resource with this email already exists');
        }
      }
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (role !== undefined) updateData.role = role;
      if (email !== undefined) updateData.email = email.toLowerCase();
      if (availability !== undefined) updateData.availability = availability;

      const resource = await Resource.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );
      if (!resource) throw new Error('Resource not found');
      return resource;
    },

    deleteResource: async (_: any, { id }: { id: string }) => {
      const resource = await Resource.findByIdAndDelete(id);
      if (!resource) throw new Error('Resource not found');
      // Pull the deleted resource ID from all Tasks resourceIds arrays
      await Task.updateMany(
        { resourceIds: new Types.ObjectId(id) as any },
        { $pull: { resourceIds: new Types.ObjectId(id) as any } }
      );
      return 'Resource deleted and references removed from tasks';
    },
  },

  Task: {
    resources: async (task: any) => {
      if (!task.resourceIds || task.resourceIds.length === 0) return [];
      return await Resource.find({ _id: { $in: task.resourceIds } });
    },
    startDate: (task: any) => {
      return formatDateOnly(task.startDate);
    },
    endDate: (task: any) => {
      return formatDateOnly(task.endDate);
    },
    duration: (task: any) => {
      return calculateDuration(task.startDate, task.endDate);
    }
  },
};
