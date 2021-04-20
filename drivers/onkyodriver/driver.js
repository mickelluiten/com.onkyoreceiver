/* eslint-disable linebreak-style */

'use strict';

const Homey = require('homey');
const net = require('net');
const { ManagerSettings } = require('homey');

let onkyoSocket = {};
let onkyoSocketConnected = false;

class onkyoDriver extends Homey.Driver {

  onInit() {
    this.log('onkyoDriver has been inited');
    // register a listener for changes in de manager settingss.
    ManagerSettings.on('set', data => {
      this.log('Manager setting are changed');
      this.log(`IP Adress:   ${ManagerSettings.get('ipAddressSet')}`);
      this.log(`Port: ${ManagerSettings.get('portSettings')}`);
      this.log(`Max Volume:  ${ManagerSettings.get('maxVolumeSet')}`);
      this.log(`Receiver Volume Step:  ${ManagerSettings.get('ReceiverVolumeStep')}`);
      this.log(`Volume Step: ${ManagerSettings.get('volumeStepSet')}`);
    });
  }

  // create and open the socket
  socketConnection(settings) {
    onkyoSocket = new net.Socket();
    onkyoSocket.connect(Number(ManagerSettings.get('portSettings')), ManagerSettings.get('ipAddressSet'), () => {
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
      data: {
        id: 'main',
      },
    },
    {
      name: 'Zone 2',
      data: {
        id: 'zone2',
      },
    },
    {
      name: 'Zone 3',
      data: {
        id: 'zone3',
      },
    },
    ];
    this.socketConnection(Number(ManagerSettings.get('portSettings')), ManagerSettings.get('ipAddressSet')); // start socket for receiver check
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
          socket.emit('errors', 'No response from receiver, check IP or port', (err, data) => {
          });
        }
      }
    });
  }

}

module.exports = onkyoDriver;
