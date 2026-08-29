import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { Shop } from '../types';
import { useAuth } from '../context/AuthContext';

interface ShopSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectShop: (shop: Shop) => void;
}

export const ShopSelectorModal: React.FC<ShopSelectorModalProps> = ({
  visible,
  onClose,
  onSelectShop,
}) => {
  const { nearbyShops, selectedShop, selectShop, refreshNearbyShops, user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshNearbyShops();
    setRefreshing(false);
  };

  const handleSelect = async (shop: Shop) => {
    await selectShop(shop);
    onSelectShop(shop);
    onClose();
  };

  const handleCallShop = (phone?: string) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const userLocality = user?.address?.locality || user?.address?.city || 'Your Address';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Select Nearby Store</Text>
              <Text style={styles.subtitle}>
                📍 Neighborhood stores within 2km of {userLocality}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* List of Nearby Shops (Strictly <= 2km) */}
          {nearbyShops.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="location-outline" size={48} color={colors.text.muted} />
              <Text style={styles.emptyTitle}>No stores found within 2km</Text>
              <Text style={styles.emptySubtitle}>
                There are currently no registered ApkaStore merchants within 2km of {userLocality}.
              </Text>
              <TouchableOpacity
                style={styles.refreshBtn}
                onPress={handleRefresh}
                disabled={refreshing}
              >
                {refreshing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="refresh" size={16} color="#fff" />
                    <Text style={styles.refreshBtnText}>Check Again</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={nearbyShops}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const isSelected = selectedShop?.id === item.id;
                const distText =
                  item.distance_km !== undefined
                    ? item.distance_km < 1
                      ? `${Math.round(item.distance_km * 1000)} m away`
                      : `${item.distance_km.toFixed(1)} km away`
                    : '< 2 km';

                return (
                  <TouchableOpacity
                    style={[styles.shopCard, isSelected && styles.selectedShopCard]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.shopCardLeft}>
                      <View style={[styles.shopIconBox, isSelected && styles.selectedIconBox]}>
                        <Ionicons
                          name="storefront"
                          size={22}
                          color={isSelected ? '#fff' : colors.primary.main}
                        />
                      </View>
                      <View style={styles.shopInfo}>
                        <View style={styles.nameRow}>
                          <Text style={styles.shopName}>{item.shop_name}</Text>
                          {isSelected && (
                            <View style={styles.activeBadge}>
                              <Text style={styles.activeBadgeText}>ACTIVE</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.shopCategory}>
                          {item.shop_category || 'Grocery Store'}
                          {item.owner_name ? ` • By ${item.owner_name}` : ''}
                        </Text>
                        {item.address && (
                          <Text style={styles.shopAddress} numberOfLines={1}>
                            {item.address.locality ? `${item.address.locality}, ` : ''}
                            {item.address.city}
                          </Text>
                        )}
                        <View style={styles.metaRow}>
                          <View style={styles.distanceBadge}>
                            <Ionicons name="navigate" size={11} color={colors.primary.main} />
                            <Text style={styles.distanceText}>{distText} (Within 2km)</Text>
                          </View>
                          {item.has_khata && (
                            <View style={styles.khataBadge}>
                              <Ionicons name="card" size={11} color={colors.gold.dark} />
                              <Text style={styles.khataBadgeText}>Udhar Active</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>

                    <View style={styles.actionsRight}>
                      {item.shop_phone && (
                        <TouchableOpacity
                          style={styles.callIconBtn}
                          onPress={() => handleCallShop(item.shop_phone)}
                        >
                          <Ionicons name="call" size={16} color={colors.primary.main} />
                        </TouchableOpacity>
                      )}
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'chevron-forward'}
                        size={24}
                        color={isSelected ? colors.primary.main : colors.border.main}
                      />
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: '45%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
  },
  listContent: {
    padding: 16,
  },
  shopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  selectedShopCard: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.surface,
  },
  shopCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  shopIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  selectedIconBox: {
    backgroundColor: colors.primary.main,
  },
  shopInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  shopName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text.primary,
    marginRight: 8,
  },
  activeBadge: {
    backgroundColor: colors.primary.main,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  shopCategory: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  shopAddress: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary.light,
    gap: 4,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary.dark,
  },
  khataBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  khataBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold.dark,
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  callIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text.primary,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.main,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 16,
    gap: 6,
  },
  refreshBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
