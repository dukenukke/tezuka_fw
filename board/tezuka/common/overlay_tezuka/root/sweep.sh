#!/bin/sh
FREQ_CENTRAL=260000000
SPAN=480000000

FREQ_MINI=47000000
SR_MINI=2100000
PROFILE_COUNT=8
EDGE_TRIM_PERCENT=15
USABLE_PERCENT=70
AD9363_MAX_RF_BANDWIDTH=56000000

if [ "$1" ]; then
    FREQ_CENTRAL=$1
else
  echo "please provide central frequency : using default $FREQ_CENTRAL"
fi

if [ "$2" ]; then
    SPAN=$2
else
  echo "please provide Span  : using default $SPAN"
fi

# Keep frequency geometry in integer arithmetic.  The additions implement
# round-to-nearest for the positive span and spacing values.
SR=$(((SPAN * 5 + 14) / 28))


# shellcheck disable=SC2044
for i in $(find -L /sys/bus/iio/devices -maxdepth 2 -name name)
do
  dev_name=$(cat "$i")
  if [ "$dev_name" = "ad9361-phy" ]; then
     phy_path=$(echo "$i" | sed 's:/name$::')
     cd "$phy_path" || exit
     break
  fi
done

if [ "$dev_name" != "ad9361-phy" ]; then
 exit
fi

if [ "$3" = "0" ]; then
  echo "Stop sweep"
  iio_attr -D ad9361-phy adi,rx-fastlock-pincontrol-enable 0
  #In order to be set, we need a fastlock_recall (bad AD implementation)
  echo 0 > out_altvoltage0_RX_LO_fastlock_recall
  echo "$FREQ_CENTRAL" > out_altvoltage0_RX_LO_frequency
  exit 1
fi

if [ "$SR" -lt "$SR_MINI" ]; then
  SR=$SR_MINI
fi

# Fastlock state, sample rate, bandwidth, and gain are global settings.
iio_attr -D ad9361-phy adi,rx-fastlock-pincontrol-enable 0

#disable fir if any
echo 0 > in_out_voltage_filter_fir_en
echo "Setting samlerate $SR"
echo "$SR" > in_voltage_sampling_frequency

REQUESTED_RF_BANDWIDTH=$(((SR * 3 + 1) / 2))
RF_BANDWIDTH=$REQUESTED_RF_BANDWIDTH
if [ "$RF_BANDWIDTH" -gt "$AD9363_MAX_RF_BANDWIDTH" ]; then
  RF_BANDWIDTH=$AD9363_MAX_RF_BANDWIDTH
fi
echo "$RF_BANDWIDTH" > in_voltage_rf_bandwidth

# Set up eight profiles whose trusted central 70% regions meet edge-to-edge.
FREQ_STEP=$(((SR * USABLE_PERCENT + 50) / 100))
FREQ1=$((FREQ_CENTRAL - ((PROFILE_COUNT - 1) * FREQ_STEP + 1) / 2))

if [ "$FREQ1" -lt "$FREQ_MINI" ]; then
  echo "Correct freq mini"
  FREQ1=$FREQ_MINI
  FREQ_CENTRAL=$((FREQ1 + ((PROFILE_COUNT - 1) * FREQ_STEP + 1) / 2))
fi

echo "Fastlock geometry: profiles=$PROFILE_COUNT edge_trim=${EDGE_TRIM_PERCENT}% span=$SPAN sample_rate=$SR spacing=$FREQ_STEP first=$FREQ1 rf_bandwidth=$RF_BANDWIDTH"
i=0
while [ "$i" -lt "$PROFILE_COUNT" ]; do
  FREQ=$((FREQ1 + i * FREQ_STEP))
  echo "$FREQ" > out_altvoltage0_RX_LO_frequency
  echo "Initializing PROFILE $i at $FREQ "
  echo "$i" > out_altvoltage0_RX_LO_fastlock_store
  i=$((i + 1))
done

echo "$FREQ_CENTRAL"

#Enable Fastlock Mode
iio_attr -D ad9361-phy adi,rx-fastlock-pincontrol-enable 1
#In order to be set, we need a fastlock_recall (bad AD implementation)
echo 0 > out_altvoltage0_RX_LO_fastlock_recall
#echo 0x25A 0x83 > /sys/kernel/debug/iio/iio:device0/direct_reg_access
#echo 0x25A 0x00 > /sys/kernel/debug/iio/iio:device0/direct_reg_access


# Mandatory as the HDL make a OR so 0 IS should be set
GPIO_BASE=906
cd /sys/class/gpio || exit

if [ $GPIO_BASE -ge 0 ]
then
  GPIO_CTRL_IN1=$((GPIO_BASE + 63))
  GPIO_CTRL_IN2=$((GPIO_BASE + 64))
  GPIO_CTRL_IN3=$((GPIO_BASE + 65))
  #Export the CTRL_IN GPIOs
  echo "$GPIO_CTRL_IN1" > "export" 2> /dev/null
  echo "$GPIO_CTRL_IN2" > "export" 2> /dev/null
  echo "$GPIO_CTRL_IN3" > "export" 2> /dev/null
else
  echo ERROR: Wrong board?
  exit
fi

CTRL_IN1=gpio${GPIO_CTRL_IN1}/direction
CTRL_IN2=gpio${GPIO_CTRL_IN2}/direction
CTRL_IN3=gpio${GPIO_CTRL_IN3}/direction

echo low > "$CTRL_IN1"
echo low > "$CTRL_IN2"
echo low > "$CTRL_IN3"
