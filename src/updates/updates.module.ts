import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { UpdateLog } from '../logs/log.entity';
import { ProjectsModule } from '../projects/projects.module';
import { VersionsModule } from '../versions/versions.module';
import { UpdateController } from './update.controller';
import { UpdateService } from './update.service';

@Module({
  imports: [TypeOrmModule.forFeature([UpdateLog]), ProjectsModule, VersionsModule],
  controllers: [UpdateController],
  providers: [UpdateService, ApiKeyGuard],
  exports: [UpdateService],
})
export class UpdatesModule {}