// lib/services/api_service.dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
 
class ApiService {
  // Singleton : une seule instance dans toute l'app
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();
 
  // URL du backend (ex: http://192.168.1.10:3000 pour tests locaux)
  //                    (ex: https://ton-app.teoheberg.fr pour production)
  Future<String> get _baseUrl async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('backend_url') ?? 'http://localhost:3000';
  }
 
  // Méthode GET générique
  Future<Map<String, dynamic>> get(String endpoint) async {
    final base = await _baseUrl;
    final uri = Uri.parse('$base/api/$endpoint');
 
    try {
      final response = await http.get(uri).timeout(const Duration(seconds: 15));
 
      if (response.statusCode == 200) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      } else {
        throw Exception('Erreur HTTP ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Impossible de joindre le backend : $e');
    }
  }
 
  // Méthode POST générique
  Future<Map<String, dynamic>> post(String endpoint, Map<String, dynamic> body) async {
    final base = await _baseUrl;
    final uri = Uri.parse('$base/api/$endpoint');
 
    final response = await http.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(body),
    ).timeout(const Duration(seconds: 15));
 
    return jsonDecode(response.body) as Map<String, dynamic>;
  }
 
  // ── Endpoints spécifiques ─────────────────────────────────────────
 
  Future<List<dynamic>> getTimetable({int weekOffset = 0}) async {
    final result = await get('timetable?week=$weekOffset');
    return result['data'] as List<dynamic>? ?? [];
  }
 
  Future<List<dynamic>> getGrades() async {
    final result = await get('grades');
    return result['data'] as List<dynamic>? ?? [];
  }
 
  Future<List<dynamic>> getHomeworks() async {
    final result = await get('homeworks');
    return result['data'] as List<dynamic>? ?? [];
  }
 
  Future<String> getAiSummary() async {
    final result = await get('ai/summary');
    return result['data']?['summary'] as String? ?? 'Résumé indisponible.';
  }
 
  Future<Map<String, dynamic>> getComplexityScore() async {
    final result = await get('ai/complexity');
    return result['data'] as Map<String, dynamic>? ?? {};
  }
 
  Future<void> savePrediction(String evalId, double prediction) async {
    await post('prediction', {'evalId': evalId, 'prediction': prediction});
  }
 
  Future<void> updateSetting(String key, String value) async {
    await post('settings', {'key': key, 'value': value});
  }
}
