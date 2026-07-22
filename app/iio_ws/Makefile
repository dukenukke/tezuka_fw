
CFLAGS += -O2
LDLIBS += -liio -lwebsockets -lpthread

all: iio_ws_proxy

iio_ws_proxy: iio_ws_proxy.c
	$(CC) $(CFLAGS) $(LDFLAGS) -o $@ $< $(LDLIBS)

clean:
	rm -f iio_ws_proxy
