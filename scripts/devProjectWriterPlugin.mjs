// @ts-check
/**
 * Dev-only "save to project" endpoints for the Dev Tools editors (Cutscene Editor, Map Editor).
 *
 * Runs only under `astro dev` (`apply: 'serve'`) and only answers loopback requests. Writes are
 * limited to an allowlist of content folders, and the editor's own writes are kept from
 * triggering a page reload so editing state isn't lost.
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PREFIX = '/__me-dev/';
const MAX_UPLOAD_BYTES = 60 * 1024 * 1024;

/** @type {RegExp[]} */
const WRITABLE_JSON = [
  /^src\/mystery-emblem\/data\/cutscenes\/[a-z0-9_]+\.json$/,
  /^src\/mystery-emblem\/data\/cutscenes\/locations\/[a-z0-9_]+\.json$/,
  /^src\/mystery-emblem\/data\/chapters\/[a-z0-9_]+\/dialogue\/[a-z0-9_]+\.json$/,
  /^src\/mystery-emblem\/data\/chapters\/[a-z0-9_]+\/chapter\.json$/,
  /^src\/mystery-emblem\/audio\/trackSettings\.json$/,
];
/** @type {RegExp[]} */
const DELETABLE = [
  /^src\/mystery-emblem\/data\/cutscenes\/[a-z0-9_]+\.json$/,
  /^src\/mystery-emblem\/data\/cutscenes\/locations\/[a-z0-9_]+\.json$/,
  /^src\/mystery-emblem\/data\/chapters\/[a-z0-9_]+\/dialogue\/[a-z0-9_]+\.json$/,
];
/** @type {Record<string, RegExp>} */
const UPLOAD_FOLDERS = {
  'cutscene-backgrounds': /\.(png|webp|gif|jpe?g)$/i,
  'cutscene-props': /\.(png|webp|gif|jpe?g)$/i,
  sfx: /\.(mp3|ogg|opus|webm|wav|m4a)$/i,
  audio: /\.(mp3|ogg|opus|webm|wav|m4a)$/i,
};

/** @param {import('node:http').IncomingMessage} req */
function readBody(req, limit = MAX_UPLOAD_BYTES) {
  return new Promise((resolve, reject) => {
    /** @type {Buffer[]} */
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('File is too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** @param {import('node:http').ServerResponse} res @param {number} status @param {unknown} body */
function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

/** @param {string} name */
function sanitizeFileName(name) {
  const base = path.basename(name).replace(/[^\w.\- ()]+/g, '_').trim();
  return base.replace(/^\.+/, '') || 'upload';
}

/** @returns {import('vite').Plugin} */
export function devProjectWriterPlugin() {
  /** @type {string} */
  let root = process.cwd();
  /** @type {Map<string, number>} */
  const recentWrites = new Map();
  /** @param {string} abs */
  const markWritten = (abs) => recentWrites.set(path.normalize(abs).toLowerCase(), Date.now());
  /** @param {string} file */
  const isRecentWrite = (file) => {
    const key = path.normalize(file).toLowerCase();
    const at = recentWrites.get(key);
    if (at === undefined) return false;
    if (Date.now() - at > 4000) {
      recentWrites.delete(key);
      return false;
    }
    return true;
  };

  return {
    name: 'mystery-emblem-dev-project-writer',
    apply: 'serve',
    configResolved(config) {
      root = config.root;
    },
    hotUpdate: {
      order: 'post',
      handler({ file }) {
        if (isRecentWrite(file)) return [];
      },
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith(PREFIX)) return next();
        const remote = req.socket.remoteAddress ?? '';
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)) {
          sendJson(res, 403, { ok: false, error: 'Local requests only.' });
          return;
        }
        const url = new URL(req.url, 'http://localhost');
        const action = url.pathname.slice(PREFIX.length);
        try {
          if (action === 'status' && req.method === 'GET') {
            sendJson(res, 200, { ok: true });
            return;
          }
          if (req.method !== 'POST') {
            sendJson(res, 405, { ok: false, error: 'POST only.' });
            return;
          }
          if (action === 'write' || action === 'delete') {
            const body = JSON.parse((await readBody(req, 8 * 1024 * 1024)).toString('utf8'));
            const rel = String(body.path ?? '').replace(/\\/g, '/');
            const allow = action === 'write' ? WRITABLE_JSON : DELETABLE;
            if (!allow.some((re) => re.test(rel))) {
              sendJson(res, 400, { ok: false, error: `Not allowed: ${rel}` });
              return;
            }
            const abs = path.join(root, rel);
            markWritten(abs);
            if (action === 'write') {
              const content = String(body.content ?? '');
              JSON.parse(content);
              await mkdir(path.dirname(abs), { recursive: true });
              await writeFile(abs, content, 'utf8');
            } else {
              await rm(abs, { force: true });
            }
            sendJson(res, 200, { ok: true, path: rel });
            return;
          }
          if (action === 'upload') {
            const folder = url.searchParams.get('folder') ?? '';
            const pattern = UPLOAD_FOLDERS[folder];
            const name = sanitizeFileName(url.searchParams.get('name') ?? '');
            if (!pattern || !pattern.test(name)) {
              sendJson(res, 400, { ok: false, error: `Unsupported file type for ${folder}: ${name}` });
              return;
            }
            const data = await readBody(req);
            const dir = path.join(root, 'assets', folder);
            await mkdir(dir, { recursive: true });
            const abs = path.join(dir, name);
            markWritten(abs);
            await writeFile(abs, data);
            sendJson(res, 200, { ok: true, name, bytes: data.length });
            return;
          }
          sendJson(res, 404, { ok: false, error: 'Unknown action.' });
        } catch (err) {
          sendJson(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
        }
      });
    },
  };
}
