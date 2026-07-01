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
    const totalAmount =
      Number(school.totalContractAmount || 0) ||
      Number(school.totalStudent || user.totalStudent || 0) *
        Number(school.subscribePrice || 0);
    const defaultTerms = [0, 1, 2].map((index) => ({
      termId: `term_${index + 1}`,
      label: `Term ${index + 1}`,
      amount: Number((totalAmount / 3).toFixed(2)),
    }));
    const configuredTerms = school.paymentTerms?.length
      ? school.paymentTerms
      : defaultTerms;
    const paymentTerms = (configuredTerms as any[]).map(
      (term, index) => {
        const termId = term.termId || `term_${index + 1}`;
        const amountPaid = payments
          .filter(
            (payment) =>
              payment.status === 'completed' &&
              (payment.termId || payment.paymentPlan) === termId,
          )
          .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        const amount = Number(term.amount || 0);

        return {
          termId,
          label: term.label || `Term ${index + 1}`,
          amount,
          amountPaid,
          remainingDue: Math.max(0, Number((amount - amountPaid).toFixed(2))),
          dueDate: term.dueDate,
        };
      },
    );

    const status = calculateSchoolPaymentStatus(
      { ...(school.termConfig || {}), paymentTerms },
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
