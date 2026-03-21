#ifndef BUZZER_MANAGER_H
#define BUZZER_MANAGER_H

#include <Arduino.h>

// Chân GPIO kết nối với loa còi (Active Buzzer)
#define BUZZER_PIN 12

class BuzzerManager {
public:
    BuzzerManager();
    
    // Cài đặt khởi tạo pin
    void begin();
    
    // Phát 1 tiếng bíp dài (Báo thành công)
    void beepOk();
    
    // Phát 1 tiếng bíp cực ngắn (Báo đã nhận thẻ)
    void beepShort();

    // Phát 3 tiếng bíp liên tục (Báo lỗi / Cảnh báo)
    void beepError();
};

// Biến toàn cục dùng chung
extern BuzzerManager buzzerMgr;

#endif
