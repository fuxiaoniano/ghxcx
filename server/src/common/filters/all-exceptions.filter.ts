import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : null;

    let code = status;
    let message = '服务器内部错误';

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (exceptionResponse && typeof exceptionResponse === 'object') {
      const body = exceptionResponse as Record<string, unknown>;
      code = Number(body.code || body.statusCode || status);
      const rawMessage = body.message;
      message = Array.isArray(rawMessage) ? rawMessage.join('; ') : String(rawMessage || message);
    } else {
      const detail = exception instanceof Error ? exception.stack || exception.message : String(exception);
      this.logger.error('Unhandled request exception', detail);
    }

    response.status(status).json({ code, message, data: null });
  }
}
