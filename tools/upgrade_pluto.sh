#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

MODE="msd"
BOARD="pluto"
ARTIFACT=""
MOUNT_DIR=""
NO_EJECT=false
DRY_RUN=false
KEEP_TMP=false
TMP_DIR=""

usage() {
    cat <<'EOF'
Usage: tools/upgrade_pluto.sh [OPTIONS]

Upgrade an original ADALM-Pluto/Pluto-compatible board.

Default mode copies pluto.frm to the Pluto USB mass-storage drive, then
unmounts/ejects it so U-Boot starts the firmware update.

Options:
  -b, --board NAME     Build output board name to use (default: pluto)
  -f, --file PATH      Firmware artifact to use (.frm, .dfu, or .zip)
  -m, --mount PATH     Pluto USB mass-storage mount point
      --dfu            Use dfu-util instead of USB mass-storage copy
      --no-eject       Copy only; do not unmount/eject the USB drive
      --dry-run        Print actions without changing anything
      --keep-tmp       Keep temporary extraction directory
  -h, --help           Show this help

Examples:
  tools/upgrade_pluto.sh
  tools/upgrade_pluto.sh --board nano
  tools/upgrade_pluto.sh --file build/pluto.zip
  tools/upgrade_pluto.sh --mount /media/$USER/PlutoSDR
  tools/upgrade_pluto.sh --dfu --board nano
EOF
}

log() {
    printf '%s\n' "$*"
}

die() {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

cleanup() {
    if [ -n "${TMP_DIR}" ] && [ "${KEEP_TMP}" = false ]; then
        rm -rf "${TMP_DIR}"
    elif [ -n "${TMP_DIR}" ]; then
        log "Kept temporary directory: ${TMP_DIR}"
    fi
}
trap cleanup EXIT

need_cmd() {
    command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

run() {
    if [ "${DRY_RUN}" = true ]; then
        printf '[dry-run]'
        printf ' %q' "$@"
        printf '\n'
    else
        "$@"
    fi
}

abs_path() {
    local path="$1"
    if [ -d "$path" ]; then
        (cd "$path" && pwd)
    else
        local dir
        dir="$(dirname "$path")"
        printf '%s/%s\n' "$(cd "$dir" && pwd)" "$(basename "$path")"
    fi
}

while [ $# -gt 0 ]; do
    case "$1" in
        -b|--board)
            [ $# -ge 2 ] || die "$1 requires a board name"
            BOARD="$2"
            shift 2
            ;;
        -f|--file)
            [ $# -ge 2 ] || die "$1 requires a path"
            ARTIFACT="$2"
            shift 2
            ;;
        -m|--mount)
            [ $# -ge 2 ] || die "$1 requires a path"
            MOUNT_DIR="$2"
            shift 2
            ;;
        --dfu)
            MODE="dfu"
            shift
            ;;
        --no-eject)
            NO_EJECT=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --keep-tmp)
            KEEP_TMP=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            die "unknown option: $1"
            ;;
    esac
done

find_default_artifact() {
    local suffix="$1"
    local candidates=()
    local output_dir="${REPO_DIR}/output/${BOARD}/images"

    if [ "$suffix" = "frm" ]; then
        candidates=(
            "${REPO_DIR}/build/${BOARD}.frm"
            "${output_dir}/flash/pluto.frm"
            "${output_dir}/pluto.frm"
            "${REPO_DIR}/build/${BOARD}.zip"
            "${output_dir}/tezuka.zip"
        )
    else
        candidates=(
            "${REPO_DIR}/build/${BOARD}.dfu"
            "${output_dir}/flash/pluto.dfu"
            "${output_dir}/pluto.dfu"
            "${REPO_DIR}/build/${BOARD}.zip"
            "${output_dir}/tezuka.zip"
        )
    fi

    local candidate
    for candidate in "${candidates[@]}"; do
        if [ -f "$candidate" ]; then
            printf '%s\n' "$candidate"
            return 0
        fi
    done

    return 1
}

extract_from_zip() {
    local zip="$1"
    local suffix="$2"
    need_cmd unzip
    TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/pluto-upgrade.XXXXXX")"

    local member=""
    member="$(unzip -Z1 "$zip" | grep -E "(^|/)pluto[.]${suffix}$" | head -n 1 || true)"
    [ -n "$member" ] || die "could not find pluto.${suffix} inside ${zip}"

    log "Extracting ${member} from ${zip}"
    if [ "${DRY_RUN}" = true ]; then
        printf '%s/pluto.%s\n' "${TMP_DIR}" "${suffix}"
    else
        unzip -p "$zip" "$member" > "${TMP_DIR}/pluto.${suffix}"
        printf '%s/pluto.%s\n' "${TMP_DIR}" "${suffix}"
    fi
}

resolve_artifact() {
    local suffix="$1"
    local artifact="$ARTIFACT"

    if [ -z "$artifact" ]; then
        artifact="$(find_default_artifact "$suffix")" || die "no default ${BOARD} .${suffix} or .zip artifact found; pass --file"
    fi

    [ -f "$artifact" ] || die "artifact not found: ${artifact}"

    case "$artifact" in
        *.zip)
            extract_from_zip "$(abs_path "$artifact")" "$suffix"
            ;;
        *."$suffix")
            abs_path "$artifact"
            ;;
        *)
            die "expected .${suffix} or .zip artifact for ${MODE} mode: ${artifact}"
            ;;
    esac
}

looks_like_pluto_mount() {
    local dir="$1"
    [ -d "$dir" ] || return 1
    [ -w "$dir" ] || return 1
    [ -f "$dir/info.html" ] || [ -f "$dir/config.txt" ] || return 1
}

find_pluto_mount() {
    local candidates=(
        "/media/${USER:-}/PlutoSDR"
        "/media/${USER:-}/Pluto"
        "/run/media/${USER:-}/PlutoSDR"
        "/run/media/${USER:-}/Pluto"
        "/mnt/PlutoSDR"
    )

    local dir
    for dir in "${candidates[@]}"; do
        if looks_like_pluto_mount "$dir"; then
            printf '%s\n' "$dir"
            return 0
        fi
    done

    local matches=()
    for dir in /media/"${USER:-}"/* /run/media/"${USER:-}"/* /mnt/*; do
        if looks_like_pluto_mount "$dir"; then
            matches+=("$dir")
        fi
    done

    if [ "${#matches[@]}" -eq 1 ]; then
        printf '%s\n' "${matches[0]}"
        return 0
    fi

    if [ "${#matches[@]}" -gt 1 ]; then
        printf 'Found multiple possible Pluto mount points:\n' >&2
        printf '  %s\n' "${matches[@]}" >&2
        die "pass one explicitly with --mount"
    fi

    return 1
}

eject_mount() {
    local mount_dir="$1"
    local device=""

    device="$(findmnt -rn -o SOURCE --target "$mount_dir" 2>/dev/null || true)"
    sync

    if [ -n "$device" ] && command -v udisksctl >/dev/null 2>&1; then
        run udisksctl unmount -b "$device"
        run udisksctl power-off -b "$device"
    elif command -v umount >/dev/null 2>&1; then
        run umount "$mount_dir"
    else
        log "Please eject/unmount ${mount_dir} manually to start the firmware update."
    fi
}

upgrade_msd() {
    local frm
    frm="$(resolve_artifact frm)"

    if [ -z "$MOUNT_DIR" ]; then
        MOUNT_DIR="$(find_pluto_mount)" || die "could not find Pluto USB drive; pass --mount"
    fi

    MOUNT_DIR="$(abs_path "$MOUNT_DIR")"
    looks_like_pluto_mount "$MOUNT_DIR" || die "${MOUNT_DIR} does not look like a writable Pluto USB drive"

    log "Using firmware: ${frm}"
    log "Using board output: ${BOARD}"
    log "Using Pluto mount: ${MOUNT_DIR}"
    run cp "$frm" "${MOUNT_DIR}/pluto.frm"
    run sync

    if [ "${NO_EJECT}" = true ]; then
        log "Copied pluto.frm. Eject/unmount the Pluto USB drive manually to start the update."
    else
        log "Ejecting Pluto USB drive to start the update..."
        eject_mount "$MOUNT_DIR"
    fi

    log "Wait for the Pluto LED update sequence to finish before power-cycling or reconnecting."
}

upgrade_dfu() {
    local dfu
    dfu="$(resolve_artifact dfu)"

    if [ "${DRY_RUN}" = false ]; then
        need_cmd dfu-util
    fi
    log "Using DFU firmware: ${dfu}"
    log "Using board output: ${BOARD}"
    run dfu-util -d 0456:b673,0456:b674 -D "$dfu" -a firmware.dfu -R
}

case "$MODE" in
    msd) upgrade_msd ;;
    dfu) upgrade_dfu ;;
    *) die "unsupported mode: ${MODE}" ;;
esac
