#ifndef GREETINGCARD_H
#define GREETINGCARD_H

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

// Hàm hỗ trợ tự động cắt tên Tiếng Việt (có dấu) thành 2 dòng chữ to nếu quá dài
void drawVietnameseName(U8G2_SH1106_128X64_NONAME_F_HW_I2C &u8g2,String studentName);

#endif