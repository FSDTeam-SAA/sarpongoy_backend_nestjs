import {
  Controller,
  Get,
  Post,
  Body,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Param,
  Put,
  Delete,
  UploadedFiles,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import AuthGuard from 'src/app/middlewares/auth.guard';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import pick from 'src/app/helpers/pick';
import { UserRole } from './user-role.enum';

@ApiTags('User(School/Admin)')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiOperation({
    summary: 'create user',
  })
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @UseGuards(AuthGuard('admin'))
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'schoolLogo', maxCount: 1 },
      { name: 'uploadeSignature', maxCount: 1 },
      { name: 'profilePicture', maxCount: 1 },
    ]),
  )
  @HttpCode(HttpStatus.CREATED)
  async createUser(
    @Body() createUserDto: CreateUserDto,
    @UploadedFiles()
    files: {
      schoolLogo?: Express.Multer.File[];
      uploadeSignature?: Express.Multer.File[];
      profilePicture?: Express.Multer.File[];
    },
  ) {
    const result = await this.userService.createUser(createUserDto, files);

    return {
      message: 'User created successfully',
      data: result,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get the all user',
  })
  @ApiBearerAuth('access-token')
  @ApiQuery({
    name: 'searchTerm',
    required: false,
    type: String,
    example: '',
    description: 'Search by ',
  })
  @ApiQuery({
    name: 'schoolName',
    required: false,
    type: String,
    example: '',
    description: 'Filter by exact schoolName value',
  })
  @ApiQuery({
    name: 'email',
    required: false,
    type: String,
    example: '',
    description: 'Filter by exact email value',
  })
  @ApiQuery({
    name: 'role',
    required: false,
    type: String,
    example: '',
    description: 'Filter by role value',
  })
  @ApiQuery({
    name: 'phoneNumber',
    required: false,
    type: String,
    example: '',
    description: 'Filter by phoneNumber value',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: 'Page number. Default is 1',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
    description: 'Items per page. Default is 10',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    example: 'createdAt',
    description: 'Sort field. Default is createdAt',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['asc', 'desc'],
    example: 'desc',
    description: 'Sort order. Default is desc',
  })
  @UseGuards(AuthGuard('admin'))
  @HttpCode(HttpStatus.OK)
  async getAllUser(@Req() req: Request) {
    const params = pick(req.query, [
      'searchTerm',
      'schoolName',
      'email',
      'role',
      'phoneNumber',
    ]);
    const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);
    const result = await this.userService.getAllUser(params, options);

    return {
      message: 'User fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  @Get('profile')
  @ApiOperation({
    summary: 'Get the profile of the currently authenticated user',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin', 'school'))
  @HttpCode(HttpStatus.OK)
  async getProfile(@Req() req: Request) {
    const user = await this.userService.getProfile(req.user!.id);
    return {
      message: 'User fetched successfully',
      data: user,
    };
  }

  @Put('profile')
  @ApiOperation({
    summary: 'Update the profile of the currently authenticated user',
  })
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @UseGuards(AuthGuard(UserRole.ADMIN, UserRole.SCHOOL))
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'schoolLogo', maxCount: 1 },
      { name: 'uploadeSignature', maxCount: 1 },
      { name: 'profilePicture', maxCount: 1 },
    ]),
  )
  @ApiBody({ type: UpdateUserDto })
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Req() req: Request,
    @Body() updateUserDto: Partial<UpdateUserDto>,
    @UploadedFiles()
    files?: {
      schoolLogo?: Express.Multer.File[];
      uploadeSignature?: Express.Multer.File[];
      profilePicture?: Express.Multer.File[];
    },
  ) {
    const result = await this.userService.updateMyProfile(
      req.user!.id,
      updateUserDto,
      files,
    );
    return {
      message: 'User updated successfully',
      data: result,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get single user by id',
  })
  @ApiQuery({
    name: 'id',
    required: true,
    type: String,
    example: '',
    description: 'User id',
  })
  @HttpCode(HttpStatus.OK)
  async getSingleUser(@Param('id') id: string) {
    const result = await this.userService.getSingleUser(id);

    return {
      message: 'User fetched successfully',
      data: result,
    };
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update user by id',
  })
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @UseGuards(AuthGuard('admin'))
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'schoolLogo', maxCount: 1 },
      { name: 'uploadeSignature', maxCount: 1 },
      { name: 'profilePicture', maxCount: 1 },
    ]),
  )
  @ApiBody({ type: UpdateUserDto })
  @HttpCode(HttpStatus.OK)
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFiles()
    files?: {
      schoolLogo?: Express.Multer.File[];
      uploadeSignature?: Express.Multer.File[];
      profilePicture?: Express.Multer.File[];
    },
  ) {
    const result = await this.userService.updateUser(id, updateUserDto, files);

    return {
      message: 'User updated successfully',
      data: result,
    };
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete user by id',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin'))
  @ApiQuery({
    name: 'id',
    required: true,
    type: String,
    example: '',
    description: 'User id',
  })
  @HttpCode(HttpStatus.OK)
  async deleteUser(@Param('id') id: string) {
    const result = await this.userService.deleteUser(id);

    return {
      message: 'User deleted successfully',
      data: result,
    };
  }
}
