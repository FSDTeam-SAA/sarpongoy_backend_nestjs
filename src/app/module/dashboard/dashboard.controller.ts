import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '../user/user-role.enum';
import AuthGuard from 'src/app/middlewares/auth.guard';
type Period = 'week' | 'month' | 'year';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get dashboard dashboardOverView' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard(UserRole.ADMIN))
  @HttpCode(HttpStatus.OK)
  async dashboardOverView() {
    const result = await this.dashboardService.dashboardOverView();
    return {
      message: 'Dashboard overview fetched successfully',
      data: result,
    };
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Get revenue chart' })
  @ApiBearerAuth('access-token')
  @ApiQuery({
    name: 'period',
    required: false,
    type: String,
    enum: ['week', 'month', 'year'],
    example: 'month',
  })
  @UseGuards(AuthGuard(UserRole.ADMIN))
  @HttpCode(HttpStatus.OK)
  async getRevenueChart(@Query() query: { period?: string }) {
    const result = await this.dashboardService.getRevenueChart(
      query.period as Period,
    );
    return {
      message: 'Revenue chart fetched successfully',
      data: result,
    };
  }
}
