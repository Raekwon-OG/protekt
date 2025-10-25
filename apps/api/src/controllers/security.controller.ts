/**
 * Security controller: delegates scanning/ingestion to service and persists results.
 */
import { PrismaClient } from '@prisma/client';
import { securityService } from '../services/security.service';

const prisma = new PrismaClient();

export const scanUrl = async (url: string) => {
  return securityService.checkUrlReputation(url);
};

export const ingestEmail = async (
  payload: {
    from?: string;
    subject?: string;
    text?: string;
    urls?: string[];
    attachments?: { name: string; buffer: Buffer }[];
  },
  options?: { orgId?: string | null; userId?: string | null }
) => {
  const safePayload = {
    ...payload,
    urls: payload.urls || [],
    attachments: payload.attachments || [],
  };

  // Run the scans (service handles static checks + external APIs)
  const summary = await securityService.ingestEmail(safePayload);

  // Prepare DB record (only include org/user context provided by server side)
  const createData: any = {
    from: safePayload.from ?? 'unknown',
    subject: safePayload.subject ?? 'No subject',
    text: safePayload.text ?? '',
    urls: safePayload.urls,
    verdictSummary: summary.phishingDetected > 0 ? 'Phishing' : 'Clean',
    phishingCount: summary.phishingDetected,
    details: summary.details ?? [],
  };

  if (options?.orgId) createData.orgId = options.orgId;
  if (options?.userId) createData.createdByUserId = options.userId;

  try {
    // Persist scan log; ignore errors so ingestion remains resilient
    // Assumes prisma schema includes model EmailScanLog with suitable fields (urls Json, details Json)
    // Adjust field names if your Prisma model differs.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    prisma.emailScanLog.create({ data: createData }).catch((e) => {
      // eslint-disable-next-line no-console
      console.error('Failed to save email scan log (non-fatal):', e);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Unexpected error saving email scan log:', err);
  }

  return summary;
};

/**
 * Returns recent email scan logs. `opts.orgId` is applied to limit to an org when present.
 * Pagination supported via page & limit.
 */
export const getEmailScanLogs = async (opts?: { page?: number; limit?: number; orgId?: string | null }) => {
  const page = Math.max(1, opts?.page ?? 1);
  const take = Math.min(200, opts?.limit ?? 50);
  const skip = (page - 1) * take;

  const where: any = {};
  if (opts?.orgId) where.orgId = opts.orgId;

  const rows = await prisma.emailScanLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take,
    skip,
  });

  return rows;
};
