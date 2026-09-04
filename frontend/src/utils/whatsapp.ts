import { Linking, Platform } from 'react-native';
import { Shop, Order, Product } from '../types';

/**
 * Open WhatsApp with a pre-filled formatted text message.
 * Supports both international phone numbers (e.g. 919876543210) and general broadcast sharing.
 */
export const sendWhatsApp = (phone?: string | null, text: string = '') => {
  const encoded = encodeURIComponent(text);
  const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
  
  let url = '';
  if (cleanPhone) {
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    url = `https://wa.me/${formattedPhone}?text=${encoded}`;
  } else {
    url = `https://wa.me/?text=${encoded}`;
  }

  Linking.openURL(url).catch((err) => {
    console.log('Failed to open WhatsApp:', err);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  });
};

/**
 * Generate formatted order bill message for customer WhatsApp.
 */
export const generateOrderBillMessage = (shop: Shop | null, order: Order): string => {
  const storeName = shop?.shop_name || 'ApkaStore';
  const orderId = order.id;
  const dateStr = new Date(order.created_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  let msg = `🧾 *ORDER BILL - ${storeName.toUpperCase()}*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📦 *Order ID:* #${orderId}\n`;
  msg += `📅 *Date:* ${dateStr}\n`;
  msg += `👤 *Customer:* ${order.customer_name || 'Valued Customer'}\n`;
  if (order.status) {
    msg += `📍 *Status:* ${order.status}\n`;
  }
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `*Items Ordered:*\n`;

  order.items?.forEach((item, idx) => {
    const unitPrice = parseFloat(String(item.unit_price)) || 0;
    const itemTotal = (unitPrice * (item.quantity || 1)).toFixed(2);
    const prodName = item.product_name || item.product?.name || 'Item';
    msg += `${idx + 1}. *${prodName}*\n   ${item.quantity} × ₹${unitPrice.toFixed(2)} = ₹${itemTotal}\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  const grandTotal = typeof order.total_amount === 'number' ? order.total_amount.toFixed(2) : order.total_amount;
  msg += `💰 *TOTAL AMOUNT: ₹${grandTotal}*\n`;
  msg += `💳 *Payment Mode:* ${order.payment_method || 'Cash on Delivery'}\n`;

  if (shop?.upi_id) {
    msg += `\n📲 *Pay via UPI:* \`${shop.upi_id}\`\n`;
  }

  msg += `\n🛍️ Order again anytime at: https://apkastore.vercel.app\n`;
  msg += `🙏 *Thank you for shopping with ${storeName}!*`;

  return msg;
};

/**
 * Generate promotional broadcast message for new product arrivals / restock.
 */
export const generateNewArrivalsMessage = (
  shop: Shop | null,
  products: Product[],
  customHeadline?: string
): string => {
  const storeName = shop?.shop_name || 'Our Store';
  const headline = customHeadline || `🌾 *FRESH STOCK ARRIVED AT ${storeName.toUpperCase()}!*`;

  let msg = `${headline}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `Dear Customers, new groceries and fresh stock have just arrived at our store!\n\n`;
  msg += `✨ *Featured New Arrivals:*\n`;

  products.slice(0, 10).forEach((p, idx) => {
    const price = typeof p.price === 'number' ? p.price.toFixed(2) : p.price;
    msg += `${idx + 1}. *${p.name}* (${p.unit || '1 unit'}) — *₹${price}*\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🚀 *Order online for fast delivery:*\n`;
  msg += `👉 https://apkastore.vercel.app\n\n`;
  if (shop?.shop_phone) {
    msg += `📞 Call / WhatsApp us: +91 ${shop.shop_phone}\n`;
  }
  msg += `📍 Visit us at *${storeName}*!`;

  return msg;
};

/**
 * Generate discount / festive offer promotional message.
 */
export const generateOfferMessage = (
  shop: Shop | null,
  offerTitle: string,
  discountSummary: string,
  products: Product[],
  validUntil?: string
): string => {
  const storeName = shop?.shop_name || 'ApkaStore';
  const title = offerTitle || '🔥 SPECIAL DISCOUNT OFFER';

  let msg = `🎉 *${title.toUpperCase()}* 🎉\n`;
  msg += `🏪 *${storeName}*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  if (discountSummary) {
    msg += `💥 *OFFER:* ${discountSummary}\n`;
  }
  if (validUntil) {
    msg += `⏰ *Valid Until:* ${validUntil}\n`;
  }
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (products.length > 0) {
    msg += `🛒 *Featured Items on Sale:*\n`;
    products.slice(0, 8).forEach((p, idx) => {
      const price = typeof p.price === 'number' ? p.price.toFixed(2) : p.price;
      msg += `${idx + 1}. *${p.name}* (${p.unit || '1 unit'}) — *₹${price}*\n`;
    });
    msg += `\n`;
  }

  msg += `⚡ Limited stock available! Order now before items run out:\n`;
  msg += `👉 https://apkastore.vercel.app\n\n`;
  if (shop?.shop_phone) {
    msg += `📞 Order on call/chat: +91 ${shop.shop_phone}\n`;
  }
  msg += `🙏 *Happy Savings from ${storeName}!*`;

  return msg;
};

/**
 * Generate polite Udhar Khata payment reminder.
 */
export const generateKhataReminderMessage = (
  shop: Shop | null,
  customerName: string,
  balance: number | string
): string => {
  const storeName = shop?.shop_name || 'ApkaStore';
  const balanceNum = typeof balance === 'number' ? balance.toFixed(2) : balance;

  let msg = `🙏 *Namaste ${customerName} ji,*\n\n`;
  msg += `This is a gentle payment reminder from *${storeName}* regarding your store Udhar / Khata account.\n\n`;
  msg += `📊 *Pending Balance:* *₹${balanceNum}*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  
  if (shop?.upi_id) {
    msg += `📲 *Pay instantly via UPI:*\n`;
    msg += `UPI ID: \`${shop.upi_id}\`\n\n`;
  }

  msg += `You can also clear the dues by visiting our store or contacting us.\n`;
  if (shop?.shop_phone) {
    msg += `📞 Store Phone: +91 ${shop.shop_phone}\n`;
  }
  msg += `\n🙏 *Thank you for being a valued customer of ${storeName}!*`;

  return msg;
};
