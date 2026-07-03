################################################################################
# serial_ws
################################################################################

SERIAL_WS_VERSION = 1.0
SERIAL_WS_SITE = $(BR2_EXTERNAL_PLUTOSDR_PATH)/app/serial_ws
SERIAL_WS_SITE_METHOD = local
SERIAL_WS_DEPENDENCIES = civetwebws

define SERIAL_WS_BUILD_CMDS
	$(TARGET_CONFIGURE_OPTS) $(MAKE) -C $(@D) \
		CFLAGS="$(TARGET_CFLAGS) -std=c99 -O2" \
		LDFLAGS="$(TARGET_LDFLAGS)" all
endef

define SERIAL_WS_INSTALL_TARGET_CMDS
	$(TARGET_CONFIGURE_OPTS) $(MAKE) -C $(@D) \
		DESTDIR="$(TARGET_DIR)" install
endef

$(eval $(generic-package))
