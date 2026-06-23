import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { TagsModule } from './tags/tags.module';
import { ArticlesModule } from './articles/articles.module';
import { CommentsModule } from './comments/comments.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { GalleryModule } from './gallery/gallery.module';
import { SearchModule } from './search/search.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql' as const,
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASS'),
        database: config.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
      // Patch MySQL driver before synchronize runs to remove fractional-seconds
      // precision from TIMESTAMP/DATETIME columns. Required for MySQL < 5.6.4
      // which rejects TIMESTAMP(n) syntax entirely.
      dataSourceFactory: async (options) => {
        const dataSource = new DataSource(options!);
        const driver = (dataSource as any).driver as any;
        // Remove fractional-seconds precision from regular TIMESTAMP/DATETIME columns
        if (driver?.dataTypeDefaults?.timestamp) {
          delete driver.dataTypeDefaults.timestamp.precision;
        }
        if (driver?.dataTypeDefaults?.datetime) {
          delete driver.dataTypeDefaults.datetime.precision;
        }
        // Remove precision from @CreateDateColumn / @UpdateDateColumn
        if (driver?.mappedDataTypes) {
          delete driver.mappedDataTypes.createDatePrecision;
          delete driver.mappedDataTypes.updateDatePrecision;
          delete driver.mappedDataTypes.deleteDatePrecision;
        }
        return dataSource.initialize();
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    UsersModule,
    AuthModule,
    CategoriesModule,
    TagsModule,
    ArticlesModule,
    CommentsModule,
    NewsletterModule,
    GalleryModule,
    SearchModule,
  ],
})
export class AppModule {}
