import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UpdateUserCreditsDto } from './dto/update-user-credits.dto';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class AdminController {
    constructor(private readonly adminService: AdminService) {}

    @Get('dashboard')
    getDashboard() {
        return this.adminService.getDashboard();
    }

    @Get('users')
    getUsers() {
        return this.adminService.getUsers();
    }

    @Get('users/:id')
    getUserById(@Param('id') id: string) {
        return this.adminService.getUserById(id);
    }

    @Get('analyses')
    getAnalyses(@Query('page') page = '1', @Query('limit') limit = '10', @Query('search') search = '') {
        return this.adminService.getAnalyses(Number(page), Number(limit), search);
    }

    @Get('credits')
    async getCreditsOverview() {
        return this.adminService.getCreditsOverview();
    }

    @Get('credits/transactions')
    async getCreditTransactions(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
    ) {
        return this.adminService.getCreditTransactions(page ? Number(page) : 1, limit ? Number(limit) : 20, search);
    }

    @Post('credits/:userId')
    async updateUserCredits(@Param('userId') userId: string, @Body() dto: UpdateUserCreditsDto) {
        return this.adminService.updateUserCredits(userId, dto.amount, dto.description);
    }
}
