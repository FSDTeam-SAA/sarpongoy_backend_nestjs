import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, Types } from 'mongoose';

export type ExclesheetDocument = HydratedDocument<Exclesheet>;

@Schema({ timestamps: true })
export class Exclesheet {
  @Prop({ required: true })
  schoolName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  studentId: string;

  @Prop({ required: true })
  gradeLevel: string;

  @Prop()
  url: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  schoolId: Types.ObjectId;
}

export const ExclesheetSchema = SchemaFactory.createForClass(Exclesheet);
