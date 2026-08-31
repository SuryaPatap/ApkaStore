import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { parchiApi, ParchiMessage, ParchiThread, ParchiDetail, ParchiCustomItem } from '../../api/endpoints';
import { shopApi } from '../../api/endpoints';
import { Product } from '../../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatTime = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

// ─── Write Custom Parchi List Modal ──────────────────────────────────────────

interface ParchiListModalProps {
  visible: boolean;
  shopName: string;
  onClose: () => void;
  onSend: (items: ParchiCustomItem[], paymentMethod: string, notes: string) => void;
}

const ParchiListModal: React.FC<ParchiListModalProps> = ({ visible, shopName, onClose, onSend }) => {
  const [items, setItems] = useState<ParchiCustomItem[]>([]);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'UDHAR_KHATA'>('COD');
  const [notes, setNotes] = useState('');

  const handleAddItem = () => {
    if (!name.trim()) {
      Alert.alert('Item Name', 'Please type an item name (e.g. Milk, Atta, Ghee).');
      return;
    }
    setItems(prev => [...prev, { name: name.trim(), quantity: quantity.trim() || '1' }]);
    setName('');
    setQuantity('1');
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSendParchi = () => {
    if (items.length === 0) {
      Alert.alert('Empty Parchi', 'Please add at least one item to your Parchi.');
      return;
    }
    onSend(items, paymentMethod, notes.trim());
    setItems([]);
    setNotes('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={pm.container}>
        {/* Header */}
        <View style={pm.header}>
          <TouchableOpacity onPress={onClose} style={pm.closeBtn}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={pm.title}>📝 Digital Parchi</Text>
            <Text style={pm.subtitle}>Send grocery list to {shopName}</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Input Card */}
        <View style={pm.inputCard}>
          <Text style={pm.inputHeader}>Add Grocery Item</Text>
          <View style={pm.inputRow}>
            <TextInput
              style={pm.itemInput}
              placeholder="e.g. Milk, Aashirvaad Atta, Ghee..."
              placeholderTextColor={colors.text.muted}
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={pm.qtyInput}
              placeholder="Qty (2 pkt)"
              placeholderTextColor={colors.text.muted}
              value={quantity}
              onChangeText={setQuantity}
            />
            <TouchableOpacity style={pm.addBtn} onPress={handleAddItem} activeOpacity={0.8}>
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* List of Added Items */}
        <ScrollView style={pm.itemsList} contentContainerStyle={{ paddingBottom: 20 }}>
          {items.map((item, idx) => (
            <View key={idx} style={pm.itemCard}>
              <View style={pm.bullet}>
                <Text style={pm.bulletText}>{idx + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={pm.itemName}>{item.name}</Text>
                <Text style={pm.itemQty}>Quantity: {item.quantity}</Text>
              </View>
              <TouchableOpacity onPress={() => handleRemoveItem(idx)} style={pm.delBtn}>
                <Ionicons name="trash-outline" size={18} color={colors.danger.main} />
              </TouchableOpacity>
            </View>
          ))}

          {items.length === 0 && (
            <View style={pm.emptyBox}>
              <Ionicons name="clipboard-outline" size={48} color={colors.text.muted} />
              <Text style={pm.emptyTitle}>Your Parchi is Empty</Text>
              <Text style={pm.emptySub}>
                Type daily grocery items above (like Atta, Milk, Oil, Sugar) and tap '+' to add.
              </Text>
            </View>
          )}

          {items.length > 0 && (
            <View style={pm.optionsBox}>
              {/* Payment selector */}
              <Text style={pm.optLabel}>Preferred Payment Method:</Text>
              <View style={pm.payRow}>
                {(['COD', 'UDHAR_KHATA'] as const).map(pmMode => (
                  <TouchableOpacity
                    key={pmMode}
                    style={[pm.payBtn, paymentMethod === pmMode && pm.payBtnActive]}
                    onPress={() => setPaymentMethod(pmMode)}
                  >
                    <Text style={[pm.payBtnText, paymentMethod === pmMode && pm.payBtnTextActive]}>
                      {pmMode === 'COD' ? '💵 Cash on Delivery' : '📒 Udhar Khata'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Instructions */}
              <Text style={[pm.optLabel, { marginTop: 12 }]}>Special Instructions (Optional):</Text>
              <TextInput
                style={pm.noteInput}
                placeholder="e.g. Deliver before 6 PM, pack fresh packets..."
                placeholderTextColor={colors.text.muted}
                value={notes}
                onChangeText={setNotes}
              />
            </View>
          )}
        </ScrollView>

        {/* Send Button */}
        {items.length > 0 && (
          <View style={pm.footer}>
            <TouchableOpacity style={pm.sendParchiBtn} onPress={handleSendParchi} activeOpacity={0.85}>
              <Ionicons name="paper-plane" size={18} color="#fff" />
              <Text style={pm.sendParchiBtnText}>Send Parchi to Shopkeeper ({items.length} items)</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};

// ─── Product Catalog Picker Modal ─────────────────────────────────────────────

interface ProductPickerProps {
  visible: boolean;
  shopId: number;
  onClose: () => void;
  onOrder: (items: { product_id: number; quantity: number }[], paymentMethod: string) => void;
}

const ProductPicker: React.FC<ProductPickerProps> = ({ visible, shopId, onClose, onOrder }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'UDHAR_KHATA'>('COD');

  useEffect(() => {
    if (visible) loadProducts();
  }, [visible]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await shopApi.getShopProducts(shopId);
      setProducts(data || []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const updateCart = (productId: number, delta: number) => {
    setCart(prev => {
      const next = { ...prev };
      const current = next[productId] || 0;
      const updated = current + delta;
      if (updated <= 0) delete next[productId];
      else next[productId] = updated;
      return next;
    });
  };

  const cartCount = Object.values(cart).reduce((sum, q) => sum + q, 0);

  const handleOrder = () => {
    const items = Object.entries(cart).map(([id, qty]) => ({
      product_id: Number(id),
      quantity: qty,
    }));
    if (items.length === 0) {
      Alert.alert('Empty Selection', 'Please add at least one product.');
      return;
    }
    onOrder(items, paymentMethod);
    setCart({});
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={pp.container}>
        <View style={pp.header}>
          <TouchableOpacity onPress={onClose} style={pp.closeBtn}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={pp.title}>Order Store Products</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={pp.payRow}>
          <Text style={pp.payLabel}>Payment:</Text>
          {(['COD', 'UDHAR_KHATA'] as const).map(pm => (
            <TouchableOpacity
              key={pm}
              style={[pp.payBtn, paymentMethod === pm && pp.payBtnActive]}
              onPress={() => setPaymentMethod(pm)}
            >
              <Text style={[pp.payBtnText, paymentMethod === pm && pp.payBtnTextActive]}>
                {pm === 'COD' ? '💵 Cash' : '📒 Udhar'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary.main} size="large" />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {products.map(product => (
              <View key={product.id} style={pp.productRow}>
                <View style={pp.productInfo}>
                  <Text style={pp.productName}>{product.name}</Text>
                  <Text style={pp.productPrice}>₹{product.price} / {product.unit}</Text>
                </View>
                <View style={pp.qtyRow}>
                  <TouchableOpacity style={pp.qtyBtn} onPress={() => updateCart(product.id, -1)}>
                    <Text style={pp.qtyBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={pp.qtyText}>{cart[product.id] || 0}</Text>
                  <TouchableOpacity style={pp.qtyBtn} onPress={() => updateCart(product.id, 1)}>
                    <Text style={pp.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {products.length === 0 && (
              <Text style={{ textAlign: 'center', color: colors.text.secondary, marginTop: 30 }}>
                No listed catalog products for this store.
              </Text>
            )}
          </ScrollView>
        )}

        {cartCount > 0 && (
          <View style={pp.footer}>
            <TouchableOpacity style={pp.orderBtn} onPress={handleOrder}>
              <Text style={pp.orderBtnText}>🛒 Send Order Request ({cartCount} items)</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};

// ─── Message Bubble ───────────────────────────────────────────────────────────

interface BubbleProps {
  msg: ParchiMessage;
}

const MessageBubble: React.FC<BubbleProps> = ({ msg }) => {
  const isMine = msg.sender_role === 'CUSTOMER';
  const isSystem = msg.sender_role === 'SYSTEM';
  const isParchiList = msg.message_type === 'PARCHI_LIST';
  const isOrder = msg.message_type === 'ORDER_REQUEST';
  const isConfirm = msg.message_type === 'ORDER_CONFIRMED';
  const isDecline = msg.message_type === 'ORDER_DECLINED';

  if (isSystem) {
    return (
      <View style={bub.systemRow}>
        <Ionicons name="sparkles" size={14} color={colors.primary.main} />
        <Text style={bub.systemText}>{msg.content}</Text>
      </View>
    );
  }

  return (
    <View style={[bub.row, isMine ? bub.rowRight : bub.rowLeft]}>
      <View
        style={[
          bub.bubble,
          isMine ? bub.bubbleMine : bub.bubbleTheirs,
          isParchiList && bub.bubbleParchiList,
          isOrder && bub.bubbleOrder,
          isConfirm && bub.bubbleConfirm,
          isDecline && bub.bubbleDecline,
        ]}
      >
        {isParchiList && (
          <View style={bub.parchiBadge}>
            <Ionicons name="clipboard" size={12} color={colors.gold.dark} />
            <Text style={bub.parchiBadgeText}>DIGITAL PARCHI LIST</Text>
          </View>
        )}
        {isOrder && (
          <View style={bub.orderBadge}>
            <Ionicons name="cart" size={12} color={colors.primary.dark} />
            <Text style={bub.orderBadgeText}>CATALOG ORDER REQUEST</Text>
          </View>
        )}
        {isConfirm && (
          <View style={[bub.orderBadge, { backgroundColor: '#D1FAE5' }]}>
            <Text style={[bub.orderBadgeText, { color: '#065F46' }]}>✅ CONFIRMED BY STORE</Text>
          </View>
        )}
        {isDecline && (
          <View style={[bub.orderBadge, { backgroundColor: '#FEE2E2' }]}>
            <Text style={[bub.orderBadgeText, { color: '#991B1B' }]}>❌ DECLINED</Text>
          </View>
        )}

        <Text style={[bub.text, isMine && !isParchiList && bub.textMine]}>{msg.content}</Text>
        {msg.order_id && (
          <Text style={[bub.orderRef, isMine && !isParchiList && { color: '#E2E8F0' }]}>
            Linked Order #{msg.order_id}
          </Text>
        )}
        <Text style={[bub.time, isMine && !isParchiList && bub.timeMine]}>
          {formatTime(msg.created_at)}
        </Text>
      </View>
    </View>
  );
};

// ─── Main Customer Parchi Screen ──────────────────────────────────────────────

export const ParchiScreen: React.FC = () => {
  const { selectedShop } = useAuth();
  const [parchi, setParchi] = useState<ParchiThread | null>(null);
  const [messages, setMessages] = useState<ParchiMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showParchiListModal, setShowParchiListModal] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const lastMsgId = useRef<number>(0);

  // ── Init & Auto-connect ──────────────────────────────────────────────────
  const loadOrStart = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let detail: ParchiDetail | null = null;
      try {
        detail = await parchiApi.getMyParchi();
      } catch (e: any) {
        // Auto start if selectedShop is available
        const thread = await parchiApi.startParchi(selectedShop?.id);
        detail = await parchiApi.getMyParchi();
      }

      if (detail) {
        setParchi(detail.parchi);
        setMessages(detail.messages || []);
        if (detail.messages && detail.messages.length > 0) {
          lastMsgId.current = detail.messages[detail.messages.length - 1].id;
        }
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not connect to Parchi.');
    } finally {
      setLoading(false);
    }
  }, [selectedShop]);

  useEffect(() => {
    loadOrStart();
  }, [loadOrStart]);

  // ── Polling ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!parchi) return;
    const poll = setInterval(async () => {
      try {
        const newMsgs = await parchiApi.getMessages(parchi.id, lastMsgId.current);
        if (newMsgs && newMsgs.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const fresh = newMsgs.filter(m => !existingIds.has(m.id));
            return fresh.length > 0 ? [...prev, ...fresh] : prev;
          });
          lastMsgId.current = newMsgs[newMsgs.length - 1].id;
          flatListRef.current?.scrollToEnd({ animated: true });
        }
      } catch {
        // silent polling catch
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [parchi]);

  // ── Start manually ────────────────────────────────────────────────────────
  const handleStart = async () => {
    try {
      setStarting(true);
      setError(null);
      await parchiApi.startParchi(selectedShop?.id);
      const detail = await parchiApi.getMyParchi();
      setParchi(detail.parchi);
      setMessages(detail.messages || []);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not start Parchi.');
    } finally {
      setStarting(false);
    }
  };

  // ── Send text ─────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!parchi || !inputText.trim()) return;
    try {
      setSending(true);
      const msg = await parchiApi.sendMessage(parchi.id, inputText.trim());
      setMessages(prev => [...prev, msg]);
      lastMsgId.current = msg.id;
      setInputText('');
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch {
      Alert.alert('Error', 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  // ── Send Parchi List ──────────────────────────────────────────────────────
  const handleSendParchiList = async (items: ParchiCustomItem[], paymentMethod: string, notes: string) => {
    if (!parchi) return;
    try {
      const msg = await parchiApi.sendParchiList(parchi.id, items, paymentMethod, notes);
      setMessages(prev => [...prev, msg]);
      lastMsgId.current = msg.id;
      flatListRef.current?.scrollToEnd({ animated: true });
      Alert.alert('Parchi Sent 🎉', 'Your digital grocery list has been sent directly to the storekeeper!');
    } catch (e: any) {
      Alert.alert('Notice', e?.response?.data?.detail || 'Failed to send Parchi list.');
    }
  };

  // ── Send Catalog Order ────────────────────────────────────────────────────
  const handleOrderRequest = async (
    items: { product_id: number; quantity: number }[],
    paymentMethod: string
  ) => {
    if (!parchi) return;
    try {
      const msg = await parchiApi.sendOrderRequest(parchi.id, items, paymentMethod);
      setMessages(prev => [...prev, msg]);
      lastMsgId.current = msg.id;
      flatListRef.current?.scrollToEnd({ animated: true });
      Alert.alert('Order Placed 🎉', 'Your order request has been sent to the storekeeper!');
    } catch (e: any) {
      Alert.alert('Order Failed', e?.response?.data?.detail || 'Could not place order.');
    }
  };

  const handleCallShop = () => {
    const phone = parchi?.shop_phone || selectedShop?.shop_phone;
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    } else {
      Alert.alert('Phone', 'Store phone number is not available.');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text style={s.loadingText}>Connecting with your neighborhood store...</Text>
      </View>
    );
  }

  if (!parchi) {
    return (
      <View style={s.centered}>
        <Ionicons name="chatbubbles-outline" size={64} color={colors.primary.light} />
        <Text style={s.emptyTitle}>Parchi & Chat with Storekeeper</Text>
        <Text style={s.emptySubtitle}>
          Send handwritten/digital grocery lists, chat live, and order items with your 2km storekeeper.
        </Text>
        {error ? <Text style={s.errorText}>{error}</Text> : null}
        <TouchableOpacity style={s.startBtn} onPress={handleStart} disabled={starting}>
          {starting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.startBtnText}>🚀 Start Parchi Now</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      {/* Header */}
      <View style={s.header}>
        <View style={s.avatar}>
          <Ionicons name="storefront" size={20} color="#fff" />
        </View>
        <View style={s.headerInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={s.shopName}>{parchi.shop_name || 'Neighborhood Store'}</Text>
            <View style={s.liveBadge}>
              <View style={s.liveDot} />
              <Text style={s.liveText}>Live</Text>
            </View>
          </View>
          <Text style={s.subHeader}>
            {parchi.order_count} orders • {parchi.message_count} exchanges
          </Text>
        </View>

        {(parchi.shop_phone || selectedShop?.shop_phone) && (
          <TouchableOpacity style={s.callBtn} onPress={handleCallShop}>
            <Ionicons name="call" size={16} color={colors.primary.main} />
          </TouchableOpacity>
        )}
      </View>

      {/* Quick Action Bar: Write Parchi vs Order Products */}
      <View style={s.actionToolbar}>
        <TouchableOpacity
          style={s.toolBtnPrimary}
          onPress={() => setShowParchiListModal(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="create-outline" size={16} color="#fff" />
          <Text style={s.toolBtnPrimaryText}>📝 Write Parchi List</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.toolBtnSecondary}
          onPress={() => setShowPicker(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="cart-outline" size={16} color={colors.primary.main} />
          <Text style={s.toolBtnSecondaryText}>🛍️ Order Catalog</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => <MessageBubble msg={item} />}
        contentContainerStyle={s.messageList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.emptyMessages}>
            <Ionicons name="chatbox-ellipses-outline" size={48} color={colors.primary.light} />
            <Text style={s.emptyMessagesText}>
              👋 Start chatting or tap "Write Parchi List" above to send your grocery items to the storekeeper!
            </Text>
          </View>
        }
      />

      {/* Input Row */}
      <View style={s.inputRow}>
        <TouchableOpacity
          style={s.quickParchiBtn}
          onPress={() => setShowParchiListModal(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="create" size={20} color={colors.primary.main} />
        </TouchableOpacity>

        <TextInput
          style={s.input}
          placeholder="Type a message or Parchi item..."
          placeholderTextColor={colors.text.muted}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={1000}
        />

        <TouchableOpacity
          style={[s.sendBtn, (!inputText.trim() || sending) && s.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={16} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {/* Write Parchi List Modal */}
      <ParchiListModal
        visible={showParchiListModal}
        shopName={parchi.shop_name || 'Storekeeper'}
        onClose={() => setShowParchiListModal(false)}
        onSend={handleSendParchiList}
      />

      {/* Product picker modal */}
      {parchi && (
        <ProductPicker
          visible={showPicker}
          shopId={parchi.shop_id}
          onClose={() => setShowPicker(false)}
          onOrder={handleOrderRequest}
        />
      )}
    </KeyboardAvoidingView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  loadingText: { color: colors.text.secondary, marginTop: 8, fontSize: 14, textAlign: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.text.primary, textAlign: 'center' },
  emptySubtitle: { fontSize: 13, color: colors.text.secondary, textAlign: 'center', lineHeight: 20 },
  errorText: { fontSize: 13, color: '#EF4444', textAlign: 'center' },
  startBtn: {
    backgroundColor: colors.primary.main,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  startBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: { flex: 1 },
  shopName: { fontSize: 16, fontWeight: '800', color: colors.text.primary },
  subHeader: { fontSize: 11, color: colors.text.secondary, marginTop: 2 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  liveText: { fontSize: 9, fontWeight: '800', color: '#065F46' },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionToolbar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  toolBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.main,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  toolBtnPrimaryText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  toolBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.surface,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  toolBtnSecondaryText: { color: colors.primary.main, fontSize: 12, fontWeight: '700' },
  messageList: { paddingHorizontal: 12, paddingVertical: 12, paddingBottom: 16 },
  emptyMessages: { alignItems: 'center', justifyContent: 'center', marginTop: 60, paddingHorizontal: 30 },
  emptyMessagesText: { color: colors.text.secondary, textAlign: 'center', lineHeight: 20, marginTop: 12, fontSize: 13 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 8,
  },
  quickParchiBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text.primary,
    maxHeight: 90,
  },
  sendBtn: {
    backgroundColor: colors.primary.main,
    borderRadius: 20,
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#CBD5E1' },
});

// Bubble styles
const bub = StyleSheet.create({
  row: { marginVertical: 4, flexDirection: 'row' },
  rowRight: { justifyContent: 'flex-end' },
  rowLeft: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  bubbleMine: { backgroundColor: colors.primary.main, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  bubbleParchiList: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: colors.gold.main,
    borderBottomRightRadius: 4,
  },
  bubbleOrder: {
    borderWidth: 1.5,
    borderColor: colors.primary.light,
  },
  bubbleConfirm: { borderWidth: 1.5, borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  bubbleDecline: { borderWidth: 1.5, borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  parchiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  parchiBadgeText: { fontSize: 10, fontWeight: '800', color: colors.gold.dark },
  orderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  orderBadgeText: { fontSize: 10, fontWeight: '800', color: colors.primary.dark },
  text: { fontSize: 14, color: colors.text.primary, lineHeight: 20 },
  textMine: { color: '#fff' },
  orderRef: { fontSize: 11, color: colors.text.secondary, fontStyle: 'italic', marginTop: 2 },
  time: { fontSize: 10, color: '#94A3B8', alignSelf: 'flex-end', marginTop: 2 },
  timeMine: { color: 'rgba(255,255,255,0.75)' },
  systemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginVertical: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: 'center',
  },
  systemText: { fontSize: 12, color: colors.text.secondary, textAlign: 'center' },
});

// Parchi Modal styles
const pm = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  closeBtn: { padding: 4 },
  title: { fontSize: 17, fontWeight: '800', color: colors.text.primary },
  subtitle: { fontSize: 11, color: colors.text.secondary, marginTop: 2 },
  inputCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  inputHeader: { fontSize: 12, fontWeight: '800', color: colors.text.primary, marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.text.primary,
  },
  qtyInput: {
    width: 80,
    minWidth: 0,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.text.primary,
    textAlign: 'center',
  },
  addBtn: {
    width: 44,
    height: 44,
    flexShrink: 0,
    borderRadius: 12,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemsList: { flex: 1, padding: 16 },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bullet: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  bulletText: { fontSize: 12, fontWeight: '800', color: colors.primary.main },
  itemName: { fontSize: 14, fontWeight: '700', color: colors.text.primary },
  itemQty: { fontSize: 12, color: colors.text.secondary, marginTop: 2 },
  delBtn: { padding: 6 },
  emptyBox: { alignItems: 'center', justifyContent: 'center', marginTop: 40, padding: 20 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary, marginTop: 10 },
  emptySub: { fontSize: 12, color: colors.text.secondary, textAlign: 'center', marginTop: 4, lineHeight: 18 },
  optionsBox: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  optLabel: { fontSize: 12, fontWeight: '700', color: colors.text.secondary },
  payRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  payBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  payBtnActive: { borderColor: colors.primary.main, backgroundColor: colors.primary.surface },
  payBtnText: { fontSize: 12, color: colors.text.secondary, fontWeight: '600' },
  payBtnTextActive: { color: colors.primary.main, fontWeight: '800' },
  noteInput: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text.primary,
    marginTop: 8,
  },
  footer: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  sendParchiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.main,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  sendParchiBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});

// Product picker styles
const pp = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  closeBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text.primary },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  payLabel: { fontSize: 13, color: colors.text.secondary, marginRight: 4 },
  payBtn: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  payBtnActive: { borderColor: colors.primary.main, backgroundColor: '#EEF2FF' },
  payBtnText: { fontSize: 13, color: colors.text.secondary },
  payBtnTextActive: { color: colors.primary.main, fontWeight: '700' },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  productInfo: { flex: 1 },
  productName: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
  productPrice: { fontSize: 13, color: colors.text.secondary, marginTop: 2 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  qtyText: { width: 24, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.text.primary },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  orderBtn: {
    backgroundColor: colors.primary.main,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  orderBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
