import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';

import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { Project } from '../projects/project.entity';
import { CheckUpdateQueryDto } from './dto/check-update-query.dto';
import { UpdateService } from './update.service';

@Controller('api/v1')
export class UpdateController {
  constructor(private readonly updateService: UpdateService) {}

  @Get('check-update')
  @UseGuards(ApiKeyGuard)
  checkUpdate(
    @Req() request: Request & { project: Project },
    @Query() query: CheckUpdateQueryDto,
  ) {
    const forwardedFor = request.header('x-forwarded-for');
    const ip = forwardedFor?.split(',')[0]?.trim() ?? request.ip ?? null;

    return this.updateService.checkForUpdate(request.project, query, ip);
  }
}