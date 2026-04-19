import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import config from './app/config';
// import { PaymentModule } from './app/module/payment/payment.module';
// import { WebhookModule } from './app/module/webhook/webhook.module';
import { AuthModule } from './app/module/auth/auth.module';

import { UserModule } from './app/module/user/user.module';
import { SubscribeModule } from './app/module/subscribe/subscribe.module';
import { SchoolModule } from './app/module/school/school.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(config.mongoUri as string),
    // PaymentModule,
    // WebhookModule,
    AuthModule,
    UserModule,
    SubscribeModule,
    SchoolModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
