import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ActiveRoleGuard } from '../auth/guards/active-role.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/auth.types';
import {
  AddCartItemDto,
  AdvanceTimeDto,
  CheckoutDto,
  CreateAddressDto,
  CreateAdminUserDto,
  CreateDiscountDto,
  CreateReviewDto,
  TopUpWalletDto,
  UpdateAddressDto,
  UpdateCartItemDto,
} from './dto/marketplace.dto';
import { MarketplaceService } from './marketplace.service';

@Controller()
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @Get('reviews')
  listReviews() {
    return this.marketplace.listReviews();
  }

  @Post('reviews')
  createReview(@Body() dto: CreateReviewDto) {
    return this.marketplace.createReview(dto);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.BUYER))
  @Get('buyer/wallet')
  getWallet(@Req() request: AuthenticatedRequest) {
    return this.marketplace.getWallet(request.user.id);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.BUYER))
  @Post('buyer/wallet/top-up')
  topUpWallet(
    @Req() request: AuthenticatedRequest,
    @Body() dto: TopUpWalletDto,
  ) {
    return this.marketplace.topUpWallet(request.user.id, dto);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.BUYER))
  @Get('buyer/wallet/transactions')
  listWalletTransactions(@Req() request: AuthenticatedRequest) {
    return this.marketplace.listWalletTransactions(request.user.id);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.BUYER))
  @Get('buyer/addresses')
  listAddresses(@Req() request: AuthenticatedRequest) {
    return this.marketplace.listAddresses(request.user.id);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.BUYER))
  @Post('buyer/addresses')
  createAddress(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateAddressDto,
  ) {
    return this.marketplace.createAddress(request.user.id, dto);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.BUYER))
  @Patch('buyer/addresses/:addressId')
  updateAddress(
    @Req() request: AuthenticatedRequest,
    @Param('addressId') addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.marketplace.updateAddress(request.user.id, addressId, dto);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.BUYER))
  @Delete('buyer/addresses/:addressId')
  deleteAddress(
    @Req() request: AuthenticatedRequest,
    @Param('addressId') addressId: string,
  ) {
    return this.marketplace.deleteAddress(request.user.id, addressId);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.BUYER))
  @Get('buyer/cart')
  getCart(@Req() request: AuthenticatedRequest) {
    return this.marketplace.getCart(request.user.id);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.BUYER))
  @Post('buyer/cart/items')
  addCartItem(
    @Req() request: AuthenticatedRequest,
    @Body() dto: AddCartItemDto,
  ) {
    return this.marketplace.addCartItem(request.user.id, dto);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.BUYER))
  @Patch('buyer/cart/items/:itemId')
  updateCartItem(
    @Req() request: AuthenticatedRequest,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.marketplace.updateCartItem(request.user.id, itemId, dto);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.BUYER))
  @Delete('buyer/cart/items/:itemId')
  deleteCartItem(
    @Req() request: AuthenticatedRequest,
    @Param('itemId') itemId: string,
  ) {
    return this.marketplace.deleteCartItem(request.user.id, itemId);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.BUYER))
  @Post('buyer/checkout')
  checkout(@Req() request: AuthenticatedRequest, @Body() dto: CheckoutDto) {
    return this.marketplace.checkout(request.user.id, dto);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.BUYER))
  @Get('buyer/orders')
  listBuyerOrders(@Req() request: AuthenticatedRequest) {
    return this.marketplace.listBuyerOrders(request.user.id);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.BUYER))
  @Get('buyer/orders/:orderId')
  getBuyerOrder(
    @Req() request: AuthenticatedRequest,
    @Param('orderId') orderId: string,
  ) {
    return this.marketplace.getBuyerOrder(request.user.id, orderId);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.BUYER))
  @Get('buyer/reports/spending')
  getBuyerSpending(@Req() request: AuthenticatedRequest) {
    return this.marketplace.getBuyerSpending(request.user.id);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.SELLER))
  @Get('seller/orders')
  listSellerOrders(@Req() request: AuthenticatedRequest) {
    return this.marketplace.listSellerOrders(request.user.id);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.SELLER))
  @Post('seller/orders/:orderId/process')
  processSellerOrder(
    @Req() request: AuthenticatedRequest,
    @Param('orderId') orderId: string,
  ) {
    return this.marketplace.processSellerOrder(request.user.id, orderId);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.SELLER))
  @Get('seller/reports/income')
  getSellerIncome(@Req() request: AuthenticatedRequest) {
    return this.marketplace.getSellerIncome(request.user.id);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.ADMIN))
  @Post('admin/vouchers')
  createVoucher(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateDiscountDto,
  ) {
    return this.marketplace.createVoucher(request.user.id, dto);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.ADMIN))
  @Post('admin/promos')
  createPromo(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateDiscountDto,
  ) {
    return this.marketplace.createPromo(request.user.id, dto);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.ADMIN))
  @Get('admin/vouchers')
  listVouchers() {
    return this.marketplace.listVouchers();
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.ADMIN))
  @Get('admin/promos')
  listPromos() {
    return this.marketplace.listPromos();
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.DRIVER))
  @Get('driver/jobs/available')
  listAvailableJobs() {
    return this.marketplace.listAvailableJobs();
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.DRIVER))
  @Get('driver/jobs')
  listDriverJobs(@Req() request: AuthenticatedRequest) {
    return this.marketplace.listDriverJobs(request.user.id);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.DRIVER))
  @Post('driver/jobs/:jobId/take')
  takeJob(
    @Req() request: AuthenticatedRequest,
    @Param('jobId') jobId: string,
  ) {
    return this.marketplace.takeJob(request.user.id, jobId);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.DRIVER))
  @Post('driver/jobs/:jobId/complete')
  completeJob(
    @Req() request: AuthenticatedRequest,
    @Param('jobId') jobId: string,
  ) {
    return this.marketplace.completeJob(request.user.id, jobId);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.DRIVER))
  @Get('driver/earnings')
  getDriverEarnings(@Req() request: AuthenticatedRequest) {
    return this.marketplace.getDriverEarnings(request.user.id);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.ADMIN))
  @Get('admin/monitoring')
  getAdminMonitoring() {
    return this.marketplace.getAdminMonitoring();
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.ADMIN))
  @Post('admin/time/advance')
  advanceTime(@Body() dto: AdvanceTimeDto) {
    return this.marketplace.advanceTime(dto);
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.ADMIN))
  @Post('admin/overdue/process')
  processOverdueOrders() {
    return this.marketplace.processOverdueOrders();
  }

  @UseGuards(JwtAuthGuard, ActiveRoleGuard(Role.ADMIN))
  @Post('admin/users')
  createAdminUser(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateAdminUserDto,
  ) {
    return this.marketplace.createAdminUser(request.user.id, dto);
  }
}
