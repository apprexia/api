import { Controller, Get, Req, UseGuards, Param } from '@nestjs/common';

import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  me(@Req() req) {
    return this.usersService.me(req.user.sub);
  }

  @Get('me/credits')
  @UseGuards(AuthGuard('jwt'))
  getCredits(@Req() req) {
    return this.usersService.getCredits(req.user.sub);
  }

  @Get('me/transactions')
  @UseGuards(AuthGuard('jwt'))
  getTransactions(@Req() req) {
    return this.usersService.getTransactions(req.user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }
}
