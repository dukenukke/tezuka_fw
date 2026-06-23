/*
 * Stream AD9361 CS8 IQ samples over a WebSocket.
 *
 * This is intentionally close to plutorx.c: libiio owns the RX data path,
 * CivetWeb only handles the WebSocket framing.
 */

#include <arpa/inet.h>
#include <ctype.h>
#include <errno.h>
#include <getopt.h>
#include <iio.h>
#include <pthread.h>
#include <signal.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include "civetweb.h"

#define PROGRAM_VERSION "0.1.0"
#define DEFAULT_PORT "7682"
#define DEFAULT_WS_URI "/iq"
#define MAX_CLIENTS 4
#define MAX_BUFF_SIZE 32000000LL
#define MAX_TOTAL_SIZE 60000000LL
#define MAX_KERNEL_BUFFERS 64

struct client_slot {
    struct mg_connection *conn;
    bool active;
};

static volatile sig_atomic_t want_quit = 0;
static pthread_mutex_t clients_lock = PTHREAD_MUTEX_INITIALIZER;
static struct client_slot clients[MAX_CLIENTS];
static unsigned int client_count = 0;

static void signal_handler(int sig)
{
    (void)sig;
    want_quit = 1;
}

static void print_usage(void)
{
    fprintf(stderr,
            "plutorx_ws-%s\n"
            "Usage: plutorx_ws [options]\n"
            "  -h              show this help\n"
            "  -u uri          libiio URI prefix to select, e.g. ip:plutosdr.local\n"
            "  -s samplerate   RX sample rate in samples/s\n"
            "  -b bytes        requested IIO block size in bytes\n"
            "  -k count        kernel buffer count\n"
            "  -p port         WebSocket listen port, default " DEFAULT_PORT "\n"
            "  -r path         WebSocket path, default " DEFAULT_WS_URI "\n"
            "\n"
            "CS8 stream endpoint: ws://<device>:%s%s\n",
            PROGRAM_VERSION,
            DEFAULT_PORT,
            DEFAULT_WS_URI);
}

static int ws_connect_handler(const struct mg_connection *conn, void *cbdata)
{
    (void)conn;
    (void)cbdata;
    return 0; /* accept */
}

static void ws_ready_handler(struct mg_connection *conn, void *cbdata)
{
    (void)cbdata;

    pthread_mutex_lock(&clients_lock);
    if (client_count >= MAX_CLIENTS) {
        pthread_mutex_unlock(&clients_lock);
        mg_websocket_write(conn, MG_WEBSOCKET_OPCODE_CONNECTION_CLOSE, NULL, 0);
        return;
    }

    for (unsigned int i = 0; i < MAX_CLIENTS; i++) {
        if (!clients[i].active) {
            clients[i].conn = conn;
            clients[i].active = true;
            client_count++;
            break;
        }
    }
    pthread_mutex_unlock(&clients_lock);

    static const char metadata[] =
        "{\"format\":\"cs8\",\"channels\":\"iq\",\"endianness\":\"iqiq\"}";

    mg_websocket_write(conn,
                       MG_WEBSOCKET_OPCODE_TEXT,
                       metadata,
                       sizeof(metadata) - 1);
}

static int ws_data_handler(struct mg_connection *conn,
                           int flags,
                           char *data,
                           size_t data_len,
                           void *cbdata)
{
    (void)conn;
    (void)data;
    (void)data_len;
    (void)cbdata;

    if ((flags & 0x0f) == MG_WEBSOCKET_OPCODE_CONNECTION_CLOSE) {
        return 0;
    }
    return 1;
}

static void ws_close_handler(const struct mg_connection *conn, void *cbdata)
{
    (void)cbdata;

    pthread_mutex_lock(&clients_lock);
    for (unsigned int i = 0; i < MAX_CLIENTS; i++) {
        if (clients[i].active && clients[i].conn == conn) {
            clients[i].active = false;
            clients[i].conn = NULL;
            if (client_count > 0) {
                client_count--;
            }
            break;
        }
    }
    pthread_mutex_unlock(&clients_lock);
}

static unsigned int get_client_snapshot(struct mg_connection **snapshot,
                                        unsigned int max_snapshot)
{
    unsigned int count = 0;

    pthread_mutex_lock(&clients_lock);
    for (unsigned int i = 0; i < MAX_CLIENTS && count < max_snapshot; i++) {
        if (clients[i].active) {
            snapshot[count++] = clients[i].conn;
        }
    }
    pthread_mutex_unlock(&clients_lock);

    return count;
}

static bool has_clients(void)
{
    bool active;

    pthread_mutex_lock(&clients_lock);
    active = client_count > 0;
    pthread_mutex_unlock(&clients_lock);

    return active;
}

static void drop_client(struct mg_connection *conn)
{
    pthread_mutex_lock(&clients_lock);
    for (unsigned int i = 0; i < MAX_CLIENTS; i++) {
        if (clients[i].active && clients[i].conn == conn) {
            clients[i].active = false;
            clients[i].conn = NULL;
            if (client_count > 0) {
                client_count--;
            }
            break;
        }
    }
    pthread_mutex_unlock(&clients_lock);
}

static int send_to_clients(const char *data, size_t len)
{
    struct mg_connection *snapshot[MAX_CLIENTS];
    unsigned int count = get_client_snapshot(snapshot, MAX_CLIENTS);
    int sent = 0;

    for (unsigned int i = 0; i < count; i++) {
        int ret = mg_websocket_write(snapshot[i],
                                     MG_WEBSOCKET_OPCODE_BINARY,
                                     data,
                                     len);
        if (ret < 0) {
            drop_client(snapshot[i]);
        } else {
            sent++;
        }
    }

    return sent;
}

static struct iio_context *open_iio_context(const char *uri_prefix)
{
    struct iio_context *ctx = NULL;
    struct iio_scan_context *scan_ctx;
    struct iio_context_info **info = NULL;

    scan_ctx = iio_create_scan_context("local:usb:ip", 0);
    if (!scan_ctx) {
        return NULL;
    }

    ssize_t ret = iio_scan_context_get_info_list(scan_ctx, &info);
    if (ret > 0) {
        for (ssize_t i = 0; i < ret; i++) {
            const char *dev_id = iio_context_info_get_uri(info[i]);
            fprintf(stderr, "Discovered: %s\n", dev_id);

            if (ctx) {
                continue;
            }

            if (uri_prefix && uri_prefix[0]) {
                if (strncmp(uri_prefix, dev_id, strlen(uri_prefix)) == 0) {
                    ctx = iio_create_context_from_uri(dev_id);
                    fprintf(stderr, "Using %s\n", dev_id);
                }
            } else {
                ctx = iio_create_context_from_uri(dev_id);
                fprintf(stderr, "Using %s\n", dev_id);
            }
        }
        iio_context_info_list_free(info);
    }

    iio_scan_context_destroy(scan_ctx);
    return ctx;
}

int main(int argc, char **argv)
{
    char uri_prefix[255] = "";
    char port[16] = DEFAULT_PORT;
    char ws_uri[64] = DEFAULT_WS_URI;
    long long sample_rate = 0;
    size_t buf_request = 0;
    unsigned int kernel_buffer_cnt = 0;
    int opt;

    while ((opt = getopt(argc, argv, "hu:s:b:k:p:r:")) != -1) {
        switch (opt) {
        case 'h':
            print_usage();
            return 0;
        case 'u':
            snprintf(uri_prefix, sizeof(uri_prefix), "%s", optarg);
            break;
        case 's':
            sample_rate = atoll(optarg);
            break;
        case 'b':
            buf_request = (size_t)atoll(optarg);
            break;
        case 'k':
            kernel_buffer_cnt = (unsigned int)atoi(optarg);
            break;
        case 'p':
            snprintf(port, sizeof(port), "%s", optarg);
            break;
        case 'r':
            snprintf(ws_uri, sizeof(ws_uri), "%s", optarg);
            break;
        default:
            print_usage();
            return 1;
        }
    }

    signal(SIGINT, signal_handler);
    signal(SIGTERM, signal_handler);
    signal(SIGQUIT, signal_handler);
    signal(SIGPIPE, SIG_IGN);

    struct iio_context *ctx = open_iio_context(uri_prefix);
    if (!ctx) {
        fprintf(stderr, "Error: no PlutoSDR/libiio context found\n");
        return 1;
    }

    struct iio_device *phy = iio_context_find_device(ctx, "ad9361-phy");
    struct iio_device *rx = iio_context_find_device(ctx, "cf-ad9361-lpc");
    if (!phy || !rx) {
        fprintf(stderr, "Error: missing ad9361-phy or cf-ad9361-lpc device\n");
        iio_context_destroy(ctx);
        return 1;
    }

    struct iio_channel *chn_i = iio_device_get_channel(rx, 0);
    struct iio_channel *chn_q = iio_device_get_channel(rx, 1);
    if (!chn_i || !chn_q) {
        fprintf(stderr, "Error: missing RX channels\n");
        iio_context_destroy(ctx);
        return 1;
    }

    iio_channel_enable(chn_i);
    iio_channel_disable(chn_q); /* Tezuka CS8 mode packs IQ bytes on voltage0. */

    if (sample_rate > 0) {
        iio_channel_attr_write_longlong(iio_device_find_channel(phy, "voltage0", false),
                                        "sampling_frequency",
                                        sample_rate);
    }
    iio_channel_attr_read_longlong(iio_device_find_channel(phy, "voltage0", false),
                                   "sampling_frequency",
                                   &sample_rate);

    size_t block_size = buf_request ? buf_request : (size_t)(sample_rate / 20);
    block_size = (block_size >> 12) << 12;
    if (block_size == 0) {
        block_size = 4096;
    }
    if (block_size > MAX_BUFF_SIZE) {
        block_size = MAX_BUFF_SIZE;
    }

    if (kernel_buffer_cnt == 0) {
        kernel_buffer_cnt = (unsigned int)(MAX_TOTAL_SIZE / block_size);
        if (kernel_buffer_cnt == 0) {
            kernel_buffer_cnt = 1;
        }
        if (kernel_buffer_cnt > MAX_KERNEL_BUFFERS) {
            kernel_buffer_cnt = MAX_KERNEL_BUFFERS;
        }
    }

    iio_device_set_kernel_buffers_count(rx, kernel_buffer_cnt);
    struct iio_buffer *rxbuf = iio_device_create_buffer(rx, block_size / 4, false);
    if (!rxbuf) {
        fprintf(stderr, "Error: failed to create RX buffer\n");
        iio_context_destroy(ctx);
        return 1;
    }

    const char *server_options[] = {
        "listening_ports", port,
        "num_threads", "4",
        "request_timeout_ms", "2000",
        NULL
    };
    struct mg_context *server = mg_start(NULL, NULL, server_options);
    if (!server) {
        fprintf(stderr, "Error: failed to start websocket server on port %s\n", port);
        iio_buffer_destroy(rxbuf);
        iio_context_destroy(ctx);
        return 1;
    }
    mg_set_websocket_handler(server,
                             ws_uri,
                             ws_connect_handler,
                             ws_ready_handler,
                             ws_data_handler,
                             ws_close_handler,
                             NULL);

    fprintf(stderr,
            "Streaming CS8 IQ from %.3f Msps at ws://0.0.0.0:%s%s\n",
            sample_rate / 1000000.0,
            port,
            ws_uri);
    fprintf(stderr,
            "IIO block size: %zu bytes, kernel buffers: %u\n",
            block_size,
            kernel_buffer_cnt);

    uint32_t val = 0;
    iio_device_reg_read(rx, 0x80000088, &val);
    iio_device_reg_write(rx, 0x80000088, val);

    while (!want_quit) {
        if (!has_clients()) {
            usleep(20000);
            continue;
        }

        ssize_t size = iio_buffer_refill(rxbuf);
        if (size < 0) {
            fprintf(stderr, "IIO refill failed: %zd\n", size);
            break;
        }

        iio_device_reg_read(rx, 0x80000088, &val);
        if (val & 4) {
            fprintf(stderr, "!");
            fflush(stderr);
            iio_device_reg_write(rx, 0x80000088, val);
        }

        send_to_clients((const char *)iio_buffer_first(rxbuf, chn_i), (size_t)size);
    }

    mg_stop(server);
    iio_buffer_destroy(rxbuf);
    iio_context_destroy(ctx);
    return 0;
}
