import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { VersionsModule } from '../versions/versions.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [AuthModule, ProjectsModule, VersionsModule],
  controllers: [AdminController],
})
export class AdminModule {}