#pragma once

#include <Arduino.h>
#include "HardwareConfig.h"

#if !ENABLE_RFID_125KHZ
	#error "Rfid125khzManager requires ENABLE_RFID_125KHZ=1 in HardwareConfig.h"
#endif

// Pin and baudrate assignments for 125kHz RFID module (configured in HardwareConfig.h)
// Note: Override these by defining in platformio.ini if different from defaults

// Khởi tạo UART cho RFID
void rfid_init();

// Gọi thường xuyên trong loop để cập nhật dữ liệu từ RFID
void rfid_update();

// Trả về true nếu vừa đọc được một mã thẻ đầy đủ
bool rfid_has_new_tag();

// Lấy nội dung thẻ vừa đọc (chuỗi ASCII, ví dụ mã HEX), đồng thời clear cờ new_tag
String rfid_get_last_tag();
