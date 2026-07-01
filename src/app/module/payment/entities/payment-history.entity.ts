import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, Types } from 'mongoose';

export type PaymentHistoryDocument = HydratedDocument<PaymentHistory>;

@Schema({ timestamps: true })
export class PaymentHistory {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Payment' })
  paymentId?: Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true })
  schoolId!: Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  changedBy?: Types.ObjectId;

  @Prop({ required: true })
  paymentPlan!: string;

  @Prop()
  termId?: string;

  @Prop()
  termLabel?: string;

  @Prop({ enum: ['stripe', 'offline', 'system'], default: 'system' })
  paymentMethod!: string;

  @Prop({
    enum: [
      'pending',
      'offline_pending',
      'completed',
      'failed',
      'refunded',
      'overdue',
    ],
    required: true,
  })
  status!: string;

  @Prop()
  amount!: number;

  @Prop()
  note?: string;
}

export const PaymentHistorySchema =
  SchemaFactory.createForClass(PaymentHistory);
