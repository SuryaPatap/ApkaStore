import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { Product, Invoice, Shop, ShopkeeperCustomerCredit } from '../types';
import { invoiceApi, creditApi } from '../api/endpoints';

interface CreateInvoiceModalProps {
  visible: boolean;
  onClose: () => void;
  onInvoiceCreated: (invoice: Invoice) => void;
  products: Product[];
  shop: Shop | null;
}

interface SelectedItem {
  product_id?: number | null;
  product_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  available_stock?: number;
}

export const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({
  visible,
  onClose,
  onInvoiceCreated,
  products,
  shop,
}) => {
  // Customer Info
  const [customerType, setCustomerType] = useState<'WALKIN' | 'REGISTERED'>('WALKIN');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [registeredCustomers, setRegisteredCustomers] = useState<ShopkeeperCustomerCredit[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);

  // Items
  const [items, setItems] = useState<SelectedItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [customItemUnit, setCustomItemUnit] = useState('1 unit');

  // Billing
  const [discountAmount, setDiscountAmount] = useState('0');
  const [taxPercent, setTaxPercent] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'UDHAR_KHATA'>('CASH');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load shop customers for Khata / registered list
  useEffect(() => {
    if (visible && shop?.id) {
      creditApi.getShopkeeperAccounts()
        .then((res: any) => setRegisteredCustomers(res || []))
        .catch(() => setRegisteredCustomers([]));
    }
  }, [visible, shop]);

  const handleAddProduct = (prod: Product) => {
    const existingIndex = items.findIndex((i) => i.product_id === prod.id);
    const priceNum = typeof prod.price === 'string' ? parseFloat(prod.price) : prod.price;

    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex].quantity += 1;
      updated[existingIndex].total_price = updated[existingIndex].quantity * updated[existingIndex].unit_price;
      setItems(updated);
    } else {
      setItems((prev) => [
        ...prev,
        {
          product_id: prod.id,
          product_name: prod.name,
          unit: prod.unit || '1 unit',
          quantity: 1,
          unit_price: priceNum,
          total_price: priceNum,
          available_stock: prod.stock_quantity,
        },
      ]);
    }
  };

  const handleAddCustomItem = () => {
    if (!customItemName.trim() || !customItemPrice.trim()) {
      Alert.alert('Required', 'Please enter item name and price.');
      return;
    }
    const priceNum = parseFloat(customItemPrice) || 0;
    setItems((prev) => [
      ...prev,
      {
        product_id: null,
        product_name: customItemName.trim(),
        unit: customItemUnit.trim() || '1 unit',
        quantity: 1,
        unit_price: priceNum,
        total_price: priceNum,
      },
    ]);
    setCustomItemName('');
    setCustomItemPrice('');
  };

  const handleUpdateQty = (index: number, delta: number) => {
    const updated = [...items];
    const newQty = updated[index].quantity + delta;
    if (newQty <= 0) {
      updated.splice(index, 1);
    } else {
      updated[index].quantity = newQty;
      updated[index].total_price = newQty * updated[index].unit_price;
    }
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
  const discount = Math.min(subtotal, Math.max(0, parseFloat(discountAmount) || 0));
  const taxPct = Math.max(0, parseFloat(taxPercent) || 0);
  const taxAmount = ((subtotal - discount) * taxPct) / 100;
  const grandTotal = Math.max(0, subtotal - discount + taxAmount);

  const handleSubmitInvoice = async () => {
    if (items.length === 0) {
      Alert.alert('Empty Bill', 'Please add at least one product to the invoice.');
      return;
    }

    if (paymentMethod === 'UDHAR_KHATA' && !selectedCustomerId && !customerName.trim()) {
      Alert.alert('Customer Required', 'Please enter customer name or select a customer for Udhar Khata billing.');
      return;
    }

    setIsSubmitting(true);
    try {
      const invPayload = {
        customer_id: customerType === 'REGISTERED' ? selectedCustomerId : null,
        customer_name:
          customerType === 'REGISTERED'
            ? registeredCustomers.find((c) => c.customer_id === selectedCustomerId)?.customer_name || customerName || 'Valued Customer'
            : customerName.trim() || 'Walk-in Customer',
        customer_phone: customerPhone.trim() || undefined,
        items: items.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          unit: i.unit,
          quantity: i.quantity,
          unit_price: i.unit_price,
          total_price: i.total_price,
        })),
        subtotal_amount: subtotal,
        discount_amount: discount,
        tax_amount: taxAmount,
        total_amount: grandTotal,
        payment_method: paymentMethod,
        payment_status: paymentMethod === 'UDHAR_KHATA' ? 'PENDING' : 'PAID',
        notes: notes.trim() || undefined,
      };

      const createdInvoice = await invoiceApi.createInvoice(invPayload);
      Alert.alert('Invoice Generated 🧾', `Invoice #${createdInvoice.invoice_number} created successfully!`);
      onInvoiceCreated(createdInvoice);
      // Reset form
      setItems([]);
      setCustomerName('');
      setCustomerPhone('');
      setDiscountAmount('0');
      setTaxPercent('0');
      setNotes('');
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create invoice.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.category.toLowerCase().includes(productSearch.toLowerCase())
  );

  const storeDisplayName = shop?.shop_name || 'ApkaStore';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconWrap}>
                <Ionicons name="receipt" size={22} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.modalTitle}>Create New Invoice / Counter Bill</Text>
                <Text style={styles.modalSub}>{storeDisplayName} • Point of Sale</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* 1. Customer Section */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeading}>1. Customer Details</Text>
              <View style={styles.customerTypeRow}>
                <TouchableOpacity
                  style={[styles.typeBtn, customerType === 'WALKIN' && styles.typeBtnActive]}
                  onPress={() => setCustomerType('WALKIN')}
                >
                  <Ionicons
                    name="person-outline"
                    size={16}
                    color={customerType === 'WALKIN' ? colors.primary.main : colors.text.muted}
                  />
                  <Text style={[styles.typeBtnText, customerType === 'WALKIN' && styles.typeBtnTextActive]}>
                    Walk-in Customer
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.typeBtn, customerType === 'REGISTERED' && styles.typeBtnActive]}
                  onPress={() => setCustomerType('REGISTERED')}
                >
                  <Ionicons
                    name="people-outline"
                    size={16}
                    color={customerType === 'REGISTERED' ? colors.primary.main : colors.text.muted}
                  />
                  <Text style={[styles.typeBtnText, customerType === 'REGISTERED' && styles.typeBtnTextActive]}>
                    Store Customer / Khata
                  </Text>
                </TouchableOpacity>
              </View>

              {customerType === 'WALKIN' ? (
                <View style={styles.rowFields}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginRight: 8 }]}
                    placeholder="Customer Name (Optional)"
                    placeholderTextColor={colors.text.muted}
                    value={customerName}
                    onChangeText={setCustomerName}
                  />
                  <TextInput
                    style={[styles.input, { width: 140 }]}
                    placeholder="Phone (WhatsApp)"
                    placeholderTextColor={colors.text.muted}
                    keyboardType="phone-pad"
                    value={customerPhone}
                    onChangeText={setCustomerPhone}
                  />
                </View>
              ) : (
                <View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.customerPills}>
                    {registeredCustomers.map((cust) => {
                      const cid = cust.customer_id;
                      const isSelected = selectedCustomerId === cid;
                      return (
                        <TouchableOpacity
                          key={cid}
                          style={[styles.custPill, isSelected && styles.custPillSelected]}
                          onPress={() => {
                            setSelectedCustomerId(cid);
                            setCustomerName(cust.customer_name);
                            setCustomerPhone(cust.customer_phone || '');
                          }}
                        >
                          <Text style={[styles.custPillText, isSelected && styles.custPillTextSelected]}>
                            {cust.customer_name || `Customer #${cid}`}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* 2. Add Items from Store Inventory */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeading}>2. Select Items from Inventory</Text>
              <View style={styles.searchWrap}>
                <Ionicons name="search" size={16} color={colors.text.muted} />
                <TextInput
                  style={styles.inventorySearchInput}
                  placeholder="Search products by name or category..."
                  placeholderTextColor={colors.text.muted}
                  value={productSearch}
                  onChangeText={setProductSearch}
                />
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.productChipsScroll}>
                {filteredProducts.slice(0, 12).map((prod) => (
                  <TouchableOpacity
                    key={prod.id}
                    style={styles.productChip}
                    onPress={() => handleAddProduct(prod)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.chipName} numberOfLines={1}>
                        {prod.name}
                      </Text>
                      <Text style={styles.chipPrice}>
                        ₹{prod.price} <Text style={styles.chipUnit}>/ {prod.unit}</Text>
                      </Text>
                    </View>
                    <View style={styles.chipAddIcon}>
                      <Ionicons name="add" size={16} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Quick Add Custom Line Item */}
              <View style={styles.customItemRow}>
                <TextInput
                  style={[styles.input, { flex: 2, marginRight: 6 }]}
                  placeholder="Custom Item Name"
                  placeholderTextColor={colors.text.muted}
                  value={customItemName}
                  onChangeText={setCustomItemName}
                />
                <TextInput
                  style={[styles.input, { flex: 1, marginRight: 6 }]}
                  placeholder="₹ Price"
                  placeholderTextColor={colors.text.muted}
                  keyboardType="numeric"
                  value={customItemPrice}
                  onChangeText={setCustomItemPrice}
                />
                <TouchableOpacity style={styles.addCustomBtn} onPress={handleAddCustomItem}>
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                  <Text style={styles.addCustomBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 3. Current Bill Line Items */}
            <View style={styles.sectionCard}>
              <View style={styles.itemsHeader}>
                <Text style={styles.sectionHeading}>3. Bill Items ({items.length})</Text>
                {items.length > 0 && (
                  <TouchableOpacity onPress={() => setItems([])}>
                    <Text style={styles.clearAllText}>Clear All</Text>
                  </TouchableOpacity>
                )}
              </View>

              {items.length === 0 ? (
                <View style={styles.emptyItemsBox}>
                  <Ionicons name="cart-outline" size={32} color={colors.text.muted} />
                  <Text style={styles.emptyItemsText}>No items added to invoice yet</Text>
                  <Text style={styles.emptyItemsSub}>Click any product above to add to bill</Text>
                </View>
              ) : (
                <View style={styles.table}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.th, { flex: 3 }]}>Item</Text>
                    <Text style={[styles.th, { flex: 1.5, textAlign: 'center' }]}>Qty</Text>
                    <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>Rate</Text>
                    <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>Total</Text>
                    <View style={{ width: 28 }} />
                  </View>

                  {items.map((item, idx) => (
                    <View key={idx} style={styles.tableRow}>
                      <View style={{ flex: 3 }}>
                        <Text style={styles.itemTitle}>{item.product_name}</Text>
                        <Text style={styles.itemUnit}>{item.unit}</Text>
                      </View>

                      <View style={styles.qtyCtrl}>
                        <TouchableOpacity onPress={() => handleUpdateQty(idx, -1)} style={styles.qtyBtn}>
                          <Ionicons name="remove" size={14} color={colors.text.primary} />
                        </TouchableOpacity>
                        <Text style={styles.qtyText}>{item.quantity}</Text>
                        <TouchableOpacity onPress={() => handleUpdateQty(idx, 1)} style={styles.qtyBtn}>
                          <Ionicons name="add" size={14} color={colors.text.primary} />
                        </TouchableOpacity>
                      </View>

                      <Text style={[styles.rateText, { flex: 1.5 }]}>₹{item.unit_price}</Text>
                      <Text style={[styles.totalText, { flex: 1.5 }]}>₹{item.total_price.toFixed(2)}</Text>

                      <TouchableOpacity onPress={() => handleRemoveItem(idx)} style={styles.trashBtn}>
                        <Ionicons name="trash-outline" size={16} color={colors.danger?.dark || '#EF4444'} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* 4. Payment & Discount Summary */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeading}>4. Payment & Summary</Text>

              {/* Payment Mode Selector */}
              <View style={styles.paymentModesRow}>
                <TouchableOpacity
                  style={[styles.payModeBtn, paymentMethod === 'CASH' && styles.payModeBtnActive]}
                  onPress={() => setPaymentMethod('CASH')}
                >
                  <Ionicons name="cash-outline" size={20} color={paymentMethod === 'CASH' ? '#10B981' : colors.text.muted} />
                  <Text style={[styles.payModeText, paymentMethod === 'CASH' && styles.payModeTextActive]}>
                    💵 Cash (Paid)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.payModeBtn, paymentMethod === 'UPI' && styles.payModeBtnActive]}
                  onPress={() => setPaymentMethod('UPI')}
                >
                  <Ionicons name="qr-code-outline" size={20} color={paymentMethod === 'UPI' ? colors.primary.main : colors.text.muted} />
                  <Text style={[styles.payModeText, paymentMethod === 'UPI' && styles.payModeTextActive]}>
                    📲 Store UPI
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.payModeBtn, paymentMethod === 'UDHAR_KHATA' && styles.payModeBtnActive]}
                  onPress={() => setPaymentMethod('UDHAR_KHATA')}
                >
                  <Ionicons name="book-outline" size={20} color={paymentMethod === 'UDHAR_KHATA' ? '#F59E0B' : colors.text.muted} />
                  <Text style={[styles.payModeText, paymentMethod === 'UDHAR_KHATA' && styles.payModeTextActive]}>
                    📒 Udhar Khata
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Store UPI QR preview if UPI selected */}
              {paymentMethod === 'UPI' && shop?.upi_id && (
                <View style={styles.upiCard}>
                  <Text style={styles.upiTitle}>Scan to Pay: {shop.upi_id}</Text>
                  <Image
                    source={{
                      uri: `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=${shop.upi_id}%26pn=${encodeURIComponent(storeDisplayName)}%26am=${grandTotal.toFixed(2)}%26cu=INR`,
                    }}
                    style={styles.upiQrImage}
                  />
                  <Text style={styles.upiSubtitle}>Amount to scan: ₹{grandTotal.toFixed(2)}</Text>
                </View>
              )}

              {/* Discount & Tax inputs */}
              <View style={styles.summaryInputsRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>Discount (₹)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor={colors.text.muted}
                    keyboardType="numeric"
                    value={discountAmount}
                    onChangeText={setDiscountAmount}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>GST / Tax (%)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor={colors.text.muted}
                    keyboardType="numeric"
                    value={taxPercent}
                    onChangeText={setTaxPercent}
                  />
                </View>
              </View>

              {/* Grand Total Breakdown */}
              <View style={styles.breakdownBox}>
                <View style={styles.breakdownRow}>
                  <Text style={styles.bdLabel}>Subtotal</Text>
                  <Text style={styles.bdValue}>₹{subtotal.toFixed(2)}</Text>
                </View>
                {discount > 0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={[styles.bdLabel, { color: '#10B981' }]}>Discount Applied</Text>
                    <Text style={[styles.bdValue, { color: '#10B981' }]}>-₹{discount.toFixed(2)}</Text>
                  </View>
                )}
                {taxAmount > 0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.bdLabel}>GST / Tax ({taxPct}%)</Text>
                    <Text style={styles.bdValue}>+₹{taxAmount.toFixed(2)}</Text>
                  </View>
                )}
                <View style={styles.divider} />
                <View style={styles.breakdownRow}>
                  <Text style={styles.grandTotalLabel}>Grand Total</Text>
                  <Text style={styles.grandTotalValue}>₹{grandTotal.toFixed(2)}</Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Footer Submit Button */}
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, items.length === 0 && styles.submitBtnDisabled]}
              onPress={handleSubmitInvoice}
              disabled={items.length === 0 || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-done-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>Generate Invoice • ₹{grandTotal.toFixed(2)}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    ...Platform.select({
      web: { boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  modalSub: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  modalBody: {
    flex: 1,
    padding: 16,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 12,
  },
  customerTypeRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#F9FAFB',
  },
  typeBtnActive: {
    borderColor: colors.primary.main,
    backgroundColor: '#EEF2FF',
  },
  typeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    marginLeft: 6,
  },
  typeBtnTextActive: {
    color: colors.primary.main,
  },
  rowFields: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    height: 42,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.text.primary,
    backgroundColor: '#FFFFFF',
  },
  customerPills: {
    flexDirection: 'row',
    marginTop: 4,
  },
  custPill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
    backgroundColor: '#F9FAFB',
  },
  custPillSelected: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  custPillText: {
    fontSize: 13,
    color: colors.text.primary,
    fontWeight: '500',
  },
  custPillTextSelected: {
    color: '#FFFFFF',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    marginBottom: 12,
  },
  inventorySearchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: colors.text.primary,
  },
  productChipsScroll: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  productChip: {
    width: 140,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 10,
    marginRight: 8,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chipName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  chipPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary.main,
    marginTop: 2,
  },
  chipUnit: {
    fontSize: 10,
    color: colors.text.secondary,
    fontWeight: 'normal',
  },
  chipAddIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  addCustomBtn: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  addCustomBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clearAllText: {
    fontSize: 12,
    color: colors.danger?.dark || '#EF4444',
    fontWeight: '600',
  },
  emptyItemsBox: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyItemsText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: 8,
  },
  emptyItemsSub: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  table: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  th: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  itemUnit: {
    fontSize: 11,
    color: colors.text.muted,
  },
  qtyCtrl: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtn: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    fontSize: 13,
    fontWeight: '600',
    marginHorizontal: 8,
    color: colors.text.primary,
  },
  rateText: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'right',
  },
  totalText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'right',
  },
  trashBtn: {
    paddingLeft: 10,
  },
  paymentModesRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  payModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#F9FAFB',
  },
  payModeBtnActive: {
    borderColor: colors.primary.main,
    backgroundColor: '#EEF2FF',
  },
  payModeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    marginLeft: 6,
  },
  payModeTextActive: {
    color: colors.primary.main,
  },
  upiCard: {
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    marginBottom: 14,
  },
  upiTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 8,
  },
  upiQrImage: {
    width: 140,
    height: 140,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  upiSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803D',
    marginTop: 8,
  },
  summaryInputsRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: 4,
    fontWeight: '500',
  },
  breakdownBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  bdLabel: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  bdValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text.primary,
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary.main,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.main,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  submitBtnDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 6,
  },
});
