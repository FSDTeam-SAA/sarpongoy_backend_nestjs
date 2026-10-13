import { ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { UtilsInterceptor } from './utils.interceptor';

describe('UtilsInterceptor response handling', () => {
  const intercept = (response: unknown, transport: Record<string, unknown>) => {
    const context = {
      switchToHttp: () => ({ getResponse: () => transport }),
    } as unknown as ExecutionContext;
    return lastValueFrom(new UtilsInterceptor().intercept(context, {
      handle: () => of(response),
    }));
  };

  it('does not transform or throw after an invoice sent its PDF and returned void', async () => {
    await expect(intercept(undefined, {
      statusCode: 200, headersSent: true, writableEnded: true,
    })).resolves.toBeUndefined();
  });

  it('leaves a manually sent webhook response untouched', async () => {
    const response = { statusCode: 200, headersSent: true, writableEnded: true };
    await expect(intercept(response, response)).resolves.toBe(response);
  });

  it('keeps the normal JSON success envelope for API handlers', async () => {
    await expect(intercept({ message: 'Payment status verified', data: { status: 'completed' } }, {
      statusCode: 200, headersSent: false, writableEnded: false,
    })).resolves.toEqual({
      statusCode: 200, success: true, message: 'Payment status verified',
      meta: undefined, data: { status: 'completed' },
    });
  });

  it.each([undefined, null])('handles an unsent empty response without a property access error', async (response) => {
    await expect(intercept(response, {
      statusCode: 204, headersSent: false, writableEnded: false,
    })).resolves.toMatchObject({ statusCode: 204, success: true });
  });
});
