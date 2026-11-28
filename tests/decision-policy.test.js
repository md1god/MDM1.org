'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../office/decision-policy');

test('high-risk work is not queued before approval', () => {
  assert.equal(policy.shouldQueueImmediately('high'), false);
  assert.equal(policy.shouldQueueImmediately('medium'), true);
  assert.equal(policy.shouldQueueImmediately('low'), true);
});
test('high-risk approval requires an explicit override; rejection does not', () => {
  assert.equal(policy.canResolveApproval('high', 'approved', false), false);
  assert.equal(policy.canResolveApproval('high', 'approved', true), true);
  assert.equal(policy.canResolveApproval('high', 'rejected', false), true);
  assert.equal(policy.canResolveApproval('low', 'approved', false), true);
  assert.equal(policy.canResolveApproval('low', 'unknown', true), false);
});
test('a direct high-risk request becomes a task only after its exact approval', () => {
  const ledger = { id: 'req-1', source: 'direct', items: [{ id: 'ri-1', agentId: 'security-officer', text: 'Review external access', status: 'needs_approval', approvalId: 'apr-1' }] };
  const approval = { id: 'apr-1', agentId: 'security-officer', actionType: 'request_execution', payload: { ledgerId: 'req-1', ledgerItemId: 'ri-1' } };
  const prepared = policy.prepareApprovedTask(approval, ledger, 'tsk-1', '2026-11-28T12:00:00.000Z');
  assert.equal(prepared.ok, true);
  assert.equal(prepared.task.status, 'queued');
  assert.deepEqual(prepared.task.ledgerItemIds, ['ri-1']);
  assert.equal(prepared.task.agentId, 'security-officer');
});
test('a stale or mismatched approval cannot create a task', () => {
  const ledger = { id: 'req-1', items: [{ id: 'ri-1', agentId: 'security-officer', text: 'Do work', status: 'needs_approval', approvalId: 'another-approval' }] };
  const approval = { id: 'apr-1', actionType: 'request_execution', payload: { ledgerId: 'req-1', ledgerItemId: 'ri-1' } };
  assert.equal(policy.prepareApprovedTask(approval, ledger, 'tsk-1', 'now').ok, false);
});
test('an assistant-plan approval links all and only its pending ledger items', () => {
  const ledger = { id: 'req-2', items: [
    { id: 'ri-1', status: 'needs_approval', approvalId: 'apr-2' },
    { id: 'ri-2', status: 'needs_approval', approvalId: 'apr-2' },
    { id: 'ri-3', status: 'needs_approval', approvalId: 'other' }
  ] };
  const approval = { id: 'apr-2', actionType: 'assistant_plan', payload: {
    agentId: 'security-officer', taskTitle: 'Audit deployment',
    taskDescription: 'Check the deployment permissions.', ledgerItemIds: ['ri-1', 'ri-2']
  } };
  const prepared = policy.prepareApprovedTask(approval, ledger, 'tsk-2', 'now');
  assert.equal(prepared.ok, true);
  assert.deepEqual(prepared.task.ledgerItemIds, ['ri-1', 'ri-2']);
  assert.deepEqual(policy.linkedLedgerItems(approval, ledger).map(x => x.id), ['ri-1', 'ri-2']);
});
