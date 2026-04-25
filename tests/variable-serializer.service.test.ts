import { describe, it, expect, beforeEach } from 'vitest';
import { VariableSerializer } from '../src/services/variable-serializer';
import type { DAPVariable } from '../src/contracts/dap';

function makeVar(overrides: Partial<DAPVariable>): DAPVariable {
  return { name: 'x', value: '', variablesReference: 0, ...overrides };
}

describe('VariableSerializer.serialize', () => {
  let serializer: VariableSerializer;

  beforeEach(() => {
    serializer = new VariableSerializer();
  });

  describe('int type', () => {
    it('returns number 42 when value is "42" and type is "int"', () => {
      const result = serializer.serialize(makeVar({ type: 'int', value: '42' }));
      expect(result).toBe(42);
    });

    it('returns number for float type', () => {
      const result = serializer.serialize(makeVar({ type: 'float', value: '3.14' }));
      expect(result).toBeCloseTo(3.14);
    });

    it('returns number for "number" type', () => {
      const result = serializer.serialize(makeVar({ type: 'number', value: '0' }));
      expect(result).toBe(0);
    });
  });

  describe('str type', () => {
    it('returns string with quotes stripped when value is \'\'hello\'\'', () => {
      const result = serializer.serialize(makeVar({ type: 'str', value: "'hello'" }));
      expect(result).toBe('hello');
    });

    it('returns string with double quotes stripped', () => {
      const result = serializer.serialize(makeVar({ type: 'string', value: '"world"' }));
      expect(result).toBe('world');
    });

    it('returns truncated string with suffix when value exceeds 1024 chars', () => {
      const long = 'a'.repeat(2000);
      const result = serializer.serialize(makeVar({ type: 'str', value: long }));
      expect(typeof result).toBe('string');
      expect((result as string).endsWith('[truncated]')).toBe(true);
      expect((result as string).length).toBe(1024 + '[truncated]'.length);
    });
  });

  describe('bool type', () => {
    it('returns boolean true when value is "True"', () => {
      const result = serializer.serialize(makeVar({ type: 'bool', value: 'True' }));
      expect(result).toBe(true);
    });

    it('returns boolean false when value is "False"', () => {
      const result = serializer.serialize(makeVar({ type: 'bool', value: 'False' }));
      expect(result).toBe(false);
    });

    it('returns boolean true when value is "true" (JS casing)', () => {
      const result = serializer.serialize(makeVar({ type: 'boolean', value: 'true' }));
      expect(result).toBe(true);
    });
  });

  describe('NoneType / null / undefined type', () => {
    it('returns null when type is "NoneType" and value is "None"', () => {
      const result = serializer.serialize(makeVar({ type: 'NoneType', value: 'None' }));
      expect(result).toBeNull();
    });

    it('returns null when type is "null"', () => {
      const result = serializer.serialize(makeVar({ type: 'null', value: 'null' }));
      expect(result).toBeNull();
    });

    it('returns null when type is "undefined"', () => {
      const result = serializer.serialize(makeVar({ type: 'undefined', value: 'undefined' }));
      expect(result).toBeNull();
    });
  });

  describe('compound types (variablesReference > 0)', () => {
    it('returns summary string for list when variablesReference > 0', () => {
      const result = serializer.serialize(
        makeVar({ type: 'list', value: '[1, 2, 3]', variablesReference: 5 }),
      );
      expect(result).toBe('<list [1, 2, 3]>');
    });

    it('returns summary with object type when type is undefined', () => {
      const result = serializer.serialize(
        makeVar({ type: undefined, value: '{a: 1}', variablesReference: 3 }),
      );
      expect(result).toBe('<object {a: 1}>');
    });
  });

  describe('circular reference detection', () => {
    it('returns "<circular reference>" when value is "..."', () => {
      const result = serializer.serialize(makeVar({ type: 'dict', value: '...' }));
      expect(result).toBe('<circular reference>');
    });

    it('returns "<circular reference>" when value is "<Recursion>"', () => {
      const result = serializer.serialize(makeVar({ type: 'list', value: '<Recursion>' }));
      expect(result).toBe('<circular reference>');
    });
  });

  describe('JS-specific types', () => {
    it('returns null when type is "undefined"', () => {
      const result = serializer.serialize(makeVar({ type: 'undefined', value: 'undefined' }));
      expect(result).toBeNull();
    });

    it('returns number 42 when type is "number" and value is "42"', () => {
      const result = serializer.serialize(makeVar({ type: 'number', value: '42' }));
      expect(result).toBe(42);
    });

    it('returns string "hello" when type is "string" and value is "hello"', () => {
      const result = serializer.serialize(makeVar({ type: 'string', value: 'hello' }));
      expect(result).toBe('hello');
    });

    it('returns boolean true when type is "boolean" and value is "true"', () => {
      const result = serializer.serialize(makeVar({ type: 'boolean', value: 'true' }));
      expect(result).toBe(true);
    });

    it('returns string "NaN" when type is "number" and value is "NaN"', () => {
      const result = serializer.serialize(makeVar({ type: 'number', value: 'NaN' }));
      expect(result).toBe('NaN');
    });

    it('returns string "Infinity" when type is "number" and value is "Infinity"', () => {
      const result = serializer.serialize(makeVar({ type: 'number', value: 'Infinity' }));
      expect(result).toBe('Infinity');
    });

    it('returns string "-Infinity" when type is "number" and value is "-Infinity"', () => {
      const result = serializer.serialize(makeVar({ type: 'number', value: '-Infinity' }));
      expect(result).toBe('-Infinity');
    });

    it('returns BigInt string representation when type is "bigint"', () => {
      const result = serializer.serialize(makeVar({ type: 'bigint', value: '9007199254740993n' }));
      expect(result).toBe('9007199254740993n');
    });

    it('returns Symbol string when type is "symbol"', () => {
      const result = serializer.serialize(makeVar({ type: 'symbol', value: 'Symbol(foo)' }));
      expect(result).toBe('Symbol(foo)');
    });

    it('returns Symbol string for symbol with no description', () => {
      const result = serializer.serialize(makeVar({ type: 'symbol', value: 'Symbol()' }));
      expect(result).toBe('Symbol()');
    });

    it('returns "<functionName>" when type is "function" and value has a named function', () => {
      const result = serializer.serialize(makeVar({ type: 'function', value: 'function myFunc() {}' }));
      expect(result).toBe('<myFunc>');
    });

    it('returns "<anonymous>" when type is "function" and value has an anonymous function', () => {
      const result = serializer.serialize(makeVar({ type: 'function', value: 'function () {}' }));
      expect(result).toBe('<anonymous>');
    });
  });

  describe('fallback for unknown types', () => {
    it('returns value string as-is when type is unrecognized and under 256 chars', () => {
      const result = serializer.serialize(makeVar({ type: 'MyClass', value: 'SomeRepr' }));
      expect(result).toBe('SomeRepr');
    });

    it('returns truncated fallback at 256 chars for unknown types', () => {
      const long = 'x'.repeat(300);
      const result = serializer.serialize(makeVar({ type: 'MyClass', value: long }));
      expect(typeof result).toBe('string');
      expect((result as string).endsWith('[truncated]')).toBe(true);
      expect((result as string).length).toBe(256 + '[truncated]'.length);
    });
  });
});
