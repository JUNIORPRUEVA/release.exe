import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { MulterError } from 'multer';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const status = this.getStatus(exception);

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
    if (exception instanceof MulterError && exception.code === 'LIMIT_FILE_SIZE') {
      return 'Payload too large';
    }

    if (this.isPayloadTooLargeError(exception)) {
      return 'Payload too large';
    }

    if (exception instanceof Error && exception.message === 'Request aborted') {
      return 'Upload was interrupted before completion';
    }

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

  private getStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    if (exception instanceof MulterError && exception.code === 'LIMIT_FILE_SIZE') {
      return HttpStatus.PAYLOAD_TOO_LARGE;
    }

    if (this.isPayloadTooLargeError(exception)) {
      return HttpStatus.PAYLOAD_TOO_LARGE;
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private isPayloadTooLargeError(exception: unknown): boolean {
    if (typeof exception !== 'object' || exception === null) {
      return false;
    }

    const payloadError = exception as {
      status?: number;
      statusCode?: number;
      type?: string;
      code?: string;
      message?: string;
    };

    return (
      payloadError.status === HttpStatus.PAYLOAD_TOO_LARGE ||
      payloadError.statusCode === HttpStatus.PAYLOAD_TOO_LARGE ||
      payloadError.type === 'entity.too.large' ||
      payloadError.code === 'LIMIT_FILE_SIZE' ||
      payloadError.message === 'request entity too large'
    );
  }
}
