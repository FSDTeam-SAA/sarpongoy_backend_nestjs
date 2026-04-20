import { Module } from '@nestjs/common';
import { ExclesheetService } from './exclesheet.service';
import { ExclesheetController } from './exclesheet.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Exclesheet, ExclesheetSchema } from './entities/exclesheet.entity';
import { User, UserSchema } from '../user/entities/user.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Exclesheet.name, schema: ExclesheetSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [ExclesheetController],
  providers: [ExclesheetService],
})
export class ExclesheetModule {}
