import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { colors } from '../../theme/colors';
import { Header } from '../../components/Header';
import { OrderCard } from '../../components/OrderCard';
import { EmptyState } from '../../components/EmptyState';
import { orderApi } from '../../api/endpoints';
import { Order } from '../../types';

interface OrdersScreenProps {
  onShopNowPress?: () => void;
}

export const OrdersScreen: React.FC<OrdersScreenProps> = ({ onShopNowPress }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');

  const fetchOrders = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await orderApi.getCustomerOrders();
      setOrders(data || []);
    } catch (e) {
      if (!silent) {
        console.log('Error fetching customer orders:', e);
        setOrders([]);
      }
    } finally {
      if (!silent) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchOrders(false);
    const interval = setInterval(() => {
      fetchOrders(true);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders(false);
  };

  const filteredOrders = orders.filter((o) => {
    if (filter === 'ACTIVE') return o.status === 'PENDING' || o.status === 'PROCESSING' || o.status === 'READY';
    if (filter === 'COMPLETED') return o.status === 'COMPLETED';
    return true;
  });

  return (
    <View style={styles.container}>
      <Header title="My Orders" subtitle="Track real-time delivery and past orders" />

      {/* Filter Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, filter === 'ALL' && styles.activeTabBtn]}
          onPress={() => setFilter('ALL')}
        >
          <Text style={[styles.tabBtnText, filter === 'ALL' && styles.activeTabBtnText]}>
            All ({orders.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, filter === 'ACTIVE' && styles.activeTabBtn]}
          onPress={() => setFilter('ACTIVE')}
        >
          <Text style={[styles.tabBtnText, filter === 'ACTIVE' && styles.activeTabBtnText]}>
            Active (
            {
              orders.filter(
                (o) => o.status === 'PENDING' || o.status === 'PROCESSING' || o.status === 'READY'
              ).length
            }
            )
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, filter === 'COMPLETED' && styles.activeTabBtn]}
          onPress={() => setFilter('COMPLETED')}
        >
          <Text style={[styles.tabBtnText, filter === 'COMPLETED' && styles.activeTabBtnText]}>
            Completed ({orders.filter((o) => o.status === 'COMPLETED').length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Orders List */}
      {loading && !refreshing ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
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
          renderItem={({ item }) => <OrderCard order={item} isShopkeeper={false} />}
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title="No orders found"
              description="When you place orders with your local store, track their live delivery status right here."
              actionLabel="Start Shopping"
              onActionPress={onShopNowPress}
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    gap: 8,
  },
  tabBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.background.subtle,
  },
  activeTabBtn: {
    backgroundColor: colors.primary.main,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  activeTabBtnText: {
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
});
