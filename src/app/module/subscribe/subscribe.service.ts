import { HttpException, Injectable } from '@nestjs/common';
import { CreateSubscribeDto } from './dto/create-subscribe.dto';
import { UpdateSubscribeDto } from './dto/update-subscribe.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Subscribe } from './entities/subscribe.entity';
import { Model } from 'mongoose';

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
}
