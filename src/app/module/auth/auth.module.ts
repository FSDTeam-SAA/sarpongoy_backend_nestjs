import { Global, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../user/entities/user.entity';
import { JwtModule } from '@nestjs/jwt';
import { School, SchoolSchema } from '../school/entities/school.entity';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: School.name, schema: SchoolSchema },
    ]),
    JwtModule.register({
      global: true,
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [JwtModule, AuthService],
})
export class AuthModule {}
