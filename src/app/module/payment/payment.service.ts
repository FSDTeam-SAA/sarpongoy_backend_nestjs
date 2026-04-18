// // payment/payment.service.ts
// import { HttpException, Injectable } from '@nestjs/common';
// import { InjectModel } from '@nestjs/mongoose';
// import { Model } from 'mongoose';
// import Stripe from 'stripe';
// import config from 'src/app/config';
// import { Payment, PaymentDocument } from './entities/payment.entity';
// import { IFilterParams } from 'src/app/helpers/pick';
// import paginationHelper, { IOptions } from 'src/app/helpers/pagenation';

// @Injectable()
// export class PaymentService {
//   private readonly stripe: Stripe;

//   constructor(
//     @InjectModel(Payment.name)
//     private readonly paymentModel: Model<PaymentDocument>,

//   ) {
//     this.stripe = new Stripe(config.stripe.secretKey!);
//   }

//   async payBooking(bookingId: string) {
//     // 1. Find booking
//     const booking = await this.bookingModel.findById(bookingId);
//     if (!booking) {
//       throw new HttpException('Booking not found', 404);
//     }

//     // 2. Find quote from booking
//     const quote = await this.quoteModel.findById(booking.quote);
//     if (!quote) {
//       throw new HttpException('Quote not found', 404);
//     }

//     // 3. Check if already paid
//     const existingCompleted = await this.paymentModel.findOne({
//       bookingId: booking._id,
//       status: 'completed',
//     });

//     if (existingCompleted) {
//       throw new HttpException('This booking is already paid', 400);
//     }

//     // 4. Check if pending payment exists — reuse it
//     const existingPending = await this.paymentModel.findOne({
//       bookingId: booking._id,
//       status: 'pending',
//     });

//     if (existingPending?.stripePaymentIntentId) {
//       const existingPaymentIntent = await this.stripe.paymentIntents.retrieve(
//         existingPending.stripePaymentIntentId,
//       );

//       if (
//         existingPaymentIntent.status !== 'succeeded' &&
//         existingPaymentIntent.status !== 'canceled'
//       ) {
//         return {
//           clientSecret: existingPaymentIntent.client_secret,
//           paymentIntentId: existingPaymentIntent.id,
//           amount: booking.price,
//         };
//       }
//     }

//     // 5. Create new Stripe payment intent
//     const paymentIntent = await this.stripe.paymentIntents.create({
//       amount: Math.round(booking.price * 100),
//       currency: 'gbp',
//       automatic_payment_methods: {
//         enabled: true,
//       },
//       metadata: {
//         bookingId: booking._id.toString(),
//         quoteId: quote._id.toString(),
//         paymentType: 'booking',
//         amount: String(booking.price),
//       },
//     });

//     // 6. Save or update payment record
//     if (existingPending) {
//       existingPending.stripePaymentIntentId = paymentIntent.id;
//       existingPending.amount = booking.price;
//       await existingPending.save();
//     } else {
//       await this.paymentModel.create({
//         bookingId: booking._id,
//         name: quote.personalInfo.fastName + ' ' + quote.personalInfo.sureName,
//         email: quote.personalInfo.email,
//         stripePaymentIntentId: paymentIntent.id,
//         amount: booking.price,
//         paymentType: 'booking',
//         status: 'pending',
//       });
//     }

//     return {
//       clientSecret: paymentIntent.client_secret,
//       paymentIntentId: paymentIntent.id,
//       amount: booking.price,
//     };
//   }

//   async getAllPayment(params: IFilterParams, options: IOptions) {
//     const { limit, page, skip, sortBy, sortOrder } = paginationHelper(options);
//     const { searchTerm, ...filterData } = params;

//     const whereConditions: Record<string, unknown> = {};

//     if (searchTerm) {
//       whereConditions.$or = [
//         { paymentType: { $regex: searchTerm, $options: 'i' } },
//         { status: { $regex: searchTerm, $options: 'i' } },
//         { name: { $regex: searchTerm, $options: 'i' } },
//         { email: { $regex: searchTerm, $options: 'i' } },
//       ];
//     }

//     if (filterData.paymentType) {
//       whereConditions.paymentType = filterData.paymentType;
//     }

//     if (filterData.status) {
//       whereConditions.status = filterData.status;
//     }

//     const total = await this.paymentModel.countDocuments(whereConditions);
//     const data = await this.paymentModel
//       .find(whereConditions)
//       .skip(skip)
//       .limit(limit)
//       .sort({ [sortBy]: sortOrder } as never)
//       .populate({
//         path: 'bookingId',
//         populate: {
//           path: 'quote',
//           populate: ['productId', 'controller', 'extra'],
//         },
//       });

//     return {
//       meta: { page, limit, total },
//       data,
//     };
//   }

//   async getSinglePayment(id: string) {
//     const payment = await this.paymentModel.findById(id).populate({
//       path: 'bookingId',
//       populate: {
//         path: 'quote',
//         populate: ['productId', 'controller', 'extra'],
//       },
//     });

//     if (!payment) {
//       throw new HttpException('Payment not found', 404);
//     }

//     return payment;
//   }
// }
