import { HttpException, Injectable } from '@nestjs/common';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { InjectModel } from '@nestjs/mongoose';
import { School } from './entities/school.entity';
import { Model } from 'mongoose';
import { IFilterParams } from 'src/app/helpers/pick';
import paginationHelper, { IOptions } from 'src/app/helpers/pagenation';
import buildWhereConditions from 'src/app/helpers/buildWhereConditions';
import { fileUpload } from 'src/app/helpers/fileUploder';

@Injectable()
export class SchoolService {
  constructor(
    @InjectModel(School.name)
    private readonly schoolModel: Model<School>,
  ) {}

  private buildTermConfig(dto: Partial<CreateSchoolDto>) {
    const dates = {
      firstTermDueDate: dto.firstTermDueDate,
      secondTermDueDate: dto.secondTermDueDate,
      thirdTermDueDate: dto.thirdTermDueDate,
      fullPaymentDueDate: dto.fullPaymentDueDate,
    };

    const parsed = Object.entries(dates).reduce<Record<string, Date>>(
      (result, [key, value]) => {
        if (!value) return result;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          throw new HttpException(`${key} must be a valid date`, 400);
        }
        result[key] = date;
        return result;
      },
      {},
    );

    const termDates = [
      parsed.firstTermDueDate,
      parsed.secondTermDueDate,
      parsed.thirdTermDueDate,
    ].filter(Boolean);

    for (let index = 1; index < termDates.length; index += 1) {
      if (termDates[index] < termDates[index - 1]) {
        throw new HttpException(
          'Term due dates must be in chronological order',
          400,
        );
      }
    }

    delete (dto as Record<string, unknown>).firstTermDueDate;
    delete (dto as Record<string, unknown>).secondTermDueDate;
    delete (dto as Record<string, unknown>).thirdTermDueDate;
    delete (dto as Record<string, unknown>).fullPaymentDueDate;

    return Object.keys(parsed).length ? parsed : undefined;
  }

  async createSchool(createSchoolDto: CreateSchoolDto,file?: Express.Multer.File) {
    const school = await this.schoolModel.findOne({
      name: createSchoolDto.name,
    });
    if (school) {
      throw new HttpException('School already exists', 400);
    }
    if(file){
      const {url} = await fileUpload.uploadToCloudinary(file);
      createSchoolDto.NDA = url;
    }
    const termConfig = this.buildTermConfig(createSchoolDto);
    if (termConfig) createSchoolDto['termConfig'] = termConfig;
    const newSchool = await this.schoolModel.create(createSchoolDto);
    return newSchool;
  }

  async getAllSchool(params: IFilterParams, options: IOptions) {
    const { limit, page, skip, sortBy, sortOrder } = paginationHelper(options);

    const WhereConditions = buildWhereConditions(params, ['name'], {});

    const [result, total] = await Promise.all([
      this.schoolModel
        .find(WhereConditions)
        .populate('school')
        .sort({ [sortBy]: sortOrder as any })
        .skip(skip)
        .limit(limit),
      this.schoolModel.countDocuments(WhereConditions),
    ]);

    return {
      data: result,
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  async getSingleSchool(id: string) {
    const school = await this.schoolModel.findById(id).populate('school');
    if (!school) {
      throw new HttpException('School not found', 404);
    }
    return school;
  }

  async updateSchool(id: string, updateSchoolDto: UpdateSchoolDto, file?: Express.Multer.File) {
    const school = await this.schoolModel.findById(id);
    if (!school) {
      throw new HttpException('School not found', 404);
    }
    if(file){
      const {url} = await fileUpload.uploadToCloudinary(file);
      updateSchoolDto.NDA = url;
    }
    const termConfig = this.buildTermConfig(updateSchoolDto);
    if (termConfig) updateSchoolDto['termConfig'] = termConfig;
    const updatedSchool = await this.schoolModel.findByIdAndUpdate(
      id,
      updateSchoolDto,
      { new: true },
    );
    return updatedSchool;
  }

  async deleteSchool(id: string) {
    const school = await this.schoolModel.findById(id);
    if (!school) {
      throw new HttpException('School not found', 404);
    }
    await this.schoolModel.findByIdAndDelete(id);
    return 'School deleted successfully';
  }
}
