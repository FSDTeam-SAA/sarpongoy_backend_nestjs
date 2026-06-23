import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Payment, PaymentSchema } from './entities/payment.entity';
import { AuthModule } from '../auth/auth.module';
import { User, UserSchema } from '../user/entities/user.entity';
import {
  Subscribe,
  SubscribeSchema,
} from '../subscribe/entities/subscribe.entity';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { School, SchoolSchema } from '../school/entities/school.entity';
import {
  PaymentHistory,
  PaymentHistorySchema,
} from './entities/payment-history.entity';
import { TermPaymentCronService } from 'src/app/helpers/cron/term-payment.cron';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: User.name, schema: UserSchema },
      { name: Subscribe.name, schema: SubscribeSchema },
      { name: School.name, schema: SchoolSchema },
      { name: PaymentHistory.name, schema: PaymentHistorySchema },
    ]),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, TermPaymentCronService],
  exports: [PaymentService],
})
export class PaymentModule {}
