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