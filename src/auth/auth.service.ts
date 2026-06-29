import { Injectable } from '@nestjs/common';
import { CreateAuthDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../services/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async generateJwt(user: any) {
    return this.jwtService.signAsync({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      provider: user.provider,
    });
  }

  async loginWithGoogle(googleUser: {
    email: string;
    name?: string;
    avatar?: string;
  }) {
    let user = await this.prisma.user.findUnique({
      where: {
        email: googleUser.email,
      },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name,
          avatar: googleUser.avatar,
        },
      });
    }

    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });
  }

  create(createAuthDto: CreateAuthDto) {
    return 'This action adds a new auth';
  }

  findAll() {
    return `This action returns all auth`;
  }

  findOne(id: number) {
    return `This action returns a #${id} auth`;
  }

  update(id: number, updateAuthDto: UpdateAuthDto) {
    return `This action updates a #${id} auth`;
  }

  remove(id: number) {
    return `This action removes a #${id} auth`;
  }
}
