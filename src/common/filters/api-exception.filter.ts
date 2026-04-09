import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const message = this.getMessage(exceptionResponse, exception);
    const details =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? exceptionResponse
        : undefined;

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.path} failed with ${status}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    if (!request.path.startsWith('/api/')) {
      response.status(status).send(message);
      return;
    }

    response.status(status).json({
      error: {
        statusCode: status,
        message,
        details,
      },
    });
  }

  private getMessage(exceptionResponse: unknown, exception: unknown): string {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse
    ) {
      const value = (exceptionResponse as { message?: string | string[] }).message;

      if (Array.isArray(value)) {
        return value.join(', ');
      }

      if (typeof value === 'string') {
        return value;
      }
    }

    if (exception instanceof Error) {
      return exception.message;
    }

    return 'Internal server error';
  }
}
