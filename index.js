#!/usr/bin/env node

var args = require('minimist')(process.argv.slice(2))
  , fs = require('fs')
  , forever = require('forever-monitor')
  , path = require('path');
    
var consul_host = args.consul_host  || process.env.CONSUL_HOST || '127.0.0.1'
  , consul_port = args.consul_port  || process.env.CONSUL_PORT || 8500
  , consul_path = args.consul_path  || process.env.CONSUL_PATH || false
  , config_path = args.config_path  || process.env.CONFIG_PATH || false
  , app_path    = ''
  , child_process = false;
    
var forever_confs = {
  env: {
    NODE_ENV : 'consulter'
  }
};

var log = function(type, message) {
  message = '[consulter] ' + message;
  
  if (console.hasOwnProperty(type) === true) {
    console[type](message);    
  } else {
    console.log(message);
  }
}

// write consul k/v config to a file location specified by config options or 
// $PWD/config/consulter.json then, launch the program up with forever.js or
// relaunch if it was running append NODE_ENV=consulter so that node programs 
// pick this up by default
var launchOrRelaunch = function(conf) {
  log('log', 'New configuration retrieved from consul k/v service');
  
  if (config_path === false) {
    return ;
  }
  
  fs.exists(config_path, function(exists) {
    if (!exists) {
      log('error', 'A valid filepath needs to be passed')
      return process.exit(-1);
    }
        
    fs.writeFile(config_path  + '/consulter.json', JSON.stringify(conf, false, 2), function() {
      if (app_path === '') {
        return ;
      }
      
      if (child_process !== false) {
        child_process.restart();
      } else {
        child_process = forever.start(app_path, forever_confs);
                
        child_process.on('restart', function() {
          log('error', 'Restarting script due to consul k/v changes');            
        });          
      }
    });
  });
};


var execute = function() {
  var consul = require('consul')({ host: consul_host, port: consul_port });
  
  var watch = consul.watch({ method: consul.kv.get, options: { key: consul_path, recurse: true }});
  
  watch.on('change', function(data, res) {
    var res = {};
        
    if (!data) {
      log('error', 'Error retrieving configuration for specified consul key: ' + consul_path);
    }
    
    try {
      res = JSON.parse(data.shift().Value);
    } catch (e) {
      log('error', 'Value should be valid JSON, but could not be parsed.');
      return ;
    }
    
    launchOrRelaunch(res);  
  });
 
  watch.on('error', function(err) {
    log('error', 'Error communicating with Consul, shutting down: ' + err);
    process.exit(-1);
  });
};
  
if (consul_path === false) {
  log('error', 'A valid consul key path is required')
  return process.exit(-1);
}

// remove superfluous trailing / from paths
if (consul_path.length > 0 && consul_path[consul_path.length - 1] === '/') {
  consul_path.slice(0, -1);
}

if ('_' in args && args._.length === 1) {
  app_path = path.resolve(args._.pop());
  
  fs.exists(app_path, function(exists) {
    if (!exists && app_path !== '') {
      log('error', 'A valid filepath needs to be passed')
      process.exit(-1);
    }
  
    execute();
  });
} else if ('_' in args && args._.length > 1){
  app_path = args._;
  execute();
} else {
  execute();
}