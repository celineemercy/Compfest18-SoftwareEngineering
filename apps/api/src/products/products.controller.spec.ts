import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ProductsController } from './products.controller';

describe('ProductsController public catalog endpoints', () => {
  const productsService = {
    findPublic: jest.fn(),
    findPublicOne: jest.fn(),
  };
  let controller: ProductsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ProductsController(productsService as never);
  });

  it('lists public catalog products without auth guards', async () => {
    const products = [{ id: 'product-1' }];
    productsService.findPublic.mockResolvedValue(products);

    await expect(controller.findPublic()).resolves.toBe(products);
    expect(productsService.findPublic).toHaveBeenCalledWith();
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ProductsController.prototype.findPublic),
    ).toBeUndefined();
  });

  it('lists public store products without auth guards', async () => {
    const products = [{ id: 'product-1', storeId: 'store-1' }];
    productsService.findPublic.mockResolvedValue(products);

    await expect(controller.findPublicByStore('store-1')).resolves.toBe(products);
    expect(productsService.findPublic).toHaveBeenCalledWith('store-1');
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        ProductsController.prototype.findPublicByStore,
      ),
    ).toBeUndefined();
  });

  it('reads a public product detail without auth guards', async () => {
    const product = { id: 'product-1' };
    productsService.findPublicOne.mockResolvedValue(product);

    await expect(controller.findPublicOne('product-1')).resolves.toBe(product);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ProductsController.prototype.findPublicOne),
    ).toBeUndefined();
  });
});
