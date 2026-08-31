import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { Header } from '../../components/Header';
import { useAuth } from '../../context/AuthContext';
import { shoppingListApi } from '../../api/endpoints';

interface ListItem {
  id: string;
  name: string;
  quantity: string;
}

export const ShoppingListScreen: React.FC = () => {
  const { user, selectedShop } = useAuth();
  const [items, setItems] = useState<ListItem[]>([]);

  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [customerNote, setCustomerNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddItem = () => {
    if (!itemName.trim()) {
      Alert.alert('Item Required', 'Please enter an item name (e.g. Milk, Onions, Soap).');
      return;
    }
    const newItem: ListItem = {
      id: Date.now().toString(),
      name: itemName.trim(),
      quantity: itemQty.trim() || '1',
    };
    setItems((prev) => [...prev, newItem]);
    setItemName('');
    setItemQty('1');
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleSendListToShop = async () => {
    if (items.length === 0) {
      Alert.alert('List is Empty', 'Please add at least one item to your list.');
      return;
    }

    if (!selectedShop) {
      Alert.alert('No Store Selected', 'Please select a nearby store first.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { parchiApi } = await import('../../api/endpoints');
      const thread = await parchiApi.startParchi(selectedShop.id);
      await parchiApi.sendParchiList(
        thread.id,
        items.map((i) => ({ name: i.name, quantity: i.quantity })),
        'COD',
        customerNote
      );

      Alert.alert(
        'Sent to Storekeeper 🎉',
        `Your digital Parchi list has been received by ${selectedShop.shop_name}. They will pack your items shortly!`
      );
      setItems([]);
      setCustomerNote('');
    } catch (e: any) {
      Alert.alert('Parchi Error', e?.response?.data?.detail || 'Could not send Parchi to storekeeper.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Header
        title="Digital Parchi (List)"
        subtitle={selectedShop ? `Send to: ${selectedShop.shop_name}` : 'Write your grocery list'}
      />

      {/* Input Section */}
      <View style={styles.inputCard}>
        <Text style={styles.inputTitle}>Add Item to List</Text>
        <View style={styles.inputRow}>
          <View style={styles.nameInputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Milk, Sugar, Atta..."
              placeholderTextColor={colors.text.muted}
              value={itemName}
              onChangeText={setItemName}
            />
          </View>

          <View style={styles.qtyInputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="Qty (e.g. 2 kg)"
              placeholderTextColor={colors.text.muted}
              value={itemQty}
              onChangeText={setItemQty}
            />
          </View>

          <TouchableOpacity style={styles.addBtn} onPress={handleAddItem} activeOpacity={0.8}>
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* List items */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <View style={styles.itemRow}>
            <View style={styles.itemBullet}>
              <Text style={styles.itemBulletText}>{index + 1}</Text>
            </View>
            <View style={styles.itemDetails}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemQty}>{item.quantity}</Text>
            </View>
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => handleRemoveItem(item.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={18} color={colors.danger.main} />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="clipboard-outline" size={48} color={colors.text.muted} />
            <Text style={styles.emptyTitle}>Your Digital Parchi is Empty</Text>
            <Text style={styles.emptySub}>
              Type any items you need from your neighborhood store above and tap '+' to add.
            </Text>
          </View>
        }
      />

      {/* Customer Note & Submit Bar */}
      {items.length > 0 && (
        <View style={styles.footerBar}>
          <TextInput
            style={styles.noteInput}
            placeholder="Special instructions (e.g. deliver after 5 PM)..."
            placeholderTextColor={colors.text.muted}
            value={customerNote}
            onChangeText={setCustomerNote}
          />

          <TouchableOpacity
            style={styles.sendListBtn}
            onPress={handleSendListToShop}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
                <Text style={styles.sendListBtnText}>
                  Send Parchi to {selectedShop?.shop_name || 'Store'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  inputCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  inputTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text.primary,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameInputWrapper: {
    flex: 1,
    minWidth: 0,
  },
  qtyInputWrapper: {
    width: 80,
    minWidth: 0,
  },
  textInput: {
    backgroundColor: colors.background.subtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.text.primary,
  },
  addBtn: {
    backgroundColor: colors.primary.main,
    width: 44,
    height: 44,
    flexShrink: 0,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  itemBullet: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemBulletText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary.dark,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  itemQty: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  removeBtn: {
    padding: 8,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  footerBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    gap: 10,
  },
  noteInput: {
    backgroundColor: colors.background.subtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: colors.text.primary,
  },
  sendListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.main,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  sendListBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
