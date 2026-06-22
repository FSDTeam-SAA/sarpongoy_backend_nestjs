import { HttpException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import config from 'src/app/config';
import { Payment, PaymentDocument } from './entities/payment.entity';
import { IFilterParams } from 'src/app/helpers/pick';
import paginationHelper, { IOptions } from 'src/app/helpers/pagenation';
import { User, UserDocument } from '../user/entities/user.entity';
import {
  Subscribe,
  SubscribeDocument,
} from '../subscribe/entities/subscribe.entity';
import { School, SchoolDocument } from '../school/entities/school.entity';

@Injectable()
export class PaymentService {
  private readonly stripe: InstanceType<typeof Stripe>;

  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Subscribe.name)
    private readonly subscribeModel: Model<SubscribeDocument>,
    @InjectModel(School.name)
    private readonly schoolModel: Model<SchoolDocument>,
  ) {
    this.stripe = new Stripe(config.stripe.secretKey!);
  }

  async paySubscribe(userId: string, subscribeId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', 404);

    const subscribe = await this.subscribeModel.findById(subscribeId);
    if (!subscribe) throw new HttpException('Subscribe not found', 404);

    // Already paid check
    const existingCompleted = await this.paymentModel.findOne({
      userId: user._id,
      subscribeId: subscribe._id,
      status: 'completed',
    });
    if (existingCompleted) {
      throw new HttpException('This subscription is already paid', 400);
    }

    // Reuse existing pending payment intent if valid
    const existingPending = await this.paymentModel.findOne({
      userId: user._id,
      subscribeId: subscribe._id,
      status: 'pending',
    });

    if (existingPending?.stripePaymentIntentId) {
      const existingIntent = await this.stripe.paymentIntents.retrieve(
        existingPending.stripePaymentIntentId,
      );
      if (
        existingIntent.status !== 'succeeded' &&
        existingIntent.status !== 'canceled'
      ) {
        return {
          clientSecret: existingIntent.client_secret,
          paymentIntentId: existingIntent.id,
          amount: subscribe.price,
        };
      }
    }

    // Create new payment intent
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(subscribe.price * 100),
      currency: 'gbp',
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId: user._id.toString(),
        subscribeId: subscribe._id.toString(),
        paymentType: 'subscribe',
        amount: String(subscribe.price),
      },
    });

    // Save or update payment record
    if (existingPending) {
      existingPending.stripePaymentIntentId = paymentIntent.id;
      existingPending.amount = subscribe.price;
      await existingPending.save();
    } else {
      await this.paymentModel.create({
        userId: user._id,
        subscribeId: subscribe._id,
        // schoolName string হিসেবে save করতে চাইলে
        // School model থেকে populate করে নাও, অথবা user.email দাও
        email: user.email,
        stripePaymentIntentId: paymentIntent.id,
        amount: subscribe.price,
        paymentType: 'subscribe',
        status: 'pending',
      });
    }

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: subscribe.price,
    };
  }

  async paySubscribeSchool(userId: string, schoolId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', 404);

    const school = await this.schoolModel.findById(schoolId);
    if (!school) throw new HttpException('School not found', 404);

    if (!school.subscribePrice || school.subscribePrice <= 0) {
      throw new HttpException(
        'This school does not have a valid subscription price',
        400,
      );
    }

    // Already subscribed check (School এর school array তে userId আছে কিনা)
    const alreadySubscribed = school.school.some(
      (id) => id.toString() === userId.toString(),
    );
    if (alreadySubscribed) {
      throw new HttpException('You are already subscribed to this school', 400);
    }

    // Already completed payment check
    const existingCompleted = await this.paymentModel.findOne({
      userId: user._id,
      schoolId: school._id,
      status: 'completed',
      paymentType: 'school',
    });
    if (existingCompleted) {
      throw new HttpException('This school subscription is already paid', 400);
    }

    // Reuse existing pending payment intent if valid
    const existingPending = await this.paymentModel.findOne({
      userId: user._id,
      schoolId: school._id,
      status: 'pending',
      paymentType: 'school',
    });

    if (existingPending?.stripePaymentIntentId) {
      const existingIntent = await this.stripe.paymentIntents.retrieve(
        existingPending.stripePaymentIntentId,
      );
      if (
        existingIntent.status !== 'succeeded' &&
        existingIntent.status !== 'canceled'
      ) {
        return {
          clientSecret: existingIntent.client_secret,
          paymentIntentId: existingIntent.id,
          amount: school.subscribePrice,
        };
      }
    }

    // Create new payment intent
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(school.subscribePrice * 100),
      currency: 'gbp',
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId: user._id.toString(),
        schoolId: school._id.toString(),
        paymentType: 'school',
        amount: String(school.subscribePrice),
      },
    });

    // Save or update payment record
    if (existingPending) {
      existingPending.stripePaymentIntentId = paymentIntent.id;
      existingPending.amount = school.subscribePrice;
      await existingPending.save();
    } else {
      await this.paymentModel.create({
        userId: user._id,
        schoolId: school._id,
        schoolName: school.name,
        email: user.email,
        stripePaymentIntentId: paymentIntent.id,
        amount: school.subscribePrice,
        paymentType: 'school',
        status: 'pending',
      });
    }

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: school.subscribePrice,
    };
  }

  async getAllPayment(params: IFilterParams, options: IOptions) {
    const { limit, page, skip, sortBy, sortOrder } = paginationHelper(options);
    const { searchTerm, ...filterData } = params;

    const whereConditions: Record<string, unknown> = {};

    if (searchTerm) {
      whereConditions.$or = [
        { paymentType: { $regex: searchTerm, $options: 'i' } },
        { status: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
      ];
    }

    if (filterData.paymentType)
      whereConditions.paymentType = filterData.paymentType;
    if (filterData.status) whereConditions.status = filterData.status;

    const total = await this.paymentModel.countDocuments(whereConditions);
    const data = await this.paymentModel
      .find(whereConditions)
      .skip(skip)
      .limit(limit)
      .sort({ [sortBy]: sortOrder } as never)
      .populate('userId', 'email schoolName')
      .populate('subscribeId');

    return { meta: { page, limit, total }, data };
  }

  async getSinglePayment(id: string) {
    const payment = await this.paymentModel
      .findById(id)
      .populate('userId', 'email schoolName')
      .populate('subscribeId');

    if (!payment) throw new HttpException('Payment not found', 404);
    return payment;
  }
}
