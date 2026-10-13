import { z } from 'zod';

import { apiRequest } from '@/lib/api';

const productTypeSchema = z.enum(['PRODUCT', 'SERVICE']);

export const productSchema = z.object({
  id: z.string().uuid(),
  type: productTypeSchema,
  name: z.string(),
  sku: z.string().nullable(),
  barcode: z.string().nullable(),
  unit: z.string(),
  directCost: z.string().nullable().optional(),
  salePrice: z.string().nullable(),
  trackInventory: z.boolean(),
  minimumStock: z.string().nullable(),
  notes: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const productsResponseSchema = z.object({
  data: z.array(productSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  }),
});

export type ProductType = z.infer<typeof productTypeSchema>;
export type Product = z.infer<typeof productSchema>;
export type ProductsResponse = z.infer<typeof productsResponseSchema>;

export interface ListProductsInput {
  search?: string;
  type?: ProductType;
  trackInventory?: boolean;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export interface CreateProductInput {
  type?: ProductType;
  name: string;
  sku?: string;
  barcode?: string;
  unit: string;
  directCost?: string;
  salePrice?: string;
  trackInventory?: boolean;
  minimumStock?: string;
  notes?: string;
}

export interface UpdateProductInput {
  type?: ProductType;
  name?: string;
  sku?: string | null;
  barcode?: string | null;
  unit?: string;
  directCost?: string | null;
  trackInventory?: boolean;
  minimumStock?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

export async function getProducts(input: ListProductsInput = {}): Promise<ProductsResponse> {
  const parameters = new URLSearchParams();

  if (input.search) {
    parameters.set('search', input.search);
  }

  if (input.type) {
    parameters.set('type', input.type);
  }

  if (input.trackInventory !== undefined) {
    parameters.set('trackInventory', String(input.trackInventory));
  }

  if (input.isActive !== undefined) {
    parameters.set('isActive', String(input.isActive));
  }

  parameters.set('page', String(input.page ?? 1));
  parameters.set('pageSize', String(input.pageSize ?? 20));

  const response = await apiRequest(`/products?${parameters.toString()}`);

  return productsResponseSchema.parse(await response.json());
}

export async function getProduct(productId: string): Promise<Product> {
  const response = await apiRequest(`/products/${encodeURIComponent(productId)}`);

  return productSchema.parse(await response.json());
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const response = await apiRequest('/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return productSchema.parse(await response.json());
}

export async function updateProduct(
  productId: string,
  input: UpdateProductInput,
): Promise<Product> {
  const response = await apiRequest(`/products/${encodeURIComponent(productId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return productSchema.parse(await response.json());
}
