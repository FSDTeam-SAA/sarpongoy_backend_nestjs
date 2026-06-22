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
