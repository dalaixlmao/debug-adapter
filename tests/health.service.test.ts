import { describe, expect, it } from 'vitest';
import { HealthService } from '../src/services/health.service';

describe('HealthService', () => {
  const sut = new HealthService();

  describe('getHealth', () => {
    it('returns ok status with the provided version when called', () => {
      // Arrange
      const version = '1.2.3';

      // Act
      const result = sut.getHealth(version);

      // Assert
      expect(result).toEqual({ status: 'ok', activeSessions: 0, version: '1.2.3' });
    });

    it('returns zero activeSessions when called', () => {
      // Arrange
      const version = '0.0.1';

      // Act
      const result = sut.getHealth(version);

      // Assert
      expect(result.activeSessions).toBe(0);
    });
  });
});
