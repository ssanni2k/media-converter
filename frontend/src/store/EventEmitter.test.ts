import { describe, it, expect } from 'vitest';
import { EventEmitter } from './EventEmitter';

interface TestEvents {
  'click': void;
  'data': string;
  'update': { value: number };
}

describe('EventEmitter', () => {
  it('registers a listener with on', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();
    emitter.on('click', listener);
    emitter.emit('click');
    expect(listener).toHaveBeenCalledOnce();
  });

  it('calls all registered listeners for an event', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    emitter.on('click', listener1);
    emitter.on('click', listener2);
    emitter.emit('click');
    expect(listener1).toHaveBeenCalledOnce();
    expect(listener2).toHaveBeenCalledOnce();
  });

  it('removes a listener with off', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();
    emitter.on('click', listener);
    emitter.off('click', listener);
    emitter.emit('click');
    expect(listener).not.toHaveBeenCalled();
  });

  it('does not throw when emitting to no listeners', () => {
    const emitter = new EventEmitter<TestEvents>();
    expect(() => emitter.emit('click')).not.toThrow();
  });

  it('passes arguments to listeners', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();
    emitter.on('data', listener);
    emitter.emit('data', 'hello');
    expect(listener).toHaveBeenCalledWith('hello');
  });

  it('passes object arguments to listeners', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();
    emitter.on('update', listener);
    emitter.emit('update', { value: 42 });
    expect(listener).toHaveBeenCalledWith({ value: 42 });
  });

  it('only affects listeners for the specific event', () => {
    const emitter = new EventEmitter<TestEvents>();
    const clickListener = vi.fn();
    const dataListener = vi.fn();
    emitter.on('click', clickListener);
    emitter.on('data', dataListener);
    emitter.emit('click');
    expect(clickListener).toHaveBeenCalledOnce();
    expect(dataListener).not.toHaveBeenCalled();
  });
});
