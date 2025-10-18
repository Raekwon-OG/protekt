// filepath: apps/api/src/controllers/security.controller.ts
/**
 * Security controller: handles URL scan and inbound email ingestion.
 */
import { securityService } from '../services/security.service';

export const scanUrl = async (url: string) => {
  const verdict = await securityService.checkUrlReputation(url);
  return verdict;
};

export const ingestEmail = async (payload: {
  from?: string;
  subject?: string;
  text?: string;
  urls?: string[];
  attachments?: any[];
}) => {
  const summary = await securityService.ingestEmail(payload);
  return summary;
};
