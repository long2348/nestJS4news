import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import cookieParser from 'cookie-parser';

import { ArticlesService } from '../src/articles/articles.service';
import { ArticlesController } from '../src/articles/articles.controller';
import {
  Article,
  ArticleStatus,
} from '../src/articles/entities/article.entity';
import { TagsService } from '../src/tags/tags.service';
import { Tag } from '../src/tags/entities/tag.entity';
import { UsersService } from '../src/users/users.service';
import { User } from '../src/users/entities/user.entity';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { Role } from '../src/common/enums/role.enum';

process.env.JWT_SECRET = 'test-jwt-secret';

const MOCK_ARTICLE: Partial<Article> = {
  id: 1,
  title: 'Bài báo test',
  slug: 'bai-bao-test',
  content: 'Nội dung bài báo',
  status: ArticleStatus.PUBLISHED,
  isBreaking: false,
  isTrending: false,
  viewCount: 0,
  authorId: 1,
  tags: [],
  createdAt: new Date('2024-01-01'),
};

const MOCK_USER_EDITOR: Partial<User> = {
  id: 1,
  email: 'editor@example.com',
  fullName: 'Editor User',
  role: Role.EDITOR,
  isActive: true,
};

const MOCK_USER_ADMIN: Partial<User> = {
  id: 2,
  email: 'admin@example.com',
  fullName: 'Admin User',
  role: Role.ADMIN,
  isActive: true,
};

const MOCK_USER_READER: Partial<User> = {
  id: 3,
  email: 'reader@example.com',
  fullName: 'Reader User',
  role: Role.READER,
  isActive: true,
};

describe('Articles (integration)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const mockArticleRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    increment: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockTagRepo = {
    find: jest.fn(),
    findBy: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
  };

  const makeArticleQb = (articles: Partial<Article>[], total: number) => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([articles, total]),
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PassportModule,
        JwtModule.register({}),
      ],
      controllers: [ArticlesController],
      providers: [
        ArticlesService,
        TagsService,
        JwtStrategy,
        UsersService,
        { provide: getRepositoryToken(Article), useValue: mockArticleRepo },
        { provide: getRepositoryToken(Tag), useValue: mockTagRepo },
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

  // ─── GET /api/articles ────────────────────────────────────────────────────────

  describe('GET /api/articles', () => {
    it('trả về danh sách bài báo đã publish với meta phân trang', async () => {
      mockArticleRepo.createQueryBuilder.mockReturnValue(
        makeArticleQb([MOCK_ARTICLE], 1),
      );

      const res = await request(app.getHttpServer())
        .get('/api/articles')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toMatchObject({ total: 1, page: 1, limit: 10 });
    });

    it('nhận query filter q và chuyển xuống service', async () => {
      const qb = makeArticleQb([MOCK_ARTICLE], 1);
      mockArticleRepo.createQueryBuilder.mockReturnValue(qb);

      await request(app.getHttpServer())
        .get('/api/articles?q=test&page=2&limit=5')
        .expect(200);

      expect(qb.skip).toHaveBeenCalledWith(5);
      expect(qb.take).toHaveBeenCalledWith(5);
    });

    it('trả về 400 khi page không phải số nguyên dương', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/articles?page=0')
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ─── GET /api/articles/breaking ───────────────────────────────────────────────

  describe('GET /api/articles/breaking', () => {
    it('trả về các bài báo breaking', async () => {
      const breakingArticle = { ...MOCK_ARTICLE, isBreaking: true };
      mockArticleRepo.find.mockResolvedValue([breakingArticle]);

      const res = await request(app.getHttpServer())
        .get('/api/articles/breaking')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(mockArticleRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isBreaking: true }),
        }),
      );
    });
  });

  // ─── GET /api/articles/trending ───────────────────────────────────────────────

  describe('GET /api/articles/trending', () => {
    it('trả về các bài báo trending', async () => {
      const trendingArticle = { ...MOCK_ARTICLE, isTrending: true };
      mockArticleRepo.find.mockResolvedValue([trendingArticle]);

      const res = await request(app.getHttpServer())
        .get('/api/articles/trending')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });
  });

  // ─── GET /api/articles/:slug ──────────────────────────────────────────────────

  describe('GET /api/articles/:slug', () => {
    it('trả về bài báo theo slug và tăng viewCount', async () => {
      mockArticleRepo.findOne.mockResolvedValue(MOCK_ARTICLE);
      mockArticleRepo.increment.mockResolvedValue({});

      const res = await request(app.getHttpServer())
        .get('/api/articles/bai-bao-test')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.slug).toBe('bai-bao-test');
      expect(mockArticleRepo.increment).toHaveBeenCalledWith(
        { id: MOCK_ARTICLE.id },
        'viewCount',
        1,
      );
    });

    it('trả về 404 khi slug không tồn tại', async () => {
      mockArticleRepo.findOne.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .get('/api/articles/khong-ton-tai')
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });
  });

  // ─── POST /api/articles ───────────────────────────────────────────────────────

  describe('POST /api/articles', () => {
    const validPayload = {
      title: 'Bài báo mới',
      slug: 'bai-bao-moi',
      content: 'Nội dung chi tiết',
    };

    it('trả về 401 khi chưa đăng nhập', async () => {
      await request(app.getHttpServer())
        .post('/api/articles')
        .send(validPayload)
        .expect(401);
    });

    it('trả về 403 khi role là READER', async () => {
      const token = signToken(MOCK_USER_READER);
      mockUserRepo.findOne.mockResolvedValue(MOCK_USER_READER);

      await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload)
        .expect(403);
    });

    it('editor tạo bài báo thành công', async () => {
      const token = signToken(MOCK_USER_EDITOR);
      mockUserRepo.findOne.mockResolvedValue(MOCK_USER_EDITOR);
      mockArticleRepo.findOne.mockResolvedValue(null);
      mockArticleRepo.create.mockReturnValue({
        ...MOCK_ARTICLE,
        ...validPayload,
      });
      mockArticleRepo.save.mockResolvedValue({
        ...MOCK_ARTICLE,
        ...validPayload,
      });

      const res = await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.slug).toBe('bai-bao-moi');
    });

    it('admin tạo bài báo thành công', async () => {
      const token = signToken(MOCK_USER_ADMIN);
      mockUserRepo.findOne.mockResolvedValue(MOCK_USER_ADMIN);
      mockArticleRepo.findOne.mockResolvedValue(null);
      mockArticleRepo.create.mockReturnValue({
        ...MOCK_ARTICLE,
        ...validPayload,
      });
      mockArticleRepo.save.mockResolvedValue({
        ...MOCK_ARTICLE,
        ...validPayload,
      });

      const res = await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload)
        .expect(201);

      expect(res.body.success).toBe(true);
    });

    it('trả về 409 khi slug đã tồn tại', async () => {
      const token = signToken(MOCK_USER_EDITOR);
      mockUserRepo.findOne.mockResolvedValue(MOCK_USER_EDITOR);
      mockArticleRepo.findOne.mockResolvedValue(MOCK_ARTICLE);

      const res = await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload)
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/slug already exists/i);
    });

    it('trả về 400 khi thiếu field bắt buộc', async () => {
      const token = signToken(MOCK_USER_EDITOR);
      mockUserRepo.findOne.mockResolvedValue(MOCK_USER_EDITOR);

      const res = await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Chỉ có title' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ─── PATCH /api/articles/:id/publish ─────────────────────────────────────────

  describe('PATCH /api/articles/:id/publish', () => {
    it('trả về 401 khi chưa đăng nhập', async () => {
      await request(app.getHttpServer())
        .patch('/api/articles/1/publish')
        .expect(401);
    });

    it('trả về 403 khi editor cố publish', async () => {
      const token = signToken(MOCK_USER_EDITOR);
      mockUserRepo.findOne.mockResolvedValue(MOCK_USER_EDITOR);

      await request(app.getHttpServer())
        .patch('/api/articles/1/publish')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('admin publish bài báo thành công', async () => {
      const token = signToken(MOCK_USER_ADMIN);
      mockUserRepo.findOne.mockResolvedValue(MOCK_USER_ADMIN);
      const draftArticle = { ...MOCK_ARTICLE, status: ArticleStatus.DRAFT };
      mockArticleRepo.findOne.mockResolvedValue(draftArticle);
      mockArticleRepo.save.mockResolvedValue({
        ...draftArticle,
        status: ArticleStatus.PUBLISHED,
        publishedAt: new Date(),
      });

      const res = await request(app.getHttpServer())
        .patch('/api/articles/1/publish')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(ArticleStatus.PUBLISHED);
    });
  });

  // ─── DELETE /api/articles/:id ─────────────────────────────────────────────────

  describe('DELETE /api/articles/:id', () => {
    it('trả về 401 khi chưa đăng nhập', async () => {
      await request(app.getHttpServer()).delete('/api/articles/1').expect(401);
    });

    it('trả về 403 khi editor cố xóa', async () => {
      const token = signToken(MOCK_USER_EDITOR);
      mockUserRepo.findOne.mockResolvedValue(MOCK_USER_EDITOR);

      await request(app.getHttpServer())
        .delete('/api/articles/1')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('admin xóa bài báo thành công', async () => {
      const token = signToken(MOCK_USER_ADMIN);
      mockUserRepo.findOne.mockResolvedValue(MOCK_USER_ADMIN);
      mockArticleRepo.findOne.mockResolvedValue(MOCK_ARTICLE);
      mockArticleRepo.remove.mockResolvedValue({});

      await request(app.getHttpServer())
        .delete('/api/articles/1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('trả về 404 khi bài báo không tồn tại', async () => {
      const token = signToken(MOCK_USER_ADMIN);
      mockUserRepo.findOne.mockResolvedValue(MOCK_USER_ADMIN);
      mockArticleRepo.findOne.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .delete('/api/articles/999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });
});
