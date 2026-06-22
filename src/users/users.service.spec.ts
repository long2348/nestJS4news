import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Role } from '../common/enums/role.enum';

const mockRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
      ],
    }).compile();
    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 1, email: 'a@b.com' });
      const result = await service.findById(1);
      expect(result).toEqual({ id: 1, email: 'a@b.com' });
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findById(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should throw ConflictException if email exists', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 1 });
      await expect(
        service.create({ email: 'a@b.com', password: 'hashed', fullName: 'A' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create and return user', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue({ email: 'a@b.com' });
      mockRepo.save.mockResolvedValue({ id: 1, email: 'a@b.com', role: Role.READER });
      const result = await service.create({ email: 'a@b.com', password: 'hashed', fullName: 'A' });
      expect(result.id).toBe(1);
    });
  });

  describe('updateRole', () => {
    it('should update and return user with new role', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 1, role: Role.READER });
      mockRepo.save.mockResolvedValue({ id: 1, role: Role.EDITOR });
      const result = await service.updateRole(1, Role.EDITOR);
      expect(result.role).toBe(Role.EDITOR);
    });
  });
});
