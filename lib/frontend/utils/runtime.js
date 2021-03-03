import ErrorStackParser from 'error-stack-parser';

import { objectStore } from '../models/ObjectStore';
import { PropertyObject } from '../models/PropertyObject';
import { InlineWorker } from './Worker';
import { isSupportWorker } from './common';

/**
 * parse console properties properly
 * @param  {*}             arg  any kind of primitive or object
 * @return {RemoteObject}       Mirror object referencing original JavaScript object.
 */
export function getConsoleArg(arg, scriptId = 1, returnByValue) {
  const property = new PropertyObject(arg);

  if (property.type === 'undefined') {
    return { type: property.type };
  }

  /**
   * return primitives right away
   */
  if (property.isPrimitive || (property.subtype === 'array' && returnByValue)) {
    return { type: property.type, value: arg };
  }

  const result = property.get();

  if (property.subtype !== 'node') {
    /**
     * apply preview for raw objects only
     */
    result.preview = {
      description: property.description,
      overflow: false,
      properties: getObjectProperties(property.object),
      type: property.type,
      subtype: property.subtype,
    };
  }

  return result;
}

export function getConsoleMessageType(logMethod) {
  if (logMethod === 'warn') return 'warning';
  return logMethod;
}

export function getObjectProperties(obj, includeDescriptors = false) {
  const propertyNames = Object.getOwnPropertyNames(obj);
  const prototype = Object.getPrototypeOf(obj);
  if (prototype) {
    Object.entries(Object.getOwnPropertyDescriptors(prototype)).forEach(([name, descriptor]) => {
      if (typeof descriptor.get !== 'undefined') {
        propertyNames.push(name);
      }
    });
  }
  propertyNames.push('__proto__');
  return propertyNames
    .map(propertyName => {
      const descriptor = Object.getOwnPropertyDescriptor(obj, propertyName);
      /**
       * ignore accessor and hide internal properties (_nodeId)
       */
      if (
        propertyName === 'length' ||
        propertyName === 'constructor' ||
        propertyName === '_nodeId' ||
        (!descriptor && typeof obj[propertyName] === 'undefined')
      ) {
        return;
      }

      const value = !descriptor ? obj[propertyName] : descriptor.value;

      const property = new PropertyObject(value);

      /**
       * only return a subset of properties
       */
      if (!includeDescriptors) {
        const result = property.get();
        result.name = propertyName;
        result.value = result.description;
        delete result.description;
        delete result.objectId;
        delete result.className;
        return result;
      }

      return {
        configurable: descriptor ? descriptor.configurable : false,
        enumerable: descriptor ? descriptor.enumerable : false,
        writable: descriptor ? descriptor.writable : false,
        name: propertyName,
        value: property.get(),
        isOwn: Object.prototype.hasOwnProperty.call(obj, propertyName),
      };
    })
    .filter(prop => Boolean(prop));
}

/**
 * generates an error object
 * @param  {String} [message='fake']  error message (optional)
 * @return {Object}                   error object
 */
export function getError(message = 'fake', fakeStack = false) {
  try {
    throw new Error(message);
  } catch (err) {
    /**
     * fake stack if none existing
     * TV browser doesn't allow to modify error object (readonly) so we need to
     * fake the error object
     */
    if (!err.stack || fakeStack) {
      return getFakeError(err);
    }

    return err;
  }
}

/**
 * generates a fake error object since we can't modify the stack and eval errors come without
 */
export function getFakeError(err) {
  const newError = {
    message: err.message,
    stack: `${err.constructor.name}: ${err.message}\n\tat <anonymous>:1:1`,
  };
  newError.constructor = err.constructor;
  return newError;
}

/**
 * returns stacktrace data for console.log event
 */
export function getStacktrace(err) {
  const error = err || getError();

  if (!error) {
    return [];
  }

  const stackFrames = ErrorStackParser.parse(error);

  return stackFrames.reduce((arr, { columnNumber, lineNumber, functionName = 'anonymous', fileName }) => {
    if (functionName === 'getStacktrace' || functionName.includes('__fakeConsole')) {
      return arr;
    }

    const script = document.querySelector(`script[src="${fileName}"]`);

    arr.push({
      columnNumber,
      lineNumber,
      scriptId: script ? script._nodeId : 0,
      url: fileName,
      functionName: functionName,
    });

    return arr;
  }, []);
}

function evalExpression(expression) {
  const result = { value: null, error: null, scriptId: null };

  try {
    result.value = eval(expression); // eslint-disable-line no-eval
  } catch (e) {
    result.error = e;
    result.error.wasThrown = true;

    /**
     * trigger scriptFailedToParse event when script can't be parsed
     */
    // scriptFailedToParse.call(this, script)
  }

  return result;
}

let worker;

export function createSandbox() {
  const evalScript = `
${evalExpression}
self.addEventListener('message', function(event) {
  var result = evalExpression(event.data.code);
  try {
    self.postMessage({
      id: event.data.id,
      evaluated: result,
    });
  } catch(error) {
    if (!error.message.includes('cloned')) {
      console.error(error);
    }
    self.postMessage({
      id: event.data.id,
      evaluated: {},
    });
  }
});
`;
  worker = new InlineWorker(evalScript);
}

export function destroySandbox() {
  if (worker) {
    worker.destroy();
    worker = null;
  }
}

/**
 * executes a given expressions safely and returns its value or error
 * @param  {String} expression  javascript you want to execute
 * @param  {Boolean} sandbox    whether run the expression in a sandbox without any side effect
 * @return {Object}             result containing the expression value or error and objectId from store
 */
export async function callFn(expression, sandbox = false) {
  let result;
  if (expression === '') {
    result = { error: new Error('Empty expression') };
    result.error.wasThrown = true;
  } else if (sandbox && isSupportWorker()) {
    try {
      result = await worker.eval(expression);
    } catch (ex) {
      result = { error: ex };
      result.error.wasThrown = true;
    }
  } else {
    result = evalExpression(expression);
  }
  result.scriptId = objectStore.push(result.value || result.error);
  return result;
}
