import { GUARDS_METADATA } from '@nestjs/common/constants';
import { StoresController } from './stores.controller';

describe('StoresController public catalog endpoints', () => {
  const storesService = {
    findPublic: jest.fn(),
    findPublicOne: jest.fn(),
  };
  let controller: StoresController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new StoresController(storesService as never);
  });

  it('lists public stores without auth guards', async () => {
    const stores = [{ id: 'store-1' }];
    storesService.findPublic.mockResolvedValue(stores);

    await expect(controller.findPublic()).resolves.toBe(stores);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, StoresController.prototype.findPublic),
    ).toBeUndefined();
  });

  it('reads public store detail without auth guards', async () => {
    const store = { id: 'store-1' };
    storesService.findPublicOne.mockResolvedValue(store);

    await expect(controller.findPublicOne('store-1')).resolves.toBe(store);
    expect(storesService.findPublicOne).toHaveBeenCalledWith('store-1');
    expect(
      Reflect.getMetadata(GUARDS_METADATA, StoresController.prototype.findPublicOne),
    ).toBeUndefined();
  });
});
