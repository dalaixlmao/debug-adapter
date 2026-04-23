import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StepCollector } from '../src/services/step-collector';
import type { IDAPSession, DAPStackFrame, DAPScope, DAPVariable, StepOutcome } from '../src/contracts';
import { ErrorCode } from '../src/errors';
import { AppError } from '../src/errors';

const SOURCE_PATH = '/tmp/test/script.py';

function makeFrame(line: number, sourcePath: string = SOURCE_PATH): DAPStackFrame {
  return { id: line, name: 'frame', line, column: 1, source: { path: sourcePath } };
}

function makeScope(name: string, ref: number): DAPScope {
  return { name, variablesReference: ref, expensive: false };
}

function makeVariable(name: string, value: string): DAPVariable {
  return { name, value, variablesReference: 0 };
}

function makeMockSession(overrides: Partial<IDAPSession> = {}): IDAPSession {
  return {
    initialize: vi.fn(),
    launch: vi.fn(),
    stepIn: vi.fn<[], Promise<StepOutcome>>().mockResolvedValue('terminated'),
    getStackTrace: vi.fn().mockResolvedValue([makeFrame(1)]),
    getScopes: vi.fn().mockResolvedValue([makeScope('Locals', 10)]),
    getVariables: vi.fn().mockResolvedValue([]),
    disconnect: vi.fn(),
    ...overrides,
  };
}

describe('StepCollector.collect', () => {
  let sut: StepCollector;

  beforeEach(() => {
    sut = new StepCollector();
  });

  describe('when program produces 3 steps on lines 1, 2, 3', () => {
    it('returns 3 frames with correct line numbers', async () => {
      // Arrange
      const session = makeMockSession();
      vi.mocked(session.getStackTrace)
        .mockResolvedValueOnce([makeFrame(1)])
        .mockResolvedValueOnce([makeFrame(2)])
        .mockResolvedValueOnce([makeFrame(3)]);
      vi.mocked(session.stepIn)
        .mockResolvedValueOnce('stopped')
        .mockResolvedValueOnce('stopped')
        .mockResolvedValueOnce('terminated');

      // Act
      const result = await sut.collect(session, SOURCE_PATH);

      // Assert
      expect(result).toHaveLength(3);
      expect(result.map(s => s.line)).toEqual([1, 2, 3]);
    });
  });

  describe('when variables accumulate across steps', () => {
    it('each step captures only variables visible at that point', async () => {
      // Arrange
      const session = makeMockSession();
      vi.mocked(session.getStackTrace)
        .mockResolvedValueOnce([makeFrame(1)])
        .mockResolvedValueOnce([makeFrame(2)])
        .mockResolvedValueOnce([makeFrame(3)]);
      vi.mocked(session.getScopes).mockResolvedValue([makeScope('Locals', 10)]);
      vi.mocked(session.getVariables)
        .mockResolvedValueOnce([makeVariable('x', '1')])
        .mockResolvedValueOnce([makeVariable('x', '1'), makeVariable('y', '2')])
        .mockResolvedValueOnce([makeVariable('x', '1'), makeVariable('y', '2'), makeVariable('z', '3')]);
      vi.mocked(session.stepIn)
        .mockResolvedValueOnce('stopped')
        .mockResolvedValueOnce('stopped')
        .mockResolvedValueOnce('terminated');

      // Act
      const result = await sut.collect(session, SOURCE_PATH);

      // Assert
      expect(result[0]?.variables).toEqual({ x: '1' });
      expect(result[1]?.variables).toEqual({ x: '1', y: '2' });
      expect(result[2]?.variables).toEqual({ x: '1', y: '2', z: '3' });
    });
  });

  describe('when stack frame source does not match filePath (debugpy internal frame)', () => {
    it('skips the frame and does not add a step', async () => {
      // Arrange
      const session = makeMockSession();
      vi.mocked(session.getStackTrace)
        .mockResolvedValueOnce([makeFrame(99, '/usr/lib/python/debugpy/__main__.py')])
        .mockResolvedValueOnce([makeFrame(1, SOURCE_PATH)]);
      vi.mocked(session.stepIn)
        .mockResolvedValueOnce('stopped')
        .mockResolvedValueOnce('terminated');

      // Act
      const result = await sut.collect(session, SOURCE_PATH);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]?.line).toBe(1);
    });
  });

  describe('when DAP fires multiple stopped events for the same line', () => {
    it('deduplicates consecutive steps on the same line', async () => {
      // Arrange
      const session = makeMockSession();
      vi.mocked(session.getStackTrace)
        .mockResolvedValueOnce([makeFrame(1)])
        .mockResolvedValueOnce([makeFrame(1)])
        .mockResolvedValueOnce([makeFrame(2)]);
      vi.mocked(session.stepIn)
        .mockResolvedValueOnce('stopped')
        .mockResolvedValueOnce('stopped')
        .mockResolvedValueOnce('terminated');

      // Act
      const result = await sut.collect(session, SOURCE_PATH);

      // Assert
      expect(result).toHaveLength(2);
      expect(result.map(s => s.line)).toEqual([1, 2]);
    });
  });

  describe('when no Locals scope is present', () => {
    it('returns empty variables object for that step', async () => {
      // Arrange
      const session = makeMockSession();
      vi.mocked(session.getScopes).mockResolvedValueOnce([makeScope('Global', 20)]);

      // Act
      const result = await sut.collect(session, SOURCE_PATH);

      // Assert
      expect(result[0]?.variables).toEqual({});
    });
  });

  describe('when program terminates immediately', () => {
    it('returns empty steps array', async () => {
      // Arrange
      const session = makeMockSession();
      vi.mocked(session.getStackTrace).mockResolvedValueOnce([]);

      // Act
      const result = await sut.collect(session, SOURCE_PATH);

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe('when step count exceeds MAX_STEPS', () => {
    it('throws MAX_STEPS_EXCEEDED error', async () => {
      // Arrange — mock always returns stopped to exceed limit
      const session = makeMockSession();
      vi.mocked(session.stepIn).mockResolvedValue('stopped');
      vi.mocked(session.getStackTrace).mockResolvedValue([makeFrame(1)]);
      vi.mocked(session.getVariables).mockResolvedValue([]);

      // Act & Assert
      await expect(sut.collect(session, SOURCE_PATH)).rejects.toMatchObject({
        code: ErrorCode.MAX_STEPS_EXCEEDED,
      });
      expect(session.stepIn).toHaveBeenCalledTimes(100);
    });
  });
});
