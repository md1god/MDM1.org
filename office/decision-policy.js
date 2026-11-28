(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MDM1DecisionPolicy = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  function shouldQueueImmediately(risk) { return String(risk || 'low').toLowerCase() !== 'high'; }
  function canResolveApproval(risk, decision, override) {
    if (decision === 'rejected') return true;
    if (decision !== 'approved') return false;
    return String(risk || 'low').toLowerCase() !== 'high' || override === true;
  }
  function linkedLedgerItems(approval, ledgerEntry) {
    if (!approval || !ledgerEntry || !Array.isArray(ledgerEntry.items)) return [];
    var payload = approval.payload || {};
    var ids = Array.isArray(payload.ledgerItemIds) ? payload.ledgerItemIds.slice() : [];
    if (payload.ledgerItemId) ids.push(payload.ledgerItemId);
    ids = ids.filter(function (id, index) { return id && ids.indexOf(id) === index; });
    return ledgerEntry.items.filter(function (item) {
      return ids.indexOf(item.id) !== -1 && item.status === 'needs_approval' && item.approvalId === approval.id;
    });
  }
  function shouldQuarantineLegacyAssistantTask(task, approval) {
    if (!task || !approval) return false;
    if (approval.status !== 'pending' || approval.actionType !== 'assistant_plan' || String(approval.risk || '').toLowerCase() !== 'high') return false;
    if (['queued', 'working'].indexOf(task.status) === -1) return false;
    var payload = approval.payload || {};
    var expectedAgent = String(payload.agentId || approval.agentId || '');
    var expectedLedger = payload.ledgerId || null;
    var expectedTitle = String(payload.taskTitle || approval.title || '').replace(/^موافقة صريحة:\s*/u, '').trim();
    return task.agentId === expectedAgent && (task.ledgerId || null) === expectedLedger && String(task.title || '').trim() === expectedTitle;
  }
  function prepareApprovedTask(approval, ledgerEntry, taskId, createdAt) {
    if (!approval || !approval.id) return { ok: false, code: 'INVALID_APPROVAL' };
    var payload = approval.payload || {}, action = approval.actionType;
    var agentId = String(payload.agentId || approval.agentId || '').trim();
    var title = '', description = '', ledgerItemIds = [];
    if (action === 'request_execution') {
      var itemId = String(payload.ledgerItemId || '').trim();
      var item = ledgerEntry && Array.isArray(ledgerEntry.items) ? ledgerEntry.items.find(function (entry) { return entry.id === itemId; }) : null;
      if (!item || item.status !== 'needs_approval' || item.approvalId !== approval.id) return { ok: false, code: 'STALE_OR_UNLINKED_LEDGER_ITEM' };
      agentId = String(item.agentId || agentId).trim();
      title = String(item.text || '').trim();
      description = title + '\n\nمصدر الطلب: ' + String(ledgerEntry.source || 'unknown');
      ledgerItemIds = [item.id];
    } else if (action === 'assistant_plan') {
      title = String(payload.taskTitle || '').trim();
      description = String(payload.taskDescription || '').trim();
      ledgerItemIds = Array.isArray(payload.ledgerItemIds) ? payload.ledgerItemIds.slice() : [];
      if (ledgerItemIds.length) {
        if (!ledgerEntry) return { ok: false, code: 'LEDGER_NOT_FOUND' };
        var linked = linkedLedgerItems(approval, ledgerEntry), found = {};
        linked.forEach(function (item) { found[item.id] = true; });
        if (ledgerItemIds.some(function (id) { return !found[id]; })) return { ok: false, code: 'STALE_OR_UNLINKED_LEDGER_ITEM' };
      }
    } else return { ok: false, code: 'UNSUPPORTED_ACTION' };
    if (!agentId || !title || !taskId) return { ok: false, code: 'INVALID_TASK_PAYLOAD' };
    return {
      ok: true,
      task: {
        id: taskId, agentId: agentId, title: title.slice(0, 160), description: description.slice(0, 5000),
        status: 'queued', createdAt: createdAt, ledgerId: ledgerEntry ? ledgerEntry.id : (payload.ledgerId || null),
        ledgerItemIds: ledgerItemIds, ledgerItemId: ledgerItemIds.length === 1 ? ledgerItemIds[0] : null
      },
      ledgerItemIds: ledgerItemIds
    };
  }
  return { shouldQueueImmediately, canResolveApproval, linkedLedgerItems, prepareApprovedTask, shouldQuarantineLegacyAssistantTask };
});
