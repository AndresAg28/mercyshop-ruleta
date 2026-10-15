import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { randomInt, randomUUID } from 'node:crypto';

const redisUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;
// En Vercel faltan credenciales = error de configuración; en desarrollo local
// (sin .env.local) guardamos en memoria para que /api/room funcione igual.
const onVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
const memory = new Map<string, { room: Stored; exp: number }>();

const TTL = 60 * 60 * 24 * 3; // las salas expiran a los 3 días
const DURATION = 7000;

interface Participant { id: string; name: string }
interface Stored {
  id: string; token: string; title: string;
  participants: Participant[];
  spin: null | { id: string; winnerId: string; winnerName: string; startedAt: number; durationMs: number; turns: number; offset: number };
  history: { id: string; name: string; revealAt: number }[];
  updatedAt: number;
}

const key = (id: string) => `room:${id}`;

async function load(id: string): Promise<Stored | null> {
  if (redis) return redis.get<Stored>(key(id));
  if (onVercel) throw new Error('Faltan KV_REST_API_URL / KV_REST_API_TOKEN');
  const entry = memory.get(id);
  if (!entry) return null;
  if (entry.exp <= Date.now()) { memory.delete(id); return null; }
  return structuredClone(entry.room);
}

async function save(room: Stored): Promise<void> {
  if (redis) { await redis.set(key(room.id), room, { ex: TTL }); return; }
  if (onVercel) throw new Error('Faltan KV_REST_API_URL / KV_REST_API_TOKEN');
  memory.set(room.id, { room: structuredClone(room), exp: Date.now() + TTL * 1000 });
}

const view = ({ token, ...room }: Stored) => ({ ...room, serverNow: Date.now() });
const isSpinning = (r: Stored) => !!r.spin && Date.now() < r.spin.startedAt + r.spin.durationMs;

const clean = (list: unknown): Participant[] =>
  (Array.isArray(list) ? list : []).slice(0, 200).map((p: any) => ({
    id: String(p.id ?? randomUUID()).slice(0, 64),
    name: String(p.name ?? '').trim().slice(0, 40)
  })).filter(p => p.name);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      const room = await load(String(req.query['id']));
      return room ? res.json(view(room)) : res.status(404).json({ error: 'Sala no encontrada' });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { action, id, token, title, participants } = req.body ?? {};

    if (action === 'create') {
      const room: Stored = {
        id: randomUUID().replace(/-/g, '').slice(0, 10), token: randomUUID(),
        title: String(title ?? 'Ruleta MercyShop').slice(0, 60),
        participants: [], spin: null, history: [], updatedAt: Date.now()
      };
      await save(room);
      return res.json({ id: room.id, token: room.token });
    }

    const room = await load(String(id));
    if (!room) return res.status(404).json({ error: 'Sala no encontrada' });
    if (room.token !== token) return res.status(403).json({ error: 'Solo la persona moderadora puede hacer esto' });
    if (isSpinning(room)) return res.status(409).json({ error: 'Hay un giro en curso' });

    if (action === 'save') {
      room.participants = clean(participants);
      if (typeof title === 'string' && title.trim()) room.title = title.trim().slice(0, 60);
    } else if (action === 'spin') {
      if (room.participants.length < 2) return res.status(400).json({ error: 'Agrega al menos 2 participantes' });
      // El ganador lo elige el servidor con un generador criptográfico: nadie puede manipularlo.
      const winner = room.participants[randomInt(room.participants.length)];
      const startedAt = Date.now();
      room.spin = { id: randomUUID(), winnerId: winner.id, winnerName: winner.name, startedAt, durationMs: DURATION, turns: 6 + randomInt(3), offset: randomInt(1000) / 1000 };
      room.history = [{ id: room.spin.id, name: winner.name, revealAt: startedAt + DURATION }, ...room.history].slice(0, 50);
    } else if (action === 'clearHistory') {
      room.history = [];
    } else {
      return res.status(400).json({ error: 'Acción inválida' });
    }

    room.updatedAt = Date.now();
    await save(room);
    return res.json(view(room));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error del servidor' });
  }
}
