import { Schema, model, Document, Types } from 'mongoose';

export interface ITask extends Document {
  projectId: Types.ObjectId;
  name: string;
  description?: string;
  parentId?: Types.ObjectId | null;
  startDate: string;
  endDate: string;
  duration: number; // in days
  progress: number; // 0 to 100
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done';
  isMilestone: boolean;
  resourceIds: Types.ObjectId[];
  isDeleted?: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'Task', default: null, index: true },
    startDate: { type: String, required: true, index: true },
    endDate: { type: String, required: true, index: true },
    duration: { type: Number, required: true, default: 1 },
    progress: { type: Number, required: true, min: 0, max: 100, default: 0 },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['todo', 'in_progress', 'done'],
      default: 'todo',
    },
    isMilestone: { type: Boolean, default: false },
    resourceIds: [{ type: Schema.Types.ObjectId, ref: 'Resource' }],
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Explicitly ensure compound or single indexes are created
TaskSchema.index({ projectId: 1, parentId: 1 });
TaskSchema.index({ projectId: 1, startDate: 1, endDate: 1 });

export const Task = model<ITask>('Task', TaskSchema);
