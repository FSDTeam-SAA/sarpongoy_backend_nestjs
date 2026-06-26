import {
  Controller,
  Get,
  Post,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  HttpCode,
  Req,
  UploadedFile,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { ExclesheetService } from './exclesheet.service';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import AuthGuard from 'src/app/middlewares/auth.guard';
import { SchoolPaymentAccessGuard } from 'src/app/middlewares/school-payment-access.guard';
import { UserRole } from '../user/user-role.enum';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import pick from 'src/app/helpers/pick';
import { fileUpload } from 'src/app/helpers/fileUploder';

@Controller('exclesheet')
export class ExclesheetController {
  constructor(private readonly exclesheetService: ExclesheetService) {}

  // ─── POST /student/upload — Upload Excel file ──────────────────────────
  @Post('upload')
  @ApiOperation({ summary: 'Upload students from Excel file (.xlsx)' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard(UserRole.SCHOOL), SchoolPaymentAccessGuard)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', fileUpload.uploadConfig))
  @HttpCode(HttpStatus.CREATED)
  async uploadStudents(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Excel file is required');
    const result = await this.exclesheetService.uploadStudents(
      req.user!.id,
      file,
    );
    return { message: result.message, data: result };
  }

  // ─── GET /student — Get all students of logged-in school ──────────────
  @Get()
  @ApiOperation({ summary: 'Get all students of the logged-in school' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard(UserRole.SCHOOL), SchoolPaymentAccessGuard)
  @ApiQuery({ name: 'searchTerm', required: false, type: String })
  @ApiQuery({ name: 'gradeLevel', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    example: 'createdAt',
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @HttpCode(HttpStatus.OK)
  async getStudents(@Req() req: Request) {
    const filters = pick(req.query, ['searchTerm', 'gradeLevel']);
    const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);
    const result = await this.exclesheetService.getAllStudents(
      req.user!.id,
      filters,
      options,
    );
    return {
      message: 'Students fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  @Get('school/:schoolId')
  @ApiOperation({ summary: 'Get imported students for a school as admin' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard(UserRole.ADMIN))
  @ApiQuery({ name: 'searchTerm', required: false, type: String })
  @ApiQuery({ name: 'gradeLevel', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    example: 'createdAt',
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @HttpCode(HttpStatus.OK)
  async getSchoolStudents(
    @Param('schoolId') schoolId: string,
    @Req() req: Request,
  ) {
    const filters = pick(req.query, ['searchTerm', 'gradeLevel']);
    const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);
    const result = await this.exclesheetService.getStudentsBySchool(
      schoolId,
      filters,
      options,
    );
    return {
      message: 'Students fetched successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  // ─── GET /student/download — Download as Excel ────────────────────────
  @Get('download')
  @ApiOperation({ summary: 'Download all students as Excel file' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard(UserRole.SCHOOL), SchoolPaymentAccessGuard)
  async downloadStudents(@Req() req: Request, @Res() res: Response) {
    const buffer = await this.exclesheetService.downloadStudents(req.user!.id);

    const filename = `students_${Date.now()}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  // ─── DELETE /student — Delete all students of school ──────────────────
  @Delete()
  @ApiOperation({ summary: 'Delete all students of logged-in school' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard(UserRole.SCHOOL), SchoolPaymentAccessGuard)
  @HttpCode(HttpStatus.OK)
  async deleteAllStudents(@Req() req: Request) {
    const result = await this.exclesheetService.deleteAllStudents(req.user!.id);
    return { message: `${result.deleted} students deleted`, data: result };
  }

  // ─── DELETE /student/:id — Delete single student ──────────────────────
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a single student by ID' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard(UserRole.SCHOOL), SchoolPaymentAccessGuard)
  @HttpCode(HttpStatus.OK)
  async deleteStudent(@Req() req: Request, @Param('id') id: string) {
    const result = await this.exclesheetService.deleteStudent(req.user!.id, id);
    return { message: 'Student deleted successfully', data: result };
  }
}
