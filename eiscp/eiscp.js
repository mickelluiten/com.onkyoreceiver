/* eslint-disable linebreak-style */
/* jslint node:true nomen:true */
/* eslint-disable max-len */
/* eslint-disable camelcase */
/* eslint-disable no-unused-vars */
/* eslint-disable no-shadow */
/* eslint-disable no-multi-assign */
/* eslint-disable no-useless-escape */
/* eslint-disable consistent-return */
/* eslint-disable prefer-rest-params */
/* eslint-disable vars-on-top */
/* eslint-disable no-var */
/* eslint-disable no-lonely-if */
/* eslint-disable prefer-const */
/* eslint-disable new-cap */

'use strict';

let self; let eiscp; let send_queue;
const net = require('net');
const dgram = require('dgram');
const util = require('util');
const async = require('async');
const events = require('events');
const eiscp_commands = require('./eiscp-commands.json');

const COMMANDS = eiscp_commands.commands;
const COMMAND_MAPPINGS = eiscp_commands.command_mappings;
const VALUE_MAPPINGS = eiscp_commands.value_mappings;
const MODELSETS = eiscp_commands.modelsets;
const config = {
  port: 60128, reconnect: false, reconnect_sleep: 3, modelsets: [], send_delay: 500, verify_commands: false,
};

module.exports = self = new events.EventEmitter();

self.is_connected = false;

function in_modelsets(set) {
  // returns true if set is in modelsets false otherwise
  return (config.modelsets.indexOf(set) !== -1);
}

function eiscp_packet(data) {
  /*
      Wraps command or iscp message in eISCP packet for communicating over Ethernet
      type is device type where 1 is receiver and x is for the discovery broadcast
      Returns complete eISCP packet as a buffer ready to be sent
    */
  let iscp_msg; let
    header;
    // Add ISCP header if not already present
  if (data.charAt(0) !== '!') {
    data = `!1${data}`;
  }
  // ISCP message
  iscp_msg = new Buffer.from(`${data}\x0D`);
  // eISCP header
  header = new Buffer.from([
    73, 83, 67, 80, // magic
    0, 0, 0, 16, // header size
    0, 0, 0, 0, // data size
    1, // version
    0, 0, 0, // reserved
  ]);
  // write data size to eISCP header
  header.writeUInt32BE(iscp_msg.length, 8);
  self.emit('debug', util.format(`RAW OUTGOING: ${JSON.stringify(Buffer.concat([header, iscp_msg]))}`));

  return Buffer.concat([header, iscp_msg]);
}

function eiscp_packet_extract(packet) {
  /*
      Exracts message from eISCP packet
      Strip first 18 bytes and last 3 since that's only the header and end characters
    */
  self.emit('debug', util.format(`RAW INCOMING: ${JSON.stringify(packet)}`));
  return packet.toString('ascii', 18, packet.length - 3);
}

function iscp_to_command(iscp_message) {
  /*
      Transform a low-level ISCP message to a high-level command
    */
  const command = iscp_message.slice(0, 3);
  const value = iscp_message.slice(3);
  const result = {};

  Object.keys(COMMANDS).forEach(zone => {
    if (typeof COMMANDS[zone][command] !== 'undefined') {
      const zone_cmd = COMMANDS[zone][command];

      result.value = iscp_message;
      result.zone = zone;
      result.command = zone_cmd.name;

      if (typeof zone_cmd.values[value] !== 'undefined') {
        result.argument = zone_cmd.values[value].name;
      } else if (typeof VALUE_MAPPINGS[zone][command].INTRANGES !== 'undefined' && /^[0-9a-fA-F]+$/.test(value)) {
        // It's a range so we need to convert args from hex to decimal
        result.argument = parseInt(value, 16);
      }
    }
  });

  return result;
}

// TODO: This function is starting to get very big, it should be split up into smaller parts and oranized better
function command_to_iscp(command, args, zone) {
  /*
      Transform high-level command to a low-level ISCP message
    */
  let base; let parts; let prefix; let value; let i; let len; let intranges;
  const default_zone = 'main';

  function parse_command(cmd) {
    // Splits and normalizes command into 3 parts: { zone, command, value }
    // Split by space, dot, equals and colon
    const parts = cmd.toLowerCase().split(/[\s\.=:]/).filter(item => {
      return item !== '';
    });
    if (parts.length < 2 || parts.length > 3) {
      return false;
    }
    if (parts.length === 2) {
      parts.unshift('main');
    }
    return {
      zone: parts[0],
      command: parts[1],
      value: parts[2],
    };
  }

  function in_intrange(number, range) {
    const parts = range.split(',');
    number = parseInt(number, 10);
    return (parts.length === 2 && number >= parseInt(parts[0], 10) && number <= parseInt(parts[1], 10));
  }

  // If parts are not explicitly given - parse the command
  if (typeof args === 'undefined' && typeof zone === 'undefined') {
    parts = parse_command(command);
    if (!parts) {
      // Error parsing command
      self.emit('error', util.format('ERROR (cmd_parse_error) Command and arguments provided could not be parsed (%s)', command));
      return;
    }
    zone = parts.zone;
    command = parts.command;
    args = parts.value;
  }

  // self.emit('debug', util.format('DEBUG (command_to_iscp) Zone: %s | Command: %s | Argument: %s', zone, command, args));

  // Find the command in our database, resolve to internal eISCP command

  if (typeof COMMANDS[zone] === 'undefined') {
    self.emit('error', util.format('ERROR (zone_not_exist) Zone %s does not exist in command file', zone));
    return;
  }

  if (typeof COMMAND_MAPPINGS[zone][command] === 'undefined') {
    self.emit('error', util.format('ERROR (cmd_not_exist) Command %s does not exist in zone %s', command, zone));
    return;
  }
  prefix = COMMAND_MAPPINGS[zone][command];

  if (typeof VALUE_MAPPINGS[zone][prefix][args] === 'undefined') {
    if (typeof VALUE_MAPPINGS[zone][prefix].INTRANGES !== 'undefined' && /^\d+$/.test(args)) {
      // This command is part of a integer range
      intranges = VALUE_MAPPINGS[zone][prefix].INTRANGES;
      len = intranges.length;
      for (i = 0; i < len; i += 1) {
        if (in_modelsets(intranges[i].models) && in_intrange(args, intranges[i].range)) {
          // args is an integer and is in the available range for this command
          value = args;
        }
      }

      if (typeof value === 'undefined' && config.verify_commands) {
        self.emit('error', util.format('ERROR (arg_not_in_range) Command %s=%s is not available on this model', command, args));
        return;
      }
      value = args;

      // Convert decimal number to hexadecimal since receiver doesn't understand decimal
      value = (+value).toString(16).toUpperCase();
      // Pad value if it is not 2 digits
      value = (value.length < 2) ? `0${value}` : value;
    } else {
      // Not yet supported command
      self.emit('error', util.format('ERROR (arg_not_exist) Argument %s does not exist in command %s', args, command));
      return;
    }
  } else {
    // Check if the commands modelset is in the receviers modelsets
    if (!config.verify_commands || in_modelsets(VALUE_MAPPINGS[zone][prefix][args].models)) {
      value = VALUE_MAPPINGS[zone][prefix][args].value;
    } else {
      self.emit('error', util.format('ERROR (cmd_not_supported) Command %s in zone %s is not supported on this model.', command, zone));
      return;
    }
  }

  // self.emit('debug', util.format('DEBUG (command_to_iscp) raw command "%s"', prefix + value));

  return prefix + value;
}

self.discover = () => {
  /*
        discover([options, ] callback)
        Sends broadcast and waits for response callback called when number of devices or timeout reached
        option.devices    - stop listening after this amount of devices have answered (default: 1)
        option.timeout    - time in seconds to wait for devices to respond (default: 10)
        option.address    - broadcast address to send magic packet to (default: 255.255.255.255)
        option.port       - receiver port should always be 60128 this is just available if you need it
      */
  let callback; let timeout_timer;
  let options = {};
  const result = [];
  const client = dgram.createSocket('udp4');
  const argv = Array.prototype.slice.call(arguments);
  const argc = argv.length;

  if (argc === 1 && typeof argv[0] === 'function') {
    callback = argv[0];
  } else if (argc === 2 && typeof argv[1] === 'function') {
    options = argv[0];
    callback = argv[1];
  } else {
    return;
  }

  options.devices = options.devices || 1;
  options.timeout = options.timeout || 10;
  options.address = options.address || '255.255.255.255';
  options.port = options.port || 60128;

  function close() {
    client.close();
    callback(false, result);
  }

  client
    .on('error', err => {
      self.emit('error', util.format('ERROR (server_error) Server error on %s:%s - %s', options.address, options.port, err));
      client.close();
      callback(err, null);
    })
    .on('message', (packet, rinfo) => {
      const message = eiscp_packet_extract(packet);
      const command = message.slice(0, 3);
      let data;
      if (command === 'ECN') {
        data = message.slice(3).split('/');
        result.push({
          host: rinfo.address,
          port: data[1],
          model: data[0],
          mac: data[3].slice(0, 12),
          areacode: data[2],
        });
        self.emit('debug', util.format('DEBUG (received_discovery) Received discovery packet from %s:%s (%j)', rinfo.address, rinfo.port, result));
        if (result.length >= options.devices) {
          clearTimeout(timeout_timer);
          close();
        }
      } else {
        self.emit('debug', util.format('DEBUG (received_data) Recevied data from %s:%s - %j', rinfo.address, rinfo.port, message));
      }
    })
    .on('listening', () => {
      client.setBroadcast(true);
      let buffer = eiscp_packet('!xECNQSTN');
      self.emit('debug', util.format('DEBUG (send_discovery) Send Onkyo broadcast discovery packet to %s:%s', options.address, options.port));
      client.send(buffer, 0, buffer.length, options.port, options.address);
      buffer = eiscp_packet('!pECNQSTN');
      self.emit('debug', util.format('DEBUG (send_discovery) Send Pioneer broadcast discovery packet to %s:%s', options.address, options.port));
      client.send(buffer, 0, buffer.length, options.port, options.address);
      timeout_timer = setTimeout(close, options.timeout * 3000);
    })
    .bind(0);
};

self.connect = options => {
  /*
        No options required if you only have one receiver on your network. We will find it and connect to it!
        options.host            - Hostname/IP
        options.port            - Port (default: 60128)
        options.send_delay      - Delay in milliseconds between each command sent to receiver (default: 500)
        options.model           - Should be discovered automatically but if you want to override it you can
        options.reconnect       - Try to reconnect if connection is lost (default: false)
        options.reconnect_sleep - Time in seconds to sleep between reconnection attempts (default: 5)
        options.verify_commands - Whether the reject commands not found for the current model
      */
  let connection_properties;

  options = options || {};
  config.host = options.host || config.host;
  config.port = options.port || config.port;
  config.model = options.model || config.model;
  config.reconnect = (options.reconnect === undefined) ? config.reconnect : options.reconnect;
  config.reconnect_sleep = options.reconnect_sleep || config.reconnect_sleep;
  config.verify_commands = (options.verify_commands === undefined) ? config.verify_commands : options.verify_commands;

  connection_properties = {
    host: config.host,
    port: config.port,
  };

  // If no host is configured - we connect to the first device to answer
  if (typeof config.host === 'undefined' || config.host === '') {
    self.discover((err, hosts) => {
      if (!err && hosts && hosts.length > 0) {
        self.connect(hosts[0]);
      }
    });
    return;
  }

  /*  If host is configured but no model is set - we send a discover directly to this receiver
      if (typeof config.model === 'undefined' || config.model === '') {
          self.discover({address: config.host}, function (err, hosts) {
              if (!err && hosts && hosts.length > 0) {
                  self.connect(hosts[0]);
              }
              return;
          });
          return;
      } */
  /*
        Compute modelsets for this model (so commands which are possible on this model are allowed)
        Note that this is not an exact match, model only has to be part of the modelname
      */
  Object.keys(MODELSETS).forEach(set => {
    MODELSETS[set].forEach(models => {
      if (models.indexOf(config.model) !== -1) {
        config.modelsets.push(set);
      }
    });
  });

  self.emit('debug', util.format('INFO (connecting) Connecting to %s:%s (model: %s)', config.host, config.port, config.model));

  // Reconnect if we have previously connected
  if (typeof eiscp !== 'undefined') {
    eiscp.connect(connection_properties);
    return;
  }

  // Connecting the first time
  eiscp = net.connect(connection_properties);

  eiscp
    .on('connect', () => {
      self.is_connected = true;
      self.emit('debug', util.format('INFO (connected) Connected to %s:%s (model: %s)', config.host, config.port, config.model));
      self.emit('connect', config.host, config.port, config.model);
      eiscp.setTimeout(180000);
    })

    .on('close', () => {
      self.is_connected = false;
      self.emit('debug', util.format('INFO (disconnected) Disconnected from %s:%s', config.host, config.port));
      self.emit('close', config.host, config.port);

      if (config.reconnect) {
        setTimeout(self.connect, config.reconnect_sleep * 1000);
      }
    })

    .on('timeout', err => {
      self.emit('timeout', config.host);
      eiscp.destroy();
    })

    .on('error', err => {
      self.emit('error', util.format('ERROR (server_error) Server error on %s:%s - %s', config.host, config.port, err));
      eiscp.destroy();
    })

    .on('data', data => {
      const iscp_message = eiscp_packet_extract(data);
      const result = iscp_to_command(iscp_message);

      // result.iscp_command = iscp_message;
      // result.host  = config.host;
      // result.port  = config.port;
      // result.model = config.model;
      self.emit('debug', util.format('DEBUG (received_data) Received data from %s:%s - %j', config.host, config.port, result));
      self.emit('data', result);

      // If the command is supported we emit it as well
      if (typeof result.command !== 'undefined') {
        if (Array.isArray(result.command)) {
          result.command.forEach(cmd => {
            self.emit(cmd, result.argument);
          });
        } else {
          self.emit(result.command, result.argument);
        }
      }
    });
};

self.close = self.disconnect = () => {
  if (self.is_connected) {
    eiscp.destroy();
    self.is_connected = false;
  }
};

send_queue = async.queue((data, callback) => {
  /*
      Syncronous queue which sends commands to device
      callback(bool error, string error_message)
    */
  if (self.is_connected) {
    self.emit('debug', util.format('DEBUG (sent_command) Sent command to %s:%s - %s', config.host, config.port, data));

    eiscp.write(eiscp_packet(data));

    setTimeout(callback, config.send_delay, false);
    return;
  }

  self.emit('error', util.format("ERROR (send_not_connected) Not connected, can't send data: %j", data));
  callback('Send command, while not connected', null);
}, 1);

self.raw = (data, callback) => {
  /*
        Send a low level command like PWR01
        callback only tells you that the command was sent but not that it succsessfully did what you asked
      */
  if (typeof data !== 'undefined' && data !== '') {
    send_queue.push(data, err => {
      if (typeof callback === 'function') {
        callback(err, null);
      }
    });
  } else if (typeof callback === 'function') {
    callback(true, 'No data provided.');
  }
};

self.command = (data, callback) => {
  /*
        Send a high level command like system-power=query
        callback only tells you that the command was sent but not that it succsessfully did what you asked
      */
  self.raw(command_to_iscp(data), callback);
};

self.get_commands = (zone, callback) => {
  /*
        Returns all commands in given zone
      */
  const result = [];
  async.each(Object.keys(COMMAND_MAPPINGS[zone]), (cmd, cb) => {
    // console.log(cmd);
    result.push(cmd);
    cb();
  }, err => {
    callback(err, result);
  });
};

self.get_command = (command, callback) => {
  /*
        Returns all command values in given zone and command
      */
  let val;
  let zone;
  const result = [];
  const parts = command.split('.');

  if (parts.length !== 2) {
    zone = 'main';
    command = parts[0];
  } else {
    zone = parts[0];
    command = parts[1];
  }

  async.each(Object.keys(VALUE_MAPPINGS[zone][COMMAND_MAPPINGS[zone][command]]), (val, cb) => {
    result.push(val);
    cb();
  }, err => {
    callback(err, result);
  });
};
