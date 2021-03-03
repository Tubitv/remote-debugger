import { objectStore } from '../models/ObjectStore';

export const SUB_TYPES = [
  'array',
  'null',
  'node',
  'regexp',
  'date',
  'map',
  'set',
  'iterator',
  'generator',
  'error',
  'promise',
  'typedarray',
];

/**
 * Facade for subtype property
 */
export class PropertyObject {
  constructor(object) {
    const type = typeof object;
    if (type.match(/^(number|string|undefined|boolean)$/)) {
      return new PrimitiveObject(object);
    }
    const subtype = PropertyObject.getSubType(object);
    if (subtype === 'null') {
      return new PrimitiveObject(object, subtype);
    }

    return PropertyObject.createPropertyInstance(object, subtype);
  }

  static createPropertyInstance(object, subtype) {
    if (subtype === 'array') return new ArrayObject(object, subtype);
    if (subtype === 'null') return new PrimitiveObject(object, subtype);
    if (subtype === 'undefined') return new PrimitiveObject(object, subtype);
    if (subtype === 'node') return new NodeObject(object, subtype);
    if (subtype === 'regexp') return new CompositeObject(object, subtype);
    if (subtype === 'date') return new CompositeObject(object, subtype);
    if (subtype === 'map') return new CompositeObject(object, subtype);
    if (subtype === 'set') return new CompositeObject(object, subtype);
    if (subtype === 'iterator') return new CompositeObject(object, subtype);
    if (subtype === 'generator') return new CompositeObject(object, subtype);
    if (subtype === 'error') return new ErrorObject(object, subtype);
    if (subtype === 'promise') return new PromiseObject(object, subtype);
    if (subtype === 'typedarray') return new TypedarrayObject(object, subtype);
    return new CompositeObject(object);
  }

  /**
   * returns subtype of object
   */
  static getSubType(object) {
    /**
     * null
     */
    if (object === null) {
      return 'null';
    }

    /**
     * undefined
     */
    if (typeof object === 'undefined') {
      return 'undefined';
    }

    try {
      /**
       * objects can have cases where constructor is null
       */
      if (!object.constructor) {
        return 'map';
      }

      const constructorName = object.constructor.name;

      /**
       * error
       */
      // If an error object does not contain stack, it will show nothing in the description
      // So we consider it as an object do show its all properties
      if ((object instanceof Error || constructorName.match(/Error$/)) && object.stack) {
        return 'error';
      }

      /**
       * node
       */
      if (typeof object.nodeType === 'number') {
        return 'node';
      }

      /**
       * iterator
       */
      if (object.iterator) {
        return 'iterator';
      }

      /**
       * generator
       */
      if (constructorName === 'GeneratorFunction') {
        return 'generator';
      }

      /**
       * promise
       */
      if (object instanceof Promise) {
        return 'promise';
      }

      /**
       * array
       */
      if (Array.isArray(object) || (typeof object.length === 'number' && object.constructor.name !== 'object')) {
        return 'array';
      }

      /**
       * typedarray
       */
      if (constructorName.match(/^Float(\d+)Array$/)) {
        return 'typedarray';
      }

      /**
       * constructorName check
       */
      if (SUB_TYPES.includes(constructorName.toLowerCase())) {
        return constructorName.toLowerCase();
      }
    } catch (ex) {
      // Sometimes there might be exceptions when calling prototype object w/o correct context objects.
      // For example, when exectue `getSubType` on a node instance's `__proto__` property, `NodeList` object,
      // there is an `Illegal invocation` exception when access `length` property of it.
      return '';
    }
  }
}

class PrimitiveObject {
  isPrimitive = true;

  constructor(object, subtype) {
    this.object = object;
    this.subtype = subtype || this.subtype;
    this.type = typeof object;
    this.value = this.object;
    this.className = (this.object && this.object.constructor) ? this.object.constructor.name : undefined;
  }

  get() {
    const { value, subtype, type, description } = this;
    return { value, subtype, type, description };
  }

  /**
   * for primitives the origin is the actual value except for 'null' and 'undefined'
   */
  get description() {
    return (typeof this.object !== 'undefined' && this.object !== null) ? this.value.toString() : this.subtype;
  }
}

class CompositeObject extends PrimitiveObject {
  isPrimitive = false;

  constructor(object, subtype) {
    super(object, subtype);
    const id = objectStore.push(this.object);
    this.objectId = JSON.stringify({ injectedScriptId: 1, id });
  }

  get() {
    const { className, description, objectId, subtype, type } = this;
    return { className, description, objectId, subtype, type };
  }

  get description() {
    return (this.object.constructor && this.object.constructor.name) || (typeof this.object.toString === 'function' && this.object.toString());
  }
}

class ArrayObject extends CompositeObject {
  get description() {
    return `${this.className}(${this.object.length})`;
  }
}

class NodeObject extends CompositeObject {
  constructor(object, subtype) {
    super(object, subtype);
    this.value = this.getValue();
    this.className = this.object.constructor.name;
  }

  get description() {
    return this.object.nodeName.toLowerCase();
  }

  getValue() {
    let value = this.object.nodeName.toLowerCase();

    if (this.object.id) {
      value += `#${this.object.id}`;
    }

    if (this.object.className) {
      value += `.${this.object.className.replace(' ', '.')}`;
    }

    return value;
  }
}

class ErrorObject extends CompositeObject {
  className = 'Error';

  get description() {
    return this.object.stack;
  }
}

class PromiseObject extends CompositeObject {
  className = 'Promise';

  get description() {
    return 'Promise';
  }
}

class TypedarrayObject extends CompositeObject {
  className = 'TypedarrayObject';

  get description() {
    return 'TypedarrayObject';
  }
}
