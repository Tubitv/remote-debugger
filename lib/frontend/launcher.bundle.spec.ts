import { RemoteDebuggerLauncher, remoteDebuggerLauncher } from './launcher.bundle';

describe('launcher', () => {
  test('should have uuid', () => {
    expect(remoteDebuggerLauncher.uuid).toBeDefined();
  });

  test('should use the same uuid all the time', () => {
    expect((new RemoteDebuggerLauncher()).uuid).toBe(remoteDebuggerLauncher.uuid);
  });

  test('should support toggle', () => {
    const anotherOne = new RemoteDebuggerLauncher();
    expect(anotherOne.enabled).toBe(false);
    anotherOne.toggle();
    expect(anotherOne.enabled).toBe(true);
    anotherOne.toggle();
    expect(anotherOne.enabled).toBe(false);
  });

  test('getStatus should work', async () => {
    const anotherOne = new RemoteDebuggerLauncher();
    let status = await anotherOne.getStatus();
    expect(status.enabled).toBe(false);
    anotherOne.toggle();
    status = await anotherOne.getStatus();
    expect(status.enabled).toBe(true);
  });

  test('"create" and "delete" lifecycle events get called correctly', () => {
    const [createFn, destroyFn] = [jest.fn(), jest.fn()];
    window.addEventListener('remoteDebuggerCreated', createFn);
    const anotherOne = new RemoteDebuggerLauncher();
    anotherOne.addListener('destroy', destroyFn);
    expect(createFn).toHaveBeenCalledTimes(0);
    expect(destroyFn).toHaveBeenCalledTimes(0);

    anotherOne.toggle();
    expect(createFn).toHaveBeenCalledTimes(1);
    expect(destroyFn).toHaveBeenCalledTimes(0);

    anotherOne.toggle();
    expect(destroyFn).toHaveBeenCalledTimes(1);
    expect(createFn).toHaveBeenCalledTimes(1);
    window.removeEventListener('remoteDebuggerCreated', createFn);
    anotherOne.removeListener('destroy', destroyFn);
  });
});
