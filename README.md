# nodered-asterisk-ari
## attempts to add StateFull functionality (fork started 11.2022)


To start node-red container in DEBUG mode:
```bash
docker run --name NodeRed_v3_2022_0_0 -it -p 1880:1880 -p 9229:9229 -v /Users/Dima/PycharmProjects/nodered-asterisk-ari:/data/nodered-asterisk-ari  --entrypoint npm nodered/node-red  run debug_brk -- --userDir /data
```