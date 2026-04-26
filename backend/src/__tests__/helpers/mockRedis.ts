import { vi } from 'vitest';

export function createMockRedis() {
  const store = new Map<string, Record<string, string>>();
  const lists = new Map<string, string[]>();
  const channels = new Map<string, Set<(msg: string) => void>>();

  return {
    hset: vi.fn(async (key: string, field: string, value: string) => {
      if (!store.has(key)) store.set(key, {});
      store.get(key)![field] = String(value);
      return 1;
    }),
    hget: vi.fn(async (key: string, field: string) => {
      return store.get(key)?.[field] ?? null;
    }),
    hgetall: vi.fn(async (key: string) => {
      return store.get(key) ?? {};
    }),
    expire: vi.fn(async () => {}),
    keys: vi.fn(async (pattern: string) => {
      const prefix = pattern.replace(/\*/g, '');
      return [...store.keys()].filter(k => k.startsWith(prefix));
    }),
    rpush: vi.fn(async (key: string, value: string) => {
      const list = lists.get(key) ?? [];
      list.push(value);
      lists.set(key, list);
      return list.length;
    }),
    lrange: vi.fn(async (key: string, start: number, stop: number) => {
      const list = lists.get(key) ?? [];
      const end = stop === -1 ? list.length : stop + 1;
      return list.slice(start, end);
    }),
    lrem: vi.fn(async (key: string, _count: number, value: string) => {
      const list = lists.get(key) ?? [];
      const idx = list.indexOf(value);
      if (idx !== -1) list.splice(idx, 1);
      lists.set(key, list);
      return idx !== -1 ? 1 : 0;
    }),
    eval: vi.fn(async (_script: string, _numkeys: number, key: string, ...args: string[]) => {
      const items = lists.get(key) ?? [];
      const parsed = items.map(i => JSON.parse(i));

      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        const targetPriority = args[0];
        const workerId = args[1];

        if (item.status === 'waiting' && item.priority === targetPriority) {
          item.status = 'assigned';
          item.assignedWorker = workerId;
          items[i] = JSON.stringify(item);
          return JSON.stringify({ ...item, jobId: item.jobId, data: item.data, priority: item.priority, assignedWorker: item.assignedWorker, status: item.status });
        }
      }
      return false;
    }),
    publish: vi.fn(async (channel: string, message: string) => {
      const subs = channels.get(channel) ?? new Set();
      subs.forEach(cb => cb(message));
      return 1;
    }),
    subscribe: vi.fn(async () => {}),
    unsubscribe: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
    on: vi.fn(),
    pipeline: vi.fn(() => ({
      hgetall: vi.fn(function(this: any) { return this; }),
      exec: vi.fn(async () => []),
    })),
    _getStore: () => store,
    _getLists: () => lists,
    _getChannels: () => channels,
    _simulateMessage: (channel: string, message: string) => {
      channels.get(channel)?.forEach(cb => cb(message));
    },
  };
}
