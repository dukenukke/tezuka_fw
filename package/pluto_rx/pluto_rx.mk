################################################################################
#
# pluto_rx
#
################################################################################

PLUTO_RX_VERSION = 1.0
PLUTO_RX_SITE = $(BR2_EXTERNAL_PLUTOSDR_PATH)/app/pluto_rx
PLUTO_RX_SITE_METHOD = local
PLUTO_RX_DEPENDENCIES = libiio

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

$(eval $(generic-package))
