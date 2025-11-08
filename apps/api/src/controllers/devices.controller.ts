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
  const user = (req as any).user;
  const { device, token } = await svc.createDeviceWithToken(user.userId, orgId, { name, type });
  const apiUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 4000}`;
  res.status(201).json({ device: { id: device.id, name: device.name, orgId: device.orgId }, connection: { deviceId: device.id, orgId: device.orgId, token, apiUrl } });
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

// Revoke a device (set revoked=true)
export const revokeDevice = async (orgId: string, deviceId: string) => {
  const result = await svc.revokeDevice(orgId, deviceId);
  return result.count > 0;
};

// Device registration endpoint (public, no auth required)
export const registerDevice = async (req: Request, res: Response) => {
  try {
    const { device_id, device_name, device_type, org_id, api_key } = req.body;
    
    if (!device_id) {
      return res.status(400).json({ error: 'Missing device_id' });
    }
    
    // If org_id and api_key provided, verify them
    // For now, we'll allow registration with or without org context
    const orgId = org_id || (req as any).user?.orgId || null;
    
    // Create or update device
    const device = await svc.registerDevice({
      device_id,
      device_name: device_name || 'ProtektAgent',
      device_type: device_type || 'windows',
      org_id: orgId,
      api_key: api_key || null
    });
    
    res.status(200).json({
      device_id: device.id,
      org_id: device.orgId,
      status: 'registered',
      registered_at: device.createdAt
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Registration failed' });
  }
};

// Heartbeat endpoint (requires device token or api_key)
export const heartbeat = async (req: Request, res: Response) => {
  try {
    const deviceId = req.body.device_id;
    if (!deviceId) {
      return res.status(400).json({ error: 'Missing device_id' });
    }
    
    // Update device status and last seen
    await svc.updateDeviceHeartbeat(deviceId, req.body);
    
    res.status(200).json({ 
      status: 'received',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Heartbeat failed' });
  }
};