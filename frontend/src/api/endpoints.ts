import { apiClient } from './client';
import {
  User,
  Shop,
  Product,
  Cart,
  Order,
  CreditAccount,
  CreditRequest,
  CreditLedgerEntry,
  ShopkeeperCustomerCredit,
  Notification,
  ShoppingList,
  PurchaseInvoice,
  PurchaseInvoiceItem,
} from '../types';

export const authApi = {
  login: async (email: string, password: string, role?: string) => {
    const res = await apiClient.post<{
      access_token: string;
      token_type: string;
      role?: string;
      user?: User;
      user_id?: number;
      name?: string;
      phone?: string;
    }>('/api/v1/auth/login', { email, password, role });
    return res.data;
  },

  registerCustomer: async (data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    address: {
      house_number: string;
      street: string;
      locality?: string;
      landmark?: string;
      city: string;
      state: string;
      pincode: string;
      latitude?: number;
      longitude?: number;
    };
  }) => {
    const res = await apiClient.post<{ id: number; user_id: number; name: string }>('/api/v1/customers', data);
    return res.data;
  },

  registerShopkeeper: async (data: {
    name: string;
    email: string;
    phone: string;
    password: string;
  }) => {
    const res = await apiClient.post<{ user_id: number; message: string }>('/api/v1/auth/register/shopkeeper', data);
    return res.data;
  },
};

export const customerApi = {
  getMe: async () => {
    const res = await apiClient.get<User>('/api/v1/customers/me');
    return res.data;
  },
};

export const shopApi = {
  getNearbyShops: async (params?: { max_distance_km?: number; latitude?: number; longitude?: number }) => {
    const maxDist = params?.max_distance_km ?? 2.0;
    let url = `/api/v1/shops/nearby?max_distance_km=${maxDist}`;
    if (params?.latitude !== undefined && params?.longitude !== undefined) {
      url += `&latitude=${params.latitude}&longitude=${params.longitude}`;
    }
    const res = await apiClient.get<Shop[]>(url);
    return res.data;
  },

  selectShop: async (shopId: number) => {
    const res = await apiClient.post<Shop>(`/api/v1/customers/select-shop/${shopId}`);
    return res.data;
  },

  getSelectedShop: async () => {
    const res = await apiClient.get<Shop | null>('/api/v1/customers/selected-shop');
    return res.data;
  },

  createShop: async (data: {
    shop_name: string;
    shop_category: string;
    gst_number?: string;
    upi_id?: string;
    address: {
      flat_number?: string;
      building_number?: string;
      sector?: string;
      house_number?: string;
      street?: string;
      locality?: string;
      city: string;
      state: string;
      pincode: string;
      latitude?: number;
      longitude?: number;
    };
  }) => {
    const res = await apiClient.post<Shop>('/api/v1/shops', data);
    return res.data;
  },

  getMyShop: async () => {
    const res = await apiClient.get<Shop>('/api/v1/shops/my-shop');
    return res.data;
  },

  updateMyShop: async (data: Partial<Shop>) => {
    const res = await apiClient.put<Shop>('/api/v1/shops/my-shop', data);
    return res.data;
  },

  getShopProducts: async (shopId?: number, category?: string, search?: string) => {
    let url = '/api/v1/products';
    const queryParams: string[] = [];
    if (shopId) queryParams.push(`shop_id=${shopId}`);
    if (category && category !== 'All') queryParams.push(`category=${encodeURIComponent(category)}`);
    if (search) queryParams.push(`search=${encodeURIComponent(search)}`);
    if (queryParams.length > 0) {
      url += '?' + queryParams.join('&');
    }
    const res = await apiClient.get<Product[]>(url);
    return res.data;
  },

  createProduct: async (data: {
    name: string;
    category: string;
    unit: string;
    price: string | number;
    stock_quantity: number;
    image_url?: string;
  }) => {
    const res = await apiClient.post<Product>('/api/v1/products', data);
    return res.data;
  },

  updateProduct: async (productId: number, data: Partial<Product>) => {
    const res = await apiClient.put<Product>(`/api/v1/products/${productId}`, data);
    return res.data;
  },

  updateInventory: async (productId: number, stockQuantity: number) => {
    const res = await apiClient.patch<Product>(`/api/v1/products/${productId}/inventory`, {
      stock_quantity: stockQuantity,
    });
    return res.data;
  },

  getInventory: async () => {
    const res = await apiClient.get<Product[]>('/api/v1/products/inventory');
    return res.data;
  },
};

export const cartApi = {
  getCart: async (shopId: number) => {
    const res = await apiClient.get<Cart>(`/api/v1/cart/${shopId}`);
    return res.data;
  },

  addItem: async (shopId: number, productId: number, quantity: number = 1) => {
    const res = await apiClient.post<Cart>(`/api/v1/cart/${shopId}/items`, {
      product_id: productId,
      quantity,
    });
    return res.data;
  },

  updateItemQuantity: async (shopId: number, itemId: number, quantity: number) => {
    const res = await apiClient.patch<Cart>(`/api/v1/cart/${shopId}/items/${itemId}`, {
      quantity,
    });
    return res.data;
  },

  clearCart: async (shopId: number) => {
    const res = await apiClient.delete<{ message: string }>(`/api/v1/cart/${shopId}/clear`);
    return res.data;
  },
};

export const orderApi = {
  createOrder: async (data: { shop_id: number; items: { product_id: number; quantity: number }[] }) => {
    const res = await apiClient.post<Order>('/api/v1/orders', data);
    return res.data;
  },

  getCustomerOrders: async () => {
    const res = await apiClient.get<Order[]>('/api/v1/orders/customer');
    return res.data;
  },

  getShopkeeperOrders: async () => {
    const res = await apiClient.get<Order[]>('/api/v1/orders/shopkeeper');
    return res.data;
  },

  updateOrderStatus: async (orderId: number, status: string) => {
    const res = await apiClient.patch<Order>(`/api/v1/orders/shopkeeper/${orderId}/status`, {
      status,
    });
    return res.data;
  },

  updateOrderItemsPricing: async (
    orderId: number,
    items: { item_id: number; unit_price: number | string; quantity?: number }[],
    notes?: string
  ) => {
    const res = await apiClient.patch<Order>(`/api/v1/orders/shopkeeper/${orderId}/items-pricing`, {
      items,
      notes,
    });
    return res.data;
  },

  checkoutOrder: async (data: { order_id: number; payment_method: string; payment_reference?: string }) => {
    const res = await apiClient.post<{
      order_id: number;
      customer_id: number;
      shop_id: number;
      total_amount: string | number;
      payment_method: string;
      payment_status: string;
      order_status: string;
      message: string;
    }>('/api/v1/checkout', data);
    return res.data;
  },
};

export const creditApi = {
  requestCredit: async (data: { shop_id: number; requested_limit: string | number; notes?: string }) => {
    const res = await apiClient.post<CreditRequest>('/api/v1/credit/request', data);
    return res.data;
  },

  getCustomerCreditRequests: async () => {
    const res = await apiClient.get<CreditRequest[]>('/api/v1/credit/requests');
    return res.data;
  },

  getShopkeeperCreditRequests: async () => {
    const res = await apiClient.get<CreditRequest[]>('/api/v1/credit/shopkeeper/requests');
    return res.data;
  },

  approveCreditRequest: async (
    requestId: number,
    data: { approved: boolean; approved_limit?: string | number; notes?: string }
  ) => {
    const res = await apiClient.patch<CreditRequest>(`/api/v1/credit/shopkeeper/requests/${requestId}`, data);
    return res.data;
  },

  getCreditAccount: async (shopId: number) => {
    const res = await apiClient.get<CreditAccount>(`/api/v1/credit/account/${shopId}`);
    return res.data;
  },

  getMyLedger: async (shopId: number) => {
    const res = await apiClient.get<CreditLedgerEntry[]>(`/api/v1/credit/ledger/${shopId}`);
    return res.data;
  },

  getShopkeeperAccounts: async () => {
    const res = await apiClient.get<ShopkeeperCustomerCredit[]>('/api/v1/credit/shopkeeper/accounts');
    return res.data;
  },

  getShopkeeperCustomerLedger: async (customerId: number) => {
    const res = await apiClient.get<CreditLedgerEntry[]>(`/api/v1/credit/shopkeeper/ledger/${customerId}`);
    return res.data;
  },

  shopkeeperRecordPayment: async (customerId: number, data: { amount: string | number; payment_method: string; notes?: string }) => {
    const res = await apiClient.post(`/api/v1/credit/shopkeeper/record-payment/${customerId}`, data);
    return res.data;
  },
};

export const notificationApi = {
  getNotifications: async () => {
    const res = await apiClient.get<Notification[]>('/api/v1/notifications');
    return res.data;
  },

  getUnreadCount: async () => {
    const res = await apiClient.get<{ unread_count: number }>('/api/v1/notifications/unread-count');
    return res.data;
  },

  markAsRead: async (notificationId: number) => {
    const res = await apiClient.patch<{ message: string }>(`/api/v1/notifications/${notificationId}/read`);
    return res.data;
  },

  markAllAsRead: async () => {
    const res = await apiClient.patch<{ message: string }>('/api/v1/notifications/read-all');
    return res.data;
  },
};

export const shoppingListApi = {
  createShoppingList: async (data: {
    customer_id: number;
    shop_id: number;
    items: { product_id?: number; product_name?: string; quantity: number; notes?: string }[];
    customer_note?: string;
  }) => {
    const res = await apiClient.post<ShoppingList>('/api/v1/shopping-list', data);
    return res.data;
  },

  getShoppingList: async (customerId: number, shopId: number) => {
    const res = await apiClient.get<ShoppingList>(`/api/v1/shopping-list/${customerId}/${shopId}`);
    return res.data;
  },
};

// ============================================================
// PARCHI API
// ============================================================

export interface ParchiMessage {
  id: number;
  parchi_id: number;
  sender_role: 'CUSTOMER' | 'SHOPKEEPER' | 'SYSTEM';
  message_type: 'TEXT' | 'PARCHI_LIST' | 'ORDER_REQUEST' | 'ORDER_CONFIRMED' | 'ORDER_DECLINED' | 'STATUS_UPDATE';
  content: string;
  order_id?: number | null;
  product_snapshot?: string | null;
  created_at: string;
}

export interface ParchiThread {
  id: number;
  customer_id: number;
  shop_id: number;
  is_active: boolean;
  created_at: string;
  last_message_at?: string | null;
  shop_name?: string | null;
  shop_phone?: string | null;
  shop_address?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  last_message_preview?: string | null;
  message_count: number;
  order_count: number;
}

export interface ParchiDetail {
  parchi: ParchiThread;
  messages: ParchiMessage[];
}

export interface ParchiOrderItem {
  product_id: number;
  quantity: number;
}

export interface ParchiCustomItem {
  name: string;
  quantity: string;
}

export const parchiApi = {
  /** Customer: start (or get) Parchi with connected shop */
  startParchi: async (shopId?: number): Promise<ParchiThread> => {
    const res = await apiClient.post<ParchiThread>('/api/v1/parchi/start', {
      shop_id: shopId,
    });
    return res.data;
  },

  /** Customer: get full Parchi thread with all messages */
  getMyParchi: async (): Promise<ParchiDetail> => {
    const res = await apiClient.get<ParchiDetail>('/api/v1/parchi/my');
    return res.data;
  },

  /** Shopkeeper: list all customer Parchi threads */
  getShopkeeperParchis: async (): Promise<ParchiThread[]> => {
    const res = await apiClient.get<ParchiThread[]>('/api/v1/parchi/shopkeeper');
    return res.data;
  },

  /** Shopkeeper: get specific Parchi thread detail */
  getShopkeeperParchiDetail: async (parchiId: number): Promise<ParchiDetail> => {
    const res = await apiClient.get<ParchiDetail>(`/api/v1/parchi/shopkeeper/${parchiId}`);
    return res.data;
  },

  /** Both roles: fetch messages (with optional polling since_id) */
  getMessages: async (parchiId: number, sinceId?: number): Promise<ParchiMessage[]> => {
    let url = `/api/v1/parchi/${parchiId}/messages`;
    if (sinceId) url += `?since_id=${sinceId}`;
    const res = await apiClient.get<ParchiMessage[]>(url);
    return res.data;
  },

  /** Both roles: send a text message */
  sendMessage: async (parchiId: number, content: string): Promise<ParchiMessage> => {
    const res = await apiClient.post<ParchiMessage>(`/api/v1/parchi/${parchiId}/messages`, {
      content,
      message_type: 'TEXT',
    });
    return res.data;
  },

  /** Customer: send a handwritten/typed Parchi grocery list */
  sendParchiList: async (
    parchiId: number,
    items: ParchiCustomItem[],
    paymentMethod: string = 'COD',
    customerNotes?: string
  ): Promise<ParchiMessage> => {
    const res = await apiClient.post<ParchiMessage>(`/api/v1/parchi/${parchiId}/messages`, {
      message_type: 'PARCHI_LIST',
      parchi_items: items,
      payment_method: paymentMethod,
      customer_notes: customerNotes,
    });
    return res.data;
  },

  /** Customer: place a catalog order via Parchi */
  sendOrderRequest: async (
    parchiId: number,
    items: ParchiOrderItem[],
    paymentMethod: string = 'COD'
  ): Promise<ParchiMessage> => {
    const res = await apiClient.post<ParchiMessage>(`/api/v1/parchi/${parchiId}/messages`, {
      content: 'Order request',
      message_type: 'ORDER_REQUEST',
      items,
      payment_method: paymentMethod,
    });
    return res.data;
  },

  /** Shopkeeper: confirm or decline an ORDER_REQUEST message */
  respondToOrder: async (
    msgId: number,
    action: 'CONFIRM' | 'DECLINE',
    replyNote?: string
  ): Promise<{ message: string; order_id: number; new_order_status: string }> => {
    const res = await apiClient.patch(`/api/v1/parchi/shopkeeper/order/${msgId}/respond`, {
      action,
      reply_note: replyNote,
    });
    return res.data;
  },
};

export const invoiceApi = {
  createPurchaseInvoice: async (data: {
    supplier_name: string;
    supplier_phone?: string;
    invoice_number: string;
    invoice_date?: string;
    total_amount?: number | string;
    notes?: string;
    items: {
      product_id?: number | null;
      product_name: string;
      category?: string;
      unit?: string;
      quantity: number;
      purchase_price: number | string;
      selling_price: number | string;
      total_cost?: number | string;
    }[];
  }): Promise<PurchaseInvoice> => {
    const res = await apiClient.post<PurchaseInvoice>('/api/v1/invoices/purchase', data);
    return res.data;
  },

  getPurchaseInvoices: async (params?: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<PurchaseInvoice[]> => {
    const res = await apiClient.get<PurchaseInvoice[]>('/api/v1/invoices/purchase', { params });
    return res.data;
  },

  getPurchaseInvoiceById: async (invoiceId: number): Promise<PurchaseInvoice> => {
    const res = await apiClient.get<PurchaseInvoice>(`/api/v1/invoices/purchase/${invoiceId}`);
    return res.data;
  },
};

