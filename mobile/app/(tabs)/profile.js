import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';
import { useAuthStore, useWardrobeStore } from '../../store';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const { stats } = useWardrobeStore();

  const handleLogout = () => {
    Alert.alert('Çıkış', 'Çıkış yapmak istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: logout },
    ]);
  };

  const menuItems = [
    {
      icon: 'person-circle',
      title: 'Profili Düzenle',
      subtitle: 'İsim, şehir, stil tercihleri',
      action: () => {},
    },
    {
      icon: 'notifications',
      title: 'Bildirimler',
      subtitle: 'Sabah kombin hatırlatması',
      action: () => {},
    },
    {
      icon: 'calendar',
      title: 'Etkinliklerim',
      subtitle: 'Özel günler için kombin planla',
      action: () => {},
    },
    {
      icon: 'bar-chart',
      title: 'Gardırop İstatistikleri',
      subtitle: 'Giyim alışkanlıkların',
      action: () => {},
    },
    {
      icon: 'water',
      title: 'Çamaşır Yıkandı!',
      subtitle: 'Tüm kirli kıyafetleri temiz yap',
      color: COLORS.info,
      action: () => {
        Alert.alert(
          'Çamaşır Yıkandı! 🧺',
          'Tüm kirli kıyafetler temiz olarak işaretlensin mi?',
          [
            { text: 'İptal', style: 'cancel' },
            {
              text: 'Evet, Temiz!',
              onPress: () => {
                // bulk wash implementation
                Alert.alert('Harika! ✨', 'Tüm kıyafetler temiz olarak güncellendi');
              },
            },
          ]
        );
      },
    },
    {
      icon: 'diamond',
      title: 'Premium\'a Geç',
      subtitle: 'Sınırsız kombin, gelişmiş özellikler',
      color: COLORS.warning,
      action: () => {},
    },
    {
      icon: 'help-circle',
      title: 'Yardım & Destek',
      subtitle: 'SSS, iletişim',
      action: () => {},
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profil Kartı */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.full_name?.charAt(0)?.toUpperCase() || '?'}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.full_name}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          {user?.is_premium && (
            <View style={styles.premiumBadge}>
              <Ionicons name="diamond" size={12} color={COLORS.warning} />
              <Text style={styles.premiumText}>Premium</Text>
            </View>
          )}
        </View>
      </View>

      {/* Hızlı İstatistikler */}
      {stats && (
        <View style={styles.quickStats}>
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatNumber}>{stats.total}</Text>
            <Text style={styles.quickStatLabel}>Kıyafet</Text>
          </View>
          <View style={styles.quickStatDivider} />
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatNumber}>{stats.favorites}</Text>
            <Text style={styles.quickStatLabel}>Favori</Text>
          </View>
          <View style={styles.quickStatDivider} />
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatNumber}>
              {Object.keys(stats.by_category || {}).length}
            </Text>
            <Text style={styles.quickStatLabel}>Kategori</Text>
          </View>
        </View>
      )}

      {/* Menü */}
      <View style={styles.menuSection}>
        {menuItems.map((item, index) => (
          <TouchableOpacity key={index} style={styles.menuItem} onPress={item.action}>
            <Ionicons name={item.icon} size={24} color={item.color || COLORS.primary} />
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Çıkış */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out" size={20} color={COLORS.error} />
        <Text style={styles.logoutText}>Çıkış Yap</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Kombin v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingBottom: 40 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...SHADOWS.medium,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: { fontSize: 26, fontWeight: '800', color: COLORS.textWhite },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  profileEmail: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warning + '20',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginTop: 6,
    gap: 4,
  },
  premiumText: { fontSize: 12, fontWeight: '700', color: COLORS.warning },
  quickStats: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    ...SHADOWS.small,
  },
  quickStatItem: { flex: 1, alignItems: 'center' },
  quickStatNumber: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
  quickStatLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  quickStatDivider: { width: 1, backgroundColor: COLORS.divider },
  menuSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
    ...SHADOWS.small,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    gap: 14,
  },
  menuInfo: { flex: 1 },
  menuTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  menuSubtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.error + '10',
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  logoutText: { fontSize: 16, fontWeight: '600', color: COLORS.error },
  version: { textAlign: 'center', fontSize: 12, color: COLORS.textLight, marginTop: 20 },
});
