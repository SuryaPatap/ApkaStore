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
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { PurchaseInvoice } from '../types';
import { invoiceApi } from '../api/endpoints';

interface SupplierInvoiceHistoryModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SupplierInvoiceHistoryModal: React.FC<SupplierInvoiceHistoryModalProps> = ({
  visible,
  onClose,
}) => {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
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

  const filtered = invoices.filter((inv) =>
    inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    inv.supplier_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconWrap}>
                <Ionicons name="documents" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Supplier Purchase Invoices</Text>
                <Text style={styles.modalSub}>{invoices.length} distributor bills recorded</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View style={styles.searchSection}>
            <Ionicons name="search-outline" size={16} color={colors.text.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by invoice number or distributor..."
              placeholderTextColor={colors.text.muted}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {loading ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="large" color={colors.primary.main} />
              <Text style={styles.loaderText}>Loading supplier invoices...</Text>
            </View>
          ) : (
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {filtered.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Ionicons name="receipt-outline" size={44} color={colors.text.muted} />
                  <Text style={styles.emptyTitle}>No Supplier Invoices Found</Text>
                  <Text style={styles.emptySub}>
                    Use "+ Add via Supplier Invoice" in the inventory to add wholesale bills and restock items.
                  </Text>
                </View>
              ) : (
                filtered.map((inv) => {
                  const isExpanded = expandedId === inv.id;
                  const totalUnits = inv.items?.reduce((s, it) => s + (it.quantity || 0), 0) || 0;

                  return (
                    <View key={inv.id} style={styles.invoiceCard}>
                      <TouchableOpacity
                        style={styles.cardHeader}
                        onPress={() => setExpandedId(isExpanded ? null : inv.id)}
                        activeOpacity={0.75}
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
                            <Text style={styles.supplierPhone}>📞 +91 {inv.supplier_phone}</Text>
                          ) : null}
                        </View>

                        <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                          <Text style={styles.totalAmt}>₹{Number(inv.total_amount).toFixed(2)}</Text>
                          <View style={styles.itemBadge}>
                            <Text style={styles.itemBadgeText}>
                              {inv.items?.length || 0} items ({totalUnits} units) {isExpanded ? '▲' : '▼'}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>

                      {isExpanded && inv.items && (
                        <View style={styles.itemsTable}>
                          <View style={styles.tableHeader}>
                            <Text style={[styles.th, { flex: 2.5 }]}>Product</Text>
                            <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Qty Added</Text>
                            <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Cost</Text>
                            <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>MRP</Text>
                          </View>

                          {inv.items.map((it, i) => (
                            <View key={i} style={styles.tableRow}>
                              <View style={{ flex: 2.5 }}>
                                <Text style={styles.rowProdName}>{it.product_name}</Text>
                                <Text style={styles.rowProdCategory}>
                                  {it.category || 'General'} • {it.unit || '1 unit'}
                                </Text>
                              </View>
                              <Text style={[styles.rowQty, { flex: 1 }]}>+{it.quantity}</Text>
                              <Text style={[styles.rowCost, { flex: 1 }]}>₹{it.purchase_price}</Text>
                              <Text style={[styles.rowMrp, { flex: 1 }]}>₹{it.selling_price}</Text>
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
            <TouchableOpacity style={styles.closeFooterBtn} onPress={onClose} activeOpacity={0.8}>
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
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '92%',
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
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
    borderRadius: 10,
    height: 38,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text.primary,
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
    padding: 14,
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
    maxWidth: 300,
    marginTop: 4,
  },
  invoiceCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: '#F8FAFC',
  },
  invNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  invNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text.primary,
  },
  invDate: {
    fontSize: 11,
    color: colors.text.muted,
  },
  supplierName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary.main,
    marginTop: 2,
  },
  supplierPhone: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 1,
  },
  totalAmt: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text.primary,
  },
  itemBadge: {
    marginTop: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  itemBadgeText: {
    fontSize: 11,
    color: colors.primary.main,
    fontWeight: '700',
  },
  itemsTable: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    paddingVertical: 7,
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
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  rowProdName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.primary,
  },
  rowProdCategory: {
    fontSize: 10,
    color: colors.text.muted,
  },
  rowQty: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
    textAlign: 'center',
  },
  rowCost: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'right',
  },
  rowMrp: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'right',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  closeFooterBtn: {
    backgroundColor: colors.primary.main,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  closeFooterBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
