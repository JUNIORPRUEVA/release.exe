import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProjectsModule } from '../projects/projects.module';
import { StorageModule } from '../storage/storage.module';
import { AppVersion } from './version.entity';
import { VersionsService } from './versions.service';

@Module({
  imports: [TypeOrmModule.forFeature([AppVersion]), ProjectsModule, StorageModule],
  providers: [VersionsService],
  exports: [VersionsService, TypeOrmModule],
})
export class VersionsModule {}