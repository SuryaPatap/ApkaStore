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
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { Header } from '../../components/Header';
import { KhataSummaryCard } from '../../components/KhataSummaryCard';
import { ModalDialog } from '../../components/ModalDialog';
import { EmptyState } from '../../components/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { creditApi } from '../../api/endpoints';
import { CreditAccount, CreditLedgerEntry } from '../../types';

export const KhataScreen: React.FC = () => {
  const { selectedShop, user } = useAuth();
  const [creditAccount, setCreditAccount] = useState<CreditAccount | null>(null);
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Request Limit Modal
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [requestedAmount, setRequestedAmount] = useState<string>('5000');
  const [requestNote, setRequestNote] = useState<string>('Monthly family grocery requirements');
  const [submittingRequest, setSubmittingRequest] = useState<boolean>(false);

  // Receipt Modal
  const [selectedReceipt, setSelectedReceipt] = useState<CreditLedgerEntry | null>(null);

  const fetchKhataData = async () => {
    if (!selectedShop) {
      setCreditAccount(null);
      setLedger([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);
      const acc = await creditApi.getCreditAccount(selectedShop.id);
      setCreditAccount(acc);

      const ledgerData = await creditApi.getMyLedger(selectedShop.id);
      setLedger(ledgerData || []);
    } catch (e) {
      console.log('No active khata or fresh ledger:', e);
      setCreditAccount(null);
      setLedger([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchKhataData();
  }, [selectedShop]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchKhataData();
  };

  const handleRequestCredit = async () => {
    if (!selectedShop) {
      Alert.alert('No Store Selected', 'Please select a store before requesting Udhar Khata.');
      return;
    }

    if (!requestedAmount || parseFloat(requestedAmount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid credit limit request amount.');
      return;
    }

    setSubmittingRequest(true);
    try {
      await creditApi.requestCredit({
        shop_id: selectedShop.id,
        requested_limit: parseFloat(requestedAmount),
        notes: requestNote,
      });
      Alert.alert(
        'Request Sent! ⏳',
        `Your credit request of ₹${requestedAmount} has been sent to ${selectedShop.shop_name}. You can start shopping once approved!`
      );
      setIsModalVisible(false);
      fetchKhataData();
    } catch (err: any) {
      Alert.alert('Notice', err.response?.data?.detail || 'Request submitted successfully.');
      setIsModalVisible(false);
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handlePayKhataDues = () => {
    const outstanding = creditAccount
      ? typeof creditAccount.outstanding_amount === 'string'
        ? parseFloat(creditAccount.outstanding_amount)
        : creditAccount.outstanding_amount
      : 0;

    if (!selectedShop || outstanding <= 0) {
      Alert.alert('No Dues', 'You have no outstanding dues with this store.');
      return;
    }

    const upiId = selectedShop.upi_id || `${selectedShop.shop_phone || 'store'}@okaxis`;
    const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(selectedShop.shop_name)}&am=${outstanding.toFixed(2)}&cu=INR`;
    Linking.openURL(upiUrl).catch(() => {
      Alert.alert(
        'Pay Store Khata Dues',
        `Store: ${selectedShop.shop_name}\nUPI ID: ${upiId}\nAmount to Settle: ₹${outstanding.toFixed(2)}\n\nPlease open your UPI app to pay.`
      );
    });
  };

  return (
    <View style={styles.container}>
      <Header
        title="Udhar Khata Book"
        subtitle={selectedShop ? `Store: ${selectedShop.shop_name}` : 'Select a nearby store'}
      />

      {loading && !refreshing ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading Khata records...</Text>
        </View>
      ) : (
        <FlatList
          data={ledger}
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
          ListHeaderComponent={
            <View>
              <KhataSummaryCard
                creditAccount={creditAccount}
                onRequestIncreasePress={() => setIsModalVisible(true)}
                onPayDuesPress={handlePayKhataDues}
              />
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeader}>Khata Ledger History</Text>
                <Text style={styles.tapTip}>Tap entry for itemized receipt</Text>
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const isPurchase = item.transaction_type === 'CREDIT_PURCHASE';
            const amount =
              typeof item.amount === 'string' ? parseFloat(item.amount) : item.amount;
            const balance =
              typeof item.balance_after === 'string'
                ? parseFloat(item.balance_after)
                : item.balance_after;

            const dateDisplay =
              item.formatted_date ||
              (item.created_at
                ? new Date(item.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })
                : 'Recent');

            const timeDisplay =
              item.formatted_time ||
              (item.created_at
                ? new Date(item.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '');

            const hasItems = item.items && item.items.length > 0;

            return (
              <TouchableOpacity
                style={styles.ledgerRow}
                onPress={() => setSelectedReceipt(item)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.txIconCircle,
                    isPurchase ? styles.purchaseCircle : styles.paymentCircle,
                  ]}
                >
                  <Ionicons
                    name={isPurchase ? 'cart' : 'checkmark-done'}
                    size={18}
                    color={isPurchase ? colors.danger.dark : colors.primary.dark}
                  />
                </View>

                <View style={styles.txInfo}>
                  <Text style={styles.txDesc} numberOfLines={1}>
                    {item.description || (isPurchase ? `Purchase Order #${item.order_id || item.id}` : 'Payment Received')}
                  </Text>
                  <View style={styles.timeRow}>
                    <Text style={styles.txDate}>
                      {dateDisplay} {timeDisplay ? `• ${timeDisplay}` : ''}
                    </Text>
                    {hasItems && (
                      <View style={styles.itemCountBadge}>
                        <Text style={styles.itemCountBadgeText}>
                          {item.items!.length} {item.items!.length === 1 ? 'item' : 'items'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.txAmountSection}>
                  <Text
                    style={[
                      styles.txAmount,
                      isPurchase ? styles.purchaseAmount : styles.paymentAmount,
                    ]}
                  >
                    {isPurchase ? `+₹${amount.toFixed(2)}` : `-₹${amount.toFixed(2)}`}
                  </Text>
                  <Text style={styles.txBalanceAfter}>Bal: ₹{balance.toFixed(2)}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="book-outline"
              title={
                !creditAccount
                  ? 'No Active Udhar Khata'
                  : 'No Khata transactions yet'
              }
              description={
                !creditAccount
                  ? `Request an Udhar Khata limit from ${selectedShop?.shop_name || 'your local store'} to start purchasing on credit.`
                  : 'Whenever you purchase items via Udhar Khata, detailed item receipts with date & time will appear here.'
              }
              actionLabel={!creditAccount ? 'Request Udhar Limit' : undefined}
              onAction={!creditAccount ? () => setIsModalVisible(true) : undefined}
            />
          }
        />
      )}

      {/* Itemized Receipt Details Modal */}
      <Modal
        visible={!!selectedReceipt}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedReceipt(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.receiptContainer}>
            {/* Modal Header */}
            <View style={styles.receiptHeader}>
              <View>
                <Text style={styles.receiptHeaderTitle}>Udhar Khata Bill Receipt</Text>
                <Text style={styles.receiptHeaderSub}>
                  {selectedReceipt?.shop_name || selectedShop?.shop_name || 'Store'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setSelectedReceipt(null)}
              >
                <Ionicons name="close" size={24} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.receiptScrollContent}>
              {/* Date, Time & Order Info Box */}
              <View style={styles.receiptMetaBox}>
                <View style={styles.metaCol}>
                  <Text style={styles.metaLabel}>Date & Time</Text>
                  <Text style={styles.metaValue}>
                    {selectedReceipt?.formatted_date || 'Today'}
                  </Text>
                  <Text style={styles.metaSubValue}>
                    {selectedReceipt?.formatted_time || ''}
                  </Text>
                </View>
                <View style={styles.metaColRight}>
                  <Text style={styles.metaLabel}>Transaction Type</Text>
                  <Text
                    style={[
                      styles.metaValue,
                      selectedReceipt?.transaction_type === 'CREDIT_PURCHASE'
                        ? styles.purchaseText
                        : styles.paymentText,
                    ]}
                  >
                    {selectedReceipt?.transaction_type === 'CREDIT_PURCHASE'
                      ? 'Udhar Purchase'
                      : 'Repayment'}
                  </Text>
                  {selectedReceipt?.order_id && (
                    <Text style={styles.metaSubValue}>
                      Order #{selectedReceipt.order_id}
                    </Text>
                  )}
                </View>
              </View>

              {/* Itemized Table */}
              <Text style={styles.itemsTableTitle}>
                {selectedReceipt?.transaction_type === 'CREDIT_PURCHASE'
                  ? 'Items Bought'
                  : 'Payment Details'}
              </Text>

              {selectedReceipt?.items && selectedReceipt.items.length > 0 ? (
                <View style={styles.tableCard}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.thText, { flex: 2 }]}>Item</Text>
                    <Text style={[styles.thText, { flex: 1, textAlign: 'center' }]}>
                      Qty
                    </Text>
                    <Text style={[styles.thText, { flex: 1, textAlign: 'right' }]}>
                      Rate
                    </Text>
                    <Text style={[styles.thText, { flex: 1, textAlign: 'right' }]}>
                      Total
                    </Text>
                  </View>

                  {selectedReceipt.items.map((it, idx) => {
                    const price =
                      typeof it.unit_price === 'string'
                        ? parseFloat(it.unit_price)
                        : it.unit_price;
                    const subtotal =
                      typeof it.subtotal === 'string'
                        ? parseFloat(it.subtotal)
                        : it.subtotal;

                    return (
                      <View
                        key={idx}
                        style={[
                          styles.tableRow,
                          idx % 2 === 1 && styles.tableRowAlt,
                        ]}
                      >
                        <Text style={[styles.tdItemName, { flex: 2 }]} numberOfLines={2}>
                          {it.product_name}
                        </Text>
                        <Text style={[styles.tdText, { flex: 1, textAlign: 'center' }]}>
                          {it.quantity} {it.unit || ''}
                        </Text>
                        <Text style={[styles.tdText, { flex: 1, textAlign: 'right' }]}>
                          ₹{price.toFixed(2)}
                        </Text>
                        <Text style={[styles.tdTotal, { flex: 1, textAlign: 'right' }]}>
                          ₹{subtotal.toFixed(2)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.singleTxCard}>
                  <Text style={styles.singleTxDesc}>
                    {selectedReceipt?.description || 'Udhar transaction record'}
                  </Text>
                </View>
              )}

              {/* Total & Balances Summary Box */}
              <View style={styles.billSummaryBox}>
                <View style={styles.billSummaryRow}>
                  <Text style={styles.billSummaryLabel}>Transaction Amount</Text>
                  <Text style={styles.billSummaryAmount}>
                    ₹
                    {selectedReceipt?.amount
                      ? parseFloat(String(selectedReceipt.amount)).toFixed(2)
                      : '0.00'}
                  </Text>
                </View>
                <View style={styles.billSummaryDivider} />
                <View style={styles.billSummaryRow}>
                  <Text style={styles.billBalanceLabel}>
                    Updated Khata Balance Due
                  </Text>
                  <Text style={styles.billBalanceAmount}>
                    ₹
                    {selectedReceipt?.balance_after
                      ? parseFloat(String(selectedReceipt.balance_after)).toFixed(2)
                      : '0.00'}
                  </Text>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => setSelectedReceipt(null)}
            >
              <Text style={styles.doneBtnText}>Close Receipt</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Request Credit Increase Modal */}
      <ModalDialog
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        title="Request Store Credit (Udhar)"
      >
        <Text style={styles.modalSubtitle}>
          Ask {selectedShop?.shop_name || 'your local store'} to set up or increase your monthly Udhar Khata limit.
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Requested Limit (₹)</Text>
          <TextInput
            style={styles.modalInput}
            value={requestedAmount}
            onChangeText={setRequestedAmount}
            keyboardType="numeric"
            placeholder="e.g. 5000"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Note for Shopkeeper (Optional)</Text>
          <TextInput
            style={[styles.modalInput, styles.textArea]}
            value={requestNote}
            onChangeText={setRequestNote}
            multiline
            numberOfLines={3}
            placeholder="e.g. Monthly milk and household groceries"
          />
        </View>

        <TouchableOpacity
          style={styles.submitModalBtn}
          onPress={handleRequestCredit}
          disabled={submittingRequest}
          activeOpacity={0.8}
        >
          {submittingRequest ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitModalBtnText}>Send Request to Store</Text>
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 10,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text.primary,
  },
  tapTip: {
    fontSize: 11,
    color: colors.text.muted,
    fontWeight: '500',
  },
  ledgerRow: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  txIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  purchaseCircle: {
    backgroundColor: colors.danger.surface,
  },
  paymentCircle: {
    backgroundColor: colors.primary.surface,
  },
  txInfo: {
    flex: 1,
    paddingRight: 8,
  },
  txDesc: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  txDate: {
    fontSize: 12,
    color: colors.text.muted,
  },
  itemCountBadge: {
    backgroundColor: colors.background.subtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  itemCountBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  txAmountSection: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  purchaseAmount: {
    color: colors.danger.dark,
  },
  paymentAmount: {
    color: colors.primary.dark,
  },
  txBalanceAfter: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 2,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  receiptContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  receiptHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text.primary,
  },
  receiptHeaderSub: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  receiptScrollContent: {
    padding: 20,
  },
  receiptMetaBox: {
    flexDirection: 'row',
    backgroundColor: colors.background.subtle,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  metaCol: {
    flex: 1,
  },
  metaColRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  metaLabel: {
    fontSize: 11,
    color: colors.text.muted,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: 2,
  },
  metaSubValue: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 1,
  },
  purchaseText: {
    color: colors.danger.dark,
  },
  paymentText: {
    color: colors.primary.dark,
  },
  itemsTableTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 8,
  },
  tableCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: colors.background.subtle,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  thText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  tableRowAlt: {
    backgroundColor: '#FAFAFA',
  },
  tdItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  tdText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  tdTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  singleTxCard: {
    backgroundColor: colors.background.subtle,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  singleTxDesc: {
    fontSize: 13,
    color: colors.text.primary,
    lineHeight: 18,
  },
  billSummaryBox: {
    backgroundColor: colors.primary.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primary.light,
  },
  billSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billSummaryLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  billSummaryAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text.primary,
  },
  billSummaryDivider: {
    height: 1,
    backgroundColor: colors.primary.light,
    marginVertical: 10,
  },
  billBalanceLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  billBalanceAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.danger.dark,
  },
  doneBtn: {
    marginHorizontal: 20,
    backgroundColor: colors.primary.main,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
    marginBottom: 16,
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
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
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
