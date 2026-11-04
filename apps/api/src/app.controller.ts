import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { APP_NAME } from '@autogenius/constants';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get('health')
  @ApiTags('System')
  @ApiOperation({ summary: 'Service liveness' })
  @ApiOkResponse({
    description:
      'Liveness probe. It answers as soon as the HTTP layer is up and does not check PostgreSQL or Redis.',
    schema: {
      example: { status: 'ok', service: APP_NAME },
    },
  })
  getHealth(): { status: string; service: string } {
    return this.appService.getHealth();
  }
}
