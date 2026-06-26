// payment/payment.controller.ts
import {
  Controller,
  Post,
  Param,
  Req,
  UseGuards,
  Get,
  Body,
  Patch,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
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

  @Post('school/:schoolId')
  @ApiOperation({ summary: 'Create payment intent for school subscription' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard(UserRole.SCHOOL))
  @HttpCode(HttpStatus.CREATED)
  async paySubscribeSchool(
    @Req() req: Request,
    @Param('schoolId') schoolId: string,
    @Body()
    body: {
      paymentPlan?: 'first_term' | 'second_term' | 'third_term' | 'full_year';
      forceNew?: boolean;
      termDueDates?: {
        firstTerm?: string;
        secondTerm?: string;
        thirdTerm?: string;
      };
    },
  ) {
    const result = await this.paymentService.paySubscribeSchool(
      req.user!.id,
      schoolId,
      body,
    );
    return {
      message: 'Payment intent created successfully',
      data: result,
    };
  }

  @Post('school/:schoolId/offline')
  @ApiOperation({ summary: 'Request offline school subscription approval' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard(UserRole.SCHOOL))
  @HttpCode(HttpStatus.CREATED)
  async requestOfflineSchoolPayment(
    @Req() req: Request,
    @Param('schoolId') schoolId: string,
    @Body()
    body: {
      paymentPlan?: 'first_term' | 'second_term' | 'third_term' | 'full_year';
      termDueDates?: {
        firstTerm?: string;
        secondTerm?: string;
        thirdTerm?: string;
      };
      offlinePaymentNote?: string;
    },
  ) {
    const result = await this.paymentService.requestOfflineSchoolPayment(
      req.user!.id,
      schoolId,
      body,
    );
    return {
      message: 'Offline payment request submitted for admin approval',
      data: result,
    };
  }

  @Post(':id/approve-offline')
  @ApiOperation({ summary: 'Approve an offline school payment' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin'))
  @HttpCode(HttpStatus.OK)
  async approveOfflineSchoolPayment(
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const result = await this.paymentService.approveOfflineSchoolPayment(
      id,
      req.user!.id,
    );
    return {
      message: 'Offline payment approved successfully',
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

  @Get('school-status')
  @ApiOperation({ summary: 'Get school term payment statuses' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin'))
  @HttpCode(HttpStatus.OK)
  async getAllSchoolPaymentStatuses() {
    const result = await this.paymentService.getAllSchoolPaymentStatuses();
    return {
      message: 'School payment statuses retrieved successfully',
      data: result,
    };
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Manually update payment status' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin'))
  @HttpCode(HttpStatus.OK)
  async updatePaymentStatus(
    @Req() req: Request,
    @Param('id') id: string,
    @Body()
    body: {
      status: 'pending' | 'offline_pending' | 'completed' | 'failed' | 'refunded';
    },
  ) {
    const result = await this.paymentService.updatePaymentStatus(
      id,
      body.status,
      req.user!.id,
    );
    return {
      message: 'Payment status updated successfully',
      data: result,
    };
  }

  @Get('school/:schoolId/access')
  @ApiOperation({ summary: 'Check current user school payment access' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard(UserRole.SCHOOL))
  @HttpCode(HttpStatus.OK)
  async getSchoolPaymentAccess(
    @Req() req: Request,
    @Param('schoolId') schoolId: string,
  ) {
    const result = await this.paymentService.getSchoolPaymentAccess(
      req.user!.id,
      schoolId,
    );
    return {
      message: 'School payment access checked successfully',
      data: result,
    };
  }

  @Get('school/:schoolId/overview')
  @ApiOperation({ summary: 'Get school payment overview with history' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard(UserRole.ADMIN, UserRole.SCHOOL))
  @HttpCode(HttpStatus.OK)
  async getSchoolPaymentOverview(
    @Req() req: Request,
    @Param('schoolId') schoolId: string,
  ) {
    const result = await this.paymentService.getSchoolPaymentOverview(
      req.user!.id,
      req.user!.role,
      schoolId,
    );
    return {
      message: 'School payment overview retrieved successfully',
      data: result,
    };
  }

  @Get(':id/invoice')
  @ApiOperation({ summary: 'Download payment invoice PDF' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard(UserRole.ADMIN, UserRole.SCHOOL))
  @HttpCode(HttpStatus.OK)
  async downloadPaymentInvoice(
    @Req() req: Request,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const invoice = await this.paymentService.getPaymentInvoice(
      req.user!.id,
      req.user!.role,
      id,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${invoice.filename}"`,
    );
    res.send(invoice.buffer);
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
