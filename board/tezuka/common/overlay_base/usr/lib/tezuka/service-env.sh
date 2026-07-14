#!/bin/sh

# Return success when a service is enabled in the U-Boot environment.
# Missing or unrecognised values preserve the historical behaviour (enabled).
service_env_enabled() {
	service_env_value=$(fw_printenv -n "$1" 2>/dev/null) || service_env_value=on
	case "$service_env_value" in
		0|no|off|false|disabled) return 1 ;;
		*) return 0 ;;
	esac
}

service_env_skip() {
	printf '%s disabled by fw_setenv %s\n' "$2" "$1"
}
