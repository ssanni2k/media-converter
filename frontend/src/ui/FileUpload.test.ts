import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountFileUpload } from './FileUpload';

function createMockStore() {
  return {
    setSelectedFile: vi.fn(),
    selectedFormat: 'mp3' as any,
    conversion: { status: 'idle' as const, progress: 0 },
    on: vi.fn(),
    off: vi.fn(),
  };
}

describe('mountFileUpload', () => {
  let container: HTMLElement;
  let store: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    store = createMockStore();
  });

  it('renders upload zone with label, icon, hint', () => {
    mountFileUpload(container, store);

    expect(container.querySelector('.upload-zone')).toBeTruthy();
    expect(container.querySelector('.upload-zone__label')).toBeTruthy();
    expect(container.querySelector('.upload-zone__icon')).toBeTruthy();
    expect(container.querySelector('.upload-zone__hint')).toBeTruthy();
    expect(container.querySelector('.upload-zone__size-limit')).toBeTruthy();
  });

  it('renders file input with correct accept attribute', () => {
    mountFileUpload(container, store);

    const input = container.querySelector('.upload-zone__input') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.accept).toBe('audio/*,video/*');
  });

  it('calls store.setSelectedFile on file input change', () => {
    mountFileUpload(container, store);

    const input = container.querySelector('.upload-zone__input') as HTMLInputElement;
    const file = new File(['data'], 'video.mp4', { type: 'video/mp4' });

    // Mock files property and trigger change event
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });
    input.dispatchEvent(new Event('change'));

    expect(store.setSelectedFile).toHaveBeenCalledWith(file);
  });

  it('subscribes to file:change and conversion:change events', () => {
    mountFileUpload(container, store);

    expect(store.on).toHaveBeenCalledWith('file:change', expect.any(Function));
    expect(store.on).toHaveBeenCalledWith('conversion:change', expect.any(Function));
  });

  it('cleanup removes event listeners and store subscriptions', () => {
    const cleanup = mountFileUpload(container, store);
    const fileListener = store.on.mock.calls.find((c: any[]) => c[0] === 'file:change')?.[1];
    const conversionListener = store.on.mock.calls.find((c: any[]) => c[0] === 'conversion:change')?.[1];

    cleanup();

    expect(store.off).toHaveBeenCalledWith('file:change', fileListener);
    expect(store.off).toHaveBeenCalledWith('conversion:change', conversionListener);
  });

  it('shows selected file info when file:change fires with a file', () => {
    mountFileUpload(container, store);

    const file = new File(['data'], 'video.mp4', { type: 'video/mp4' });
    const fileListener = store.on.mock.calls.find((c: any[]) => c[0] === 'file:change')?.[1];

    fileListener(file);

    expect(container.querySelector('.upload-zone__selected')!.getAttribute('style')).not.toContain('none');
    expect(container.querySelector('.upload-zone__file-name')!.textContent).toBe('video.mp4');
  });

  it('clears file info when file:change fires with null', () => {
    mountFileUpload(container, store);

    // First set a file
    const file = new File(['data'], 'video.mp4', { type: 'video/mp4' });
    const fileListener = store.on.mock.calls.find((c: any[]) => c[0] === 'file:change')?.[1];
    fileListener(file);

    // Then clear it
    fileListener(null);

    expect(container.querySelector('.upload-zone__label')!.getAttribute('style')).not.toContain('none');
    expect(container.querySelector('.upload-zone__selected')!.getAttribute('style')).toContain('none');
  });
});
