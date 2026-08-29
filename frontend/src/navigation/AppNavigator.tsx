import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, SafeAreaView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

// Auth Screens
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';

// Customer Screens
import { HomeScreen } from '../screens/customer/HomeScreen';
import { CartScreen } from '../screens/customer/CartScreen';
import { OrdersScreen } from '../screens/customer/OrdersScreen';
import { KhataScreen } from '../screens/customer/KhataScreen';
import { ShoppingListScreen } from '../screens/customer/ShoppingListScreen';
import { NotificationsScreen } from '../screens/customer/NotificationsScreen';
import { CustomerProfileScreen } from '../screens/customer/CustomerProfileScreen';
import { ParchiScreen } from '../screens/customer/ParchiScreen';

// Shopkeeper Screens
import { DashboardScreen } from '../screens/shopkeeper/DashboardScreen';
import { OrdersManageScreen } from '../screens/shopkeeper/OrdersManageScreen';
import { InventoryScreen } from '../screens/shopkeeper/InventoryScreen';
import { KhataManageScreen } from '../screens/shopkeeper/KhataManageScreen';
import { ShopkeeperProfileScreen } from '../screens/shopkeeper/ShopkeeperProfileScreen';
import { ParchiInboxScreen } from '../screens/shopkeeper/ParchiInboxScreen';

type CustomerTab = 'HOME' | 'CART' | 'KHATA' | 'ORDERS' | 'LIST' | 'NOTIFICATIONS' | 'PROFILE';
type ShopkeeperTab = 'DASHBOARD' | 'ORDERS' | 'INVENTORY' | 'KHATA' | 'PARCHI' | 'PROFILE';

export const AppNavigator: React.FC = () => {
  const { user, role } = useAuth();
  const { totalItems } = useCart();

  const [authScreen, setAuthScreen] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [customerTab, setCustomerTab] = useState<CustomerTab>('HOME');
  const [shopkeeperTab, setShopkeeperTab] = useState<ShopkeeperTab>('DASHBOARD');

  // If not logged in, render Auth flow
  if (!user) {
    return authScreen === 'LOGIN' ? (
      <LoginScreen onNavigateToRegister={() => setAuthScreen('REGISTER')} />
    ) : (
      <RegisterScreen onNavigateToLogin={() => setAuthScreen('LOGIN')} />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Main Content Area */}
        <View style={styles.screenContainer}>
          {role === 'CUSTOMER' ? (
            <>
              {customerTab === 'HOME' && (
                <HomeScreen
                  onNavigateToCart={() => setCustomerTab('CART')}
                  onNavigateToNotifications={() => setCustomerTab('NOTIFICATIONS')}
                />
              )}
              {customerTab === 'CART' && (
                <CartScreen
                  onContinueShopping={() => setCustomerTab('HOME')}
                  onOrderPlaced={() => setCustomerTab('ORDERS')}
                />
              )}
              {customerTab === 'KHATA' && <KhataScreen />}
              {customerTab === 'ORDERS' && (
                <OrdersScreen onShopNowPress={() => setCustomerTab('HOME')} />
              )}
              {customerTab === 'LIST' && <ParchiScreen />}
              {customerTab === 'NOTIFICATIONS' && (
                <NotificationsScreen onBackPress={() => setCustomerTab('HOME')} />
              )}
              {customerTab === 'PROFILE' && <CustomerProfileScreen />}
            </>
          ) : (
            <>
              {shopkeeperTab === 'DASHBOARD' && (
                <DashboardScreen
                  onNavigateToOrders={() => setShopkeeperTab('ORDERS')}
                  onNavigateToInventory={() => setShopkeeperTab('INVENTORY')}
                  onNavigateToKhata={() => setShopkeeperTab('KHATA')}
                />
              )}
              {shopkeeperTab === 'ORDERS' && <OrdersManageScreen />}
              {shopkeeperTab === 'INVENTORY' && <InventoryScreen />}
              {shopkeeperTab === 'KHATA' && <KhataManageScreen />}
              {shopkeeperTab === 'PARCHI' && <ParchiInboxScreen />}
              {shopkeeperTab === 'PROFILE' && <ShopkeeperProfileScreen />}
            </>
          )}
        </View>

        {/* Bottom Tab Bar */}
        <View style={styles.tabBar}>
          {role === 'CUSTOMER' ? (
            <>
              <TouchableOpacity
                style={styles.tabItem}
                onPress={() => setCustomerTab('HOME')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={customerTab === 'HOME' ? 'storefront' : 'storefront-outline'}
                  size={20}
                  color={customerTab === 'HOME' ? colors.primary.main : colors.text.secondary}
                />
                <Text style={[styles.tabLabel, customerTab === 'HOME' && styles.activeTabLabel]}>
                  Store
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.tabItem}
                onPress={() => setCustomerTab('CART')}
                activeOpacity={0.8}
              >
                <View style={styles.iconWithBadge}>
                  <Ionicons
                    name={customerTab === 'CART' ? 'cart' : 'cart-outline'}
                    size={20}
                    color={customerTab === 'CART' ? colors.primary.main : colors.text.secondary}
                  />
                  {totalItems > 0 && (
                    <View style={styles.cartBadge}>
                      <Text style={styles.cartBadgeText}>{totalItems}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.tabLabel, customerTab === 'CART' && styles.activeTabLabel]}>
                  Cart
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.tabItem}
                onPress={() => setCustomerTab('KHATA')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={customerTab === 'KHATA' ? 'wallet' : 'wallet-outline'}
                  size={20}
                  color={customerTab === 'KHATA' ? colors.primary.main : colors.text.secondary}
                />
                <Text style={[styles.tabLabel, customerTab === 'KHATA' && styles.activeTabLabel]}>
                  Khata
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.tabItem}
                onPress={() => setCustomerTab('ORDERS')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={customerTab === 'ORDERS' ? 'receipt' : 'receipt-outline'}
                  size={20}
                  color={customerTab === 'ORDERS' ? colors.primary.main : colors.text.secondary}
                />
                <Text style={[styles.tabLabel, customerTab === 'ORDERS' && styles.activeTabLabel]}>
                  Orders
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.tabItem}
                onPress={() => setCustomerTab('LIST')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={customerTab === 'LIST' ? 'list' : 'list-outline'}
                  size={20}
                  color={customerTab === 'LIST' ? colors.primary.main : colors.text.secondary}
                />
                <Text style={[styles.tabLabel, customerTab === 'LIST' && styles.activeTabLabel]}>
                  Parchi
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.tabItem}
                onPress={() => setCustomerTab('PROFILE')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={customerTab === 'PROFILE' ? 'person-circle' : 'person-circle-outline'}
                  size={22}
                  color={customerTab === 'PROFILE' ? colors.primary.main : colors.text.secondary}
                />
                <Text style={[styles.tabLabel, customerTab === 'PROFILE' && styles.activeTabLabel]}>
                  Profile
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.tabItem}
                onPress={() => setShopkeeperTab('DASHBOARD')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={shopkeeperTab === 'DASHBOARD' ? 'grid' : 'grid-outline'}
                  size={20}
                  color={shopkeeperTab === 'DASHBOARD' ? colors.primary.main : colors.text.secondary}
                />
                <Text style={[styles.tabLabel, shopkeeperTab === 'DASHBOARD' && styles.activeTabLabel]}>
                  Dashboard
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.tabItem}
                onPress={() => setShopkeeperTab('ORDERS')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={shopkeeperTab === 'ORDERS' ? 'receipt' : 'receipt-outline'}
                  size={20}
                  color={shopkeeperTab === 'ORDERS' ? colors.primary.main : colors.text.secondary}
                />
                <Text style={[styles.tabLabel, shopkeeperTab === 'ORDERS' && styles.activeTabLabel]}>
                  Orders
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.tabItem}
                onPress={() => setShopkeeperTab('INVENTORY')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={shopkeeperTab === 'INVENTORY' ? 'cube' : 'cube-outline'}
                  size={20}
                  color={shopkeeperTab === 'INVENTORY' ? colors.primary.main : colors.text.secondary}
                />
                <Text style={[styles.tabLabel, shopkeeperTab === 'INVENTORY' && styles.activeTabLabel]}>
                  Inventory
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.tabItem}
                onPress={() => setShopkeeperTab('KHATA')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={shopkeeperTab === 'KHATA' ? 'book' : 'book-outline'}
                  size={20}
                  color={shopkeeperTab === 'KHATA' ? colors.primary.main : colors.text.secondary}
                />
                <Text style={[styles.tabLabel, shopkeeperTab === 'KHATA' && styles.activeTabLabel]}>
                  Khata
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.tabItem}
                onPress={() => setShopkeeperTab('PARCHI')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={shopkeeperTab === 'PARCHI' ? 'chatbubbles' : 'chatbubbles-outline'}
                  size={20}
                  color={shopkeeperTab === 'PARCHI' ? colors.primary.main : colors.text.secondary}
                />
                <Text style={[styles.tabLabel, shopkeeperTab === 'PARCHI' && styles.activeTabLabel]}>
                  Parchi
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.tabItem}
                onPress={() => setShopkeeperTab('PROFILE')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={shopkeeperTab === 'PROFILE' ? 'person-circle' : 'person-circle-outline'}
                  size={22}
                  color={shopkeeperTab === 'PROFILE' ? colors.primary.main : colors.text.secondary}
                />
                <Text style={[styles.tabLabel, shopkeeperTab === 'PROFILE' && styles.activeTabLabel]}>
                  Profile
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  screenContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 4 : 8,
    elevation: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: 2,
  },
  activeTabLabel: {
    color: colors.primary.dark,
    fontWeight: '800',
  },
  iconWithBadge: {
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: colors.primary.main,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
});
