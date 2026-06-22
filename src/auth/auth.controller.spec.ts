import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Request, Response } from 'express';

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
};

const mockRes = () => ({
  cookie: jest.fn(),
  clearCookie: jest.fn(),
} as unknown as Response);

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();
    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should call authService.register and return the result', async () => {
      const dto = { email: 'a@b.com', password: '123456', fullName: 'A' };
      const user = { id: 1, email: 'a@b.com', fullName: 'A', role: 'reader' };
      mockAuthService.register.mockResolvedValue(user);

      const result = await controller.register(dto);

      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(user);
    });
  });

  describe('login', () => {
    it('should set HttpOnly refresh_token cookie and return access_token', async () => {
      const dto = { email: 'a@b.com', password: '123456' };
      mockAuthService.login.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });
      const res = mockRes();

      const result = await controller.login(dto, res);

      expect(mockAuthService.login).toHaveBeenCalledWith(dto);
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'rt',
        expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
      );
      expect(result).toEqual({ access_token: 'at' });
    });
  });

  describe('refresh', () => {
    it('should use userId and refreshToken from req.user, set new cookie, return new access_token', async () => {
      mockAuthService.refresh.mockResolvedValue({ accessToken: 'new-at', refreshToken: 'new-rt' });
      const req = { user: { userId: 1, refreshToken: 'old-rt' }, cookies: {} } as unknown as Request;
      const res = mockRes();

      const result = await controller.refresh(req, res);

      expect(mockAuthService.refresh).toHaveBeenCalledWith(1, 'old-rt');
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'new-rt',
        expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
      );
      expect(result).toEqual({ access_token: 'new-at' });
    });
  });

  describe('logout', () => {
    it('should call logout with user id and cookie token, then clear cookie', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);
      const req = {
        user: { id: 7 },
        cookies: { refresh_token: 'cookie-rt' },
      } as unknown as Request;
      const res = mockRes();

      const result = await controller.logout(req, res);

      expect(mockAuthService.logout).toHaveBeenCalledWith(7, 'cookie-rt');
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token');
      expect(result).toEqual({ message: 'Logged out' });
    });

    it('should still call logout when no refresh cookie is present', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);
      const req = { user: { id: 7 }, cookies: {} } as unknown as Request;
      const res = mockRes();

      await controller.logout(req, res);

      expect(mockAuthService.logout).toHaveBeenCalledWith(7, undefined);
    });
  });
});
