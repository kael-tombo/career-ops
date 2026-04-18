import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Dashboard</Text>
        <Text style={[styles.subtitle, { color: theme.icon }]}>Your career operations center</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: theme.tint + '10' }]}>
          <Text style={[styles.statValue, { color: theme.text }]}>45</Text>
          <Text style={[styles.statLabel, { color: theme.icon }]}>Portals Scanned</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.tint + '10' }]}>
          <Text style={[styles.statValue, { color: theme.text }]}>3</Text>
          <Text style={[styles.statLabel, { color: theme.icon }]}>New Matches</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Activity</Text>
        
        <View style={[styles.activityItem, { borderBottomColor: theme.icon + '30' }]}>
          <View style={styles.activityDot} />
          <View>
            <Text style={[styles.activityText, { color: theme.text }]}>System evaluated Anthropic role</Text>
            <Text style={[styles.activityTime, { color: theme.icon }]}>2 hours ago</Text>
          </View>
        </View>
        
        <View style={[styles.activityItem, { borderBottomColor: theme.icon + '30' }]}>
          <View style={[styles.activityDot, { backgroundColor: theme.tint }]} />
          <View>
            <Text style={[styles.activityText, { color: theme.text }]}>CV generated for Mistral AI</Text>
            <Text style={[styles.activityTime, { color: theme.icon }]}>5 hours ago</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    padding: 20,
    gap: 16,
  },
  statCard: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#34C759',
    marginRight: 12,
  },
  activityText: {
    fontSize: 16,
  },
  activityTime: {
    fontSize: 12,
    marginTop: 2,
  },
});
