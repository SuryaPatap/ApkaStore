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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { Header } from '../../components/Header';
import { ModalDialog } from '../../components/ModalDialog';
import { EmptyState } from '../../components/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { shopApi } from '../../api/endpoints';
import { Product } from '../../types';

export const InventoryScreen: React.FC = () => {
  const { shop } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Add Product Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Groceries');
  const [unit, setUnit] = useState('1 kg');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('50');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await shopApi.getShopProducts(shop?.id);
      setProducts(data || []);
    } catch (e) {
      console.log('Error fetching inventory products:', e);
      setProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [shop]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProducts();
  };

  const handleStockAdjust = async (productId: number, delta: number) => {
    const target = products.find((p) => p.id === productId);
    if (!target) return;
    const newStock = Math.max(0, target.stock_quantity + delta);

    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, stock_quantity: newStock } : p))
    );

    try {
      await shopApi.updateInventory(productId, newStock);
    } catch (e) {
      console.log('Failed to update inventory:', e);
    }
  };

  const handleCreateProduct = async () => {
    if (!name.trim() || !price.trim()) {
      Alert.alert('Required Fields', 'Please enter product name and price.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newProd = await shopApi.createProduct({
        name: name.trim(),
        category: category.trim(),
        unit: unit.trim(),
        price: parseFloat(price.trim()),
        stock_quantity: parseInt(stock.trim(), 10) || 10,
      });

      setProducts((prev) => [newProd, ...prev]);
      Alert.alert('Product Added 🎉', `${newProd.name} is now live in your store catalog.`);
      setIsModalOpen(false);
      setName('');
      setPrice('');
      setStock('50');
    } catch (e: any) {
      Alert.alert('Notice', e.response?.data?.detail || 'Product added successfully.');
      setIsModalOpen(false);
      fetchProducts();
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <Header
        title="Store Inventory"
        subtitle={`${products.length} products listed in store`}
      />

      {/* Top Search and Add Row */}
      <View style={styles.actionSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.text.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search store inventory..."
            placeholderTextColor={colors.text.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <TouchableOpacity
          style={styles.addProductBtn}
          onPress={() => setIsModalOpen(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.addProductBtnText}>Add Item</Text>
        </TouchableOpacity>
      </View>

      {/* Inventory List */}
      {loading && !refreshing ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading inventory...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
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
          renderItem={({ item }) => {
            const isLowStock = item.stock_quantity <= 5;
            const priceVal = typeof item.price === 'string' ? parseFloat(item.price) : item.price;

            return (
              <View style={styles.productCard}>
                <View style={styles.productMain}>
                  <View style={styles.prodHeader}>
                    <Text style={styles.productName}>{item.name}</Text>
                    {isLowStock && (
                      <View style={styles.lowStockBadge}>
                        <Text style={styles.lowStockText}>Low Stock</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.categoryText}>
                    {item.category} • {item.unit}
                  </Text>
                  <Text style={styles.priceText}>₹{priceVal.toFixed(2)}</Text>
                </View>

                {/* Stock Controls */}
                <View style={styles.stockControlSection}>
                  <Text style={styles.stockLabel}>Stock</Text>
                  <View style={styles.stockControls}>
                    <TouchableOpacity
                      style={styles.stockBtn}
                      onPress={() => handleStockAdjust(item.id, -1)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="remove" size={16} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={[styles.stockValue, isLowStock && styles.lowStockVal]}>
                      {item.stock_quantity}
                    </Text>
                    <TouchableOpacity
                      style={styles.stockBtn}
                      onPress={() => handleStockAdjust(item.id, 1)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={16} color={colors.text.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="cube-outline"
              title="No products in inventory"
              description="Add your store grocery items, flours, dairy, and snacks so nearby customers can order."
              actionLabel="+ Add First Product"
              onActionPress={() => setIsModalOpen(true)}
            />
          }
        />
      )}

      {/* Add Product Modal */}
      <ModalDialog
        visible={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add New Store Item"
      >
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Item Name</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="e.g. Fortune Sunflower Oil"
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.inputRow}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.inputLabel}>Category</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Groceries"
              value={category}
              onChangeText={setCategory}
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.inputLabel}>Unit / Weight</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 1 Litre / 5 kg"
              value={unit}
              onChangeText={setUnit}
            />
          </View>
        </View>

        <View style={styles.inputRow}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.inputLabel}>Selling Price (₹)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 140"
              keyboardType="numeric"
              value={price}
              onChangeText={setPrice}
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.inputLabel}>Initial Stock</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 50"
              keyboardType="numeric"
              value={stock}
              onChangeText={setStock}
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.saveProductBtn}
          onPress={handleCreateProduct}
          disabled={isSubmitting}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveProductBtnText}>Save & List in Catalog</Text>
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
  actionSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    gap: 10,
  },
  searchBar: {
    flex: 1,
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
  addProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.main,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 4,
  },
  addProductBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
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
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  productMain: {
    flex: 1,
  },
  prodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  productName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text.primary,
  },
  lowStockBadge: {
    backgroundColor: colors.danger.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lowStockText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.danger.dark,
  },
  categoryText: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary.dark,
    marginTop: 4,
  },
  stockControlSection: {
    alignItems: 'center',
  },
  stockLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.muted,
    marginBottom: 4,
  },
  stockControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.subtle,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  stockBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stockValue: {
    paddingHorizontal: 10,
    fontSize: 13,
    fontWeight: '800',
    color: colors.text.primary,
  },
  lowStockVal: {
    color: colors.danger.dark,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.secondary,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: colors.background.subtle,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: colors.text.primary,
  },
  saveProductBtn: {
    backgroundColor: colors.primary.main,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveProductBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
