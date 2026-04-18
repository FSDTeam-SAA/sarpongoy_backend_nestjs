// payment/entities/payment.entity.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, Types } from 'mongoose';

export type PaymentDocument = HydratedDocument<Payment>;

@Schema({ timestamps: true })
export class Payment {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
  })
  bookingId: Types.ObjectId;

  @Prop()
  name: string;

  @Prop()
  email: string;

  @Prop()
  amount: number;

  @Prop({ default: 'booking' })
  paymentType: string;

  @Prop({
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending',
  })
  status: string;

  @Prop()
  stripePaymentIntentId: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
