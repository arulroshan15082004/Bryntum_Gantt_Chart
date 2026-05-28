import { Schema, model, Document } from 'mongoose';

export interface IProject extends Document {
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    name: { type: String, required: true, trim: true, index: true },
    description: { type: String, trim: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    status: {
      type: String,
      enum: ['planning', 'active', 'on_hold', 'completed'],
      default: 'planning',
    },
  },
  {
    timestamps: true,
  }
);

export const Project = model<IProject>('Project', ProjectSchema);
