import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { MarketplaceController } from './marketplace.controller';

describe('MarketplaceController Level 5 driver endpoints', () => {
  const routes = [
    {
      methodName: 'listAvailableJobs',
      method: RequestMethod.GET,
      path: 'driver/jobs/available',
    },
    {
      methodName: 'listDriverJobs',
      method: RequestMethod.GET,
      path: 'driver/jobs',
    },
    {
      methodName: 'takeJob',
      method: RequestMethod.POST,
      path: 'driver/jobs/:jobId/take',
    },
    {
      methodName: 'completeJob',
      method: RequestMethod.POST,
      path: 'driver/jobs/:jobId/complete',
    },
    {
      methodName: 'getDriverEarnings',
      method: RequestMethod.GET,
      path: 'driver/earnings',
    },
  ] as const;

  it.each(routes)('exposes $methodName at the documented Level 5 route', (route) => {
    const handler = MarketplaceController.prototype[route.methodName];

    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(route.path);
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(route.method);
  });
});
