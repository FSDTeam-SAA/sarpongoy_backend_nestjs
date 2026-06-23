import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PaymentService } from 'src/app/module/payment/payment.service';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class TermPaymentCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TermPaymentCronService.name);
  private interval?: NodeJS.Timeout;

  constructor(private readonly paymentService: PaymentService) {}

  onModuleInit() {
    void this.run();
    this.interval = setInterval(() => void this.run(), ONE_DAY_MS);
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  private async run() {
    try {
      const result = await this.paymentService.syncSchoolPaymentAccessStatuses();
      this.logger.log(
        `Term payment cron checked ${result.checked} schools, updated ${result.updated}`,
      );
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.message : 'Term payment cron failed',
      );
    }
  }
}
