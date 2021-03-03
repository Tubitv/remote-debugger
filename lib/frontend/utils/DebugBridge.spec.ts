import { DebugBridge } from './DebugBridge';

describe('Bridge method management', () => {
  let bridge: DebugBridge;

  beforeEach(() => {
    bridge = new DebugBridge();
  });

  afterEach(() => {
    bridge.destroy();
  });

  test('`addNamespace` should add a namespace to internal storage', () => {
    bridge.addNamespace('MockMap', {});
    /* eslint-disable-next-line dot-notation */
    expect(bridge['namespaceMap']).toHaveProperty('MockMap');
  });

  test('`removeNamespace` should remove a namespace in internal storage', () => {
    bridge.addNamespace('MockMap', {});
    bridge.removeNamespace('MockMap');
    /* eslint-disable-next-line dot-notation */
    expect((bridge['namespaceMap'])).not.toHaveProperty('MockMap');
  });

  test('`execute` should call namespace method in internal storage', async () => {
    const refresh = jest.fn();
    bridge.addNamespace('MockMap', {
      refresh,
    });

    await bridge.execute('MockMap', 'refresh', 1, 2, 3);
    expect(refresh).toHaveBeenCalledWith(1, 2, 3);
  });

  test('`execute` should throw an exception if namespace is not in internal storage', async () => {
    await expect(bridge.execute('MockMap', 'print')).rejects.toThrow('No namespace');
  });

  test('`execute` should throw an exception if namespace method is not in internal storage', async () => {
    bridge.addNamespace('MockMap', {
      refresh: jest.fn(),
    });
    await expect(bridge.execute('MockMap', 'log')).rejects.toThrow('No method');
  });

  test('`execute` should throw an exception if namespace method throws an error', async () => {
    bridge.addNamespace('MockMap', {
      refresh: () => {
        throw new Error('Print fails');
      },
    });
    await expect(bridge.execute('MockMap', 'refresh')).rejects.toThrow('Print fails');
  });
});
