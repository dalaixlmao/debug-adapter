import { describe, it, expect } from 'vitest';
import { ResponseBuilder } from '../src/services/response-builder';
import type { StepFrame } from '../src/contracts';

const builder = new ResponseBuilder();

function makeSteps(count: number): StepFrame[] {
  return Array.from({ length: count }, (_, i) => ({ line: i + 1, variables: {} }));
}

describe('ResponseBuilder.build', () => {
  describe('steps field', () => {
    it('returns the same steps array reference when steps are provided', () => {
      // Arrange
      const steps = makeSteps(2);
      const startTime = process.hrtime.bigint();

      // Act
      const result = builder.build({ steps, startTime, truncated: false });

      // Assert
      expect(result.steps).toBe(steps);
    });

    it('returns empty array when steps array is empty', () => {
      // Arrange
      const startTime = process.hrtime.bigint();

      // Act
      const result = builder.build({ steps: [], startTime, truncated: false });

      // Assert
      expect(result.steps).toHaveLength(0);
    });
  });

  describe('total_steps field', () => {
    it('returns total_steps equal to steps length', () => {
      // Arrange
      const steps = makeSteps(3);
      const startTime = process.hrtime.bigint();

      // Act
      const result = builder.build({ steps, startTime, truncated: false });

      // Assert
      expect(result.total_steps).toBe(3);
    });

    it('returns zero when steps array is empty', () => {
      // Arrange
      const startTime = process.hrtime.bigint();

      // Act
      const result = builder.build({ steps: [], startTime, truncated: false });

      // Assert
      expect(result.total_steps).toBe(0);
    });
  });

  describe('truncated field', () => {
    it('returns false when truncated is false', () => {
      // Arrange
      const startTime = process.hrtime.bigint();

      // Act
      const result = builder.build({ steps: [], startTime, truncated: false });

      // Assert
      expect(result.truncated).toBe(false);
    });

    it('returns true when truncated is true', () => {
      // Arrange
      const startTime = process.hrtime.bigint();

      // Act
      const result = builder.build({ steps: [], startTime, truncated: true });

      // Assert
      expect(result.truncated).toBe(true);
    });
  });

  describe('execution_time_ms field', () => {
    it('returns a non-negative integer', () => {
      // Arrange
      const startTime = process.hrtime.bigint();

      // Act
      const result = builder.build({ steps: [], startTime, truncated: false });

      // Assert
      expect(result.execution_time_ms).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(result.execution_time_ms)).toBe(true);
    });

    it('reflects elapsed time when startTime was in the past', () => {
      // Arrange — 10 ms ago
      const startTime = process.hrtime.bigint() - BigInt(10_000_000);

      // Act
      const result = builder.build({ steps: [], startTime, truncated: false });

      // Assert
      expect(result.execution_time_ms).toBeGreaterThanOrEqual(10);
    });
  });
});
