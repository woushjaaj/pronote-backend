// lib/widgets/prediction_dialog.dart
import 'package:flutter/material.dart';
import '../services/api_service.dart';
 
class PredictionDialog extends StatefulWidget {
  final String evalId;
  final String subject;
  final double outOf; // note maximale
 
  const PredictionDialog({
    super.key,
    required this.evalId,
    required this.subject,
    required this.outOf,
  });
 
  @override
  State<PredictionDialog> createState() => _PredictionDialogState();
}
 
class _PredictionDialogState extends State<PredictionDialog> {
  double _value = 10.0;  // valeur par défaut
  bool _loading = false;
 
  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text('Ta prédiction — ${widget.subject}'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'Quelle note tu penses avoir eu ?',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 24),
          // Affichage de la valeur sélectionnée
          Text(
            '${_value.toStringAsFixed(1)} / ${widget.outOf.toStringAsFixed(0)}',
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
              color: Theme.of(context).colorScheme.primary,
              fontWeight: FontWeight.bold,
            ),
          ),
          // Slider pour choisir la note
          Slider(
            value: _value,
            min: 0,
            max: widget.outOf,
            divisions: (widget.outOf * 2).toInt(), // pas de 0.5
            onChanged: (v) => setState(() => _value = v),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('0', style: Theme.of(context).textTheme.labelSmall),
              Text('${widget.outOf.toStringAsFixed(0)}',
                style: Theme.of(context).textTheme.labelSmall),
            ],
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Annuler'),
        ),
        FilledButton(
          onPressed: _loading ? null : _save,
          child: _loading
              ? const SizedBox(width: 16, height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Enregistrer'),
        ),
      ],
    );
  }
 
  Future<void> _save() async {
    setState(() => _loading = true);
    try {
      await ApiService().savePrediction(widget.evalId, _value);
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✅ Prédiction enregistrée !')),
        );
      }
    } catch (e) {
      setState(() => _loading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('❌ Erreur : $e')),
        );
      }
    }
  }
}
