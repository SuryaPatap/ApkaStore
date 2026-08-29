import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { Header } from '../../components/Header';
import { ModalDialog } from '../../components/ModalDialog';
import { EmptyState } from '../../components/EmptyState';
import { creditApi } from '../../api/endpoints';
import {
  CreditRequest,
  ShopkeeperCustomerCredit,
  CreditLedgerEntry,
} from '../../types';

export const KhataManageScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'REQUESTS' | 'ACCOUNTS'>('REQUESTS');
  const [requests, setRequests] = useState<CreditRequest[]>([]);
  const [accounts, setAccounts] = useState<ShopkeeperCustomerCredit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Customer Ledger Sheet Modal
  const [viewingCustomer, setViewingCustomer] = useState<ShopkeeperCustomerCredit | null>(null);
  const [customerLedger, setCustomerLedger] = useState<CreditLedgerEntry[]>([]);
  const [loadingLedger, setLoadingLedger] = useState<boolean>(false);

  // Record Payment Modal
  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState<boolean>(false);
  const [paymentCustomer, setPaymentCustomer] = useState<ShopkeeperCustomerCredit | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);

  const fetchKhataData = async () => {
    try {
      setLoading(true);
      const [reqs, accs] = await Promise.all([
        creditApi.getShopkeeperCreditRequests().catch(() => []),
        creditApi.getShopkeeperAccounts().catch(() => []),
      ]);
      setRequests(reqs || []);
      setAccounts(accs || []);
    } catch (e) {
      console.log('Error loading shopkeeper khata data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchKhataData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchKhataData();
  };

  const openCustomerLedger = async (cust: ShopkeeperCustomerCredit) => {
    setViewingCustomer(cust);
    setLoadingLedger(true);
    try {
      const data = await creditApi.getShopkeeperCustomerLedger(cust.customer_id);
      setCustomerLedger(data || []);
    } catch (err) {
      console.log('Failed to load customer ledger:', err);
      setCustomerLedger([]);
    } finally {
      setLoadingLedger(false);
    }
  };

  const handleApproveRequest = async (request: CreditRequest, approved: boolean) => {
    try {
      await creditApi.approveCreditRequest(request.id, {
        approved,
        approved_limit: approved ? request.requested_limit : 0,
        notes: approved ? 'Approved by storekeeper' : 'Declined',
      });
      Alert.alert(
        approved ? 'Approved ✅' : 'Declined',
        approved
          ? `Credit account approved with limit ₹${parseFloat(String(request.requested_limit)).toFixed(2)}.`
          : 'Credit request was rejected.'
      );
      fetchKhataData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to update credit request.');
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentCustomer || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount.');
      return;
    }

    const payVal = parseFloat(paymentAmount);
    setIsSubmittingPayment(true);
    try {
      await creditApi.shopkeeperRecordPayment(paymentCustomer.customer_id, {
        amount: payVal,
        payment_method: paymentMethod,
        notes: paymentNotes || `Collected via ${paymentMethod}`,
      });

      Alert.alert(
        'Payment Logged 🎉',
        `Recorded ₹${payVal.toFixed(2)} repayment from ${paymentCustomer.customer_name}.`
      );

      setIsPaymentModalVisible(false);
      setPaymentAmount('');
      setPaymentNotes('');

      // Refresh data
      await fetchKhataData();
      if (viewingCustomer && viewingCustomer.customer_id === paymentCustomer.customer_id) {
        await openCustomerLedger(paymentCustomer);
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to record payment.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Udhar Khata Manager"
        subtitle="Review credit requests & itemized customer ledgers"
      />

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'REQUESTS' && styles.activeTab]}
          onPress={() => setActiveTab('REQUESTS')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'REQUESTS' && styles.activeTabText,
            ]}
          >
            Credit Requests ({requests.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'ACCOUNTS' && styles.activeTab]}
          onPress={() => setActiveTab('ACCOUNTS')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'ACCOUNTS' && styles.activeTabText,
            ]}
          >
            Customer Khatas ({accounts.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading && !refreshing ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading Khata records...</Text>
        </View>
      ) : activeTab === 'REQUESTS' ? (
        <FlatList
          data={requests}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary.main]}
            />
          }
          renderItem={({ item }) => {
            const limit =
              typeof item.requested_limit === 'string'
                ? parseFloat(item.requested_limit)
                : item.requested_limit;

            const dateStr = item.created_at
              ? new Date(item.created_at).toLocaleDateString()
              : 'Recent';

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.customerName}>
                      {item.customer_name || `Customer #${item.customer_id}`}
                    </Text>
                    <Text style={styles.requestTime}>
                      Requested ₹{limit.toFixed(2)} credit limit • {dateStr}
                    </Text>
                    {item.customer_phone && (
                      <Text style={styles.phoneText}>📞 {item.customer_phone}</Text>
                    )}
                  </View>
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>PENDING</Text>
                  </View>
                </View>

                {item.notes && (
                  <Text style={styles.notesBox}>"{item.notes}"</Text>
                )}

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => handleApproveRequest(item, false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.rejectBtnText}>Decline</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() => handleApproveRequest(item, true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    <Text style={styles.approveBtnText}>Approve Limit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="checkmark-done-circle-outline"
              title="No pending credit requests"
              description="When nearby customers request Udhar Khata from your store, they will show up here."
            />
          }
        />
      ) : (
        <FlatList
          data={accounts}
          keyExtractor={(item) => String(item.customer_id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary.main]}
            />
          }
          renderItem={({ item }) => {
            const outst = parseFloat(String(item.outstanding_amount || 0));
            const limit = parseFloat(String(item.credit_limit || 0));

            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => openCustomerLedger(item)}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.customerName}>{item.customer_name}</Text>
                    <Text style={styles.phoneText}>📞 {item.customer_phone}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.recordPayBtn}
                    onPress={() => {
                      setPaymentCustomer(item);
                      setIsPaymentModalVisible(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add-circle" size={16} color="#FFFFFF" />
                    <Text style={styles.recordPayBtnText}>+ Payment</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.duesRow}>
                  <View style={styles.dueBlock}>
                    <Text style={styles.dueLabel}>Outstanding Due</Text>
                    <Text style={styles.dueValue}>₹{outst.toFixed(2)}</Text>
                  </View>

                  <View style={styles.dueBlock}>
                    <Text style={styles.dueLabel}>Approved Limit</Text>
                    <Text style={styles.limitValue}>₹{limit.toFixed(2)}</Text>
                  </View>
                </View>

                <View style={styles.tapDetailsHint}>
                  <Text style={styles.tapDetailsText}>
                    Tap to view itemized purchase history & time logs
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.primary.main} />
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="No customer accounts yet"
              description="Approved customer credit accounts and their Udhar ledgers will be listed here."
            />
          }
        />
      )}

      {/* Customer Itemized Ledger Modal */}
      <Modal
        visible={!!viewingCustomer}
        animationType="slide"
        transparent
        onRequestClose={() => setViewingCustomer(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.ledgerModalContainer}>
            {/* Modal Header */}
            <View style={styles.ledgerModalHeader}>
              <View>
                <Text style={styles.ledgerModalTitle}>
                  {viewingCustomer?.customer_name}'s Khata Ledger
                </Text>
                <Text style={styles.ledgerModalSub}>
                  📞 {viewingCustomer?.customer_phone} • Due: ₹
                  {parseFloat(String(viewingCustomer?.outstanding_amount || 0)).toFixed(2)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setViewingCustomer(null)}
              >
                <Ionicons name="close" size={24} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {loadingLedger ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary.main} />
                <Text style={{ marginTop: 10, color: colors.text.secondary }}>
                  Loading itemized transactions...
                </Text>
              </View>
            ) : customerLedger.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Ionicons name="receipt-outline" size={40} color={colors.text.muted} />
                <Text style={{ fontSize: 15, fontWeight: '700', marginTop: 10 }}>
                  No transactions recorded yet
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.text.secondary,
                    textAlign: 'center',
                    marginTop: 4,
                  }}
                >
                  Purchases made by this customer using Udhar Khata will display detailed items, date, and time here.
                </Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                {customerLedger.map((tx) => {
                  const isPurchase = tx.transaction_type === 'CREDIT_PURCHASE';
                  const amount = parseFloat(String(tx.amount || 0));
                  const balance = parseFloat(String(tx.balance_after || 0));

                  return (
                    <View key={tx.id} style={styles.ledgerCard}>
                      {/* Top row: Date & Time + Amount */}
                      <View style={styles.txCardHeader}>
                        <View>
                          <Text style={styles.txDateText}>
                            📅 {tx.formatted_date || 'Date'} • ⏰ {tx.formatted_time || 'Time'}
                          </Text>
                          <Text style={styles.txOrderRef}>
                            {isPurchase
                              ? `Udhar Purchase ${tx.order_id ? `(Order #${tx.order_id})` : ''}`
                              : 'Repayment Received'}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text
                            style={[
                              styles.txAmountText,
                              isPurchase ? styles.purchaseAmountText : styles.paymentAmountText,
                            ]}
                          >
                            {isPurchase ? `+₹${amount.toFixed(2)}` : `-₹${amount.toFixed(2)}`}
                          </Text>
                          <Text style={styles.txBalText}>Bal: ₹{balance.toFixed(2)}</Text>
                        </View>
                      </View>

                      {/* Items table if order items present */}
                      {tx.items && tx.items.length > 0 && (
                        <View style={styles.miniTable}>
                          <Text style={styles.miniTableHeading}>Items Bought:</Text>
                          {tx.items.map((it, idx) => (
                            <View key={idx} style={styles.miniTableRow}>
                              <Text style={styles.miniItemName} numberOfLines={1}>
                                • {it.product_name}
                              </Text>
                              <Text style={styles.miniItemQty}>
                                {it.quantity} {it.unit || ''} × ₹{parseFloat(String(it.unit_price)).toFixed(2)}
                              </Text>
                              <Text style={styles.miniItemSubtotal}>
                                ₹{parseFloat(String(it.subtotal)).toFixed(2)}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {tx.description && !tx.items?.length && (
                        <Text style={styles.txDescNote}>"{tx.description}"</Text>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            )}

            {/* Bottom Actions */}
            <View style={styles.ledgerModalFooter}>
              <TouchableOpacity
                style={styles.logPaymentFooterBtn}
                onPress={() => {
                  if (viewingCustomer) {
                    setPaymentCustomer(viewingCustomer);
                    setIsPaymentModalVisible(true);
                  }
                }}
              >
                <Ionicons name="cash-outline" size={18} color="#fff" />
                <Text style={styles.logPaymentFooterBtnText}>+ Record Payment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Record Payment Modal */}
      <ModalDialog
        visible={isPaymentModalVisible}
        onClose={() => setIsPaymentModalVisible(false)}
        title="Record Customer Repayment"
      >
        <Text style={styles.modalSub}>
          Recording payment received from {paymentCustomer?.customer_name} (Due: ₹
          {parseFloat(String(paymentCustomer?.outstanding_amount || 0)).toFixed(2)})
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Payment Amount (₹)</Text>
          <TextInput
            style={styles.modalInput}
            value={paymentAmount}
            onChangeText={setPaymentAmount}
            placeholder="e.g. 500"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Payment Method</Text>
          <View style={styles.payMethodRow}>
            {['CASH', 'UPI', 'CARD', 'CHEQUE'].map((method) => (
              <TouchableOpacity
                key={method}
                style={[
                  styles.payMethodBtn,
                  paymentMethod === method && styles.payMethodBtnActive,
                ]}
                onPress={() => setPaymentMethod(method)}
              >
                <Text
                  style={[
                    styles.payMethodText,
                    paymentMethod === method && styles.payMethodTextActive,
                  ]}
                >
                  {method}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Notes / Reference (Optional)</Text>
          <TextInput
            style={styles.modalInput}
            value={paymentNotes}
            onChangeText={setPaymentNotes}
            placeholder="e.g. Paid in full / GooglePay ref"
          />
        </View>

        <TouchableOpacity
          style={styles.submitModalBtn}
          onPress={handleRecordPayment}
          disabled={isSubmittingPayment}
          activeOpacity={0.85}
        >
          {isSubmittingPayment ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitModalBtnText}>Confirm Payment & Update Balance</Text>
          )}
        </TouchableOpacity>
      </ModalDialog>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    gap: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.background.subtle,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  activeTab: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text.primary,
  },
  requestTime: {
    fontSize: 12,
    color: colors.primary.main,
    fontWeight: '700',
    marginTop: 2,
  },
  phoneText: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  pendingBadge: {
    backgroundColor: colors.gold.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pendingBadgeText: {
    color: colors.gold.dark,
    fontSize: 10,
    fontWeight: '800',
  },
  notesBox: {
    fontSize: 13,
    color: colors.text.secondary,
    fontStyle: 'italic',
    backgroundColor: colors.background.subtle,
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rejectBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.background.subtle,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  rejectBtnText: {
    color: colors.danger.main,
    fontSize: 13,
    fontWeight: '700',
  },
  approveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.main,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 4,
  },
  approveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  recordPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.main,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 4,
  },
  recordPayBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  duesRow: {
    flexDirection: 'row',
    backgroundColor: colors.background.subtle,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  dueBlock: {
    flex: 1,
  },
  dueLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: '600',
    marginBottom: 2,
  },
  dueValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.danger.dark,
  },
  limitValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text.primary,
  },
  tapDetailsHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  tapDetailsText: {
    fontSize: 11,
    color: colors.primary.main,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  ledgerModalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 20,
  },
  ledgerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  ledgerModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text.primary,
  },
  ledgerModalSub: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  ledgerCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: 12,
  },
  txCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  txDateText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.primary,
  },
  txOrderRef: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  txAmountText: {
    fontSize: 15,
    fontWeight: '800',
  },
  purchaseAmountText: {
    color: colors.danger.dark,
  },
  paymentAmountText: {
    color: colors.primary.dark,
  },
  txBalText: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
  },
  miniTable: {
    backgroundColor: colors.background.subtle,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  miniTableHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.secondary,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  miniTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  miniItemName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 2,
  },
  miniItemQty: {
    fontSize: 11,
    color: colors.text.secondary,
    flex: 1,
    textAlign: 'center',
  },
  miniItemSubtotal: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
    textAlign: 'right',
  },
  txDescNote: {
    fontSize: 12,
    color: colors.text.secondary,
    fontStyle: 'italic',
    marginTop: 6,
  },
  ledgerModalFooter: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  logPaymentFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.main,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 6,
  },
  logPaymentFooterBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  modalSub: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.secondary,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: colors.background.subtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text.primary,
  },
  payMethodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  payMethodBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: colors.background.subtle,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  payMethodBtnActive: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  payMethodText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  payMethodTextActive: {
    color: '#FFFFFF',
  },
  submitModalBtn: {
    backgroundColor: colors.primary.main,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  submitModalBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
