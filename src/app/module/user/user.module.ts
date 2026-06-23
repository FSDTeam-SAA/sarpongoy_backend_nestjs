import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './entities/user.entity';
import { School, SchoolSchema } from '../school/entities/school.entity';
import { Payment, PaymentSchema } from '../payment/entities/payment.entity';
import { SchoolPaymentAccessGuard } from 'src/app/middlewares/school-payment-access.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: School.name, schema: SchoolSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
  ],
  controllers: [UserController],
  providers: [UserService, SchoolPaymentAccessGuard],
})
export class UserModule {}
