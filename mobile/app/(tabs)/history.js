import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';
import { useOutfitStore } from '../../store';

export default function HistoryScreen() {
  const { history, fetchHistory } = useOutfitStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  }, []);

  const renderOutfit = ({ item }) => {
    const date = new Date(item.created_at).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      weekday: 'short',
    });

    const clothes = item.outfit_items?.map((oi) => oi.clothes).filter(Boolean) || [];

    return (
      <View style={styles.outfitCard}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.dateText}>{date}</Text>
            <Text style={styles.occasionText}>{item.occasion || 'Günlük'}</Text>
          </View>
          <View style={styles.ratingContainer}>
            {item.is_liked !== null && (
              <Ionicons
                name={item.is_liked ? 'heart' : 'heart-dislike'}
                size={20}
                color={item.is_liked ? COLORS.secondary : COLORS.textLight}
              />
            )}
            {item.is_worn && (
              <View style={styles.wornBadge}>
                <Text style={styles.wornText}>Giyildi ✓</Text>
              </View>
            )}
          </View>
        </View>

        {/* Kıyafet Önizlemeleri */}
        <View style={styles.thumbnailRow}>
          {clothes.map((c, idx) => (
            <View key={idx} style={styles.thumbnailContainer}>
              {c.thumbnail_url ? (
                <Image source={{ uri: c.thumbnail_url }} style={styles.thumbnail} />
              ) : (
                <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                  <Ionicons name="shirt" size={18} color={COLORS.textLight} />
                </View>
              )}
              <Text style={styles.thumbnailLabel} numberOfLines={1}>
                {c.name}
              </Text>
            </View>
          ))}
        </View>

        {/* Hava Durumu */}
        {item.weather_temp && (
          <View style={styles.weatherInfo}>
            <Ionicons name="thermometer" size={14} color={COLORS.textSecondary} />
            <Text style={styles.weatherText}>
              {item.weather_temp}° - {item.weather_condition}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={renderOutfit}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📅</Text>
            <Text style={styles.emptyText}>Henüz kombin geçmişin yok</Text>
            <Text style={styles.emptySubtext}>İlk kombini oluştur ve giyim geçmişini takip et!</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  list: { padding: 16 },
  outfitCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  dateText: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  occasionText: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  ratingContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wornBadge: {
    backgroundColor: COLORS.success + '20',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  wornText: { fontSize: 11, fontWeight: '600', color: COLORS.success },
  thumbnailRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  thumbnailContainer: { alignItems: 'center', width: 60 },
  thumbnail: { width: 55, height: 55, borderRadius: 10 },
  thumbnailPlaceholder: {
    backgroundColor: COLORS.divider,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailLabel: { fontSize: 10, color: COLORS.textSecondary, marginTop: 3, textAlign: 'center' },
  weatherInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  weatherText: { fontSize: 12, color: COLORS.textSecondary },
  emptyContainer: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  emptySubtext: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center' },
});
