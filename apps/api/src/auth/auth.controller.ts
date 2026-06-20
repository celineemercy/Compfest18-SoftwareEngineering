import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';

@Controller('auth') // This means all routes here start with /auth
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register') // This listens for POST requests to /auth/register
  async register(@Body() registerDto: RegisterDto) {
    // The @Body() decorator automatically grabs the JSON data sent by the user
    // and checks it against the rules we wrote in RegisterDto!
    return this.authService.register(registerDto);
  }
}