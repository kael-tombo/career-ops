import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const FLASHCARDS = [
  { id: '1', q: 'Tell me about a time you improved system reliability under pressure.', a: 'S: Ambatovy IMS had P2+ alerts taking 4+ hours...\nT: Migrate from legacy Java EE to Spring Boot 3...\nA: Re-architected the alert pipeline with Spring Batch...\nR: -65% alert response time, 99.97% reliability.' },
  { id: '2', q: 'How do you handle scope creep from product managers?', a: 'S: During DDS.mg SaaS delivery...\nT: PM requested 3 new features midway...\nA: I negotiated a phased release, moving 2 features to v1.1...\nR: Delivered v1.0 on time, PM was happy with the early release of core value.' },
];

export default function PrepScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  
  const [flippedId, setFlippedId] = useState<string | null>(null);

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>Interview Prep</Text>
      <Text style={[styles.subtitle, { color: theme.icon }]}>STAR Stories & Flashcards</Text>

      <View style={styles.cardsContainer}>
        {FLASHCARDS.map(card => {
          const isFlipped = flippedId === card.id;
          return (
            <Pressable 
              key={card.id} 
              style={[styles.flashcard, { backgroundColor: theme.tint + '15', borderColor: theme.tint }]}
              onPress={() => setFlippedId(isFlipped ? null : card.id)}
            >
              <Text style={[styles.cardHeader, { color: theme.tint }]}>
                {isFlipped ? 'Answer (STAR)' : 'Question'}
              </Text>
              <Text style={[styles.cardText, { color: theme.text }]}>
                {isFlipped ? card.a : card.q}
              </Text>
              <Text style={[styles.flipHint, { color: theme.icon }]}>
                Tap to flip
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
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
    marginBottom: 24,
  },
  cardsContainer: {
    gap: 16,
  },
  flashcard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
    position: 'absolute',
    top: 20,
    left: 24,
  },
  cardText: {
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
  },
  flipHint: {
    fontSize: 12,
    position: 'absolute',
    bottom: 16,
  },
});
