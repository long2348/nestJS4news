import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import cookieParser from 'cookie-parser';

import { UsersModule } from '../../src/users/users.module';
import { AuthModule } from '../../src/auth/auth.module';
import { User } from '../../src/users/entities/user.entity';
import { RefreshToken } from '../../src/auth/entities/refresh-token.entity';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';

// Dùng better-sqlite3 in-memory để test E2E mà không cần MySQL
describe('Auth E2E (SQLite in-memory)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [User, RefreshToken],
          synchronize: true,
          dropSchema: true,
          retryAttempts: 0,
        }),
        UsersModule,
        AuthModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Register ────────────────────────────────────────────────────────────────

  describe('POST /api/auth/register', () => {
    it('đăng ký thành công và không trả về password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'password123',
          fullName: 'New User',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('newuser@example.com');
      expect(res.body.data.fullName).toBe('New User');
      expect(res.body.data).not.toHaveProperty('password');
    });

    it('trả về 409 khi email đã tồn tại trong DB', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'dup@example.com',
          password: 'password123',
          fullName: 'User 1',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'dup@example.com',
          password: 'password123',
          fullName: 'User 2',
        })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('trả về 400 khi email không hợp lệ', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'bad-email', password: 'password123', fullName: 'X' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('trả về 400 khi password ngắn hơn 6 ký tự', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'short@example.com',
          password: '123',
          fullName: 'Short',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ─── Login ────────────────────────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    beforeAll(async () => {
      await request(app.getHttpServer()).post('/api/auth/register').send({
        email: 'login@example.com',
        password: 'password123',
        fullName: 'Login User',
      });
    });

    it('đăng nhập thành công → trả về access_token và set refresh_token cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'login@example.com', password: 'password123' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('access_token');

      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies.some((c: string) => c.startsWith('refresh_token='))).toBe(
        true,
      );
      expect(cookies.some((c: string) => c.includes('HttpOnly'))).toBe(true);
    });

    it('trả về 401 khi sai mật khẩu', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'login@example.com', password: 'wrongpassword' })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid credentials/i);
    });

    it('trả về 401 khi email không tồn tại', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'password123' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('trả về 400 khi thiếu password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'login@example.com' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ─── Luồng đầy đủ: Register → Login → Refresh → Logout ──────────────────────

  describe('Full auth flow', () => {
    it('đăng ký → đăng nhập → refresh → logout thành công', async () => {
      // 1. Register
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'flow@example.com',
          password: 'flowpass123',
          fullName: 'Flow User',
        })
        .expect(201);

      // 2. Login
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'flow@example.com', password: 'flowpass123' })
        .expect(200);

      const accessToken: string = loginRes.body.data.access_token;
      const loginCookies = loginRes.headers[
        'set-cookie'
      ] as unknown as string[];
      const refreshCookie = loginCookies.find((c: string) =>
        c.startsWith('refresh_token='),
      )!;
      const refreshToken = refreshCookie.split(';')[0].split('=')[1];

      // 3. Refresh
      const refreshRes = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${refreshToken}`)
        .expect(200);

      expect(refreshRes.body.data).toHaveProperty('access_token');
      const newAccessToken: string = refreshRes.body.data.access_token;

      const refreshCookies2 = refreshRes.headers[
        'set-cookie'
      ] as unknown as string[];
      const newRefreshCookie = refreshCookies2.find((c: string) =>
        c.startsWith('refresh_token='),
      )!;
      const newRefreshToken = newRefreshCookie.split(';')[0].split('=')[1];

      // 4. Logout
      const logoutRes = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .set('Cookie', `refresh_token=${newRefreshToken}`)
        .expect(200);

      expect(logoutRes.body.success).toBe(true);

      // 5. Sau logout, refresh token cũ không dùng được nữa
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${newRefreshToken}`)
        .expect(401);

      void accessToken; // used for type check only
    });
  });

  // ─── Refresh ──────────────────────────────────────────────────────────────────

  describe('POST /api/auth/refresh', () => {
    it('trả về 401 khi không có refresh_token cookie', async () => {
      await request(app.getHttpServer()).post('/api/auth/refresh').expect(401);
    });

    it('trả về 401 khi refresh token không hợp lệ', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', 'refresh_token=invalid-token')
        .expect(401);
    });
  });

  // ─── Logout ───────────────────────────────────────────────────────────────────

  describe('POST /api/auth/logout', () => {
    it('trả về 401 khi chưa đăng nhập', async () => {
      await request(app.getHttpServer()).post('/api/auth/logout').expect(401);
    });
  });
});
