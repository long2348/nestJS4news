import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Media } from './entities/media.entity';

@Injectable()
export class GalleryService {
  constructor(
    @InjectRepository(Media)
    private readonly repo: Repository<Media>,
  ) {}

  findAll(): Promise<Media[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  save(file: Express.Multer.File, uploadedById: number): Promise<Media> {
    const url = `/uploads/${file.filename}`;
    return this.repo.save(
      this.repo.create({
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url,
        uploadedById,
      }),
    );
  }

  async remove(id: number): Promise<void> {
    const media = await this.repo.findOne({ where: { id } });
    if (!media) throw new NotFoundException('Media not found');
    const filePath = path.join(process.cwd(), 'uploads', media.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await this.repo.remove(media);
  }
}
