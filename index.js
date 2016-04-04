#!/usr/bin/env node

var args = require('minimist')(process.argv.slice(2))
  , fs = require('fs')
  , forever = require('forever-monitor')
  , path = require('path');
    
var consul_host = args.consul_host     || process.env.CONSUL_HOST     || '127.0.0.1'
  , consul_port = args.consul_port     || process.env.CONSUL_PORT     || 8500
  , consul_path = args.consul_path     || process.env.CONSUL_PATH     || false
  , config_path = args.config_path     || process.env.CONFIG_PATH     || false
  , config_file = args.config_filename || process.env.CONFIG_FILENAME || false
  , one_time    = args.single_run      || process.env.SINGLE_RUN      || false
  , use_env     = args.file_from_env   || process.env.FILE_FROM_ENV   || false
  , node_env    = process.env.NODE_ENV || 'consulter'
  , file_ext    = '.json'
  , app_path    = ''
  , child_process = false;

if(config_file===false) {
  config_file = (use_env ? node_env : 'consulter') + file_ext;
}

if(!use_env) {
  node_env = config_file.substr(0, config_file.length - file_ext.length);
}

var forever_confs = {
  env: {
    NODE_ENV : node_env
  },
  spinSleepTime: 5000,
  minUptime: 5000,
  max: 10
};

var log = function(type, message) {
  message = '[consulter] ' + message;
  
  if (console.hasOwnProperty(type) === true) {
    console[type](message);    
  } else {
    console.log(message);
  }
};

var cleanup = function(skip_child_exit) {
  fs.exists(config_path + '/' + config_file, function(exists) {
    log('log', 'Exiting...');
    
    if (child_process !== false && !skip_child_exit) {
      child_process.kill();
    }
    
    if (exists) {
      fs.unlink(config_path + '/' + config_file, function() {
        process.exit();
      });
    } else {
      process.exit();
    }
  });
};

// write consul k/v config to a file location specified by config options or 
// $PWD/config/consulter.json then, launch the program up with forever.js or
// relaunch if it was running.
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
        
    fs.writeFile(config_path  + '/' + config_file, JSON.stringify(conf, false, 2), function() {      
      if (one_time || app_path === '') {
        return process.exit();
      }
      
      if (child_process !== false) {
        child_process.restart();
      } else {
        child_process = forever.start(app_path, forever_confs);
                
        child_process.on('restart', function() {
          log('error', 'Restarting script due to consul k/v changes or script failure');            
        });
        
        child_process.on('exit', function() {
          log('error', 'Process could not stay up, exiting...');
          cleanup(true);
        });
      }
    });
  });
};


var execute = function() {
  var consul = require('consul')({ host: consul_host, port: consul_port });
  
  var watch = consul.watch({ method: consul.kv.get, options: { key: consul_path, recurse: true }});
  
  watch.on('change', function(data, res) {
    res = {};
        
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
    log('error', 'Error communicating with Consul, updates to configuration will resume when consul recovers: ' + err);
  });
};
  
if (consul_path === false) {
  log('error', 'A valid consul key path is required');
  return process.exit(-1);
}

// remove superfluous trailing / from paths
if (consul_path.length > 0 && consul_path[consul_path.length - 1] === '/') {
  consul_path.slice(0, -1);
}

if ('_' in args && args._.length === 1 && args._[0].indexOf('.js') !== -1) {
  app_path = path.resolve(args._.pop());
  
  fs.exists(app_path, function(exists) {
    if (!exists && app_path !== '') {
      log('error', 'A valid filepath needs to be passed');
      process.exit(-1);
    }
  
    execute();
  });
} else if ('_' in args && args._.length > 0){
  app_path = args._;
  execute();
} else {
  execute();
}

// Cleanup files created on exit
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('SIGHUP', cleanup);
