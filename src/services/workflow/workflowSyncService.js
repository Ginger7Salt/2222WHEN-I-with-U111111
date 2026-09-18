// src/services/workflow/workflowSyncService.js
//
// 把本地 workflow 配置 + 可用的 MCP 连接快照，同步给云端推送服务器
// （/www/wwwroot/pwa-push-server/server.js 的 /api/sync-workflows）。
//
// 设计目的：App 彻底关闭时，服务器需要自己知道有哪些 workflow 要跑、
// 能调用哪些 MCP 工具。这里只做"读本地数据 → 组装 → POST"，
// 不改变任何本地已有的调度逻辑——workflowScheduler.js 依然是
// App 打开时的主执行路径，这个文件只是给离线兜底铺数据。
//
// ⚠️ 安全边界：只把 auth.type === 'none' 的纯 HTTP/HTTPS MCP 连接
// 同步出去。bearer / oauth 类型连接的凭证不会离开本机，哪怕
// 服务器那边本来就会把它们过滤掉——这里提前在客户端就不发送，
// 避免凭证在网络上多走一趟。

import db from '../../db';
import { getEffectiveServerUrl } from '../cloudPushService';

const SYNC_DEBOUNCE_MS = 800;

let debounceTimer = null;
let isSyncing = false;
let pendingReSync = false;

const buildMcpConnectionsPayload = async () => {
  const [connections, tools] = await Promise.all([
    db.mcpConnections.toArray(),
    db.mcpTools.toArray(),
  ]);

  const toolsByConnectionId = new Map();

  for (const tool of tools) {
    if (!toolsByConnectionId.has(tool.connectionId)) {
      toolsByConnectionId.set(tool.connectionId, []);
    }
    toolsByConnectionId.get(tool.connectionId).push(tool);
  }

  return connections
    .filter((connection) => connection?.auth?.type === 'none')
    .map((connection) => ({
      id: connection.id,
      name: connection.name,
      endpoint: connection.endpoint,
      enabled: Boolean(connection.enabled),
      auth: { type: 'none' },
      tools: (toolsByConnectionId.get(connection.id) || [])
        .filter((tool) => tool.enabled === true && tool.isAvailable !== false)
        .map((tool) => ({
          toolName: tool.toolName,
          description: tool.description || '',
          inputSchema: tool.inputSchema || { type: 'object', properties: {} },
          enabled: true,
        })),
    }));
};

const buildWorkflowsPayload = async () => {
  const workflows = await db.workflows.toArray();

  return workflows.map((workflow) => ({
    id: workflow.id,
    chatId: workflow.chatId,
    characterId: workflow.characterId,
    name: workflow.name || '',
    time: workflow.time,
    weekdays: Array.isArray(workflow.weekdays) ? workflow.weekdays : [],
    goal: workflow.goal || '',
    enabled: Boolean(workflow.enabled),

    /*
     * 目前 workflowService.js 里还没有这个字段，正常情况下会是
     * undefined。服务器端把它当"空数组=不限制"处理，不会报错，
     * 以后真加上了这里也不用改。
     */
    allowedConnectionIds: Array.isArray(workflow.allowedConnectionIds)
      ? workflow.allowedConnectionIds
      : [],
  }));
};

/**
 * 立即执行一次同步（返回 Promise，可以 await，也可以不管返回值）。
 *
 * 未配置推送服务器 / 网络失败时都会静默跳过，不抛出异常、
 * 不打断调用方的操作——和 cloudPushService.js 里其它同步函数
 * 的容错风格保持一致。
 */
export const syncWorkflowsToServer = async () => {
  try {
    const serverUrl = await getEffectiveServerUrl();

    if (!serverUrl) {
      return { skipped: true, reason: 'no-server-configured' };
    }

    const [workflows, mcpConnections] = await Promise.all([
      buildWorkflowsPayload(),
      buildMcpConnectionsPayload(),
    ]);

    const response = await fetch(`${serverUrl}/api/sync-workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflows, mcpConnections }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.warn('[WorkflowSync] 服务器拒绝了 workflow 同步:', response.status, text);
      return { skipped: false, ok: false, status: response.status };
    }

    const result = await response.json().catch(() => null);
    return { skipped: false, ok: true, result };
  } catch (error) {
    // 纯离线或网络波动时静默跳过，不影响任何本地功能
    console.warn('[WorkflowSync] 同步失败（已忽略）:', error?.message);
    return { skipped: false, ok: false, error: error?.message };
  }
};

/**
 * 防抖版本：短时间内多次调用（比如批量勾选启用几个工具、
 * 连续保存几次 workflow 编辑）只会真正发出最后一次请求。
 *
 * 调用方直接 fire-and-forget 即可，不需要 await、
 * 不需要处理返回值——失败了也只是这次同步没成功，
 * 下一次任何改动触发的同步会带上最新的完整状态，
 * 不存在"漏更新"的情况。
 */
export const scheduleWorkflowSync = () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    debounceTimer = null;

    if (isSyncing) {
      pendingReSync = true;
      return;
    }

    isSyncing = true;

    syncWorkflowsToServer().finally(() => {
      isSyncing = false;

      if (pendingReSync) {
        pendingReSync = false;
        scheduleWorkflowSync();
      }
    });
  }, SYNC_DEBOUNCE_MS);
};

/**
 * 拉取服务器侧记录的 workflow 运行状态（lastRunDate / lastRunError），
 * 写回本地 db.workflows，让「工作流」管理页也能看到 App 关闭期间、
 * 服务器已经代跑过的执行结果（比如早上 6 点用 MCP 天气发的那条）。
 *
 * 只读云端接口，完全不影响本地 workflowScheduler.js 的调度逻辑；
 * 未配置推送服务器 / 网络失败时静默跳过。
 */
export const pullWorkflowRunStatusFromServer = async () => {
  try {
    const serverUrl = await getEffectiveServerUrl();

    if (!serverUrl) {
      return { skipped: true, reason: 'no-server-configured' };
    }

    const response = await fetch(`${serverUrl}/api/fetch-workflow-run-status`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return { skipped: false, ok: false, status: response.status };
    }

    const data = await response.json().catch(() => null);
    const serverWorkflows = Array.isArray(data?.workflows) ? data.workflows : [];

    let updatedCount = 0;

    for (const serverWorkflow of serverWorkflows) {
      if (!serverWorkflow?.id) continue;

      const localWorkflow = await db.workflows.get(serverWorkflow.id);
      if (!localWorkflow) continue;

      const serverRunDate = serverWorkflow.lastRunDate || '';
      const localRunDate = localWorkflow.lastRunDate || '';

      // 谁的 lastRunDate 更新（YYYY-MM-DD 字符串可以直接比较），就以谁为准，
      // 避免服务器的旧记录覆盖掉本地刚跑完的新结果。
      if (serverRunDate && serverRunDate >= localRunDate) {
        await db.workflows.update(serverWorkflow.id, {
          lastRunDate: serverRunDate,
          lastRunError: serverWorkflow.lastRunError || null,
          lastRunStatus: serverWorkflow.lastRunError ? 'error' : 'sent',
        });
        updatedCount += 1;
      }
    }

    return { skipped: false, ok: true, updatedCount };
  } catch (error) {
    console.warn('[WorkflowSync] 拉取服务器运行状态失败（已忽略）:', error?.message);
    return { skipped: false, ok: false, error: error?.message };
  }
};