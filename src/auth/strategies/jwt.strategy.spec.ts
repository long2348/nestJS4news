import { NotFoundException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

const mockUsersService = { findById: jest.fn() };
const mockConfig = { get: jest.fn().mockReturnValue('test-jwt-secret') };

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    strategy = new JwtStrategy(mockConfig as any, mockUsersService as any);
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('should call usersService.findById with the sub from payload', async () => {
      const user = { id: 1, email: 'a@b.com', role: 'reader' };
      mockUsersService.findById.mockResolvedValue(user);

      const result = await strategy.validate({ sub: 1, email: 'a@b.com' });

      expect(mockUsersService.findById).toHaveBeenCalledWith(1);
      expect(result).toEqual(user);
    });

    it('should propagate NotFoundException when user does not exist', async () => {
      mockUsersService.findById.mockRejectedValue(new NotFoundException('User not found'));

      await expect(strategy.validate({ sub: 99, email: 'ghost@b.com' }))
        .rejects.toThrow(NotFoundException);
    });
  });
});
