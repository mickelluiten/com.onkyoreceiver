/* eslint-disable no-unused-vars */
/* eslint-disable max-len */

'use strict';

const Homey = require('homey');
const { ManagerSettings } = require('homey');
const { ManagerDrivers } = require('homey');
const eiscp = require('eiscp');

let onkyoSocketConnectionExisted = false;
let deviceMainIsDeleted = false;
let DeviceMainIsInUse = false;
let DeviceZone2IsInUse = false;
let DeviceZone3IsInUse = false;
let receiverVolumeStepVar = 1;
const debug = false;

class onkyoDevice extends Homey.Device {

  async onInit() {
    deviceMainIsDeleted = false;
    switch (this.getDeviceId()) {
      case 'main':
        DeviceMainIsInUse = true;
        this.setDeviceAvaible('main');
        break;
      case 'zone2':
        DeviceZone2IsInUse = true;
        this.setDeviceAvaible('zone2');
        break;
      case 'zone3':
        DeviceZone3IsInUse = true;
        this.setDeviceAvaible('zone3');
        break;
      default: this.log('no devices in init');
    }
    this.log(`device init: name = ${this.getName()}, id = ${this.getDeviceId()}`);

    // Register a listener for multiple capability change events
    this.registerMultipleCapabilityListener(['onoff', 'volume_mute', 'volume_set', 'volume_down', 'volume_up', 'inputset'], valueObj => {
      this.setDeviceStateToReceiver(valueObj, this.getDeviceId());
      return Promise.resolve();
    }, 500);

    // register listener for flowcardtriggers
    const receiveCustomflowTrigger = new Homey.FlowCardTrigger('receivecustomcommand');
    receiveCustomflowTrigger
      .registerRunListener(() => {
        return Promise.resolve();
      })
      .register();

    // Register a global token voor receiveCustomflowTrigger
    const receiveCustomGlobalToken = new Homey.FlowToken('receivecustomglobaltoken', {
      title: 'Received-Command',
    });
    receiveCustomGlobalToken.register();

    // register listeners for flowcardactions
    new Homey.FlowCardAction('sendcustomcommand')
      .register()
      .registerRunListener(args => {
        this.log(`Sending custom command: ${args.command}`);
        eiscp.command(args.command);
        return Promise.resolve(true);
      });

    new Homey.FlowCardAction('sendrawcommand')
      .register()
      .registerRunListener(args => {
        this.log(`Sending RAW  command: ${args.command}`);
        eiscp.raw(args.command);
        return Promise.resolve(true);
      });

    this.setSettingsVolumeSliderMax(ManagerSettings.get('maxVolumeSet'), ManagerSettings.get('ReceiverVolumeStep'));

    // Main zone needs always there.
    if (this.getDeviceId() === 'main') {
      if (ManagerSettings.get('ipAddressSet') !== '0.0.0.0') {
        this.socketConnector(); // start the socket
      }
      // register a listener for changes in de manager settingss.
      ManagerSettings.on('set', data => {
        eiscp.close();
        if (DeviceMainIsInUse) {
          this.setDeviceUnAvaible('main');
        }
        if (DeviceZone2IsInUse) {
          this.setDeviceUnAvaible('zone2');
        }
        if (DeviceZone3IsInUse) {
          this.setDeviceUnAvaible('zone3');
        }
        this.setSettingsVolumeSliderMax(ManagerSettings.get('maxVolumeSet'), ManagerSettings.get('ReceiverVolumeStep'));
      });

      // When socket getting no data
      eiscp.on('timeout', msg => {
        this.log(`Timeout on connection: ${msg}`);
        onkyoSocketConnectionExisted = false;
        if (DeviceMainIsInUse) {
          this.setDeviceUnAvaible('main');
        }
        if (DeviceZone2IsInUse) {
          this.setDeviceUnAvaible('zone2');
        }
        if (DeviceZone3IsInUse) {
          this.setDeviceUnAvaible('zone3');
        }
      });

      // When socket is closed
      eiscp.on('close', msg => {
        this.log(`Closing connection to receiver: ${msg}`);
        onkyoSocketConnectionExisted = false;
        if (DeviceMainIsInUse) {
          this.setDeviceUnAvaible('main');
        }
        if (DeviceZone2IsInUse) {
          this.setDeviceUnAvaible('zone2');
        }
        if (DeviceZone3IsInUse) {
          this.setDeviceUnAvaible('zone3');
        }
      });

      // When socket trows a error
      eiscp.on('error', msg => {
        this.log(`ERROR: ${msg}`);
        onkyoSocketConnectionExisted = false;
        if (DeviceMainIsInUse) {
          this.setDeviceUnAvaible('main');
        }
        if (DeviceZone2IsInUse) {
          this.setDeviceUnAvaible('zone2');
        }
        if (DeviceZone3IsInUse) {
          this.setDeviceUnAvaible('zone3');
        }
      });

      // WHen socket is connected
      eiscp.on('connect', msg => {
        this.log(`Connected to receiver: ${msg}`);
        if (DeviceMainIsInUse) {
          this.setDeviceAvaible('main');
        }
        if (DeviceZone2IsInUse) {
          this.setDeviceAvaible('zone2');
        }
        if (DeviceZone3IsInUse) {
          this.setDeviceAvaible('zone3');
        }
      });

      // Socket Debug
      if (debug) {
        eiscp.on('debug', msg => {
          this.log(msg);
        });
      }


      // On socket data
      eiscp.on('data', msg => {
        this.log(`Incoming message from receiver: ${JSON.stringify(msg)}`);
        const onkyoCmdInputs = Object.values(msg);
        if (typeof onkyoCmdInputs[0] !== 'undefined') {
          if (!onkyoCmdInputs[0].includes('N/A')) {
            this.getDeviceStateFromReceiver(onkyoCmdInputs[1], onkyoCmdInputs[2], onkyoCmdInputs[3], onkyoCmdInputs[0]);

            // flowcardtrigger
            const tokens = { command: `${onkyoCmdInputs[1]}.${onkyoCmdInputs[2]}=${onkyoCmdInputs[3]}` };
            const state = { command: `${onkyoCmdInputs[1]}.${onkyoCmdInputs[2]}=${onkyoCmdInputs[3]}` };
            // trigger for receiveCustomflowTrigger
            receiveCustomflowTrigger.trigger()
              .catch(this.error);
            // Token set for received cumstom command
            this.log(`Received command for the global token : ${onkyoCmdInputs[1]}.${onkyoCmdInputs[2]}=${onkyoCmdInputs[3]}`);
            receiveCustomGlobalToken.setValue(`${onkyoCmdInputs[1]}.${onkyoCmdInputs[2]}=${onkyoCmdInputs[3]}`)
              .catch(this.error);
          } else {
            this.log('Incoming message is N/A');
          }
        } else {
          this.log('Incoming message is undefined');
        }
      });
    }
  }

  // socketconnection to receiver
  async socketConnector() {
    const socketTimer = setInterval(() => {
      if (!onkyoSocketConnectionExisted && !deviceMainIsDeleted) {
        eiscp.connect({ port: Number(ManagerSettings.get('portSettings')), host: ManagerSettings.get('ipAddressSet') });
        onkyoSocketConnectionExisted = true;
        this.log(`Trying to connect to receiver: ${ManagerSettings.get('ipAddressSet')}`);
      }
    }, 5000);
  }

  // when device is addded
  onAdded() {
    switch (this.getDeviceId()) {
      case 'main':
        DeviceMainIsInUse = true;
        this.setDeviceAvaible('main');
        break;
      case 'zone2':
        DeviceZone2IsInUse = true;
        this.setDeviceAvaible('zone2');
        break;
      case 'zone3':
        DeviceZone3IsInUse = true;
        this.setDeviceAvaible('zone3');
        break;
      default: this.log('no devices in added');
    }
    this.log(`device added: name = ${this.getName()}, id = ${this.getDeviceId()}`);
  }

  // when device is deleted
  onDeleted() {
    this.log(`device deleted: name = ${this.getName()}, id = ${this.getDeviceId()}`);
    // when deviceard main is deleted stop socketconnection
    switch (this.getDeviceId()) {
      case 'main':
        onkyoSocketConnectionExisted = false;
        deviceMainIsDeleted = true;
        eiscp.close();
        DeviceMainIsInUse = false;
        break;
      case 'zone2':
        DeviceZone2IsInUse = false;
        break;
      case 'zone3':
        DeviceZone3IsInUse = false;
        break;
      default: this.log('no devices in init');
    }
  }

  // set Available for devicecards.
  setDeviceAvaible(zoneNameId) {
    const driver = ManagerDrivers.getDriver('onkyodriver');
    const deviceNameId = driver.getDevice({ id: zoneNameId });
    deviceNameId.setAvailable();
  }

  // set UnAvailable for devicecards.
  setDeviceUnAvaible(zoneNameId) {
    const driver = ManagerDrivers.getDriver('onkyodriver');
    const deviceNameId = driver.getDevice({ id: zoneNameId });
    deviceNameId.setUnavailable();
  }

  // get the device ID
  getDeviceId() {
    const deviceID = Object.values(this.getData());
    return deviceID[0];
  }

  // Setting the maxvolume setting on volume_set capability to scale and refresh device
  async setSettingsVolumeSliderMax(maxVolumeValue, receiverVolmeStepValue) {
    if (Number(receiverVolmeStepValue) === 1) {
      this.log(`Change volumesettingslider to step: ${receiverVolmeStepValue} --MaxVolume: ${maxVolumeValue}`);
      receiverVolumeStepVar = 1;
      this.setCapabilityOptions('volume_set', {
        min: 0, max: Number(maxVolumeValue), step: 1, decimals: 0,
      });
    } else if (Number(receiverVolmeStepValue) === 0.5) {
      this.log(`Change volumesettingslider to step: ${receiverVolmeStepValue} --MaxVolume: ${maxVolumeValue}`);
      receiverVolumeStepVar = 0.5;
      this.setCapabilityOptions('volume_set', {
        min: 0, max: Number(maxVolumeValue) * 2, step: 1, decimals: 0,
      });
    }
  }

  // CapabilityListener to send commands to receiver.
  async setDeviceStateToReceiver(valueObj, deviceId) {
    let volumeDown;
    let volumeUp;
    const valueName = Object.keys(valueObj);
    this.log(`Received state change for deviceID: ${deviceId} -- capabilty: ${valueName[0]} -- value: ${valueObj[valueName]}`);
    const currentVolume = this.getCapabilityValue('volume_set');
    if (receiverVolumeStepVar === 1) {
      volumeDown = Number(currentVolume) - Number(ManagerSettings.get('volumeStepSet'));
      volumeUp = Number(currentVolume) + Number(ManagerSettings.get('volumeStepSet'));
    } else if (receiverVolumeStepVar === 0.5) {
      volumeDown = Number(currentVolume) - Number(ManagerSettings.get('volumeStepSet') * 2);
      volumeUp = Number(currentVolume) + Number(ManagerSettings.get('volumeStepSet') * 2);
    }
    switch (valueName[0]) {
      case 'onoff':
        if (valueObj[valueName]) {
          this.log(`Sending PowerON command to receiver for ${deviceId}`);
          eiscp.command(`${deviceId}.power=on`);
          this.getReceiverstate();
        } else {
          this.log(`Sending PowerOFF command to receiver for ${deviceId}`);
          eiscp.command(`${deviceId}.power=standby`);
        }
        break;

      case 'volume_mute':
        if (valueObj[valueName]) {
          this.log(`Sending MuteON command to receiver for ${deviceId}`);
          eiscp.command(`${deviceId}.muting=on`);
        } else {
          this.log(`Sending MuteOFF command to receiver for ${deviceId}`);
          eiscp.command(`${deviceId}.muting=off`);
        }
        break;

      case 'volume_up':
        this.log(`Sending VolumeUP command to receiver for ${deviceId}`);
        if (receiverVolumeStepVar === 1) {
          if (volumeUp <= ManagerSettings.get('maxVolumeSet')) {
            eiscp.command(`${deviceId}.volume=${volumeUp}`);
          } else {
            this.log('Maximum volume reached');
          }
        } else if (receiverVolumeStepVar === 0.5) {
          if (volumeUp <= ManagerSettings.get('maxVolumeSet') * 2) {
            eiscp.command(`${deviceId}.volume=${volumeUp}`);
          } else {
            this.log('Maximum volume reached');
          }
        }
        break;

      case 'volume_down':
        this.log(`Sending VolumeDOWN command to receiver for ${deviceId}`);
        if (volumeDown >= 0) {
          eiscp.command(`${deviceId}.volume=${volumeDown}`);
        }
        break;

      case 'volume_set':
        this.log(`Sending VolumeChANGE command to receiver for ${deviceId}`);
        eiscp.command(`${deviceId}.volume=${valueObj[valueName]}`);
        break;

      case 'inputset':
        this.log(`Sending InputSet command to reveiver for ${deviceId}`);
        eiscp.command(`${deviceId}.selector=${valueObj[valueName]}`);
        break;

      default: this.log('Not defined change command');
    }
  }

  // Receive from receiver for setting the capabiltysvalues.
  async getDeviceStateFromReceiver(device, command, argument, eiscpcommand) {
    const driver = ManagerDrivers.getDriver('onkyodriver');
    const deviceNameId = driver.getDevice({ id: device });
    switch (command) {
      case 'power':
        if (argument === 'on') {
          this.log(`Set powerON on devicecard: ${device}`);
          deviceNameId.setCapabilityValue('onoff', true);
        } else {
          this.log(`Set powerOFF on devicecard: ${device}`);
          deviceNameId.setCapabilityValue('onoff', false);
        }
        break;

      case 'muting':
        if (argument === 'on') {
          this.log(`Set MuteON on devicecard: ${device}`);
          deviceNameId.setCapabilityValue('volume_mute', true);
        } else {
          this.log(`Set MuteOFF on devicecard: ${device}`);
          deviceNameId.setCapabilityValue('volume_mute', false);
        }
        break;

      case 'volume':
        this.log(`Changing volume on devicecard ${device}`);
        deviceNameId.setCapabilityValue('volume_set', argument);
        break;

      case 'selector':
        this.log(`Changing input on devicecard ${device}`);
        if (typeof argument !== 'undefined') {
          deviceNameId.setCapabilityValue('inputset', argument[0]);
        }
        break;

        // bugfix when e.g. spotifyconnect NO pwrON is send by receiver and no selector
      case 'net-usb-play-status':
        this.log(`Sending powerOn ${device}`);
        eiscp.command(`${device}.power=on`);
        eiscp.command(`${device}.selector=network`);
        break;

      default: this.log('Not defined change command');
    }
  }

  // on reciverpowerOn get current status from receiver
  async getReceiverstate() {
    if (DeviceMainIsInUse) {
      eiscp.command('main.selector=query');
      eiscp.command('main.volume=query');
    }
    // only needed is devicecard zone2 or 3 are there
    if (DeviceZone2IsInUse) {
      eiscp.command('zone2.selector=query');
      eiscp.command('zone2.volume=query');
    }
    if (DeviceZone3IsInUse) {
      eiscp.command('zone3.selector=query');
      eiscp.command('zone3.volume=query');
    }
  }


}

module.exports = onkyoDevice;
