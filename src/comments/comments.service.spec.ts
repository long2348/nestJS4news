import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { Comment } from './entities/comment.entity';
import { Role } from '../common/enums/role.enum';

const mockRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

describe('CommentsService', () => {
  let service: CommentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: getRepositoryToken(Comment), useValue: mockRepo },
      ],
    }).compile();
    service = module.get<CommentsService>(CommentsService);
    jest.clearAllMocks();
  });

  it('should return comments for an article', async () => {
    mockRepo.find.mockResolvedValue([{ id: 1, content: 'Hay quá' }]);
    const result = await service.findByArticle(1);
    expect(result).toHaveLength(1);
    expect(mockRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ articleId: 1 }) }),
    );
  });

  it('should throw ForbiddenException when reader deletes another user comment', async () => {
    mockRepo.findOne.mockResolvedValue({ id: 1, authorId: 99 });
    await expect(service.remove(1, 1, Role.READER)).rejects.toThrow(ForbiddenException);
  });

  it('should allow admin to delete any comment', async () => {
    mockRepo.findOne.mockResolvedValue({ id: 1, authorId: 99 });
    mockRepo.remove.mockResolvedValue({});
    await expect(service.remove(1, 1, Role.ADMIN)).resolves.not.toThrow();
  });
});
