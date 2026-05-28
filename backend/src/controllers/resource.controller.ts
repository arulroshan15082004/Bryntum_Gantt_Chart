import { Request, Response } from 'express';
import { Resource } from '../models/Resource';
import { Task } from '../models/Task';
import { Types } from 'mongoose';

export const getResources = async (req: Request, res: Response): Promise<void> => {
  try {
    const resources = await Resource.find().sort({ name: 1 });
    res.json(resources);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching resources' });
  }
};

export const createResource = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, role, email, availability } = req.body;
    const existing = await Resource.findOne({ email: email?.toLowerCase() });
    if (existing) {
      res.status(400).json({ message: 'Resource with this email already exists' });
      return;
    }
    const resource = new Resource({
      name,
      role,
      email: email?.toLowerCase(),
      availability,
    });
    await resource.save();
    res.status(201).json(resource);
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Error creating resource' });
  }
};

export const updateResource = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, role, email, availability } = req.body;
    
    // Check email uniqueness if email is being updated
    if (email) {
      const existing = await Resource.findOne({
        email: email.toLowerCase(),
        _id: { $ne: id },
      });
      if (existing) {
        res.status(400).json({ message: 'Resource with this email already exists' });
        return;
      }
    }

    const resource = await Resource.findByIdAndUpdate(
      id,
      { name, role, email: email?.toLowerCase(), availability },
      { new: true, runValidators: true }
    );

    if (!resource) {
      res.status(404).json({ message: 'Resource not found' });
      return;
    }
    res.json(resource);
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Error updating resource' });
  }
};

export const deleteResource = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const resource = await Resource.findByIdAndDelete(id);
    if (!resource) {
      res.status(404).json({ message: 'Resource not found' });
      return;
    }
    // Pull the deleted resource ID from all Tasks resourceIds arrays
    await Task.updateMany(
      { resourceIds: new Types.ObjectId(id as string) as any },
      { $pull: { resourceIds: new Types.ObjectId(id as string) as any } }
    );
    res.json({ message: 'Resource deleted and references removed from tasks' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error deleting resource' });
  }
};
