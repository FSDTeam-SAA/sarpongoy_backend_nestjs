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
  userId!: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
  })
  schoolId!: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscribe',
  })
  subscribeId!: Types.ObjectId;

  @Prop()
  schoolName!: string;

  @Prop()
  email!: string;

  @Prop()
  amount!: number;

  @Prop()
  totalStudents!: number;

  @Prop()
  perStudentCharge!: number;

  @Prop()
  totalAmount!: number;

  @Prop({
    type: String,
    enum: ['first_term', 'second_term', 'third_term', 'full_year'],
  })
  paymentPlan!: string;

  @Prop({
    type: {
      firstTerm: Date,
      secondTerm: Date,
      thirdTerm: Date,
    },
    default: {},
  })
  termDueDates!: {
    firstTerm?: Date;
    secondTerm?: Date;
    thirdTerm?: Date;
  };

  @Prop({
    type: String,
    enum: ['stripe', 'offline'],
    default: 'stripe',
  })
  paymentMethod!: string;

  @Prop()
  offlinePaymentNote!: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  approvedBy!: Types.ObjectId;

  @Prop()
  approvedAt!: Date;

  @Prop({ default: 'booking' })
  paymentType!: string;

  @Prop({
    type: String,
    enum: ['pending', 'offline_pending', 'completed', 'failed', 'refunded'],
    default: 'pending',
  })
  status!: string;

  @Prop()
  stripePaymentIntentId!: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
