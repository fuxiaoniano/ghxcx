import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { text } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use('/wechat/oa/callback', text({ type: ['text/*', 'application/xml', 'text/xml'] }));
  app.use('/wechat/mini/callback', text({ type: ['text/*', 'application/xml', 'text/xml'] }));
  app.use(helmet());
  app.enableCors({
    origin: (origin, callback) => {
      const allowList = (config.get<string>('CORS_ORIGINS') || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      if (!origin || allowList.length === 0 || allowList.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false
    })
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  if (config.get<string>('NODE_ENV') !== 'production' || config.get<string>('SWAGGER_ENABLED') === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('微信公众号阅读者挂号服务系统 API')
      .setDescription('小程序、公众号、管理后台统一接口文档')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const port = Number(config.get('PORT') || 3000);
  await app.listen(port);
}

bootstrap();
