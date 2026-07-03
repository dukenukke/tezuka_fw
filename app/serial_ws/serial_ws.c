#define _DEFAULT_SOURCE
#define _POSIX_C_SOURCE 200809L

#include <errno.h>
#include <fcntl.h>
#include <getopt.h>
#include <poll.h>
#include <pthread.h>
#include <signal.h>
#include <stdbool.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <termios.h>
#include <time.h>
#include <unistd.h>

#include "civetweb.h"

#define DEFAULT_DEVICE "/dev/ttyPS0"
#define DEFAULT_PORT "7683"
#define DEFAULT_PATH "/serial"
#define LOG_PATH "/tmp/serial_ws.log"
#define BUFFER_SIZE 4096

static volatile sig_atomic_t quitting;
static volatile sig_atomic_t exit_signal;
static pthread_mutex_t client_lock = PTHREAD_MUTEX_INITIALIZER;
static pthread_mutex_t log_lock = PTHREAD_MUTEX_INITIALIZER;
static pthread_mutex_t serial_lock = PTHREAD_MUTEX_INITIALIZER;
static struct mg_connection *client;
static FILE *log_file;
static int serial_fd = -1;
static unsigned long serial_generation;
static const char *serial_device;

static void handle_signal(int sig)
{
	(void)sig;
	exit_signal = sig;
	quitting = 1;
}

static void log_prefix(void)
{
	time_t now = time(NULL);
	struct tm local;
	char timestamp[32];

	if (localtime_r(&now, &local)
	    && strftime(timestamp, sizeof(timestamp), "%Y-%m-%d %H:%M:%S", &local))
		fprintf(log_file, "[%s] ", timestamp);
}

static void log_event(const char *format, ...)
{
	va_list args;

	if (!log_file) return;
	pthread_mutex_lock(&log_lock);
	log_prefix();
	va_start(args, format);
	vfprintf(log_file, format, args);
	va_end(args);
	fputc('\n', log_file);
	fflush(log_file);
	pthread_mutex_unlock(&log_lock);
}

static void log_ws_message(int opcode, const char *data, size_t len)
{
	size_t i;

	if (!log_file) return;
	pthread_mutex_lock(&log_lock);
	log_prefix();
	fprintf(log_file, "WebSocket receive: opcode=%d length=%zu data=", opcode, len);
	for (i = 0; i < len; i++)
		fprintf(log_file, "%02x", (unsigned char)data[i]);
	fputc('\n', log_file);
	fflush(log_file);
	pthread_mutex_unlock(&log_lock);
}

static int write_all(int fd, const char *buf, size_t len)
{
	while (len) {
		ssize_t n = write(fd, buf, len);
		if (n > 0) {
			buf += n;
			len -= (size_t)n;
		} else if (n < 0 && errno == EINTR) {
			continue;
		} else {
			return -1;
		}
	}
	return 0;
}

static int open_serial(const char *device)
{
	int fd = open(device, O_RDWR | O_NOCTTY);
	int error;
	struct termios tty;

	if (fd < 0) return -1;
	if (tcgetattr(fd, &tty) < 0) goto fail;
	cfmakeraw(&tty);
	cfsetispeed(&tty, B115200);
	cfsetospeed(&tty, B115200);
	tty.c_cflag |= CLOCAL | CREAD;
	tty.c_cflag &= ~(CRTSCTS | CSTOPB | PARENB | CSIZE);
	tty.c_cflag |= CS8;
	if (tcsetattr(fd, TCSANOW, &tty) < 0) goto fail;
	return fd;
fail:
	error = errno;
	close(fd);
	errno = error;
	return -1;
}

static void close_serial_locked(void)
{
	if (serial_fd >= 0) close(serial_fd);
	serial_fd = -1;
	serial_generation++;
}

static int send_ws_result(struct mg_connection *conn, int error,
			  const char *operation)
{
	char response[256];
	int len;

	if (error) {
		len = snprintf(response, sizeof(response),
			       "{\"status\":\"error\",\"error\":\"%s failed: %s\"}",
			       operation, strerror(error));
	} else {
		len = snprintf(response, sizeof(response), "{\"status\":\"ok\"}");
	}
	if (len < 0) return -1;
	if ((size_t)len >= sizeof(response)) len = (int)sizeof(response) - 1;
	return mg_websocket_write(conn, MG_WEBSOCKET_OPCODE_TEXT,
				  response, (size_t)len);
}

static int ws_connect(const struct mg_connection *conn, void *data)
{
	(void)conn;
	(void)data;
	return 0;
}

static void ws_ready(struct mg_connection *conn, void *data)
{
	(void)data;
	pthread_mutex_lock(&client_lock);
	/* Serial replies go to the most recently connected client. All clients
	 * may send, which supports short connect/send/disconnect commands. */
	client = conn;
	pthread_mutex_unlock(&client_lock);
}

static int ws_data(struct mg_connection *conn, int flags, char *data,
		   size_t len, void *cbdata)
{
	int opcode = flags & 0x0f;
	int operation_error = 0;
	const char *operation = "serial write";
	(void)cbdata;
	if (opcode == MG_WEBSOCKET_OPCODE_CONNECTION_CLOSE) return 0;
	if (opcode != MG_WEBSOCKET_OPCODE_BINARY &&
	    opcode != MG_WEBSOCKET_OPCODE_TEXT && opcode != 0) {
		log_event("Communication error: unsupported WebSocket opcode %d", opcode);
		return 1;
	}
	log_ws_message(opcode, data, len);
	pthread_mutex_lock(&serial_lock);
	if (serial_fd < 0) {
		serial_fd = open_serial(serial_device);
		serial_generation++;
		if (serial_fd < 0) {
			operation_error = errno;
			operation = "serial open";
			log_event("Communication error: cannot reopen %s: %s",
				  serial_device, strerror(operation_error));
		} else {
			log_event("Serial connection reopened");
		}
	}
	if (serial_fd >= 0 && write_all(serial_fd, data, len) < 0) {
		operation_error = errno;
		fprintf(stderr, "Serial write failed: %s\n",
			strerror(operation_error));
		log_event("Communication error: serial write failed: %s",
			  strerror(operation_error));
		close_serial_locked();
	}
	pthread_mutex_unlock(&serial_lock);

	if (send_ws_result(conn, operation_error, operation) <= 0)
		log_event("Communication error: WebSocket result write failed");
	return 1;
}

static void ws_close(const struct mg_connection *conn, void *data)
{
	(void)data;
	pthread_mutex_lock(&client_lock);
	if (client == conn) client = NULL;
	pthread_mutex_unlock(&client_lock);
}

static void usage(const char *name)
{
	fprintf(stderr, "Usage: %s [-v] [-d device] [-p port] [-r path]\n", name);
}

int main(int argc, char **argv)
{
	const char *device = DEFAULT_DEVICE;
	const char *port = DEFAULT_PORT;
	const char *path = DEFAULT_PATH;
	struct mg_context *server;
	struct pollfd serial_poll;
	char buf[BUFFER_SIZE];
	const char *exit_reason = "normal shutdown";
	bool verbose = false;
	int opt;

	while ((opt = getopt(argc, argv, "hvd:p:r:")) != -1) {
		switch (opt) {
		case 'd': device = optarg; break;
		case 'p': port = optarg; break;
		case 'r': path = optarg; break;
		case 'v': verbose = true; break;
		case 'h': usage(argv[0]); return 0;
		default: usage(argv[0]); return 1;
		}
	}
	if (verbose) {
		log_file = fopen(LOG_PATH, "a");
		if (!log_file) {
			fprintf(stderr, "Cannot open log %s: %s\n", LOG_PATH,
				strerror(errno));
			return 1;
		}
		log_event("serial_ws started");
	}

	signal(SIGINT, handle_signal);
	signal(SIGTERM, handle_signal);
	signal(SIGPIPE, SIG_IGN);
	serial_fd = open_serial(device);
	if (serial_fd < 0) {
		fprintf(stderr, "Cannot open %s: %s\n", device, strerror(errno));
		log_event("Communication error: cannot open %s: %s", device,
			  strerror(errno));
		log_event("Exit reason: serial device open failed");
		if (log_file) fclose(log_file);
		return 1;
	}
	serial_device = device;

	const char *options[] = { "listening_ports", port, "num_threads", "2", NULL };
	server = mg_start(NULL, NULL, options);
	if (!server) {
		fprintf(stderr, "Cannot listen on port %s\n", port);
		log_event("Communication error: cannot listen on port %s", port);
		log_event("Exit reason: WebSocket server startup failed");
		close(serial_fd);
		if (log_file) fclose(log_file);
		return 1;
	}
	mg_set_websocket_handler(server, path, ws_connect, ws_ready,
				 ws_data, ws_close, NULL);
	fprintf(stderr, "Bridging ws://0.0.0.0:%s%s to %s at 115200 8N1\n",
		port, path, device);
	serial_poll.events = POLLIN;

	while (!quitting) {
		unsigned long polled_generation;

		pthread_mutex_lock(&serial_lock);
		serial_poll.fd = serial_fd;
		polled_generation = serial_generation;
		pthread_mutex_unlock(&serial_lock);
		if (serial_poll.fd < 0) {
			poll(NULL, 0, 500);
			continue;
		}
		int ready = poll(&serial_poll, 1, 500);
		if (ready < 0 && errno == EINTR) continue;
		if (ready < 0) {
			fprintf(stderr, "Serial poll failed: %s\n", strerror(errno));
			log_event("Communication error: serial poll failed: %s",
				  strerror(errno));
			exit_reason = "serial poll failed";
			break;
		}
		if (ready == 0) continue;
		pthread_mutex_lock(&serial_lock);
		if (serial_poll.fd != serial_fd ||
		    polled_generation != serial_generation) {
			pthread_mutex_unlock(&serial_lock);
			continue;
		}
		if (!(serial_poll.revents & POLLIN)) {
			fprintf(stderr, "Serial device error (poll events 0x%x)\n",
				serial_poll.revents);
			log_event("Communication error: serial poll events 0x%x",
				  serial_poll.revents);
			exit_reason = "serial device error";
			pthread_mutex_unlock(&serial_lock);
			break;
		}
		ssize_t n = read(serial_fd, buf, sizeof(buf));
		if (n < 0 && errno == EINTR) {
			pthread_mutex_unlock(&serial_lock);
			continue;
		}
		if (n < 0) {
			fprintf(stderr, "Serial read failed: %s\n", strerror(errno));
			log_event("Communication error: serial read failed: %s",
				  strerror(errno));
			exit_reason = "serial read failed";
			pthread_mutex_unlock(&serial_lock);
			break;
		}
		pthread_mutex_unlock(&serial_lock);
		if (n == 0) continue;
		pthread_mutex_lock(&client_lock);
		if (client) {
			int written = mg_websocket_write(client,
						 MG_WEBSOCKET_OPCODE_BINARY,
						 buf, (size_t)n);
			/* CivetWeb returns zero for a connection that is already
			 * closed, and -1 for a write error. Neither is success. */
			if (written <= 0) {
				fprintf(stderr, "WebSocket write failed (%d)\n", written);
				log_event("Communication error: WebSocket write failed (%d)",
					  written);
				client = NULL;
			}
		}
		pthread_mutex_unlock(&client_lock);
	}

	mg_stop(server);
	pthread_mutex_lock(&serial_lock);
	close_serial_locked();
	pthread_mutex_unlock(&serial_lock);
	if (exit_signal)
		log_event("Exit reason: signal %d", exit_signal);
	else
		log_event("Exit reason: %s", exit_reason);
	if (log_file) fclose(log_file);
	return quitting ? 0 : 1;
}
