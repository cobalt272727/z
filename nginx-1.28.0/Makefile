
default:	build

clean:
	rm -rf Makefile objs

.PHONY:	default clean

build:
	$(MAKE) -f objs/Makefile

install:
	$(MAKE) -f objs/Makefile install

modules:
	$(MAKE) -f objs/Makefile modules

upgrade:
	/root/z/nginx/sbin/nginx -t

	kill -USR2 `cat /root/z/nginx/logs/nginx.pid`
	sleep 1
	test -f /root/z/nginx/logs/nginx.pid.oldbin

	kill -QUIT `cat /root/z/nginx/logs/nginx.pid.oldbin`

.PHONY:	build install modules upgrade
