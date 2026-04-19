import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, Types } from 'mongoose';

export type SubscribeDocument = HydratedDocument<Subscribe>;

@Schema({ timestamps: true })
export class Subscribe {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true })
  features: string[];

  @Prop({ type: Number, default: 0 })
  months: number;

  @Prop({ enum: ['active', 'inactive'], default: 'active' })
  status: string;

  @Prop({ type: [mongoose.Schema.Types.ObjectId], ref: 'User' })
  subscribeSchools: Types.ObjectId[];
}

export const SubscribeSchema = SchemaFactory.createForClass(Subscribe);
