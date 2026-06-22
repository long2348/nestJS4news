import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const res = exception instanceof HttpException ? exception.getResponse() : null;
    const rawMessage = typeof res === 'object' && res !== null && 'message' in res
      ? (res as any).message
      : exception instanceof Error ? exception.message : 'Internal server error';

    const isArray = Array.isArray(rawMessage);
    response.status(status).json({
      success: false,
      statusCode: status,
      message: isArray ? 'Validation failed' : rawMessage,
      ...(isArray && { errors: rawMessage }),
    });
  }
}
