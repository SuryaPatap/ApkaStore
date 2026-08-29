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
import { useAuth } from '../../context/AuthContext';
import { orderApi, creditApi, shopApi } from '../../api/endpoints';

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
  const [stats, setStats] = useState({
    activeOrdersCount: 0,
    pendingCreditRequests: 0,
    lowStockCount: 0,
    totalTodaySales: 0.0,
  });

  const fetchDashboardStats = async (silent = false) => {
    try {
      if (!silent) setRefreshing(true);
      const [orders, creditReqs, inventory] = await Promise.all([
        orderApi.getShopkeeperOrders().catch(() => []),
        creditApi.getShopkeeperCreditRequests().catch(() => []),
        shopApi.getInventory().catch(() => []),
      ]);

      const active = (orders || []).filter(
        (o) => o.status === 'PENDING' || o.status === 'PROCESSING' || o.status === 'READY'
      ).length;

      const pendingCredit = (creditReqs || []).filter((r) => r.status === 'PENDING').length;
      const lowStock = (inventory || []).filter((i) => i.stock_quantity <= 5).length;

      // Calculate total sales from all orders with prices
      const totalSales = (orders || []).reduce((sum, o) => {
        const amt = typeof o.total_amount === 'string' ? parseFloat(o.total_amount) : o.total_amount;
        if (amt && amt > 0) return sum + amt;
        if (o.items && o.items.length > 0) {
          const itemSum = o.items.reduce((acc: number, it: any) => {
            const u = typeof it.unit_price === 'string' ? parseFloat(it.unit_price) : it.unit_price || 0;
            return acc + u * (it.quantity || 1);
          }, 0);
          return sum + itemSum;
        }
        return sum;
      }, 0);

      setStats({
        activeOrdersCount: active,
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
    }, 3000);
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
            <Text style={styles.metricTitle}>Khata Requests</Text>
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
              <Text style={styles.shortcutTitle}>Store Inventory & Products</Text>
              <Text style={styles.shortcutSub}>Add products, adjust pricing, and update stock</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    marginBottom: 8,
  },
  heroLabel: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  heroValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 4,
  },
  storeStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  storeStatusText: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '700',
  },
  heroSubText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 6,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  metricIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
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
    fontSize: 16,
    fontWeight: '800',
    color: colors.text.primary,
    marginBottom: 4,
  },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  shortcutIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  shortcutInfo: {
    flex: 1,
  },
  shortcutTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  shortcutSub: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
});
