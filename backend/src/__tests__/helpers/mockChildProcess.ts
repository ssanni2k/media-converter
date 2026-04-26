import { vi } from 'vitest';
import { EventEmitter } from 'events';

export function createMockChildProcess() {
  const emitter = new EventEmitter();

  const mockProcess = {
    stdin: { end: vi.fn() },
    stdout: emitter,
    stderr: emitter,
    kill: vi.fn(),
    on: vi.fn((event: string, handler: (...args: any[]) => void) => {
      emitter.on(event, handler);
      return mockProcess;
    }),
    _emitStdout: (data: string) => emitter.emit('data', Buffer.from(data)),
    _emitStderr: (data: Buffer) => emitter.emit('data', data),
    _emitClose: (code: number | null) => emitter.emit('close', code),
    _emitError: (err: Error) => emitter.emit('error', err),
  };

  return mockProcess;
}

export function mockSpawn(mockProcess: ReturnType<typeof createMockChildProcess>) {
  return vi.fn(() => mockProcess);
}
