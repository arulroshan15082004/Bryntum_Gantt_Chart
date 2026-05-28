import { Schema, model, Document } from 'mongoose';

export interface IResource extends Document {
  name: string;
  role?: string;
  email: string;
  availability: number; // e.g. 100 for 100% full time
  createdAt: Date;
  updatedAt: Date;
}

const ResourceSchema = new Schema<IResource>(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    availability: { type: Number, required: true, min: 0, max: 100, default: 100 },
  },
  {
    timestamps: true,
  }
);

export const Resource = model<IResource>('Resource', ResourceSchema);
