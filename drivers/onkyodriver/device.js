'use strict';

const Homey = require('homey');
const { ManagerSettings } = require('homey');

class onkyoDevice extends Homey.Device {

  onInit() {
    this.log('Device has been inited: ', this.getName());
    // register a listener for changes in de manager settingss.
    ManagerSettings.on('set', data => {
      this.log('Manager setting is changed');
      this.log(`IP Adress:   ${ManagerSettings.get('ipAddressSet')}`);
      this.log(`Max Volume:  ${ManagerSettings.get('maxVolumeSet')}`);
      this.log(`Volume Step: ${ManagerSettings.get('volumeStepSet')}`);
      this.setSettingsVolumeSliderMax(ManagerSettings.get('maxVolumeSet'));
    });
    this.setSettingsVolumeSliderMax(ManagerSettings.get('maxVolumeSet'));
  }

  getDeviceId() {
    return this.getData().id;
  }

  // Setting the maxvolume setting on volume_set capability to scale the slider and refresh device
  async setSettingsVolumeSliderMax(maxVolumeValue) {
    this.setUnavailable();
    this.log('TEST', this.getCapabilities());
    this.setCapabilityOptions('volume_set', {
      min: 0, max: 1,
    });
    this.log(`New CapabilityOptions are: ${this.getCapabilityOptions()}`);
    this.setAvailable();
  }


  onAdded() {
    this.log(`Device "${this.getName()}" is added`);
    // this.setSettingsVolumeSliderMax();
  }


  // when device is deleted
  onDeleted() {
    this.log(`Device "${this.getName()}" is deleted`);
  }


}


module.exports = onkyoDevice;
