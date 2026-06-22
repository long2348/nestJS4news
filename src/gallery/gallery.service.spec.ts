import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { GalleryService } from './gallery.service';
import { Media } from './entities/media.entity';

const mockRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

describe('GalleryService', () => {
  let service: GalleryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GalleryService,
        { provide: getRepositoryToken(Media), useValue: mockRepo },
      ],
    }).compile();
    service = module.get<GalleryService>(GalleryService);
    jest.clearAllMocks();
  });

  it('should return all media', async () => {
    mockRepo.find.mockResolvedValue([{ id: 1, filename: 'img.jpg' }]);
    const result = await service.findAll();
    expect(result).toHaveLength(1);
  });

  it('should throw NotFoundException on remove unknown id', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    await expect(service.remove(99)).rejects.toThrow(NotFoundException);
  });
});
