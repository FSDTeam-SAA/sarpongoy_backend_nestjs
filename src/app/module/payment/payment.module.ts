// import { Module } from '@nestjs/common';
// import { PaymentService } from './payment.service';
// import { PaymentController } from './payment.controller';
// import { MongooseModule } from '@nestjs/mongoose';
// import { Payment, PaymentSchema } from './entities/payment.entity';
// import { AuthModule } from '../auth/auth.module';
// import { Booking, BookingSchema } from '../booking/entities/booking.entity';
// import { Quote, QuoteSchema } from '../quote/entities/quote.entity';

// @Module({
//   imports: [
//     AuthModule,
//     MongooseModule.forFeature([
//       { name: Payment.name, schema: PaymentSchema },
//       { name: Booking.name, schema: BookingSchema },
//       { name: Quote.name, schema: QuoteSchema },
//     ]),
//   ],
//   controllers: [PaymentController],
//   providers: [PaymentService],
// })
// export class PaymentModule {}
