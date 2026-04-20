// payment/payment.controller.ts
import {
  Controller,
  Post,
  Param,
  Req,
  UseGuards,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import AuthGuard from 'src/app/middlewares/auth.guard';
import pick from 'src/app/helpers/pick';
import { PaymentService } from './payment.service';
import { UserRole } from '../user/user-role.enum';

@ApiTags('payment')
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post(':subscribeId')
  @ApiOperation({ summary: 'Create payment intent for a booking' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard(UserRole.SCHOOL))
  @HttpCode(HttpStatus.CREATED)
  async paySubscribe(
    @Req() req: Request,
    @Param('subscribeId') subscribeId: string,
  ) {
    const result = await this.paymentService.paySubscribe(
      req.user!.id,
      subscribeId,
    );
    return {
      message: 'Payment intent created successfully',
      data: result,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all payments' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin'))
  @ApiQuery({ name: 'searchTerm', required: false, type: String })
  @ApiQuery({ name: 'paymentType', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    example: 'createdAt',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  @HttpCode(HttpStatus.OK)
  async getAllPayment(@Req() req: Request) {
    const filters = pick(req.query, ['searchTerm', 'paymentType', 'status']);
    const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);
    const result = await this.paymentService.getAllPayment(filters, options);
    return {
      message: 'Payment retrieved successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment by Id' })
  @HttpCode(HttpStatus.OK)
  async getSinglePayment(@Param('id') id: string) {
    const result = await this.paymentService.getSinglePayment(id);
    return {
      message: 'Payment retrieved successfully',
      data: result,
    };
  }
}
