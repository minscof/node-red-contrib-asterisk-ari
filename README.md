# nodered-asterisk-ari

## $\text{\color{green}{This module is a fork from Sam Machin }}$

nodered-asterisk-ari is a module for nodered to manage Asterisk IPBX communications.

It allows to define Stasis application and some functions
- answer
- continueInDialPlan
- playback
- hangup
  
It uses Rest api from Asterisk : ari


## Installation

### Requirements
nodered-asterik-ari requires to activate ari on asterisk server

Stasis application requires modules :
- res_ari.so                     Asterisk RESTful Interface               
- res_ari_applications.so        RESTful API module - Stasis application  
- res_ari_asterisk.so            RESTful API module - Asterisk resources  
- res_ari_events.so              RESTful API module - WebSocket resource  
- res_ari_model.so               ARI Model validators                     

answer : require 



## Usage



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
 "nodered-contrib-asterisk-ari-2025": "file:../node-red-asterisk-ari"  
 in file ~/.nodered/package.json  
 then npm prune  
 -> remove packages for nodered-asterisk-ari  
 then  
 npm install ~/nodered-asterisk-ari/  
 -> install updated packages  
  
run node-red  
node --inspect $(which node-red)  
  

test : http://127.0.0.1:1880/

