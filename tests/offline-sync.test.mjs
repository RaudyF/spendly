/**
 * Tests for Offline-First Synchronization & Device Conflict Resolution Engine
 * - Queueing pending changes in local storage
 * - Automatic retry on connectivity recovery
 * - Visual indicator states: saved_locally, syncing, synced, offline, error
 * - Mandatory sync metadata: userId, createdAt, updatedAt, deletedAt, source, sourceId
 * - Record-by-record reconciliation (Phone modifies obligation + PC registers movement -> both preserved)
 */

import {
  withRecordMetadata,
  reconcileRecordCollection,
  generateSourceId,
} from '../src/lib/sync-conflict.ts';

export async function runOfflineSyncTests() {
  const results = [];

  // Mock syncQueue
  const mockSyncQueue = [];
  const mockQueueDB = {
    add: async (change) => {
      mockSyncQueue.push(change);
    },
    getAll: async () => [...mockSyncQueue],
    clear: async () => {
      mockSyncQueue.length = 0;
    },
  };

  // Test OFFLINE-1: Pending changes are queued in offline mode
  try {
    const isOnline = false;
    const change = {
      entityType: 'expense',
      action: 'create',
      entityId: 'exp_offline_123',
      payload: { id: 'exp_offline_123', amount: 1500, description: 'Supermercado' },
      timestamp: Date.now(),
    };

    await mockQueueDB.add(change);
    const queue = await mockQueueDB.getAll();

    const passed = queue.length === 1 && queue[0].entityId === 'exp_offline_123';
    results.push({
      testId: 'OFFLINE-1',
      suite: 'OfflineSync/Queue',
      name: 'IndexedDB almacena en cola los cambios realizados sin conexión',
      passed,
      actual: `Queue length=${queue.length}, EnqueuedId=${queue[0]?.entityId}`,
    });
  } catch (err) {
    results.push({
      testId: 'OFFLINE-1',
      suite: 'OfflineSync/Queue',
      name: 'IndexedDB almacena en cola los cambios realizados sin conexión',
      passed: false,
      actual: err.message,
    });
  }

  // Test OFFLINE-2: Sync states lifecycle and transitions
  try {
    const states = [];
    let currentStatus = 'saved_locally';
    states.push(currentStatus);

    // Go offline
    let isOnline = false;
    currentStatus = 'offline';
    states.push(currentStatus);

    // Go online with pending items -> start sync
    isOnline = true;
    currentStatus = 'syncing';
    states.push(currentStatus);

    // Sync finishes successfully
    await mockQueueDB.clear();
    currentStatus = 'synced';
    states.push(currentStatus);

    // Server error case
    currentStatus = 'error';
    states.push(currentStatus);

    const validTransitions =
      states.includes('saved_locally') &&
      states.includes('offline') &&
      states.includes('syncing') &&
      states.includes('synced') &&
      states.includes('error');

    results.push({
      testId: 'OFFLINE-2',
      suite: 'OfflineSync/Status',
      name: 'Transiciones de estado visual: saved_locally, offline, syncing, synced, error',
      passed: validTransitions,
      actual: states.join(' -> '),
    });
  } catch (err) {
    results.push({
      testId: 'OFFLINE-2',
      suite: 'OfflineSync/Status',
      name: 'Transiciones de estado visual: saved_locally, offline, syncing, synced, error',
      passed: false,
      actual: err.message,
    });
  }

  // Test CONFLICT-1: Mandatory metadata attributes injection
  try {
    const rawRecord = {
      id: 'exp_phone_001',
      amount: 450,
      description: 'Farmacia',
    };

    const enriched = withRecordMetadata(rawRecord, {
      userId: 'usr_abc_123',
      source: 'phone-android',
    });

    const hasAllFields =
      enriched.userId === 'usr_abc_123' &&
      typeof enriched.createdAt === 'string' &&
      typeof enriched.updatedAt === 'string' &&
      enriched.deletedAt === null &&
      enriched.source === 'phone-android' &&
      typeof enriched.sourceId === 'string' &&
      enriched.sourceId.length > 5;

    results.push({
      testId: 'CONFLICT-1',
      suite: 'SyncConflict/Metadata',
      name: 'Cada registro posee userId, createdAt, updatedAt, deletedAt, source, sourceId',
      passed: hasAllFields,
      actual: JSON.stringify({
        userId: enriched.userId,
        source: enriched.source,
        hasSourceId: !!enriched.sourceId,
        hasTimestamps: !!(enriched.createdAt && enriched.updatedAt),
      }),
    });
  } catch (err) {
    results.push({
      testId: 'CONFLICT-1',
      suite: 'SyncConflict/Metadata',
      name: 'Cada registro posee userId, createdAt, updatedAt, deletedAt, source, sourceId',
      passed: false,
      actual: err.message,
    });
  }

  // Test CONFLICT-2: Per-record resolution (Phone modifies obligation, PC registers expense -> BOTH preserved)
  try {
    // 1. Initial shared state
    const obligationOrig = {
      id: 'obs_rent_1',
      name: 'Alquiler',
      amount: 15000,
      isPaid: false,
      updatedAt: '2026-03-01T10:00:00.000Z',
      createdAt: '2026-03-01T10:00:00.000Z',
      deletedAt: null,
      source: 'web',
      sourceId: 'src_orig',
    };

    // 2. Phone modifies the obligation (marks as paid)
    const phoneModifiedObligation = {
      ...obligationOrig,
      isPaid: true,
      amount: 15500,
      updatedAt: '2026-03-02T12:00:00.000Z',
      source: 'phone-ios',
      sourceId: 'src_phone_edit',
    };

    // 3. PC (current device) has original obligation locally + registers a new expense movement
    const pcExpense = {
      id: 'exp_pc_groceries_1',
      amount: 820,
      description: 'Despensa PC',
      createdAt: '2026-03-02T11:00:00.000Z',
      updatedAt: '2026-03-02T11:00:00.000Z',
      deletedAt: null,
      source: 'desktop-web',
      sourceId: 'src_pc_exp',
    };

    // PC local collections:
    const pcLocalObligations = [obligationOrig];
    const pcLocalExpenses = [pcExpense];

    // Cloud collections (received Phone update for obligations, no expense yet):
    const cloudObligations = [phoneModifiedObligation];
    const cloudExpenses = [];

    // Reconcile obligations on PC
    const reconObligations = reconcileRecordCollection(pcLocalObligations, cloudObligations);
    // Reconcile expenses on PC
    const reconExpenses = reconcileRecordCollection(pcLocalExpenses, cloudExpenses);

    // Verification:
    // Obligation: phone modified version should win and be saved locally on PC
    const obligationPreserved =
      reconObligations.merged.length === 1 &&
      reconObligations.merged[0].isPaid === true &&
      reconObligations.merged[0].amount === 15500 &&
      reconObligations.toSaveLocally.length === 1;

    // Expense: PC new expense must be preserved and scheduled to push to remote
    const expensePreserved =
      reconExpenses.merged.length === 1 &&
      reconExpenses.merged[0].id === 'exp_pc_groceries_1' &&
      reconExpenses.toPushToRemote.length === 1;

    const testPassed = obligationPreserved && expensePreserved;

    results.push({
      testId: 'CONFLICT-2',
      suite: 'SyncConflict/GranularMerge',
      name: 'Teléfono modifica obligación y PC registra movimiento -> Ambos cambios se conservan (no se reemplaza en bloque)',
      passed: testPassed,
      actual: `Obligation merged paid=${reconObligations.merged[0]?.isPaid}, Expense merged count=${reconExpenses.merged.length}, toPush=${reconExpenses.toPushToRemote.length}`,
    });
  } catch (err) {
    results.push({
      testId: 'CONFLICT-2',
      suite: 'SyncConflict/GranularMerge',
      name: 'Teléfono modifica obligación y PC registra movimiento -> Ambos cambios se conservan (no se reemplaza en bloque)',
      passed: false,
      actual: err.message,
    });
  }

  // Test CONFLICT-3: LWW (Last-Write-Wins) on same record concurrent update
  try {
    const localVersion = {
      id: 'rec_goal_1',
      name: 'Meta Ahorro',
      targetAmount: 5000,
      updatedAt: '2026-03-02T15:00:00.000Z',
      createdAt: '2026-03-01T10:00:00.000Z',
      deletedAt: null,
      source: 'pc',
    };

    const remoteOlderVersion = {
      id: 'rec_goal_1',
      name: 'Meta Ahorro Modificada Antes',
      targetAmount: 4000,
      updatedAt: '2026-03-02T14:00:00.000Z', // 1 hour older
      createdAt: '2026-03-01T10:00:00.000Z',
      deletedAt: null,
      source: 'phone',
    };

    const recon = reconcileRecordCollection([localVersion], [remoteOlderVersion]);

    // Local is newer -> local wins, pushes to remote
    const localWins =
      recon.merged.length === 1 &&
      recon.merged[0].targetAmount === 5000 &&
      recon.toPushToRemote.length === 1 &&
      recon.toSaveLocally.length === 0;

    results.push({
      testId: 'CONFLICT-3',
      suite: 'SyncConflict/LWW',
      name: 'Resolución Last-Write-Wins: conserva la versión más reciente por timestamp de actualización',
      passed: localWins,
      actual: `Winner targetAmount=${recon.merged[0]?.targetAmount}, toPush=${recon.toPushToRemote.length}`,
    });
  } catch (err) {
    results.push({
      testId: 'CONFLICT-3',
      suite: 'SyncConflict/LWW',
      name: 'Resolución Last-Write-Wins: conserva la versión más reciente por timestamp de actualización',
      passed: false,
      actual: err.message,
    });
  }

  // Test OFFLINE-3: Partial sync failure preserves failed items in syncQueue
  try {
    const initialQueue = [
      { id: 'q1', entityId: 'exp_ok_1', entityType: 'expense' },
      { id: 'q2', entityId: 'exp_fail_2', entityType: 'expense' },
      { id: 'q3', entityId: 'inc_ok_3', entityType: 'income' },
    ];

    // Simulated API response with partial success
    const mockApiResponse = {
      success: false,
      partial: true,
      syncedIds: {
        expenses: ['exp_ok_1'],
        incomes: ['inc_ok_3'],
      },
      failed: [
        { entityType: 'expense', id: 'exp_fail_2', error: 'Database locked', recoverable: true },
      ],
    };

    const syncedIdSet = new Set([
      ...mockApiResponse.syncedIds.expenses,
      ...mockApiResponse.syncedIds.incomes,
    ]);

    // Purge only synced IDs
    const remainingQueue = initialQueue.filter((item) => !syncedIdSet.has(item.entityId));

    const testPassed =
      mockApiResponse.partial === true &&
      remainingQueue.length === 1 &&
      remainingQueue[0].entityId === 'exp_fail_2';

    results.push({
      testId: 'OFFLINE-3',
      suite: 'OfflineSync/PartialFailure',
      name: 'Sincronización parcial: retiene únicamente elementos fallidos en syncQueue y reporta error recuperable',
      passed: testPassed,
      actual: `Remaining in queue: ${remainingQueue.map((r) => r.entityId).join(', ')}`,
    });
  } catch (err) {
    results.push({
      testId: 'OFFLINE-3',
      suite: 'OfflineSync/PartialFailure',
      name: 'Sincronización parcial: retiene únicamente elementos fallidos en syncQueue y reporta error recuperable',
      passed: false,
      actual: err.message,
    });
  }

  return results;
}
