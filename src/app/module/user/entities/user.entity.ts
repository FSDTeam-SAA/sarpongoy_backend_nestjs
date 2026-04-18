import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import config from '../../../config';
import { UserRole } from '../user-role.enum';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  schoolName: string;

  @Prop({ trim: true })
  firstName: string;

  @Prop({ trim: true })
  lastName: string;

  @Prop()
  country: string;

  @Prop({ unique: true, lowercase: true, trim: true, required: true })
  email: string;

  @Prop({ required: true, minlength: 6, select: false })
  password: string;

  @Prop({
    enum: Object.values(UserRole),
    default: UserRole.SCHOOL,
  })
  role: UserRole;

  @Prop() phoneNumber: string;
  @Prop() address: string;
  @Prop() schoolLogo: string;
  @Prop() profilePicture: string;
  @Prop() uploadeSignature: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' })
  subscription: Types.ObjectId;

  @Prop() bio: string;
  @Prop() totalStudent: number;

  @Prop() otp?: string;
  @Prop() otpExpiry?: Date;

  @Prop({ enum: ['active', 'suspended'], default: 'active' })
  status: string;

  @Prop({ default: false })
  verifiedForget: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);


UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  this.password = await bcrypt.hash(
    this.password,
    Number(config.bcryptSaltRounds),
  );
});
