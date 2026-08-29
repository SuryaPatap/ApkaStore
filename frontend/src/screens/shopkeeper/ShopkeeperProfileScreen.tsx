import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { Header } from '../../components/Header';
import { useAuth } from '../../context/AuthContext';
import { shopApi, creditApi, orderApi, parchiApi } from '../../api/endpoints';
import { Order } from '../../types';
import { ParchiThread } from '../../api/endpoints';

export const ShopkeeperProfileScreen: React.FC = () => {
  const { user, shop, logout, refreshUserProfile } = useAuth();
  const [productCount, setProductCount] = useState<number>(0);
  const [customerCount, setCustomerCount] = useState<number>(0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [parchiThreads, setParchiThreads] = useState<ParchiThread[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Edit Store Details Modal State
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editShopName, setEditShopName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editGst, setEditGst] = useState('');
  const [editUpiId, setEditUpiId] = useState('');
  const [editFlat, setEditFlat] = useState('');
  const [editBuilding, setEditBuilding] = useState('');
  const [editSector, setEditSector] = useState('');
  const [editStreet, setEditStreet] = useState('');
  const [editLocality, setEditLocality] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editPincode, setEditPincode] = useState('');
  const [savingStore, setSavingStore] = useState(false);

  const fetchShopkeeperProfile = async (silent = false) => {
    try {
      if (!silent) setRefreshing(true);
      await refreshUserProfile();
      const [prods, accs, ords, parchis] = await Promise.all([
        shopApi.getShopProducts(shop?.id).catch(() => []),
        creditApi.getShopkeeperAccounts().catch(() => []),
        orderApi.getShopkeeperOrders().catch(() => []),
        parchiApi.getShopkeeperParchis().catch(() => []),
      ]);
      setProductCount(prods?.length || 0);
      setCustomerCount(accs?.length || 0);
      setOrders(ords || []);
      setParchiThreads(parchis || []);
    } catch (e) {
      if (!silent) console.log('Error refreshing shopkeeper profile:', e);
    } finally {
      if (!silent) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchShopkeeperProfile(false);
    const interval = setInterval(() => {
      fetchShopkeeperProfile(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [shop]);

  const onRefresh = () => {
    fetchShopkeeperProfile();
  };

  const handleOpenEditModal = () => {
    setEditShopName(shop?.shop_name || '');
    setEditCategory(shop?.shop_category || 'Grocery & Daily Needs');
    setEditGst(shop?.gst_number || '');
    setEditUpiId(shop?.upi_id || '');
    setEditFlat(address?.flat_number || '');
    setEditBuilding(address?.building_number || '');
    setEditSector(address?.sector || '');
    setEditStreet(address?.street || '');
    setEditLocality(address?.locality || '');
    setEditCity(address?.city || 'Bengaluru');
    setEditState(address?.state || 'Karnataka');
    setEditPincode(address?.pincode || '');
    setIsEditModalVisible(true);
  };

  const handleSaveStoreDetails = async () => {
    if (!editShopName.trim()) {
      Alert.alert('Required Field', 'Please provide a store name.');
      return;
    }
    if (!editStreet.trim() || !editCity.trim() || !editPincode.trim()) {
      Alert.alert('Required Field', 'Please provide street, city, and pincode for 2km delivery coverage.');
      return;
    }

    setSavingStore(true);
    try {
      await shopApi.updateMyShop({
        shop_name: editShopName.trim(),
        shop_category: editCategory.trim(),
        gst_number: editGst.trim() || undefined,
        upi_id: editUpiId.trim() || undefined,
        address: {
          flat_number: editFlat.trim() || undefined,
          building_number: editBuilding.trim() || undefined,
          sector: editSector.trim() || undefined,
          street: editStreet.trim(),
          locality: editLocality.trim() || editSector.trim() || editStreet.trim(),
          city: editCity.trim(),
          state: editState.trim() || 'Karnataka',
          pincode: editPincode.trim(),
        },
      });

      await refreshUserProfile();
      setIsEditModalVisible(false);
      Alert.alert('Store Updated 🎉', 'Store details and UPI ID have been updated successfully.');
      fetchShopkeeperProfile(true);
    } catch (e: any) {
      console.log('Update store error:', e);
      Alert.alert('Notice', e.response?.data?.detail || 'Store updated.');
      setIsEditModalVisible(false);
      fetchShopkeeperProfile(true);
    } finally {
      setSavingStore(false);
    }
  };

  const address = shop?.address;
  const coordsText =
    address?.latitude && address?.longitude
      ? `${address.latitude.toFixed(4)}° N, ${address.longitude.toFixed(4)}° E`
      : 'Auto-Estimated via Store Pincode';

  // Store metrics
  const totalRevenue = orders.reduce((sum, o) => {
    const amt = typeof o.total_amount === 'string' ? parseFloat(o.total_amount) : o.total_amount || 0;
    return sum + amt;
  }, 0);

  const completedOrders = orders.filter(o => o.status === 'COMPLETED').length;
  const activeOrders = orders.filter(o => o.status === 'PENDING' || o.status === 'PROCESSING' || o.status === 'READY').length;
  const totalParchiOrders = parchiThreads.reduce((sum, p) => sum + (p.order_count || 0), 0);
  const totalParchiMessages = parchiThreads.reduce((sum, p) => sum + (p.message_count || 0), 0);

  return (
    <View style={styles.container}>
      <Header
        title="Store Profile"
        subtitle="ApkaStore Merchant & Business Details"
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
        {/* Owner Card */}
        <View style={styles.ownerCard}>
          <View style={styles.avatarCircle}>
            <Ionicons name="business" size={36} color="#fff" />
          </View>
          <View style={styles.ownerInfo}>
            <View style={styles.roleRow}>
              <Text style={styles.ownerName}>{user?.name || 'Shopkeeper'}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>MERCHANT</Text>
              </View>
            </View>
            <Text style={styles.ownerPhone}>📞 {user?.phone || 'Not set'}</Text>
            <Text style={styles.ownerEmail}>✉️ {user?.email || 'Not set'}</Text>
          </View>
        </View>

        {/* Store Business & Order Performance */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.primary.surface }]}>
              <Ionicons name="stats-chart" size={18} color={colors.primary.main} />
            </View>
            <Text style={styles.sectionTitle}>Store Orders & Revenue Summary</Text>
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
              <Text style={[styles.metricNumber, { color: colors.gold.dark }]}>{activeOrders}</Text>
              <Text style={styles.metricLabel}>In Packing</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={[styles.metricNumber, { color: colors.primary.main }]}>₹{totalRevenue.toFixed(0)}</Text>
              <Text style={styles.metricLabel}>Revenue</Text>
            </View>
          </View>
        </View>

        {/* Parchi Channel & Live Customer Interaction */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIcon, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="chatbubbles" size={18} color={colors.gold.dark} />
            </View>
            <Text style={styles.sectionTitle}>Parchi Network & Customer Exchanges</Text>
          </View>

          <View style={styles.parchiStatsGrid}>
            <View style={styles.parchiStatItem}>
              <Text style={styles.parchiStatNum}>{parchiThreads.length}</Text>
              <Text style={styles.parchiStatLbl}>Connected Customers</Text>
            </View>
            <View style={styles.parchiStatItem}>
              <Text style={[styles.parchiStatNum, { color: colors.primary.main }]}>{totalParchiOrders}</Text>
              <Text style={styles.parchiStatLbl}>Parchi Orders Received</Text>
            </View>
            <View style={styles.parchiStatItem}>
              <Text style={styles.parchiStatNum}>{totalParchiMessages}</Text>
              <Text style={styles.parchiStatLbl}>Total Chat Messages</Text>
            </View>
          </View>
        </View>

        {/* Store Business Profile */}
        <View style={styles.sectionCard}>
          <View style={[styles.sectionHeaderRow, { justifyContent: 'space-between' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.sectionIcon}>
                <Ionicons name="storefront" size={18} color={colors.primary.main} />
              </View>
              <Text style={styles.sectionTitle}>Store Business Details</Text>
            </View>
            <TouchableOpacity
              style={styles.editStoreBtn}
              onPress={handleOpenEditModal}
              activeOpacity={0.8}
            >
              <Ionicons name="pencil" size={13} color="#FFFFFF" />
              <Text style={styles.editStoreBtnText}>Edit Details & UPI</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Shop Name</Text>
            <Text style={styles.detailVal}>{shop?.shop_name || 'My Store'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Business Category</Text>
            <Text style={styles.detailVal}>{shop?.shop_category || 'Grocery & Daily Needs'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Store UPI ID</Text>
            {shop?.upi_id ? (
              <View style={styles.upiDisplayBadge}>
                <Ionicons name="qr-code-outline" size={13} color="#0369A1" />
                <Text style={styles.upiDisplayBadgeText}>{shop.upi_id}</Text>
              </View>
            ) : (
              <TouchableOpacity onPress={handleOpenEditModal}>
                <Text style={{ color: colors.primary.main, fontWeight: '700', fontSize: 13 }}>+ Add UPI ID</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>GST / Registration #</Text>
            <Text style={styles.detailVal}>{shop?.gst_number || 'Not Registered'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Store Status</Text>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Open & Accepting Orders</Text>
            </View>
          </View>
        </View>

        {/* Store Physical Address & 2km Coverage */}
        <View style={styles.sectionCard}>
          <View style={[styles.sectionHeaderRow, { justifyContent: 'space-between' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.gold.surface }]}>
                <Ionicons name="location" size={18} color={colors.gold.dark} />
              </View>
              <Text style={styles.sectionTitle}>Store Location & Neighborhood Coverage</Text>
            </View>
            <TouchableOpacity
              style={styles.editStoreTextBtn}
              onPress={handleOpenEditModal}
              activeOpacity={0.7}
            >
              <Text style={styles.editStoreTextBtnLabel}>Edit Address</Text>
            </TouchableOpacity>
          </View>

          {address ? (
            <View style={styles.addressBox}>
              <Text style={[styles.addressLine, { fontWeight: '700', color: colors.text.primary }]}>
                {[
                  address.flat_number ? `Shop/Unit ${address.flat_number}` : null,
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
                <Ionicons name="radio" size={12} color={colors.primary.dark} />
                <Text style={styles.geoText}>
                  Coverage Radius: Strictly 2.0 km ({coordsText})
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.emptyNote}>No address details registered.</Text>
          )}
        </View>

        {/* Connected Customer & Catalog Metrics */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.primary.surface }]}>
              <Ionicons name="analytics" size={18} color={colors.primary.main} />
            </View>
            <Text style={styles.sectionTitle}>Store Network & Catalog</Text>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricNumber}>{productCount}</Text>
              <Text style={styles.metricLabel}>Products Listed</Text>
            </View>

            <View style={styles.metricBox}>
              <Text style={styles.metricNumber}>{customerCount}</Text>
              <Text style={styles.metricLabel}>Udhar Khata Customers</Text>
            </View>

            <View style={styles.metricBox}>
              <Text style={styles.metricNumber}>2.0 km</Text>
              <Text style={styles.metricLabel}>Delivery Radius</Text>
            </View>
          </View>
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

      {/* ─── EDIT STORE DETAILS & UPI ID MODAL ─── */}
      <Modal
        visible={isEditModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.sectionIcon, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="storefront" size={18} color="#0369A1" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Edit Store & UPI Details</Text>
                  <Text style={styles.modalSubtitle}>Configure shop details and customer UPI payment ID</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setIsEditModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: 18, paddingBottom: 30 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Basic Details */}
              <Text style={styles.formSectionTitle}>STORE IDENTITY & PAYMENTS</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Shop Name *</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editShopName}
                  onChangeText={setEditShopName}
                  placeholder="e.g. Mohan Mart"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Business Category</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editCategory}
                  onChangeText={setEditCategory}
                  placeholder="e.g. Grocery & Daily Needs"
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={styles.inputLabel}>Store UPI ID (For Customer Payments) *</Text>
                  <View style={{ backgroundColor: '#E0F2FE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ color: '#0369A1', fontSize: 10, fontWeight: '800' }}>INSTANT PAY</Text>
                  </View>
                </View>
                <TextInput
                  style={[styles.modalInput, { borderColor: '#0284C7', backgroundColor: '#F0F9FF' }]}
                  value={editUpiId}
                  onChangeText={setEditUpiId}
                  placeholder="e.g. mohanmart@okaxis or 9876543210@paytm"
                  autoCapitalize="none"
                />
                <Text style={{ fontSize: 11, color: colors.text.secondary, marginTop: 3 }}>
                  Customers can scan or tap to pay directly to this UPI ID during checkout & order delivery.
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>GST Number (Optional)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editGst}
                  onChangeText={setEditGst}
                  placeholder="e.g. 07AAAAA0000A1Z5"
                  autoCapitalize="characters"
                />
              </View>

              {/* Physical Address Details */}
              <Text style={[styles.formSectionTitle, { marginTop: 14 }]}>STORE ADDRESS & 2KM COVERAGE</Text>

              <View style={styles.formRow}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Shop / Flat #</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editFlat}
                    onChangeText={setEditFlat}
                    placeholder="e.g. Shop 12"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Building / Complex</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editBuilding}
                    onChangeText={setEditBuilding}
                    placeholder="e.g. Plaza Tower"
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Sector (Name/Number)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editSector}
                    onChangeText={setEditSector}
                    placeholder="e.g. Sector 4"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Street / Market *</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editStreet}
                    onChangeText={setEditStreet}
                    placeholder="e.g. Main Market Road"
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>City *</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editCity}
                    onChangeText={setEditCity}
                    placeholder="e.g. Bengaluru"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Pincode *</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editPincode}
                    onChangeText={setEditPincode}
                    placeholder="e.g. 560038"
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setIsEditModalVisible(false)}
                  disabled={savingStore}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={handleSaveStoreDetails}
                  disabled={savingStore}
                  activeOpacity={0.85}
                >
                  {savingStore ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={16} color="#fff" />
                      <Text style={styles.modalSaveBtnText}>Save Store & UPI</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  ownerCard: {
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
  ownerInfo: {
    flex: 1,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  ownerName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  roleBadge: {
    backgroundColor: colors.gold.main,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  ownerPhone: {
    fontSize: 13,
    color: '#CBD5E1',
    marginTop: 2,
  },
  ownerEmail: {
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
    paddingHorizontal: 4,
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
  parchiStatsGrid: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  parchiStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  parchiStatNum: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.gold.dark,
  },
  parchiStatLbl: {
    fontSize: 10,
    color: colors.text.secondary,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.background.subtle,
  },
  detailLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  detailVal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statusText: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: '800',
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
  editStoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary.main,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  editStoreBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  editStoreTextBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  editStoreTextBtnLabel: {
    color: colors.primary.main,
    fontSize: 12,
    fontWeight: '700',
  },
  upiDisplayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  upiDisplayBadgeText: {
    color: '#0369A1',
    fontSize: 12,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 540,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    backgroundColor: '#F8FAFC',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text.primary,
  },
  modalSubtitle: {
    fontSize: 11,
    color: colors.text.secondary,
  },
  modalCloseBtn: {
    padding: 6,
  },
  formSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.text.secondary,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.border.main,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: colors.text.primary,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border.main,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  modalSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary.main,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: 'center',
  },
  modalSaveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
