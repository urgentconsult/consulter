var args = require('minimist')(process.argv.slice(2))
  , fs = require('fs')
  , forever = require('forever-monitor')
  , path = require('path');
    
var consul_host = args.consul_host  || process.env.CONSUL_HOST || '127.0.0.1'
  , consul_port = args.consul_port  || process.env.CONSUL_PORT || 8500
  , consul_path = args.consul_path  || process.env.CONSUL_PATH || false
  , config_path = args.config_path  || process.env.CONFIG_PATH || false
  , app_path    = ('_' in args && args._.length > 0) ? path.resolve(args._.slice(0,1).pop()) : ''
  , child_process = false;
  
var forever_confs = {
  env: {
    NODE_ENV : 'consulter'
  }
};

// write consul k/v config to a file location specified by config options or 
// $PWD/config/consulter.json then, launch the program up with forever.js or
// relaunch if it was running append NODE_ENV=consulter so that node programs 
// pick this up by default
var launchOrRelaunch = function(conf) {
  console.log('New configuration retrieved from consul k/v service');
  
  if (config_path === false) {
    return ;
  }
  
  fs.exists(config_path, function(exists) {
    if (!exists) {
      console.error('A valid filepath needs to be passed')
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
          console.error('Restarting script due to consul k/v changes');            
        });          
      }
    });
  });
}
  
if (consul_path === false) {
  console.error('A valid consul key path is required')
  return process.exit(-1);
}

// remove superfluous trailing / from paths
if (consul_path.length > 0 && consul_path[consul_path.length - 1] === '/') {
  consul_path.slice(0, -1);
}

fs.exists(app_path, function(exists) {
  if (!exists && app_path !== '') {
    console.error('"' + app_path + '"');
    console.error('A valid filepath needs to be passed')
    process.exit(-1);
  }
  
  var consul = require('consul')({ host: consul_host, port: consul_port });
  
  var watch = consul.watch({ method: consul.kv.get, options: { key: consul_path, recurse: true }});
  
  watch.on('change', function(data, res) {
    var res = {};
    
    data.forEach(function(keyVal) {
      if (keyVal.Key[keyVal.Key.length - 1] === '/') {
        keyVal.Key.slice(0,-1);
      } 
      
      var key = keyVal.Key.replace(consul_path, '').split('/');      
       
      (function stringToObject(key, res, value) {        
        if (key.length === 0 || key[0].length === 0) return;
        
        var thisKey = key.shift();
                
        if ((key.length === 0 || key[0].length === 0) && value !== null) {
          res[thisKey] = value;
        } else if (res.hasOwnProperty(thisKey) === false) {
          res[thisKey] = {};
        }
        
        stringToObject(key, res[thisKey], value);
      })(key, res, keyVal.Value);                  
    });
    
    launchOrRelaunch(res);
  });
 
  watch.on('error', function(err) {
    console.error('Error communicating with Consul, shutting down: ' + err);
    process.exit(-1);
  });
});
  
