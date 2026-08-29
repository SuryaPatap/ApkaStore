import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  quantityInCart?: number;
  onAddToCart?: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onPress?: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  quantityInCart = 0,
  onAddToCart,
  onIncrement,
  onDecrement,
  onPress,
}) => {
  const isOutOfStock = product.stock_quantity <= 0;

  const getCategoryIcon = (category: string) => {
    const cat = category?.toLowerCase() || '';
    if (cat.includes('fruit') || cat.includes('veg')) return 'nutrition-outline';
    if (cat.includes('dairy') || cat.includes('milk')) return 'water-outline';
    if (cat.includes('grain') || cat.includes('rice') || cat.includes('flour')) return 'leaf-outline';
    if (cat.includes('snack') || cat.includes('biscuit')) return 'fast-food-outline';
    return 'basket-outline';
  };

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={onPress ? 0.8 : 1}
      onPress={onPress}
    >
      {/* Product Image / Icon Container */}
      <View style={styles.imageContainer}>
        <Ionicons name={getCategoryIcon(product.category) as any} size={32} color={Colors.primary} />
        {product.stock_quantity <= 5 && product.stock_quantity > 0 && (
          <View style={styles.lowStockBadge}>
            <Text style={styles.lowStockText}>Low Stock</Text>
          </View>
        )}
      </View>

      {/* Product Details */}
      <View style={styles.content}>
        <Text style={styles.category}>{product.category || 'General'}</Text>
        <Text style={styles.name} numberOfLines={1}>
          {product.name}
        </Text>
        <Text style={styles.unit}>{product.unit ? `Per ${product.unit}` : 'Standard pack'}</Text>

        <View style={styles.footer}>
          <Text style={styles.price}>
            ₹{typeof product.price === 'string' ? parseFloat(product.price).toFixed(2) : product.price.toFixed(2)}
          </Text>

          {isOutOfStock ? (
            <View style={styles.outOfStockBadge}>
              <Text style={styles.outOfStockText}>Out of Stock</Text>
            </View>
          ) : quantityInCart > 0 ? (
            <View style={styles.counterContainer}>
              <TouchableOpacity
                style={styles.counterButton}
                onPress={onDecrement}
                activeOpacity={0.7}
              >
                <Ionicons name="remove" size={14} color={Colors.primaryDark} />
              </TouchableOpacity>
              <Text style={styles.quantityText}>{quantityInCart}</Text>
              <TouchableOpacity
                style={styles.counterButton}
                onPress={onIncrement}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={14} color={Colors.primaryDark} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addButton}
              onPress={onAddToCart}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  imageContainer: {
    height: 110,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  lowStockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.warningSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  lowStockText: {
    color: Colors.warningDark,
    fontSize: 10,
    fontWeight: '700',
  },
  content: {
    padding: 12,
  },
  category: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  unit: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  price: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
  },
  addButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 3,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primarySoft,
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  counterButton: {
    width: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primaryDark,
    paddingHorizontal: 6,
  },
  outOfStockBadge: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  outOfStockText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
});
