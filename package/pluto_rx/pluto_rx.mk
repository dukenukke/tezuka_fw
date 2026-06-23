################################################################################
#
# pluto_rx
#
################################################################################

PLUTO_RX_VERSION = 1.0
PLUTO_RX_SITE = $(BR2_EXTERNAL_PLUTOSDR_PATH)/app/pluto_rx
PLUTO_RX_SITE_METHOD = local
PLUTO_RX_DEPENDENCIES = libiio civetwebws

define PLUTO_RX_BUILD_CMDS
	$(TARGET_CONFIGURE_OPTS) $(MAKE) -C $(@D) \
		CFLAGS="$(TARGET_CFLAGS) -std=c99 -O3" \
		LDFLAGS="$(TARGET_LDFLAGS) -liio -lm" \
		all
endef

define PLUTO_RX_INSTALL_TARGET_CMDS
	$(TARGET_CONFIGURE_OPTS) $(MAKE) -C $(@D) \
		DESTDIR="$(TARGET_DIR)/usr" install
endef

define PLUTO_RX_INSTALL_INIT_SYSV
	$(INSTALL) -D -m 0755 \
		$(BR2_EXTERNAL_PLUTOSDR_PATH)/package/pluto_rx/S61plutorx-ws \
		$(TARGET_DIR)/etc/init.d/S61plutorx-ws
endef

$(eval $(generic-package))
