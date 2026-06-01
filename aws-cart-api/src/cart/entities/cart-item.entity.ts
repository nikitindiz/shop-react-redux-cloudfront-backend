import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CartEntity } from './cart.entity';

@Entity('cart_items')
export class CartItemEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => CartEntity, (cart) => cart.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cart_id' })
  cart: CartEntity;

  @Column({ type: 'varchar', name: 'cart_id' })
  cart_id: string;

  @Column({ type: 'varchar', name: 'product_id', nullable: false })
  product_id: string;

  @Column({ type: 'int', default: 1 })
  count: number;
}
