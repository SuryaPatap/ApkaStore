import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { shopApi } from '../../api/endpoints';
import { UserRole } from '../../types';

interface RegisterScreenProps {
  onNavigateToLogin: () => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ onNavigateToLogin }) => {
  const { registerCustomer, registerShopkeeper, isLoading } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>('CUSTOMER');

  // Basic User Info
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  // Customer Address
  const [flatNumber, setFlatNumber] = useState('');
  const [buildingNumber, setBuildingNumber] = useState('');
  const [sector, setSector] = useState('');
  const [street, setStreet] = useState('');
  const [locality, setLocality] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [state, setState] = useState('Karnataka');
  const [pincode, setPincode] = useState('');

  // Shopkeeper Shop Info
  const [shopName, setShopName] = useState('');
  const [shopCategory, setShopCategory] = useState('Grocery & Daily Needs');
  const [gstNumber, setGstNumber] = useState('');
  const [shopUpiId, setShopUpiId] = useState('');
  const [shopFlatNumber, setShopFlatNumber] = useState('');
  const [shopBuildingNumber, setShopBuildingNumber] = useState('');
  const [shopSector, setShopSector] = useState('');
  const [shopStreet, setShopStreet] = useState('');
  const [shopLocality, setShopLocality] = useState('');
  const [shopCity, setShopCity] = useState('Bengaluru');
  const [shopState, setShopState] = useState('Karnataka');
  const [shopPincode, setShopPincode] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !phone.trim() || !password.trim()) {
      setErrorMessage('Please fill in your name, email, phone, and password.');
      return;
    }

    if (selectedRole === 'CUSTOMER') {
      if (!city.trim() || !pincode.trim() || !street.trim()) {
        setErrorMessage('Please provide your street/area, city, and pincode to discover stores within 2km.');
        return;
      }
    } else {
      if (!shopName.trim() || !shopPincode.trim() || !shopStreet.trim()) {
        setErrorMessage('Please provide your shop name, shop street/area, and pincode.');
        return;
      }
    }

    setErrorMessage(null);
    try {
      if (selectedRole === 'CUSTOMER') {
        await registerCustomer({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password: password.trim(),
          address: {
            flat_number: flatNumber.trim() || undefined,
            building_number: buildingNumber.trim() || undefined,
            sector: sector.trim() || undefined,
            house_number: flatNumber.trim() || buildingNumber.trim() || '1',
            street: street.trim(),
            locality: locality.trim() || sector.trim() || street.trim(),
            city: city.trim(),
            state: state.trim() || 'Karnataka',
            pincode: pincode.trim(),
          },
        });
      } else {
        await registerShopkeeper({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password: password.trim(),
        });

        // Create the newly registered shopkeeper's store
        try {
          await shopApi.createShop({
            shop_name: shopName.trim(),
            shop_category: shopCategory.trim(),
            gst_number: gstNumber.trim() || undefined,
            upi_id: shopUpiId.trim() || undefined,
            address: {
              flat_number: shopFlatNumber.trim() || undefined,
              building_number: shopBuildingNumber.trim() || undefined,
              sector: shopSector.trim() || undefined,
              street: shopStreet.trim(),
              locality: shopLocality.trim() || shopSector.trim() || shopStreet.trim(),
              city: shopCity.trim(),
              state: shopState.trim() || 'Karnataka',
              pincode: shopPincode.trim(),
            },
          });
        } catch (shopErr) {
          console.log('Shop creation notice:', shopErr);
        }
      }
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.detail || err.message || 'Registration failed. Please verify your details.'
      );
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Ionicons name="storefront" size={28} color="#fff" />
          </View>
          <Text style={styles.brandName}>Join ApkaStore</Text>
          <Text style={styles.brandTagline}>
            Connect with your local 2km neighborhood stores & monthly Udhar Khata
          </Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {/* Role Tabs */}
          <View style={styles.roleTabs}>
            <TouchableOpacity
              style={[
                styles.roleTab,
                selectedRole === 'CUSTOMER' && styles.activeTab,
              ]}
              onPress={() => setSelectedRole('CUSTOMER')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="person"
                size={14}
                color={
                  selectedRole === 'CUSTOMER'
                    ? colors.primary.main
                    : colors.text.secondary
                }
              />
              <Text
                style={[
                  styles.roleTabText,
                  selectedRole === 'CUSTOMER' && styles.activeTabText,
                ]}
              >
                Customer
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roleTab,
                selectedRole === 'SHOPKEEPER' && styles.activeTab,
              ]}
              onPress={() => setSelectedRole('SHOPKEEPER')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="business"
                size={14}
                color={
                  selectedRole === 'SHOPKEEPER'
                    ? colors.primary.main
                    : colors.text.secondary
                }
              />
              <Text
                style={[
                  styles.roleTabText,
                  selectedRole === 'SHOPKEEPER' && styles.activeTabText,
                ]}
              >
                Shopkeeper
              </Text>
            </TouchableOpacity>
          </View>

          {errorMessage && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={colors.danger.main} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Account Details Section */}
          <Text style={styles.sectionHeader}>Personal Account Details</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder={
                selectedRole === 'CUSTOMER' ? 'e.g. Rahul Sharma' : 'e.g. Mohan Gupta'
              }
              placeholderTextColor={colors.text.muted}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.inputLabel}>Mobile Phone</Text>
              <TextInput
                style={styles.input}
                placeholder="10-digit mobile"
                placeholderTextColor={colors.text.muted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="email@example.com"
                placeholderTextColor={colors.text.muted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Minimum 6 characters"
              placeholderTextColor={colors.text.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {/* Customer Specific Address Fields */}
          {selectedRole === 'CUSTOMER' ? (
            <View style={styles.addressSection}>
              <View style={styles.addressTitleRow}>
                <Ionicons name="location" size={16} color={colors.primary.main} />
                <Text style={styles.sectionHeader}>
                  Your Address (For 2km Nearby Store Match)
                </Text>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Flat / Unit #</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Flat 302"
                    placeholderTextColor={colors.text.muted}
                    value={flatNumber}
                    onChangeText={setFlatNumber}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Building / Apartment #</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Tower B / Bldg 12"
                    placeholderTextColor={colors.text.muted}
                    value={buildingNumber}
                    onChangeText={setBuildingNumber}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Sector (Name / Number)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Sector 62 / Sector 4"
                    placeholderTextColor={colors.text.muted}
                    value={sector}
                    onChangeText={setSector}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Street / Road / Block</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 100 Feet Road"
                    placeholderTextColor={colors.text.muted}
                    value={street}
                    onChangeText={setStreet}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>City</Text>
                  <TextInput
                    style={styles.input}
                    value={city}
                    onChangeText={setCity}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>State</Text>
                  <TextInput
                    style={styles.input}
                    value={state}
                    onChangeText={setState}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Pincode</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 560038"
                    placeholderTextColor={colors.text.muted}
                    value={pincode}
                    onChangeText={setPincode}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            </View>
          ) : (
            /* Shopkeeper Specific Store Fields */
            <View style={styles.addressSection}>
              <View style={styles.addressTitleRow}>
                <Ionicons name="storefront" size={16} color={colors.primary.main} />
                <Text style={styles.sectionHeader}>Your Store Details (2km Radius Coverage)</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Shop Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Apka Fresh Mart"
                  placeholderTextColor={colors.text.muted}
                  value={shopName}
                  onChangeText={setShopName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Shop Category</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Grocery & Daily Needs"
                  placeholderTextColor={colors.text.muted}
                  value={shopCategory}
                  onChangeText={setShopCategory}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>GST Number (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 29ABCDE1234F1Z5"
                  placeholderTextColor={colors.text.muted}
                  value={gstNumber}
                  onChangeText={setGstNumber}
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={styles.inputLabel}>Store UPI ID (For Customer Payments)</Text>
                  <View style={{ backgroundColor: '#E0F2FE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ color: '#0369A1', fontSize: 10, fontWeight: '800' }}>UPI DIRECT</Text>
                  </View>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. mohanmart@okaxis or 9876543210@paytm"
                  placeholderTextColor={colors.text.muted}
                  value={shopUpiId}
                  onChangeText={setShopUpiId}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Shop / Unit #</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Shop 12"
                    placeholderTextColor={colors.text.muted}
                    value={shopFlatNumber}
                    onChangeText={setShopFlatNumber}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Building / Complex #</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Plaza 1"
                    placeholderTextColor={colors.text.muted}
                    value={shopBuildingNumber}
                    onChangeText={setShopBuildingNumber}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Sector (Name / Number)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Sector 4"
                    placeholderTextColor={colors.text.muted}
                    value={shopSector}
                    onChangeText={setShopSector}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Street / Market</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Market Main Road"
                    placeholderTextColor={colors.text.muted}
                    value={shopStreet}
                    onChangeText={setShopStreet}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>City</Text>
                  <TextInput
                    style={styles.input}
                    value={shopCity}
                    onChangeText={setShopCity}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>State</Text>
                  <TextInput
                    style={styles.input}
                    value={shopState}
                    onChangeText={setShopState}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Pincode</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 560001"
                    placeholderTextColor={colors.text.muted}
                    value={shopPincode}
                    onChangeText={setShopPincode}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleRegister}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>
                {selectedRole === 'CUSTOMER'
                  ? 'Register & Discover Stores in 2km'
                  : 'Register Store & Connect 2km Neighbors'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Footer */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already registered on ApkaStore? </Text>
            <TouchableOpacity onPress={onNavigateToLogin}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 32,
    paddingBottom: 40,
    alignItems: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: colors.primary.main,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  brandName: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.text.primary,
  },
  brandTagline: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  roleTabs: {
    flexDirection: 'row',
    backgroundColor: colors.background.subtle,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  roleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
  },
  roleTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  activeTabText: {
    fontWeight: '800',
    color: colors.primary.main,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.danger.surface,
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
    gap: 8,
  },
  errorText: {
    color: colors.danger.dark,
    fontSize: 12,
    flex: 1,
    fontWeight: '600',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text.primary,
    marginBottom: 10,
  },
  addressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.secondary,
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.background.subtle,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: colors.text.primary,
  },
  addressSection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  row: {
    flexDirection: 'row',
  },
  submitButton: {
    backgroundColor: colors.primary.main,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 14,
    shadowColor: colors.primary.main,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  footerText: {
    color: colors.text.secondary,
    fontSize: 13,
  },
  loginLink: {
    color: colors.primary.main,
    fontSize: 13,
    fontWeight: '800',
  },
});
