// // webhook/webhook.module.ts
// import { Module } from '@nestjs/common';
// // import { WebhookService } from './webhook.service';
// import { WebhookController } from './webhook.controller';
// import { MongooseModule } from '@nestjs/mongoose';
// import { Payment, PaymentSchema } from '../payment/entities/payment.entity';


// @Module({
//   imports: [
//     MongooseModule.forFeature([
//       { name: Payment.name, schema: PaymentSchema },
//       { name: Booking.name, schema: BookingSchema },
//     ]),
//   ],
//   controllers: [WebhookController],
//   providers: [WebhookService],
// })
// export class WebhookModule {}
