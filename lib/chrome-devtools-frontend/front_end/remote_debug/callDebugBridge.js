async function callDebugBridge(namespace, method) {
  const executionContext = UI.context.flavor(SDK.ExecutionContext);
  const args = Array.from(arguments).slice(2);
  const executeArgs = [namespace, method].concat(args);
  const expression = `(window.remoteDebuggerLauncher.remoteDebugger.debugBridge.execute(${executeArgs.map(JSON.stringify).join(', ')}))`;

  const result = await executionContext.evaluate({
    expression,
    objectGroup: 'console',
    throwOnSideEffect: false,
  }, /* userGesture */ false, /* awaitPromise */ true);

  if (result.error) {
    throw new Error(result.error);
  }
  if (result.exceptionDetails) {
    throw result.exceptionDetails;
  }

  const value = result.object.value;
  return typeof value === 'undefined' ? value : JSON.parse(value);
}
