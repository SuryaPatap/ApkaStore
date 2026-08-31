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
      purchase_price: '0',
      selling_price: '0',
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
        purchase_price: '0',
        selling_price: '0',
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
        `Successfully processed Invoice #${res.invoice_number}! All items and stock quantities are now live in your store catalog.`
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
          purchase_price: '0',
          selling_price: '0',
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
                <Ionicons name="receipt" size={22} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.modalTitle}>Add Items via Supplier Invoice</Text>
                <Text style={styles.modalSub}>Bulk import new products & restock inventory from distributor bills</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* 1. Supplier / Bill Header */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeading}>1. Supplier & Invoice Details</Text>
              <View style={styles.rowFields}>
                <View style={{ flex: 1.5, marginRight: 10 }}>
                  <Text style={styles.fieldLabel}>Supplier / Distributor Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Metro Cash & Carry / Local Wholesaler"
                    placeholderTextColor={colors.text.muted}
                    value={supplierName}
                    onChangeText={setSupplierName}
                  />
                </View>

                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.fieldLabel}>Invoice / Bill No. *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. INV-9842"
                    placeholderTextColor={colors.text.muted}
                    value={invoiceNumber}
                    onChangeText={setInvoiceNumber}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Supplier Phone (Optional)</Text>
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

            {/* 2. Items Table in Invoice */}
            <View style={styles.sectionCard}>
              <View style={styles.itemsHeader}>
                <Text style={styles.sectionHeading}>2. Products in Invoice ({items.length} items)</Text>
                <TouchableOpacity style={styles.addRowBtn} onPress={handleAddItemRow}>
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                  <Text style={styles.addRowBtnText}>+ Add Another Row</Text>
                </TouchableOpacity>
              </View>

              {items.map((item, idx) => {
                const qtyVal = parseFloat(item.quantity) || 0;
                const costVal = parseFloat(item.purchase_price) || 0;
                const rowTotal = qtyVal * costVal;

                return (
                  <View key={idx} style={styles.itemRowCard}>
                    <View style={styles.itemRowTop}>
                      <Text style={styles.itemIndex}>#{idx + 1}</Text>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.miniLabel}>Product Name *</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="e.g. Aashirvaad Shudh Chakki Atta 10kg"
                          placeholderTextColor={colors.text.muted}
                          value={item.product_name}
                          onChangeText={(v) => handleUpdateItem(idx, 'product_name', v)}
                        />
                      </View>

                      {/* Quick match from existing catalog chip selector */}
                      {existingProducts.length > 0 && !item.product_id && (
                        <View style={{ width: 140 }}>
                          <Text style={styles.miniLabel}>Match Catalog</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.matchPills}>
                            {existingProducts.slice(0, 4).map((p) => (
                              <TouchableOpacity
                                key={p.id}
                                style={styles.matchPill}
                                onPress={() => handleSelectExistingProduct(idx, p)}
                              >
                                <Text style={styles.matchPillText} numberOfLines={1}>
                                  {p.name}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}

                      <TouchableOpacity style={styles.deleteRowBtn} onPress={() => handleRemoveItemRow(idx)}>
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.itemRowBottom}>
                      <View style={{ flex: 1.2, marginRight: 6 }}>
                        <Text style={styles.miniLabel}>Category</Text>
                        <TextInput
                          style={styles.miniInput}
                          placeholder="Groceries"
                          placeholderTextColor={colors.text.muted}
                          value={item.category}
                          onChangeText={(v) => handleUpdateItem(idx, 'category', v)}
                        />
                      </View>

                      <View style={{ flex: 1, marginRight: 6 }}>
                        <Text style={styles.miniLabel}>Unit / Pack</Text>
                        <TextInput
                          style={styles.miniInput}
                          placeholder="1 kg / 1 pc"
                          placeholderTextColor={colors.text.muted}
                          value={item.unit}
                          onChangeText={(v) => handleUpdateItem(idx, 'unit', v)}
                        />
                      </View>

                      <View style={{ flex: 0.9, marginRight: 6 }}>
                        <Text style={styles.miniLabel}>Qty Added</Text>
                        <TextInput
                          style={[styles.miniInput, { fontWeight: '700', color: colors.primary.main }]}
                          placeholder="10"
                          placeholderTextColor={colors.text.muted}
                          keyboardType="numeric"
                          value={item.quantity}
                          onChangeText={(v) => handleUpdateItem(idx, 'quantity', v)}
                        />
                      </View>

                      <View style={{ flex: 1, marginRight: 6 }}>
                        <Text style={styles.miniLabel}>Cost Price (₹)</Text>
                        <TextInput
                          style={styles.miniInput}
                          placeholder="0"
                          placeholderTextColor={colors.text.muted}
                          keyboardType="numeric"
                          value={item.purchase_price}
                          onChangeText={(v) => handleUpdateItem(idx, 'purchase_price', v)}
                        />
                      </View>

                      <View style={{ flex: 1, marginRight: 6 }}>
                        <Text style={styles.miniLabel}>Selling MRP (₹)</Text>
                        <TextInput
                          style={[styles.miniInput, { fontWeight: '700' }]}
                          placeholder="0"
                          placeholderTextColor={colors.text.muted}
                          keyboardType="numeric"
                          value={item.selling_price}
                          onChangeText={(v) => handleUpdateItem(idx, 'selling_price', v)}
                        />
                      </View>

                      <View style={{ flex: 1.1, alignItems: 'flex-end', justifyContent: 'center' }}>
                        <Text style={styles.miniLabel}>Row Cost</Text>
                        <Text style={styles.rowCostVal}>₹{rowTotal.toFixed(2)}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}

              <TouchableOpacity style={styles.bottomAddBtn} onPress={handleAddItemRow}>
                <Ionicons name="add-circle" size={18} color={colors.primary.main} />
                <Text style={styles.bottomAddBtnText}>Add Another Product from Bill</Text>
              </TouchableOpacity>
            </View>

            {/* Total Cost Summary */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryLeft}>
                <Text style={styles.summaryLabel}>Total Purchase Value:</Text>
                <Text style={styles.summarySub}>Total cost of products received from supplier</Text>
              </View>
              <Text style={styles.summaryTotalVal}>₹{totalCost.toFixed(2)}</Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={18} color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>
                    📦 Add & Restock Inventory ({items.length} items)
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 820,
    maxHeight: '94%',
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
  rowFields: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 4,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    color: colors.text.primary,
    backgroundColor: '#FFFFFF',
  },
  itemsHeader: {
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
    marginLeft: 4,
  },
  itemRowCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#F9FAFB',
  },
  itemRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemIndex: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.muted,
    marginRight: 8,
  },
  miniLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 2,
  },
  matchPills: {
    flexDirection: 'row',
  },
  matchPill: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#E0E7FF',
    marginRight: 4,
  },
  matchPillText: {
    fontSize: 10,
    color: colors.primary.main,
    fontWeight: '600',
  },
  deleteRowBtn: {
    padding: 6,
    marginLeft: 4,
  },
  itemRowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniInput: {
    height: 36,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 12,
    backgroundColor: '#FFFFFF',
    color: colors.text.primary,
  },
  rowCostVal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  bottomAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary.main,
    marginTop: 4,
    backgroundColor: '#EEF2FF',
  },
  bottomAddBtnText: {
    color: colors.primary.main,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  summaryLeft: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  summarySub: {
    fontSize: 11,
    color: colors.text.muted,
  },
  summaryTotalVal: {
    fontSize: 20,
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
