import { HttpException, Injectable } from '@nestjs/common';
import { CreateSubscribeDto } from './dto/create-subscribe.dto';
import { UpdateSubscribeDto } from './dto/update-subscribe.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Subscribe } from './entities/subscribe.entity';
import { Model } from 'mongoose';
import { IFilterParams } from 'src/app/helpers/pick';
import paginationHelper, { IOptions } from 'src/app/helpers/pagenation';
import buildWhereConditions from 'src/app/helpers/buildWhereConditions';

@Injectable()
export class SubscribeService {
  constructor(
    @InjectModel(Subscribe.name)
    private readonly subscribeModel: Model<Subscribe>,
  ) {}

  async createSubscribe(createSubscribeDto: CreateSubscribeDto) {
    const subscribe = await this.subscribeModel.findOne({
      name: createSubscribeDto.name,
    });
    if (subscribe) {
      throw new HttpException('Subscribe already exists', 400);
    }
    const newSubscribe = await this.subscribeModel.create(createSubscribeDto);
    return newSubscribe;
  }

  async getAllSubscribes(params: IFilterParams, options: IOptions) {
    const { limit, page, skip, sortBy, sortOrder } = paginationHelper(options);

    const whereConditions = buildWhereConditions(params, ['name']);

    const [result, total] = await Promise.all([
      this.subscribeModel
        .find(whereConditions)
        .sort({ [sortBy]: sortOrder } as any)
        .skip(skip)
        .limit(limit),
      this.subscribeModel.countDocuments(whereConditions),
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

  async getSingleSubscribe(id: string) {
    const subscribe = await this.subscribeModel.findById(id);
    if (!subscribe) {
      throw new HttpException('Subscribe not found', 404);
    }
    return subscribe;
  }

  async updateSubscribe(id: string, updateSubscribeDto: UpdateSubscribeDto) {
    const subscribe = await this.subscribeModel.findById(id);
    if (!subscribe) {
      throw new HttpException('Subscribe not found', 404);
    }
    const updatedSubscribe = await this.subscribeModel.findByIdAndUpdate(
      id,
      updateSubscribeDto,
      { new: true },
    );
    return updatedSubscribe;
  }

  async deleteSubscribe(id: string) {
    const subscribe = await this.subscribeModel.findById(id);
    if (!subscribe) {
      throw new HttpException('Subscribe not found', 404);
    }
    const deletedSubscribe = await this.subscribeModel.findByIdAndDelete(id);
    return deletedSubscribe;
  }
}
