import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart, CartItem, CartStatuses } from '../models';
import { CartEntity } from '../entities/cart.entity';
import { CartItemEntity } from '../entities/cart-item.entity';
import { PutCartPayload } from 'src/order/type';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartEntity)
    private readonly cartRepository: Repository<CartEntity>,
    @InjectRepository(CartItemEntity)
    private readonly cartItemRepository: Repository<CartItemEntity>,
  ) {}

  private mapToCart(entity: CartEntity): Cart {
    return {
      id: entity.id,
      user_id: entity.user_id,
      created_at: entity.created_at.getTime(),
      updated_at: entity.updated_at.getTime(),
      status: entity.status,
      items: (entity.items ?? []).map((item) => ({
        product: { id: item.product_id, title: '', description: '', price: 0 },
        count: item.count,
      })),
    };
  }

  async findByUserId(userId: string): Promise<Cart | null> {
    const entity = await this.cartRepository.findOne({
      where: { user_id: userId },
      relations: { items: true },
    });
    return entity ? this.mapToCart(entity) : null;
  }

  async createByUserId(user_id: string): Promise<Cart> {
    const entity = this.cartRepository.create({
      user_id,
      status: CartStatuses.OPEN,
      items: [],
    });
    const saved = await this.cartRepository.save(entity);
    return this.mapToCart(saved);
  }

  async findOrCreateByUserId(userId: string): Promise<Cart> {
    const existing = await this.findByUserId(userId);
    if (existing) {
      return existing;
    }
    return this.createByUserId(userId);
  }

  async updateByUserId(userId: string, payload: PutCartPayload): Promise<Cart> {
    const cartEntity = await this.cartRepository.findOne({
      where: { user_id: userId },
      relations: { items: true },
    });

    const entity =
      cartEntity ??
      (await this.cartRepository.save(
        this.cartRepository.create({
          user_id: userId,
          status: CartStatuses.OPEN,
          items: [],
        }),
      ));

    const existingItem = (entity.items ?? []).find(
      (item) => item.product_id === payload.product.id,
    );

    if (!existingItem) {
      if (payload.count > 0) {
        await this.cartItemRepository.save(
          this.cartItemRepository.create({
            cart_id: entity.id,
            product_id: payload.product.id,
            count: payload.count,
          }),
        );
      }
    } else if (payload.count === 0) {
      await this.cartItemRepository.delete(existingItem.id);
    } else {
      existingItem.count = payload.count;
      await this.cartItemRepository.save(existingItem);
    }

    const updated = await this.cartRepository.findOne({
      where: { id: entity.id },
      relations: { items: true },
    });
    return this.mapToCart(updated);
  }

  async removeByUserId(userId: string): Promise<void> {
    const entity = await this.cartRepository.findOne({
      where: { user_id: userId },
    });
    if (entity) {
      await this.cartRepository.delete(entity.id);
    }
  }
}
