#ifndef GREETINGCARD_H
#define GREETINGCARD_H
#include "HardwareConfig.h"

#if !ENABLE_OLED_DISPLAY
	#error "OledBackdrop requires ENABLE_OLED_DISPLAY=1 in HardwareConfig.h"
#endif


#include <U8g2lib.h>

/**
 * Hiển thị màn hình chào với logo, thông tin trạng thái và phiên bản.
 * @param u8g2 Đối tượng màn hình truyền từ main
 * @param wifiSSID Tên mạng Wifi (truyền "" nếu không kết nối)
 * @param btName Tên Bluetooth (truyền "" nếu tắt)
 */
void showWelcomeScreen(U8G2_SH1106_128X64_NONAME_F_HW_I2C &u8g2);


// Hàm hiển thị thông số từ Flash
void showFlashConfig(U8G2_SH1106_128X64_NONAME_F_HW_I2C &u8g2, const char * moretext = NULL);

// Màn hình thông số AP
void showAPConfig(U8G2_SH1106_128X64_NONAME_F_HW_I2C &u8g2);

// Màn hình thông số MQTT
void showMqttConfig(U8G2_SH1106_128X64_NONAME_F_HW_I2C &u8g2);

// Phiên bản nhỏ gọn hơn, dùng font 6x12, bắt đầu từ Y=36 để tránh chồng MSSV
void drawVietnameseNameCompact(U8G2_SH1106_128X64_NONAME_F_HW_I2C &u8g2, String studentName);

// Trang cài đặt Settings On/Off
void showSettingsPage(U8G2_SH1106_128X64_NONAME_F_HW_I2C &u8g2, uint8_t cursorIndex);

#endif