import { Module } from '@nestjs/common';
import { ExclesheetService } from './exclesheet.service';
import { ExclesheetController } from './exclesheet.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Exclesheet, ExclesheetSchema } from './entities/exclesheet.entity';
import { User, UserSchema } from '../user/entities/user.entity';
import { School, SchoolSchema } from '../school/entities/school.entity';
import { Payment, PaymentSchema } from '../payment/entities/payment.entity';
import { SchoolPaymentAccessGuard } from 'src/app/middlewares/school-payment-access.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Exclesheet.name, schema: ExclesheetSchema },
      { name: User.name, schema: UserSchema },
      { name: School.name, schema: SchoolSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
  ],
  controllers: [ExclesheetController],
  providers: [ExclesheetService, SchoolPaymentAccessGuard],
})
export class ExclesheetModule {}
