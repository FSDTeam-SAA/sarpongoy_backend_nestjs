import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Request } from 'express';
import { User, UserDocument } from '../module/user/entities/user.entity';
import { School, SchoolDocument } from '../module/school/entities/school.entity';
import { Payment, PaymentDocument } from '../module/payment/entities/payment.entity';
import { calculateSchoolPaymentStatus } from '../helpers/termPaymentStatus';
import { UserRole } from '../module/user/user-role.enum';

@Injectable()
export class SchoolPaymentAccessGuard implements CanActivate {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(School.name)
    private readonly schoolModel: Model<SchoolDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authUser = request.user;

    if (!authUser || authUser.role !== UserRole.SCHOOL) return true;

    const user = await this.userModel.findById(authUser.id);
    if (!user?.schoolName) {
      throw new HttpException('School payment is required', 402);
    }

    const school = await this.schoolModel.findById(user.schoolName);
    if (!school) throw new HttpException('School not found', 404);

    const payments = await this.paymentModel.find({
      userId: user._id,
      schoolId: school._id,
      paymentType: 'school',
    });

    const status = calculateSchoolPaymentStatus(
      school.termConfig || {},
      payments,
    );

    if (status.isRestricted) {
      school.paymentAccessStatus = 'restricted';
      school.overdueTerm = status.overdueTerm;
      school.paymentAccessCheckedAt = new Date();
      await school.save();
      throw new HttpException(status.reason, 402);
    }

    if (
      school.paymentAccessStatus !== 'active' ||
      school.overdueTerm !== 'none'
    ) {
      school.paymentAccessStatus = 'active';
      school.overdueTerm = 'none';
      school.paymentAccessCheckedAt = new Date();
      await school.save();
    }

    return true;
  }
}
