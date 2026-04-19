import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Get,
  Req,
  Param,
  Patch,
  Delete,
  Put,
} from '@nestjs/common';
import { SchoolService } from './school.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import AuthGuard from 'src/app/middlewares/auth.guard';
import { UserRole } from '../user/user-role.enum';
import type { Request } from 'express';
import pick from 'src/app/helpers/pick';

@ApiTags('School')
@Controller('school')
export class SchoolController {
  constructor(private readonly schoolService: SchoolService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new school',
    description: 'Create a new school',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard(UserRole.ADMIN))
  @HttpCode(HttpStatus.CREATED)
  async createSchool(@Body() createSchoolDto: CreateSchoolDto) {
    const result = await this.schoolService.createSchool(createSchoolDto);
    return {
      message: 'School created successfully',
      data: result,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all schools',
    description: 'Get all schools',
  })
  @ApiQuery({ name: 'searchTerm', required: false, description: 'Search term' })
  @ApiQuery({ name: 'name', required: false, description: 'School name' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort by' })
  @ApiQuery({ name: 'sortOrder', required: false, description: 'Sort order' })
  @HttpCode(HttpStatus.OK)
  async getAllSchool(@Req() req: Request) {
    const filters = pick(req.query, ['name']);
    const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await this.schoolService.getAllSchool(filters, options);
    return {
      message: 'Schools fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single school',
    description: 'Get a single school',
  })
  @HttpCode(HttpStatus.OK)
  async getSingleSchool(@Param('id') id: string) {
    const result = await this.schoolService.getSingleSchool(id);
    return {
      message: 'School fetched successfully',
      data: result,
    };
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update a school',
    description: 'Update a school',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard(UserRole.ADMIN))
  @HttpCode(HttpStatus.OK)
  async updateSchool(
    @Param('id') id: string,
    @Body() updateSchoolDto: UpdateSchoolDto,
  ) {
    const result = await this.schoolService.updateSchool(id, updateSchoolDto);
    return {
      message: 'School updated successfully',
      data: result,
    };
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a school',
    description: 'Delete a school',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard(UserRole.ADMIN))
  @HttpCode(HttpStatus.OK)
  async deleteSchool(@Param('id') id: string) {
    const result = await this.schoolService.deleteSchool(id);
    return {
      message: 'School deleted successfully',
      data: result,
    };
  }
}
