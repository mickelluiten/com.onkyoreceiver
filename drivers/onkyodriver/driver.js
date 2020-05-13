
'use strict';

const Homey = require('homey');
const net = require('net');
const { ManagerSettings } = require('homey');

let onkyoSocket = {};
let onkyoSocketConnected = false;


class onkyoDriver extends Homey.Driver {

  onInit() {
    this.log('onkyoDriver has been inited');
  }

  // create and open the socket
  socketConnection(settings) {
    onkyoSocket = new net.Socket();
    onkyoSocket.connect(60128, ManagerSettings.get('ipAddressSet'), () => {
    });

    // socket timeout
    onkyoSocket.on('timeout', () => {
      this.log('Connection timed out.');
      onkyoSocket.destroy();
    });

    // socket close
    onkyoSocket.on('close', () => {
      this.log(`Connection closed to IP: ${ManagerSettings.get('ipAddressSet')}`);
    });

    onkyoSocket.on('error', err => {
      this.log(`Error:${err}`);
    });

    onkyoSocket.on('connect', () => {
      this.log(`Connected with receiver on IP: ${ManagerSettings.get('ipAddressSet')}`);
      onkyoSocketConnected = true;
    });

    onkyoSocket.on('data', (data, callback) => {
      let payLoad = this.eiscpPacket(data);
      payLoad = data.toString().split('!1');
      payLoad = JSON.stringify(payLoad[1]);
      payLoad = payLoad.split('\\u');
      payLoad = payLoad[0].substring(1);
      this.log(`Received data from receiver: ${payLoad}`);
    });
  }

  eiscpPacket(cmd) {
    const cmdLength = cmd.length + 1;
    const code = String.fromCharCode(cmdLength);
    const line = `ISCP\x00\x00\x00\x10\x00\x00\x00${code}\x01\x00\x00\x00${cmd}\x0D`;
    return line;
  }

  sendCommand(cmd) {
    onkyoSocket.write(this.eiscpPacket(`!1${cmd}`));
    // this.log(`Sending ${cmd} to device`);
  }

  onPair(socket) {
    // create the devices data property.
    const devices = [{
      name: 'Main Zone',
      capabilitiesOptions: {
        volume_set: {
          min: 0, max: 0.5, step: 0.1, decimals: 0, type: 'number',
        },
      },
      capabilities: [
        'volume_mute',
        'volume_set',
        'onoff',
        'volume_down.',
        'volume_mute',
        'volume_up',
        'input_changed'],
      data: {
        id: 'zone1',
      },
    },
    {
      name: 'Zone 2',
      capabilitiesOptions: {
        volume_set: {
          min: 0, max: ManagerSettings.get('maxVolumeSet'), step: 1, decimals: 0, type: 'number',
        },
      },
      capabilities: [
        'volume_mute',
        'volume_set',
        'onoff',
        'volume_down.',
        'volume_mute',
        'volume_up',
        'input_changed'],
      data: {
        id: 'zone2',
      },
    },
    {
      name: 'Zone 3',
      capabilitiesOptions: {
        volume_set: {
          min: 0, max: ManagerSettings.get('maxVolumeSet'), step: 1, decimals: 0, type: 'number',
        },
      },
      capabilities: [
        'volume_mute',
        'volume_set',
        'onoff',
        'volume_down.',
        'volume_mute',
        'volume_up',
        'input_changed'],
      data: {
        id: 'zone3',
      },
    },
    ];
    this.socketConnection(ManagerSettings.get('ipAddressSet')); // start socket for receiver check
    socket.on('showView', (viewId, callbackShow) => {
      callbackShow();
      if (viewId === 'start') {
        if (ManagerSettings.get('ipAddressSet') === '0.0.0.0' || ManagerSettings.get('ipAddressSet') === '127.0.0.1') {
          socket.emit('errors', 'Default or NO IP address, go to general settings to change.', (err, data) => {
          });
        } else if (onkyoSocketConnected) {
          this.log('Receiver is reachable');
          onkyoSocket.destroy();
          onkyoSocketConnected = false;
          socket.emit('continue', null);
          socket.on('list_devices', (data, callback) => {
            callback(null, devices);
          });
        } else {
          socket.emit('errors', 'No response from receiver, check IP', (err, data) => {
          });
        }
      }
    });
  }

}


module.exports = onkyoDriver;
