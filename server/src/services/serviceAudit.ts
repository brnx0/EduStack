import { create, readCollection } from './jsonStorage.js';

const COLLECTION = 'service-actions';

export type ServiceActionRecord = {
  id: number;
  criadoEm: string;
  userId: string | number | null;
  userLogin: string;
  serverId: number;
  serverName: string;
  service: string;
  action: string;
  success: boolean;
  message: string;
};

export function recordAction(entry: Omit<ServiceActionRecord, 'id' | 'criadoEm'>): ServiceActionRecord {
  return create(COLLECTION, entry) as ServiceActionRecord;
}

export function listActions(limit = 50): ServiceActionRecord[] {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 50, 1), 200);
  return (readCollection(COLLECTION) as ServiceActionRecord[]).slice(-safeLimit).reverse();
}
