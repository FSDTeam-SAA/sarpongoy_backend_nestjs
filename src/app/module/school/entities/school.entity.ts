import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, Types } from 'mongoose';

export type SchoolDocument = HydratedDocument<School>;

@Schema({ timestamps: true })
export class School {
  @Prop({ required: true })
  name!: string;

  @Prop()
  subscribePrice!: number;

  @Prop()
  NDA!: string;

  @Prop({ type: [mongoose.Schema.Types.ObjectId], ref: 'User' })
  school!: Types.ObjectId[];
}

export const SchoolSchema = SchemaFactory.createForClass(School);
