import 'package:flutter/material.dart';

class GradesProvider extends ChangeNotifier {
  List<dynamic> grades = [];
  bool isLoading = false;
}