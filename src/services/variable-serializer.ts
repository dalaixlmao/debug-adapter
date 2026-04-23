import type { DAPVariable } from '../contracts/dap';
import type { JsonSafeValue, IVariableSerializer } from '../contracts/variable-serializer';
import {
  VAR_STRING_MAX_CHARS,
  VAR_FALLBACK_MAX_CHARS,
  VAR_TRUNCATED_SUFFIX,
  VAR_CIRCULAR_MARKER,
  VAR_CIRCULAR_INDICATORS,
} from '../config/config';

export class VariableSerializer implements IVariableSerializer {
  serialize(variable: DAPVariable): JsonSafeValue {
    if (isCircularIndicator(variable.value)) return VAR_CIRCULAR_MARKER;
    if (variable.variablesReference > 0) return buildCompoundSummary(variable);
    return serializeByType(variable.type, variable.value);
  }
}

function isCircularIndicator(value: string): boolean {
  return (VAR_CIRCULAR_INDICATORS as readonly string[]).includes(value);
}

function buildCompoundSummary(variable: DAPVariable): string {
  const type = variable.type ?? 'object';
  return `<${type} ${variable.value}>`;
}

function serializeByType(type: string | undefined, value: string): JsonSafeValue {
  const normalizedType = (type ?? '').toLowerCase();
  if (normalizedType === 'int' || normalizedType === 'float' || normalizedType === 'number') {
    return parseNumber(value);
  }
  if (normalizedType === 'str' || normalizedType === 'string') {
    return parseString(value);
  }
  if (normalizedType === 'bool' || normalizedType === 'boolean') {
    return parseBoolean(value);
  }
  if (normalizedType === 'nonetype' || normalizedType === 'null' || normalizedType === 'undefined') {
    return null;
  }
  return truncate(value, VAR_FALLBACK_MAX_CHARS);
}

function parseNumber(value: string): JsonSafeValue {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : truncate(value, VAR_FALLBACK_MAX_CHARS);
}

function parseString(value: string): string {
  const stripped = stripOuterQuotes(value);
  return truncate(stripped, VAR_STRING_MAX_CHARS);
}

function parseBoolean(value: string): boolean | null {
  if (value === 'True' || value === 'true') return true;
  if (value === 'False' || value === 'false') return false;
  return null;
}

function stripOuterQuotes(value: string): string {
  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return value.slice(0, maxChars) + VAR_TRUNCATED_SUFFIX;
}
