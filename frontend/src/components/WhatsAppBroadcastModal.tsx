import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { Product, Shop } from '../types';
import {
  sendWhatsApp,
  generateNewArrivalsMessage,
  generateOfferMessage,
} from '../utils/whatsapp';

interface WhatsAppBroadcastModalProps {
  visible: boolean;
  onClose: () => void;
  products: Product[];
  shop: Shop | null;
  initialType?: 'NEW_ARRIVALS' | 'OFFER' | 'ANNOUNCEMENT';
  preSelectedProducts?: Product[];
}

export const WhatsAppBroadcastModal: React.FC<WhatsAppBroadcastModalProps> = ({
  visible,
  onClose,
  products,
  shop,
  initialType = 'NEW_ARRIVALS',
  preSelectedProducts,
}) => {
  const [activeTab, setActiveTab] = useState<'NEW_ARRIVALS' | 'OFFER' | 'ANNOUNCEMENT'>(initialType);

  // Form Fields
  const [headline, setHeadline] = useState('');
  const [offerDiscount, setOfferDiscount] = useState('Flat 10% Off on all Grocery Essentials!');
  const [offerExpiry, setOfferExpiry] = useState('This Sunday');
  const [announcementText, setAnnouncementText] = useState(
    '🚚 Free Home Delivery available on all orders above ₹200! Order now on ApkaStore.'
  );

  // Selected Products for Promo
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);

  useEffect(() => {
    if (visible) {
      setActiveTab(initialType);
      if (preSelectedProducts && preSelectedProducts.length > 0) {
        setSelectedProductIds(preSelectedProducts.map((p) => p.id));
      } else if (products.length > 0) {
        // default select top 4 products
        setSelectedProductIds(products.slice(0, 4).map((p) => p.id));
      }
    }
  }, [visible, initialType, preSelectedProducts, products]);

  const toggleProductSelect = (id: number) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectedProductsList = products.filter((p) => selectedProductIds.includes(p.id));

  // Compute live message preview
  const getLiveMessage = (): string => {
    const storeName = shop?.shop_name || 'ApkaStore';
    if (activeTab === 'NEW_ARRIVALS') {
      return generateNewArrivalsMessage(shop, selectedProductsList, headline.trim() || undefined);
    }
    if (activeTab === 'OFFER') {
      return generateOfferMessage(
        shop,
        headline.trim() || '🔥 SPECIAL FESTIVAL DISCOUNT',
        offerDiscount.trim(),
        selectedProductsList,
        offerExpiry.trim() || undefined
      );
    }
    // Custom Announcement
    let msg = `📢 *IMPORTANT ANNOUNCEMENT - ${storeName.toUpperCase()}*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
    msg += `${announcementText.trim()}\n\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🛒 Shop online at: https://apkastore.vercel.app\n`;
    if (shop?.shop_phone) {
      msg += `📞 Contact Store: +91 ${shop.shop_phone}\n`;
    }
    msg += `🙏 *Thank you for choosing ${storeName}!*`;
    return msg;
  };

  const handleShare = () => {
    const msg = getLiveMessage();
    sendWhatsApp(undefined, msg);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconWrap}>
                <Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>WhatsApp Marketing & Broadcast</Text>
                <Text style={styles.modalSub}>Send customer bills, offers, and new item updates</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Segmented Tab Switcher */}
          <View style={styles.tabSwitcher}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'NEW_ARRIVALS' && styles.tabBtnActive]}
              onPress={() => setActiveTab('NEW_ARRIVALS')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="sparkles"
                size={14}
                color={activeTab === 'NEW_ARRIVALS' ? '#166534' : colors.text.secondary}
              />
              <Text style={[styles.tabBtnText, activeTab === 'NEW_ARRIVALS' && styles.tabBtnTextActive]}>
                New Stock
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'OFFER' && styles.tabBtnActive]}
              onPress={() => setActiveTab('OFFER')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="pricetag"
                size={14}
                color={activeTab === 'OFFER' ? '#166534' : colors.text.secondary}
              />
              <Text style={[styles.tabBtnText, activeTab === 'OFFER' && styles.tabBtnTextActive]}>
                Sale / Offer
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'ANNOUNCEMENT' && styles.tabBtnActive]}
              onPress={() => setActiveTab('ANNOUNCEMENT')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="megaphone"
                size={14}
                color={activeTab === 'ANNOUNCEMENT' ? '#166534' : colors.text.secondary}
              />
              <Text style={[styles.tabBtnText, activeTab === 'ANNOUNCEMENT' && styles.tabBtnTextActive]}>
                Notice
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Tab 1: New Arrivals Form */}
            {activeTab === 'NEW_ARRIVALS' && (
              <View style={styles.formCard}>
                <Text style={styles.formLabel}>Custom Headline (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder={`e.g. 🌾 Fresh Stock Just Arrived at ${shop?.shop_name || 'Store'}!`}
                  placeholderTextColor={colors.text.muted}
                  value={headline}
                  onChangeText={setHeadline}
                />
              </View>
            )}

            {/* Tab 2: Offer Form */}
            {activeTab === 'OFFER' && (
              <View style={styles.formCard}>
                <Text style={styles.formLabel}>Sale Title</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 🔥 WEEKEND MEGA DISCOUNT SALE"
                  placeholderTextColor={colors.text.muted}
                  value={headline}
                  onChangeText={setHeadline}
                />

                <View style={styles.gridRow}>
                  <View style={[styles.inputGroup, { flex: 1.4, marginRight: 8 }]}>
                    <Text style={styles.formLabel}>Discount Details</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Flat 15% Off"
                      placeholderTextColor={colors.text.muted}
                      value={offerDiscount}
                      onChangeText={setOfferDiscount}
                    />
                  </View>

                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.formLabel}>Valid Until</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. This Sunday"
                      placeholderTextColor={colors.text.muted}
                      value={offerExpiry}
                      onChangeText={setOfferExpiry}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Tab 3: Announcement Form */}
            {activeTab === 'ANNOUNCEMENT' && (
              <View style={styles.formCard}>
                <Text style={styles.formLabel}>Store Notice Message</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  multiline
                  numberOfLines={4}
                  placeholder="Type your store message, delivery update, or holiday notice..."
                  placeholderTextColor={colors.text.muted}
                  value={announcementText}
                  onChangeText={setAnnouncementText}
                />
              </View>
            )}

            {/* Product Selector (for New Arrivals and Offers) */}
            {activeTab !== 'ANNOUNCEMENT' && products.length > 0 && (
              <View style={styles.productPickerCard}>
                <View style={styles.pickerHeader}>
                  <Text style={styles.formLabel}>
                    Select Items to Feature ({selectedProductIds.length} chosen)
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      if (selectedProductIds.length === products.length) {
                        setSelectedProductIds([]);
                      } else {
                        setSelectedProductIds(products.map((p) => p.id));
                      }
                    }}
                  >
                    <Text style={styles.toggleAllText}>
                      {selectedProductIds.length === products.length ? 'Clear All' : 'Select All'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                  {products.map((prod) => {
                    const isSelected = selectedProductIds.includes(prod.id);
                    return (
                      <TouchableOpacity
                        key={prod.id}
                        style={[styles.productChip, isSelected && styles.productChipActive]}
                        onPress={() => toggleProductSelect(prod.id)}
                        activeOpacity={0.75}
                      >
                        <Ionicons
                          name={isSelected ? 'checkmark-circle' : 'add-circle-outline'}
                          size={15}
                          color={isSelected ? '#166534' : colors.text.muted}
                        />
                        <View style={{ marginLeft: 6 }}>
                          <Text
                            style={[styles.chipTitle, isSelected && styles.chipTitleActive]}
                            numberOfLines={1}
                          >
                            {prod.name}
                          </Text>
                          <Text style={styles.chipPrice}>₹{prod.price}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Live WhatsApp Message Preview Card */}
            <View style={styles.previewContainer}>
              <View style={styles.previewHeader}>
                <Ionicons name="eye-outline" size={16} color="#075E54" />
                <Text style={styles.previewTitle}>Live WhatsApp Message Preview</Text>
              </View>

              <View style={styles.waBubble}>
                <Text style={styles.waBubbleText}>{getLiveMessage()}</Text>
                <Text style={styles.waTime}>Just now • ✓✓</Text>
              </View>
            </View>
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Close</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
              <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
              <Text style={styles.shareBtnText}>Share to WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '94%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    ...Platform.select({
      web: { boxShadow: '0 20px 30px -5px rgba(0,0,0,0.25)' },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F8FAFC',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text.primary,
  },
  modalSub: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  tabSwitcher: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#22C55E',
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  tabBtnTextActive: {
    color: '#166534',
  },
  modalBody: {
    flex: 1,
    padding: 14,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 6,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: colors.text.primary,
    backgroundColor: '#F8FAFC',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 8,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  inputGroup: {
    marginBottom: 2,
  },
  productPickerCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  toggleAllText: {
    fontSize: 11,
    color: colors.primary.main,
    fontWeight: '700',
  },
  chipsScroll: {
    flexDirection: 'row',
  },
  productChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    minWidth: 110,
  },
  productChipActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#22C55E',
  },
  chipTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.primary,
    maxWidth: 120,
  },
  chipTitleActive: {
    color: '#166534',
    fontWeight: '700',
  },
  chipPrice: {
    fontSize: 11,
    color: colors.text.muted,
  },
  previewContainer: {
    backgroundColor: '#EFEAE2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#075E54',
  },
  waBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#25D366',
  },
  waBubbleText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#111827',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  waTime: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 6,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 10,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 10,
    gap: 6,
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
