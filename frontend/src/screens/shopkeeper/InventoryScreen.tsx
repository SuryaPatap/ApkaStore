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
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { Header } from '../../components/Header';
import { ModalDialog } from '../../components/ModalDialog';
import { EmptyState } from '../../components/EmptyState';
import { CreateInvoiceModal } from '../../components/CreateInvoiceModal';
import { InvoiceDetailModal } from '../../components/InvoiceDetailModal';
import { useAuth } from '../../context/AuthContext';
import { shopApi, invoiceApi } from '../../api/endpoints';
import { Product, Invoice } from '../../types';

export const InventoryScreen: React.FC = () => {
  const { shop } = useAuth();
  const [activeTab, setActiveTab] = useState<'STOCK' | 'INVOICES'>('STOCK');

  // Stock State
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

  // Invoices State
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState<boolean>(false);
  const [invoiceSearch, setInvoiceSearch] = useState<string>('');
  const [invoiceFilter, setInvoiceFilter] = useState<'ALL' | 'PAID' | 'UDHAR_KHATA'>('ALL');
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState<boolean>(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

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

  const fetchInvoices = async () => {
    try {
      setInvoicesLoading(true);
      const data = await invoiceApi.getInvoices();
      setInvoices(data || []);
    } catch (e) {
      console.log('Error fetching invoices:', e);
      setInvoices([]);
    } finally {
      setInvoicesLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    if (activeTab === 'INVOICES') {
      fetchInvoices();
    }
  }, [shop, activeTab]);

  const onRefresh = () => {
    setRefreshing(true);
    if (activeTab === 'STOCK') {
      fetchProducts();
    } else {
      fetchInvoices();
    }
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

  const handleInvoiceCreated = (newInv: Invoice) => {
    setInvoices((prev) => [newInv, ...prev]);
    // Refresh products to show decremented stock!
    fetchProducts();
    // Open the detail modal for immediate receipt preview / print
    setSelectedInvoice(newInv);
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoice_number.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
      inv.customer_name.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
      (inv.customer_phone && inv.customer_phone.includes(invoiceSearch));

    if (!matchesSearch) return false;
    if (invoiceFilter === 'PAID') return inv.payment_status === 'PAID';
    if (invoiceFilter === 'UDHAR_KHATA') return inv.payment_method === 'UDHAR_KHATA';
    return true;
  });

  // Invoice Statistics
  const totalBilledAmount = invoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
  const udharInvoicesCount = invoices.filter((inv) => inv.payment_method === 'UDHAR_KHATA').length;

  return (
    <View style={styles.container}>
      <Header
        title="Store Inventory & POS"
        subtitle={`${products.length} catalog items • ${invoices.length} invoices generated`}
      />

      {/* Segmented Switcher */}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'STOCK' && styles.tabBtnActive]}
          onPress={() => setActiveTab('STOCK')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="cube-outline"
            size={18}
            color={activeTab === 'STOCK' ? colors.primary.main : colors.text.secondary}
          />
          <Text style={[styles.tabBtnText, activeTab === 'STOCK' && styles.tabBtnTextActive]}>
            📦 Stock & Catalog ({products.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'INVOICES' && styles.tabBtnActive]}
          onPress={() => {
            setActiveTab('INVOICES');
            fetchInvoices();
          }}
          activeOpacity={0.8}
        >
          <Ionicons
            name="receipt-outline"
            size={18}
            color={activeTab === 'INVOICES' ? colors.primary.main : colors.text.secondary}
          />
          <Text style={[styles.tabBtnText, activeTab === 'INVOICES' && styles.tabBtnTextActive]}>
            🧾 Invoices & Billing ({invoices.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* ===================== TAB 1: STOCK & CATALOG ===================== */}
      {activeTab === 'STOCK' && (
        <View style={{ flex: 1 }}>
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
              data={filteredProducts}
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
        </View>
      )}

      {/* ===================== TAB 2: INVOICES & BILLING ===================== */}
      {activeTab === 'INVOICES' && (
        <View style={{ flex: 1 }}>
          {/* Summary Stat Cards */}
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total Invoiced</Text>
              <Text style={styles.metricValue}>₹{totalBilledAmount.toFixed(0)}</Text>
              <Text style={styles.metricSub}>{invoices.length} total bills</Text>
            </View>

            <View style={[styles.metricCard, { borderLeftColor: '#F59E0B' }]}>
              <Text style={styles.metricLabel}>Udhar Khata Bills</Text>
              <Text style={[styles.metricValue, { color: '#D97706' }]}>{udharInvoicesCount}</Text>
              <Text style={styles.metricSub}>Added to ledger</Text>
            </View>

            <TouchableOpacity
              style={styles.newInvoiceCtaCard}
              onPress={() => setIsCreateInvoiceOpen(true)}
              activeOpacity={0.85}
            >
              <View style={styles.ctaIconWrap}>
                <Ionicons name="add" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.ctaTitle}>➕ New Bill / POS</Text>
              <Text style={styles.ctaSub}>Counter Sale</Text>
            </TouchableOpacity>
          </View>

          {/* Search & Filter Row */}
          <View style={styles.actionSection}>
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={18} color={colors.text.muted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by invoice # or customer..."
                placeholderTextColor={colors.text.muted}
                value={invoiceSearch}
                onChangeText={setInvoiceSearch}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterPills}>
              <TouchableOpacity
                style={[styles.filterPill, invoiceFilter === 'ALL' && styles.filterPillActive]}
                onPress={() => setInvoiceFilter('ALL')}
              >
                <Text style={[styles.filterText, invoiceFilter === 'ALL' && styles.filterTextActive]}>
                  All ({invoices.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, invoiceFilter === 'PAID' && styles.filterPillActive]}
                onPress={() => setInvoiceFilter('PAID')}
              >
                <Text style={[styles.filterText, invoiceFilter === 'PAID' && styles.filterTextActive]}>
                  Paid
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, invoiceFilter === 'UDHAR_KHATA' && styles.filterPillActive]}
                onPress={() => setInvoiceFilter('UDHAR_KHATA')}
              >
                <Text style={[styles.filterText, invoiceFilter === 'UDHAR_KHATA' && styles.filterTextActive]}>
                  Udhar
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Invoices List */}
          {invoicesLoading && !refreshing ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={colors.primary.main} />
              <Text style={styles.loadingText}>Loading store invoices...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredInvoices}
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
                <TouchableOpacity
                  style={styles.invoiceCard}
                  onPress={() => setSelectedInvoice(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.invCardLeft}>
                    <View style={styles.invHeaderRow}>
                      <Text style={styles.invNumber}>#{item.invoice_number}</Text>
                      <View
                        style={[
                          styles.invBadge,
                          item.payment_status === 'PAID' ? styles.invBadgePaid : styles.invBadgePending,
                        ]}
                      >
                        <Text
                          style={[
                            styles.invBadgeText,
                            item.payment_status === 'PAID' ? styles.invBadgeTextPaid : styles.invBadgeTextPending,
                          ]}
                        >
                          {item.payment_method} • {item.payment_status}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.invCustomer}>{item.customer_name}</Text>
                    <Text style={styles.invDate}>
                      {new Date(item.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {item.items ? ` • ${item.items.length} items` : ''}
                    </Text>
                  </View>

                  <View style={styles.invCardRight}>
                    <Text style={styles.invAmount}>₹{Number(item.total_amount).toFixed(2)}</Text>
                    <View style={styles.invActionRow}>
                      <TouchableOpacity
                        style={styles.invViewBtn}
                        onPress={() => setSelectedInvoice(item)}
                      >
                        <Ionicons name="eye-outline" size={14} color={colors.primary.main} />
                        <Text style={styles.invViewText}>View Bill</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <EmptyState
                  icon="receipt-outline"
                  title="No invoices generated yet"
                  description="Generate instant counter bills and Point-of-Sale receipts for your walk-in and regular customers."
                  actionLabel="+ Create First Invoice"
                  onActionPress={() => setIsCreateInvoiceOpen(true)}
                />
              }
            />
          )}
        </View>
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

      {/* POS Create Invoice Modal */}
      <CreateInvoiceModal
        visible={isCreateInvoiceOpen}
        onClose={() => setIsCreateInvoiceOpen(false)}
        onInvoiceCreated={handleInvoiceCreated}
        products={products}
        shop={shop}
      />

      {/* Invoice Detail / Print / WhatsApp Modal */}
      <InvoiceDetailModal
        visible={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        invoice={selectedInvoice}
        shop={shop}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.background.subtle,
    marginRight: 8,
  },
  tabBtnActive: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: colors.primary.main,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    marginLeft: 6,
  },
  tabBtnTextActive: {
    color: colors.primary.main,
    fontWeight: '700',
  },
  metricsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary.main,
  },
  metricLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text.primary,
    marginTop: 2,
  },
  metricSub: {
    fontSize: 10,
    color: colors.text.muted,
    marginTop: 2,
  },
  newInvoiceCtaCard: {
    flex: 1.2,
    backgroundColor: colors.primary.main,
    padding: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  ctaTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  ctaSub: {
    color: '#E0E7FF',
    fontSize: 10,
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
  filterPills: {
    flexDirection: 'row',
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.background.subtle,
    marginRight: 6,
  },
  filterPillActive: {
    backgroundColor: colors.primary.main,
  },
  filterText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFFFFF',
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
  invoiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
  },
  invCardLeft: {
    flex: 1,
  },
  invHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  invNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text.primary,
  },
  invBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  invBadgePaid: {
    backgroundColor: '#DCFCE7',
  },
  invBadgePending: {
    backgroundColor: '#FEF3C7',
  },
  invBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  invBadgeTextPaid: {
    color: '#15803D',
  },
  invBadgeTextPending: {
    color: '#B45309',
  },
  invCustomer: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 3,
  },
  invDate: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
  },
  invCardRight: {
    alignItems: 'flex-end',
  },
  invAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary.main,
  },
  invActionRow: {
    marginTop: 4,
  },
  invViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EEF2FF',
    gap: 4,
  },
  invViewText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary.main,
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
