import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import * as bcrypt from 'bcrypt';

import { AuthService } from '../src/auth/auth.service';
import { AuthController } from '../src/auth/auth.controller';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { JwtRefreshStrategy } from '../src/auth/strategies/jwt-refresh.strategy';
import { UsersService } from '../src/users/users.service';
import { User } from '../src/users/entities/user.entity';
import { RefreshToken } from '../src/auth/entities/refresh-token.entity';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { Role } from '../src/common/enums/role.enum';

process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';

const MOCK_USER: Partial<User> = {
  id: 1,
  email: 'test@example.com',
  fullName: 'Test User',
  role: Role.READER,
  isActive: true,
};

describe('Auth (integration)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const mockUserRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockRefreshTokenRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const makeUserQb = (user: Partial<User> | null) => ({
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(user),
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PassportModule,
        JwtModule.register({}),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtStrategy,
        JwtRefreshStrategy,
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(RefreshToken), useValue: mockRefreshTokenRepo },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());

    jwtService = moduleFixture.get<JwtService>(JwtService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const signAccessToken = (userId: number = 1, email: string = 'test@example.com') =>
    jwtService.sign({ sub: userId, email }, { secret: 'test-jwt-secret', expiresIn: '1h' });

  const signRefreshToken = (userId: number = 1, email: string = 'test@example.com') =>
    jwtService.sign({ sub: userId, email }, { secret: 'test-jwt-refresh-secret', expiresIn: '7d' });

  // ─── Register ────────────────────────────────────────────────────────────────

  describe('POST /api/auth/register', () => {
    it('trả về 201 và user data không có password khi đăng ký hợp lệ', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockUserRepo.create.mockReturnValue({ ...MOCK_USER, password: 'hashed' });
      mockUserRepo.save.mockResolvedValue({ ...MOCK_USER, password: 'hashed' });

      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'password123', fullName: 'Test User' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('test@example.com');
      expect(res.body.data).not.toHaveProperty('password');
    });

    it('trả về 400 khi email không hợp lệ', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'not-valid-email', password: 'password123', fullName: 'Test' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
    });

    it('trả về 400 khi password ngắn hơn 6 ký tự', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: '123', fullName: 'Test' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('trả về 400 khi thiếu field bắt buộc', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'password123' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('trả về 409 khi email đã được đăng ký', async () => {
      mockUserRepo.findOne.mockResolvedValue(MOCK_USER);

      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'taken@example.com', password: 'password123', fullName: 'Test' })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already exists/i);
    });
  });

  // ─── Login ────────────────────────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    it('trả về access_token và set refresh_token httpOnly cookie khi đăng nhập đúng', async () => {
      const hashed = await bcrypt.hash('password123', 10);
      mockUserRepo.createQueryBuilder.mockReturnValue(
        makeUserQb({ ...MOCK_USER, password: hashed }),
      );
      mockRefreshTokenRepo.create.mockReturnValue({});
      mockRefreshTokenRepo.save.mockResolvedValue({});

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('access_token');

      const cookies = res.headers['set-cookie'] as string[];
      expect(cookies.some((c: string) => c.startsWith('refresh_token='))).toBe(true);
      expect(cookies.some((c: string) => c.includes('HttpOnly'))).toBe(true);
    });

    it('trả về 401 khi user không tồn tại', async () => {
      mockUserRepo.createQueryBuilder.mockReturnValue(makeUserQb(null));

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'password123' })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid credentials/i);
    });

    it('trả về 401 khi sai mật khẩu', async () => {
      mockUserRepo.createQueryBuilder.mockReturnValue(
        makeUserQb({ ...MOCK_USER, password: 'hashed-different-password' }),
      );

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrong-password' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('trả về 400 khi thiếu email hoặc password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'test@example.com' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ─── Refresh ──────────────────────────────────────────────────────────────────

  describe('POST /api/auth/refresh', () => {
    it('trả về access_token mới khi refresh token hợp lệ', async () => {
      const refreshToken = signRefreshToken();
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      mockRefreshTokenRepo.findOne.mockResolvedValue({
        id: 10,
        token: refreshToken,
        userId: 1,
        expiresAt: futureDate,
      });
      mockUserRepo.findOne.mockResolvedValue(MOCK_USER);
      mockRefreshTokenRepo.delete.mockResolvedValue({ affected: 1 });
      mockRefreshTokenRepo.create.mockReturnValue({});
      mockRefreshTokenRepo.save.mockResolvedValue({});

      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${refreshToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('access_token');
    });

    it('trả về 401 khi không có refresh_token cookie', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .expect(401);
    });

    it('trả về 401 khi refresh token đã hết hạn trong DB', async () => {
      const refreshToken = signRefreshToken();
      const pastDate = new Date(Date.now() - 1000);

      mockRefreshTokenRepo.findOne.mockResolvedValue({
        id: 10,
        token: refreshToken,
        userId: 1,
        expiresAt: pastDate,
      });

      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${refreshToken}`)
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // ─── Logout ───────────────────────────────────────────────────────────────────

  describe('POST /api/auth/logout', () => {
    it('trả về 401 khi chưa đăng nhập', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .expect(401);
    });

    it('xóa cookie và trả về success khi đã đăng nhập', async () => {
      const token = signAccessToken();
      mockUserRepo.findOne.mockResolvedValue(MOCK_USER);
      mockRefreshTokenRepo.delete.mockResolvedValue({ affected: 1 });

      const res = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', 'refresh_token=some-old-token')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(mockRefreshTokenRepo.delete).toHaveBeenCalledWith({
        token: 'some-old-token',
        userId: 1,
      });

      const cookies = res.headers['set-cookie'] as string[];
      const refreshCookie = cookies?.find((c: string) => c.startsWith('refresh_token='));
      expect(refreshCookie).toMatch(/refresh_token=;/);
    });
  });
});
