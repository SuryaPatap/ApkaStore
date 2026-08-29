import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, Shop, Address } from '../types';
import { authApi, shopApi, customerApi } from '../api/endpoints';
import { setAuthToken } from '../api/client';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  token: string | null;
  shop: Shop | null; // For Shopkeeper
  selectedShop: Shop | null; // For Customer (currently selected nearby shop within 2km)
  nearbyShops: Shop[];
  isLoading: boolean;
  login: (email: string, pass: string, preferredRole?: UserRole) => Promise<void>;
  registerCustomer: (data: any) => Promise<void>;
  registerShopkeeper: (data: any) => Promise<void>;
  logout: () => void;
  switchRole: (newRole: UserRole) => void;
  setMyShop: (shop: Shop) => void;
  selectShop: (shop: Shop) => Promise<void>;
  refreshNearbyShops: () => Promise<Shop[]>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>('CUSTOMER');
  const [token, setToken] = useState<string | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [selectedShop, setSelectedShopState] = useState<Shop | null>(null);
  const [nearbyShops, setNearbyShops] = useState<Shop[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const refreshNearbyShops = async (): Promise<Shop[]> => {
    try {
      const shops = await shopApi.getNearbyShops({ max_distance_km: 2.0 });
      setNearbyShops(shops);

      // If customer has a previously selected shop still nearby within 2km, keep it
      if (shops.length > 0) {
        const currentlySelected = shops.find((s) => s.is_selected) || shops[0];
        setSelectedShopState(currentlySelected);
      } else {
        setSelectedShopState(null);
      }
      return shops;
    } catch (err) {
      console.warn('Failed to load nearby shops:', err);
      return [];
    }
  };

  const selectShop = async (targetShop: Shop) => {
    try {
      await shopApi.selectShop(targetShop.id);
      setSelectedShopState(targetShop);
      // Refresh nearby list so is_selected state updates
      await refreshNearbyShops();
    } catch (err) {
      console.warn('Failed to select shop:', err);
      setSelectedShopState(targetShop);
    }
  };

  const refreshUserProfile = async () => {
    if (role === 'CUSTOMER') {
      try {
        const me = await customerApi.getMe();
        if (me && user) {
          setUser((prev) => (prev ? { ...prev, ...me } : prev));
        }
      } catch (e) {
        // Silent error handling
      }
      await refreshNearbyShops();
    } else if (role === 'SHOPKEEPER') {
      try {
        const shopData = await shopApi.getMyShop();
        setShop(shopData);
      } catch (e) {
        // Silent error handling
      }
    }
  };

  const login = async (email: string, pass: string, preferredRole: UserRole = 'CUSTOMER') => {
    setIsLoading(true);
    try {
      // Pass preferred role to backend for strict validation
      const data = await authApi.login(email, pass, preferredRole.toLowerCase());
      const accessToken = data.access_token;
      setAuthToken(accessToken);
      setToken(accessToken);

      const resolvedRole: UserRole =
        (data.role?.toUpperCase() as UserRole) ||
        (data.user?.role?.toUpperCase() as UserRole) ||
        preferredRole;

      setRole(resolvedRole);

      // Fetch dynamic user profile from backend
      let profileUser: User = data.user || {
        id: data.user_id || 1,
        name: data.name || email.split('@')[0],
        email: email,
        phone: data.phone || '',
        role: resolvedRole,
        is_active: true,
      };

      if (resolvedRole === 'CUSTOMER') {
        try {
          const me = await customerApi.getMe();
          if (me) {
            profileUser = { ...profileUser, ...me };
          }
        } catch (e) {
          // Keep current profile
        }
      }

      setUser(profileUser);

      if (resolvedRole === 'SHOPKEEPER') {
        try {
          const shopData = await shopApi.getMyShop();
          setShop(shopData);
        } catch (e) {
          setShop(null);
        }
      } else {
        // Customer: Load shops under 2km
        await refreshNearbyShops();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const registerCustomer = async (data: any) => {
    setIsLoading(true);
    try {
      await authApi.registerCustomer(data);
      // Auto login freshly registered user as CUSTOMER
      await login(data.email, data.password, 'CUSTOMER');
    } finally {
      setIsLoading(false);
    }
  };

  const registerShopkeeper = async (data: any) => {
    setIsLoading(true);
    try {
      await authApi.registerShopkeeper(data);
      // Auto login freshly registered shopkeeper as SHOPKEEPER
      await login(data.email, data.password, 'SHOPKEEPER');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setShop(null);
    setSelectedShopState(null);
    setNearbyShops([]);
    setAuthToken(null);
  };

  const switchRole = (newRole: UserRole) => {
    setRole(newRole);
    if (user) {
      setUser({ ...user, role: newRole });
    }
  };

  const setMyShop = (newShop: Shop) => {
    setShop(newShop);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        token,
        shop,
        selectedShop,
        nearbyShops,
        isLoading,
        login,
        registerCustomer,
        registerShopkeeper,
        logout,
        switchRole,
        setMyShop,
        selectShop,
        refreshNearbyShops,
        refreshUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
