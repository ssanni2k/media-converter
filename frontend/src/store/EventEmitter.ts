// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener = (...args: any[]) => void;

export class EventEmitter<TEventMap extends Record<string, unknown>> {
  private listeners = new Map<keyof TEventMap, Set<Listener>>();

  on<K extends keyof TEventMap>(event: K, listener: Listener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off<K extends keyof TEventMap>(event: K, listener: Listener): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit<K extends keyof TEventMap>(event: K, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((listener) => listener(...args));
  }
}
