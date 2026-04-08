import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LoginDto } from './dto/login.dto';
import { signJwt, verifyJwt } from './jwt.util';

type AdminTokenPayload = {
  sub: 'admin';
  username: string;
  iat?: number;
  exp?: number;
};

@Injectable()
export class AuthService {
  constructor(private readonly configService: ConfigService) {}

  login(payload: LoginDto): { token: string; expires_in: string; username: string } {
    const expectedUsername = this.configService.get<string>('ADMIN_USERNAME', 'admin');
    const expectedPassword = this.configService.get<string>('ADMIN_PASSWORD', 'change-me');

    if (payload.username !== expectedUsername || payload.password !== expectedPassword) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '12h');
    const token = signJwt(
      {
        sub: 'admin',
        username: payload.username,
      },
      this.configService.get<string>('JWT_SECRET', 'replace-this-secret'),
      expiresIn,
    );

    return {
      token,
      expires_in: expiresIn,
      username: payload.username,
    };
  }

  verifyAdminToken(token: string): AdminTokenPayload {
    try {
      const payload = verifyJwt(
        token,
        this.configService.get<string>('JWT_SECRET', 'replace-this-secret'),
      ) as AdminTokenPayload;

      if (payload.sub !== 'admin' || typeof payload.username !== 'string') {
        throw new Error('Invalid token');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}