#pragma once

#include <Arduino.h>

// Cấu hình chân UART cho module RFID 125kHz
// Bạn có thể chỉnh lại cho đúng với phần cứng của mình
#define RFID_RX_PIN 16
#define RFID_TX_PIN 17  // thường không dùng, nhưng cần cho Serial2.begin

// Tốc độ baud phổ biến cho module RFID 125kHz (VD: RDM6300)
#define RFID_BAUD 9600

// Khởi tạo UART cho RFID
void rfid_init();

// Gọi thường xuyên trong loop để cập nhật dữ liệu từ RFID
void rfid_update();

// Trả về true nếu vừa đọc được một mã thẻ đầy đủ
bool rfid_has_new_tag();

// Lấy nội dung thẻ vừa đọc (chuỗi ASCII, ví dụ mã HEX), đồng thời clear cờ new_tag
String rfid_get_last_tag();
