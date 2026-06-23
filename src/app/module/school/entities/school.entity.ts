import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, Types } from 'mongoose';

export type SchoolDocument = HydratedDocument<School>;

@Schema({ _id: false })
export class TermConfiguration {
  @Prop()
  firstTermDueDate?: Date;

  @Prop()
  secondTermDueDate?: Date;

  @Prop()
  thirdTermDueDate?: Date;

  @Prop()
  fullPaymentDueDate?: Date;
}

export const TermConfigurationSchema =
  SchemaFactory.createForClass(TermConfiguration);

@Schema({ timestamps: true })
export class School {
  @Prop({ required: true })
  name!: string;

  @Prop()
  subscribePrice!: number;

  @Prop()
  NDA!: string;

  @Prop({ type: TermConfigurationSchema, default: {} })
  termConfig!: TermConfiguration;

  @Prop({
    enum: ['active', 'restricted'],
    default: 'active',
  })
  paymentAccessStatus!: string;

  @Prop({
    enum: [
      'none',
      'first_term',
      'second_term',
      'third_term',
      'full_payment',
    ],
    default: 'none',
  })
  overdueTerm!: string;

  @Prop()
  paymentAccessCheckedAt!: Date;

  @Prop({ type: [mongoose.Schema.Types.ObjectId], ref: 'User' })
  school!: Types.ObjectId[];
}

export const SchoolSchema = SchemaFactory.createForClass(School);
