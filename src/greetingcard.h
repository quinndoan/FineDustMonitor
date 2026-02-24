#ifndef GREETINGCARD_H
#define GREETINGCARD_H

#include <U8g2lib.h>

/**
 * Hiển thị màn hình chào với logo, thông tin trạng thái và phiên bản.
 * @param u8g2 Đối tượng màn hình truyền từ main
 * @param wifiSSID Tên mạng Wifi (truyền "" nếu không kết nối)
 * @param btName Tên Bluetooth (truyền "" nếu tắt)
 */
void showWelcomeScreen(U8G2_SH1106_128X64_NONAME_F_HW_I2C &u8g2, const char* wifiSSID, const char* btName);


// Hàm hiển thị thông số từ Flash
void showFlashConfig(U8G2_SH1106_128X64_NONAME_F_HW_I2C &u8g2);

// Màn hình thông số AP
void showAPConfig(U8G2_SH1106_128X64_NONAME_F_HW_I2C &u8g2, char * apname, char * password);

#endif