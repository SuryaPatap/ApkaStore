import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { Header } from '../../components/Header';
import { WhatsAppBroadcastModal } from '../../components/WhatsAppBroadcastModal';
import { AddBulkCustomersModal } from '../../components/AddBulkCustomersModal';
import { useAuth } from '../../context/AuthContext';
import { orderApi, creditApi, shopApi } from '../../api/endpoints';
import { Product } from '../../types';

interface DashboardScreenProps {
  onNavigateToOrders: () => void;
  onNavigateToInventory: () => void;
  onNavigateToKhata: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onNavigateToOrders,
  onNavigateToInventory,
  onNavigateToKhata,
}) => {
  const { shop } = useAuth();
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isAddBulkCustomersModalOpen, setIsAddBulkCustomersModalOpen] = useState(false);

  const [stats, setStats] = useState<{
    activeOrdersCount: number;
    pendingCreditRequests: number;
    lowStockCount: number;
    totalTodaySales: number;
  }>({
    activeOrdersCount: 0,
    pendingCreditRequests: 0,
    lowStockCount: 0,
    totalTodaySales: 0,
  });

  const fetchDashboardStats = async (silent: boolean = false) => {
    try {
      if (!silent) setLoading(true);

      const [orders, creditRequests, prods] = await Promise.all([
        orderApi.getShopkeeperOrders().catch(() => []),
        creditApi.getShopkeeperAccounts().catch(() => []),
        shopApi.getShopProducts(shop?.id).catch(() => []),
      ]);

      setProducts(prods || []);

      const activeOrders = orders.filter(
        (o: any) => o.status === 'PENDING' || o.status === 'PROCESSING' || o.status === 'READY'
      ).length;

      const pendingCredit = creditRequests.length;
      const lowStock = prods.filter((p: any) => p.stock_quantity <= 5).length;

      const totalSales = orders
        .filter((o: any) => o.status === 'COMPLETED' || o.status === 'READY')
        .reduce((sum: number, o: any) => sum + (parseFloat(String(o.total_amount)) || 0), 0);

      setStats({
        activeOrdersCount: activeOrders,
        pendingCreditRequests: pendingCredit,
        lowStockCount: lowStock,
        totalTodaySales: totalSales,
      });
    } catch (e) {
      if (!silent) console.log('Error fetching shopkeeper dashboard stats:', e);
    } finally {
      if (!silent) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchDashboardStats(false);
    const interval = setInterval(() => {
      fetchDashboardStats(true);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <Header
        title={shop?.shop_name || 'My Store Dashboard'}
        subtitle="Shopkeeper Business Console"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={fetchDashboardStats}
            colors={[colors.primary.main]}
          />
        }
      >
        {/* Sales Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroLabel}>Total Store Sales</Text>
              <Text style={styles.heroValue}>₹{stats.totalTodaySales.toFixed(2)}</Text>
            </View>
            <View style={styles.storeStatusBadge}>
              <View style={styles.onlineDot} />
              <Text style={styles.storeStatusText}>Store Live</Text>
            </View>
          </View>
          <Text style={styles.heroSubText}>Includes Cash, UPI, and Udhar Khata purchases</Text>
        </View>

        {/* Action / Alert Cards Grid */}
        <View style={styles.metricsGrid}>
          {/* Active Orders */}
          <TouchableOpacity
            style={[styles.metricCard, { borderLeftColor: colors.primary.main, borderLeftWidth: 4 }]}
            onPress={onNavigateToOrders}
            activeOpacity={0.8}
          >
            <View style={styles.metricIconCircle}>
              <Ionicons name="bag-handle" size={20} color={colors.primary.main} />
            </View>
            <Text style={styles.metricVal}>{stats.activeOrdersCount}</Text>
            <Text style={styles.metricTitle}>Active Orders</Text>
          </TouchableOpacity>

          {/* Pending Credit Requests */}
          <TouchableOpacity
            style={[styles.metricCard, { borderLeftColor: colors.gold.main, borderLeftWidth: 4 }]}
            onPress={onNavigateToKhata}
            activeOpacity={0.8}
          >
            <View style={[styles.metricIconCircle, { backgroundColor: colors.gold.surface }]}>
              <Ionicons name="book" size={20} color={colors.gold.dark} />
            </View>
            <Text style={styles.metricVal}>{stats.pendingCreditRequests}</Text>
            <Text style={styles.metricTitle}>Khata Accounts</Text>
          </TouchableOpacity>

          {/* Low Stock Items */}
          <TouchableOpacity
            style={[styles.metricCard, { borderLeftColor: colors.danger.main, borderLeftWidth: 4 }]}
            onPress={onNavigateToInventory}
            activeOpacity={0.8}
          >
            <View style={[styles.metricIconCircle, { backgroundColor: colors.danger.surface }]}>
              <Ionicons name="alert-circle" size={20} color={colors.danger.main} />
            </View>
            <Text style={styles.metricVal}>{stats.lowStockCount}</Text>
            <Text style={styles.metricTitle}>Low Stock Items</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Management Shortcuts */}
        <View style={styles.shortcutsSection}>
          <Text style={styles.sectionHeader}>Quick Actions</Text>

          {/* WhatsApp Marketing Banner Shortcut */}
          <TouchableOpacity
            style={[styles.shortcutRow, styles.waShortcutRow]}
            onPress={() => setIsWhatsAppModalOpen(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.shortcutIconBox, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="logo-whatsapp" size={24} color="#166534" />
            </View>
            <View style={styles.shortcutInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.shortcutTitle, { color: '#166534' }]}>WhatsApp Marketing & Offers</Text>
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>PROMO</Text>
                </View>
              </View>
              <Text style={styles.shortcutSub}>Send festival offers, new stock alerts & bills on WhatsApp</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#166534" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shortcutRow}
            onPress={onNavigateToOrders}
            activeOpacity={0.8}
          >
            <View style={styles.shortcutIconBox}>
              <Ionicons name="receipt-outline" size={22} color={colors.primary.main} />
            </View>
            <View style={styles.shortcutInfo}>
              <Text style={styles.shortcutTitle}>Manage Live Orders</Text>
              <Text style={styles.shortcutSub}>View, pack, and mark customer orders ready</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
          </TouchableOpacity>

          {/* Add Bulk Customers Shortcut */}
          <TouchableOpacity
            style={styles.shortcutRow}
            onPress={() => setIsAddBulkCustomersModalOpen(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.shortcutIconBox, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="people-circle-outline" size={24} color={colors.primary.main} />
            </View>
            <View style={styles.shortcutInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.shortcutTitle}>Add Bulk Customers (10+ at once)</Text>
                <View style={[styles.newBadge, { backgroundColor: colors.primary.surface }]}>
                  <Text style={[styles.newBadgeText, { color: colors.primary.main }]}>BULK</Text>
                </View>
              </View>
              <Text style={styles.shortcutSub}>Quick import customer directory by table entry or copy-paste</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shortcutRow}
            onPress={onNavigateToKhata}
            activeOpacity={0.8}
          >
            <View style={[styles.shortcutIconBox, { backgroundColor: colors.gold.surface }]}>
              <Ionicons name="people-outline" size={22} color={colors.gold.dark} />
            </View>
            <View style={styles.shortcutInfo}>
              <Text style={styles.shortcutTitle}>Udhar Khata Book</Text>
              <Text style={styles.shortcutSub}>Approve credit limits & log customer repayments</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shortcutRow}
            onPress={onNavigateToInventory}
            activeOpacity={0.8}
          >
            <View style={[styles.shortcutIconBox, { backgroundColor: colors.primary.surface }]}>
              <Ionicons name="cube-outline" size={22} color={colors.primary.main} />
            </View>
            <View style={styles.shortcutInfo}>
              <Text style={styles.shortcutTitle}>Store Inventory & Inward Invoices</Text>
              <Text style={styles.shortcutSub}>Add products, import wholesale bills, and update stock</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* WhatsApp Marketing & Broadcast Modal */}
      <WhatsAppBroadcastModal
        visible={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        products={products}
        shop={shop}
        initialType="NEW_ARRIVALS"
      />

      {/* Add Bulk Customers Modal */}
      <AddBulkCustomersModal
        visible={isAddBulkCustomersModalOpen}
        onClose={() => setIsAddBulkCustomersModalOpen(false)}
        onCustomersAdded={() => {
          setIsAddBulkCustomersModalOpen(false);
          setIsWhatsAppModalOpen(true);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: colors.navy.main,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroValue: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 4,
  },
  storeStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    gap: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  storeStatusText: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '700',
  },
  heroSubText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 14,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  metricIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricVal: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text.primary,
  },
  metricTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.secondary,
    marginTop: 2,
  },
  shortcutsSection: {
    gap: 10,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text.primary,
    marginBottom: 2,
  },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: 12,
  },
  waShortcutRow: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
    borderWidth: 1.5,
  },
  newBadge: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  newBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  shortcutIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shortcutInfo: {
    flex: 1,
  },
  shortcutTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text.primary,
  },
  shortcutSub: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
});
