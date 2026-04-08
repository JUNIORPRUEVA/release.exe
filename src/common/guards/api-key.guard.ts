import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

import { ProjectsService } from '../../projects/projects.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly projectsService: ProjectsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { project?: unknown }>();
    const apiKeyHeader = request.header('x-api-key')?.trim();

    if (!apiKeyHeader) {
      throw new UnauthorizedException('Missing API key');
    }

    const project = await this.projectsService.findByApiKey(apiKeyHeader);

    if (!project) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (!project.isActive) {
      throw new ForbiddenException('Project is inactive');
    }

    request.project = project;
    return true;
  }
}