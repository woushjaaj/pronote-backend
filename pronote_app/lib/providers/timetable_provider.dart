import 'package:flutter/material.dart';

class TimetableProvider extends ChangeNotifier {
  List<dynamic> slots = [];
  bool isLoading = false;
}