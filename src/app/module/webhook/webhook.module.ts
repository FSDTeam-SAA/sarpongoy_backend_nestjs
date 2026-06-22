import { Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Payment, PaymentSchema } from '../payment/entities/payment.entity';
import { User, UserSchema } from '../user/entities/user.entity';
import { Subscribe, SubscribeSchema } from '../subscribe/entities/subscribe.entity';
import { School, SchoolSchema } from '../school/entities/school.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: User.name, schema: UserSchema },
      { name: Subscribe.name, schema: SubscribeSchema },
      { name: School.name, schema: SchoolSchema },
    ]),
  ],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
