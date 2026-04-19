import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Delete,
} from '@nestjs/common';
import { SubscribeService } from './subscribe.service';
import { CreateSubscribeDto } from './dto/create-subscribe.dto';
import AuthGuard from 'src/app/middlewares/auth.guard';
import { UserRole } from '../user/user-role.enum';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import pick from 'src/app/helpers/pick';
import type { Request } from 'express';
import { UpdateSubscribeDto } from './dto/update-subscribe.dto';

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
  @HttpCode(HttpStatus.CREATED)
  async createSubscribe(@Body() createSubscribeDto: CreateSubscribeDto) {
    const result =
      await this.subscribeService.createSubscribe(createSubscribeDto);
    return {
      message: 'Subscribe created successfully',
      data: result,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all subscribes',
    description: 'Get all subscribes',
  })
  @ApiQuery({
    name: 'searchTerm',
    description: 'Search term',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'name',
    description: 'Name',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Limit',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'page',
    description: 'Page',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'sortBy',
    description: 'Sort by',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'sortOrder',
    description: 'Sort order',
    required: false,
    type: String,
  })
  @HttpCode(HttpStatus.OK)
  async getAllSubscribes(@Req() req: Request) {
    const filters = pick(req.query, ['searchTerm', 'name']);
    const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);
    const result = await this.subscribeService.getAllSubscribes(
      filters,
      options,
    );
    return {
      message: 'Subscribes fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single subscribe',
    description: 'Get a single subscribe',
  })
  @HttpCode(HttpStatus.OK)
  async getSingleSubscribe(@Param('id') id: string) {
    const result = await this.subscribeService.getSingleSubscribe(id);
    return {
      message: 'Subscribe fetched successfully',
      data: result,
    };
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update a subscribe',
    description: 'Update a subscribe',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard(UserRole.ADMIN))
  @HttpCode(HttpStatus.OK)
  async updateSubscribe(
    @Param('id') id: string,
    @Body() updateSubscribeDto: UpdateSubscribeDto,
  ) {
    const result = await this.subscribeService.updateSubscribe(
      id,
      updateSubscribeDto,
    );
    return {
      message: 'Subscribe updated successfully',
      data: result,
    };
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a subscribe',
    description: 'Delete a subscribe',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard(UserRole.ADMIN))
  @HttpCode(HttpStatus.OK)
  async deleteSubscribe(@Param('id') id: string) {
    const result = await this.subscribeService.deleteSubscribe(id);
    return {
      message: 'Subscribe deleted successfully',
      data: result,
    };
  }
}
