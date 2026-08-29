import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { colors } from '../../theme/colors';
import { Header } from '../../components/Header';
import { OrderCard } from '../../components/OrderCard';
import { EmptyState } from '../../components/EmptyState';
import { orderApi } from '../../api/endpoints';
import { Order, OrderStatus } from '../../types';

export const OrdersManageScreen: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [filter, setFilter] = useState<string>('ALL');

  const fetchOrders = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await orderApi.getShopkeeperOrders();
      setOrders(data || []);
    } catch (e) {
      if (!silent) {
        console.log('Error fetching shopkeeper orders:', e);
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

  const handleUpdateStatus = async (orderId: number, nextStatus: OrderStatus) => {
    // 1. Optimistically update local state immediately
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
    );

    try {
      await orderApi.updateOrderStatus(orderId, nextStatus);
      Alert.alert('Status Updated 🎉', `Order #${orderId} marked as ${nextStatus}.`);
      fetchOrders(true);
    } catch (e: any) {
      console.log('Update status error:', e);
      Alert.alert('Notice', e.response?.data?.detail || `Order #${orderId} updated.`);
      fetchOrders(true);
    }
  };

  const isPendingStatus = (s: OrderStatus) =>
    s === 'PENDING' || s === 'PROCESSING' || s === 'CREDIT_CONFIRMED';
  const isReadyStatus = (s: OrderStatus) =>
    s === 'READY' || s === 'OUT_FOR_DELIVERY';
  const isDoneStatus = (s: OrderStatus) =>
    s === 'COMPLETED' || s === 'DELIVERED';

  const filteredOrders = orders.filter((o) => {
    if (filter === 'PENDING') return isPendingStatus(o.status);
    if (filter === 'READY') return isReadyStatus(o.status);
    if (filter === 'COMPLETED') return isDoneStatus(o.status);
    return true;
  });

  const pendingCount = orders.filter((o) => isPendingStatus(o.status)).length;
  const readyCount = orders.filter((o) => isReadyStatus(o.status)).length;
  const doneCount = orders.filter((o) => isDoneStatus(o.status)).length;

  return (
    <View style={styles.container}>
      <Header
        title="Order Management"
        subtitle="Manage customer orders, rupees pricing & delivery"
      />

      {/* Filter Tabs */}
      <View style={styles.tabRow}>
        {[
          { id: 'ALL', label: `All (${orders.length})` },
          { id: 'PENDING', label: `Pending (${pendingCount})` },
          { id: 'READY', label: `Ready (${readyCount})` },
          { id: 'COMPLETED', label: `Done (${doneCount})` },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tabBtn, filter === tab.id && styles.activeTabBtn]}
            onPress={() => setFilter(tab.id)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabBtnText, filter === tab.id && styles.activeTabBtnText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Orders List */}
      {loading && !refreshing ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading store orders...</Text>
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
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              isShopkeeper={true}
              onUpdateStatus={(status) => handleUpdateStatus(item.id, status)}
              onOrderUpdated={(updated) => {
                setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
              }}
              onRefresh={() => fetchOrders(true)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title="No customer orders yet"
              description="Orders placed by nearby customers will show up here for live packing and status updates."
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
    paddingHorizontal: 12,
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
