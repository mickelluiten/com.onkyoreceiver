/* eslint-disable max-len */

'use strict';

const Homey = require('homey');
const { ManagerSettings } = require('homey');
const { ManagerDrivers } = require('homey');
const eiscp = require('eiscp');

class onkyoDevice extends Homey.Device {

  async onInit() {
    this.log(`device init: name = ${this.getName()}, id = ${this.getDeviceId()}`);

    // rRegister a listener for multiple capability change event
    this.registerMultipleCapabilityListener(['onoff', 'volume_mute', 'volume_set', 'volume_down', 'volume_up', 'inputset'], valueObj => {
      this.sendDeviceStateToReceiver(valueObj, this.getDeviceId());
      return Promise.resolve();
    }, 500);

    this.setSettingsVolumeSliderMax(ManagerSettings.get('maxVolumeSet'));

    // Main zone needs always there.
    if (this.getDeviceId() === 'main') {
      // register a listener for changes in de manager settingss.
      ManagerSettings.on('set', data => {
        this.log('Manager setting is changed');
        this.log(`IP Adress:   ${ManagerSettings.get('ipAddressSet')}`);
        this.log(`Max Volume:  ${ManagerSettings.get('maxVolumeSet')}`);
        this.log(`Volume Step: ${ManagerSettings.get('volumeStepSet')}`);
        this.setSettingsVolumeSliderMax(ManagerSettings.get('maxVolumeSet'));
        if (ManagerSettings.get('ipAddressSet') !== '0.0.0.0') {
          eiscp.connect({ host: ManagerSettings.get('ipAddressSet') });
        }
      });
      if (ManagerSettings.get('ipAddressSet') !== '0.0.0.0') {
        eiscp.connect({ host: ManagerSettings.get('ipAddressSet') });
      }
      eiscp.on('data', msg => {
        this.log(`Incoming message from receiver: ${JSON.stringify(msg)}`);
        const onkyoCmdInputs = Object.values(msg);
        this.receiveDeviceStateFromReceiver(onkyoCmdInputs[0], onkyoCmdInputs[1], onkyoCmdInputs[2]);
      });
    }
  }

  // when device is addded
  onAdded() {
    this.log(`Device "${this.getName()}" is added`);
  }

  // when device is deleted
  onDeleted() {
    this.log(`Device "${this.getName()}" is deleted`);
    // when deviceard main is deleted stop socket
    if (this.getDeviceId() === 'main') {
      eiscp.close();
    }
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

  // CapabilityListener to send command to receiver.
  async sendDeviceStateToReceiver(valueObj, deviceId) {
    const valueName = Object.keys(valueObj);
    this.log(`Received state change for deviceID: ${deviceId} -- capabilty: ${valueName[0]} -- value: ${valueObj[valueName]}`);
    const currentVolume = this.getCapabilityValue('volume_set');
    const volumeDown = Number(currentVolume) - Number(ManagerSettings.get('volumeStepSet'));
    const volumeUp = Number(currentVolume) + Number(ManagerSettings.get('volumeStepSet'));
    switch (valueName[0]) {
      case 'onoff':
        if (valueObj[valueName]) {
          this.log(`Sending PowerON command to receiver for ${deviceId}`);
          eiscp.command(`${deviceId}.power=on`);
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
        if (volumeUp < ManagerSettings.get('maxVolumeSet')) {
          eiscp.command(`${deviceId}.volume=${volumeUp}`);
        } else {
          this.log('Maximum volume reached');
        }
        break;

      case 'volume_down':
        this.log(`Sending VolumeDOWN command to receiver for ${deviceId}`);
        if (volumeDown > 0) {
          eiscp.command(`${deviceId}.volume=${volumeDown}`);
        }
        break;

      case 'volume_set':
        this.log(`Sending VolumeChANGE command to receiver for ${deviceId}`);
        eiscp.command(`${deviceId}.volume=${valueObj[valueName]}`);
        break;

      case 'inputset':
        this.log(`Sending InputSet command to reveiver for ${deviceId}`);
        // eiscp.command(`${deviceId}.selector=${valueObj[valueName]}`);
        break;

      default: this.log('Not defined change command');
    }
  }

  // Receive from receiver for setting the capabiltysvalues.
  async receiveDeviceStateFromReceiver(device, command, argument) {
    const driver = ManagerDrivers.getDriver('onkyodriver');
    const deviceState = driver.getDevice({ id: device });
    switch (command) {
      case 'power':
        if (argument === 'on') {
          this.log(`Set powerON on devicecard: ${device}`);
          deviceState.setCapabilityValue('onoff', true);
        } else {
          this.log(`Set powerOFF on devicecard: ${device}`);
          deviceState.setCapabilityValue('onoff', false);
        }
        break;

      case 'muting':
        if (argument === 'on') {
          this.log(`Set MuteON on devicecard: ${device}`);
          deviceState.setCapabilityValue('volume_mute', true);
        } else {
          this.log(`Set MuteOFF on devicecard: ${device}`);
          deviceState.setCapabilityValue('volume_mute', false);
        }
        break;

      case 'volume':
        this.log(`Changing volume on devicecard ${device}`);
        deviceState.setCapabilityValue('volume_set', argument);
        break;

      case 'selector':
        this.log(`Changing input on devicecard ${device}`);
        deviceState.setCapabilityValue('input_set', argument);
        break;

      default: this.log('Not defined change command');
    }
  }

}


module.exports = onkyoDevice;
