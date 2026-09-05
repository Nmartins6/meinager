import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { OrganizationRoles } from '../auth/authorization/organization-roles.decorator.js';
import { OrganizationRolesGuard } from '../auth/authorization/organization-roles.guard.js';
import { SessionAuthGuard } from '../auth/session/session-auth.guard.js';
import type { AuthenticatedRequest } from '../auth/session/session.types.js';
import { OrganizationRole } from '../generated/prisma/enums.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { ListProductsQueryDto } from './dto/list-products-query.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductsService } from './products.service.js';

@Controller('products')
@UseGuards(SessionAuthGuard, OrganizationRolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(
    @Query() query: ListProductsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.productsService.findAll(request.auth.organization.id, query);
  }

  @Get(':productId')
  findOne(
    @Param('productId', new ParseUUIDPipe({ version: '4' }))
    productId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.productsService.findOne(
      request.auth.organization.id,
      productId,
    );
  }

  @Post()
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.OPERATIONS,
  )
  create(@Body() dto: CreateProductDto, @Req() request: AuthenticatedRequest) {
    return this.productsService.create(
      request.auth.organization.id,
      request.auth.user.id,
      dto,
    );
  }

  @Patch(':productId')
  @OrganizationRoles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.OPERATIONS,
  )
  update(
    @Param('productId', new ParseUUIDPipe({ version: '4' }))
    productId: string,
    @Body() dto: UpdateProductDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.productsService.update(
      request.auth.organization.id,
      request.auth.user.id,
      productId,
      dto,
    );
  }
}
