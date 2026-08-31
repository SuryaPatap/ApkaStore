import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { PurchaseInvoice } from '../types';
import { invoiceApi } from '../api/endpoints';

interface SupplierInvoiceHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  onRefreshNeeded?: () => void;
}

export const SupplierInvoiceHistoryModal: React.FC<SupplierInvoiceHistoryModalProps> = ({
  visible,
  onClose,
}) => {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await invoiceApi.getPurchaseInvoices();
      setInvoices(res || []);
    } catch (e) {
      console.log('Failed to load supplier invoices:', e);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchHistory();
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconWrap}>
                <Ionicons name="documents" size={20} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.modalTitle}>Supplier Purchase Invoices</Text>
                <Text style={styles.modalSub}>History of distributor bills and stock intake</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="large" color={colors.primary.main} />
              <Text style={styles.loaderText}>Loading supplier invoices...</Text>
            </View>
          ) : (
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {invoices.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Ionicons name="document-text-outline" size={40} color={colors.text.muted} />
                  <Text style={styles.emptyTitle}>No Supplier Invoices Recorded</Text>
                  <Text style={styles.emptySub}>
                    Use "Add via Supplier Invoice" in the inventory to bulk import and restock products.
                  </Text>
                </View>
              ) : (
                invoices.map((inv) => {
                  const isExpanded = expandedId === inv.id;
                  return (
                    <View key={inv.id} style={styles.invoiceCard}>
                      <TouchableOpacity
                        style={styles.cardHeader}
                        onPress={() => setExpandedId(isExpanded ? null : inv.id)}
                        activeOpacity={0.7}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={styles.invNumberRow}>
                            <Text style={styles.invNumber}>Bill #{inv.invoice_number}</Text>
                            <Text style={styles.invDate}>
                              {new Date(inv.created_at).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </Text>
                          </View>
                          <Text style={styles.supplierName}>🏢 {inv.supplier_name}</Text>
                          {inv.supplier_phone ? (
                            <Text style={styles.supplierPhone}>📞 {inv.supplier_phone}</Text>
                          ) : null}
                        </View>

                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.totalAmt}>₹{Number(inv.total_amount).toFixed(2)}</Text>
                          <Text style={styles.itemCount}>
                            {inv.items?.length || 0} items {isExpanded ? '▲' : '▼'}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {isExpanded && inv.items && (
                        <View style={styles.itemsTable}>
                          <View style={styles.tableHeader}>
                            <Text style={[styles.th, { flex: 3 }]}>Product</Text>
                            <Text style={[styles.th, { flex: 1.2, textAlign: 'center' }]}>Qty Added</Text>
                            <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>Cost (₹)</Text>
                            <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>MRP (₹)</Text>
                          </View>

                          {inv.items.map((it, i) => (
                            <View key={i} style={styles.tableRow}>
                              <View style={{ flex: 3 }}>
                                <Text style={styles.rowProdName}>{it.product_name}</Text>
                                <Text style={styles.rowProdCategory}>
                                  {it.category} • {it.unit}
                                </Text>
                              </View>
                              <Text style={[styles.rowQty, { flex: 1.2 }]}>+{it.quantity}</Text>
                              <Text style={[styles.rowCost, { flex: 1.5 }]}>₹{it.purchase_price}</Text>
                              <Text style={[styles.rowMrp, { flex: 1.5 }]}>₹{it.selling_price}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.closeFooterBtn} onPress={onClose}>
              <Text style={styles.closeFooterBtnText}>Close</Text>
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
    maxHeight: '90%',
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  modalSub: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  loaderWrap: {
    padding: 40,
    alignItems: 'center',
  },
  loaderText: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 8,
  },
  modalBody: {
    flex: 1,
    padding: 16,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: colors.text.muted,
    textAlign: 'center',
    maxWidth: 320,
    marginTop: 4,
  },
  invoiceCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: '#F9FAFB',
  },
  invNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  invNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  invDate: {
    fontSize: 11,
    color: colors.text.muted,
  },
  supplierName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary.main,
    marginTop: 2,
  },
  supplierPhone: {
    fontSize: 11,
    color: colors.text.secondary,
  },
  totalAmt: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text.primary,
  },
  itemCount: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 2,
  },
  itemsTable: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  th: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  rowProdName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.primary,
  },
  rowProdCategory: {
    fontSize: 10,
    color: colors.text.muted,
  },
  rowQty: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success?.dark || '#166534',
    textAlign: 'center',
  },
  rowCost: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'right',
  },
  rowMrp: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'right',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  closeFooterBtn: {
    backgroundColor: colors.primary.main,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  closeFooterBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
