CFLAGS += -std=c99 -O2
LDLIBS += -lcivetweb -lpthread

TARGET = serial_ws

all: $(TARGET)

$(TARGET): serial_ws.c
	$(CC) $(CFLAGS) $(LDFLAGS) -o $@ $< $(LDLIBS)

install: $(TARGET)
	install -D -m 0755 $(TARGET) $(DESTDIR)/usr/bin/$(TARGET)

clean:
	$(RM) $(TARGET)

.PHONY: all install clean
