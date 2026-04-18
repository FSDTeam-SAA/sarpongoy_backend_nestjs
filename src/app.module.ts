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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(config.mongoUri as string),
    // PaymentModule,
    // WebhookModule,
    AuthModule,
    UserModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
