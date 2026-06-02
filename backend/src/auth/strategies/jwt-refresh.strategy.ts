import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { Injectable } from '@nestjs/common';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_REFRESH_SECRET || 'super-secret-jwt-refresh-key-67890',
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: any) {
    const authorizationHeader = req.get('Authorization');
    if (!authorizationHeader) {
      return null;
    }
    const refreshToken = authorizationHeader.replace('Bearer', '').trim();
    return {
      ...payload,
      refreshToken,
    };
  }
}
