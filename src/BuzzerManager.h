#ifndef BUZZER_MANAGER_H
#define BUZZER_MANAGER_H

#include <Arduino.h>
#include "HardwareConfig.h"

#if !ENABLE_BUZZER
    #error "BuzzerManager requires ENABLE_BUZZER=1 in HardwareConfig.h"
#endif

// GPIO pin for buzzer (configured in HardwareConfig.h)
// BUZZER_PIN is already defined in HardwareConfig.h

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
