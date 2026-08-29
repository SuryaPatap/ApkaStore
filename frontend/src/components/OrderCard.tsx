import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Linking,
  Alert,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, colors } from '../theme/colors';
import { Order, OrderStatus } from '../types';
import { Badge } from './Badge';
import { orderApi } from '../api/endpoints';

interface OrderCardProps {
  order: Order;
  isShopkeeper?: boolean;
  onUpdateStatus?: (status: OrderStatus) => void;
  onOrderUpdated?: (order: Order) => void;
  onPress?: () => void;
  onRefresh?: () => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  isShopkeeper = false,
  onUpdateStatus,
  onOrderUpdated,
  onPress,
  onRefresh,
}) => {
  const [currentOrder, setCurrentOrder] = useState<Order>(order);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [isEditingRupees, setIsEditingRupees] = useState(false);
  const [itemPrices, setItemPrices] = useState<{ [itemId: number]: string }>({});
  const [savingPrices, setSavingPrices] = useState(false);

  // Sync currentOrder when props.order changes
  React.useEffect(() => {
    setCurrentOrder(order);
  }, [order]);

  const isDelivered = currentOrder.status === 'COMPLETED' || currentOrder.status === 'DELIVERED';
  const isParchi = Boolean(
    currentOrder.is_parchi || (currentOrder.notes && currentOrder.notes.toLowerCase().includes('parchi'))
  );

  const getBadgeVariant = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return 'warning';
      case 'PROCESSING':
        return 'info';
      case 'READY':
      case 'CREDIT_CONFIRMED':
        return 'primary';
      case 'COMPLETED':
      case 'DELIVERED':
        return 'success';
      case 'CANCELLED':
        return 'danger';
      default:
        return 'secondary';
    }
  };

  // Calculate live preview total inside modal / receipt
  const liveCalculatedTotal = currentOrder.items && currentOrder.items.length > 0
    ? currentOrder.items.reduce((sum, it) => {
        const rate = parseFloat(
          itemPrices[it.id] !== undefined && itemPrices[it.id] !== ''
            ? itemPrices[it.id]
            : String(it.unit_price || '0')
        ) || 0;
        return sum + rate * it.quantity;
      }, 0)
    : (typeof currentOrder.total_amount === 'string' ? parseFloat(currentOrder.total_amount) : currentOrder.total_amount) || 0;

  const total = (() => {
    // If editing or rates are typed in inputs, use liveCalculatedTotal
    if ((isEditingRupees || showPriceModal) && liveCalculatedTotal > 0) {
      return liveCalculatedTotal.toFixed(2);
    }
    const rawAmt =
      typeof currentOrder.total_amount === 'string'
        ? parseFloat(currentOrder.total_amount)
        : currentOrder.total_amount;
    if (rawAmt && rawAmt > 0) return rawAmt.toFixed(2);
    if (liveCalculatedTotal > 0) return liveCalculatedTotal.toFixed(2);
    return '0.00';
  })();

  const formattedDate = currentOrder.created_at
    ? new Date(currentOrder.created_at).toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Just now';

  const handleCall = () => {
    if (currentOrder.customer_phone) {
      Linking.openURL(`tel:${currentOrder.customer_phone}`);
    } else {
      Alert.alert('Phone', 'Customer phone number not available.');
    }
  };

  const handleOpenReceipt = () => {
    const pricesObj: { [itemId: number]: string } = {};
    if (currentOrder.items && currentOrder.items.length > 0) {
      currentOrder.items.forEach((it) => {
        const u = typeof it.unit_price === 'string' ? parseFloat(it.unit_price) : it.unit_price;
        pricesObj[it.id] = String(u !== undefined && u !== null ? u : 0);
      });
    }
    setItemPrices(pricesObj);
    setIsEditingRupees(false);
    setShowReceipt(true);
  };

  const handleConfirmDelivery = (customAction?: () => void) => {
    const doDeliver = () => {
      if (customAction) customAction();
      if (onUpdateStatus) onUpdateStatus('COMPLETED');
    };

    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined'
          ? window.confirm(`Mark Order #${currentOrder.id} as Delivered & Completed?`)
          : true;
      if (confirmed) {
        doDeliver();
      }
    } else {
      Alert.alert(
        'Confirm Delivery',
        `Mark Order #${currentOrder.id} as Delivered & Completed?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes, Deliver',
            onPress: doDeliver,
          },
        ]
      );
    }
  };

  const handleOpenPriceModal = () => {
    const pricesObj: { [itemId: number]: string } = {};
    if (currentOrder.items && currentOrder.items.length > 0) {
      currentOrder.items.forEach((it) => {
        const u = typeof it.unit_price === 'string' ? parseFloat(it.unit_price) : it.unit_price;
        pricesObj[it.id] = String(u !== undefined && u !== null ? u : 0);
      });
    }
    setItemPrices(pricesObj);
    setShowPriceModal(true);
  };

  const handleSavePrices = async () => {
    if (!currentOrder.items || currentOrder.items.length === 0) {
      Alert.alert('Notice', 'No items found on this order to update.');
      setIsEditingRupees(false);
      setShowPriceModal(false);
      return;
    }
    try {
      setSavingPrices(true);
      const newItems = currentOrder.items.map((it) => {
        const valStr =
          itemPrices[it.id] !== undefined && itemPrices[it.id] !== ''
            ? itemPrices[it.id]
            : String(it.unit_price !== undefined && it.unit_price !== null ? it.unit_price : '0');
        const unit_price = parseFloat(valStr) || 0;
        return {
          ...it,
          unit_price,
        };
      });

      const newCalculatedTotal = newItems.reduce(
        (sum, it) => sum + (parseFloat(String(it.unit_price)) || 0) * (it.quantity || 1),
        0
      );

      const optimisticOrder = {
        ...currentOrder,
        items: newItems,
        total_amount: newCalculatedTotal,
      };

      // Keep local state in sync
      const updatedPricesObj: { [itemId: number]: string } = {};
      newItems.forEach((it) => {
        updatedPricesObj[it.id] = String(it.unit_price);
      });
      setItemPrices(updatedPricesObj);
      setCurrentOrder(optimisticOrder);
      if (onOrderUpdated) onOrderUpdated(optimisticOrder);

      const payload = newItems.map((it) => ({
        item_id: it.id,
        unit_price: parseFloat(String(it.unit_price)) || 0,
        quantity: it.quantity || 1,
      }));

      const updated = await orderApi.updateOrderItemsPricing(currentOrder.id, payload);
      if (updated) {
        setCurrentOrder(updated);
        if (onOrderUpdated) onOrderUpdated(updated);
      }

      Alert.alert(
        'Prices Updated 🎉',
        `Item rates for Order #${currentOrder.id} have been updated. Total Amount is now ₹${newCalculatedTotal.toFixed(2)}.`
      );
      setIsEditingRupees(false);
      setShowPriceModal(false);
      if (onRefresh) onRefresh();
    } catch (e: any) {
      console.error('Failed to update pricing:', e);
      Alert.alert('Notice', e?.message || e?.response?.data?.detail || 'Prices updated.');
    } finally {
      setSavingPrices(false);
    }
  };

  return (
    <>
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={0.7}
            onPress={() => (onPress ? onPress() : setShowReceipt(true))}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={styles.orderId}>Order #{currentOrder.id}</Text>
              {isParchi && (
                <View style={styles.parchiBadge}>
                  <Text style={styles.parchiBadgeText}>📋 DIGITAL PARCHI</Text>
                </View>
              )}
            </View>
            <Text style={styles.orderDate}>{formattedDate}</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Badge label={currentOrder.status} variant={getBadgeVariant(currentOrder.status)} />
            <TouchableOpacity
              style={styles.receiptTag}
              onPress={handleOpenReceipt}
              activeOpacity={0.8}
            >
              <Ionicons name="receipt-outline" size={13} color={colors.primary.main} />
              <Text style={styles.receiptTagText}>Receipt</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Customer Details if Shopkeeper */}
        {isShopkeeper && (
          <View style={styles.customerBox}>
            {currentOrder.customer_name && (
              <View style={styles.customerRow}>
                <Ionicons name="person" size={13} color={colors.primary.main} />
                <Text style={styles.customerName}>{currentOrder.customer_name}</Text>
              </View>
            )}

            {currentOrder.customer_phone && (
              <TouchableOpacity style={styles.customerRow} onPress={handleCall} activeOpacity={0.8}>
                <Ionicons name="call" size={13} color="#059669" />
                <Text style={[styles.customerPhone, { color: '#059669' }]}>
                  {currentOrder.customer_phone} (Tap to Call)
                </Text>
              </TouchableOpacity>
            )}

            {currentOrder.customer_address && (
              <View style={styles.addressRow}>
                <Ionicons name="location" size={13} color={colors.primary.main} style={{ marginTop: 2 }} />
                <Text style={styles.addressText}>
                  <Text style={{ fontWeight: '700' }}>Delivery: </Text>
                  {currentOrder.customer_address}
                </Text>
              </View>
            )}

            <View style={styles.payBadgeRow}>
              <View style={styles.payBadge}>
                <Ionicons name="card-outline" size={12} color={colors.text.secondary} />
                <Text style={styles.payBadgeText}>Payment: {currentOrder.payment_method || 'COD'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Items List Preview */}
        <View style={styles.itemsList}>
          {currentOrder.items && currentOrder.items.length > 0 ? (
            currentOrder.items.slice(0, 4).map((item, idx) => {
              const typedPrice = itemPrices[item.id];
              const uPrice =
                (isEditingRupees || showPriceModal) && typedPrice !== undefined && typedPrice !== ''
                  ? parseFloat(typedPrice) || 0
                  : typeof item.unit_price === 'string'
                  ? parseFloat(item.unit_price)
                  : item.unit_price || 0;
              const subtotal = uPrice * item.quantity;
              return (
                <View key={item.id || idx} style={styles.itemRow}>
                  <Text style={styles.itemQuantity}>{item.quantity}x</Text>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.product?.name || item.product_name || `Item #${item.id}`}
                  </Text>
                  <Text style={[styles.itemPrice, uPrice === 0 && { color: '#D97706', fontWeight: '800' }]}>
                    {uPrice > 0 ? `₹${subtotal.toFixed(2)}` : '₹0 (Set Price)'}
                  </Text>
                </View>
              );
            })
          ) : (
            <View style={styles.itemRow}>
              <Ionicons name="document-text-outline" size={14} color={colors.text.muted} />
              <Text style={styles.emptyItemsText}>
                {currentOrder.notes || 'Digital Parchi grocery order list'}
              </Text>
            </View>
          )}

          {currentOrder.items && currentOrder.items.length > 4 && (
            <Text style={styles.moreItemsText}>+{currentOrder.items.length - 4} more items...</Text>
          )}
        </View>

        {/* Prominent Shopkeeper "Update Rupees" Bar */}
        {isShopkeeper && (
          <TouchableOpacity
            style={styles.priceActionBanner}
            onPress={handleOpenPriceModal}
            activeOpacity={0.85}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.priceBannerIcon}>
                <Ionicons name="cash" size={16} color="#fff" />
              </View>
              <View>
                <Text style={styles.priceBannerTitle}>💰 Add / Update Item Rupees (₹)</Text>
                <Text style={styles.priceBannerSub}>Set or edit item rates for this order</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#B45309" />
          </TouchableOpacity>
        )}

        {/* Footer with Total & Status Actions */}
        <View style={styles.footer}>
          <View>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalAmount}>₹{total}</Text>
          </View>

          <View style={styles.footerActions}>
            <TouchableOpacity
              style={styles.viewReceiptBtn}
              onPress={handleOpenReceipt}
              activeOpacity={0.8}
            >
              <Text style={styles.viewReceiptBtnText}>View Receipt</Text>
            </TouchableOpacity>

            {isShopkeeper && onUpdateStatus && !isDelivered && (
              <View style={styles.statusActions}>
                {currentOrder.status === 'PENDING' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.processingBtn]}
                    onPress={() => onUpdateStatus('PROCESSING')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.actionBtnText}>Pack</Text>
                  </TouchableOpacity>
                )}

                {currentOrder.status === 'PROCESSING' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.readyBtn]}
                    onPress={() => onUpdateStatus('READY')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.actionBtnText}>Ready</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionBtn, styles.completeBtn]}
                  onPress={() => handleConfirmDelivery()}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-circle" size={14} color="#fff" />
                  <Text style={styles.actionBtnText}>Deliver</Text>
                </TouchableOpacity>
              </View>
            )}

            {isDelivered && (
              <View style={styles.deliveredBadge}>
                <Ionicons name="checkmark-done" size={14} color="#059669" />
                <Text style={styles.deliveredBadgeText}>Delivered / Done</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ─── DEDICATED RUPEE / PRICE UPDATE MODAL ─── */}
      <Modal visible={showPriceModal} animationType="slide" transparent>
        <View style={pm.backdrop}>
          <View style={pm.container}>
            {/* Modal Header */}
            <View style={pm.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={pm.iconBadge}>
                  <Ionicons name="cash" size={20} color="#fff" />
                </View>
                <View>
                  <Text style={pm.title}>Update Item Rupees (₹)</Text>
                  <Text style={pm.sub}>Order #{currentOrder.id} • Digital Parchi</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowPriceModal(false)} style={pm.closeBtn}>
                <Ionicons name="close" size={20} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={pm.body} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={pm.instructionText}>
                Enter the unit rate in Rupees (₹) for each item in the customer's grocery list:
              </Text>

              {currentOrder.items && currentOrder.items.length > 0 ? (
                currentOrder.items.map((it, idx) => {
                  const currentVal =
                    itemPrices[it.id] !== undefined
                      ? itemPrices[it.id]
                      : String(it.unit_price !== undefined && it.unit_price !== null ? it.unit_price : '0');
                  const itemRate = parseFloat(currentVal || '0') || 0;
                  const itemSubtotal = itemRate * it.quantity;

                  return (
                    <View key={it.id || idx} style={pm.itemCard}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={pm.itemName} numberOfLines={2}>
                          {it.product?.name || it.product_name || `Item #${it.id}`}
                        </Text>
                        <Text style={pm.itemQty}>Quantity: {it.quantity}</Text>
                      </View>

                      <View style={{ alignItems: 'flex-end' }}>
                        <View style={pm.inputRow}>
                          <Text style={pm.rupeeSymbol}>₹</Text>
                          <TextInput
                            style={pm.priceInput}
                            keyboardType="numeric"
                            value={currentVal}
                            placeholder="0"
                            placeholderTextColor="#9CA3AF"
                            onChangeText={(val) =>
                              setItemPrices((prev) => ({ ...prev, [it.id]: val }))
                            }
                          />
                        </View>
                        <Text style={pm.subtotalText}>Subtotal: ₹{itemSubtotal.toFixed(2)}</Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={pm.emptyBox}>
                  <Text style={pm.emptyText}>No items found on this order.</Text>
                </View>
              )}

              {/* Total Preview */}
              <View style={pm.totalCard}>
                <Text style={pm.totalCardLabel}>Calculated Grand Total:</Text>
                <Text style={pm.totalCardVal}>₹{liveCalculatedTotal.toFixed(2)}</Text>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={pm.saveBtn}
                onPress={handleSavePrices}
                disabled={savingPrices}
                activeOpacity={0.85}
              >
                {savingPrices ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="save" size={18} color="#fff" />
                    <Text style={pm.saveBtnText}>
                      Save Rates & Update Customer Total (₹{liveCalculatedTotal.toFixed(2)})
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── FULL OFFICIAL ORDER RECEIPT MODAL ─── */}
      <Modal visible={showReceipt} animationType="slide" transparent>
        <View style={rc.backdrop}>
          <View style={rc.modalContainer}>
            {/* Receipt Header */}
            <View style={rc.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={rc.headerIcon}>
                  <Ionicons name="receipt" size={20} color="#fff" />
                </View>
                <View>
                  <Text style={rc.headerTitle}>Order Received Receipt</Text>
                  <Text style={rc.headerSub}>ApkaStore Verified Order</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowReceipt(false)} style={rc.closeBtn}>
                <Ionicons name="close" size={22} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={rc.body}
              contentContainerStyle={{ paddingBottom: 28 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Order Meta Bar */}
              <View style={rc.metaBar}>
                <View>
                  <Text style={rc.metaOrderId}>Order #{currentOrder.id}</Text>
                  <Text style={rc.metaDate}>{formattedDate}</Text>
                </View>
                <Badge label={currentOrder.status} variant={getBadgeVariant(currentOrder.status)} />
              </View>

              {/* Customer & Delivery Details */}
              <View style={rc.section}>
                <Text style={rc.sectionTitle}>👤 CUSTOMER & DELIVERY DETAILS</Text>
                <View style={rc.detailCard}>
                  <View style={rc.detailRow}>
                    <Text style={rc.detailKey}>Customer Name:</Text>
                    <Text style={rc.detailVal}>{currentOrder.customer_name || 'Customer'}</Text>
                  </View>

                  <View style={rc.detailRow}>
                    <Text style={rc.detailKey}>Phone Number:</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[rc.detailVal, { color: colors.primary.main, fontWeight: '800' }]}>
                        {currentOrder.customer_phone || 'Not available'}
                      </Text>
                      {currentOrder.customer_phone && (
                        <TouchableOpacity onPress={handleCall} style={rc.miniCallBtn}>
                          <Ionicons name="call" size={12} color="#fff" />
                          <Text style={rc.miniCallText}>Call</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  <View style={[rc.detailRow, { alignItems: 'flex-start' }]}>
                    <Text style={rc.detailKey}>Full Address:</Text>
                    <Text style={[rc.detailVal, rc.addressVal]}>
                      {currentOrder.customer_address || 'Address registered on file'}
                    </Text>
                  </View>

                  <View style={rc.detailRow}>
                    <Text style={rc.detailKey}>Payment Method:</Text>
                    <Text style={[rc.detailVal, { fontWeight: '800', color: colors.gold.dark }]}>
                      {currentOrder.payment_method || 'Cash on Delivery (COD)'}
                    </Text>
                  </View>

                  {currentOrder.notes && (
                    <View style={[rc.detailRow, { alignItems: 'flex-start' }]}>
                      <Text style={rc.detailKey}>Special Notes:</Text>
                      <Text style={[rc.detailVal, { color: colors.text.secondary, fontStyle: 'italic' }]}>
                        {currentOrder.notes}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Items Breakdown Table */}
              <View style={rc.section}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <Text style={rc.sectionTitle}>📦 ORDERED ITEMS BREAKDOWN</Text>

                  {/* Top Edit / Done Action Toggle Button (Shopkeeper only) */}
                  {isShopkeeper && (
                    !isEditingRupees ? (
                      <TouchableOpacity
                        style={rc.editModeBtn}
                        onPress={() => {
                          const pricesObj: { [itemId: number]: string } = {};
                          if (currentOrder.items && currentOrder.items.length > 0) {
                            currentOrder.items.forEach((it) => {
                              const u = typeof it.unit_price === 'string' ? parseFloat(it.unit_price) : it.unit_price;
                              pricesObj[it.id] = String(u !== undefined && u !== null && u > 0 ? u : '');
                            });
                          }
                          setItemPrices((prev) => ({ ...pricesObj, ...prev }));
                          setIsEditingRupees(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="pencil" size={13} color="#92400E" />
                        <Text style={rc.editModeBtnText}>✏️ Edit Rupees</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={rc.doneHeaderBtn}
                        onPress={handleSavePrices}
                        disabled={savingPrices}
                        activeOpacity={0.8}
                      >
                        {savingPrices ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <>
                            <Ionicons name="checkmark-circle" size={14} color="#fff" />
                            <Text style={rc.doneHeaderBtnText}>Done</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )
                  )}
                </View>

                {/* Edit Mode Instructions / Notice (Shopkeeper only) */}
                {isShopkeeper && isEditingRupees ? (
                  <View style={rc.pricingTipBanner}>
                    <Ionicons name="create" size={15} color="#B45309" />
                    <Text style={rc.pricingTipText}>
                      Enter missing item prices in Rupees (₹), then click Done to calculate Grand Total:
                    </Text>
                  </View>
                ) : isShopkeeper && currentOrder.items && currentOrder.items.some((it) => (!it.unit_price || parseFloat(String(it.unit_price)) === 0)) ? (
                  <TouchableOpacity
                    style={rc.missingPriceAlert}
                    onPress={() => {
                      const pricesObj: { [itemId: number]: string } = {};
                      if (currentOrder.items && currentOrder.items.length > 0) {
                        currentOrder.items.forEach((it) => {
                          const u = typeof it.unit_price === 'string' ? parseFloat(it.unit_price) : it.unit_price;
                          pricesObj[it.id] = String(u !== undefined && u !== null && u > 0 ? u : '');
                        });
                      }
                      setItemPrices((prev) => ({ ...pricesObj, ...prev }));
                      setIsEditingRupees(true);
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="alert-circle" size={16} color="#D97706" />
                    <Text style={rc.missingPriceAlertText}>
                      Item has ₹0.00 price! Tap here or "Edit Rupees" to set price.
                    </Text>
                  </TouchableOpacity>
                ) : null}

                <View style={rc.table}>
                  <View style={rc.tableHead}>
                    <Text style={[rc.th, { flex: 2 }]}>Item</Text>
                    <Text style={[rc.th, { flex: 0.8, textAlign: 'center' }]}>Qty</Text>
                    <Text style={[rc.th, { flex: 1.4, textAlign: 'right' }]}>Rate (₹)</Text>
                    <Text style={[rc.th, { flex: 1.2, textAlign: 'right' }]}>Subtotal</Text>
                  </View>

                  {currentOrder.items && currentOrder.items.length > 0 ? (
                    currentOrder.items.map((it, idx) => {
                      const currentVal =
                        itemPrices[it.id] !== undefined
                          ? itemPrices[it.id]
                          : String(it.unit_price !== undefined && it.unit_price !== null ? it.unit_price : '0');
                      const rateVal = parseFloat(currentVal || '0') || 0;
                      const sub = rateVal * it.quantity;

                      return (
                        <View key={it.id || idx} style={rc.tableRow}>
                          <View style={{ flex: 2 }}>
                            <Text style={rc.itemTitleText} numberOfLines={2}>
                              {it.product?.name || it.product_name || `Item #${it.id}`}
                            </Text>
                            {isShopkeeper && !isEditingRupees && rateVal === 0 && (
                              <View style={rc.missingBadge}>
                                <Text style={rc.missingBadgeText}>Missing Price</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[rc.td, { flex: 0.8, textAlign: 'center' }]}>{it.quantity}</Text>

                          {/* Rate Column: Editable Input ONLY for Shopkeeper in Edit Mode, otherwise Clean Text */}
                          <View style={{ flex: 1.4, alignItems: 'flex-end' }}>
                            {isShopkeeper && isEditingRupees ? (
                              <View style={rc.inTableRateInputBox}>
                                <Text style={rc.inTableRupeeSymbol}>₹</Text>
                                <TextInput
                                  style={rc.inTableRateInput}
                                  keyboardType="numeric"
                                  value={currentVal}
                                  placeholder="0.00"
                                  placeholderTextColor="#94A3B8"
                                  onChangeText={(val) =>
                                    setItemPrices((prev) => ({ ...prev, [it.id]: val }))
                                  }
                                />
                              </View>
                            ) : (
                              <Text
                                style={[
                                  rc.td,
                                  { textAlign: 'right' },
                                  rateVal === 0 && { color: isShopkeeper ? '#D97706' : colors.text.secondary, fontWeight: '800' },
                                ]}
                              >
                                ₹{rateVal.toFixed(2)}
                              </Text>
                            )}
                          </View>

                          <Text style={[rc.td, { flex: 1.2, textAlign: 'right', fontWeight: '800', color: '#0F172A' }]}>
                            ₹{sub.toFixed(2)}
                          </Text>
                        </View>
                      );
                    })
                  ) : (
                    <View style={rc.tableRow}>
                      <Text style={[rc.td, { flex: 2 }]}>Grocery order package</Text>
                      <Text style={[rc.td, { flex: 0.8, textAlign: 'center' }]}>1</Text>
                      <Text style={[rc.td, { flex: 1.4, textAlign: 'right' }]}>₹{total}</Text>
                      <Text style={[rc.td, { flex: 1.2, textAlign: 'right' }]}>₹{total}</Text>
                    </View>
                  )}
                </View>

                {/* Direct In-Receipt "Done & Save Grand Total" Button in Edit Mode (Shopkeeper only) */}
                {isShopkeeper && isEditingRupees && currentOrder.items && currentOrder.items.length > 0 && (
                  <TouchableOpacity
                    style={rc.directSaveBtn}
                    onPress={handleSavePrices}
                    disabled={savingPrices}
                    activeOpacity={0.85}
                  >
                    {savingPrices ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-done-circle" size={18} color="#fff" />
                        <Text style={rc.directSaveBtnText}>
                          Done & Save Grand Total (₹{liveCalculatedTotal.toFixed(2)})
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* Total Calculation */}
              <View style={rc.totalBox}>
                <View style={rc.totalRow}>
                  <Text style={rc.totalKey}>Items Subtotal</Text>
                  <Text style={rc.totalVal}>₹{liveCalculatedTotal.toFixed(2)}</Text>
                </View>
                <View style={rc.totalRow}>
                  <Text style={rc.totalKey}>Delivery Charge (&lt; 2km neighborhood)</Text>
                  <Text style={[rc.totalVal, { color: '#059669', fontWeight: '800' }]}>FREE</Text>
                </View>
                <View style={[rc.totalRow, rc.grandTotalRow]}>
                  <Text style={rc.grandTotalKey}>Grand Total</Text>
                  <Text style={rc.grandTotalVal}>₹{liveCalculatedTotal.toFixed(2)}</Text>
                </View>
              </View>

              {/* Customer Pay via UPI Action */}
              {!isShopkeeper && liveCalculatedTotal > 0 && !isDelivered && (
                <View style={{ marginTop: 14 }}>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      backgroundColor: '#0284C7',
                      paddingVertical: 12,
                      borderRadius: 12,
                    }}
                    onPress={() => {
                      const shopPhone = currentOrder.shop_phone || 'store';
                      const upiId = currentOrder.shop_upi_id || `${shopPhone}@okaxis`;
                      const upiUrl = `upi://pay?pa=${upiId}&pn=ApkaStore&am=${liveCalculatedTotal.toFixed(2)}&cu=INR`;
                      Linking.openURL(upiUrl).catch(() => {
                        Alert.alert('Store Payment', `Store UPI: ${upiId}\nAmount: ₹${liveCalculatedTotal.toFixed(2)}\n\nPlease open GPay, PhonePe, or Paytm to pay.`);
                      });
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="qr-code-outline" size={18} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>
                      Pay ₹{liveCalculatedTotal.toFixed(2)} via UPI App
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Action Buttons */}
              {isShopkeeper && onUpdateStatus && !isDelivered && (
                <View style={rc.actionSection}>
                  {currentOrder.status === 'PENDING' && (
                    <TouchableOpacity
                      style={[rc.mainActionBtn, { backgroundColor: Colors.info }]}
                      onPress={() => {
                        setShowReceipt(false);
                        onUpdateStatus('PROCESSING');
                      }}
                    >
                      <Ionicons name="cube" size={18} color="#fff" />
                      <Text style={rc.mainActionBtnText}>Accept Order & Start Packing</Text>
                    </TouchableOpacity>
                  )}

                  {currentOrder.status === 'PROCESSING' && (
                    <TouchableOpacity
                      style={[rc.mainActionBtn, { backgroundColor: colors.primary.main }]}
                      onPress={() => {
                        setShowReceipt(false);
                        onUpdateStatus('READY');
                      }}
                    >
                      <Ionicons name="checkmark-circle" size={18} color="#fff" />
                      <Text style={rc.mainActionBtnText}>Items Packed & Order Ready</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[rc.mainActionBtn, { backgroundColor: '#059669', marginTop: 10 }]}
                    onPress={() => handleConfirmDelivery(() => setShowReceipt(false))}
                  >
                    <Ionicons name="shield-checkmark" size={18} color="#fff" />
                    <Text style={rc.mainActionBtnText}>Mark Order Completed & Delivered</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  receiptTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primary.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  receiptTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary.main,
  },
  parchiBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  parchiBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#B45309',
  },
  orderDate: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  customerBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
    marginBottom: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customerName: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  customerPhone: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary.main,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 2,
  },
  addressText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  payBadgeRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  payBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  payBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  itemsList: {
    marginVertical: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemQuantity: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
    width: 28,
  },
  itemName: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    paddingRight: 8,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  moreItemsText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    fontStyle: 'italic',
  },
  emptyItemsText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginLeft: 6,
  },
  priceActionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 6,
  },
  priceBannerIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  priceBannerSub: {
    fontSize: 10,
    color: '#B45309',
    marginTop: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.primaryDark,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  viewReceiptBtn: {
    backgroundColor: colors.primary.surface,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewReceiptBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary.main,
  },
  statusActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  processingBtn: {
    backgroundColor: Colors.info,
  },
  readyBtn: {
    backgroundColor: Colors.primary,
  },
  completeBtn: {
    backgroundColor: '#059669',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  deliveredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  deliveredBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
  },
});

// ─── Price Editor Modal Styles ────────────────────────────────────────────────
const pm = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#92400E',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fff',
  },
  sub: {
    fontSize: 11,
    color: '#FDE68A',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 16,
  },
  instructionText: {
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: 12,
    lineHeight: 16,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  itemQty: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rupeeSymbol: {
    fontSize: 14,
    fontWeight: '900',
    color: '#92400E',
    marginRight: 4,
  },
  priceInput: {
    fontSize: 15,
    fontWeight: '800',
    color: '#92400E',
    width: 75,
    textAlign: 'right',
    padding: 0,
  },
  subtotalText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text.secondary,
    marginTop: 3,
  },
  emptyBox: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: colors.text.muted,
  },
  totalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  totalCardLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  totalCardVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#B45309',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 12,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
});

// ─── Modal Styles ─────────────────────────────────────────────────────────────
const rc = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.navy.main,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fff',
  },
  headerSub: {
    fontSize: 11,
    color: '#94A3B8',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 18,
    paddingBottom: 24,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.text.secondary,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  detailCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailKey: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '600',
    width: 120,
  },
  detailVal: {
    flex: 1,
    fontSize: 13,
    color: colors.text.primary,
    fontWeight: '700',
    textAlign: 'right',
  },
  addressVal: {
    fontWeight: '600',
    color: colors.navy.main,
    lineHeight: 18,
  },
  miniCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  miniCallText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  table: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  th: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.text.secondary,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  td: {
    fontSize: 12,
    color: colors.text.primary,
  },
  totalBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalKey: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  totalVal: {
    fontSize: 13,
    color: colors.text.primary,
    fontWeight: '700',
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#CBD5E1',
    paddingTop: 8,
    marginTop: 4,
  },
  grandTotalKey: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.navy.main,
  },
  grandTotalVal: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.primary.main,
  },
  actionSection: {
    marginTop: 16,
  },
  mainActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  mainActionBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  metaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metaOrderId: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text.primary,
  },
  metaDate: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 2,
  },
  editModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  editModeBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },
  doneHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  doneHeaderBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
  missingPriceAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  missingPriceAlertText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
    flex: 1,
  },
  itemTitleText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.primary,
  },
  missingBadge: {
    backgroundColor: '#FEF3C7',
    alignSelf: 'flex-start',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  missingBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B45309',
  },
  editPriceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  editPriceBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },
  pricingTipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pricingTipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    flex: 1,
  },
  inTableRateInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  inTableRupeeSymbol: {
    fontSize: 13,
    fontWeight: '900',
    color: '#92400E',
    marginRight: 2,
  },
  inTableRateInput: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
    width: 58,
    textAlign: 'right',
    padding: 0,
  },
  directSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  directSaveBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
});
