import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { Product, PurchaseInvoice } from '../types';
import { invoiceApi } from '../api/endpoints';

interface AddFromInvoiceModalProps {
  visible: boolean;
  onClose: () => void;
  onInvoiceSaved: (invoice: PurchaseInvoice) => void;
  existingProducts: Product[];
}

interface InvoiceItemDraft {
  product_id?: number | null;
  product_name: string;
  category: string;
  unit: string;
  quantity: string;
  purchase_price: string;
  selling_price: string;
}

const COMMON_CATEGORIES = ['Groceries', 'Dairy', 'Snacks', 'Edible Oil', 'Flour & Grains', 'Spices', 'Beverages', 'Personal Care'];
const COMMON_UNITS = ['1 kg', '500 g', '1 Litre', '500 ml', '1 pc', '1 pack', '1 box'];

export const AddFromInvoiceModal: React.FC<AddFromInvoiceModalProps> = ({
  visible,
  onClose,
  onInvoiceSaved,
  existingProducts,
}) => {
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [items, setItems] = useState<InvoiceItemDraft[]>([
    {
      product_id: null,
      product_name: '',
      category: 'Groceries',
      unit: '1 kg',
      quantity: '10',
      purchase_price: '',
      selling_price: '',
    },
  ]);

  const handleAddItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        product_id: null,
        product_name: '',
        category: 'Groceries',
        unit: '1 kg',
        quantity: '10',
        purchase_price: '',
        selling_price: '',
      },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (items.length <= 1) {
      Alert.alert('Notice', 'Invoice must have at least one product row.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: keyof InvoiceItemDraft, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const handleSelectExistingProduct = (index: number, prod: Product) => {
    const updated = [...items];
    const priceVal = typeof prod.price === 'string' ? prod.price : String(prod.price);
    updated[index] = {
      ...updated[index],
      product_id: prod.id,
      product_name: prod.name,
      category: prod.category || 'Groceries',
      unit: prod.unit || '1 kg',
      selling_price: priceVal,
    };
    setItems(updated);
  };

  // Calculate invoice total cost
  const totalCost = items.reduce((sum, it) => {
    const qty = parseFloat(it.quantity) || 0;
    const cost = parseFloat(it.purchase_price) || 0;
    return sum + qty * cost;
  }, 0);

  const totalUnits = items.reduce((sum, it) => sum + (parseInt(it.quantity, 10) || 0), 0);

  const handleSubmit = async () => {
    if (!supplierName.trim()) {
      Alert.alert('Required', 'Please enter Distributor / Supplier Name.');
      return;
    }
    if (!invoiceNumber.trim()) {
      Alert.alert('Required', 'Please enter Supplier Invoice / Bill Number.');
      return;
    }

    const validItems = items.filter((it) => it.product_name.trim().length > 0);
    if (validItems.length === 0) {
      Alert.alert('Required', 'Please enter product name for at least one item.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        supplier_name: supplierName.trim(),
        supplier_phone: supplierPhone.trim() || undefined,
        invoice_number: invoiceNumber.trim(),
        notes: notes.trim() || undefined,
        total_amount: totalCost,
        items: validItems.map((it) => {
          const qty = parseInt(it.quantity, 10) || 1;
          const pCost = parseFloat(it.purchase_price) || 0;
          const sPrice = parseFloat(it.selling_price) || 0;
          return {
            product_id: it.product_id || null,
            product_name: it.product_name.trim(),
            category: it.category.trim() || 'Groceries',
            unit: it.unit.trim() || '1 unit',
            quantity: qty,
            purchase_price: pCost,
            selling_price: sPrice,
            total_cost: qty * pCost,
          };
        }),
      };

      const res = await invoiceApi.createPurchaseInvoice(payload);
      Alert.alert(
        'Inventory Restocked 🎉',
        `Successfully processed Invoice #${res.invoice_number}! ${validItems.length} products & ${totalUnits} units added to your inventory.`
      );
      onInvoiceSaved(res);
      // Reset
      setSupplierName('');
      setSupplierPhone('');
      setInvoiceNumber('');
      setNotes('');
      setItems([
        {
          product_id: null,
          product_name: '',
          category: 'Groceries',
          unit: '1 kg',
          quantity: '10',
          purchase_price: '',
          selling_price: '',
        },
      ]);
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to import invoice into inventory.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconWrap}>
                <Ionicons name="receipt" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Inward Supplier Invoice</Text>
                <Text style={styles.modalSub}>Add & restock inventory from distributor bills</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* 1. Supplier & Invoice Header Card */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="business-outline" size={16} color={colors.primary.main} />
                <Text style={styles.sectionHeading}>1. Supplier & Bill Details</Text>
              </View>

              <View style={styles.inputBlock}>
                <Text style={styles.fieldLabel}>Distributor / Supplier Name <Text style={styles.reqStar}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Metro Cash & Carry / Local Wholesaler"
                  placeholderTextColor={colors.text.muted}
                  value={supplierName}
                  onChangeText={setSupplierName}
                />
              </View>

              <View style={styles.gridRow}>
                <View style={[styles.inputBlock, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.fieldLabel}>Invoice / Bill No. <Text style={styles.reqStar}>*</Text></Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. INV-9842"
                    placeholderTextColor={colors.text.muted}
                    value={invoiceNumber}
                    onChangeText={setInvoiceNumber}
                  />
                </View>

                <View style={[styles.inputBlock, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Supplier Phone</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 9876543210"
                    placeholderTextColor={colors.text.muted}
                    keyboardType="phone-pad"
                    value={supplierPhone}
                    onChangeText={setSupplierPhone}
                  />
                </View>
              </View>
            </View>

            {/* 2. Items List */}
            <View style={styles.sectionCard}>
              <View style={styles.itemsHeaderRow}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="cube-outline" size={16} color={colors.primary.main} />
                  <Text style={styles.sectionHeading}>2. Products on Invoice ({items.length})</Text>
                </View>

                <TouchableOpacity style={styles.addRowBtn} onPress={handleAddItemRow} activeOpacity={0.8}>
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                  <Text style={styles.addRowBtnText}>+ Add Item</Text>
                </TouchableOpacity>
              </View>

              {items.map((item, idx) => {
                const qtyVal = parseFloat(item.quantity) || 0;
                const costVal = parseFloat(item.purchase_price) || 0;
                const rowTotal = qtyVal * costVal;
                const isExisting = Boolean(item.product_id);

                return (
                  <View key={idx} style={styles.itemCard}>
                    {/* Item Card Header */}
                    <View style={styles.itemCardHeader}>
                      <View style={styles.itemBadgeWrap}>
                        <Text style={styles.itemBadgeText}>Item #{idx + 1}</Text>
                        {isExisting && (
                          <View style={styles.existingTag}>
                            <Text style={styles.existingTagText}>In Catalog</Text>
                          </View>
                        )}
                      </View>

                      <TouchableOpacity
                        style={styles.trashBtn}
                        onPress={() => handleRemoveItemRow(idx)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>

                    {/* Product Name Input */}
                    <View style={styles.inputBlock}>
                      <Text style={styles.miniLabel}>Product Name <Text style={styles.reqStar}>*</Text></Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Aashirvaad Shudh Chakki Atta 10kg"
                        placeholderTextColor={colors.text.muted}
                        value={item.product_name}
                        onChangeText={(v) => handleUpdateItem(idx, 'product_name', v)}
                      />
                    </View>

                    {/* Fast Auto-Match Pills from existing store catalog */}
                    {existingProducts.length > 0 && !item.product_id && (
                      <View style={styles.matchSection}>
                        <Text style={styles.matchHelpText}>Or choose existing product to restock:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.matchScroll}>
                          {existingProducts.slice(0, 6).map((p) => (
                            <TouchableOpacity
                              key={p.id}
                              style={styles.matchChip}
                              onPress={() => handleSelectExistingProduct(idx, p)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="checkmark-circle-outline" size={12} color={colors.primary.main} />
                              <Text style={styles.matchChipText} numberOfLines={1}>
                                {p.name}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}

                    {/* Category & Unit Grid */}
                    <View style={styles.gridRow}>
                      <View style={[styles.inputBlock, { flex: 1, marginRight: 8 }]}>
                        <Text style={styles.miniLabel}>Category</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Groceries"
                          placeholderTextColor={colors.text.muted}
                          value={item.category}
                          onChangeText={(v) => handleUpdateItem(idx, 'category', v)}
                        />
                      </View>

                      <View style={[styles.inputBlock, { flex: 1 }]}>
                        <Text style={styles.miniLabel}>Unit / Weight</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="1 kg / 1 Litre"
                          placeholderTextColor={colors.text.muted}
                          value={item.unit}
                          onChangeText={(v) => handleUpdateItem(idx, 'unit', v)}
                        />
                      </View>
                    </View>

                    {/* Numbers Row: Qty, Cost, Selling Price, Row Total */}
                    <View style={styles.pricingRow}>
                      <View style={[styles.inputBlock, { flex: 1, marginRight: 6 }]}>
                        <Text style={styles.miniLabel}>Qty Added</Text>
                        <TextInput
                          style={[styles.input, styles.qtyInput]}
                          placeholder="10"
                          placeholderTextColor={colors.text.muted}
                          keyboardType="numeric"
                          value={item.quantity}
                          onChangeText={(v) => handleUpdateItem(idx, 'quantity', v)}
                        />
                      </View>

                      <View style={[styles.inputBlock, { flex: 1, marginRight: 6 }]}>
                        <Text style={styles.miniLabel}>Cost (₹)</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Cost Price"
                          placeholderTextColor={colors.text.muted}
                          keyboardType="numeric"
                          value={item.purchase_price}
                          onChangeText={(v) => handleUpdateItem(idx, 'purchase_price', v)}
                        />
                      </View>

                      <View style={[styles.inputBlock, { flex: 1, marginRight: 6 }]}>
                        <Text style={styles.miniLabel}>MRP (₹)</Text>
                        <TextInput
                          style={[styles.input, { fontWeight: '700' }]}
                          placeholder="Selling Price"
                          placeholderTextColor={colors.text.muted}
                          keyboardType="numeric"
                          value={item.selling_price}
                          onChangeText={(v) => handleUpdateItem(idx, 'selling_price', v)}
                        />
                      </View>

                      <View style={styles.rowCostBlock}>
                        <Text style={styles.miniLabel}>Row Cost</Text>
                        <Text style={styles.rowCostText}>₹{rowTotal.toFixed(0)}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}

              <TouchableOpacity style={styles.addMoreBtn} onPress={handleAddItemRow} activeOpacity={0.8}>
                <Ionicons name="add-circle" size={18} color={colors.primary.main} />
                <Text style={styles.addMoreBtnText}>+ Add Another Product from Invoice</Text>
              </TouchableOpacity>
            </View>

            {/* Total Cost Card */}
            <View style={styles.totalCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.totalCardTitle}>Total Purchase Bill Amount</Text>
                <Text style={styles.totalCardSub}>{items.length} product lines • {totalUnits} total units</Text>
              </View>
              <Text style={styles.totalCardVal}>₹{totalCost.toFixed(2)}</Text>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>
                    Restock Inventory ({items.length} items)
                  </Text>
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
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 780,
    maxHeight: '94%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    ...Platform.select({
      web: { boxShadow: '0 20px 30px -5px rgba(0,0,0,0.25)' },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F8FAFC',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text.primary,
  },
  modalSub: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  modalBody: {
    flex: 1,
    padding: 14,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    marginLeft: 6,
  },
  inputBlock: {
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 5,
  },
  reqStar: {
    color: '#EF4444',
  },
  input: {
    height: 42,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: colors.text.primary,
    backgroundColor: '#FFFFFF',
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.main,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addRowBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 3,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#F8FAFC',
  },
  itemCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.primary,
  },
  existingTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  existingTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  trashBtn: {
    padding: 4,
  },
  miniLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 3,
  },
  matchSection: {
    marginBottom: 8,
  },
  matchHelpText: {
    fontSize: 10,
    color: colors.text.muted,
    marginBottom: 4,
  },
  matchScroll: {
    flexDirection: 'row',
  },
  matchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    gap: 4,
  },
  matchChipText: {
    fontSize: 11,
    color: colors.primary.main,
    fontWeight: '600',
  },
  pricingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyInput: {
    fontWeight: '700',
    color: colors.primary.main,
  },
  rowCostBlock: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 4,
  },
  rowCostText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text.primary,
  },
  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary.main,
    backgroundColor: '#EEF2FF',
    marginTop: 4,
  },
  addMoreBtnText: {
    color: colors.primary.main,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  totalCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  totalCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  totalCardSub: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
  },
  totalCardVal: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary.main,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 10,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.main,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 10,
    gap: 6,
  },
  submitBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
