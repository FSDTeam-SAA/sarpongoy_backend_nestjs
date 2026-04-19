import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { SubscribeService } from './subscribe.service';
import { CreateSubscribeDto } from './dto/create-subscribe.dto';
import AuthGuard from 'src/app/middlewares/auth.guard';
import { UserRole } from '../user/user-role.enum';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Subscribe')
@Controller('subscribe')
export class SubscribeController {
  constructor(private readonly subscribeService: SubscribeService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new subscribe',
    description: 'Create a new subscribe',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard(UserRole.ADMIN))
  async createSubscribe(@Body() createSubscribeDto: CreateSubscribeDto) {
    const result =
      await this.subscribeService.createSubscribe(createSubscribeDto);
    return {
      message: 'Subscribe created successfully',
      data: result,
    };
  }
}
