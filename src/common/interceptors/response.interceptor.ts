import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'meta' in data && 'data' in data) {
          return { success: true, data: data.data, meta: data.meta };
        }
        return { success: true, data };
      }),
    );
  }
}
