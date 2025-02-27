# node-red-contrib-asterisk-ari


<span style="color:green">This module is a fork from [Sam Machin](https://github.com/sammachin/nodered-asterisk-ari)</span>

node-red-contrib-asterisk-ari is a module for nodered to manage Asterisk IPBX communications.

It allows to use Stasis application and theses functions :  
- answer
- continueInDialPlan
- playback
- hangup
- originate
- dtmf listen
- bridgedial : receive a call then dial to connect caller
  
It uses Rest api from Asterisk : ari

### Prerequisites

Have Node-RED installed and working, if you need to
install Node-RED see [here](https://nodered.org/docs/getting-started/installation).

- [Node.js](https://nodejs.org) v20.0.0+
- [Node-RED](https://nodered.org/) v3.1.1+

## Installation

Install via Node-RED Manage Palette

```
@minscof/node-red-contrib-asterisk-ari
```

Install via npm

```shell
$ cd ~/.node-red
$ npm install @minscof/node-red-contrib-asterisk-ari
# then restart node-red
```

### Requirements
node-red-contrib-asterik-ari requires to activate ari on asterisk server

Stasis application requires modules :
- res_ari.so                     Asterisk RESTful Interface               
- res_ari_applications.so        RESTful API module - Stasis application  
- res_ari_asterisk.so            RESTful API module - Asterisk resources  
- res_ari_events.so              RESTful API module - WebSocket resource  
- res_ari_model.so               ARI Model validators                     

answer : require 


## Usage

## Example
output example application node, event StasisStart 
```json
{   "event":"StasisStart",
    "channel":"1739903441.42",
    "client":"xx:xx:xx:xx:xx:xx",
    "payload":{
                "type":"StasisStart",
                "timestamp":"2025-02-18T18:30:41.969+0000",
                "args":[],
                "channel":{
                            "id":"1739903441.42",
                            "name":"PJSIP/yyyyyy",
                            "state":"Ring",
                            "protocol_id":"zz@zz",
                            "caller":{
                                        "name":"",
                                        "number":"+tel number caller"
                                    },
                            "connected":{
                                        "name":"",
                                        "number":""
                                    },
                            "accountcode":"",
                            "dialplan":{
                                        "context":"from-external",
                                        "exten":"+tel number called",
                                        "priority":2,
                                        "app_name":"Stasis",
                                        "app_data":"application"
                                        },
                            "creationtime":"2025-02-18T18:30:41.968+0000",
                            "language":"fr"
                            },
                "asterisk_id":"xx:xx:xx:xx:xx:xx",
                "application":"application"
                },
    "_msgid":"1fd285aa51c2a5a0"
}

```

## Limitation
Can not yet launch call, only receive call

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License
[MIT](https://choosealicense.com/licenses/mit/)

## Project status














-------------------------------------------------------------------------------------------------------------------------
ARI commands on asterisk server :
```
ari mkpasswd                   -- Encrypts a password
ari set debug                  -- Enable/disable debugging of an ARI application
ari show apps                  -- List registered ARI applications
ari show app                   -- Display details of a registered ARI application
ari show status                -- Show ARI settings
ari show users                 -- List ARI users
ari show user                  -- List single ARI user
```


manual installation for dev
 cd ~  
 git clone http://...  
 cd ~/.node-red
 remove line after dependencies  
 "node-red-contrib-asterisk-ari": "file:../node-red-contrib-asterisk-ari"  
 in file ~/.nodered/package.json  
 then npm prune  
 -> remove packages for node-red-contrib-asterisk-ari  
 then  
 npm install ~/node-red-contrib-asterisk-ari/  
 -> install updated packages  
  
run node-red locally  
node --inspect $(which node-red)  
  

test : http://127.0.0.1:1880/

