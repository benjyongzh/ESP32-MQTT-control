#include "HX711.h"

#define DT  25
#define SCK 27

HX711 scale;

// replace this with YOUR computed factor:

// step 1. set calibration factor to 1.0
// step 2. upload and run the code with no weights on the scale. place a known weight (for example 1250g) on the scale check the reading
// step 3. divide the reading by the weight placed (324500 / 1250)
// step 4. use this factor as the new calibration factor and re-upload the run
// float calibration_factor = 324500/1250;  // example, for grams
float calibration_factor = 259.6;

void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("HX711 scale demo");

  scale.begin(DT, SCK);

  scale.set_scale(calibration_factor);  // use your calibration factor
  scale.tare(20);                       // zero with no load

  Serial.println("Tare complete. Put weight on the scale.");
}

void loop() {
  float weight = scale.get_units(10);  // averaged, now in grams (if calibrated that way)
  Serial.print("Weight: ");
  Serial.print(weight, 1);             // 1 decimal place
  Serial.println(" g");
  delay(200);
}
