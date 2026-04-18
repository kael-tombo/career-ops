import { StyleSheet, Text, View, FlatList } from 'react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const MOCK_JOBS = [
  { id: '1', company: 'Anthropic', role: 'Senior Backend Engineer', status: 'Interview', date: '2026-04-17' },
  { id: '2', company: 'Mistral AI', role: 'Platform Engineer', status: 'Applied', date: '2026-04-16' },
  { id: '3', company: 'ElevenLabs', role: 'Full-Stack Engineer', status: 'Evaluated', date: '2026-04-15' },
];

export default function PipelineScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>Pipeline</Text>
      <Text style={[styles.subtitle, { color: theme.icon }]}>Track every opportunity</Text>

      <FlatList
        data={MOCK_JOBS}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.tint + '10' }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.company, { color: theme.text }]}>{item.company}</Text>
              <View style={[styles.badge, { backgroundColor: theme.tint }]}>
                <Text style={styles.badgeText}>{item.status}</Text>
              </View>
            </View>
            <Text style={[styles.role, { color: theme.icon }]}>{item.role}</Text>
            <Text style={[styles.date, { color: theme.icon }]}>{item.date}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
  },
  list: {
    gap: 12,
  },
  card: {
    padding: 16,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  company: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  role: {
    fontSize: 16,
    marginBottom: 8,
  },
  date: {
    fontSize: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
