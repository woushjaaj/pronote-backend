// lib/widgets/complexity_card.dart
import 'package:flutter/material.dart';
 
class ComplexityCard extends StatelessWidget {
  final int score;              // 0-100
  final String label;           // 'Tranquille', 'Chargé', 'Intense'
  final String emoji;           // '😌', '📚', '🔥'
  final Map<String, dynamic> bySubject;  // score par matière
 
  const ComplexityCard({
    super.key,
    required this.score,
    required this.label,
    required this.emoji,
    required this.bySubject,
  });
 
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    // La couleur de la jauge dépend du score
    final gaugeColor = score < 30
        ? Colors.green
        : score < 60
            ? Colors.orange
            : Colors.red;
 
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(emoji, style: const TextStyle(fontSize: 24)),
                const SizedBox(width: 8),
                Text(
                  'Charge de travail',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const Spacer(),
                Text(
                  '$score/100',
                  style: theme.textTheme.titleLarge?.copyWith(
                    color: gaugeColor,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            // Jauge principale
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(
                value: score / 100,
                minHeight: 10,
                backgroundColor: gaugeColor.withValues(alpha : 0.15),
                valueColor: AlwaysStoppedAnimation(gaugeColor),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(color: gaugeColor, fontWeight: FontWeight.w600),
            ),
            if (bySubject.isNotEmpty) ...[
              const Divider(height: 24),
              Text('Par matière :', style: theme.textTheme.labelLarge),
              const SizedBox(height: 8),
              // Liste des scores par matière
              ...bySubject.entries.map((entry) {
                final subjectScore = (entry.value as num).toInt();
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(entry.key, style: theme.textTheme.bodyMedium),
                      ),
                      Text(
                        '$subjectScore pts',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: subjectScore > 10 ? Colors.red : null,
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ],
          ],
        ),
      ),
    );
  }
}
