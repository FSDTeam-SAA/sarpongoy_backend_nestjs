import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, Types } from 'mongoose';

export type PaymentDocument = HydratedDocument<Payment>;

@Schema({ timestamps: true })
export class Payment {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscribe',
    required: true,
  })
  subscribeId: Types.ObjectId;

  @Prop()
  schoolName: string;

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
