import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { Header } from '../../components/Header';
import { useAuth } from '../../context/AuthContext';
import { creditApi, orderApi, parchiApi } from '../../api/endpoints';
import { CreditAccount, Order } from '../../types';
import { ParchiDetail } from '../../api/endpoints';

export const CustomerProfileScreen: React.FC = () => {
  const { user, selectedShop, logout, refreshUserProfile } = useAuth();
  const [creditAccount, setCreditAccount] = useState<CreditAccount | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [parchiDetail, setParchiDetail] = useState<ParchiDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProfileDetails = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      await refreshUserProfile();
      const [acc, ords, parchi] = await Promise.all([
        selectedShop ? creditApi.getCreditAccount(selectedShop.id).catch(() => null) : Promise.resolve(null),
        orderApi.getCustomerOrders().catch(() => []),
        parchiApi.getMyParchi().catch(() => null),
      ]);
      setCreditAccount(acc);
      setOrders(ords || []);
      setParchiDetail(parchi);
    } catch (e) {
      if (!silent) console.log('Error refreshing profile:', e);
    } finally {
      if (!silent) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchProfileDetails(false);
    const interval = setInterval(() => {
      fetchProfileDetails(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedShop]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfileDetails();
  };

  const handleCallShopkeeper = () => {
    const phone = parchiDetail?.parchi?.shop_phone || selectedShop?.shop_phone;
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const address = user?.address;
  const coordsText =
    address?.latitude && address?.longitude
      ? `${address.latitude.toFixed(4)}° N, ${address.longitude.toFixed(4)}° E`
      : 'Auto-Estimated via Pincode';

  // Order stats
  const totalSpent = orders.reduce((sum, o) => {
    const amt = typeof o.total_amount === 'string' ? parseFloat(o.total_amount) : o.total_amount || 0;
    if (amt > 0) return sum + amt;
    if (o.items && o.items.length > 0) {
      const itemSum = o.items.reduce((acc: number, it: any) => {
        const u = typeof it.unit_price === 'string' ? parseFloat(it.unit_price) : it.unit_price || 0;
        return acc + u * (it.quantity || 1);
      }, 0);
      return sum + itemSum;
    }
    return sum;
  }, 0);
  const completedOrders = orders.filter(o => o.status === 'COMPLETED').length;
  const pendingOrders = orders.filter(o => o.status === 'PENDING' || o.status === 'PROCESSING' || o.status === 'READY').length;

  return (
    <View style={styles.container}>
      <Header
        title="My Profile"
        subtitle="ApkaStore Customer Account"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary.main]}
          />
        }
      >
        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={36} color="#fff" />
          </View>
          <View style={styles.userInfo}>
            <View style={styles.roleRow}>
              <Text style={styles.userName}>{user?.name || 'Customer'}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>CUSTOMER</Text>
              </View>
            </View>
            <Text style={styles.userPhone}>📞 {user?.phone || 'Not set'}</Text>
            <Text style={styles.userEmail}>✉️ {user?.email || 'Not set'}</Text>
          </View>
        </View>

        {/* Orders & Channel Activity Metrics */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.primary.surface }]}>
              <Ionicons name="receipt" size={18} color={colors.primary.main} />
            </View>
            <Text style={styles.sectionTitle}>Order & Purchase Summary</Text>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricNumber}>{orders.length}</Text>
              <Text style={styles.metricLabel}>Total Orders</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={[styles.metricNumber, { color: '#059669' }]}>{completedOrders}</Text>
              <Text style={styles.metricLabel}>Delivered</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={[styles.metricNumber, { color: colors.gold.dark }]}>{pendingOrders}</Text>
              <Text style={styles.metricLabel}>In Progress</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={[styles.metricNumber, { color: colors.primary.main }]}>₹{totalSpent.toFixed(0)}</Text>
              <Text style={styles.metricLabel}>Total Spent</Text>
            </View>
          </View>
        </View>

        {/* Parchi Conversation & Channel Status */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIcon, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="chatbubbles" size={18} color={colors.gold.dark} />
            </View>
            <Text style={styles.sectionTitle}>Parchi Channel & Conversations</Text>
          </View>

          {parchiDetail ? (
            <View style={styles.parchiBox}>
              <View style={styles.parchiRow}>
                <Text style={styles.parchiKey}>Active Store:</Text>
                <Text style={styles.parchiVal}>{parchiDetail.parchi.shop_name || 'Storekeeper'}</Text>
              </View>
              <View style={styles.parchiRow}>
                <Text style={styles.parchiKey}>Parchi Grocery Orders:</Text>
                <Text style={[styles.parchiVal, { color: colors.primary.main, fontWeight: '800' }]}>
                  {parchiDetail.parchi.order_count} orders sent
                </Text>
              </View>
              <View style={styles.parchiRow}>
                <Text style={styles.parchiKey}>Total Chat Messages:</Text>
                <Text style={styles.parchiVal}>{parchiDetail.messages?.length || 0} messages</Text>
              </View>
              {parchiDetail.parchi.last_message_preview && (
                <View style={[styles.parchiRow, { alignItems: 'flex-start' }]}>
                  <Text style={styles.parchiKey}>Last Exchange:</Text>
                  <Text style={[styles.parchiVal, { color: colors.text.secondary, fontStyle: 'italic' }]} numberOfLines={2}>
                    "{parchiDetail.parchi.last_message_preview}"
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.emptyNote}>
              No active Parchi thread yet. You can chat and send grocery lists from the Parchi tab.
            </Text>
          )}
        </View>

        {/* Registered Delivery Address */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIcon}>
              <Ionicons name="location" size={18} color={colors.primary.main} />
            </View>
            <Text style={styles.sectionTitle}>Registered Delivery Address</Text>
          </View>

          {address ? (
            <View style={styles.addressBox}>
              <Text style={[styles.addressLine, { fontWeight: '700', color: colors.text.primary }]}>
                {[
                  address.flat_number ? `Flat ${address.flat_number}` : null,
                  address.building_number ? `Bldg ${address.building_number}` : null,
                  address.house_number ? `#${address.house_number}` : null,
                ].filter(Boolean).join(', ')}
              </Text>
              <Text style={styles.addressLine}>
                {[
                  address.sector ? `Sector ${address.sector.replace(/^sector\s*/i, '')}` : null,
                  address.street,
                  address.locality,
                ].filter(Boolean).join(', ')}
              </Text>
              <Text style={styles.addressLine}>
                {address.city} - {address.pincode}, {address.state}
              </Text>

              <View style={styles.geoBadge}>
                <Ionicons name="navigate" size={12} color={colors.primary.dark} />
                <Text style={styles.geoText}>
                  GPS Grid: {coordsText} (2km Radius Active)
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.emptyNote}>No address details registered.</Text>
          )}
        </View>

        {/* Active Connected Store (within 2km) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.gold.surface }]}>
              <Ionicons name="storefront" size={18} color={colors.gold.dark} />
            </View>
            <Text style={styles.sectionTitle}>Connected Neighborhood Store</Text>
          </View>

          {selectedShop ? (
            <View style={styles.storeCard}>
              <View style={styles.storeInfoRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.storeName}>{selectedShop.shop_name}</Text>
                  <Text style={styles.storeCategory}>
                    {selectedShop.shop_category || 'Grocery Store'}
                  </Text>
                  {selectedShop.owner_name && (
                    <Text style={styles.ownerName}>
                      Owner: {selectedShop.owner_name}
                    </Text>
                  )}
                  <View style={styles.distanceBadge}>
                    <Ionicons name="navigate" size={11} color={colors.primary.main} />
                    <Text style={styles.distanceBadgeText}>
                      {selectedShop.distance_km !== undefined
                        ? `${selectedShop.distance_km.toFixed(1)} km away (< 2km)`
                        : 'Under 2km'}
                    </Text>
                  </View>
                </View>

                {(parchiDetail?.parchi?.shop_phone || selectedShop.shop_phone) && (
                  <TouchableOpacity
                    style={styles.callBtn}
                    onPress={handleCallShopkeeper}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="call" size={16} color="#fff" />
                    <Text style={styles.callBtnText}>Call Store</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            <Text style={styles.emptyNote}>
              No store selected within 2km. Use the Home screen to pick a store.
            </Text>
          )}
        </View>

        {/* Udhar Khata Status */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.primary.surface }]}>
              <Ionicons name="book" size={18} color={colors.primary.main} />
            </View>
            <Text style={styles.sectionTitle}>Udhar Khata Book</Text>
          </View>

          {creditAccount ? (
            <View style={styles.khataSummaryBox}>
              <View style={styles.khataRow}>
                <Text style={styles.khataLabel}>Approved Credit Limit</Text>
                <Text style={styles.khataVal}>
                  ₹{parseFloat(String(creditAccount.credit_limit || 0)).toFixed(2)}
                </Text>
              </View>
              <View style={styles.khataRow}>
                <Text style={styles.khataLabel}>Outstanding Due</Text>
                <Text style={[styles.khataVal, { color: colors.danger.dark }]}>
                  ₹{parseFloat(String(creditAccount.outstanding_amount || 0)).toFixed(2)}
                </Text>
              </View>
              <View style={styles.khataRow}>
                <Text style={styles.khataLabel}>Account Status</Text>
                <Text style={[styles.khataVal, { color: colors.primary.main }]}>
                  {creditAccount.status || 'ACTIVE'}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.emptyNote}>
              No active credit account with the selected store. You can request a limit from the Khata tab.
            </Text>
          )}
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={logout}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.danger.main} />
          <Text style={styles.logoutBtnText}>Log Out from ApkaStore</Text>
        </TouchableOpacity>
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
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navy.main,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  userInfo: {
    flex: 1,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  userName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  roleBadge: {
    backgroundColor: colors.primary.main,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  userPhone: {
    fontSize: 13,
    color: '#CBD5E1',
    marginTop: 2,
  },
  userEmail: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primary.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text.primary,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricNumber: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.navy.main,
  },
  metricLabel: {
    fontSize: 10,
    color: colors.text.secondary,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  parchiBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    gap: 6,
  },
  parchiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  parchiKey: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  parchiVal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  addressBox: {
    backgroundColor: colors.background.subtle,
    borderRadius: 12,
    padding: 12,
    gap: 3,
  },
  addressLine: {
    fontSize: 13,
    color: colors.text.primary,
    fontWeight: '600',
  },
  geoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary.surface,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
  },
  geoText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary.dark,
  },
  storeCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  storeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  storeName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text.primary,
  },
  storeCategory: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  ownerName: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 1,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary.surface,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 6,
  },
  distanceBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary.dark,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  callBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  khataSummaryBox: {
    backgroundColor: colors.background.subtle,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  khataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  khataLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  khataVal: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text.primary,
  },
  emptyNote: {
    fontSize: 12,
    color: colors.text.secondary,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    marginTop: 6,
  },
  logoutBtnText: {
    color: colors.danger.main,
    fontSize: 14,
    fontWeight: '800',
  },
});
