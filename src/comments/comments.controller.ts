import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { User } from '../users/entities/user.entity';

@ApiTags('comments')
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('article/:articleId')
  findByArticle(@Param('articleId', ParseIntPipe) articleId: number) {
    return this.commentsService.findByArticle(articleId);
  }

  @Post('article/:articleId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  create(
    @Param('articleId', ParseIntPipe) articleId: number,
    @CurrentUser() user: User,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(user.id, articleId, dto);
  }

  @Patch(':id/approve')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  approve(@Param('id', ParseIntPipe) id: number) {
    return this.commentsService.approve(id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.commentsService.remove(id, user.id, user.role);
  }
}
