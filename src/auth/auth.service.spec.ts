import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RefreshToken } from './entities/refresh-token.entity';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const mockUsersService = {
  findByEmail: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
};
const mockJwtService = {
  sign: jest.fn().mockReturnValue('signed-token'),
};
const mockConfigService = {
  get: jest.fn().mockReturnValue('secret'),
};
const mockRefreshTokenRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getRepositoryToken(RefreshToken), useValue: mockRefreshTokenRepo },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      await expect(service.login({ email: 'x@y.com', password: '123' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password wrong', async () => {
      mockUsersService.findByEmail.mockResolvedValue({ id: 1, email: 'x@y.com', password: 'hashed' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.login({ email: 'x@y.com', password: 'wrong' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should return tokens on valid credentials', async () => {
      mockUsersService.findByEmail.mockResolvedValue({ id: 1, email: 'x@y.com', password: 'hashed' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockRefreshTokenRepo.create.mockReturnValue({});
      mockRefreshTokenRepo.save.mockResolvedValue({});
      const result = await service.login({ email: 'x@y.com', password: 'correct' });
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });

  describe('register', () => {
    it('should hash password and create user', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-pw');
      mockUsersService.create.mockResolvedValue({
        id: 1, email: 'a@b.com', fullName: 'A', role: 'reader', password: 'hashed-pw',
      });
      const result = await service.register({ email: 'a@b.com', password: 'plain', fullName: 'A' });
      expect(bcrypt.hash).toHaveBeenCalledWith('plain', 10);
      expect(mockUsersService.create).toHaveBeenCalledWith({
        email: 'a@b.com', password: 'hashed-pw', fullName: 'A',
      });
      expect(result).not.toHaveProperty('password');
    });

    it('should return user data without password field', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-pw');
      mockUsersService.create.mockResolvedValue({
        id: 2, email: 'b@c.com', fullName: 'B', role: 'reader', password: 'hashed-pw',
      });
      const result = await service.register({ email: 'b@c.com', password: 'pass123', fullName: 'B' });
      expect(result).toEqual({ id: 2, email: 'b@c.com', fullName: 'B', role: 'reader' });
    });
  });

  describe('refresh', () => {
    it('should throw UnauthorizedException when token not found', async () => {
      mockRefreshTokenRepo.findOne.mockResolvedValue(null);
      await expect(service.refresh(1, 'invalid-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when token is expired', async () => {
      const pastDate = new Date(Date.now() - 1000);
      mockRefreshTokenRepo.findOne.mockResolvedValue({ id: 1, expiresAt: pastDate, userId: 1 });
      await expect(service.refresh(1, 'expired-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should delete old token and return new tokens', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      mockRefreshTokenRepo.findOne.mockResolvedValue({ id: 42, expiresAt: futureDate, userId: 1 });
      mockUsersService.findById.mockResolvedValue({ id: 1, email: 'x@y.com' });
      mockRefreshTokenRepo.delete.mockResolvedValue({ affected: 1 });
      mockRefreshTokenRepo.create.mockReturnValue({});
      mockRefreshTokenRepo.save.mockResolvedValue({});
      const result = await service.refresh(1, 'valid-token');
      expect(mockRefreshTokenRepo.delete).toHaveBeenCalledWith({ id: 42 });
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });

  describe('logout', () => {
    it('should delete refresh token', async () => {
      mockRefreshTokenRepo.delete.mockResolvedValue({ affected: 1 });
      await service.logout(1, 'some-token');
      expect(mockRefreshTokenRepo.delete).toHaveBeenCalledWith({ token: 'some-token', userId: 1 });
    });
  });
});
