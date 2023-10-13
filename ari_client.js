var ari = require('ari-client');
var uuid = require('uuid');


module.exports = function(RED) {
    "use strict";

    var asterisks_ari = {};
    var stasis_apps ={};
    class StasisApp{
        static GetOrCreate(app_name,asterisk_ari, node){
            if (asterisk_ari.constructor.name !== 'AsteriskAri'){
                console.error(`Wrong type of parameter in StasisApp.GetOrCreate asteris_ary type: ${type(asterisk_ari)}`);
                return;
            }
            let key=`${app_name}-${asterisk_ari.url}`;
            if (key in stasis_apps){
                return stasis_apps[key];
            } else {
                return new StasisApp(app_name,asterisk_ari, node);
            }
        }
        constructor(app_name,asterisk_ari,node) {
            if(asterisk_ari.constructor.name !== 'AsteriskAri'){
                console.error(`Wrong type of parameter in StasisApp.GetOrCreate asteris_ary type: ${type(asterisk_ari)}`);
                return;
            }
            let key=`${app_name}-${asterisk_ari.url}`;
            if (key in stasis_apps){
                console.error(`Application already registred ${name}, ${asterisk_ari.url}`);
            }
            this.node = node;
            node.stasis_app=this;
            this.app_name = app_name;
            this.asterisk_ari = asterisk_ari;
            this.node.status({fill: "red", shape: "dot", text: `Initialising`});
            this.started = false;
            this._heardbeat();
            this._register_app();
        }
        _register_app(){
            if (!this.asterisk_ari.connection_status){
                this.node.status({fill: "red", shape: "dot", text: `asterisk not connected`});
                setTimeout(() => {
                            console.warn(`Can't start App  ${this.app_name} on ${this.asterisk_ari.url} asterisk not connected...`);
                            this._register_app();
                        }, 1000);
                return;
            }
            this.asterisk_ari.ari.start(this.app_name).bind(this)
                .then(function (){
                    console.log(`Registered App ${this.app_name} on ${this.asterisk_ari.url}`);
                    this.node.status({fill: "green", shape: "dot", text: `${this.app_name} on ${this.asterisk_ari.url}`});
                    this.started = true;
                    this.node.on("close", this._close_app);
                })
                .catch(function (err){
                    console.error(err);
                    setTimeout(() => {
//                            console.log(`Trying to reconnect ${url}`);
                            this._register_app();
                        }, 1000);
                });
        }
        _heardbeat(){
            setTimeout(function(){
                if (this.started) {
                    this.node.status({
                        fill: "red",
                        shape: "dot",
                        text: `${this.app_name} on ${this.asterisk_ari.url} wait for answer...`
                    });

                    this.connection_status = false;
                    try {
                        this.asterisk_ari.ari.applications.filter({applicationName: this.app_name}).bind(this)
                            .then(function () {
                                this.node.status({
                                    fill: "green",
                                    shape: "dot",
                                    text: `${this.app_name} on ${this.asterisk_ari.url}`
                                });
                                //console.log(`PONG ${application.name} from ${this.asterisk_ari.url}`)

                            })
                            .catch(function (err) {
                                this.node.status({
                                    fill: "red",
                                    shape: "dot",
                                    text: `Error: ${this.app_name} on ${this.asterisk_ari.url} ${err}`
                                });
                                console.warn(` ${this.app_name} from ${this.asterisk_ari.url} => ${err}`);
                                this._register_app();

                            });

                    }
                    catch (err){
                        this.node.status({
                        fill: "red",
                        shape: "dot",
                        text: `${this.app_name} on ${this.asterisk_ari.url} err: ${err}`
                    });
                    }
                } else {
                    this.node.status({
                        fill: "red",
                        shape: "dot",
                        text: `${this.app_name} on ${this.asterisk_ari.url} wait for starting...`
                    });
                }
                this._heardbeat();
            }.bind(this),1000);
        }

        _close_app(){ // TODO THIS in this method are NODE not StasisApp instance why ??
            console.log(`Close App ${this.stasis_app.app_name} on ${this.stasis_app.asterisk_ari.url}`);
            this.stasis_app.asterisk_ari.ari.stop(this.stasis_app.app_name).bind(this)
                .then(function (){
                    console.log(`Stopped App ${this.stasis_app.app_name} on ${this.stasis_app.asterisk_ari.url}`);
                    this.status({fill: "red", shape: "dot", text: `${this.app_name} on ${this.asterisk_ari.url}`});
                    this.stasis_app.started = false;
                })
                .catch(function (err){
                    console.error(err);
                });
        }
    }
    class AsteriskAri{
        static GetOrCreate(url,username, password ){
            if (url in asterisks_ari){
                return asterisks_ari[url];
            } else{
                return new AsteriskAri(url,username, password);
            }
        }
        constructor(url,username, password) {
            if (url in asterisks_ari) {
                console.log(`Asterisk Already connected!!!`);
                //this = asterisks_ari[this.id];
                return;
            }
            this.id = (url);
            asterisks_ari[this.id] = this;
            this.connection_status=false;
            this.ari=null;
            this.url= url;
            this.username=username;
            this.password=password;
            this._connect_attempt();
            setTimeout(() => {
                            console.log(`Starting cycle for ${this.url}..`);
                            ;
                        }, 1000);
        }

        _connect_attempt() {
            console.log(`Trying connect to ${this.url}`);
            ari.connect(this.url, this.username, this.password ).bind(this)
                .then(function (ari) {
                    if (!this.ari){this.ari = ari;}
                    console.log(`Connected to asterisk ${this.url}`);
                    this.connection_status=true;
                    this._heardbeat();
                })
                .catch(function (err) {
                    console.error(`Connection to ${this.url}: ${err} trying..`);
                    setTimeout(() => {
                        this._connect_attempt();}, 1000);
                });
            }
        _heardbeat() {
            setTimeout(function(){
                this.connection_status = false;
                try {
                    this.ari.asterisk.ping().bind(this)
                        .then(function (asteriskping) {
                            if (asteriskping.ping === "pong") {
                                console.debug(`PING ${this.url} => ${asteriskping.ping}`);
                                this.connection_status = true;
                            } else {
                                console.warn(`PING ${this.url} => ${asteriskping.ping}`);
                                this.connection_status = false;
                            }

                        })
                        .catch(function (err) {
                            console.warn(`PING ${this.url} => ${err}`);
                            this.connection_status = false;
                        });
                }
                catch (err){
                    this.connection_status = false;
                    console.warn(`PING ${this.url} => ${err}`);
                }
                finally {
                    this._heardbeat();
                }
            }.bind(this),1000);
        }
        /*register_app(app_name){
            console.log(`${this.ari}, ${app_name}`);
        }
*/
    }

    var ariConnectionPool = (function() {
        var connections = {};
        var channels = {};
        var obj = {
            setconn: function(url,username,password, node) {
                var id = uuid.v4();
                ari.connect(url, username, password, function(err, client){
                    if (err) {
                        node.error(err);
                        return;
                      }
                    var id = uuid.v4(client._connection.host);
                    connections[id] =client;
                    clientLoaded(client, node.app_name, node,id);
                });
                //connections[id]._id = id;
                //connections[id]._nodeCount = 0;
                //connections[id]._nodeCount += 1;
                return connections[id];
            },
            getconn : function(id){
                return connections[id];
            },
            close: function(connection) {
                connection._nodeCount -= 1;
                if (connection._nodeCount === 0) {
                    delete connections[connection._id];
                }
            },
            setchan: function(channel){
                var id = channel.id;
                channels[id] = channel;
                //channel.on('StasisEnd', function (event, channel) {
                    //console.log(`Channel ${channel} HANGUP`)
                //    delete channels[id]
                //})
                return id;
            },
            getchan: function(id){
                return channels[id];
            },
            getchans: function() {
                return channels;
            },
            closechan: function (id){
                delete channels[id];
            }
        };
        return obj;
    }());

    function clientLoaded (client, app, node, id) {
        function heardbeat() {
            setTimeout(function(){
                client.asterisk.ping(
                    function (err, asteriskping) {
                        if (err) {
                            console.log(err);
                            node.status({fill: "red", shape: "dot", text: `NOT connected!`});
                        } else {
                            if(asteriskping.ping === "pong" ){
                                node.status({fill: "green", shape: "dot", text: `connected to ${node.app_name}`});
                            } else {
                                console.warn(asteriskping);
                                node.status({fill: "orange", shape: "dot", text: `Connection Warning ${asteriskping}`});
                            }


                        }
                    }
                );


                heardbeat();
            },1000);
        }

        function stasisStart(event, channel) {
            var dialed = event.args[0] === 'dialed';
            if (!dialed){
                var channelid = ariConnectionPool.setchan(channel);
                var msg = {};
                msg.channel = channelid;
                msg.client = id;
                msg.payload = event;
                var stat_data= {};
                stat_data.chanCount = Object.keys(ariConnectionPool.getchans()).length;
                node.send([msg, null, stat_data]);
            }

        }
        function stasisEnd(event, channel){
            ariConnectionPool.closechan(channel.id);
            //console.log(event)
        }
        function dtmfEvent(event, channel){
            var msg = {};
            msg.channel = channel.id;
            msg.client = id;
            msg.payload = event;
            node.send([null, msg]);
        }
        client.on('StasisStart', stasisStart);
        client.on('StasisEnd', stasisEnd);
        client.on('ChannelDtmfReceived', dtmfEvent);
        client.start(app);
        heardbeat();
    }
    function ari_application_node(n){
        RED.nodes.createNode(this,n);
        var application_node = this;
        var asterisk_ari_node = RED.nodes.getNode(n.server);
        var asteriskARI_instance = AsteriskAri.GetOrCreate(asterisk_ari_node.credentials.url, asterisk_ari_node.credentials.username, asterisk_ari_node.credentials.password);
        var stasis_app = StasisApp.GetOrCreate(n.app_name,asteriskARI_instance,application_node);
        setTimeout(() => {
                            console.log(`Starting cycle complete..`);
                            ;
                        }, 10000);


    }

    /*function ari_client(n) {
        RED.nodes.createNode(this,n);
        var node = this;
        //this.sip_user = n.sip_user
        //this.sip_password = n.sip_password
        this.server = RED.nodes.getNode(n.server);
        this.app_name = n.app_name;
        //provision(this.server.credentials.url, this.server.credentials.username, this.server.credentials.password, this.sip_user, this.sip_password)
        provision(this.server.credentials.url, this.server.credentials.username, this.server.credentials.password)
        //this.conn = ariConnectionPool.setconn(this.server.credentials.url, this.server.credentials.username, this.server.credentials.password, this.sip_password, node)
        this.conn = ariConnectionPool.setconn(this.server.credentials.url, this.server.credentials.username, this.server.credentials.password, node)
        this.on("close", function() {
            //deprovision(this.server.credentials.url, this.server.credentials.username, this.server.credentials.password, this.sip_user)
            //this.conn.close()
        });
    }
    RED.nodes.registerType("ari_client",ari_client);
    */
    RED.nodes.registerType("ari_client",ari_application_node);

    function ari_playback(n) {
        RED.nodes.createNode(this,n);
        var node = this;
        node.config = n;
        this.media = n.media
        node.on('input', function (msg) {
            this.media2 = RED.util.evaluateNodeProperty(node.config.media2, node.config.media2Type, node,msg);
            //this.media2 = node.media2
            var client = ariConnectionPool.getconn(msg.client)
            var channel = ariConnectionPool.getchan(msg.channel)
            if (typeof channel !=='undefined'){
                node.status({fill:"blue",shape:"dot",text:`playing ${this.media2}`});
                var playback = client.Playback();
                channel.play({media: this.media2}, playback)
                    .then(function(playback) {
                        playback.on('PlaybackFinished', function (event, completedPlayback) {
                            //console.log(`Finish ${playback.id}`)
                            msg.payload = event;
                            node.send(msg);
                            node.status({});
                        });
                    })
                    .catch(function (err){
                        console.error(`Playback failed ${err}`)
                        node.send(msg)
                        node.status({})
                    });
            } else {
                node.status({})
            }

            //playback.on('PlaybackFinished', function(event, completedPlayback) {
            //    msg.payload = event
            //    node.send(msg)
            //    node.status({})
            //});

            //console.log(`Starting ${this.media2}`)
            //client.channels.play({
            //    media: this.media2,
            //    channelId:channel.id,
            //    playbackId: playback.id
            //}, function (err,playback){
            //    if (err) {
            //        console.error(`Playback failed:${err}`)
            //        node.send(msg)
            //        node.status({})
//
            //    } else {
            //        msg.payload = true
            //        node.send(msg)
            //        node.status({})
            //        console.log(`Finish ${playback.id}`)
            //    }
            //})



            //channel.play({media: this.media2},
            //                  playback, function(err, newPlayback) {if (err) {throw err;}});
            //playback.on('PlaybackFinished', function(event, completedPlayback) {
            //    msg.payload = event
            //    node.send(msg)
            //    node.status({})
            //});
        });

        this.on("close", function() {
              // Called when the node is shutdown - eg on redeploy.
              // Allows ports to be closed, connections dropped etc.
              // eg: node.client.disconnect();
        });
    }
    RED.nodes.registerType("ari_playback",ari_playback);

    function ari_hangup(n) {
        RED.nodes.createNode(this,n);
        var node = this;
        node.on('input', function (msg) {
          node.status({fill:"blue",shape:"dot"});
            var channel = ariConnectionPool.getchan(msg.channel)
            channel.hangup(function(err) {
                if (err) {node.error(err);}
                node.status({})
            });
        });
    }
    RED.nodes.registerType("ari_hangup",ari_hangup);


    function ari_answer(n) {
        RED.nodes.createNode(this,n);
        var node = this;
        node.on('input', function (msg) {
          node.status({fill:"blue",shape:"dot"});
          var client = ariConnectionPool.getconn(msg.client)
          var channel = ariConnectionPool.getchan(msg.channel)
          client.channels.answer({channelId: channel.id},function (err) {
            if (err) {node.error(err);}
            msg.payload = 'answered'
            node.send(msg)
            node.status({})
          });
        });

        this.on("close", function() {
              // Called when the node is shutdown - eg on redeploy.
              // Allows ports to be closed, connections dropped etc.
              // eg: node.client.disconnect();
        });
    }
    RED.nodes.registerType("ari_answer",ari_answer);

    function ari_bridgedial(n){
        RED.nodes.createNode(this,n);
        var node = this;
        this.destination = n.destination
        this.callerId = n.callerId
        node.on('input', function (msg) {
          node.status({fill:"blue",shape:"dot"});
          var client = ariConnectionPool.getconn(msg.client)
          var channel = ariConnectionPool.getchan(msg.channel)
          // Create outbound channel
          var dialed = client.Channel();
          var bridge = client.Bridge();
          var bridgeid = bridge.id
          bridge.create({type: 'mixing, dtmf_events'}, function(err) {if (err) {throw err;}})
          client.start(bridgeid);
          dialed.on('StasisStart', function(event, dialed) {
            dialed.answer(function(err) {if (err) {throw err;}})
            bridge.addChannel({channel: [channel.id, dialed.id]}, function(err) {if (err) {throw err;}});
            var channelid = ariConnectionPool.setchan(dialed)
            var bmsg = {}
            bmsg.channel = channelid
            bmsg.client = client.id
            msg.type = "connected"
            bmsg.type = "connected"
            bmsg.payload = {bridge : bridge.id}
            msg.payload = {bridge : bridge.id}
            if (n.connected_event) {
                node.send([msg, bmsg])
            }
          });
          dialed.on('StasisEnd', function(event, dialed) {
            bridge.destroy(function(err) {});
            msg.type = "ended"
            msg.payload = event
            if (n.ended_event) {
                node.send([msg, null])
            }
            node.status({});
          });
          channel.on('StasisEnd', function(event, channel) {
            var msg = {}
            msg.type = "ended"
            msg.channel = dialed.id
            msg.client = client.id
            msg.payload = event
            bridge.destroy(function(err) {});
            if (n.ended_event) {
                node.send([null, msg])
            }

            node.status({});
          });
          channel.on('ChannelDtmfReceived', function(event, channel){
            var msg = {}
            msg.type = "DTMF"
            msg.channel = channel.id
            msg.client = client.id
            msg.payload = event
            node.send([msg, null])
          });
          dialed.on('ChannelDtmfReceived', function(event, dialled){
            var msg = {}
            msg.type = "DTMF"
            msg.channel = dialled.id
            msg.client = client.id
            msg.payload = event
            node.send([null, msg])
          });

          dialed.originate({endpoint: this.destination, callerId: this.callerId, app: bridgeid, appArgs: 'dialed'}, function(err, response) {
              if (err) {throw err;}
          });
        });

        this.on("close", function() {
              // Called when the node is shutdown - eg on redeploy.
              // Allows ports to be closed, connections dropped etc.
              // eg: node.client.disconnect();
        });
    }
    RED.nodes.registerType("ari_bridgedial",ari_bridgedial);
}

//function provision(url,username,passwordd) {
function provision(url,username,password) {
    ari.connect(url, username, password)
        .then(function (ari){
            console.log(ari.bridges);
            //console.log(ari.channels);
            //console.log(ari.endpoints);
        })
        .catch(function (err) {
            console.error(err)
        })
}

    /*.then(function (client){
        client.asterisk.updateObject({
          configClass: 'res_pjsip',
          id: sip_user,
          objectType: 'auth',
          fields : [
              { attribute: 'auth_type', value: 'userpass' },
              { attribute: 'username', value: sip_user },
              { attribute: 'password', value: sip_password }
          ]
      })
      .then (function (configTuples){
          //console.log(configTuples)
          client.asterisk.updateObject({
              configClass: 'res_pjsip',
              id: sip_user,
              objectType: 'aor',
              fields : [
                  { attribute: 'support_path', value: "yes" },
                  { attribute: 'remove_existing', value: "yes" },
                  { attribute: 'max_contacts', value: "1" }
              ]
              })
              .then (function (configTuples){
                  //console.log(configTuples)
                  client.asterisk.updateObject({
                  configClass: 'res_pjsip',
                  id: sip_user,
                  objectType: 'endpoint',
                  fields : [
                      { attribute: 'from_user', value: sip_user },
                      { attribute: 'allow', value: "!all,g722,ulaw,alaw" },
                      { attribute: 'ice_support', value: "yes" },
                      { attribute: 'force_rport', value: "yes" },
                      { attribute: 'rewrite_contact', value: "yes" },
                      { attribute: 'rtp_symmetric', value: "yes" },
                      { attribute: 'context', value: "applications" },
                      { attribute: 'auth', value: sip_user },
                      { attribute: 'aors', value: sip_user }
                  ]
                  })
                  .then (function (configTuples){
                      //console.log(configTuples)
                  })
              })
          })
    })
    .catch(function (err) {
        console.log(err)
    });*/



//  function deprovision(url,username,password, sip_user){
function deprovision(url,username,password){
    ari.connect(url, username, password)
    .then(function (client){
        client.asterisk.deleteObject({
          configClass: 'res_pjsip',
          id: sip_user,
          objectType: 'endpoint'
      })
      .then (function (configTuples){
          //console.log(configTuples)
          client.asterisk.deleteObject({
              configClass: 'res_pjsip',
              id: sip_user,
              objectType: 'aor'
              
              })
              .then (function (configTuples){
                  console.log(configTuples)
                  client.asterisk.deleteObject({
                  configClass: 'res_pjsip',
                  id: sip_user,
                  objectType: 'auth'
                  })
                  .then (function (configTuples){
                      console.log(configTuples)
                  })
              })
          })
    })
    .catch(function (err) {
        console.log(err)
    });
  
  
  }
  