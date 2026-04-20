import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Payment, PaymentDocument } from '../payment/entities/payment.entity';
import { Model } from 'mongoose';
import { User, UserDocument } from '../user/entities/user.entity';
import { UserRole } from '../user/user-role.enum';


type Period = 'week' | 'month' | 'year';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async dashboardOverView() {
    const totalSchool = await this.userModel.countDocuments({
      role: UserRole.SCHOOL,
    });

    const totalRevenue = await this.paymentModel.aggregate([
      {
        $match: {
          status: 'completed',
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
        },
      },
    ]);

    return {
      totalSchool,
      totalRevenue: totalRevenue[0]?.totalRevenue || 0,
    };
  }

  // ─── Revenue Chart ────────────────────────────────────────────────────────
  async getRevenueChart(period: Period = 'month') {
    const now = new Date();
    let startDate: Date;
    let groupFormat: string;
    let labelFn: (id: any) => string;
    let allLabels: string[];

    if (period === 'week') {
      // Last 7 days
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
      groupFormat = '%Y-%m-%d';
      allLabels = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        return d.toISOString().split('T')[0];
      });
      labelFn = (id) => id;
    } else if (period === 'month') {
      // Current year — 12 months
      startDate = new Date(now.getFullYear(), 0, 1);
      groupFormat = '%Y-%m';
      const months = [
        'JAN',
        'FEB',
        'MAR',
        'APR',
        'MAY',
        'JUN',
        'JUL',
        'AUG',
        'SEP',
        'OCT',
        'NOV',
        'DEC',
      ];
      allLabels = Array.from({ length: 12 }, (_, i) => {
        const m = String(i + 1).padStart(2, '0');
        return `${now.getFullYear()}-${m}`;
      });
      labelFn = (id) => {
        const month = parseInt(id.split('-')[1], 10) - 1;
        return months[month];
      };
    } else {
      // Last 5 years
      const currentYear = now.getFullYear();
      startDate = new Date(currentYear - 4, 0, 1);
      groupFormat = '%Y';
      allLabels = Array.from({ length: 5 }, (_, i) =>
        String(currentYear - 4 + i),
      );
      labelFn = (id) => id;
    }

    const raw = await this.paymentModel.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
          revenue: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Map aggregation result to key-value
    const map = new Map(
      raw.map((r) => [r._id, { revenue: r.revenue, count: r.count }]),
    );

    // Fill missing labels with 0
    const chartData = allLabels.map((key) => ({
      label: labelFn(key),
      revenue: map.get(key)?.revenue ?? 0,
      count: map.get(key)?.count ?? 0,
    }));

    const totalRevenue = chartData.reduce((s, d) => s + d.revenue, 0);

    return {
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      period,
      chart: chartData,
    };
  }
}
