import { Injectable } from '@nestjs/common';
import { APP_NAME } from '@autogenius/constants';

@Injectable()
export class AppService {
  getHealth(): { status: string; service: string } {
    return { status: 'ok', service: APP_NAME };
  }
}
