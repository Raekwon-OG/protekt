import { Request, Response } from 'express';
import * as svc from '../services/devices.service';

export const listDevices = async (req: Request, res: Response) => {
  const orgId = (req as any).orgId as string;
  const devices = await svc.listDevicesForOrg(orgId);
  res.json(devices);
};

export const createDevice = async (req: Request, res: Response) => {
  const orgId = (req as any).orgId as string;
  const { name, type } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing name' });
  const device = await svc.createDeviceForOrg(orgId, { name, type });
  res.status(201).json(device);
};

export const getDevice = async (req: Request, res: Response) => {
  const orgId = (req as any).orgId as string;
  const { id } = req.params;
  const device = await svc.getDevice(orgId, id);
  if (!device) return res.status(404).json({ error: 'Not found' });
  res.json(device);
};

export const patchDevice = async (req: Request, res: Response) => {
  const orgId = (req as any).orgId as string;
  const { id } = req.params;
  const result = await svc.updateDevice(orgId, id, req.body);
  res.json({ updated: result.count ?? 0 });
};

export const removeDevice = async (req: Request, res: Response) => {
  const orgId = (req as any).orgId as string;
  const { id } = req.params;
  const result = await svc.deleteDevice(orgId, id);
  res.json({ deleted: result.count ?? 0 });
};