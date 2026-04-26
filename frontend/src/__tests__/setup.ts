import { vi } from 'vitest';

// Mock localStorage with a Map
const storage = new Map<string, string>();

const localStorageMock = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
  removeItem: vi.fn((key: string) => storage.delete(key)),
  clear: vi.fn(() => storage.clear()),
  get length() { return storage.size; },
  key: vi.fn((index: number) => [...storage.keys()][index] ?? null),
};

Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

// Mock EventSource
class MockEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  url: string;
  readyState = MockEventSource.CONNECTING;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  private _listeners = new Map<string, Set<EventListener>>();

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = MockEventSource.OPEN;
      this.onopen?.(new Event('open'));
    }, 0);
  }

  addEventListener(type: string, listener: EventListener) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: EventListener) {
    this._listeners.get(type)?.delete(listener);
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
  }

  _simulateMessage(data: unknown) {
    const event = new MessageEvent('message', { data: JSON.stringify(data) });
    this.onmessage?.(event);
    this._listeners.get('message')?.forEach(l => l(event));
  }

  _simulateError() {
    const event = new Event('error');
    this.onerror?.(event);
    this._listeners.get('error')?.forEach(l => l(event));
  }
}

const eventSourceInstances: MockEventSource[] = [];

vi.stubGlobal('EventSource', class extends MockEventSource {
  constructor(url: string) {
    super(url);
    eventSourceInstances.push(this);
  }
});

export function getLastEventSource(): MockEventSource | undefined {
  return eventSourceInstances[eventSourceInstances.length - 1];
}

export function clearEventSources(): void {
  eventSourceInstances.length = 0;
}
