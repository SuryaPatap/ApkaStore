import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { Header } from '../../components/Header';
import { ProductCard } from '../../components/ProductCard';
import { EmptyState } from '../../components/EmptyState';
import { ShopSelectorModal } from '../../components/ShopSelectorModal';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { shopApi } from '../../api/endpoints';
import { Product, Shop } from '../../types';

interface HomeScreenProps {
  onNavigateToCart: () => void;
  onNavigateToNotifications?: () => void;
}

const CATEGORIES = ['All', 'Groceries', 'Dairy', 'Fruits & Veg', 'Snacks', 'Beverages'];

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigateToCart,
  onNavigateToNotifications,
}) => {
  const { items, addItem, updateQuantity, totalItems, totalAmount } = useCart();
  const { user, selectedShop, nearbyShops, refreshNearbyShops, selectShop } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isShopModalVisible, setIsShopModalVisible] = useState<boolean>(false);

  const fetchCatalog = async (targetShopId?: number) => {
    const shopId = targetShopId || selectedShop?.id;
    if (!shopId) {
      setProducts([]);
      return;
    }

    try {
      setLoading(true);
      const data = await shopApi.getShopProducts(shopId, selectedCategory, searchQuery);
      setProducts(data || []);
    } catch (err) {
      console.warn('Failed to load products for shop:', err);
      setProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (selectedShop) {
      fetchCatalog(selectedShop.id);
    } else {
      refreshNearbyShops();
    }
  }, [selectedShop, selectedCategory]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshNearbyShops();
    if (selectedShop) {
      await fetchCatalog(selectedShop.id);
    } else {
      setRefreshing(false);
    }
  };

  const getQuantityInCart = (productId: number) => {
    const item = items.find((i) => i.product.id === productId);
    return item ? item.quantity : 0;
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      searchQuery === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat =
      selectedCategory === 'All' ||
      p.category.toLowerCase().includes(selectedCategory.toLowerCase()) ||
      (selectedCategory === 'Groceries' && (p.category.includes('Grain') || p.category.includes('Grocery')));
    return matchesSearch && matchesCat;
  });

  const distBadgeText = selectedShop?.distance_km !== undefined
    ? selectedShop.distance_km < 1
      ? `${Math.round(selectedShop.distance_km * 1000)}m away`
      : `${selectedShop.distance_km.toFixed(1)}km away`
    : 'Under 2km';

  return (
    <View style={styles.container}>
      <Header
        title={user ? `Namaste, ${user.name}` : 'ApkaStore'}
        subtitle="Fresh groceries delivered from your 2km neighborhood store"
        onNotificationPress={onNavigateToNotifications}
        unreadCount={0}
      />

      {/* Selected Nearby Store Card (2km Radius) */}
      <View style={styles.storeHeaderContainer}>
        {selectedShop ? (
          <TouchableOpacity
            style={styles.storeInfoCard}
            onPress={() => setIsShopModalVisible(true)}
            activeOpacity={0.8}
          >
            <View style={styles.storeIconWrapper}>
              <Ionicons name="storefront" size={20} color={colors.primary.main} />
            </View>
            <View style={styles.storeDetails}>
              <View style={styles.storeTitleRow}>
                <Text style={styles.storeName} numberOfLines={1}>
                  {selectedShop.shop_name}
                </Text>
                <View style={styles.distanceChip}>
                  <Ionicons name="navigate" size={10} color={colors.primary.main} />
                  <Text style={styles.distanceChipText}>{distBadgeText}</Text>
                </View>
              </View>
              <Text style={styles.storeSub} numberOfLines={1}>
                {selectedShop.shop_category || 'Grocery'} • {selectedShop.address?.locality || selectedShop.address?.city || 'Local Area'}
              </Text>
            </View>
            <View style={styles.changeStoreBtn}>
              <Text style={styles.changeStoreBtnText}>Change</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary.main} />
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.noStoreCard}
            onPress={() => setIsShopModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="location-outline" size={24} color={colors.gold.main} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.noStoreTitle}>Select a store within 2km</Text>
              <Text style={styles.noStoreSub}>Tap to view stores near your address</Text>
            </View>
            <View style={styles.pickStoreBtn}>
              <Text style={styles.pickStoreBtnText}>Pick Store</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.text.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search atta, dal, milk, tea, snacks..."
            placeholderTextColor={colors.text.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => fetchCatalog()}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.text.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Pills */}
      <View style={styles.categoriesContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIES}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.categoriesList}
          renderItem={({ item }) => {
            const isSelected = selectedCategory === item;
            return (
              <TouchableOpacity
                style={[styles.categoryChip, isSelected && styles.selectedCategoryChip]}
                onPress={() => setSelectedCategory(item)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    isSelected && styles.selectedCategoryChipText,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Products Grid / List */}
      {loading && !refreshing ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading store products...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.productsList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary.main]}
            />
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              quantityInCart={getQuantityInCart(item.id)}
              onAddToCart={() => addItem(item, 1)}
              onIncrement={() => updateQuantity(item.id, getQuantityInCart(item.id) + 1)}
              onDecrement={() => updateQuantity(item.id, getQuantityInCart(item.id) - 1)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              title={selectedShop ? 'No items found in this store' : 'No store selected'}
              description={
                selectedShop
                  ? 'This store has not listed any items in this category yet. Try another category or store.'
                  : 'Please pick a nearby store within 5km of your address to browse items.'
              }
              actionLabel={selectedShop ? 'Browse All Categories' : 'Find Nearby Stores'}
              onAction={() => {
                if (selectedShop) {
                  setSelectedCategory('All');
                } else {
                  setIsShopModalVisible(true);
                }
              }}
            />
          }
        />
      )}

      {/* Floating Cart Bar */}
      {totalItems > 0 && (
        <View style={styles.floatingCartWrapper}>
          <TouchableOpacity
            style={styles.floatingCart}
            onPress={onNavigateToCart}
            activeOpacity={0.9}
          >
            <View style={styles.cartInfo}>
              <View style={styles.cartCountBadge}>
                <Text style={styles.cartCountText}>{totalItems}</Text>
              </View>
              <View>
                <Text style={styles.cartTotalText}>₹{totalAmount.toFixed(2)}</Text>
                <Text style={styles.cartSubText}>From {selectedShop?.shop_name || 'Store'}</Text>
              </View>
            </View>
            <View style={styles.viewCartAction}>
              <Text style={styles.viewCartText}>View Cart</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Store Selector Modal */}
      <ShopSelectorModal
        visible={isShopModalVisible}
        onClose={() => setIsShopModalVisible(false)}
        onSelectShop={(newShop) => {
          fetchCatalog(newShop.id);
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
  storeHeaderContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: '#fff',
  },
  storeInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.surface,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.primary.light,
  },
  storeIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  storeDetails: {
    flex: 1,
  },
  storeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  storeName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    maxWidth: 160,
  },
  distanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
  },
  distanceChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary.dark,
  },
  storeSub: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 2,
  },
  changeStoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 2,
  },
  changeStoreBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary.main,
  },
  noStoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.gold.light,
  },
  noStoreTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  noStoreSub: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 2,
  },
  pickStoreBtn: {
    backgroundColor: colors.gold.main,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pickStoreBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#fff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.subtle,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text.primary,
  },
  categoriesContainer: {
    backgroundColor: '#fff',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  categoriesList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.background.subtle,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  selectedCategoryChip: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  selectedCategoryChipText: {
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
  productsList: {
    padding: 16,
    paddingBottom: 100,
  },
  floatingCartWrapper: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
  },
  floatingCart: {
    backgroundColor: colors.navy.main,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  cartInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cartCountBadge: {
    backgroundColor: colors.primary.main,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartCountText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  cartTotalText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  cartSubText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  viewCartAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  viewCartText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
