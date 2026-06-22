import { JwtRefreshStrategy } from './jwt-refresh.strategy';
import { Request } from 'express';

const mockConfig = { get: jest.fn().mockReturnValue('test-refresh-secret') };

describe('JwtRefreshStrategy', () => {
  let strategy: JwtRefreshStrategy;

  beforeEach(() => {
    strategy = new JwtRefreshStrategy(mockConfig as any);
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('should return userId and refreshToken extracted from cookie', () => {
      const req = { cookies: { refresh_token: 'my-rt' } } as unknown as Request;

      const result = strategy.validate(req, { sub: 5 });

      expect(result).toEqual({ userId: 5, refreshToken: 'my-rt' });
    });

    it('should return undefined refreshToken when cookie is absent', () => {
      const req = { cookies: {} } as unknown as Request;

      const result = strategy.validate(req, { sub: 3 });

      expect(result).toEqual({ userId: 3, refreshToken: undefined });
    });
  });
});
