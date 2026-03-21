#include "BuzzerManager.h"

// Biến toàn cục định nghĩa sẵn
BuzzerManager buzzerMgr;

BuzzerManager::BuzzerManager() {
}

void BuzzerManager::begin() {
    pinMode(BUZZER_PIN, OUTPUT);
    digitalWrite(BUZZER_PIN, LOW); // Mặc định tắt loa
}

void BuzzerManager::beepOk() {
    // Kêu tít 1 tiếng đủ dài để báo được việc cập nhật hệ thống / quẹt đúng
    digitalWrite(BUZZER_PIN, HIGH);
    delay(300);
    digitalWrite(BUZZER_PIN, LOW);
}

void BuzzerManager::beepShort() {
    // Kêu tít 1 tiếng thật ngắn làm phản hồi khi đọc thấy thẻ
    digitalWrite(BUZZER_PIN, HIGH);
    delay(80);
    digitalWrite(BUZZER_PIN, LOW);
}

void BuzzerManager::beepError() {
    // Kêu 3 nhịp giật cục (bíp bíp bíp)
    for(int i = 0; i < 3; i++) {
        digitalWrite(BUZZER_PIN, HIGH);
        delay(100);
        digitalWrite(BUZZER_PIN, LOW);
        delay(100);
    }
}
