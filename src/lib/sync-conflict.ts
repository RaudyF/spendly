/**
 * Device Conflict Resolution, Universal Deduplication & Sync Metadata Engine
 * 
 * Guarantees that all entities contain:
 * 1. userId
 * 2. createdAt
 * 3. updatedAt
 * 4. deletedAt (optional / null)
 * 5. source (normalized origin)
 * 6. sourceId (unique client event/transaction id)
 * 7. idempotencyKey (optional explicit deduplication key)
 * 8. gmailMessageId (prepared for Gmail integration)
 * 
 * Provides granular record-by-record reconciliation (LWW - Last-Write-Wins)
 * and universal deduplication without replacing complete blocks or wiping unrelated information.
 */

export type NormalizedOrigin =
  | 'manual'
  | 'salary'
  | 'obligation'
  | 'gmail'
  | 'import'
  | 'system'
  | 'rollover'
  | 'recurring';

export interface SyncEntityMetadata {
  userId?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  source?: string;
  sourceId?: string;
  idempotencyKey?: string;
  gmailMessageId?: string;
  financialPeriod?: string;
}

/**
 * Normalize source origin to standard set
 */
export function normalizeOrigin(source?: string): NormalizedOrigin {
  if (!source) return 'manual';
  const s = source.toLowerCase().trim();
  if (s.includes('salary') || s.includes('nomina') || s.includes('nómina') || s.includes('sueldo')) return 'salary';
  if (s.includes('obligation') || s.includes('obligacion') || s.includes('obligación') || s.includes('bill')) return 'obligation';
  if (s.includes('gmail') || s.includes('email') || s.includes('mail')) return 'gmail';
  if (s.includes('import') || s.includes('csv') || s.includes('excel') || s.includes('file')) return 'import';
  if (s.includes('rollover') || s.includes('arrastre') || s.includes('carry')) return 'rollover';
  if (s.includes('recurring') || s.includes('recurren') || s.includes('template')) return 'recurring';
  if (s.includes('system') || s.includes('auto') || s.includes('closing') || s.includes('cierre')) return 'system';
  return 'manual';
}

/**
 * Detect client device source descriptor
 */
export function getClientSource(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    const ua = navigator.userAgent || '';
    if (/android/i.test(ua)) return 'phone-android';
    if (/iphone|ipad|ipod/i.test(ua)) return 'phone-ios';
    if (/mobile/i.test(ua)) return 'phone-mobile';
    return 'desktop-web';
  } catch {
    return 'web-client';
  }
}

/**
 * Generate a unique sourceId / event idempotency identifier
 */
export function generateSourceId(prefix: string = 'tx'): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${ts}_${rand}`;
}

/**
 * Compute the deduplication key for a record.
 * Rules:
 * - If explicit idempotencyKey exists -> use it scoped by userId
 * - If gmailMessageId exists -> use it scoped by userId
 * - If imported with stable sourceId -> use it scoped by userId
 * - If salary payment -> scoped by userId + period + cycle + type
 * - If recurring obligation template instance -> scoped by userId + templateId + period
 * - If rollover -> scoped by userId + srcPeriod + srcCycle + destPeriod + destCycle
 * - Otherwise (manual movements) -> unique record `id` ONLY.
 *   (NEVER deduplicate solely on amount + date!)
 */
export function getRecordDeduplicationKey(record: any): string {
  if (!record) return '';
  const userId = record.userId || '';

  // 1. Explicit idempotency key
  if (record.idempotencyKey && String(record.idempotencyKey).trim()) {
    return `idemp:${userId}:${String(record.idempotencyKey).trim()}`;
  }

  // 2. Gmail message ID
  if (record.gmailMessageId && String(record.gmailMessageId).trim()) {
    return `gmail:${userId}:${String(record.gmailMessageId).trim()}`;
  }

  // 3. Import with stable source ID
  const origin = normalizeOrigin(record.source);
  if (origin === 'import' && record.sourceId && String(record.sourceId).trim()) {
    return `import:${userId}:${String(record.sourceId).trim()}`;
  }

  // 4. Salary confirmation deduplication
  if (origin === 'salary' && record.type === 'salary') {
    const period = (record.date || record.financialPeriod || '').substring(0, 7);
    const cycle = record.payCycle || 'MONTHLY';
    if (period) {
      return `salary:${userId}:${period}:${cycle}:salary`;
    }
  }

  // 5. Recurring obligation instance deduplication
  if (record.templateId && record.period) {
    return `recurring_inst:${userId}:${record.templateId}:${record.period}`;
  }

  // 6. Period rollover deduplication
  if (record.sourcePeriod && record.destinationPeriod) {
    return `rollover:${userId}:${record.sourcePeriod}:${record.sourceCycle || 'MONTHLY'}:${record.destinationPeriod}:${record.destinationCycle || 'MONTHLY'}`;
  }

  // 7. Default: Unique Record ID
  return `id:${userId}:${record.id || ''}`;
}

/**
 * Merge two records, preserving the more recent timestamp (LWW)
 * and retaining any non-null fields so no richer data is lost.
 */
export function mergeRecordFields<T extends Record<string, any>>(local: T, remote: T): T {
  const localTime = new Date(local.updatedAt || local.createdAt || 0).getTime();
  const remoteTime = new Date(remote.updatedAt || remote.createdAt || 0).getTime();

  const primary = remoteTime >= localTime ? remote : local;
  const secondary = remoteTime >= localTime ? local : remote;

  const merged: any = { ...secondary, ...primary };

  // Retain non-null optional fields from secondary if primary has them undefined/null
  for (const key of Object.keys(secondary)) {
    if (merged[key] === undefined || merged[key] === null || merged[key] === '') {
      if (secondary[key] !== undefined && secondary[key] !== null && secondary[key] !== '') {
        merged[key] = secondary[key];
      }
    }
  }

  // Handle deletion tombstone
  if (local.deletedAt || remote.deletedAt) {
    const localDelTime = local.deletedAt ? new Date(local.deletedAt).getTime() : 0;
    const remoteDelTime = remote.deletedAt ? new Date(remote.deletedAt).getTime() : 0;
    const maxDelTime = Math.max(localDelTime, remoteDelTime);
    const maxActiveTime = Math.max(
      !local.deletedAt ? localTime : 0,
      !remote.deletedAt ? remoteTime : 0
    );

    if (maxDelTime >= maxActiveTime) {
      merged.deletedAt = local.deletedAt && localDelTime >= remoteDelTime ? local.deletedAt : remote.deletedAt;
    } else {
      merged.deletedAt = null; // Un-deleted by more recent update
    }
  }

  return merged as T;
}

/**
 * Enrich or initialize any record with mandatory sync metadata
 */
export function withRecordMetadata<T extends Record<string, any>>(
  record: T,
  options?: {
    userId?: string;
    source?: string;
    sourceId?: string;
    idempotencyKey?: string;
    gmailMessageId?: string;
    isUpdate?: boolean;
  }
): T & SyncEntityMetadata {
  const now = new Date().toISOString();
  const defaultSource = options?.source || record.source || getClientSource();
  const defaultSourceId = options?.sourceId || record.sourceId || generateSourceId(record.id || 'item');

  return {
    ...record,
    userId: options?.userId || record.userId || undefined,
    createdAt: record.createdAt || now,
    updatedAt: options?.isUpdate ? now : (record.updatedAt || record.createdAt || now),
    deletedAt: record.deletedAt !== undefined ? record.deletedAt : null,
    source: defaultSource,
    sourceId: defaultSourceId,
    idempotencyKey: options?.idempotencyKey || record.idempotencyKey || undefined,
    gmailMessageId: options?.gmailMessageId || record.gmailMessageId || undefined,
  };
}

export interface ReconcileResult<T> {
  merged: T[];
  toSaveLocally: T[];
  toDeleteLocally: string[];
  toPushToRemote: T[];
}

/**
 * Reconcile local and remote collections record-by-record with universal deduplication.
 * Never wipes tables. Preserves local creations/updates and applies newer remote updates.
 */
export function reconcileRecordCollection<T extends { id: string; updatedAt: string; createdAt?: string; deletedAt?: string | null; userId?: string }>(
  localRecords: T[] = [],
  remoteRecords: T[] = []
): ReconcileResult<T> {
  const localById = new Map<string, T>();
  const localByDedup = new Map<string, T>();

  const remoteById = new Map<string, T>();
  const remoteByDedup = new Map<string, T>();

  for (const item of localRecords) {
    if (item && item.id) {
      localById.set(item.id, item);
      const dedupKey = getRecordDeduplicationKey(item);
      if (dedupKey) localByDedup.set(dedupKey, item);
    }
  }

  for (const item of remoteRecords) {
    if (item && item.id) {
      remoteById.set(item.id, item);
      const dedupKey = getRecordDeduplicationKey(item);
      if (dedupKey) remoteByDedup.set(dedupKey, item);
    }
  }

  const mergedMap = new Map<string, T>();
  const toSaveLocally: T[] = [];
  const toDeleteLocally: string[] = [];
  const toPushToRemote: T[] = [];
  const processedLocalIds = new Set<string>();

  // 1. Process all remote records against local state
  remoteById.forEach((remoteItem, remoteId) => {
    const dedupKey = getRecordDeduplicationKey(remoteItem);
    const localItem = localById.get(remoteId) || (dedupKey ? localByDedup.get(dedupKey) : undefined);

    if (localItem) {
      processedLocalIds.add(localItem.id);
    }

    if (!localItem) {
      if (remoteItem.deletedAt) {
        toDeleteLocally.push(remoteId);
      } else {
        mergedMap.set(remoteId, remoteItem);
        toSaveLocally.push(remoteItem);
      }
    } else {
      const mergedItem = mergeRecordFields(localItem, remoteItem);
      const remoteTime = new Date(remoteItem.updatedAt || remoteItem.createdAt || 0).getTime();
      const localTime = new Date(localItem.updatedAt || localItem.createdAt || 0).getTime();

      if (mergedItem.deletedAt) {
        toDeleteLocally.push(localItem.id);
        if (remoteId !== localItem.id) toDeleteLocally.push(remoteId);
        if (localTime > remoteTime) {
          toPushToRemote.push(mergedItem);
        }
      } else {
        mergedMap.set(mergedItem.id, mergedItem);
        if (remoteTime > localTime) {
          toSaveLocally.push(mergedItem);
        } else if (localTime > remoteTime) {
          toPushToRemote.push(mergedItem);
        }
      }
    }
  });

  // 2. Process all local records that were not matched by remote
  localById.forEach((localItem, localId) => {
    if (!processedLocalIds.has(localId)) {
      const dedupKey = getRecordDeduplicationKey(localItem);
      if (!dedupKey || !remoteByDedup.has(dedupKey)) {
        if (localItem.deletedAt) {
          toDeleteLocally.push(localId);
        } else {
          mergedMap.set(localId, localItem);
          toPushToRemote.push(localItem);
        }
      }
    }
  });

  return {
    merged: Array.from(mergedMap.values()),
    toSaveLocally,
    toDeleteLocally,
    toPushToRemote,
  };
}

/**
 * Deduplicate an array of in-memory records using strict deduplication keys.
 * Retains the latest and most complete record.
 */
export function deduplicateCollection<T extends Record<string, any>>(records: T[]): T[] {
  const dedupMap = new Map<string, T>();

  for (const record of records) {
    if (!record) continue;
    const key = getRecordDeduplicationKey(record);
    const existing = dedupMap.get(key);

    if (!existing) {
      dedupMap.set(key, record);
    } else {
      dedupMap.set(key, mergeRecordFields(existing, record));
    }
  }

  return Array.from(dedupMap.values());
}

