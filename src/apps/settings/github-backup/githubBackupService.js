import db from '../../../db';
import { generateBackupData, restoreBackupData } from '../../../services/backupService';

// UTF-8 编码传输支持，规避 Base64 中文乱码问题
const utf8ToB64 = (str) => btoa(unescape(encodeURIComponent(str)));
const b64ToUtf8 = (str) => decodeURIComponent(escape(atob(str.replace(/\s/g, ''))));

/**
 * 载入 GitHub 配置
 */
export const getGitHubConfig = async () => {
  const keys = [
    'github_backup_token',
    'github_backup_owner',
    'github_backup_repo',
    'github_backup_branch',
    'github_backup_path',
    'github_backup_last_time',
    'github_backup_last_status',
  ];

  const list = await db.settings.where('key').anyOf(keys).toArray();
  const config = {};
  list.forEach((item) => {
    config[item.key] = item.value;
  });

  return {
    token: config.github_backup_token || '',
    owner: config.github_backup_owner || '',
    repo: config.github_backup_repo || '',
    branch: config.github_backup_branch || 'main',
    path: config.github_backup_path || 'backups/when-i-with-u.json',
    lastTime: config.github_backup_last_time || null,
    lastStatus: config.github_backup_last_status || null,
  };
};

/**
 * 保存配置
 */
export const saveGitHubConfig = async (config) => {
  await db.transaction('rw', db.settings, async () => {
    const data = [
      { key: 'github_backup_owner', value: config.owner.trim() },
      { key: 'github_backup_repo', value: config.repo.trim() },
      { key: 'github_backup_branch', value: config.branch.trim() },
      { key: 'github_backup_path', value: config.path.trim() },
    ];

    // 如果未更改 Token（仍显示占位符）则不更新数据库中的明文 token
    if (config.token && config.token !== '••••••••••••••••') {
      data.push({ key: 'github_backup_token', value: config.token.trim() });
    }

    if (config.lastTime !== undefined) {
      data.push({ key: 'github_backup_last_time', value: config.lastTime });
    }

    if (config.lastStatus !== undefined) {
      data.push({ key: 'github_backup_last_status', value: config.lastStatus });
    }

    await db.settings.bulkPut(data);
  });
};

/**
 * 连接检验与权限测试
 */
export const testGitHubConnection = async (token, owner, repo) => {
  if (!token || !owner || !repo) {
    throw new Error('连通测试失败：必须填写完整 Token、Owner 与 Repository。');
  }

  let finalToken = token;
  if (token === '••••••••••••••••') {
    const record = await db.settings.get('github_backup_token');
    finalToken = record?.value || '';
  }

  if (!finalToken) {
    throw new Error('未检出有效的 GitHub 授权 Token。');
  }

  const response = await fetch(`https://api.github.com/repos/${owner.trim()}/${repo.trim()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${finalToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('访问认证失败。请检查 Token 是否有效。');
    }
    if (response.status === 404) {
      throw new Error('未找到指定仓库。请核对仓库名或检查 Token 的 Scope 权限。');
    }
    const errObj = await response.json().catch(() => ({}));
    throw new Error(errObj.message || `API 连接失败，状态码: ${response.status}`);
  }

  return true;
};

// 2026-10：GitHub 的 Contents API（/contents/{path}）只能在文件 <=1MB 时
// 通过 GET 拿到 content 字段，PUT 写入也只稳定支持到 1MB 左右——而这个 App
// 的备份里内联了语音/图片的 Blob（转成了 base64），随便几条语音消息就能
// 让备份文件超过 1MB。超过之后：GET 会拿到一个没有 content 字段的响应
// （本来的 bug：'云端备份文件内容空白'），PUT 也可能因为请求体过大被拒绝
// 或行为不稳定。
//
// 改用 Git Data API（blob/tree/commit，支持到 100MB）绕开这个限制：
// 推送 = 创建 blob -> 基于现有树创建新树 -> 创建新 commit -> 更新分支引用；
// 拉取 = 用 Contents API 只问文件的 sha 元信息（这一步不受 1MB 限制），
// 再通过 git/blobs/{sha} 单独取内容。

const GITHUB_API_VERSION = '2022-11-28';

const githubHeaders = (token, extra = {}) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': GITHUB_API_VERSION,
  ...extra,
});

const githubRequest = async (url, { token, method = 'GET', body, allow404 = false } = {}) => {
  const res = await fetch(url, {
    method,
    headers: githubHeaders(token, body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 404 && allow404) {
    return { ok: false, status: 404, data: null };
  }

  if (!res.ok) {
    const errObj = await res.json().catch(() => ({}));
    throw new Error(errObj.message || `GitHub API 请求失败，状态码: ${res.status}`);
  }

  const data = await res.json().catch(() => ({}));
  return { ok: true, status: res.status, data };
};

/**
 * 自动获取远端文件 SHA 并推送备份（走 Git Data API，不受 1MB 限制）
 */
export const backupToGitHub = async () => {
  const config = await getGitHubConfig();
  const tokenRecord = await db.settings.get('github_backup_token');
  const token = tokenRecord?.value;

  if (!token || !config.owner || !config.repo) {
    throw new Error('备份终止：GitHub 配置存在空白项');
  }

  const repoBase = `https://api.github.com/repos/${config.owner}/${config.repo}`;

  // 1. 生成最新备份，内部已自动剔除 token 配置
  const backupObj = await generateBackupData();
  const jsonStr = JSON.stringify(backupObj, null, 2);
  const base64Content = utf8ToB64(jsonStr);

  // 2. 查询目标分支当前指向的 commit（分支不存在时走首次创建分支的流程）
  const refRes = await githubRequest(
    `${repoBase}/git/ref/heads/${encodeURIComponent(config.branch)}`,
    { token, allow404: true },
  );
  const baseCommitSha = refRes.ok ? refRes.data.object?.sha : null;

  // 3. 获取基准树（在现有树上做增量修改，避免覆盖仓库里其他文件）
  let baseTreeSha = null;
  if (baseCommitSha) {
    const commitRes = await githubRequest(`${repoBase}/git/commits/${baseCommitSha}`, { token });
    baseTreeSha = commitRes.data.tree?.sha || null;
  }

  // 4. 创建新 blob
  const blobRes = await githubRequest(`${repoBase}/git/blobs`, {
    token,
    method: 'POST',
    body: { content: base64Content, encoding: 'base64' },
  });
  const blobSha = blobRes.data.sha;

  // 5. 基于基准树创建新树（只替换备份文件这一个路径）
  const treeRes = await githubRequest(`${repoBase}/git/trees`, {
    token,
    method: 'POST',
    body: {
      ...(baseTreeSha ? { base_tree: baseTreeSha } : {}),
      tree: [{ path: config.path, mode: '100644', type: 'blob', sha: blobSha }],
    },
  });
  const newTreeSha = treeRes.data.sha;

  // 6. 创建新 commit
  const commitRes = await githubRequest(`${repoBase}/git/commits`, {
    token,
    method: 'POST',
    body: {
      message: `backup: WHEN I with U archive at ${new Date().toISOString()}`,
      tree: newTreeSha,
      parents: baseCommitSha ? [baseCommitSha] : [],
    },
  });
  const newCommitSha = commitRes.data.sha;

  // 7. 更新（或首次创建）分支引用
  if (baseCommitSha) {
    await githubRequest(
      `${repoBase}/git/refs/heads/${encodeURIComponent(config.branch)}`,
      { token, method: 'PATCH', body: { sha: newCommitSha } },
    );
  } else {
    await githubRequest(`${repoBase}/git/refs`, {
      token,
      method: 'POST',
      body: { ref: `refs/heads/${config.branch}`, sha: newCommitSha },
    });
  }

  const nowStr = new Date().toISOString();
  await saveGitHubConfig({
    ...config,
    lastTime: nowStr,
    lastStatus: 'success',
  });

  return { nowTime: nowStr, warningCount: backupObj.exportWarnings?.length || 0 };
};

/**
 * 从 GitHub 同步并覆盖本地
 * 先用 Contents API 只取文件元信息（sha），再用 Git Data API 取真正内容，
 * 这样无论备份文件多大都能正常取到，不再受 Contents API 的 1MB content 限制。
 */
export const restoreFromGitHub = async () => {
  const config = await getGitHubConfig();
  const tokenRecord = await db.settings.get('github_backup_token');
  const token = tokenRecord?.value;

  if (!token || !config.owner || !config.repo) {
    throw new Error('恢复终止：GitHub 配置存在空白项');
  }

  const repoBase = `https://api.github.com/repos/${config.owner}/${config.repo}`;

  const metaRes = await githubRequest(
    `${repoBase}/contents/${config.path}?ref=${config.branch}`,
    { token, allow404: true },
  );

  if (!metaRes.ok) {
    throw new Error(`未在指定路径找到备份文件：${config.path}`);
  }

  const fileData = metaRes.data;
  let base64Content = fileData.content;

  // 文件超过 1MB 时，Contents API 不会在这一步返回 content——改用
  // Git Data 的 blob 接口按 sha 单独取，支持到 100MB。
  if (!base64Content && fileData.sha) {
    const blobRes = await githubRequest(`${repoBase}/git/blobs/${fileData.sha}`, { token });
    base64Content = blobRes.data.content;
  }

  if (!base64Content) {
    throw new Error('云端备份文件内容空白');
  }

  const decodedStr = b64ToUtf8(base64Content);
  const backupObj = JSON.parse(decodedStr);

  // 执行覆盖恢复
  return restoreBackupData(backupObj);
};