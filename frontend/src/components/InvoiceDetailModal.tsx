import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { Invoice, Shop } from '../types';

interface InvoiceDetailModalProps {
  visible: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  shop: Shop | null;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  visible,
  onClose,
  invoice,
  shop,
}) => {
  if (!invoice) return null;

  const handlePrint = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.print();
    }
  };

  const storeDisplayName = shop?.shop_name || 'ApkaStore';
  const storePhone = shop?.shop_phone || '';

  const handleWhatsAppShare = () => {
    let text = `🧾 *TAX INVOICE - ${storeDisplayName}*\n`;
    text += `Invoice No: *#${invoice.invoice_number}*\n`;
    text += `Date: ${new Date(invoice.created_at).toLocaleDateString()}\n`;
    text += `Customer: ${invoice.customer_name}\n`;
    text += `--------------------------------\n`;
    invoice.items?.forEach((item, index) => {
      text += `${index + 1}. ${item.product_name} (${item.quantity} ${item.unit}) - ₹${item.total_price}\n`;
    });
    text += `--------------------------------\n`;
    text += `Subtotal: ₹${invoice.subtotal_amount}\n`;
    if (Number(invoice.discount_amount) > 0) {
      text += `Discount: -₹${invoice.discount_amount}\n`;
    }
    if (Number(invoice.tax_amount) > 0) {
      text += `GST/Tax: +₹${invoice.tax_amount}\n`;
    }
    text += `*Grand Total: ₹${invoice.total_amount}*\n`;
    text += `Payment: ${invoice.payment_method} (${invoice.payment_status})\n`;
    if (shop?.upi_id) {
      text += `UPI ID: ${shop.upi_id}\n`;
    }
    text += `\nThank you for shopping with ${storeDisplayName}! 🙏`;

    const encoded = encodeURIComponent(text);
    const phone = invoice.customer_phone ? invoice.customer_phone.replace(/[^0-9]/g, '') : '';
    const url = phone ? `https://wa.me/91${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    Linking.openURL(url).catch((err) => console.log('WhatsApp share failed:', err));
  };

  const getStoreAddressString = () => {
    if (!shop?.address) return 'Local Neighborhood Store';
    if (typeof shop.address === 'string') return shop.address;
    return `${shop.address.street || ''} ${shop.address.city || ''}`.trim() || 'Local Neighborhood Store';
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header Action Bar */}
          <View style={styles.headerBar}>
            <View style={styles.headerTitleWrap}>
              <Ionicons name="document-text" size={20} color={colors.primary.main} />
              <Text style={styles.headerTitle}>Invoice #{invoice.invoice_number}</Text>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.actionIconBtn} onPress={handlePrint}>
                <Ionicons name="print-outline" size={18} color={colors.text.primary} />
                <Text style={styles.actionBtnText}>Print</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionIconBtn, styles.waBtn]} onPress={handleWhatsAppShare}>
                <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Printable Invoice Body */}
          <ScrollView style={styles.billContent} showsVerticalScrollIndicator={false}>
            {/* Store Information */}
            <View style={styles.storeHeader}>
              <Text style={styles.storeName}>{storeDisplayName}</Text>
              <Text style={styles.storeSub}>
                {getStoreAddressString()}
                {storePhone ? ` • Tel: +91 ${storePhone}` : ''}
              </Text>
              {shop?.gst_number ? (
                <Text style={styles.gstText}>GSTIN: {shop.gst_number}</Text>
              ) : null}
              {shop?.upi_id ? (
                <Text style={styles.upiText}>Store UPI: {shop.upi_id}</Text>
              ) : null}
            </View>

            <View style={styles.dottedDivider} />

            {/* Bill Meta Row */}
            <View style={styles.metaRow}>
              <View>
                <Text style={styles.metaLabel}>Billed To:</Text>
                <Text style={styles.metaCustomerName}>{invoice.customer_name}</Text>
                {invoice.customer_phone ? (
                  <Text style={styles.metaPhone}>+91 {invoice.customer_phone}</Text>
                ) : null}
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.metaLabel}>Invoice Date:</Text>
                <Text style={styles.metaValue}>
                  {new Date(invoice.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    invoice.payment_status === 'PAID' ? styles.statusPaid : styles.statusPending,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      invoice.payment_status === 'PAID' ? styles.statusTextPaid : styles.statusTextPending,
                    ]}
                  >
                    {invoice.payment_method} • {invoice.payment_status}
                  </Text>
                </View>
              </View>
            </View>

            {/* Items Table */}
            <View style={styles.table}>
              <View style={styles.tableHead}>
                <Text style={[styles.th, { flex: 3 }]}>Item & Description</Text>
                <Text style={[styles.th, { flex: 1.2, textAlign: 'center' }]}>Qty</Text>
                <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>Rate</Text>
                <Text style={[styles.th, { flex: 1.8, textAlign: 'right' }]}>Total</Text>
              </View>

              {invoice.items?.map((item, i) => (
                <View key={i} style={styles.tableRow}>
                  <View style={{ flex: 3 }}>
                    <Text style={styles.rowItemName}>{item.product_name}</Text>
                    <Text style={styles.rowItemUnit}>{item.unit}</Text>
                  </View>
                  <Text style={[styles.rowQty, { flex: 1.2 }]}>{item.quantity}</Text>
                  <Text style={[styles.rowRate, { flex: 1.5 }]}>₹{item.unit_price}</Text>
                  <Text style={[styles.rowTotal, { flex: 1.8 }]}>₹{item.total_price}</Text>
                </View>
              ))}
            </View>

            {/* Summary Breakdown */}
            <View style={styles.summaryContainer}>
              <View style={styles.summaryRow}>
                <Text style={styles.sumLabel}>Subtotal</Text>
                <Text style={styles.sumVal}>₹{invoice.subtotal_amount}</Text>
              </View>

              {Number(invoice.discount_amount) > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.sumLabel, { color: '#10B981' }]}>Discount</Text>
                  <Text style={[styles.sumVal, { color: '#10B981' }]}>-₹{invoice.discount_amount}</Text>
                </View>
              )}

              {Number(invoice.tax_amount) > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.sumLabel}>GST / Tax</Text>
                  <Text style={styles.sumVal}>+₹{invoice.tax_amount}</Text>
                </View>
              )}

              <View style={styles.solidDivider} />

              <View style={styles.summaryRow}>
                <Text style={styles.grandLabel}>Total Paid / Due</Text>
                <Text style={styles.grandVal}>₹{invoice.total_amount}</Text>
              </View>
            </View>

            {invoice.notes ? (
              <View style={styles.notesBox}>
                <Text style={styles.notesLabel}>Notes:</Text>
                <Text style={styles.notesContent}>{invoice.notes}</Text>
              </View>
            ) : null}

            {/* Footer Greeting */}
            <View style={styles.billFooter}>
              <Text style={styles.footerGreeting}>Thank you for choosing {storeDisplayName}!</Text>
              <Text style={styles.footerTagline}>Powered by ApkaStore Cloud POS</Text>
            </View>
          </ScrollView>

          {/* Close Button */}
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>Close</Text>
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
    maxWidth: 620,
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginLeft: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  waBtn: {
    backgroundColor: '#25D366',
    borderColor: '#25D366',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
    color: colors.text.primary,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  billContent: {
    flex: 1,
    padding: 24,
  },
  storeHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  storeName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: 0.5,
  },
  storeSub: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  gstText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '600',
    marginTop: 2,
  },
  upiText: {
    fontSize: 12,
    color: colors.primary.main,
    fontWeight: '700',
    marginTop: 2,
  },
  dottedDivider: {
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginVertical: 14,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.muted,
    textTransform: 'uppercase',
  },
  metaCustomerName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: 2,
  },
  metaPhone: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 2,
  },
  statusBadge: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusPaid: {
    backgroundColor: '#DCFCE7',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextPaid: {
    color: '#15803D',
  },
  statusTextPending: {
    color: '#B45309',
  },
  table: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: 8,
    paddingHorizontal: 12,
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
  rowItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  rowItemUnit: {
    fontSize: 11,
    color: colors.text.muted,
  },
  rowQty: {
    fontSize: 13,
    textAlign: 'center',
    color: colors.text.primary,
    fontWeight: '600',
  },
  rowRate: {
    fontSize: 13,
    textAlign: 'right',
    color: colors.text.secondary,
  },
  rowTotal: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
    color: colors.text.primary,
  },
  summaryContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  sumLabel: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  sumVal: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  solidDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 6,
  },
  grandLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text.primary,
  },
  grandVal: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.primary.main,
  },
  notesBox: {
    backgroundColor: '#FEF9C3',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#854D0E',
  },
  notesContent: {
    fontSize: 12,
    color: '#713F12',
    marginTop: 2,
  },
  billFooter: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  footerGreeting: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  footerTagline: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  doneBtn: {
    backgroundColor: colors.primary.main,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
