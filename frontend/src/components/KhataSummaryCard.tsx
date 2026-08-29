import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { CreditAccount } from '../types';

interface KhataSummaryCardProps {
  creditAccount?: CreditAccount | null;
  onRequestIncreasePress?: () => void;
  onPayDuesPress?: () => void;
}

export const KhataSummaryCard: React.FC<KhataSummaryCardProps> = ({
  creditAccount,
  onRequestIncreasePress,
  onPayDuesPress,
}) => {
  const limit = creditAccount
    ? typeof creditAccount.credit_limit === 'string'
      ? parseFloat(creditAccount.credit_limit)
      : creditAccount.credit_limit
    : 0;

  const outstanding = creditAccount
    ? typeof creditAccount.outstanding_amount === 'string'
      ? parseFloat(creditAccount.outstanding_amount)
      : creditAccount.outstanding_amount
    : 0;

  const available = creditAccount
    ? typeof creditAccount.available_credit === 'string'
      ? parseFloat(creditAccount.available_credit)
      : creditAccount.available_credit
    : limit - outstanding;

  const percentageUsed = limit > 0 ? Math.min(Math.round((outstanding / limit) * 100), 100) : 0;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="wallet" size={20} color="#FFFFFF" />
          <Text style={styles.title}>My Store Khata (Credit)</Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>
            {creditAccount ? creditAccount.status : 'NO ACCOUNT'}
          </Text>
        </View>
      </View>

      {/* Balances */}
      <View style={styles.balanceSection}>
        <View style={styles.balanceBlock}>
          <Text style={styles.balanceLabel}>Current Outstanding</Text>
          <Text style={styles.outstandingAmount}>₹{outstanding.toFixed(2)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.balanceBlock}>
          <Text style={styles.balanceLabel}>Available Limit</Text>
          <Text style={styles.availableAmount}>₹{available.toFixed(2)}</Text>
        </View>
      </View>

      {/* Progress Bar */}
      {limit > 0 && (
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressBar,
                { width: `${percentageUsed}%` },
                percentageUsed > 80 ? styles.progressDanger : styles.progressNormal,
              ]}
            />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressText}>{percentageUsed}% Used</Text>
            <Text style={styles.progressText}>Limit: ₹{limit.toFixed(2)}</Text>
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionRow}>
        {onRequestIncreasePress && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onRequestIncreasePress}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-up-circle-outline" size={16} color="#FFFFFF" />
            <Text style={styles.secondaryButtonText}>Request Limit</Text>
          </TouchableOpacity>
        )}

        {onPayDuesPress && outstanding > 0 && (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onPayDuesPress}
            activeOpacity={0.8}
          >
            <Ionicons name="card-outline" size={16} color={Colors.secondary} />
            <Text style={styles.primaryButtonText}>Pay Dues</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.secondary,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  statusPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: {
    color: '#A7F3D0',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  balanceSection: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  balanceBlock: {
    flex: 1,
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 12,
  },
  balanceLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  outstandingAmount: {
    color: '#F87171',
    fontSize: 20,
    fontWeight: '800',
  },
  availableAmount: {
    color: '#34D399',
    fontSize: 20,
    fontWeight: '800',
  },
  progressContainer: {
    marginTop: 14,
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  progressNormal: {
    backgroundColor: '#34D399',
  },
  progressDanger: {
    backgroundColor: '#EF4444',
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  progressText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#34D399',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  primaryButtonText: {
    color: Colors.secondary,
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
