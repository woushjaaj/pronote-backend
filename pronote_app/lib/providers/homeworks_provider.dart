import 'package:flutter/material.dart';

class HomeworksProvider extends ChangeNotifier {
  List<dynamic> homeworks = [];
  bool isLoading = false;
}