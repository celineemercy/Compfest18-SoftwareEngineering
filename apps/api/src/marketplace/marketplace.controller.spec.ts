import { GUARDS_METADATA } from '@nestjs/common/constants';
import { MarketplaceController } from './marketplace.controller';

describe('MarketplaceController public review endpoints', () => {
  const marketplace = {
    listReviews: jest.fn(),
    createReview: jest.fn(),
  };
  let controller: MarketplaceController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new MarketplaceController(marketplace as never);
  });

  it('lists public reviews without auth guards', async () => {
    const reviews = [{ id: 'review-1', name: 'Guest' }];
    marketplace.listReviews.mockResolvedValue(reviews);

    await expect(controller.listReviews()).resolves.toBe(reviews);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, MarketplaceController.prototype.listReviews),
    ).toBeUndefined();
  });

  it('creates public reviews without auth guards', async () => {
    const review = { id: 'review-1', rating: 5 };
    const dto = {
      name: 'Guest',
      rating: 5,
      category: 'Demo',
      comment: 'Works well',
    };
    marketplace.createReview.mockResolvedValue(review);

    await expect(controller.createReview(dto)).resolves.toBe(review);
    expect(marketplace.createReview).toHaveBeenCalledWith(dto);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, MarketplaceController.prototype.createReview),
    ).toBeUndefined();
  });
});
