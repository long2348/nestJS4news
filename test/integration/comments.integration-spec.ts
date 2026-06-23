import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import cookieParser from 'cookie-parser';

import { CommentsService } from '../../src/comments/comments.service';
import { CommentsController } from '../../src/comments/comments.controller';
import { Comment } from '../../src/comments/entities/comment.entity';
import { UsersService } from '../../src/users/users.service';
import { User } from '../../src/users/entities/user.entity';
import { JwtStrategy } from '../../src/auth/strategies/jwt.strategy';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { Role } from '../../src/common/enums/role.enum';

process.env.JWT_SECRET = 'test-jwt-secret';

const MOCK_USER_READER: Partial<User> = {
  id: 1,
  email: 'reader@example.com',
  fullName: 'Reader User',
  role: Role.READER,
  isActive: true,
};

const MOCK_USER_ADMIN: Partial<User> = {
  id: 2,
  email: 'admin@example.com',
  fullName: 'Admin User',
  role: Role.ADMIN,
  isActive: true,
};

const MOCK_COMMENT: Partial<Comment> = {
  id: 1,
  content: 'Bình luận hay quá!',
  articleId: 10,
  authorId: 1,
  isApproved: false,
  createdAt: new Date('2024-01-01'),
};

describe('Comments (integration)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const mockCommentRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PassportModule,
        JwtModule.register({}),
      ],
      controllers: [CommentsController],
      providers: [
        CommentsService,
        JwtStrategy,
        UsersService,
        { provide: getRepositoryToken(Comment), useValue: mockCommentRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
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

    jwtService = moduleFixture.get<JwtService>(JwtService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const signToken = (user: Partial<User>) =>
    jwtService.sign(
      { sub: user.id, email: user.email },
      { secret: 'test-jwt-secret', expiresIn: '1h' },
    );

  // ─── GET /api/comments/article/:articleId ──────────────────────────────────────

  describe('GET /api/comments/article/:articleId', () => {
    it('trả về danh sách comment của bài báo (không cần auth)', async () => {
      mockCommentRepo.find.mockResolvedValue([MOCK_COMMENT]);

      const res = await request(app.getHttpServer())
        .get('/api/comments/article/10')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(mockCommentRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ articleId: 10 }),
        }),
      );
    });

    it('trả về mảng rỗng khi bài báo chưa có comment', async () => {
      mockCommentRepo.find.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/api/comments/article/99')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res?.body.data).toHaveLength(0);
    });

    it('trả về 400 khi articleId không phải số', async () => {
      await request(app.getHttpServer())
        .get('/api/comments/article/not-a-number')
        .expect(400);
    });
  });

  // ─── POST /api/comments/article/:articleId ────────────────────────────────────

  describe('POST /api/comments/article/:articleId', () => {
    it('trả về 401 khi chưa đăng nhập', async () => {
      await request(app.getHttpServer())
        .post('/api/comments/article/10')
        .send({ content: 'Bình luận hay quá!' })
        .expect(401);
    });

    it('người dùng đã đăng nhập tạo comment thành công', async () => {
      const token = signToken(MOCK_USER_READER);
      mockUserRepo.findOne.mockResolvedValue(MOCK_USER_READER);
      mockCommentRepo.create.mockReturnValue(MOCK_COMMENT);
      mockCommentRepo.save.mockResolvedValue(MOCK_COMMENT);

      const res = await request(app.getHttpServer())
        .post('/api/comments/article/10')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Bình luận hay quá!' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(mockCommentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Bình luận hay quá!',
          articleId: 10,
          authorId: MOCK_USER_READER.id,
        }),
      );
    });

    it('tạo reply (nested comment) với parentId', async () => {
      const token = signToken(MOCK_USER_READER);
      mockUserRepo.findOne.mockResolvedValue(MOCK_USER_READER);
      const replyComment = { ...MOCK_COMMENT, id: 2, parentId: 1 };
      mockCommentRepo.create.mockReturnValue(replyComment);
      mockCommentRepo.save.mockResolvedValue(replyComment);

      const res = await request(app.getHttpServer())
        .post('/api/comments/article/10')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Trả lời comment!', parentId: 1 })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(mockCommentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: 1 }),
      );
    });

    it('trả về 400 khi thiếu content', async () => {
      const token = signToken(MOCK_USER_READER);
      mockUserRepo.findOne.mockResolvedValue(MOCK_USER_READER);

      const res = await request(app.getHttpServer())
        .post('/api/comments/article/10')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ─── PATCH /api/comments/:id/approve ─────────────────────────────────────────

  describe('PATCH /api/comments/:id/approve', () => {
    it('trả về 401 khi chưa đăng nhập', async () => {
      await request(app.getHttpServer())
        .patch('/api/comments/1/approve')
        .expect(401);
    });

    it('trả về 403 khi reader cố approve', async () => {
      const token = signToken(MOCK_USER_READER);
      mockUserRepo.findOne.mockResolvedValue(MOCK_USER_READER);

      await request(app.getHttpServer())
        .patch('/api/comments/1/approve')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('admin approve comment thành công', async () => {
      const token = signToken(MOCK_USER_ADMIN);
      mockUserRepo.findOne.mockResolvedValue(MOCK_USER_ADMIN);
      mockCommentRepo.findOne.mockResolvedValue(MOCK_COMMENT);
      mockCommentRepo.save.mockResolvedValue({
        ...MOCK_COMMENT,
        isApproved: true,
      });

      const res = await request(app.getHttpServer())
        .patch('/api/comments/1/approve')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isApproved).toBe(true);
    });

    it('trả về 404 khi comment không tồn tại', async () => {
      const token = signToken(MOCK_USER_ADMIN);
      mockUserRepo.findOne.mockResolvedValue(MOCK_USER_ADMIN);
      mockCommentRepo.findOne.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .patch('/api/comments/999/approve')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  // ─── DELETE /api/comments/:id ─────────────────────────────────────────────────

  describe('DELETE /api/comments/:id', () => {
    it('trả về 401 khi chưa đăng nhập', async () => {
      await request(app.getHttpServer()).delete('/api/comments/1').expect(401);
    });

    it('người dùng xóa comment của chính mình thành công', async () => {
      const token = signToken(MOCK_USER_READER);
      mockUserRepo.findOne.mockResolvedValue(MOCK_USER_READER);
      mockCommentRepo.findOne.mockResolvedValue({
        ...MOCK_COMMENT,
        authorId: MOCK_USER_READER.id,
      });
      mockCommentRepo.remove.mockResolvedValue({});

      await request(app.getHttpServer())
        .delete('/api/comments/1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(mockCommentRepo.remove).toHaveBeenCalled();
    });

    it('trả về 403 khi người dùng cố xóa comment của người khác', async () => {
      const token = signToken(MOCK_USER_READER);
      mockUserRepo.findOne.mockResolvedValue(MOCK_USER_READER);
      mockCommentRepo.findOne.mockResolvedValue({
        ...MOCK_COMMENT,
        authorId: 999,
      });

      const res = await request(app.getHttpServer())
        .delete('/api/comments/1')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/own comments/i);
    });

    it('admin xóa comment của bất kỳ người dùng nào', async () => {
      const token = signToken(MOCK_USER_ADMIN);
      mockUserRepo.findOne.mockResolvedValue(MOCK_USER_ADMIN);
      mockCommentRepo.findOne.mockResolvedValue({
        ...MOCK_COMMENT,
        authorId: 999,
      });
      mockCommentRepo.remove.mockResolvedValue({});

      await request(app.getHttpServer())
        .delete('/api/comments/1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(mockCommentRepo.remove).toHaveBeenCalled();
    });

    it('trả về 404 khi comment không tồn tại', async () => {
      const token = signToken(MOCK_USER_READER);
      mockUserRepo.findOne.mockResolvedValue(MOCK_USER_READER);
      mockCommentRepo.findOne.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .delete('/api/comments/999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });
});
