export type UserRole = 'CUSTOMER' | 'SHOPKEEPER';

export interface Address {
  id?: number;
  flat_number?: string;
  building_number?: string;
  sector?: string;
  house_number?: string;
  street?: string;
  locality?: string;
  landmark?: string;
  city: string;
  district?: string;
  state: string;
  pincode: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  normalized_address?: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  is_active: boolean;
  shop_id?: number;
  customer_id?: number;
  address?: Address;
}

export interface Shop {
  id: number;
  owner_user_id?: number;
  owner_name?: string;
  shopkeeper_id?: number;
  shop_name: string;
  shop_phone?: string;
  email?: string;
  shop_category: string;
  gst_number?: string;
  upi_id?: string;
  address?: Address;
  distance_km?: number;
  is_active: boolean;
  is_selected?: boolean;
  has_khata?: boolean;
  credit_limit?: number | string;
  outstanding_amount?: number | string;
}

export interface Product {
  id: number;
  shop_id: number;
  name: string;
  category: string;
  unit: string;
  price: string | number;
  stock_quantity: number;
  image_url?: string;
  is_active: boolean;
}

export interface CartItem {
  id: number;
  cart_id: number;
  product_id: number;
  quantity: number;
  product?: Product;
}

export interface Cart {
  id: number;
  customer_id: number;
  shop_id: number;
  is_active: boolean;
  items: CartItem[];
}

export type OrderStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED' | 'CREDIT_CONFIRMED';

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  unit_price: string | number;
  product_name?: string;
  product?: Product;
}

export interface Order {
  id: number;
  customer_id: number;
  shop_id: number;
  shop_name?: string;
  shop_phone?: string;
  shop_upi_id?: string;
  status: OrderStatus;
  total_amount: string | number;
  created_at: string;
  updated_at?: string;
  items: OrderItem[];
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string | null;
  payment_method?: string;
  notes?: string;
  is_parchi?: boolean;
  order_source?: string;
}

export interface CreditAccount {
  id: number;
  customer_id: number;
  shop_id: number;
  customer_name?: string;
  customer_phone?: string;
  shop_name?: string;
  credit_limit: string | number;
  outstanding_amount: string | number;
  available_credit: string | number;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreditRequest {
  id: number;
  customer_id: number;
  shop_id: number;
  requested_limit: string | number;
  approved_limit?: string | number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  notes?: string;
  created_at: string;
  customer_name?: string;
  customer_phone?: string;
  shop_name?: string;
}

export interface CreditLedgerItem {
  product_name: string;
  quantity: number;
  unit_price: string | number;
  subtotal: string | number;
  unit?: string;
}

export interface CreditLedgerEntry {
  id: number;
  customer_id: number;
  customer_name?: string;
  customer_phone?: string;
  shop_id: number;
  shop_name?: string;
  order_id?: number;
  transaction_type: 'CREDIT_PURCHASE' | 'PAYMENT' | 'ADJUSTMENT';
  amount: string | number;
  balance_after: string | number;
  description?: string;
  payment_reference?: string;
  formatted_date?: string;
  formatted_time?: string;
  created_at: string;
  items?: CreditLedgerItem[];
}

export interface ShopkeeperCustomerCredit {
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  credit_limit: string | number;
  outstanding_amount: string | number;
  available_credit: string | number;
  account_status: string;
  last_transaction_at?: string;
}

export interface Notification {
  id: number;
  user_id: number;
  order_id?: number | null;
  type?: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface ShoppingListItem {
  product_id?: number;
  product_name?: string;
  quantity: number;
  unit_price?: string | number;
  notes?: string;
}

export interface ShoppingList {
  cart_id?: number;
  customer_id: number;
  shop_id: number;
  status?: string;
  items: ShoppingListItem[];
}

export interface InvoiceItem {
  id?: number;
  invoice_id?: number;
  product_id?: number | null;
  product_name: string;
  unit: string;
  quantity: number;
  unit_price: number | string;
  total_price: number | string;
}

export interface Invoice {
  id: number;
  shop_id: number;
  invoice_number: string;
  customer_id?: number | null;
  customer_name: string;
  customer_phone?: string | null;
  subtotal_amount: number | string;
  discount_amount: number | string;
  tax_amount: number | string;
  total_amount: number | string;
  payment_method: 'CASH' | 'UPI' | 'UDHAR_KHATA' | string;
  payment_status: 'PAID' | 'PENDING' | string;
  notes?: string | null;
  created_at: string;
  items: InvoiceItem[];
}

