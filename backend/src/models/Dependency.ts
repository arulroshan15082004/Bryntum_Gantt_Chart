import { Schema, model, Document, Types } from 'mongoose';

export interface IDependency extends Document {
  projectId: Types.ObjectId;
  fromTaskId: Types.ObjectId;
  toTaskId: Types.ObjectId;
  type: 'FS' | 'SS' | 'FF' | 'SF';
  lag: number; // in days
  isDeleted: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const DependencySchema = new Schema<IDependency>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    fromTaskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    toTaskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    type: {
      type: String,
      enum: ['FS', 'SS', 'FF', 'SF'],
      required: true,
      default: 'FS',
    },
    lag: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
  }
);

// Compound index to avoid duplicate dependencies between same tasks
DependencySchema.index({ fromTaskId: 1, toTaskId: 1 }, { unique: true });

export const Dependency = model<IDependency>('Dependency', DependencySchema);
