import { HttpException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Exclesheet, ExclesheetDocument } from './entities/exclesheet.entity';
import { Model } from 'mongoose';
import { User, UserDocument } from '../user/entities/user.entity';
import * as XLSX from 'xlsx';
import { IFilterParams } from 'src/app/helpers/pick';
import paginationHelper, { IOptions } from 'src/app/helpers/pagenation';
import { fileUpload } from 'src/app/helpers/fileUploder';

interface ExcelRow {
  'School Name'?: string;
  'Last Name'?: string;
  'First Name'?: string;
  'Student ID'?: string | number;
  'Grade Level'?: string;
  // lowercase variants (fallback)
  school_name?: string;
  last_name?: string;
  first_name?: string;
  student_id?: string | number;
  grade_level?: string;
}

@Injectable()
export class ExclesheetService {
  constructor(
    @InjectModel(Exclesheet.name)
    private readonly exclesheetModel: Model<ExclesheetDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async uploadStudents(schoolId: string, file: Express.Multer.File) {
    const user = await this.userModel.findById(schoolId);
    if (!user) throw new HttpException('User not found', 404);

    // Parse workbook from buffer
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert sheet → JSON rows
    const rows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows.length) {
      throw new HttpException('Excel file is empty or has no data rows', 400);
    }

    // Validate required columns exist
    const firstRow = rows[0];
    const hasColumns =
      ('First Name' in firstRow || 'first_name' in firstRow) &&
      ('Last Name' in firstRow || 'last_name' in firstRow) &&
      ('Student ID' in firstRow || 'student_id' in firstRow) &&
      ('Grade Level' in firstRow || 'grade_level' in firstRow);

    if (!hasColumns) {
      throw new HttpException(
        'Invalid Excel format. Required columns: School Name, Last Name, First Name, Student ID, Grade Level',
        400,
      );
    }

    // Map rows → student documents
    const students = rows
      .filter((row) => {
        const sid = row['Student ID'] ?? row['student_id'];
        return sid !== '' && sid !== undefined && sid !== null;
      })
      .map((row) => ({
        schoolId: schoolId,
        schoolName: String(
          row['School Name'] ?? row['school_name'] ?? user.email,
        ),
        firstName: String(row['First Name'] ?? row['first_name'] ?? ''),
        lastName: String(row['Last Name'] ?? row['last_name'] ?? ''),
        studentId: String(row['Student ID'] ?? row['student_id'] ?? ''),
        gradeLevel: String(row['Grade Level'] ?? row['grade_level'] ?? ''),
      }));

    if (!students.length) {
      throw new HttpException('No valid student rows found in file', 400);
    }

    // Bulk insert — skip duplicates by studentId + schoolId
    const existingIds = await this.exclesheetModel
      .find({ schoolId: schoolId })
      .select('studentId');

    const existingSet = new Set(existingIds.map((s) => s.studentId));
    const newStudents = students.filter((s) => !existingSet.has(s.studentId));
    const skipped = students.length - newStudents.length;

    if (user.totalStudent < skipped) {
      throw new HttpException(
        'You have reached the maximum number of students',
        400,
      );
    }

    let uploadedFileUrl = '';
    if (file) {
      const uploadResult = await fileUpload.uploadToCloudinary(file);
      if (!uploadResult?.url) {
        throw new HttpException('File upload failed', 500);
      }
      uploadedFileUrl = uploadResult.url;
    }

    let inserted = 0;
    if (newStudents.length) {
      const studentsToInsert = newStudents.map((student) => ({
        ...student,
        url: uploadedFileUrl,
      }));

      const result = await this.exclesheetModel.insertMany(
        studentsToInsert,
        { ordered: false },
      );
      inserted = result.length;

      // Extract new IDs and push to the User document
      const insertedIds = result.map((doc) => doc._id as any);
      if (!user.studentList) user.studentList = [];
      user.studentList.push(...insertedIds);
      await user.save();
    }

    return {
      total: students.length,
      inserted,
      skipped,
      message: `${inserted} students imported, ${skipped} skipped (already exist)`,
    };
  }

  // ─── 2. GET ALL (paginated + filter) ─────────────────────────────────────
  async getAllStudents(
    schoolId: string,
    params: IFilterParams,
    options: IOptions,
  ) {
    const { limit, page, skip, sortBy, sortOrder } = paginationHelper(options);
    const { searchTerm, ...filters } = params;

    const where: Record<string, any> = {
      schoolId: schoolId,
    };

    if (searchTerm) {
      where.$or = [
        { schoolName: { $regex: searchTerm, $options: 'i' } },
        { lastName: { $regex: searchTerm, $options: 'i' } },
        { firstName: { $regex: searchTerm, $options: 'i' } },
        { studentId: { $regex: searchTerm, $options: 'i' } },
        { gradeLevel: { $regex: searchTerm, $options: 'i' } },
      ];
    }

    if (filters.gradeLevel) where.gradeLevel = filters.gradeLevel;

    const [data, total] = await Promise.all([
      this.exclesheetModel
        .find(where)
        .sort({ [sortBy]: sortOrder } as any)
        .skip(skip)
        .limit(limit)
        .lean(),
      this.exclesheetModel.countDocuments(where),
    ]);

    return { data, meta: { page, limit, total } };
  }

  // ─── 3. DOWNLOAD: MongoDB → Excel buffer ─────────────────────────────────
  async downloadStudents(schoolId: string): Promise<Buffer> {
    const students = await this.exclesheetModel
      .find({ schoolId: schoolId })
      .lean();

    if (!students.length) {
      throw new HttpException('No students found to download', 404);
    }

    // Map to Excel rows
    const rows = students.map((s) => ({
      'School Name': s.schoolName,
      'Last Name': s.lastName,
      'First Name': s.firstName,
      'Student ID': s.studentId,
      'Grade Level': s.gradeLevel,
    }));

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(rows);

    // Column widths
    sheet['!cols'] = [
      { wch: 20 }, // School Name
      { wch: 15 }, // Last Name
      { wch: 15 }, // First Name
      { wch: 12 }, // Student ID
      { wch: 12 }, // Grade Level
    ];

    XLSX.utils.book_append_sheet(workbook, sheet, 'Students');

    // Return as Buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  }

  // ─── 4. DELETE all students of a school ──────────────────────────────────
  async deleteAllStudents(schoolId: string) {
    const result = await this.exclesheetModel.deleteMany({
      schoolId: schoolId,
    });
    return { deleted: result.deletedCount };
  }

  // ─── 5. DELETE single student ────────────────────────────────────────────
  async deleteStudent(schoolId: string, studentDocId: string) {
    const student = await this.exclesheetModel.findOneAndDelete({
      _id: studentDocId,
      schoolId: schoolId,
    });
    if (!student) throw new HttpException('Student not found', 404);
    return student;
  }
}
