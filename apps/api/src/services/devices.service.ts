import * as dbModule from '../utils/db';
// support both `export const prisma = ...` and `export default prisma`
const prisma = (dbModule as any).prisma ?? (dbModule as any).default ?? dbModule;

export const listDevicesForOrg = async (orgId: string) => {
  return prisma.device.findMany({ where: { orgId }, orderBy: { createdAt: 'desc' } });
};

export const createDeviceForOrg = async (orgId: string, data: { name: string; type: string; status?: string }) => {
  return prisma.device.create({
    data: {
      orgId,
      name: data.name,
      type: data.type,
      status: data.status ?? 'Offline',
    },
  });
};

export const getDevice = async (orgId: string, id: string) => {
  return prisma.device.findFirst({ where: { id, orgId } });
};

export const updateDevice = async (orgId: string, id: string, patch: any) => {
  return prisma.device.updateMany({ where: { id, orgId }, data: patch });
};

export const deleteDevice = async (orgId: string, id: string) => {
  return prisma.device.deleteMany({ where: { id, orgId } });
};

// Register a device (create or update)
export const registerDevice = async (data: {
  device_id: string;
  device_name: string;
  device_type: string;
  org_id: string | null;
  api_key: string | null;
}) => {
  // Try to find existing device
  const existing = await prisma.device.findUnique({ where: { id: data.device_id } });
  
  if (existing) {
    // Update existing device
    return prisma.device.update({
      where: { id: data.device_id },
      data: {
        name: data.device_name,
        type: data.device_type,
        orgId: data.org_id || existing.orgId,
        status: 'Online',
        lastSeen: new Date(),
      },
    });
  } else {
    // Create new device
    if (!data.org_id) {
      throw new Error('org_id is required for new device registration');
    }
    
    return prisma.device.create({
      data: {
        id: data.device_id,
        orgId: data.org_id,
        name: data.device_name,
        type: data.device_type,
        status: 'Online',
        lastSeen: new Date(),
      },
    });
  }
};

// Update device heartbeat
export const updateDeviceHeartbeat = async (deviceId: string, telemetryData: any) => {
  // Extract key metrics from telemetry
  const cpuPercent = telemetryData?.cpu?.percent || 0;
  const memoryPercent = telemetryData?.memory?.percent || 0;
  
  // Determine risk level based on metrics
  let risk = 'Low';
  if (cpuPercent > 90 || memoryPercent > 90) {
    risk = 'Critical';
  } else if (cpuPercent > 80 || memoryPercent > 80) {
    risk = 'Medium';
  }
  
  return prisma.device.updateMany({
    where: { id: deviceId },
    data: {
      status: 'Online',
      lastSeen: new Date(),
      risk,
    },
  });
};