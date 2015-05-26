# consulter

Consul configuration writer with a process-restarting wrapper for Node.JS.  This is useful if you:

* Want to write JSON configuration files from a consul key/value base path (i.e., for usage with [node-config](https://github.com/lorenwest/node-config))
* Want your process to fetch the latest configuration before starting (optionally)
* Want your process to relaunch whenever configuration changes (optionally)

### Usage

```
> consulter [OPTIONS] [path to node.js application filepath to start]

> --consul_path REQUIRED The base path of a configuration tree.  Recursively fetches sub-keys and creates a JSON structure with the `base_path` omitted from the JSON keys
> --consul_host OPTIONAL The consul server hostname or IP, defaults to 127.0.0.1 if omitted
> --consul_port OPTIONAL The consul server port number, defaults to 8500
> --config_path OPTIONAL The configuration path that you want the JSON structure written to.  This should just be a directory path, a file named "consulter.json" will be created inside of the specified directory.

Path to a node.js script is optional; you can run this without a node.js application if you want to just use this script to fetch the latest configuration whenever it changes and write it to file.
```

### Examples

```
consulter --consul_path=app-configs/test/ --config_path=./
consulter --consul_path=app-configs/test/ --config_path=./ index.js
consulter --consul_path=app-configs/test/ (if you just wanted to get alerts whenever configuration changed)
consulter --consul_path=app-configs/test/ --config_path=./ --consul_host=consul.service.consul --consul-port=8500 index.js
```


