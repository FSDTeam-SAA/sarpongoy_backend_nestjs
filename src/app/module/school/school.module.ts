import { Module } from '@nestjs/common';
import { SchoolService } from './school.service';
import { SchoolController } from './school.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { School, SchoolSchema } from './entities/school.entity';
import { User, UserSchema } from '../user/entities/user.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: School.name, schema: SchoolSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [SchoolController],
  providers: [SchoolService],
})
export class SchoolModule {}
