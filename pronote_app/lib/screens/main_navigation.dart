// lib/screens/main_navigation.dart
import 'package:flutter/material.dart';
import 'dashboard_screen.dart';
import 'timetable_screen.dart';
import 'grades_screen.dart';
import 'homeworks_screen.dart';
import 'messages_screen.dart';
 
class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});
 
  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}
 
class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;
 
  // Liste des pages — l'ordre doit correspondre aux NavigationDestination
  final List<Widget> _pages = [
    const DashboardScreen(),
    const TimetableScreen(),
    const GradesScreen(),
    const HomeworksScreen(),
    const MessagesScreen(),
  ];
 
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // IndexedStack garde toutes les pages en mémoire
      // (évite de recharger les données à chaque changement d'onglet)
      body: IndexedStack(
        index: _currentIndex,
        children: _pages,
      ),
 
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() => _currentIndex = index);
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard),
            label: 'Accueil',
          ),
          NavigationDestination(
            icon: Icon(Icons.calendar_today_outlined),
            selectedIcon: Icon(Icons.calendar_today),
            label: 'EDT',
          ),
          NavigationDestination(
            icon: Icon(Icons.grade_outlined),
            selectedIcon: Icon(Icons.grade),
            label: 'Notes',
          ),
          NavigationDestination(
            icon: Icon(Icons.book_outlined),
            selectedIcon: Icon(Icons.book),
            label: 'Devoirs',
          ),
          NavigationDestination(
            icon: Icon(Icons.mail_outlined),
            selectedIcon: Icon(Icons.mail),
            label: 'Messages',
          ),
        ],
      ),
    );
  }
}
