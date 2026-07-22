# Tezuka v0.3.12 Fastlock Overlap Patch

This Android application does not use `http://<pluto_ip>/sweep` as a data endpoint. Spectrum data must continue to come from:

```text
ws://<pluto_ip>/waterfall
```

Tezuka v0.3.12 currently derives RX Fastlock profiles as:

```text
sampleRate = requestedSpan / 8
profileSpacing = sampleRate
```

That geometry has no overlap and is not compatible with the SDR Video Scanner Fastlock mode. The scanner will fall back to the legacy retune-per-window waterfall scanner unless the Android setting `fastlockOverlapCapableFirmware` is enabled after applying an equivalent firmware patch.

## Firmware Files To Change

No Tezuka firmware checkout or scripts are present in this workspace. Apply the following change in the Tezuka component that handles these MQTT topics:

```text
cmd/rx/span
cmd/rx/sweep/frequency
cmd/rx/sweep/activate
cmd/spectro/fps
cmd/spectro/mode
```

In a stock Tezuka v0.3.12 tree, this is the RX sweep/Fastlock profile setup code that responds to `cmd/rx/span` and `cmd/rx/sweep/frequency`. Replace only the profile geometry and AD9363 Fastlock-table programming logic; keep `/waterfall` frame output as binary native/little-endian `Float32`.

## Required Geometry

```text
PROFILE_COUNT = 8
EDGE_TRIM_FRACTION = 0.15
USABLE_FRACTION = 0.70

sampleRate = requestedTrustedSpan / (8 * 0.70)
           = requestedTrustedSpan * 5 / 28

profileSpacing = sampleRate * 0.70

firstProfileCenter =
    sweepCenter - ((PROFILE_COUNT - 1) * profileSpacing / 2)

profileCenter[i] =
    firstProfileCenter + i * profileSpacing
```

For each profile, the trusted interval is:

```text
profileCenter[i] +/- sampleRate * 0.35
```

Adjacent trusted intervals must meet continuously:

```text
rightEdge(i) == leftEdge(i + 1)
```

Clamp the configured RF bandwidth to the AD9363-supported maximum. Gain, RF bandwidth, sample rate, and spectrometer mode are global settings, not per-profile settings.

## Replacement Pseudocode

```text
sampleRate = round(span * 5 / 28)
profileSpacing = round(sampleRate * 7 / 10)
firstFrequency = center - round(7 * profileSpacing / 2)

disable Fastlock pin control
configure global sample rate
configure global RF bandwidth = min(requested RF bandwidth, AD9363 maximum)

for profile in 0..7:
    frequency = firstFrequency + profile * profileSpacing
    set RX LO frequency = frequency
    store RX LO into Fastlock profile = profile

enable Fastlock pin control
recall profile 0
```

## Waterfall Frame Contract

In Fastlock mode each `/waterfall` binary message must be:

```text
frame[0]   = Fastlock profile index as Float32, exactly 0 through 7
frame[1..] = linear-power FFT bins
```

The first float is metadata. It must not be visualized or analyzed as spectrum power.

The Android scanner retains the same central bins as the Tezuka dashboard:

```text
fftBinCount = frameFloatCount - 1
edgeBins = floor(fftBinCount * 0.15)
usableBins = fftBinCount - 2 * edgeBins
retained source range = 1 + edgeBins until 1 + edgeBins + usableBins
```

## Android Configuration

Use the existing scan configuration JSON or saved preferences:

```json
{
  "fastlockEnabled": true,
  "fastlockOverlapCapableFirmware": true,
  "fastlockProfileCount": 8,
  "fastlockProfileEdgeTrimPercent": 15,
  "fastlockTrustedSweepSpanHz": 60000000,
  "fastlockFullSweepFps": 10,
  "fastlockWarmupCycles": 1,
  "fastlockSweepsPerWindow": 1,
  "fastlockWindowOverlapHz": 6000000,
  "fastlockSpectrometerMode": "Average"
}
```

Leave `fastlockOverlapCapableFirmware=false` on unpatched Tezuka v0.3.12. The app will log a warning and preserve the legacy Maia waterfall scanner.

## Verification

Android diagnostics expose:

```text
fastlock_status
fastlock_actual_full_sweep_fps
fastlockCompletedSweeps
fastlockDroppedCycles
fastlockIncompleteCycles
fastlockDuplicateProfiles
fastlockInvalidProfiles
fastlockOutOfOrderProfiles
```

A healthy sweep shows ordered profile indices `0,1,2,3,4,5,6,7` on `/waterfall`, one discarded warm-up cycle after every profile reprogramming, then increasing `fastlockCompletedSweeps`. The measured full-sweep rate is computed from timestamps between successive valid profile-0 frames.
