// src/apps/manual/tutorialContent.js
//
// "教程区域" 用的是另一套内容结构（不是 manualContent.js 里的 note/p/items 那套），
// 因为它对应的是 manual.css 里已经写好但还没接组件的 tutorial-card / tutorial-detail
// 视觉系统——左边一列可点的教程卡片，右边是选中教程的详情面板。
//
// 每个教程条目的 blocks 支持这些类型（对应 TutorialLibrary.jsx 里的渲染逻辑）：
//   { type: 'paragraph', heading?, text }
//   { type: 'steps', heading?, items: [{ title, text }] }
//   { type: 'code', label, code }                          代码块，自带复制按钮
//   { type: 'checklist', heading?, items: [string] }
//   { type: 'callout', tone: 'note' | 'warning', title?, text }
//   { type: 'note', text }                                  一行小提示（比 callout 更轻）
//   { type: 'divider' }
//
// 代码块内容跟语言无关，三种语言共用同一份 code，只有说明文字分语言。

import { BellRing, Cloud, Watch } from 'lucide-react';

const MINIMAX_WORKER_CODE = `const ALLOWED_ORIGINS = new Set([
  'https://你的用户名.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
]);

const MINIMAX_ORIGIN = 'https://api.minimaxi.com';

const addCorsHeaders = (request, headers = {}) => {
  const origin = request.headers.get('Origin') || '';
  const responseHeaders = new Headers(headers);

  if (ALLOWED_ORIGINS.has(origin)) {
    responseHeaders.set('Access-Control-Allow-Origin', origin);
  }

  responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  responseHeaders.set(
    'Access-Control-Allow-Headers',
    ['Authorization', 'Content-Type', 'X-Api-Key'].join(', '),
  );
  responseHeaders.set('Access-Control-Max-Age', '86400');
  responseHeaders.set('Vary', 'Origin');

  return responseHeaders;
};

const createJsonResponse = (request, body, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: addCorsHeaders(request, { 'Content-Type': 'application/json' }),
  });
};

const getProxyPath = (pathname) => {
  if (pathname === '/t2a_v2' || pathname === '/v1/t2a_v2') return '/v1/t2a_v2';
  if (pathname === '/speech_to_text' || pathname === '/v1/speech_to_text') return '/v1/speech_to_text';
  if (pathname === '/anthropic/v1/models') return '/anthropic/v1/models';
  return null;
};

const createUpstreamHeaders = (request) => {
  const headers = new Headers();
  const authorization = request.headers.get('Authorization');
  const apiKey = request.headers.get('X-Api-Key');
  const contentType = request.headers.get('Content-Type');
  const accept = request.headers.get('Accept');

  if (authorization) headers.set('Authorization', authorization);
  if (apiKey) headers.set('X-Api-Key', apiKey);
  if (contentType) headers.set('Content-Type', contentType);

  if (accept) {
    headers.set('Accept', accept);
    return headers;
  }

  headers.set('Accept', 'application/json');
  return headers;
};

const getSafeErrorMessage = (error) => (error ? error.message || 'MiniMax 请求失败。' : 'MiniMax 请求失败。');

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: addCorsHeaders(request) });
    }

    const upstreamPath = getProxyPath(url.pathname);

    if (!upstreamPath) {
      return createJsonResponse(request, {
        error: 'Unsupported proxy route.',
        availableRoutes: ['GET /anthropic/v1/models', 'POST /v1/t2a_v2', 'POST /v1/speech_to_text'],
      }, 404);
    }

    if (upstreamPath === '/v1/t2a_v2' && request.method !== 'POST') {
      return createJsonResponse(request, { error: 'TTS endpoint only accepts POST.' }, 405);
    }

    if (upstreamPath === '/v1/speech_to_text' && request.method !== 'POST') {
      return createJsonResponse(request, { error: 'ASR endpoint only accepts POST.' }, 405);
    }

    if (upstreamPath === '/anthropic/v1/models' && request.method !== 'GET') {
      return createJsonResponse(request, { error: 'Models endpoint only accepts GET.' }, 405);
    }

    const upstreamUrl = new URL(\`\${MINIMAX_ORIGIN}\${upstreamPath}\`);
    url.searchParams.forEach((value, key) => upstreamUrl.searchParams.set(key, value));

    const hasAuthorization = Boolean(request.headers.get('Authorization'));
    const hasApiKey = Boolean(request.headers.get('X-Api-Key'));

    if (!hasAuthorization && !hasApiKey) {
      return createJsonResponse(request, { error: 'Missing MiniMax authentication header.' }, 401);
    }

    try {
      const upstreamResponse = await fetch(upstreamUrl.toString(), {
        method: request.method,
        headers: createUpstreamHeaders(request),
        body: request.method === 'POST' ? request.body : undefined,
      });

      const responseHeaders = new Headers();
      const contentType = upstreamResponse.headers.get('Content-Type');

      if (contentType) responseHeaders.set('Content-Type', contentType);
      responseHeaders.set('Cache-Control', 'no-store');

      const corsHeaders = addCorsHeaders(request, responseHeaders);

      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: corsHeaders,
      });
    } catch (error) {
      return createJsonResponse(request, {
        error: 'Unable to reach MiniMax.',
        detail: getSafeErrorMessage(error),
      }, 502);
    }
  },
};
`;

const HEALTH_NGINX_CODE = `#PROXY-START/
location ^~ /
{
    proxy_pass http://127.0.0.1:3055;
    proxy_set_header Host $host:$server_port;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_http_version 1.1;

    # 针对 MCP 的 SSE / 流式传输至关重要
    proxy_buffering off;
    proxy_cache off;
    chunked_transfer_encoding off;
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
    proxy_set_header Connection '';
}
#PROXY-END/`;

const HEALTH_SERVER_CODE = `import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import dotenv from 'dotenv';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3055;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// 1. 初始化独立持久化数据库（Node 原生 SQLite）
const db = new DatabaseSync('health_data.sqlite');
db.exec(\`
  CREATE TABLE IF NOT EXISTS health_summary (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    summary_text TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
\`);

// 2. 跨域与请求解析配置（支持 PWA 浏览器访问）
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-token', 'mcp-session-id', 'last-event-id'],
  exposedHeaders: ['mcp-session-id'],
}));
app.use(express.json({ limit: '30mb' }));

// 3. 指标中英对照表
const METRIC_NAMES = {
  heart_rate: '心率',
  resting_heart_rate: '静息心率',
  heart_rate_variability: '心率变异性(HRV)',
  walking_heart_rate_average: '步行平均心率',
  step_count: '每日步数',
  flights_climbed: '爬楼层数',
  walking_running_distance: '步行+跑步距离',
  running_distance: '跑步距离',
  active_energy: '活动能量(千卡)',
  basal_energy_burned: '静息能量(千卡)',
  apple_exercise_time: '锻炼时长(分钟)',
  apple_stand_time: '站立时长(分钟)',
  apple_stand_hour: '站立达标小时数',
  headphone_audio_exposure: '耳机音量暴露',
  environmental_audio_exposure: '环境噪音水平',
  oxygen_saturation: '血氧饱和度',
  respiratory_rate: '呼吸频率',
  time_in_daylight: '日光暴露时长(分钟)',
  apple_sleeping_wrist_temperature: '睡眠手腕温度',
};

const CUMULATIVE_METRICS = new Set([
  'step_count', 'flights_climbed', 'walking_running_distance',
  'running_distance', 'active_energy', 'basal_energy_burned',
  'apple_exercise_time', 'apple_stand_time', 'apple_stand_hour',
  'time_in_daylight',
]);

const AVERAGING_METRICS = new Set([
  'heart_rate', 'resting_heart_rate', 'heart_rate_variability',
  'walking_heart_rate_average', 'headphone_audio_exposure',
  'environmental_audio_exposure', 'oxygen_saturation',
  'respiratory_rate', 'apple_sleeping_wrist_temperature',
]);

// 4. 数据清洗算法
function cleanHealthData(payload) {
  const metrics = payload?.data?.metrics || [];
  const workouts = payload?.data?.workouts || [];

  const sections = {
    sleep: [], cardio: [], activity: [],
    hearing: [], vitals: [], workouts: [], others: [],
  };

  for (const metric of metrics) {
    const name = metric.name;
    const units = metric.units || '';
    const data = metric.data || [];
    if (!data.length) continue;

    const displayName = METRIC_NAMES[name] || name;

    // A. 睡眠分析（精准适配真实 Apple Watch 字段：asleep/inBed 常常为 0，
    // 真实有效时长在 totalSleep / deep / core / rem / awake 里）
    if (name === 'sleep_analysis') {
      data.slice(-7).forEach((d) => {
        const dateStr = (d.date || d.sleepEnd || '').split(' ')[0] || '未知';
        const total = d.totalSleep ? Number(d.totalSleep) : (d.asleep ? Number(d.asleep) : 0);
        if (total <= 0 && !d.inBed) return;

        const phases = [];
        if (d.deep) phases.push(\`深睡 \${Number(d.deep).toFixed(1)}h\`);
        if (d.core) phases.push(\`核心 \${Number(d.core).toFixed(1)}h\`);
        if (d.rem) phases.push(\`REM \${Number(d.rem).toFixed(1)}h\`);
        if (d.awake) phases.push(\`清醒 \${Number(d.awake).toFixed(1)}h\`);

        let timeRange = '';
        if (d.sleepStart && d.sleepEnd) {
          const s = d.sleepStart.split(' ')[1]?.substring(0, 5) || '';
          const e = d.sleepEnd.split(' ')[1]?.substring(0, 5) || '';
          if (s && e) timeRange = \` [\${s} ~ \${e}]\`;
        }

        const phaseStr = phases.length ? \` (\${phases.join(', ')})\` : '';
        sections.sleep.push(\`  · \${dateStr}\${timeRange}: 睡眠 \${total.toFixed(1)}小时\${phaseStr}\`);
      });
      continue;
    }

    // B. 累积型指标按天统计
    if (CUMULATIVE_METRICS.has(name)) {
      const dayMap = {};
      data.forEach((d) => {
        const day = (d.date || '').split(' ')[0] || '未知';
        const val = Number(d.qty !== undefined ? d.qty : (d.Avg || 0));
        dayMap[day] = (dayMap[day] || 0) + val;
      });

      const daySummary = Object.entries(dayMap).slice(-7).map(([day, val]) => {
        const formatted = name.includes('distance') ? val.toFixed(2) : Math.round(val);
        return \`\${day}: \${formatted}\`;
      }).join(', ');

      sections.activity.push(\`- \${displayName}: \${daySummary} \${units}\`);
      continue;
    }

    // C. 统计型指标计算均值与极值
    if (AVERAGING_METRICS.has(name)) {
      const isAgg = data.some((d) => d.Avg !== undefined);
      let avg, max, min;

      if (isAgg) {
        const avgList = data.map((d) => Number(d.Avg)).filter((n) => !isNaN(n));
        avg = (avgList.reduce((a, b) => a + b, 0) / avgList.length).toFixed(1);
        const maxList = data.map((d) => Number(d.Max)).filter((n) => !isNaN(n));
        const minList = data.map((d) => Number(d.Min)).filter((n) => !isNaN(n));
        max = maxList.length ? Math.max(...maxList).toFixed(0) : null;
        min = minList.length ? Math.min(...minList).toFixed(0) : null;
      } else {
        const vals = data.map((d) => Number(d.qty)).filter((n) => !isNaN(n));
        if (vals.length > 0) {
          avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
          max = Math.max(...vals).toFixed(0);
          min = Math.min(...vals).toFixed(0);
        }
      }

      if (avg !== undefined) {
        let line = \`- \${displayName}: 平均 \${avg} \${units}\`;
        if (max && min && (name === 'heart_rate' || name.includes('exposure'))) {
          line += \` (最高 \${max}, 最低 \${min})\`;
        }

        if (name.includes('heart') || name === 'heart_rate_variability') {
          sections.cardio.push(line);
        } else if (name.includes('exposure')) {
          sections.hearing.push(line);
        } else {
          sections.vitals.push(line);
        }
      }
      continue;
    }

    // D. 其他指标兜底
    const last = data[data.length - 1];
    if (last) {
      const val = last.qty !== undefined
        ? Number(last.qty).toFixed(1)
        : (last.Avg !== undefined ? Number(last.Avg).toFixed(1) : '');
      if (val) sections.others.push(\`- \${displayName}: 最近值 \${val} \${units}\`);
    }
  }

  // E. 健身记录
  if (workouts.length > 0) {
    workouts.slice(-5).forEach((w) => {
      const type = w.name || w.activity || '体能训练';
      const duration = w.duration ? (Number(w.duration) / 60).toFixed(0) + '分钟' : '';
      const cals = w.activeEnergy ? Math.round(w.activeEnergy) + 'kcal' : '';
      const date = (w.start || w.date || '').split(' ')[0];
      sections.workouts.push(\`  · \${date} \${type}: \${duration} \${cals}\`);
    });
  }

  const report = [];
  report.push(\`【Apple Watch 最近 7 天健康体征全景（更新于 \${new Date().toLocaleString('zh-CN')}）】\\n\`);
  if (sections.sleep.length) report.push('### 睡眠分析 (Sleep Analysis)\\n' + sections.sleep.join('\\n') + '\\n');
  if (sections.cardio.length) report.push('### 心血管与体能 (Cardio Health)\\n' + sections.cardio.join('\\n') + '\\n');
  if (sections.activity.length) report.push('### 活动与消耗 (Daily Activity)\\n' + sections.activity.join('\\n') + '\\n');
  if (sections.hearing.length) report.push('### 听力与环境 (Hearing & Environment)\\n' + sections.hearing.join('\\n') + '\\n');
  if (sections.vitals.length) report.push('### 呼吸与生理体征 (Vitals)\\n' + sections.vitals.join('\\n') + '\\n');
  if (sections.workouts.length) report.push('### 健身记录 (Workouts)\\n' + sections.workouts.join('\\n') + '\\n');
  if (sections.others.length) report.push('### 其他指标\\n' + sections.others.join('\\n') + '\\n');

  return report.join('\\n');
}

// 5. Webhook 接口实现
app.post('/api/health-webhook', (req, res) => {
  const clientToken = req.headers['x-token'] || req.query.token;
  if (!clientToken || clientToken !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: Secret Token 无效' });
  }

  try {
    const summaryText = cleanHealthData(req.body);
    const stmt = db.prepare(\`
      INSERT INTO health_summary (id, summary_text, updated_at)
      VALUES (1, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET summary_text = excluded.summary_text, updated_at = CURRENT_TIMESTAMP
    \`);
    stmt.run(summaryText);
    return res.json({ success: true, message: 'Health summary saved successfully' });
  } catch (error) {
    console.error('写入错误:', error);
    return res.status(500).json({ error: '数据处理或存储失败' });
  }
});

// 6. MCP Server 工厂函数
function createMcpServer() {
  const server = new McpServer({ name: 'apple-watch-mcp-server', version: '1.0.0' });

  server.tool('get_health_data', '获取用户最近7天的 Apple Watch 全量健康数据汇总', {}, async () => {
    const stmt = db.prepare('SELECT summary_text, updated_at FROM health_summary WHERE id = 1');
    const row = stmt.get();
    if (!row) {
      return { content: [{ type: 'text', text: '暂无健康数据，请确认是否已完成数据同步。' }] };
    }
    return {
      content: [{ type: 'text', text: \`\${row.summary_text}\\n\\n(数据入库时间: \${row.updated_at})\` }],
    };
  });

  return server;
}

// 7. Streamable HTTP 单请求处理端点
const handleMcp = async (req, res) => {
  try {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const mcpServer = createMcpServer();
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('MCP Transport Error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
};

app.all('/mcp', handleMcp);
app.all('/sse', handleMcp);
app.all('/', handleMcp);

app.listen(PORT, '127.0.0.1', () => {
  console.log(\`服务已在 http://127.0.0.1:\${PORT} 启动\`);
});
`;

const HEALTH_DEPLOY_COMMANDS = `npm install
pm2 start server.js --name health-mcp
pm2 save
pm2 startup`;

const PUSH_SERVER_CODE = `/**
 * server.js - PWA 离线推送微服务大脑（脱敏骨架）
 */
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');
const cron = require('node-cron');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const CONFIG_FILE = path.join(__dirname, 'push_data.json');

// 1. VAPID 签名配置（敏感信息从环境变量读取，绝不写进前端代码）
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'YOUR_VAPID_PUBLIC_KEY';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'YOUR_VAPID_PRIVATE_KEY';

webpush.setVapidDetails(
  'mailto:your-email@example.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
);

// 2. 接收手机前端同步的推送凭据与配置
app.post('/api/sync-push-config', (req, res) => {
  const { subscription, apiConfig, character, recentContext } = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ ok: false, error: '缺少有效推送凭据' });
  }

  // 将手机上报的数据持久化到本地 push_data.json
  // （包含用户的 APNs 订阅、自填的 API Key、选中的伴侣人设及冷却状态）
  // ...写入文件逻辑...

  res.json({ ok: true, message: '配置同步成功' });
});

// 3. 全链路即时测试
app.get('/api/test-push', async (req, res) => {
  // 读取已保存的订阅，发送一条测试消息用于验证整条链路
  // ...调用 webpush.sendNotification...
});

// 4. 定时调度核心：随机主动发起逻辑
async function checkAndTrigger() {
  // 步骤 A: 免打扰判断（例如夜间 23:00 ~ 08:00 跳过）
  // 步骤 B: 冷却时间判断（距离上次发送是否已过指定时长）
  // 步骤 C: 概率留白机制（例如 30% 几率本次保持沉默，消除机械定时感）
  // 步骤 D: 呼叫大模型，用人设 Prompt 生成一句话回复
  // 步骤 E: 签名推送到苹果 APNs 服务器
  /*
    const payload = JSON.stringify({
      characterName: character.name,
      type: 'message',
      body: aiReplyText,
      url: '/',
    });
    await webpush.sendNotification(subscription, payload);
  */
  // 步骤 F: 动态计算并更新下一次触发的随机间隔时间，写回本地
}

// 每小时整点巡检一次
cron.schedule('0 * * * *', () => {
  void checkAndTrigger();
});

// 5. 启动服务（务必显式绑定 IPv4，否则 Nginx 反代容易 502）
const PORT = process.env.PORT || 3456;
app.listen(PORT, '0.0.0.0', () => {
  console.log(\`PWA 推送服务已在端口 \${PORT} 启动\`);
});
`;

const PUSH_ENV_EXAMPLE = `# server.js 同目录下的 .env（或直接用环境变量，不要写进前端）
VAPID_PUBLIC_KEY=你的公钥
VAPID_PRIVATE_KEY=你的私钥`;

export const TUTORIAL_ITEMS = [
  // ----------------------------------------------------------------
  // 跨域 Worker（MiniMax 语音）
  // ----------------------------------------------------------------
  {
    id: 'minimax-worker',
    theme: 'cloud',
    icon: Cloud,
    translations: {
      zh: {
        title: '跨域 Worker 部署',
        description: 'Messages 里"打电话"用到的 MiniMax 语音功能，需要它中转跨域请求。',
        blocks: [
          {
            type: 'paragraph',
            text: '浏览器直接请求 MiniMax 官方接口会被 CORS 拦截，所以需要一个免费的 Cloudflare Worker 当中转站：把请求转发给 MiniMax，再把跨域头补齐后返回给 PWA。这个 Worker 只负责转发和补头，不会存你的 MiniMax Key——Key 还是从前端请求里带过去的，不用也不要把 Key 写进 Worker 代码里。',
          },
          {
            type: 'steps',
            heading: '部署步骤',
            items: [
              { title: '新建 Worker', text: '注册 Cloudflare 账号，进入 Workers & Pages，新建一个 Worker。' },
              { title: '粘贴代码', text: '把下面的完整代码粘贴进 Worker 编辑器，替换掉默认模板。' },
              { title: '改成自己的域名', text: '把 ALLOWED_ORIGINS 里的域名换成你自己的：通过 GitHub Pages 部署的话填 https://你的用户名.github.io；本地开发想测试的话把 localhost 那两行留着。' },
              { title: '保存并部署', text: '点击 Deploy，拿到形如 https://xxx.workers.dev 的 Worker 地址。' },
              { title: '填回熔巧机', text: '回到角色设置里的 MiniMax 相关配置，把这个 Worker 地址填进去，保存即可。' },
            ],
          },
          { type: 'code', label: 'worker.js', code: MINIMAX_WORKER_CODE },
          {
            type: 'checklist',
            heading: '验收',
            items: [
              'Worker 部署成功，能访问到 workers.dev 地址',
              'ALLOWED_ORIGINS 已经换成自己的域名',
              '角色设置里填的 Worker 地址已保存',
            ],
          },
          {
            type: 'callout',
            tone: 'warning',
            title: 'Key 不要写进 Worker',
            text: 'MiniMax 的 API Key 应该始终从前端请求头带过去，Worker 代码里不需要、也不应该出现任何真实密钥。',
          },
        ],
      },
      en: {
        title: 'Deploy the CORS Worker',
        description: 'The MiniMax voice feature behind "voice calls" in Messages needs this to relay cross-origin requests.',
        blocks: [
          {
            type: 'paragraph',
            text: "Calling MiniMax's API directly from the browser gets blocked by CORS, so a free Cloudflare Worker sits in between: it forwards the request to MiniMax and adds the missing CORS headers on the way back. The Worker only relays and patches headers — it never stores your MiniMax key, since that still travels in the request from the front end. Don't hardcode any key into the Worker.",
          },
          {
            type: 'steps',
            heading: 'Deployment steps',
            items: [
              { title: 'Create a Worker', text: 'Sign up for Cloudflare, open Workers & Pages, and create a new Worker.' },
              { title: 'Paste the code', text: 'Paste the full code below into the Worker editor, replacing the default template.' },
              { title: 'Point it at your own domain', text: 'Change the domain in ALLOWED_ORIGINS to your own: if you deploy via GitHub Pages, use https://yourname.github.io; keep the localhost lines if you want to test locally.' },
              { title: 'Save and deploy', text: 'Click Deploy to get a worker URL like https://xxx.workers.dev.' },
              { title: 'Paste it back into the app', text: "Go to the character's MiniMax settings and fill in this Worker URL, then save." },
            ],
          },
          { type: 'code', label: 'worker.js', code: MINIMAX_WORKER_CODE },
          {
            type: 'checklist',
            heading: 'Checklist',
            items: [
              'The Worker deployed successfully and its workers.dev URL is reachable',
              'ALLOWED_ORIGINS has been changed to your own domain',
              'The Worker URL is saved in the character settings',
            ],
          },
          {
            type: 'callout',
            tone: 'warning',
            title: "Don't put the key in the Worker",
            text: 'Your MiniMax API key should always travel in the request headers from the front end. The Worker code should never contain a real key.',
          },
        ],
      },
      ko: {
        title: 'CORS Worker 배포하기',
        description: 'Messages의 "전화하기"에 쓰이는 MiniMax 음성 기능이 이걸로 크로스 오리진 요청을 중계합니다.',
        blocks: [
          {
            type: 'paragraph',
            text: '브라우저가 MiniMax API를 직접 호출하면 CORS에 막히기 때문에, 무료 Cloudflare Worker를 중계소로 둡니다: 요청을 MiniMax로 전달하고 돌아올 때 CORS 헤더를 채워 넣습니다. 이 Worker는 전달과 헤더 보정만 하며 MiniMax 키를 저장하지 않습니다 — 키는 여전히 프론트엔드 요청에서 전달됩니다. Worker 코드에 실제 키를 넣지 마세요.',
          },
          {
            type: 'steps',
            heading: '배포 단계',
            items: [
              { title: 'Worker 만들기', text: 'Cloudflare에 가입하고 Workers & Pages에서 새 Worker를 만드세요.' },
              { title: '코드 붙여넣기', text: '아래 전체 코드를 Worker 편집기에 붙여넣어 기본 템플릿을 대체하세요.' },
              { title: '자신의 도메인으로 변경', text: 'ALLOWED_ORIGINS의 도메인을 자신의 것으로 바꾸세요: GitHub Pages로 배포한다면 https://내아이디.github.io로, 로컬 테스트가 필요하면 localhost 두 줄은 남겨두세요.' },
              { title: '저장 후 배포', text: 'Deploy를 눌러 https://xxx.workers.dev 형태의 Worker 주소를 받으세요.' },
              { title: '앱에 다시 입력', text: '캐릭터 설정의 MiniMax 관련 항목에 이 Worker 주소를 입력하고 저장하세요.' },
            ],
          },
          { type: 'code', label: 'worker.js', code: MINIMAX_WORKER_CODE },
          {
            type: 'checklist',
            heading: '체크리스트',
            items: [
              'Worker가 정상 배포되어 workers.dev 주소로 접근됨',
              'ALLOWED_ORIGINS가 자신의 도메인으로 바뀜',
              '캐릭터 설정에 입력한 Worker 주소가 저장됨',
            ],
          },
          {
            type: 'callout',
            tone: 'warning',
            title: '키를 Worker에 넣지 마세요',
            text: 'MiniMax API 키는 항상 프론트엔드 요청 헤더로 전달되어야 합니다. Worker 코드에는 실제 키가 들어가서는 안 됩니다.',
          },
        ],
      },
    },
  },

  // ----------------------------------------------------------------
  // Apple Watch 健康数据 MCP
  // ----------------------------------------------------------------
  {
    id: 'apple-watch-mcp',
    theme: 'apple-health',
    icon: Watch,
    translations: {
      zh: {
        title: 'Apple Watch 健康数据 MCP',
        description: '通过「Health Auto Export」把 HealthKit 数据同步到自己的服务器，再用 MCP 带进对话。',
        blocks: [
          {
            type: 'paragraph',
            text: '整体架构：iPhone 上的「Health Auto Export」App 定时把 HealthKit 数据打包 POST 到你自己的服务器；服务器把逐条采样数据清洗成一段 Markdown 摘要，存进 SQLite；PWA 通过 MCP 的 Streamable HTTP 协议，向服务器要这份摘要。域名走非标端口 + DNS 验证证书，绕开大陆机房对未备案域名 80/443 端口的拦截。',
          },
          {
            type: 'steps',
            heading: '部署步骤',
            items: [
              { title: '域名解析与证书', text: '给域名加一条 A 记录指到服务器公网 IP；申请 SSL 证书时选"手动解析"（DNS 验证，不走 80 端口）；在云厂商安全组和宝塔面板里都放行一个非标端口，例如 1111。' },
              { title: '改监听端口', text: '把站点 Nginx 配置里的 listen 80 / listen 443 换成 listen 1111 ssl，并关闭"强制 HTTPS"，避免被重定向回 443。' },
              { title: '反向代理', text: '把请求转发给本地 Node 服务（例如 127.0.0.1:3055），并关闭 proxy_buffering、开启长连接——这是 MCP 的流式传输能正常工作的关键，配置见下方代码块。' },
              { title: '准备 server.js', text: '用 Node.js 22+ 自带的 node:sqlite 存数据（不要装 better-sqlite3，容易和高版本 Node 的 V8 引擎编译冲突），用 @modelcontextprotocol/sdk 起一个 Streamable HTTP 的 MCP Server，暴露一个 get_health_data 工具。' },
              { title: 'pm2 常驻启动', text: 'npm install 之后执行 pm2 start / save / startup 三条命令（见下方），保证服务器重启后也会自动拉起。' },
              { title: '配置「Health Auto Export」', text: '在 iPhone 上新建一个 REST API 自动化：URL 填你的 webhook 地址，Header 里加一个自定义 Token 做鉴权，导出格式选 JSON v2，时间范围选最近 7 天，勾选想要的健康指标。' },
              { title: '在熔巧机里添加 MCP', text: '协议选 Streamable HTTP，地址填 https://你的域名:端口/mcp（注意路径是 /mcp，不是网站首页），鉴权 Token 留空——读接口是公开的，写接口靠上面配置的 Webhook Token 保护。' },
            ],
          },
          { type: 'code', label: 'nginx 反向代理片段', code: HEALTH_NGINX_CODE },
          { type: 'code', label: 'server.js', code: HEALTH_SERVER_CODE },
          { type: 'code', label: '部署命令', code: HEALTH_DEPLOY_COMMANDS },
          {
            type: 'checklist',
            heading: '验收',
            items: [
              '域名已解析，能 curl 通非标端口',
              'Nginx 反代已关闭 proxy_buffering，流式传输不会卡住',
              'pm2 status 里 health-mcp 一直是 online',
              'Health Auto Export 手动上传一次，返回状态码 200',
              '熔巧机里填的 MCP 地址是 .../mcp，不是网站首页地址',
            ],
          },
          {
            type: 'callout',
            tone: 'warning',
            title: '睡眠数据最容易踩坑',
            text: 'sleep_analysis 字段里的 asleep 和 inBed 经常是 0，真正有效的时长在 totalSleep / deep（深睡）/ core（核心）/ rem（快速眼动）/ awake（清醒）里。上面的 server.js 已经按这几个字段处理了，直接照抄就不会再踩这个坑。',
          },
        ],
      },
      en: {
        title: 'Apple Watch Health Data via MCP',
        description: "Sync HealthKit data to your own server through Health Auto Export, then bring it into the conversation via MCP.",
        blocks: [
          {
            type: 'paragraph',
            text: "Architecture: the Health Auto Export app on iPhone periodically POSTs HealthKit data to your own server; the server cleans the raw samples into a Markdown summary and stores it in SQLite; the PWA asks the server for that summary over MCP's Streamable HTTP protocol. The domain runs on a non-standard port with a DNS-verified certificate, to get around mainland-China hosts blocking ports 80/443 on unregistered domains.",
          },
          {
            type: 'steps',
            heading: 'Deployment steps',
            items: [
              { title: 'DNS and certificate', text: 'Point an A record at your server\'s public IP. Request the SSL certificate with DNS verification (not port 80). Open a non-standard port, e.g. 1111, in both your cloud provider\'s security group and your hosting panel.' },
              { title: 'Change the listening port', text: 'In the site\'s Nginx config, replace "listen 80"/"listen 443" with "listen 1111 ssl", and turn off "force HTTPS" so it doesn\'t redirect back to 443.' },
              { title: 'Reverse proxy', text: 'Forward requests to your local Node service (e.g. 127.0.0.1:3055), with proxy_buffering off and long-lived connections — this is what keeps MCP\'s streaming transport working. See the config snippet below.' },
              { title: 'Prepare server.js', text: "Use Node.js 22+'s built-in node:sqlite for storage (avoid better-sqlite3, which often fails to compile against newer Node/V8). Spin up a Streamable HTTP MCP server with @modelcontextprotocol/sdk that exposes one get_health_data tool." },
              { title: 'Keep it running with pm2', text: 'After npm install, run the three pm2 commands below so the service survives restarts.' },
              { title: 'Configure Health Auto Export', text: 'On iPhone, create a REST API automation: point the URL at your webhook, add a custom token header for auth, export format JSON v2, time range last 7 days, and select the metrics you want.' },
              { title: 'Add the MCP server in the app', text: "Choose Streamable HTTP, address https://yourdomain:port/mcp (note the /mcp path, not the site root), leave the auth token blank — the read endpoint is public, the write endpoint is protected by the webhook token above." },
            ],
          },
          { type: 'code', label: 'nginx reverse proxy snippet', code: HEALTH_NGINX_CODE },
          { type: 'code', label: 'server.js', code: HEALTH_SERVER_CODE },
          { type: 'code', label: 'deploy commands', code: HEALTH_DEPLOY_COMMANDS },
          {
            type: 'checklist',
            heading: 'Checklist',
            items: [
              'The domain resolves and the non-standard port is reachable via curl',
              'proxy_buffering is off in the Nginx config, so streaming does not stall',
              'pm2 status shows health-mcp as online',
              'A manual upload from Health Auto Export returns status 200',
              'The MCP address entered in the app ends in /mcp, not the site root',
            ],
          },
          {
            type: 'callout',
            tone: 'warning',
            title: 'Sleep data is the easiest thing to get wrong',
            text: "The sleep_analysis fields asleep and inBed are often 0 — the real duration lives in totalSleep / deep / core / rem / awake. The server.js above already handles it this way, so copying it as-is avoids the pitfall.",
          },
        ],
      },
      ko: {
        title: 'Apple Watch 건강 데이터 MCP 연동',
        description: 'Health Auto Export로 HealthKit 데이터를 자신의 서버에 동기화하고, MCP로 대화에 가져옵니다.',
        blocks: [
          {
            type: 'paragraph',
            text: '전체 구조: 아이폰의 Health Auto Export 앱이 주기적으로 HealthKit 데이터를 자신의 서버로 POST하고, 서버는 원시 샘플을 Markdown 요약으로 정리해 SQLite에 저장합니다. PWA는 MCP의 Streamable HTTP 프로토콜로 서버에 이 요약을 요청합니다. 도메인은 비표준 포트 + DNS 인증 방식 인증서를 사용해, 미등록 도메인의 80/443 포트를 막는 중국 대륙 호스팅 환경을 피합니다.',
          },
          {
            type: 'steps',
            heading: '배포 단계',
            items: [
              { title: 'DNS와 인증서', text: '도메인 A 레코드를 서버의 공개 IP로 지정하세요. SSL 인증서는 DNS 인증 방식으로 신청하고(80번 포트 사용 안 함), 비표준 포트(예: 1111)를 클라우드 보안 그룹과 호스팅 패널 양쪽 모두에서 열어주세요.' },
              { title: '리스닝 포트 변경', text: '사이트의 Nginx 설정에서 listen 80 / listen 443을 listen 1111 ssl로 바꾸고, "강제 HTTPS"를 꺼서 443으로 리다이렉트되지 않게 하세요.' },
              { title: '리버스 프록시', text: '로컬 Node 서비스(예: 127.0.0.1:3055)로 요청을 전달하며, proxy_buffering을 끄고 연결을 유지하세요 — MCP의 스트리밍 전송이 정상 동작하는 핵심입니다. 아래 설정 조각을 참고하세요.' },
              { title: 'server.js 준비', text: 'Node.js 22+ 내장 node:sqlite로 저장하세요(better-sqlite3는 최신 Node/V8과 컴파일 충돌이 잦아 피하는 게 좋습니다). @modelcontextprotocol/sdk로 get_health_data 도구를 노출하는 Streamable HTTP MCP 서버를 띄우세요.' },
              { title: 'pm2로 상시 구동', text: 'npm install 후 아래 pm2 명령 세 줄을 실행해, 서버 재시작 후에도 자동으로 다시 뜨게 하세요.' },
              { title: 'Health Auto Export 설정', text: '아이폰에서 REST API 자동화를 새로 만드세요: URL은 당신의 webhook 주소, 헤더에 커스텀 토큰을 인증용으로 추가, 내보내기 형식은 JSON v2, 기간은 최근 7일, 원하는 건강 지표를 선택하세요.' },
              { title: '앱에 MCP 서버 추가', text: '프로토콜은 Streamable HTTP, 주소는 https://도메인:포트/mcp(사이트 루트가 아니라 /mcp 경로임에 주의), 인증 토큰은 비워두세요 — 읽기 엔드포인트는 공개이고, 쓰기 엔드포인트는 위의 webhook 토큰으로 보호됩니다.' },
            ],
          },
          { type: 'code', label: 'nginx 리버스 프록시 조각', code: HEALTH_NGINX_CODE },
          { type: 'code', label: 'server.js', code: HEALTH_SERVER_CODE },
          { type: 'code', label: '배포 명령', code: HEALTH_DEPLOY_COMMANDS },
          {
            type: 'checklist',
            heading: '체크리스트',
            items: [
              '도메인이 정상 해석되고 비표준 포트가 curl로 접근됨',
              'Nginx 설정에서 proxy_buffering이 꺼져 있어 스트리밍이 멈추지 않음',
              'pm2 status에서 health-mcp가 계속 online 상태',
              'Health Auto Export에서 수동 업로드 시 상태 코드 200 반환',
              '앱에 입력한 MCP 주소가 /mcp로 끝나며 사이트 루트가 아님',
            ],
          },
          {
            type: 'callout',
            tone: 'warning',
            title: '수면 데이터가 가장 헷갈립니다',
            text: 'sleep_analysis의 asleep, inBed 필드는 자주 0으로 나옵니다. 실제 유효한 시간은 totalSleep / deep / core / rem / awake에 들어 있습니다. 위 server.js는 이미 이 필드들로 처리되어 있으니 그대로 사용하면 이 문제를 피할 수 있습니다.',
          },
        ],
      },
    },
  },

  // ----------------------------------------------------------------
  // iOS PWA 离线主动推送
  // ----------------------------------------------------------------
  {
    id: 'ios-push',
    theme: 'default',
    icon: BellRing,
    translations: {
      zh: {
        title: 'iOS PWA 离线主动推送',
        description: 'PWA 被彻底杀掉、手机息屏锁屏时，角色依然能通过系统级推送主动"敲门"。',
        blocks: [
          {
            type: 'paragraph',
            text: '整体架构：前端是纯静态 PWA，用户配置全在手机本地 IndexedDB；后端是宝塔上的轻量 Node.js 微服务（Express + web-push + node-cron），每小时巡检一次，命中冷却和概率条件后调用大模型生成一句问候，用 VAPID 协议签名后推给 Apple 的 APNs 网关，即使 PWA 被杀掉、手机息屏也能弹出锁屏横幅。',
          },
          {
            type: 'steps',
            heading: '部署步骤',
            items: [
              { title: '门槛检查', text: 'iPhone 系统要 iOS 16.4 及以上；必须通过 Safari「分享」→「添加到主屏幕」，并且从桌面图标打开才算 Standalone 模式；准备一台能装宝塔的云服务器（1核1G/1核2G 即可）和一个域名。' },
              { title: '生成 VAPID 密钥对', text: '在终端运行 npx web-push generate-vapid-keys。Public Key 填进前端设置，Private Key 只放在后端环境变量里，绝不要写进前端代码。' },
              { title: '检查前端 Service Worker', text: '确认 public/sw.js 里有标准的 push 事件监听（解析服务端下发的标题/正文/跳转地址）和 notificationclick 事件（点横幅唤起 PWA），并且严格只处理同源请求，不要误拦截跨域 fetch。如果拿不准，可以把这个文件发给 AI 帮你检查有没有。' },
              { title: '搭建推送微服务', text: '在宝塔 /www/wwwroot/ 下新建 pwa-push-server 目录，装 express / cors / web-push / node-cron，写 server.js：一个接口接收手机上报的推送凭证和人设配置存本地 JSON，一个每小时巡检的定时任务——命中免打扰时段或没到冷却时间就跳过，命中了就调用大模型生成一句问候，再用 web-push 签名推给 Apple。' },
              { title: '域名与证书', text: '买一个域名（哪怕是 .top / .icu 这种便宜后缀），国内平台购买后必须完成实名认证并等待解析生效（通常 5~15 分钟）；宝塔里新建站点绑定二级域名，申请 Let\'s Encrypt 证书并开启强制 HTTPS。' },
              { title: '配置反向代理', text: '把站点反代到本地 Node 服务端口（例如 3456），并确认对 OPTIONS 预检请求返回的 204 响应里带有 Access-Control-Allow-Origin——如果是在 if 块里 return 204，一定要把 add_header 也写在同一个 if 块里，否则会被 Nginx 官方"if 剥离外层 header"的机制吞掉。' },
              { title: '用 pm2 常驻启动', text: '启动后如果终端返回类似 {"error":"尚未绑定任何手机推送凭证"} 这样明确的 JSON，就说明云端环境已经准备就绪，接下来接前端绑定即可。' },
            ],
          },
          { type: 'code', label: 'server.js（脱敏骨架）', code: PUSH_SERVER_CODE },
          { type: 'code', label: '.env 示例', code: PUSH_ENV_EXAMPLE },
          {
            type: 'checklist',
            heading: '验收',
            items: [
              'iOS 16.4+，且是从"添加到主屏幕"的图标打开的',
              'VAPID 私钥只在后端，没有出现在任何前端代码里',
              '域名已完成实名认证，且解析已生效',
              'Node 服务用 app.listen(PORT, \'0.0.0.0\', ...) 显式绑定了 IPv4',
              'curl -i -X OPTIONS 你的接口地址，能在返回头里看到 access-control-allow-origin',
            ],
          },
          {
            type: 'callout',
            tone: 'warning',
            title: 'Load failed 先怀疑 CORS 预检',
            text: 'iOS Safari 对 CORS 预检失败只会统一报 TypeError: Load failed，不会告诉你具体哪一步错了。遇到这个报错，先怀疑 OPTIONS 预检有没有通过、Nginx 的 if 块是不是把 header 丢了，而不是先怀疑自己的业务代码。另外：大陆机房对未备案域名的 80/443 端口有硬件级阻断，改用非标端口（如 8443）通常能绕开。',
          },
          {
            type: 'note',
            text: '这份教程 by 玉元一，请不要把教程本身用于商业用途。',
          },
        ],
      },
      en: {
        title: 'iOS PWA Background Push',
        description: "Even with the PWA fully killed and the phone locked, your character can still knock through a system-level push.",
        blocks: [
          {
            type: 'paragraph',
            text: "Architecture: the front end is a fully static PWA with all user config in local IndexedDB. The back end is a lightweight Node.js service (Express + web-push + node-cron) that checks in every hour; once cooldown and probability conditions line up, it asks an LLM for a one-line greeting, signs it with VAPID, and pushes it through Apple's APNs gateway — which can raise a lockscreen banner even after the PWA has been fully killed.",
          },
          {
            type: 'steps',
            heading: 'Deployment steps',
            items: [
              { title: 'Requirements check', text: 'iOS 16.4 or later. The PWA must be added to the home screen via Safari\'s Share menu and opened from that icon (Standalone mode). You\'ll need a small cloud server (1 core / 1–2GB is enough) and a domain.' },
              { title: 'Generate a VAPID key pair', text: 'Run npx web-push generate-vapid-keys in a terminal. The public key goes into the front-end settings; the private key only ever lives in a back-end environment variable — never in front-end code.' },
              { title: 'Check the front-end service worker', text: 'Confirm public/sw.js has a standard push event listener (parsing title/body/url from the server payload) and a notificationclick handler (focusing the PWA on tap), and that it strictly leaves cross-origin fetches alone. If unsure, hand this file to an AI to check.' },
              { title: 'Build the push microservice', text: 'Create a pwa-push-server folder on your host, install express / cors / web-push / node-cron, and write server.js: one endpoint to receive the phone\'s push subscription and persona config into a local JSON file, and an hourly cron job that skips quiet hours or an unfinished cooldown, otherwise asks an LLM for a greeting and pushes it via web-push.' },
              { title: 'Domain and certificate', text: 'Buy a domain (even a cheap .top/.icu is fine). If bought through a mainland Chinese registrar, complete real-name verification and wait for it to propagate (usually 5–15 minutes). Bind a subdomain to a new site on your panel, request a Let\'s Encrypt certificate, and force HTTPS.' },
              { title: 'Configure the reverse proxy', text: "Proxy the site to your local Node port (e.g. 3456), and make sure the 204 response to OPTIONS preflight requests carries Access-Control-Allow-Origin — if that return 204 lives inside an if block, the add_header must be inside the same block, or Nginx's well-known 'if strips outer headers' behavior will drop it." },
              { title: 'Keep it running with pm2', text: 'Once running, a clear JSON response like {"error":"no phone subscription bound yet"} means the cloud side is ready — wire up the front-end binding next.' },
            ],
          },
          { type: 'code', label: 'server.js (sanitized skeleton)', code: PUSH_SERVER_CODE },
          { type: 'code', label: '.env example', code: PUSH_ENV_EXAMPLE },
          {
            type: 'checklist',
            heading: 'Checklist',
            items: [
              'iOS 16.4+, opened from the home-screen icon',
              'The VAPID private key only exists on the back end, never in front-end code',
              'The domain has completed real-name verification and DNS has propagated',
              "The Node service binds IPv4 explicitly with app.listen(PORT, '0.0.0.0', ...)",
              'curl -i -X OPTIONS against your endpoint shows access-control-allow-origin in the response headers',
            ],
          },
          {
            type: 'callout',
            tone: 'warning',
            title: 'Suspect the CORS preflight first',
            text: "iOS Safari collapses any CORS preflight failure into a single TypeError: Load failed, with no further detail. When you see it, check the OPTIONS preflight and whether an Nginx if block dropped the header before you go digging through your own business logic. Also: mainland-China hosts hard-block ports 80/443 for unregistered domains — switching to a non-standard port (e.g. 8443) usually gets around it.",
          },
          {
            type: 'note',
            text: 'This guide is by 玉元一 — please don\'t use the guide itself for commercial purposes.',
          },
        ],
      },
      ko: {
        title: 'iOS PWA 백그라운드 푸시',
        description: 'PWA를 완전히 종료하고 화면을 꺼둔 상태에서도, 캐릭터가 시스템 푸시로 먼저 말을 걸 수 있습니다.',
        blocks: [
          {
            type: 'paragraph',
            text: '전체 구조: 프론트엔드는 완전한 정적 PWA이고 사용자 설정은 모두 로컬 IndexedDB에 저장됩니다. 백엔드는 가벼운 Node.js 서비스(Express + web-push + node-cron)로, 매시간 점검하며 쿨다운과 확률 조건이 맞으면 LLM에게 짧은 인사말을 요청하고 VAPID로 서명해 Apple의 APNs 게이트웨이로 푸시합니다 — PWA가 완전히 종료된 뒤에도 잠금화면 배너를 띄울 수 있습니다.',
          },
          {
            type: 'steps',
            heading: '배포 단계',
            items: [
              { title: '요구 사항 확인', text: 'iOS 16.4 이상이어야 합니다. Safari의 공유 메뉴로 홈 화면에 추가한 뒤 그 아이콘으로 열어야 Standalone 모드가 됩니다. 작은 클라우드 서버(1코어/1~2GB면 충분)와 도메인이 필요합니다.' },
              { title: 'VAPID 키 쌍 생성', text: '터미널에서 npx web-push generate-vapid-keys를 실행하세요. Public Key는 프론트엔드 설정에, Private Key는 백엔드 환경 변수에만 두세요 — 프론트엔드 코드에는 절대 넣지 마세요.' },
              { title: '프론트엔드 서비스 워커 확인', text: 'public/sw.js에 표준 push 이벤트 리스너(서버가 보낸 제목/본문/URL 파싱)와 notificationclick 핸들러(탭 시 PWA 포커스)가 있는지, 그리고 크로스 오리진 fetch는 절대 가로채지 않는지 확인하세요. 확실하지 않다면 이 파일을 AI에게 보여주고 점검을 부탁하세요.' },
              { title: '푸시 마이크로서비스 구축', text: '호스트에 pwa-push-server 폴더를 만들고 express / cors / web-push / node-cron을 설치한 뒤 server.js를 작성하세요: 하나는 휴대폰의 푸시 구독과 캐릭터 설정을 받아 로컬 JSON에 저장하는 엔드포인트, 다른 하나는 매시간 도는 cron 작업으로 방해 금지 시간대나 쿨다운 중이면 건너뛰고, 아니면 LLM에게 인사말을 받아 web-push로 전송합니다.' },
              { title: '도메인과 인증서', text: '도메인을 하나 구매하세요(.top/.icu 같은 저가 도메인도 괜찮습니다). 중국 대륙 등록기관에서 구매했다면 실명 인증을 마치고 전파를 기다리세요(보통 5~15분). 패널에서 서브도메인으로 새 사이트를 만들고 Let\'s Encrypt 인증서를 발급받아 HTTPS를 강제하세요.' },
              { title: '리버스 프록시 설정', text: '사이트를 로컬 Node 포트(예: 3456)로 프록시하고, OPTIONS 프리플라이트에 대한 204 응답에 Access-Control-Allow-Origin이 포함되는지 확인하세요 — 그 return 204가 if 블록 안에 있다면 add_header도 반드시 같은 블록 안에 있어야 합니다. 그렇지 않으면 Nginx의 잘 알려진 "if가 바깥쪽 헤더를 지운다" 동작 때문에 헤더가 사라집니다.' },
              { title: 'pm2로 상시 구동', text: '실행 후 {"error":"아직 등록된 휴대폰 구독이 없습니다"}처럼 명확한 JSON 응답이 나오면 클라우드 쪽은 준비된 것입니다. 다음으로 프론트엔드 바인딩을 연결하세요.' },
            ],
          },
          { type: 'code', label: 'server.js (익명화된 골격)', code: PUSH_SERVER_CODE },
          { type: 'code', label: '.env 예시', code: PUSH_ENV_EXAMPLE },
          {
            type: 'checklist',
            heading: '체크리스트',
            items: [
              'iOS 16.4+이며 홈 화면 아이콘으로 열림',
              'VAPID 개인 키가 백엔드에만 있고 프론트엔드 코드에는 없음',
              '도메인 실명 인증이 완료되고 DNS가 전파됨',
              "Node 서비스가 app.listen(PORT, '0.0.0.0', ...)로 IPv4를 명시적으로 바인딩함",
              'curl -i -X OPTIONS로 엔드포인트를 호출하면 응답 헤더에 access-control-allow-origin이 보임',
            ],
          },
          {
            type: 'callout',
            tone: 'warning',
            title: 'Load failed면 먼저 CORS 프리플라이트를 의심하세요',
            text: 'iOS Safari는 CORS 프리플라이트 실패를 전부 TypeError: Load failed 하나로 뭉뚱그립니다. 이 에러를 보면 자신의 비즈니스 로직을 파기 전에 OPTIONS 프리플라이트가 통과했는지, Nginx의 if 블록이 헤더를 날리지 않았는지 먼저 확인하세요. 참고로 중국 대륙 호스트는 미등록 도메인의 80/443 포트를 하드웨어 수준에서 막는 경우가 많으니, 비표준 포트(예: 8443)로 바꾸면 보통 우회할 수 있습니다.',
          },
          {
            type: 'note',
            text: '이 가이드는 玉元一가 작성했습니다. 가이드 자체를 상업적으로 사용하지 말아 주세요.',
          },
        ],
      },
    },
  },
];

export default TUTORIAL_ITEMS;