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

@Schema({ _id: false })
export class SchoolPaymentTerm {
  @Prop({ required: true })
  termId!: string;

  @Prop({ required: true })
  label!: string;

  @Prop({ required: true })
  amount!: number;

  @Prop()
  dueDate?: string;
}

export const SchoolPaymentTermSchema =
  SchemaFactory.createForClass(SchoolPaymentTerm);

@Schema({ timestamps: true })
export class School {
  @Prop({ required: true })
  name!: string;

  @Prop({ default: 0 })
  subscribePrice!: number;

  @Prop({ default: 0 })
  totalStudent!: number;

  @Prop({ default: 0 })
  totalContractAmount!: number;

  @Prop()
  NDA!: string;

  @Prop({ type: TermConfigurationSchema, default: {} })
  termConfig!: TermConfiguration;

  @Prop({ type: [SchoolPaymentTermSchema], default: [] })
  paymentTerms!: SchoolPaymentTerm[];

  @Prop({ default: false })
  termsLocked!: boolean;

  @Prop({
    enum: ['active', 'restricted'],
    default: 'active',
  })
  paymentAccessStatus!: string;

  @Prop({ default: 'none' })
  overdueTerm!: string;

  @Prop()
  paymentAccessCheckedAt!: Date;

  @Prop({ type: [mongoose.Schema.Types.ObjectId], ref: 'User' })
  school!: Types.ObjectId[];
}

export const SchoolSchema = SchemaFactory.createForClass(School);
