import db from '../../db'; // 按你项目实际路径调整

/**
 * 记录一次工作流的执行结果——只写 workflowRuns 这张历史表。
 *
 * 注意：workflows 表上的 lastRunAt/lastRunStatus/lastRunError 这几个
 * "最新状态"字段，继续由 workflowService.js 里已有的 `markWorkflowRun`
 * 负责更新，这里不重复写，避免两处逻辑对同一批字段各写一份、以后改起来
 * 要改两个地方。`recordWorkflowRun` 和 `markWorkflowRun` 是各管一段：
 * 前者管"完整历史"，后者管"列表页要看的最新一条"。
 *
 * 接入点（两处）：
 *  1. 客户端 `workflowScheduler.js`：在已有的 `markWorkflowRun(...)`
 *     调用旁边，加一行 `recordWorkflowRun(...)`，source 传 'app'
 *     （具体改法见「运行历史接入.md」）。
 *  2. 服务器端 `server.js` 的巡检分支C：调用完
 *     `generateAiReplyForWorkflow(...)` 之后同样要记一条，source 传
 *     'server'——但服务器端不能直接写客户端本地的 Dexie，这一段还需要
 *     你先定"服务器执行结果怎么带回客户端"的方案（见前面的说明），
 *     定了之后我再补。
 *
 * @param {object} workflow 工作流记录（至少要有 id/chatId/characterId）
 * @param {'sent'|'error'} status
 * @param {object} [options]
 * @param {string} [options.errorMessage]
 * @param {'app'|'server'} [options.source]
 */
export async function recordWorkflowRun(workflow, status, options = {}) {
  const { errorMessage = null, source = 'app' } = options;

  await db.workflowRuns.add({
    workflowId: workflow.id,
    chatId: workflow.chatId,
    characterId: workflow.characterId,
    status,
    errorMessage,
    source,
    runAt: Date.now()
  });
}

export async function listWorkflowRuns(workflowId, { limit = 200 } = {}) {
  const rows = await db.workflowRuns
    .where('workflowId')
    .equals(workflowId)
    .toArray();

  return rows.sort((a, b) => b.runAt - a.runAt).slice(0, limit);
}

export async function clearWorkflowRuns(workflowId) {
  const rows = await db.workflowRuns.where('workflowId').equals(workflowId).toArray();
  await db.workflowRuns.bulkDelete(rows.map((r) => r.id));
}