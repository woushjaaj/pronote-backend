// lib/main.dart
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'providers/timetable_provider.dart';
import 'providers/grades_provider.dart';
import 'providers/homeworks_provider.dart';
import 'screens/main_navigation.dart';
 
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const PronoteApp());
}
 
class PronoteApp extends StatelessWidget {
  const PronoteApp({super.key});
 
  @override
  Widget build(BuildContext context) {
    // MultiProvider permet d'utiliser plusieurs providers dans toute l'app
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => TimetableProvider()),
        ChangeNotifierProvider(create: (_) => GradesProvider()),
        ChangeNotifierProvider(create: (_) => HomeworksProvider()),
      ],
      child: MaterialApp(
        title: 'Pronote',
        debugShowCheckedModeBanner: false,
 
        // Thème clair
        theme: _buildTheme(Brightness.light),
        // Thème sombre (suit automatiquement le mode du téléphone)
        darkTheme: _buildTheme(Brightness.dark),
        themeMode: ThemeMode.system,
 
        home: const MainNavigationScreen(),
      ),
    );
  }
 
  ThemeData _buildTheme(Brightness brightness) {
    // ColorScheme.fromSeed génère automatiquement toute la palette MD3
    // à partir d'une seule couleur principale
    final colorScheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFFE65100), // Deep Orange
      brightness: brightness,
    );
 
    final base = brightness == Brightness.light
        ? ThemeData.light(useMaterial3: true)
        : ThemeData.dark(useMaterial3: true);
 
    return base.copyWith(
      colorScheme: colorScheme,
 
      // Police Inter via Google Fonts
      textTheme: GoogleFonts.interTextTheme(base.textTheme),
 
      // Cards sans ombre (style MD3 moderne)
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        color: colorScheme.surfaceContainerHighest,
      ),
 
      // Barre de navigation du bas
      navigationBarTheme: NavigationBarThemeData(
        indicatorColor: colorScheme.primaryContainer,
        labelTextStyle: WidgetStateProperty.all(
          GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w500),
        ),
      ),
 
      // AppBar sans ombre
      appBarTheme: AppBarTheme(
        elevation: 0,
        scrolledUnderElevation: 1,
        backgroundColor: colorScheme.surface,
        foregroundColor: colorScheme.onSurface,
        titleTextStyle: GoogleFonts.inter(
          fontSize: 20, fontWeight: FontWeight.w600,
          color: colorScheme.onSurface,
        ),
      ),
 
      // Chips avec style filled
      chipTheme: ChipThemeData(
        backgroundColor: colorScheme.primaryContainer,
        labelStyle: TextStyle(color: colorScheme.onPrimaryContainer, fontSize: 12),
      ),
    );
  }
}
