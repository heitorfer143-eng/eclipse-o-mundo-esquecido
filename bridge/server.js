import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';

const PORT = Number(process.env.PORT || 3000);
const MANUS_API_KEY = process.env.MANUS_API_KEY || '';
const BRIDGE_TOKEN = process.env.ECLIPSE_BRIDGE_TOKEN || '';
const MANUS_PROJECT_ID = process.env.MANUS_PROJECT_ID || '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://heitorfer143-eng.github.io';

function send(res, status, payload, extraHeaders = {}) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

function authorized(req) {
  const supplied = req.headers['x-eclipse-bridge-token'];
  if (!BRIDGE_TOKEN || typeof supplied !== 'string') return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(BRIDGE_TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 32_768) throw Object.assign(new Error('Corpo muito grande.'), { status: 413 });
  }
  try { return raw ? JSON.parse(raw) : {}; }
  catch { throw Object.assign(new Error('JSON inválido.'), { status: 400 }); }
}

async function manus(path, options = {}) {
  if (!MANUS_API_KEY) throw Object.assign(new Error('MANUS_API_KEY não configurada no Railway.'), { status: 503 });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(`https://api.manus.ai/v2/${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-manus-api-key': MANUS_API_KEY,
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      const message = data?.error?.message || 'A API do Manus recusou a solicitação.';
      throw Object.assign(new Error(message), { status: response.status || 502 });
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const cors = origin === ALLOWED_ORIGIN ? {
    'access-control-allow-origin': ALLOWED_ORIGIN,
    'vary': 'Origin',
    'access-control-allow-headers': 'content-type,x-eclipse-bridge-token',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  } : {};

  if (req.method === 'OPTIONS') {
    if (origin && origin !== ALLOWED_ORIGIN) return send(res, 403, { error: 'Origem não permitida.' });
    res.writeHead(204, cors);
    return res.end();
  }
  if (origin && origin !== ALLOWED_ORIGIN) return send(res, 403, { error: 'Origem não permitida.' });
  if (req.url === '/health' && req.method === 'GET') {
    return send(res, 200, {
      ok: true,
      service: 'eclipse-agent-bridge',
      manusConfigured: Boolean(MANUS_API_KEY),
      accessConfigured: Boolean(BRIDGE_TOKEN),
    }, cors);
  }
  if (!authorized(req)) return send(res, 401, { error: 'Acesso não autorizado.' }, cors);

  try {
    if (req.method === 'POST' && req.url === '/api/manus/tasks') {
      const body = await readJson(req);
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (!message || message.length > 18_000) {
        return send(res, 400, { error: 'Informe uma tarefa de 1 a 18.000 caracteres.' }, cors);
      }
      const repoContext = [
        'Projeto: Eclipse — O Mundo Esquecido.',
        'Repositório GitHub: heitorfer143-eng/eclipse-o-mundo-esquecido.',
        'Stack: Three.js, TypeScript e Vite; publicação via GitHub Pages.',
        'Antes de editar, inspecione o estado mais recente do repositório e os commits recentes.',
        'Preserve sistemas existentes e mudanças de outros colaboradores. Não reescreva o jogo do zero.',
        'Não exponha segredos, tokens ou dados privados em arquivos, commits ou logs.',
        'Não faça force-push nem apague arquivos sem necessidade.',
        'Prefira branch própria e pull request; não publique diretamente em main se houver suporte a PR.',
        'Execute build e testes disponíveis e relate exatamente o que passou ou falhou.',
        'Tarefa solicitada:'
      ].join('\n');
      const data = await manus('task.create', {
        method: 'POST',
        body: JSON.stringify({
          message: { content: [{ type: 'text', text: repoContext + '\n' + message, visibility: 'visible' }] },
          ...(MANUS_PROJECT_ID ? { project_id: MANUS_PROJECT_ID } : {}),
          locale: 'pt-BR',
          interactive_mode: true,
          share_visibility: 'private',
          agent_profile: body.agent_profile === 'lite' || body.agent_profile === 'max' ? body.agent_profile : 'standard',
          ...(typeof body.title === 'string' && body.title.trim() ? { title: body.title.trim().slice(0, 120) } : {}),
        }),
      });
      return send(res, 201, {
        ok: true,
        task_id: data.task_id,
        task_title: data.task_title,
        task_url: data.task_url,
        share_visibility: data.share_visibility || 'private',
      }, cors);
    }

    const taskMatch = req.url?.match(/^\/api\/manus\/tasks\/([A-Za-z0-9_-]{8,80})\/messages$/);
    if (taskMatch && req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const data = await manus('task.listMessages?' + new URLSearchParams({
        task_id: taskMatch[1],
        order: 'desc',
        limit: String(Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 30)))),
      }));
      return send(res, 200, {
        ok: true,
        task_id: data.task_id,
        messages: (data.messages || []).map((item) => ({
          id: item.id,
          type: item.type,
          timestamp: item.timestamp,
          content: item.assistant_message?.content || item.user_message?.content || item.status_update?.brief || item.error_message?.content || '',
          status: item.status_update?.agent_status || null,
          attachments: item.assistant_message?.attachments || [],
        })),
      }, cors);
    }

    if (taskMatch && req.method === 'POST') {
      const body = await readJson(req);
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (!message || message.length > 18_000) {
        return send(res, 400, { error: 'Informe uma mensagem de 1 a 18.000 caracteres.' }, cors);
      }
      const data = await manus('task.sendMessage', {
        method: 'POST',
        body: JSON.stringify({
          task_id: taskMatch[1],
          message: { content: [{ type: 'text', text: message, visibility: 'visible' }] },
        }),
      });
      return send(res, 200, { ok: true, task_id: data.task_id }, cors);
    }

    return send(res, 404, { error: 'Rota não encontrada.' }, cors);
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 502;
    return send(res, status, { error: error.message || 'Falha ao comunicar com Manus.' }, cors);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Eclipse Agent Bridge listening on ${PORT}`);
});
