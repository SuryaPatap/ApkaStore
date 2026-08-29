import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { Header } from '../../components/Header';
import { EmptyState } from '../../components/EmptyState';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { orderApi } from '../../api/endpoints';

interface CartScreenProps {
  onContinueShopping: () => void;
  onOrderPlaced: () => void;
}

type PaymentMethod = 'CASH' | 'UPI' | 'CREDIT';

export const CartScreen: React.FC<CartScreenProps> = ({
  onContinueShopping,
  onOrderPlaced,
}) => {
  const { items, updateQuantity, clearCart, totalAmount, shopId } = useCart();
  const { selectedShop } = useAuth();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CREDIT');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  const deliveryFee = 0; // Free neighborhood store delivery
  const finalTotal = totalAmount + deliveryFee;
  const currentShop = selectedShop;

  const handleCheckout = async () => {
    if (items.length === 0) return;

    const targetShopId = currentShop?.id || shopId || 1;

    setIsSubmitting(true);
    try {
      // 1. Create order
      const orderPayload = {
        shop_id: targetShopId,
        payment_method: paymentMethod,
        items: items.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
        })),
      };

      const orderRes = await orderApi.createOrder(orderPayload);
      const orderId = orderRes.id;

      // 2. Checkout order with selected payment method
      await orderApi.checkoutOrder({
        order_id: orderId,
        payment_method: paymentMethod,
        payment_reference: paymentMethod === 'UPI' ? 'UPI_REF_TXN' : undefined,
      });

      clearCart();
      setOrderSuccess(
        paymentMethod === 'CREDIT'
          ? `Order #${orderId} has been added to your ${currentShop?.shop_name || 'Store'} Udhar Khata! An itemized receipt with date & time is logged in your Khata book.`
          : `Order #${orderId} confirmed successfully with ${paymentMethod}!`
      );
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.detail || err.message || 'Checkout failed. Please verify your Khata limit or store availability.';
      Alert.alert('Checkout Notice', errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (orderSuccess) {
    return (
      <View style={styles.container}>
        <Header title="Order Placed 🎉" showRoleToggle={false} />
        <View style={styles.successContainer}>
          <View style={styles.successCircle}>
            <Ionicons name="checkmark-circle" size={64} color={colors.primary.main} />
          </View>
          <Text style={styles.successTitle}>Order Confirmed!</Text>
          <Text style={styles.successMessage}>{orderSuccess}</Text>

          <View style={styles.successActions}>
            <TouchableOpacity
              style={styles.viewOrdersBtn}
              onPress={onOrderPlaced}
              activeOpacity={0.8}
            >
              <Text style={styles.viewOrdersBtnText}>View My Orders</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.continueBtn}
              onPress={onContinueShopping}
              activeOpacity={0.8}
            >
              <Text style={styles.continueBtnText}>Continue Shopping</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.container}>
        <Header title="Shopping Cart" />
        <EmptyState
          icon="cart-outline"
          title="Your cart is empty"
          description="Explore fresh groceries and household essentials from your neighborhood store."
          actionLabel="Browse Products"
          onActionPress={onContinueShopping}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Shopping Cart"
        subtitle={currentShop ? `From: ${currentShop.shop_name}` : `${items.length} items`}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Store Origin Info */}
        {currentShop && (
          <View style={styles.storeBanner}>
            <Ionicons name="storefront" size={18} color={colors.primary.main} />
            <Text style={styles.storeBannerText}>
              Ordering from <Text style={{ fontWeight: '800' }}>{currentShop.shop_name}</Text> ({currentShop.distance_km !== undefined ? `${currentShop.distance_km.toFixed(1)} km away` : '< 5km'})
            </Text>
          </View>
        )}

        {/* Items List */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Items in Cart ({items.length})</Text>
          {items.map(({ product, quantity }) => {
            const price =
              typeof product.price === 'string'
                ? parseFloat(product.price)
                : product.price;
            const itemTotal = price * quantity;

            return (
              <View key={product.id} style={styles.cartItemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{product.name}</Text>
                  <Text style={styles.itemUnit}>
                    ₹{price.toFixed(2)} / {product.unit || 'pack'}
                  </Text>
                  <Text style={styles.itemTotal}>₹{itemTotal.toFixed(2)}</Text>
                </View>

                {/* Counter */}
                <View style={styles.counter}>
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() => updateQuantity(product.id, quantity - 1)}
                  >
                    <Ionicons name="remove" size={14} color={colors.text.primary} />
                  </TouchableOpacity>
                  <Text style={styles.counterVal}>{quantity}</Text>
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() => updateQuantity(product.id, quantity + 1)}
                  >
                    <Ionicons name="add" size={14} color={colors.text.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        {/* Payment Method Selector */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Choose Payment Method</Text>

          {/* Udhar Khata Credit */}
          <TouchableOpacity
            style={[styles.payOption, paymentMethod === 'CREDIT' && styles.payOptionActive]}
            onPress={() => setPaymentMethod('CREDIT')}
            activeOpacity={0.8}
          >
            <View style={styles.payOptionLeft}>
              <View style={[styles.payIconCircle, { backgroundColor: colors.gold.surface }]}>
                <Ionicons name="book" size={20} color={colors.gold.dark} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.payOptionTitle}>Udhar Khata (Monthly Store Credit)</Text>
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedBadgeText}>RECOMMENDED</Text>
                  </View>
                </View>
                <Text style={styles.payOptionSubtitle}>
                  Itemized bill with exact time logged directly to your store ledger
                </Text>
              </View>
            </View>
            <Ionicons
              name={paymentMethod === 'CREDIT' ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={paymentMethod === 'CREDIT' ? colors.primary.main : colors.border.main}
            />
          </TouchableOpacity>

          {/* Instant UPI */}
          <TouchableOpacity
            style={[styles.payOption, paymentMethod === 'UPI' && styles.payOptionActive]}
            onPress={() => setPaymentMethod('UPI')}
            activeOpacity={0.8}
          >
            <View style={styles.payOptionLeft}>
              <View style={[styles.payIconCircle, { backgroundColor: colors.primary.surface }]}>
                <Ionicons name="qr-code-outline" size={20} color={colors.primary.main} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.payOptionTitle}>UPI (Google Pay, PhonePe, Paytm)</Text>
                <Text style={styles.payOptionSubtitle}>
                  {currentShop?.upi_id ? `Pay directly to ${currentShop.upi_id}` : 'Instant zero-fee store payment'}
                </Text>
              </View>
            </View>
            <Ionicons
              name={paymentMethod === 'UPI' ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={paymentMethod === 'UPI' ? colors.primary.main : colors.border.main}
            />
          </TouchableOpacity>

          {/* Expanded Store UPI Details */}
          {paymentMethod === 'UPI' && currentShop?.upi_id && (
            <View style={styles.upiStoreCard}>
              <View style={styles.upiHeaderRow}>
                <Ionicons name="business" size={15} color="#0369A1" />
                <Text style={styles.upiStoreTitle}>{currentShop.shop_name} Official UPI</Text>
              </View>
              <View style={styles.upiIdRow}>
                <Text style={styles.upiIdText}>{currentShop.upi_id}</Text>
                <TouchableOpacity
                  style={styles.upiLaunchBtn}
                  onPress={() => {
                    const upiUrl = `upi://pay?pa=${currentShop.upi_id}&pn=${encodeURIComponent(currentShop.shop_name)}&am=${finalTotal.toFixed(2)}&cu=INR`;
                    Linking.openURL(upiUrl).catch(() => {
                      Alert.alert(
                        'Store UPI Details',
                        `Store: ${currentShop.shop_name}\nUPI ID: ${currentShop.upi_id}\nAmount: ₹${finalTotal.toFixed(2)}\n\nPlease open GPay, PhonePe, or Paytm and send to this UPI ID.`
                      );
                    });
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="open-outline" size={13} color="#fff" />
                  <Text style={styles.upiLaunchBtnText}>Pay via UPI App</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Cash on Delivery */}
          <TouchableOpacity
            style={[styles.payOption, paymentMethod === 'CASH' && styles.payOptionActive]}
            onPress={() => setPaymentMethod('CASH')}
            activeOpacity={0.8}
          >
            <View style={styles.payOptionLeft}>
              <View style={[styles.payIconCircle, { backgroundColor: colors.background.subtle }]}>
                <Ionicons name="cash-outline" size={20} color={colors.text.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.payOptionTitle}>Cash on Delivery / Counter Pickup</Text>
                <Text style={styles.payOptionSubtitle}>Pay cash upon delivery</Text>
              </View>
            </View>
            <Ionicons
              name={paymentMethod === 'CASH' ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={paymentMethod === 'CASH' ? colors.primary.main : colors.border.main}
            />
          </TouchableOpacity>
        </View>

        {/* Bill Breakdown */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Bill Breakdown</Text>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Items Subtotal</Text>
            <Text style={styles.billValue}>₹{totalAmount.toFixed(2)}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Neighborhood Store Delivery</Text>
            <Text style={[styles.billValue, { color: colors.primary.main, fontWeight: '700' }]}>
              FREE
            </Text>
          </View>
          <View style={[styles.billRow, styles.billTotalRow]}>
            <Text style={styles.billTotalLabel}>Grand Total</Text>
            <Text style={styles.billTotalValue}>₹{finalTotal.toFixed(2)}</Text>
          </View>
        </View>

        {/* Place Order Button */}
        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={handleCheckout}
          disabled={isSubmitting}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <View style={styles.checkoutBtnContent}>
              <Text style={styles.checkoutBtnText}>
                {paymentMethod === 'CREDIT' ? 'Add to Udhar Khata & Place Order' : 'Place Order'}
              </Text>
              <Text style={styles.checkoutBtnPrice}>₹{finalTotal.toFixed(2)}</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  storeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.primary.light,
    gap: 8,
  },
  storeBannerText: {
    fontSize: 12,
    color: colors.primary.dark,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text.primary,
    marginBottom: 12,
  },
  cartItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  itemInfo: {
    flex: 1,
    paddingRight: 10,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  itemUnit: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary.dark,
    marginTop: 3,
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.subtle,
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  counterBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  counterVal: {
    paddingHorizontal: 10,
    fontSize: 13,
    fontWeight: '800',
    color: colors.text.primary,
  },
  payOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  payOptionActive: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.surface,
  },
  payOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
    gap: 10,
  },
  payIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  payOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  payOptionSubtitle: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 2,
  },
  recommendedBadge: {
    backgroundColor: colors.gold.main,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  recommendedBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  billLabel: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  billValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  billTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    marginTop: 6,
    paddingTop: 10,
  },
  billTotalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text.primary,
  },
  billTotalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text.primary,
  },
  checkoutBtn: {
    backgroundColor: colors.primary.main,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    shadowColor: colors.primary.main,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 4,
  },
  checkoutBtnContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkoutBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  checkoutBtnPrice: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.primary.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text.primary,
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  successActions: {
    width: '100%',
    gap: 10,
  },
  viewOrdersBtn: {
    backgroundColor: colors.primary.main,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  viewOrdersBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  continueBtn: {
    backgroundColor: colors.background.subtle,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  continueBtnText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  upiStoreCard: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    padding: 12,
    marginTop: -4,
    marginBottom: 10,
  },
  upiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  upiStoreTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0369A1',
  },
  upiIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  upiIdText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  upiLaunchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  upiLaunchBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
});
