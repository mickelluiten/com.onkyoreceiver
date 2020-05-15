
'use strict';

const Homey = require('homey');
const { ManagerSettings } = require('homey');
const eiscp = require('eiscp');


// let onkyoSocket = {};
// eslint-disable-next-line no-unused-vars
// let onkyoSocketConnectionExisted = false;

class onkyoDevice extends Homey.Device {

  async onInit() {
    this.log(`Device init: name: ${this.getName()}`);

    // rRegister a listener for multiple capability change event
    this.registerMultipleCapabilityListener(['onoff', 'volume_mute', 'volume_set', 'volume_down', 'volume_up'], valueObj => {
      this.sendDeviceStateToReceiver(valueObj, this.getDeviceId());
      return Promise.resolve();
    }, 500);

    // register a listener for changes in de manager settingss.
    ManagerSettings.on('set', data => {
      this.log('Manager setting is changed');
      this.log(`IP Adress:   ${ManagerSettings.get('ipAddressSet')}`);
      this.log(`Max Volume:  ${ManagerSettings.get('maxVolumeSet')}`);
      this.log(`Volume Step: ${ManagerSettings.get('volumeStepSet')}`);
      this.setSettingsVolumeSliderMax(ManagerSettings.get('maxVolumeSet'));
    });
    this.setSettingsVolumeSliderMax(ManagerSettings.get('maxVolumeSet'));

    eiscp.on('debug', msg => {
      this.log(`DEBUG: ${msg}`);
    });

    eiscp.connect({ host: ManagerSettings.get('ipAddressSet') });
  }


  // when device is addded
  onAdded() {
    this.log(`Device "${this.getName()}" is added`);
  }

  // when device is deleted
  onDeleted() {
    this.log(`Device "${this.getName()}" is deleted`);
  }

  // get the device ID
  getDeviceId() {
    const deviceID = Object.values(this.getData());
    return deviceID[0];
  }

  // Setting the maxvolume setting on volume_set capability to scale and refresh device
  async setSettingsVolumeSliderMax(maxVolumeValue) {
    await this.setUnavailable();
    this.setCapabilityOptions('volume_set', {
      min: 0, max: Number(maxVolumeValue), step: 1, decimals: 0,
    });
    await this.setAvailable();
  }

  /*
  socketConnection() {
    onkyoSocket = new net.Socket();
    onkyoSocket.connect(60128, ManagerSettings.get('ipAddressSet'), () => {
      this.log(`Polling device with IP : ${ManagerSettings.get('ipAddressSet')}`);
      onkyoSocketConnectionExisted = true;
      this.setAvailable();
      onkyoSocket.setTimeout(65000);
    });

    // socket error
    onkyoSocket.on('error', err => {
      this.log(`Connection error: ${err}`);
      onkyoSocket.destroy();
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

    // socket data(in)
    onkyoSocket.on('data', data => {
      let payLoad = this.eiscpPacket(data);
      payLoad = data.toString().split('!1');
      payLoad = JSON.stringify(payLoad[1]);
      payLoad = payLoad.split('\\u');
      payLoad = payLoad[0].substring(1);
      this.log(`Received data from device : ${payLoad}`);
    });
  }

  onkyoSocketConnectionRestartOrPoll() {
    // eslint-disable-next-line no-unused-vars
    const socketTimer = setInterval(() => {
      if (onkyoSocketConnectionExisted) {
        if (onkyoSocket.destroyed && onkyoSocket.connecting !== true) {
          this.setUnavailable();
          this.socketConnection(ManagerSettings.get('ipAddressSet'));
        }
      }
    }, 10000);
  }
  */


  // Extract command from receiver
  eiscpPacket(cmd) {
    const cmdLength = cmd.length + 1;
    const code = String.fromCharCode(cmdLength);
    const line = `ISCP\x00\x00\x00\x10\x00\x00\x00${code}\x01\x00\x00\x00${cmd}\x0D`;
    return line;
  }

  // CapabilityListener to send command to receiver.
  async sendDeviceStateToReceiver(valueObj, deviceId) {
    const valueName = Object.keys(valueObj);
    this.log(`Received state change for deviceID: ${deviceId} -- capabilty: ${valueName[0]} -- value: ${valueObj[valueName]}`);
    switch (valueName[0]) {
      case 'onoff':
        if (valueObj[valueName]) {
          this.log('Sending PowerON command to receiver');
        } else {
          this.log('Sending PowerOFF command to receiver');
        }
        break;

      case 'volume_mute':
        if (valueObj[valueName]) {
          this.log('Sending MuteON command to receiver');
          // onkyo.audioMute();
        } else {
          this.log('Sending MuteOFF command to receiver');
          // onkyo.audioUnMute();
        }
        break;

      case 'volume_up':
        this.log('Sending VolumeUP command to receiver');
        break;

      case 'volume_down':
        this.log('Sending VolumeDOWN command to receiver');
        break;

      case 'volume_set':
        this.log('Sending VolumeChANGE command to receiver');
        break;

      default: this.log('Not defined state change command');
    }
  }

}


module.exports = onkyoDevice;
