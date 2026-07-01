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

  private toMoney(value: unknown) {
    return Number(Number(value || 0).toFixed(2));
  }

  private toCents(value: unknown) {
    return Math.round(Number(value || 0) * 100);
  }

  private buildDefaultTerms(totalContractAmount: number) {
    const totalCents = this.toCents(totalContractAmount);
    const base = Math.floor(totalCents / 3);
    const remainder = totalCents - base * 3;

    return [0, 1, 2].map((index) => ({
      termId: `term_${index + 1}`,
      label: `Term ${index + 1}`,
      amount: this.toMoney((base + (index < remainder ? 1 : 0)) / 100),
    }));
  }

  private toDateOnly(value: unknown) {
    if (!value) return undefined;
    const text = String(value).trim();
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return null;
    return text.length >= 10 ? text.slice(0, 10) : date.toISOString().slice(0, 10);
  }

  private parsePaymentTerms(value?: string | unknown[]) {
    if (Array.isArray(value)) return this.normalizePaymentTerms(value);
    if (!value?.trim()) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new HttpException('paymentTerms must be valid JSON', 400);
    }

    if (!Array.isArray(parsed)) {
      throw new HttpException('paymentTerms must be an array', 400);
    }

    return this.normalizePaymentTerms(parsed);
  }

  private normalizePaymentTerms(value: unknown[]) {
    return value.map((item, index) => {
      const term = item as Record<string, unknown>;
      const amount = this.toMoney(term.amount);
      const dueDateValue = this.toDateOnly(term.dueDate);

      if (amount <= 0) {
        throw new HttpException(`Term ${index + 1} amount must be greater than 0`, 400);
      }

      if (dueDateValue === null) {
        throw new HttpException(`Term ${index + 1} dueDate must be valid`, 400);
      }

      return {
        termId: String(term.termId || `term_${index + 1}`),
        label: String(term.label || `Term ${index + 1}`),
        amount,
        dueDate: dueDateValue,
      };
    });
  }

  private buildContractConfig(
    dto: Partial<CreateSchoolDto>,
    existing?: { termsLocked?: boolean; subscribePrice?: number; totalStudent?: number },
  ) {
    const raw = dto as Record<string, unknown>;
    const wantsContractChange =
      raw.subscribePrice !== undefined ||
      raw.totalStudent !== undefined ||
      raw.paymentTerms !== undefined;

    if (existing?.termsLocked && wantsContractChange) {
      throw new HttpException('Payment terms are locked because payments are already in progress', 400);
    }

    const perStudentCharge = this.toMoney(raw.subscribePrice ?? existing?.subscribePrice);
    const totalStudent = Number(raw.totalStudent ?? existing?.totalStudent ?? 0);

    if (!existing && perStudentCharge <= 0) {
      throw new HttpException('Per Student Charge is required', 400);
    }

    if (!existing && totalStudent <= 0) {
      throw new HttpException('Total School Population is required', 400);
    }

    if (!wantsContractChange && existing) return;

    // Always persist the individual fields when explicitly sent
    if (raw.subscribePrice !== undefined) raw.subscribePrice = perStudentCharge;
    if (raw.totalStudent !== undefined) raw.totalStudent = totalStudent;

    if (perStudentCharge <= 0 || totalStudent <= 0) return;

    const totalContractAmount = this.toMoney(perStudentCharge * totalStudent);
    const parsedTerms = this.parsePaymentTerms(
      (raw.paymentTerms || '') as string | unknown[],
    );
    const paymentTerms = parsedTerms.length
      ? parsedTerms
      : this.buildDefaultTerms(totalContractAmount);
    const termTotalCents = paymentTerms.reduce(
      (total, term) => total + this.toCents(term.amount),
      0,
    );
    const contractCents = this.toCents(totalContractAmount);

    if (termTotalCents !== contractCents) {
      const delta = this.toMoney((contractCents - termTotalCents) / 100);
      throw new HttpException(
        `Payment terms must equal total contract amount. Difference: ${delta}`,
        400,
      );
    }

    raw.subscribePrice = perStudentCharge;
    raw.totalStudent = totalStudent;
    raw.totalContractAmount = totalContractAmount;
    raw.paymentTerms = paymentTerms;
  }

  private buildPersistableSchoolUpdate(dto: Partial<CreateSchoolDto>) {
    const raw = dto as Record<string, unknown>;
    const update: Record<string, unknown> = {};

    [
      'name',
      'subscribePrice',
      'totalStudent',
      'totalContractAmount',
      'NDA',
      'termConfig',
      'paymentTerms',
    ].forEach((key) => {
      if (raw[key] !== undefined) update[key] = raw[key];
    });

    return update;
  }

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
    this.buildContractConfig(createSchoolDto);
    const termConfig = this.buildTermConfig(createSchoolDto);
    if (termConfig) createSchoolDto['termConfig'] = termConfig;
    const newSchool = await this.schoolModel.create(createSchoolDto as any);
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
    this.buildContractConfig(updateSchoolDto, school);
    const termConfig = this.buildTermConfig(updateSchoolDto);
    if (termConfig) updateSchoolDto['termConfig'] = termConfig;

    const updatePayload = this.buildPersistableSchoolUpdate(updateSchoolDto);
    const updatedSchool = await this.schoolModel.findByIdAndUpdate(
      id,
      { $set: updatePayload },
      { new: true, runValidators: true },
    );
    if (!updatedSchool) throw new HttpException('School not found', 404);
    return this.getSingleSchool(id);
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
