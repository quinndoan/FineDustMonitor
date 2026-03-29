#include "NfcManager.h"

// Local MFRC522 instance
MFRC522 mfrc522(SS_PIN, RST_PIN);  

static String nfcBuffer = "";
static bool nfcTagReady = false;

// Cooldown to avoid reading the same card repeatedly when it is kept on the reader
static unsigned long lastTimeRead = 0;
static const unsigned long READ_COOLDOWN_MS = 2000; 

// Try writing block 0 (contains UID) with all‑zero UID to detect rewrite/magic MIFARE Classic 1K cards
static bool nfc_is_rewritable_uid_card() {
  // Only apply for MIFARE Classic cards (Mini / 1K / 4K)
  MFRC522::PICC_Type piccType = mfrc522.PICC_GetType(mfrc522.uid.sak);
  if (piccType != MFRC522::PICC_TYPE_MIFARE_MINI &&
      piccType != MFRC522::PICC_TYPE_MIFARE_1K &&
      piccType != MFRC522::PICC_TYPE_MIFARE_4K) {
    return false;
  }

  // Some clone cards allow writing block 0 using default keys FFFFFFFFFFFF or A0A1A2A3A4A5
  const byte candidateKeys[][6] = {
    {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF},
    {0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5}
  };

  for (byte k = 0; k < 2; k++) {
    MFRC522::MIFARE_Key key;
    for (byte i = 0; i < 6; i++) {
      key.keyByte[i] = candidateKeys[k][i];
    }

    // Authenticate block 0 with Key A
    MFRC522::StatusCode status = mfrc522.PCD_Authenticate(
        MFRC522::PICC_CMD_MF_AUTH_KEY_A,
        0, // block 0: UID + BCC + manufacturer data
        &key,
        &(mfrc522.uid));

    if (status != MFRC522::STATUS_OK) {
      continue; // try next key
    }

    // Prepare new block 0 data: UID = 00 00 00 00, BCC = XOR of 4 UID bytes (still 0), the rest = 0
    byte block0[16];
    for (byte i = 0; i < 16; i++) {
      block0[i] = 0x00;
    }
    block0[4] = block0[0] ^ block0[1] ^ block0[2] ^ block0[3];

    status = mfrc522.MIFARE_Write(0, block0, 16);
    mfrc522.PCD_StopCrypto1();

    if (status == MFRC522::STATUS_OK) {
      Serial.print(F("[NFC/MFRC522] Debug: Successfully wrote block 0 with clone key index="));
      Serial.println(k);
      // If we can write block 0 then this is definitely a clone/rewrite card (UID is not ROM‑only)
      return true;
    }
  }

  Serial.println(F("[NFC/MFRC522] Debug: Block 0 is not writable with default keys (likely genuine card)"));
  return false;
}

void nfc_init() {
  SPI.begin();           // Initialize HW SPI bus (18, 19, 23)
  mfrc522.PCD_Init();    // Initialize MFRC522 chip
  Serial.println(F("[NFC/MFRC522] Initialized on SPI bus (CS:5, RST:32)"));
}

void nfc_update() {
  // 1. Only check card when cooldown has passed
  if (millis() - lastTimeRead < READ_COOLDOWN_MS) {
      return; 
  }

  // 2. Look for a new card (returns true if there is a card present)
  if ( ! mfrc522.PICC_IsNewCardPresent()) {
    return;
  }

  // 3. Read card data (manufacturer UID)
  if ( ! mfrc522.PICC_ReadCardSerial()) {
    return;
  }

  // 4. If UID read is successful -> convert to hex string (e.g. 4 bytes [A1 B2 C3 01] => "A1B2C301")
  String uidString = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    // Add leading '0' if current byte is < 0x10 to keep 2‑digit formatting
    if(mfrc522.uid.uidByte[i] < 0x10) {
        uidString += "0";
    }
    uidString += String(mfrc522.uid.uidByte[i], HEX);
  }
  
  uidString.toUpperCase();

  Serial.printf("[NFC/MFRC522] Detected card with UID: %s\n", uidString.c_str());

  // 4b. Try writing UID 000000... to detect rewrite/magic cards (writable UID)
  if (nfc_is_rewritable_uid_card()) {
    Serial.print(F("[NFC/MFRC522] WARNING: Detected card with writable UID (magic/rewrite), rejecting: "));
    Serial.println(uidString);

    // Update cooldown to avoid reading it again immediately
    lastTimeRead = millis();

    // Halt current card communication
    mfrc522.PICC_HaltA();
    mfrc522.PCD_StopCrypto1();
    return; // Do not forward this UID to main logic
  }

  // 5. Store UID in buffer for main loop to consume
  nfcBuffer = uidString;
  nfcTagReady = true;

  // 6. Update last read timestamp (start cooldown window)
  lastTimeRead = millis();

  // 7. Halt communication with the current card so the reader can serve others
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
}

bool nfc_has_new_tag() {
  return nfcTagReady;
}

String nfc_get_last_tag() {
  String tag = nfcBuffer;
  nfcBuffer = "";
  nfcTagReady = false;
  return tag; // Return UID in uppercase, e.g. 05A2B1BC
}
